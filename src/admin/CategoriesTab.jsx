import React, { useEffect, useState } from 'react';
import Card from '../components/Card';
import { adminApi } from './adminApi';
import InlineRename from './InlineRename';

export default function CategoriesTab({ churchId, run }) {
  const [categories, setCategories] = useState([]);
  const [counts, setCounts] = useState({});
  const [name, setName] = useState('');

  useEffect(() => {
    Promise.all([adminApi.list(churchId, 'categories'), adminApi.list(churchId, 'songs')])
      .then(([categoryList, songs]) => {
        setCategories(categoryList);
        const next = {};
        songs.forEach((s) => { next[s.category] = (next[s.category] || 0) + 1; });
        setCounts(next);
      })
      .catch(() => {});
  }, [churchId]);

  const add = async (e) => {
    e.preventDefault();
    let created;
    if (await run(async () => { created = await adminApi.create(churchId, 'categories', { name }); }, `Pridaná kategória: ${name}`)) {
      setCategories((list) => [...list, created]);
      setName('');
    }
  };

  const rename = async (category, newName) => {
    let updated;
    const ok = await run(async () => { updated = await adminApi.update(churchId, 'categories', category.id, { name: newName }); }, 'Kategória je premenovaná');
    if (ok) setCategories((list) => list.map((c) => (c.id === category.id ? updated : c)));
    return ok;
  };

  const remove = async (category) => {
    if (!window.confirm(`Naozaj zmazať kategóriu „${category.name}“?`)) return;
    if (await run(() => adminApi.remove(churchId, 'categories', category.id), `Zmazané: ${category.name}`)) {
      setCategories((list) => list.filter((c) => c.id !== category.id));
    }
  };

  return (
    <Card title="Kategórie" subtitle="Kategóriu s piesňami nemožno zmazať – najprv piesne presuň inam" className="max-w-2xl">
      <form className="flex gap-2 mb-3" onSubmit={add}>
        <input className="field" placeholder="Nová kategória…" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        <button className="btn-primary" disabled={!name.trim()}>Pridať</button>
      </form>
      {!categories.length && <div className="text-sm text-muted">Zatiaľ žiadne kategórie.</div>}
      <div className="space-y-1">
        {categories.map((c) => (
          <div key={c.id} className="flex items-center gap-2 pl-3 rounded-xl hover:bg-sunken min-h-[48px]">
            <InlineRename value={c.name} onSave={(n) => rename(c, n)} className="flex-1 text-sm" />
            <span className="text-xs text-muted shrink-0">{counts[c.id] || 0} piesní</span>
            <button
              onClick={() => remove(c)}
              disabled={Boolean(counts[c.id])}
              className="btn-icon hover:!text-danger"
              title={counts[c.id] ? 'Kategória obsahuje piesne' : 'Zmazať'}
              aria-label={`Zmazať: ${c.name}`}
            >
              🗑
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}
