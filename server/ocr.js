// Rozpoznanie textu z fotky strany spevníka (Tesseract, slovenčina) – bez internetu, priamo na zariadení.
// Inštalátor pridá balíky tesseract-ocr a tesseract-ocr-slk.
import { execFile, spawn } from 'node:child_process';

let available = null;

// Iba znaky, ktoré sa v slovenskom spevníku vyskytujú – bez nich rozpoznávanie na tmavších alebo
// rozmazaných fotkách vracia znaky ako $ > | # © a pod.
const LETTERS = 'aáäbcčdďeéfghiíjklĺľmnňoóôpqrŕsštťuúvwxyýzž';
const WHITELIST = `${LETTERS}${LETTERS.toUpperCase()}0123456789.,;:!?-–—'"„“”()[]/+ `;

export function ocrAvailable() {
  if (available === null) {
    available = false;
    execFile('tesseract', ['--list-langs'], { timeout: 5000 }, (err, stdout, stderr) => {
      available = !err && /\bslk\b/.test(`${stdout}${stderr}`);
    });
  }
  return available;
}

export function recognizeText(image) {
  return new Promise((resolve, reject) => {
    // psm 4: jeden stĺpec textu s riadkami rôznej dĺžky (strana spevníka)
    const proc = spawn('tesseract', ['stdin', 'stdout', '-l', 'slk', '--psm', '4', '-c', `tessedit_char_whitelist=${WHITELIST}`], { stdio: ['pipe', 'pipe', 'pipe'] });
    // Výstup ako bajty: písmeno s diakritikou (2 bajty v UTF-8) môže byť rozdelené medzi dva kúsky
    const out = [];
    const err = [];
    const timer = setTimeout(() => proc.kill('SIGKILL'), 120000);
    proc.stdout.on('data', (d) => out.push(d));
    proc.stderr.on('data', (d) => err.push(d));
    proc.on('error', () => reject(Object.assign(new Error('Na zariadení chýba rozpoznávanie textu (spusti nový inštalátor)'), { status: 501 })));
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(Buffer.concat(err).toString('utf8').trim().split('\n').pop() || 'Text sa nepodarilo rozpoznať'));
      resolve(Buffer.concat(out).toString('utf8').normalize('NFC'));
    });
    proc.stdin.on('error', () => {});
    proc.stdin.end(image);
  });
}
