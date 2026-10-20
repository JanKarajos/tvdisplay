// Akcie ovládania. Vždy posielajú iba zmenené polia, nikdy celý (možno zastaraný) stav.
import { stateClient } from '../api/stateClient';
import { library } from '../api/api';
import { getPageCount } from './lyrics';

const current = () => stateClient.getState();
const patch = (p) => stateClient.patch(p);

export const actions = {
  show(song) {
    return patch({ currentSongId: song.id, nextSongId: null, currentPage: 0 });
  },

  // Keď už niečo beží, nové "Zobraziť" pieseň iba pripraví ako ďalšiu
  stageOrShow(song) {
    return current().currentSongId ? patch({ nextSongId: song.id }) : actions.show(song);
  },

  showNext() {
    const id = current().nextSongId;
    return id ? patch({ currentSongId: id, nextSongId: null, currentPage: 0 }) : undefined;
  },

  // "Ďalšia": najprv ďalšia strofa, na poslednej strofe pripravená ďalšia pieseň
  next(song) {
    const last = Math.max(0, getPageCount(song) - 1);
    const page = Math.min(current().currentPage || 0, last);
    if (page < last) return patch({ currentPage: page + 1 });
    return actions.showNext();
  },

  prev(song) {
    const last = Math.max(0, getPageCount(song) - 1);
    return patch({ currentPage: Math.max(Math.min(current().currentPage || 0, last) - 1, 0) });
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

  async loadPsalm() {
    return actions.stageOrShow(await library.loadPsalm());
  },

  addToPlaylist(id) {
    const ids = current().selectedSongIds || [];
    return ids.includes(id) ? undefined : patch({ selectedSongIds: [...ids, id] });
  },

  removeFromPlaylist(id) {
    return patch({ selectedSongIds: (current().selectedSongIds || []).filter((x) => x !== id) });
  },

  movePlaylistItem(id, delta) {
    const ids = [...(current().selectedSongIds || [])];
    const from = ids.indexOf(id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= ids.length) return undefined;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    return patch({ selectedSongIds: ids });
  },

  clearPlaylist() {
    return patch({ selectedSongIds: [] });
  },
};
