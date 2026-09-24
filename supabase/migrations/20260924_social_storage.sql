-- Aplicar depois de social_feed. Bucket privado; não usar URL pública.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('post-images','post-images',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists social_images_upload on storage.objects;
create policy social_images_upload on storage.objects for insert to authenticated with check (
  bucket_id='post-images' and public.account_is_active()
  and name ~ ('^'||auth.uid()::text||'/[0-9a-f-]{36}\.(jpg|png|webp)$')
);
drop policy if exists social_images_read on storage.objects;
create policy social_images_read on storage.objects for select to authenticated using (
  bucket_id='post-images' and public.account_is_active() and (
    (split_part(name,'/',1)=auth.uid()::text and not exists(select 1 from public.posts p where p.image_path=name))
    or exists(select 1 from public.posts p where p.image_path=name)
  )
);
drop policy if exists social_images_delete on storage.objects;
create policy social_images_delete on storage.objects for delete to authenticated using (
  bucket_id='post-images' and public.account_is_active() and split_part(name,'/',1)=auth.uid()::text
);
commit;
