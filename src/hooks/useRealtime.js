import { useEffect } from 'react';

// State server URL
const STATE_SERVER_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:3002' 
  : `http://${window.location.hostname}:3002`;

export function createMockRealtime() {
  const listeners = new Set();
  let pollingInterval = null;
  let lastState = null;
  let useServerSync = false;

  // Skontroluj dostupnosť state servera
  const checkServerAvailability = async () => {
    try {
      const response = await fetch(`${STATE_SERVER_URL}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000)
      });
      if (response.ok) {
        useServerSync = true;
        console.log('✅ State server je dostupný - používam server synchronizáciu');
        startPolling();
        return true;
      }
    } catch (error) {
      console.log('⚠️ State server nie je dostupný - používam localStorage');
    }
    useServerSync = false;
    setupLocalStorageSync();
    return false;
  };

  // Polling pre zmeny na serveri
  const startPolling = () => {
    if (pollingInterval) return;
    
    // Poll každé 2 sekundy
    pollingInterval = setInterval(async () => {
      try {
        const response = await fetch(`${STATE_SERVER_URL}/api/state`);
        if (response.ok) {
          const serverState = await response.json();
          
          // Skontroluj, či sa stav zmenil
          const stateChanged = !lastState || 
            JSON.stringify(serverState) !== JSON.stringify(lastState);
          
          if (stateChanged) {
            lastState = serverState;
            const payload = { type: 'state', state: serverState };
            console.log('[Realtime] Server state update:', payload);
            listeners.forEach(cb => cb(payload));
            
            // Aktualizuj aj localStorage pre fallback
            try {
              localStorage.setItem('tvdisplay-api-state', JSON.stringify(serverState));
            } catch (e) {}
          }
        }
      } catch (error) {
        // Server nie je dostupný, prepni na localStorage
        if (useServerSync) {
          console.log('⚠️ State server neodpovedá, prepínam na localStorage');
          useServerSync = false;
          setupLocalStorageSync();
          if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
          }
        }
      }
    }, 2000);
  };

  // Lokálna synchronizácia cez localStorage (fallback)
  const setupLocalStorageSync = () => {
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
  };

  // Initial state load
  const loadInitialState = async () => {
    if (useServerSync) {
      try {
        const response = await fetch(`${STATE_SERVER_URL}/api/state`);
        if (response.ok) {
          const serverState = await response.json();
          lastState = serverState;
          const payload = { type: 'state', state: serverState };
          setTimeout(() => {
            listeners.forEach(cb => cb(payload));
          }, 100);
          return;
        }
      } catch (e) {}
    }
    
    // Fallback na localStorage
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
  };

  // Inicializácia
  checkServerAvailability().then(loadInitialState);

  return {
    on: (cb) => { 
      listeners.add(cb); 
      return () => listeners.delete(cb); 
    },
    emit: async (payload) => {
      console.log('[Realtime] Emitting:', payload);
      
      if (useServerSync && payload.type === 'state') {
        // Pošli na server
        try {
          await fetch(`${STATE_SERVER_URL}/api/state`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload.state)
          });
          console.log('[Realtime] State sent to server');
          // Server polling sa postará o update všetkých klientov
        } catch (error) {
          console.error('[Realtime] Failed to send state to server:', error);
          // Fallback na localStorage
          useServerSync = false;
          localStorage.setItem('tvdisplay-api-state', JSON.stringify(payload.state));
        }
      }
      
      // Zavolaj lokálnych listenerov
      listeners.forEach(cb => cb(payload));
    },
    cleanup: () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
      }
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
