// Text rozpoznaný z fotky strany spevníka -> číslo, názov a strofy piesne.
// Strofy sa delia podľa čísel "1.", "2." na začiatku riadku, inak podľa prázdnych riadkov.

// "1. Text", "1) Text" aj "1 Text" (rozpoznávanie bodku za číslom niekedy vynechá)
const STROPHE = /^(\d{1,2})(?:\s*[.)]\s*|\s+(?=\p{Lu}))(\S.*)$/u;
const HEADING = /^(\d{1,4})\s*[.)]?\s+(\p{Lu}.{2,60})$/u;

function cleanLine(line) {
  let out = line
    .normalize('NFC')
    .replace(/ﬁ/g, 'fi')
    .replace(/ﬂ/g, 'fl')
    .replace(/[|_~«»]/g, ' ')
    .replace(/[‘’`]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/\s{2,}/g, ' ')
    .trim();
  // slabiky pod notami: "ra - dost - ne" -> "radostne" (iba keď je takých miest v riadku viac,
  // jedna pomlčka býva interpunkcia: "Pane - ty si")
  if ((out.match(/\p{L} ?- ?\p{Ll}/gu) || []).length >= 2) out = out.replace(/(\p{L}) ?- ?(?=\p{Ll})/gu, '$1');
  // spojka "a" prečítaná ako číslica: "hladom 4 biedou"
  out = out.replace(/(\p{L}) 4 (?=\p{L})/gu, '$1 a ');
  // predložka uprostred vety prečítaná veľkým písmenom (rovnaký tvar): "každý Z nás" -> "každý z nás"
  out = out.replace(/(\p{Ll},? )([ZSVOK])(?= \p{L})/gu, (m, before, letter) => before + letter.toLowerCase());
  return markSpeaker(out);
}

// Značky v pobožnostiach (K. kňaz, Ľ. ľud, V. všetci) sú v spevníku červené a rozpoznávanie ich
// často prečíta zle ("[.", "r.", "L,", "x"). Zjednotia sa na zápis "K:", "Ľ:", "V:" ako v ostatných textoch.
const SPEAKER = [
  [/^(?:K|k)\s*[.,:;]\s*(?=\S)/u, 'K: '],
  [/^[xX]\s+(?=\p{Lu})/u, 'K: '],
  [/^(?:Ľ|Ĺ|ľ|L|l|I|\[|\]|\||r|f|t)\s*[.,:;]\s*(?=\S)/u, 'Ľ: '],
  [/^(?:Ľ|Ĺ)\s+(?=\S)/u, 'Ľ: '],
  [/^V\s*[.,:;]\s*(?=\S)/u, 'V: '],
];
function markSpeaker(line) {
  for (const [re, mark] of SPEAKER) if (re.test(line)) return line.replace(re, mark);
  return line;
}
const SPEAKER_LINE = /^[KĽV]: /u;

// Riadok takmer bez písmen alebo zo samých úlomkov (číslo strany, šum, kúsky zakriveného okraja) sa vynechá
const SHORT_WORDS = new Set('a i k o s u v z do na za po od sa si ti ťa mi ma je ja my vy on ju ho mu že by aj ak no tu či ku so zo vo ba to ty ó'.split(' '));
function isNoise(line) {
  if ((line.match(/\p{L}/gu) || []).length < 3) return true;
  const words = line.replace(/^[KĽV]: /u, '').split(/\s+/).filter(Boolean);
  const real = words.filter((w) => {
    const letters = w.replace(/[^\p{L}]/gu, '');
    return letters.length >= 3 || SHORT_WORDS.has(letters.toLowerCase());
  });
  return words.length >= 2 && real.length / words.length < 0.5;
}

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
    // (číslo 1 na začiatku je skôr prvá strofa ako pieseň č. 1)
    if (!title && !content.some(Boolean)) {
      // nadpis veľkými písmenami: "ZASVÄTENIE ĽUDSKÉHO POKOLENIA"
      const letters = line.match(/\p{L}/gu) || [];
      const upper = letters.filter((c) => c === c.toUpperCase() && c !== c.toLowerCase()).length;
      if (letters.length >= 8 && upper / letters.length >= 0.8 && /\s/.test(line) && !SPEAKER_LINE.test(line)) {
        const lower = line.toLowerCase().replace(/[.,:;]+$/, '');
        title = lower.charAt(0).toUpperCase() + lower.slice(1);
        continue;
      }
      const h = HEADING.exec(line);
      if (h && h[1] !== '1' && !(STROPHE.test(line) && /^\d\s*[.)]/.test(line))) {
        number = h[1];
        title = h[2].trim();
        continue;
      }
    }
    content.push(line);
  }

  const numbered = content.filter((l) => STROPHE.test(l)).length >= 2;
  // Pobožnosť so značkami K:/Ľ: – každá strana začína kňazom (K: a odpoveď Ľ: sú spolu)
  const responsorial = !numbered && content.filter((l) => SPEAKER_LINE.test(l)).length >= 2;
  const strophes = [];
  let current = [];
  const flush = () => {
    if (current.length) strophes.push(current.join('\n'));
    current = [];
  };
  for (const line of content) {
    const m = STROPHE.exec(line);
    if (responsorial) {
      if (/^[KV]: /u.test(line)) flush();
      if (line) current.push(line);
    } else if (numbered) {
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
    title = strophes[0].split('\n')[0].replace(SPEAKER_LINE, '').replace(/[,.;:!?]+$/, '');
  }
  return { number, title, lyrics: strophes.join('\n\n') };
}
