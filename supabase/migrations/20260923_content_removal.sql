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
