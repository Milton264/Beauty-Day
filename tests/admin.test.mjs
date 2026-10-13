import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import content from '../docs/content/site.json' with {type:'json'};
const tick=()=>new Promise(resolve=>setImmediate(resolve));

async function panel(role='admin',{delayLoad=false}={}){
 let markup='',modal='',fail=false,draftInputs=[],saved=[],issued=[],onSessionEnd,onAuthChange,finishLoad,finishSave,delaySave=false;
 const nodes=new Map(),queryLists=new Map();
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
 const document={querySelector:query,querySelectorAll:selector=>selector==='[data-draft]'?draftInputs:queryLists.get(selector)||[],activeElement:{focus(){}}};
 const privateContent=structuredClone(content);privateContent.services[0].price=20000;
 const backend={configured:true,onAuthChange(fn){onAuthChange=fn;},onSessionEnd(fn){onSessionEnd=fn;},session:async()=>({user:{}}),panelSession:async()=>delayLoad?new Promise(resolve=>finishLoad=()=>resolve({role,content:privateContent,revision:'rev1',pricesConfigured:true})):({role,content:privateContent,revision:'rev1',pricesConfigured:true}),saveContent:async(next,revision)=>{saved.push({next:structuredClone(next),revision});if(fail)throw Error('Otra persona guardó. Recarga para continuar.');if(delaySave)return new Promise(resolve=>finishSave=()=>resolve({revision:'rev2',pricesConfigured:true}));return {revision:'rev2',pricesConfigured:true};},issueCode:async checks=>{issued.push(checks);return {code:'01234567-89ab-cdef-0123-456789abcdef',expiresAt:Date.now()+86400000};},signOut:async()=>{onAuthChange('SIGNED_OUT');}};
 const window={BeautyData:backend,addEventListener(){},matchMedia:()=>({matches:true})};
 const context={window,document,location:{href:'https://salon.test/Beauty-Day/admin/'},navigator:{clipboard:{writeText:async()=>{}}},URL,URLSearchParams,structuredClone,Intl,Date,Number,String,Array,Object,Math,crypto:{randomUUID:()=> 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'},confirm:()=>true,setTimeout(){}};
 vm.runInNewContext(readFileSync(new URL('../docs/assets/js/media.js',import.meta.url),'utf8'),context);
 vm.runInNewContext(readFileSync(new URL('../docs/assets/js/access-link.js',import.meta.url),'utf8'),context);
 const source=readFileSync(new URL('../docs/admin/admin.js',import.meta.url),'utf8').replace(/\}\)\(\);\s*$/,`window.review={select(key){tab=key;editor();},openEntry,state:()=>({data,sha,dirty})};})();`);
 vm.runInNewContext(source,context);await tick();
 return {window,node,saved,issued,html:()=>markup,modal:()=>modal,fail(value){fail=value;},inputs(value){draftInputs=value;},queryList(selector,list){queryLists.set(selector,list);},expire(){onSessionEnd('La sesión terminó por seguridad.');},finishLoad:()=>finishLoad(),deferSave(){delaySave=true;},finishSave:()=>finishSave()};
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

test('atención solo muestra sus tareas y bloquea el editor de contenido',async()=>{
 const p=await panel('support');
 assert.match(p.html(),/Atención por WhatsApp/);
 assert.doesNotMatch(p.html(),/data-tab="(?:services|general|administrators|categories)"|data-save/);
 p.window.review.select('access');
 assert.match(p.html(),/grant-form/);assert.doesNotMatch(p.html(),/import-prices/);
 p.window.review.openEntry('services',0);
 assert.equal(p.modal(),'');assert.equal(p.saved.length,0);
 p.window.review.select('administrators');
 assert.doesNotMatch(p.html(),/admin-email-form/);
 assert.match(p.html(),/Continúa la conversación/);
});
test('todas las colecciones tienen fotografías y explican dónde se muestran',async()=>{
 const p=await panel();
 for(const key of ['services','professionals','promotions','gifts','combos']){
  p.window.review.select(key);
  p.window.review.openEntry(key);
  assert.match(p.modal(),/id="draft-photo"/,key);
  await p.node('#cancel-dialog').handlers.click();
 }
 p.window.review.select('gifts');assert.match(p.html(),/compra, entrega, vigencia y uso/);assert.match(p.html(),/href="\.\.\/#\/bonos"/);
 p.window.review.select('promotions');assert.match(p.html(),/muestran su foto en el inicio y en Promociones/);
 p.window.review.select('general');assert.match(p.html(),/Más que una cita/);assert.match(p.html(),/seccion=presentacion/);
 p.window.review.select('administrators');assert.match(p.html(),/value="support"/);assert.match(p.html(),/value="admin"/);
});

test('renombrar una categoría conserva sus servicios, especialidades y el filtro del panel',async()=>{
 const p=await panel(),old=p.window.review.state().data.categories[0];
 p.window.review.select('services');p.node('#service-category').value=old;
 p.node('#service-category').handlers.change({currentTarget:p.node('#service-category')});
 const input=p.node('category-input');input.dataset.categoryName='0';input.value='Nueva especialidad';
 p.queryList('[data-category-name]',[input]);p.window.review.select('categories');input.handlers.change();
 const data=p.window.review.state().data;
 assert.ok(data.services.some(s=>s.category==='Nueva especialidad'));
 assert.ok(data.professionals.some(person=>person.categories.includes('Nueva especialidad')));
 assert.ok(!data.services.some(s=>s.category===old));
 p.window.review.select('services');assert.match(p.html(),/Semipermanente/);assert.match(p.html(),/selected> Nueva especialidad|selected>\s*Nueva especialidad/);
});

test('agregar categorías evita duplicados incluso con diferencias de mayúsculas',async()=>{
 const p=await panel(),input=p.node('category-input');input.dataset.categoryName='0';input.value='nueva categoría';
 p.queryList('[data-category-name]',[input]);p.window.review.select('categories');input.handlers.change();
 p.node('#add-category').handlers.click();
 const categories=p.window.review.state().data.categories;
 assert.ok(categories.includes('Nueva categoría 2'));
 assert.equal(new Set(categories.map(c=>c.toLowerCase())).size,categories.length);
});

test('el filtro del panel distingue la categoría Todos de todas las categorías',async()=>{
 const p=await panel(),input=p.node('category-input');input.dataset.categoryName='0';input.value='Todos';
 p.queryList('[data-category-name]',[input]);p.window.review.select('categories');input.handlers.change();
 const data=p.window.review.state().data,expected=data.services.filter(s=>s.category==='Todos').length;
 p.window.review.select('services');
 assert.match(p.html(),/option value="" selected>Todas las categorías/);
 p.node('#service-category').value='Todos';p.node('#service-category').handlers.change({currentTarget:p.node('#service-category')});
 assert.equal((p.node('#services-list').innerHTML.match(/class="service-name"/g)||[]).length,expected);
 p.node('#service-category').value='';p.node('#service-category').handlers.change({currentTarget:p.node('#service-category')});
 assert.equal((p.node('#services-list').innerHTML.match(/class="service-name"/g)||[]).length,data.services.length);
});

test('una lectura pendiente no vuelve a mostrar el editor tras cerrar la sesión',async()=>{
 const p=await panel('admin',{delayLoad:true});assert.match(p.html(),/Abriendo el contenido/);
 p.expire();assert.match(p.html(),/login-form/);p.finishLoad();await tick();
 assert.match(p.html(),/login-form/);assert.doesNotMatch(p.html(),/class="editor"|Tarifa privada|Habilitar precios/);
 assert.equal(p.window.review.state().data,null);
});

test('un guardado pendiente se descarta al vencer la sesión y se limpia el borrador privado',async()=>{
 const p=await panel();p.window.review.select('services');p.window.review.openEntry('services',0);
 p.inputs([{dataset:{draft:'name'},type:'text',value:'Edición privada de prueba'}]);p.deferSave();
 const pending=p.node('#entry-form').handlers.submit({preventDefault(){},currentTarget:p.node('#entry-form')});
 p.expire();p.finishSave();await pending;
 assert.match(p.html(),/login-form/);assert.equal(p.modal(),'');assert.equal(p.window.review.state().data,null);
 assert.equal(p.window.review.state().dirty,false);assert.doesNotMatch(p.html(),/Edición privada|20[.,]000/);
});
