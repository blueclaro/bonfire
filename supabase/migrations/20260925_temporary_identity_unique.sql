-- Permite repetir o nome ou a tag separadamente. Somente a identidade completa
-- nome#tag precisa ser unica entre contas temporarias (sem diferenciar caixa).
begin;

drop index if exists public.profiles_temporary_tag_unique;
create unique index if not exists profiles_temporary_identity_unique
  on public.profiles(lower(display_name)) where temporary_tag is not null;

commit;
