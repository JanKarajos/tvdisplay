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
