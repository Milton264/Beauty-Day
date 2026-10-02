import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';

const sql=name=>readFileSync(new URL('../database/'+name,import.meta.url),'utf8');

test('Postgres: acceso público, RLS, administradores, revisión y códigos',async()=>{
 const db=new PGlite({extensions:{pgcrypto}});
 try{
  // Reproduce el contrato de Auth y Storage necesario para probar nuestro SQL.
  // Los flujos de correo y sesiones de Supabase requieren además validación real.
  await db.exec(`
   create role anon;create role authenticated;
   create schema auth;create schema storage;create schema extensions;
   create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth to anon,authenticated;
   grant execute on function auth.uid() to anon,authenticated;
   create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
   create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
   alter table storage.objects enable row level security;
   grant usage on schema storage to anon,authenticated;
   grant select,insert,update,delete on storage.objects to anon,authenticated;
  `);
  await db.exec(sql('01_schema.sql'));
  await db.exec(sql('02_public_seed.sql'));
  const results=await db.exec(sql('03_verify.sql'));
  assert.ok(results.some(r=>r.rows?.some(row=>row.resultado?.includes('verificados'))));
  const state=await db.query(`select (select count(*) from auth.users) as users,(select count(*) from beauty_private.price_codes) as codes,(select revision from public.beauty_content) as revision`);
  assert.deepEqual(state.rows,[{users:0,codes:0,revision:1}]);
  // NULLs y referencias inexistentes no deben pasar la validación del catálogo.
  const invalid=await db.query(`select public.beauty_validate_content(document-'legal') as missing,public.beauty_validate_content(jsonb_set(document,'{services,0,category}','null')) as null_category,public.beauty_validate_content(jsonb_set(document,'{services,0,price}','-1')) as negative from public.beauty_content`);
  assert.deepEqual(invalid.rows,[{missing:false,null_category:false,negative:false}]);
 }finally{await db.close();}
});
