import * as THREE from 'three';
import type { NFCConfig } from '../types';

/**
 * Builds a cutter for a fully-enclosed cylindrical pocket at mid-thickness, sized to
 * fit an NFC sticker (tagThickness) plus a bit of play (clearance). Unlike the QR/logo/
 * text cutters, this one never touches the top or bottom surface — it's meant to be
 * exposed only by pausing the print at that Z height to drop the tag in, then resuming.
 */
export function buildNFCPocketCutter(nfc: NFCConfig, plateThickness: number): THREE.BufferGeometry | null {
  if (!nfc.enabled || nfc.diameter <= 0) return null;

  const pocketHeight = nfc.tagThickness + nfc.clearance;
  if (pocketHeight <= 0) return null;

  const minWall = 0.2; // mm, minimum plastic left above/below the pocket
  if (pocketHeight + minWall * 2 > plateThickness) return null;

  const radius = nfc.diameter / 2;
  const geom = new THREE.CylinderGeometry(radius, radius, pocketHeight, 48, 1);
  geom.rotateX(Math.PI / 2); // cylinder axis: Y -> Z (thickness axis)
  geom.translate(nfc.offsetX, nfc.offsetY, plateThickness / 2);
  return geom.toNonIndexed();
}
