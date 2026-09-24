const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { PGlite } = require("../.test-tools/node_modules/@electric-sql/pglite");

test("contas temporárias: identidade, acesso e expiração no banco", async t => {
  const db = new PGlite();
  const id = n => "00000000-0000-4000-8000-" + String(n).padStart(12, "0");
  const regular = id(1), guest = id(2), category = id(10), privateCategory = id(11);
  async function asUser(user) {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
    await db.exec("set role authenticated");
  }
  const create = (user, name = "CharlieLegal", tag = "bubu") =>
    db.query("insert into auth.users(id,is_anonymous,raw_user_meta_data) values ($1,true,$2)", [user, JSON.stringify({temporary_name:name,temporary_tag:tag,role:"moderator",class_name:"Secreta",temporary_expires_at:"2099-01-01"})]);
  try {
    await db.exec(`
      create role authenticated; create role anon; create schema auth;
      create table auth.users(id uuid primary key,email text,is_anonymous boolean not null default false,raw_user_meta_data jsonb default '{}'::jsonb);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
      $$;
      grant usage on schema public,auth to authenticated,anon;
      alter default privileges in schema public grant select,insert,update,delete on tables to authenticated;
      create publication supabase_realtime;
    `);
    const schema = readFileSync(resolve(__dirname,"../supabase/schema.sql"),"utf8");
    const migration = readFileSync(resolve(__dirname,"../supabase/migrations/20260923_temporary_accounts.sql"),"utf8");
    assert.ok(schema.trimEnd().endsWith(migration.trimEnd()));
    await db.exec(schema.replace(/create extension if not exists pgcrypto;/i,""));
    await db.query("insert into auth.users(id,email) values ($1,'regular@test.invalid')",[regular]);
    await db.query("insert into forum_categories(id,name) values ($1,'Público')",[category]);
    await db.query("insert into forum_categories(id,name,visibility,class_name) values ($1,'Privado','class','Secreta')",[privateCategory]);
    await db.query("insert into chat_rooms(id,name) values ($1,'Chat público')",[category]);
    await db.query("insert into posts(id,category_id,author_id,title,content) values ($1,$2,$3,'Tópico existente','Conteúdo existente de teste')",[id(20),category,regular]);
    await t.test("entrada fechada bloqueia criação e público só consulta status",async()=>{
      await assert.rejects(create(guest),{code:"42501"});
      assert.equal((await db.query("select count(*)::int as n from auth.users where id=$1",[guest])).rows[0].n,0);
      await db.exec("set role anon");
      assert.equal((await db.query("select temporary_access_status() as status")).rows[0].status.enabled,false);
      await assert.rejects(db.query("update temporary_access_settings set registration_enabled=true"),{code:"42501"});
      await db.exec("reset role");
      await db.exec("update temporary_access_settings set registration_enabled=true");
    });
    await t.test("nome e tag são validados no servidor; tag é exclusiva ignorando caixa",async()=>{
      for (const tag of ["","com espaço","bubu#","ábc","_teste","a".repeat(17)]) {
        await assert.rejects(create(id(3),"Nome",tag),{code:"22023"});
      }
      await assert.rejects(create(id(3),"A#B","valida"),{code:"22023"});
      await create(guest);
      await assert.rejects(create(id(3),"OutraPessoa","BUBU"),{code:"23505"});
      const profile=(await db.query("select * from profiles where id=$1",[guest])).rows[0];
      assert.equal(profile.display_name,"CharlieLegal#bubu");
      assert.equal(profile.role,"student");
      assert.equal(profile.class_name,null);
      const remaining=(new Date(profile.temporary_expires_at).getTime()-Date.now())/3600000;
      assert.ok(remaining>23.9 && remaining<=24.1);
    });
    await t.test("participante publica, comenta e conversa; não entra em turma restrita",async()=>{
      await asUser(guest);
      assert.equal((await db.query("select id from forum_categories where id=$1",[privateCategory])).rows.length,0);
      await db.query("insert into posts(id,category_id,author_id,title,content) values ($1,$2,auth.uid(),'Meu tópico temporário','Conteúdo público de teste')",[id(21),category]);
      await db.query("insert into comments(post_id,author_id,content) values ($1,auth.uid(),'Comentário de teste')",[id(20)]);
      await db.query("insert into chat_messages(room_id,author_id,content) values ($1,auth.uid(),'Olá comunidade')",[category]);
      await assert.rejects(db.query("insert into posts(category_id,author_id,title,content) values ($1,auth.uid(),'Teste indevido','Conteúdo da turma privada')",[privateCategory]),{code:"42501"});
      assert.equal((await db.query("select id from posts where id=$1",[id(21)])).rows.length,1);
    });
    await t.test("não altera identidade, validade, função nem configuração; sem moderação",async()=>{
      assert.equal((await db.query("update profiles set display_name='Administrador' where id=auth.uid() returning id")).rows.length,0);
      for(const column of ["role='moderator'","temporary_expires_at=now()+interval '1 year'","temporary_tag='outra'"]) {
        await assert.rejects(db.query("update profiles set "+column+" where id=auth.uid()"),{code:"42501"});
      }
      await assert.rejects(db.query("select moderate_post($1,'lock',true)",[id(20)]),{code:"42501"});
      await assert.rejects(db.query("select review_report($1,'resolved')",[id(99)]),{code:"42501"});
      await assert.rejects(db.query("update temporary_access_settings set max_accounts=1000"),{code:"42501"});
    });
    await t.test("limite de participantes é aplicado atomicamente e reaplicar preserva configuração",async()=>{
      await db.exec("reset role");
      await db.exec("update temporary_access_settings set max_accounts=1");
      await assert.rejects(create(id(3),"OutroNome","outraTag"),{code:"42501"});
      await db.exec(migration);
      const status=(await db.query("select temporary_access_status() as status")).rows[0].status;
      assert.equal(status.enabled,true);
      assert.equal(status.available,false);
    });
    await t.test("fechar inscrições não expulsa sessões; desativar acesso bloqueia todas",async()=>{
      await db.exec("update temporary_access_settings set registration_enabled=false");
      await asUser(guest);
      assert.equal((await db.query("select account_is_active() as active")).rows[0].active,true);
      await db.exec("reset role; update temporary_access_settings set access_enabled=false");
      await asUser(guest);
      assert.equal((await db.query("select account_is_active() as active")).rows[0].active,false);
      assert.equal((await db.query("select * from posts")).rows.length,0);
      await db.exec("reset role; update temporary_access_settings set access_enabled=true");
    });
    await t.test("24 horas: leitura e escrita bloqueadas mesmo com sessão autenticada",async()=>{
      await db.query("update profiles set temporary_expires_at=now()-interval '1 second' where id=$1",[guest]);
      await asUser(guest);
      for(const table of ["posts","comments","chat_messages","forum_categories","chat_rooms","announcements","notifications","reports"]) {
        assert.equal((await db.query("select * from "+table)).rows.length,0);
      }
      assert.equal((await db.query("select id from profiles")).rows.length,1); // próprio perfil para explicar expiração
      await assert.rejects(db.query("insert into chat_messages(room_id,author_id,content) values ($1,auth.uid(),'Não deve enviar')",[category]),{code:"42501"});
      await assert.rejects(db.query("select submit_report('post',$1,'Motivo de denúncia válido')",[id(20)]),{code:"42501"});
      await assert.rejects(db.query("select mark_notification_read($1)",[id(99)]),{code:"42501"});
    });
    await t.test("contas permanentes continuam ativas; expiração não apaga publicações",async()=>{
      await asUser(regular);
      assert.equal((await db.query("select account_is_active() as active")).rows[0].active,true);
      assert.equal((await db.query("select id from posts where id=$1",[id(21)])).rows.length,1);
      await db.query("update profiles set display_name='Nome permanente' where id=auth.uid()");
    });
  } finally { await db.close(); }
});
