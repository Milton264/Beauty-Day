import {randomBytes,pbkdf2Sync} from 'node:crypto';

const password=randomBytes(24).toString('base64url');
const salt=randomBytes(24);
const hash=pbkdf2Sync(password,salt,12000,32,'sha256');

console.log('CONTRASEÑA DEL PANEL (entrégala a la dueña por un canal privado): '+password);
console.log('ADMIN_PASSWORD_SALT = '+salt.toString('base64'));
console.log('ADMIN_PASSWORD_HASH = '+hash.toString('base64'));
console.log('ADMIN_SESSION_SECRET = '+randomBytes(48).toString('base64'));
console.log('Guarda estos datos de forma privada. No los subas a GitHub.');
