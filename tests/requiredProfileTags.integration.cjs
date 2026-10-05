const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {resolve} = require('node:path');
const {PGlite} = require('../.test-tools/node_modules/@electric-sql/pglite');
const read = path => readFileSync(resolve(__dirname,'..',path),'utf8');

test('tag obrigatória em novos perfis e alterações, incluindo cargos elevados', async t => {
  const db = new PGlite();
  const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
  try {
    await db.exec(`create role authenticated;create role anon;create schema auth;
      create table auth.users(id uuid primary key,email text,is_anonymous boolean default false,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema public,auth to authenticated,anon;
      alter default privileges in schema public grant select,insert,update,delete on tables to authenticated;
      create publication supabase_realtime;`);
    await db.exec(read('supabase/schema.sql').replace(/create extension if not exists pgcrypto;/i,''));
    await db.exec(read('supabase/migrations/20260925_permanent_profile_tags.sql'));
    for (const n of [1,2]) await db.query('insert into auth.users(id,email) values($1,$2)',[id(n),`user${n}@test.invalid`]);
    const migration = read('supabase/migrations/20261005_required_profile_tags.sql');
    await db.exec(migration);await db.exec(migration);
    await t.test('conta legada mantém acesso e aceita mudança de cargo ou biografia',async()=>{
      await db.query("update profiles set role='moderator',bio='Biografia nova' where id=$1",[id(1)]);
      assert.equal((await db.query('select username from profiles where id=$1',[id(1)])).rows[0].username,'user1');
    });
    await t.test('não permite retirar tag, nem deixá-la vazia, longa ou inválida',async()=>{
      for (const role of ['student','teacher','moderator','coordination']) {
        await db.query('update profiles set role=$1 where id=$2',[role,id(2)]);
        await db.query("update profiles set username='charlie#dev' where id=$1",[id(2)]);
        for (const name of ['charlie','charlie#','charlie#abcde','charlie#d_v','charlie#á',null]) {
          await assert.rejects(db.query('update profiles set username=$1 where id=$2',[name,id(2)]),{code:'22023'});
        }
        await db.query("update profiles set username='charlie#novo' where id=$1",[id(2)]);
      }
    });
    await t.test('cadastro novo exige tag e aceita a identidade informada no cadastro',async()=>{
      await assert.rejects(db.query("insert into auth.users(id,email) values($1,'sem-tag@test.invalid')",[id(3)]),{code:'22023'});
      await db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)',[id(3),'charlie@test.invalid',JSON.stringify({username:'charlie#dev'})]);
      assert.equal((await db.query('select username from profiles where id=$1',[id(3)])).rows[0].username,'charlie#dev');
    });
    await t.test('temporários continuam usando nome#tag sem expor o identificador interno',async()=>{
      await db.exec('update temporary_access_settings set registration_enabled=true');
      await db.query('insert into auth.users(id,is_anonymous,raw_user_meta_data) values($1,true,$2)',[id(4),JSON.stringify({temporary_name:'Charlie',temporary_tag:'dev'})]);
      assert.equal((await db.query('select display_name from profiles where id=$1',[id(4)])).rows[0].display_name,'Charlie#dev');
    });
  } finally {await db.close();}
});
