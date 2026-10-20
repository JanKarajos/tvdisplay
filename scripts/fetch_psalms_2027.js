// Script to fetch psalm refrains for every day in 2027
import https from 'https';
import fs from 'fs';
import zlib from 'zlib';

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function fetchURL(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent': 'tvdisplay/1.0 (psalm-refrain-fetcher)',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
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
  const respMatch = html.match(
    /<span[^>]*class=['\"]lcRESP['\"][^>]*>\s*R\.\s*:\s*<\/span>\s*<span[^>]*class=['\"]lcVERS['\"][^>]*>([\s\S]*?)<\/span>/i
  );
  if (respMatch) return normalizeText(respMatch[1]);

  const marker = 'Responzóriový žalm';
  const markerIndex = html.toLowerCase().indexOf(marker.toLowerCase());
  const slice = markerIndex >= 0 ? html.slice(markerIndex) : html;
  const fallback = slice.match(/R\.\s*:\s*([\s\S]{0,200})/i);
  if (!fallback) return null;

  return normalizeText(fallback[1]);
}

function extractDateInfo(html) {
  const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const liturgicalMatch = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);

  return {
    title: titleMatch ? normalizeText(titleMatch[1]) : '',
    liturgical: liturgicalMatch ? normalizeText(liturgicalMatch[1]) : '',
  };
}

async function fetchAllPsalms() {
  const psalms = [];
  const startDate = new Date('2027-01-01');
  const endDate = new Date('2027-12-31');

  let currentDate = new Date(startDate);
  let processedCount = 0;

  while (currentDate <= endDate) {
    const dateStr = formatDate(currentDate);
    const url = `https://lc.kbs.sk/?den=${dateStr}`;

    try {
      console.log(`Fetching ${dateStr}...`);
      const html = await fetchURL(url);
      const refrain = extractPsalmRefrain(html);
      const dateInfo = extractDateInfo(html);

      const dayData = {
        date: dateStr,
        dayOfWeek: currentDate.toLocaleDateString('sk-SK', { weekday: 'long' }),
        liturgical: dateInfo.liturgical,
        refrain: refrain || 'Refren nenájdený',
      };

      psalms.push(dayData);
      processedCount++;

      if (processedCount % 30 === 0) {
        console.log(`Progress: ${processedCount}/365 days processed`);
      }

      await new Promise((resolve) => setTimeout(resolve, 250));
    } catch (error) {
      console.error(`Error fetching ${dateStr}:`, error.message);
      psalms.push({
        date: dateStr,
        dayOfWeek: currentDate.toLocaleDateString('sk-SK', { weekday: 'long' }),
        liturgical: 'Error',
        refrain: 'Chyba pri sťahovaní',
      });
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return psalms;
}

function createJSON(psalms) {
  const content = psalms.map((p) => {
    const cleanRefrain = normalizeText(p.refrain);
    return {
      name: `${p.date} - ${cleanRefrain}`,
      number: p.date,
      strophes: [cleanRefrain],
    };
  });

  return {
    name: 'Žalmy 2027',
    content,
  };
}

async function main() {
  console.log('Starting psalm refrain extraction for 2027...');
  console.log('This will take approximately 3-6 minutes (365 pages)...\n');

  const psalms = await fetchAllPsalms();
  const jsonData = createJSON(psalms);

  const outputPath = new URL('../Texty/Žalmy 2027.json', import.meta.url);
  fs.mkdirSync(new URL('../Texty/', import.meta.url), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(jsonData, null, 2), 'utf8');

  console.log(`\n✓ Successfully created: ${outputPath}`);
  console.log(`Total days processed: ${psalms.length}`);

  const withRefrains = psalms.filter(
    (p) => p.refrain !== 'Refren nenájdený' && p.refrain !== 'Chyba pri sťahovaní'
  ).length;
  console.log(`Days with refrains found: ${withRefrains}/${psalms.length}`);
}

main().catch(console.error);
