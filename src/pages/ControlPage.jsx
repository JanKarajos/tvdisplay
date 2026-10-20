import React, { useEffect, useMemo } from 'react';
import Header from '../components/Header';
import PinDialog from '../components/PinDialog';
import NowPlaying from '../components/control/NowPlaying';
import SongBrowser from '../components/control/SongBrowser';
import Playlist from '../components/control/Playlist';
import QuickActions from '../components/control/QuickActions';
import ContentManager from '../components/control/ContentManager';
import { useAppState } from '../hooks/useAppState';
import { useLibrary } from '../hooks/useLibrary';
import { useSong } from '../hooks/useSong';
import { useServerHealth } from '../hooks/useServerHealth';
import { actions } from '../lib/actions';
import { getPin, markAuthRequired } from '../api/stateClient';

export default function ControlPage() {
  const { state, status, authRequired } = useAppState();
  const lib = useLibrary();
  const health = useServerHealth(status);
  const song = useSong(state.currentSongId, lib);
  const nextSong = useSong(state.nextSongId, lib);

  // PIN pýtame hneď, ak ho server vyžaduje a ešte nie je zadaný
  useEffect(() => {
    if (health?.auth?.pinRequired && !getPin()) markAuthRequired();
  }, [health]);

  const playlistIds = state.selectedSongIds || [];
  const playlist = useMemo(() => {
    const byId = new Map(lib.songs.map((s) => [s.id, s]));
    return playlistIds.map((id) => byId.get(id)).filter(Boolean);
  }, [lib.songs, playlistIds]);

  // Klávesové skratky (aj kliker na prezentácie posiela PageUp/PageDown)
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest('input, textarea, select, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return;
      if (['ArrowRight', 'PageDown'].includes(e.key)) actions.next(song);
      else if (['ArrowLeft', 'PageUp'].includes(e.key)) actions.prev(song);
      else if (e.key === 'h' || e.key === 'H') actions.toggleHide();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [song]);

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900">
      <Header status={status} clients={health?.clients} />
      {authRequired && <PinDialog />}
      {lib.error && (
        <div className="max-w-7xl mx-auto px-4 pt-4">
          <div className="p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-800">{lib.error}</div>
        </div>
      )}
      <main className="max-w-7xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-4">
        <div className="space-y-4">
          <NowPlaying state={state} song={state.currentSongId ? song : null} nextSong={state.nextSongId ? nextSong : null} />
          <Playlist songs={playlist} currentId={state.currentSongId} nextId={state.nextSongId} />
          <QuickActions state={state} images={lib.images} />
        </div>
        <div className="space-y-4">
          <SongBrowser lib={lib} playlistIds={playlistIds} />
          <ContentManager lib={lib} health={health} />
        </div>
      </main>
    </div>
  );
}
