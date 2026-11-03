import React, { useState } from 'react';
import { adminApi, churchDataUrl } from './adminApi';
import { Button, Input, InlineRename } from './ui';

export default function ChurchesTab({ churches, onChanged, run }) {
  const [name, setName] = useState('');
  const [seed, setSeed] = useState(true);

  const add = async (e) => {
    e.preventDefault();
    await run(async () => {
      await adminApi.createChurch(name, seed);
      setName('');
      await onChanged();
    }, 'Kostol je pridaný');
  };

  const rename = (church, newName) => run(async () => {
    await adminApi.renameChurch(church.id, newName);
    await onChanged();
  }, 'Kostol je premenovaný');

  const remove = async (church) => {
    if (!window.confirm(`Naozaj zmazať kostol "${church.name}"? Jeho piesne a obrázky sa presunú do priečinka deleted/ na serveri.`)) return;
    await run(async () => {
      await adminApi.deleteChurch(church.id);
      await onChanged();
    }, 'Kostol je zmazaný');
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <form className="bg-white border rounded p-4 shadow-sm space-y-2" onSubmit={add}>
        <div className="font-semibold text-sm">Nový kostol</div>
        <div className="flex gap-2">
          <Input className="flex-1" placeholder="Názov kostola, napr. Kostol sv. Martina" value={name} onChange={e => setName(e.target.value)} maxLength={100} />
          <Button type="submit" variant="success" disabled={!name.trim()}>Pridať</Button>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={seed} onChange={e => setSeed(e.target.checked)} />
          Naplniť piesňami zo spevníka JKS (kostol dostane vlastnú kópiu, ktorú môže ľubovoľne upravovať)
        </label>
      </form>

      <div className="bg-white border rounded shadow-sm">
        {churches.map(c => (
          <div key={c.id} className="p-3 border-b text-sm flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
            <div>
              <div className="font-medium"><InlineRename value={c.name} onSave={(n) => rename(c, n)} /></div>
              <div className="text-xs text-gray-500 mt-1">
                Adresa pre Orange Pi: <code className="bg-gray-100 px-1 rounded select-all">{churchDataUrl(c.id)}</code>
              </div>
            </div>
            <Button variant="danger" onClick={() => remove(c)}>Zmazať</Button>
          </div>
        ))}
        {!churches.length && <div className="text-sm text-gray-500 p-3">Zatiaľ žiadne kostoly.</div>}
      </div>
    </div>
  );
}
