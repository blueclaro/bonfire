// Banco descartável em memória. Não usa .env.local nem acessa Supabase remoto.
// Instalação: npm install --prefix .test-tools --no-save --package-lock=false @electric-sql/pglite
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { PGlite } = require("../.test-tools/node_modules/@electric-sql/pglite");

test("permissões de moderação em PostgreSQL", async t => {
  const db = new PGlite();
  const student = "00000000-0000-4000-8000-000000000001";
  const teacher = "00000000-0000-4000-8000-000000000002";
  const moderator = "00000000-0000-4000-8000-000000000003";
  const coordination = "00000000-0000-4000-8000-000000000004";
  const category = "00000000-0000-4000-8000-000000000010";
  const post = "00000000-0000-4000-8000-000000000020";
  async function asUser(id) {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
    await db.exec("set role authenticated");
  }
  const moderate = (action, enabled, id = post) => db.query(
    "select * from public.moderate_post($1, $2, $3)", [id, action, enabled]);
  const insertComment = () => db.query(
    "insert into public.comments(post_id, author_id, content) values ($1, auth.uid(), 'Resposta de teste')", [post]);
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
    // gen_random_uuid é nativa; a extensão pgcrypto não é usada pelo código sob teste.
    const schema = readFileSync(resolve(__dirname, "../supabase/schema.sql"), "utf8")
      .replace(/create extension if not exists pgcrypto;/i, "");
    await db.exec(schema);
    const migration = readFileSync(resolve(__dirname, "../supabase/migrations/20260921_posts_moderation.sql"), "utf8");
    await db.exec(migration); // Reaplicar também precisa funcionar.
    for (const [index, id] of [student, teacher, moderator, coordination].entries()) {
      await db.query("insert into auth.users(id, email) values ($1, $2)", [id, "user" + index + "@test.invalid"]);
    }
    await db.query("update public.profiles set role='teacher' where id=$1", [teacher]);
    await db.query("update public.profiles set role='moderator' where id=$1", [moderator]);
    await db.query("update public.profiles set role='coordination' where id=$1", [coordination]);
    await db.query("insert into public.forum_categories(id, name) values ($1, 'Geral')", [category]);
    await db.query("insert into public.posts(id, category_id, author_id, title, content) values ($1,$2,$3,'Título original','Conteúdo original do tópico')", [post, category, student]);

    await t.test("aluno e professor não moderam nem criam tópico com flags", async () => {
      for (const id of [student, teacher]) {
        await asUser(id);
        await assert.rejects(moderate("pin", true), { code: "42501" });
        await assert.rejects(moderate("lock", true), { code: "42501" });
        await assert.rejects(db.query("insert into public.posts(category_id, author_id, title, content, is_pinned) values ($1, auth.uid(), 'Título válido', 'Conteúdo longo válido', true)", [category]), { code: "42501" });
        await assert.rejects(db.query("insert into public.posts(category_id, author_id, title, content, is_locked) values ($1, auth.uid(), 'Título válido', 'Conteúdo longo válido', true)", [category]), { code: "42501" });
        await assert.rejects(db.query("update public.posts set is_locked=true where id=$1", [post]), { code: "42501" });
      }
    });
    await t.test("autor edita texto mas não se promove", async () => {
      await asUser(student);
      const result = await db.query("update public.posts set title='Título editado' where id=$1 returning title", [post]);
      assert.equal(result.rows[0].title, "Título editado");
      await assert.rejects(db.query("update public.profiles set role='moderator' where id=$1", [student]), { code: "42501" });
    });
    await t.test("moderador fixa tópico alheio sem poder alterar seu texto", async () => {
      await asUser(moderator);
      const pinned = await moderate("pin", true);
      assert.equal(pinned.rows[0].is_pinned, true);
      const edit = await db.query("update public.posts set title='Texto indevido' where id=$1 returning id", [post]);
      assert.equal(edit.rows.length, 0);
      const result = await db.query("select title from public.posts where id=$1", [post]);
      assert.equal(result.rows[0].title, "Título editado");
    });
    await t.test("bloqueio impede novos comentários de aluno e equipe; reabrir permite", async () => {
      await asUser(student);
      await insertComment();
      await asUser(moderator);
      await moderate("lock", true);
      for (const id of [student, teacher, moderator]) {
        await asUser(id);
        await assert.rejects(insertComment(), { code: "42501" });
      }
      await asUser(coordination);
      const unlocked = await moderate("lock", false);
      assert.equal(unlocked.rows[0].is_locked, false);
      assert.equal(unlocked.rows[0].is_pinned, true);
      const unpinned = await moderate("pin", false);
      assert.equal(unpinned.rows[0].is_pinned, false);
      await asUser(student);
      await insertComment();
      const count = await db.query("select count(*)::int as total from public.comments where post_id=$1", [post]);
      assert.equal(count.rows[0].total, 2);
    });
    await t.test("ações inválidas e tópicos ausentes retornam erro", async () => {
      await asUser(moderator);
      await assert.rejects(moderate("delete", true), { code: "22023" });
      await assert.rejects(moderate("pin", null), { code: "22023" });
      await assert.rejects(moderate("pin", true, "00000000-0000-4000-8000-000000000099"), { code: "P0002" });
    });
    await t.test("fixar prioriza tópico antigo; desafixar restaura a ordem", async () => {
      await asUser(student);
      const newer = await db.query("insert into public.posts(category_id, author_id, title, content) values ($1, auth.uid(), 'Tópico mais novo', 'Conteúdo do novo tópico') returning id", [category]);
      const first = async () => (await db.query("select id from public.posts where category_id=$1 order by is_pinned desc, created_at desc, id desc limit 1", [category])).rows[0].id;
      assert.equal(await first(), newer.rows[0].id);
      await asUser(moderator);
      await moderate("pin", true);
      assert.equal(await first(), post);
      await moderate("pin", false);
      assert.equal(await first(), newer.rows[0].id);
      const deleted = await db.query("delete from public.posts where id=$1 returning id", [post]);
      assert.equal(deleted.rows.length, 0);
    });
    await t.test("anônimo não executa a função", async () => {
      await db.exec("reset role; set role anon");
      await assert.rejects(moderate("pin", true), { code: "42501" });
    });
  } finally {
    await db.close();
  }
});
