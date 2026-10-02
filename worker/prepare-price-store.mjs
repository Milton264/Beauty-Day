import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
if(!account||!token)throw Error('Faltan las credenciales de Cloudflare.');
const base=`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}/storage/kv/namespaces`;
async function api(path='',method='GET',body,raw=false){
 const r=await fetch(base+path,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':raw?'text/plain':'application/json'},body:body===undefined?undefined:raw?body:JSON.stringify(body)});
 if(raw&&method==='GET'&&r.status===404)return null;
 if(!r.ok)throw Error(`Cloudflare rechazó la preparación de KV (${r.status}). Comprueba el permiso Workers KV Storage: Edit.`);
 if(raw&&method==='GET')return r.text();
 const value=await r.json();if(!value.success)throw Error('Cloudflare no pudo preparar KV.');return value;
}
let ns;for(let page=1;page<=100;page++){
 const result=await api(`?page=${page}&per_page=100`);ns=result.result.find(x=>x.title==='beauty-day-private-prices');
 if(ns||result.result.length<100)break;
}
if(!ns)ns=(await api('','POST',{title:'beauty-day-private-prices'})).result;
if(!/^[a-f0-9]{32}$/.test(ns.id))throw Error('Identificador de KV inválido.');
const path=new URL('./wrangler.toml',import.meta.url);
let toml=readFileSync(path,'utf8');
if(/\[\[kv_namespaces\]\]/.test(toml))throw Error('La preparación automática requiere wrangler.toml sin un namespace manual.');
toml+=`\n[[kv_namespaces]]\nbinding = "PRICE_STORE"\nid = "${ns.id}"\n`;writeFileSync(path,toml);
// Primera activación: recuperar únicamente las tarifas ya existentes en el
// historial de este mismo repositorio. Nunca imprimirlas ni escribirlas a disco.
if(!await api(`/${ns.id}/values/catalog`,'GET',undefined,true)){
 let prices;
 try{
  const commits=execFileSync('git',['log','-50','--format=%H','--','docs/content/site.json'],{encoding:'utf8'}).trim().split('\n');
  for(const sha of commits){
   if(!/^[a-f0-9]{40}$/.test(sha))continue;
   const old=JSON.parse(execFileSync('git',['show',`${sha}:docs/content/site.json`],{encoding:'utf8',maxBuffer:500000}));
   if(old.services?.some(s=>Number.isInteger(s.price))){prices=old.services.map(({id,price,pricePrefix})=>({id,price,pricePrefix}));break;}
  }
 }catch{/* La importación manual del panel permanece disponible. */}
 if(prices){await api(`/${ns.id}/values/catalog`,'PUT',JSON.stringify({prices}),true);console.log('Tarifas anteriores migradas al almacén privado.');}
 else console.log('No se encontraron tarifas anteriores. Impórtalas desde el panel después del despliegue.');
}
console.log('Almacén privado preparado.');
