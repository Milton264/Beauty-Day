import test from 'node:test';
import assert from 'node:assert/strict';
import {pbkdf2Sync} from 'node:crypto';
import worker,{valid} from '../worker/src/index.js';
import content from '../docs/content/site.json' with {type:'json'};

const origin='https://beauty.example';
const salt=Buffer.from('sal-de-prueba-para-editor');
const env={SITE_ORIGIN:origin,REPO_OWNER:'owner',REPO_NAME:'repo',BRANCH:'main',CONTENT_PATH:'docs/content/site.json',GITHUB_TOKEN:'test',ADMIN_PASSWORD_SALT:salt.toString('base64'),ADMIN_PASSWORD_HASH:pbkdf2Sync('clave-larga-de-prueba',salt,12000,32,'sha256').toString('base64'),ADMIN_SESSION_SECRET:'secreto-de-prueba-de-sesion',LOGIN_LIMITER:{limit:async()=>({success:true})}};
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
    const response=await worker.fetch(req('/api/content','PUT',JSON.stringify({content,sha:'abc123'}),{'Content-Type':'application/json',Authorization:'Bearer '+token}),env);
    assert.equal(response.status,200);
    assert.equal((await response.json()).sha,'nuevo-sha');
    assert.equal(calls.length,2);
    assert.equal(calls[1].options.method,'PUT');
    const body=JSON.parse(calls[1].options.body);
    assert.equal(body.sha,'abc123');
    assert.equal(body.branch,'main');
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
