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
  const window={addEventListener:(event,fn)=>listeners[event]=fn,scrollTo(){},matchMedia:()=>({matches:true})};
  const context={document,window,location,sessionStorage:storage,localStorage:storage,fetch:async()=>({ok:true,json:async()=>content}),URLSearchParams,clearTimeout(){},setInterval(){},Date,Number,String,Array,Math,encodeURIComponent,setTimeout};
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
  location.hash='#/servicio/s01';listeners.hashchange();assert.match(node('#main').innerHTML,/Ver cómo acceder/);assert.doesNotMatch(node('#main').innerHTML,/55[.,]000/);
  assert.match(node('#site-footer').innerHTML,/#\/privacidad/);
});
