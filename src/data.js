import {createClient} from '@supabase/supabase-js';
import {createAuthStorage,createPanelSession} from './panel-session.js';
const settings=window.BEAUTY_DAY_SUPABASE||{};
const configured=/^https:\/\/[-a-z0-9]+\.supabase\.co$/.test(settings.url||'')&&/^sb_publishable_[A-Za-z0-9_-]+$/.test(settings.publishableKey||'');
const storage=createAuthStorage({sessionStorage:typeof sessionStorage==='undefined'?null:sessionStorage,localStorage:typeof localStorage==='undefined'?null:localStorage});
const db=configured?createClient(settings.url,settings.publishableKey,{auth:{storage,storageKey:'beauty_day_admin_session',persistSession:true,autoRefreshToken:true,detectSessionInUrl:/\/admin(?:\/(?:index\.html)?)?$/.test(new URL(location.href).pathname),flowType:'pkce'}}):null;
const panel=db?createPanelSession(db,{storage,settings,window,document:typeof document==='undefined'?null:document,setInterval,clearInterval,fetch:typeof fetch==='undefined'?null:fetch}):null;
function requireDb(){if(!db)throw Error('Falta conectar la base de datos de Beauty Day.');return db;}
function unwrap(result){if(result.error){const error=Error(result.error.code==='PGRST202'?'Falta aplicar la actualización de Beauty Day en la base de datos.':result.error.message||'No pudimos completar la petición.');error.code=result.error.code;throw error;}if(result.data?.error)throw Error(result.data.error);return result.data;}
async function rpc(name,params={}){return unwrap(await requireDb().rpc(name,params));}
async function panelRpc(name,params={}){requireDb();return unwrap(await panel.run(()=>db.rpc(name,params)));}
window.BeautyData={
 configured,
 async content(){if(!db){const response=await fetch('content/site.json',{cache:'no-cache'});if(!response.ok)throw Error('Contenido no disponible.');return response.json();}const data=unwrap(await db.from('beauty_content').select('document').eq('id','site').single());return data.document;},
 async prices(code){return rpc('beauty_read_prices',{p_code:code});},
 async signIn(email,password){await panel?.waitForClose();const result=await requireDb().auth.signInWithPassword({email,password});if(result.error){const error=Error(result.error.code==='email_not_confirmed'?'Tu cuenta está creada, pero falta confirmar tu correo. Abre el enlace de confirmación que recibiste.':'Correo o contraseña incorrectos.');error.code=result.error.code;throw error;}try{await panel.start();}catch(error){await panel.close().catch(()=>{});throw error;}return result.data;},
 async signUp(email,password){if(password.length<12)throw Error('Usa una contraseña de al menos 12 caracteres.');const result=await requireDb().auth.signUp({email,password,options:{emailRedirectTo:new URL('./',location.href).href}});if(result.error)throw Error(result.error.message);return result.data;},
 async session(){const session=unwrap(await requireDb().auth.getSession()).session;if(session&&!panel.isActive()&&!panel.isRecovery()){try{await panel.start();}catch(error){await panel.close().catch(()=>{});throw error;}}return session;},
 async signOut(){requireDb();return panel.close();},
 async recover(email){const result=await requireDb().auth.resetPasswordForEmail(email,{redirectTo:new URL('./',location.href).href});if(result.error)throw Error(result.error.message);},
 async resendConfirmation(email){const result=await requireDb().auth.resend({type:'signup',email,options:{emailRedirectTo:new URL('./',location.href).href}});if(result.error)throw Error(/rate_limit/.test(result.error.code||'')?'Se alcanzó el límite de envíos. Inténtalo más tarde.':result.error.message);return result.data;},
 async changePassword(password){if(password.length<12)throw Error('Usa una contraseña de al menos 12 caracteres.');const result=unwrap(await requireDb().auth.updateUser({password}));const closed=await db.auth.signOut({scope:'others'});if(closed.error)throw Error('La contraseña se actualizó, pero no pudimos confirmar el cierre de las otras sesiones.');await panel.start();return result;},
 onSessionEnd(callback){return panel?.onEnd(callback)||null;},
 onAuthChange(callback){if(db)return db.auth.onAuthStateChange(callback);return null;},
 adminContent:()=>panelRpc('beauty_admin_read'),
  panelSession:()=>panelRpc('beauty_panel_session'),
 saveContent:(content,revision)=>panelRpc('beauty_save_content',{p_content:content,p_revision:revision}),
 issueCode:checks=>panelRpc('beauty_issue_code',{p_checks:checks}),
 revokeCode:code=>panelRpc('beauty_revoke_code',{p_code:code}),
 admins:()=>panelRpc('beauty_list_admins'),
 manageAdmin:(email,active)=>panelRpc('beauty_manage_admin',{p_email:email,p_active:active}),
  manageMember:(email,active,role)=>panelRpc('beauty_manage_member',{p_email:email,p_active:active,p_role:role}),
 async upload(file){
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>500000)throw Error('Usa una foto JPG, PNG o WebP de hasta 500 KB.');
  const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type],path=`photos/${crypto.randomUUID()}.${ext}`;
  const client=requireDb();unwrap(await panel.run(()=>client.storage.from('beauty-images').upload(path,file,{contentType:file.type,upsert:false,cacheControl:'3600'})));
  return {path:client.storage.from('beauty-images').getPublicUrl(path).data.publicUrl};
 }
};
