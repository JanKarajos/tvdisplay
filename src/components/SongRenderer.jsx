import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { splitIntoPages } from '../lib/lyrics';

// Písmo sa nastaví pre každú strofu zvlášť (krátka strofa nie je malá kvôli dlhej) a skutočne
// sa zmeria, takže text sa vždy zmestí. Všetky rozmery sú pomerné k výške plochy, preto náhľad
// v ovládaní vyzerá presne ako zmenšená TV.
const LINE_HEIGHT = 1.25;

function fitFontSize(measure, pages, height, maxSize) {
  let best = Infinity;
  for (const lines of pages) {
    measure.textContent = lines.join('\n');
    let lo = 4;
    let hi = maxSize;
    for (let i = 0; i < 10; i++) {
      const mid = (lo + hi) / 2;
      measure.style.fontSize = `${mid}px`;
      // scrollWidth > clientWidth znamená, že sa nejaké slovo nezmestí ani po zalomení
      if (measure.scrollHeight <= height + 1 && measure.scrollWidth <= measure.clientWidth + 1) lo = mid;
      else hi = mid;
    }
    best = Math.min(best, lo);
  }
  return Math.floor(best);
}

export default function SongRenderer({ lyrics, title, number, imageUrl, currentPage = 0, hideTitle = false, accent = '#e4e4e7' }) {
  const boxRef = useRef(null);
  const measureRef = useRef(null);
  const [fontSize, setFontSize] = useState(null);
  const [boxHeight, setBoxHeight] = useState(0);

  const pages = useMemo(() => splitIntoPages(lyrics), [lyrics]);
  const pageIndex = Math.max(0, Math.min(currentPage, pages.length - 1));

  const fit = useCallback(() => {
    const box = boxRef.current;
    const measure = measureRef.current;
    if (!box || !measure || !pages[pageIndex]) return;
    const { clientHeight } = box;
    if (!clientHeight) return;
    setBoxHeight(clientHeight);
    // Hore je nadpis v rohu, dole bodky – text má zvyšných ~86 % výšky
    setFontSize(fitFontSize(measure, [pages[pageIndex]], clientHeight * 0.86, clientHeight / 5.5));
  }, [pages, pageIndex]);

  useLayoutEffect(() => {
    fit();
    const box = boxRef.current;
    if (!box) return undefined;
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    // Písmo sa môže načítať až po prvom meraní (širšie ako náhradné) – zmeraj znova, inak by sa
    // slová lámali uprostred ("Blahoslaven / í")
    const fonts = document.fonts;
    let alive = true;
    fonts?.ready?.then(() => alive && fit());
    fonts?.addEventListener?.('loadingdone', fit);
    return () => {
      alive = false;
      ro.disconnect();
      fonts?.removeEventListener?.('loadingdone', fit);
    };
  }, [fit]);

  if (imageUrl && !lyrics) {
    return (
      <div className="flex items-center justify-center w-full h-full">
        <img src={imageUrl} alt={title || 'Obrázok'} className="max-h-full max-w-full object-contain" />
      </div>
    );
  }

  if (!pages.length) {
    return <div className="w-full h-full flex items-center justify-center text-white/50">Žiadny text</div>;
  }

  // pre-line: zalomenia riadkov ostanú, medzery na konci riadku sa zahodia (pri pre-wrap v starších
  // prehliadačoch v TV „trčia“ za okraj a meranie by písmo zbytočne zmenšilo)
  const textStyle = { lineHeight: LINE_HEIGHT, whiteSpace: 'pre-line', textAlign: 'center', fontWeight: 600 };
  const unit = boxHeight / 100; // 1 % výšky

  return (
    <div ref={boxRef} className="relative w-full h-full flex items-center justify-center overflow-hidden text-white">
      {/* Neviditeľný prvok na meranie textu */}
      <div ref={measureRef} aria-hidden="true" className="song-text absolute invisible pointer-events-none left-0 top-0" style={{ ...textStyle, width: '95%' }} />

      {!hideTitle && title && (
        <div
          className="song-title absolute left-0 top-0 font-semibold truncate max-w-[70%]"
          style={{ color: accent, opacity: 0.8, fontSize: Math.max(8, unit * 3.4), padding: `${unit * 2.5}px ${unit * 4}px` }}
        >
          {number ? `${number} · ` : ''}{title}
        </div>
      )}

      <div
        key={`${pageIndex}-${lyrics.length}`}
        className="song-text animate-fade-in w-[96%]"
        style={{ ...textStyle, overflowWrap: 'break-word', hyphens: 'manual', fontSize: fontSize ?? 0, visibility: fontSize ? 'visible' : 'hidden' }}
      >
        {pages[pageIndex].join('\n')}
      </div>

      {pages.length > 1 && (
        <div className="absolute left-0 right-0 flex justify-center" style={{ bottom: unit * 3.5, gap: unit * 1.2 }} aria-label={`Strofa ${pageIndex + 1} z ${pages.length}`}>
          {pages.map((_, i) => (
            <span
              key={i}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === pageIndex ? unit * 3.2 : unit * 1.1,
                height: unit * 1.1,
                background: accent,
                opacity: i === pageIndex ? 0.9 : 0.3,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
