import type { ReliefGrid } from './relief';
import type { TextZoneConfig } from '../types';
import { cssFamilyFor } from '../fonts';

/** Rasterizes a text zone's string into a boolean pixel grid for embossing/engraving. */
export async function buildTextGrid(zone: TextZoneConfig): Promise<ReliefGrid | null> {
  const text = zone.text.trim();
  if (!text) return null;

  const refSize = 120;
  const weight = zone.bold ? 'bold ' : '';
  const family = cssFamilyFor(zone.fontFamily);
  const fontSpec = `${weight}${refSize}px "${family}"`;

  if ('fonts' in document) {
    try {
      await document.fonts.load(fontSpec, text);
      await document.fonts.ready;
    } catch {
      // Fall back to whatever font is available; rendering still works.
    }
  }

  const measureCanvas = document.createElement('canvas');
  const mctx = measureCanvas.getContext('2d');
  if (!mctx) return null;
  mctx.font = fontSpec;
  const metrics = mctx.measureText(text);
  const ascent = metrics.actualBoundingBoxAscent || refSize * 0.75;
  const descent = metrics.actualBoundingBoxDescent || refSize * 0.25;
  const textWidthPx = Math.max(1, Math.ceil(metrics.width));
  const textHeightPx = Math.max(1, Math.ceil(ascent + descent));

  const bigCanvas = document.createElement('canvas');
  bigCanvas.width = textWidthPx;
  bigCanvas.height = textHeightPx;
  const bctx = bigCanvas.getContext('2d');
  if (!bctx) return null;
  bctx.font = fontSpec;
  bctx.fillStyle = '#000';
  bctx.textBaseline = 'alphabetic';
  bctx.fillText(text, 0, ascent);

  const rows = Math.max(6, Math.round(zone.resolution));
  const cols = Math.max(1, Math.round(rows * (textWidthPx / textHeightPx)));

  const canvas = document.createElement('canvas');
  canvas.width = cols;
  canvas.height = rows;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.clearRect(0, 0, cols, rows);
  ctx.drawImage(bigCanvas, 0, 0, cols, rows);

  const { data } = ctx.getImageData(0, 0, cols, rows);
  const cells = new Array<boolean>(cols * rows).fill(false);
  for (let i = 0; i < cols * rows; i++) {
    cells[i] = data[i * 4 + 3] > 96;
  }

  return { cols, rows, cells };
}
