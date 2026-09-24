-- Aplicar após temporary_tag_limit. Preserva fóruns, publicações e permissões.
begin;
alter table public.profiles add column if not exists school_label text not null default '';
alter table public.posts add column if not exists image_path text;
insert into public.forum_categories(id,name,description,visibility)
values ('20000000-0000-4000-8000-000000000001','Feed','Publicações da comunidade','everyone')
on conflict(id) do nothing;

create or replace function public.set_school_label(label text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not public.account_is_active() then raise exception 'Conta indisponível.' using errcode='42501'; end if;
  if label is null or char_length(btrim(label))>60 then raise exception 'Turma deve ter até 60 caracteres.' using errcode='22023'; end if;
  update public.profiles set school_label=btrim(label) where id=auth.uid();
end; $$;
revoke all on function public.set_school_label(text) from public,anon;
grant execute on function public.set_school_label(text) to authenticated;

create or replace function public.validate_social_post() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.category_id='20000000-0000-4000-8000-000000000001' then
    if char_length(btrim(new.content))>5000 or (btrim(new.content)='' and new.image_path is null) then
      raise exception 'Escreva uma publicação ou adicione uma imagem (até 5000 caracteres).' using errcode='22023';
    end if;
  end if;
  if new.image_path is not null and (
    split_part(new.image_path,'/',1)<>new.author_id::text or
    new.image_path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
  ) then raise exception 'Imagem inválida.' using errcode='22023'; end if;
  return new;
end; $$;
drop trigger if exists posts_validate_social on public.posts;
create trigger posts_validate_social before insert or update on public.posts
for each row execute function public.validate_social_post();

create table if not exists public.post_reactions (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check(kind in ('like','ignite')),
  created_at timestamptz not null default now(),
  primary key(post_id,user_id,kind)
);
alter table public.post_reactions enable row level security;
revoke all on public.post_reactions from public,anon,authenticated;
grant select,delete on public.post_reactions to authenticated;
grant insert(post_id,user_id,kind) on public.post_reactions to authenticated;
drop policy if exists reactions_read on public.post_reactions;
create policy reactions_read on public.post_reactions for select to authenticated using (
  public.account_is_active() and exists(select 1 from public.posts p where p.id=post_id)
);
drop policy if exists reactions_add on public.post_reactions;
create policy reactions_add on public.post_reactions for insert to authenticated with check (
  user_id=auth.uid() and public.account_is_active() and exists(
    select 1 from public.posts p join public.forum_categories c on c.id=p.category_id
    where p.id=post_id and (kind='like' or c.visibility='everyone')
  )
);
drop policy if exists reactions_remove on public.post_reactions;
create policy reactions_remove on public.post_reactions for delete to authenticated using(user_id=auth.uid() and public.account_is_active());

-- Função invoker: cada consulta continua sujeita ao RLS, incluindo contagens e reposts.
create or replace function public.social_feed(page_offset integer default 0, hashtag text default '')
returns jsonb language sql stable security invoker set search_path='' as $$
  with events as (
    select p.id::text event_id,p.id post_id,p.created_at event_at,null::uuid igniter
    from public.posts p
    union all
    select r.post_id::text||':'||r.user_id::text,r.post_id,r.created_at,r.user_id
    from public.post_reactions r where kind='ignite'
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

create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  primary key(blocker_id,blocked_id), check(blocker_id<>blocked_id)
);
alter table public.user_blocks enable row level security;
revoke all on public.user_blocks from public,anon,authenticated;
grant select,insert,delete on public.user_blocks to authenticated;
drop policy if exists blocks_own on public.user_blocks;
create policy blocks_own on public.user_blocks for all to authenticated
using(blocker_id=auth.uid() and public.account_is_active())
with check(blocker_id=auth.uid() and public.account_is_active());

create or replace function public.can_message(target uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select public.account_is_active() and target<>auth.uid()
    and exists(select 1 from public.profiles p where p.id=target and
      (p.temporary_expires_at is null or (p.temporary_expires_at>now() and exists(select 1 from public.temporary_access_settings where id and access_enabled))))
    and not exists(select 1 from public.user_blocks b where
      (b.blocker_id=auth.uid() and b.blocked_id=target) or (b.blocker_id=target and b.blocked_id=auth.uid()));
$$;
revoke all on function public.can_message(uuid) from public,anon;
grant execute on function public.can_message(uuid) to authenticated;
create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check(char_length(btrim(content)) between 1 and 2000),
  created_at timestamptz not null default now(), check(sender_id<>recipient_id)
);
create index if not exists direct_messages_pair_time on public.direct_messages(sender_id,recipient_id,created_at desc);
create index if not exists direct_messages_recipient_time on public.direct_messages(recipient_id,created_at desc);
alter table public.direct_messages enable row level security;
revoke all on public.direct_messages from public,anon,authenticated;
grant select on public.direct_messages to authenticated;
grant insert(sender_id,recipient_id,content) on public.direct_messages to authenticated;
drop policy if exists dm_read on public.direct_messages;
create policy dm_read on public.direct_messages for select to authenticated using (
  public.account_is_active() and auth.uid() in (sender_id,recipient_id)
);
drop policy if exists dm_send on public.direct_messages;
create policy dm_send on public.direct_messages for insert to authenticated with check (
  sender_id=auth.uid() and public.can_message(recipient_id)
);
commit;
