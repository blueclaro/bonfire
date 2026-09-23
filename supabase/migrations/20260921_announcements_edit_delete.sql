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

