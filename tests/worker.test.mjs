import test from 'node:test';
import assert from 'node:assert/strict';
import {pbkdf2Sync} from 'node:crypto';
import worker,{valid,codeKey} from '../worker/src/index.js';
import content from '../docs/content/site.json' with {type:'json'};

const origin='https://beauty.example';
const salt=Buffer.from('sal-de-prueba-para-editor');
const kv=new Map();
const store={get:async(key,type)=>{const value=kv.get(key);return value==null?null:type==='json'?JSON.parse(value):value;},put:async(key,value)=>kv.set(key,value),delete:async key=>kv.delete(key)};
const env={PRICE_STORE:store,PUBLIC_LIMITER:{limit:async()=>({success:true})},SITE_ORIGIN:origin,REPO_OWNER:'owner',REPO_NAME:'repo',BRANCH:'main',CONTENT_PATH:'docs/content/site.json',GITHUB_TOKEN:'test',ADMIN_PASSWORD_SALT:salt.toString('base64'),ADMIN_PASSWORD_HASH:pbkdf2Sync('clave-larga-de-prueba',salt,12000,32,'sha256').toString('base64'),ADMIN_SESSION_SECRET:'secreto-de-prueba-de-sesion',LOGIN_LIMITER:{limit:async()=>({success:true})}};
const req=(url,method='GET',body,headers={})=>new Request('https://worker.example'+url,{method,headers:{Origin:origin,...headers},body});

test('contenido inicial válido y rechazo de rutas peligrosas',()=>{
  assert.equal(valid(content),true);
  const bad=structuredClone(content);bad.brand.heroImage='javascript:alert(1)';assert.equal(valid(bad),false);
});
test('el origen ajeno y la sesión ausente no pueden editar',async()=>{
  const foreign=await worker.fetch(new Request('https://worker.example/api/content',{method:'GET',headers:{Origin:'https://evil.example'}}),env);
  assert.equal(foreign.status,403);
  const unauthed=await worker.fetch(req('/api/content'),env);
  assert.equal(unauthed.status,401);
});
test('login, lectura y protección frente a edición desactualizada',async()=>{
  const login=await worker.fetch(req('/api/login','POST',JSON.stringify({password:'clave-larga-de-prueba'}),{'Content-Type':'application/json'}),env);
  assert.equal(login.status,200);
  const {token}=await login.json();
  let calls=0;
  const previous=globalThis.fetch;
  globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify({content:Buffer.from(JSON.stringify(content)).toString('base64'),sha:'abc123'}),{status:200,headers:{'Content-Type':'application/json'}});};
  try{
    const read=await worker.fetch(req('/api/content','GET',undefined,{Authorization:'Bearer '+token}),env);
    assert.equal(read.status,200);
    assert.equal((await read.json()).content.brand.name,'Beauty Day');
    const conflict=await worker.fetch(req('/api/content','PUT',JSON.stringify({content,sha:'antiguo'}),{'Content-Type':'application/json',Authorization:'Bearer '+token}),env);
    assert.equal(conflict.status,409);
    assert.equal(calls,2);
  }finally{globalThis.fetch=previous;}
});
test('foto inválida no llega a GitHub',async()=>{
  const login=await worker.fetch(req('/api/login','POST',JSON.stringify({password:'clave-larga-de-prueba'}),{'Content-Type':'application/json'}),env);
  const {token}=await login.json();
  const result=await worker.fetch(req('/api/upload','POST',JSON.stringify({mime:'image/png',base64:'AQID'}),{'Content-Type':'application/json',Authorization:'Bearer '+token}),env);
  assert.equal(result.status,400);
});
test('guardado autorizado crea commit con SHA actual',async()=>{
  const login=await worker.fetch(req('/api/login','POST',JSON.stringify({password:'clave-larga-de-prueba'}),{'Content-Type':'application/json'}),env);
  const {token}=await login.json();
  const previous=globalThis.fetch;
  const calls=[];
  globalThis.fetch=async(url,options)=>{
    calls.push({url,options});
    if(options.method==='PUT')return new Response(JSON.stringify({content:{sha:'nuevo-sha'}}),{status:200});
    return new Response(JSON.stringify({sha:'abc123'}),{status:200});
  };
  try{
    const priced=structuredClone(content);priced.services[0].price=55555;priced.services[0].pricePrefix='Desde ';
    const response=await worker.fetch(req('/api/content','PUT',JSON.stringify({content:priced,sha:'abc123'}),{'Content-Type':'application/json',Authorization:'Bearer '+token}),env);
    assert.equal(response.status,200);
    assert.equal((await response.json()).sha,'nuevo-sha');
    assert.equal(calls.length,2);
    assert.equal(calls[1].options.method,'PUT');
    const body=JSON.parse(calls[1].options.body);
    assert.equal(body.sha,'abc123');
    assert.equal(body.branch,'main');
    const published=JSON.parse(Buffer.from(body.content,'base64').toString());
    assert.equal(published.services[0].price,null);
    assert.equal(published.services[0].pricePrefix,'');
    assert.equal(JSON.parse(kv.get('catalog')).prices[0].price,55555);
  }finally{globalThis.fetch=previous;}
});
test('foto válida se almacena con ruta nueva y sin exponer token al navegador',async()=>{
  const login=await worker.fetch(req('/api/login','POST',JSON.stringify({password:'clave-larga-de-prueba'}),{'Content-Type':'application/json'}),env);
  const {token}=await login.json();
  const previous=globalThis.fetch;
  let githubBody;
  globalThis.fetch=async(_url,options)=>{githubBody=JSON.parse(options.body);return new Response(JSON.stringify({content:{sha:'foto-sha'}}),{status:200});};
  try{
    const base64=Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]).toString('base64');
    const result=await worker.fetch(req('/api/upload','POST',JSON.stringify({mime:'image/png',base64}),{'Content-Type':'application/json',Authorization:'Bearer '+token}),env);
    assert.equal(result.status,200);
    assert.match((await result.json()).path,/^assets\/uploads\/foto-.*\.png$/);
    assert.equal(githubBody.content,base64);
    assert.equal(githubBody.branch,'main');
  }finally{globalThis.fetch=previous;}
});

test('solo una revisión administrativa completa entrega acceso; código permite consultar, nunca editar',async()=>{
 kv.clear();kv.set('catalog',JSON.stringify({prices:[{id:'s01',price:55555,pricePrefix:''}]}));
 const login=await worker.fetch(req('/api/login','POST',JSON.stringify({password:'clave-larga-de-prueba'})),env);
 const {token}=await login.json();const headers={Authorization:'Bearer '+token};
 const checks={instagram:true,tiktok:true,facebook:true,reservation:true};
 const noAuth=await worker.fetch(req('/api/access','POST',JSON.stringify({checks})),env);assert.equal(noAuth.status,401);
 const missing=await worker.fetch(req('/api/access','POST',JSON.stringify({checks:{...checks,reservation:false}}),headers),env);assert.equal(missing.status,400);
 const wrongTypes=await worker.fetch(req('/api/access','POST',JSON.stringify({checks:{...checks,instagram:'true'}}),headers),env);assert.equal(wrongTypes.status,400);
 const issued=await worker.fetch(req('/api/access','POST',JSON.stringify({checks}),headers),env);assert.equal(issued.status,201);
 const {code,expiresAt}=await issued.json();assert.equal(code.replaceAll('-','').length,32);assert.ok(expiresAt>Date.now());
 const access=await worker.fetch(req('/api/prices','POST',JSON.stringify({code})),env);assert.equal(access.status,200);assert.equal((await access.json()).prices[0].price,55555);assert.equal(access.headers.get('Cache-Control'),'no-store');
 const codeAsAdmin=await worker.fetch(req('/api/content','GET',undefined,{Authorization:'Bearer '+code}),env);assert.equal(codeAsAdmin.status,401);
 const invalid=await worker.fetch(req('/api/prices','POST',JSON.stringify({code:'0'.repeat(32)})),env);assert.equal(invalid.status,401);assert.doesNotMatch(await invalid.text(),/55555/);
 const revoked=await worker.fetch(req('/api/access/revoke','POST',JSON.stringify({code}),headers),env);assert.equal(revoked.status,200);
 const denied=await worker.fetch(req('/api/prices','POST',JSON.stringify({code})),env);assert.equal(denied.status,401);
 kv.set(await codeKey(code.replaceAll('-','')),JSON.stringify({approved:true,exp:Date.now()-1}));
 const expired=await worker.fetch(req('/api/prices','POST',JSON.stringify({code})),env);assert.equal(expired.status,401);
});
test('fallos de configuración, abuso y JSON inválido conservan los precios cerrados',async()=>{
 const unavailable=await worker.fetch(req('/api/prices','POST','{}'),{...env,PRICE_STORE:undefined});assert.equal(unavailable.status,503);
 const limited=await worker.fetch(req('/api/prices','POST','{}'),{...env,PUBLIC_LIMITER:{limit:async()=>({success:false})}});assert.equal(limited.status,429);
 const invalid=await worker.fetch(req('/api/prices','POST','invalid-json'),env);assert.equal(invalid.status,400);
 const large=await worker.fetch(req('/api/prices','POST','x'.repeat(2000)),env);assert.equal(large.status,413);
});
