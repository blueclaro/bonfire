-- Impede remover a tag ao editar a identidade; preserva perfis legados intactos.
begin;
create or replace function public.validate_profile_handle() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.temporary_tag is not null then return new; end if;
  -- Alterar somente o cargo não força a renomeação de contas anteriores às tags.
  if tg_op='UPDATE' and new.username is not distinct from old.username then return new; end if;
  if new.username is null or new.username !~ '^[A-Za-z0-9_!*/.+-]{3,24}#[A-Za-z0-9]{1,4}$' then
    raise exception 'Use nome#tag, sem espaços. A tag é obrigatória e deve ter de 1 a 4 letras ou números.' using errcode='22023';
  end if;
  return new;
end; $$;
drop trigger if exists profiles_validate_handle on public.profiles;
create trigger profiles_validate_handle before insert or update of username,role on public.profiles
for each row execute function public.validate_profile_handle();
commit;
