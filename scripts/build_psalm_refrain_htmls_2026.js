// Converts the already-downloaded lc.kbs.sk daily HTML pages into minimal HTML files
// containing only the responsorial psalm refrain (R.: ...).
//
// Input:  exports/psalms-2026-html/YYYY-MM-DD.html
// Output: exports/psalms-2026-refrain-html/YYYY-MM-DD.html

import fs from 'fs';
import path from 'path';

const IN_DIR = path.resolve('exports/psalms-2026-html');
const OUT_DIR = path.resolve('exports/psalms-2026-refrain-html');

function normalizeText(text) {
  return String(text)
    .replace(/\u00a0/g, ' ')
    .replace(/&nbsp;|&#160;|&#xa0;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractPsalmRefrain(html) {
  // Typical structure:
  // <span class='lcRESP'>R.:</span> <span class='lcVERS'>...</span>
  const respMatch = html.match(
    /<span[^>]*class=['\"]lcRESP['\"][^>]*>\s*R\.\s*:\s*<\/span>\s*<span[^>]*class=['\"]lcVERS['\"][^>]*>([\s\S]*?)<\/span>/i
  );
  if (respMatch) return normalizeText(respMatch[1]);

  // Fallback: try to find any literal "R.:" and capture nearby text.
  const marker = 'Responzóriový žalm';
  const markerIndex = html.toLowerCase().indexOf(marker.toLowerCase());
  const slice = markerIndex >= 0 ? html.slice(markerIndex) : html;
  const fallback = slice.match(/R\.\s*:\s*([\s\S]{0,240})/i);
  if (!fallback) return null;
  return normalizeText(fallback[1]);
}

function buildMinimalHtml({ dateStr, refrain }) {
  const safeRefrain = (refrain || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const body = safeRefrain || `Žalm pre dátum ${dateStr} sa nenašiel.`;

  return `<!doctype html>\n<html lang="sk">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>Žalm ${dateStr}</title>\n<style>\n  body{margin:0;padding:24px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,sans-serif;background:#000;color:#fff;}\n  .wrap{max-width:1200px;margin:0 auto;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center;}\n  .txt{font-size:56px;line-height:1.25;font-weight:700;word-break:break-word;}\n</style>\n</head>\n<body>\n  <div class="wrap">\n    <div class="txt">${body}</div>\n  </div>\n</body>\n</html>\n`;
}

function main() {
  if (!fs.existsSync(IN_DIR)) {
    console.error('Missing input directory:', IN_DIR);
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const files = fs.readdirSync(IN_DIR).filter((f) => f.endsWith('.html')).sort();
  if (files.length === 0) {
    console.error('No input HTML files found in:', IN_DIR);
    process.exit(1);
  }

  let ok = 0;
  for (const file of files) {
    const dateStr = file.replace(/\.html$/i, '');
    const inputPath = path.join(IN_DIR, file);
    const outputPath = path.join(OUT_DIR, file);

    const html = fs.readFileSync(inputPath, 'utf8');
    const refrain = extractPsalmRefrain(html);
    if (refrain) ok++;

    fs.writeFileSync(outputPath, buildMinimalHtml({ dateStr, refrain }), 'utf8');
  }

  console.log(`Converted ${files.length} files. Refrains found: ${ok}/${files.length}`);
  console.log('Output:', OUT_DIR);
  console.log('Next: zip -9 -r exports/Zalmy-2026-refrain-html.zip exports/psalms-2026-refrain-html');
}

main();
