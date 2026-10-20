import React, { useEffect, useMemo, useState } from 'react';
import Header from '../components/Header';
import PinDialog from '../components/PinDialog';
import Toaster from '../components/Toaster';
import BottomBar from '../components/control/BottomBar';
import NowPlaying from '../components/control/NowPlaying';
import SongBrowser from '../components/control/SongBrowser';
import Playlist from '../components/control/Playlist';
import ScreenSettings from '../components/control/ScreenSettings';
import ContentManager from '../components/control/ContentManager';
import { useAppState } from '../hooks/useAppState';
import { useLibrary } from '../hooks/useLibrary';
import { useSong } from '../hooks/useSong';
import { useServerHealth } from '../hooks/useServerHealth';
import { useUiTheme } from '../hooks/useUiTheme';
import { actions, nextInPlaylist, prevInPlaylist } from '../lib/actions';
import { describeItem } from '../api/api';
import { getPin, markAuthRequired } from '../api/stateClient';

const SAMPLE_SONG = {
  id: 'sample',
  title: 'Ukážka',
  number: '123',
  lyrics: 'Chváľ, duša moja, Pána,\nnech celé moje vnútro\nvelebí jeho sväté meno.\n\nDruhá strofa',
};

function readTab() {
  try {
    return sessionStorage.getItem('tvdisplay-tab') || 'mass';
  } catch {
    return 'mass';
  }
}

export default function ControlPage() {
  const { state, status, authRequired } = useAppState();
  const lib = useLibrary();
  const health = useServerHealth(status);
  const { mode: uiTheme, cycle: cycleUiTheme } = useUiTheme();
  const [tab, setTab] = useState(readTab);

  const song = useSong(state.currentSongId, lib);
  const nextId = nextInPlaylist(state);
  const nextSong = useSong(nextId, lib);

  useEffect(() => {
    try {
      sessionStorage.setItem('tvdisplay-tab', tab);
    } catch {
      // ignoruj
    }
  }, [tab]);

  // PIN pýtame hneď, ak ho server vyžaduje a ešte nie je zadaný
  useEffect(() => {
    if (health?.auth?.pinRequired && !getPin()) markAuthRequired();
  }, [health]);

  const playlistIds = state.selectedSongIds || [];
  const playlist = useMemo(() => playlistIds.map(describeItem), [lib, playlistIds]);
  const currentIndex = playlistIds.indexOf(state.currentSongId);
  const playedIndex = currentIndex >= 0 ? currentIndex : playlistIds.indexOf(state.lastPlaylistId) + 1;

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

  const shownSong = state.currentSongId ? song : null;

  return (
    <div className="min-h-screen pb-40 sm:pb-28">
      <Header status={status} clients={health?.clients} tab={tab} onTab={setTab} uiTheme={uiTheme} onCycleTheme={cycleUiTheme} />
      {authRequired && <PinDialog />}
      {lib.error && (
        <div className="max-w-7xl mx-auto px-3 sm:px-4 pt-4">
          <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-sm text-danger">{lib.error}</div>
        </div>
      )}

      <main className="max-w-7xl mx-auto p-3 sm:p-4">
        {tab === 'mass' && (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-4">
            <div className="space-y-4">
              <NowPlaying state={state} song={shownSong} nextSong={nextId ? nextSong : null} />
              <Playlist items={playlist} currentId={state.currentSongId} nextId={nextId} playedIndex={playedIndex} />
            </div>
            <SongBrowser lib={lib} playlistIds={playlistIds} />
          </div>
        )}
        {tab === 'screen' && <ScreenSettings state={state} images={lib.images} sampleSong={SAMPLE_SONG} />}
        {tab === 'content' && <ContentManager lib={lib} health={health} />}
      </main>

      <Toaster />
      <BottomBar state={state} song={shownSong} nextItem={nextId ? describeItem(nextId) : null} hasPrev={Boolean(prevInPlaylist(state))} />
    </div>
  );
}
