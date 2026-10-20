import { useEffect, useSyncExternalStore } from 'react';
import { library, loadLibrary } from '../api/api';

// { songs, images, presentations, categories, loaded, source, error }
export function useLibrary() {
  useEffect(() => {
    loadLibrary();
  }, []);
  return useSyncExternalStore(library.subscribe, library.getSnapshot);
}
