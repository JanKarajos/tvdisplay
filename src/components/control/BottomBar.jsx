import React from 'react';
import { actions } from '../../lib/actions';
import { getPageCount } from '../../lib/lyrics';

// Diaľkový ovládač: vždy viditeľný dole, čo najväčšie tlačidlá pre omšu (trafí sa aj naslepo)
export default function BottomBar({ state, song, nextItem, hasPrev }) {
  const pageCount = getPageCount(song);
  const page = Math.min(state.currentPage || 0, Math.max(0, pageCount - 1));
  const morePages = Boolean(song) && page < pageCount - 1;
  const canNext = morePages || Boolean(nextItem);
  const canPrev = Boolean(song) && (page > 0 || hasPrev);

  let nextLabel = 'Koniec poradia';
  if (morePages) nextLabel = `Strofa ${page + 2} / ${pageCount}`;
  else if (nextItem) nextLabel = nextItem.title;
  else if (!state.currentSongId) nextLabel = 'Poradie je prázdne';

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 bg-surface/95 backdrop-blur border-t border-line pb-safe">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 pt-2 sm:pt-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
        <div className="min-w-0 sm:flex-1 flex items-center gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">{song ? song.title : 'Na TV nie je nič'}</div>
            <div className="text-xs text-muted truncate">Ďalej: {nextLabel}</div>
          </div>
          {pageCount > 1 && (
            <div className="hidden sm:flex items-center gap-1 ml-auto" aria-label={`Strofa ${page + 1} z ${pageCount}`}>
              {Array.from({ length: pageCount }, (_, i) => (
                <button
                  key={i}
                  onClick={() => actions.goToPage(i)}
                  className={`h-2.5 rounded-full transition-all ${i === page ? 'w-6 bg-accent' : 'w-2.5 bg-line hover:bg-muted'}`}
                  aria-label={`Strofa ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-[1fr_1fr_2fr] sm:flex gap-2">
          <button onClick={() => actions.prev(song)} disabled={!canPrev} className="btn h-20 sm:h-24 sm:w-36 text-2xl" aria-label="Späť">
            ← <span className="hidden sm:inline">Späť</span>
          </button>
          <button
            onClick={actions.toggleHide}
            disabled={!song}
            className={`btn h-20 sm:h-24 sm:w-40 text-lg ${state.isHidden ? '!bg-danger !text-white !border-danger' : ''}`}
            title="Kláves H"
          >
            {state.isHidden ? 'Zobraziť' : 'Skryť'}
          </button>
          <button onClick={() => actions.next(song)} disabled={!canNext} className="btn-primary h-20 sm:h-24 sm:w-80 text-2xl font-bold" title="Kláves → alebo PageDown">
            Ďalej →
          </button>
        </div>
      </div>
    </div>
  );
}
