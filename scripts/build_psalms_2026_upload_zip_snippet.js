// Build a ZIP for legacy ChurchApp where each file contains ONLY the exact
// snippet pattern it likely regex-parses:
//   <span class='lcRESP'>R.:</span> <span class='lcVERS'>REFRAIN</span>
//
// This avoids any <html ...> wrapper that the legacy UI might accidentally display.
//
// Output:
// - exports/psalms-2026-upload-snippet/YYYY-MM-DD.html
// - exports/Zalmy-2026-upload-snippet.zip

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const OUT_DIR = path.resolve('exports/psalms-2026-upload-snippet');
const OUT_ZIP = path.resolve('exports/Zalmy-2026-upload-snippet.zip');
const INPUT_JSON = path.resolve('Texty/Žalmy 2026.json');

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildSnippetHtml({ dateStr, refrain }) {
  const safe = escapeHtml(refrain || '');
  if (!safe) {
    return `<span class='lcVERS'>Žalm pre dátum ${escapeHtml(dateStr)} sa nenašiel.</span>\n`;
  }
  return `<span class='lcRESP'>R.:</span> <span class='lcVERS'>${safe}</span>\n`;
}

function main() {
  if (!fs.existsSync(INPUT_JSON)) {
    console.error('Missing input JSON:', INPUT_JSON);
    process.exit(1);
  }

  const parsed = JSON.parse(fs.readFileSync(INPUT_JSON, 'utf8'));
  const entries = Array.isArray(parsed?.content) ? parsed.content : [];
  fs.mkdirSync(OUT_DIR, { recursive: true });

  let written = 0;
  for (const item of entries) {
    const dateStr = String(item?.number || '').trim();
    if (!/^2026-\d{2}-\d{2}$/.test(dateStr)) continue;

    const refrain = Array.isArray(item?.strophes) ? item.strophes[0] : '';
    const outPath = path.join(OUT_DIR, `${dateStr}.html`);
    fs.writeFileSync(outPath, buildSnippetHtml({ dateStr, refrain }), 'utf8');
    written++;
  }

  console.log(`Wrote ${written} snippet HTML files.`);

  if (fs.existsSync(OUT_ZIP)) fs.rmSync(OUT_ZIP);

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
