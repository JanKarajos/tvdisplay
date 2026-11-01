// Rozdelí text piesne na strany podľa strof (oddelené prázdnym riadkom)
export function splitIntoPages(lyrics) {
  if (!lyrics) return [];
  const pages = [];
  let stanza = [];
  for (const line of lyrics.split('\n')) {
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
