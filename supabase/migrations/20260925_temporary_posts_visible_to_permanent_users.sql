-- Contas permanentes e temporarias ativas compartilham o mesmo feed publico.
-- O tipo da conta do autor nunca interfere na leitura ou nas interacoes.
begin;

drop policy if exists posts_select on public.posts;
create policy posts_select on public.posts for select to authenticated using (
  public.account_is_active()
  and exists (
    select 1
    from public.forum_categories category
    where category.id=posts.category_id
      and public.can_access_content(category.visibility,category.class_name)
  )
);

drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments for select to authenticated using (
  public.account_is_active()
  and exists (
    select 1
    from public.posts post
    join public.forum_categories category on category.id=post.category_id
    where post.id=comments.post_id
      and public.can_access_content(category.visibility,category.class_name)
  )
);

drop policy if exists reactions_read on public.post_reactions;
create policy reactions_read on public.post_reactions for select to authenticated using (
  public.account_is_active()
  and exists (
    select 1
    from public.posts post
    join public.forum_categories category on category.id=post.category_id
    where post.id=post_reactions.post_id
      and public.can_access_content(category.visibility,category.class_name)
  )
);

drop policy if exists reactions_add on public.post_reactions;
create policy reactions_add on public.post_reactions for insert to authenticated with check (
  user_id=auth.uid()
  and public.account_is_active()
  and exists (
    select 1
    from public.posts post
    join public.forum_categories category on category.id=post.category_id
    where post.id=post_reactions.post_id
      and public.can_access_content(category.visibility,category.class_name)
      and (post_reactions.kind='like' or category.visibility='everyone')
  )
);

commit;
