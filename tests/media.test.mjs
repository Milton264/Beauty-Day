import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const window={};
vm.runInNewContext(readFileSync(new URL('../docs/assets/js/media.js',import.meta.url),'utf8'),{window});
test('solo permite fotografías locales y del bucket de Supabase',()=>{
 const path='https://vkydsmoiizksoppqerbd.supabase.co/storage/v1/object/public/beauty-images/photos/abc.jpg';
 assert.equal(window.BeautyMedia.path(path),path);
 assert.equal(window.BeautyMedia.adminPath('assets/img/beauty-day/unas-rosas.webp'),'../assets/img/beauty-day/unas-rosas.webp');
 for(const value of [null,{},'javascript:alert(1)','data:image/svg+xml,<svg/>','//evil.example/x.jpg','assets/img/../x.jpg','https://evil.example/storage/v1/object/public/beauty-images/x.jpg',path+'?x=1',path+'#x','https://user:pass@vkydsmoiizksoppqerbd.supabase.co/storage/v1/object/public/beauty-images/x.jpg','assets/img/x.svg','assets/img/x.jpg" onerror="alert(1)'])assert.equal(window.BeautyMedia.path(value),'',String(value));
});
