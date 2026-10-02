import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import content from '../docs/content/site.json' with {type:'json'};

test('rutas públicas, carrusel, privacidad y reserva se generan sin errores',async()=>{
  const listeners={};
  const nodes=new Map();
  const node=key=>{
    if(!nodes.has(key))nodes.set(key,{innerHTML:'',textContent:'',disabled:false,classList:{add(){},remove(){},toggle(){}},setAttribute(){},addEventListener(){}});
    return nodes.get(key);
  };
  const document={querySelector:selector=>selector==='#featured-rail'?null:node(selector),querySelectorAll:()=>[],body:{append(){}},createElement:()=>({innerHTML:'',className:'',setAttribute(){},querySelector:()=>node('button')})};
  const storage={getItem:key=>key==='bd_storage_notice'?'1':key==='beautyDayBooking'?JSON.stringify({service:'s01',professional:'any',date:'2026-10-10',time:'10:00'}):null,setItem(){}};
  const location={hash:''};
  const window={BeautyData:{content:async()=>content,prices:async()=>{throw Error('El código es inválido o venció.');}},addEventListener:(event,fn)=>listeners[event]=fn,scrollTo(){},matchMedia:()=>({matches:true})};
  const context={document,window,location,sessionStorage:storage,localStorage:storage,fetch:async()=>({ok:true,json:async()=>content}),URL,URLSearchParams,clearTimeout(){},setInterval(){},Date,Number,String,Array,Math,encodeURIComponent,setTimeout};
  vm.runInNewContext(readFileSync(new URL('../docs/assets/js/access-link.js',import.meta.url),'utf8'),context);
  vm.runInNewContext(readFileSync(new URL('../docs/assets/js/app.js',import.meta.url),'utf8'),context);
  await new Promise(resolve=>setImmediate(resolve));
  assert.match(node('#main').innerHTML,/hero-inner/);
  assert.match(node('#main').innerHTML,/featured-rail/);
  assert.match(node('#main').innerHTML,/team-preview-grid/);
  for(const [route,expected] of [
    ['#/precios','price-access-form'],['#/servicios','catalog-tools'],['#/equipo','person-grid'],['#/promociones','promo-row'],
    ['#/bonos','combo-list'],['#/privacidad','Política de privacidad'],
    ['#/cookies','Cookies y almacenamiento'],['#/condiciones','Condiciones de reserva'],
    ['#/reserva/4','name="privacy"']
  ]){
    location.hash=route;
    listeners.hashchange();
    assert.ok(node('#main').innerHTML.includes(expected),route);
  }
  location.hash='#/servicio/s01';listeners.hashchange();assert.match(node('#main').innerHTML,/Cómo ver precios/);assert.doesNotMatch(node('#main').innerHTML,/55[.,]000/);
  assert.match(node('#site-footer').innerHTML,/#\/privacidad/);
});

test('el código habilita tarifas y una revocación vuelve a ocultarlas',async()=>{
 const nodes=new Map(),listeners={},saved=new Map([['bd_storage_notice','1']]);
 const node=key=>{
  if(!nodes.has(key))nodes.set(key,{innerHTML:'',textContent:'',value:'',disabled:false,isConnected:true,handlers:{},classList:{add(){},remove(){},toggle(){}},setAttribute(){},addEventListener(event,fn){this.handlers[event]=fn;},querySelector:()=>node('button')});
  return nodes.get(key);
 };
 const document={hidden:false,querySelector:s=>s==='#featured-rail'?null:node(s),querySelectorAll:()=>[],body:{append(){}},createElement:()=>node('aside')};
 const storage={getItem:key=>saved.get(key)||null,setItem:(key,value)=>saved.set(key,value),removeItem:key=>saved.delete(key)};
 let revoked=false,interval;
 const location={hash:'#/precios'};
 const window={BeautyData:{content:async()=>content,prices:async()=>{if(revoked)throw Error('El código es inválido o venció.');return {expiresAt:Date.now()+60000,prices:[{id:'s01',price:777,pricePrefix:''}]};}},addEventListener:(event,fn)=>listeners[event]=fn,scrollTo(){},matchMedia:()=>({matches:true})};
 const context={document,window,location,sessionStorage:storage,localStorage:storage,URL,URLSearchParams,Date,Number,String,Array,Math,encodeURIComponent,setTimeout(){return 1;},clearTimeout(){},setInterval:fn=>interval=fn};
 vm.runInNewContext(readFileSync(new URL('../docs/assets/js/access-link.js',import.meta.url),'utf8'),context);
 vm.runInNewContext(readFileSync(new URL('../docs/assets/js/app.js',import.meta.url),'utf8'),context);
 await new Promise(resolve=>setImmediate(resolve));
 node('#price-code').value='0123456789abcdef0123456789abcdef';
 await node('#price-access-form').handlers.submit({preventDefault(){},currentTarget:node('#price-access-form')});
 assert.equal(saved.get('bd_price_code'),'0123456789abcdef0123456789abcdef');
 location.hash='#/servicio/s01';listeners.hashchange();
 assert.match(node('#main').innerHTML,/777 COP/);
 revoked=true;interval();
 await new Promise(resolve=>setImmediate(resolve));
 assert.match(node('#main').innerHTML,/Cómo ver precios/);
 assert.doesNotMatch(node('#main').innerHTML,/777 COP/);
 assert.equal(saved.has('bd_price_code'),false);
 location.hash='#/precios';listeners.hashchange();
 node('#price-code').value='0123456789abcdef0123456789abcdef';
 await node('#price-access-form').handlers.submit({preventDefault(){},currentTarget:node('#price-access-form')});
 assert.match(node('#main').innerHTML,/Este acceso venció o fue retirado/);
 assert.match(node('#main').innerHTML,/<details class="access-fallback" open>/);
});

async function openPrivateLink({reject=false,token='0123456789abcdef0123456789abcdef'}={}){
 const nodes=new Map(),listeners={},saved=new Map([['bd_storage_notice','1']]);
 const node=key=>{if(!nodes.has(key))nodes.set(key,{innerHTML:'',textContent:'',disabled:false,isConnected:true,classList:{add(){},remove(){},toggle(){}},setAttribute(){},addEventListener(){}});return nodes.get(key);};
 const document={hidden:false,querySelector:s=>s==='#featured-rail'?null:node(s),querySelectorAll:()=>[],body:{append(){}}};
 const storage={getItem:key=>saved.get(key)||null,setItem:(key,value)=>saved.set(key,value),removeItem:key=>saved.delete(key)};
 const location={pathname:'/Beauty-Day/',search:'',hash:'#/servicios?acceso='+token};
 const replaced=[],calls=[];
 const history={replaceState(_state,_unused,url){replaced.push(url);location.hash=new URL(url,'https://salon.test').hash;}};
 const window={BeautyData:{content:async()=>content,prices:async code=>{calls.push(code);if(reject)throw Error('El código es inválido o venció.');return {expiresAt:Date.now()+60000,prices:[{id:'s01',price:777,pricePrefix:''}]};}},addEventListener:(event,fn)=>listeners[event]=fn,scrollTo(){},matchMedia:()=>({matches:true})};
 const context={window,document,location,history,sessionStorage:storage,localStorage:storage,URL,URLSearchParams,Date,Number,String,Array,Math,encodeURIComponent,setTimeout(){return 1;},clearTimeout(){},setInterval(){}};
 for(const script of ['access-link.js','app.js'])vm.runInNewContext(readFileSync(new URL('../docs/assets/js/'+script,import.meta.url),'utf8'),context);
 await new Promise(resolve=>setImmediate(resolve));
 return {main:node('#main').innerHTML,replaced,calls,saved,location};
}
test('abrir el enlace muestra las tarifas y retira el acceso de la URL',async()=>{
 const r=await openPrivateLink();
 assert.deepEqual(r.calls,['0123456789abcdef0123456789abcdef']);
 assert.equal(r.replaced[0],'/Beauty-Day/#/precios');assert.equal(r.location.hash,'#/servicios');
 assert.match(r.main,/777 COP/);assert.equal(r.saved.get('bd_price_code'),'0123456789abcdef0123456789abcdef');
});
test('un enlace vencido o incompleto conserva los precios ocultos y explica cómo continuar',async()=>{
 const revoked=await openPrivateLink({reject:true});
 assert.match(revoked.main,/Este acceso venció o fue retirado/);assert.doesNotMatch(revoked.main,/777 COP/);assert.equal(revoked.saved.has('bd_price_code'),false);
 const malformed=await openPrivateLink({token:'incompleto'});
 assert.equal(malformed.calls.length,0);assert.match(malformed.main,/código completo/);assert.equal(malformed.location.hash,'#/precios');
});
