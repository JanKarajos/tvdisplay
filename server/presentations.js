// Prezentácie: PDF sa uloží priamo, PowerPoint/Impress (ppt, pptx, odp) sa cez LibreOffice
// prevedie na PDF – prehliadač na TV vie zobraziť iba PDF. Počet strán/slajdov sa zistí z PDF.
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

export const PRESENTATION_EXTENSIONS = new Set(['.ppt', '.pptx', '.pps', '.ppsx', '.odp', '.key']);
export const ACCEPTED_EXTENSIONS = new Set(['.pdf', ...PRESENTATION_EXTENSIONS]);

const SOFFICE_CANDIDATES = [
  process.env.SOFFICE_PATH,
  'soffice',
  'libreoffice',
  '/usr/bin/soffice',
  '/Applications/LibreOffice.app/Contents/MacOS/soffice',
].filter(Boolean);

let sofficePath; // undefined = ešte nezistené, null = nie je nainštalovaný
let checkedAt = 0;

export function hasSoffice() {
  return Boolean(sofficePath);
}

let searching = null;

export async function findSoffice() {
  if (sofficePath) return sofficePath;
  // Chýbajúci LibreOffice skúšame znova po minúte – po inštalácii netreba reštartovať server
  if (sofficePath === null && Date.now() - checkedAt < 60000) return null;
  if (searching) return searching;
  checkedAt = Date.now();
  searching = (async () => {
    for (const candidate of SOFFICE_CANDIDATES) {
      try {
        // Na slabom zariadení (Orange Pi) trvá prvé spustenie aj desiatky sekúnd
        await run(candidate, ['--version'], { timeout: 90000 });
        sofficePath = candidate;
        return sofficePath;
      } catch {
        // skús ďalší
      }
    }
    sofficePath = null;
    return null;
  })();
  try {
    return await searching;
  } finally {
    searching = null;
  }
}

// pdfjs sa načíta až pri prvom súbore, je veľký a Orange Pi by zbytočne spomalil pri štarte.
// Bez voliteľného @napi-rs/canvas v Node chýba DOMMatrix, ktorý pdfjs volá už pri načítaní.
// Počítanie strán ho nepoužíva (je potrebný iba na vykresľovanie), takže stačí prázdna trieda.
async function loadPdfjs() {
  globalThis.DOMMatrix ??= class DOMMatrix {};
  globalThis.Path2D ??= class Path2D {};
  globalThis.ImageData ??= class ImageData {};
  return import('pdfjs-dist/legacy/build/pdf.mjs');
}

export async function countPdfPages(buffer) {
  const { getDocument } = await loadPdfjs();
  const doc = await getDocument({ data: new Uint8Array(buffer), isEvalSupported: false }).promise;
  const pages = doc.numPages;
  await doc.destroy();
  return pages;
}

// Prevedie prezentáciu na PDF; vráti Buffer s PDF
let queue = Promise.resolve(); // LibreOffice naraz iba jeden prevod (inak sa bije o profil)

export function convertToPdf(buffer, ext) {
  const job = queue.then(async () => {
    const soffice = await findSoffice();
    if (!soffice) {
      const err = new Error('Na serveri chýba LibreOffice, prezentácie PowerPoint sa nedajú previesť. Na Raspberry Pi: sudo apt install libreoffice-impress');
      err.status = 501;
      throw err;
    }
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tvdisplay-'));
    try {
      const input = path.join(dir, `prezentacia${ext}`);
      fs.writeFileSync(input, buffer);
      await run(
        soffice,
        [`-env:UserInstallation=file://${path.join(os.tmpdir(), 'tvdisplay-lo-profile')}`, '--headless', '--convert-to', 'pdf', '--outdir', dir, input],
        { timeout: 420000 },
      );
      const output = path.join(dir, 'prezentacia.pdf');
      if (!fs.existsSync(output)) throw new Error('LibreOffice prezentáciu neprevedol');
      return fs.readFileSync(output);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
  queue = job.catch(() => {});
  return job;
}
