// Volania servera pre televízor, rozpoznanie textu z fotky a hudobný sprievod
import { SERVER_URL } from '../config';
import { markAuthRequired, writeHeaders } from './stateClient';

export async function call(path, { method = 'POST', body, raw, filename } = {}) {
  let res;
  try {
    const headers = writeHeaders();
    if (raw) {
      delete headers['Content-Type'];
      headers['Content-Type'] = 'application/octet-stream';
      if (filename) headers['X-Filename'] = encodeURIComponent(filename);
    }
    res = await fetch(`${SERVER_URL}${path}`, { method, headers, body: raw || (body !== undefined ? JSON.stringify(body) : undefined), cache: 'no-store' });
  } catch {
    throw new Error('Zariadenie v kostole nie je dostupné');
  }
  if (res.status === 401) {
    markAuthRequired();
    throw new Error('Je potrebný PIN');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Chyba ${res.status}`);
  return data;
}

export const tvApi = {
  get: () => call('/api/tv', { method: 'GET' }),
  update: (patch) => call('/api/tv', { method: 'PUT', body: patch }),
  run: (action) => call(`/api/tv/${action}`),
};

export const accompaniment = {
  status: () => call('/api/accompaniment', { method: 'GET' }),
  play: (songId, pages, { from = 0, marking = false } = {}) => call('/api/accompaniment/play', { body: { songId, pages, from, marking } }),
  run: (action) => call(`/api/accompaniment/${action}`),
  upload: (file) => call('/api/audio', { raw: file, filename: file.name }),
};

export async function recognizePhoto(blob) {
  return (await call('/api/ocr', { raw: blob })).text || '';
}
