import { buildQRGrid } from './buildQR';
import { buildLogoGrid } from './buildLogo';
import { buildTextGrid } from './buildText';
import type { KeychainConfig } from '../types';
import type { KeychainInputs } from './buildKeychain';

/** Computes every enabled feature's relief grid for the given config (async: logo/text need font/image loading). */
export async function collectGrids(config: KeychainConfig): Promise<KeychainInputs> {
  const qrGrid = config.qr.enabled ? buildQRGrid(config.qr) : null;
  const logoGrid = config.logo.enabled ? await buildLogoGrid(config.logo) : null;
  const text1Grid = config.text1.enabled ? await buildTextGrid(config.text1) : null;
  const text2Grid = config.text2.enabled ? await buildTextGrid(config.text2) : null;
  const text3Grid = config.text3.enabled ? await buildTextGrid(config.text3) : null;
  return { qrGrid, logoGrid, text1Grid, text2Grid, text3Grid };
}
