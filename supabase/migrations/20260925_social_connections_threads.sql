-- Seguidores, handles, threads e notificacoes com trecho do comentario.
-- Aplicar depois de 20260924_social_feed.sql.
begin;

create table if not exists public.profile_follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followed_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(follower_id,followed_id),
  check(follower_id<>followed_id)
);
alter table public.profile_follows enable row level security;
revoke all on public.profile_follows from public,anon,authenticated;
grant select,insert,delete on public.profile_follows to authenticated;
drop policy if exists follows_read on public.profile_follows;
create policy follows_read on public.profile_follows for select to authenticated
  using(public.account_is_active());
drop policy if exists follows_add on public.profile_follows;
create policy follows_add on public.profile_follows for insert to authenticated
  with check(follower_id=auth.uid() and public.account_is_active());
drop policy if exists follows_remove on public.profile_follows;
create policy follows_remove on public.profile_follows for delete to authenticated
  using(follower_id=auth.uid() and public.account_is_active());
create index if not exists profile_follows_followed_idx on public.profile_follows(followed_id,created_at desc);

alter table public.comments add column if not exists parent_id uuid references public.comments(id) on delete cascade;
create index if not exists comments_parent_idx on public.comments(parent_id,created_at);
create or replace function public.validate_comment_thread() returns trigger
language plpgsql set search_path='' as $$
declare parent_post uuid; ancestor uuid; depth integer:=0;
begin
  if new.parent_id is null then return new; end if;
  ancestor:=new.parent_id;
  loop
    select post_id,parent_id into parent_post,ancestor from public.comments where id=ancestor;
    if not found or parent_post<>new.post_id then
      raise exception 'A resposta deve pertencer a mesma faisca.' using errcode='22023';
    end if;
    depth:=depth+1;
    if depth>8 then raise exception 'A conversa atingiu o limite de respostas.' using errcode='22023'; end if;
    exit when ancestor is null;
    if ancestor=new.id then raise exception 'Conversa circular invalida.' using errcode='22023'; end if;
  end loop;
  return new;
end; $$;
drop trigger if exists comments_validate_thread on public.comments;
create trigger comments_validate_thread before insert or update of parent_id,post_id on public.comments
for each row execute function public.validate_comment_thread();

alter table public.notifications drop constraint if exists notifications_kind_source_id_key;
create unique index if not exists notifications_kind_source_recipient_unique
  on public.notifications(kind,source_id,recipient_id);
create or replace function public.notify_post_comment()
returns trigger language plpgsql security definer set search_path='' as $$
declare post_author uuid; parent_author uuid; excerpt text;
begin
  select author_id into post_author from public.posts where id=new.post_id and not is_removed;
  if new.parent_id is not null then
    select author_id into parent_author from public.comments where id=new.parent_id and not is_removed;
  end if;
  excerpt:=left(regexp_replace(btrim(new.content),'[[:space:]]+',' ','g'),240);
  if post_author is not null and post_author<>new.author_id then
    insert into public.notifications(recipient_id,kind,source_id,target_type,target_id,destination,message)
    values(post_author,'comment',new.id,'comment',new.id,'/foruns/topico/'||new.post_id::text,
      'Comentario na sua faisca: "'||excerpt||case when char_length(btrim(new.content))>240 then '…' else '' end||'"')
    on conflict(kind,source_id,recipient_id) do nothing;
  end if;
  if parent_author is not null and parent_author<>new.author_id and parent_author is distinct from post_author then
    insert into public.notifications(recipient_id,kind,source_id,target_type,target_id,destination,message)
    values(parent_author,'comment',new.id,'comment',new.id,'/foruns/topico/'||new.post_id::text,
      'Resposta ao seu comentario: "'||excerpt||case when char_length(btrim(new.content))>240 then '…' else '' end||'"')
    on conflict(kind,source_id,recipient_id) do nothing;
  end if;
  return new;
end; $$;

create or replace function public.validate_profile_handle() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.role='student' and new.temporary_tag is null and
     (new.username is null or new.username !~ '^[A-Za-z0-9_!*/.+-]{3,24}$') then
    raise exception 'Usuario invalido: use de 3 a 24 letras, numeros ou _ ! * / . + -' using errcode='22023';
  end if;
  return new;
end; $$;
drop trigger if exists profiles_validate_handle on public.profiles;
create trigger profiles_validate_handle before insert or update of username,role on public.profiles
for each row execute function public.validate_profile_handle();

create or replace function public.social_feed(page_offset integer default 0, hashtag text default '')
returns jsonb language sql stable security invoker set search_path='' as $$
  with events as (
    select p.id::text event_id,p.id post_id,p.created_at event_at,null::uuid igniter
    from public.posts p
    union all
    select r.post_id::text||':'||r.user_id::text,r.post_id,r.created_at,r.user_id
    from public.post_reactions r
    where kind='ignite' and (r.user_id=auth.uid() or exists(
      select 1 from public.profile_follows f where f.follower_id=auth.uid() and f.followed_id=r.user_id
    ))
  ), visible as (
    select e.*,p.title,p.content,p.image_path,p.created_at,p.author_id,p.is_locked,
      c.visibility='everyone' can_ignite
    from events e join public.posts p on p.id=e.post_id
    join public.forum_categories c on c.id=p.category_id
    where coalesce(hashtag,'')='' or exists (
      select 1 from regexp_matches(p.content,'(^|[[:space:]])#([[:alnum:]_]{1,40})(?![[:alnum:]_])','g') as tag
      where lower(tag[2])=lower(hashtag)
    )
    order by event_at desc,event_id desc limit 20 offset greatest(0,least(page_offset,10000))
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'event_id',v.event_id,'id',v.post_id,'title',v.title,'content',v.content,
    'image_path',v.image_path,'created_at',v.created_at,'event_at',v.event_at,
    'author_id',v.author_id,'is_locked',v.is_locked,'can_ignite',v.can_ignite,
    'author',(select jsonb_build_object('id',a.id,'username',a.username,'display_name',a.display_name,'temporary_tag',a.temporary_tag,'avatar_url',a.avatar_url) from public.profiles a where a.id=v.author_id),
    'igniter',(select jsonb_build_object('id',a.id,'username',a.username,'display_name',a.display_name,'temporary_tag',a.temporary_tag) from public.profiles a where a.id=v.igniter),
    'likes',(select count(*) from public.post_reactions r where r.post_id=v.post_id and r.kind='like'),
    'ignites',(select count(*) from public.post_reactions r where r.post_id=v.post_id and r.kind='ignite'),
    'comments',(select count(*) from public.comments c where c.post_id=v.post_id),
    'liked',exists(select 1 from public.post_reactions r where r.post_id=v.post_id and r.kind='like' and r.user_id=auth.uid()),
    'ignited',exists(select 1 from public.post_reactions r where r.post_id=v.post_id and r.kind='ignite' and r.user_id=auth.uid())
  ) order by v.event_at desc,v.event_id desc),'[]'::jsonb) from visible v;
$$;
revoke all on function public.social_feed(integer,text) from public,anon;
grant execute on function public.social_feed(integer,text) to authenticated;

commit;
