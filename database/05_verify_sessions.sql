-- Ejecutar como propietario después de beauty_panel_sessions. Todo termina en ROLLBACK.
begin;
create temporary table beauty_session_test(admin_id uuid,support_id uuid,admin_sid uuid,support_sid uuid);
insert into beauty_session_test values(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid());
grant select on beauty_session_test to anon,authenticated;
insert into auth.users(id,email,email_confirmed_at)
 select admin_id,'session-admin-'||admin_id||'@example.invalid',now() from beauty_session_test union all
 select support_id,'session-support-'||support_id||'@example.invalid',now() from beauty_session_test;
insert into beauty_private.admin_emails(email,role)
 select 'session-admin-'||admin_id||'@example.invalid','admin' from beauty_session_test union all
 select 'session-support-'||support_id||'@example.invalid','support' from beauty_session_test;
insert into auth.sessions(id,user_id,created_at,updated_at)
 select admin_sid,admin_id,now(),now() from beauty_session_test union all
 select support_sid,support_id,now(),now() from beauty_session_test;

set local role anon;
do $$begin
 begin perform public.beauty_start_panel_session();raise exception 'Fallo: anónimo abre sesión';exception when insufficient_privilege then null;end;
 begin perform public.beauty_touch_panel_session();raise exception 'Fallo: anónimo renueva sesión';exception when insufficient_privilege then null;end;
 begin perform public.beauty_end_panel_session();raise exception 'Fallo: anónimo retira sesión';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',admin_id::text,true),set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'session_id',admin_sid)::text,true) from beauty_session_test;
set local role authenticated;
do $$begin
 if beauty_private.is_admin() then raise exception 'Fallo: JWT sin sesión del panel concede acceso';end if;
 if public.beauty_start_panel_session()->>'role'<>'admin' then raise exception 'Fallo: no abre sesión de administración';end if;
 if not beauty_private.is_admin() then raise exception 'Fallo: sesión nueva no autoriza';end if;
 perform public.beauty_admin_read();perform public.beauty_touch_panel_session();
 begin perform * from beauty_private.panel_sessions;raise exception 'Fallo: tabla privada de sesiones expuesta';exception when insufficient_privilege then null;end;
 begin perform beauty_private.registered_member_role();raise exception 'Fallo: función de autorización sin sesión expuesta';exception when insufficient_privilege then null;end;
end $$;
reset role;
update beauty_private.panel_sessions set last_activity_at=now()-interval '16 minutes' where session_id=(select admin_sid from beauty_session_test);
set local role authenticated;
do $$begin
 if beauty_private.is_admin() or exists(select 1 from public.beauty_prices) then raise exception 'Fallo: inactividad deja consultar tarifas';end if;
 begin perform public.beauty_admin_read();raise exception 'Fallo: sesión inactiva abre editor';exception when insufficient_privilege then null;end;
 begin perform public.beauty_touch_panel_session();raise exception 'Fallo: revive sesión inactiva';exception when insufficient_privilege then null;end;
 begin perform public.beauty_start_panel_session();raise exception 'Fallo: mismo token reinicia sesión inactiva';exception when insufficient_privilege then null;end;
 begin insert into storage.objects(bucket_id,name) values('beauty-images','session-expired.jpg');raise exception 'Fallo: sesión inactiva sube fotos';exception when insufficient_privilege then null;end;
end $$;
reset role;
update beauty_private.panel_sessions set last_activity_at=now(),expires_at=now()-interval '1 minute' where session_id=(select admin_sid from beauty_session_test);
-- Un JWT renovado conserva su session_id: no debe reiniciar la duración máxima.
select set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'session_id',admin_sid,'iat',extract(epoch from now()))::text,true) from beauty_session_test;
set local role authenticated;
do $$begin
 if beauty_private.is_admin() then raise exception 'Fallo: token renovado extiende una sesión vencida';end if;
 begin perform public.beauty_touch_panel_session();raise exception 'Fallo: supera duración máxima';exception when insufficient_privilege then null;end;
end $$;
reset role;
update beauty_private.panel_sessions set last_activity_at=now(),expires_at=now()+interval '8 hours' where session_id=(select admin_sid from beauty_session_test);
set local role authenticated;
do $$begin
 perform public.beauty_end_panel_session();
 if beauty_private.is_admin() or exists(select 1 from public.beauty_prices) then raise exception 'Fallo: token retirado mantiene privilegios';end if;
 begin perform public.beauty_start_panel_session();raise exception 'Fallo: reabre sesión retirada';exception when insufficient_privilege then null;end;
 begin perform public.beauty_issue_code('{"instagram":true,"tiktok":true,"facebook":true,"reservation":true}');raise exception 'Fallo: sesión retirada habilita precios';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',support_id::text,true),set_config('request.jwt.claims',jsonb_build_object('sub',support_id,'session_id',admin_sid,'user_metadata',jsonb_build_object('role','admin'))::text,true) from beauty_session_test;
set local role authenticated;
do $$begin
 if beauty_private.session_valid() then raise exception 'Fallo: usa la sesión de otra persona';end if;
 begin perform public.beauty_start_panel_session();raise exception 'Fallo: vincula sesión ajena';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',support_id,'session_id',support_sid,'email','admin@example.invalid','user_metadata',jsonb_build_object('role','admin'))::text,true) from beauty_session_test;
set local role authenticated;
do $$begin
 if public.beauty_start_panel_session()->>'role'<>'support' or beauty_private.is_admin() then raise exception 'Fallo: metadatos o correo del JWT elevan rol';end if;
 begin perform public.beauty_admin_read();raise exception 'Fallo: atención abre editor';exception when insufficient_privilege then null;end;
end $$;
reset role;
-- Revocación real de Auth: el access token puede seguir firmado y vigente.
delete from auth.sessions where id=(select support_sid from beauty_session_test);
set local role authenticated;
do $$begin
 if beauty_private.session_valid() or beauty_private.can_issue_prices() then raise exception 'Fallo: token de Auth cerrado mantiene permisos';end if;
 begin perform public.beauty_start_panel_session();raise exception 'Fallo: sesión de Auth inexistente se reabre';exception when insufficient_privilege then null;end;
end $$;
reset role;
insert into auth.sessions(id,user_id,created_at,updated_at) select support_sid,support_id,now()-interval '9 hours',now() from beauty_session_test;
update beauty_private.panel_sessions set last_activity_at=now(),expires_at=now()+interval '8 hours' where session_id=(select support_sid from beauty_session_test);
set local role authenticated;
do $$begin
 if beauty_private.session_valid() then raise exception 'Fallo: sesión de Auth antigua elude las ocho horas';end if;
 begin perform public.beauty_start_panel_session();raise exception 'Fallo: token antiguo inicia sesión nueva sin autenticarse';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'Sesiones, inactividad, revocación, tokens renovados y aislamiento verificados. Los datos de prueba se revierten.' as resultado;
rollback;
