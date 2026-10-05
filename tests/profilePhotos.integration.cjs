const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { PGlite } = require('../.test-tools/node_modules/@electric-sql/pglite');
const read = file => readFileSync(resolve(__dirname, '..', file), 'utf8');

test('fotos de perfil: envio, privacidade, troca e remoção no PostgreSQL', async t => {
  const db = new PGlite();
  const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const a = id(1), b = id(2), temporary = id(3), pending = id(4);
  const first = `${a}/${id(10)}.jpg`, next = `${a}/${id(11)}.jpg`, guestPhoto = `${temporary}/${id(12)}.jpg`;
  async function asUser(user) {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
    await db.exec('set role authenticated');
  }
  const upload = path => db.query("insert into storage.objects(bucket_id,name) values('avatars',$1)", [path]);
  const save = path => db.query('select set_profile_avatar($1)', [path]);
  const remove = path => db.query("delete from storage.objects where bucket_id='avatars' and name=$1 returning name", [path]);
  const readPhoto = path => db.query("select name from storage.objects where bucket_id='avatars' and name=$1", [path]);
  try {
    await db.exec(`
      create role authenticated; create role anon; create schema auth;
      create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema public,auth to authenticated,anon;
      alter default privileges in schema public grant select,insert,update,delete on tables to authenticated;
      create publication supabase_realtime;
      create schema storage;
      grant usage on schema storage to authenticated,anon;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid default gen_random_uuid() primary key,bucket_id text,name text,unique(bucket_id,name));
      alter table storage.objects enable row level security;
      grant select,insert,delete on storage.objects to authenticated;
    `);
    await db.exec(read('supabase/schema.sql').replace(/create extension if not exists pgcrypto;/i, ''));
    for (const user of [a, b]) await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())", [user, `user${user.slice(-1)}@test.invalid`]);
    await db.exec('update temporary_access_settings set registration_enabled=true');
    await db.query('insert into auth.users(id,is_anonymous,raw_user_meta_data) values($1,true,$2)', [temporary, JSON.stringify({temporary_name: 'Visitante', temporary_tag: 'foto'})]);
    await db.exec(read('supabase/migrations/20261005_account_approval.sql'));
    await db.query("insert into auth.users(id,email) values($1,'pending@test.invalid')", [pending]);
    const migration = read('supabase/migrations/20261005_profile_photos.sql');
    await db.exec(migration); await db.exec(migration);
    await t.test('bucket privado aceita apenas JPEG e limita o tamanho', async () => {
      const bucket = (await db.query("select * from storage.buckets where id='avatars'")).rows[0];
      assert.equal(bucket.public, false);
      assert.equal(Number(bucket.file_size_limit), 2097152);
      assert.deepEqual(bucket.allowed_mime_types, ['image/jpeg']);
    });
    await t.test('usuário só envia para a própria pasta; não vincula URLs ou arquivo alheio', async () => {
      await asUser(a); await upload(first);
      await assert.rejects(upload(`${b}/${id(15)}.jpg`), {code: '42501'});
      await assert.rejects(upload(`${a}/foto.svg`), {code: '42501'});
      await assert.rejects(save('https://example.com/foto.jpg'), {code: '22023'});
      await assert.rejects(save(`avatars/${b}/${id(15)}.jpg`), {code: '22023'});
      await assert.rejects(save(`avatars/${a}/${id(99)}.jpg`), {code: '22023'});
      await assert.rejects(db.query("update profiles set avatar_url='indevido' where id=auth.uid()"), {code: '42501'});
    });
    await t.test('imagem não salva fica privada ao dono; imagem do perfil fica visível à comunidade', async () => {
      await asUser(b); assert.equal((await readPhoto(first)).rows.length, 0);
      await asUser(a); await save(`avatars/${first}`);
      assert.equal((await db.query('select avatar_url from profiles where id=auth.uid()')).rows[0].avatar_url, `avatars/${first}`);
      await asUser(b); assert.equal((await readPhoto(first)).rows.length, 1);
      assert.equal((await remove(first)).rows.length, 0);
    });
    await t.test('foto atual não pode ser apagada; trocar permite limpar a anterior', async () => {
      await asUser(a);
      assert.equal((await remove(first)).rows.length, 0);
      await upload(next); await save(`avatars/${next}`);
      assert.equal((await remove(first)).rows.length, 1);
      assert.equal((await remove(next)).rows.length, 0);
      await save(null);
      assert.equal((await db.query('select avatar_url from profiles where id=auth.uid()')).rows[0].avatar_url, null);
      assert.equal((await remove(next)).rows.length, 1);
    });
    await t.test('conta temporária aprovada troca apenas a foto, preservando identidade e validade', async () => {
      await asUser(temporary); await upload(guestPhoto); await save(`avatars/${guestPhoto}`);
      assert.equal((await db.query('select avatar_url from profiles where id=auth.uid()')).rows[0].avatar_url, `avatars/${guestPhoto}`);
      assert.equal((await db.query("update profiles set display_name='Outro nome' where id=auth.uid() returning id")).rows.length, 0);
      await assert.rejects(db.query("update profiles set temporary_expires_at=now()+interval '1 year' where id=auth.uid()"), {code: '42501'});
    });
    await t.test('pendente, rejeitado, expirado e anônimo não enviam, leem nem alteram fotos', async () => {
      for (const status of ['pending', 'rejected']) {
        await db.exec('reset role');
        await db.query('update profiles set approval_status=$1 where id=$2', [status, pending]);
        await asUser(pending);
        await assert.rejects(upload(`${pending}/${id(16)}.jpg`), {code: '42501'});
        await assert.rejects(save(null), {code: '42501'});
        assert.equal((await readPhoto(guestPhoto)).rows.length, 0);
      }
      await db.exec('reset role');
      await db.query("update profiles set temporary_expires_at=now()-interval '1 minute' where id=$1", [temporary]);
      await asUser(temporary);
      await assert.rejects(save(null), {code: '42501'});
      assert.equal((await readPhoto(guestPhoto)).rows.length, 0);
      await db.exec('reset role; set role anon');
      await assert.rejects(save(null), {code: '42501'});
      await assert.rejects(readPhoto(guestPhoto), {code: '42501'});
    });
  } finally { await db.close(); }
});
