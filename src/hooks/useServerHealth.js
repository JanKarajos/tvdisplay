import { timeoutSignal } from '../lib/net';
import { useEffect, useState } from 'react';
import { SERVER_URL } from '../config';

// Stav servera (PIN, GitHub token). null = server nedostupný.
export function useServerHealth(status) {
  const [health, setHealth] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`${SERVER_URL}/health`, { signal: timeoutSignal(3000) })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((h) => { if (!cancelled) setHealth(h); });
    return () => { cancelled = true; };
  }, [status]);
  return health;
}
