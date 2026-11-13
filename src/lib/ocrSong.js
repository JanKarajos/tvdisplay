// Text rozpoznaný z fotky strany spevníka -> číslo, názov a strofy piesne.
// Strofy sa delia podľa čísel "1.", "2." na začiatku riadku, inak podľa prázdnych riadkov.

const STROPHE = /^(\d{1,2})\s*[.)]\s*(\S.*)$/;
const HEADING = /^(\d{1,4})\s*[.)]?\s+(\p{Lu}.{2,60})$/u;

function cleanLine(line) {
  let out = line
    .replace(/[|_~«»]/g, ' ')
    .replace(/[‘’`]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/\s{2,}/g, ' ')
    .trim();
  // slabiky pod notami: "ra - dost - ne" -> "radostne" (iba keď je takých miest v riadku viac,
  // jedna pomlčka býva interpunkcia: "Pane - ty si")
  if ((out.match(/\p{L} ?- ?\p{Ll}/gu) || []).length >= 2) out = out.replace(/(\p{L}) ?- ?(?=\p{Ll})/gu, '$1');
  return out;
}

// Riadok bez písmen (číslo strany, šum z fotky) sa vynechá
const isNoise = (line) => (line.match(/\p{L}/gu) || []).length < 2;

export function songFromOcr(text) {
  const raw = String(text || '').replace(/\r\n?/g, '\n').replace(/\f/g, '\n').split('\n').map(cleanLine);

  // Rozdelené slovo na konci riadku: "milo-" + "srdenstvo"
  const lines = [];
  for (const line of raw) {
    const prev = lines[lines.length - 1];
    if (prev && /\p{L}-$/u.test(prev) && /^\p{Ll}/u.test(line)) lines[lines.length - 1] = prev.slice(0, -1) + line;
    else lines.push(line);
  }

  let number = '';
  let title = '';
  const content = [];
  for (const line of lines) {
    if (!line) {
      content.push('');
      continue;
    }
    if (isNoise(line)) continue;
    // Prvý riadok "123 Názov piesne" (pred prvou strofou)
    if (!title && !content.some(Boolean) && !STROPHE.test(line)) {
      const h = HEADING.exec(line);
      if (h) {
        number = h[1];
        title = h[2].trim();
        continue;
      }
    }
    content.push(line);
  }

  const numbered = content.filter((l) => STROPHE.test(l)).length >= 2;
  const strophes = [];
  let current = [];
  const flush = () => {
    if (current.length) strophes.push(current.join('\n'));
    current = [];
  };
  for (const line of content) {
    const m = STROPHE.exec(line);
    if (numbered) {
      if (m) {
        flush();
        current.push(m[2]);
      } else if (line) current.push(line);
    } else if (!line) flush();
    else current.push(m ? m[2] : line);
  }
  flush();

  if (!title && strophes.length) {
    // názov podľa prvého riadku textu (ako v spevníku)
    title = strophes[0].split('\n')[0].replace(/[,.;:!?]+$/, '');
  }
  return { number, title, lyrics: strophes.join('\n\n') };
}
