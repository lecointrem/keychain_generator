import { buildQRGrid } from './buildQR';
import { buildLogoGrid } from './buildLogo';
import { parseSvgLogo } from './buildLogoSVG';
import { buildTextGrid } from './buildText';
import type { KeychainConfig } from '../types';
import type { KeychainInputs } from './buildKeychain';

const SVG_DATA_URL_PREFIX = 'data:image/svg+xml';

/** Computes every enabled feature's relief grid for the given config (async: logo/text need font/image loading). */
export async function collectGrids(config: KeychainConfig): Promise<KeychainInputs> {
  const qrGrid = config.qr.enabled ? buildQRGrid(config.qr) : null;
  // Raster fallback is always built too — it's cheap, and the vector path falls back to
  // it automatically when the SVG has <text> (unsupported) or otherwise fails to parse.
  const logoGrid = config.logo.enabled ? await buildLogoGrid(config.logo) : null;
  const isSvgLogo = config.logo.imageDataUrl?.startsWith(SVG_DATA_URL_PREFIX) ?? false;
  const logoSvg =
    config.logo.enabled && config.logo.vectorize && isSvgLogo
      ? await parseSvgLogo(config.logo).catch((e) => {
          console.error('[svg-logo] parseSvgLogo threw, falling back to raster:', e);
          return null;
        })
      : null;
  const text1Grid = config.text1.enabled ? await buildTextGrid(config.text1) : null;
  const text2Grid = config.text2.enabled ? await buildTextGrid(config.text2) : null;
  const text3Grid = config.text3.enabled ? await buildTextGrid(config.text3) : null;
  return { qrGrid, logoGrid, logoSvg, text1Grid, text2Grid, text3Grid };
}
