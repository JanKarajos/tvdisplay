// Ladiace výpisy sú vypnuté. Zapnutie: v konzole localStorage.setItem('tvdisplay-debug', '1') alebo ?debug v URL.
let enabled = false;
try {
  enabled = localStorage.getItem('tvdisplay-debug') === '1' || window.location.search.includes('debug');
} catch {
  // localStorage nemusí byť dostupný
}

export const log = (...args) => {
  if (enabled) console.log(...args);
};
