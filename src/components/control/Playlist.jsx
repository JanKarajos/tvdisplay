import React, { useEffect, useRef, useState } from 'react';
import Card from '../Card';
import { actions } from '../../lib/actions';
import { getPsalmOptions, psalmId, psalmOptionsSync, toLocalISODate } from '../../api/api';

const KIND_ICON = { song: '♪', psalm: 'Ž', pdf: '▤', image: '▧', missing: '?' };

function pluralItems(n) {
  if (n === 1) return 'položka';
  return n >= 2 && n <= 4 ? 'položky' : 'položiek';
}

function nextSunday() {
  const d = new Date();
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  return toLocalISODate(d);
}

// Presúvanie ťahaním za úchyt – funguje myšou aj prstom (pointer events)
function useDragReorder(onMove) {
  const listRef = useRef(null);
  const [drag, setDrag] = useState(null); // { from, over }

  const handlers = (index) => ({
    onPointerDown: (e) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      setDrag({ from: index, over: index });
    },
    onPointerMove: (e) => {
      if (!drag || !listRef.current) return;
      const rows = [...listRef.current.children];
      let over = rows.findIndex((row) => {
        const r = row.getBoundingClientRect();
        return e.clientY < r.top + r.height / 2;
      });
      if (over < 0) over = rows.length - 1;
      if (over !== drag.over) setDrag({ ...drag, over });
    },
    onPointerUp: () => {
      if (drag) onMove(drag.from, drag.over);
      setDrag(null);
    },
    onPointerCancel: () => setDrag(null),
  });

  return { listRef, drag, handlers };
}

function PsalmButton() {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(nextSunday);
  const [options, setOptions] = useState(() => psalmOptionsSync(date));
  useEffect(() => {
    let cancelled = false;
    setOptions(psalmOptionsSync(date));
    getPsalmOptions(date).then((o) => !cancelled && setOptions(o));
    return () => { cancelled = true; };
  }, [date]);

  // Na koniec, ako keď sa poradie skladá postupne; presunúť sa dá ťahaním
  const add = (option) => {
    actions.addToPlaylist(psalmId(date, option));
    setOpen(false);
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="btn !min-h-[36px] !px-3 text-xs whitespace-nowrap" aria-expanded={open}>+ Žalm</button>
      {open && (
        <div className="absolute right-0 top-full mt-2 z-40 w-72 max-h-[55vh] overflow-auto bg-surface border border-line rounded-2xl shadow-xl p-3 space-y-2">
          <label className="block text-xs text-muted">
            Žalm na dátum
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field mt-1" />
          </label>
          <div className="flex gap-2">
            <button onClick={() => setDate(toLocalISODate())} className="btn flex-1 !min-h-[36px] text-xs">Dnes</button>
            <button onClick={() => setDate(nextSunday())} className="btn flex-1 !min-h-[36px] text-xs">Nedeľa</button>
          </div>
          {options.length > 1 ? (
            <div className="space-y-1.5">
              <div className="text-xs text-muted">Na tento deň je {options.length} žalmov na výber:</div>
              {options.map((o, i) => (
                <button key={i} onClick={() => add(i)} className="w-full text-left rounded-xl border border-line hover:border-accent p-2">
                  {o.label && <span className="block text-[11px] font-semibold text-accent">{o.label}</span>}
                  <span className="block text-xs">{o.refrain}</span>
                </button>
              ))}
            </div>
          ) : (
            <>
              {options[0] && <div className="text-xs text-muted">{options[0].refrain}</div>}
              <button className="btn-primary w-full" onClick={() => add(0)}>Pridať do poradia</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function Playlist({ items, currentId, nextId, playedIndex }) {
  const { listRef, drag, handlers } = useDragReorder((from, to) => actions.movePlaylistItem(from, to));

  // Počas ťahania ukazujeme nové poradie hneď
  let shown = items.map((item, i) => ({ item, index: i }));
  if (drag) {
    const [moved] = shown.splice(drag.from, 1);
    shown.splice(drag.over, 0, moved);
  }

  return (
    <Card
      title="Poradie na omšu"
      subtitle={items.length ? `${items.length} ${pluralItems(items.length)} · „Ďalej“ ide poradím` : 'Klikni na pieseň a pridá sa sem'}
      actions={
        <div className="flex gap-2">
          <PsalmButton />
          <button
            onClick={() => window.confirm('Vyprázdniť celé poradie?') && actions.clearPlaylist()}
            disabled={!items.length}
            className="btn !min-h-[36px] !px-3 text-xs"
          >
            Vyprázdniť
          </button>
        </div>
      }
    >
      {!items.length && (
        <div className="rounded-xl border-2 border-dashed border-line p-6 text-center text-sm text-muted">
          Poradie je prázdne. Pridaj piesne kliknutím v zozname piesní a žalm tlačidlom „+ Žalm“.
        </div>
      )}
      <ol ref={listRef} className="space-y-1.5 select-none">
        {shown.map(({ item, index }, pos) => {
          const isCurrent = item.id === currentId;
          const isNext = item.id === nextId;
          const played = !isCurrent && playedIndex >= 0 && index < playedIndex;
          const dragging = drag && drag.from === index;
          return (
            <li
              key={item.id}
              className={`flex items-center gap-1 pr-1 rounded-xl border transition-colors ${
                dragging ? 'border-accent bg-accent/10 shadow-lg' : isCurrent ? 'border-accent bg-accent/10' : isNext ? 'border-warn/60 bg-warn/10' : 'border-line bg-sunken/50'
              } ${played ? 'opacity-50' : ''}`}
            >
              <button {...handlers(index)} className="w-9 h-12 grid place-items-center text-muted cursor-grab active:cursor-grabbing touch-none" aria-label="Presunúť" title="Ťahaj pre zmenu poradia">
                ⠿
              </button>
              <span className="w-6 shrink-0 text-sm text-muted tabular-nums">{pos + 1}.</span>
              <span className={`hidden sm:grid w-7 h-7 shrink-0 rounded-lg place-items-center text-xs font-bold ${item.kind === 'psalm' ? 'bg-warn/20 text-warn' : 'bg-line text-muted'}`}>
                {KIND_ICON[item.kind]}
              </span>
              <div className="flex-1 min-w-0 py-1.5 pl-1">
                <div className="text-sm font-semibold line-clamp-2 sm:truncate">
                  {item.number && <span className="text-muted tabular-nums mr-1.5">{item.number}</span>}
                  {item.title}
                </div>
                {item.subtitle && <div className="text-xs text-muted truncate">{item.subtitle}</div>}
              </div>
              {isCurrent && <span className="hidden sm:inline px-2 py-0.5 rounded-md bg-accent text-on-accent text-[10px] font-bold">NA TV</span>}
              {isNext && <span className="hidden sm:inline px-2 py-0.5 rounded-md bg-warn/20 text-warn text-[10px] font-bold">ĎALEJ</span>}
              <button onClick={() => actions.showId(item.id)} className="btn-icon !w-14 !h-14 text-2xl" title="Zobraziť hneď" aria-label={`Zobraziť hneď: ${item.title}`}>▶</button>
              <button onClick={() => actions.removeFromPlaylist(item.id)} className="btn-icon hover:!text-danger" title="Odobrať" aria-label={`Odobrať: ${item.title}`}>✕</button>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
