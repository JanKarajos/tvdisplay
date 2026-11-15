// Načítanie obrázka pred nahraním: veľkú fotku zmenší na max. 1920 px (JPEG),
// viac TV aj tak nezobrazí a menší súbor sa rýchlejšie nahrá aj načíta na Orange Pi.
const MAX_IMAGE_SIZE = 1920;

export function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function prepareImage(file, maxSize = MAX_IMAGE_SIZE) {
  const original = await readAsDataUrl(file);
  if (file.type === 'image/gif') return original;
  const img = new Image();
  img.src = original;
  await img.decode();
  const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
  if (scale === 1 && file.size < 1024 * 1024) return original;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.85);
}

// Fotka strany spevníka pred rozpoznaním textu: odtiene sivej, vyrovnané osvetlenie (tieň od ruky,
// tmavší okraj strany) a vyšší kontrast. Na tmavších a rozmazaných fotkách to rozpoznávanie výrazne
// zlepší (v skúške z ~50 % chýb na 2–6 %). Vráti JPEG ako Blob.
export async function prepareForOcr(file, maxSize = 2400) {
  const img = new Image();
  img.src = await readAsDataUrl(file);
  await img.decode();
  const longSide = Math.max(img.width, img.height);
  // malé fotky zväčšiť (písmená aspoň ~20 px), veľké zmenšiť
  const scale = longSide < 1600 ? 1600 / longSide : Math.min(1, maxSize / longSide);
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;

  // Pozadie (osvetlenie strany): silno rozmazaná kópia. Zmenšuje sa postupne na polovicu (aby sa
  // body spriemerovali, nie preskočili) až na ~1/32 a potom sa zväčší späť.
  let small = canvas;
  let sw = w;
  let sh = h;
  while (sw > w / 32 && sw > 16) {
    const next = document.createElement('canvas');
    next.width = Math.max(8, Math.round(sw / 2));
    next.height = Math.max(8, Math.round(sh / 2));
    const nctx = next.getContext('2d');
    nctx.imageSmoothingEnabled = true;
    nctx.imageSmoothingQuality = 'high';
    nctx.drawImage(small, 0, 0, next.width, next.height);
    small = next;
    sw = next.width;
    sh = next.height;
  }
  const bgCanvas = document.createElement('canvas');
  bgCanvas.width = w;
  bgCanvas.height = h;
  const bctx = bgCanvas.getContext('2d');
  bctx.imageSmoothingEnabled = true;
  bctx.imageSmoothingQuality = 'high';
  bctx.drawImage(small, 0, 0, w, h);
  const bg = bctx.getImageData(0, 0, w, h).data;

  // šedá / pozadie, potom kontrast: 50 % -> čierna, 98 % -> biela
  for (let i = 0; i < px.length; i += 4) {
    const gray = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    const back = Math.max(1, 0.299 * bg[i] + 0.587 * bg[i + 1] + 0.114 * bg[i + 2]);
    const ratio = Math.min(1, gray / back);
    const v = Math.max(0, Math.min(255, ((ratio - 0.5) / 0.48) * 255));
    px[i] = px[i + 1] = px[i + 2] = v;
  }
  ctx.putImageData(data, 0, 0);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
}
