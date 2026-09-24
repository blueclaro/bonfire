-- Contas temporárias para apresentação. Aplicar após 20260923_notifications.sql.
begin;
alter table public.profiles add column if not exists temporary_expires_at timestamptz;
alter table public.profiles add column if not exists temporary_tag text;
create unique index if not exists profiles_temporary_tag_unique
  on public.profiles(lower(temporary_tag)) where temporary_tag is not null;

create table if not exists public.temporary_access_settings (
  id boolean primary key default true check(id),
  registration_enabled boolean not null default false,
  access_enabled boolean not null default true,
  duration_hours integer not null default 24 check(duration_hours between 1 and 168),
  max_accounts integer not null default 200 check(max_accounts between 1 and 1000)
);
insert into public.temporary_access_settings(id) values(true) on conflict do nothing;
alter table public.temporary_access_settings enable row level security;
revoke all on public.temporary_access_settings from public,anon,authenticated;

create or replace function public.temporary_access_status()
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('enabled',registration_enabled and access_enabled,
    'access_enabled',access_enabled,
    'duration_hours',duration_hours,
    'available', (select count(*) from public.profiles where temporary_expires_at is not null) < max_accounts)
    from public.temporary_access_settings where id;
$$;
revoke all on function public.temporary_access_status() from public;
grant execute on function public.temporary_access_status() to anon,authenticated;

create or replace function public.account_is_active()
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.profiles p where p.id=auth.uid()
    and (p.temporary_expires_at is null or
      (p.temporary_expires_at > now() and exists(select 1 from public.temporary_access_settings where id and access_enabled))));
$$;
revoke all on function public.account_is_active() from public,anon;
grant execute on function public.account_is_active() to authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path='' as $$
declare settings public.temporary_access_settings; participant text; tag text;
begin
  -- O indicador vem do Auth, nunca do metadata fornecido pelo participante.
  if coalesce((to_jsonb(new)->>'is_anonymous')::boolean,false) then
    select * into settings from public.temporary_access_settings where id for update;
    if not found or not settings.registration_enabled or not settings.access_enabled then
      raise exception 'Entrada temporária fechada.' using errcode='42501';
    end if;
    participant := btrim(coalesce(new.raw_user_meta_data->>'temporary_name',''));
    tag := coalesce(new.raw_user_meta_data->>'temporary_tag','');
    if participant !~ '^[^#[:cntrl:]]{2,32}$' or tag !~ '^[A-Za-z0-9]{1,16}$' then
      raise exception 'Nome ou tag inválidos.' using errcode='22023';
    end if;
    if (select count(*) from public.profiles where temporary_expires_at is not null) >= settings.max_accounts then
      raise exception 'Limite de participantes atingido.' using errcode='42501';
    end if;
    insert into public.profiles(id,username,display_name,role,class_name,temporary_tag,temporary_expires_at)
      values(new.id,'visitante'||replace(new.id::text,'-',''),participant||'#'||tag,'student',null,tag,
        now()+make_interval(hours=>settings.duration_hours));
  else
    insert into public.profiles(id,username,display_name,role,class_name)
      values(new.id,coalesce(new.raw_user_meta_data->>'username',split_part(new.email,'@',1)),
        coalesce(new.raw_user_meta_data->>'full_name',split_part(new.email,'@',1)),
        'student',new.raw_user_meta_data->>'class_name') on conflict(id) do nothing;
  end if;
  return new;
end;
$$;

create or replace function public.can_access_content(content_visibility text, content_class_name text default null)
returns boolean language sql stable security definer set search_path='' as $$
  select public.account_is_active() and exists(select 1 from public.profiles p where p.id=auth.uid() and (
    (p.temporary_expires_at is not null and content_visibility='everyone')
    or (p.temporary_expires_at is null and (
      p.role in ('coordination','moderator') or content_visibility='everyone'
      or (content_visibility='students' and p.role='student')
      or (content_visibility='teachers' and p.role='teacher')
      or (content_visibility='staff' and p.role in ('teacher','coordination','moderator'))
      or (content_visibility='moderation' and p.role in ('coordination','moderator'))
      or (content_visibility='class' and content_class_name is not null
          and (p.class_name=content_class_name or p.role in ('teacher','coordination','moderator')))
    ))
  ));
$$;

-- O banco bloqueia leitura e escrita mesmo com uma sessão ainda válida no Auth.
do $$
declare target text;
begin
  foreach target in array array['forum_categories','posts','comments','chat_rooms','chat_messages','announcements','reports','notifications','content_moderation_events'] loop
    execute format('drop policy if exists active_account_required on public.%I', target);
    execute format('create policy active_account_required on public.%I as restrictive for all to authenticated using (public.account_is_active()) with check (public.account_is_active())',target);
  end loop;
end $$;
drop policy if exists temporary_profile_read on public.profiles;
create policy temporary_profile_read on public.profiles as restrictive for select to authenticated
  using (id=auth.uid() or public.account_is_active());
drop policy if exists temporary_profile_no_edit on public.profiles;
create policy temporary_profile_no_edit on public.profiles as restrictive for update to authenticated
  using (temporary_expires_at is null) with check (temporary_expires_at is null);
revoke update(temporary_expires_at,temporary_tag) on public.profiles from public,anon,authenticated;

create or replace function public.mark_notification_read(notification_uuid uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.account_is_active() then raise exception 'Conta indisponível.' using errcode='42501'; end if;
  update public.notifications set read_at=clock_timestamp()
    where id=notification_uuid and recipient_id=auth.uid() and read_at is null;
end;
$$;
commit;
