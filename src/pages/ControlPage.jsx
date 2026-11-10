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

function readSettingsOpen() {
  try {
    return sessionStorage.getItem('tvdisplay-settings') === '1';
  } catch {
    return false;
  }
}

export default function ControlPage() {
  const { state, status, authRequired } = useAppState();
  const lib = useLibrary();
  const health = useServerHealth(status);
  const { mode: uiTheme, cycle: cycleUiTheme } = useUiTheme();
  const [settingsOpen, setSettingsOpen] = useState(readSettingsOpen);
  const [chosenTab, setTab] = useState(readTab);
  // Bez otvorených nastavení je aktívna iba omša
  const tab = settingsOpen ? chosenTab : 'mass';

  const song = useSong(state.currentSongId, lib);
  const nextId = nextInPlaylist(state);
  const nextSong = useSong(nextId, lib);

  useEffect(() => {
    try {
      sessionStorage.setItem('tvdisplay-tab', chosenTab);
      sessionStorage.setItem('tvdisplay-settings', settingsOpen ? '1' : '0');
    } catch {
      // ignoruj
    }
  }, [chosenTab, settingsOpen]);

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
    <div className="min-h-screen pb-48 sm:pb-36">
      <Header status={status} clients={health?.clients} tab={tab} onTab={setTab} uiTheme={uiTheme} onCycleTheme={cycleUiTheme} showSettings={settingsOpen} onToggleSettings={() => { setSettingsOpen((o) => !o); setTab(settingsOpen ? 'mass' : 'screen'); }} />
      {authRequired && <PinDialog />}
      {lib.error && (
        <div className="max-w-7xl mx-auto px-3 sm:px-4 pt-4">
          <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-sm text-danger">{lib.error}</div>
        </div>
      )}

      <main className="max-w-7xl mx-auto p-3 sm:p-4">
        {tab === 'mass' && (
          // Hore vľavo poradie, vpravo čo je na TV; pod nimi piesne na celú šírku
          // (na mobile najprv TV, potom poradie a piesne)
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="order-2 lg:order-1 min-w-0">
              <Playlist items={playlist} currentId={state.currentSongId} nextId={nextId} playedIndex={playedIndex} />
            </div>
            <div className="order-1 lg:order-2 min-w-0">
              <NowPlaying state={state} song={shownSong} nextSong={nextId ? nextSong : null} categories={lib.categories} />
            </div>
            <div className="order-3 lg:col-span-2 min-w-0">
              <SongBrowser lib={lib} playlistIds={playlistIds} />
            </div>
          </div>
        )}
        {tab === 'screen' && <ScreenSettings state={state} images={lib.images} sampleSong={SAMPLE_SONG} health={health} />}
        {tab === 'content' && <ContentManager lib={lib} health={health} />}
      </main>

      <Toaster />
      <BottomBar state={state} song={shownSong} nextItem={nextId ? describeItem(nextId) : null} hasPrev={Boolean(prevInPlaylist(state))} />
    </div>
  );
}
