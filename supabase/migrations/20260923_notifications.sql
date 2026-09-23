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
