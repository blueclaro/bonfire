-- Perfis permanentes usam a identidade unica nome#tag no campo username.
-- Perfis antigos, ainda sem tag, continuam validos.
begin;

create or replace function public.validate_profile_handle() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.role='student' and new.temporary_tag is null and
     (new.username is null or new.username !~ '^[A-Za-z0-9_!*/.+-]{3,24}(#[A-Za-z0-9]{1,4})?$') then
    raise exception 'Usuario invalido: use nome#tag, sem espacos' using errcode='22023';
  end if;
  return new;
end; $$;

drop trigger if exists profiles_validate_handle on public.profiles;
create trigger profiles_validate_handle before insert or update of username,role on public.profiles
for each row execute function public.validate_profile_handle();

create unique index if not exists profiles_username_casefold_unique
  on public.profiles(lower(username)) where username is not null;

commit;
