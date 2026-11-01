import React, { useEffect, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Worker je pribalený v builde – PDF funguje aj bez internetu
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export default function PdfView({ url, page }) {
  const boxRef = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [numPages, setNumPages] = useState(null);
  const [aspect, setAspect] = useState(null);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => setSize({ width: el.clientWidth, height: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pageNumber = Math.min(Math.max(1, page), numPages || page);

  return (
    <div ref={boxRef} className="w-full h-full flex items-center justify-center">
      {size.height > 0 && (
        <Document
          file={url}
          onLoadSuccess={({ numPages: n }) => setNumPages(n)}
          loading={<div className="text-white/60 text-2xl">Načítavam PDF…</div>}
          error={<div className="text-white/60 text-xl">PDF sa nepodarilo načítať</div>}
        >
          <Page
            key={pageNumber}
            pageNumber={pageNumber}
            {...(aspect ? { width: Math.min(size.width, size.height * aspect) } : { height: size.height })}
            onLoadSuccess={(p) => setAspect(p.originalWidth / p.originalHeight)}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            className="animate-fade-in shadow-2xl"
            loading={null}
          />
        </Document>
      )}
    </div>
  );
}
