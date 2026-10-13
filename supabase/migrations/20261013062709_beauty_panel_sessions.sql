-- Sesiones privadas: vigencia de Auth, 15 minutos de inactividad y máximo 8 horas.
-- No modifica el documento, las tarifas, los miembros ni los enlaces de clientas.
begin;
create table if not exists beauty_private.panel_sessions(
 session_id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 last_activity_at timestamptz not null default now(),
 expires_at timestamptz not null,
 revoked boolean not null default false
);
alter table beauty_private.panel_sessions enable row level security;
revoke all on beauty_private.panel_sessions from public,anon,authenticated;
create index if not exists beauty_panel_session_expiry on beauty_private.panel_sessions(expires_at);

create or replace function beauty_private.current_session_id() returns uuid
language sql stable security invoker set search_path='' as $$
 select case when (auth.jwt()->>'session_id') ~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
 then (auth.jwt()->>'session_id')::uuid else null end
$$;
create or replace function beauty_private.session_valid() returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(
  select 1 from beauty_private.panel_sessions p join auth.sessions a on a.id=p.session_id and a.user_id=p.user_id
  where p.session_id=beauty_private.current_session_id() and p.user_id=auth.uid() and not p.revoked
  and p.expires_at>now() and p.last_activity_at>now()-interval '15 minutes'
  and a.created_at>now()-interval '8 hours'
 )
$$;
create or replace function beauty_private.registered_member_role() returns text
language sql stable security definer set search_path='' as $$
 select a.role from auth.users u join beauty_private.admin_emails a on a.email=lower(u.email)
 where auth.uid() is not null and u.id=auth.uid() and u.email_confirmed_at is not null and a.active
$$;
create or replace function beauty_private.member_role() returns text
language sql stable security definer set search_path='' as $$
 select case when beauty_private.session_valid() then beauty_private.registered_member_role() else null end
$$;

create or replace function beauty_private.start_panel_session() returns jsonb
language plpgsql security definer set search_path='' as $$
declare sid uuid=beauty_private.current_session_id();v_role text;auth_created timestamptz;deadline timestamptz;
begin
 if auth.uid() is null or sid is null then raise exception 'Vuelve a iniciar sesión para abrir el panel.' using errcode='42501';end if;
 v_role=beauty_private.registered_member_role();
 if v_role is null then raise exception 'Tu cuenta no tiene acceso al equipo de Beauty Day.' using errcode='42501';end if;
 select a.created_at into auth_created from auth.sessions a where a.id=sid and a.user_id=auth.uid();
 if auth_created is null or auth_created<now()-interval '15 minutes' or auth_created>now()+interval '1 minute' then
  raise exception 'Vuelve a iniciar sesión para abrir el panel.' using errcode='42501';
 end if;
 deadline=auth_created+interval '8 hours';
 -- Nunca reabre ni renueva una sesión ya vencida o retirada con el mismo JWT.
 insert into beauty_private.panel_sessions(session_id,user_id,expires_at) values(sid,auth.uid(),deadline) on conflict(session_id) do nothing;
 if not beauty_private.session_valid() then raise exception 'La sesión terminó. Vuelve a ingresar.' using errcode='42501';end if;
 delete from beauty_private.panel_sessions where expires_at<now()-interval '1 day';
 return jsonb_build_object('role',v_role,'expiresAt',floor(extract(epoch from deadline)*1000));
end $$;
create or replace function beauty_private.touch_panel_session() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if beauty_private.member_role() is null then raise exception 'La sesión o los permisos ya no están vigentes.' using errcode='42501';end if;
 update beauty_private.panel_sessions set last_activity_at=now() where session_id=beauty_private.current_session_id() and user_id=auth.uid() and not revoked;
 return jsonb_build_object('active',true);
end $$;
create or replace function beauty_private.end_panel_session() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or beauty_private.current_session_id() is null then raise exception 'Sesión inválida.' using errcode='42501';end if;
 update beauty_private.panel_sessions set revoked=true where session_id=beauty_private.current_session_id() and user_id=auth.uid();
 return jsonb_build_object('closed',true);
end $$;

create or replace function public.beauty_start_panel_session() returns jsonb
language sql security invoker set search_path='' as $$select beauty_private.start_panel_session()$$;
create or replace function public.beauty_touch_panel_session() returns jsonb
language sql security invoker set search_path='' as $$select beauty_private.touch_panel_session()$$;
create or replace function public.beauty_end_panel_session() returns jsonb
language sql security invoker set search_path='' as $$select beauty_private.end_panel_session()$$;
revoke all on function beauty_private.current_session_id(),beauty_private.session_valid(),beauty_private.registered_member_role(),beauty_private.member_role(),beauty_private.start_panel_session(),beauty_private.touch_panel_session(),beauty_private.end_panel_session(),public.beauty_start_panel_session(),public.beauty_touch_panel_session(),public.beauty_end_panel_session() from public,anon,authenticated;
-- registered_member_role solo es usado internamente por funciones privadas.
grant execute on function beauty_private.current_session_id(),beauty_private.session_valid(),beauty_private.member_role(),beauty_private.start_panel_session(),beauty_private.touch_panel_session(),beauty_private.end_panel_session(),public.beauty_start_panel_session(),public.beauty_touch_panel_session(),public.beauty_end_panel_session() to authenticated;
notify pgrst,'reload schema';
commit;
