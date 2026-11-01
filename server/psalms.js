// Responzóriové žalmy: pribalené v Texty/Žalmy RRRR.json, chýbajúce dni server stiahne z lc.kbs.sk.
// Na pozadí dopĺňa aktuálny a nasledujúci rok do psalms/RRRR.json. Tento priečinok aktualizácia
// aplikácie nemaže. Bez internetu to skúša znova, takže stačí Orange Pi pripojiť na sieť.
import fs from 'node:fs';
import path from 'node:path';

const SOURCE = 'https://lc.kbs.sk/?den=';
const REQUEST_DELAY_MS = 250; // ohľaduplne voči zdrojovému webu
const SAVE_EVERY = 30;
const RETRY_OFFLINE_MS = 5 * 60 * 1000;
const RECHECK_MS = 6 * 60 * 60 * 1000;

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function isValidDate(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

// Web posiela slovenské znaky ako HTML kódy (&aacute;, &scaron;, &#357;)
const NAMED_ENTITIES = {
  nbsp: ' ', quot: '"', apos: "'", lt: '<', gt: '>', ndash: '–', mdash: '—', hellip: '…',
  bdquo: '„', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', sbquo: '‚', laquo: '«', raquo: '»', shy: '',
};
for (const [base, letters] of Object.entries({ acute: 'aeiouyl', uml: 'aeiou', circ: 'aeiou', caron: 'cdelnrstz' })) {
  for (const letter of letters) {
    NAMED_ENTITIES[letter + base] = letter.normalize('NFD') + { acute: '\u0301', uml: '\u0308', circ: '\u0302', caron: '\u030c' }[base];
    NAMED_ENTITIES[letter.toUpperCase() + base] = letter.toUpperCase() + { acute: '\u0301', uml: '\u0308', circ: '\u0302', caron: '\u030c' }[base];
  }
}

function decodeEntities(text) {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (entity, name) => NAMED_ENTITIES[name] ?? entity)
    .replace(/&amp;/gi, '&')
    .normalize('NFC');
}

function normalizeText(text) {
  return decodeEntities(String(text).replace(/<[^>]+>/g, ''))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Web pri alternatívach končí refrén slovom "alebo". Prázdny text, HTML ani nerozpoznaný kód
// neberieme: taký deň ostane chýbajúci a stiahne sa znova, namiesto zobrazenia na TV.
function cleanRefrain(raw) {
  const text = normalizeText(raw).replace(/\s+alebo\s*$/i, '').trim();
  if (!text || text.length > 300 || /[<>]|&[a-z#0-9]+;/i.test(text)) return null;
  return text;
}

export function extractRefrain(html) {
  const match = html.match(
    /<span[^>]*class=['"]lcRESP['"][^>]*>\s*R\.\s*:\s*<\/span>\s*<span[^>]*class=['"]lcVERS['"][^>]*>([\s\S]*?)<\/span>/i,
  );
  return match ? cleanRefrain(match[1]) : null;
}

// Vráti refrén, null keď ho stránka neobsahuje; pri výpadku siete vyhodí chybu
async function downloadRefrain(date) {
  const res = await fetch(SOURCE + date, {
    headers: { 'User-Agent': 'tvdisplay/1.0 (psalm-refrain-fetcher)' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return extractRefrain(await res.text());
}

function datesOfYear(year) {
  const dates = [];
  for (let d = new Date(Date.UTC(year, 0, 1)); d.getUTCFullYear() === year; d.setUTCDate(d.getUTCDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

function readEntries(file) {
  try {
    const content = JSON.parse(fs.readFileSync(file, 'utf8')).content;
    return Array.isArray(content) ? content : [];
  } catch {
    return [];
  }
}

export function createPsalmStore({ textyDir, psalmsDir, onUpdate = () => {} }) {
  const years = new Map(); // rok -> Map(dátum -> refrén)
  const status = { downloading: false, lastError: null };
  let timer = null;

  function loadYear(year) {
    if (years.has(year)) return years.get(year);
    const map = new Map();
    const files = [];
    // Názov môže byť zapísaný s rozloženým znakom Ž (po kopírovaní z macOS), Linux ich rozlišuje
    try {
      const wanted = `Žalmy ${year}.json`.normalize('NFC');
      files.push(...fs.readdirSync(textyDir).filter((f) => f.normalize('NFC') === wanted).map((f) => path.join(textyDir, f)));
    } catch {
      // priečinok chýba
    }
    files.push(path.join(psalmsDir, `${year}.json`));
    for (const file of files) {
      for (const item of readEntries(file)) {
        const refrain = Array.isArray(item?.strophes) ? cleanRefrain(item.strophes[0] ?? '') : null;
        if (item?.number && refrain) map.set(item.number, refrain);
      }
    }
    years.set(year, map);
    return map;
  }

  function saveYear(year) {
    const map = loadYear(year);
    const content = [...map.keys()].sort().map((date) => ({
      name: `${date} - ${map.get(date)}`,
      number: date,
      strophes: [map.get(date)],
    }));
    fs.mkdirSync(psalmsDir, { recursive: true });
    const file = path.join(psalmsDir, `${year}.json`);
    fs.writeFileSync(`${file}.tmp`, JSON.stringify({ name: `Žalmy ${year}`, content }, null, 2));
    fs.renameSync(`${file}.tmp`, file);
  }

  // Refrén na konkrétny deň; keď chýba, skúsi ho stiahnuť hneď
  async function getRefrain(date) {
    const year = date.slice(0, 4);
    const map = loadYear(year);
    if (map.has(date)) return map.get(date);
    try {
      const refrain = await downloadRefrain(date);
      if (!refrain) return null;
      map.set(date, refrain);
      saveYear(year);
      return refrain;
    } catch (e) {
      status.lastError = e.message;
      return null;
    }
  }

  // Dopĺňa chýbajúce dni, najskôr od dnešného dňa dopredu. Vráti false pri výpadku siete.
  async function syncOnce() {
    const today = new Date().toISOString().slice(0, 10);
    const thisYear = Number(today.slice(0, 4));
    const all = [...datesOfYear(thisYear), ...datesOfYear(thisYear + 1)];
    const missing = all.filter((date) => !loadYear(date.slice(0, 4)).has(date));
    const queue = [...missing.filter((d) => d >= today), ...missing.filter((d) => d < today)];
    if (!queue.length) return true;

    console.log(`[žalmy] Sťahujem ${queue.length} chýbajúcich dní`);
    status.downloading = true;
    const dirty = new Set();
    let unsaved = 0;
    const flush = () => {
      if (!unsaved) return;
      dirty.forEach(saveYear);
      dirty.clear();
      unsaved = 0;
      onUpdate();
    };

    try {
      for (const date of queue) {
        const refrain = await downloadRefrain(date);
        if (refrain) {
          const year = date.slice(0, 4);
          loadYear(year).set(date, refrain);
          dirty.add(year);
          unsaved += 1;
          if (unsaved >= SAVE_EVERY) flush();
        }
        await pause(REQUEST_DELAY_MS);
      }
      status.lastError = null;
      return true;
    } catch (e) {
      status.lastError = e.message;
      console.log(`[žalmy] Internet nie je dostupný (${e.message}), skúsim znova neskôr`);
      return false;
    } finally {
      flush();
      status.downloading = false;
    }
  }

  async function loop() {
    let online = false;
    try {
      online = await syncOnce();
    } catch (e) {
      console.error('[žalmy] Chyba:', e.message);
    }
    timer = setTimeout(loop, online ? RECHECK_MS : RETRY_OFFLINE_MS);
    timer.unref?.();
  }

  return {
    getRefrain,
    getYear(year) {
      const map = loadYear(year);
      return {
        name: `Žalmy ${year}`,
        content: [...map.keys()].sort().map((date) => ({ name: `${date} - ${map.get(date)}`, number: date, strophes: [map.get(date)] })),
      };
    },
    status: () => ({ ...status }),
    start() {
      timer = setTimeout(loop, 3000);
      timer.unref?.();
    },
  };
}
