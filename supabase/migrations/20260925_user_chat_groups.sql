-- Grupos criados pelos usuarios. Aplicar depois de social_connections_threads.
begin;
alter table public.chat_rooms add column if not exists is_private boolean not null default false;
alter table public.chat_rooms add column if not exists archived_at timestamptz;
update public.chat_rooms set archived_at=coalesce(archived_at,clock_timestamp())
where id in ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003');

create table if not exists public.chat_room_members(
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check(role in ('owner','member')),
  joined_at timestamptz not null default now(),
  primary key(room_id,user_id)
);
alter table public.chat_room_members enable row level security;
revoke all on public.chat_room_members from public,anon,authenticated;
grant select on public.chat_room_members to authenticated;

create or replace function public.can_access_chat_group(room_uuid uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select public.account_is_active() and exists(
    select 1 from public.chat_rooms r where r.id=room_uuid and r.archived_at is null
      and (not r.is_private or r.created_by=auth.uid() or exists(
        select 1 from public.chat_room_members m where m.room_id=r.id and m.user_id=auth.uid()
      ))
  );
$$;
revoke all on function public.can_access_chat_group(uuid) from public,anon;
grant execute on function public.can_access_chat_group(uuid) to authenticated;

drop policy if exists rooms_select on public.chat_rooms;
create policy rooms_select on public.chat_rooms for select to authenticated
  using(public.can_access_chat_group(id));
drop policy if exists room_members_read on public.chat_room_members;
create policy room_members_read on public.chat_room_members for select to authenticated
  using(public.can_access_chat_group(room_id));
drop policy if exists messages_select on public.chat_messages;
create policy messages_select on public.chat_messages for select to authenticated
  using(public.can_access_chat_group(room_id));
drop policy if exists messages_insert_own on public.chat_messages;
create policy messages_insert_own on public.chat_messages for insert to authenticated
  with check(auth.uid()=author_id and public.can_access_chat_group(room_id));
drop policy if exists messages_update_own on public.chat_messages;
create policy messages_update_own on public.chat_messages for update to authenticated
  using(auth.uid()=author_id and public.can_access_chat_group(room_id))
  with check(auth.uid()=author_id and public.can_access_chat_group(room_id));

create or replace function public.create_chat_group(group_name text,group_description text,private_group boolean,member_ids uuid[] default '{}')
returns uuid language plpgsql security definer set search_path='' as $$
declare room_uuid uuid; member uuid;
begin
  if not public.account_is_active() then raise exception 'Conta indisponivel.' using errcode='42501'; end if;
  if char_length(btrim(group_name)) not between 2 and 60 then raise exception 'Nome deve ter entre 2 e 60 caracteres.' using errcode='22023'; end if;
  if char_length(btrim(coalesce(group_description,'')))>240 then raise exception 'Descricao deve ter ate 240 caracteres.' using errcode='22023'; end if;
  insert into public.chat_rooms(name,description,visibility,class_name,created_by,is_private)
    values(btrim(group_name),nullif(btrim(coalesce(group_description,'')),''),'everyone',null,auth.uid(),coalesce(private_group,false)) returning id into room_uuid;
  insert into public.chat_room_members(room_id,user_id,role) values(room_uuid,auth.uid(),'owner');
  if private_group then foreach member in array coalesce(member_ids,'{}') loop
    if member<>auth.uid() and exists(select 1 from public.profiles where id=member) then
      insert into public.chat_room_members(room_id,user_id,role) values(room_uuid,member,'member') on conflict do nothing;
    end if;
  end loop; end if;
  return room_uuid;
end; $$;
revoke all on function public.create_chat_group(text,text,boolean,uuid[]) from public,anon;
grant execute on function public.create_chat_group(text,text,boolean,uuid[]) to authenticated;

create or replace function public.delete_chat_group(room_uuid uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.chat_rooms where id=room_uuid and created_by=auth.uid()) then
    raise exception 'Apenas quem criou o grupo pode exclui-lo.' using errcode='42501';
  end if;
  delete from public.chat_rooms where id=room_uuid;
end; $$;
revoke all on function public.delete_chat_group(uuid) from public,anon;
grant execute on function public.delete_chat_group(uuid) to authenticated;
commit;
