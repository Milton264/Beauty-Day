import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import content from '../docs/content/site.json' with {type:'json'};
const tick=()=>new Promise(resolve=>setImmediate(resolve));

async function panel(){
 let markup='',modal='',fail=false,draftInputs=[],saved=[],issued=[];
 const nodes=new Map();
 const node=key=>{
  if(!nodes.has(key))nodes.set(key,{textContent:'',value:'',hidden:false,disabled:false,handlers:{},elements:{},dataset:{},focus(){},select(){},showModal(){this.open=true;},close(){this.open=false;},scrollIntoView(){},reportValidity(){return true;},addEventListener(name,fn){this.handlers[name]=fn;},querySelector:()=>node('button'),reset(){for(const input of Object.values(this.elements)){input.checked=false;input.value='';}},get innerHTML(){return key==='#admin-root'?markup:key==='#modal-slot'?modal:this.html||'';},set innerHTML(value){if(key==='#admin-root'){markup=value;modal='';}else if(key==='#modal-slot')modal=value;else this.html=value;}});
  return nodes.get(key);
 };
 for(const name of ['instagram','tiktok','facebook','reservation','client'])node('#grant-form').elements[name]={checked:false,value:''};
 const query=selector=>{
  if(selector==='#admin-root')return node(selector);
  if(selector.startsWith('#'))return (markup+modal).includes('id="'+selector.slice(1)+'"')?node(selector):null;
  if(selector==='.status')return node(selector);
  if(selector==='.savebar')return node(selector);
  return null;
 };
 const document={querySelector:query,querySelectorAll:selector=>selector==='[data-draft]'?draftInputs:[],activeElement:{focus(){}}};
 const privateContent=structuredClone(content);privateContent.services[0].price=20000;
 const backend={configured:true,onAuthChange(){},session:async()=>({user:{}}),adminContent:async()=>({content:privateContent,revision:'rev1',pricesConfigured:true}),saveContent:async(next,revision)=>{saved.push({next:structuredClone(next),revision});if(fail)throw Error('Otra persona guardó. Recarga para continuar.');return {revision:'rev2',pricesConfigured:true};},issueCode:async checks=>{issued.push(checks);return {code:'01234567-89ab-cdef-0123-456789abcdef',expiresAt:Date.now()+86400000};},signOut:async()=>{}};
 const window={BeautyData:backend,addEventListener(){},matchMedia:()=>({matches:true})};
 const context={window,document,location:{href:'https://salon.test/Beauty-Day/admin/'},navigator:{clipboard:{writeText:async()=>{}}},URL,URLSearchParams,structuredClone,Intl,Date,Number,String,Array,Object,Math,crypto:{randomUUID:()=> 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'},confirm:()=>true,setTimeout(){}};
 vm.runInNewContext(readFileSync(new URL('../docs/assets/js/access-link.js',import.meta.url),'utf8'),context);
 const source=readFileSync(new URL('../docs/admin/admin.js',import.meta.url),'utf8').replace(/\}\)\(\);\s*$/,`window.review={select(key){tab=key;editor();},openEntry,state:()=>({data,sha,dirty})};})();`);
 vm.runInNewContext(source,context);await tick();
 return {window,node,saved,issued,html:()=>markup,modal:()=>modal,fail(value){fail=value;},inputs(value){draftInputs=value;}};
}
test('el editor conserva el contenido tras un error y guarda con la revisión actual al reintentar',async()=>{
 const p=await panel();p.window.review.select('services');
 assert.match(p.html(),/service-search/);assert.match(p.html(),/service-table/);assert.doesNotMatch(p.html(),/data-draft/);
 const original=p.window.review.state().data.services[0].name;
 p.window.review.openEntry('services',0);assert.match(p.modal(),/Guardar servicio/);
 p.inputs([{dataset:{draft:'name'},type:'text',value:'Servicio actualizado'}]);p.fail(true);
 await p.node('#entry-form').handlers.submit({preventDefault(){},currentTarget:p.node('#entry-form')});
 assert.equal(p.window.review.state().data.services[0].name,original);
 assert.equal(p.window.review.state().sha,'rev1');assert.equal(p.node('#entry-dialog').open,true);
 assert.match(p.node('#dialog-status').textContent,/Otra persona guardó/);
 p.fail(false);await p.node('#entry-form').handlers.submit({preventDefault(){},currentTarget:p.node('#entry-form')});
 assert.equal(p.window.review.state().data.services[0].name,'Servicio actualizado');
 assert.equal(p.window.review.state().sha,'rev2');assert.equal(p.saved[1].revision,'rev1');
 assert.equal(p.window.review.state().dirty,false);assert.match(p.node('.status').textContent,/Guardado/);
});
test('habilitar precios exige cuatro comprobaciones y prepara un enlace para la clienta',async()=>{
 const p=await panel();p.window.review.select('access');
 const form=p.node('#grant-form'),button=p.node('#grant-button');assert.equal(button.disabled,true);
 for(const name of ['instagram','tiktok','facebook'])form.elements[name].checked=true;
 form.handlers.change();assert.equal(button.disabled,true);
 form.elements.reservation.checked=true;form.elements.client.value='Valentina';form.handlers.change();assert.equal(button.disabled,false);
 await form.handlers.submit({preventDefault(){},currentTarget:form});
 assert.equal(p.issued.length,1);assert.ok(Object.values(p.issued[0]).every(Boolean));
 assert.match(p.node('#grant-message').value,/Hola Valentina/);assert.match(p.node('#grant-message').value,/https:\/\/salon.test\/Beauty-Day\/#\/servicios\?acceso=[a-f0-9]{32}/);
 assert.equal(p.node('#grant-result').hidden,false);assert.equal(button.disabled,true);
});
