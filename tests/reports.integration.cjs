// PostgreSQL local descartável; não acessa o Supabase remoto.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { PGlite } = require("../.test-tools/node_modules/@electric-sql/pglite");

test("denúncias: envio e análise com permissões reais", async t => {
  const db = new PGlite();
  const id = n => "00000000-0000-4000-8000-" + String(n).padStart(12, "0");
  const [student, author, teacher, moderator, coordination] = [1, 2, 3, 4, 5].map(id);
  async function asUser(user) {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user]);
    await db.exec("set role authenticated");
  }
  const submit = (kind = "post", target = id(20), reason = "Conteúdo impróprio para a comunidade") =>
    db.query("select public.submit_report($1,$2,$3) as id", [kind, target, reason]);
  const review = (report, status = "resolved") => db.query("select public.review_report($1,$2)", [report, status]);
  let report;
  try {
    await db.exec(`
      create role authenticated;
      create role anon;
      create schema auth;
      create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      grant usage on schema public, auth to authenticated, anon;
      alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
      create publication supabase_realtime;
    `);
    const removalMigration = readFileSync(resolve(__dirname, "../supabase/migrations/20260923_content_removal.sql"), "utf8");
    const schema = readFileSync(resolve(__dirname, "../supabase/schema.sql"), "utf8");
    assert.ok(schema.includes(removalMigration.trimEnd()), "schema completo deve incluir a migração de remoção");
    // Simula atualização de banco existente, com conteúdo criado antes da migração.
    await db.exec(schema.split("-- Execute após 20260923_reports.sql. Remoção lógica")[0].replace(/create extension if not exists pgcrypto;/i, ""));
    await db.exec(readFileSync(resolve(__dirname, "../supabase/migrations/20260923_reports.sql"), "utf8"));
    for (const [index, user] of [student, author, teacher, moderator, coordination].entries()) {
      await db.query("insert into auth.users(id,email) values ($1,$2)", [user, "report" + index + "@test.invalid"]);
    }
    for (const [user, role] of [[teacher, "teacher"], [moderator, "moderator"], [coordination, "coordination"]]) {
      await db.query("update profiles set role=$2 where id=$1", [user, role]);
    }
    for (const [category, visibility] of [[id(10), "everyone"], [id(11), "moderation"]]) {
      await db.query("insert into forum_categories(id,name,visibility) values ($1,$2,$3)", [category, category, visibility]);
      await db.query("insert into chat_rooms(id,name,visibility) values ($1,$2,$3)", [category, category, visibility]);
    }
    for (const [target, category] of [[id(20), id(10)], [id(21), id(11)]]) {
      await db.query("insert into posts(id,category_id,author_id,title,content) values ($1,$2,$3,'Título de teste','Conteúdo original de teste')", [target, category, author]);
      await db.query("insert into comments(id,post_id,author_id,content) values ($1,$1,$2,'Comentário original')", [target, author]);
      await db.query("insert into chat_messages(id,room_id,author_id,content) values ($1,$2,$3,'Mensagem original')", [target, category, author]);
    }
    await db.exec(removalMigration);
    await db.exec(removalMigration); // Reaplicação mantém dados e políticas.
    await t.test("envia os três tipos, mas não pode ler nem forjar a fila", async () => {
      await asUser(student);
      report = (await submit()).rows[0].id;
      await submit("comment");
      await submit("message");
      assert.equal((await db.query("select * from reports")).rows.length, 0);
      await assert.rejects(db.query("insert into reports(reporter_id,target_type,target_id,reason,status) values ($1,'post',$2,'Forjada','resolved')", [student, id(20)]), { code: "42501" });
      await assert.rejects(db.query("update reports set status='resolved'"), { code: "42501" });
      await assert.rejects(db.query("delete from reports"), { code: "42501" });
    });
    await t.test("rejeita duplicação, campos inválidos e motivo vazio/longo", async () => {
      await assert.rejects(submit(), { code: "23505" });
      for (const reason of ["curto", " ".repeat(30), "x".repeat(2001), null]) {
        await assert.rejects(submit("post", id(20), reason), { code: "22023" });
      }
      await assert.rejects(submit("profile"), { code: "22023" });
      await assert.rejects(submit(null), { code: "22023" });
      await assert.rejects(submit("post", null), { code: "22023" });
    });
    await t.test("não denuncia conteúdo próprio, inexistente ou sem acesso, nos três tipos", async () => {
      for (const kind of ["post", "comment", "message"]) {
        await asUser(student);
        await assert.rejects(submit(kind, id(21)), { code: "42501" });
        await assert.rejects(submit(kind, id(999)), { code: "42501" });
        await asUser(author);
        await assert.rejects(submit(kind), { code: "42501" });
      }
    });
    await t.test("aluno e professor não analisam nem consultam denúncias", async () => {
      for (const user of [student, teacher]) {
        await asUser(user);
        assert.equal((await db.query("select * from reports")).rows.length, 0);
        await assert.rejects(review(report), { code: "42501" });
      }
    });
    await t.test("moderador vê o trecho e registra decisão com autoria e data", async () => {
      await asUser(moderator);
      const queue = (await db.query("select * from reports")).rows;
      assert.equal(queue.length, 3);
      const item = queue.find(row => row.id === report);
      assert.equal(item.reporter_id, student);
      assert.match(item.target_excerpt, /Conteúdo original/);
      assert.equal(item.target_path, "/foruns/topico/" + id(20));
      await assert.rejects(review(report, "pending"), { code: "22023" });
      await assert.rejects(review(report, null), { code: "22023" });
      await review(report);
      const resolved = (await db.query("select * from reports where id=$1", [report])).rows[0];
      assert.equal(resolved.status, "resolved");
      assert.equal(resolved.reviewed_by, moderator);
      assert.ok(resolved.reviewed_at);
      await assert.rejects(review(report, "dismissed"), { code: "P0002" });
      await assert.rejects(db.query("update reports set reason='Alterada'"), { code: "42501" });
    });
    await t.test("coordenação descarta; encerramento não altera o conteúdo", async () => {
      await asUser(coordination);
      const commentReport = (await db.query("select id from reports where target_type='comment'")).rows[0].id;
      await review(commentReport, "dismissed");
      assert.equal((await db.query("select status from reports where id=$1", [commentReport])).rows[0].status, "dismissed");
      assert.equal((await db.query("select content from comments where id=$1", [id(20)])).rows[0].content, "Comentário original");
    });
    const moderateContent = (reportId, action = "remove", reason = "Motivo detalhado da decisão") =>
      db.query("select public.moderate_reported_content($1,$2,$3)", [reportId, action, reason]);
    const reportState = reportId => db.query("select public.reported_content_state($1) as removed", [reportId]);
    const contentReports = {};
    await t.test("somente equipe pode remover, restaurar e consultar auditoria", async () => {
      await asUser(moderator);
      for (const row of (await db.query("select id,target_type from reports")).rows) contentReports[row.target_type] = row.id;
      for (const user of [student, teacher, author]) {
        await asUser(user);
        await assert.rejects(moderateContent(report), { code: "42501" });
        await assert.rejects(moderateContent(report, "restore"), { code: "42501" });
        await assert.rejects(reportState(report), { code: "42501" });
        assert.equal((await db.query("select * from content_moderation_events")).rows.length, 0);
      }
      await db.exec("reset role; set role anon");
      await assert.rejects(moderateContent(report), { code: "42501" });
      await assert.rejects(reportState(report), { code: "42501" });
    });
    await t.test("remoção valida motivo, ação e existência sem registrar falso sucesso", async () => {
      await asUser(moderator);
      for (const reason of ["", "curto", " ".repeat(30), "x".repeat(2001), null]) {
        await assert.rejects(moderateContent(report, "remove", reason), { code: "22023" });
      }
      await assert.rejects(moderateContent(report, "delete"), { code: "22023" });
      await assert.rejects(moderateContent(id(999)), { code: "P0002" });
      assert.equal((await db.query("select * from content_moderation_events")).rows.length, 0);
    });
    await t.test("remoção dos três tipos oculta conteúdo até do autor e protege alterações diretas", async () => {
      for (const [kind, table] of [["comment", "comments"], ["message", "chat_messages"], ["post", "posts"]]) {
        await asUser(moderator);
        await moderateContent(contentReports[kind]);
        assert.equal((await reportState(contentReports[kind])).rows[0].removed, true);
        await assert.rejects(moderateContent(contentReports[kind]), { code: "40001" });
        for (const user of [student, author, moderator]) {
          await asUser(user);
          assert.equal((await db.query("select id from " + table + " where id=$1", [id(20)])).rows.length, 0);
          await assert.rejects(db.query("update " + table + " set is_removed=false where id=$1", [id(20)]), { code: "42501" });
        }
        await asUser(author);
        assert.equal((await db.query("update " + table + " set content='Alteração indevida de teste' where id=$1 returning id", [id(20)])).rows.length, 0);
        assert.equal((await db.query("delete from " + table + " where id=$1 returning id", [id(20)])).rows.length, 0);
        await asUser(student);
        await assert.rejects(submit(kind), { code: "42501" });
      }
      await asUser(author);
      await assert.rejects(db.query("insert into posts(category_id,author_id,title,content,is_removed) values ($1,$2,'Título de teste','Conteúdo de teste',true)", [id(10), author]), { code: "42501" });
      await assert.rejects(db.query("insert into comments(post_id,author_id,content) values ($1,$2,'Resposta nova')", [id(20), author]), { code: "42501" });
    });
    await t.test("restaurar tópico não restaura comentário removido; cascata não pode apagar esse comentário", async () => {
      await asUser(coordination);
      await moderateContent(report, "restore");
      await asUser(author);
      assert.equal((await db.query("select id from posts where id=$1", [id(20)])).rows.length, 1);
      assert.equal((await db.query("select id from comments where id=$1", [id(20)])).rows.length, 0);
      assert.equal((await db.query("delete from posts where id=$1 returning id", [id(20)])).rows.length, 0);
      await asUser(coordination);
      await moderateContent(contentReports.comment, "restore");
      await moderateContent(contentReports.message, "restore");
      await assert.rejects(moderateContent(report, "restore"), { code: "40001" });
      await asUser(student);
      assert.equal((await db.query("select content from comments where id=$1", [id(20)])).rows[0].content, "Comentário original");
      assert.equal((await db.query("select content from chat_messages where id=$1", [id(20)])).rows[0].content, "Mensagem original");
    });
    await t.test("tópico removido oculta também comentários não removidos individualmente", async () => {
      await asUser(moderator);
      await moderateContent(report);
      await asUser(student);
      assert.equal((await db.query("select id from comments where id=$1", [id(20)])).rows.length, 0);
      await assert.rejects(submit("comment"), { code: "42501" });
      await asUser(author);
      assert.equal((await db.query("delete from comments where id=$1 returning id", [id(20)])).rows.length, 0);
      await asUser(moderator);
      await moderateContent(report, "restore");
    });
    await t.test("edição existente de comentário e mensagem continua funcionando após restaurar", async () => {
      await asUser(author);
      for (const table of ["comments", "chat_messages"]) {
        const result = await db.query("update " + table + " set content=content, updated_at=now() where id=$1 returning id", [id(20)]);
        assert.equal(result.rows.length, 1);
      }
    });
    await t.test("histórico preserva ator, motivo e sequência sem permitir adulteração", async () => {
      await asUser(moderator);
      const history = (await db.query("select * from content_moderation_events order by created_at")).rows;
      assert.equal(history.length, 8);
      assert.equal(history[0].actor_id, moderator);
      assert.equal(history[0].reason, "Motivo detalhado da decisão");
      assert.equal(history[0].action, "remove");
      assert.ok(history[0].actor_name);
      assert.ok(history[0].created_at);
      await assert.rejects(db.query("delete from content_moderation_events"), { code: "42501" });
      await assert.rejects(db.query("update content_moderation_events set reason='Forjada'"), { code: "42501" });
      await assert.rejects(db.query("insert into content_moderation_events(target_type,target_id,action,reason,actor_id,actor_name) values ('post',$1,'remove','Motivo forjado',$2,'Forjado')", [id(20), moderator]), { code: "42501" });
      assert.equal((await db.query("select status from reports where id=$1", [report])).rows[0].status, "resolved");
    });
    await t.test("snapshot persiste após edição e exclusão do alvo", async () => {
      await asUser(author);
      await db.query("update posts set content='Conteúdo alterado posteriormente' where id=$1", [id(20)]);
      await db.query("delete from posts where id=$1", [id(20)]);
      await asUser(moderator);
      const preserved = (await db.query("select target_excerpt from reports where id=$1", [report])).rows[0];
      assert.match(preserved.target_excerpt, /Conteúdo original/);
      assert.equal((await db.query("select count(*)::int as total from reports")).rows[0].total, 3);
      assert.equal((await reportState(report)).rows[0].removed, null);
      await assert.rejects(moderateContent(report, "restore"), { code: "P0002" });
      assert.equal((await db.query("select * from content_moderation_events")).rows.length, 8);
    });
    await t.test("limite por hora também é aplicado no banco", async () => {
      await db.exec("reset role");
      await db.query("insert into reports(reporter_id,target_type,target_id,reason) select $1,'post',gen_random_uuid(),'Motivo de teste' from generate_series(1,20)", [teacher]);
      await asUser(teacher);
      await assert.rejects(submit("message"), { code: "P0001" });
    });
    await t.test("anônimo não envia, consulta nem analisa", async () => {
      await db.exec("reset role; set role anon");
      await assert.rejects(submit("message"), { code: "42501" });
      await assert.rejects(review(report), { code: "42501" });
      await assert.rejects(db.query("select * from reports"), { code: "42501" });
    });
  } finally {
    await db.close();
  }
});
