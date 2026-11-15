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

  // Natočená fotka: najprv sa vyrovná celá strana, potom každý pás riadkov zvlášť
  // (fotka zo šikmého uhla alebo zakrivená strana má hore a dole iný sklon)
  const straight = rotated(canvas, skewAngle(px, w, h, 0, h, 10));
  const sp = straight.getContext('2d').getImageData(0, 0, w, h).data;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const octx = out.getContext('2d');
  octx.fillStyle = '#fff';
  octx.fillRect(0, 0, w, h);
  for (const [top, bottom] of lineBands(sp, w, h)) {
    const angle = skewAngle(sp, w, h, top, bottom, 4);
    octx.save();
    octx.beginPath();
    octx.rect(0, top, w, bottom - top);
    octx.clip();
    octx.translate(w / 2, (top + bottom) / 2);
    octx.rotate((angle * Math.PI) / 180);
    octx.drawImage(straight, -w / 2, -(top + bottom) / 2);
    octx.restore();
  }
  return new Promise((resolve) => out.toBlob(resolve, 'image/jpeg', 0.9));
}

function rotated(source, angle) {
  if (Math.abs(angle) < 0.2) return source;
  const { width: w, height: h } = source;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.translate(w / 2, h / 2);
  ctx.rotate((angle * Math.PI) / 180);
  ctx.drawImage(source, -w / 2, -h / 2);
  return out;
}

// Pásy po ~6 riadkoch: hranice sa hľadajú v medzerách medzi riadkami (najmenej tmavých bodov)
function lineBands(px, w, h) {
  const dark = new Array(h).fill(0);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x += 2) if (px[(y * w + x) * 4] < 110) dark[y] += 1;
  }
  const count = Math.max(1, Math.round(h / 400));
  const cuts = [0];
  for (let k = 1; k < count; k++) {
    const c = Math.round((h * k) / count);
    const r = Math.round(h / (3 * count));
    let best = c;
    for (let y = Math.max(0, c - r); y < Math.min(h, c + r); y++) if (dark[y] < dark[best]) best = y;
    cuts.push(best);
  }
  cuts.push(h);
  return cuts.slice(1).map((b, i) => [cuts[i], b]).filter(([a, b]) => b - a > 10);
}

// Uhol natočenia textu v stupňoch v riadkoch top..bottom (kladný = riadky stúpajú doprava)
function skewAngle(px, w, h, top, bottom, range) {
  const step = Math.max(1, Math.round(w / 700));
  const xs = [];
  const ys = [];
  for (let y = top; y < bottom; y += step) {
    for (let x = 0; x < w; x += step) {
      if (px[(y * w + x) * 4] < 110) {
        xs.push(x);
        ys.push(y);
      }
    }
  }
  if (xs.length < 200) return 0;
  const score = (deg) => {
    const t = Math.tan((deg * Math.PI) / 180);
    const bins = new Map();
    for (let i = 0; i < xs.length; i++) {
      const b = Math.round((ys[i] + xs[i] * t) / step);
      bins.set(b, (bins.get(b) || 0) + 1);
    }
    let sum = 0;
    for (const v of bins.values()) sum += v * v;
    return sum;
  };
  let best = 0;
  let bestScore = score(0);
  for (let deg = -range; deg <= range; deg += 0.5) {
    const sc = score(deg);
    if (sc > bestScore) { best = deg; bestScore = sc; }
  }
  for (let deg = best - 0.4; deg <= best + 0.4; deg += 0.1) {
    const sc = score(deg);
    if (sc > bestScore) { best = deg; bestScore = sc; }
  }
  return best;
}
