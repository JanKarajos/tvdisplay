// Zdieľaný stav displeja. Server je zdroj pravdy a zmeny posiela cez WebSocket okamžite.
// Keď server nie je dostupný, stav sa drží v localStorage (funguje len v jednom prehliadači)
// a klient sa sám skúša znova pripojiť.
import { SERVER_URL, WS_URL } from '../config';
import { log } from '../lib/log';

const STORAGE_KEY = 'tvdisplay-api-state';
const PIN_KEY = 'tvdisplay-pin';

export const DEFAULT_STATE = {
  currentSongId: null,
  background: null,
  isHidden: false,
  currentPage: 0,
  selectedSongIds: [],
  nextSongId: null,
};

function readCache() {
  try {
    return { ...DEFAULT_STATE, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function writeCache(value) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // plný alebo zablokovaný localStorage nevadí
  }
}

let state = readCache();
// 'connecting' | 'online' | 'offline'
let status = 'connecting';
let authRequired = false;
let snapshot = { state, status, authRequired };
let ws = null;
let retryDelay = 1000;
let retryTimer = null;

const listeners = new Set();

function notify() {
  snapshot = { state, status, authRequired };
  listeners.forEach((cb) => cb());
}

function setState(next) {
  state = { ...DEFAULT_STATE, ...next };
  writeCache(state);
  notify();
}

function setStatus(next) {
  if (status === next) return;
  status = next;
  notify();
}

function scheduleReconnect() {
  clearTimeout(retryTimer);
  retryTimer = setTimeout(connect, retryDelay);
  retryDelay = Math.min(retryDelay * 2, 15000);
}

function connect() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  try {
    ws = new WebSocket(WS_URL);
  } catch {
    setStatus('offline');
    scheduleReconnect();
    return;
  }
  ws.onopen = () => {
    retryDelay = 1000;
    setStatus('online');
    log('[state] WebSocket pripojený');
  };
  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'state') setState(msg.state);
    } catch (e) {
      console.error('[state] Neplatná správa zo servera', e);
    }
  };
  ws.onclose = () => {
    setStatus('offline');
    scheduleReconnect();
  };
  ws.onerror = () => ws.close();
}

// Ostatné karty v tom istom prehliadači (fallback bez servera)
window.addEventListener('storage', (event) => {
  if (event.key !== STORAGE_KEY || status === 'online' || !event.newValue) return;
  try {
    state = { ...DEFAULT_STATE, ...JSON.parse(event.newValue) };
    notify();
  } catch {
    // ignoruj
  }
});

// Mobil po prebudení: hneď skús obnoviť spojenie
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && status !== 'online') {
    retryDelay = 1000;
    connect();
  }
});

connect();

export function getPin() {
  try {
    return localStorage.getItem(PIN_KEY) || '';
  } catch {
    return '';
  }
}

export function setPin(pin) {
  try {
    localStorage.setItem(PIN_KEY, pin);
  } catch {
    // ignoruj
  }
  authRequired = false;
  notify();
}

export function writeHeaders() {
  const pin = getPin();
  return { 'Content-Type': 'application/json', ...(pin ? { 'X-Control-Pin': pin } : {}) };
}

export function markAuthRequired() {
  authRequired = true;
  notify();
}

export const stateClient = {
  getState: () => state,
  getSnapshot: () => snapshot,
  subscribe(cb) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },

  // Pošle iba zmenené polia; server ich zlúči, takže súčasné zmeny z dvoch zariadení sa neprepíšu
  async patch(partial) {
    const previous = state;
    setState({ ...state, ...partial }); // optimisticky, aby UI reagovalo hneď
    if (status !== 'online') return state;
    try {
      const res = await fetch(`${SERVER_URL}/api/state`, {
        method: 'PATCH',
        headers: writeHeaders(),
        body: JSON.stringify(partial),
      });
      if (res.status === 401) {
        setState(previous);
        markAuthRequired();
        return state;
      }
      if (res.ok) setState(await res.json());
    } catch (e) {
      console.warn('[state] Server neodpovedá, zmena ostáva lokálne', e);
      setStatus('offline');
      scheduleReconnect();
    }
    return state;
  },
};
