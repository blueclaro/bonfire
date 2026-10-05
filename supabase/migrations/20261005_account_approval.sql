-- Aplicar depois das migrações de setembro. Contas existentes mantêm o acesso.
begin;

alter table public.profiles add column if not exists approval_status text not null default 'approved'
  check (approval_status in ('pending','approved','rejected'));
alter table public.profiles alter column approval_status set default 'pending';
alter table public.profiles add column if not exists approval_reviewed_at timestamptz;
alter table public.profiles add column if not exists approval_reviewed_by uuid references public.profiles(id) on delete set null;
alter table public.profiles add column if not exists approval_reason text;
create index if not exists profiles_approval_queue_idx on public.profiles(approval_status,created_at,id);
revoke update(approval_status,approval_reviewed_at,approval_reviewed_by,approval_reason)
  on public.profiles from public,anon,authenticated;

-- Não aceita aprovação fornecida por metadata ou INSERT do cliente.
create or replace function public.initialize_account_approval() returns trigger
language plpgsql set search_path='' as $$
begin
  new.approval_status := 'pending';
  new.approval_reviewed_at := null;
  new.approval_reviewed_by := null;
  new.approval_reason := null;
  return new;
end; $$;
drop trigger if exists profiles_initialize_approval on public.profiles;
create trigger profiles_initialize_approval before insert on public.profiles
for each row execute function public.initialize_account_approval();

create or replace function public.account_is_active()
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.profiles p where p.id=auth.uid()
    and p.approval_status='approved'
    and (p.temporary_expires_at is null or
      (p.temporary_expires_at > now() and exists(select 1 from public.temporary_access_settings where id and access_enabled))));
$$;
revoke all on function public.account_is_active() from public,anon;
grant execute on function public.account_is_active() to authenticated;

create or replace function public.can_review_accounts()
returns boolean language sql stable security definer set search_path='' as $$
  select public.account_is_active() and exists(select 1 from public.profiles
    where id=auth.uid() and role in ('moderator','coordination') and temporary_expires_at is null);
$$;
revoke all on function public.can_review_accounts() from public,anon;
grant execute on function public.can_review_accounts() to authenticated;

create or replace function public.review_account(account_uuid uuid, decision text, review_reason text default '')
returns void language plpgsql security definer set search_path='' as $$
declare target public.profiles;
begin
  if not public.can_review_accounts() then
    raise exception 'Acesso restrito à moderação.' using errcode='42501';
  end if;
  if account_uuid=auth.uid() then
    raise exception 'Você não pode analisar sua própria conta.' using errcode='42501';
  end if;
  if decision is null or decision not in ('approved','rejected') or review_reason is null
    or char_length(btrim(review_reason)) > 2000
    or (decision='rejected' and char_length(btrim(review_reason)) < 10) then
    raise exception 'Informe uma decisão válida e um motivo de 10 a 2000 caracteres para rejeitar.' using errcode='22023';
  end if;
  select * into target from public.profiles where id=account_uuid for update;
  if not found or target.approval_status<>'pending' then
    raise exception 'Conta já analisada ou não encontrada. Atualize a lista.' using errcode='P0002';
  end if;
  if decision='approved' and target.temporary_expires_at is null and not exists(
    select 1 from auth.users where id=account_uuid and email_confirmed_at is not null
  ) then
    raise exception 'A conta precisa confirmar o e-mail antes da aprovação.' using errcode='22023';
  end if;
  if decision='approved' and target.temporary_expires_at <= now() then
    raise exception 'Esta conta temporária já expirou.' using errcode='22023';
  end if;
  update public.profiles set approval_status=decision,approval_reason=nullif(btrim(review_reason),''),
    approval_reviewed_by=auth.uid(),approval_reviewed_at=clock_timestamp() where id=account_uuid;
end; $$;
revoke all on function public.review_account(uuid,text,text) from public,anon;
grant execute on function public.review_account(uuid,text,text) to authenticated;

-- E-mail só é exposto à equipe; a lista identifica cadastros ainda não confirmados.
create or replace function public.account_review_queue(queue_status text default 'pending', page_offset integer default 0)
returns table(id uuid,username text,display_name text,role text,class_name text,created_at timestamptz,
  temporary_expires_at timestamptz,email text,email_verified boolean,approval_status text,
  approval_reason text,approval_reviewed_at timestamptz,reviewer_name text)
language plpgsql stable security definer set search_path='' as $$
begin
  if not public.can_review_accounts() then raise exception 'Acesso restrito à moderação.' using errcode='42501'; end if;
  if queue_status is null or queue_status not in ('pending','approved','rejected') or page_offset is null or page_offset<0 then
    raise exception 'Filtro inválido.' using errcode='22023';
  end if;
  return query select p.id,p.username,p.display_name,p.role,p.class_name,p.created_at,p.temporary_expires_at,
    u.email::text,u.email_confirmed_at is not null,p.approval_status,p.approval_reason,p.approval_reviewed_at,
    coalesce(reviewer.display_name,reviewer.username)
    from public.profiles p join auth.users u on u.id=p.id
    left join public.profiles reviewer on reviewer.id=p.approval_reviewed_by
    where p.approval_status=queue_status order by p.created_at desc,p.id desc limit 21 offset page_offset;
end; $$;
revoke all on function public.account_review_queue(text,integer) from public,anon;
grant execute on function public.account_review_queue(text,integer) to authenticated;

-- Motivos e autoria das decisões são privados: só a equipe e o próprio usuário.
create or replace function public.my_account_approval()
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('approval_status',approval_status,'approval_reason',approval_reason)
    from public.profiles where id=auth.uid();
$$;
revoke all on function public.my_account_approval() from public,anon;
grant execute on function public.my_account_approval() to authenticated;
revoke select on public.profiles from public,anon,authenticated;
revoke select(approval_reason,approval_reviewed_by,approval_reviewed_at) on public.profiles from public,anon,authenticated;
do $$
declare columns_to_read text;
begin
  select string_agg(format('%I',column_name),',') into columns_to_read
    from information_schema.columns where table_schema='public' and table_name='profiles'
    and column_name not in ('approval_reason','approval_reviewed_by','approval_reviewed_at');
  execute format('grant select(%s) on public.profiles to authenticated',columns_to_read);
end $$;

drop policy if exists approved_profile_edit on public.profiles;
create policy approved_profile_edit on public.profiles as restrictive for update to authenticated
  using(public.account_is_active()) with check(public.account_is_active());

-- Completa a proteção das tabelas opcionais adicionadas pelas migrações sociais.
do $$
declare target text;
begin
  foreach target in array array['forum_categories','posts','comments','chat_rooms','chat_messages','announcements',
    'reports','notifications','content_moderation_events','post_reactions','user_blocks','direct_messages',
    'profile_follows','chat_room_members'] loop
    if to_regclass('public.'||target) is not null then
      execute format('drop policy if exists active_account_required on public.%I',target);
      execute format('create policy active_account_required on public.%I as restrictive for all to authenticated using(public.account_is_active()) with check(public.account_is_active())',target);
    end if;
  end loop;
end $$;

-- As funções antigas SECURITY DEFINER também precisam exigir aprovação.

create or replace function public.reported_content_state(report_uuid uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare r public.reports; removed boolean;
begin
  if not public.account_is_active() then raise exception 'Conta aguardando aprovação ou indisponível.' using errcode='42501'; end if;
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

create or replace function public.moderate_reported_content(report_uuid uuid, moderation_action text, moderation_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare r public.reports; removed boolean; actor text; desired boolean;
begin
  if not public.account_is_active() then raise exception 'Conta aguardando aprovação ou indisponível.' using errcode='42501'; end if;
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

create or replace function public.submit_report(target_kind text, target_uuid uuid, report_reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  viewer uuid := auth.uid();
  owner_id uuid;
  excerpt text;
  destination text;
  result uuid;
begin
  if not public.account_is_active() then raise exception 'Conta aguardando aprovação ou indisponível.' using errcode='42501'; end if;
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

create or replace function public.moderate_post(
  target_post_id uuid, moderation_action text, enabled boolean
)
returns table(is_pinned boolean, is_locked boolean)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.account_is_active() then raise exception 'Conta aguardando aprovação ou indisponível.' using errcode='42501'; end if;
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

create or replace function public.review_report(report_uuid uuid, resolution text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.account_is_active() then raise exception 'Conta aguardando aprovação ou indisponível.' using errcode='42501'; end if;
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

create or replace function public.staff_remove_post(post_uuid uuid, moderation_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare removed boolean; actor text;
begin
  if not public.account_is_active() then raise exception 'Conta aguardando aprovação ou indisponível.' using errcode='42501'; end if;
  select coalesce(nullif(display_name,''),username,'Membro da equipe') into actor
    from public.profiles where id=auth.uid() and role in ('coordination','moderator');
  if actor is null then raise exception 'Acesso restrito a moderacao.' using errcode='42501'; end if;
  if moderation_reason is null or char_length(btrim(moderation_reason)) not between 10 and 2000 then
    raise exception 'Informe um motivo entre 10 e 2000 caracteres.' using errcode='22023';
  end if;
  select is_removed into removed from public.posts where id=post_uuid for update;
  if removed is null then raise exception 'Faisca nao encontrada.' using errcode='P0002'; end if;
  if removed then raise exception 'A faisca ja foi removida.' using errcode='40001'; end if;
  update public.posts set is_removed=true where id=post_uuid;
  insert into public.content_moderation_events(target_type,target_id,report_id,action,reason,actor_id,actor_name)
    values('post',post_uuid,null,'remove',btrim(moderation_reason),auth.uid(),actor);
end; $$;

revoke all on function public.staff_remove_post(uuid,text) from public,anon;
grant execute on function public.staff_remove_post(uuid,text) to authenticated;

create or replace function public.has_removed_comments(post_uuid uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select public.account_is_active() and exists(select 1 from public.comments where post_id=post_uuid and is_removed);
$$;

commit;
