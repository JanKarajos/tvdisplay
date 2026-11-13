// Orange Pi napojené na administráciu (CHURCH_DATA_URL): server si pravidelne sťahuje piesne,
// obrázky, kategórie a súbory svojho kostola a drží ich kópiu na disku. Displej tak funguje
// aj keď NAS alebo internet nie je dostupný. Pri zmene v administrácii dá vedieť všetkým zariadeniam.
import { writeFileAtomic } from './safeWrite.js';
import fs from 'node:fs';
import path from 'node:path';

const FILES = ['songs.json', 'images.json', 'categories.json'];
const TIMEOUT_MS = 15000;
export const MEDIA_PREFIX = '/church-media/';

// "media/x.jpg" z administrácie -> "/church-media/x.jpg" na tomto serveri
// Súbor v media/ kostola: "media/x" (administrácia) alebo "/nas-media/x" (Orange Pi s NAS)
const isMediaLink = (url) => typeof url === 'string' && (url.startsWith('media/') || url.startsWith('/nas-media/'));

function localMediaUrl(url) {
  return isMediaLink(url) ? MEDIA_PREFIX + path.basename(url) : url;
}

export function createChurchSync({ dataUrl, cacheDir, intervalMs = 60000, onChange }) {
  const base = dataUrl.replace(/\/+$/, '');
  const mediaDir = path.join(cacheDir, 'media');
  const metaFile = path.join(cacheDir, 'etags.json');
  fs.mkdirSync(mediaDir, { recursive: true });

  let etags = {};
  try {
    etags = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
  } catch {
    // prvé spustenie
  }
  const status = { lastSync: null, lastError: null };

  const writeAtomic = writeFileAtomic;

  async function downloadMedia(name) {
    const target = path.join(mediaDir, name);
    if (fs.existsSync(target)) return;
    const res = await fetch(`${base}/media/${encodeURIComponent(name)}`, { signal: AbortSignal.timeout(120000) });
    if (!res.ok) throw new Error(`súbor ${name}: HTTP ${res.status}`);
    writeAtomic(target, Buffer.from(await res.arrayBuffer()));
  }

  // Stiahne obrázky a PDF, ktoré ešte nemáme, a zmaže tie, ktoré sa už nepoužívajú
  async function syncMedia() {
    const used = new Set();
    for (const file of ['songs.json', 'images.json']) {
      for (const item of readList(file, false)) {
        for (const url of [item.imageUrl, item.pdfUrl]) {
          if (isMediaLink(url)) used.add(path.basename(url));
        }
      }
    }
    for (const name of used) await downloadMedia(name);
    for (const name of fs.readdirSync(mediaDir)) {
      if (!used.has(name) && !name.endsWith('.tmp')) fs.rmSync(path.join(mediaDir, name), { force: true });
    }
  }

  async function syncOnce() {
    let changed = false;
    try {
      for (const file of FILES) {
        const headers = etags[file] && fs.existsSync(path.join(cacheDir, file)) ? { 'If-None-Match': etags[file] } : {};
        const res = await fetch(`${base}/${file}`, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (res.status === 304) continue;
        if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
        const data = await res.json();
        if (!Array.isArray(data)) throw new Error(`${file}: neplatné dáta`);
        writeAtomic(path.join(cacheDir, file), JSON.stringify(data));
        etags[file] = res.headers.get('etag') || '';
        changed = true;
      }
      if (changed) writeAtomic(metaFile, JSON.stringify(etags));
      // Funkcie zariadenia z administrácie (nepovinné – staršia administrácia ich nemá)
      const fres = await fetch(`${base}/features.json`, { signal: AbortSignal.timeout(TIMEOUT_MS) }).catch(() => null);
      if (fres?.ok) {
        const obj = await fres.json().catch(() => null);
        if (obj && typeof obj === 'object' && !Array.isArray(obj) && JSON.stringify(obj) !== JSON.stringify(readFeatures())) {
          writeAtomic(path.join(cacheDir, 'features.json'), JSON.stringify(obj));
          changed = true;
        }
      }
      await syncMedia();
      status.lastSync = Date.now();
      status.lastError = null;
    } catch (e) {
      status.lastError = e.message;
      console.warn('[kostol] Synchronizácia s administráciou zlyhala:', e.message);
    }
    if (changed) onChange?.();
    return changed;
  }

  // Zoznam z kópie na disku; pre prehliadač s odkazmi na súbory na tomto serveri
  function readList(file, forClient = true) {
    try {
      const list = JSON.parse(fs.readFileSync(path.join(cacheDir, file), 'utf8'));
      if (!forClient) return list;
      return list.map((item) => ({ ...item, ...(item.imageUrl ? { imageUrl: localMediaUrl(item.imageUrl) } : {}), ...(item.pdfUrl ? { pdfUrl: localMediaUrl(item.pdfUrl) } : {}) }));
    } catch {
      return forClient ? null : [];
    }
  }

  function readFeatures() {
    try {
      return JSON.parse(fs.readFileSync(path.join(cacheDir, 'features.json'), 'utf8'));
    } catch {
      return null;
    }
  }

  let running = false;
  async function tick() {
    if (running) return;
    running = true;
    try {
      await syncOnce();
    } finally {
      running = false;
    }
  }

  const ready = tick();
  setInterval(tick, intervalMs).unref();

  return {
    ready,
    syncNow: tick,
    status,
    readList,
    readFeatures,
    // Súbor obrázka/PDF; keď chýba, skúsi ho stiahnuť
    async mediaFile(name) {
      if (name !== path.basename(name)) return null;
      const file = path.join(mediaDir, name);
      if (!fs.existsSync(file)) {
        try {
          await downloadMedia(name);
        } catch {
          return null;
        }
      }
      return file;
    },
    // Adresa administrácie (pre odkaz v ovládaní)
    adminUrl: (() => {
      try {
        return `${new URL(base).origin}/#admin`;
      } catch {
        return null;
      }
    })(),
  };
}
