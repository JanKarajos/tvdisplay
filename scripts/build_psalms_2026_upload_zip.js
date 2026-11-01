// Build a ZIP that the legacy ChurchApp (/upload-psalms) is more likely to accept.
//
// Key differences vs previous attempts:
// - HTML files are placed at the ZIP root (no parent folder) via `zip -j`
// - Each HTML contains the expected marker spans:
//     <span class='lcRESP'>R.:</span> <span class='lcVERS'>REFRAIN</span>
//   so legacy parsers (LoadPsalmsFromHtmls) can extract the refrain.
//
// Output:
// - exports/psalms-2026-upload-html/YYYY-MM-DD.html
// - exports/Zalmy-2026-upload.zip

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const OUT_DIR = path.resolve('exports/psalms-2026-upload-html');
const OUT_ZIP = path.resolve('exports/Zalmy-2026-upload.zip');
const INPUT_JSON = path.resolve('Texty/Žalmy 2026.json');

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildHtml({ dateStr, refrain }) {
  const safe = escapeHtml(refrain || '');
  const body = safe
    ? `<span class="lcRESP">R.:</span> <span class="lcVERS">${safe}</span>`
    : `<span class="lcVERS">Žalm pre dátum ${escapeHtml(dateStr)} sa nenašiel.</span>`;

  return `<!doctype html>\n<html lang="sk">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>Žalm ${escapeHtml(dateStr)}</title>\n<style>\n  body{margin:0;padding:24px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,sans-serif;background:#000;color:#fff;}\n  .wrap{max-width:1200px;margin:0 auto;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center;}\n  .lcRESP{font-size:42px;font-weight:800;margin-right:12px;}\n  .lcVERS{font-size:56px;line-height:1.25;font-weight:800;word-break:break-word;}\n</style>\n</head>\n<body>\n  <div class="wrap">\n    <div>${body}</div>\n  </div>\n</body>\n</html>\n`;
}

function main() {
  if (!fs.existsSync(INPUT_JSON)) {
    console.error('Missing input JSON:', INPUT_JSON);
    process.exit(1);
  }

  const parsed = JSON.parse(fs.readFileSync(INPUT_JSON, 'utf8'));
  const entries = Array.isArray(parsed?.content) ? parsed.content : [];
  if (entries.length < 300) {
    console.error('Unexpected JSON content size:', entries.length);
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  let written = 0;
  for (const item of entries) {
    const dateStr = String(item?.number || '').trim();
    if (!/^2026-\d{2}-\d{2}$/.test(dateStr)) continue;

    const refrain = Array.isArray(item?.strophes) ? item.strophes[0] : '';
    const outPath = path.join(OUT_DIR, `${dateStr}.html`);
    fs.writeFileSync(outPath, buildHtml({ dateStr, refrain }), 'utf8');
    written++;
  }

  if (written !== 365) {
    console.warn(`Warning: wrote ${written} HTML files (expected 365).`);
  } else {
    console.log('Wrote 365 daily HTML files.');
  }

  // Build ZIP with files at the root (no directory nesting)
  if (fs.existsSync(OUT_ZIP)) fs.rmSync(OUT_ZIP);

  const zipCheck = spawnSync('zip', ['-v'], { stdio: 'ignore' });
  if (zipCheck.error) {
    console.log('zip not available; please zip the folder manually with:');
    console.log(`  zip -j -9 ${OUT_ZIP} ${OUT_DIR}/*.html`);
    return;
  }

  const zipRes = spawnSync('zip', ['-j', '-9', OUT_ZIP, path.join(OUT_DIR, '*.html')], {
    stdio: 'inherit',
    shell: true,
  });

  if (zipRes.status !== 0) {
    console.error('zip failed with status', zipRes.status);
    process.exit(zipRes.status || 1);
  }

  console.log('Created:', OUT_ZIP);
}

main();
