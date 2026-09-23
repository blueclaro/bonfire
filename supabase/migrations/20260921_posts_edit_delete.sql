-- Edição e exclusão dos próprios tópicos. Execute após o schema base.
begin;

drop policy if exists posts_update_own on public.posts;
create policy posts_update_own on public.posts
for update to authenticated using (
  author_id = auth.uid()
  and exists (select 1 from public.forum_categories c where c.id = posts.category_id)
) with check (
  author_id = auth.uid()
  and exists (select 1 from public.forum_categories c where c.id = posts.category_id)
  and char_length(btrim(title)) between 5 and 120
  and char_length(btrim(content)) between 10 and 5000
);

drop policy if exists posts_delete_own on public.posts;
create policy posts_delete_own on public.posts
for delete to authenticated using (
  author_id = auth.uid()
  and exists (select 1 from public.forum_categories c where c.id = posts.category_id)
);

-- Somente o texto pode ser alterado; campos de autoria, categoria e moderação ficam protegidos.
revoke update on public.posts from public, anon, authenticated;
revoke update(id, category_id, author_id, is_pinned, is_locked, created_at, updated_at)
  on public.posts from public, anon, authenticated;
grant update(title, content) on public.posts to authenticated;
grant delete on public.posts to authenticated;

create or replace function public.stamp_post_edit()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.title is distinct from old.title or new.content is distinct from old.content then
    new.updated_at := clock_timestamp();
  end if;
  return new;
end;
$$;
drop trigger if exists posts_stamp_edit on public.posts;
create trigger posts_stamp_edit before update on public.posts
for each row execute function public.stamp_post_edit();

-- comments.post_id já usa ON DELETE CASCADE no schema base.
commit;

