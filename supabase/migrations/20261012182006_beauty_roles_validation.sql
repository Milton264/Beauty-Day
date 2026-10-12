-- Actualización de Beauty Day existente. Conserva contenido, precios y accesos.
begin;
alter table beauty_private.admin_emails add column if not exists role text not null default 'admin';
do $$begin
 if not exists(select 1 from pg_constraint where conname='beauty_member_role' and conrelid='beauty_private.admin_emails'::regclass) then
  alter table beauty_private.admin_emails add constraint beauty_member_role check(role in ('admin','support'));
 end if;
end $$;

create or replace function beauty_private.member_role() returns text
language sql stable security definer set search_path='' as $$
 select a.role from auth.users u join beauty_private.admin_emails a on a.email=lower(u.email)
 where auth.uid() is not null and u.id=auth.uid() and u.email_confirmed_at is not null and a.active
$$;
create or replace function beauty_private.is_admin() returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and coalesce(beauty_private.member_role()='admin',false)
$$;
create or replace function beauty_private.can_issue_prices() returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and coalesce(beauty_private.member_role() in ('admin','support'),false)
$$;
revoke all on function beauty_private.member_role(),beauty_private.is_admin(),beauty_private.can_issue_prices() from public,anon,authenticated;
grant execute on function beauty_private.member_role(),beauty_private.is_admin(),beauty_private.can_issue_prices() to authenticated;

create or replace function beauty_private.panel_state() returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_role text; result jsonb; c public.beauty_content;
begin
 if auth.uid() is null then raise exception 'Inicia sesión para entrar al panel.' using errcode='42501';end if;
 v_role=beauty_private.member_role();
 if v_role is null then raise exception 'Tu cuenta no tiene acceso al equipo de Beauty Day.' using errcode='42501';end if;
 if v_role='admin' then return public.beauty_admin_read()||jsonb_build_object('role',v_role);end if;
 select * into c from public.beauty_content where id='site';
 if not found then raise exception 'Aún no se ha importado el contenido de Beauty Day.';end if;
 -- Atención solo recibe el documento público: nunca las tarifas privadas.
 return jsonb_build_object('role',v_role,'content',c.document,'revision',c.revision,'pricesConfigured',exists(select 1 from public.beauty_prices));
end $$;
create or replace function public.beauty_panel_session() returns jsonb
language sql security invoker set search_path='' as $$select beauty_private.panel_state()$$;
revoke all on function beauty_private.panel_state(),public.beauty_panel_session() from public,anon,authenticated;
grant execute on function beauty_private.panel_state(),public.beauty_panel_session() to authenticated;

create or replace function beauty_private.manage_member(p_email text,p_active boolean,p_role text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_email text=lower(btrim(p_email));v_own_email text;
begin
 if auth.uid() is null or not beauty_private.is_admin() then raise exception 'Solo administración puede gestionar el equipo.' using errcode='42501';end if;
 if v_email is null or v_email !~ '^[^ @]+@[^ @]+\.[^ @]+$' or length(v_email)>254 or p_active is null or p_role is null or p_role not in ('admin','support') then raise exception 'Revisa el correo y el rol de la persona.' using errcode='22023';end if;
 select lower(u.email) into v_own_email from auth.users u where u.id=auth.uid();
 if v_email=v_own_email and (not p_active or p_role<>'admin') then raise exception 'No puedes desactivar ni reducir tu propio acceso de administración.';end if;
 insert into beauty_private.admin_emails(email,active,role) values(v_email,p_active,p_role)
 on conflict(email) do update set active=excluded.active,role=excluded.role;
 return jsonb_build_object('saved',true);
end $$;
create or replace function public.beauty_manage_member(p_email text,p_active boolean,p_role text) returns jsonb
language sql security invoker set search_path='' as $$select beauty_private.manage_member(p_email,p_active,p_role)$$;
revoke all on function beauty_private.manage_member(text,boolean,text),public.beauty_manage_member(text,boolean,text) from public,anon,authenticated;
grant execute on function beauty_private.manage_member(text,boolean,text),public.beauty_manage_member(text,boolean,text) to authenticated;

-- Compatibilidad con el panel anterior: reactivar a alguien conserva su rol.
create or replace function beauty_private.manage_admin(p_email text,p_active boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_role text;
begin
 if auth.uid() is null or not beauty_private.is_admin() then raise exception 'Solo administración puede gestionar el equipo.' using errcode='42501';end if;
 select role into v_role from beauty_private.admin_emails where email=lower(btrim(p_email));
 return beauty_private.manage_member(p_email,p_active,coalesce(v_role,'admin'));
end $$;
create or replace function beauty_private.list_admins() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not beauty_private.is_admin() then raise exception 'Solo administración puede consultar el equipo.' using errcode='42501';end if;
 return(select coalesce(jsonb_agg(jsonb_build_object('email',email,'active',active,'role',role) order by email),'[]') from beauty_private.admin_emails);
end $$;
revoke all on function beauty_private.manage_admin(text,boolean),beauty_private.list_admins() from public,anon,authenticated;
grant execute on function beauty_private.manage_admin(text,boolean),beauty_private.list_admins() to authenticated;

create index if not exists beauty_code_creator_time on beauty_private.price_codes(created_by,created_at);
create or replace function beauty_private.issue_code(p_checks jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare code text;expires timestamptz=now()+interval '24 hours';
begin
 if auth.uid() is null or not beauty_private.can_issue_prices() then raise exception 'Tu cuenta no tiene permiso para habilitar precios.' using errcode='42501';end if;
 if p_checks is null or not(p_checks @> '{"instagram":true,"tiktok":true,"facebook":true,"reservation":true}'::jsonb) then raise exception 'Revisa los tres seguimientos y confirma la reserva antes de generar el enlace.' using errcode='22023';end if;
 if not exists(select 1 from public.beauty_prices) then raise exception 'Administración debe guardar las tarifas antes de habilitar precios.';end if;
 -- Serializa las emisiones de la misma persona: no permite saltar el límite por concurrencia.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('beauty-code:'||auth.uid()::text,0));
 if (select count(*) from beauty_private.price_codes where created_by=auth.uid() and created_at>now()-interval '1 hour')>=60 then raise exception 'Has preparado 60 enlaces en una hora. Espera antes de generar otro.' using errcode='54000';end if;
 delete from beauty_private.price_codes where expires_at<now()-interval '1 day';
 code=encode(extensions.gen_random_bytes(16),'hex');
 insert into beauty_private.price_codes(code_hash,expires_at,created_by) values(encode(extensions.digest(code,'sha256'),'hex'),expires,auth.uid());
 return jsonb_build_object('code',substring(code,1,8)||'-'||substring(code,9,8)||'-'||substring(code,17,8)||'-'||substring(code,25,8),'expiresAt',floor(extract(epoch from expires)*1000));
end $$;
create or replace function beauty_private.revoke_code(p_code text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare code text=regexp_replace(lower(btrim(p_code)),'[-\s]','','g');v_hash text;
begin
 if auth.uid() is null or not beauty_private.can_issue_prices() then raise exception 'Tu cuenta no tiene permiso para retirar accesos.' using errcode='42501';end if;
 if code is null or code !~ '^[a-f0-9]{32}$' then raise exception 'Código inválido.' using errcode='22023';end if;
 v_hash=encode(extensions.digest(code,'sha256'),'hex');
 if not beauty_private.is_admin() and exists(select 1 from beauty_private.price_codes where code_hash=v_hash and created_by is distinct from auth.uid()) then raise exception 'Solo puedes retirar los enlaces que tú generaste.' using errcode='42501';end if;
 update beauty_private.price_codes set revoked=true where code_hash=v_hash and (beauty_private.is_admin() or created_by=auth.uid());
 return jsonb_build_object('revoked',true);
end $$;
revoke all on function beauty_private.issue_code(jsonb),beauty_private.revoke_code(text) from public,anon,authenticated;
grant execute on function beauty_private.issue_code(jsonb),beauty_private.revoke_code(text) to authenticated;

create or replace function beauty_private.valid_image(p_path text) returns boolean
language sql immutable security invoker set search_path='' as $$
 select p_path is not null and length(p_path)<=1200 and position('..' in p_path)=0 and
 (p_path='' or p_path ~ '^assets/(img|uploads)/[a-zA-Z0-9._/-]+\.(png|jpe?g|webp)$' or
 p_path ~ '^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/beauty-images/[a-zA-Z0-9._/-]+\.(png|jpe?g|webp)$')
$$;
revoke all on function beauty_private.valid_image(text) from public,anon,authenticated;
grant execute on function beauty_private.valid_image(text) to anon,authenticated;

create or replace function public.beauty_validate_content(c jsonb) returns boolean
language plpgsql immutable security invoker set search_path = '' as $$
declare s jsonb;p jsonb;x jsonb;v text; arr text; cats jsonb;
begin
 if c is null or not(c ?& array['version','brand','contact','legal','categories','services','professionals','promotions','gifts','combos']) or jsonb_typeof(c)<>'object' or c->>'version'<>'1' or octet_length(c::text)>300000 then return false; end if;
 if not((c->'brand') ?& array['name','eyebrow','heroTitle','heroSubtitle','heroImage','heroImageIsReference']) or not((c->'contact') ?& array['whatsapp','phone','address','hours','email','mapsUrl','instagramUrl','tiktokUrl','facebookUrl']) or not((c->'legal') ?& array['responsibleName','privacyEmail']) or jsonb_typeof(c->'brand')<>'object' or jsonb_typeof(c->'contact')<>'object' or jsonb_typeof(c->'legal')<>'object' then return false;end if;
 foreach v in array array['name','eyebrow','heroTitle','heroSubtitle'] loop
  if jsonb_typeof(c->'brand'->v)<>'string' or length(c->'brand'->>v)>300 then return false;end if;
 end loop;
 if jsonb_typeof(c->'brand'->'heroImage')<>'string' or jsonb_typeof(c->'brand'->'heroImageIsReference')<>'boolean' then return false;end if;
 if jsonb_typeof(c->'contact'->'whatsapp')<>'string' or (c->'contact'->>'whatsapp') !~ '^\d{10,15}$' then return false;end if;
 foreach v in array array['phone','address','hours','email','mapsUrl','instagramUrl','tiktokUrl','facebookUrl'] loop
  if jsonb_typeof(c->'contact'->v)<>'string' or length(c->'contact'->>v)>500 then return false;end if;
  if v like '%Url' and (c->'contact'->>v)<>'' and (c->'contact'->>v) !~ '^https://' then return false;end if;
 end loop;
 foreach v in array array['responsibleName','privacyEmail'] loop
  if jsonb_typeof(c->'legal'->v)<>'string' or length(c->'legal'->>v)>300 then return false;end if;
 end loop;
 cats=c->'categories';
 if jsonb_typeof(cats)<>'array' or jsonb_array_length(cats)<1 or jsonb_array_length(cats)>12 then return false;end if;
 for x in select value from jsonb_array_elements(cats) loop
  if jsonb_typeof(x)<>'string' or length(x#>>'{}') not between 1 and 60 then return false;end if;
 end loop;
 if (select count(distinct value) from jsonb_array_elements(cats))<>jsonb_array_length(cats) then return false;end if;
 foreach arr in array array['services','professionals','promotions','gifts','combos'] loop
  if jsonb_typeof(c->arr)<>'array' or jsonb_array_length(c->arr)>(case when arr='services' then 100 else 30 end) then return false;end if;
  if (select count(distinct value->>'id') from jsonb_array_elements(c->arr))<>jsonb_array_length(c->arr) then return false;end if;
  for x in select value from jsonb_array_elements(c->arr) loop
   if jsonb_typeof(x)<>'object' or (x->>'id') !~ '^[a-zA-Z0-9_-]{1,40}$' then return false;end if;
   if length(coalesce(x->>'description',x->>'bio',''))>1200 then return false;end if;
   if x ? 'image' and (jsonb_typeof(x->'image')<>'string' or not (x->>'image'='' or ((x->>'image') ~ '^assets/(img|uploads)/[a-zA-Z0-9._/-]+\.(png|jpe?g|webp)$' and position('..' in x->>'image')=0) or ((x->>'image') ~ '^https://[^ ]+/storage/v1/object/public/beauty-images/[a-zA-Z0-9._/-]+\.(png|jpe?g|webp)$'))) then return false;end if;
  end loop;
 end loop;
 for s in select value from jsonb_array_elements(c->'services') loop
  if not(s ?& array['id','name','category','description','featured','pricePrefix','price','duration','image']) then return false;end if;
  if jsonb_typeof(s->'name')<>'string' or length(s->>'name') not between 1 and 120 or jsonb_typeof(s->'category')<>'string' or not (cats ? (s->>'category')) then return false;end if;
  if jsonb_typeof(s->'description')<>'string' or jsonb_typeof(s->'featured')<>'boolean' or jsonb_typeof(s->'pricePrefix')<>'string' or length(s->>'pricePrefix')>40 or not(s ? 'price') then return false;end if;
  if s->'price'<>'null'::jsonb and (jsonb_typeof(s->'price')<>'number' or (s->>'price') !~ '^\d+$' or (s->>'price')::numeric>=100000000) then return false;end if;
  if s->'duration'<>'null'::jsonb and (jsonb_typeof(s->'duration')<>'number' or (s->>'duration') !~ '^\d+$' or (s->>'duration')::numeric not between 1 and 1440) then return false;end if;
 end loop;
 for p in select value from jsonb_array_elements(c->'professionals') loop
  if not(p ?& array['id','name','role','bio','categories','image','schedule']) then return false;end if;
  if jsonb_typeof(p->'name')<>'string' or length(p->>'name') not between 1 and 100 or jsonb_typeof(p->'categories')<>'array' then return false;end if;
  foreach v in array array['role','bio','schedule'] loop
   if jsonb_typeof(p->v)<>'string' or length(p->>v)>1200 then return false;end if;
  end loop;
  if not cats @> (p->'categories') then return false;end if;
 end loop;
 for p in select value from jsonb_array_elements(c->'promotions') loop
  if not(p ?& array['id','title','tag','description','terms','active','image']) then return false;end if;
  if jsonb_typeof(p->'active')<>'boolean' or jsonb_typeof(p->'title')<>'string' or length(p->>'title') not between 1 and 160 or length(p->>'terms')>1200 then return false;end if;
 end loop;
 foreach arr in array array['gifts','combos'] loop
  for p in select value from jsonb_array_elements(c->arr) loop
   if not(p ?& array['id','title','description']) or jsonb_typeof(p->'title')<>'string' or length(p->>'title') not between 1 and 160 or jsonb_typeof(p->'description')<>'string' then return false;end if;
  end loop;
 end loop;

 foreach v in array array['heroImage','detailImage','storyImage'] loop
  if (c->'brand') ? v and (jsonb_typeof(c->'brand'->v)<>'string' or not beauty_private.valid_image(c->'brand'->>v)) then return false;end if;
 end loop;
 if exists(select 1 from jsonb_array_elements(cats) e where btrim(e.value#>>'{}')='' or e.value#>>'{}'<>btrim(e.value#>>'{}')) or (select count(distinct lower(value#>>'{}')) from jsonb_array_elements(cats))<>jsonb_array_length(cats) then return false;end if;
 foreach arr in array array['services','professionals','promotions','gifts','combos'] loop
  for x in select value from jsonb_array_elements(c->arr) loop
   if x ? 'image' and (jsonb_typeof(x->'image')<>'string' or not beauty_private.valid_image(x->>'image')) then return false;end if;
   if x ? 'description' and jsonb_typeof(x->'description')<>'string' then return false;end if;
   if arr='promotions' then
    foreach v in array array['tag','terms'] loop
     if jsonb_typeof(x->v)<>'string' or length(x->>v)>(case when v='tag' then 120 else 1200 end) then return false;end if;
    end loop;
   end if;
  end loop;
 end loop;
 return true;
exception when others then return false;
end $$;

notify pgrst,'reload schema';
commit;
