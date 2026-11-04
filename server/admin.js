// Administrácia (beží na NAS): prihlasovanie, kostoly, používatelia a obsah každého kostola.
// Zapne sa premennou ADMIN_DATA_DIR. Dáta sú v tomto priečinku:
//   users.json, churches.json
//   churches/<id>/songs.json, images.json, categories.json, media/<súbory>
// S ADMIN_CHURCHES_DIR sú priečinky kostolov priamo v zdieľanom priečinku na NAS (napr. tvdisplay/),
// ktorý Orange Pi čítajú cez WebDAV (NAS_URL). Každý podpriečinok je jeden kostol.
// Orange Pi v kostoloch čítajú dáta svojho kostola z /api/public/churches/<id>/... (iba čítanie).
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ACCEPTED_EXTENSIONS, PRESENTATION_EXTENSIONS, convertToPdf, countPdfPages } from './presentations.js';
import { CATEGORY_NAMES, categoryOrder } from './jksCategories.js';

const SESSION_COOKIE = 'tvd_admin';
const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 dní
const LOGIN_MAX_FAILS = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const LIST_FILES = new Set(['songs.json', 'images.json', 'categories.json']);
const IMAGE_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// --- Pomocné funkcie -----------------------------------------------------

function readJsonFile(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

// Zápis cez dočasný súbor, aby výpadok prúdu nepoškodil pôvodný súbor
function writeJsonFile(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

function randomId(prefix) {
  return `${prefix}-${crypto.randomBytes(6).toString('hex')}`;
}

export function slugify(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function verifyPassword(password, stored) {
  const [scheme, saltHex, hashHex] = String(stored || '').split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(String(password), Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

const DUMMY_HASH = hashPassword(crypto.randomBytes(16).toString('hex'));

function parseCookies(header) {
  const cookies = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) cookies[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return cookies;
}

function str(value, field, { required = false, max = 200 } = {}) {
  if (value === undefined || value === null) value = '';
  if (typeof value !== 'string' && typeof value !== 'number') throw new HttpError(400, `Neplatná hodnota: ${field}`);
  value = String(value).trim();
  if (required && !value) throw new HttpError(400, `Chýba: ${field}`);
  if (value.length > max) throw new HttpError(400, `Príliš dlhé: ${field}`);
  return value;
}

function publicUser(user) {
  return { id: user.id, username: user.username, role: user.role, churchId: user.churchId || null };
}

// Express 4 nezachytí chyby z async funkcií sám
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// --- Administrácia -------------------------------------------------------

export function createAdmin({ dataDir, seedSongsFile, churchesDir }) {
  const usersFile = path.join(dataDir, 'users.json');
  const churchesFile = path.join(dataDir, 'churches.json');
  // Zdieľaný priečinok s Orange Pi: kostoly sú jeho podpriečinky
  const sharedFolder = Boolean(churchesDir);
  const churchesRoot = churchesDir || path.join(dataDir, 'churches');
  const churchDir = (id) => path.join(churchesRoot, id);
  const sessions = new Map(); // token -> { userId, expires }
  const loginFails = new Map(); // meno -> { count, first }

  fs.mkdirSync(dataDir, { recursive: true });

  const loadUsers = () => readJsonFile(usersFile, []);
  const saveUsers = (users) => writeJsonFile(usersFile, users);
  // Kostoly z churches.json; v zdieľanom priečinku aj podpriečinky, ktoré vytvorilo Orange Pi alebo človek
  const loadChurches = () => {
    const listed = readJsonFile(churchesFile, []);
    if (!sharedFolder) return listed;
    let folders = [];
    try {
      folders = fs.readdirSync(churchesRoot, { withFileTypes: true })
        .filter((d) => d.isDirectory() && !/^[.@#]/.test(d.name)) // skryté, @eaDir, #recycle
        .map((d) => d.name);
    } catch {
      // priečinok ešte nie je pripojený
    }
    return [
      ...listed.filter((c) => folders.includes(c.id)),
      ...folders.filter((f) => !listed.some((c) => c.id === f)).map((f) => ({ id: f, name: f })),
    ];
  };
  const saveChurches = (churches) => writeJsonFile(churchesFile, churches);
  const loadList = (id, name) => readJsonFile(path.join(churchDir(id), name), []);
  const saveList = (id, name, list) => writeJsonFile(path.join(churchDir(id), name), list);

  // Kategórie kostola; doplní tie, ktoré používajú piesne, ale v zozname chýbajú
  // (napr. piesne, ktoré priniesol Orange Pi bez categories.json)
  function loadCategories(id) {
    const categories = loadList(id, 'categories.json');
    const known = new Set(categories.map((c) => c.id));
    const missing = [...new Set(loadList(id, 'songs.json').map((s) => s.category).filter(Boolean))]
      .filter((cid) => !known.has(cid))
      .sort((a, b) => categoryOrder(a) - categoryOrder(b));
    if (!missing.length) return categories;
    const merged = [...categories, ...missing.map((cid) => ({ id: cid, name: CATEGORY_NAMES[cid] || cid }))];
    saveList(id, 'categories.json', merged);
    return merged;
  }

  // Prvý administrátor z premenných prostredia
  if (loadUsers().length === 0) {
    const password = (process.env.ADMIN_PASSWORD || '').trim();
    if (password) {
      const username = (process.env.ADMIN_USERNAME || 'admin').trim();
      saveUsers([{ id: randomId('u'), username, passwordHash: hashPassword(password), role: 'admin', churchId: null }]);
      console.log(`👤 Vytvorený administrátor "${username}"`);
    } else {
      console.warn('⚠️  Administrácia nemá žiadneho používateľa. Nastav ADMIN_PASSWORD a reštartuj server,');
      console.warn('   alebo spusti: node server/set-password.js <meno> <heslo> --admin');
    }
  }

  // Upratovanie vypršaných prihlásení
  setInterval(() => {
    const now = Date.now();
    for (const [token, s] of sessions) if (s.expires < now) sessions.delete(token);
  }, 60 * 60 * 1000).unref();

  function sessionUser(req) {
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    const session = token && sessions.get(token);
    if (!session || session.expires < Date.now()) {
      if (token) sessions.delete(token);
      return null;
    }
    const user = loadUsers().find((u) => u.id === session.userId);
    if (!user) {
      sessions.delete(token);
      return null;
    }
    session.expires = Date.now() + SESSION_TTL_MS;
    return user;
  }

  function setSessionCookie(req, res, token, maxAgeMs) {
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: req.secure || req.get('x-forwarded-proto') === 'https',
      maxAge: maxAgeMs,
      path: '/',
    });
  }

  function requireAdmin(user) {
    if (user.role !== 'admin') throw new HttpError(403, 'Na toto potrebuješ práva administrátora');
  }

  // Editor smie spravovať iba svoj kostol, administrátor všetky
  function requireChurch(user, churchId) {
    if (!loadChurches().some((c) => c.id === churchId)) throw new HttpError(404, 'Kostol neexistuje');
    if (user.role !== 'admin' && user.churchId !== churchId) throw new HttpError(403, 'Tento kostol nemôžeš spravovať');
  }

  function visibleChurches(user) {
    const churches = loadChurches();
    return user.role === 'admin' ? churches : churches.filter((c) => c.id === user.churchId);
  }

  // Doplní kostolu piesne zo spevníka JKS, ktoré ešte nemá (podľa id).
  // Piesne, ktoré kostol už má (aj upravené), sa neprepíšu. Vráti počet pridaných piesní.
  function addJksSongs(churchId) {
    const jks = readJsonFile(seedSongsFile, []).filter((s) => s.category && s.category !== 'test' && s.type !== 'pdf' && s.lyrics);
    const songs = loadList(churchId, 'songs.json');
    const categories = loadCategories(churchId);
    const have = new Set(songs.map((s) => s.id));
    const missing = jks.filter((s) => !have.has(s.id));
    // Chýbajúce kategórie v poradí spevníka (adventné, vianočné, …)
    const newIds = [...new Set(missing.map((s) => s.category))]
      .filter((cid) => !categories.some((c) => c.id === cid))
      .sort((a, b) => categoryOrder(a) - categoryOrder(b));
    for (const cid of newIds) categories.push({ id: cid, name: CATEGORY_NAMES[cid] || cid });
    saveList(churchId, 'categories.json', categories);
    saveList(churchId, 'songs.json', [...songs, ...missing]);
    return missing.length;
  }

  // Každý nový kostol dostane vlastnú kópiu spevníka JKS
  function createChurch(name) {
    const churches = loadChurches();
    const base = slugify(name) || 'kostol';
    let id = base;
    for (let i = 2; churches.some((c) => c.id === id); i++) id = `${base}-${i}`;
    fs.mkdirSync(path.join(churchDir(id), 'media'), { recursive: true });
    saveList(id, 'songs.json', []);
    saveList(id, 'categories.json', []);
    saveList(id, 'images.json', []);
    addJksSongs(id);
    const church = { id, name };
    saveChurches([...churches, church]);
    return church;
  }

  function saveMedia(churchId, buffer, ext) {
    const name = `${crypto.randomBytes(8).toString('hex')}${ext}`;
    const dir = path.join(churchDir(churchId), 'media');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, name), buffer);
    return `media/${name}`;
  }

  // Odkazy "media/x" (administrácia) aj "/nas-media/x" (Orange Pi) vedú do priečinka media/ kostola
  function deleteMedia(churchId, relUrl) {
    if (typeof relUrl !== 'string' || !(relUrl.startsWith('media/') || relUrl.startsWith('/nas-media/'))) return;
    const name = path.basename(relUrl);
    fs.rm(path.join(churchDir(churchId), 'media', name), { force: true }, () => {});
  }

  function validateSong(body, categories) {
    const song = {
      title: str(body?.title, 'názov', { required: true }),
      number: str(body?.number, 'číslo', { max: 20 }),
      category: str(body?.category, 'kategória', { required: true, max: 60 }),
      lyrics: str(body?.lyrics, 'text', { required: true, max: 50000 }).replace(/\r\n/g, '\n'),
    };
    if (!categories.some((c) => c.id === song.category)) throw new HttpError(400, 'Neznáma kategória');
    if (!song.number) delete song.number;
    return song;
  }

  // --- /api/admin --------------------------------------------------------

  const api = express.Router();

  // Zmeny iba s vlastnou hlavičkou: cudzia stránka ju bez povolenia CORS nepošle (ochrana proti CSRF)
  api.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.get('x-tvdisplay-admin') !== '1') {
      return next(new HttpError(403, 'Chýba hlavička X-Tvdisplay-Admin'));
    }
    next();
  });

  api.post('/login', (req, res) => {
    const username = str(req.body?.username, 'meno', { required: true, max: 60 });
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const key = username.toLowerCase();
    const fails = loginFails.get(key);
    const recent = fails && Date.now() - fails.first < LOGIN_WINDOW_MS;
    if (recent && fails.count >= LOGIN_MAX_FAILS) {
      throw new HttpError(429, 'Príliš veľa neúspešných pokusov. Skús to znova o 15 minút.');
    }
    const user = loadUsers().find((u) => u.username.toLowerCase() === key);
    // Heslo overujeme aj pri neexistujúcom mene, aby sa podľa času odpovede nedalo zistiť, ktoré mená existujú
    if (!verifyPassword(password, user ? user.passwordHash : DUMMY_HASH) || !user) {
      const entry = recent ? fails : { count: 0, first: Date.now() };
      entry.count += 1;
      loginFails.set(key, entry);
      throw new HttpError(401, 'Nesprávne meno alebo heslo');
    }
    loginFails.delete(key);
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, { userId: user.id, expires: Date.now() + SESSION_TTL_MS });
    setSessionCookie(req, res, token, SESSION_TTL_MS);
    res.json({ user: publicUser(user) });
  });

  api.post('/logout', (req, res) => {
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    if (token) sessions.delete(token);
    setSessionCookie(req, res, '', 0);
    res.json({ ok: true });
  });

  // Všetko ďalej vyžaduje prihlásenie
  api.use((req, res, next) => {
    const user = sessionUser(req);
    if (!user) return next(new HttpError(401, 'Nie si prihlásený'));
    req.user = user;
    next();
  });

  api.get('/me', (req, res) => {
    // shareName: názov zdieľaného priečinka na NAS (pre adresu, ktorú dostane Orange Pi)
    res.json({ user: publicUser(req.user), churches: visibleChurches(req.user), sharedFolder, shareName: sharedFolder ? (process.env.ADMIN_SHARE_NAME || 'tvdisplay').trim() : null });
  });

  api.put('/me/password', (req, res) => {
    if (!verifyPassword(String(req.body?.currentPassword || ''), req.user.passwordHash)) {
      throw new HttpError(400, 'Súčasné heslo nie je správne');
    }
    const newPassword = String(req.body?.newPassword || '');
    if (newPassword.length < 8) throw new HttpError(400, 'Nové heslo musí mať aspoň 8 znakov');
    const users = loadUsers();
    users.find((u) => u.id === req.user.id).passwordHash = hashPassword(newPassword);
    saveUsers(users);
    res.json({ ok: true });
  });

  // --- Používatelia (iba administrátor) ---

  api.get('/users', (req, res) => {
    requireAdmin(req.user);
    res.json(loadUsers().map(publicUser));
  });

  api.post('/users', (req, res) => {
    requireAdmin(req.user);
    const users = loadUsers();
    const username = str(req.body?.username, 'meno', { required: true, max: 60 });
    if (!/^[\w.@-]+$/.test(username)) throw new HttpError(400, 'Meno môže obsahovať iba písmená bez diakritiky, čísla a znaky . _ - @');
    if (users.some((u) => u.username.toLowerCase() === username.toLowerCase())) throw new HttpError(409, 'Používateľ s týmto menom už existuje');
    const password = String(req.body?.password || '');
    if (password.length < 8) throw new HttpError(400, 'Heslo musí mať aspoň 8 znakov');
    const role = req.body?.role === 'admin' ? 'admin' : 'editor';
    const churchId = role === 'admin' ? null : str(req.body?.churchId, 'kostol', { required: true, max: 60 });
    if (churchId && !loadChurches().some((c) => c.id === churchId)) throw new HttpError(400, 'Kostol neexistuje');
    const user = { id: randomId('u'), username, passwordHash: hashPassword(password), role, churchId };
    saveUsers([...users, user]);
    res.status(201).json(publicUser(user));
  });

  api.put('/users/:id', (req, res) => {
    requireAdmin(req.user);
    const users = loadUsers();
    const target = users.find((u) => u.id === req.params.id);
    if (!target) throw new HttpError(404, 'Používateľ neexistuje');
    const body = req.body || {};
    if (body.password) {
      if (String(body.password).length < 8) throw new HttpError(400, 'Heslo musí mať aspoň 8 znakov');
      target.passwordHash = hashPassword(String(body.password));
    }
    if (body.role) {
      if (target.id === req.user.id && body.role !== 'admin') throw new HttpError(400, 'Sám sebe nemôžeš odobrať práva administrátora');
      target.role = body.role === 'admin' ? 'admin' : 'editor';
    }
    if (target.role === 'admin') {
      target.churchId = null;
    } else if (body.churchId !== undefined) {
      const churchId = str(body.churchId, 'kostol', { required: true, max: 60 });
      if (!loadChurches().some((c) => c.id === churchId)) throw new HttpError(400, 'Kostol neexistuje');
      target.churchId = churchId;
    }
    if (target.role === 'editor' && !target.churchId) throw new HttpError(400, 'Editor musí mať priradený kostol');
    saveUsers(users);
    res.json(publicUser(target));
  });

  api.delete('/users/:id', (req, res) => {
    requireAdmin(req.user);
    if (req.params.id === req.user.id) throw new HttpError(400, 'Sám seba nemôžeš zmazať');
    const users = loadUsers();
    if (!users.some((u) => u.id === req.params.id)) throw new HttpError(404, 'Používateľ neexistuje');
    saveUsers(users.filter((u) => u.id !== req.params.id));
    for (const [token, s] of sessions) if (s.userId === req.params.id) sessions.delete(token);
    res.json({ ok: true });
  });

  // --- Kostoly ---

  api.get('/churches', (req, res) => res.json(visibleChurches(req.user)));

  api.post('/churches', (req, res) => {
    requireAdmin(req.user);
    const church = createChurch(str(req.body?.name, 'názov', { required: true, max: 100 }));
    res.status(201).json(church);
  });

  // Doplnenie chýbajúcich piesní JKS do všetkých kostolov naraz
  api.post('/churches/add-jks', (req, res) => {
    requireAdmin(req.user);
    const added = loadChurches().map((c) => ({ id: c.id, name: c.name, added: addJksSongs(c.id) }));
    res.json({ churches: added, total: added.reduce((sum, c) => sum + c.added, 0) });
  });

  // Kontrola prístupu pre všetky adresy jedného kostola
  api.use('/churches/:churchId', (req, res, next) => {
    requireChurch(req.user, req.params.churchId);
    next();
  });

  api.put('/churches/:churchId', (req, res) => {
    requireAdmin(req.user);
    const churches = loadChurches();
    churches.find((c) => c.id === req.params.churchId).name = str(req.body?.name, 'názov', { required: true, max: 100 });
    saveChurches(churches);
    res.json({ ok: true });
  });

  api.delete('/churches/:churchId', (req, res) => {
    requireAdmin(req.user);
    const { churchId } = req.params;
    // Dáta sa nemažú natrvalo, presunú sa do priečinka deleted/ (v zdieľanom priečinku do skrytého .zmazane/)
    const trash = sharedFolder ? path.join(churchesRoot, '.zmazane') : path.join(dataDir, 'deleted');
    fs.mkdirSync(trash, { recursive: true });
    if (fs.existsSync(churchDir(churchId))) fs.renameSync(churchDir(churchId), path.join(trash, `${churchId}-${Date.now()}`));
    saveChurches(loadChurches().filter((c) => c.id !== churchId));
    saveUsers(loadUsers().map((u) => (u.churchId === churchId ? { ...u, churchId: null } : u)));
    res.json({ ok: true });
  });

  // --- Kategórie ---

  api.get('/churches/:churchId/categories', (req, res) => res.json(loadCategories(req.params.churchId)));

  api.post('/churches/:churchId/categories', (req, res) => {
    const { churchId } = req.params;
    const categories = loadCategories(churchId);
    const name = str(req.body?.name, 'názov', { required: true, max: 60 });
    const base = slugify(name) || 'kategoria';
    let id = base;
    for (let i = 2; categories.some((c) => c.id === id); i++) id = `${base}-${i}`;
    const category = { id, name };
    saveList(churchId, 'categories.json', [...categories, category]);
    res.status(201).json(category);
  });

  api.put('/churches/:churchId/categories/:id', (req, res) => {
    const { churchId, id } = req.params;
    const categories = loadCategories(churchId);
    const category = categories.find((c) => c.id === id);
    if (!category) throw new HttpError(404, 'Kategória neexistuje');
    category.name = str(req.body?.name, 'názov', { required: true, max: 60 });
    saveList(churchId, 'categories.json', categories);
    res.json(category);
  });

  api.delete('/churches/:churchId/categories/:id', (req, res) => {
    const { churchId, id } = req.params;
    const count = loadList(churchId, 'songs.json').filter((s) => s.category === id).length;
    if (count) throw new HttpError(409, `Kategória obsahuje ${count} piesní – najprv ich presuň alebo zmaž`);
    saveList(churchId, 'categories.json', loadList(churchId, 'categories.json').filter((c) => c.id !== id));
    res.json({ ok: true });
  });

  // --- Piesne (bez prezentácií, tie majú vlastnú sekciu) ---

  api.get('/churches/:churchId/songs', (req, res) => {
    res.json(loadList(req.params.churchId, 'songs.json').filter((s) => s.type !== 'pdf'));
  });

  api.post('/churches/:churchId/songs', (req, res) => {
    const { churchId } = req.params;
    const song = { id: randomId('s'), ...validateSong(req.body, loadCategories(churchId)) };
    saveList(churchId, 'songs.json', [...loadList(churchId, 'songs.json'), song]);
    res.status(201).json(song);
  });

  api.put('/churches/:churchId/songs/:id', (req, res) => {
    const { churchId, id } = req.params;
    const songs = loadList(churchId, 'songs.json');
    const index = songs.findIndex((s) => s.id === id && s.type !== 'pdf');
    if (index < 0) throw new HttpError(404, 'Pieseň neexistuje');
    songs[index] = { id, ...validateSong(req.body, loadCategories(churchId)) };
    saveList(churchId, 'songs.json', songs);
    res.json(songs[index]);
  });

  api.delete('/churches/:churchId/songs/:id', (req, res) => {
    const { churchId, id } = req.params;
    const songs = loadList(churchId, 'songs.json');
    if (!songs.some((s) => s.id === id && s.type !== 'pdf')) throw new HttpError(404, 'Pieseň neexistuje');
    saveList(churchId, 'songs.json', songs.filter((s) => s.id !== id));
    res.json({ ok: true });
  });

  // --- Prezentácie (v songs.json s type: 'pdf', rovnako ako na Orange Pi) ---

  api.get('/churches/:churchId/pdfs', (req, res) => {
    res.json(loadList(req.params.churchId, 'songs.json').filter((s) => s.type === 'pdf'));
  });

  // Súbor ide priamo v tele požiadavky; PowerPoint sa prevedie na PDF, ak je na serveri LibreOffice
  api.post('/churches/:churchId/pdfs', express.raw({ type: () => true, limit: '100mb' }), wrap(async (req, res) => {
    const { churchId } = req.params;
    if (!Buffer.isBuffer(req.body) || !req.body.length) throw new HttpError(400, 'Prázdny súbor');
    const original = decodeURIComponent(req.get('x-filename') || 'prezentacia.pdf');
    const title = str(decodeURIComponent(req.get('x-title') || ''), 'názov', { required: true });
    const ext = path.extname(original).toLowerCase();
    if (!ACCEPTED_EXTENSIONS.has(ext)) throw new HttpError(400, `Nepodporovaný typ súboru ${ext} – použi PDF, PPT, PPTX alebo ODP`);
    let pdf;
    let pageCount;
    try {
      pdf = PRESENTATION_EXTENSIONS.has(ext) ? await convertToPdf(req.body, ext) : req.body;
      pageCount = await countPdfPages(pdf);
    } catch (e) {
      throw new HttpError(e.status || 422, e.status === 501 ? e.message : `Súbor sa nepodarilo spracovať: ${e.message}`);
    }
    const item = { id: randomId('pdf'), title, type: 'pdf', pdfUrl: saveMedia(churchId, pdf, '.pdf'), pageCount };
    saveList(churchId, 'songs.json', [...loadList(churchId, 'songs.json'), item]);
    res.status(201).json(item);
  }));

  api.put('/churches/:churchId/pdfs/:id', (req, res) => {
    const { churchId, id } = req.params;
    const songs = loadList(churchId, 'songs.json');
    const pdf = songs.find((s) => s.id === id && s.type === 'pdf');
    if (!pdf) throw new HttpError(404, 'Prezentácia neexistuje');
    pdf.title = str(req.body?.title, 'názov', { required: true });
    saveList(churchId, 'songs.json', songs);
    res.json(pdf);
  });

  api.delete('/churches/:churchId/pdfs/:id', (req, res) => {
    const { churchId, id } = req.params;
    const songs = loadList(churchId, 'songs.json');
    const pdf = songs.find((s) => s.id === id && s.type === 'pdf');
    if (!pdf) throw new HttpError(404, 'Prezentácia neexistuje');
    deleteMedia(churchId, pdf.pdfUrl);
    saveList(churchId, 'songs.json', songs.filter((s) => s.id !== id));
    res.json({ ok: true });
  });

  // --- Obrázky (prehliadač ich pred nahraním zmenší) ---

  api.get('/churches/:churchId/images', (req, res) => res.json(loadList(req.params.churchId, 'images.json')));

  api.post('/churches/:churchId/images', (req, res) => {
    const { churchId } = req.params;
    const title = str(req.body?.title, 'názov', { required: true });
    const match = /^data:([a-z0-9.+/-]+);base64,(.*)$/i.exec(String(req.body?.dataUrl || ''));
    const ext = match && IMAGE_TYPES[match[1].toLowerCase()];
    if (!ext) throw new HttpError(400, 'Nepodporovaný obrázok – použi JPG, PNG, WEBP alebo GIF');
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length > MAX_IMAGE_BYTES) throw new HttpError(413, 'Obrázok je príliš veľký');
    const image = { id: randomId('img'), title, imageUrl: saveMedia(churchId, buffer, ext) };
    saveList(churchId, 'images.json', [...loadList(churchId, 'images.json'), image]);
    res.status(201).json(image);
  });

  api.put('/churches/:churchId/images/:id', (req, res) => {
    const { churchId, id } = req.params;
    const images = loadList(churchId, 'images.json');
    const image = images.find((i) => i.id === id);
    if (!image) throw new HttpError(404, 'Obrázok neexistuje');
    image.title = str(req.body?.title, 'názov', { required: true });
    saveList(churchId, 'images.json', images);
    res.json(image);
  });

  api.delete('/churches/:churchId/images/:id', (req, res) => {
    const { churchId, id } = req.params;
    const images = loadList(churchId, 'images.json');
    const image = images.find((i) => i.id === id);
    if (!image) throw new HttpError(404, 'Obrázok neexistuje');
    deleteMedia(churchId, image.imageUrl);
    saveList(churchId, 'images.json', images.filter((i) => i.id !== id));
    res.json({ ok: true });
  });

  api.use(() => {
    throw new HttpError(404, 'Neznáma požiadavka');
  });

  // --- /api/public: iba čítanie, pre Orange Pi v kostoloch ---

  const pub = express.Router();

  pub.get('/churches', (req, res) => res.json(loadChurches().map((c) => ({ id: c.id, name: c.name }))));

  // res.json posiela ETag, takže Orange Pi pri kontrole zmien dostane 304 bez sťahovania dát
  pub.get('/churches/:churchId/:file', (req, res) => {
    const { churchId, file } = req.params;
    if (!LIST_FILES.has(file) || !loadChurches().some((c) => c.id === churchId)) throw new HttpError(404, 'Nenájdené');
    res.set('Cache-Control', 'no-cache');
    res.json(loadList(churchId, file));
  });

  pub.get('/churches/:churchId/media/:name', (req, res) => {
    const { churchId, name } = req.params;
    if (name !== path.basename(name) || !loadChurches().some((c) => c.id === churchId)) throw new HttpError(404, 'Nenájdené');
    const file = path.join(churchDir(churchId), 'media', name);
    if (!fs.existsSync(file)) throw new HttpError(404, 'Nenájdené');
    // Názvy súborov sú náhodné a nemenia sa
    res.sendFile(file, { maxAge: '365d', immutable: true });
  });

  pub.use(() => {
    throw new HttpError(404, 'Nenájdené');
  });

  // Chyby ako JSON
  const errors = (err, req, res, next) => {
    if (res.headersSent) return next(err);
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Súbor je príliš veľký' });
    console.error('[admin] Chyba:', err);
    res.status(500).json({ error: 'Chyba servera' });
  };
  api.use(errors);
  pub.use(errors);

  return { api, pub };
}
