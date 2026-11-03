// Administrácia: prihlasovanie, kostoly, používatelia, piesne, kategórie, obrázky a PDF.
// Dáta sa ukladajú do priečinka DATA_DIR:
//   users.json, churches.json
//   churches/<id>/songs.json, images.json, categories.json, media/<súbory>
// Orange Pi v kostoloch čítajú dáta cez verejné (len na čítanie) adresy /api/public/churches/<id>/...
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { sendJson, readJson, sendFile, safeJoin, HttpError } from './http-utils.mjs';

const SESSION_COOKIE = 'tvd_session';
const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 dní
const MAX_JSON = 1024 * 1024; // bežné požiadavky
const MAX_UPLOAD = 60 * 1024 * 1024; // obrázky a PDF ako base64
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_PDF_BYTES = 40 * 1024 * 1024;
const LOGIN_MAX_FAILS = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

// Pekné názvy kategórií pôvodného spevníka
const SEED_CATEGORY_NAMES = {
  vseobecne: 'Všeobecné',
  marianske: 'Mariánske',
  vianocne: 'Vianočné',
  velkonocne: 'Veľkonočné',
  adoracia: 'Adorácia',
};

// --- Pomocné funkcie -------------------------------------------------------

function readJsonFile(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

// Zápis cez dočasný súbor, aby sa pri výpadku prúdu nepoškodil pôvodný súbor
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
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
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

// Rozloží data URL a overí typ a veľkosť; vráti { buffer, ext }
function parseDataUrl(dataUrl, allowed, maxBytes) {
  const match = /^data:([a-z0-9.+/-]+);base64,(.*)$/i.exec(String(dataUrl || ''));
  if (!match) throw new HttpError(400, 'Neplatný súbor');
  const ext = allowed[match[1].toLowerCase()];
  if (!ext) throw new HttpError(400, 'Nepodporovaný typ súboru');
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > maxBytes) throw new HttpError(413, 'Súbor je príliš veľký');
  return { buffer, ext };
}

const IMAGE_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
const PDF_TYPES = { 'application/pdf': '.pdf' };

function publicUser(user) {
  return { id: user.id, username: user.username, role: user.role, churchId: user.churchId || null };
}

// --- Administrácia ------------------------------------------------------------

export function createAdmin({ dataDir, seedSongsFile }) {
  const usersFile = path.join(dataDir, 'users.json');
  const churchesFile = path.join(dataDir, 'churches.json');
  const churchDir = (id) => path.join(dataDir, 'churches', id);
  const sessions = new Map(); // token -> { userId, expires }
  const loginFails = new Map(); // username -> { count, first }

  fs.mkdirSync(dataDir, { recursive: true });

  // Upratovanie vypršaných prihlásení
  setInterval(() => {
    const now = Date.now();
    for (const [token, s] of sessions) if (s.expires < now) sessions.delete(token);
  }, 60 * 60 * 1000).unref();

  const loadUsers = () => readJsonFile(usersFile, []);
  const saveUsers = (users) => writeJsonFile(usersFile, users);
  const loadChurches = () => readJsonFile(churchesFile, []);
  const saveChurches = (churches) => writeJsonFile(churchesFile, churches);
  const churchFile = (id, name) => path.join(churchDir(id), name);
  const loadList = (id, name) => readJsonFile(churchFile(id, name), []);
  const saveList = (id, name, list) => writeJsonFile(churchFile(id, name), list);

  // Prvý administrátor z premenných prostredia (ADMIN_USERNAME / ADMIN_PASSWORD)
  if (loadUsers().length === 0) {
    const password = process.env.ADMIN_PASSWORD;
    if (password) {
      const username = process.env.ADMIN_USERNAME || 'admin';
      saveUsers([{ id: randomId('u'), username, passwordHash: hashPassword(password), role: 'admin', churchId: null }]);
      console.log(`Vytvorený administrátor "${username}".`);
    } else {
      console.warn('Nie je vytvorený žiadny používateľ. Nastav ADMIN_PASSWORD (a voliteľne ADMIN_USERNAME) a reštartuj server,');
      console.warn('alebo spusti: node server/set-password.mjs <meno> <heslo> --admin');
    }
  }

  function getSessionUser(req) {
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    if (!token) return null;
    const session = sessions.get(token);
    if (!session || session.expires < Date.now()) {
      sessions.delete(token);
      return null;
    }
    const user = loadUsers().find(u => u.id === session.userId);
    if (!user) {
      sessions.delete(token);
      return null;
    }
    session.expires = Date.now() + SESSION_TTL_MS;
    return user;
  }

  function cookieHeader(req, token, maxAgeSec) {
    const secure = req.headers['x-forwarded-proto'] === 'https' || req.socket.encrypted;
    return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSec}${secure ? '; Secure' : ''}`;
  }

  function requireUser(req) {
    const user = getSessionUser(req);
    if (!user) throw new HttpError(401, 'Nie si prihlásený');
    return user;
  }

  function requireAdmin(user) {
    if (user.role !== 'admin') throw new HttpError(403, 'Na toto potrebuješ práva administrátora');
  }

  // Editor smie spravovať len svoj kostol, administrátor všetky
  function requireChurch(user, churchId) {
    if (!loadChurches().some(c => c.id === churchId)) throw new HttpError(404, 'Kostol neexistuje');
    if (user.role !== 'admin' && user.churchId !== churchId) throw new HttpError(403, 'Tento kostol nemôžeš spravovať');
  }

  function visibleChurches(user) {
    const churches = loadChurches();
    return user.role === 'admin' ? churches : churches.filter(c => c.id === user.churchId);
  }

  function createChurch(name, seed) {
    const churches = loadChurches();
    let id = slugify(name) || 'kostol';
    for (let i = 2; churches.some(c => c.id === id); i++) id = `${slugify(name) || 'kostol'}-${i}`;
    let songs = [];
    let categories = [];
    if (seed && seedSongsFile) {
      songs = readJsonFile(seedSongsFile, []).filter(s => s.category && s.category !== 'test' && s.type !== 'pdf' && !s.imageUrl);
      categories = [...new Set(songs.map(s => s.category))].map(cid => ({ id: cid, name: SEED_CATEGORY_NAMES[cid] || cid }));
    }
    fs.mkdirSync(path.join(churchDir(id), 'media'), { recursive: true });
    saveList(id, 'songs.json', songs);
    saveList(id, 'categories.json', categories);
    saveList(id, 'images.json', []);
    const church = { id, name };
    saveChurches([...churches, church]);
    return church;
  }

  function saveMedia(churchId, buffer, ext) {
    const file = `${crypto.randomBytes(8).toString('hex')}${ext}`;
    const dir = path.join(churchDir(churchId), 'media');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, file), buffer);
    return `media/${file}`;
  }

  function deleteMedia(churchId, relUrl) {
    if (!relUrl || !relUrl.startsWith('media/')) return;
    const file = safeJoin(churchDir(churchId), relUrl);
    if (file) fs.rm(file, { force: true }, () => {});
  }

  function validateSong(body, categories) {
    const song = {
      title: str(body.title, 'názov', { required: true }),
      number: str(body.number, 'číslo', { max: 20 }),
      category: str(body.category, 'kategória', { required: true, max: 60 }),
      lyrics: str(body.lyrics, 'text', { required: true, max: 50000 }).replace(/\r\n/g, '\n'),
    };
    if (!categories.some(c => c.id === song.category)) throw new HttpError(400, 'Neznáma kategória');
    if (!song.number) delete song.number;
    return song;
  }

  // --- API ---------------------------------------------------------------------

  async function handleApi(req, res, parts) {
    const method = req.method;

    // POST /api/admin/login
    if (parts[0] === 'login' && method === 'POST') {
      const body = await readJson(req, MAX_JSON);
      const username = str(body?.username, 'meno', { required: true, max: 60 });
      const password = typeof body?.password === 'string' ? body.password : '';
      const key = username.toLowerCase();
      const fails = loginFails.get(key);
      if (fails && Date.now() - fails.first < LOGIN_WINDOW_MS && fails.count >= LOGIN_MAX_FAILS) {
        throw new HttpError(429, 'Príliš veľa neúspešných pokusov. Skús to znova o 15 minút.');
      }
      const user = loadUsers().find(u => u.username.toLowerCase() === key);
      // Aj pri neexistujúcom mene overujeme heslo, aby sa podľa času odpovede nedalo zistiť, ktoré mená existujú
      if (!verifyPassword(password, user ? user.passwordHash : DUMMY_HASH) || !user) {
        const entry = fails && Date.now() - fails.first < LOGIN_WINDOW_MS ? fails : { count: 0, first: Date.now() };
        entry.count++;
        loginFails.set(key, entry);
        throw new HttpError(401, 'Nesprávne meno alebo heslo');
      }
      loginFails.delete(key);
      const token = crypto.randomBytes(32).toString('hex');
      sessions.set(token, { userId: user.id, expires: Date.now() + SESSION_TTL_MS });
      return sendJson(res, 200, { user: publicUser(user) }, { 'Set-Cookie': cookieHeader(req, token, SESSION_TTL_MS / 1000) });
    }

    // POST /api/admin/logout
    if (parts[0] === 'logout' && method === 'POST') {
      const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
      if (token) sessions.delete(token);
      return sendJson(res, 200, { ok: true }, { 'Set-Cookie': cookieHeader(req, '', 0) });
    }

    // Všetko ďalej vyžaduje prihlásenie
    const user = requireUser(req);

    // GET /api/admin/me
    if (parts[0] === 'me' && parts.length === 1 && method === 'GET') {
      return sendJson(res, 200, { user: publicUser(user), churches: visibleChurches(user) });
    }

    // PUT /api/admin/me/password
    if (parts[0] === 'me' && parts[1] === 'password' && method === 'PUT') {
      const body = await readJson(req, MAX_JSON);
      if (!verifyPassword(String(body?.currentPassword || ''), user.passwordHash)) throw new HttpError(400, 'Súčasné heslo nie je správne');
      const newPassword = String(body?.newPassword || '');
      if (newPassword.length < 8) throw new HttpError(400, 'Nové heslo musí mať aspoň 8 znakov');
      const users = loadUsers();
      users.find(u => u.id === user.id).passwordHash = hashPassword(newPassword);
      saveUsers(users);
      return sendJson(res, 200, { ok: true });
    }

    // --- Používatelia (len administrátor) ---
    if (parts[0] === 'users') {
      requireAdmin(user);
      const users = loadUsers();
      if (parts.length === 1 && method === 'GET') return sendJson(res, 200, users.map(publicUser));
      if (parts.length === 1 && method === 'POST') {
        const body = await readJson(req, MAX_JSON);
        const username = str(body?.username, 'meno', { required: true, max: 60 });
        if (!/^[\w.@-]+$/.test(username)) throw new HttpError(400, 'Meno môže obsahovať len písmená bez diakritiky, čísla a znaky . _ - @');
        if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) throw new HttpError(409, 'Používateľ s týmto menom už existuje');
        const password = String(body?.password || '');
        if (password.length < 8) throw new HttpError(400, 'Heslo musí mať aspoň 8 znakov');
        const role = body?.role === 'admin' ? 'admin' : 'editor';
        const churchId = role === 'admin' ? null : str(body?.churchId, 'kostol', { required: true, max: 60 });
        if (churchId && !loadChurches().some(c => c.id === churchId)) throw new HttpError(400, 'Kostol neexistuje');
        const newUser = { id: randomId('u'), username, passwordHash: hashPassword(password), role, churchId };
        saveUsers([...users, newUser]);
        return sendJson(res, 201, publicUser(newUser));
      }
      const target = users.find(u => u.id === parts[1]);
      if (!target) throw new HttpError(404, 'Používateľ neexistuje');
      if (parts.length === 2 && method === 'PUT') {
        const body = await readJson(req, MAX_JSON);
        if (body?.password) {
          if (String(body.password).length < 8) throw new HttpError(400, 'Heslo musí mať aspoň 8 znakov');
          target.passwordHash = hashPassword(String(body.password));
        }
        if (body?.role) {
          if (target.id === user.id && body.role !== 'admin') throw new HttpError(400, 'Sám sebe nemôžeš odobrať práva administrátora');
          target.role = body.role === 'admin' ? 'admin' : 'editor';
        }
        if (target.role === 'admin') {
          target.churchId = null;
        } else if (body?.churchId !== undefined) {
          const churchId = str(body.churchId, 'kostol', { required: true, max: 60 });
          if (!loadChurches().some(c => c.id === churchId)) throw new HttpError(400, 'Kostol neexistuje');
          target.churchId = churchId;
        }
        if (target.role === 'editor' && !target.churchId) throw new HttpError(400, 'Editor musí mať priradený kostol');
        saveUsers(users);
        return sendJson(res, 200, publicUser(target));
      }
      if (parts.length === 2 && method === 'DELETE') {
        if (target.id === user.id) throw new HttpError(400, 'Sám seba nemôžeš zmazať');
        saveUsers(users.filter(u => u.id !== target.id));
        for (const [token, s] of sessions) if (s.userId === target.id) sessions.delete(token);
        return sendJson(res, 200, { ok: true });
      }
    }

    // --- Kostoly ---
    if (parts[0] === 'churches' && parts.length === 1) {
      if (method === 'GET') return sendJson(res, 200, visibleChurches(user));
      if (method === 'POST') {
        requireAdmin(user);
        const body = await readJson(req, MAX_JSON);
        const church = createChurch(str(body?.name, 'názov', { required: true, max: 100 }), !!body?.seed);
        return sendJson(res, 201, church);
      }
    }

    if (parts[0] === 'churches' && parts[1]) {
      const churchId = parts[1];
      requireChurch(user, churchId);
      const resource = parts[2];
      const itemId = parts[3];

      if (!resource) {
        if (method === 'PUT') {
          requireAdmin(user);
          const body = await readJson(req, MAX_JSON);
          const churches = loadChurches();
          churches.find(c => c.id === churchId).name = str(body?.name, 'názov', { required: true, max: 100 });
          saveChurches(churches);
          return sendJson(res, 200, { ok: true });
        }
        if (method === 'DELETE') {
          requireAdmin(user);
          // Dáta sa nemažú natrvalo - presunú sa do priečinka deleted/
          const trash = path.join(dataDir, 'deleted');
          fs.mkdirSync(trash, { recursive: true });
          if (fs.existsSync(churchDir(churchId))) fs.renameSync(churchDir(churchId), path.join(trash, `${churchId}-${Date.now()}`));
          saveChurches(loadChurches().filter(c => c.id !== churchId));
          saveUsers(loadUsers().map(u => (u.churchId === churchId ? { ...u, churchId: null } : u)));
          return sendJson(res, 200, { ok: true });
        }
      }

      // Kategórie
      if (resource === 'categories') {
        const categories = loadList(churchId, 'categories.json');
        if (!itemId && method === 'GET') return sendJson(res, 200, categories);
        if (!itemId && method === 'POST') {
          const body = await readJson(req, MAX_JSON);
          const name = str(body?.name, 'názov', { required: true, max: 60 });
          let id = slugify(name) || 'kategoria';
          for (let i = 2; categories.some(c => c.id === id); i++) id = `${slugify(name) || 'kategoria'}-${i}`;
          const category = { id, name };
          saveList(churchId, 'categories.json', [...categories, category]);
          return sendJson(res, 201, category);
        }
        const category = categories.find(c => c.id === itemId);
        if (!category) throw new HttpError(404, 'Kategória neexistuje');
        if (method === 'PUT') {
          const body = await readJson(req, MAX_JSON);
          category.name = str(body?.name, 'názov', { required: true, max: 60 });
          saveList(churchId, 'categories.json', categories);
          return sendJson(res, 200, category);
        }
        if (method === 'DELETE') {
          const count = loadList(churchId, 'songs.json').filter(s => s.category === itemId).length;
          if (count) throw new HttpError(409, `Kategória obsahuje ${count} piesní - najprv ich presuň alebo zmaž`);
          saveList(churchId, 'categories.json', categories.filter(c => c.id !== itemId));
          return sendJson(res, 200, { ok: true });
        }
      }

      // Piesne (bez PDF prezentácií, tie majú vlastnú sekciu)
      if (resource === 'songs') {
        const songs = loadList(churchId, 'songs.json');
        if (!itemId && method === 'GET') return sendJson(res, 200, songs.filter(s => s.type !== 'pdf'));
        if (!itemId && method === 'POST') {
          const body = await readJson(req, MAX_JSON);
          const song = { id: randomId('s'), ...validateSong(body, loadList(churchId, 'categories.json')) };
          saveList(churchId, 'songs.json', [...songs, song]);
          return sendJson(res, 201, song);
        }
        const index = songs.findIndex(s => s.id === itemId && s.type !== 'pdf');
        if (index < 0) throw new HttpError(404, 'Pieseň neexistuje');
        if (method === 'PUT') {
          const body = await readJson(req, MAX_JSON);
          songs[index] = { id: itemId, ...validateSong(body, loadList(churchId, 'categories.json')) };
          saveList(churchId, 'songs.json', songs);
          return sendJson(res, 200, songs[index]);
        }
        if (method === 'DELETE') {
          songs.splice(index, 1);
          saveList(churchId, 'songs.json', songs);
          return sendJson(res, 200, { ok: true });
        }
      }

      // PDF prezentácie (ukladajú sa do songs.json s type: 'pdf', ako doteraz)
      if (resource === 'pdfs') {
        const songs = loadList(churchId, 'songs.json');
        if (!itemId && method === 'GET') return sendJson(res, 200, songs.filter(s => s.type === 'pdf'));
        if (!itemId && method === 'POST') {
          const body = await readJson(req, MAX_UPLOAD);
          const title = str(body?.title, 'názov', { required: true });
          const { buffer, ext } = parseDataUrl(body?.dataUrl, PDF_TYPES, MAX_PDF_BYTES);
          const pageCount = Math.max(1, Math.min(10000, parseInt(body?.pageCount, 10) || 1));
          const pdf = { id: randomId('p'), title, type: 'pdf', pdfUrl: saveMedia(churchId, buffer, ext), pageCount };
          saveList(churchId, 'songs.json', [...songs, pdf]);
          return sendJson(res, 201, pdf);
        }
        const pdf = songs.find(s => s.id === itemId && s.type === 'pdf');
        if (!pdf) throw new HttpError(404, 'Prezentácia neexistuje');
        if (method === 'PUT') {
          const body = await readJson(req, MAX_JSON);
          pdf.title = str(body?.title, 'názov', { required: true });
          saveList(churchId, 'songs.json', songs);
          return sendJson(res, 200, pdf);
        }
        if (method === 'DELETE') {
          deleteMedia(churchId, pdf.pdfUrl);
          saveList(churchId, 'songs.json', songs.filter(s => s.id !== itemId));
          return sendJson(res, 200, { ok: true });
        }
      }

      // Obrázky
      if (resource === 'images') {
        const images = loadList(churchId, 'images.json');
        if (!itemId && method === 'GET') return sendJson(res, 200, images);
        if (!itemId && method === 'POST') {
          const body = await readJson(req, MAX_UPLOAD);
          const title = str(body?.title, 'názov', { required: true });
          const { buffer, ext } = parseDataUrl(body?.dataUrl, IMAGE_TYPES, MAX_IMAGE_BYTES);
          const image = { id: randomId('i'), title, imageUrl: saveMedia(churchId, buffer, ext) };
          saveList(churchId, 'images.json', [...images, image]);
          return sendJson(res, 201, image);
        }
        const image = images.find(img => img.id === itemId);
        if (!image) throw new HttpError(404, 'Obrázok neexistuje');
        if (method === 'PUT') {
          const body = await readJson(req, MAX_JSON);
          image.title = str(body?.title, 'názov', { required: true });
          saveList(churchId, 'images.json', images);
          return sendJson(res, 200, image);
        }
        if (method === 'DELETE') {
          deleteMedia(churchId, image.imageUrl);
          saveList(churchId, 'images.json', images.filter(img => img.id !== itemId));
          return sendJson(res, 200, { ok: true });
        }
      }
    }

    throw new HttpError(404, 'Neznáma požiadavka');
  }

  // Verejné čítanie dát kostola (pre Orange Pi a displej)
  function handlePublic(req, res, parts) {
    if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Len na čítanie');
    const headers = { 'Access-Control-Allow-Origin': '*' };
    if (parts.length === 0) {
      return sendJson(res, 200, loadChurches().map(c => ({ id: c.id, name: c.name })), headers);
    }
    const churchId = parts[0];
    if (!loadChurches().some(c => c.id === churchId)) throw new HttpError(404, 'Kostol neexistuje');
    const rest = parts.slice(1).join('/');
    if (['songs.json', 'images.json', 'categories.json'].includes(rest)) {
      return sendJson(res, 200, loadList(churchId, rest), headers);
    }
    if (parts[1] === 'media' && parts.length === 3) {
      const file = safeJoin(path.join(churchDir(churchId), 'media'), parts[2]);
      res.setHeader('Access-Control-Allow-Origin', '*');
      // Názvy súborov sú náhodné a nemenia sa, takže sa môžu dlho cachovať
      if (file && sendFile(res, file, 'public, max-age=31536000, immutable')) return;
    }
    throw new HttpError(404, 'Nenájdené');
  }

  // Vráti true, ak požiadavku spracovala administrácia
  return function handle(req, res, pathname) {
    let handler;
    let parts;
    if (pathname.startsWith('/api/admin/')) {
      handler = handleApi;
      parts = pathname.slice('/api/admin/'.length).split('/').filter(Boolean);
    } else if (pathname === '/api/public/churches' || pathname.startsWith('/api/public/churches/')) {
      handler = handlePublic;
      parts = pathname.slice('/api/public/churches'.length).split('/').filter(Boolean);
    } else {
      return false;
    }
    try {
      parts = parts.map(decodeURIComponent);
    } catch {
      sendJson(res, 400, { error: 'Neplatná adresa' });
      return true;
    }
    // Zmeny dát len cez JSON - prehliadač ich tak nepošle z cudzej stránky bez CORS (ochrana proti CSRF)
    if (!['GET', 'HEAD'].includes(req.method) && !(req.headers['content-type'] || '').startsWith('application/json')) {
      sendJson(res, 415, { error: 'Očakáva sa application/json' });
      return true;
    }
    Promise.resolve()
      .then(() => handler(req, res, parts))
      .catch((err) => {
        if (res.headersSent) return res.end();
        if (err instanceof HttpError) return sendJson(res, err.status, { error: err.message });
        console.error('Chyba administrácie:', err);
        sendJson(res, 500, { error: 'Chyba servera' });
      });
    return true;
  };
}
