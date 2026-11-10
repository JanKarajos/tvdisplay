// Doplní kostolu všetky piesne a texty z priečinka Texty/ a zaradí ich do kategórií podľa súborov
// (1. JKS, 2. Žalmy, 3. Prosby, … 10.1 Hlásenia …). Nič neprepíše: piesne, ktoré kostol už má
// (aj upravené), si nechajú text a dostanú len kategóriu súboru, v ktorom sú.
//
//   node scripts/merge_texty.mjs <songs.json kostola> [výstupný priečinok]
//
// Výsledok: songs.json a categories.json – nahrajú sa do priečinka kostola na NAS
// (napr. tvdisplay/zdana) namiesto pôvodných.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEXTY = path.join(ROOT, 'Texty');

const [songsFile, outDir = '.'] = process.argv.slice(2);
if (!songsFile) {
  console.error('Použitie: node scripts/merge_texty.mjs <songs.json kostola> [výstupný priečinok]');
  process.exit(1);
}

const norm = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const slug = (t) => norm(t).replace(/ /g, '-') || 'kategoria';
// "4.1 Liturg. spevy SK" → [4, 1]; súbory bez čísla idú na koniec
const orderKey = (name) => {
  const m = name.match(/^(\d+)(?:\.(\d+))?/);
  return m ? [Number(m[1]), Number(m[2] || 0)] : [1e9, 0];
};

// --- Súbory v Texty/ (bez denných žalmov "Žalmy RRRR") ---------------------
const collections = new Map(); // NFC názov -> položky (rovnaký názov v inom zápise diakritiky sa spojí)
for (const file of fs.readdirSync(TEXTY)) {
  if (!file.endsWith('.json')) continue;
  const name = file.normalize('NFC').replace(/\.json$/, '');
  if (/^Žalmy \d{4}$/.test(name)) continue;
  let data;
  try {
    data = JSON.parse(fs.readFileSync(path.join(TEXTY, file), 'utf8'));
  } catch (e) {
    console.warn(`Preskakujem ${file}: ${e.message}`);
    continue;
  }
  const items = Array.isArray(data?.content) ? data.content : Array.isArray(data) ? data : [];
  if (!items.length) continue;
  collections.set(name, [...(collections.get(name) || []), ...items]);
}
const names = [...collections.keys()].sort((a, b) => {
  const [a1, a2] = orderKey(a);
  const [b1, b2] = orderKey(b);
  return a1 - b1 || a2 - b2 || a.localeCompare(b, 'sk');
});
const categories = names.map((name) => ({ id: slug(name), name }));

const lyricsOf = (item) => (Array.isArray(item.strophes) ? item.strophes : [])
  .map((s) => String(s || '').replace(/\r/g, '').trim())
  .filter(Boolean)
  .join('\n\n');
const numberOf = (item) => {
  const n = String(item.number ?? '').trim();
  return n === '0' ? '' : n;
};

// Všetky položky v poradí kategórií
const entries = [];
for (const name of names) {
  const category = slug(name);
  for (const item of collections.get(name)) {
    const title = String(item.name || '').trim();
    const lyrics = lyricsOf(item);
    if (!lyrics) continue; // bez textu nie je čo zobraziť
    entries.push({ category, title: title || lyrics.split('\n')[0].slice(0, 60), number: numberOf(item), lyrics, claimed: false });
  }
}

// --- Piesne kostola: priradenie k položkám zo súborov ----------------------
const church = JSON.parse(fs.readFileSync(songsFile, 'utf8'));
if (!Array.isArray(church)) throw new Error('songs.json kostola nie je zoznam');
const byTitle = new Map();
for (const e of entries) {
  const key = norm(e.title);
  if (!byTitle.has(key)) byTitle.set(key, []);
  byTitle.get(key).push(e);
}

let recategorized = 0;
const kept = [];
for (const song of church) {
  if (song.type === 'pdf' || song.fromFile) { kept.push(song); continue; }
  const number = String(song.number ?? '').trim();
  let candidates = (byTitle.get(norm(song.title)) || []).filter((e) => !e.claimed);
  // Rovnaká pieseň JKS s mierne iným názvom ("anjeli" / "anjelia"): podľa čísla a začiatku názvu
  if (!candidates.length && number) {
    candidates = entries.filter((e) => !e.claimed && e.number === number && norm(e.title).slice(0, 12) === norm(song.title).slice(0, 12));
  }
  const match = candidates.find((e) => e.number === number) || candidates[0];
  if (match) {
    match.claimed = true;
    if (song.category !== match.category) recategorized++;
    kept.push({ ...song, category: match.category });
  } else {
    kept.push(song);
  }
}

// --- Nové piesne: všetko zo súborov, čo kostol ešte nemá -------------------
const usedIds = new Set(church.map((s) => s.id));
const counters = {};
const added = [];
for (const e of entries) {
  if (e.claimed) continue;
  // Rovnaká položka dvakrát v tom istom súbore (rovnaký názov aj text) sa pridá raz
  if (added.some((a) => a.category === e.category && norm(a.title) === norm(e.title) && a.lyrics === e.lyrics)) continue;
  let id;
  do {
    counters[e.category] = (counters[e.category] || 0) + 1;
    id = `t-${e.category}-${counters[e.category]}`;
  } while (usedIds.has(id));
  usedIds.add(id);
  added.push({ id, title: e.title, category: e.category, number: e.number, lyrics: e.lyrics });
}

const songs = [...kept, ...added];
const known = new Set(categories.map((c) => c.id));
const leftover = [...new Set(songs.map((s) => s.category).filter((c) => c && !known.has(c)))];

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'songs.json'), `${JSON.stringify(songs, null, 2)}\n`);
fs.writeFileSync(path.join(outDir, 'categories.json'), `${JSON.stringify(categories, null, 2)}\n`);

console.log(`Pôvodne: ${church.length} piesní, preradených do kategórií zo súborov: ${recategorized}, pridaných: ${added.length}, spolu: ${songs.length}`);
const counts = Object.fromEntries(categories.map((c) => [c.name, songs.filter((s) => s.category === c.id).length]));
for (const [name, n] of Object.entries(counts)) console.log(`  ${name}: ${n}`);
if (leftover.length) console.log(`Piesne mimo súborov ostali v kategóriách: ${leftover.join(', ')}`);
