// Knižnica piesní, obrázkov a PDF + žalmy. Ukladanie ide cez server (GitHub token je iba tam).
import { timeoutSignal } from '../lib/net';
import { SERVER_URL, SONGS_URL, IMAGES_URL, resolveServerUrl } from '../config';
import { stateClient, writeHeaders, markAuthRequired } from './stateClient';
import { log } from '../lib/log';
import { CATEGORY_NAMES, categoryOrder } from '../../server/jksCategories.js';

// --- Žalmy --------------------------------------------------------------

// Všetky Texty/Žalmy YYYY.json, ktoré existujú v čase buildu (chýbajúci rok build nezhodí)
const bundledPsalms = import.meta.glob('../../Texty/Žalmy *.json', { eager: true, import: 'default' });

// Refrén zo starších dát končí na "alebo" (druhá možnosť sa nestiahla) – to slovo nezobrazujeme
const stripAlebo = (text) => text.replace(/\s+alebo\s*$/i, '').trim();

// dátum -> [{ label, refrain }]; viac možností má napr. Vianoce (v noci, na úsvite, počas dňa)
function buildPsalmMap(dataset) {
  const map = new Map();
  for (const item of Array.isArray(dataset?.content) ? dataset.content : []) {
    if (!item?.number) continue;
    const options = (Array.isArray(item.options) && item.options.length ? item.options : [{ label: '', refrain: Array.isArray(item.strophes) ? item.strophes[0] : '' }])
      .map((o) => ({ label: typeof o?.label === 'string' ? o.label : '', refrain: normalizePsalmRefrain(typeof o?.refrain === 'string' ? stripAlebo(o.refrain) : '') }))
      .filter((o) => o.refrain);
    if (options.length) map.set(item.number, options);
  }
  return map;
}

const psalmMaps = new Map();
for (const [file, data] of Object.entries(bundledPsalms)) {
  const year = file.match(/(\d{4})\.json$/)?.[1];
  if (year) psalmMaps.set(year, buildPsalmMap(data));
}

async function ensurePsalmYear(year) {
  if (!/^\d{4}$/.test(year) || psalmMaps.has(year)) return;
  try {
    const res = await fetch(`${SERVER_URL}/api/psalms/${year}`, { signal: timeoutSignal(8000) });
    if (!res.ok) return;
    const map = buildPsalmMap(await res.json());
    if (map.size) psalmMaps.set(year, map);
  } catch {
    // server nie je dostupný
  }
}

function normalizePsalmRefrain(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 500) return null;
  // Ochrana: ak by scraper uložil celú HTML stránku, nezobrazuj ju
  const lower = trimmed.toLowerCase();
  if (lower.includes('<html') || lower.includes('<!doctype') || (trimmed.includes('<') && trimmed.includes('>') && trimmed.length > 80)) {
    return null;
  }
  return trimmed;
}

function toLocalISODate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// "psalm-2026-12-25" = prvý refrén dňa, "psalm-2026-12-25~2" = tretí
function parsePsalmKey(key) {
  const [date, option] = String(key || '').split('~');
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : toLocalISODate();
  return { iso, option: Math.max(0, parseInt(option, 10) || 0) };
}

const psalmOptionsSync = (iso) => psalmMaps.get(iso.slice(0, 4))?.get(iso) || [];

// Všetky refrény na daný dátum (pri rokoch mimo aplikácie ich stiahne zo servera)
export async function getPsalmOptions(iso) {
  await ensurePsalmYear(iso.slice(0, 4));
  return psalmOptionsSync(iso);
}

export { psalmOptionsSync };

function psalmTitle(iso, label) {
  return `Responzóriový žalm – ${formatDate(iso)}${label ? ` (${label})` : ''}`;
}

async function buildPsalmSong(key) {
  const { iso, option } = parsePsalmKey(key);
  const options = await getPsalmOptions(iso);
  const chosen = options[option] || options[0];
  return {
    id: `psalm-${iso}${option ? `~${option}` : ''}`,
    title: psalmTitle(iso, options.length > 1 ? chosen?.label : ''),
    category: 'Žalmy',
    lyrics: chosen?.refrain || `Žalm pre dátum ${iso} sa nenašiel.`,
    hideTitle: true,
  };
}

// --- Knižnica -----------------------------------------------------------

let songs = [];
let images = [];
let extraCategories = [];
let managedCategories = null; // názvy kategórií z administrácie (s diakritikou)
let fileCategories = []; // kategórie z podpriečinkov texty/ na NAS (iba názvy)
let loadInfo = { loaded: false, source: null, error: null, managed: false, adminUrl: null, nas: false };
let snapshot = null;
const listeners = new Set();

// Názov kategórie: oddiely JKS majú pekné názvy, vlastné kategórie sa odvodia z id
function categoryName(id) {
  return CATEGORY_NAMES[id] || id.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildSnapshot() {
  // Kategórie z administrácie v jej poradí, inak v poradí spevníka JKS (vlastné na konci)
  const fromSongs = Array.from(new Set(songs.map((s) => s.category).filter(Boolean))).sort((a, b) => categoryOrder(a) - categoryOrder(b));
  // Poradie z administrácie alebo z categories.json na NAS (napr. 1. JKS, 2. Žalmy …), potom ostatné
  const ordered = managedCategories || fileCategories || [];
  const ids = Array.from(new Set([...ordered.map((c) => c.id), ...fromSongs, ...extraCategories]))
    // prázdne kategórie zo zoznamu nezobrazuj (iba z administrácie, kde sa dajú spravovať)
    .filter((id) => managedCategories || fromSongs.includes(id) || extraCategories.includes(id));
  const names = new Map([...fileCategories, ...(managedCategories || [])].map((c) => [c.id, c.name]));
  snapshot = {
    songs,
    images,
    presentations: songs.filter((s) => s.type === 'pdf'),
    categories: ids.map((id) => ({ id, name: names.get(id) || categoryName(id) })),
    ...loadInfo,
  };
}
buildSnapshot();

function notify() {
  buildSnapshot();
  listeners.forEach((cb) => cb());
}

function cacheKey(file) {
  return `tvdisplay-cache-${file}`;
}

function writeCache(file, data) {
  try {
    localStorage.setItem(cacheKey(file), JSON.stringify(data));
  } catch {
    // images.json môže byť pre localStorage príliš veľký – nevadí
  }
}

function readCache(file) {
  try {
    const raw = localStorage.getItem(cacheKey(file));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function fetchJson(url, timeout = 8000) {
  const res = await fetch(url, { signal: timeoutSignal(timeout), cache: 'no-store' });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

// GitHub raw má 5-minútovú cache, Contents API vráti vždy aktuálny obsah
async function fetchFromGithub(rawUrl) {
  const match = rawUrl.split('?')[0].match(/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)/);
  if (!match) return fetchJson(rawUrl);
  const [, owner, repo, branch, path] = match;
  try {
    const meta = await fetchJson(`https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}&_=${Date.now()}`);
    if (meta.content) {
      const bytes = Uint8Array.from(atob(meta.content.replace(/\n/g, '')), (c) => c.charCodeAt(0));
      return JSON.parse(new TextDecoder().decode(bytes));
    }
    if (meta.download_url) return fetchJson(meta.download_url);
  } catch (e) {
    log('[library] Contents API zlyhalo, skúšam raw URL', e);
  }
  return fetchJson(rawUrl);
}

// Poradie: GitHub → lokálna kópia na serveri → posledná úspešná verzia v prehliadači
// Obrazovka na TV berie dáta vždy najprv zo zariadenia v kostole: je v tej istej sieti a má aktuálnu kópiu
const isDisplay = () => (typeof window !== 'undefined' && /^#\/?display/.test(window.location.hash || ''));

async function loadList(file, remoteUrl, preferServer = false) {
  const github = ['GitHub', () => fetchFromGithub(remoteUrl)];
  // Dlhší limit: songs.json má stovky kB a prehliadač v TV ho spracúva pomaly
  const server = ['server', () => fetchJson(`${SERVER_URL}/api/data/${file}`, 30000)];
  if (isDisplay()) preferServer = true;
  const sources = preferServer ? [server, github] : [github, server];
  for (const [name, load] of sources) {
    try {
      const data = await load();
      if (Array.isArray(data)) {
        writeCache(file, data);
        return { data, source: name };
      }
    } catch (e) {
      log(`[library] ${file} z ${name} zlyhalo:`, e.message);
    }
  }
  const cached = readCache(file);
  if (Array.isArray(cached)) return { data: cached, source: 'cache' };
  return { data: [], source: null };
}

function songsUrl() {
  try {
    return localStorage.getItem('tvdisplay-github-raw') || SONGS_URL;
  } catch {
    return SONGS_URL;
  }
}

// Je tento server napojený na administráciu kostola? Keď server neodpovedá, platí posledná známa odpoveď,
// aby sa pri výpadku nezačali zobrazovať piesne z GitHubu namiesto piesní kostola.
const MODE_KEY = 'tvdisplay-library-mode';

async function libraryMode() {
  try {
    const res = await fetch(`${SERVER_URL}/health`, { signal: timeoutSignal(4000), cache: 'no-store' });
    if (res.ok) {
      const library = (await res.json()).library || {};
      // nas: piesne, obrázky a prezentácie sú na NAS – upravujú sa tu, ukladajú sa cez server na NAS
      const mode = { managed: Boolean(library.managed), adminUrl: library.adminUrl || null, nas: library.storage === 'nas' };
      try {
        localStorage.setItem(MODE_KEY, JSON.stringify(mode));
      } catch {
        // ignoruj
      }
      return mode;
    }
  } catch {
    // server nedostupný
  }
  try {
    return { managed: false, adminUrl: null, nas: false, ...JSON.parse(localStorage.getItem(MODE_KEY) || '{}') };
  } catch {
    return { managed: false, adminUrl: null, nas: false };
  }
}

// Dáta z administrácie alebo z NAS: iba zo servera (ten má kópiu), inak posledná verzia v prehliadači
async function loadManagedList(file, source = 'administrácia') {
  try {
    const data = await fetchJson(`${SERVER_URL}/api/data/${file}`, 30000);
    if (Array.isArray(data)) {
      writeCache(`church-${file}`, data);
      return { data, source };
    }
  } catch (e) {
    log(`[library] ${file} zo servera zlyhalo:`, e.message);
  }
  const cached = readCache(`church-${file}`);
  if (Array.isArray(cached)) return { data: cached, source: 'cache' };
  return { data: [], source: null };
}

// Relatívne odkazy (/church-media/..., /nas-media/..., /uploads/...) patria serveru
const withServerUrls = (list) => list.map((item) => (typeof item.imageUrl === 'string' ? { ...item, imageUrl: resolveServerUrl(item.imageUrl) } : item));
// Pri ukladaní späť na relatívne odkazy, aby fungovali z každého zariadenia
const withoutServerUrls = (list) => list.map((item) => (typeof item.imageUrl === 'string' && item.imageUrl.startsWith(`${SERVER_URL}/`)
  ? { ...item, imageUrl: item.imageUrl.slice(SERVER_URL.length) }
  : item));

// Názov súboru na NAS z odkazu ".../nas-media/x.jpg"
function nasMediaName(url) {
  const i = typeof url === 'string' ? url.indexOf('/nas-media/') : -1;
  return i >= 0 ? url.slice(i + '/nas-media/'.length) : null;
}

async function deleteNasMedia(url) {
  const name = nasMediaName(url);
  if (!name) return;
  try {
    await fetch(`${SERVER_URL}/api/media/${encodeURIComponent(name)}`, { method: 'DELETE', headers: writeHeaders() });
  } catch {
    // súbor ostane na NAS, v zozname už nie je
  }
}

let loadingPromise = null;
let retryLoadTimer = null;

export function loadLibrary({ force = false, preferServer = false } = {}) {
  if (loadingPromise && !force) return loadingPromise;
  loadingPromise = (async () => {
    const mode = await libraryMode();
    let songsResult;
    let imagesResult;
    if (mode.managed) {
      let categoriesResult;
      [songsResult, imagesResult, categoriesResult] = await Promise.all(['songs.json', 'images.json', 'categories.json'].map((f) => loadManagedList(f)));
      managedCategories = categoriesResult.data;
    } else if (mode.nas) {
      let categoriesResult;
      [songsResult, imagesResult, categoriesResult] = await Promise.all(['songs.json', 'images.json', 'categories.json'].map((f) => loadManagedList(f, 'NAS')));
      managedCategories = null;
      fileCategories = categoriesResult.data;
    } else {
      [songsResult, imagesResult] = await Promise.all([
        loadList('songs.json', songsUrl(), preferServer),
        loadList('images.json', IMAGES_URL, preferServer),
      ]);
      managedCategories = null;
    }
    songs = withServerUrls(songsResult.data);
    images = withServerUrls(imagesResult.data);
    loadInfo = {
      loaded: true,
      source: songsResult.source,
      error: songsResult.source ? null : 'Piesne sa nepodarilo načítať zo žiadneho zdroja',
      managed: mode.managed,
      adminUrl: mode.adminUrl,
      nas: mode.nas,
    };
    notify();
    // Nepodarilo sa nič načítať (server sa ešte spúšťa, výpadok Wi-Fi): skús znova o chvíľu
    if (!songsResult.source) {
      clearTimeout(retryLoadTimer);
      retryLoadTimer = setTimeout(() => loadLibrary({ force: true }), 15000);
    }
    return snapshot;
  })();
  return loadingPromise;
}

async function saveFile(file, list, message) {
  const content = withoutServerUrls(list);
  writeCache(file, content);
  try {
    const res = await fetch(`${SERVER_URL}/api/github/${file}`, {
      method: 'PUT',
      headers: writeHeaders(),
      body: JSON.stringify({ content, message }),
    });
    if (res.status === 401) {
      markAuthRequired();
      return { ok: false, error: 'Je potrebný PIN' };
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, savedLocally: Boolean(body.savedLocally), error: body.error || `Chyba ${res.status}` };
    return { ok: true };
  } catch {
    return { ok: false, error: 'Server nie je dostupný – zmena platí len v tomto prehliadači' };
  }
}

const missingIds = new Map();

// Server oznámil zmenu knižnice (iné zariadenie pridalo/upravilo/zmazalo) – jeho kópia je najnovšia
window.addEventListener('tvdisplay:library', () => {
  if (loadInfo.loaded) loadLibrary({ force: true, preferServer: true });
});

function newId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export const library = {
  subscribe(cb) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  getSnapshot: () => snapshot,

  addCategory(name) {
    const id = name.trim().toLowerCase().replace(/\s+/g, '-');
    if (id && !extraCategories.includes(id)) extraCategories = [...extraCategories, id];
    notify();
    return id;
  },

  async addText({ title, lyrics, category }) {
    songs = [...songs, { id: newId('custom'), title, category, lyrics }];
    notify();
    return saveFile('songs.json', songs, `Pridaný text: ${title}`);
  },

  // imageUrl je data URL; pri NAS sa obrázok uloží ako súbor a v zozname je iba odkaz naň
  async addImage({ title, imageUrl }) {
    if (loadInfo.nas) {
      try {
        const res = await fetch(`${SERVER_URL}/api/media`, {
          method: 'POST',
          headers: writeHeaders(),
          body: JSON.stringify({ dataUrl: imageUrl, name: title }),
        });
        if (res.status === 401) {
          markAuthRequired();
          return { ok: false, error: 'Je potrebný PIN' };
        }
        const body = await res.json().catch(() => ({}));
        if (!res.ok) return { ok: false, error: body.error || `Chyba ${res.status}` };
        imageUrl = resolveServerUrl(body.url);
      } catch {
        return { ok: false, error: 'Server nie je dostupný – obrázok sa nedá nahrať' };
      }
    }
    images = [...images, { id: newId('img'), title, imageUrl }];
    notify();
    return saveFile('images.json', images, `Pridaný obrázok: ${title}`);
  },

  async deleteImage(id) {
    const img = images.find((i) => i.id === id);
    images = images.filter((i) => i.id !== id);
    notify();
    await deleteNasMedia(img?.imageUrl);
    return saveFile('images.json', images, `Vymazaný obrázok: ${img?.title || id}`);
  },

  async updateSong(id, fields) {
    const clean = { ...fields };
    for (const key of Object.keys(clean)) {
      if (typeof clean[key] === 'string') clean[key] = clean[key].trim();
    }
    let updated = null;
    songs = songs.map((s) => {
      if (s.id !== id) return s;
      updated = { ...s, ...clean };
      if (!updated.number) delete updated.number;
      return updated;
    });
    if (!updated) return { ok: false, error: 'Pieseň sa nenašla' };
    notify();
    return saveFile('songs.json', songs, `Upravené: ${updated.title}`);
  },

  // Zmaže pieseň alebo prezentáciu zo songs.json; pri prezentácii aj súbor na serveri
  async deleteSong(id) {
    const song = songs.find((s) => s.id === id);
    if (!song) return { ok: false, error: 'Položka sa nenašla' };
    songs = songs.filter((s) => s.id !== id);
    notify();
    await deleteNasMedia(song.pdfUrl);
    if (typeof song.pdfUrl === 'string' && song.pdfUrl.startsWith('/uploads/')) {
      try {
        await fetch(`${SERVER_URL}/api/uploads/${encodeURIComponent(song.pdfUrl.slice('/uploads/'.length))}`, {
          method: 'DELETE',
          headers: writeHeaders(),
        });
      } catch {
        // súbor ostane na serveri, v zozname už nie je
      }
    }
    return saveFile('songs.json', songs, `Vymazané: ${song.title}`);
  },

  // Prezentácia (PDF, PPT, PPTX, ODP) sa nahrá na server; PowerPoint server prevedie na PDF
  // a zistí počet strán. V songs.json je iba odkaz, nie celý súbor.
  async addPresentation({ title, file }) {
    let uploaded;
    try {
      const res = await fetch(`${SERVER_URL}/api/uploads`, {
        method: 'POST',
        headers: { ...writeHeaders(), 'Content-Type': file.type || 'application/octet-stream', 'X-Filename': encodeURIComponent(file.name) },
        body: file,
      });
      if (res.status === 401) {
        markAuthRequired();
        return { ok: false, error: 'Je potrebný PIN' };
      }
      uploaded = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: uploaded.error || 'Nahranie prezentácie zlyhalo' };
    } catch {
      return { ok: false, error: 'Server nie je dostupný – prezentácia sa nedá nahrať' };
    }
    const item = { id: newId('pdf'), title, type: 'pdf', pdfUrl: uploaded.url, pageCount: uploaded.pageCount || 1 };
    songs = [...songs, item];
    notify();
    const saved = await saveFile('songs.json', songs, `Pridaná prezentácia: ${title}`);
    return { ...saved, item };
  },

  async getSong(id) {
    if (!id) return null;
    if (id.startsWith('psalm-')) return buildPsalmSong(id.slice('psalm-'.length));
    await loadLibrary();
    const find = () => songs.find((s) => s.id === id) || images.find((i) => i.id === id) || null;
    if (find()) return find();
    // Rovnaké chýbajúce id skúšame znova najskôr po 30 s (inak by obnovovanie knižnice cyklilo)
    if (Date.now() - (missingIds.get(id) || 0) < 30000) return null;
    missingIds.set(id, Date.now());
    // Položka pridaná na inom zariadení: načítaj knižnicu znova, prípadne z kópie na serveri
    // (GitHub mohol uloženie odmietnuť alebo ešte nemá najnovšiu verziu)
    await loadLibrary({ force: true });
    if (find()) return find();
    for (const [file, list] of [['songs.json', 'songs'], ['images.json', 'images']]) {
      try {
        const found = (await fetchJson(`${SERVER_URL}/api/data/${file}`, 30000)).find((x) => x.id === id);
        const item = found && withServerUrls([found])[0];
        if (item) {
          if (list === 'songs') songs = [...songs, item];
          else images = [...images, item];
          notify();
          return item;
        }
      } catch {
        // server nedostupný
      }
    }
    return null;
  },

  loadPsalm: (date) => buildPsalmSong(date),
};

function formatDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d}. ${m}. ${y}`;
}

// Synchrónny popis položky poradia (pre zoznam na omšu) – bez sťahovania
export function describeItem(id) {
  if (typeof id === 'string' && id.startsWith('psalm-')) {
    const { iso, option } = parsePsalmKey(id.slice('psalm-'.length));
    const options = psalmOptionsSync(iso);
    const chosen = options[option] || options[0];
    return { id, kind: 'psalm', title: psalmTitle(iso, options.length > 1 ? chosen?.label : ''), subtitle: chosen?.refrain || '' };
  }
  const song = songs.find((s) => s.id === id);
  if (song) return { id, kind: song.type === 'pdf' ? 'pdf' : 'song', title: song.title, number: song.number, category: song.category };
  const image = images.find((i) => i.id === id);
  if (image) return { id, kind: 'image', title: image.title, imageUrl: image.imageUrl };
  return { id, kind: 'missing', title: 'Neznáma položka' };
}

export function psalmId(date, option = 0) {
  return `psalm-${date || toLocalISODate()}${option ? `~${option}` : ''}`;
}

export { toLocalISODate };

// Kompatibilita so starým ovládaním (ControlPageLegacy)
export const api = {
  getAllSongs: async () => {
    await loadLibrary();
    return songs.filter((s) => s.category);
  },
  getSong: (id) => library.getSong(id),
  loadPsalm: ({ date } = {}) => buildPsalmSong(date),
  getState: async () => stateClient.getState(),
  setState: (partial) => stateClient.patch(partial),
};
