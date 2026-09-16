import qrcodegen from 'qrcode-generator';
import type { ReliefGrid } from './relief';
import type { QRConfig } from '../types';

/** Builds a boolean cell grid (including quiet zone) for the QR code text. */
export function buildQRGrid(qr: QRConfig): ReliefGrid | null {
  const text = qr.text.trim();
  if (!text) return null;

  const code = qrcodegen(0, qr.errorCorrection);
  code.addData(text);
  code.make();

  const count = code.getModuleCount();
  const margin = Math.max(0, qr.quietZone);
  const size = count + margin * 2;
  const cells = new Array<boolean>(size * size).fill(false);

  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (code.isDark(r, c)) {
        const gr = r + margin;
        const gc = c + margin;
        cells[gr * size + gc] = true;
      }
    }
  }

  return { cols: size, rows: size, cells };
}
