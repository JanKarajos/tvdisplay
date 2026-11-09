import React, { useEffect, useState } from 'react';
import Stage from '../components/Stage';
import { useAppState } from '../hooks/useAppState';
import { useLibrary } from '../hooks/useLibrary';
import { useSong } from '../hooks/useSong';
import { stateClient, enableAutoReload } from '../api/stateClient';
import { getPageCount } from '../lib/lyrics';
import { getRotation, rotationStyle } from '../lib/rotation';

export default function DisplayPage() {
  const { state, status } = useAppState();
  const lib = useLibrary();
  const song = useSong(state.currentSongId, lib);
  const [showOffline, setShowOffline] = useState(false);

  useEffect(() => enableAutoReload(), []);

  // Pieseň je vybraná, ale TV ju nevie načítať – po chvíli ukáž dôvod (inak by TV len mlčala)
  const missing = Boolean(state.currentSongId) && !song && lib.loaded;
  const [showMissing, setShowMissing] = useState(false);
  useEffect(() => {
    setShowMissing(false);
    if (!missing) return undefined;
    const t = setTimeout(() => setShowMissing(true), 6000);
    return () => clearTimeout(t);
  }, [missing, state.currentSongId]);

  // Indikátor výpadku až po 5 s, aby krátke odpojenia nerušili
  useEffect(() => {
    if (status === 'online') {
      setShowOffline(false);
      return undefined;
    }
    const t = setTimeout(() => setShowOffline(true), 5000);
    return () => clearTimeout(t);
  }, [status]);

  // Klávesnica / kliker priamo pri TV – mení zdieľaný stav, takže ovládanie ostane v súlade
  useEffect(() => {
    const onKey = (e) => {
      const s = stateClient.getState();
      const last = Math.max(0, getPageCount(song) - 1);
      const page = s.currentPage || 0;
      if (['ArrowRight', 'PageDown', ' '].includes(e.key)) stateClient.patch({ currentPage: Math.min(page + 1, last) });
      else if (['ArrowLeft', 'PageUp'].includes(e.key)) stateClient.patch({ currentPage: Math.max(page - 1, 0) });
      else if (e.key === 'Home') stateClient.patch({ currentPage: 0 });
      else if (e.key === 'End') stateClient.patch({ currentPage: last });
      else if (e.key === 'f') document.documentElement.requestFullscreen?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [song]);

  return (
    <div className="fixed inset-0 bg-black cursor-none select-none">
      <div style={rotationStyle(getRotation(state.settings))}>
        <Stage state={state} song={state.currentSongId ? song : null} />
      </div>
      {showMissing && (
        <div className="absolute bottom-3 right-3 max-w-[60%] text-right text-xs text-white/50">
          Pieseň sa nepodarilo načítať. {lib.error || `V zozname je ${lib.songs.length} piesní (zdroj: ${lib.source || 'žiadny'}).`}
        </div>
      )}
      {showOffline && (
        <div className="absolute bottom-3 left-3 flex items-center gap-2 text-xs text-white/40" title="Spojenie so serverom je prerušené">
          <span className="w-2 h-2 rounded-full bg-red-500/70 animate-pulse" />
          offline
        </div>
      )}
    </div>
  );
}
