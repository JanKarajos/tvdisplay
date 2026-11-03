// Nastaví heslo používateľovi (alebo ho vytvorí). Použitie:
//   node server/set-password.mjs <meno> <heslo> [--admin]
// Na Synology NAS:
//   docker exec -it tvdisplay-admin node server/set-password.mjs admin NoveHeslo123 --admin
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { hashPassword } from './admin.mjs';

const [username, password, flag] = process.argv.slice(2);
if (!username || !password) {
  console.log('Použitie: node server/set-password.mjs <meno> <heslo> [--admin]');
  process.exit(1);
}
if (password.length < 8) {
  console.log('Heslo musí mať aspoň 8 znakov.');
  process.exit(1);
}

const dataDir = process.env.DATA_DIR || path.resolve('admin-data');
const usersFile = path.join(dataDir, 'users.json');
let users = [];
try {
  users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
} catch {
  // ešte žiadni používatelia
}

let user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
if (user) {
  user.passwordHash = hashPassword(password);
  if (flag === '--admin') {
    user.role = 'admin';
    user.churchId = null;
  }
  console.log(`Heslo používateľa "${user.username}" bolo zmenené.`);
} else {
  if (flag !== '--admin') {
    console.log('Používateľ neexistuje. Nového editora vytvor v administrácii, alebo pridaj --admin pre nového administrátora.');
    process.exit(1);
  }
  user = { id: `u-${crypto.randomBytes(6).toString('hex')}`, username, passwordHash: hashPassword(password), role: 'admin', churchId: null };
  users.push(user);
  console.log(`Vytvorený administrátor "${username}".`);
}

fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
console.log('Zmena sa prejaví hneď (server netreba reštartovať).');
