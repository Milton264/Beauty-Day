import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const window={};
vm.runInNewContext(readFileSync(new URL('../docs/assets/js/access-link.js',import.meta.url),'utf8'),{window,URL,URLSearchParams});
const access=window.BeautyAccess,token='0123456789abcdef0123456789abcdef';
test('el enlace privado conserva el acceso en el fragmento y admite códigos anteriores',()=>{
 const link=access.link('01234567-89AB-CDEF-0123-456789ABCDEF','https://salon.test/Beauty-Day/?tracking=1');
 const url=new URL(link);
 assert.equal(url.search,'');assert.equal(url.hash,'#/servicios?acceso='+token);
 assert.equal(access.normalize(link),token);assert.equal(access.normalize('01234567-89AB-CDEF-0123-456789ABCDEF'),token);
 assert.equal(access.fromHash(url.hash),token);assert.equal(access.fromHash('#/servicios?c=Uñas'),null);
});
test('rechaza enlaces sin acceso y códigos incompletos',()=>{
 for(const value of ['','abc','https://salon.test/','#/servicios?acceso='+token])assert.throws(()=>access.normalize(value));
});
