import React, { useMemo, useState } from 'react';
import Card from '../Card';
import { actions } from '../../lib/actions';
import { library } from '../../api/api';
import { normalizeText } from '../../lib/lyrics';

function pluralSongs(n) {
  if (n === 1) return 'pieseň';
  return n >= 2 && n <= 4 ? 'piesne' : 'piesní';
}

export default function SongBrowser({ lib, playlistIds }) {
  const [category, setCategory] = useState(null);
  const [query, setQuery] = useState('');
  const [newCategory, setNewCategory] = useState('');

  const results = useMemo(() => {
    const q = normalizeText(query);
    if (q) {
      return lib.songs.filter((s) => s.category && (normalizeText(s.title).includes(q) || String(s.number || '') === q || String(s.number || '').startsWith(q)));
    }
    return category ? lib.songs.filter((s) => s.category === category) : [];
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
        {lib.categories.map((c) => (
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

      <div className="mt-2 h-[calc(100vh-23rem)] min-h-[18rem] overflow-auto -mx-2 px-1">
        {!lib.loaded && <div className="text-sm text-muted p-3">Načítavam piesne…</div>}
        {lib.loaded && !query && !category && <div className="text-sm text-muted p-3">Vyber kategóriu alebo začni písať názov či číslo piesne.</div>}
        {lib.loaded && (query || category) && !results.length && <div className="text-sm text-muted p-3">Nič sa nenašlo.</div>}
        {results.map((s) => {
          const position = playlistIds.indexOf(s.id);
          const inPlaylist = position >= 0;
          return (
            <div key={s.id} className={`flex items-center gap-1 rounded-xl transition-colors ${inPlaylist ? 'bg-accent/10' : 'hover:bg-sunken'}`}>
              <button
                onClick={() => actions.addToPlaylist(s.id)}
                className="flex-1 min-w-0 min-h-[48px] flex items-center gap-3 px-2 text-left"
                title={inPlaylist ? 'Už je v poradí' : 'Pridať do poradia'}
              >
                <span className={`w-9 shrink-0 text-right tabular-nums text-sm ${inPlaylist ? 'text-accent font-bold' : 'text-muted'}`}>
                  {s.number || ''}
                </span>
                <span className="min-w-0">
                  <span className="block text-[15px] truncate">{s.title}</span>
                  {query && <span className="block text-xs text-muted">{categoryName(s.category)}</span>}
                </span>
                <span className="ml-auto shrink-0">
                  {inPlaylist ? (
                    <span className="px-2 py-1 rounded-lg bg-accent text-on-accent text-xs font-bold">✓ {position + 1}.</span>
                  ) : (
                    <span className="w-8 h-8 rounded-lg grid place-items-center text-accent text-lg">+</span>
                  )}
                </span>
              </button>
              <button onClick={() => actions.show(s)} className="btn-icon shrink-0" title="Zobraziť hneď (mimo poradia)" aria-label={`Zobraziť hneď: ${s.title}`}>
                ▶
              </button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
