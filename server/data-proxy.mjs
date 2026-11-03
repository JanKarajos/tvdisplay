// Pre Orange Pi v kostole: sprostredkuje dáta kostola z centrálnej administrácie (NAS)
// a ukladá si ich kópiu na disk. Keď NAS alebo internet nie je dostupný, použije uloženú kópiu,
// takže displej funguje aj bez pripojenia.
//   /data/songs.json  ->  <DATA_URL>/songs.json
//   /data/media/x.jpg ->  <DATA_URL>/media/x.jpg
import fs from 'node:fs';
import path from 'node:path';
import { sendFile, safeJoin } from './http-utils.mjs';

const FETCH_TIMEOUT_MS = 10000;

export function createDataProxy({ dataUrl, cacheDir }) {
  const base = dataUrl.replace(/\/+$/, '');
  fs.mkdirSync(cacheDir, { recursive: true });

  async function fetchToCache(relPath, cacheFile) {
    const res = await fetch(`${base}/${relPath}`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
    const tmp = `${cacheFile}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, buffer);
    fs.renameSync(tmp, cacheFile);
  }

  return async function handle(req, res, pathname) {
    if (!pathname.startsWith('/data/')) return false;
    let relPath;
    try {
      relPath = decodeURIComponent(pathname.slice('/data/'.length));
    } catch {
      res.writeHead(400);
      res.end();
      return true;
    }
    const cacheFile = relPath ? safeJoin(cacheDir, relPath) : null;
    if (!cacheFile || (req.method !== 'GET' && req.method !== 'HEAD')) {
      res.writeHead(400);
      res.end();
      return true;
    }

    const isMedia = relPath.startsWith('media/');
    // Médiá majú nemenné názvy - ak ich už máme, netreba ich sťahovať znova
    if (isMedia && sendFile(res, cacheFile, 'public, max-age=31536000, immutable')) return true;

    try {
      await fetchToCache(relPath, cacheFile);
    } catch (err) {
      if (err.status === 404) {
        res.writeHead(404);
        res.end();
        return true;
      }
      console.warn(`Dáta ${relPath} sa nepodarilo stiahnuť (${err.message}), použijem uloženú kópiu.`);
    }
    if (!sendFile(res, cacheFile, isMedia ? 'public, max-age=31536000, immutable' : 'no-store')) {
      res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Dáta nie sú dostupné a nemám ani uloženú kópiu.');
    }
    return true;
  };
}
