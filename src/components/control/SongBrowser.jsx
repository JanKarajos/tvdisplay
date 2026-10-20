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
      return lib.songs.filter((s) => s.category && (normalizeText(s.title).includes(q) || String(s.number || '').includes(q)));
    }
    return category ? lib.songs.filter((s) => s.category === category) : [];
  }, [lib.songs, category, query]);

  const categoryName = (id) => lib.categories.find((c) => c.id === id)?.name || id;

  return (
    <Card title={query ? 'Vyhľadávanie' : category ? categoryName(category) : 'Piesne'}>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Hľadaj názov alebo číslo…"
        className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      <div className="flex flex-wrap gap-1.5 mt-3">
        {lib.categories.map((c) => (
          <button
            key={c.id}
            onClick={() => { setCategory(c.id); setQuery(''); }}
            className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${category === c.id && !query ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-gray-50'}`}
          >
            {c.name}
          </button>
        ))}
        <form
          className="inline-flex"
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
            placeholder="+ nová kategória"
            className="px-2.5 py-1 text-xs rounded-full border border-dashed w-32 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </form>
      </div>

      {query && <div className="mt-2 text-xs text-gray-500">Nájdených: {results.length} {pluralSongs(results.length)}</div>}

      <div className="mt-3 h-[calc(100vh-24rem)] min-h-[16rem] overflow-auto -mx-2">
        {!lib.loaded && <div className="text-sm text-gray-500 p-3">Načítavam piesne…</div>}
        {lib.loaded && !query && !category && <div className="text-sm text-gray-500 p-3">Vyber kategóriu alebo začni vyhľadávať.</div>}
        {lib.loaded && (query || category) && !results.length && <div className="text-sm text-gray-500 p-3">Nič sa nenašlo.</div>}
        {results.map((s) => {
          const inPlaylist = playlistIds.includes(s.id);
          return (
            <div key={s.id} className="group flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50">
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">
                  {s.number && <span className="text-gray-400 tabular-nums mr-2">{s.number}</span>}
                  {s.title}
                </div>
                {query && <div className="text-[11px] text-gray-400">{categoryName(s.category)}</div>}
              </div>
              <button
                onClick={() => actions.addToPlaylist(s.id)}
                disabled={inPlaylist}
                className="px-2 py-1 text-xs border rounded hover:bg-white disabled:opacity-40"
                title="Pridať do zoznamu na omšu"
              >
                {inPlaylist ? '✓ V zozname' : '+ Zoznam'}
              </button>
              <button onClick={() => actions.stageOrShow(s)} className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">
                Zobraziť
              </button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
