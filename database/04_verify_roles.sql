-- Pruebas de seguridad del nuevo rol. Todo se revierte, incluso si se ejecuta en producción.
begin;
create temporary table beauty_role_test(admin_id uuid,support_id uuid,other_id uuid,unconfirmed_id uuid,doc jsonb,revision bigint,own_code text,other_code text);
insert into beauty_role_test select gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),document,revision,null,null from public.beauty_content where id='site';
grant select,update on beauty_role_test to anon,authenticated;
insert into auth.users(id,email,email_confirmed_at)
 select admin_id,'role-test-admin-'||admin_id||'@example.invalid',now() from beauty_role_test union all
 select support_id,'role-test-support-'||support_id||'@example.invalid',now() from beauty_role_test union all
 select other_id,'role-test-other-'||other_id||'@example.invalid',now() from beauty_role_test union all
 select unconfirmed_id,'role-test-unconfirmed-'||unconfirmed_id||'@example.invalid',null from beauty_role_test;
insert into beauty_private.admin_emails(email,role)
 select 'role-test-admin-'||admin_id||'@example.invalid','admin' from beauty_role_test union all
 select 'role-test-support-'||support_id||'@example.invalid','support' from beauty_role_test union all
 select 'role-test-other-'||other_id||'@example.invalid','support' from beauty_role_test union all
 select 'role-test-unconfirmed-'||unconfirmed_id||'@example.invalid','support' from beauty_role_test;

set local role anon;
do $$begin
 begin perform public.beauty_panel_session();raise exception 'Fallo: panel público';exception when insufficient_privilege then null;end;
 begin perform public.beauty_manage_member('denied@example.invalid',true,'support');raise exception 'Fallo: público gestiona roles';exception when insufficient_privilege then null;end;
 begin perform public.beauty_revoke_code(repeat('0',32));raise exception 'Fallo: público retira códigos';exception when insufficient_privilege then null;end;
end $$;
reset role;

select set_config('request.jwt.claim.sub',admin_id::text,true) from beauty_role_test;
set local role authenticated;
do $$declare r jsonb;begin
 if public.beauty_panel_session()->>'role'<>'admin' then raise exception 'Fallo: rol administrativo';end if;
 perform public.beauty_save_content(jsonb_set((select doc from beauty_role_test),'{services,0,price}','777'),(select revision from beauty_role_test));
 perform public.beauty_manage_member(' Role-Invite@Example.Invalid ',true,'support');
 if not exists(select 1 from jsonb_array_elements(public.beauty_list_admins()) m where m->>'email'='role-invite@example.invalid' and m->>'role'='support') then raise exception 'Fallo: invitación de atención';end if;
 -- El panel antiguo tampoco eleva una cuenta de atención al reactivarla.
 perform public.beauty_manage_admin('role-invite@example.invalid',false);
 perform public.beauty_manage_admin('role-invite@example.invalid',true);
 if not exists(select 1 from jsonb_array_elements(public.beauty_list_admins()) m where m->>'email'='role-invite@example.invalid' and m->>'role'='support') then raise exception 'Fallo: escalada por compatibilidad';end if;
 begin perform public.beauty_manage_member('role-invite@example.invalid',true,'owner');raise exception 'Fallo: rol arbitrario';exception when invalid_parameter_value then null;end;
 begin perform public.beauty_manage_member('role-test-admin-'||(select admin_id from beauty_role_test)||'@example.invalid',true,'support');raise exception 'Fallo: puede reducir su propio rol' using errcode='XX000';exception when raise_exception then null;end;
 insert into storage.objects(bucket_id,name) values('beauty-images','role-test-admin-photo.jpg');
end $$;
reset role;

select set_config('request.jwt.claim.sub',support_id::text,true) from beauty_role_test;
set local role authenticated;
do $$declare r jsonb;n integer;begin
 if beauty_private.is_admin() or not beauty_private.can_issue_prices() then raise exception 'Fallo: permisos de atención';end if;
 r=public.beauty_panel_session();
 if r->>'role'<>'support' or not(r->>'pricesConfigured')::boolean then raise exception 'Fallo: panel de atención';end if;
 if exists(select 1 from jsonb_array_elements(r#>'{content,services}') s where s->'price'<>'null'::jsonb or s->>'pricePrefix'<>'') then raise exception 'Fallo: atención recibe tarifas privadas';end if;
 if exists(select 1 from public.beauty_prices) then raise exception 'Fallo: atención consulta precios directamente';end if;
 if exists(select 1 from storage.objects where bucket_id='beauty-images') then raise exception 'Fallo: atención lista archivos de Storage';end if;
 begin perform public.beauty_admin_read();raise exception 'Fallo: atención abre editor';exception when insufficient_privilege then null;end;
 begin perform public.beauty_save_content((select doc from beauty_role_test),1);raise exception 'Fallo: atención guarda contenido';exception when insufficient_privilege then null;end;
 begin perform public.beauty_manage_member('role-invite@example.invalid',true,'admin');raise exception 'Fallo: atención asigna roles';exception when insufficient_privilege then null;end;
 begin perform public.beauty_manage_admin('role-invite@example.invalid',true);raise exception 'Fallo: atención asigna administradores';exception when insufficient_privilege then null;end;
 begin perform public.beauty_list_admins();raise exception 'Fallo: atención ve directorio';exception when insufficient_privilege then null;end;
 begin perform * from beauty_private.price_codes;raise exception 'Fallo: atención lee códigos';exception when insufficient_privilege then null;end;
 begin insert into storage.objects(bucket_id,name) values('beauty-images','role-denied.jpg');raise exception 'Fallo: atención sube fotos';exception when insufficient_privilege then null;end;
 update public.beauty_content set revision=revision+1;get diagnostics n=row_count;
 if n<>0 then raise exception 'Fallo: atención edita directamente';end if;
 -- Supabase también puede rechazar DELETE mediante storage.protect_delete().
 -- Ambos resultados son seguros: permiso denegado o cero filas afectadas por RLS.
 begin
  delete from storage.objects where name='role-test-admin-photo.jpg';get diagnostics n=row_count;
  if n<>0 then raise exception 'Fallo: atención elimina fotografías';end if;
 exception when insufficient_privilege then null;
 end;
 begin perform public.beauty_issue_code('{"instagram":true,"tiktok":true,"facebook":true,"reservation":false}');raise exception 'Fallo: atención omite la reserva';exception when invalid_parameter_value then null;end;
 update beauty_role_test set own_code=public.beauty_issue_code('{"instagram":true,"tiktok":true,"facebook":true,"reservation":true}')->>'code';
 if not(public.beauty_read_prices((select own_code from beauty_role_test)) ? 'prices') then raise exception 'Fallo: enlace de atención no habilita';end if;
end $$;
reset role;

select set_config('request.jwt.claim.sub',other_id::text,true) from beauty_role_test;
set local role authenticated;
update beauty_role_test set other_code=public.beauty_issue_code('{"instagram":true,"tiktok":true,"facebook":true,"reservation":true}')->>'code';
reset role;
select set_config('request.jwt.claim.sub',support_id::text,true) from beauty_role_test;
set local role authenticated;
do $$begin
 begin perform public.beauty_revoke_code((select other_code from beauty_role_test));raise exception 'Fallo: atención retira enlace ajeno';exception when insufficient_privilege then null;end;
 perform public.beauty_revoke_code((select own_code from beauty_role_test));
 if not(public.beauty_read_prices((select own_code from beauty_role_test)) ? 'error') then raise exception 'Fallo: revocación propia';end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',admin_id::text,true) from beauty_role_test;
set local role authenticated;
select public.beauty_revoke_code(other_code) from beauty_role_test;
reset role;

select set_config('request.jwt.claim.sub',unconfirmed_id::text,true) from beauty_role_test;
set local role authenticated;
do $$begin
 if beauty_private.can_issue_prices() then raise exception 'Fallo: cuenta sin confirmar tiene permiso';end if;
 begin perform public.beauty_panel_session();raise exception 'Fallo: cuenta sin confirmar entra';exception when insufficient_privilege then null;end;
end $$;
reset role;

-- Revocar el rol afecta la siguiente petición sin renovar el JWT.
update beauty_private.admin_emails set active=false where email='role-test-support-'||(select support_id from beauty_role_test)||'@example.invalid';
select set_config('request.jwt.claim.sub',support_id::text,true) from beauty_role_test;
set local role authenticated;
do $$begin
 if beauty_private.can_issue_prices() then raise exception 'Fallo: acceso desactivado conserva permiso';end if;
 begin perform public.beauty_issue_code('{"instagram":true,"tiktok":true,"facebook":true,"reservation":true}');raise exception 'Fallo: cuenta desactivada genera';exception when insufficient_privilege then null;end;
end $$;
reset role;
update beauty_private.admin_emails set active=true where email='role-test-support-'||(select support_id from beauty_role_test)||'@example.invalid';
select set_config('request.jwt.claim.sub',support_id::text,true) from beauty_role_test;
set local role authenticated;
do $$declare i integer;begin
 for i in 1..59 loop perform public.beauty_issue_code('{"instagram":true,"tiktok":true,"facebook":true,"reservation":true}');end loop;
 begin perform public.beauty_issue_code('{"instagram":true,"tiktok":true,"facebook":true,"reservation":true}');raise exception 'Fallo: sin límite de emisión';exception when program_limit_exceeded then null;end;
end $$;
reset role;

do $$declare d jsonb;begin
 select doc into d from beauty_role_test;
 if not public.beauty_validate_content(d) then raise exception 'Fallo: documento anterior incompatible';end if;
 if public.beauty_validate_content(jsonb_set(d,'{brand,storyImage}','"javascript:alert(1)"')) then raise exception 'Fallo: foto de presentación peligrosa';end if;
 if public.beauty_validate_content(jsonb_set(d,'{brand,detailImage}','"assets/img/../private.jpg"')) then raise exception 'Fallo: ruta de imagen con traversal';end if;
 if public.beauty_validate_content(jsonb_set(d,'{promotions,0,image}','"https://evil.example/storage/v1/object/public/beauty-images/test.jpg"')) then raise exception 'Fallo: dominio de foto externo';end if;
 if public.beauty_validate_content(jsonb_set(d,'{promotions,0,tag}','{}')) then raise exception 'Fallo: etiqueta de promoción inválida';end if;
 if public.beauty_validate_content(jsonb_set(d,'{categories,0}','"   "')) then raise exception 'Fallo: categoría vacía';end if;
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'beauty_%' and p.prosecdef) then raise exception 'Fallo: función privilegiada en esquema expuesto';end if;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','beauty_private') and c.relkind='r' and (c.relname like 'beauty_%' or n.nspname='beauty_private') and not c.relrowsecurity) then raise exception 'Fallo: tabla sin RLS';end if;
end $$;
select 'Rol de atención, RLS, aislamiento, imágenes, revocación y límites verificados. Sin cambios persistentes.' as resultado;
rollback;
