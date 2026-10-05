-- Correção isolada: preserva contas, decisões e permissões existentes.
-- auth.users.email é varchar no Supabase; RETURN QUERY exige o tipo text declarado.
begin;
create or replace function public.account_review_queue(queue_status text default 'pending', page_offset integer default 0)
returns table(id uuid,username text,display_name text,role text,class_name text,created_at timestamptz,
  temporary_expires_at timestamptz,email text,email_verified boolean,approval_status text,
  approval_reason text,approval_reviewed_at timestamptz,reviewer_name text)
language plpgsql stable security definer set search_path='' as $$
begin
  if not public.can_review_accounts() then raise exception 'Acesso restrito à moderação.' using errcode='42501'; end if;
  if queue_status is null or queue_status not in ('pending','approved','rejected') or page_offset is null or page_offset<0 then
    raise exception 'Filtro inválido.' using errcode='22023';
  end if;
  return query select p.id,p.username,p.display_name,p.role,p.class_name,p.created_at,p.temporary_expires_at,
    u.email::text,u.email_confirmed_at is not null,p.approval_status,p.approval_reason,p.approval_reviewed_at,
    coalesce(reviewer.display_name,reviewer.username)
    from public.profiles p join auth.users u on u.id=p.id
    left join public.profiles reviewer on reviewer.id=p.approval_reviewed_by
    where p.approval_status=queue_status order by p.created_at desc,p.id desc limit 21 offset page_offset;
end; $$;
revoke all on function public.account_review_queue(text,integer) from public,anon;
grant execute on function public.account_review_queue(text,integer) to authenticated;
commit;
