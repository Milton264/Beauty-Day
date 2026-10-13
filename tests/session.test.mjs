import test from 'node:test';
import assert from 'node:assert/strict';
import {createAuthStorage,createPanelSession,PANEL_IDLE_MS,PANEL_MAX_MS} from '../src/panel-session.js';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const mapStorage=map=>({getItem:key=>map.get(key)||null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)});
function sessionFixture(){
 let time=1000000,interval,authCallback;const events={},calls=[],notifications=[],requests=[];
 const storage=createAuthStorage(),client={rpc:async name=>{calls.push(name);return {data:name==='beauty_start_panel_session'?{role:'admin',expiresAt:time+PANEL_MAX_MS}:{active:true}};},auth:{onAuthStateChange:fn=>authCallback=fn,signOut:async()=>({}),startAutoRefresh(){},stopAutoRefresh(){}}};
 const api=createPanelSession(client,{storage,settings:{url:'https://project.supabase.co',publishableKey:'sb_publishable_test'},window:{addEventListener:(name,fn)=>events[name]=fn},document:{visibilityState:'visible'},now:()=>time,setInterval:fn=>{interval=fn;return 1;},clearInterval(){},fetch:async(...args)=>{requests.push(args);return {};}});
 api.onEnd(reason=>notifications.push(reason));
 return {api,storage,events,calls,notifications,requests,client,advance(ms){time+=ms;},watch:()=>interval(),auth(event,session){authCallback(event,session);}};
}
test('los tokens no se conservan al recrear el cliente ni se escriben en almacenamiento persistente',()=>{
 const persistent=new Map([['beauty_day_admin_session','legacy-token']]),tab=new Map([['beauty_day_admin_session','legacy-token']]);
 const options={localStorage:mapStorage(persistent),sessionStorage:mapStorage(tab)};
 const first=createAuthStorage(options);assert.equal(persistent.size,0);assert.equal(tab.size,0);
 first.setItem('beauty_day_admin_session','test-only-token');assert.equal(first.getItem('beauty_day_admin_session'),'test-only-token');
 assert.equal(persistent.size,0);assert.equal(tab.size,0);
 assert.equal(createAuthStorage(options).getItem('beauty_day_admin_session'),null);
});
test('el verificador PKCE cruza pestañas, vence y se retira sin conservar una sesión',()=>{
 let time=0;const persistent=new Map(),options={localStorage:mapStorage(persistent),now:()=>time};
 const first=createAuthStorage(options),second=createAuthStorage(options),key='beauty_day_admin_session-code-verifier';
 first.setItem(key,'test-only-verifier');assert.equal(second.getItem(key),'test-only-verifier');
 assert.equal(second.getItem('beauty_day_admin_session'),null);
 time=PANEL_IDLE_MS;assert.equal(second.getItem(key),null);assert.equal(persistent.size,0);
 first.setItem(key,'another-test-verifier');first.removeItem(key);assert.equal(second.getItem(key),null);
});
test('la inactividad bloquea una operación antes de enviarla y retira la sesión remota',async()=>{
 const f=sessionFixture();await f.api.start();f.advance(PANEL_IDLE_MS);f.watch();await tick();
 assert.equal(f.api.isActive(),false);assert.ok(f.calls.includes('beauty_end_panel_session'));assert.equal(f.notifications.length,1);
 let sent=false;await assert.rejects(f.api.run(async()=>{sent=true;return {data:{}};}),{code:'BEAUTY_SESSION_EXPIRED'});assert.equal(sent,false);
});
test('renovar el token o simular eventos no prolonga el tiempo sin actividad',async()=>{
 const f=sessionFixture();await f.api.start();f.advance(PANEL_IDLE_MS-1);
 f.auth('TOKEN_REFRESHED',{access_token:'test-only-refreshed-token'});await f.events.input({isTrusted:false});
 f.advance(1);f.watch();await tick();assert.equal(f.api.isActive(),false);
});
test('la actividad real renueva la inactividad pero nunca las ocho horas máximas',async()=>{
 const f=sessionFixture();await f.api.start();
 for(let i=0;i<31;i++){f.advance(PANEL_IDLE_MS);f.advance(-1);await f.events.keydown({isTrusted:true});}
 assert.equal(f.api.isActive(),true);assert.ok(f.calls.includes('beauty_touch_panel_session'));
 f.advance(PANEL_MAX_MS-31*(PANEL_IDLE_MS-1)-60000);await f.events.keydown({isTrusted:true});
 f.advance(60000);f.watch();await tick();assert.equal(f.api.isActive(),false);
});
test('una respuesta privada pendiente se descarta después de cerrar la sesión',async()=>{
 const f=sessionFixture();await f.api.start();let finish;
 const pending=f.api.run(()=>new Promise(resolve=>finish=resolve));const rejection=assert.rejects(pending,{code:'BEAUTY_SESSION_EXPIRED'});
 await f.api.close();finish({data:{privatePrice:777}});await rejection;
});
test('una denegación de permisos cierra la sesión, mientras un fallo de validación permite corregir el formulario',async()=>{
 const f=sessionFixture();await f.api.start();
 const validation=await f.api.run(async()=>({error:{code:'22023',message:'Datos inválidos'}}));assert.equal(validation.error.code,'22023');assert.equal(f.api.isActive(),true);
 await assert.rejects(f.api.run(async()=>({error:{code:'42501',message:'Sin permiso'}})),{code:'BEAUTY_SESSION_EXPIRED'});
 await tick();assert.equal(f.api.isActive(),false);
});
test('abandonar la página limpia la memoria y solicita el cierre sin conservar el token',async()=>{
 const f=sessionFixture();await f.api.start();f.storage.setItem('beauty_day_admin_session','test-only-token');f.auth('SIGNED_IN',{access_token:'test-only-access-token'});
 f.events.pagehide();assert.equal(f.api.isActive(),false);assert.equal(f.storage.getItem('beauty_day_admin_session'),null);
 assert.equal(f.requests.length,1);assert.equal(f.requests[0][1].keepalive,true);assert.equal(f.requests[0][1].headers.Authorization,'Bearer test-only-access-token');
});

test('un fallo de conexión al cerrar nunca conserva el acceso local ni los tokens',async()=>{
 const f=sessionFixture();await f.api.start();f.storage.setItem('beauty_day_admin_session','test-only-token');
 f.client.rpc=async()=>({error:{code:'NETWORK',message:'Sin conexión'}});
 f.client.auth.signOut=async()=>({error:{message:'Sin conexión'}});
 await assert.rejects(f.api.close(),/no pudimos confirmar el cierre remoto/);
 assert.equal(f.api.isActive(),false);assert.equal(f.storage.getItem('beauty_day_admin_session'),null);
 let sent=false;await assert.rejects(f.api.run(async()=>{sent=true;}),{code:'BEAUTY_SESSION_EXPIRED'});assert.equal(sent,false);
});
