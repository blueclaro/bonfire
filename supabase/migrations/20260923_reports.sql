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

