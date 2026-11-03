import React, { useEffect, useMemo, useState } from 'react';
import Card from '../components/Card';
import SongEditor from '../components/control/SongEditor';
import { normalizeText } from '../lib/lyrics';
import { adminApi } from './adminApi';

function pluralSongs(n) {
  if (n === 1) return 'pieseň';
  return n >= 2 && n <= 4 ? 'piesne' : 'piesní';
}

const byNumber = (a, b) => (parseInt(a.number, 10) || 1e9) - (parseInt(b.number, 10) || 1e9) || a.title.localeCompare(b.title, 'sk');

export default function SongsTab({ churchId, run }) {
  const [songs, setSongs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [editing, setEditing] = useState(null); // pieseň alebo {} pre novú

  useEffect(() => {
    Promise.all([adminApi.list(churchId, 'songs'), adminApi.list(churchId, 'categories')])
      .then(([songList, categoryList]) => {
        setSongs(songList);
        setCategories(categoryList);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [churchId]);

  const categoryName = (id) => categories.find((c) => c.id === id)?.name || id;

  // Hľadá v názve, čísle aj v texte piesne
  const results = useMemo(() => {
    const q = normalizeText(query);
    return songs
      .filter((s) => !category || s.category === category)
      .filter((s) => !q || normalizeText(s.title).includes(q) || String(s.number || '').startsWith(q) || normalizeText(s.lyrics).includes(q))
      .sort(byNumber);
  }, [songs, query, category]);

  const save = (song) => async (fields) => {
    try {
      if (song.id) {
        const updated = await adminApi.update(churchId, 'songs', song.id, fields);
        setSongs((list) => list.map((s) => (s.id === song.id ? updated : s)));
      } else {
        const created = await adminApi.create(churchId, 'songs', fields);
        setSongs((list) => [...list, created]);
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  const remove = async (song) => {
    if (!window.confirm(`Naozaj zmazať pieseň „${song.title}“?`)) return;
    const ok = await run(() => adminApi.remove(churchId, 'songs', song.id), `Zmazané: ${song.title}`);
    if (ok) {
      setSongs((list) => list.filter((s) => s.id !== song.id));
      setEditing(null);
    }
  };

  return (
    <Card
      title="Piesne"
      subtitle="Hľadá sa v názve, čísle aj texte. Klik na pieseň ju otvorí na úpravu."
      actions={<button className="btn-primary" onClick={() => setEditing({})} disabled={!categories.length}>+ Nová pieseň</button>}
    >
      {loaded && !categories.length && (
        <div className="mb-3 p-3 rounded-xl bg-warn/10 border border-warn/30 text-sm text-warn">
          Najprv vytvor aspoň jednu kategóriu (záložka Kategórie).
        </div>
      )}
      <div className="relative">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Hľadaj názov, číslo alebo text…"
          className="field pl-10 text-base"
        />
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none">⌕</span>
      </div>
      <div className="flex gap-1.5 mt-3 overflow-x-auto pb-1 -mx-1 px-1">
        <button onClick={() => setCategory('')} className={`${!category ? 'chip-active' : 'chip'} shrink-0`}>Všetky</button>
        {categories.map((c) => (
          <button key={c.id} onClick={() => setCategory(c.id)} className={`${category === c.id ? 'chip-active' : 'chip'} shrink-0`}>{c.name}</button>
        ))}
      </div>

      <div className="mt-2 text-xs text-muted">{results.length} {pluralSongs(results.length)}</div>
      <div className="mt-1 h-[calc(100vh-22rem)] min-h-[18rem] overflow-auto -mx-2 px-1">
        {!loaded && <div className="text-sm text-muted p-3">Načítavam piesne…</div>}
        {loaded && !results.length && <div className="text-sm text-muted p-3">Nič sa nenašlo.</div>}
        {results.map((s) => (
          <div key={s.id} className="flex items-center gap-1 rounded-xl hover:bg-sunken">
            <button onClick={() => setEditing(s)} className="flex-1 min-w-0 min-h-[48px] flex items-center gap-3 px-2 text-left">
              <span className="w-10 shrink-0 text-right tabular-nums text-sm text-muted">{s.number || ''}</span>
              <span className="min-w-0">
                <span className="block text-[15px] truncate">{s.title}</span>
                <span className="block text-xs text-muted">{categoryName(s.category)}</span>
              </span>
            </button>
            <button onClick={() => remove(s)} className="btn-icon hover:!text-danger" title="Zmazať" aria-label={`Zmazať: ${s.title}`}>🗑</button>
          </div>
        ))}
      </div>

      {editing && (
        <SongEditor
          song={editing}
          categories={categories}
          onSave={save(editing)}
          onDelete={() => remove(editing)}
          onClose={() => setEditing(null)}
        />
      )}
    </Card>
  );
}
