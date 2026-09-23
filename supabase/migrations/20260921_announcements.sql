-- Execute no SQL Editor do Supabase após o schema base.
begin;

create index if not exists announcements_created_at_idx
  on public.announcements(created_at desc, id desc);

drop policy if exists announcements_select on public.announcements;
create policy announcements_select on public.announcements
for select to authenticated using (
  author_id = auth.uid() or public.can_access_content(visibility, class_name)
);

drop policy if exists announcements_insert_staff on public.announcements;
create policy announcements_insert_staff on public.announcements
for insert to authenticated with check (
  author_id = auth.uid()
  and char_length(btrim(title)) between 5 and 120
  and char_length(btrim(content)) between 10 and 5000
  and visibility in ('everyone', 'students', 'teachers', 'class', 'staff', 'moderation')
  and (
    (visibility = 'class' and class_name is not null and char_length(btrim(class_name)) between 1 and 80)
    or (visibility <> 'class' and class_name is null)
  )
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('teacher', 'coordination', 'moderator')
      and (visibility <> 'moderation' or p.role in ('coordination', 'moderator'))
  )
);

grant select, insert on public.announcements to authenticated;

commit;

