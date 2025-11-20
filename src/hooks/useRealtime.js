import { useEffect } from 'react';
export function createMockRealtime() {
  const listeners = new Set();
  
  // Listen for storage events to sync across tabs/windows
  window.addEventListener('storage', (event) => {
    if (event.key === 'tvdisplay-state') {
      try {
        const payload = JSON.parse(event.newValue);
        listeners.forEach(cb => cb(payload));
      } catch (e) {
        console.error('Failed to parse state:', e);
      }
    }
  });

  // Initial state load
  try {
    const savedState = localStorage.getItem('tvdisplay-state');
    if (savedState) {
      const payload = JSON.parse(savedState);
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
      localStorage.setItem('tvdisplay-state', JSON.stringify(payload));
      listeners.forEach(cb => cb(payload));
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
