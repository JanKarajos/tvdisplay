// Liturgické obdobie podľa dátumu a farebné témy pre TV

function easterSunday(year) {
  // Gregoriánsky výpočet (Meeus/Jones/Butcher)
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

const addDays = (date, n) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);

function firstAdventSunday(year) {
  const christmas = new Date(year, 11, 25);
  return addDays(christmas, -(christmas.getDay() || 7) - 21);
}

function baptismOfTheLord(year) {
  // Nedeľa po Zjavení Pána (6. 1.)
  const epiphany = new Date(year, 0, 6);
  return addDays(epiphany, 7 - epiphany.getDay());
}

export function liturgicalSeason(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const year = d.getFullYear();
  const easter = easterSunday(year);
  if (d >= new Date(year, 11, 25) || d <= baptismOfTheLord(year)) return 'christmas';
  if (d >= firstAdventSunday(year)) return 'advent';
  if (d >= addDays(easter, -46) && d < easter) return 'lent';
  if (d >= easter && d <= addDays(easter, 49)) return 'easter';
  return 'ordinary';
}

// accent = farba nadpisu a ukazovateľa strof; background = pozadie za textom
export const THEMES = {
  none: { name: 'Čierna', accent: '#d4d4d8', background: '#000' },
  ordinary: {
    name: 'Cez rok (zelená)',
    accent: '#86efac',
    background: 'radial-gradient(ellipse at 50% 120%, #0f3d24 0%, #04140b 55%, #000 100%)',
  },
  advent: {
    name: 'Advent (fialová)',
    accent: '#c4b5fd',
    background: 'radial-gradient(ellipse at 50% 120%, #2e1a5c 0%, #0e0820 55%, #000 100%)',
  },
  christmas: {
    name: 'Vianoce (zlatá)',
    accent: '#fcd34d',
    background: 'radial-gradient(ellipse at 50% 120%, #4a3410 0%, #170f03 55%, #000 100%)',
  },
  lent: {
    name: 'Pôst (fialová)',
    accent: '#d8b4fe',
    background: 'radial-gradient(ellipse at 50% 120%, #2b1238 0%, #0d0512 55%, #000 100%)',
  },
  easter: {
    name: 'Veľká noc (biela a zlatá)',
    accent: '#fde68a',
    background: 'radial-gradient(ellipse at 50% 120%, #4b4320 0%, #15130a 55%, #000 100%)',
  },
};

export function resolveTheme(setting, date = new Date()) {
  const id = !setting || setting === 'auto' ? liturgicalSeason(date) : setting;
  return { id, ...(THEMES[id] || THEMES.none) };
}
