import React, { useEffect, useRef, useState } from 'react';

export default function SongRenderer({ lyrics, title, imageUrl, currentPage = 0, isPreview = false }) {
  const containerRef = useRef(null);
  const [fontSize, setFontSize] = useState(48);
  const [pages, setPages] = useState([]);

  console.log('SongRenderer props:', { lyrics, title, imageUrl, lyricsLength: lyrics?.length, currentPage, isPreview });

  // Rozdeliť text na strany a nastaviť veľkosť písma
  useEffect(() => {
    if (!lyrics) {
      console.log('SongRenderer: No lyrics');
      setPages([]);
      return;
    }

    const allLines = lyrics.split('\n');
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    
    // Rozdeliť na strany podľa strof (oddelené prázdnymi riadkami)
    const newPages = [];
    let currentStanza = [];
    
    for (let i = 0; i < allLines.length; i++) {
      const line = allLines[i];
      
      // Ak je riadok prázdny a máme nejaký obsah, ukonči strofu
      if (!line.trim() && currentStanza.length > 0) {
        // Pridaj strofu ako samostatnú stranu
        newPages.push([...currentStanza]);
        currentStanza = [];
        continue;
      }
      
      // Pridaj neprázdny riadok do aktuálnej strofy
      if (line.trim()) {
        currentStanza.push(line);
      }
    }
    
    // Pridaj poslednú strofu ak existuje
    if (currentStanza.length > 0) {
      newPages.push(currentStanza);
    }
    
    // Vypočítaj veľkosť písma pre najdlhšiu strofu
    const maxLinesInPage = Math.max(...newPages.map(p => p.length), 1);
    let calculatedFontSize;
    
    if (isPreview) {
      // Pre preview použiť menšie písmo
      calculatedFontSize = Math.min(
        viewportHeight / (maxLinesInPage * 2.5),
        viewportWidth * 0.025
      );
      calculatedFontSize = Math.max(8, Math.min(24, calculatedFontSize));
    } else {
      // Pre fullscreen displej
      calculatedFontSize = Math.min(
        viewportHeight / (maxLinesInPage * 1.8),
        viewportWidth * 0.05
      );
      calculatedFontSize = Math.max(36, Math.min(80, calculatedFontSize));
    }
    
    setFontSize(calculatedFontSize);
    
    console.log('Split into', newPages.length, 'stanzas/pages with font size', calculatedFontSize, 'isPreview:', isPreview);
    setPages(newPages);
  }, [lyrics, isPreview]);

  if (imageUrl && !lyrics) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full">
        <img src={imageUrl} alt={title || 'Obrázok'} className="max-h-[80vh] max-w-full object-contain rounded shadow" />
        {title && <div className="mt-4 text-white text-3xl font-bold">{title}</div>}
      </div>
    );
  }

  if (!lyrics || pages.length === 0) {
    console.log('No lyrics to display');
    return (
      <div className="text-white text-2xl text-center">
        Žiadny text k dispozícii
      </div>
    );
  }

  const currentPageLines = pages[currentPage] || [];
  console.log('Displaying page', currentPage + 1, 'of', pages.length, 'with', currentPageLines.length, 'lines');
  
  return (
    <div ref={containerRef} className="text-white w-full h-full flex flex-col items-center justify-center px-8 py-6 relative">
      {title && (
        <div 
          className="mb-6 font-bold text-center"
          style={{ fontSize: `${Math.min(fontSize * 1.3, 64)}px` }}
        >
          {title}
        </div>
      )}
      <div 
        className="text-center max-w-full flex-1 flex items-center justify-center"
        style={{ 
          fontSize: `${fontSize}px`,
          lineHeight: '1.5'
        }}
      >
        <div>
          {currentPageLines.map((l, i) => (
            <div key={i} className="mb-1">{l || '\u00A0'}</div>
          ))}
        </div>
      </div>
      
      {/* Indikátor strany */}
      {pages.length > 1 && (
        <div className="absolute bottom-8 right-8">
          <div className="text-white text-3xl font-bold bg-black/50 px-8 py-4 rounded-lg">
            {currentPage + 1} / {pages.length}
          </div>
        </div>
      )}
    </div>
  );
}
