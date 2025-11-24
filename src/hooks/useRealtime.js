import { useEffect } from 'react';
export function createMockRealtime() {
  const listeners = new Set();
  
  // Listen for storage events to sync across tabs/windows
  window.addEventListener('storage', (event) => {
    if (event.key === 'tvdisplay-api-state') {
      try {
        const stateData = JSON.parse(event.newValue);
        const payload = { type: 'state', state: stateData };
        console.log('[Realtime] Storage event received:', payload);
        listeners.forEach(cb => cb(payload));
      } catch (e) {
        console.error('Failed to parse state:', e);
      }
    }
  });

  // Initial state load
  try {
    const savedState = localStorage.getItem('tvdisplay-api-state');
    if (savedState) {
      const stateData = JSON.parse(savedState);
      const payload = { type: 'state', state: stateData };
      setTimeout(() => {
        listeners.forEach(cb => cb(payload));
      }, 0);
    }
  } catch (e) {
    console.error('Failed to load initial state:', e);
  }

  return {
    on: (cb) => { 
      listeners.add(cb); 
      return () => listeners.delete(cb); 
    },
    emit: (payload) => {
      console.log('[Realtime] Emitting:', payload);
      // Zavolaj všetkých listenerov priamo (pre rovnakú stránku)
      listeners.forEach(cb => cb(payload));
      // storage event sa aktivuje len medzi rôznymi oknami/kartami,
      // takže pre lokálnu synchronizáciu voláme listenery priamo
    }
  };
}
export const realtime = createMockRealtime();
export function useRealtime(cb) {
  useEffect(() => { 
    console.log('Setting up realtime listener');
    const off = realtime.on((payload) => {
      console.log('Realtime update received:', payload);
      cb(payload);
    }); 
    return () => {
      console.log('Cleaning up realtime listener');
      off();
    };
  }, [cb]);
}
