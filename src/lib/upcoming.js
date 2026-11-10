import { getPageCount } from './lyrics';

// Čo sa zobrazí po stlačení "Ďalej": ďalšia strofa, inak ďalšia položka poradia
export function getUpcoming(state, song, nextSong) {
  const pageCount = getPageCount(song);
  const page = Math.min(state.currentPage || 0, Math.max(0, pageCount - 1));
  if (song && page < pageCount - 1) return { label: `Strofa ${page + 2} / ${pageCount}`, song, page: page + 1 };
  if (nextSong) return { label: nextSong.title, song: nextSong, page: 0 };
  return null;
}
