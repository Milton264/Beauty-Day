import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const required = [
  'CLOUDFLARE_ACCOUNT_ID',
  'CLOUDFLARE_API_TOKEN',
  'BEAUTY_DAY_GITHUB_TOKEN',
  'BEAUTY_DAY_ADMIN_PASSWORD',
];
const missing = required.filter(name => !process.env[name]);
if (missing.length) {
  throw new Error('Faltan secretos de GitHub Actions: ' + missing.join(', '));
}
if (process.env.BEAUTY_DAY_ADMIN_PASSWORD.length < 20) {
  throw new Error('BEAUTY_DAY_ADMIN_PASSWORD debe tener al menos 20 caracteres.');
}

const salt = randomBytes(24).toString('base64');
const hash = pbkdf2Sync(process.env.BEAUTY_DAY_ADMIN_PASSWORD, Buffer.from(salt, 'base64'), 12000, 32, 'sha256').toString('base64');
const session = randomBytes(48).toString('base64');
const secrets = {
  GITHUB_TOKEN: process.env.BEAUTY_DAY_GITHUB_TOKEN,
  ADMIN_PASSWORD_SALT: salt,
  ADMIN_PASSWORD_HASH: hash,
  ADMIN_SESSION_SECRET: session,
};

// El archivo solo existe durante la ejecución temporal de GitHub Actions.
writeFileSync(new URL('./.deploy-secrets.json', import.meta.url), JSON.stringify(secrets), { mode: 0o600 });
console.log('Secretos del Worker preparados sin mostrar sus valores.');

