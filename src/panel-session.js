export const PANEL_IDLE_MS=15*60*1000;
export const PANEL_MAX_MS=8*60*60*1000;
const SESSION_KEY='beauty_day_admin_session';

// Tokens en memoria. Solo el verificador PKCE, que no concede acceso por sí solo,
// cruza pestañas durante quince minutos para confirmar o recuperar la cuenta.
export function createAuthStorage({sessionStorage,localStorage,now=Date.now}={}){
 const memory=new Map();
 for(const key of [SESSION_KEY,SESSION_KEY+'-user'])for(const store of [sessionStorage,localStorage])try{store?.removeItem(key);}catch{}
 return {
  getItem(key){
   if(!key.endsWith('-code-verifier'))return memory.get(key)||null;
   try{const item=JSON.parse(localStorage?.getItem(key)||'null');if(item&&item.expiresAt>now()&&typeof item.value==='string')return item.value;localStorage?.removeItem(key);}catch{}
   const item=memory.get(key);return item&&item.expiresAt>now()?item.value:null;
  },
  setItem(key,value){
   if(!key.endsWith('-code-verifier')){memory.set(key,value);return;}
   const item={value,expiresAt:now()+PANEL_IDLE_MS};memory.set(key,item);
   try{localStorage?.setItem(key,JSON.stringify(item));}catch{}
  },
  removeItem(key){memory.delete(key);if(key.endsWith('-code-verifier'))try{localStorage?.removeItem(key);}catch{}},
  clearMemory(){memory.clear();}
 };
}

export function createPanelSession(client,{storage,settings,window,document,now=Date.now,setInterval,clearInterval,fetch}={}){
 let active=false,epoch=0,lastActivity=0,deadline=0,lastTouch=0,timer=null,touching=false,closing=null,token=null,recovering=false;
 const listeners=new Set();
 const expired=()=>{const error=Error('La sesión terminó. Vuelve a ingresar para continuar.');error.code='BEAUTY_SESSION_EXPIRED';return error;};
 function invalidate(reason){
  const wasActive=active;active=false;epoch++;if(timer!==null){clearInterval(timer);timer=null;}
  client.auth.stopAutoRefresh?.();
  if(wasActive)for(const callback of listeners)callback(reason);
 }
 async function close(reason='La sesión se cerró. Vuelve a ingresar para continuar.'){
  if(closing)return closing;
  const wasActive=active;invalidate(reason);
  closing=(async()=>{
   let remoteError;
   try{if(wasActive){const result=await client.rpc('beauty_end_panel_session');if(result.error)remoteError=result.error;}}
   catch(error){remoteError=error;}
   finally{try{const result=await client.auth.signOut({scope:'local'});if(result.error)remoteError??=result.error;}catch(error){remoteError??=error;}storage.clearMemory();token=null;recovering=false;}
   if(remoteError)throw Error('La sesión se cerró en este panel, pero no pudimos confirmar el cierre remoto. Revisa tu conexión.');
  })();
  try{return await closing;}finally{closing=null;}
 }
 function ensure(){
  if(!active)throw expired();
  if(now()-lastActivity>=PANEL_IDLE_MS||now()>=deadline){void close('La sesión terminó por seguridad. Vuelve a ingresar.').catch(()=>{});throw expired();}
 }
 async function start(){
  await closing;
  const result=await client.rpc('beauty_start_panel_session');
  if(result.error)throw Object.assign(Error(result.error.code==='PGRST202'?'Falta aplicar la actualización de sesiones de Beauty Day en la base de datos.':result.error.message),{code:result.error.code});
  if(!['admin','support'].includes(result.data?.role)||!Number.isFinite(result.data?.expiresAt)||result.data.expiresAt<=now())throw expired();
  active=true;epoch++;lastActivity=now();lastTouch=now();deadline=Math.min(result.data.expiresAt,now()+PANEL_MAX_MS);
  if(timer!==null)clearInterval(timer);timer=setInterval(()=>{try{ensure();}catch{}},10000);
  client.auth.startAutoRefresh?.();return result.data;
 }
 async function run(operation){
  ensure();const current=epoch,result=await operation();
  if(current!==epoch)throw expired();ensure();
  if(result.error?.code==='42501'){void close('Tu sesión o tus permisos ya no están vigentes. Vuelve a ingresar.').catch(()=>{});throw expired();}
  return result;
 }
 async function activity(event){
  if(!active||!event.isTrusted||document?.visibilityState==='hidden')return;
  try{ensure();lastActivity=now();if(touching||now()-lastTouch<60000)return;
   touching=true;lastTouch=now();await run(()=>client.rpc('beauty_touch_panel_session'));
  }catch(error){if(error.code==='BEAUTY_SESSION_EXPIRED')return;}
  finally{touching=false;}
 }
 for(const event of ['pointerdown','keydown','input','scroll'])window?.addEventListener?.(event,activity,{passive:true});
 window?.addEventListener?.('pagehide',()=>{
  const wasActive=active,accessToken=token;invalidate('Vuelve a ingresar para abrir el panel.');storage.clearMemory();token=null;
  // Best effort al abandonar la página. El vencimiento en la base sigue siendo
  // obligatorio aunque la red o el navegador interrumpan esta petición.
  if(wasActive&&accessToken&&fetch)void fetch(settings.url+'/rest/v1/rpc/beauty_end_panel_session',{method:'POST',headers:{apikey:settings.publishableKey,Authorization:'Bearer '+accessToken,'Content-Type':'application/json'},body:'{}',keepalive:true}).catch(()=>{});
 });
 client.auth.onAuthStateChange?.((event,session)=>{
  if(event==='PASSWORD_RECOVERY')recovering=true;
  if(event==='SIGNED_OUT'){invalidate('La sesión se cerró. Vuelve a ingresar.');storage.clearMemory();token=null;recovering=false;}
  else if(session?.access_token)token=session.access_token;
 });
 return {start,run,close,ensure,waitForClose:()=>closing,onEnd(callback){listeners.add(callback);return {unsubscribe:()=>listeners.delete(callback)};},isActive:()=>active,isRecovery:()=>recovering};
}
