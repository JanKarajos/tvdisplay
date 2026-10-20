import React, { useEffect, useRef, useState } from 'react';

export default function SongRenderer({ lyrics, title, number, imageUrl, currentPage = 0, isPreview = false, hideTitle = false }) {
  const containerRef = useRef(null);
  const [fontSize, setFontSize] = useState(48);
  const [pages, setPages] = useState([]);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  console.log('SongRenderer props:', { lyrics, title, number, imageUrl, lyricsLength: lyrics?.length, currentPage, isPreview, hideTitle });

  // Pri preview potrebujeme rozmery reálneho kontajnera (nie okna)
  useEffect(() => {
    if (!isPreview) return;
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      setContainerSize({ width: rect.width, height: rect.height });
    };

    update();

    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    return () => ro.disconnect();
  }, [isPreview]);

  // Rozdeliť text na strany a nastaviť veľkosť písma
  useEffect(() => {
    if (!lyrics) {
      console.log('SongRenderer: No lyrics');
      setPages([]);
      return;
    }

    const allLines = lyrics.split('\n');
    const viewportHeight = isPreview && containerSize.height ? containerSize.height : window.innerHeight;
    const viewportWidth = isPreview && containerSize.width ? containerSize.width : window.innerWidth;
    
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
      // Pre preview: rátame aj so zalamovaním dlhých riadkov podľa šírky kontajnera.
      const lineHeight = 1.35;
      const reservedSpace = hideTitle ? 28 : 50; // menšia rezerva v preview
      const availableHeight = Math.max(1, viewportHeight - reservedSpace);
      const availableWidth = Math.max(1, viewportWidth - 32); // približne px-2 vnútri

      // Začneme od odhadu iba podľa výšky, potom 2x prepočítame podľa očakávaného zalomenia.
      let fs = availableHeight / (maxLinesInPage * lineHeight);
      fs = Math.max(8, Math.min(18, fs));

      for (let i = 0; i < 2; i++) {
        const approxCharWidth = fs * 0.6; // hrubý odhad pre sans font
        const charsPerLine = Math.max(8, Math.floor(availableWidth / approxCharWidth));
        const wrapFactor = Math.max(1, maxLineLength / charsPerLine);
        const estimatedTotalLines = maxLinesInPage * wrapFactor;
        fs = availableHeight / (estimatedTotalLines * lineHeight);
        fs = Math.max(8, Math.min(18, fs));
      }

      calculatedFontSize = fs;
    } else {
      // Pre fullscreen displej
      // lineHeight je 1.5, takže skutočná výška je lines * fontSize * 1.5
      // Ak má riadok viac ako 80 znakov, pravdepodobne sa zalomí na 2-3 riadky
      // Zvýšený koeficient pre istotu že sa text zmestí
      const estimatedLinesPerRow = maxLineLength > 120 ? 3.5 : 
                                    maxLineLength > 100 ? 3 : 
                                    maxLineLength > 80 ? 2.5 : 
                                    maxLineLength > 60 ? 2 : 1.5;
      
      const estimatedTotalLines = maxLinesInPage * estimatedLinesPerRow;
      
      const reservedSpace = 180; // priestor pre nadpis, padding a okraje (zvýšené)
      const availableHeight = viewportHeight - reservedSpace;
      calculatedFontSize = availableHeight / (estimatedTotalLines * 1.5);
      calculatedFontSize = Math.max(18, Math.min(48, calculatedFontSize));
    }
    
    setFontSize(calculatedFontSize);
    
    console.log('Split into', newPages.length, 'stanzas/pages with font size', calculatedFontSize, 'max line length:', maxLineLength, 'isPreview:', isPreview);
    setPages(newPages);
  }, [lyrics, isPreview, hideTitle, containerSize.height, containerSize.width]);

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

  const safePageIndex = Math.max(0, Math.min(currentPage, pages.length - 1));
  const currentPageLines = pages[safePageIndex] || [];
  console.log('Displaying page', currentPage + 1, 'of', pages.length, 'with', currentPageLines.length, 'lines', 'fontSize:', fontSize);
  
  return (
    <div
      ref={containerRef}
      className={isPreview ? "text-white w-full h-full flex flex-col items-center justify-center px-2 py-2 relative overflow-hidden" : "text-white w-full h-full flex flex-col items-center justify-center px-4 py-4 relative overflow-hidden"}
    >
      <div className="flex flex-col items-center justify-center w-full" style={{ maxHeight: isPreview ? '100%' : '95vh' }}>
        {title && !hideTitle && (
          <div 
            className={isPreview ? "mb-3 font-bold text-center flex-shrink-0" : "mb-6 font-bold text-center flex-shrink-0"}
            style={{ fontSize: `${Math.min(fontSize * 1.15, isPreview ? 24 : 48)}px` }}
          >
            {number && `${number}. `}{title}
          </div>
        )}
        <div 
          className={isPreview ? "text-center w-full px-2 overflow-hidden" : "text-center w-full max-w-5xl px-4 overflow-hidden"}
          style={{ 
            fontSize: `${fontSize}px`,
            lineHeight: isPreview ? '1.35' : '1.5'
          }}
        >
          {currentPageLines.map((l, i) => (
            <div key={i} className="break-words whitespace-pre-wrap">{l || '\u00A0'}</div>
          ))}
        </div>
      </div>
      
      {/* Indikátor strany */}
      {pages.length > 1 && (
        <div className={isPreview ? "absolute bottom-2 right-2" : "absolute bottom-8 right-8"}>
          <div className={isPreview ? "text-white text-xs font-bold bg-black/50 px-2 py-1 rounded" : "text-white text-3xl font-bold bg-black/50 px-8 py-4 rounded-lg"}>
            {safePageIndex + 1} / {pages.length}
          </div>
        </div>
      )}
    </div>
  );
}
