import React, { useEffect, useRef, useState } from 'react';
import { adminApi, mediaUrl } from './adminApi';
import { Button, Input, Field, InlineRename } from './ui';
import { countPdfPages } from '../lib/pdf';

const MAX_IMAGE_SIZE = 1920; // viac TV aj tak nezobrazí

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Zmenší veľký obrázok na max. 1920 px a uloží ho ako JPEG - šetrí miesto aj čas načítania na Orange Pi
async function prepareImage(file) {
  const original = await readAsDataUrl(file);
  if (file.type === 'image/gif') return original;
  const img = new Image();
  img.src = original;
  await img.decode();
  const scale = Math.min(1, MAX_IMAGE_SIZE / Math.max(img.width, img.height));
  if (scale === 1 && file.size < 1024 * 1024) return original;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.85);
}

const titleFromFile = (file) => file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');

export function ImagesTab({ churchId, run }) {
  const [images, setImages] = useState([]);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef(null);

  useEffect(() => {
    adminApi.list(churchId, 'images').then(setImages).catch(() => {});
  }, [churchId]);

  const upload = async (e) => {
    e.preventDefault();
    setUploading(true);
    await run(async () => {
      const dataUrl = await prepareImage(file);
      const created = await adminApi.create(churchId, 'images', { title, dataUrl });
      setImages(list => [...list, created]);
      setTitle('');
      setFile(null);
      if (fileInput.current) fileInput.current.value = '';
    }, 'Obrázok je nahratý');
    setUploading(false);
  };

  const rename = (image, newTitle) => run(async () => {
    const updated = await adminApi.update(churchId, 'images', image.id, { title: newTitle });
    setImages(list => list.map(i => (i.id === image.id ? updated : i)));
  }, 'Obrázok je premenovaný');

  const remove = async (image) => {
    if (!window.confirm(`Naozaj zmazať obrázok "${image.title}"?`)) return;
    await run(async () => {
      await adminApi.remove(churchId, 'images', image.id);
      setImages(list => list.filter(i => i.id !== image.id));
    }, 'Obrázok je zmazaný');
  };

  return (
    <div className="space-y-4">
      <form className="bg-white border rounded p-4 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-2 items-end" onSubmit={upload}>
        <Field label="Súbor (JPG, PNG, WEBP, GIF)">
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="text-sm w-full"
            onChange={e => {
              const f = e.target.files?.[0] || null;
              setFile(f);
              if (f && !title) setTitle(titleFromFile(f));
            }}
            required
          />
        </Field>
        <Field label="Názov">
          <Input className="w-full" value={title} onChange={e => setTitle(e.target.value)} required maxLength={200} />
        </Field>
        <Button type="submit" variant="success" disabled={uploading || !file || !title.trim()}>
          {uploading ? 'Nahrávam...' : 'Nahrať obrázok'}
        </Button>
      </form>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {images.map(img => (
          <div key={img.id} className="bg-white border rounded p-2 shadow-sm text-sm">
            <img src={mediaUrl(churchId, img.imageUrl)} alt={img.title} className="w-full aspect-video object-cover rounded mb-2 bg-gray-100" />
            <div className="mb-2 break-words"><InlineRename value={img.title} onSave={(t) => rename(img, t)} /></div>
            <Button variant="danger" onClick={() => remove(img)}>Zmazať</Button>
          </div>
        ))}
      </div>
      {!images.length && <div className="text-sm text-gray-500">Zatiaľ žiadne obrázky.</div>}
    </div>
  );
}

export function PdfsTab({ churchId, run }) {
  const [pdfs, setPdfs] = useState([]);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef(null);

  useEffect(() => {
    adminApi.list(churchId, 'pdfs').then(setPdfs).catch(() => {});
  }, [churchId]);

  const upload = async (e) => {
    e.preventDefault();
    setUploading(true);
    await run(async () => {
      const [dataUrl, pageCount] = await Promise.all([readAsDataUrl(file), countPdfPages(file)]);
      const created = await adminApi.create(churchId, 'pdfs', { title, dataUrl, pageCount });
      setPdfs(list => [...list, created]);
      setTitle('');
      setFile(null);
      if (fileInput.current) fileInput.current.value = '';
    }, 'Prezentácia je nahratá');
    setUploading(false);
  };

  const rename = (pdf, newTitle) => run(async () => {
    const updated = await adminApi.update(churchId, 'pdfs', pdf.id, { title: newTitle });
    setPdfs(list => list.map(p => (p.id === pdf.id ? updated : p)));
  }, 'Prezentácia je premenovaná');

  const remove = async (pdf) => {
    if (!window.confirm(`Naozaj zmazať prezentáciu "${pdf.title}"?`)) return;
    await run(async () => {
      await adminApi.remove(churchId, 'pdfs', pdf.id);
      setPdfs(list => list.filter(p => p.id !== pdf.id));
    }, 'Prezentácia je zmazaná');
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <form className="bg-white border rounded p-4 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-2 items-end" onSubmit={upload}>
        <Field label="PDF súbor (max. 40 MB)">
          <input
            ref={fileInput}
            type="file"
            accept="application/pdf"
            className="text-sm w-full"
            onChange={e => {
              const f = e.target.files?.[0] || null;
              setFile(f);
              if (f && !title) setTitle(titleFromFile(f));
            }}
            required
          />
        </Field>
        <Field label="Názov">
          <Input className="w-full" value={title} onChange={e => setTitle(e.target.value)} required maxLength={200} />
        </Field>
        <Button type="submit" variant="success" disabled={uploading || !file || !title.trim()}>
          {uploading ? 'Nahrávam...' : 'Nahrať PDF'}
        </Button>
      </form>

      <div className="bg-white border rounded shadow-sm">
        {pdfs.map(pdf => (
          <div key={pdf.id} className="flex items-center justify-between p-3 border-b text-sm">
            <div className="flex items-center gap-2">
              <span className="text-2xl">📄</span>
              <div>
                <InlineRename value={pdf.title} onSave={(t) => rename(pdf, t)} />
                <div className="text-xs text-gray-500">
                  {pdf.pageCount} strán · <a className="underline" href={mediaUrl(churchId, pdf.pdfUrl)} target="_blank" rel="noreferrer">otvoriť</a>
                </div>
              </div>
            </div>
            <Button variant="danger" onClick={() => remove(pdf)}>Zmazať</Button>
          </div>
        ))}
        {!pdfs.length && <div className="text-sm text-gray-500 p-3">Zatiaľ žiadne prezentácie.</div>}
      </div>
    </div>
  );
}
