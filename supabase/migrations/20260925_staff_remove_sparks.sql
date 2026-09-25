-- Permite remocao logica direta de faiscas por coordenacao e moderacao.
-- Aplicar depois de 20260925_user_chat_groups.sql.
begin;
-- A migração de threads permite a mesma origem notificar mais de um destinatário.
-- Atualiza também o gatilho de moderação para a nova chave única.
create or replace function public.notify_content_moderation()
returns trigger language plpgsql security definer set search_path='' as $$
declare recipient uuid; destination text; label text;
begin
  if new.target_type='post' then
    select author_id,'/foruns/topico/'||id::text into recipient,destination from public.posts where id=new.target_id;
    label := 'Sua faísca';
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
        label || case when new.target_type in ('post','message')
          then case when new.action='remove' then ' foi removida pela moderação.' else ' foi restaurada pela moderação.' end
          else case when new.action='remove' then ' foi removido pela moderação.' else ' foi restaurado pela moderação.' end end,
        new.reason)
      on conflict(kind,source_id,recipient_id) do nothing;
  end if;
  return new;
end; $$;

create or replace function public.staff_remove_post(post_uuid uuid, moderation_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare removed boolean; actor text;
begin
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
commit;
