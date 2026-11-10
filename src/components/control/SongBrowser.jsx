import React, { useEffect, useMemo, useState } from 'react';
import Card from '../Card';
import { actions } from '../../lib/actions';
import { library, getPsalmOptions, psalmId, psalmOptionsSync, toLocalISODate } from '../../api/api';
import { normalizeText } from '../../lib/lyrics';

function pluralSongs(n) {
  if (n === 1) return 'pieseň';
  return n >= 2 && n <= 4 ? 'piesne' : 'piesní';
}

const ALL = '__all';
const PSALMS = '__psalms';
const WEEKDAYS = ['Ne', 'Po', 'Ut', 'St', 'Št', 'Pi', 'So'];

function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  return toLocalISODate(new Date(y, m - 1, d + n));
}

function dateLabel(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const today = toLocalISODate();
  const day = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  return `${iso === today ? 'Dnes' : iso === addDays(today, 1) ? 'Zajtra' : day} ${d}. ${m}.`;
}

// Žalmy na najbližšie dni; pri dňoch s viacerými žalmami (napr. Vianoce) všetky na výber
function PsalmList({ playlistIds }) {
  const [from, setFrom] = useState(toLocalISODate);
  const days = useMemo(() => Array.from({ length: 21 }, (_, i) => addDays(from, i)), [from]);
  const [, refresh] = useState(0);
  useEffect(() => {
    let cancelled = false;
    // rok mimo aplikácie (napr. budúci) sa stiahne zo servera
    Promise.all([...new Set(days.map((d) => d.slice(0, 4)))].map((y) => getPsalmOptions(`${y}-01-01`))).then(() => !cancelled && refresh((n) => n + 1));
    return () => { cancelled = true; };
  }, [days]);

  return (
    <>
      <div className="flex items-center gap-2 p-2 text-xs text-muted">
        Od dátumu
        <input type="date" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} className="field !w-auto !min-h-[36px] !py-1 text-sm" />
        <button onClick={() => setFrom(toLocalISODate())} className="btn !min-h-[36px] !px-3 text-xs">Dnes</button>
      </div>
      {days.map((iso) => {
        const options = psalmOptionsSync(iso);
        if (!options.length) return null;
        return options.map((o, i) => {
          const id = psalmId(iso, i);
          const position = playlistIds.indexOf(id);
          const inPlaylist = position >= 0;
          return (
            <div key={id} className={`flex items-center gap-1 rounded-xl transition-colors ${inPlaylist ? 'bg-accent/10' : 'hover:bg-sunken'}`}>
              <button onClick={() => actions.addToPlaylist(id)} className="flex-1 min-w-0 min-h-[60px] flex items-center gap-3 px-2 text-left" title={inPlaylist ? 'Už je v poradí' : 'Pridať do poradia'}>
                <span className={`w-16 shrink-0 text-right text-xs ${inPlaylist ? 'text-accent font-bold' : 'text-muted'}`}>{i === 0 ? dateLabel(iso) : ''}</span>
                <span className="min-w-0">
                  {options.length > 1 && <span className="block text-[11px] font-semibold text-accent">{o.label || `Možnosť ${i + 1}`}</span>}
                  <span className="block text-[15px] leading-snug">{o.refrain}</span>
                </span>
                <span className="ml-auto shrink-0">
                  {inPlaylist ? (
                    <span className="px-2 py-1 rounded-lg bg-accent text-on-accent text-xs font-bold">✓ {position + 1}.</span>
                  ) : (
                    <span className="w-12 h-12 rounded-xl grid place-items-center bg-accent/10 text-accent text-3xl font-semibold">+</span>
                  )}
                </span>
              </button>
              <button onClick={() => actions.showId(id)} className="btn-icon shrink-0 !w-14 !h-14 text-2xl" title="Zobraziť hneď (mimo poradia)" aria-label={`Zobraziť hneď: žalm ${dateLabel(iso)}`}>
                ▶
              </button>
            </div>
          );
        });
      })}
    </>
  );
}

export default function SongBrowser({ lib, playlistIds }) {
  const [category, setCategory] = useState(ALL);
  const [query, setQuery] = useState('');
  const [newCategory, setNewCategory] = useState('');

  const results = useMemo(() => {
    const q = normalizeText(query);
    if (q) {
      return lib.songs.filter((s) => s.category && (normalizeText(s.title).includes(q) || String(s.number || '') === q || String(s.number || '').startsWith(q)));
    }
    // V kategórii podľa čísla JKS, piesne bez čísla na konci podľa názvu
    const byNumber = (a, b) => (parseInt(a.number, 10) || 1e9) - (parseInt(b.number, 10) || 1e9) || a.title.localeCompare(b.title, 'sk');
    if (category === PSALMS) return [];
    // "Všetky": celý spevník (iba piesne s kategóriou, nie obrázky a prezentácie)
    if (category === ALL) return lib.songs.filter((s) => s.category && s.type !== 'pdf').sort(byNumber);
    return lib.songs.filter((s) => s.category === category).sort(byNumber);
  }, [lib.songs, category, query]);

  const categoryName = (id) => lib.categories.find((c) => c.id === id)?.name || id;

  return (
    <Card title="Piesne" subtitle="Klik na pieseň ju pridá do poradia">
      <div className="relative">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Hľadaj názov alebo číslo…"
          className="field pl-10 text-base"
          enterKeyHint="search"
        />
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none">⌕</span>
      </div>

      <div className="flex gap-1.5 mt-3 overflow-x-auto pb-1 -mx-1 px-1">
        {[{ id: ALL, name: 'Všetky' }, { id: PSALMS, name: 'Žalmy' }, ...lib.categories].map((c) => (
          <button key={c.id} onClick={() => { setCategory(c.id); setQuery(''); }} className={`${category === c.id && !query ? 'chip-active' : 'chip'} shrink-0`}>
            {c.name}
          </button>
        ))}
        {!lib.managed && <form
          className="shrink-0"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newCategory.trim()) return;
            setCategory(library.addCategory(newCategory));
            setNewCategory('');
          }}
        >
          <input
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="+ kategória"
            className="min-h-[36px] w-28 px-3 rounded-full text-sm border border-dashed border-line bg-transparent placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
        </form>}
      </div>

      {query && <div className="mt-2 text-xs text-muted">Nájdených: {results.length} {pluralSongs(results.length)}</div>}

      <div className="mt-2 h-[65vh] min-h-[18rem] overflow-auto -mx-2 px-1">
        {!lib.loaded && <div className="text-sm text-muted p-3">Načítavam piesne…</div>}
        {!query && category === PSALMS && <PsalmList playlistIds={playlistIds} />}
        {lib.loaded && category !== PSALMS && !results.length && <div className="text-sm text-muted p-3">Nič sa nenašlo.</div>}
        {results.map((s) => {
          const position = playlistIds.indexOf(s.id);
          const inPlaylist = position >= 0;
          return (
            <div key={s.id} className={`flex items-center gap-1 rounded-xl transition-colors ${inPlaylist ? 'bg-accent/10' : 'hover:bg-sunken'}`}>
              <button
                onClick={() => actions.addToPlaylist(s.id)}
                className="flex-1 min-w-0 min-h-[60px] flex items-center gap-3 px-2 text-left"
                title={inPlaylist ? 'Už je v poradí' : 'Pridať do poradia'}
              >
                <span className={`w-9 shrink-0 text-right tabular-nums text-sm ${inPlaylist ? 'text-accent font-bold' : 'text-muted'}`}>
                  {s.number || ''}
                </span>
                <span className="min-w-0">
                  <span className="block text-[15px] truncate">{s.title}</span>
                  {(query || category === ALL) && <span className="block text-xs text-muted">{categoryName(s.category)}</span>}
                </span>
                <span className="ml-auto shrink-0">
                  {inPlaylist ? (
                    <span className="px-2 py-1 rounded-lg bg-accent text-on-accent text-xs font-bold">✓ {position + 1}.</span>
                  ) : (
                    <span className="w-12 h-12 rounded-xl grid place-items-center bg-accent/10 text-accent text-3xl font-semibold">+</span>
                  )}
                </span>
              </button>
              <button onClick={() => actions.show(s)} className="btn-icon shrink-0 !w-14 !h-14 text-2xl" title="Zobraziť hneď (mimo poradia)" aria-label={`Zobraziť hneď: ${s.title}`}>
                ▶
              </button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
