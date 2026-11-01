// Jednoduchý server pre produkčné nasadenie (napr. Orange Pi):
// - servíruje zbuildovanú aplikáciu z dist/
// - drží spoločný stav displeja (GET/POST /api/state)
// - posiela zmeny stavu všetkým klientom cez Server-Sent Events (/api/events)
// Nepoužíva žiadne externé balíčky, stačí Node.js.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT) || 8080;
const STATE_FILE = process.env.STATE_FILE || path.join(ROOT, 'tvdisplay-state.json');
const MAX_BODY = 25 * 1024 * 1024; // pozadie môže byť obrázok ako data URL

const DEFAULT_STATE = { currentSongId: null, background: null, isHidden: false, currentPage: 0 };

let state = { ...DEFAULT_STATE };
try {
  state = { ...DEFAULT_STATE, ...JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) };
} catch {
  // súbor ešte neexistuje - začíname s predvoleným stavom
}

let saveTimer = null;
function saveStateSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.writeFile(STATE_FILE, JSON.stringify(state), (err) => {
      if (err) console.error('Nepodarilo sa uložiť stav:', err.message);
    });
  }, 500);
}

const clients = new Set();
function broadcast(message) {
  const data = `data: ${JSON.stringify(message)}\n\n`;
  for (const res of clients) res.write(data);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function serveStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  let file = path.join(DIST, path.normalize(urlPath));
  if (file !== DIST && !file.startsWith(DIST + path.sep)) {
    res.writeHead(403);
    return res.end();
  }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) file = path.join(DIST, 'index.html');
    fs.readFile(file, (readErr, data) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Chýba dist/ - najprv spusti "npm run build".');
      }
      const ext = path.extname(file);
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
      });
      res.end(data);
    });
  });
}

const server = http.createServer((req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');

  if (pathname === '/api/state' && req.method === 'GET') {
    return sendJson(res, 200, state);
  }

  if (pathname === '/api/state' && req.method === 'POST') {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        sendJson(res, 413, { error: 'Príliš veľké dáta' });
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (res.writableEnded) return;
      let patch;
      try {
        patch = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch {
        return sendJson(res, 400, { error: 'Neplatný JSON' });
      }
      if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
        return sendJson(res, 400, { error: 'Očakáva sa objekt' });
      }
      state = { ...state, ...patch };
      saveStateSoon();
      // Posielame len zmenu - pozadie (veľký obrázok) sa neposiela pri každom otočení strany
      broadcast({ type: 'patch', state: patch });
      return sendJson(res, 200, { ok: true });
    });
    return;
  }

  if (pathname === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
    });
    res.write(`data: ${JSON.stringify({ type: 'full', state })}\n\n`);
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405);
    return res.end();
  }
  return serveStatic(req, res);
});

// Udržiavanie SSE spojení, aby ich nezavrel proxy/router
setInterval(() => {
  for (const res of clients) res.write(': ping\n\n');
}, 25000);

server.listen(PORT, () => {
  console.log(`TV Display server beží na porte ${PORT}`);
  console.log(`  Displej:   http://localhost:${PORT}/#display`);
  console.log(`  Ovládanie: http://<IP-adresa>:${PORT}/#control`);
});
