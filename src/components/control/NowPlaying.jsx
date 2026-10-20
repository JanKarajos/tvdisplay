import React from 'react';
import Card from '../Card';
import Preview from '../Preview';
import { actions } from '../../lib/actions';
import { getPageCount } from '../../lib/lyrics';

export default function NowPlaying({ state, song, nextSong }) {
  const pageCount = getPageCount(song);
  const page = Math.min(state.currentPage || 0, Math.max(0, pageCount - 1));

  // Čo príde po stlačení "Ďalej"
  let upcoming = null;
  if (song && page < pageCount - 1) upcoming = { label: `Strofa ${page + 2} / ${pageCount}`, song, page: page + 1 };
  else if (nextSong) upcoming = { label: nextSong.title, song: nextSong, page: 0 };

  return (
    <Card
      title="Teraz na TV"
      actions={
        <button onClick={actions.clear} disabled={!song} className="btn !min-h-[36px] !px-3 text-xs">Vyčistiť TV</button>
      }
    >
      <div className="grid grid-cols-[3fr_2fr] gap-3">
        <div className="min-w-0">
          <Preview state={state} song={song} />
          <div className="mt-1.5 text-xs text-muted truncate">{song ? song.title : 'Nič sa nezobrazuje'}</div>
        </div>
        <div className="min-w-0">
          <Preview
            state={{ ...state, isHidden: false }}
            song={upcoming?.song || null}
            page={upcoming?.page}
            empty="Nič ďalšie"
            onClick={upcoming ? () => actions.next(song) : undefined}
            label="Prejsť ďalej"
          />
          <div className="mt-1.5 text-xs text-muted truncate">Ďalej: {upcoming ? upcoming.label : '—'}</div>
        </div>
      </div>

      {pageCount > 1 && (
        <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Strofy">
          {Array.from({ length: pageCount }, (_, i) => (
            <button
              key={i}
              onClick={() => actions.goToPage(i)}
              className={`w-11 h-11 rounded-xl text-sm font-semibold transition ${i === page ? 'bg-accent text-on-accent' : 'bg-sunken hover:bg-line'}`}
              aria-label={`Strofa ${i + 1}`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}
