import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { splitIntoPages } from '../lib/lyrics';

// Písmo sa nastaví podľa najdlhšej strofy (rovnaké na všetkých stranách) a skutočne sa zmeria,
// takže text sa vždy zmestí – na TV aj v malom náhľade. Veľkosti sú pomerné k výške plochy,
// preto náhľad vyzerá ako zmenšená TV.
const LINE_HEIGHT = 1.4;

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

export default function SongRenderer({ lyrics, title, number, imageUrl, currentPage = 0, isPreview = false, hideTitle = false }) {
  const boxRef = useRef(null);
  const measureRef = useRef(null);
  const [fontSize, setFontSize] = useState(null);
  const [boxHeight, setBoxHeight] = useState(0);

  const pages = useMemo(() => splitIntoPages(lyrics), [lyrics]);
  const showTitle = Boolean(title) && !hideTitle;

  const fit = useCallback(() => {
    const box = boxRef.current;
    const measure = measureRef.current;
    if (!box || !measure || !pages.length) return;
    const { clientWidth, clientHeight } = box;
    if (!clientWidth || !clientHeight) return;
    setBoxHeight(clientHeight);
    // Najväčšie písmo ~ 1/9 výšky plochy; nadpis zaberá cca 12 %
    const available = clientHeight * (showTitle ? 0.82 : 0.94);
    setFontSize(fitFontSize(measure, pages, available, clientHeight / 9));
  }, [pages, showTitle]);

  useLayoutEffect(() => {
    fit();
    const box = boxRef.current;
    if (!box) return undefined;
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => ro.disconnect();
  }, [fit]);

  if (imageUrl && !lyrics) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full">
        <img src={imageUrl} alt={title || 'Obrázok'} className="max-h-full max-w-full object-contain" />
      </div>
    );
  }

  if (!pages.length) {
    return <div className="text-white/60 text-center" style={{ fontSize: isPreview ? 12 : 32 }}>Žiadny text k dispozícii</div>;
  }

  const pageIndex = Math.max(0, Math.min(currentPage, pages.length - 1));
  const lines = pages[pageIndex];
  const textStyle = {
    lineHeight: LINE_HEIGHT,
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
    textAlign: 'center',
  };

  return (
    <div ref={boxRef} className="song-stage relative w-full h-full flex flex-col items-center justify-center overflow-hidden text-white">
      {/* Neviditeľný prvok na meranie textu */}
      <div
        ref={measureRef}
        aria-hidden="true"
        className="song-text absolute invisible pointer-events-none"
        style={{ ...textStyle, width: '92%', left: 0, top: 0, overflowWrap: 'normal' }}
      />

      {showTitle && (
        <div className="song-title text-center font-semibold opacity-80 mb-[2%] px-[4%]" style={{ fontSize: Math.max(10, boxHeight * 0.05) }}>
          {number ? `${number}. ` : ''}{title}
        </div>
      )}

      <div
        key={`${pageIndex}-${lyrics.length}`}
        className="song-text animate-fade-in w-[92%]"
        style={{ ...textStyle, fontSize: fontSize ?? 0, visibility: fontSize ? 'visible' : 'hidden' }}
      >
        {lines.join('\n')}
      </div>

      {pages.length > 1 && (
        <div
          className="absolute font-semibold tabular-nums text-white/70 bg-black/40 rounded-full"
          style={{
            right: '2%',
            bottom: '3%',
            fontSize: Math.max(9, boxHeight * 0.03),
            padding: `${boxHeight * 0.006}px ${boxHeight * 0.016}px`,
          }}
        >
          {pageIndex + 1} / {pages.length}
        </div>
      )}
    </div>
  );
}
