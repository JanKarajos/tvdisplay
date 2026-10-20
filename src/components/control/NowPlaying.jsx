import React from 'react';
import Card from '../Card';
import Preview from '../Preview';
import { actions } from '../../lib/actions';
import { getPageCount } from '../../lib/lyrics';

const btn = 'px-3 py-2 rounded-md text-sm font-medium border transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

export default function NowPlaying({ state, song, nextSong }) {
  const pageCount = getPageCount(song);
  const page = Math.min(state.currentPage || 0, Math.max(0, pageCount - 1));
  const onLastPage = page >= pageCount - 1;
  const canNext = Boolean(song) && (!onLastPage || Boolean(state.nextSongId));

  // Čo príde po stlačení "Ďalšia"
  let upcoming = null;
  if (song && !onLastPage) upcoming = { label: `Strana ${page + 2} / ${pageCount}`, song, page: page + 1 };
  else if (nextSong) upcoming = { label: nextSong.title, song: nextSong, page: 0 };

  return (
    <Card
      title="Na obrazovke"
      actions={
        <div className="flex gap-2">
          <button onClick={actions.toggleHide} disabled={!song} className={`${btn} ${state.isHidden ? 'bg-red-600 text-white border-red-600' : 'hover:bg-gray-50'}`}>
            {state.isHidden ? 'Zobraziť text' : 'Skryť text'}
          </button>
          <button onClick={actions.clear} disabled={!song} className={`${btn} hover:bg-gray-50`}>Vymazať</button>
        </div>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-3">
        <div>
          <div className="text-xs text-gray-500 mb-1 truncate">{song ? song.title : 'Nič sa nezobrazuje'}</div>
          <Preview state={state} song={song} />
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1 truncate">Ďalej: {upcoming ? upcoming.label : '—'}</div>
          {upcoming ? (
            <button className="block w-full text-left opacity-80 hover:opacity-100" onClick={() => actions.next(song)} title="Prejsť ďalej">
              <Preview state={{ ...state, isHidden: false }} song={upcoming.song} page={upcoming.page} />
            </button>
          ) : (
            <div className="aspect-video rounded-md border border-dashed flex items-center justify-center text-xs text-gray-400">Nič nie je pripravené</div>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button onClick={() => actions.prev(song)} disabled={!song || page === 0} className={`${btn} flex-1 hover:bg-gray-50`}>← Späť</button>
        <div className="text-sm font-medium tabular-nums w-16 text-center">{pageCount ? `${page + 1} / ${pageCount}` : '—'}</div>
        <button onClick={() => actions.next(song)} disabled={!canNext} className={`${btn} flex-[2] bg-blue-600 text-white border-blue-600 hover:bg-blue-700`}>
          {onLastPage && state.nextSongId ? 'Ďalšia pieseň →' : 'Ďalej →'}
        </button>
      </div>

      {pageCount > 1 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {Array.from({ length: pageCount }, (_, i) => (
            <button
              key={i}
              onClick={() => actions.goToPage(i)}
              className={`w-8 h-8 rounded text-xs font-medium ${i === page ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
      <div className="mt-2 text-[11px] text-gray-400 hidden md:block">Klávesy: → / PageDown ďalej, ← / PageUp späť, H skryť/zobraziť text</div>
    </Card>
  );
}
