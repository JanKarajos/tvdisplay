import React, { Suspense, lazy } from 'react';
import SongRenderer from './SongRenderer';
import { resolveServerUrl } from '../config';
import { resolveTheme } from '../lib/liturgy';

// PDF knižnica je veľká – načíta sa až keď je naozaj potrebná
const PdfView = lazy(() => import('./PdfView'));

function Fill({ background, theme }) {
  if (!background) return <div className="absolute inset-0" style={{ background: theme.background }} />;
  if (background.startsWith('#')) return <div className="absolute inset-0" style={{ backgroundColor: background }} />;
  return <img src={background} alt="" className="absolute inset-0 w-full h-full object-cover" />;
}

// Spoločné vykreslenie pre TV aj náhľad v ovládaní, aby náhľad presne zodpovedal displeju
export default function Stage({ state, song, page, preview = false }) {
  const settings = state.settings || {};
  const theme = resolveTheme(settings.theme);
  const currentPage = typeof page === 'number' ? page : state.currentPage || 0;
  const isText = Boolean(song?.lyrics);
  const hasContent = Boolean(song && (song.lyrics || song.pdfUrl || song.imageUrl));
  const showContent = hasContent && (preview || !state.isHidden);

  // Pozadie: bez obsahu (alebo skryté) zvolené pozadie; pri texte téma, prípadne stmavený obrázok
  let layer;
  if (!showContent || (preview && state.isHidden)) {
    layer = <Fill background={state.background} theme={theme} />;
  } else if (isText && settings.textOverBackground && state.background) {
    layer = (
      <>
        <Fill background={state.background} theme={theme} />
        <div className="absolute inset-0 bg-black/60" />
      </>
    );
  } else if (isText) {
    layer = <Fill background={null} theme={theme} />;
  } else {
    layer = <div className="absolute inset-0 bg-black" />;
  }

  return (
    <div className="absolute inset-0 overflow-hidden text-white">
      {layer}
      {showContent && (
        <div className={`absolute inset-0 ${state.isHidden ? 'opacity-30' : ''}`}>
          {song.pdfUrl ? (
            preview ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-white/80">
                <div className="text-3xl">📄</div>
                <div className="text-xs font-semibold text-center px-2">{song.title}</div>
                <div className="text-[10px] text-white/50">strana {currentPage + 1} / {song.pageCount || '?'}</div>
              </div>
            ) : (
              <Suspense fallback={null}>
                <PdfView url={resolveServerUrl(song.pdfUrl)} page={currentPage + 1} />
              </Suspense>
            )
          ) : (
            <SongRenderer
              lyrics={song.lyrics}
              title={song.title}
              number={song.number}
              imageUrl={song.imageUrl}
              currentPage={currentPage}
              hideTitle={song.hideTitle}
              accent={theme.accent}
            />
          )}
        </div>
      )}
    </div>
  );
}
