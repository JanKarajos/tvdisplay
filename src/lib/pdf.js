import { pdfjs } from 'react-pdf';
// Worker je pribalený v aplikácii, aby PDF fungovali aj bez prístupu na unpkg.com.
// Verzia pdfjs-dist v package.json musí byť rovnaká ako tá, ktorú používa react-pdf.
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

export { pdfjs };

// Zistí počet strán PDF súboru (File/Blob)
export async function countPdfPages(file) {
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const count = doc.numPages;
  doc.destroy();
  return count;
}
