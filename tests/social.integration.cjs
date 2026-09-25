const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {resolve}=require('node:path');
const {PGlite}=require('../.test-tools/node_modules/@electric-sql/pglite');
test('rede social: isolamento, preservação e interações',async t=>{
  const db=new PGlite();
  const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
  const a=id(1),b=id(2),staff=id(3),guest=id(4),post=id(10),privatePost=id(11),category=id(20);
  const feed='20000000-0000-4000-8000-000000000001';
  const read=p=>readFileSync(resolve(__dirname,'..',p),'utf8');
  async function as(user){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);await db.exec('set role authenticated');}
  const denied=fn=>assert.rejects(fn,{code:'42501'});
  try{
    await db.exec(`create role authenticated;create role anon;create schema auth;
      create table auth.users(id uuid primary key,email text,is_anonymous boolean default false,raw_user_meta_data jsonb default '{}'::jsonb);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema public,auth to authenticated,anon;
      alter default privileges in schema public grant select,insert,update,delete on tables to authenticated;
      create publication supabase_realtime;
      create schema storage; grant usage on schema storage to authenticated;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
      alter table storage.objects enable row level security;
      grant select,insert,delete on storage.objects to authenticated;
    `);
    await db.exec(read('supabase/schema.sql').replace(/create extension if not exists pgcrypto;/i,''));
    const migration=read('supabase/migrations/20260924_social_feed.sql'),storage=read('supabase/migrations/20260924_social_storage.sql');
    await db.exec(migration);await db.exec(storage);
    await db.exec(read('supabase/migrations/20260925_social_connections_threads.sql'));
    await db.exec(read('supabase/migrations/20260925_user_chat_groups.sql'));
    for(const [user,name] of [[a,'Alice'],[b,'Bruno'],[staff,'Equipe']]) await db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)',[user,name+'@test.invalid',JSON.stringify({full_name:name})]);
    await db.query("update profiles set role='moderator' where id=$1",[staff]);
    await db.exec('update temporary_access_settings set registration_enabled=true');
    await db.query("insert into auth.users(id,is_anonymous,raw_user_meta_data) values($1,true,$2)",[guest,JSON.stringify({temporary_name:'Charlie',temporary_tag:'eba'})]);
    await db.query("insert into forum_categories(id,name,visibility,class_name) values($1,'Turma restrita','class','Secreta')",[category]);
    await db.query("insert into posts(id,category_id,author_id,title,content) values($1,$2,$3,'Legado privado','Conteúdo privado preservado')",[privatePost,category,staff]);
    await t.test('publicação sem título e conta temporária podem publicar e comentar',async()=>{
      await as(guest);
      await db.query("insert into posts(id,category_id,author_id,title,content) values($1,$2,$3,'','Olá #PPO')",[post,feed,guest]);
      await db.query("insert into comments(post_id,author_id,content) values($1,$2,'Comentário real')",[post,guest]);
      await assert.rejects(db.query("insert into posts(category_id,author_id,title,content) values($1,$2,'','')",[feed,guest]),{code:'22023'});
      await denied(db.query("insert into posts(category_id,author_id,title,content) values($1,$2,'','Autor falso')",[feed,a]));
    });
    await t.test('curtidas e ignites únicos e protegidos contra falsificação',async()=>{
      await as(a);
      for(const kind of ['like','ignite'])await db.query('insert into post_reactions(post_id,user_id,kind) values($1,$2,$3)',[post,a,kind]);
      await assert.rejects(db.query("insert into post_reactions(post_id,user_id,kind) values($1,$2,'like')",[post,a]),{code:'23505'});
      await denied(db.query("insert into post_reactions(post_id,user_id,kind) values($1,$2,'like')",[post,b]));
      await as(b);
      assert.equal((await db.query('delete from post_reactions where user_id=$1 returning *',[a])).rows.length,0);
      const data=(await db.query("select social_feed(0,'ppo') as data")).rows[0].data;
      assert.equal(data.length,1);assert.equal(data[0].likes,1);assert.equal(data[0].comments,1);assert.equal(data[0].ignites,1);
      await db.query('insert into profile_follows(follower_id,followed_id) values($1,$2)',[b,a]);
      const followed=(await db.query("select social_feed(0,'ppo') as data")).rows[0].data;
      assert.equal(followed.length,2);assert.equal(followed.find(row=>row.igniter).author_id,guest);
      assert.equal((await db.query('select * from posts where id=$1',[privatePost])).rows.length,0);
      await denied(db.query("insert into post_reactions(post_id,user_id,kind) values($1,$2,'ignite')",[privatePost,b]));
      await as(staff);await denied(db.query("insert into post_reactions(post_id,user_id,kind) values($1,$2,'ignite')",[privatePost,staff]));
    });
    await t.test('threads validam a faísca e notificações mostram o comentário',async()=>{
      const root=id(31),reply=id(32);
      await as(a);await db.query("insert into comments(id,post_id,author_id,content) values($1,$2,$3,'Comentário visível na notificação')",[root,post,a]);
      await as(b);await db.query("insert into comments(id,post_id,author_id,parent_id,content) values($1,$2,$3,$4,'Resposta encadeada')",[reply,post,b,root]);
      await as(guest);assert.match((await db.query("select message from notifications where source_id=$1",[root])).rows[0].message,/Comentário visível/);
      await as(a);assert.match((await db.query("select message from notifications where source_id=$1",[reply])).rows[0].message,/Resposta encadeada/);
      await as(b);await assert.rejects(db.query("insert into comments(post_id,author_id,parent_id,content) values($1,$2,$3,'Post diferente')",[privatePost,b,root]),{code:'22023'});
    });
    await t.test('etiqueta de turma não concede acesso nem altera identidade temporária',async()=>{
      await as(guest);await db.query("select set_school_label('Secreta')");
      const p=(await db.query('select * from profiles where id=$1',[guest])).rows[0];
      assert.equal(p.school_label,'Secreta');assert.equal(p.class_name,null);assert.equal(p.temporary_tag,'eba');
      assert.equal((await db.query('select * from posts where id=$1',[privatePost])).rows.length,0);
      await denied(db.query("update profiles set school_label='Forjada' where id=$1",[b]));
      await assert.rejects(db.query('select set_school_label($1)',['a'.repeat(61)]),{code:'22023'});
    });
    await t.test('mensagens só podem ser lidas pelos participantes, nem moderador acessa',async()=>{
      await as(a);await db.query("insert into direct_messages(sender_id,recipient_id,content) values($1,$2,'Olá Bruno')",[a,b]);
      await denied(db.query("insert into direct_messages(sender_id,recipient_id,content) values($1,$2,'Forjada')",[b,a]));
      await as(b);assert.equal((await db.query('select * from direct_messages')).rows.length,1);
      await as(staff);assert.equal((await db.query('select * from direct_messages')).rows.length,0);
      await denied(db.query("update direct_messages set content='Alterada'"));
    });
    await t.test('grupos privados só aparecem para membros e podem ser excluídos pelo criador',async()=>{
      await as(a);const room=(await db.query("select create_chat_group('Equipe','Privado',true,array[$1::uuid]) as id",[b])).rows[0].id;
      await db.query("insert into chat_messages(room_id,author_id,content) values($1,$2,'Segredo')",[room,a]);
      await as(b);assert.equal((await db.query('select * from chat_rooms where id=$1',[room])).rows.length,1);assert.equal((await db.query('select * from chat_messages where room_id=$1',[room])).rows.length,1);
      await as(staff);assert.equal((await db.query('select * from chat_rooms where id=$1',[room])).rows.length,0);
      await denied(db.query('select delete_chat_group($1)',[room]));
      await as(a);await db.query('select delete_chat_group($1)',[room]);assert.equal((await db.query('select * from chat_rooms where id=$1',[room])).rows.length,0);
    });
    await t.test('bloqueio impede envio nas duas direções sem apagar histórico',async()=>{
      await as(b);await db.query('insert into user_blocks values($1,$2)',[b,a]);
      await denied(db.query("insert into direct_messages(sender_id,recipient_id,content) values($1,$2,'Bloqueada')",[b,a]));
      await as(a);await denied(db.query("insert into direct_messages(sender_id,recipient_id,content) values($1,$2,'Bloqueada')",[a,b]));
      assert.equal((await db.query('select * from direct_messages')).rows.length,1);
    });
    await t.test('imagens privadas respeitam conteúdo visível e pasta do autor',async()=>{
      const name=guest+'/'+id(90)+'.jpg';await as(guest);
      await db.query("insert into storage.objects(bucket_id,name) values('post-images',$1)",[name]);
      await denied(db.query("insert into storage.objects(bucket_id,name) values('post-images',$1)",[a+'/'+id(91)+'.jpg']));
      await db.query("insert into posts(category_id,author_id,title,content,image_path) values($1,$2,'','',$3)",[feed,guest,name]);
      await as(b);assert.equal((await db.query('select * from storage.objects')).rows.length,1);
      assert.equal((await db.query('delete from storage.objects returning *')).rows.length,0);
      await db.exec('reset role');
      await db.query('update posts set is_removed=true where image_path=$1',[name]);
      await as(b);assert.equal((await db.query('select * from storage.objects')).rows.length,0);
      const secret=staff+'/'+id(92)+'.jpg';
      await db.exec('reset role');
      await db.query("insert into storage.objects(bucket_id,name) values('post-images',$1)",[secret]);
      await db.query('update posts set image_path=$1 where id=$2',[secret,privatePost]);
      await as(b);assert.equal((await db.query('select * from storage.objects')).rows.length,0);
      await as(staff);assert.equal((await db.query('select * from storage.objects where name=$1',[secret])).rows.length,1);
    });
    await t.test('expiração bloqueia feed, interações e mensagens',async()=>{
      await db.exec('reset role');await db.query("update profiles set temporary_expires_at=now()-interval '1 second' where id=$1",[guest]);
      await as(guest);assert.deepEqual((await db.query('select social_feed() as data')).rows[0].data,[]);
      await denied(db.query("insert into direct_messages(sender_id,recipient_id,content) values($1,$2,'Expirada')",[guest,a]));
      await denied(db.query("select set_school_label('Outra')"));
      assert.equal((await db.query('select * from storage.objects')).rows.length,0);
      await as(a);await denied(db.query("insert into direct_messages(sender_id,recipient_id,content) values($1,$2,'Destino expirado')",[a,guest]));
    });
    await t.test('migrações reaplicáveis preservam dados existentes',async()=>{
      await db.exec('reset role');await db.exec(migration);await db.exec(storage);
      assert.equal((await db.query('select count(*)::int n from direct_messages')).rows[0].n,1);
      assert.equal((await db.query('select title from posts where id=$1',[privatePost])).rows[0].title,'Legado privado');
      const bucket=(await db.query("select * from storage.buckets where id='post-images'")).rows[0];
      assert.equal(bucket.public,false);assert.equal(Number(bucket.file_size_limit),5242880);
      assert.deepEqual(bucket.allowed_mime_types,['image/jpeg','image/png','image/webp']);
      await db.exec('set role anon');
      await denied(db.query('select social_feed()'));
      await denied(db.query('select * from direct_messages'));
    });
  } finally {await db.close();}
});
