// Reštart aplikácie a celého zariadenia z ovládania (iba na Orange Pi nainštalovanom inštalátorom).
// Server beží ako obyčajný používateľ; inštalátor mu cez sudoers povolí spustiť jediný
// pomocný skript, ktorý vie iba tieto dve akcie.
import { execFile } from 'node:child_process';
import fs from 'node:fs';

const HELPER = process.env.LAUDATE_SYSTEM_HELPER || '/usr/local/sbin/laudate-system';
const ACTIONS = new Set(['restart-app', 'reboot']);

export function systemActionsAvailable() {
  try {
    fs.accessSync(HELPER, fs.constants.X_OK);
    return fs.existsSync('/usr/bin/sudo');
  } catch {
    return false;
  }
}

export function runSystemAction(action) {
  return new Promise((resolve, reject) => {
    if (!ACTIONS.has(action)) return reject(new Error('Neznáma akcia'));
    if (!systemActionsAvailable()) return reject(new Error('Na tomto zariadení to nie je nastavené (spusti nový inštalátor)'));
    // -n: nikdy sa nepýtať na heslo; skript zaradí akciu do systemd a hneď skončí
    execFile('/usr/bin/sudo', ['-n', HELPER, action], { timeout: 15000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error((stderr || err.message).trim()));
      resolve();
    });
  });
}

// Názov dosky pre ovládanie ("Reštartovať Raspberry Pi" / "Orange Pi")
export function deviceName() {
  try {
    const model = fs.readFileSync('/proc/device-tree/model', 'utf8').replace(/\0/g, '');
    if (/Raspberry Pi/i.test(model)) return { model, name: 'Raspberry Pi' };
    if (/Orange Pi/i.test(model)) return { model, name: 'Orange Pi' };
    return { model, name: 'zariadenie' };
  } catch {
    return { model: null, name: 'zariadenie' };
  }
}
