-- Limita novas tags a 4 caracteres, sem alterar contas existentes ou abrir inscrições.
begin;
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path='' as $$
declare settings public.temporary_access_settings; participant text; tag text;
begin
  -- O indicador vem do Auth, nunca do metadata fornecido pelo participante.
  if coalesce((to_jsonb(new)->>'is_anonymous')::boolean,false) then
    select * into settings from public.temporary_access_settings where id for update;
    if not found or not settings.registration_enabled or not settings.access_enabled then
      raise exception 'Entrada temporária fechada.' using errcode='42501';
    end if;
    participant := btrim(coalesce(new.raw_user_meta_data->>'temporary_name',''));
    tag := coalesce(new.raw_user_meta_data->>'temporary_tag','');
    if participant !~ '^[^#[:cntrl:]]{2,32}$' or tag !~ '^[A-Za-z0-9]{1,4}$' then
      raise exception 'Nome ou tag inválidos.' using errcode='22023';
    end if;
    if (select count(*) from public.profiles where temporary_expires_at is not null) >= settings.max_accounts then
      raise exception 'Limite de participantes atingido.' using errcode='42501';
    end if;
    insert into public.profiles(id,username,display_name,role,class_name,temporary_tag,temporary_expires_at)
      values(new.id,'visitante'||replace(new.id::text,'-',''),participant||'#'||tag,'student',null,tag,
        now()+make_interval(hours=>settings.duration_hours));
  else
    insert into public.profiles(id,username,display_name,role,class_name)
      values(new.id,coalesce(new.raw_user_meta_data->>'username',split_part(new.email,'@',1)),
        coalesce(new.raw_user_meta_data->>'full_name',split_part(new.email,'@',1)),
        'student',new.raw_user_meta_data->>'class_name') on conflict(id) do nothing;
  end if;
  return new;
end;
$$;
commit;
