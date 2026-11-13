// Funkcie, ktoré sa dajú pre zariadenie v kostole zapnúť alebo vypnúť.
// Nastavujú sa v administrácii (features.json v priečinku kostola) alebo voľbami inštalátora
// (LAUDATE_FEATURES v .env). Vypnutá funkcia sa v ovládaní nezobrazí, server ju odmietne
// a inštalátor nestiahne jej balíky.
export const FEATURES = [
  { id: 'tv', label: 'Ovládanie televízora Samsung', hint: 'Zapnutie, vypnutie a program cez Wi-Fi', option: 'tv' },
  { id: 'photo', label: 'Pieseň z fotky', hint: 'Rozpoznanie textu z fotky spevníka (balík Tesseract, ~30 MB)', option: 'foto' },
  { id: 'audio', label: 'Hudobný sprievod', hint: 'Prehrávanie nahrávok do ozvučenia (ffmpeg, ~150 MB)', option: 'sprievod' },
  { id: 'presentations', label: 'Prezentácie (PDF)', hint: 'Nahrávanie a zobrazovanie prezentácií', option: 'prezentacie' },
  { id: 'powerpoint', label: 'Prevod PowerPointu', hint: 'PPT/PPTX sa prevedú na PDF (LibreOffice, ~500 MB)', option: 'powerpoint' },
];

export const DEFAULT_FEATURES = Object.fromEntries(FEATURES.map((f) => [f.id, true]));

// Iba známe kľúče s hodnotou true/false
export function cleanFeatures(obj) {
  const out = {};
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return out;
  for (const f of FEATURES) if (typeof obj[f.id] === 'boolean') out[f.id] = obj[f.id];
  return out;
}

// LAUDATE_FEATURES = zoznam zapnutých funkcií, napr. "tv,photo" (slovenské názvy z inštalátora tiež);
// "none" = všetko vypnuté. Nenastavené = null (rozhoduje administrácia, inak všetko zapnuté).
export function parseFeatureList(value) {
  if (value == null || !String(value).trim()) return null;
  const items = String(value).split(/[\s,]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  const on = new Set(items.map((i) => FEATURES.find((f) => f.id === i || f.option === i)?.id).filter(Boolean));
  return Object.fromEntries(FEATURES.map((f) => [f.id, on.has(f.id)]));
}

// Výsledok: predvolené <- inštalátor <- administrácia (zdieľané nastavenie má prednosť)
export function effectiveFeatures(local, remote) {
  const features = { ...DEFAULT_FEATURES, ...cleanFeatures(local), ...cleanFeatures(remote) };
  if (!features.presentations) features.powerpoint = false;
  return features;
}
