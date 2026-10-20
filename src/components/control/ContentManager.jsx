import React, { useState } from 'react';
import Card from '../Card';
import { actions } from '../../lib/actions';
import { library, loadLibrary } from '../../api/api';
import { reportSave } from '../../lib/notify';

const input = 'w-full border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
const primary = 'px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-40';

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function AddText({ categories }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    reportSave(await library.addText({ title, category, lyrics }), 'Text sa neuložil');
    setTitle('');
    setLyrics('');
    setBusy(false);
  };

  return (
    <form className="space-y-2" onSubmit={submit}>
      <div className="flex gap-2">
        <select className={`${input} w-40`} value={category} onChange={(e) => setCategory(e.target.value)} required>
          <option value="">Kategória…</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input className={input} placeholder="Názov" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <textarea className={input} placeholder={'Text piesne – strofy oddeľ prázdnym riadkom'} value={lyrics} onChange={(e) => setLyrics(e.target.value)} rows={6} required />
      <button className={primary} disabled={busy || !title || !category || !lyrics}>{busy ? 'Ukladám…' : 'Pridať text'}</button>
    </form>
  );
}

function Images({ images }) {
  const [title, setTitle] = useState('');
  const [dataUrl, setDataUrl] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    reportSave(await library.addImage({ title, imageUrl: dataUrl }), 'Obrázok sa neuložil');
    setTitle('');
    setDataUrl('');
    e.target.reset();
    setBusy(false);
  };

  const remove = async (img) => {
    if (!window.confirm(`Naozaj vymazať obrázok „${img.title}“?`)) return;
    reportSave(await library.deleteImage(img.id), 'Vymazanie sa neuložilo');
  };

  return (
    <div className="space-y-4">
      <form className="flex flex-wrap items-end gap-2" onSubmit={submit}>
        <input className={`${input} flex-1 min-w-[10rem]`} placeholder="Názov obrázka" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <input
          type="file"
          accept="image/*"
          required
          className="text-sm flex-1 min-w-[10rem]"
          onChange={async (e) => setDataUrl(e.target.files?.[0] ? await readAsDataUrl(e.target.files[0]) : '')}
        />
        {dataUrl && <img src={dataUrl} alt="" className="h-10 rounded border" />}
        <button className={primary} disabled={busy || !title || !dataUrl}>{busy ? 'Ukladám…' : 'Pridať'}</button>
      </form>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {!images.length && <div className="text-sm text-gray-500">Žiadne obrázky</div>}
        {images.map((img) => (
          <div key={img.id} className="group relative rounded-md overflow-hidden border">
            <img src={img.imageUrl} alt={img.title} className="w-full aspect-video object-cover" />
            <div className="px-2 py-1 text-xs truncate">{img.title}</div>
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 focus-within:opacity-100 flex flex-col items-center justify-center gap-1 transition-opacity">
              <button onClick={() => actions.show(img)} className="px-2 py-1 text-xs bg-white rounded">Zobraziť na TV</button>
              <button onClick={() => actions.setBackground(img.imageUrl)} className="px-2 py-1 text-xs bg-white rounded">Nastaviť pozadie</button>
              <button onClick={() => remove(img)} className="px-2 py-1 text-xs bg-red-600 text-white rounded">Vymazať</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Pdfs({ presentations }) {
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [pageCount, setPageCount] = useState(1);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    reportSave(await library.addPdf({ title, file, pageCount }), 'Prezentácia sa neuložila');
    setTitle('');
    setFile(null);
    setPageCount(1);
    e.target.reset();
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <form className="flex flex-wrap items-end gap-2" onSubmit={submit}>
        <input className={`${input} flex-1 min-w-[10rem]`} placeholder="Názov prezentácie" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <input type="file" accept="application/pdf" required className="text-sm flex-1 min-w-[10rem]" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <label className="text-xs text-gray-500">
          Strán
          <input type="number" min="1" value={pageCount} onChange={(e) => setPageCount(parseInt(e.target.value, 10) || 1)} className={`${input} w-20`} />
        </label>
        <button className={primary} disabled={busy || !title || !file}>{busy ? 'Nahrávam…' : 'Pridať'}</button>
      </form>
      <div className="space-y-1">
        {!presentations.length && <div className="text-sm text-gray-500">Žiadne prezentácie</div>}
        {presentations.map((p) => (
          <div key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50">
            <span>📄</span>
            <span className="flex-1 text-sm truncate">{p.title}</span>
            <span className="text-xs text-gray-400">{p.pageCount} str.</span>
            <button onClick={() => actions.stageOrShow(p)} className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">Zobraziť</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Sync({ lib, health }) {
  const [busy, setBusy] = useState(false);
  const sourceLabel = { GitHub: 'GitHub', server: 'lokálna kópia na serveri', cache: 'uložená kópia v prehliadači' }[lib.source] || 'nič';
  return (
    <div className="space-y-2 text-sm">
      <div>Piesne načítané z: <b>{sourceLabel}</b> ({lib.songs.length} piesní, {lib.images.length} obrázkov)</div>
      {lib.source && lib.source !== 'GitHub' && <div className="text-amber-700">GitHub nie je dostupný – zobrazuje sa záložná kópia.</div>}
      <div>
        Ukladanie na GitHub:{' '}
        {health == null ? <b className="text-red-700">server nedostupný</b> : health.github?.tokenConfigured ? <b className="text-emerald-700">aktívne (token je na serveri)</b> : <b className="text-amber-700">token na serveri chýba – ukladá sa iba lokálne</b>}
      </div>
      <button
        className="px-3 py-1.5 text-sm border rounded-md hover:bg-gray-50 disabled:opacity-40"
        disabled={busy}
        onClick={async () => { setBusy(true); await loadLibrary({ force: true }); setBusy(false); }}
      >
        {busy ? 'Načítavam…' : 'Znova načítať piesne'}
      </button>
    </div>
  );
}

const TABS = [
  ['text', 'Nový text'],
  ['images', 'Obrázky'],
  ['pdf', 'PDF'],
  ['sync', 'Synchronizácia'],
];

export default function ContentManager({ lib, health }) {
  const [tab, setTab] = useState('text');
  return (
    <Card title="Správa obsahu">
      <div className="flex gap-1 border-b mb-3 -mt-1 overflow-x-auto">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-3 py-1.5 text-sm -mb-px border-b-2 whitespace-nowrap ${tab === id ? 'border-blue-600 text-blue-700 font-medium' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'text' && <AddText categories={lib.categories} />}
      {tab === 'images' && <Images images={lib.images} />}
      {tab === 'pdf' && <Pdfs presentations={lib.presentations} />}
      {tab === 'sync' && <Sync lib={lib} health={health} />}
    </Card>
  );
}
