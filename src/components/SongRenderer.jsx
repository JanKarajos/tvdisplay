import React, { useEffect, useRef, useState } from 'react';

export default function SongRenderer({ lyrics, title, imageUrl }) {
  const containerRef = useRef(null);
  const [fontSize, setFontSize] = useState(48);

  console.log('SongRenderer props:', { lyrics, title, imageUrl, lyricsLength: lyrics?.length });

  useEffect(() => {
    if (!lyrics || !containerRef.current) {
      console.log('SongRenderer: No lyrics or container', { hasLyrics: !!lyrics, hasContainer: !!containerRef.current });
      return;
    }

    const adjustFontSize = () => {
      const container = containerRef.current;
      if (!container) return;

      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      // Pre výpočet použijeme len neprázdne riadky
      const allLines = lyrics.split('\n');
      const nonEmptyLines = allLines.filter(Boolean);
      const lineCount = allLines.length; // Celkový počet riadkov vrátane prázdnych
      const contentLineCount = nonEmptyLines.length; // Len riadky s obsahom
      
      // Vypočítaj ideálnu veľkosť písma podľa počtu riadkov a výšky obrazovky
      let newFontSize;
      
      if (lineCount > 30) {
        newFontSize = Math.min(viewportHeight / (lineCount * 1.5), 32);
      } else if (lineCount > 20) {
        newFontSize = Math.min(viewportHeight / (lineCount * 1.3), 40);
      } else if (lineCount > 10) {
        newFontSize = Math.min(viewportHeight / (lineCount * 1.2), 56);
      } else {
        newFontSize = Math.min(viewportHeight / (lineCount * 1.1), 72);
      }

      // Zohľadni šírku obrazovky
      const maxLineLength = Math.max(...nonEmptyLines.map(l => l.length), 1);
      const widthBasedSize = (viewportWidth * 0.8) / (maxLineLength * 0.6);
      newFontSize = Math.min(newFontSize, widthBasedSize);

      // Minimálna a maximálna veľkosť
      newFontSize = Math.max(24, Math.min(96, newFontSize));
      
      console.log('Font size calculated:', newFontSize, 'for', lineCount, 'lines (', contentLineCount, 'with content)');
      setFontSize(newFontSize);
    };

    adjustFontSize();
    window.addEventListener('resize', adjustFontSize);
    return () => window.removeEventListener('resize', adjustFontSize);
  }, [lyrics]);

  if (imageUrl && !lyrics) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full">
        <img src={imageUrl} alt={title || 'Obrázok'} className="max-h-[80vh] max-w-full object-contain rounded shadow" />
        {title && <div className="mt-4 text-white text-3xl font-bold">{title}</div>}
      </div>
    );
  }

  if (!lyrics) {
    console.log('No lyrics to display');
    return (
      <div className="text-white text-2xl text-center">
        Žiadny text k dispozícii
      </div>
    );
  }

  // Rozdeliť na riadky, ale NEODSTRAŇOVAŤ prázdne riadky
  const lines = lyrics.split('\n');
  console.log('Displaying', lines.length, 'lines');
  
  return (
    <div ref={containerRef} className="text-white w-full h-full flex flex-col items-center justify-center px-8 py-6">
      {title && (
        <div 
          className="mb-6 font-bold text-center"
          style={{ fontSize: `${Math.min(fontSize * 1.2, 72)}px` }}
        >
          {title}
        </div>
      )}
      <div 
        className="text-center max-w-full"
        style={{ 
          fontSize: `${fontSize}px`,
          lineHeight: '1.4'
        }}
      >
        {lines.map((l, i) => (
          <div key={i} className="mb-2">{l || '\u00A0'}</div>
        ))}
      </div>
    </div>
  );
}
