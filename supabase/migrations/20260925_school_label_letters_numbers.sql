-- Corrige a etiqueta de turma para aceitar ate 5 letras ou numeros, como IA24.
-- O valor vazio continua permitido para remover a etiqueta do perfil.
begin;

create or replace function public.set_school_label(label text) returns void
language plpgsql security definer set search_path='' as $$
declare cleaned text := btrim(coalesce(label,''));
begin
  if not public.account_is_active() then raise exception 'Conta indisponível.' using errcode='42501'; end if;
  if cleaned !~ '^[A-Za-z0-9]{0,5}$' then
    raise exception 'Turma deve ter no máximo 5 letras ou números.' using errcode='22023';
  end if;
  update public.profiles set school_label=cleaned where id=auth.uid();
end; $$;

revoke all on function public.set_school_label(text) from public,anon;
grant execute on function public.set_school_label(text) to authenticated;

commit;
