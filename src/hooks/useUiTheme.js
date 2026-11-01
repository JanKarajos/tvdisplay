import { useEffect, useState } from 'react';

const KEY = 'tvdisplay-ui-theme';

function read() {
  try {
    return localStorage.getItem(KEY) || 'system';
  } catch {
    return 'system';
  }
}

// Svetlý/tmavý režim ovládania: 'system' | 'light' | 'dark'
export function useUiTheme() {
  const [mode, setMode] = useState(read);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = mode === 'dark' || (mode === 'system' && media.matches);
      document.documentElement.classList.toggle('dark', dark);
    };
    apply();
    try {
      localStorage.setItem(KEY, mode);
    } catch {
      // ignoruj
    }
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [mode]);

  const cycle = () => setMode((m) => ({ system: 'dark', dark: 'light', light: 'system' }[m]));
  return { mode, cycle };
}
