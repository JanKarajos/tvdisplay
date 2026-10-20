// Akcie ovládania. Vždy posielajú iba zmenené polia, nikdy celý (možno zastaraný) stav.
//
// Tok omše: piesne sa klikaním radia do poradia (selectedSongIds). "Ďalej" prechádza strofy
// a na poslednej strofe automaticky zobrazí ďalšiu položku poradia.
import { stateClient } from '../api/stateClient';
import { describeItem } from '../api/api';
import { getPageCount } from './lyrics';
import { toast } from './toast';

const current = () => stateClient.getState();
const patch = (p) => stateClient.patch(p);
const playlist = () => current().selectedSongIds || [];

// Pozícia v poradí: aktuálna položka, inak posledná zobrazená z poradia (po vložení piesne mimo poradia)
function playlistIndex(s = current()) {
  const ids = s.selectedSongIds || [];
  const idx = ids.indexOf(s.currentSongId);
  return idx >= 0 ? idx : ids.indexOf(s.lastPlaylistId);
}

export function nextInPlaylist(s = current()) {
  const ids = s.selectedSongIds || [];
  return ids[playlistIndex(s) + 1] || null;
}

export function prevInPlaylist(s = current()) {
  const ids = s.selectedSongIds || [];
  const idx = playlistIndex(s);
  return idx > 0 ? ids[idx - 1] : null;
}

export const actions = {
  // Zobrazí položku hneď (pieseň, žalm, obrázok, PDF)
  showId(id) {
    const inPlaylist = playlist().includes(id);
    return patch({
      currentSongId: id,
      currentPage: 0,
      nextSongId: null,
      ...(inPlaylist ? { lastPlaylistId: id } : {}),
    });
  },

  show(item) {
    return actions.showId(item.id);
  },

  // "Ďalej": ďalšia strofa, na poslednej strofe ďalšia položka poradia
  next(song) {
    const s = current();
    if (s.currentSongId && song) {
      const last = Math.max(0, getPageCount(song) - 1);
      const page = Math.min(s.currentPage || 0, last);
      if (page < last) return patch({ currentPage: page + 1 });
    }
    const nextId = nextInPlaylist(s);
    return nextId ? actions.showId(nextId) : undefined;
  },

  // "Späť": predchádzajúca strofa, na prvej strofe predchádzajúca položka poradia
  prev(song) {
    const s = current();
    const page = Math.min(s.currentPage || 0, Math.max(0, getPageCount(song) - 1));
    if (page > 0) return patch({ currentPage: page - 1 });
    const prevId = prevInPlaylist(s);
    return prevId ? actions.showId(prevId) : undefined;
  },

  goToPage(page) {
    return patch({ currentPage: page });
  },

  toggleHide() {
    return patch({ isHidden: !current().isHidden });
  },

  clear() {
    return patch({ currentSongId: null, isHidden: false, currentPage: 0 });
  },

  setBackground(background) {
    return patch({ background });
  },

  setSettings(settings) {
    return patch({ settings });
  },

  // Pridá do poradia (na koniec alebo hneď za aktuálnu položku)
  addToPlaylist(id, { afterCurrent = false, silent = false } = {}) {
    const ids = playlist();
    if (ids.includes(id)) {
      if (!silent) toast(`„${describeItem(id).title}“ už je v poradí`);
      return undefined;
    }
    const at = afterCurrent ? playlistIndex() + 1 : ids.length;
    const next = [...ids.slice(0, at), id, ...ids.slice(at)];
    if (!silent) toast(`${at + 1}. ${describeItem(id).title}`, { tone: 'ok' });
    return patch({ selectedSongIds: next });
  },

  removeFromPlaylist(id) {
    return patch({ selectedSongIds: playlist().filter((x) => x !== id) });
  },

  movePlaylistItem(from, to) {
    const ids = [...playlist()];
    if (from === to || from < 0 || to < 0 || from >= ids.length || to >= ids.length) return undefined;
    const [item] = ids.splice(from, 1);
    ids.splice(to, 0, item);
    return patch({ selectedSongIds: ids });
  },

  clearPlaylist() {
    return patch({ selectedSongIds: [], lastPlaylistId: null, nextSongId: null });
  },
};
