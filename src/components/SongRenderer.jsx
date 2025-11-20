import React, { useEffect, useRef, useState } from 'react';

export default function SongRenderer({ lyrics, title, imageUrl }) {
  const containerRef = useRef(null);
  const [fontSize, setFontSize] = useState(48);

  useEffect(() => {
    if (!lyrics || !containerRef.current) return;

    const adjustFontSize = () => {
      const container = containerRef.current;
      if (!container) return;

      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const lines = lyrics.split('\n').filter(Boolean);
      const lineCount = lines.length;
      
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
      const maxLineLength = Math.max(...lines.map(l => l.length));
      const widthBasedSize = (viewportWidth * 0.8) / (maxLineLength * 0.6);
      newFontSize = Math.min(newFontSize, widthBasedSize);

      // Minimálna a maximálna veľkosť
      newFontSize = Math.max(24, Math.min(96, newFontSize));
      
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

  const lines = lyrics ? lyrics.split('\n').filter(Boolean) : [];
  
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
