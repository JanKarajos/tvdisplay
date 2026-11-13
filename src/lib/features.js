// Funkcie zapnuté pre zariadenie v kostole (z /health: administrácia alebo inštalátor).
// Kým server neodpovie (alebo je starší), všetko sa zobrazuje.
import { useSyncExternalStore } from 'react';

let features = {};
const listeners = new Set();

export function setFeatures(next) {
  const value = next && typeof next === 'object' ? next : {};
  if (JSON.stringify(value) === JSON.stringify(features)) return;
  features = value;
  for (const l of listeners) l();
}

const subscribe = (cb) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

// has('audio') -> false iba keď je funkcia výslovne vypnutá
export function useFeature(id) {
  return useSyncExternalStore(subscribe, () => features[id] !== false);
}
