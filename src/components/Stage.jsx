import React, { Suspense, lazy } from 'react';
import SongRenderer from './SongRenderer';
import { resolveServerUrl } from '../config';

// PDF knižnica je veľká – načíta sa až keď je naozaj potrebná
const PdfView = lazy(() => import('./PdfView'));

function Backdrop({ background }) {
  if (!background) return <div className="absolute inset-0 bg-black" />;
  if (background.startsWith('#')) return <div className="absolute inset-0" style={{ backgroundColor: background }} />;
  return <img src={background} alt="" className="absolute inset-0 w-full h-full object-cover" />;
}

// Spoločné vykreslenie pre TV aj náhľad v ovládaní, aby náhľad presne zodpovedal displeju
export default function Stage({ state, song, page, preview = false }) {
  const currentPage = typeof page === 'number' ? page : state.currentPage || 0;
  const hasContent = Boolean(song && (song.lyrics || song.pdfUrl || song.imageUrl));
  const showBackdrop = !hasContent || state.isHidden;
  const showContent = hasContent && (preview || !state.isHidden);

  return (
    <div className="absolute inset-0 overflow-hidden text-white">
      {showBackdrop ? <Backdrop background={state.background} /> : <div className="absolute inset-0 bg-black" />}

      {showContent && (
        <div className={`absolute inset-0 ${preview ? 'p-[3%]' : 'p-[2.5%]'} ${state.isHidden ? 'opacity-40' : ''}`}>
          {song.pdfUrl ? (
            preview ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-white/80">
                <div className="text-3xl">📄</div>
                <div className="text-xs font-medium text-center">{song.title}</div>
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
              isPreview={preview}
              hideTitle={preview || song.hideTitle}
            />
          )}
        </div>
      )}
    </div>
  );
}
