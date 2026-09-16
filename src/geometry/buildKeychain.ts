import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';
import type { KeychainConfig, ReliefMode } from '../types';
import { buildPlateGeometry, plateTopZ } from './buildPlate';
import { shapeBounds } from './shapeOutline';
import { buildReliefGeometry, computeReliefLayout, type ReliefGrid } from './relief';

export interface KeychainInputs {
  qrGrid: ReliefGrid | null;
  logoGrid: ReliefGrid | null;
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
  height: number,
  mode: ReliefMode,
  zTop: number,
  thickness: number,
  bounds: { width: number; height: number },
): THREE.BufferGeometry | null {
  if (!enabled || !grid) return null;
  const sizeMm = reliefSizeMm(bounds, sizeRatio);
  const layout = computeReliefLayout(grid.cols, grid.rows, sizeMm, offsetX, offsetY);
  return buildReliefGeometry(grid, layout, height, zTop, mode, thickness);
}

export interface KeychainParts {
  /** Plate + contour, with any engraved cavities already cut in. */
  base: THREE.BufferGeometry;
  /** Merged raised (additive) QR/logo material, if any — a separate printable piece. */
  relief: THREE.BufferGeometry | null;
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
    config.logo.reliefHeight,
    config.logo.mode,
    zTop,
    thickness,
    bounds,
  );

  const cutters: THREE.BufferGeometry[] = [];
  const additions: THREE.BufferGeometry[] = [];

  if (qrGeom) (config.qr.mode === 'engraved' ? cutters : additions).push(qrGeom);
  if (logoGeom) (config.logo.mode === 'engraved' ? cutters : additions).push(logoGeom);

  let base = plateGeom;

  if (cutters.length > 0) {
    const cutterGeom = cutters.length === 1 ? cutters[0] : mergeGeometries(cutters, false);
    const evaluator = new Evaluator();
    const plateBrush = new Brush(base, new THREE.MeshStandardMaterial());
    const cutterBrush = new Brush(cutterGeom, new THREE.MeshStandardMaterial());
    plateBrush.updateMatrixWorld(true);
    cutterBrush.updateMatrixWorld(true);
    const resultBrush = evaluator.evaluate(plateBrush, cutterBrush, SUBTRACTION);
    base = resultBrush.geometry.index ? resultBrush.geometry.toNonIndexed() : resultBrush.geometry;
  }

  const relief = additions.length === 0 ? null : additions.length === 1 ? additions[0] : mergeGeometries(additions, false);

  return { base, relief };
}

/** Assembles the full printable keychain geometry: plate + hole + contour + QR + logo. */
export function buildKeychainGeometry(
  config: KeychainConfig,
  inputs: KeychainInputs,
): THREE.BufferGeometry {
  const { base, relief } = buildKeychainParts(config, inputs);
  return relief ? mergeGeometries([base, relief], false) : base;
}
