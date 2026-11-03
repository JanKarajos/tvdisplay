import React, { useEffect, useMemo, useState } from 'react';
import Preview from '../Preview';
import { library } from '../../api/api';
import { stateClient } from '../../api/stateClient';
import { splitIntoPages } from '../../lib/lyrics';
import { reportSave } from '../../lib/notify';
import { toast } from '../../lib/toast';

// Úprava piesne so živým náhľadom, ako bude vyzerať na TV.
// onSave(fields) -> { ok, error } (predvolene uloženie do knižnice na GitHub); song bez id = nová pieseň
export default function SongEditor({ song, categories, onClose, onSave, onDelete }) {
  const isNew = !song.id;
  const [title, setTitle] = useState(song.title || '');
  const [number, setNumber] = useState(song.number ? String(song.number) : '');
  const [category, setCategory] = useState(song.category || categories[0]?.id || '');
  const [lyrics, setLyrics] = useState(song.lyrics || '');
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);

  const pages = useMemo(() => splitIntoPages(lyrics), [lyrics]);
  const dirty = title !== (song.title || '') || number !== (song.number ? String(song.number) : '') || category !== (song.category || '') || lyrics !== (song.lyrics || '');
  const shownPage = Math.min(page, Math.max(0, pages.length - 1));

  const close = () => {
    if (dirty && !window.confirm('Zahodiť neuložené zmeny?')) return;
    onClose();
  };

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    const fields = { title, number, category, lyrics };
    if (onSave) {
      const result = await onSave(fields);
      setBusy(false);
      if (!result.ok) return window.alert(result.error || 'Pieseň sa nepodarilo uložiť');
      toast(`Uložené: ${title}`, { tone: 'ok' });
      return onClose();
    }
    const result = await library.updateSong(song.id, fields);
    setBusy(false);
    reportSave(result, 'Zmena sa neuložila na GitHub');
    if (result.ok) toast(`Uložené: ${title}`, { tone: 'ok' });
    onClose();
  };

  const previewSong = { id: song.id || 'new', title, number, lyrics };
  const previewState = { ...stateClient.getState(), isHidden: false };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-stretch sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" aria-label={isNew ? 'Nová pieseň' : `Upraviť pieseň ${song.title}`}>
      <form onSubmit={save} className="bg-surface text-fg w-full max-w-5xl sm:rounded-2xl shadow-2xl border border-line flex flex-col max-h-full sm:max-h-[92vh]">
        <div className="flex items-center justify-between gap-2 px-4 h-14 border-b border-line shrink-0">
          <h2 className="font-bold truncate">{isNew ? 'Nová pieseň' : 'Upraviť pieseň'}</h2>
          <button type="button" onClick={close} className="btn-icon" aria-label="Zavrieť">✕</button>
        </div>

        <div className="flex-1 overflow-auto p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="grid grid-cols-[6rem_1fr] gap-2">
              <label className="text-xs text-muted">
                Číslo
                <input className="field mt-1 tabular-nums" value={number} onChange={(e) => setNumber(e.target.value)} inputMode="numeric" />
              </label>
              <label className="text-xs text-muted">
                Názov
                <input className="field mt-1" value={title} onChange={(e) => setTitle(e.target.value)} required />
              </label>
            </div>
            <label className="block text-xs text-muted">
              Kategória
              <select className="field mt-1" value={category} onChange={(e) => setCategory(e.target.value)} required>
                {!category && <option value="">Vyber kategóriu…</option>}
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="block text-xs text-muted">
              Text – strofy oddeľ prázdnym riadkom ({pages.length} {pages.length === 1 ? 'strofa' : pages.length >= 2 && pages.length <= 4 ? 'strofy' : 'strof'})
              <textarea
                className="field mt-1 py-2 min-h-[16rem] lg:min-h-[22rem] leading-relaxed text-[15px]"
                value={lyrics}
                onChange={(e) => setLyrics(e.target.value)}
                required
                spellCheck
                lang="sk"
              />
            </label>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-muted">Náhľad na TV</div>
            <Preview state={previewState} song={previewSong} page={shownPage} />
            {pages.length > 1 && (
              <div className="flex flex-wrap gap-1.5">
                {pages.map((_, i) => (
                  <button
                    type="button"
                    key={i}
                    onClick={() => setPage(i)}
                    className={`w-10 h-10 rounded-xl text-sm font-semibold ${i === shownPage ? 'bg-accent text-on-accent' : 'bg-sunken hover:bg-line'}`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-line shrink-0 pb-safe">
          {onDelete && !isNew && (
            <button type="button" onClick={onDelete} className="btn mr-auto hover:!text-danger">🗑 Zmazať pieseň</button>
          )}
          <button type="button" onClick={close} className="btn">Zrušiť</button>
          <button className="btn-primary min-w-[8rem]" disabled={busy || !dirty || !title.trim() || !lyrics.trim() || !category}>
            {busy ? 'Ukladám…' : 'Uložiť'}
          </button>
        </div>
      </form>
    </div>
  );
}
