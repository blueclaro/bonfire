-- Execute após 20260921_posts_edit_delete.sql. Pode ser reaplicado.
begin;

-- As permissões de edição dos autores continuam restritas a título e conteúdo.
-- A moderação é exposta somente por esta função, sem liberar UPDATE nas flags.
create or replace function public.moderate_post(
  target_post_id uuid, moderation_action text, enabled boolean
)
returns table(is_pinned boolean, is_locked boolean)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('coordination', 'moderator')
  ) then
    raise exception 'Apenas coordenação e moderadores podem moderar tópicos.'
      using errcode = '42501';
  end if;
  if moderation_action is null or moderation_action not in ('pin', 'lock') or enabled is null then
    raise exception 'Ação de moderação inválida.' using errcode = '22023';
  end if;
  return query
    update public.posts p set
      is_pinned = case when moderation_action = 'pin' then enabled else p.is_pinned end,
      is_locked = case when moderation_action = 'lock' then enabled else p.is_locked end
    where p.id = target_post_id
      and exists (
        select 1 from public.forum_categories c
        where c.id = p.category_id and public.can_access_content(c.visibility, c.class_name)
      )
    returning p.is_pinned, p.is_locked;
  if not found then
    raise exception 'Tópico não encontrado ou acesso indisponível.' using errcode = 'P0002';
  end if;
end;
$$;
revoke all on function public.moderate_post(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.moderate_post(uuid, text, boolean) to authenticated;

-- Impede que autores contornem a moderação enviando flags no INSERT.
drop policy if exists posts_insert_own on public.posts;
create policy posts_insert_own on public.posts for insert to authenticated with check (
  auth.uid() = author_id
  and exists (select 1 from public.forum_categories c where c.id = posts.category_id)
  and (
    (not is_pinned and not is_locked)
    or exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('coordination', 'moderator')
    )
  )
);

-- A verificação no banco protege inclusive abas antigas ainda com o formulário aberto.
drop policy if exists comments_insert_own on public.comments;
create policy comments_insert_own on public.comments for insert to authenticated with check (
  auth.uid() = author_id
  and exists (select 1 from public.posts p where p.id = comments.post_id and not p.is_locked)
);

create index if not exists posts_category_pinned_created_idx
  on public.posts(category_id, is_pinned desc, created_at desc, id desc);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'posts'
  ) then
    alter publication supabase_realtime add table public.posts;
  end if;
end $$;

commit;

