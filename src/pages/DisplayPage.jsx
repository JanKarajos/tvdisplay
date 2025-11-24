import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api/mockApi';
import { useRealtime } from '../hooks/useRealtime';
import SongRenderer from '../components/SongRenderer';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const defaultGithubRawUrl = 'https://raw.githubusercontent.com/JanKarajos/tvdisplay/main/songs.json';

export default function DisplayPage() {
  const [state, setState] = useState({ currentSongId: null, background: null, isHidden: false, currentPage: 0 });
  const [song, setSong] = useState(null);
  const [pdfCurrentPage, setPdfCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(null);
  
  // Auto-load songs from GitHub on mount
  useEffect(() => {
    const autoLoad = async () => {
      const savedUrl = localStorage.getItem('tvdisplay-github-raw') || defaultGithubRawUrl;
      try {
        console.log('[DisplayPage] Auto-loading songs from URL:', savedUrl);
        await api.loadRemoteSongs(savedUrl);
        console.log('[DisplayPage] Songs loaded successfully');
        localStorage.setItem('tvdisplay-github-raw', savedUrl);
      } catch (e) {
        console.error('[DisplayPage] Failed to auto-load songs:', e);
      }
    };
    autoLoad();
  }, []);
  
  // Load initial state
  useEffect(() => {
    const loadState = async () => {
      try {
        const currentState = await api.getState();
        console.log('[DisplayPage] Loaded state:', currentState);
        setState(currentState);
        if (currentState.currentSongId) {
          const songData = await api.getSong(currentState.currentSongId);
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

    // Check for state every second as backup
    const interval = setInterval(loadState, 1000);
    return () => clearInterval(interval);
  }, []);

  // Listen for realtime updates
  const handleRealtimeUpdate = useCallback((msg) => {
    console.log('[DisplayPage] Realtime message received:', msg);
    if (msg.type === 'state') {
      console.log('[DisplayPage] Updating state:', msg.state);
      setState(msg.state);
      if (msg.state.currentSongId) {
        api.getSong(msg.state.currentSongId).then(song => {
          console.log('[DisplayPage] Loading song:', song);
          setSong(song);
          setPdfCurrentPage(1); // Reset to first page on new content
        });
      } else {
        setSong(null);
        setPdfCurrentPage(1);
      }
    }
  }, []);

  useRealtime(handleRealtimeUpdate);

  // Keyboard navigation for PDF
  useEffect(() => {
    if (!song?.pdfUrl) return;

    const handleKeyPress = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        setPdfCurrentPage(prev => Math.min(prev + 1, song.pageCount || numPages || 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        setPdfCurrentPage(prev => Math.max(prev - 1, 1));
      } else if (e.key === 'Home') {
        setPdfCurrentPage(1);
      } else if (e.key === 'End') {
        setPdfCurrentPage(song.pageCount || numPages || 1);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [song, numPages]);

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
    setPdfCurrentPage(1);
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
                    width={Math.min(window.innerWidth * 0.95, 1400)}
                    loading={
                      <div className="text-white">Načítavam stránku...</div>
                    }
                  />
                </Document>
                
                {/* PDF Controls */}
                <div className="mt-4 flex items-center gap-4 bg-black bg-opacity-70 px-6 py-3 rounded-lg">
                  <button
                    onClick={() => setPdfCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={pdfCurrentPage <= 1}
                    className="px-4 py-2 bg-white text-black rounded disabled:opacity-30 hover:bg-gray-200"
                  >
                    ← Predchádzajúca
                  </button>
                  
                  <div className="text-white text-lg">
                    Strana {pdfCurrentPage} z {numPages || song.pageCount || '?'}
                  </div>
                  
                  <button
                    onClick={() => setPdfCurrentPage(prev => Math.min(prev + 1, numPages || song.pageCount || 1))}
                    disabled={pdfCurrentPage >= (numPages || song.pageCount || 1)}
                    className="px-4 py-2 bg-white text-black rounded disabled:opacity-30 hover:bg-gray-200"
                  >
                    Ďalšia →
                  </button>
                </div>
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
