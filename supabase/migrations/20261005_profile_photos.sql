-- Aplicar após 20261005_account_approval.sql. Fotos privadas da comunidade.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('avatars','avatars',false,2097152,array['image/jpeg'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists avatars_upload_own on storage.objects;
create policy avatars_upload_own on storage.objects for insert to authenticated with check(
  bucket_id='avatars' and public.account_is_active()
  and name ~ ('^'||auth.uid()::text||'/[0-9a-f-]{36}\.jpg$')
);
drop policy if exists avatars_read on storage.objects;
create policy avatars_read on storage.objects for select to authenticated using(
  bucket_id='avatars' and public.account_is_active() and (
    split_part(name,'/',1)=auth.uid()::text
    or exists(select 1 from public.profiles where avatar_url='avatars/'||name)
  )
);
drop policy if exists avatars_delete_own on storage.objects;
create policy avatars_delete_own on storage.objects for delete to authenticated using(
  bucket_id='avatars' and public.account_is_active() and split_part(name,'/',1)=auth.uid()::text
  and not exists(select 1 from public.profiles where avatar_url='avatars/'||name)
);
-- Cada foto usa um novo nome; não libera UPDATE/sobrescrita de objetos.
revoke update(avatar_url) on public.profiles from public,anon,authenticated;

create or replace function public.set_profile_avatar(avatar_path text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.account_is_active() then raise exception 'Conta indisponível.' using errcode='42501'; end if;
  if avatar_path is not null then
    if avatar_path !~ ('^avatars/'||auth.uid()::text||'/[0-9a-f-]{36}\.jpg$') then
      raise exception 'Foto inválida ou não enviada por esta conta.' using errcode='22023';
    end if;
    -- Impede apagar o arquivo entre a validação e a associação ao perfil.
    perform 1 from storage.objects where bucket_id='avatars' and name=substr(avatar_path,9) for share;
    if not found then raise exception 'Foto não encontrada.' using errcode='22023'; end if;
  end if;
  -- Serializa trocas concorrentes do mesmo perfil, inclusive em abas diferentes.
  perform 1 from public.profiles where id=auth.uid() for update;
  update public.profiles set avatar_url=avatar_path,updated_at=clock_timestamp() where id=auth.uid();
end; $$;
revoke all on function public.set_profile_avatar(text) from public,anon;
grant execute on function public.set_profile_avatar(text) to authenticated;
commit;
