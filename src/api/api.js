// Knižnica piesní, obrázkov a PDF + žalmy. Ukladanie ide cez server (GitHub token je iba tam).
import { SERVER_URL, SONGS_URL, IMAGES_URL } from '../config';
import { stateClient, writeHeaders, markAuthRequired } from './stateClient';
import { log } from '../lib/log';

// --- Žalmy --------------------------------------------------------------

// Všetky Texty/Žalmy YYYY.json, ktoré existujú v čase buildu (chýbajúci rok build nezhodí)
const bundledPsalms = import.meta.glob('../../Texty/*.json', { eager: true, import: 'default' });

function buildPsalmMap(dataset) {
  const map = new Map();
  for (const item of Array.isArray(dataset?.content) ? dataset.content : []) {
    const refrain = Array.isArray(item?.strophes) ? item.strophes[0] : null;
    if (item?.number && typeof refrain === 'string' && refrain.trim()) {
      map.set(item.number, refrain.trim());
    }
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
    const res = await fetch(`${SERVER_URL}/api/psalms/${year}`, { signal: AbortSignal.timeout(4000) });
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

async function buildPsalmSong(dateStr) {
  const isoDate = typeof dateStr === 'string' && dateStr.trim() ? dateStr.trim() : toLocalISODate();
  const year = isoDate.slice(0, 4);
  await ensurePsalmYear(year);
  const refrain = normalizePsalmRefrain(psalmMaps.get(year)?.get(isoDate));
  return {
    id: `psalm-${isoDate}`,
    title: `Responzóriový žalm – ${formatDate(isoDate)}`,
    category: 'Žalmy',
    lyrics: refrain || `Žalm pre dátum ${isoDate} sa nenašiel.`,
    hideTitle: true,
  };
}

// --- Knižnica -----------------------------------------------------------

let songs = [];
let images = [];
let extraCategories = [];
let loadInfo = { loaded: false, source: null, error: null };
let snapshot = null;
const listeners = new Set();

function categoryName(id) {
  return id.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildSnapshot() {
  const ids = Array.from(new Set([...songs.map((s) => s.category).filter(Boolean), ...extraCategories]));
  snapshot = {
    songs,
    images,
    presentations: songs.filter((s) => s.type === 'pdf'),
    categories: ids.map((id) => ({ id, name: categoryName(id) })),
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
  const res = await fetch(url, { signal: AbortSignal.timeout(timeout), cache: 'no-store' });
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
async function loadList(file, remoteUrl) {
  const sources = [
    ['GitHub', () => fetchFromGithub(remoteUrl)],
    ['server', () => fetchJson(`${SERVER_URL}/api/data/${file}`, 4000)],
  ];
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

let loadingPromise = null;

export function loadLibrary({ force = false } = {}) {
  if (loadingPromise && !force) return loadingPromise;
  loadingPromise = (async () => {
    const [songsResult, imagesResult] = await Promise.all([
      loadList('songs.json', songsUrl()),
      loadList('images.json', IMAGES_URL),
    ]);
    songs = songsResult.data;
    images = imagesResult.data;
    loadInfo = {
      loaded: true,
      source: songsResult.source,
      error: songsResult.source ? null : 'Piesne sa nepodarilo načítať zo žiadneho zdroja',
    };
    notify();
    return snapshot;
  })();
  return loadingPromise;
}

async function saveFile(file, content, message) {
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

  async addImage({ title, imageUrl }) {
    images = [...images, { id: newId('img'), title, imageUrl }];
    notify();
    return saveFile('images.json', images, `Pridaný obrázok: ${title}`);
  },

  async deleteImage(id) {
    const img = images.find((i) => i.id === id);
    images = images.filter((i) => i.id !== id);
    notify();
    return saveFile('images.json', images, `Vymazaný obrázok: ${img?.title || id}`);
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
        const item = (await fetchJson(`${SERVER_URL}/api/data/${file}`, 4000)).find((x) => x.id === id);
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
    const iso = id.slice('psalm-'.length);
    return {
      id,
      kind: 'psalm',
      title: `Responzóriový žalm – ${formatDate(iso)}`,
      subtitle: normalizePsalmRefrain(psalmMaps.get(iso.slice(0, 4))?.get(iso)) || '',
    };
  }
  const song = songs.find((s) => s.id === id);
  if (song) return { id, kind: song.type === 'pdf' ? 'pdf' : 'song', title: song.title, number: song.number, category: song.category };
  const image = images.find((i) => i.id === id);
  if (image) return { id, kind: 'image', title: image.title, imageUrl: image.imageUrl };
  return { id, kind: 'missing', title: 'Neznáma položka' };
}

export function psalmId(date) {
  return `psalm-${date || toLocalISODate()}`;
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
