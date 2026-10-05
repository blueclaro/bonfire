const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { PGlite } = require('../.test-tools/node_modules/@electric-sql/pglite');
const read = path => readFileSync(resolve(__dirname, '..', path), 'utf8');

test('aprovação de contas: fila, decisões e bloqueio no PostgreSQL', async t => {
  const db = new PGlite();
  const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const student = id(1), moderator = id(2), teacher = id(3), coordination = id(4);
  const pending = id(5), unverified = id(6), guest = id(7), rejected = id(8), category = id(10), post = id(20);
  async function asUser(user) {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
    await db.exec('set role authenticated');
  }
  async function create(user, verified = true) {
    await db.query("insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,$3,$4)",
      [user, `user${user.slice(-2)}@test.invalid`, verified ? new Date().toISOString() : null,
        JSON.stringify({username: `user${user.slice(-2)}#test`, full_name: 'Pessoa de teste', approval_status: 'approved', role: 'moderator'})]);
  }
  const review = (user, decision = 'approved', reason = '') => db.query('select review_account($1,$2,$3)', [user, decision, reason]);
  try {
    await db.exec(`
      create role authenticated; create role anon; create schema auth;
      create table auth.users(id uuid primary key,email varchar(255),email_confirmed_at timestamptz,
        is_anonymous boolean not null default false,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
      $$;
      grant usage on schema public,auth to authenticated,anon;
      alter default privileges in schema public grant select,insert,update,delete on tables to authenticated;
      create publication supabase_realtime;
    `);
    await db.exec(read('supabase/schema.sql').replace(/create extension if not exists pgcrypto;/i, ''));
    for (const user of [student, moderator, teacher, coordination]) await create(user);
    await db.query("update profiles set role='moderator' where id=$1", [moderator]);
    await db.query("update profiles set role='teacher' where id=$1", [teacher]);
    await db.query("update profiles set role='coordination' where id=$1", [coordination]);
    await db.query("insert into forum_categories(id,name) values($1,'Geral')", [category]);
    await db.query("insert into posts(id,category_id,author_id,title,content) values($1,$2,$3,'Tópico de teste','Conteúdo do tópico de teste')", [post, category, student]);
    for (const name of ['20260924_social_feed','20260925_social_connections_threads','20260925_permanent_profile_tags','20260925_user_chat_groups','20260925_staff_remove_sparks']) {
      await db.exec(read(`supabase/migrations/${name}.sql`));
    }
    const migration = read('supabase/migrations/20261005_account_approval.sql');
    await db.exec(migration);
    await create(pending); await create(unverified, false); await create(rejected);
    await db.exec('update temporary_access_settings set registration_enabled=true');
    await db.query("insert into auth.users(id,is_anonymous,raw_user_meta_data) values($1,true,$2)",
      [guest, JSON.stringify({temporary_name: 'Visitante', temporary_tag: 'test', approval_status: 'approved'})]);
    await db.exec(migration);

    await t.test('correção isolada resolve a incompatibilidade varchar do Supabase sem recriar contas', async () => {
      const oldDefinition = migration.match(/create or replace function public\.account_review_queue\([\s\S]*?end; \$\$;/)[0].replace('u.email::text', 'u.email');
      await db.exec(oldDefinition);
      await asUser(moderator);
      await assert.rejects(db.query('select * from account_review_queue()'), {code: '42804'});
      await db.exec('reset role');
      const repair = read('supabase/migrations/20261005_fix_account_review_queue.sql');
      await db.exec(repair); await db.exec(repair);
      await asUser(moderator);
      assert.equal((await db.query('select * from account_review_queue()')).rows.length, 4);
    });

    await t.test('preserva contas existentes e reaplicar não aprova novos cadastros', async () => {
      await asUser(student);
      assert.equal((await db.query('select account_is_active() as active')).rows[0].active, true);
      await asUser(pending);
      const own = (await db.query('select approval_status from profiles where id=auth.uid()')).rows[0];
      assert.equal(own.approval_status, 'pending');
      assert.equal((await db.query('select id from profiles')).rows.length, 1);
      assert.equal((await db.query('select account_is_active() as active')).rows[0].active, false);
    });
    await t.test('pendentes não leem conteúdo, publicam, editam perfil ou usam funções privilegiadas', async () => {
      for (const user of [pending, guest]) {
        await asUser(user);
        for (const table of ['posts','comments','chat_rooms','chat_messages','announcements','reports','notifications','post_reactions','profile_follows','chat_room_members','direct_messages']) {
          assert.equal((await db.query(`select * from ${table}`)).rows.length, 0);
        }
        await assert.rejects(db.query("insert into posts(category_id,author_id,title,content) values($1,auth.uid(),'Novo tópico válido','Conteúdo do tópico válido')", [category]), {code: '42501'});
        assert.equal((await db.query("update profiles set display_name='Novo nome' where id=auth.uid() returning id")).rows.length, 0);
        await assert.rejects(db.query("update profiles set approval_status='approved' where id=auth.uid()"), {code: '42501'});
        await assert.rejects(db.query("select submit_report('post',$1,'Motivo de denúncia válido')", [post]), {code: '42501'});
        await assert.rejects(db.query("select create_chat_group('Grupo de teste','Descrição',false,'{}'::uuid[])"), {code: '42501'});
      }
    });
    await t.test('aluno e professor não podem consultar a fila nem aprovar', async () => {
      for (const user of [student, teacher]) {
        await asUser(user);
        await assert.rejects(db.query('select * from account_review_queue()'), {code: '42501'});
        await assert.rejects(review(pending), {code: '42501'});
      }
    });
    await t.test('moderador consulta e-mail da fila e só aprova após confirmação', async () => {
      await asUser(moderator);
      const queue = (await db.query('select * from account_review_queue()')).rows;
      assert.equal(queue.length, 4);
      assert.equal(queue.find(row => row.id === unverified).email_verified, false);
      await assert.rejects(review(unverified), {code: '22023'});
      await assert.rejects(review(moderator), {code: '42501'});
      await review(pending);
      await assert.rejects(review(pending), {code: 'P0002'});
      await asUser(pending);
      assert.equal((await db.query('select account_is_active() as active')).rows[0].active, true);
      assert.equal((await db.query('select id from posts')).rows.length, 1);
      // Reproduz a falha da versão antiga: SELECT * pede decisões privadas.
      await assert.rejects(db.query('select * from profiles where id=auth.uid()'), {code: '42501'});
      const profile = await db.query('select id,username,display_name,role,class_name,avatar_url,bio,school_label,temporary_expires_at from profiles where id=auth.uid()');
      assert.equal(profile.rows[0].id, pending);
      const edited = await db.query("update profiles set display_name='Nome atualizado' where id=auth.uid() returning id,username,display_name,role,class_name,avatar_url,bio,school_label,temporary_expires_at");
      assert.equal(edited.rows[0].display_name, 'Nome atualizado');
    });
    await t.test('coordenação rejeita com motivo e registra responsável', async () => {
      await asUser(coordination);
      await assert.rejects(review(rejected, 'rejected', 'curto'), {code: '22023'});
      await review(rejected, 'rejected', 'Identidade não reconhecida pela escola.');
      await asUser(rejected);
      const own = (await db.query('select my_account_approval() as approval')).rows[0].approval;
      assert.equal(own.approval_status, 'rejected');
      assert.equal(own.approval_reason, 'Identidade não reconhecida pela escola.');
      assert.equal((await db.query('select id from posts')).rows.length, 0);
      await asUser(coordination);
      const record = (await db.query("select * from account_review_queue('rejected')")).rows[0];
      assert.ok(record.approval_reviewed_at);
      assert.equal(record.reviewer_name, 'Pessoa de teste');
      await db.exec('reset role');
      assert.equal((await db.query('select approval_reviewed_by from profiles where id=$1', [rejected])).rows[0].approval_reviewed_by, coordination);
      await asUser(student);
      await assert.rejects(db.query('select approval_reason from profiles where id=$1', [rejected]), {code: '42501'});
      assert.equal((await db.query('select my_account_approval() as approval')).rows[0].approval.approval_reason, null);
    });
    await t.test('cargos elevados não contornam a aprovação nem moderam por RPC', async () => {
      await db.exec('reset role');
      await db.query("update profiles set role='moderator' where id=$1", [unverified]);
      await asUser(unverified);
      for (const query of ["select review_report($1,'resolved')", 'select reported_content_state($1)',
        "select moderate_reported_content($1,'remove','Motivo de teste válido')", "select moderate_post($1,'pin',true)",
        "select staff_remove_post($1,'Motivo de teste válido')"]) {
        await assert.rejects(db.query(query, [post]), {code: '42501'});
      }
      await assert.rejects(review(guest), {code: '42501'});
    });
    await t.test('temporárias precisam de aprovação e continuam sujeitas à expiração', async () => {
      await asUser(moderator); await review(guest);
      await asUser(guest);
      assert.equal((await db.query('select account_is_active() as active')).rows[0].active, true);
      await db.exec('reset role');
      await db.query("update profiles set temporary_expires_at=now()-interval '1 minute' where id=$1", [guest]);
      await asUser(guest);
      assert.equal((await db.query('select account_is_active() as active')).rows[0].active, false);
    });
    await t.test('denúncias continuam permitindo remover, restaurar e resolver após a nova aprovação', async () => {
      await asUser(pending);
      const report = (await db.query("select submit_report('post',$1,'Motivo de denúncia válido') as id", [post])).rows[0].id;
      await asUser(moderator);
      assert.equal((await db.query('select reported_content_state($1) as removed', [report])).rows[0].removed, false);
      await db.query("select moderate_reported_content($1,'remove','Motivo de remoção válido')", [report]);
      assert.equal((await db.query('select reported_content_state($1) as removed', [report])).rows[0].removed, true);
      await db.query("select moderate_reported_content($1,'restore','Motivo de restauração válido')", [report]);
      await db.query("select review_report($1,'resolved')", [report]);
      assert.equal((await db.query('select status from reports where id=$1', [report])).rows[0].status, 'resolved');
    });
    await t.test('anônimo não consulta cadastros nem toma decisões', async () => {
      await db.exec('reset role; set role anon');
      await assert.rejects(db.query('select * from account_review_queue()'), {code: '42501'});
      await assert.rejects(review(unverified), {code: '42501'});
    });
  } finally { await db.close(); }
});
