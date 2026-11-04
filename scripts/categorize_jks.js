// Rozdelí piesne v songs.json do kategórií:
//   - piesne s číslom JKS podľa oddielov spevníka (server/jksCategories.js)
//   - zvolania k prosbám (Texty/3. Prosby.json z histórie) -> "prosby"
//   - časti omše (Sláva, Verím, Svätý, Baránok, Otče náš, kánon) -> "casti-omse"
// Ostatné piesne (vlastné, adorácia) ostanú v pôvodnej kategórii.
// Spustenie:  node scripts/categorize_jks.js [songs.json]
import fs from 'node:fs';
import { jksCategory } from '../server/jksCategories.js';

const file = process.argv[2] || 'songs.json';
const songs = JSON.parse(fs.readFileSync(file, 'utf8'));

const MASS_PARTS = /^(slava bohu|svaty|baranok bozi|otce nas, ktory si|apostolske vyznanie|nicejsko|detsky kanon)/;
const plain = (text) => String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const counts = {};
for (const song of songs) {
  if (song.type === 'pdf' || !song.category) continue;
  let category = jksCategory(song.number);
  if (!category && song.category === 'vseobecne') {
    // Časti omše majú celý text; krátke zvolanie (napr. "Baránok Boží, zmiluj sa nad nami.") je zvolanie k prosbám
    category = MASS_PARTS.test(plain(song.title)) && song.lyrics.length > 80 ? 'casti-omse' : 'prosby';
  }
  if (category && category !== song.category) {
    counts[`${song.category} -> ${category}`] = (counts[`${song.category} -> ${category}`] || 0) + 1;
    song.category = category;
  }
}

fs.writeFileSync(file, JSON.stringify(songs, null, 2));
console.log(counts);
