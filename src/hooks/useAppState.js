import { useSyncExternalStore } from 'react';
import { stateClient } from '../api/stateClient';

// { state, status: 'connecting'|'online'|'offline', authRequired }
export function useAppState() {
  return useSyncExternalStore(stateClient.subscribe, stateClient.getSnapshot);
}
