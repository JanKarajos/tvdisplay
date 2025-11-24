import React, { useEffect, useRef, useState } from 'react';

export default function SongRenderer({ lyrics, title, number, imageUrl, currentPage = 0, isPreview = false }) {
  const containerRef = useRef(null);
  const [fontSize, setFontSize] = useState(48);
  const [pages, setPages] = useState([]);

  console.log('SongRenderer props:', { lyrics, title, number, imageUrl, lyricsLength: lyrics?.length, currentPage, isPreview });

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
    
    // Vypočítaj aj najdlhší riadok v znakoch
    const maxLineLength = Math.max(
      ...newPages.flatMap(page => page.map(line => line.length)),
      1
    );
    
    let calculatedFontSize;
    
    if (isPreview) {
      // Pre preview - počítame s lineHeight 1.5 a rezervou pre nadpis/okraje
      const availableHeight = viewportHeight - 80; // rezerva pre nadpis a okraje
      calculatedFontSize = availableHeight / (maxLinesInPage * 1.5);
      calculatedFontSize = Math.max(8, Math.min(20, calculatedFontSize));
    } else {
      // Pre fullscreen displej
      // lineHeight je 1.5, takže skutočná výška je lines * fontSize * 1.5
      // Ak má riadok viac ako 80 znakov, pravdepodobne sa zalomí na 2-3 riadky
      const estimatedLinesPerRow = maxLineLength > 100 ? 2.5 : 
                                    maxLineLength > 80 ? 2 : 
                                    maxLineLength > 60 ? 1.5 : 1;
      
      const estimatedTotalLines = maxLinesInPage * estimatedLinesPerRow;
      
      const reservedSpace = 150; // priestor pre nadpis, padding a okraje
      const availableHeight = viewportHeight - reservedSpace;
      calculatedFontSize = availableHeight / (estimatedTotalLines * 1.5);
      calculatedFontSize = Math.max(20, Math.min(56, calculatedFontSize));
    }
    
    setFontSize(calculatedFontSize);
    
    console.log('Split into', newPages.length, 'stanzas/pages with font size', calculatedFontSize, 'max line length:', maxLineLength, 'isPreview:', isPreview);
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
    <div ref={containerRef} className="text-white w-full h-full flex flex-col items-center justify-center px-8 py-8 relative">
      <div className="flex flex-col items-center justify-center max-h-full">
        {title && (
          <div 
            className="mb-8 font-bold text-center"
            style={{ fontSize: `${Math.min(fontSize * 1.2, 56)}px` }}
          >
            {number && `${number}. `}{title}
          </div>
        )}
        <div 
          className="text-center w-full max-w-5xl"
          style={{ 
            fontSize: `${fontSize}px`,
            lineHeight: '1.5'
          }}
        >
          {currentPageLines.map((l, i) => (
            <div key={i} className="break-words whitespace-pre-wrap">{l || '\u00A0'}</div>
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
