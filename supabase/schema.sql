  create extension if not exists pgcrypto;

  create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    username text unique,
    display_name text,
    role text not null default 'student' check (role in ('student','teacher','coordination','moderator')),
    class_name text,
    avatar_url text,
    bio text not null default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );
  create table if not exists public.forum_categories (id uuid primary key default gen_random_uuid(), name text not null, description text, visibility text not null default 'everyone', class_name text, created_by uuid references public.profiles(id) on delete set null, created_at timestamptz not null default now());
  create table if not exists public.posts (id uuid primary key default gen_random_uuid(), category_id uuid not null references public.forum_categories(id) on delete cascade, author_id uuid not null references public.profiles(id) on delete cascade, title text not null, content text not null, is_pinned boolean not null default false, is_locked boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
  create table if not exists public.comments (id uuid primary key default gen_random_uuid(), post_id uuid not null references public.posts(id) on delete cascade, author_id uuid not null references public.profiles(id) on delete cascade, content text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
  create index if not exists comments_post_created_at_idx on public.comments(post_id, created_at);
  alter table public.comments drop constraint if exists comments_content_length;
  alter table public.comments add constraint comments_content_length check (char_length(btrim(content)) between 2 and 2000);
  create table if not exists public.chat_rooms (id uuid primary key default gen_random_uuid(), name text not null, description text, visibility text not null default 'everyone', class_name text, created_by uuid references public.profiles(id) on delete set null, created_at timestamptz not null default now());
  create table if not exists public.chat_messages (id uuid primary key default gen_random_uuid(), room_id uuid not null references public.chat_rooms(id) on delete cascade, author_id uuid not null references public.profiles(id) on delete cascade, content text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
  do $$
  begin
    if not exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='chat_messages' and column_name='updated_at'
    ) then
      alter table public.chat_messages add column updated_at timestamptz not null default now();
      update public.chat_messages set updated_at=created_at;
    end if;
  end $$;
  create index if not exists chat_messages_room_created_at_idx on public.chat_messages(room_id, created_at);
  alter table public.chat_messages drop constraint if exists chat_messages_content_length;
  alter table public.chat_messages add constraint chat_messages_content_length check (char_length(btrim(content)) between 1 and 2000);
  insert into public.chat_rooms(id, name, description, visibility) values
    ('10000000-0000-4000-8000-000000000001', 'Comunidade', 'Conversa geral da comunidade escolar', 'everyone'),
    ('10000000-0000-4000-8000-000000000002', 'Dúvidas ENEM', 'Redação, matemática e simulados', 'everyone'),
    ('10000000-0000-4000-8000-000000000003', 'Trabalhos e PPO', 'Organização dos projetos', 'everyone')
  on conflict (id) do update set name=excluded.name, description=excluded.description, visibility=excluded.visibility;
  create table if not exists public.announcements (id uuid primary key default gen_random_uuid(), author_id uuid not null references public.profiles(id) on delete cascade, title text not null, content text not null, visibility text not null default 'everyone', class_name text, created_at timestamptz not null default now());
  create table if not exists public.reports (id uuid primary key default gen_random_uuid(), reporter_id uuid not null references public.profiles(id) on delete cascade, target_type text not null, target_id uuid not null, reason text not null, status text not null default 'pending', created_at timestamptz not null default now());

  create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$ begin insert into public.profiles(id,username,display_name,role,class_name) values(new.id,coalesce(new.raw_user_meta_data->>'username',split_part(new.email,'@',1)),coalesce(new.raw_user_meta_data->>'full_name',split_part(new.email,'@',1)),'student',new.raw_user_meta_data->>'class_name') on conflict(id) do nothing; return new; end; $$;
  drop trigger if exists on_auth_user_created on auth.users;
  create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

  create or replace function public.can_access_content(content_visibility text, content_class_name text default null)
  returns boolean
  language sql
  stable
  security definer
  set search_path=public
  as $$
    select exists (
      select 1
      from public.profiles profile
      where profile.id=auth.uid()
        and (
          profile.role in ('coordination', 'moderator')
          or content_visibility='everyone'
          or (content_visibility='students' and profile.role='student')
          or (content_visibility='teachers' and profile.role='teacher')
          or (content_visibility='staff' and profile.role in ('teacher', 'coordination', 'moderator'))
          or (content_visibility='moderation' and profile.role in ('coordination', 'moderator'))
          or (
            content_visibility='class'
            and content_class_name is not null
            and (
              profile.class_name=content_class_name
              or profile.role in ('teacher', 'coordination', 'moderator')
            )
          )
        )
    );
  $$;
  revoke all on function public.can_access_content(text, text) from public, anon;
  grant execute on function public.can_access_content(text, text) to authenticated;

  alter table public.profiles enable row level security; alter table public.forum_categories enable row level security; alter table public.posts enable row level security; alter table public.comments enable row level security; alter table public.chat_rooms enable row level security; alter table public.chat_messages enable row level security; alter table public.announcements enable row level security; alter table public.reports enable row level security;
  drop policy if exists "profiles_select" on public.profiles;
  drop policy if exists "profiles_update_own" on public.profiles;
  create policy "profiles_select" on public.profiles for select to authenticated using (true);
  create policy "profiles_update_own" on public.profiles for update to authenticated using (auth.uid()=id) with check (auth.uid()=id);
  revoke update on public.profiles from authenticated;
  grant update(username, display_name, avatar_url, bio, updated_at) on public.profiles to authenticated;
  drop policy if exists "categories_select" on public.forum_categories;
  create policy "categories_select" on public.forum_categories for select to authenticated using (public.can_access_content(visibility, class_name));
  drop policy if exists "posts_select" on public.posts;
  drop policy if exists "posts_insert_own" on public.posts;
  create policy "posts_select" on public.posts for select to authenticated using (
    exists (select 1 from public.forum_categories category where category.id=posts.category_id)
  );
  create policy "posts_insert_own" on public.posts for insert to authenticated with check (
    auth.uid()=author_id
    and exists (select 1 from public.forum_categories category where category.id=posts.category_id)
  );
  drop policy if exists "comments_select" on public.comments;
  drop policy if exists "comments_insert_own" on public.comments;
  drop policy if exists "comments_update_own" on public.comments;
  drop policy if exists "comments_delete_own" on public.comments;
  create policy "comments_select" on public.comments for select to authenticated using (
    exists (select 1 from public.posts where posts.id=comments.post_id)
  );
  create policy "comments_insert_own" on public.comments for insert to authenticated with check (
    auth.uid()=author_id and exists (
      select 1 from public.posts where posts.id=comments.post_id and not posts.is_locked
    )
  );
  create policy "comments_update_own" on public.comments for update to authenticated using (
    auth.uid()=author_id and exists (select 1 from public.posts where posts.id=comments.post_id)
  ) with check (
    auth.uid()=author_id and exists (select 1 from public.posts where posts.id=comments.post_id)
  );
  create policy "comments_delete_own" on public.comments for delete to authenticated using (auth.uid()=author_id);
  do $$
  begin
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'comments'
    ) then
      alter publication supabase_realtime add table public.comments;
    end if;
  end $$;
  drop policy if exists "rooms_select" on public.chat_rooms;
  create policy "rooms_select" on public.chat_rooms for select to authenticated using (public.can_access_content(visibility, class_name));
  drop policy if exists "messages_select" on public.chat_messages;
  drop policy if exists "messages_insert_own" on public.chat_messages;
  drop policy if exists "messages_update_own" on public.chat_messages;
  drop policy if exists "messages_delete_own" on public.chat_messages;
  create policy "messages_select" on public.chat_messages for select to authenticated using (
    exists (select 1 from public.chat_rooms room where room.id=chat_messages.room_id)
  );
  create policy "messages_insert_own" on public.chat_messages for insert to authenticated with check (
    auth.uid()=author_id
    and exists (select 1 from public.chat_rooms room where room.id=chat_messages.room_id)
  );
  create policy "messages_update_own" on public.chat_messages for update to authenticated using (
    auth.uid()=author_id and exists (select 1 from public.chat_rooms room where room.id=chat_messages.room_id)
  ) with check (
    auth.uid()=author_id and exists (select 1 from public.chat_rooms room where room.id=chat_messages.room_id)
  );
  create policy "messages_delete_own" on public.chat_messages for delete to authenticated using (auth.uid()=author_id);
  do $$
  begin
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_messages'
    ) then
      alter publication supabase_realtime add table public.chat_messages;
    end if;
  end $$;
  drop policy if exists "announcements_select" on public.announcements;
  create policy "announcements_select" on public.announcements for select to authenticated using (public.can_access_content(visibility, class_name));
  drop policy if exists "reports_insert_own" on public.reports;
  create policy "reports_insert_own" on public.reports for insert to authenticated with check (auth.uid()=reporter_id);

-- Execute no SQL Editor do Supabase após o schema base.
begin;

create index if not exists announcements_created_at_idx
  on public.announcements(created_at desc, id desc);

drop policy if exists announcements_select on public.announcements;
create policy announcements_select on public.announcements
for select to authenticated using (
  author_id = auth.uid() or public.can_access_content(visibility, class_name)
);

drop policy if exists announcements_insert_staff on public.announcements;
create policy announcements_insert_staff on public.announcements
for insert to authenticated with check (
  author_id = auth.uid()
  and char_length(btrim(title)) between 5 and 120
  and char_length(btrim(content)) between 10 and 5000
  and visibility in ('everyone', 'students', 'teachers', 'class', 'staff', 'moderation')
  and (
    (visibility = 'class' and class_name is not null and char_length(btrim(class_name)) between 1 and 80)
    or (visibility <> 'class' and class_name is null)
  )
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('teacher', 'coordination', 'moderator')
      and (visibility <> 'moderation' or p.role in ('coordination', 'moderator'))
  )
);

grant select, insert on public.announcements to authenticated;

commit;

-- Após 20260921_announcements.sql. Pode ser reaplicado.
begin;

drop policy if exists announcements_update_own on public.announcements;
create policy announcements_update_own on public.announcements
for update to authenticated using (
  author_id = auth.uid()
  and exists (
    select 1 from public.profiles p where p.id = auth.uid()
    and p.role in ('teacher', 'coordination', 'moderator')
  )
) with check (
  author_id = auth.uid()
  and char_length(btrim(title)) between 5 and 120
  and char_length(btrim(content)) between 10 and 5000
  and visibility in ('everyone', 'students', 'teachers', 'class', 'staff', 'moderation')
  and (
    (visibility = 'class' and class_name is not null and char_length(btrim(class_name)) between 1 and 80)
    or (visibility <> 'class' and class_name is null)
  )
  and exists (
    select 1 from public.profiles p where p.id = auth.uid()
    and p.role in ('teacher', 'coordination', 'moderator')
    and (visibility <> 'moderation' or p.role in ('coordination', 'moderator'))
  )
);

drop policy if exists announcements_delete_own on public.announcements;
create policy announcements_delete_own on public.announcements
for delete to authenticated using (
  author_id = auth.uid()
  and exists (
    select 1 from public.profiles p where p.id = auth.uid()
    and p.role in ('teacher', 'coordination', 'moderator')
  )
);

-- Edição não permite trocar autor, identificador ou data de criação.
revoke update on public.announcements from public, anon, authenticated;
revoke update(id, author_id, created_at) on public.announcements from public, anon, authenticated;
grant update(title, content, visibility, class_name) on public.announcements to authenticated;
grant delete on public.announcements to authenticated;

commit;

-- Edição e exclusão dos próprios tópicos. Execute após o schema base.
begin;

drop policy if exists posts_update_own on public.posts;
create policy posts_update_own on public.posts
for update to authenticated using (
  author_id = auth.uid()
  and exists (select 1 from public.forum_categories c where c.id = posts.category_id)
) with check (
  author_id = auth.uid()
  and exists (select 1 from public.forum_categories c where c.id = posts.category_id)
  and char_length(btrim(title)) between 5 and 120
  and char_length(btrim(content)) between 10 and 5000
);

drop policy if exists posts_delete_own on public.posts;
create policy posts_delete_own on public.posts
for delete to authenticated using (
  author_id = auth.uid()
  and exists (select 1 from public.forum_categories c where c.id = posts.category_id)
);

-- Somente o texto pode ser alterado; campos de autoria, categoria e moderação ficam protegidos.
revoke update on public.posts from public, anon, authenticated;
revoke update(id, category_id, author_id, is_pinned, is_locked, created_at, updated_at)
  on public.posts from public, anon, authenticated;
grant update(title, content) on public.posts to authenticated;
grant delete on public.posts to authenticated;

create or replace function public.stamp_post_edit()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.title is distinct from old.title or new.content is distinct from old.content then
    new.updated_at := clock_timestamp();
  end if;
  return new;
end;
$$;
drop trigger if exists posts_stamp_edit on public.posts;
create trigger posts_stamp_edit before update on public.posts
for each row execute function public.stamp_post_edit();

-- comments.post_id já usa ON DELETE CASCADE no schema base.
commit;

-- Execute após 20260921_posts_edit_delete.sql. Pode ser reaplicado.
begin;

-- As permissões de edição dos autores continuam restritas a título e conteúdo.
-- A moderação é exposta somente por esta função, sem liberar UPDATE nas flags.
create or replace function public.moderate_post(
  target_post_id uuid, moderation_action text, enabled boolean
)
returns table(is_pinned boolean, is_locked boolean)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('coordination', 'moderator')
  ) then
    raise exception 'Apenas coordenação e moderadores podem moderar tópicos.'
      using errcode = '42501';
  end if;
  if moderation_action is null or moderation_action not in ('pin', 'lock') or enabled is null then
    raise exception 'Ação de moderação inválida.' using errcode = '22023';
  end if;
  return query
    update public.posts p set
      is_pinned = case when moderation_action = 'pin' then enabled else p.is_pinned end,
      is_locked = case when moderation_action = 'lock' then enabled else p.is_locked end
    where p.id = target_post_id
      and exists (
        select 1 from public.forum_categories c
        where c.id = p.category_id and public.can_access_content(c.visibility, c.class_name)
      )
    returning p.is_pinned, p.is_locked;
  if not found then
    raise exception 'Tópico não encontrado ou acesso indisponível.' using errcode = 'P0002';
  end if;
end;
$$;
revoke all on function public.moderate_post(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.moderate_post(uuid, text, boolean) to authenticated;

-- Impede que autores contornem a moderação enviando flags no INSERT.
drop policy if exists posts_insert_own on public.posts;
create policy posts_insert_own on public.posts for insert to authenticated with check (
  auth.uid() = author_id
  and exists (select 1 from public.forum_categories c where c.id = posts.category_id)
  and (
    (not is_pinned and not is_locked)
    or exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('coordination', 'moderator')
    )
  )
);

-- A verificação no banco protege inclusive abas antigas ainda com o formulário aberto.
drop policy if exists comments_insert_own on public.comments;
create policy comments_insert_own on public.comments for insert to authenticated with check (
  auth.uid() = author_id
  and exists (select 1 from public.posts p where p.id = comments.post_id and not p.is_locked)
);

create index if not exists posts_category_pinned_created_idx
  on public.posts(category_id, is_pinned desc, created_at desc, id desc);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'posts'
  ) then
    alter publication supabase_realtime add table public.posts;
  end if;
end $$;

commit;

-- Denúncias: envio validado e fila privada da equipe.
begin;

alter table public.reports add column if not exists target_excerpt text;
alter table public.reports add column if not exists target_path text;
alter table public.reports add column if not exists reviewed_by uuid references public.profiles(id) on delete set null;
alter table public.reports add column if not exists reviewed_at timestamptz;

alter table public.reports enable row level security;
drop policy if exists reports_insert_own on public.reports;
drop policy if exists reports_select_staff on public.reports;
create policy reports_select_staff on public.reports for select to authenticated using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('coordination', 'moderator'))
);
revoke all on public.reports from public, anon, authenticated;
grant select on public.reports to authenticated;
create index if not exists reports_status_created_idx on public.reports(status, created_at desc, id desc);
create index if not exists reports_pending_target_idx on public.reports(reporter_id, target_type, target_id) where status = 'pending';

create or replace function public.submit_report(target_kind text, target_uuid uuid, report_reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  viewer uuid := auth.uid();
  owner_id uuid;
  excerpt text;
  destination text;
  result uuid;
begin
  if viewer is null or not exists (select 1 from public.profiles where id = viewer) then
    raise exception 'Entre na sua conta para denunciar.' using errcode = '42501';
  end if;
  if target_kind is null or target_kind not in ('post', 'comment', 'message')
     or target_uuid is null or report_reason is null or char_length(btrim(report_reason)) not between 10 and 2000 then
    raise exception 'Informe um motivo entre 10 e 2000 caracteres.' using errcode = '22023';
  end if;
  if target_kind = 'post' then
    select p.author_id, left(p.title || E'\n' || p.content, 2000), '/foruns/topico/' || p.id::text
      into owner_id, excerpt, destination
      from public.posts p join public.forum_categories c on c.id = p.category_id
      where p.id = target_uuid and public.can_access_content(c.visibility, c.class_name);
  elsif target_kind = 'comment' then
    select m.author_id, left(m.content, 2000), '/foruns/topico/' || p.id::text
      into owner_id, excerpt, destination
      from public.comments m join public.posts p on p.id = m.post_id
      join public.forum_categories c on c.id = p.category_id
      where m.id = target_uuid and public.can_access_content(c.visibility, c.class_name);
  else
    select m.author_id, left(r.name || E'\n' || m.content, 2000), '/chats'
      into owner_id, excerpt, destination
      from public.chat_messages m join public.chat_rooms r on r.id = m.room_id
      where m.id = target_uuid and public.can_access_content(r.visibility, r.class_name);
  end if;
  if owner_id is null or owner_id = viewer then
    raise exception 'Conteúdo indisponível para denúncia.' using errcode = '42501';
  end if;
  -- Serializa envios do mesmo usuário, incluindo cliques em abas diferentes.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(viewer::text, 0));
  select id into result from public.reports
    where reporter_id = viewer and target_type = target_kind and target_id = target_uuid and status = 'pending'
    limit 1;
  if result is not null then
    raise exception 'Você já possui uma denúncia pendente deste conteúdo.' using errcode = '23505';
  end if;
  if (select count(*) from public.reports where reporter_id = viewer and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'Limite de denúncias atingido. Tente novamente mais tarde.' using errcode = 'P0001';
  end if;
  insert into public.reports(reporter_id, target_type, target_id, reason, target_excerpt, target_path)
    values (viewer, target_kind, target_uuid, btrim(report_reason), excerpt, destination)
    returning id into result;
  return result;
end;
$$;
revoke all on function public.submit_report(text, uuid, text) from public, anon;
grant execute on function public.submit_report(text, uuid, text) to authenticated;

create or replace function public.review_report(report_uuid uuid, resolution text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role in ('coordination', 'moderator')) then
    raise exception 'Acesso restrito à equipe de moderação.' using errcode = '42501';
  end if;
  if resolution is null or resolution not in ('resolved', 'dismissed') then
    raise exception 'Decisão inválida.' using errcode = '22023';
  end if;
  update public.reports set status = resolution, reviewed_by = auth.uid(), reviewed_at = now()
    where id = report_uuid and status = 'pending';
  if not found then
    raise exception 'Denúncia já analisada ou não encontrada. Atualize a lista.' using errcode = 'P0002';
  end if;
end;
$$;
revoke all on function public.review_report(uuid, text) from public, anon;
grant execute on function public.review_report(uuid, text) to authenticated;

commit;

-- Execute após 20260923_reports.sql. Remoção lógica e trilha de auditoria.
begin;
alter table public.posts add column if not exists is_removed boolean not null default false;
alter table public.comments add column if not exists is_removed boolean not null default false;
alter table public.chat_messages add column if not exists is_removed boolean not null default false;

create table if not exists public.content_moderation_events (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('post','comment','message')),
  target_id uuid not null,
  report_id uuid,
  action text not null check (action in ('remove','restore')),
  reason text not null check (char_length(btrim(reason)) between 10 and 2000),
  actor_id uuid not null,
  actor_name text not null,
  created_at timestamptz not null default clock_timestamp()
);
alter table public.content_moderation_events enable row level security;
revoke all on public.content_moderation_events from public, anon, authenticated;
grant select on public.content_moderation_events to authenticated;
drop policy if exists moderation_events_staff on public.content_moderation_events;
create policy moderation_events_staff on public.content_moderation_events for select to authenticated using (
  exists(select 1 from public.profiles where id=auth.uid() and role in ('coordination','moderator'))
);
create index if not exists moderation_events_target_idx on public.content_moderation_events(target_type,target_id,created_at desc);

-- Políticas restritivas também se aplicam a autores e moderadores.
drop policy if exists posts_not_removed on public.posts;
create policy posts_not_removed on public.posts as restrictive for all to authenticated
  using (not is_removed) with check (not is_removed);
drop policy if exists comments_not_removed on public.comments;
create policy comments_not_removed on public.comments as restrictive for all to authenticated
  using (not is_removed and exists(select 1 from public.posts where id=comments.post_id))
  with check (not is_removed and exists(select 1 from public.posts where id=comments.post_id));
drop policy if exists messages_not_removed on public.chat_messages;
create policy messages_not_removed on public.chat_messages as restrictive for all to authenticated
  using (not is_removed) with check (not is_removed);

revoke update on public.comments, public.chat_messages from public, anon, authenticated;
revoke update(is_removed) on public.posts, public.comments, public.chat_messages from public, anon, authenticated;
grant update(content, updated_at) on public.comments, public.chat_messages to authenticated;

-- Impede que a exclusão de um tópico apague comentários sob moderação por cascata.
create or replace function public.has_removed_comments(post_uuid uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.comments where post_id=post_uuid and is_removed);
$$;
revoke all on function public.has_removed_comments(uuid) from public, anon;
grant execute on function public.has_removed_comments(uuid) to authenticated;
drop policy if exists posts_preserve_removed_comments on public.posts;
create policy posts_preserve_removed_comments on public.posts as restrictive for delete to authenticated
  using (not public.has_removed_comments(id));

create or replace function public.reported_content_state(report_uuid uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare r public.reports; removed boolean;
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and role in ('coordination','moderator')) then
    raise exception 'Acesso restrito à moderação.' using errcode='42501';
  end if;
  select * into r from public.reports where id=report_uuid;
  if r.target_type='post' then select is_removed into removed from public.posts where id=r.target_id;
  elsif r.target_type='comment' then select is_removed into removed from public.comments where id=r.target_id;
  elsif r.target_type='message' then select is_removed into removed from public.chat_messages where id=r.target_id;
  end if;
  return removed; -- NULL significa alvo excluído definitivamente ou ausente.
end;
$$;
revoke all on function public.reported_content_state(uuid) from public, anon;
grant execute on function public.reported_content_state(uuid) to authenticated;

create or replace function public.moderate_reported_content(report_uuid uuid, moderation_action text, moderation_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare r public.reports; removed boolean; actor text; desired boolean;
begin
  select coalesce(nullif(display_name,''),username,'Membro da equipe') into actor
    from public.profiles where id=auth.uid() and role in ('coordination','moderator');
  if actor is null then
    raise exception 'Acesso restrito à moderação.' using errcode='42501';
  end if;
  if moderation_action is null or moderation_action not in ('remove','restore')
     or moderation_reason is null or char_length(btrim(moderation_reason)) not between 10 and 2000 then
    raise exception 'Ação ou motivo inválido.' using errcode='22023';
  end if;
  select * into r from public.reports where id=report_uuid;
  if not found then raise exception 'Denúncia não encontrada.' using errcode='P0002'; end if;
  -- Trava o alvo, não a denúncia: várias denúncias podem apontar ao mesmo conteúdo.
  if r.target_type='post' then select is_removed into removed from public.posts where id=r.target_id for update;
  elsif r.target_type='comment' then
    -- Mesmo lock do pai usado na exclusão: evita perder o comentário por cascata.
    perform 1 from public.posts where id=(select post_id from public.comments where id=r.target_id) for update;
    select is_removed into removed from public.comments where id=r.target_id for update;
  elsif r.target_type='message' then select is_removed into removed from public.chat_messages where id=r.target_id for update;
  end if;
  if removed is null then raise exception 'Conteúdo excluído definitivamente ou não encontrado.' using errcode='P0002'; end if;
  desired := moderation_action='remove';
  if removed=desired then raise exception 'O estado já mudou. Atualize antes de tentar novamente.' using errcode='40001'; end if;
  if r.target_type='post' then update public.posts set is_removed=desired where id=r.target_id;
  elsif r.target_type='comment' then update public.comments set is_removed=desired where id=r.target_id;
  else update public.chat_messages set is_removed=desired where id=r.target_id;
  end if;
  insert into public.content_moderation_events(target_type,target_id,report_id,action,reason,actor_id,actor_name)
    values(r.target_type,r.target_id,r.id,moderation_action,btrim(moderation_reason),auth.uid(),actor);
end;
$$;
revoke all on function public.moderate_reported_content(uuid,text,text) from public, anon;
grant execute on function public.moderate_reported_content(uuid,text,text) to authenticated;

-- A função de envio privilegiada também precisa respeitar a remoção.
create or replace function public.submit_report(target_kind text, target_uuid uuid, report_reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  viewer uuid := auth.uid();
  owner_id uuid;
  excerpt text;
  destination text;
  result uuid;
begin
  if viewer is null or not exists (select 1 from public.profiles where id = viewer) then
    raise exception 'Entre na sua conta para denunciar.' using errcode = '42501';
  end if;
  if target_kind is null or target_kind not in ('post', 'comment', 'message')
     or target_uuid is null or report_reason is null or char_length(btrim(report_reason)) not between 10 and 2000 then
    raise exception 'Informe um motivo entre 10 e 2000 caracteres.' using errcode = '22023';
  end if;
  if target_kind = 'post' then
    select p.author_id, left(p.title || E'\n' || p.content, 2000), '/foruns/topico/' || p.id::text
      into owner_id, excerpt, destination
      from public.posts p join public.forum_categories c on c.id = p.category_id
      where p.id = target_uuid and not p.is_removed and public.can_access_content(c.visibility, c.class_name);
  elsif target_kind = 'comment' then
    select m.author_id, left(m.content, 2000), '/foruns/topico/' || p.id::text
      into owner_id, excerpt, destination
      from public.comments m join public.posts p on p.id = m.post_id
      join public.forum_categories c on c.id = p.category_id
      where m.id = target_uuid and not m.is_removed and not p.is_removed and public.can_access_content(c.visibility, c.class_name);
  else
    select m.author_id, left(r.name || E'\n' || m.content, 2000), '/chats'
      into owner_id, excerpt, destination
      from public.chat_messages m join public.chat_rooms r on r.id = m.room_id
      where m.id = target_uuid and not m.is_removed and public.can_access_content(r.visibility, r.class_name);
  end if;
  if owner_id is null or owner_id = viewer then
    raise exception 'Conteúdo indisponível para denúncia.' using errcode = '42501';
  end if;
  -- Serializa envios do mesmo usuário, incluindo cliques em abas diferentes.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(viewer::text, 0));
  select id into result from public.reports
    where reporter_id = viewer and target_type = target_kind and target_id = target_uuid and status = 'pending'
    limit 1;
  if result is not null then
    raise exception 'Você já possui uma denúncia pendente deste conteúdo.' using errcode = '23505';
  end if;
  if (select count(*) from public.reports where reporter_id = viewer and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'Limite de denúncias atingido. Tente novamente mais tarde.' using errcode = 'P0001';
  end if;
  insert into public.reports(reporter_id, target_type, target_id, reason, target_excerpt, target_path)
    values (viewer, target_kind, target_uuid, btrim(report_reason), excerpt, destination)
    returning id into result;
  return result;
end;
$$;
revoke all on function public.submit_report(text, uuid, text) from public, anon;
grant execute on function public.submit_report(text, uuid, text) to authenticated;


commit;

-- Notificações privadas. Execute após 20260923_content_removal.sql.
begin;
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('comment','content_removed','content_restored')),
  source_id uuid not null,
  target_type text not null check (target_type in ('post','comment','message')),
  target_id uuid not null,
  destination text not null,
  message text not null,
  reason text,
  created_at timestamptz not null default clock_timestamp(),
  read_at timestamptz,
  unique(kind, source_id)
);
alter table public.notifications enable row level security;
revoke all on public.notifications from public, anon, authenticated;
grant select on public.notifications to authenticated;
drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications for select to authenticated
  using (recipient_id=auth.uid());
create index if not exists notifications_recipient_created_idx
  on public.notifications(recipient_id,created_at desc,id desc);
create index if not exists notifications_unread_idx
  on public.notifications(recipient_id) where read_at is null;

create or replace function public.notify_post_comment()
returns trigger language plpgsql security definer set search_path='' as $$
declare recipient uuid;
begin
  select author_id into recipient from public.posts where id=new.post_id and not is_removed;
  if recipient is not null and recipient<>new.author_id and not new.is_removed then
    insert into public.notifications(recipient_id,kind,source_id,target_type,target_id,destination,message)
      values(recipient,'comment',new.id,'comment',new.id,'/foruns/topico/'||new.post_id::text,
        'Alguém comentou no seu tópico.')
      on conflict(kind,source_id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.notify_post_comment() from public, anon, authenticated;
drop trigger if exists comments_notify_author on public.comments;
create trigger comments_notify_author after insert on public.comments
  for each row execute function public.notify_post_comment();

create or replace function public.notify_content_moderation()
returns trigger language plpgsql security definer set search_path='' as $$
declare recipient uuid; destination text; label text;
begin
  if new.target_type='post' then
    select author_id,'/foruns/topico/'||id::text into recipient,destination from public.posts where id=new.target_id;
    label := 'Seu tópico';
  elsif new.target_type='comment' then
    select author_id,'/foruns/topico/'||post_id::text into recipient,destination from public.comments where id=new.target_id;
    label := 'Seu comentário';
  elsif new.target_type='message' then
    select author_id,'/chats' into recipient,destination from public.chat_messages where id=new.target_id;
    label := 'Sua mensagem';
  end if;
  if recipient is not null then
    insert into public.notifications(recipient_id,kind,source_id,target_type,target_id,destination,message,reason)
      values(recipient,case when new.action='remove' then 'content_removed' else 'content_restored' end,
        new.id,new.target_type,new.target_id,destination,
        label || case when new.target_type='message'
          then case when new.action='remove' then ' foi removida pela moderação.' else ' foi restaurada pela moderação.' end
          else case when new.action='remove' then ' foi removido pela moderação.' else ' foi restaurado pela moderação.' end end,
        new.reason)
      on conflict(kind,source_id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.notify_content_moderation() from public, anon, authenticated;
drop trigger if exists moderation_notify_author on public.content_moderation_events;
create trigger moderation_notify_author after insert on public.content_moderation_events
  for each row execute function public.notify_content_moderation();

create or replace function public.mark_notification_read(notification_uuid uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Entre na sua conta.' using errcode='42501'; end if;
  update public.notifications set read_at=clock_timestamp()
    where id=notification_uuid and recipient_id=auth.uid() and read_at is null;
end;
$$;
revoke all on function public.mark_notification_read(uuid) from public, anon;
grant execute on function public.mark_notification_read(uuid) to authenticated;

do $$
begin
  if not exists(select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
commit;
