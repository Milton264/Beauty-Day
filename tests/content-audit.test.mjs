import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import content from '../docs/content/site.json' with {type:'json'};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function page(data,{booking}={}){
 const nodes=new Map(),listeners={},saved=new Map([['bd_storage_notice','1']]);
 if(booking)saved.set('beautyDayBooking',JSON.stringify(booking));
 const node=key=>{if(!nodes.has(key))nodes.set(key,{innerHTML:'',textContent:'',value:'',disabled:false,handlers:{},classList:{add(){},remove(){},toggle(){}},setAttribute(){},addEventListener(event,fn){this.handlers[event]=fn;}});return nodes.get(key);};
 const buttons=data.services.map(s=>({...node('service:'+s.id),dataset:{service:s.id},classList:{toggle(){}},addEventListener(event,fn){this.handlers[event]=fn;}}));
 const document={querySelector:s=>s==='#featured-rail'?null:node(s),querySelectorAll:s=>s==='[data-service]'&&node('#main').innerHTML.includes('data-service=')?buttons:[],body:{append(){}}};
 const storage={getItem:key=>saved.get(key)||null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)};
 const location={hash:'',pathname:'/',search:''};
 const window={BeautyData:{content:async()=>data},addEventListener:(name,fn)=>listeners[name]=fn,scrollTo(){},matchMedia:()=>({matches:true})};
 const context={window,document,location,sessionStorage:storage,localStorage:storage,URL,URLSearchParams,Date,Number,String,Array,Object,Math,encodeURIComponent,setTimeout(){},clearTimeout(){},setInterval(){}};
 for(const script of ['media.js','access-link.js','app.js'])vm.runInNewContext(readFileSync(new URL('../docs/assets/js/'+script,import.meta.url),'utf8'),context);
 await tick();
 return {location,html:()=>node('#main').innerHTML,navigate(route){location.hash=route;listeners.hashchange();},node,buttons,saved};
}
test('todas las imágenes guardadas de promociones, bonos y combos se muestran al cliente',async()=>{
 const data=structuredClone(content);
 data.promotions[0].image='https://vkydsmoiizksoppqerbd.supabase.co/storage/v1/object/public/beauty-images/photos/promocion.jpg';
 data.promotions[0].active=true;data.promotions[1].active=false;data.promotions[1].title='Promoción oculta de prueba';
 data.gifts[0].image='assets/img/beauty-day/unas-rosas.webp';
 data.combos[0].image='assets/img/beauty-day/unas-ondas.webp';
 const p=await page(data);
 assert.match(p.html(),/src="https:\/\/vkydsmoiizksoppqerbd.supabase.co\/storage\/v1\/object\/public\/beauty-images\/photos\/promocion.jpg"/);
 assert.match(p.html(),/gift-preview/);
 p.navigate('#/promociones');assert.ok(p.html().includes(data.promotions[0].image));assert.doesNotMatch(p.html(),/Promoción oculta de prueba/);
 p.navigate('#/bonos');assert.ok(p.html().includes(data.gifts[0].image));assert.ok(p.html().includes(data.combos[0].image));
 assert.match(p.html(),/¿Cómo regalo un bono\?/);assert.match(p.html(),/wa.me\/573242889865\?text=/);
});
test('cada servicio y profesional tiene detalle y se mantiene la profesional al reservar',async()=>{
 const p=await page(structuredClone(content));
 for(const s of content.services){p.navigate('#/servicio/'+s.id);assert.ok(p.html().includes(s.name),s.id);assert.match(p.html(),/Solicitar este servicio/);assert.match(p.html(),/Cómo ver precios/);}
 for(const professional of content.professionals){p.navigate('#/profesional/'+professional.id);assert.ok(p.html().includes(professional.name));assert.ok(p.html().includes('p='+professional.id));}
 const professional=content.professionals[0],service=content.services.find(s=>professional.categories.includes(s.category));
 p.navigate('#/reserva/1?p='+professional.id);
 p.buttons.find(b=>b.dataset.service===service.id).handlers.click();
 assert.equal(JSON.parse(p.saved.get('beautyDayBooking')).professional,professional.id);
 p.navigate('#/reserva/2');assert.ok(p.html().includes('data-professional="'+professional.id+'"'));
 p.navigate('#/servicio/desconocido');assert.match(p.html(),/Esta página no está aquí/);
 p.navigate('#/profesional/desconocido');assert.match(p.html(),/Esta página no está aquí/);
});
test('contacto muestra las tres redes y la búsqueda conserva la categoría',async()=>{
 const p=await page(structuredClone(content));
 p.navigate('#/contacto');for(const network of ['instagramUrl','tiktokUrl','facebookUrl'])assert.ok(p.html().includes(content.contact[network]));
 p.navigate('#/servicios?c='+encodeURIComponent(content.categories[0]));p.node('#catalog-search').value='semi';
 p.node('#search-form').handlers.submit({preventDefault(){}});
 // El destino conserva la categoría y la consulta, aunque sus espacios se normalicen.
 const destination=new URLSearchParams(p.location.hash.split('?')[1]);
 assert.equal(destination.get('c'),content.categories[0]);assert.equal(destination.get('q'),'semi');
 // El nuevo render debe filtrar simultáneamente categoría y nombre.
 p.navigate('#/servicios?c='+encodeURIComponent(content.categories[0])+'&q=semi');assert.match(p.html(),/Semipermanente/);assert.doesNotMatch(p.html(),/href="#\/servicio\/s35"/);
});
test('contenido máximo, categorías renombradas, títulos largos y vacío no rompen las rutas',async()=>{
 const data=structuredClone(content);
 data.categories=Array.from({length:12},(_,i)=>'Categoría '+String(i+1).padStart(2,'0')+' '+ 'larga '.repeat(8));
 data.services=Array.from({length:100},(_,i)=>({...content.services[0],id:'stress'+i,category:data.categories[i%12],name:'Servicio '+i+' '+ 'nombreextenso'.repeat(7),featured:i<15,price:null}));
 data.professionals=Array.from({length:30},(_,i)=>({...content.professionals[0],id:'persona'+i,name:'Profesional '+i,categories:[data.categories[i%12]]}));
 for(const key of ['promotions','gifts','combos'])data[key]=Array.from({length:30},(_,i)=>({...content[key][0],id:key+i,title:'Opción '+i+' '+ 'tituloextenso'.repeat(8)}));
 const p=await page(data);assert.equal((p.html().match(/class="category-tile /g)||[]).length,12);
 p.navigate('#/servicios');assert.equal((p.html().match(/class="service-card"/g)||[]).length,100);
 p.navigate('#/equipo');assert.equal((p.html().match(/class="person-card"/g)||[]).length,30);
 p.navigate('#/promociones');assert.equal((p.html().match(/class="promo-card"/g)||[]).length,30);
 p.navigate('#/bonos');assert.equal((p.html().match(/class="number-card"/g)||[]).length,30);
 p.navigate('#/descubre?m=pausa');assert.match(p.html(),/href="#\/servicios"/);assert.doesNotMatch(p.html(),/c=Spa%20y%20bienestar/);
 for(const key of ['services','professionals','promotions','gifts','combos'])data[key]=[];
 const empty=await page(data);for(const route of ['#/servicios','#/equipo','#/promociones','#/bonos']){empty.navigate(route);assert.ok(empty.html().length>100);}
});
test('texto con HTML no ejecuta código ni crea etiquetas en tarjetas o formularios',async()=>{
 const data=structuredClone(content),attack='<img src=x onerror="alert(1)">';
 data.services[0].name=attack;data.promotions[0].title=attack;data.promotions[0].description='<script>alert(1)</script>';data.gifts[0].title=attack;
 const p=await page(data);for(const route of ['#/servicios','#/servicio/s01','#/promociones','#/bonos','#/reserva/1']){
  p.navigate(route);assert.doesNotMatch(p.html(),/<script>|<img src=x/);assert.match(p.html(),/&lt;img/);
 }
});

test('reservar desde un perfil descarta un servicio anterior incompatible y conserva la profesional',async()=>{
 const data=structuredClone(content),professional=data.professionals[0];
 const incompatible=data.services.find(s=>!professional.categories.includes(s.category));
 const compatible=data.services.find(s=>professional.categories.includes(s.category));
 assert.ok(incompatible&&compatible);
 const p=await page(data,{booking:{service:incompatible.id,professional:'any'}});
 p.navigate('#/reserva/1?p='+professional.id);
 const selected=JSON.parse(p.saved.get('beautyDayBooking'));
 assert.equal(selected.service,'');assert.equal(selected.professional,professional.id);
 p.buttons.find(b=>b.dataset.service===compatible.id).handlers.click();
 assert.equal(JSON.parse(p.saved.get('beautyDayBooking')).professional,professional.id);
 p.navigate('#/reserva/2');assert.ok(p.html().includes('data-professional="'+professional.id+'"'));
});

test('los enlaces de categorías antiguas vuelven al catálogo y permiten buscar',async()=>{
 const p=await page(structuredClone(content));
 p.navigate('#/servicios?c=Categor%C3%ADa%20que%20ya%20no%20existe');
 assert.equal((p.html().match(/class="service-card"/g)||[]).length,content.services.length);
 p.node('#catalog-search').value='semi';p.node('#search-form').handlers.submit({preventDefault(){}});
 const query=new URLSearchParams(p.location.hash.split('?')[1]);
 assert.equal(query.has('c'),false);assert.equal(query.get('q'),'semi');
});

test('una categoría llamada Todos se filtra sin confundirse con el catálogo completo',async()=>{
 const data=structuredClone(content),old=data.categories[0];data.categories[0]='Todos';
 data.services.forEach(s=>{if(s.category===old)s.category='Todos';});
 const expected=data.services.filter(s=>s.category==='Todos').length;
 const p=await page(data);
 p.navigate('#/servicios?c=Todos');
 assert.equal((p.html().match(/class="service-card"/g)||[]).length,expected);
 assert.match(p.html(),/href="#\/servicios\?c=Todos">Todos<\/a>/);
 p.navigate('#/servicios');
 assert.equal((p.html().match(/class="service-card"/g)||[]).length,data.services.length);
 assert.match(p.html(),/Todos los servicios/);
});

test('el inicio oculta el carrusel cuando no hay servicios destacados',async()=>{
 const data=structuredClone(content);data.services.forEach(s=>s.featured=false);
 const p=await page(data);
 assert.doesNotMatch(p.html(),/featured-rail|Servicio anterior|Servicio siguiente/);
 assert.match(p.html(),/category-grid/);assert.match(p.html(),/gift-preview/);
});

test('los correos editables se muestran y no inyectan parámetros en los enlaces',async()=>{
 const data=structuredClone(content);data.contact.email='salon+contacto@example.test?bcc=otra@example.test';data.legal.privacyEmail='datos@example.test?subject=Prueba';
 const p=await page(data);
 for(const route of ['#/contacto','#/privacidad']){
  p.navigate(route);const href=p.html().match(/href="(mailto:[^"]+)"/)[1];
  assert.equal(new URL(href).search,'');assert.match(href,/%3F/);
 }
});
