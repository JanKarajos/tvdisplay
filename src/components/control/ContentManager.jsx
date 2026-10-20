import React, { useState } from 'react';
import Card from '../Card';
import { actions } from '../../lib/actions';
import { library, loadLibrary } from '../../api/api';
import { reportSave } from '../../lib/notify';
import { toast } from '../../lib/toast';
import { normalizeText } from '../../lib/lyrics';
import { stateClient } from '../../api/stateClient';

const input = 'field';
const primary = 'btn-primary';

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
      <textarea className={`${input} py-2`} placeholder={'Text piesne – strofy oddeľ prázdnym riadkom'} value={lyrics} onChange={(e) => setLyrics(e.target.value)} rows={6} required />
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
    actions.forget(img.id);
    if (stateClient.getState().background === img.imageUrl) actions.setBackground(null);
    reportSave(await library.deleteImage(img.id), 'Vymazanie sa neuložilo');
    toast(`Vymazané: ${img.title}`);
  };

  return (
    <div className="space-y-4">
      <form className="flex flex-wrap items-end gap-2" onSubmit={submit}>
        <input className={`${input} flex-1 min-w-[10rem]`} placeholder="Názov obrázka" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <input
          type="file"
          accept="image/*"
          required
          className="text-sm flex-1 min-w-[10rem] file:btn file:mr-3 file:!min-h-[40px]"
          onChange={async (e) => setDataUrl(e.target.files?.[0] ? await readAsDataUrl(e.target.files[0]) : '')}
        />
        {dataUrl && <img src={dataUrl} alt="" className="h-11 rounded-lg border border-line" />}
        <button className={primary} disabled={busy || !title || !dataUrl}>{busy ? 'Ukladám…' : 'Pridať'}</button>
      </form>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {!images.length && <div className="text-sm text-muted">Žiadne obrázky</div>}
        {images.map((img) => (
          <div key={img.id} className="rounded-xl overflow-hidden border border-line bg-sunken">
            <img src={img.imageUrl} alt={img.title} className="w-full aspect-video object-cover" />
            <div className="flex items-center gap-1 pl-2">
              <span className="flex-1 min-w-0 text-xs truncate" title={img.title}>{img.title}</span>
              <button onClick={() => remove(img)} className="btn-icon hover:!text-danger" title="Vymazať" aria-label={`Vymazať: ${img.title}`}>🗑</button>
            </div>
            <div className="grid grid-cols-2 gap-1 p-1 pt-0">
              <button onClick={() => actions.addToPlaylist(img.id)} className="btn !min-h-[36px] !px-2 text-xs">+ Poradie</button>
              <button onClick={() => actions.setBackground(img.imageUrl)} className="btn !min-h-[36px] !px-2 text-xs">Pozadie</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const PRESENTATION_ACCEPT = '.pdf,.ppt,.pptx,.pps,.ppsx,.odp,application/pdf';

function titleFromFile(name) {
  return name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
}

function Presentations({ presentations, canConvert }) {
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const isPowerPoint = file && !/\.pdf$/i.test(file.name);

  const submit = async (e) => {
    e.preventDefault();
    const form = e.target;
    setBusy(true);
    const result = await library.addPresentation({ title, file });
    setBusy(false);
    if (!result.item) {
      window.alert(result.error || 'Prezentáciu sa nepodarilo pridať');
      return;
    }
    toast(`${result.item.title} – ${result.item.pageCount} ${pluralPages(result.item.pageCount)}`, { tone: 'ok' });
    reportSave(result, 'Prezentácia je na serveri, ale zoznam sa neuložil');
    setTitle('');
    setFile(null);
    form.reset();
  };

  return (
    <div className="space-y-4">
      <form className="space-y-2" onSubmit={submit}>
        <div className="flex flex-wrap items-end gap-2">
          <input
            type="file"
            accept={PRESENTATION_ACCEPT}
            required
            className="text-sm flex-1 min-w-[12rem] file:btn file:mr-3 file:!min-h-[40px]"
            onChange={(e) => {
              const f = e.target.files?.[0] || null;
              setFile(f);
              if (f && !title) setTitle(titleFromFile(f.name));
            }}
          />
          <input className={`${input} flex-1 min-w-[10rem]`} placeholder="Názov prezentácie" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <button className={primary} disabled={busy || !title || !file}>
            {busy ? (isPowerPoint ? 'Prevádzam…' : 'Nahrávam…') : 'Pridať'}
          </button>
        </div>
        <p className="text-xs text-muted">
          PDF alebo PowerPoint (PPT, PPTX), prípadne ODP. Počet strán sa zistí automaticky.
          {isPowerPoint && ' Prevod PowerPointu môže trvať do minúty.'}
        </p>
        {isPowerPoint && !canConvert && (
          <p className="text-xs text-warn">Na serveri zatiaľ nie je LibreOffice, PowerPoint sa nepodarí previesť. Na Raspberry Pi: <code>sudo apt install libreoffice-impress</code></p>
        )}
      </form>
      <div className="space-y-1">
        {!presentations.length && <div className="text-sm text-muted">Žiadne prezentácie</div>}
        {presentations.map((p) => (
          <div key={p.id} className="flex items-center gap-2 pl-3 rounded-xl hover:bg-sunken">
            <span>📄</span>
            <span className="flex-1 text-sm truncate">{p.title}</span>
            <span className="text-xs text-muted">{p.pageCount} {pluralPages(p.pageCount)}</span>
            <button onClick={() => actions.addToPlaylist(p.id)} className="btn !min-h-[36px] !px-3 text-xs">+ Do poradia</button>
            <button onClick={() => actions.show(p)} className="btn-icon" title="Zobraziť hneď" aria-label={`Zobraziť hneď: ${p.title}`}>▶</button>
            <button onClick={() => removeSong(p, 'prezentáciu')} className="btn-icon hover:!text-danger" title="Vymazať" aria-label={`Vymazať: ${p.title}`}>🗑</button>
          </div>
        ))}
      </div>
    </div>
  );
}

async function removeSong(song, what) {
  if (!window.confirm(`Naozaj vymazať ${what} „${song.title}“?\n\nZmaže sa zo zoznamu na všetkých zariadeniach.`)) return;
  actions.forget(song.id);
  reportSave(await library.deleteSong(song.id), 'Vymazanie sa neuložilo');
  toast(`Vymazané: ${song.title}`);
}

// Správa piesní: vyhľadanie a vymazanie
function ManageSongs({ songs, categories }) {
  const [query, setQuery] = useState('');
  const q = normalizeText(query);
  const results = q
    ? songs.filter((s) => s.category && (normalizeText(s.title).includes(q) || String(s.number || '').startsWith(q))).slice(0, 100)
    : [];
  const categoryName = (id) => categories.find((c) => c.id === id)?.name || id;

  return (
    <div className="space-y-3">
      <input type="search" className={`${input} text-base`} placeholder="Nájdi pieseň na vymazanie (názov alebo číslo)…" value={query} onChange={(e) => setQuery(e.target.value)} />
      {!q && <p className="text-sm text-muted">Začni písať názov alebo číslo piesne.</p>}
      {q && !results.length && <p className="text-sm text-muted">Nič sa nenašlo.</p>}
      <div className="space-y-1">
        {results.map((s) => (
          <div key={s.id} className="flex items-center gap-2 pl-3 rounded-xl hover:bg-sunken">
            <span className="w-9 shrink-0 text-right text-sm text-muted tabular-nums">{s.number || ''}</span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm truncate">{s.title}</span>
              <span className="block text-xs text-muted">{categoryName(s.category)}</span>
            </span>
            <button onClick={() => removeSong(s, 'pieseň')} className="btn !min-h-[36px] !px-3 text-xs hover:!text-danger hover:!border-danger">Vymazať</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function pluralPages(n) {
  if (n === 1) return 'strana';
  return n >= 2 && n <= 4 ? 'strany' : 'strán';
}

function Sync({ lib, health }) {
  const [busy, setBusy] = useState(false);
  const sourceLabel = { GitHub: 'GitHub', server: 'lokálna kópia na serveri', cache: 'uložená kópia v prehliadači' }[lib.source] || 'nič';
  return (
    <div className="space-y-2 text-sm">
      <div>Piesne načítané z: <b>{sourceLabel}</b> ({lib.songs.length} piesní, {lib.images.length} obrázkov)</div>
      {lib.source && lib.source !== 'GitHub' && <div className="text-warn">GitHub nie je dostupný – zobrazuje sa záložná kópia.</div>}
      <div>
        Ukladanie na GitHub:{' '}
        {health == null ? <b className="text-danger">server nedostupný</b> : health.github?.tokenConfigured ? <b className="text-ok">aktívne (token je na serveri)</b> : <b className="text-warn">token na serveri chýba – ukladá sa iba lokálne</b>}
      </div>
      <button
        className="btn"
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
  ['songs', 'Piesne'],
  ['images', 'Obrázky'],
  ['pdf', 'Prezentácie'],
  ['sync', 'Synchronizácia'],
];

export default function ContentManager({ lib, health }) {
  const [tab, setTab] = useState('text');
  return (
    <Card title="Správa obsahu" subtitle="Nové texty, obrázky a prezentácie sa uložia na server aj na GitHub" className="max-w-4xl mx-auto">
      <div className="flex gap-1 border-b border-line mb-4 -mt-1 overflow-x-auto">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`min-h-[44px] px-4 text-sm font-semibold -mb-px border-b-2 whitespace-nowrap ${tab === id ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-fg'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'text' && <AddText categories={lib.categories} />}
      {tab === 'songs' && <ManageSongs songs={lib.songs} categories={lib.categories} />}
      {tab === 'images' && <Images images={lib.images} />}
      {tab === 'pdf' && <Presentations presentations={lib.presentations} canConvert={Boolean(health?.converter?.powerpoint)} />}
      {tab === 'sync' && <Sync lib={lib} health={health} />}
    </Card>
  );
}
