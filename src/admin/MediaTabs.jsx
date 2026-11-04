import React, { useEffect, useState } from 'react';
import Card from '../components/Card';
import { adminApi, mediaUrl } from './adminApi';
import InlineRename from './InlineRename';
import { prepareImage } from '../lib/image';

const PRESENTATION_ACCEPT = '.pdf,.ppt,.pptx,.pps,.ppsx,.odp,application/pdf';

function titleFromFile(name) {
  return name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
}

function pluralPages(n) {
  if (n === 1) return 'strana';
  return n >= 2 && n <= 4 ? 'strany' : 'strán';
}

// Spoločný formulár: súbor + názov
function UploadForm({ accept, label, busyLabel, onUpload, hint }) {
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const form = e.target;
    setBusy(true);
    const ok = await onUpload(title, file);
    setBusy(false);
    if (ok) {
      setTitle('');
      setFile(null);
      form.reset();
    }
  };

  return (
    <form className="space-y-2 mb-4" onSubmit={submit}>
      <div className="flex flex-wrap items-end gap-2">
        <input
          type="file"
          accept={accept}
          required
          className="text-sm flex-1 min-w-[12rem] file:btn file:mr-3 file:!min-h-[40px]"
          onChange={(e) => {
            const f = e.target.files?.[0] || null;
            setFile(f);
            if (f && !title) setTitle(titleFromFile(f.name));
          }}
        />
        <input className="field flex-1 min-w-[10rem]" placeholder="Názov" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
        <button className="btn-primary" disabled={busy || !title.trim() || !file}>{busy ? busyLabel : label}</button>
      </div>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </form>
  );
}

export function ImagesTab({ churchId, run }) {
  const [images, setImages] = useState([]);

  useEffect(() => {
    adminApi.list(churchId, 'images').then(setImages).catch(() => {});
  }, [churchId]);

  const upload = (title, file) => run(async () => {
    const created = await adminApi.create(churchId, 'images', { title, dataUrl: await prepareImage(file) });
    setImages((list) => [...list, created]);
  }, `Nahraté: ${title}`);

  const rename = (image, title) => run(async () => {
    const updated = await adminApi.update(churchId, 'images', image.id, { title });
    setImages((list) => list.map((i) => (i.id === image.id ? updated : i)));
  }, 'Obrázok je premenovaný');

  const remove = async (image) => {
    if (!window.confirm(`Naozaj zmazať obrázok „${image.title}“?`)) return;
    if (await run(() => adminApi.remove(churchId, 'images', image.id), `Zmazané: ${image.title}`)) {
      setImages((list) => list.filter((i) => i.id !== image.id));
    }
  };

  return (
    <Card title="Obrázky" subtitle="Pozadia a obrázky na TV. Veľké fotky sa pri nahraní samy zmenšia.">
      <UploadForm accept="image/jpeg,image/png,image/webp,image/gif" label="Nahrať" busyLabel="Nahrávam…" onUpload={upload} />
      {!images.length && <div className="text-sm text-muted">Zatiaľ žiadne obrázky.</div>}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {images.map((img) => (
          <div key={img.id} className="rounded-xl overflow-hidden border border-line bg-sunken">
            <img src={mediaUrl(churchId, img.imageUrl)} alt={img.title} className="w-full aspect-video object-cover" loading="lazy" />
            <div className="flex items-center gap-1 pl-2">
              <InlineRename value={img.title} onSave={(t) => rename(img, t)} className="flex-1 text-xs" />
              <button onClick={() => remove(img)} className="btn-icon hover:!text-danger" title="Zmazať" aria-label={`Zmazať: ${img.title}`}>🗑</button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function PdfsTab({ churchId, run, canConvert }) {
  const [pdfs, setPdfs] = useState([]);

  useEffect(() => {
    adminApi.list(churchId, 'pdfs').then(setPdfs).catch(() => {});
  }, [churchId]);

  const upload = (title, file) => run(async () => {
    const created = await adminApi.uploadPresentation(churchId, title, file);
    setPdfs((list) => [...list, created]);
  }, `Nahraté: ${title}`);

  const rename = (pdf, title) => run(async () => {
    const updated = await adminApi.update(churchId, 'pdfs', pdf.id, { title });
    setPdfs((list) => list.map((p) => (p.id === pdf.id ? updated : p)));
  }, 'Prezentácia je premenovaná');

  const remove = async (pdf) => {
    if (!window.confirm(`Naozaj zmazať prezentáciu „${pdf.title}“?`)) return;
    if (await run(() => adminApi.remove(churchId, 'pdfs', pdf.id), `Zmazané: ${pdf.title}`)) {
      setPdfs((list) => list.filter((p) => p.id !== pdf.id));
    }
  };

  return (
    <Card title="Prezentácie" subtitle="PDF – počet strán sa zistí automaticky" className="max-w-4xl">
      <UploadForm
        accept={canConvert ? PRESENTATION_ACCEPT : '.pdf,application/pdf'}
        label="Nahrať"
        busyLabel="Nahrávam…"
        onUpload={upload}
        hint={canConvert ? 'PDF alebo PowerPoint (PPT, PPTX, ODP) – PowerPoint sa prevedie na PDF.' : 'Iba PDF. PowerPoint najprv ulož ako PDF (Súbor → Uložiť ako → PDF).'}
      />
      {!pdfs.length && <div className="text-sm text-muted">Zatiaľ žiadne prezentácie.</div>}
      <div className="space-y-1">
        {pdfs.map((p) => (
          <div key={p.id} className="flex items-center gap-2 pl-3 rounded-xl hover:bg-sunken min-h-[48px]">
            <span>📄</span>
            <InlineRename value={p.title} onSave={(t) => rename(p, t)} className="flex-1 text-sm" />
            <span className="text-xs text-muted shrink-0">{p.pageCount} {pluralPages(p.pageCount)}</span>
            <a className="btn-icon" href={mediaUrl(churchId, p.pdfUrl)} target="_blank" rel="noreferrer" title="Otvoriť" aria-label={`Otvoriť: ${p.title}`}>⧉</a>
            <button onClick={() => remove(p)} className="btn-icon hover:!text-danger" title="Zmazať" aria-label={`Zmazať: ${p.title}`}>🗑</button>
          </div>
        ))}
      </div>
    </Card>
  );
}
