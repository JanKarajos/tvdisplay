// Vyčistí text zo spevníkov: \r, tabulátory, nezlomiteľné a viacnásobné medzery, mäkké delenie
// a medzery na konci riadkov – inak sa na TV text zle zalamuje a písmo vychádza zbytočne malé
export function cleanLyrics(lyrics) {
  return String(lyrics || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\t\u00a0\u2000-\u200a\u202f\u205f\u3000]/g, ' ')
    .replace(/[\u00ad\u200b-\u200d\ufeff]/g, '')
    .split('\n')
    .map((line) => line.replace(/ {2,}/g, ' ').trim())
    .join('\n');
}

// Rozdelí text piesne na strany podľa strof (oddelené prázdnym riadkom)
export function splitIntoPages(lyrics) {
  if (!lyrics) return [];
  const pages = [];
  let stanza = [];
  for (const line of cleanLyrics(lyrics).split('\n')) {
    if (line.trim()) {
      stanza.push(line);
    } else if (stanza.length) {
      pages.push(stanza);
      stanza = [];
    }
  }
  if (stanza.length) pages.push(stanza);
  return pages;
}

export function getPageCount(song) {
  if (!song) return 0;
  if (song.pdfUrl) return Math.max(1, Number(song.pageCount) || 1);
  return splitIntoPages(song.lyrics).length;
}

// Odstráni diakritiku a interpunkciu pre vyhľadávanie
export function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
