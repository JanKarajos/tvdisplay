import { useEffect, useState } from 'react';
import { library } from '../api/api';

// Načíta pieseň/obrázok/PDF/žalm podľa id; znova po zmene knižnice
export function useSong(id, libraryVersion) {
  const [song, setSong] = useState(null);
  useEffect(() => {
    let cancelled = false;
    if (!id) {
      setSong(null);
      return undefined;
    }
    library.getSong(id).then((s) => {
      if (!cancelled) setSong(s);
    });
    return () => {
      cancelled = true;
    };
  }, [id, libraryVersion]);
  return song;
}
