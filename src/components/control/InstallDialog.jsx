import React, { useEffect, useMemo, useState } from 'react';
import qrcode from 'qrcode-generator';

// Zachytený systémový návrh na inštaláciu (Chrome/Edge – iba pri https alebo localhost)
let deferredPrompt = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
  });
}

function detectPlatform() {
  const ua = navigator.userAgent || '';
  const iPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  if (/iPhone|iPad|iPod/i.test(ua) || iPadOS) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'pc';
}

const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;

function QrCode({ text }) {
  const svg = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    return qr.createSvgTag({ cellSize: 5, margin: 2, scalable: true });
  }, [text]);
  return <div className="w-48 h-48 bg-white p-1 rounded-xl mx-auto [&_svg]:w-full [&_svg]:h-full" dangerouslySetInnerHTML={{ __html: svg }} />;
}

function Steps({ items }) {
  return (
    <ol className="space-y-2">
      {items.map((t, i) => (
        <li key={i} className="flex gap-3 text-sm">
          <span className="w-6 h-6 shrink-0 rounded-full bg-accent/15 text-accent text-xs font-bold grid place-items-center">{i + 1}</span>
          <span className="pt-0.5">{t}</span>
        </li>
      ))}
    </ol>
  );
}

const TABS = [
  ['android', 'Android'],
  ['ios', 'iPhone / iPad'],
  ['pc', 'Z počítača'],
];

// Okno "Aplikácia do telefónu": stiahnutie Android aplikácie a pridanie na plochu (Android, iPhone, iPad)
export default function InstallDialog({ onClose, health }) {
  const [tab, setTab] = useState(detectPlatform);
  const [canPrompt, setCanPrompt] = useState(Boolean(deferredPrompt));
  // Otvorené priamo na zariadení (localhost)? Telefón potrebuje adresu zariadenia v sieti.
  const local = /^(localhost|127\.|\[?::1)/.test(window.location.hostname);
  const lanIp = local ? health?.lan?.[0] : null;
  const host = lanIp || window.location.hostname;
  const controlUrl = lanIp ? `${window.location.protocol}//${lanIp}:${window.location.port}/#control` : `${window.location.origin}/#control`;
  const standalone = isStandalone();

  useEffect(() => {
    const onPrompt = () => setCanPrompt(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice.catch(() => {});
    deferredPrompt = null;
    setCanPrompt(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-title"
        className="bg-surface w-full sm:max-w-lg max-h-[92vh] overflow-auto rounded-t-2xl sm:rounded-2xl shadow-xl p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src="/icons/icon-192.png" alt="" className="w-12 h-12 rounded-xl" />
            <div>
              <h2 id="install-title" className="font-bold text-lg">Aplikácia do telefónu a tabletu</h2>
              <p className="text-xs text-muted">Ovládanie Laudate ako ikona na ploche, bez panelu prehliadača</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-icon text-xl" aria-label="Zavrieť">×</button>
        </div>

        {standalone && (
          <div className="p-3 rounded-xl bg-ok/10 text-ok text-sm font-semibold">Laudate už beží ako aplikácia na tomto zariadení.</div>
        )}

        <div className="flex gap-1 p-1 rounded-xl bg-sunken" role="tablist">
          {TABS.map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`flex-1 min-h-[40px] rounded-lg text-sm font-semibold transition ${tab === id ? 'bg-surface shadow-sm text-accent' : 'text-muted'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'android' && (
          <div className="space-y-4">
            <a href="/laudate.apk" download="Laudate.apk" className="btn-primary w-full !min-h-[52px] text-base">
              ⬇ Stiahnuť aplikáciu Laudate pre Android
            </a>
            <Steps
              items={[
                'Ťuknite na tlačidlo vyššie a stiahnutý súbor Laudate.apk otvorte.',
                'Povoľte inštaláciu z tohto zdroja (Android sa opýta raz) a ťuknite na Inštalovať.',
                <>Pri prvom spustení, ak sa aplikácia nepripojí, zvoľte <b>Zmeniť adresu</b> a zadajte <b className="font-mono">{host}</b>.</>,
                'Obrazovka telefónu počas omše nezhasne; adresu zmeníte cez tlačidlo Späť.',
              ]}
            />
            <div className="text-xs text-muted border-t border-line pt-3">
              Bez inštalácie súboru: v prehliadači Chrome otvorte ponuku ⋮ a zvoľte <b>Pridať na plochu</b>.
            </div>
            {canPrompt && <button onClick={install} className="btn w-full">Pridať na plochu teraz</button>}
          </div>
        )}

        {tab === 'ios' && (
          <div className="space-y-4">
            <Steps
              items={[
                <>Otvorte túto stránku v <b>Safari</b> (adresa <span className="font-mono">{host}</span>).</>,
                <>Ťuknite na tlačidlo <b>Zdieľať</b> (štvorec so šípkou ⬆) – na iPhone dole, na iPade hore.</>,
                <>V ponuke zvoľte <b>Pridať na plochu</b> a potvrďte <b>Pridať</b>.</>,
                'Na ploche pribudne ikona Laudate – otvorí ovládanie na celú obrazovku, bez panelu Safari.',
              ]}
            />
            <div className="text-xs text-muted border-t border-line pt-3">
              Pre iPhone a iPad nie je aplikácia v App Store – ikona na ploche funguje rovnako a nič netreba sťahovať.
            </div>
          </div>
        )}

        {tab === 'pc' && (
          <div className="space-y-3 text-center">
            <p className="text-sm">Naskenujte kód fotoaparátom telefónu alebo tabletu – otvorí sa ovládanie. Potom postupujte podľa návodu pre Android alebo iPhone.</p>
            <QrCode text={controlUrl} />
            <div className="font-mono text-sm select-all">{controlUrl}</div>
            <p className="text-xs text-muted">Telefón musí byť na tej istej Wi-Fi ako zariadenie v kostole.</p>
            {canPrompt && <button onClick={install} className="btn-primary w-full">Nainštalovať do tohto počítača</button>}
          </div>
        )}
      </div>
    </div>
  );
}
