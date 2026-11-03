import React, { useEffect, useState } from 'react';
import { adminApi } from './adminApi';
import { Button, Input, InlineRename } from './ui';

export default function CategoriesTab({ churchId, run }) {
  const [categories, setCategories] = useState([]);
  const [songCounts, setSongCounts] = useState({});
  const [name, setName] = useState('');

  useEffect(() => {
    Promise.all([adminApi.list(churchId, 'categories'), adminApi.list(churchId, 'songs')])
      .then(([categoryList, songs]) => {
        setCategories(categoryList);
        const counts = {};
        songs.forEach(s => { counts[s.category] = (counts[s.category] || 0) + 1; });
        setSongCounts(counts);
      })
      .catch(() => {});
  }, [churchId]);

  const add = async (e) => {
    e.preventDefault();
    await run(async () => {
      const created = await adminApi.create(churchId, 'categories', { name });
      setCategories(list => [...list, created]);
      setName('');
    }, 'Kategória je pridaná');
  };

  const rename = (category, newName) => run(async () => {
    const updated = await adminApi.update(churchId, 'categories', category.id, { name: newName });
    setCategories(list => list.map(c => (c.id === category.id ? updated : c)));
  }, 'Kategória je premenovaná');

  const remove = async (category) => {
    if (!window.confirm(`Naozaj zmazať kategóriu "${category.name}"?`)) return;
    await run(async () => {
      await adminApi.remove(churchId, 'categories', category.id);
      setCategories(list => list.filter(c => c.id !== category.id));
    }, 'Kategória je zmazaná');
  };

  return (
    <div className="bg-white border rounded p-4 shadow-sm max-w-2xl">
      <form className="flex gap-2 mb-4" onSubmit={add}>
        <Input className="flex-1" placeholder="Nová kategória..." value={name} onChange={e => setName(e.target.value)} maxLength={60} />
        <Button type="submit" variant="success" disabled={!name.trim()}>Pridať</Button>
      </form>
      {categories.map(c => (
        <div key={c.id} className="flex items-center justify-between py-2 border-b text-sm">
          <div>
            <InlineRename value={c.name} onSave={(newName) => rename(c, newName)} />
            <span className="text-xs text-gray-500 ml-2">{songCounts[c.id] || 0} piesní</span>
          </div>
          <Button
            variant="danger"
            onClick={() => remove(c)}
            disabled={!!songCounts[c.id]}
            title={songCounts[c.id] ? 'Kategória obsahuje piesne' : ''}
          >Zmazať</Button>
        </div>
      ))}
      {!categories.length && <div className="text-sm text-gray-500">Zatiaľ žiadne kategórie.</div>}
    </div>
  );
}
