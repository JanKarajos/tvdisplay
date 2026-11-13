// Hudobný sprievod: zariadenie prehrá nahrávku piesne do ozvučenia kostola (USB zvuková karta)
// a podľa času v nahrávke samo posúva strofy na TV.
//   song.audioUrl    – nahrávka (/nas-media/… alebo /uploads/…)
//   song.audioStarts – sekunda, v ktorej začína každá strofa; keď chýba, čas sa rozdelí rovnomerne
// Prehráva ffmpeg priamo do ALSA; zariadenie sa dá určiť v LAUDATE_AUDIO_DEVICE (inak prvá USB
// zvuková karta, potom predvolené). LAUDATE_AUDIO_DEVICE=null iba odsimuluje prehrávanie (testy).
import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs';

export const AUDIO_TYPES = { '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.ogg': 'audio/ogg', '.opus': 'audio/ogg', '.wav': 'audio/wav', '.flac': 'audio/flac' };

function audioDevice() {
  const env = (process.env.LAUDATE_AUDIO_DEVICE || '').trim();
  if (env) return env;
  try {
    // " 1 [Device         ]: USB-Audio - USB Audio Device"
    const cards = fs.readFileSync('/proc/asound/cards', 'utf8');
    const usb = /^\s*\d+\s+\[(\S+)\s*\]:\s*USB-Audio/m.exec(cards);
    if (usb) return `plughw:CARD=${usb[1]}`;
  } catch {
    // bez zvukových kariet
  }
  return 'default';
}

export function soundOutputs() {
  try {
    return fs.readFileSync('/proc/asound/cards', 'utf8')
      .split('\n').map((l) => /^\s*\d+\s+\[\S+\s*\]:\s*(.+)$/.exec(l)?.[1]?.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

export function audioDuration(file) {
  return new Promise((resolve) => {
    execFile('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { timeout: 15000 }, (err, stdout) => {
      const d = Number.parseFloat(stdout);
      resolve(err || !Number.isFinite(d) ? null : d);
    });
  });
}

// Ktorá strofa patrí k času t
export function pageAt(t, starts) {
  let page = 0;
  for (let i = 0; i < starts.length; i++) if (t >= starts[i]) page = i;
  return page;
}

export function evenStarts(duration, pages) {
  return Array.from({ length: pages }, (_, i) => Math.round((duration * i * 100) / pages) / 100);
}

export function createPlayer({ onPage, onChange }) {
  let proc = null;
  let ticker = null;
  // status ide do ovládania
  const status = { state: 'stopped', songId: null, position: 0, duration: null, page: 0, marking: false, marks: [], error: null };
  let startedAt = 0;
  let startPos = 0;
  let file = null;
  let starts = [];

  const position = () => (status.state === 'playing' ? startPos + (Date.now() - startedAt) / 1000 : status.position);
  const emit = () => onChange({ ...status, position: Math.round(position() * 10) / 10 });

  function kill() {
    if (proc) {
      proc.removeAllListeners('close');
      proc.kill('SIGKILL');
      proc = null;
    }
    clearInterval(ticker);
    ticker = null;
  }

  function spawnAt(pos) {
    kill();
    const device = audioDevice();
    const args = ['-nostdin', '-hide_banner', '-loglevel', 'error', '-re', '-ss', String(pos), '-i', file, '-vn'];
    args.push(...(device === 'null' ? ['-f', 'null', '-'] : ['-ac', '2', '-ar', '48000', '-f', 'alsa', device]));
    let errText = '';
    proc = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    proc.stderr.on('data', (d) => { errText += d; });
    proc.on('error', () => {
      status.error = 'Na zariadení chýba ffmpeg (spusti nový inštalátor)';
      stop();
    });
    proc.on('close', (code) => {
      proc = null;
      if (code !== 0 && status.state === 'playing') status.error = errText.trim().split('\n').pop() || `Prehrávanie skončilo s chybou (${code})`;
      stop();
    });
    startPos = pos;
    startedAt = Date.now();
    status.state = 'playing';
    ticker = setInterval(tick, 200);
    tick();
  }

  let lastEmit = 0;
  function tick() {
    const t = position();
    if (!status.marking && starts.length) {
      const page = pageAt(t, starts);
      if (page !== status.page) {
        status.page = page;
        onPage(status.songId, page);
        emit();
      }
    }
    if (Date.now() - lastEmit > 1000) {
      lastEmit = Date.now();
      emit();
    }
  }

  function stop() {
    if (status.state !== 'stopped') status.position = position();
    kill();
    status.state = 'stopped';
    emit();
  }

  return {
    status: () => ({ ...status, position: Math.round(position() * 10) / 10 }),

    // marking: strofy sa neposúvajú samy, obsluha ich preklikáva a časy sa zaznamenajú (mark)
    async play({ songId, path, audioStarts, pages, from = 0, marking = false }) {
      kill();
      file = path;
      status.songId = songId;
      status.error = null;
      status.marking = marking;
      status.marks = marking ? [from] : [];
      status.duration = await audioDuration(path);
      const valid = Array.isArray(audioStarts) && audioStarts.length === pages && audioStarts.every(Number.isFinite);
      starts = valid ? audioStarts : status.duration ? evenStarts(status.duration, pages) : [0];
      status.page = marking ? 0 : pageAt(from, starts);
      onPage(songId, status.page);
      spawnAt(from);
      return this.status();
    },
    pause() {
      if (status.state !== 'playing') return this.status();
      status.position = position();
      kill();
      status.state = 'paused';
      emit();
      return this.status();
    },
    resume() {
      if (status.state === 'paused' && file) spawnAt(status.position);
      return this.status();
    },
    stop() {
      stop();
      status.marking = false;
      return this.status();
    },
    // Ďalšia strofa pri označovaní: zapamätá čas a posunie TV
    mark() {
      if (!status.marking || status.state === 'stopped') return this.status();
      status.marks.push(Math.round(position() * 10) / 10);
      status.page = status.marks.length - 1;
      onPage(status.songId, status.page);
      emit();
      return this.status();
    },
  };
}
