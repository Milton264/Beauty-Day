-- Ejecutar como propietario en un proyecto Beauty Day ya inicializado.
-- Comprobaciones transaccionales: no deja usuarios, códigos ni ediciones.
begin;
create temporary table beauty_test_state(admin_id uuid,visitor_id uuid,unconfirmed_id uuid,doc jsonb,revision bigint,code text);
insert into beauty_test_state select gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),document,revision,null from public.beauty_content where id='site';
grant select,update on beauty_test_state to anon,authenticated;
insert into auth.users(id,email,email_confirmed_at)
 select admin_id,'beauty-test-admin-'||admin_id||'@example.invalid',now() from beauty_test_state union all
 select visitor_id,'beauty-test-visitor-'||visitor_id||'@example.invalid',now() from beauty_test_state union all
 select unconfirmed_id,'beauty-test-unconfirmed-'||unconfirmed_id||'@example.invalid',null from beauty_test_state;
insert into beauty_private.admin_emails(email)
 select 'beauty-test-admin-'||admin_id||'@example.invalid' from beauty_test_state union all
 select 'beauty-test-unconfirmed-'||unconfirmed_id||'@example.invalid' from beauty_test_state;

set local role anon;
do $$begin
 if not exists(select 1 from public.beauty_content) then raise exception 'Fallo: catálogo público inaccesible';end if;
 if exists(select 1 from public.beauty_content c,jsonb_array_elements(c.document->'services') s where s->'price'<>'null'::jsonb or s->>'pricePrefix'<>'') then raise exception 'Fallo: precios públicos';end if;
 begin perform * from public.beauty_prices;raise exception 'Fallo: precios directos accesibles';exception when insufficient_privilege then null;end;
 begin perform public.beauty_admin_read();raise exception 'Fallo: lectura administrativa anónima';exception when insufficient_privilege then null;end;
 begin perform public.beauty_issue_code('{}');raise exception 'Fallo: alta de código anónima';exception when insufficient_privilege then null;end;
 begin perform public.beauty_manage_admin('denied@example.invalid',true);raise exception 'Fallo: autorización administrativa anónima';exception when insufficient_privilege then null;end;
 begin update public.beauty_content set revision=revision+1;raise exception 'Fallo: visitante puede editar';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',visitor_id::text,true) from beauty_test_state;
set local role authenticated;
do $$begin
 if beauty_private.is_admin() then raise exception 'Fallo: cuenta común autorizada';end if;
 begin perform public.beauty_manage_admin('denied@example.invalid',true);raise exception 'Fallo: cuenta común autoriza administradores';exception when insufficient_privilege then null;end;
 if exists(select 1 from public.beauty_prices) then raise exception 'Fallo: cuenta común ve tarifas';end if;
 begin insert into storage.objects(bucket_id,name) values('beauty-images','test-denied.jpg');raise exception 'Fallo: cuenta común sube fotos';exception when insufficient_privilege then null;end;
 begin perform * from beauty_private.admin_emails;raise exception 'Fallo: directorio administrativo expuesto';exception when insufficient_privilege then null;end;
 begin perform public.beauty_admin_read();raise exception 'Fallo: cuenta común abre panel';exception when insufficient_privilege then null;end;
 begin perform public.beauty_save_content((select doc from beauty_test_state),(select revision from beauty_test_state));raise exception 'Fallo: cuenta común guarda';exception when insufficient_privilege then null;end;
 begin perform public.beauty_issue_code('{"instagram":true,"tiktok":true,"facebook":true,"reservation":true}');raise exception 'Fallo: cuenta común genera códigos';exception when insufficient_privilege then null;end;
 if public.beauty_read_prices('invalido') ? 'prices' then raise exception 'Fallo: código inválido muestra precios';end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',unconfirmed_id::text,true) from beauty_test_state;
set local role authenticated;
do $$begin if beauty_private.is_admin() then raise exception 'Fallo: cuenta sin confirmar autorizada';end if;end $$;
reset role;
select set_config('request.jwt.claim.sub',admin_id::text,true) from beauty_test_state;
set local role authenticated;
do $$declare r jsonb;c jsonb;begin
 if not beauty_private.is_admin() then raise exception 'Fallo: administrador sin permiso';end if;
 insert into storage.objects(bucket_id,name) values('beauty-images','test-allowed.jpg');
 if jsonb_array_length(public.beauty_list_admins())<2 then raise exception 'Fallo: no lista administradores';end if;
 r=public.beauty_manage_admin(' Beauty-Test-Invite@Example.Invalid ',true);
 if r->>'saved'<>'true' then raise exception 'Fallo: no autoriza un correo nuevo';end if;
 if not exists(select 1 from jsonb_array_elements(public.beauty_list_admins()) a where a->>'email'='beauty-test-invite@example.invalid' and (a->>'active')::boolean) then raise exception 'Fallo: correo nuevo sin normalizar o activar';end if;
 perform public.beauty_manage_admin('beauty-test-invite@example.invalid',true);
 if (select count(*) from jsonb_array_elements(public.beauty_list_admins()) a where a->>'email'='beauty-test-invite@example.invalid')<>1 then raise exception 'Fallo: autorización repetida duplica un correo';end if;
 perform public.beauty_manage_admin('beauty-test-invite@example.invalid',false);
 if not exists(select 1 from jsonb_array_elements(public.beauty_list_admins()) a where a->>'email'='beauty-test-invite@example.invalid' and not (a->>'active')::boolean) then raise exception 'Fallo: no desactiva un correo existente';end if;
 perform public.beauty_manage_admin('beauty-test-invite@example.invalid',true);
 if not exists(select 1 from jsonb_array_elements(public.beauty_list_admins()) a where a->>'email'='beauty-test-invite@example.invalid' and (a->>'active')::boolean) then raise exception 'Fallo: no reactiva un correo existente';end if;
 begin perform public.beauty_manage_admin('correo-invalido',true);raise exception 'Fallo: acepta un correo inválido';exception when invalid_parameter_value then null;end;

 begin perform public.beauty_manage_admin('beauty-test-admin-'||(select admin_id from beauty_test_state)||'@example.invalid',false);raise exception 'Fallo: puede desactivar su propia cuenta' using errcode='XX000';exception when raise_exception then null;end;
 if not(public.beauty_admin_read() ? 'content') then raise exception 'Fallo: administrador sin contenido';end if;
 select jsonb_set(doc,'{services,0,price}','777') into c from beauty_test_state;
 r=public.beauty_save_content(c,(select revision from beauty_test_state));
 if (r->>'revision')::bigint<>(select revision+1 from beauty_test_state) then raise exception 'Fallo: revisión no avanzó';end if;
 if (select document#>'{services,0,price}' from public.beauty_content)<>'null'::jsonb then raise exception 'Fallo: tarifa filtrada al público';end if;
 if (public.beauty_admin_read()#>>'{content,services,0,price}')::integer<>777 then raise exception 'Fallo: tarifa no guardada';end if;
 begin perform public.beauty_save_content(c,(select revision from beauty_test_state));raise exception 'Fallo: revisión obsoleta aceptada';exception when serialization_failure then null;end;
 begin perform public.beauty_issue_code('{}');raise exception 'Fallo: código sin comprobaciones';exception when invalid_parameter_value then null;end;
 update beauty_test_state set code=public.beauty_issue_code('{"instagram":true,"tiktok":true,"facebook":true,"reservation":true}')->>'code';
 if jsonb_array_length(public.beauty_read_prices((select code from beauty_test_state))->'prices')<1 then raise exception 'Fallo: código válido no lee tarifas';end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$begin
 if jsonb_array_length(public.beauty_read_prices((select code from beauty_test_state))->'prices')<1 then raise exception 'Fallo: visitante con código no lee tarifas';end if;
 if not exists(select 1 from storage.objects where name='test-allowed.jpg') then raise exception 'Fallo: foto pública no visible';end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',admin_id::text,true) from beauty_test_state;
set local role authenticated;
select public.beauty_revoke_code(code) from beauty_test_state;
reset role;
set local role anon;
do $$begin if not(public.beauty_read_prices((select code from beauty_test_state)) ? 'error') then raise exception 'Fallo: código revocado funciona';end if;end $$;
reset role;
-- Expiración y límite de intentos en otra dirección de prueba.
update beauty_private.price_codes set revoked=false,expires_at=now()-interval '1 second' where code_hash=encode(extensions.digest(regexp_replace((select code from beauty_test_state),'-','','g'),'sha256'),'hex');
select set_config('request.headers','{"x-forwarded-for":"198.51.100.123"}',true);
set local role anon;
do $$declare r jsonb;i integer;begin
 if not(public.beauty_read_prices((select code from beauty_test_state)) ? 'error') then raise exception 'Fallo: código vencido funciona';end if;
 for i in 1..20 loop r=public.beauty_read_prices('incorrecto');end loop;
 if r->>'error'<>'Demasiados intentos. Espera un minuto.' then raise exception 'Fallo: sin límite de intentos';end if;
end $$;
reset role;
-- La revocación del administrador invalida el permiso sin esperar a otro JWT.
update beauty_private.admin_emails set active=false where email='beauty-test-admin-'||(select admin_id from beauty_test_state)||'@example.invalid';
select set_config('request.jwt.claim.sub',admin_id::text,true) from beauty_test_state;
set local role authenticated;
do $$begin if beauty_private.is_admin() then raise exception 'Fallo: administrador desactivado conserva acceso';end if;end $$;
reset role;
select 'Permisos, transacciones, revisiones y códigos verificados. Sin cambios persistentes.' as resultado;
rollback;
