// Downloads raw daily pages from https://lc.kbs.sk for each day in 2026
// and saves them as individual HTML files, then you can ZIP the folder
// and upload it to the legacy ChurchApp (/upload-psalms).
//
// Output folder: exports/psalms-2026-html/

import https from 'https';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const OUT_DIR = path.resolve('exports/psalms-2026-html');

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function pause(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fetchURL(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent': 'tvdisplay/1.0 (psalm-html-fetcher)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Encoding': 'gzip,deflate,br',
        },
      },
      (res) => {
        const encoding = (res.headers['content-encoding'] || '').toLowerCase();
        let stream = res;

        if (encoding === 'gzip') stream = res.pipe(zlib.createGunzip());
        else if (encoding === 'deflate') stream = res.pipe(zlib.createInflate());
        else if (encoding === 'br') stream = res.pipe(zlib.createBrotliDecompress());

        const chunks = [];
        stream.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        stream.on('error', reject);
      }
    );
    req.on('error', reject);
  });
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const startDate = new Date('2026-01-01');
  const endDate = new Date('2026-12-31');

  let currentDate = new Date(startDate);
  let processed = 0;
  let ok = 0;

  console.log('Fetching raw HTML pages for each day in 2026...');
  console.log('Output:', OUT_DIR);

  while (currentDate <= endDate) {
    const dateStr = formatDate(currentDate);
    const url = `https://lc.kbs.sk/?den=${dateStr}`;
    const outPath = path.join(OUT_DIR, `${dateStr}.html`);

    try {
      const html = await fetchURL(url);
      fs.writeFileSync(outPath, html, 'utf8');
      ok++;
    } catch (e) {
      // Still write a small marker file so the ZIP has the full set of dates.
      const marker = `<!-- fetch error for ${dateStr}: ${String(e?.message || e)} -->\n`;
      fs.writeFileSync(outPath, marker, 'utf8');
      console.error('Error fetching', dateStr, '-', e?.message || e);
    }

    processed++;
    if (processed % 25 === 0) {
      console.log(`Progress: ${processed}/365 (ok: ${ok})`);
    }

    // Be nice to the server.
    await pause(250);

    currentDate.setDate(currentDate.getDate() + 1);
  }

  console.log(`Done. Files written: ${processed}. Successful fetches: ${ok}.`);
  console.log('Next: zip the folder (command printed below)');
  console.log('  zip -9 -r exports/Zalmy-2026-html.zip exports/psalms-2026-html');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
