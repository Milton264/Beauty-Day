import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const tick=()=>new Promise(resolve=>setImmediate(resolve));

function adapter(){
 let signInError={code:'email_not_confirmed'},resendError=null,resendArgs;
 const window={BEAUTY_DAY_SUPABASE:{url:'https://test.supabase.co',publishableKey:'sb_publishable_test'}};
 const db={auth:{signInWithPassword:async()=>({error:signInError,data:{session:{}}}),resend:async args=>{resendArgs=args;return {error:resendError,data:{}};}}};
 const source=readFileSync(new URL('../src/data.js',import.meta.url),'utf8').replace(/^import .*\n/,'');
 vm.runInNewContext(source,{window,createClient:()=>db,URL,location:{href:'https://salon.test/Beauty-Day/admin/'},sessionStorage:{getItem(){return null;},setItem(){},removeItem(){}}});
 return {api:window.BeautyData,signInError(value){signInError=value;},resendError(value){resendError=value;},resendArgs:()=>resendArgs};
}
test('el inicio de sesión distingue un correo sin confirmar de credenciales incorrectas',async()=>{
 const a=adapter();
 await assert.rejects(a.api.signIn('admin@example.invalid','test-only-password'),error=>error.code==='email_not_confirmed'&&/falta confirmar tu correo/.test(error.message));
 a.signInError({code:'invalid_credentials'});
 await assert.rejects(a.api.signIn('admin@example.invalid','test-only-password'),error=>error.code==='invalid_credentials'&&error.message==='Correo o contraseña incorrectos.');
 a.signInError(null);assert.ok((await a.api.signIn('admin@example.invalid','test-only-password')).session);
});
test('el reenvío usa confirmación de registro y conserva el destino del panel',async()=>{
 const a=adapter();await a.api.resendConfirmation('admin@example.invalid');
 assert.equal(a.resendArgs().type,'signup');assert.equal(a.resendArgs().email,'admin@example.invalid');
 assert.equal(a.resendArgs().options.emailRedirectTo,'https://salon.test/Beauty-Day/admin/');
 a.resendError({code:'over_email_send_rate_limit',message:'rate limit'});
 await assert.rejects(a.api.resendConfirmation('admin@example.invalid'),/límite de envíos/);
});
test('el panel explica la confirmación, conserva el correo y reenvía solo al solicitarlo',async()=>{
 let html='',resends=0;
 const form={elements:{email:{value:'admin@example.invalid'},password:{value:'test-only-password'}},handlers:{},querySelector(){return {disabled:false};},addEventListener(event,fn){this.handlers[event]=fn;}};
 const root={set innerHTML(value){html=value;}};
 const document={querySelector:selector=>selector==='#admin-root'?root:selector==='#login-form'?form:null,querySelectorAll:()=>[]};
 const window={BeautyData:{configured:true,onAuthChange(){},session:async()=>null,signIn:async()=>{const error=Error('Tu cuenta está creada, pero falta confirmar tu correo.');error.code='email_not_confirmed';throw error;},resendConfirmation:async email=>{assert.equal(email,'admin@example.invalid');resends++;}},addEventListener(){}};
 vm.runInNewContext(readFileSync(new URL('../docs/admin/admin.js',import.meta.url),'utf8'),{window,document,URL,location:{href:'https://salon.test/Beauty-Day/admin/'}});
 await tick();assert.match(html,/Confirmar mi correo/);
 await form.handlers.submit({preventDefault(){},currentTarget:form});
 assert.match(html,/Confirma tu correo/);assert.match(html,/falta confirmar tu correo/);assert.match(html,/value="admin@example.invalid"/);
 assert.doesNotMatch(html,/type="password"/);assert.equal(resends,0);
 await form.handlers.submit({preventDefault(){},currentTarget:form});
 assert.equal(resends,1);assert.match(html,/recibirás un nuevo enlace/);
});
