import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api/mockApi';
import { serverAvailable, getDataUrls } from '../api/server';
import { useRealtime } from '../hooks/useRealtime';
import SongRenderer from '../components/SongRenderer';
import { Document, Page } from 'react-pdf';
import '../lib/pdf'; // nastaví PDF.js worker
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

export default function DisplayPage() {
  const [state, setState] = useState({ currentSongId: null, background: null, isHidden: false, currentPage: 0 });
  const [song, setSong] = useState(null);
  const [numPages, setNumPages] = useState(null);
  // Promise, ktorý sa splní po prvom načítaní piesní a obrázkov
  const dataLoaded = useRef(null);
  // Položky, pre ktoré sme už skúsili znova stiahnuť dáta (aby sme to nerobili každú sekundu)
  const refreshedIds = useRef(new Set());
  
  // Auto-load songs and images from GitHub on mount
  if (!dataLoaded.current) {
    dataLoaded.current = (async () => {
      const urls = await getDataUrls();
      try {
        console.log('[DisplayPage] Auto-loading songs from URL:', urls.songs);
        await api.loadRemoteSongs(urls.songs);
        console.log('[DisplayPage] Songs loaded successfully');
      } catch (e) {
        console.error('[DisplayPage] Failed to auto-load songs:', e);
      }
      try {
        // Obrázky sú potrebné, aby sa dal obrázok zobraziť ako obsah
        await api.loadRemoteImages(urls.images);
      } catch (e) {
        console.error('[DisplayPage] Failed to auto-load images:', e);
      }
    })();
  }

  // Nájde pieseň/obrázok/PDF. Ak chýba (napr. bola práve pridaná na inom zariadení),
  // stiahne aktuálne dáta z GitHubu a skúsi to znova.
  const findItem = useCallback(async (id) => {
    await dataLoaded.current;
    let item = await api.getSong(id);
    if (!item && !refreshedIds.current.has(id)) {
      refreshedIds.current.add(id);
      console.log('[DisplayPage] Item not found, reloading data:', id);
      const urls = await getDataUrls();
      await Promise.allSettled([
        api.loadRemoteSongs(urls.songs, { fresh: true }),
        api.loadRemoteImages(urls.images, { fresh: true }),
      ]);
      item = await api.getSong(id);
    }
    return item;
  }, []);
  
  // Load initial state
  useEffect(() => {
    const loadState = async () => {
      try {
        const currentState = await api.getState();
        console.log('[DisplayPage] Loaded state:', currentState);
        setState(currentState);
        if (currentState.currentSongId) {
          const songData = await findItem(currentState.currentSongId);
          console.log('[DisplayPage] Loaded song:', songData);
          setSong(songData);
        } else {
          setSong(null);
        }
      } catch (e) {
        console.error('Failed to load initial state:', e);
      }
    };
    loadState();

    // Bez servera kontroluj stav každú sekundu ako zálohu
    // (so serverom chodia zmeny spoľahlivo cez /api/events)
    let interval = null;
    let cancelled = false;
    serverAvailable.then(ok => {
      if (!ok && !cancelled) interval = setInterval(loadState, 1000);
    });
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [findItem]);

  // Listen for realtime updates
  const handleRealtimeUpdate = useCallback((msg) => {
    console.log('[DisplayPage] Realtime message received:', msg);
    if (msg.type === 'state') {
      console.log('[DisplayPage] Updating state:', msg.state);
      setState(msg.state);
      if (msg.state.currentSongId) {
        findItem(msg.state.currentSongId).then(song => {
          console.log('[DisplayPage] Loading song:', song);
          setSong(song);
        });
      } else {
        setSong(null);
      }
    }
  }, [findItem]);

  useRealtime(handleRealtimeUpdate);

  // Nový dokument - počet strán zistíme znova
  useEffect(() => {
    setNumPages(null);
  }, [song?.pdfUrl]);

  // Strana PDF sa riadi z ovládania (state.currentPage je číslovaná od 0)
  const pdfPageCount = numPages || song?.pageCount || 1;
  const pdfCurrentPage = Math.min((state.currentPage || 0) + 1, pdfPageCount);

  // Klávesnica na displeji (napr. prezentačný klikač) - mení spoločný stav, takže sa to prejaví aj v ovládaní
  useEffect(() => {
    if (!song?.pdfUrl) return;

    const handleKeyPress = (e) => {
      const page = state.currentPage || 0;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        api.setState({ currentPage: Math.min(page + 1, pdfPageCount - 1) });
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        api.setState({ currentPage: Math.max(page - 1, 0) });
      } else if (e.key === 'Home') {
        api.setState({ currentPage: 0 });
      } else if (e.key === 'End') {
        api.setState({ currentPage: pdfPageCount - 1 });
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [song, state.currentPage, pdfPageCount]);

  console.log('Rendering DisplayPage with state:', state, 'and song:', song);
  
  // Pozadie zobrazíme len keď:
  // 1. Nie je pieseň/prezentácia ALEBO
  // 2. Je pieseň ale je skrytá (isHidden=true)
  const showBackground = (!song?.lyrics && !song?.pdfUrl) || state.isHidden;
  const showContent = song && !state.isHidden;
  
  console.log('Display state:', {
    showBackground,
    showContent,
    hasLyrics: !!song?.lyrics,
    hasPdf: !!song?.pdfUrl,
    isHidden: state.isHidden,
    background: state.background,
    songId: state.currentSongId
  });

  const renderBackground = () => {
    if (!showBackground || !state.background) {
      return <div className="absolute inset-0 bg-black" />;
    }

    if (state.background.startsWith('data:')) {
      // Pre base64/DataURL obrázky
      return (
        <div className="absolute inset-0">
          <img 
            src={state.background} 
            alt="Pozadie"
            className="w-full h-full object-cover"
          />
        </div>
      );
    }

    if (state.background.startsWith('#')) {
      // Pre farebné pozadie
      return (
        <div 
          className="absolute inset-0"
          style={{ backgroundColor: state.background }}
        />
      );
    }

    // Pre URL obrázky
    return (
      <div 
        className="absolute inset-0"
        style={{ 
          backgroundImage: `url(${state.background})`,
          backgroundPosition: 'center',
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat'
        }}
      />
    );
  };

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
  };

  return (
    <div className="fixed inset-0 w-full h-full bg-black flex items-center justify-center overflow-hidden">
      {renderBackground()}

      {/* Obsah */}
      <div className="relative z-10 w-full h-full flex flex-col">
        {showContent ? (
          <>
            {song.pdfUrl ? (
              <div className="flex-1 flex flex-col items-center justify-center">
                <Document
                  key={song.pdfUrl}
                  file={song.pdfUrl}
                  onLoadSuccess={onDocumentLoadSuccess}
                  loading={
                    <div className="text-white text-2xl">Načítavam PDF...</div>
                  }
                  error={
                    <div className="text-white text-xl">Chyba pri načítaní PDF</div>
                  }
                >
                  <Page
                    pageNumber={pdfCurrentPage}
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                    height={window.innerHeight * 0.95}
                    loading={
                      <div className="text-white">Načítavam stránku...</div>
                    }
                  />
                </Document>
              </div>
            ) : (
              <div className="flex-1 w-full h-full flex items-center justify-center">
                {console.log('Rendering SongRenderer with song:', song, 'currentPage:', state.currentPage)}
                <SongRenderer {...song} currentPage={state.currentPage || 0} />
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
