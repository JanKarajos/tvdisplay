// Piesne, obrázky a prezentácie na NAS (Synology WebDAV Server) namiesto GitHubu.
// Zapne sa premennou NAS_URL, napr. https://mojnas.synology.me:5006/tvdisplay/kostol-sv-martina
//
// V priečinku na NAS sú:  songs.json, images.json a media/ (obrázky a PDF prezentácie) – tie spravuje aplikácia.
// Okrem toho sa načítajú súbory, ktoré do priečinka vloží človek (napr. cez File Station):
//   texty/*.txt alebo texty/<kategória>/*.txt  – piesne a texty ("143 Názov.txt" = pieseň č. 143)
//   obrazky/*.jpg|png|webp|gif                 – obrázky
//   prezentacie/*.pdf (aj PowerPoint, ak je na zariadení LibreOffice) – prezentácie
// Tieto položky sú iba na čítanie (menia sa na NAS) a majú fromFile: true.
// Server na Orange Pi si drží ich kópiu (nas-cache/), takže displej aj ovládanie fungujú, aj keď NAS
// alebo internet nie je dostupný. Zmeny urobené bez spojenia sa na NAS nahrajú, keď sa spojenie obnoví.
// Každú minútu kontroluje zmeny na NAS (napr. z iného Orange Pi v tom istom kostole).
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';
import crypto from 'node:crypto';
import { jksCategory } from './jksCategories.js';

export const NAS_MEDIA_PREFIX = '/nas-media/';
const LIST_FILES = ['songs.json', 'images.json'];
const IMAGE_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
const FOLDERS = { texts: 'texty/', images: 'obrazky/', presentations: 'prezentacie/' };
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const PRESENTATION_EXT = new Set(['.pdf', '.ppt', '.pptx', '.pps', '.ppsx', '.odp']);
const OWN_CATEGORY = { id: 'vlastne', name: 'Vlastné' };

const shortHash = (text) => crypto.createHash('sha1').update(text).digest('hex').slice(0, 12);

function slug(text) {
  return String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'kategoria';
}

// Odpoveď WebDAV PROPFIND (XML) -> [{ href, isDir, version }]; bez XML knižnice, menné priestory sa ignorujú
function parsePropfind(xml) {
  const tag = (block, name) => block.match(new RegExp(`<(?:[\\w-]+:)?${name}[^>]*>([^<]*)</(?:[\\w-]+:)?${name}>`, 'i'))?.[1] ?? '';
  return xml.split(/<(?:[\w-]+:)?response[\s>]/i).slice(1).map((block) => ({
    href: tag(block, 'href').trim(),
    isDir: /<(?:[\w-]+:)?collection\s*\/?>/i.test(block),
    version: tag(block, 'getetag') || `${tag(block, 'getlastmodified')}|${tag(block, 'getcontentlength')}`,
  }));
}

// "143 Kristus, príklad pokory.txt" (aj "143. …", "143 - …") -> { number: '143', title: 'Kristus, príklad pokory' }
function parseTextName(fileName) {
  const stem = fileName.replace(/\.[^.]+$/, '').trim();
  const match = /^(\d{1,3})(?:\.\s*|\s+-\s+|\s+)(.+)$/.exec(stem);
  return match ? { number: match[1], title: match[2].trim() } : { title: stem };
}

// Názov súboru v media/ z odkazu "/nas-media/x.jpg"; null pre iné odkazy
export function nasMediaName(url) {
  if (typeof url !== 'string' || !url.startsWith(NAS_MEDIA_PREFIX)) return null;
  const name = url.slice(NAS_MEDIA_PREFIX.length);
  return name && name === path.basename(name) ? name : null;
}

export function createNasStorage({ url, username, password, ignoreCert = false, cacheDir, seed, presentations, intervalMs = 60000, onChange }) {
  const base = new URL(url.endsWith('/') ? url : `${url}/`);
  const auth = username ? `Basic ${Buffer.from(`${username}:${password || ''}`).toString('base64')}` : null;
  const mediaDir = path.join(cacheDir, 'media');
  const pendingFile = path.join(cacheDir, 'pending.json');
  fs.mkdirSync(mediaDir, { recursive: true });

  const status = { lastSync: null, lastError: null, pending: 0, fileErrors: [] };
  // Súbory vložené na NAS: { "<cesta>": { version, item } } a z nich vytvorené kategórie
  const filesIndexFile = path.join(cacheDir, 'files.json');
  let filesIndex = {};
  try {
    filesIndex = JSON.parse(fs.readFileSync(filesIndexFile, 'utf8'));
  } catch {
    // ešte nič
  }
  // Zmeny, ktoré ešte nie sú na NAS: { files: [...], media: [...], deletes: [...] }
  let pending = { files: [], media: [], deletes: [] };
  try {
    pending = { ...pending, ...JSON.parse(fs.readFileSync(pendingFile, 'utf8')) };
  } catch {
    // nič nečaká
  }

  function savePending() {
    status.pending = pending.files.length + pending.media.length + pending.deletes.length;
    writeAtomic(pendingFile, JSON.stringify(pending));
  }
  status.pending = pending.files.length + pending.media.length + pending.deletes.length;

  function writeAtomic(file, data) {
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, data);
    fs.renameSync(tmp, file);
  }

  // WebDAV požiadavka (http/https bez ďalších knižníc; pri ignoreCert prijme aj certifikát vystavený samotným NAS)
  function dav(method, rel, { body, headers = {}, timeout = 30000 } = {}) {
    const target = new URL(rel, base);
    const lib = target.protocol === 'https:' ? https : http;
    return new Promise((resolve, reject) => {
      const req = lib.request(target, {
        method,
        timeout,
        rejectUnauthorized: !ignoreCert,
        headers: {
          ...(auth ? { Authorization: auth } : {}),
          ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
          ...headers,
        },
      }, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
        res.on('error', reject);
      });
      req.on('timeout', () => req.destroy(new Error('NAS neodpovedá')));
      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    });
  }

  function expectOk(res, what) {
    if (res.status === 401 || res.status === 403) throw new Error(`NAS odmietol prístup (${res.status}) – skontroluj meno a heslo`);
    if (res.status < 200 || res.status >= 300) throw new Error(`${what}: NAS vrátil ${res.status}`);
  }

  // Priečinok (aj nadradené) na NAS; existujúci priečinok WebDAV hlási 405
  let foldersReady = false;
  async function ensureFolders() {
    if (foldersReady) return;
    const segments = base.pathname.split('/').filter(Boolean);
    for (let i = 1; i <= segments.length + 1; i++) {
      const folder = i <= segments.length ? `/${segments.slice(0, i).join('/')}/` : `${base.pathname}media/`;
      const res = await dav('MKCOL', new URL(folder, base).href);
      if (res.status === 401) expectOk(res, 'Priečinok');
    }
    foldersReady = true;
  }

  async function putFile(rel, data) {
    await ensureFolders();
    expectOk(await dav('PUT', rel, { body: data, headers: { 'Content-Type': 'application/octet-stream' } }), `Uloženie ${rel}`);
  }

  function readCache(file) {
    try {
      return JSON.parse(fs.readFileSync(path.join(cacheDir, file), 'utf8'));
    } catch {
      return null;
    }
  }

  function writeCache(file, list) {
    writeAtomic(path.join(cacheDir, file), JSON.stringify(list, null, 2));
  }

  function newMediaName(original, ext) {
    const stem = path.basename(original || 'subor', path.extname(original || ''))
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 40) || 'subor';
    return `${Date.now()}-${crypto.randomBytes(3).toString('hex')}-${stem}${ext}`;
  }

  // Prázdny priečinok na NAS: nahrajú sa doterajšie piesne a obrázky tohto Orange Pi.
  // Obrázky uložené priamo v images.json (data URL) a PDF z uploads/ sa prevedú na súbory v media/.
  function seedFromLocal() {
    const images = (seed.images() || []).map((img) => {
      const match = /^data:([a-z0-9.+/-]+);base64,(.*)$/i.exec(img.imageUrl || '');
      const ext = match && IMAGE_TYPES[match[1].toLowerCase()];
      if (!ext) return img;
      const name = newMediaName(img.title, ext);
      fs.writeFileSync(path.join(mediaDir, name), Buffer.from(match[2], 'base64'));
      pending.media.push(name);
      return { ...img, imageUrl: NAS_MEDIA_PREFIX + name };
    });
    const songs = (seed.songs() || []).map((song) => {
      const local = typeof song.pdfUrl === 'string' && song.pdfUrl.startsWith('/uploads/') && seed.upload(path.basename(song.pdfUrl));
      if (!local || !fs.existsSync(local)) return song;
      const name = newMediaName(path.basename(local), '.pdf');
      fs.copyFileSync(local, path.join(mediaDir, name));
      pending.media.push(name);
      return { ...song, pdfUrl: NAS_MEDIA_PREFIX + name };
    });
    writeCache('songs.json', songs);
    writeCache('images.json', images);
    for (const file of LIST_FILES) if (!pending.files.includes(file)) pending.files.push(file);
    savePending();
    console.log(`[nas] Priečinok na NAS je prázdny – nahrávam ${songs.length} piesní a ${images.length} obrázkov z tohto zariadenia`);
  }

  // Najprv nahrá čakajúce zmeny, potom stiahne novšie dáta z NAS
  async function syncOnce() {
    let changed = false;
    try {
      for (const name of [...pending.media]) {
        const file = path.join(mediaDir, name);
        if (fs.existsSync(file)) await putFile(`media/${encodeURIComponent(name)}`, fs.readFileSync(file));
        pending.media = pending.media.filter((n) => n !== name);
        savePending();
      }
      for (const file of [...pending.files]) {
        const list = readCache(file);
        if (list) await putFile(file, JSON.stringify(list, null, 2));
        pending.files = pending.files.filter((f) => f !== file);
        savePending();
      }
      for (const name of [...pending.deletes]) {
        const res = await dav('DELETE', `media/${encodeURIComponent(name)}`);
        if (res.status !== 404) expectOk(res, `Zmazanie ${name}`);
        pending.deletes = pending.deletes.filter((n) => n !== name);
        savePending();
      }

      for (const file of LIST_FILES) {
        // Zmenu urobenú počas tejto synchronizácie ešte nahrá ďalšia – nesmie ju prepísať stará verzia z NAS
        if (pending.files.includes(file)) continue;
        const res = await dav('GET', file);
        if (res.status === 404) {
          // Nový priečinok na NAS – naplní sa piesňami tohto zariadenia
          if (file === 'songs.json' && !pending.files.length) {
            seedFromLocal();
            return syncOnce();
          }
          continue;
        }
        expectOk(res, file);
        const text = res.body.toString('utf8');
        const list = JSON.parse(text);
        if (!Array.isArray(list)) throw new Error(`${file} na NAS nie je zoznam`);
        // Kým sa sťahovalo, mohla prísť nová zmena z tohto zariadenia – tá má prednosť
        if (pending.files.includes(file)) continue;
        if (JSON.stringify(list) !== JSON.stringify(readCache(file))) {
          writeCache(file, list);
          changed = true;
        }
      }

      if (await scanFiles()) changed = true;

      // Kópie obrázkov a PDF pre prácu bez spojenia; nepoužívané sa z kópie zmažú
      const used = new Set();
      for (const file of LIST_FILES) {
        for (const item of combinedList(file) || []) {
          for (const link of [item.imageUrl, item.pdfUrl]) {
            const name = nasMediaName(link);
            if (name) used.add(name);
          }
        }
      }
      for (const name of used) {
        if (!fs.existsSync(path.join(mediaDir, name)) && !name.startsWith('f-')) await download(name);
      }
      // Čerstvo nahratý súbor ešte nemusí byť v zozname (zoznam sa ukladá hneď po ňom)
      const recent = Date.now() - 60 * 60 * 1000;
      for (const name of fs.readdirSync(mediaDir)) {
        const file = path.join(mediaDir, name);
        if (used.has(name) || pending.media.includes(name) || name.endsWith('.tmp') || fs.statSync(file).mtimeMs > recent) continue;
        fs.rmSync(file, { force: true });
      }

      status.lastSync = Date.now();
      status.lastError = null;
    } catch (e) {
      status.lastError = e.message;
      console.warn('[nas] Synchronizácia zlyhala:', e.message);
    }
    if (changed) onChange?.();
    return changed;
  }

  // Obsah priečinka na NAS (jedna úroveň); neexistujúci priečinok = prázdny
  async function listFolder(rel) {
    const res = await dav('PROPFIND', rel, {
      body: '<?xml version="1.0" encoding="utf-8"?><propfind xmlns="DAV:"><prop><resourcetype/><getetag/><getlastmodified/><getcontentlength/></prop></propfind>',
      headers: { Depth: '1', 'Content-Type': 'application/xml; charset=utf-8' },
    });
    if (res.status === 404) return [];
    expectOk(res, `Priečinok ${rel}`);
    const folder = new URL(rel, base).pathname.replace(/\/+$/, '');
    return parsePropfind(res.body.toString('utf8'))
      .map((entry) => {
        const full = decodeURIComponent(new URL(entry.href, base).pathname).replace(/\/+$/, '');
        return { ...entry, path: full, name: path.posix.basename(full) };
      })
      .filter((entry) => entry.path !== decodeURIComponent(folder) && !entry.name.startsWith('.') && !entry.name.startsWith('@'));
  }

  async function getFile(rel) {
    const res = await dav('GET', rel, { timeout: 120000 });
    expectOk(res, rel);
    return res.body;
  }

  // Načíta súbory, ktoré človek vložil do texty/, obrazky/ a prezentacie/. Stiahne iba nové a zmenené.
  async function scanFiles() {
    const found = [];
    for (const entry of await listFolder(FOLDERS.texts)) {
      if (entry.isDir) {
        for (const inner of await listFolder(`${FOLDERS.texts}${encodeURIComponent(entry.name)}/`)) {
          if (!inner.isDir) found.push({ kind: 'text', category: entry.name, rel: `${FOLDERS.texts}${encodeURIComponent(entry.name)}/${encodeURIComponent(inner.name)}`, ...inner });
        }
      } else {
        found.push({ kind: 'text', category: null, rel: `${FOLDERS.texts}${encodeURIComponent(entry.name)}`, ...entry });
      }
    }
    for (const entry of await listFolder(FOLDERS.images)) {
      if (!entry.isDir) found.push({ kind: 'image', rel: `${FOLDERS.images}${encodeURIComponent(entry.name)}`, ...entry });
    }
    for (const entry of await listFolder(FOLDERS.presentations)) {
      if (!entry.isDir) found.push({ kind: 'presentation', rel: `${FOLDERS.presentations}${encodeURIComponent(entry.name)}`, ...entry });
    }

    const next = {};
    const errors = [];
    for (const file of found) {
      const ext = path.extname(file.name).toLowerCase();
      const key = `${file.kind}:${file.path}`;
      const previous = filesIndex[key];
      if (previous && previous.version === file.version && previous.category === file.category) {
        next[key] = previous;
        continue;
      }
      const id = `nas-${shortHash(file.path)}`;
      try {
        let item = null;
        if (file.kind === 'text' && ext === '.txt') {
          const text = (await getFile(file.rel)).toString('utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
          const { number, title } = parseTextName(file.name);
          const category = file.category ? slug(file.category) : jksCategory(number) || OWN_CATEGORY.id;
          item = { id, title, ...(number ? { number } : {}), category, lyrics: text, fromFile: true };
        } else if (file.kind === 'image' && IMAGE_EXT.has(ext)) {
          // Názov podľa verzie súboru: po zmene na NAS sa v prehliadači nezobrazí stará verzia z cache
          const name = `f-${shortHash(`${file.path}|${file.version}`)}${ext === '.jpeg' ? '.jpg' : ext}`;
          writeAtomic(path.join(mediaDir, name), await getFile(file.rel));
          item = { id, title: file.name.replace(/\.[^.]+$/, ''), imageUrl: NAS_MEDIA_PREFIX + name, fromFile: true };
        } else if (file.kind === 'presentation' && PRESENTATION_EXT.has(ext)) {
          let pdf = await getFile(file.rel);
          if (ext !== '.pdf') {
            if (!(await presentations.canConvert())) throw new Error('PowerPoint sa dá zobraziť iba s LibreOffice – ulož ho na NAS ako PDF');
            pdf = await presentations.convertToPdf(pdf, ext);
          }
          const name = `f-${shortHash(`${file.path}|${file.version}`)}.pdf`;
          writeAtomic(path.join(mediaDir, name), pdf);
          item = { id, title: file.name.replace(/\.[^.]+$/, ''), type: 'pdf', pdfUrl: NAS_MEDIA_PREFIX + name, pageCount: await presentations.countPdfPages(pdf), fromFile: true };
        }
        if (item) next[key] = { version: file.version, category: file.category, item };
      } catch (e) {
        errors.push(`${file.name}: ${e.message}`);
        if (previous) next[key] = previous; // ponechaj poslednú dobrú verziu
      }
    }
    status.fileErrors = errors;
    const changed = JSON.stringify(next) !== JSON.stringify(filesIndex);
    if (changed) {
      filesIndex = next;
      writeAtomic(filesIndexFile, JSON.stringify(filesIndex));
    }
    return changed;
  }

  // Položky zo súborov na NAS podľa druhu
  function fileItems() {
    const entries = Object.values(filesIndex).map((e) => e.item);
    return {
      songs: entries.filter((i) => i.lyrics || i.type === 'pdf'),
      images: entries.filter((i) => i.imageUrl),
    };
  }

  // Zoznam pre aplikáciu: dáta aplikácie + súbory vložené na NAS
  function combinedList(file) {
    const own = readCache(file);
    const extra = file === 'songs.json' ? fileItems().songs : fileItems().images;
    if (!own && !extra.length) return null;
    return [...(own || []), ...extra];
  }

  // Názvy kategórií z podpriečinkov texty/ (s diakritikou, ako ich človek pomenoval)
  function fileCategories() {
    const names = new Map();
    for (const entry of Object.values(filesIndex)) {
      const { item, category } = entry;
      if (!item.lyrics) continue;
      if (category) names.set(item.category, category);
      else if (item.category === OWN_CATEGORY.id) names.set(OWN_CATEGORY.id, OWN_CATEGORY.name);
    }
    return [...names].map(([id, name]) => ({ id, name }));
  }

  async function download(name) {
    const res = await dav('GET', `media/${encodeURIComponent(name)}`, { timeout: 120000 });
    expectOk(res, `Súbor ${name}`);
    writeAtomic(path.join(mediaDir, name), res.body);
  }

  // Naraz beží iba jedna synchronizácia; požiadavka počas nej spustí ešte jednu hneď po nej
  let running = null;
  let queued = null;
  function sync() {
    if (!running) {
      running = syncOnce().finally(() => { running = null; });
      return running;
    }
    if (!queued) queued = running.then(() => { queued = null; return sync(); });
    return queued;
  }

  const ready = sync();
  setInterval(sync, intervalMs).unref();

  return {
    ready,
    status,
    syncNow: sync,
    // Zoznam z kópie na disku vrátane súborov vložených na NAS (null, kým sa prvýkrát nestiahne)
    readList: (file) => (file === 'categories.json' ? fileCategories() : combinedList(file)),

    // Uloží zoznam: hneď do kópie, na NAS hneď alebo neskôr (keď nie je spojenie).
    // Položky zo súborov na NAS sa do zoznamu neukladajú – sú v priečinkoch texty/, obrazky/, prezentacie/.
    async writeList(file, list) {
      list = list.filter((item) => !item.fromFile);
      writeCache(file, list);
      if (!pending.files.includes(file)) pending.files.push(file);
      savePending();
      await sync();
      return { ok: true, queued: pending.files.includes(file) };
    },

    // Nový obrázok alebo PDF; vráti odkaz /nas-media/...
    async saveMedia(buffer, originalName, ext) {
      const name = newMediaName(originalName, ext);
      writeAtomic(path.join(mediaDir, name), buffer);
      pending.media.push(name);
      savePending();
      sync(); // na pozadí – odkaz platí hneď, súbor je v kópii
      return NAS_MEDIA_PREFIX + name;
    },

    async deleteMedia(name) {
      fs.rmSync(path.join(mediaDir, name), { force: true });
      pending.media = pending.media.filter((n) => n !== name);
      if (!pending.deletes.includes(name)) pending.deletes.push(name);
      savePending();
      sync();
    },

    // Súbor z kópie; keď chýba, skúsi ho stiahnuť z NAS
    async mediaFile(name) {
      if (!name || name !== path.basename(name)) return null;
      const file = path.join(mediaDir, name);
      if (!fs.existsSync(file)) {
        try {
          await download(name);
        } catch {
          return null;
        }
      }
      return file;
    },
  };
}
