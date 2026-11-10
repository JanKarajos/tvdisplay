// Stiahne refrény responzóriových žalmov na celý rok z lc.kbs.sk (Liturgický kalendár KBS)
// a uloží ich do Texty/Žalmy RRRR.json.
//
//   node scripts/fetch_psalms.js 2027
//
// Pri dňoch s viacerými omšami (napr. Vianoce: v noci, na úsvite, počas dňa) alebo s možnosťou
// „alebo“ uloží všetky refrény do "options" ([{ label, refrain }]). "strophes[0]" je prvý refrén
// (kvôli starším verziám aplikácie).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const ENTITIES = { nbsp: ' ', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', thinsp: ' ', ndash: '–', mdash: '—' };
function decode(text) {
  return String(text)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+)(acute|caron|uml|circ|grave);/gi, (m, letter, mark) => {
      const marks = { acute: '́', caron: '̌', uml: '̈', circ: '̂', grave: '̀' };
      return (letter + marks[mark.toLowerCase()]).normalize('NFC');
    })
    .replace(/&scaron;/g, 'š').replace(/&Scaron;/g, 'Š')
    .replace(/&([a-z]+);/gi, (m, name) => (name in ENTITIES ? ENTITIES[name] : m));
}

const clean = (html) => decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

// Zo súhrnu dňa (pred plným textom čítaní) vyberie refrény žalmov a názvy omší
export function extractRefrains(html) {
  const summaryEnd = html.indexOf('<h4');
  const summary = summaryEnd > 0 ? html.slice(0, summaryEnd) : html;
  const options = [];
  const re = /<h3[^>]*lcSEKCIAtitul[^>]*>([\s\S]*?)<\/h3>|<span[^>]*class=['"]lcVERS['"][^>]*>([\s\S]*?)<\/p>/gi;
  let section = '';
  let inResp = false;
  let m;
  while ((m = re.exec(summary))) {
    if (m[1] !== undefined) {
      section = clean(m[1].split('<!DOCTYPE')[0]);
      continue;
    }
    // iba lcVERS hneď za "R.:" (refrén žalmu), nie verš pred evanjeliom
    const before = summary.slice(Math.max(0, m.index - 120), m.index);
    inResp = /lcRESP['"]>\s*R\.\s*:\s*<\/span>\s*$/i.test(before);
    if (!inResp) continue;
    const parts = m[2].split(/<span[^>]*class=['"]lcMOD['"][^>]*>\s*alebo\s*<\/span>/i).map(clean).filter(Boolean);
    parts.forEach((refrain, i) => {
      const label = [section, i > 0 ? 'alebo' : ''].filter(Boolean).join(' – ');
      if (!options.some((o) => o.refrain === refrain)) options.push({ label, refrain });
    });
  }
  // Rovnaký názov viackrát (Veľkonočná vigília má 7+ žalmov): doplň poradie
  const counts = {};
  options.forEach((o) => { counts[o.label] = (counts[o.label] || 0) + 1; });
  const seen = {};
  return options.map((o) => {
    if (!o.label || counts[o.label] < 2) return o;
    seen[o.label] = (seen[o.label] || 0) + 1;
    return { ...o, label: `${o.label} – ${seen[o.label]}. žalm` };
  });
}

async function fetchDay(date) {
  // PSALM_HTML_DIR: stránky stiahnuté vopred (napr. cez curl) ako RRRR-MM-DD.html
  if (process.env.PSALM_HTML_DIR) return fs.readFileSync(path.join(process.env.PSALM_HTML_DIR, `${date}.html`), 'utf8');
  const res = await fetch(`https://lc.kbs.sk/?den=${date}`, {
    headers: { 'User-Agent': 'Laudate/1.0 (psalm-refrain-fetcher)', Accept: 'text/html' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

const pad = (n) => String(n).padStart(2, '0');

async function main() {
  const year = Number(process.argv[2]);
  if (!year || year < 2000 || year > 2100) {
    console.error('Použitie: node scripts/fetch_psalms.js RRRR');
    process.exit(1);
  }
  const content = [];
  const missing = [];
  for (let d = new Date(Date.UTC(year, 0, 1)); d.getUTCFullYear() === year; d.setUTCDate(d.getUTCDate() + 1)) {
    const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    let options = [];
    for (let attempt = 0; attempt < 3 && !options.length; attempt++) {
      try {
        options = extractRefrains(await fetchDay(date));
      } catch (e) {
        if (attempt === 2) console.error(`${date}: ${e.message}`);
      }
    }
    if (!options.length) missing.push(date);
    const first = options[0]?.refrain || '';
    content.push({ name: `${date} - ${first}`, number: date, strophes: [first], ...(options.length > 1 ? { options } : {}) });
    if (options.length > 1) console.log(`${date}: ${options.length} refrény`);
    if (!process.env.PSALM_HTML_DIR) await new Promise((r) => setTimeout(r, 250));
  }
  const file = path.join(ROOT, 'Texty', `Žalmy ${year}.json`);
  fs.writeFileSync(file, `${JSON.stringify({ name: `Žalmy ${year}`, content }, null, 2)}\n`);
  console.log(`Uložené: ${file} (${content.length} dní, bez refrénu: ${missing.length ? missing.join(', ') : 'žiadny'})`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
