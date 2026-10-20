// TVDisplay server: zdieľaný stav (REST + WebSocket), žalmy, ukladanie na GitHub
// a v produkcii aj servírovanie buildu frontendu (dist/).
//
// Spustenie:  node server/index.js            (iba API, pre vývoj s Vite)
//             node server/index.js --serve    (API + hotová aplikácia z dist/)
// Premenné v .env: STATE_PORT, APP_PORT, CONTROL_PIN, GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { ACCEPTED_EXTENSIONS, PRESENTATION_EXTENSIONS, convertToPdf, countPdfPages, findSoffice } from './presentations.js';

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

function broadcast() {
  const msg = JSON.stringify({ type: 'state', state, version });
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

// --- Express ------------------------------------------------------------

const app = express();
app.use(cors());
app.use(express.json({ limit: '25mb' })); // obrázky/PDF sú ako data URL

function requirePin(req, res, next) {
  if (!CONTROL_PIN) return next();
  if (req.get('x-control-pin') === CONTROL_PIN) return next();
  return res.status(401).json({ error: 'Nesprávny alebo chýbajúci PIN' });
}

app.get('/health', async (req, res) => {
  res.json({
    status: 'ok',
    clients: sockets.size,
    auth: { pinRequired: Boolean(CONTROL_PIN) },
    converter: { powerpoint: Boolean(await findSoffice()) },
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

// Lokálna kópia songs.json / images.json – záloha, keď GitHub nie je dostupný
app.get('/api/data/:file', (req, res) => {
  const { file } = req.params;
  if (!GITHUB_FILES.has(file)) return res.status(404).end();
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) return res.status(404).json({ error: 'Súbor neexistuje' });
  res.sendFile(full);
});

// Prezentácie (PDF, PowerPoint, Impress): ukladajú sa do uploads/ ako PDF,
// v songs.json je iba relatívny odkaz /uploads/... a zistený počet strán
app.use('/uploads', express.static(UPLOADS_DIR));
app.post('/api/uploads', requirePin, express.raw({ type: () => true, limit: '100mb' }), async (req, res) => {
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
app.put('/api/github/:file', requirePin, async (req, res) => {
  const { file } = req.params;
  if (!GITHUB_FILES.has(file)) return res.status(400).json({ error: 'Nepovolený súbor' });
  const { content, message } = req.body || {};
  if (!Array.isArray(content)) return res.status(400).json({ error: 'Obsah musí byť pole' });

  const text = JSON.stringify(content, null, 2);
  try {
    fs.writeFileSync(path.join(ROOT, file), text, 'utf8');
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
