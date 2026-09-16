import type { ReliefGrid } from './relief';
import type { LogoConfig } from '../types';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Impossible de charger l'image"));
    img.src = src;
  });
}

/** Rasterizes the uploaded logo image into a boolean pixel grid for embossing/engraving. */
export async function buildLogoGrid(logo: LogoConfig): Promise<ReliefGrid | null> {
  if (!logo.imageDataUrl) return null;

  const img = await loadImage(logo.imageDataUrl);
  const aspect = img.naturalWidth / img.naturalHeight || 1;
  const resolution = Math.max(4, Math.round(logo.resolution));

  const cols = aspect >= 1 ? resolution : Math.max(1, Math.round(resolution * aspect));
  const rows = aspect >= 1 ? Math.max(1, Math.round(resolution / aspect)) : resolution;

  const canvas = document.createElement('canvas');
  canvas.width = cols;
  canvas.height = rows;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  ctx.imageSmoothingEnabled = true;
  ctx.clearRect(0, 0, cols, rows);
  ctx.drawImage(img, 0, 0, cols, rows);

  const { data } = ctx.getImageData(0, 0, cols, rows);
  const cells = new Array<boolean>(cols * rows).fill(false);

  for (let i = 0; i < cols * rows; i++) {
    const o = i * 4;
    const r = data[o];
    const g = data[o + 1];
    const b = data[o + 2];
    const a = data[o + 3];
    if (a < 32) continue; // transparent -> no material

    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    let dark = luminance < logo.threshold;
    if (logo.invert) dark = !dark;
    cells[i] = dark;
  }

  return { cols, rows, cells };
}
