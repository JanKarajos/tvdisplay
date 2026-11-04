// TVDisplay server: zdieľaný stav (REST + WebSocket), žalmy, ukladanie na GitHub
// a v produkcii aj servírovanie buildu frontendu (dist/).
//
// Spustenie:  node server/index.js            (iba API, pre vývoj s Vite)
//             node server/index.js --serve    (API + hotová aplikácia z dist/)
// Premenné v .env: STATE_PORT, APP_PORT, CONTROL_PIN, GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH
//   ADMIN_DATA_DIR   – zapne administráciu kostolov (NAS), napr. ./admin-data
//   CHURCH_DATA_URL  – Orange Pi berie piesne svojho kostola z administrácie namiesto GitHubu
//   NAS_URL, NAS_USER, NAS_PASSWORD – piesne, obrázky a prezentácie v priečinku na NAS (WebDAV) namiesto GitHubu

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { ACCEPTED_EXTENSIONS, PRESENTATION_EXTENSIONS, convertToPdf, countPdfPages, findSoffice, hasSoffice } from './presentations.js';
import { createAdmin } from './admin.js';
import { createChurchSync } from './churchSync.js';
import { createNasStorage, nasMediaName } from './nasStorage.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATE_FILE = path.join(ROOT, 'state.json');
const TEXTY_DIR = path.join(ROOT, 'Texty');
const DIST_DIR = path.join(ROOT, 'dist');
const UPLOADS_DIR = path.join(ROOT, 'uploads');

const STATE_PORT = Number(process.env.STATE_PORT) || 3002;
const APP_PORT = Number(process.env.APP_PORT) || 5173;
const SERVE_APP = process.argv.includes('--serve') || process.env.SERVE_APP === '1';
const CONTROL_PIN = (process.env.CONTROL_PIN || '').trim();

const GITHUB = {
  token: (process.env.GITHUB_TOKEN || '').trim(),
  owner: process.env.GITHUB_OWNER || 'JanKarajos',
  repo: process.env.GITHUB_REPO || 'tvdisplay',
  branch: process.env.GITHUB_BRANCH || 'main',
};
// Na GitHub smú ísť iba tieto súbory
const GITHUB_FILES = new Set(['songs.json', 'images.json']);

const ADMIN_DATA_DIR = (process.env.ADMIN_DATA_DIR || '').trim();
const CHURCH_DATA_URL = (process.env.CHURCH_DATA_URL || '').trim();
const NAS_URL = (process.env.NAS_URL || '').trim();

const DEFAULT_STATE = {
  currentSongId: null,
  background: null,
  isHidden: false,
  currentPage: 0,
  selectedSongIds: [], // poradie na omšu (piesne, žalmy psalm-RRRR-MM-DD, obrázky, PDF)
  nextSongId: null, // iba pre staré ovládanie
  lastPlaylistId: null, // posledná položka poradia, ktorá bola na TV – odtiaľ pokračuje "Ďalej"
  settings: { theme: 'auto', textOverBackground: false },
};

// --- Stav ---------------------------------------------------------------

function loadState() {
  try {
    return { ...DEFAULT_STATE, ...JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) };
  } catch {
    return { ...DEFAULT_STATE, lastUpdate: Date.now() };
  }
}

let state = loadState();
let version = 0;
let saveTimer = null;

function persistState() {
  // Zápis na disk s malým oneskorením, aby rýchle klikanie nezaťažovalo SD kartu
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2), (err) => {
      if (err) console.error('[state] Nepodarilo sa uložiť state.json:', err.message);
    });
  }, 300);
}

const ALLOWED_KEYS = new Set(Object.keys(DEFAULT_STATE));

function applyPatch(patch) {
  const clean = {};
  for (const [key, value] of Object.entries(patch || {})) {
    if (ALLOWED_KEYS.has(key)) clean[key] = value;
  }
  if ('settings' in clean) {
    const ok = clean.settings && typeof clean.settings === 'object' && !Array.isArray(clean.settings);
    if (ok) clean.settings = { ...state.settings, ...clean.settings };
    else delete clean.settings;
  }
  state = { ...state, ...clean, lastUpdate: Date.now() };
  version += 1;
  persistState();
  broadcast();
  return state;
}

// --- WebSocket ----------------------------------------------------------

const sockets = new Set();

function broadcast(message = { type: 'state', state, version }) {
  const msg = JSON.stringify(message);
  for (const ws of sockets) {
    if (ws.readyState === ws.OPEN) ws.send(msg);
  }
}

function attachWebSocket(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', (ws) => {
    sockets.add(ws);
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
    ws.on('close', () => sockets.delete(ws));
    ws.send(JSON.stringify({ type: 'state', state, version }));
  });
  // Odpojených klientov (napr. uspaný mobil) upraceme
  const interval = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) { ws.terminate(); continue; }
      ws.isAlive = false;
      ws.ping();
    }
  }, 30000);
  wss.on('close', () => clearInterval(interval));
}

// --- Kostol z administrácie (Orange Pi) ---------------------------------

const church = CHURCH_DATA_URL
  ? createChurchSync({
    dataUrl: CHURCH_DATA_URL,
    cacheDir: path.resolve(process.env.CHURCH_CACHE_DIR || path.join(ROOT, 'church-data')),
    intervalMs: (Number(process.env.CHURCH_SYNC_SECONDS) || 60) * 1000,
    // Zmena v administrácii: ovládanie aj TV si knižnicu načítajú znova
    onChange: () => broadcast({ type: 'library', file: 'songs.json' }),
  })
  : null;

// --- Piesne na NAS (WebDAV) ---------------------------------------------

function readLocalList(file) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
  } catch {
    return [];
  }
}

if (NAS_URL && church) console.warn('⚠️  Nastavené je CHURCH_DATA_URL aj NAS_URL – použije sa administrácia, NAS sa ignoruje');
const nas = NAS_URL && !church
  ? createNasStorage({
    url: NAS_URL,
    username: (process.env.NAS_USER || '').trim(),
    password: process.env.NAS_PASSWORD || '',
    ignoreCert: process.env.NAS_IGNORE_CERT === '1',
    cacheDir: path.resolve(process.env.NAS_CACHE_DIR || path.join(ROOT, 'nas-cache')),
    intervalMs: (Number(process.env.NAS_SYNC_SECONDS) || 60) * 1000,
    // Prázdny priečinok na NAS sa naplní piesňami, obrázkami a prezentáciami tohto zariadenia
    seed: {
      songs: () => readLocalList('songs.json'),
      images: () => readLocalList('images.json'),
      upload: (name) => path.join(UPLOADS_DIR, name),
    },
    // Zmena na NAS (napr. z iného zariadenia): ovládanie aj TV si knižnicu načítajú znova
    onChange: () => broadcast({ type: 'library', file: 'songs.json' }),
  })
  : null;

// --- Express ------------------------------------------------------------

const app = express();
app.use(cors());
app.use(express.json({ limit: '25mb' })); // obrázky/PDF sú ako data URL

function requirePin(req, res, next) {
  if (!CONTROL_PIN) return next();
  if (req.get('x-control-pin') === CONTROL_PIN) return next();
  return res.status(401).json({ error: 'Nesprávny alebo chýbajúci PIN' });
}

if (ADMIN_DATA_DIR) {
  const admin = createAdmin({ dataDir: path.resolve(ADMIN_DATA_DIR), seedSongsFile: path.join(ROOT, 'songs.json') });
  app.use('/api/admin', admin.api);
  app.use('/api/public', admin.pub);
  // Administrácia je dostupná z internetu – zápisy ovládania (stav TV, GitHub, nahrávanie) tu nemajú čo robiť
  app.use(['/api/state', '/api/github', '/api/uploads'], (req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD') return next();
    res.status(403).json({ error: 'Na serveri administrácie je ovládanie vypnuté' });
  });
}

// Obsah kostola spravuje administrácia – tu sa nemení
function rejectWhenManaged(req, res, next) {
  if (!church) return next();
  res.status(409).json({ error: 'Piesne, obrázky a prezentácie tohto kostola sa upravujú v administrácii' });
}

app.get('/health', (req, res) => {
  findSoffice(); // na pozadí, /health nesmie čakať
  res.json({
    status: 'ok',
    clients: sockets.size,
    auth: { pinRequired: Boolean(CONTROL_PIN) },
    converter: { powerpoint: hasSoffice() },
    admin: Boolean(ADMIN_DATA_DIR),
    library: church
      ? { managed: true, adminUrl: church.adminUrl, lastSync: church.status.lastSync, lastError: church.status.lastError }
      : nas
        ? { managed: false, storage: 'nas', lastSync: nas.status.lastSync, lastError: nas.status.lastError, pending: nas.status.pending }
        : { managed: false, storage: 'github' },
    github: {
      owner: GITHUB.owner,
      repo: GITHUB.repo,
      branch: GITHUB.branch,
      tokenConfigured: Boolean(GITHUB.token),
    },
  });
});

app.post('/api/auth/check', requirePin, (req, res) => res.json({ ok: true }));

app.get('/api/state', (req, res) => res.json(state));
app.patch('/api/state', requirePin, (req, res) => res.json(applyPatch(req.body)));
// POST ponechaný kvôli spätnej kompatibilite (test-sync.html) – správa sa ako PATCH
app.post('/api/state', requirePin, (req, res) => res.json(applyPatch(req.body)));
app.delete('/api/state', requirePin, (req, res) => {
  state = { ...DEFAULT_STATE };
  res.json(applyPatch({}));
});

app.get('/api/psalms/:year', (req, res) => {
  const { year } = req.params;
  if (!/^\d{4}$/.test(year)) return res.status(400).json({ error: 'Neplatný rok' });
  const file = path.join(TEXTY_DIR, `Žalmy ${year}.json`);
  if (!fs.existsSync(file)) return res.status(404).json({ error: `Žalmy ${year} nie sú k dispozícii` });
  res.sendFile(file);
});

// Lokálna kópia songs.json / images.json – záloha, keď GitHub nie je dostupný.
// Pri napojení na administráciu jediný zdroj (aj categories.json).
app.get('/api/data/:file', async (req, res) => {
  const { file } = req.params;
  if (church) {
    if (!['songs.json', 'images.json', 'categories.json'].includes(file)) return res.status(404).end();
    let list = church.readList(file);
    if (!list) {
      await church.ready; // prvé spustenie: počkaj na prvé stiahnutie
      list = church.readList(file);
    }
    if (!list) return res.status(503).json({ error: 'Dáta kostola zatiaľ nie sú stiahnuté z administrácie' });
    res.set('Cache-Control', 'no-store');
    return res.json(list);
  }
  if (!GITHUB_FILES.has(file)) return res.status(404).end();
  if (nas) {
    let list = nas.readList(file);
    if (!list) {
      await nas.ready; // prvé spustenie: počkaj na prvé stiahnutie z NAS
      list = nas.readList(file);
    }
    res.set('Cache-Control', 'no-store');
    // NAS ešte nikdy nebol dostupný: piesne, ktoré má zariadenie od inštalácie
    return res.json(list || readLocalList(file));
  }
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) return res.status(404).json({ error: 'Súbor neexistuje' });
  res.sendFile(full);
});

// Prezentácie (PDF, PowerPoint, Impress): ukladajú sa do uploads/ ako PDF,
// v songs.json je iba relatívny odkaz /uploads/... a zistený počet strán
app.use('/uploads', express.static(UPLOADS_DIR));

// Obrázky a PDF kostola z administrácie (kópia na disku)
app.get('/church-media/:name', async (req, res) => {
  const file = church && (await church.mediaFile(req.params.name));
  if (!file) return res.status(404).end();
  res.sendFile(file, { maxAge: '365d', immutable: true });
});

// Obrázky a prezentácie z NAS (kópia na disku)
app.get('/nas-media/:name', async (req, res) => {
  const file = nas && (await nas.mediaFile(req.params.name));
  if (!file) return res.status(404).end();
  res.sendFile(file, { maxAge: '365d', immutable: true });
});

const IMAGE_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };

// Obrázok na NAS (prehliadač ho pred nahraním zmenší); vráti odkaz /nas-media/...
app.post('/api/media', requirePin, async (req, res) => {
  if (!nas) return res.status(404).json({ error: 'NAS nie je nastavený' });
  const match = /^data:([a-z0-9.+/-]+);base64,(.*)$/i.exec(String(req.body?.dataUrl || ''));
  const ext = match && IMAGE_TYPES[match[1].toLowerCase()];
  if (!ext) return res.status(400).json({ error: 'Nepodporovaný obrázok – použi JPG, PNG, WEBP alebo GIF' });
  const url = await nas.saveMedia(Buffer.from(match[2], 'base64'), String(req.body?.name || 'obrazok'), ext);
  res.json({ url });
});

app.delete('/api/media/:name', requirePin, async (req, res) => {
  const name = nasMediaName(`/nas-media/${req.params.name}`);
  if (!nas || !name) return res.status(400).json({ error: 'Neplatný názov súboru' });
  await nas.deleteMedia(name);
  res.json({ ok: true });
});

app.post('/api/uploads', requirePin, rejectWhenManaged, express.raw({ type: () => true, limit: '100mb' }), async (req, res) => {
  if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ error: 'Prázdny súbor' });
  const original = decodeURIComponent(req.get('x-filename') || 'prezentacia.pdf');
  const ext = path.extname(original).toLowerCase();
  if (!ACCEPTED_EXTENSIONS.has(ext)) {
    return res.status(400).json({ error: `Nepodporovaný typ súboru ${ext || ''} – použi PDF, PPT, PPTX alebo ODP` });
  }
  try {
    const converted = PRESENTATION_EXTENSIONS.has(ext);
    const pdf = converted ? await convertToPdf(req.body, ext) : req.body;
    const pageCount = await countPdfPages(pdf);
    const safe = path.basename(original, path.extname(original))
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 60) || 'prezentacia';
    if (nas) return res.json({ url: await nas.saveMedia(pdf, original, '.pdf'), pageCount, converted });
    const name = `${Date.now()}-${safe}.pdf`;
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    fs.writeFileSync(path.join(UPLOADS_DIR, name), pdf);
    res.json({ url: `/uploads/${name}`, pageCount, converted });
  } catch (e) {
    console.error('[uploads] Spracovanie zlyhalo:', e.message);
    const status = e.status || 422;
    res.status(status).json({ error: status === 501 ? e.message : `Súbor sa nepodarilo spracovať: ${e.message}` });
  }
});

// Zmazanie nahratej prezentácie (iba súbory priamo v uploads/)
app.delete('/api/uploads/:name', requirePin, rejectWhenManaged, (req, res) => {
  const name = path.basename(req.params.name);
  if (name !== req.params.name || !name.endsWith('.pdf')) return res.status(400).json({ error: 'Neplatný názov súboru' });
  const full = path.join(UPLOADS_DIR, name);
  if (fs.existsSync(full)) fs.unlinkSync(full);
  res.json({ ok: true });
});

async function githubRequest(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${GITHUB.token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'tvdisplay',
      ...(options.headers || {}),
    },
  });
}

// Uloží songs.json alebo images.json na GitHub (token je iba na serveri) a zároveň lokálne
app.put('/api/github/:file', requirePin, rejectWhenManaged, async (req, res) => {
  const { file } = req.params;
  if (!GITHUB_FILES.has(file)) return res.status(400).json({ error: 'Nepovolený súbor' });
  const { content, message } = req.body || {};
  if (!Array.isArray(content)) return res.status(400).json({ error: 'Obsah musí byť pole' });

  // Piesne na NAS: uloží sa tam (pri výpadku spojenia neskôr), GitHub sa nepoužíva
  if (nas) {
    const result = await nas.writeList(file, content);
    broadcast({ type: 'library', file });
    return res.json(result);
  }

  const text = JSON.stringify(content, null, 2);
  try {
    fs.writeFileSync(path.join(ROOT, file), text, 'utf8');
    // Ostatné zariadenia si knižnicu hneď načítajú znova (napr. upravená pieseň na TV)
    broadcast({ type: 'library', file });
  } catch (e) {
    console.error(`[github] Lokálne uloženie ${file} zlyhalo:`, e.message);
  }

  if (!GITHUB.token) {
    return res.status(503).json({ error: 'Na serveri chýba GITHUB_TOKEN – uložené iba lokálne', savedLocally: true });
  }

  const apiUrl = `https://api.github.com/repos/${GITHUB.owner}/${GITHUB.repo}/contents/${file}`;
  try {
    let sha;
    const getRes = await githubRequest(`${apiUrl}?ref=${GITHUB.branch}`);
    if (getRes.ok) sha = (await getRes.json()).sha;

    const putRes = await githubRequest(apiUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: message || `Update ${file} from tvdisplay`,
        content: Buffer.from(text, 'utf8').toString('base64'),
        branch: GITHUB.branch,
        ...(sha ? { sha } : {}),
      }),
    });

    if (!putRes.ok) {
      const details = await putRes.text();
      console.error(`[github] PUT ${file} zlyhal:`, putRes.status, details);
      return res.status(502).json({ error: `GitHub vrátil ${putRes.status}`, details, savedLocally: true });
    }
    res.json({ ok: true, savedLocally: true });
  } catch (e) {
    console.error('[github] Chyba:', e.message);
    res.status(502).json({ error: e.message, savedLocally: true });
  }
});

// --- Štart --------------------------------------------------------------

const apiServer = http.createServer(app);
attachWebSocket(apiServer);
apiServer.listen(STATE_PORT, '0.0.0.0', () => {
  console.log(`📡 TVDisplay server beží na porte ${STATE_PORT} (PIN: ${CONTROL_PIN ? 'zapnutý' : 'vypnutý'}, GitHub token: ${GITHUB.token ? 'áno' : 'nie'})`);
  if (ADMIN_DATA_DIR) console.log(`🔐 Administrácia kostolov zapnutá (dáta v ${path.resolve(ADMIN_DATA_DIR)}), adresa: /#admin`);
  if (church) console.log(`⛪ Piesne kostola z administrácie: ${CHURCH_DATA_URL}`);
  if (nas) console.log(`🗄️  Piesne, obrázky a prezentácie na NAS: ${NAS_URL}`);
});

if (SERVE_APP) {
  if (!fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
    console.error('❌ Chýba dist/ – najprv spusti "npm run build"');
    process.exit(1);
  }
  const web = express();
  web.use(app); // rovnaké API aj na porte aplikácie
  web.use(express.static(DIST_DIR));
  web.get('*', (req, res) => res.sendFile(path.join(DIST_DIR, 'index.html')));
  const webServer = http.createServer(web);
  attachWebSocket(webServer);
  webServer.listen(APP_PORT, '0.0.0.0', () => {
    console.log(`🌐 Aplikácia beží na porte ${APP_PORT}  (ovládanie: /#control, displej: /#display)`);
  });
}
