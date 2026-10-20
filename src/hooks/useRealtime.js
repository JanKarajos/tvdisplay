import { useEffect } from 'react';
import { stateClient } from '../api/stateClient';

// Spätná kompatibilita pre ControlPageLegacy: cb dostane { type: 'state', state }
export function useRealtime(cb) {
  useEffect(() => {
    let last = stateClient.getState();
    return stateClient.subscribe(() => {
      const next = stateClient.getState();
      if (next !== last) {
        last = next;
        cb({ type: 'state', state: next });
      }
    });
  }, [cb]);
}
