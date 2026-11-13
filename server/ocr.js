// Rozpoznanie textu z fotky strany spevníka (Tesseract, slovenčina) – bez internetu, priamo na zariadení.
// Inštalátor pridá balíky tesseract-ocr a tesseract-ocr-slk.
import { execFile, spawn } from 'node:child_process';

let available = null;

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
    const proc = spawn('tesseract', ['stdin', 'stdout', '-l', 'slk', '--psm', '4'], { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    const timer = setTimeout(() => proc.kill('SIGKILL'), 120000);
    proc.stdout.on('data', (d) => { out += d; });
    proc.stderr.on('data', (d) => { err += d; });
    proc.on('error', () => reject(Object.assign(new Error('Na zariadení chýba rozpoznávanie textu (spusti nový inštalátor)'), { status: 501 })));
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(err.trim().split('\n').pop() || 'Text sa nepodarilo rozpoznať'));
      resolve(out);
    });
    proc.stdin.on('error', () => {});
    proc.stdin.end(image);
  });
}
