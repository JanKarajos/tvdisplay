import React, { useEffect, useState } from 'react';
import { accompaniment } from '../../api/device';
import { library } from '../../api/api';
import { reportSave } from '../../lib/notify';
import { toast } from '../../lib/toast';

const fmt = (s) => {
  const t = Math.max(0, Math.floor(s || 0));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

// Stav prehrávača zo servera (WebSocket správa "audio")
export function useAccompaniment() {
  const [audio, setAudio] = useState(null);
  useEffect(() => {
    let alive = true;
    accompaniment.status().then((s) => alive && setAudio(s)).catch(() => {});
    const onAudio = (e) => setAudio(e.detail);
    window.addEventListener('tvdisplay:audio', onAudio);
    return () => {
      alive = false;
      window.removeEventListener('tvdisplay:audio', onAudio);
    };
  }, []);
  return audio;
}

// Hudobný sprievod piesne, ktorá je na TV: prehrávanie do ozvučenia a nastavenie časov strof
export default function AccompanimentPanel({ song, pageCount }) {
  const audio = useAccompaniment();
  const [busy, setBusy] = useState(false);
  if (!song?.audioUrl) return null;

  const mine = audio && audio.songId === song.id && audio.state !== 'stopped';
  const marking = mine && audio.marking;
  const timed = Array.isArray(song.audioStarts) && song.audioStarts.length === pageCount;

  const act = async (fn) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast(e.message, { tone: 'danger', duration: 6000 });
    }
    setBusy(false);
  };

  const saveMarks = () => act(async () => {
    const marks = audio.marks.slice(0, pageCount);
    await accompaniment.run('stop');
    if (marks.length < pageCount) {
      toast(`Označených je ${marks.length} z ${pageCount} strof – časy sa neuložili. Skúste to znova.`, { tone: 'danger', duration: 7000 });
      return;
    }
    reportSave(await library.updateSong(song.id, { audioStarts: marks }), 'Časy strof sa neuložili');
    toast('Časy strof sú uložené – nabudúce sa strofy posunú samy', { tone: 'ok' });
  });

  return (
    <div className="mt-3 p-3 rounded-xl bg-sunken space-y-2">
      <div className="flex items-center gap-2 text-sm">
        <span className="font-semibold">🎵 Hudobný sprievod</span>
        {mine && <span className="text-muted tabular-nums">{fmt(audio.position)}{audio.duration ? ` / ${fmt(audio.duration)}` : ''}</span>}
        {!mine && <span className="text-xs text-muted">{timed ? 'strofy sa posúvajú podľa uložených časov' : 'časy strof nie sú nastavené – rozdelia sa rovnomerne'}</span>}
      </div>
      {audio?.error && audio.songId === song.id && <div className="text-xs text-danger">{audio.error}</div>}

      {marking ? (
        <div className="space-y-2">
          <div className="text-xs text-muted">Ťuknite na „Ďalšia strofa“ presne vtedy, keď sa začína spievať ďalšia strofa. Strofa {audio.marks.length} / {pageCount}.</div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary flex-1 !min-h-[56px] text-base" disabled={audio.marks.length >= pageCount} onClick={() => act(() => accompaniment.run('mark'))}>Ďalšia strofa ▶</button>
            <button className="btn" disabled={busy} onClick={saveMarks}>✓ Uložiť časy</button>
            <button className="btn" disabled={busy} onClick={() => act(() => accompaniment.run('stop'))}>Zrušiť</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {!mine && <button className="btn-primary" disabled={busy} onClick={() => act(() => accompaniment.play(song.id, pageCount))}>▶ Prehrať sprievod</button>}
          {mine && audio.state === 'playing' && <button className="btn" disabled={busy} onClick={() => act(() => accompaniment.run('pause'))}>⏸ Pauza</button>}
          {mine && audio.state === 'paused' && <button className="btn-primary" disabled={busy} onClick={() => act(() => accompaniment.run('resume'))}>▶ Pokračovať</button>}
          {mine && <button className="btn" disabled={busy} onClick={() => act(() => accompaniment.run('stop'))}>⏹ Zastaviť</button>}
          {!mine && pageCount > 1 && (
            <button className="btn" disabled={busy} onClick={() => act(() => accompaniment.play(song.id, pageCount, { marking: true }))}>⏱ Nastaviť časy strof</button>
          )}
        </div>
      )}
    </div>
  );
}

// V úprave piesne: nahratie nahrávky sprievodu (MP3 z telefónu, napr. organista nahrá pieseň raz)
export function AccompanimentUpload({ song }) {
  const [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState(song.audioUrl || '');
  if (!song.id) return null;

  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const { url } = await accompaniment.upload(file);
      const result = await library.updateSong(song.id, { audioUrl: url, audioStarts: null });
      reportSave(result, 'Nahrávka sa neuložila');
      if (result.ok) {
        setCurrent(url);
        toast('Nahrávka sprievodu je uložená. Na karte „Teraz na TV“ ju prehráte a nastavíte časy strof.', { tone: 'ok', duration: 7000 });
      }
    } catch (err) {
      toast(err.message, { tone: 'danger', duration: 6000 });
    }
    setBusy(false);
  };

  const remove = async () => {
    if (!window.confirm('Odstrániť nahrávku sprievodu z tejto piesne?')) return;
    reportSave(await library.updateSong(song.id, { audioUrl: null, audioStarts: null }), 'Zmena sa neuložila');
    setCurrent('');
  };

  return (
    <div className="p-3 rounded-xl bg-sunken space-y-2">
      <div className="text-sm font-semibold">🎵 Hudobný sprievod</div>
      <div className="text-xs text-muted">
        Nahrávka piesne (MP3, M4A, WAV), ktorú zariadenie prehrá do ozvučenia kostola. Najlepšie, keď organista
        zahrá melódiu toľkokrát, koľko má pieseň strof, a nahrá ju telefónom.
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className={`btn cursor-pointer ${busy ? 'opacity-50 pointer-events-none' : ''}`}>
          {busy ? 'Nahrávam…' : current ? 'Vymeniť nahrávku' : '⬆ Nahrať nahrávku'}
          <input type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg,.flac" className="hidden" onChange={upload} disabled={busy} />
        </label>
        {current && <span className="text-xs text-ok font-semibold">Nahrávka je pridaná</span>}
        {current && <button type="button" className="btn-icon hover:!text-danger" onClick={remove} aria-label="Odstrániť nahrávku">🗑</button>}
      </div>
    </div>
  );
}
