const encoder = new TextEncoder();
const decoder = new TextDecoder();
const cors = origin => ({'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, POST, PUT, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type','Vary':'Origin','Cache-Control':'no-store'});
const json = (data,status,origin) => new Response(JSON.stringify(data),{status,headers:{...cors(origin),'Content-Type':'application/json; charset=utf-8'}});
const b64 = bytes => {let out='';for(let i=0;i<bytes.length;i+=8192)out+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(out);};
const unb64 = value => Uint8Array.from(atob(value.replace(/\s/g,'')),c=>c.charCodeAt(0));
const equal = (a,b) => a.length===b.length && a.reduce((diff,v,i)=>diff|(v^b[i]),0)===0;
// El instalador crea una contraseña aleatoria de 32 caracteres. 12.000 rondas
// mantienen la verificación dentro del límite de CPU del plan gratuito.
const digest = async (password,salt) => new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations:12000},await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']),256));
const hmacKey = secret => crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
const sign = async (payload,secret) => `${b64(encoder.encode(JSON.stringify(payload)))}.${b64(new Uint8Array(await crypto.subtle.sign('HMAC',await hmacKey(secret),encoder.encode(JSON.stringify(payload)))))}`;
async function authorized(request,env) {
  const token=(request.headers.get('Authorization')||'').replace(/^Bearer /i,'');
  const [data,signature,...extra]=token.split('.');if(!data||!signature||extra.length)return false;
  try {
    const payload=JSON.parse(decoder.decode(unb64(data)));
    if(payload.role!=='editor'||payload.exp<Date.now()||payload.exp>Date.now()+8*3600000)return false;
    return crypto.subtle.verify('HMAC',await hmacKey(env.ADMIN_SESSION_SECRET),unb64(signature),encoder.encode(JSON.stringify(payload)));
  }catch{return false;}
}
const filePath = env => env.CONTENT_PATH||'docs/content/site.json';
async function github(env,path,method='GET',body) {
  const url=`https://api.github.com/repos/${encodeURIComponent(env.REPO_OWNER)}/${encodeURIComponent(env.REPO_NAME)}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(env.BRANCH||'main')}`;
  const response=await fetch(url,{method,headers:{'Authorization':`Bearer ${env.GITHUB_TOKEN}`,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'beauty-day-editor','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  let data;try{data=await response.json();}catch{data={};}
  if(!response.ok)throw Object.assign(new Error(response.status===409?'Otro cambio se guardó antes. Recarga el panel.':`GitHub rechazó la operación (${response.status}).`),{status:response.status});
  return data;
}
const short = (v,max=300) => typeof v==='string' && v.length<=max;
const image = v => v==='' || (typeof v==='string'&&/^assets\/(img|uploads)\/[a-zA-Z0-9._/-]+\.(png|jpe?g|webp)$/.test(v)&&!v.includes('..'));
function valid(content) {
  if(!content||content.version!==1||!content.brand||!content.contact||!content.legal)return false;
  const b=content.brand,c=content.contact;
  if(![b.name,b.eyebrow,b.heroTitle,b.heroSubtitle].every(x=>short(x,300))||!image(b.heroImage)||typeof b.heroImageIsReference!=='boolean')return false;
  if(!/^\d{10,15}$/.test(c.whatsapp)||![c.phone,c.address,c.hours,c.email].every(x=>short(x,300)))return false;
  if(![c.mapsUrl,c.instagramUrl,c.tiktokUrl||'',c.facebookUrl||''].every(x=>x===''||(short(x,500)&&/^https:\/\//.test(x))))return false;
  if(!short(content.legal.responsibleName,160)||!short(content.legal.privacyEmail,200))return false;
  if(!Array.isArray(content.categories)||content.categories.length>12||!content.categories.every(x=>short(x,60)))return false;
  const arrays=[['services',100],['professionals',30],['promotions',30],['gifts',30],['combos',30]];
  if(!arrays.every(([name,max])=>Array.isArray(content[name])&&content[name].length<=max))return false;
  if(new Set(content.services.map(s=>s.id)).size!==content.services.length)return false;
  if(!content.services.every(s=>short(s.id,40)&&short(s.name,120)&&short(s.category,60)&&short(s.description,1200)&&short(s.pricePrefix,40)&&image(s.image)&&typeof s.featured==='boolean'&&(s.price===null||Number.isInteger(s.price)&&s.price>=0&&s.price<100000000)&&(s.duration===null||Number.isInteger(s.duration)&&s.duration>0&&s.duration<1441)))return false;
  if(!content.professionals.every(p=>short(p.id,40)&&short(p.name,100)&&short(p.role,100)&&short(p.bio,1200)&&short(p.schedule,160)&&image(p.image)&&Array.isArray(p.categories)&&p.categories.length<=12&&p.categories.every(x=>short(x,60))))return false;
  if(!content.promotions.every(p=>short(p.id,40)&&short(p.title,160)&&short(p.tag,100)&&short(p.description,1200)&&short(p.terms,1200)&&image(p.image)&&typeof p.active==='boolean'))return false;
  if(!['gifts','combos'].every(key=>content[key].every(x=>short(x.id,40)&&short(x.title,160)&&short(x.description,1200))))return false;
  return true;
}
const normalizeCode = value => typeof value==='string' ? value.trim().replace(/[-\s]/g,'').toLowerCase() : '';
const codeKey = async code => 'access:'+Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(code))),b=>b.toString(16).padStart(2,'0')).join('');
const pricesOf = content => content.services.map(({id,price,pricePrefix})=>({id,price,pricePrefix}));
const publicContent = content => ({...content,services:content.services.map(s=>({...s,price:null,pricePrefix:''}))});
async function parseBody(request,max=300000){
  const raw=await request.text();if(raw.length>max)throw Object.assign(new Error('Solicitud demasiado grande.'),{status:413});
  try{return JSON.parse(raw);}catch{throw Object.assign(new Error('Solicitud inválida.'),{status:400});}
}
export default {async fetch(request,env) {
  const origin=request.headers.get('Origin');
  if(!env.SITE_ORIGIN||origin!==env.SITE_ORIGIN)return new Response('Origen no permitido',{status:403});
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...cors(origin),'Access-Control-Max-Age':'600'}});
  if(!env.GITHUB_TOKEN||!env.ADMIN_PASSWORD_SALT||!env.ADMIN_PASSWORD_HASH||!env.ADMIN_SESSION_SECRET||!env.REPO_OWNER||!env.REPO_NAME)return json({error:'Configuración incompleta del servidor.'},503,origin);
  const path=new URL(request.url).pathname;
  try {
    if(path==='/api/login'&&request.method==='POST') {
      const ip=request.headers.get('CF-Connecting-IP')||'local';
      if(!env.LOGIN_LIMITER)return json({error:'Falta configurar el límite de intentos.'},503,origin);
      const {success}=await env.LOGIN_LIMITER.limit({key:`login:${ip}`});
      if(!success)return json({error:'Demasiados intentos. Espera un minuto.'},429,origin);
      const raw=await request.text();
      if(raw.length>2048)return json({error:'Solicitud inválida.'},400,origin);
      let body;try{body=JSON.parse(raw);}catch{return json({error:'Solicitud inválida.'},400,origin);}
      if(!short(body?.password,256))return json({error:'Contraseña inválida.'},401,origin);
      const given=await digest(body.password,unb64(env.ADMIN_PASSWORD_SALT));
      if(!equal(given,unb64(env.ADMIN_PASSWORD_HASH)))return json({error:'Contraseña inválida.'},401,origin);
      return json({token:await sign({role:'editor',exp:Date.now()+8*3600000},env.ADMIN_SESSION_SECRET)},200,origin);
    }
    if(path==='/api/prices'&&request.method==='POST') {
      if(!env.PRICE_STORE||!env.PUBLIC_LIMITER)return json({error:'El acceso a precios todavía no está habilitado. Consulta con Beauty Day.'},503,origin);
      const {success}=await env.PUBLIC_LIMITER.limit({key:'prices:'+(request.headers.get('CF-Connecting-IP')||'local')});
      if(!success)return json({error:'Demasiados intentos. Espera un minuto.'},429,origin);
      const body=await parseBody(request,1024),code=normalizeCode(body?.code);
      if(!/^[a-f0-9]{32}$/.test(code))return json({error:'El código es inválido o venció.'},401,origin);
      const grant=await env.PRICE_STORE.get(await codeKey(code),'json');
      if(!grant||!Number.isFinite(grant.exp)||grant.exp<=Date.now()||grant.approved!==true)return json({error:'El código es inválido o venció.'},401,origin);
      const catalog=await env.PRICE_STORE.get('catalog','json');
      if(!catalog)return json({error:'Beauty Day aún está preparando las tarifas.'},503,origin);
      return json({prices:catalog.prices,expiresAt:grant.exp},200,origin);
    }
    if(!await authorized(request,env))return json({error:'Sesión vencida o no autorizada.'},401,origin);
    if(path==='/api/access'&&request.method==='POST') {
      if(!env.PRICE_STORE)return json({error:'Falta configurar el almacén privado de precios.'},503,origin);
      const body=await parseBody(request,1024);
      if(!['instagram','tiktok','facebook','reservation'].every(k=>body?.checks?.[k]===true))return json({error:'Debes revisar los tres seguimientos y confirmar la reserva antes de generar el acceso.'},400,origin);
      if(!await env.PRICE_STORE.get('catalog'))return json({error:'Guarda o importa las tarifas antes de generar accesos.'},409,origin);
      const code=Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join(''),exp=Date.now()+86400000;
      await env.PRICE_STORE.put(await codeKey(code),JSON.stringify({approved:true,exp}),{expirationTtl:86400});
      return json({code:code.match(/.{8}/g).join('-'),expiresAt:exp},201,origin);
    }
    if(path==='/api/access/revoke'&&request.method==='POST') {
      if(!env.PRICE_STORE)return json({error:'Falta configurar el almacén privado.'},503,origin);
      const body=await parseBody(request,1024),code=normalizeCode(body?.code);
      if(!/^[a-f0-9]{32}$/.test(code))return json({error:'Introduce un código válido.'},400,origin);
      await env.PRICE_STORE.delete(await codeKey(code));return json({revoked:true},200,origin);
    }
    if(path==='/api/content'&&request.method==='GET') {
      const file=await github(env,filePath(env));
      if(!env.PRICE_STORE)return json({error:'Falta configurar PRICE_STORE. Sigue ACTIVAR_PRECIOS.md.'},503,origin);
      const content=publicContent(JSON.parse(decoder.decode(unb64(file.content))));
      const catalog=await env.PRICE_STORE.get('catalog','json');
      const prices=new Map((catalog?.prices||[]).map(s=>[s.id,s]));
      content.services=content.services.map(s=>({...s,...(prices.get(s.id)||{})}));
      return json({content,sha:file.sha,pricesConfigured:!!catalog},200,origin);
    }
    if(path==='/api/content'&&request.method==='PUT') {
      const raw=await request.text();
      if(raw.length>300000)return json({error:'Contenido demasiado grande.'},413,origin);
      let body;try{body=JSON.parse(raw);}catch{return json({error:'Contenido inválido.'},400,origin);}
      if(!valid(body?.content)||!short(body?.sha,100))return json({error:'Contenido inválido.'},400,origin);
      const current=await github(env,filePath(env));
      if(current.sha!==body.sha)return json({error:'El contenido cambió desde que abriste el panel. Recarga antes de guardar.'},409,origin);
      if(!env.PRICE_STORE)return json({error:'Falta configurar el almacén privado de precios.'},503,origin);
      const content=b64(encoder.encode(JSON.stringify(publicContent(body.content),null,2)+'\n'));
      const result=await github(env,filePath(env),'PUT',{message:'Actualiza contenido de Beauty Day desde el panel',content,sha:body.sha,branch:env.BRANCH||'main'});
      try{await env.PRICE_STORE.put('catalog',JSON.stringify({prices:pricesOf(body.content)}));}
      catch{return json({error:'El contenido público se guardó; las tarifas no. Recarga el panel y vuelve a guardar las tarifas.',sha:result.content.sha,partial:true},502,origin);}
      return json({sha:result.content.sha,pricesConfigured:true},200,origin);
    }
    if(path==='/api/upload'&&request.method==='POST') {
      const raw=await request.text();
      if(raw.length>620000)return json({error:'La foto es demasiado grande.'},413,origin);
      let body;try{body=JSON.parse(raw);}catch{return json({error:'Foto inválida.'},400,origin);}
      const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[body?.mime];
      if(!ext)return json({error:'Usa una imagen JPG, PNG o WebP.'},400,origin);
      const encoded=body.base64;
      if(typeof encoded!=='string'||encoded.length<16||encoded.length>600000||!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))return json({error:'Foto inválida.'},400,origin);
      const bytes=unb64(encoded.slice(0,32));
      const signature=ext==='jpg'&&bytes[0]===255&&bytes[1]===216||ext==='png'&&bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71||ext==='webp'&&decoder.decode(bytes.subarray(0,4))==='RIFF'&&decoder.decode(bytes.subarray(8,12))==='WEBP';
      if(!signature)return json({error:'El archivo no corresponde al formato indicado.'},400,origin);
      const id=crypto.randomUUID().slice(0,12),name=`foto-${Date.now()}-${id}.${ext}`;
      const uploadPrefix=env.UPLOAD_PREFIX||'docs/assets/uploads';
      if(!/^docs\/assets\/uploads$/.test(uploadPrefix))return json({error:'Ruta de imágenes inválida.'},503,origin);
      await github(env,`${uploadPrefix}/${name}`,'PUT',{message:`Agrega imagen Beauty Day ${name}`,content:encoded,branch:env.BRANCH||'main'});
      return json({path:`assets/uploads/${name}`},200,origin);
    }
    return json({error:'Ruta no encontrada.'},404,origin);
  } catch(error) {return json({error:error.message||'Ocurrió un error.'},[400,409,413].includes(error.status)?error.status:502,origin);}
}};
export {valid,digest,b64,unb64,publicContent,codeKey};
