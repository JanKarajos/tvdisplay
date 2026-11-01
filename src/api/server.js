// Zistí, či aplikácia beží cez server/server.mjs (napr. na Orange Pi).
// Vtedy sa stav synchronizuje cez server medzi všetkými zariadeniami.
// Pri "npm run dev" server nie je, a stav sa synchronizuje cez localStorage (len v jednom prehliadači).
export const serverAvailable = fetch('/api/state', { cache: 'no-store' })
  .then(res => res.ok && (res.headers.get('content-type') || '').includes('application/json'))
  .catch(() => false);
