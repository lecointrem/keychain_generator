import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { KeychainConfig } from '../types';
import { createInsetShape, createOuterShape } from './shapeOutline';

/** Builds just the base plate (with keyring hole), no contour. */
export function buildBasePlateGeometry(config: KeychainConfig): THREE.BufferGeometry {
  const { shape, hole } = config;
  const outer = createOuterShape(shape);

  if (hole.enabled && hole.diameter > 0) {
    const holePath = new THREE.Path();
    holePath.absarc(hole.offsetX, hole.offsetY, hole.diameter / 2, 0, Math.PI * 2, true);
    outer.holes.push(holePath);
  }

  return new THREE.ExtrudeGeometry(outer, {
    depth: shape.thickness,
    bevelEnabled: false,
    curveSegments: 32,
  });
}

/** Builds just the raised contour ring, sitting on top of the base plate (or null if disabled). */
export function buildContourGeometry(config: KeychainConfig): THREE.BufferGeometry | null {
  const { shape, contour } = config;
  if (!contour.enabled || contour.width <= 0 || contour.height <= 0) return null;

  const ringOuter = createOuterShape(shape);
  const ringInner = createInsetShape(shape, contour.width);
  ringOuter.holes.push(pathFromShape(ringInner));

  const ringGeom = new THREE.ExtrudeGeometry(ringOuter, {
    depth: contour.height,
    bevelEnabled: false,
    curveSegments: 32,
  });
  ringGeom.translate(0, 0, shape.thickness);
  return ringGeom;
}

/**
 * Builds the base plate (with keyring hole) plus an optional raised contour ring,
 * merged into a single geometry. Extrusion runs along +Z; Z=0 is the bottom face.
 */
export function buildPlateGeometry(config: KeychainConfig): THREE.BufferGeometry {
  const baseGeom = buildBasePlateGeometry(config);
  const ringGeom = buildContourGeometry(config);
  return ringGeom ? mergeGeometries([baseGeom, ringGeom], false) : baseGeom;
}

function pathFromShape(shape: THREE.Shape): THREE.Path {
  const path = new THREE.Path();
  path.curves = shape.curves;
  return path;
}

/** Z height of the top surface of the base plate (where QR/logo sit). */
export function plateTopZ(config: KeychainConfig): number {
  return config.shape.thickness;
}
