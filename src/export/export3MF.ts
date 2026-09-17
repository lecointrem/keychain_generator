import * as THREE from 'three';
import { exportTo3MF } from 'three-3mf-exporter';
import type { KeychainConfig } from '../types';
import { buildKeychainPieces, type KeychainInputs } from '../geometry/buildKeychain';
import { downloadBlob } from '../utils/download';

/**
 * Exports the keychain as a 3MF file with one named, colored object per piece
 * (base, contour, QR, logo, text zones) — BambuStudio-compatible, so an AMS or
 * other multi-material printer can pick up each object's color automatically.
 * Engraved elements have no volume of their own, so they always take on the
 * color of whatever they're cut into.
 */
export async function exportKeychain3MF(config: KeychainConfig, inputs: KeychainInputs) {
  const pieces = buildKeychainPieces(config, inputs);
  const filename = (config.export.filename || 'porte-cle').trim() || 'porte-cle';

  const group = new THREE.Group();
  for (const piece of pieces) {
    const material = new THREE.MeshStandardMaterial({ color: piece.color });
    const mesh = new THREE.Mesh(piece.geometry, material);
    mesh.name = piece.label;
    group.add(mesh);
  }

  const blob = await exportTo3MF(group);
  downloadBlob(blob, `${filename}.3mf`);
}
