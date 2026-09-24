// PostgreSQL descartável: não usa credenciais nem dados do Supabase remoto.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { PGlite } = require("../.test-tools/node_modules/@electric-sql/pglite");

test("notificações privadas e automáticas", async t => {
  const db = new PGlite();
  const id = n => "00000000-0000-4000-8000-" + String(n).padStart(12, "0");
  const [author, commenter, moderator, stranger] = [1, 2, 3, 4].map(id);
  const category = id(10), post = id(20), comment = id(30), message = id(40);
  async function asUser(user) {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
    await db.exec("set role authenticated");
  }
  const read = () => db.query("select * from notifications order by created_at");
  const mark = notification => db.query("select public.mark_notification_read($1)", [notification]);
  const notifyMigration = readFileSync(resolve(__dirname, "../supabase/migrations/20260923_notifications.sql"), "utf8");
  try {
    await db.exec(`
      create role authenticated; create role anon;
      create schema auth;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}'::jsonb);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
      $$;
      grant usage on schema public,auth to authenticated,anon;
      alter default privileges in schema public grant select,insert,update,delete on tables to authenticated;
      create publication supabase_realtime;
    `);
    const schema = readFileSync(resolve(__dirname, "../supabase/schema.sql"), "utf8");
    assert.ok(schema.includes(notifyMigration.trimEnd()));
    // Banco anterior com conteúdo existente: a migração não deve gerar alertas retroativos.
    await db.exec(schema.split("-- Notificações privadas. Execute após 20260923_content_removal.sql.")[0].replace(/create extension if not exists pgcrypto;/i, ""));
    for (const [index, user] of [author, commenter, moderator, stranger].entries()) {
      await db.query("insert into auth.users(id,email) values ($1,$2)", [user, "notify" + index + "@test.invalid"]);
    }
    await db.query("update profiles set role='moderator' where id=$1", [moderator]);
    await db.query("insert into forum_categories(id,name) values ($1,'Geral')", [category]);
    await db.query("insert into chat_rooms(id,name) values ($1,'Geral')", [category]);
    await db.query("insert into posts(id,category_id,author_id,title,content) values ($1,$2,$3,'Tópico de teste','Conteúdo de teste válido')", [post, category, author]);
    await db.query("insert into comments(post_id,author_id,content) values ($1,$2,'Comentário antigo')", [post, commenter]);
    await db.query("insert into chat_messages(id,room_id,author_id,content) values ($1,$2,$3,'Mensagem de teste')", [message, category, author]);
    await db.exec(notifyMigration);
    await db.exec(notifyMigration);

    let notification;
    await t.test("migração não notifica comentários antigos; novo comentário notifica só o dono", async () => {
      await asUser(author);
      assert.equal((await read()).rows.length, 0);
      await asUser(commenter);
      await db.query("insert into comments(id,post_id,author_id,content) values ($1,$2,$3,'Comentário novo')", [comment, post, commenter]);
      assert.equal((await read()).rows.length, 0);
      await asUser(author);
      const rows = (await read()).rows;
      assert.equal(rows.length, 1);
      notification = rows[0].id;
      assert.equal(rows[0].kind, "comment");
      assert.equal(rows[0].read_at, null);
      assert.equal(rows[0].destination, "/foruns/topico/" + post);
      assert.equal(rows[0].reason, null);
    });
    await t.test("comentários próprios e edições não geram novos alertas", async () => {
      await db.query("insert into comments(post_id,author_id,content) values ($1,$2,'Resposta do autor')", [post, author]);
      assert.equal((await read()).rows.length, 1);
      await asUser(commenter);
      await db.query("update comments set content='Comentário editado' where id=$1", [comment]);
      await asUser(author);
      assert.equal((await read()).rows.length, 1);
    });
    await t.test("nem moderador lê ou marca notificação alheia", async () => {
      for (const user of [stranger, moderator, commenter]) {
        await asUser(user);
        assert.equal((await read()).rows.length, 0);
        await mark(notification);
      }
      await asUser(author);
      assert.equal((await read()).rows[0].read_at, null);
      await mark(notification);
      const first = (await read()).rows[0].read_at;
      assert.ok(first);
      await mark(notification);
      assert.deepEqual((await read()).rows[0].read_at, first);
    });
    await t.test("não permite forjar, alterar ou excluir alertas pela API", async () => {
      await assert.rejects(db.query("update notifications set message='Forjada'"), { code: "42501" });
      await assert.rejects(db.query("update notifications set read_at=null"), { code: "42501" });
      await assert.rejects(db.query("delete from notifications"), { code: "42501" });
      await assert.rejects(db.query("insert into notifications(recipient_id,kind,source_id,target_type,target_id,destination,message) values ($1,'comment',gen_random_uuid(),'post',$2,'/chats','Forjada')", [author, post]), { code: "42501" });
    });
    await t.test("remoção e restauração dos três tipos notificam seus autores, sem identidade do denunciante", async () => {
      for (const [kind, target, recipient, reporter] of [
        ["post", post, author, stranger],
        ["comment", comment, commenter, stranger],
        ["message", message, author, stranger],
      ]) {
        await asUser(reporter);
        const report = (await db.query("select submit_report($1,$2,'Motivo privado da denúncia') as id", [kind, target])).rows[0].id;
        for (const action of ["remove", "restore"]) {
          await asUser(moderator);
          await db.query("select moderate_reported_content($1,$2,'Motivo público da decisão')", [report, action]);
          await assert.rejects(db.query("select moderate_reported_content($1,$2,'Motivo público da decisão')", [report, action]), { code: "40001" });
          await asUser(recipient);
          const rows = (await db.query("select * from notifications where target_type=$1 and target_id=$2 and kind=$3", [kind, target, action === "remove" ? "content_removed" : "content_restored"])).rows;
          assert.equal(rows.length, 1);
          assert.equal(rows[0].reason, "Motivo público da decisão");
          assert.ok(!("reporter_id" in rows[0]));
          assert.ok(!("report_id" in rows[0]));
          assert.ok(!JSON.stringify(rows[0]).includes(reporter));
          assert.ok(!JSON.stringify(rows[0]).includes("Motivo privado da denúncia"));
          if (kind === "message") assert.match(rows[0].message, action === "remove" ? /removida/ : /restaurada/);
        }
      }
      await asUser(stranger);
      assert.equal((await read()).rows.length, 0);
    });
    await t.test("desfazer transação de comentário também desfaz a notificação", async () => {
      await asUser(commenter);
      await db.exec("begin");
      await db.query("insert into comments(post_id,author_id,content) values ($1,$2,'Comentário cancelado')", [post, commenter]);
      await db.exec("rollback");
      await asUser(author);
      assert.equal((await db.query("select id from notifications where kind='comment'")).rows.length, 1);
    });
    await t.test("reaplicar migração não duplica notificações; excluir alvo mantém aviso seguro", async () => {
      await db.exec("reset role");
      const before = (await db.query("select count(*)::int as n from notifications")).rows[0].n;
      assert.equal(before, 7);
      await db.exec(notifyMigration);
      assert.equal((await db.query("select count(*)::int as n from notifications")).rows[0].n, before);
      await asUser(author);
      await db.query("delete from posts where id=$1", [post]);
      assert.equal((await read()).rows.length, 5);
    });
    await t.test("anônimos não acessam dados, marcação nem funções de geração", async () => {
      await db.exec("reset role; set role anon");
      await assert.rejects(read(), { code: "42501" });
      await assert.rejects(mark(notification), { code: "42501" });
      await assert.rejects(db.query("select notify_post_comment()"), { code: "42501" });
      await assert.rejects(db.query("select notify_content_moderation()"), { code: "42501" });
    });
  } finally { await db.close(); }
});
