import React, { useEffect, useMemo, useState } from 'react';
import { adminApi } from './adminApi';
import { Button, Input, Select, Field } from './ui';

const EMPTY_SONG = { title: '', number: '', category: '', lyrics: '' };

// Odstráni diakritiku pre vyhľadávanie
const normalize = (text) => String(text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Počet strof = počet strán na TV (strofy sú oddelené prázdnym riadkom)
const countStanzas = (lyrics) => lyrics.split(/\n\s*\n/).filter(part => part.trim()).length;

export default function SongsTab({ churchId, run }) {
  const [songs, setSongs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [selectedId, setSelectedId] = useState(null); // null = nič, 'new' = nová pieseň
  const [form, setForm] = useState(EMPTY_SONG);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    setSelectedId(null);
    Promise.all([adminApi.list(churchId, 'songs'), adminApi.list(churchId, 'categories')])
      .then(([songList, categoryList]) => {
        setSongs(songList);
        setCategories(categoryList);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [churchId]);

  const categoryName = (id) => categories.find(c => c.id === id)?.name || id;

  const filtered = useMemo(() => {
    const query = normalize(search.trim());
    return songs
      .filter(s => !filterCategory || s.category === filterCategory)
      .filter(s => !query || normalize(s.title).includes(query) || String(s.number || '').includes(query) || normalize(s.lyrics).includes(query))
      .sort((a, b) => (parseInt(a.number, 10) || 1e9) - (parseInt(b.number, 10) || 1e9) || a.title.localeCompare(b.title, 'sk'));
  }, [songs, search, filterCategory]);

  const openSong = (song) => {
    setSelectedId(song.id);
    setForm({ title: song.title || '', number: song.number || '', category: song.category || '', lyrics: song.lyrics || '' });
  };

  const newSong = () => {
    setSelectedId('new');
    setForm({ ...EMPTY_SONG, category: filterCategory || categories[0]?.id || '' });
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    await run(async () => {
      if (selectedId === 'new') {
        const created = await adminApi.create(churchId, 'songs', form);
        setSongs(list => [...list, created]);
        setSelectedId(created.id);
      } else {
        const updated = await adminApi.update(churchId, 'songs', selectedId, form);
        setSongs(list => list.map(s => (s.id === selectedId ? updated : s)));
      }
    }, 'Pieseň je uložená');
    setSaving(false);
  };

  const remove = async () => {
    if (!window.confirm(`Naozaj zmazať pieseň "${form.title}"?`)) return;
    await run(async () => {
      await adminApi.remove(churchId, 'songs', selectedId);
      setSongs(list => list.filter(s => s.id !== selectedId));
      setSelectedId(null);
    }, 'Pieseň je zmazaná');
  };

  if (loading) return <div className="text-sm text-gray-500">Načítavam piesne...</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      <div className="lg:col-span-2 bg-white border rounded p-4 shadow-sm">
        <div className="flex gap-2 mb-2">
          <Input className="flex-1" placeholder="Hľadaj podľa názvu, čísla alebo textu..." value={search} onChange={e => setSearch(e.target.value)} />
          <Button variant="success" onClick={newSong} disabled={!categories.length}>+ Nová</Button>
        </div>
        <Select className="w-full mb-2" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
          <option value="">Všetky kategórie</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        {!categories.length && (
          <div className="mb-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
            Najprv vytvor aspoň jednu kategóriu (záložka Kategórie).
          </div>
        )}
        <div className="text-xs text-gray-500 mb-1">{filtered.length} z {songs.length} piesní</div>
        <div className="h-[60vh] overflow-auto border-t">
          {filtered.map(s => (
            <button
              key={s.id}
              type="button"
              onClick={() => openSong(s)}
              className={`w-full text-left p-2 border-b text-sm hover:bg-gray-50 ${selectedId === s.id ? 'bg-blue-50' : ''}`}
            >
              {s.number && <span className="text-gray-500 mr-2">#{s.number}</span>}
              <span className="font-medium">{s.title}</span>
              <div className="text-xs text-gray-500">{categoryName(s.category)}</div>
            </button>
          ))}
          {!filtered.length && <div className="text-sm text-gray-500 p-3">Žiadne piesne</div>}
        </div>
      </div>

      <div className="lg:col-span-3 bg-white border rounded p-4 shadow-sm">
        {!selectedId ? (
          <div className="text-sm text-gray-500">Vyber pieseň zo zoznamu alebo pridaj novú.</div>
        ) : (
          <form className="space-y-3" onSubmit={save}>
            <div className="font-semibold">{selectedId === 'new' ? 'Nová pieseň' : 'Úprava piesne'}</div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <div className="sm:col-span-3">
                <Field label="Názov">
                  <Input className="w-full" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required maxLength={200} />
                </Field>
              </div>
              <Field label="Číslo (JKS)">
                <Input className="w-full" value={form.number} onChange={e => setForm({ ...form, number: e.target.value })} maxLength={20} />
              </Field>
            </div>
            <Field label="Kategória">
              <Select className="w-full" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} required>
                <option value="">Vyber kategóriu</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            <Field label={`Text (strofy oddeľ prázdnym riadkom - každá strofa je jedna strana na TV; počet strán: ${countStanzas(form.lyrics)})`}>
              <textarea
                className="w-full border rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={18}
                value={form.lyrics}
                onChange={e => setForm({ ...form, lyrics: e.target.value })}
                required
              />
            </Field>
            <div className="flex gap-2">
              <Button type="submit" variant="primary" disabled={saving}>{saving ? 'Ukladám...' : 'Uložiť'}</Button>
              <Button onClick={() => setSelectedId(null)}>Zavrieť</Button>
              {selectedId !== 'new' && <Button variant="danger" className="ml-auto" onClick={remove}>Zmazať pieseň</Button>}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
