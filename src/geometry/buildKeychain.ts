import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ADDITION, Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';
import type { KeychainConfig, ReliefMode, TextZoneConfig } from '../types';
import { buildPlateGeometry, plateTopZ } from './buildPlate';
import { shapeBounds } from './shapeOutline';
import {
  buildReliefGeometry,
  computeReliefLayout,
  computeReliefLayoutByHeight,
  rotateReliefGeometry,
  type ReliefGrid,
} from './relief';
import { buildNFCPocketCutter } from './buildNFC';

export interface KeychainInputs {
  qrGrid: ReliefGrid | null;
  logoGrid: ReliefGrid | null;
  text1Grid: ReliefGrid | null;
  text2Grid: ReliefGrid | null;
  text3Grid: ReliefGrid | null;
}

function reliefSizeMm(bounds: { width: number; height: number }, sizeRatio: number): number {
  return Math.min(bounds.width, bounds.height) * sizeRatio;
}

function buildFeatureGeometries(
  grid: ReliefGrid | null,
  enabled: boolean,
  sizeRatio: number,
  offsetX: number,
  offsetY: number,
  rotation: number,
  height: number,
  mode: ReliefMode,
  zTop: number,
  thickness: number,
  bounds: { width: number; height: number },
): THREE.BufferGeometry | null {
  if (!enabled || !grid) return null;
  const sizeMm = reliefSizeMm(bounds, sizeRatio);
  const layout = computeReliefLayout(grid.cols, grid.rows, sizeMm, offsetX, offsetY);
  const geom = buildReliefGeometry(grid, layout, height, zTop, mode, thickness);
  if (!geom) return null;
  return rotateReliefGeometry(geom, rotation, offsetX, offsetY);
}

function buildTextZoneGeometry(
  grid: ReliefGrid | null,
  zone: TextZoneConfig,
  zTop: number,
  thickness: number,
): THREE.BufferGeometry | null {
  if (!zone.enabled || !grid) return null;
  const layout = computeReliefLayoutByHeight(grid.cols, grid.rows, zone.height, zone.offsetX, zone.offsetY);
  const geom = buildReliefGeometry(grid, layout, zone.reliefHeight, zTop, zone.mode, thickness);
  if (!geom) return null;
  return rotateReliefGeometry(geom, zone.rotation, zone.offsetX, zone.offsetY);
}

export interface KeychainParts {
  /** Plate + contour, with any engraved cavities already cut in. */
  base: THREE.BufferGeometry;
  /** Merged raised (additive) QR/logo material, if any — a separate printable piece. */
  relief: THREE.BufferGeometry | null;
  /** Whether `base` had material cut out of it (an engraved cutter was applied). */
  hasCavities: boolean;
}

/** Boolean-combines two geometries via three-bvh-csg, returning a non-indexed result. */
function csgCombine(
  a: THREE.BufferGeometry,
  b: THREE.BufferGeometry,
  operation: typeof ADDITION | typeof SUBTRACTION,
): THREE.BufferGeometry {
  const evaluator = new Evaluator();
  const brushA = new Brush(a, new THREE.MeshStandardMaterial());
  const brushB = new Brush(b, new THREE.MeshStandardMaterial());
  brushA.updateMatrixWorld(true);
  brushB.updateMatrixWorld(true);
  const result = evaluator.evaluate(brushA, brushB, operation);
  return result.geometry.index ? result.geometry.toNonIndexed() : result.geometry;
}

/** Builds the base plate (with engravings applied) and the raised relief as separate pieces. */
export function buildKeychainParts(config: KeychainConfig, inputs: KeychainInputs): KeychainParts {
  const plateGeom = buildPlateGeometry(config);
  const bounds = shapeBounds(config.shape);
  const zTop = plateTopZ(config);
  const thickness = config.shape.thickness;

  const qrGeom = buildFeatureGeometries(
    inputs.qrGrid,
    config.qr.enabled,
    config.qr.sizeRatio,
    config.qr.offsetX,
    config.qr.offsetY,
    config.qr.rotation,
    config.qr.moduleHeight,
    config.qr.mode,
    zTop,
    thickness,
    bounds,
  );

  const logoGeom = buildFeatureGeometries(
    inputs.logoGrid,
    config.logo.enabled,
    config.logo.sizeRatio,
    config.logo.offsetX,
    config.logo.offsetY,
    config.logo.rotation,
    config.logo.reliefHeight,
    config.logo.mode,
    zTop,
    thickness,
    bounds,
  );

  const text1Geom = buildTextZoneGeometry(inputs.text1Grid, config.text1, zTop, thickness);
  const text2Geom = buildTextZoneGeometry(inputs.text2Grid, config.text2, zTop, thickness);
  const text3Geom = buildTextZoneGeometry(inputs.text3Grid, config.text3, zTop, thickness);
  const nfcGeom = buildNFCPocketCutter(config.nfc, thickness);

  const cutters: THREE.BufferGeometry[] = [];
  const additions: THREE.BufferGeometry[] = [];

  if (qrGeom) (config.qr.mode === 'engraved' ? cutters : additions).push(qrGeom);
  if (logoGeom) (config.logo.mode === 'engraved' ? cutters : additions).push(logoGeom);
  if (text1Geom) (config.text1.mode === 'engraved' ? cutters : additions).push(text1Geom);
  if (text2Geom) (config.text2.mode === 'engraved' ? cutters : additions).push(text2Geom);
  if (text3Geom) (config.text3.mode === 'engraved' ? cutters : additions).push(text3Geom);
  if (nfcGeom) cutters.push(nfcGeom);

  let base = plateGeom;
  const hasCavities = cutters.length > 0;

  if (hasCavities) {
    const cutterGeom = cutters.length === 1 ? cutters[0] : mergeGeometries(cutters, false);
    base = csgCombine(base, cutterGeom, SUBTRACTION);
  }

  const relief = additions.length === 0 ? null : additions.length === 1 ? additions[0] : mergeGeometries(additions, false);

  return { base, relief, hasCavities };
}

/** Assembles the full printable keychain geometry: plate + hole + contour + QR + logo. */
export function buildKeychainGeometry(
  config: KeychainConfig,
  inputs: KeychainInputs,
): THREE.BufferGeometry {
  const { base, relief, hasCavities } = buildKeychainParts(config, inputs);
  if (!relief) return base;
  // Only pay for a real boolean union when the base actually has an engraved cavity
  // that a raised piece could be overlapping (otherwise a plain merge is far cheaper
  // and safer — a CSG union of many small touching boxes, like QR/text pixels, is a
  // pathological case for the boolean evaluator).
  return hasCavities ? csgCombine(base, relief, ADDITION) : mergeGeometries([base, relief], false);
}
