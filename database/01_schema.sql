-- Beauty Day: Data API + Auth + Storage, sin Worker ni servidor propio.
begin;
create schema if not exists beauty_private;
revoke all on schema beauty_private from public;
grant usage on schema beauty_private to anon, authenticated;
create extension if not exists pgcrypto with schema extensions;

create table beauty_private.admin_emails (
 email text primary key check(email=lower(btrim(email)) and length(email) between 5 and 254 and position('@' in email)>1),
 active boolean not null default true,
 created_at timestamptz not null default now()
);
alter table beauty_private.admin_emails enable row level security;
revoke all on beauty_private.admin_emails from public,anon,authenticated;

-- Comprueba identidad confirmada en Auth y autorización actual en la BD.
-- No confía en metadatos editables, en un flag del navegador ni en JWT antiguos.
create function beauty_private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
 select auth.uid() is not null and exists (
  select 1 from auth.users u join beauty_private.admin_emails a on a.email=lower(u.email)
  where u.id=auth.uid() and u.email_confirmed_at is not null and a.active
 )
$$;
revoke all on function beauty_private.is_admin() from public,anon;
grant execute on function beauty_private.is_admin() to authenticated;

create function public.beauty_validate_content(c jsonb) returns boolean
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
 return true;
exception when others then return false;
end $$;
revoke all on function public.beauty_validate_content(jsonb) from public;
grant execute on function public.beauty_validate_content(jsonb) to anon,authenticated;

create function public.beauty_public_document(c jsonb) returns jsonb
language sql immutable security invoker set search_path='' as $$
 select jsonb_set(c,'{services}',coalesce((select jsonb_agg(s||jsonb_build_object('price',null,'pricePrefix','') order by n) from jsonb_array_elements(c->'services') with ordinality as e(s,n)),'[]'::jsonb))
$$;
revoke all on function public.beauty_public_document(jsonb) from public;
grant execute on function public.beauty_public_document(jsonb) to anon,authenticated;

create table public.beauty_content (
 id text primary key check(id='site'), document jsonb not null,
 revision bigint not null default 1 check(revision>0), updated_at timestamptz not null default now(),
 constraint beauty_valid_document check(public.beauty_validate_content(document)),
 constraint beauty_no_public_prices check(document=public.beauty_public_document(document))
);
create table public.beauty_prices (
 service_id text primary key check(service_id ~ '^[a-zA-Z0-9_-]{1,40}$'),
 price integer check(price>=0 and price<100000000),
 price_prefix text not null default '' check(length(price_prefix)<=40)
);
alter table public.beauty_content enable row level security;
alter table public.beauty_prices enable row level security;
revoke all on public.beauty_content,public.beauty_prices from public,anon,authenticated;
grant select on public.beauty_content to anon,authenticated;
grant insert,update,delete on public.beauty_content to authenticated;
grant select,insert,update,delete on public.beauty_prices to authenticated;
create policy beauty_content_read on public.beauty_content for select to anon,authenticated using(true);
create policy beauty_content_admin_insert on public.beauty_content for insert to authenticated with check((select beauty_private.is_admin()));
create policy beauty_content_admin_update on public.beauty_content for update to authenticated using((select beauty_private.is_admin())) with check((select beauty_private.is_admin()));
create policy beauty_content_admin_delete on public.beauty_content for delete to authenticated using((select beauty_private.is_admin()));
create policy beauty_prices_admin on public.beauty_prices for all to authenticated using((select beauty_private.is_admin())) with check((select beauty_private.is_admin()));

create table beauty_private.price_codes (
 code_hash text primary key check(length(code_hash)=64),
 expires_at timestamptz not null, revoked boolean not null default false,
 created_at timestamptz not null default now(),created_by uuid references auth.users(id) on delete set null
);
create index beauty_code_expiry on beauty_private.price_codes(expires_at);
alter table beauty_private.price_codes enable row level security;
revoke all on beauty_private.price_codes from public,anon,authenticated;
create table beauty_private.code_attempts (
 ip_hash text not null, window_at timestamptz not null, attempts integer not null,
 primary key(ip_hash,window_at)
);
alter table beauty_private.code_attempts enable row level security;
revoke all on beauty_private.code_attempts from public,anon,authenticated;

create function public.beauty_admin_read() returns jsonb
language plpgsql security invoker set search_path='' as $$
declare c public.beauty_content;result jsonb;
begin
 if not beauty_private.is_admin() then raise exception 'La cuenta no tiene permiso de administración.' using errcode='42501';end if;
 select * into c from public.beauty_content where id='site';
 if not found then raise exception 'Aún no se ha importado el contenido de Beauty Day.';end if;
 select coalesce(jsonb_agg(s||jsonb_build_object('price',p.price,'pricePrefix',coalesce(p.price_prefix,'')) order by n),'[]'::jsonb) into result
 from jsonb_array_elements(c.document->'services') with ordinality as e(s,n) left join public.beauty_prices p on p.service_id=s->>'id';
 return jsonb_build_object('content',jsonb_set(c.document,'{services}',result),'revision',c.revision,'pricesConfigured',exists(select 1 from public.beauty_prices));
end $$;
create function public.beauty_save_content(p_content jsonb,p_revision bigint) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare current_revision bigint;next_revision bigint;
begin
 if not beauty_private.is_admin() then raise exception 'La cuenta no tiene permiso de administración.' using errcode='42501';end if;
 if not public.beauty_validate_content(p_content) then raise exception 'Contenido inválido. Revisa los campos del panel.' using errcode='22023';end if;
 select revision into current_revision from public.beauty_content where id='site' for update;
 if current_revision is distinct from p_revision then raise exception 'Otro administrador guardó un cambio. Recarga antes de guardar.' using errcode='40001';end if;
 next_revision=current_revision+1;
 update public.beauty_content set document=public.beauty_public_document(p_content),revision=next_revision,updated_at=now() where id='site';
 delete from public.beauty_prices where service_id not in(select value->>'id' from jsonb_array_elements(p_content->'services'));
 insert into public.beauty_prices(service_id,price,price_prefix)
 select s->>'id',(s->>'price')::integer,s->>'pricePrefix' from jsonb_array_elements(p_content->'services') s
 on conflict(service_id) do update set price=excluded.price,price_prefix=excluded.price_prefix;
 return jsonb_build_object('revision',next_revision,'pricesConfigured',true);
end $$;
revoke all on function public.beauty_admin_read(),public.beauty_save_content(jsonb,bigint) from public,anon;
grant execute on function public.beauty_admin_read(),public.beauty_save_content(jsonb,bigint) to authenticated;

-- Funciones privilegiadas estrictamente delimitadas en esquema no expuesto.
-- Alta/revocación: identidad administrativa verificada. Lectura: código aleatorio
-- de 128 bits vigente. Esta autorización permite al visitante leer sin cuenta.
create function beauty_private.issue_code(p_checks jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare code text;expires timestamptz=now()+interval '24 hours';
begin
 if not beauty_private.is_admin() then raise exception 'La cuenta no tiene permiso de administración.' using errcode='42501';end if;
 if p_checks is null or not(p_checks @> '{"instagram":true,"tiktok":true,"facebook":true,"reservation":true}'::jsonb) then raise exception 'Revisa los tres seguimientos y confirma la reserva antes de generar el código.' using errcode='22023';end if;
 if not exists(select 1 from public.beauty_prices) then raise exception 'Guarda las tarifas antes de generar un código.';end if;
 delete from beauty_private.price_codes where expires_at<now()-interval '1 day';
 code=encode(extensions.gen_random_bytes(16),'hex');
 insert into beauty_private.price_codes(code_hash,expires_at,created_by) values(encode(extensions.digest(code,'sha256'),'hex'),expires,auth.uid());
 return jsonb_build_object('code',substring(code,1,8)||'-'||substring(code,9,8)||'-'||substring(code,17,8)||'-'||substring(code,25,8),'expiresAt',floor(extract(epoch from expires)*1000));
end $$;
create function beauty_private.revoke_code(p_code text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare code text=regexp_replace(lower(btrim(p_code)),'[-\s]','','g');
begin
 if not beauty_private.is_admin() then raise exception 'La cuenta no tiene permiso de administración.' using errcode='42501';end if;
 if code is null or code !~ '^[a-f0-9]{32}$' then raise exception 'Código inválido.' using errcode='22023';end if;
 update beauty_private.price_codes set revoked=true where code_hash=encode(extensions.digest(code,'sha256'),'hex');
 return jsonb_build_object('revoked',true);
end $$;
create function beauty_private.read_prices(p_code text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare code text=regexp_replace(lower(btrim(p_code)),'[-\s]','','g');expires timestamptz;prices jsonb;attempts integer;headers jsonb;iphash text;
begin
 headers=coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb;
 iphash=encode(extensions.digest(split_part(coalesce(headers->>'x-forwarded-for','unknown'),',',1),'sha256'),'hex');
 delete from beauty_private.code_attempts where window_at<now()-interval '1 hour';
 insert into beauty_private.code_attempts(ip_hash,window_at,attempts) values(iphash,date_trunc('minute',now()),1)
 on conflict(ip_hash,window_at) do update set attempts=beauty_private.code_attempts.attempts+1 returning code_attempts.attempts into attempts;
 -- Devuelve error como JSON para que el contador no se revierta en un rollback.
 if attempts>20 then return jsonb_build_object('error','Demasiados intentos. Espera un minuto.');end if;
 if code is null or length(code)>80 or code !~ '^[a-f0-9]{32}$' then return jsonb_build_object('error','El código es inválido o venció.');end if;
 select expires_at into expires from beauty_private.price_codes where code_hash=encode(extensions.digest(code,'sha256'),'hex') and not revoked and expires_at>now();
 if not found then return jsonb_build_object('error','El código es inválido o venció.');end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',service_id,'price',price,'pricePrefix',price_prefix) order by service_id),'[]') into prices from public.beauty_prices;
 return jsonb_build_object('prices',prices,'expiresAt',floor(extract(epoch from expires)*1000));
end $$;
revoke all on function beauty_private.issue_code(jsonb),beauty_private.revoke_code(text),beauty_private.read_prices(text) from public,anon,authenticated;
grant execute on function beauty_private.issue_code(jsonb),beauty_private.revoke_code(text) to authenticated;
grant execute on function beauty_private.read_prices(text) to anon,authenticated;
create function public.beauty_issue_code(p_checks jsonb) returns jsonb language sql security invoker set search_path='' as $$select beauty_private.issue_code(p_checks)$$;
create function public.beauty_revoke_code(p_code text) returns jsonb language sql security invoker set search_path='' as $$select beauty_private.revoke_code(p_code)$$;
create function public.beauty_read_prices(p_code text) returns jsonb language sql security invoker set search_path='' as $$select beauty_private.read_prices(p_code)$$;
revoke all on function public.beauty_issue_code(jsonb),public.beauty_revoke_code(text),public.beauty_read_prices(text) from public,anon,authenticated;
grant execute on function public.beauty_issue_code(jsonb),public.beauty_revoke_code(text) to authenticated;
grant execute on function public.beauty_read_prices(text) to anon,authenticated;

create function beauty_private.manage_admin(p_email text,p_active boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_email text=lower(btrim(p_email));v_own_email text;
begin
 if not beauty_private.is_admin() then raise exception 'La cuenta no tiene permiso de administración.' using errcode='42501';end if;
 if v_email is null or v_email !~ '^[^ @]+@[^ @]+\.[^ @]+$' or length(v_email)>254 then raise exception 'Correo inválido.' using errcode='22023';end if;
 select lower(u.email) into v_own_email from auth.users u where u.id=auth.uid();
 if p_active is not true and v_email=v_own_email then raise exception 'No puedes retirar tu propio acceso desde esta sesión.';end if;
 insert into beauty_private.admin_emails(email,active) values(v_email,p_active) on conflict(email) do update set active=excluded.active;
 return jsonb_build_object('saved',true);
end $$;
create function beauty_private.list_admins() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if not beauty_private.is_admin() then raise exception 'La cuenta no tiene permiso de administración.' using errcode='42501';end if;
 return(select coalesce(jsonb_agg(jsonb_build_object('email',email,'active',active) order by email),'[]') from beauty_private.admin_emails);
end $$;
revoke all on function beauty_private.manage_admin(text,boolean),beauty_private.list_admins() from public,anon;
grant execute on function beauty_private.manage_admin(text,boolean),beauty_private.list_admins() to authenticated;
create function public.beauty_manage_admin(p_email text,p_active boolean) returns jsonb language sql security invoker set search_path='' as $$select beauty_private.manage_admin(p_email,p_active)$$;
create function public.beauty_list_admins() returns jsonb language sql security invoker set search_path='' as $$select beauty_private.list_admins()$$;
revoke all on function public.beauty_manage_admin(text,boolean),public.beauty_list_admins() from public,anon;
grant execute on function public.beauty_manage_admin(text,boolean),public.beauty_list_admins() to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('beauty-images','beauty-images',true,500000,array['image/jpeg','image/png','image/webp']);
create policy beauty_images_read on storage.objects for select to anon,authenticated using(bucket_id='beauty-images');
create policy beauty_images_insert on storage.objects for insert to authenticated with check(bucket_id='beauty-images' and (select beauty_private.is_admin()));
create policy beauty_images_update on storage.objects for update to authenticated using(bucket_id='beauty-images' and (select beauty_private.is_admin())) with check(bucket_id='beauty-images' and (select beauty_private.is_admin()));
create policy beauty_images_delete on storage.objects for delete to authenticated using(bucket_id='beauty-images' and (select beauty_private.is_admin()));
notify pgrst,'reload schema';
commit;
