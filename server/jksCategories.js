// Oddiely Jednotného katolíckeho spevníka (JKS) podľa čísla piesne.
// Zdroj rozsahov: https://sk.wikipedia.org/wiki/Jednotný_katolícky_spevník (časť Rozdelenie piesní).
// Používa ho server (administrácia), aplikácia (názvy a poradie kategórií) aj scripts/categorize_jks.js.
export const JKS_SECTIONS = [
  { id: 'adventne', name: 'Adventné', from: 1, to: 33 },
  { id: 'vianocne', name: 'Vianočné', from: 34, to: 113 },
  { id: 'meno-jezis', name: 'K menu Ježiš', from: 114, to: 120 },
  { id: 'postne', name: 'Pôstne', from: 121, to: 181 },
  { id: 'velky-tyzden', name: 'Veľký týždeň', from: 182, to: 191 },
  { id: 'velkonocne', name: 'Veľkonočné', from: 192, to: 212 },
  { id: 'nanebovstupenie', name: 'Nanebovstúpenie Pána', from: 213, to: 215 },
  { id: 'duch-svaty', name: 'Duch Svätý', from: 216, to: 219 },
  { id: 'najsvatejsia-trojica', name: 'Najsvätejšia Trojica', from: 220, to: 222 },
  { id: 'bozie-telo', name: 'Božie telo', from: 223, to: 226 },
  { id: 'srdce-jezisovo', name: 'Srdce Ježišovo', from: 227, to: 235 },
  { id: 'k-svatej-omsi', name: 'K svätej omši', from: 236, to: 259 },
  { id: 'eucharisticke', name: 'Eucharistické', from: 260, to: 299 },
  { id: 'svate-prijimanie', name: 'Sväté prijímanie', from: 300, to: 303 },
  { id: 'litanie', name: 'Litánie a antifóny', from: 304, to: 322 },
  { id: 'marianske', name: 'Mariánske', from: 323, to: 416 },
  { id: 'k-svatym', name: 'K svätým', from: 417, to: 459 },
  { id: 'za-zomrelych', name: 'Za zomrelých', from: 460, to: 483 },
  { id: 'kropenie', name: 'Kropenie svätenou vodou', from: 484, to: 484 },
  { id: 'prosebne', name: 'Prosebné', from: 485, to: 497 },
  { id: 'oslavne', name: 'Oslavné', from: 498, to: 504 },
  { id: 'prilezitostne', name: 'Príležitostné', from: 505, to: 526 },
  { id: 'zborove', name: 'Zborové', from: 527, to: 531 },
  { id: 'latinske', name: 'Latinské', from: 532, to: 543 },
];

// Ďalšie kategórie v songs.json, ktoré nie sú piesne JKS
export const OTHER_CATEGORIES = [
  { id: 'casti-omse', name: 'Časti omše' },
  { id: 'prosby', name: 'Prosby veriacich' },
  { id: 'adoracia', name: 'Adorácia' },
  { id: 'vlastne', name: 'Vlastné' },
];

// Názvy kategórií v poradí spevníka (poradie kľúčov = poradie zobrazenia)
export const CATEGORY_NAMES = Object.fromEntries([...JKS_SECTIONS, ...OTHER_CATEGORIES].map((c) => [c.id, c.name]));

// Kategória JKS pre číslo piesne; null, ak číslo do spevníka nepatrí
export function jksCategory(number) {
  const n = Number.parseInt(number, 10);
  if (!Number.isFinite(n) || String(n) !== String(number).trim()) return null;
  return JKS_SECTIONS.find((s) => n >= s.from && n <= s.to)?.id || null;
}

// Zoradí id kategórií podľa spevníka, neznáme (vlastné) idú na koniec v pôvodnom poradí
export function categoryOrder(id) {
  const index = Object.keys(CATEGORY_NAMES).indexOf(id);
  return index < 0 ? Number.MAX_SAFE_INTEGER : index;
}
