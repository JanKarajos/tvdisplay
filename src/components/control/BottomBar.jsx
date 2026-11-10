import React from 'react';
import { actions } from '../../lib/actions';
import { getPageCount } from '../../lib/lyrics';
import { getUpcoming } from '../../lib/upcoming';
import { getRotation, isPortrait } from '../../lib/rotation';
import Preview from '../Preview';

// Výška náhľadov v spodnom ovládači na mobile (naležato menšia, vedľa tlačidiel)
const DOCK_H = 'var(--dock-h)';

// Diaľkový ovládač: vždy viditeľný dole. Na mobile ukazuje aj čo je na TV a čo príde ďalej,
// na počítači a tablete sú náhľady vo veľkej karte "Teraz na TV" a tlačidlá sú veľké.
export default function BottomBar({ state, song, nextItem, nextSong, hasPrev }) {
  const pageCount = getPageCount(song);
  const page = Math.min(state.currentPage || 0, Math.max(0, pageCount - 1));
  const morePages = Boolean(song) && page < pageCount - 1;
  const canNext = morePages || Boolean(nextItem);
  const canPrev = Boolean(song) && (page > 0 || hasPrev);

  let nextLabel = 'Koniec poradia';
  if (morePages) nextLabel = `Strofa ${page + 2} / ${pageCount}`;
  else if (nextItem) nextLabel = nextItem.title;
  else if (!state.currentSongId) nextLabel = 'Poradie je prázdne';

  const upcoming = getUpcoming(state, song, nextSong);
  const ratio = isPortrait(getRotation(state.settings)) ? 0.5625 : 1.7778;
  const colWidth = { width: `calc(${DOCK_H} * ${ratio})`, maxWidth: '100%' };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 bg-surface/95 backdrop-blur border-t border-line pb-safe [--dock-h:min(19vh,160px)] short:[--dock-h:min(42vh,150px)]">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 pt-2 pb-2 lg:pt-3 lg:pb-0 flex flex-col lg:flex-row lg:items-center short:flex-row short:items-center gap-2 lg:gap-4">
        {/* Mobil: náhľad TV a toho, čo príde (ťuknutím na ďalší sa prepne) */}
        <div className="lg:hidden grid grid-cols-2 gap-2 short:flex short:flex-none">
          <div className="min-w-0 flex flex-col items-center gap-0.5">
            <Preview state={state} song={song} height={DOCK_H} empty="Nič" />
            <div className="text-[11px] text-muted truncate text-center" style={colWidth}>Na TV: {song ? song.title : 'nič'}</div>
          </div>
          <div className="min-w-0 flex flex-col items-center gap-0.5">
            <Preview
              state={{ ...state, isHidden: false }}
              song={upcoming?.song || null}
              page={upcoming?.page}
              height={DOCK_H}
              empty="Nič ďalšie"
              onClick={upcoming ? () => actions.next(song) : undefined}
              label="Prejsť ďalej"
            />
            <div className="text-[11px] font-semibold truncate text-center" style={colWidth}>Ďalej: {upcoming ? upcoming.label : '—'}</div>
          </div>
        </div>

        <div className="hidden lg:flex min-w-0 lg:flex-1 items-center gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">{song ? song.title : 'Na TV nie je nič'}</div>
            <div className="text-xs text-muted truncate">Ďalej: {nextLabel}</div>
          </div>
          {pageCount > 1 && (
            <div className="flex items-center gap-1 ml-auto" aria-label={`Strofa ${page + 1} z ${pageCount}`}>
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

        <div className="grid grid-cols-[1fr_1fr_2fr] lg:flex short:flex-1 short:grid-cols-1 gap-2 short:gap-1.5">
          <button onClick={() => actions.prev(song)} disabled={!canPrev} className="btn h-14 lg:h-24 lg:w-36 short:!h-10 text-xl lg:text-2xl short:text-base short:order-3" aria-label="Späť">
            ← <span className="hidden sm:inline">Späť</span>
          </button>
          <button
            onClick={actions.toggleHide}
            disabled={!song}
            className={`btn h-14 lg:h-24 lg:w-40 short:!h-10 text-base lg:text-lg short:order-2 ${state.isHidden ? '!bg-danger !text-white !border-danger' : ''}`}
            title="Kláves H"
          >
            {state.isHidden ? 'Zobraziť' : 'Skryť'}
          </button>
          <button onClick={() => actions.next(song)} disabled={!canNext} className="btn-primary h-14 lg:h-24 lg:w-80 short:!h-10 text-xl lg:text-2xl short:text-lg font-bold short:order-1" title="Kláves → alebo PageDown">
            Ďalej →
          </button>
        </div>
      </div>
    </div>
  );
}
