import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { KeychainConfig } from '../types';
import { createInsetShape, createOuterShape } from './shapeOutline';

/**
 * Builds the base plate (with keyring hole) plus an optional raised contour ring,
 * merged into a single geometry. Extrusion runs along +Z; Z=0 is the bottom face.
 */
export function buildPlateGeometry(config: KeychainConfig): THREE.BufferGeometry {
  const { shape, hole, contour } = config;

  const outer = createOuterShape(shape);

  if (hole.enabled && hole.diameter > 0) {
    const holePath = new THREE.Path();
    holePath.absarc(hole.offsetX, hole.offsetY, hole.diameter / 2, 0, Math.PI * 2, true);
    outer.holes.push(holePath);
  }

  const baseGeom = new THREE.ExtrudeGeometry(outer, {
    depth: shape.thickness,
    bevelEnabled: false,
    curveSegments: 32,
  });

  const parts: THREE.BufferGeometry[] = [baseGeom];

  if (contour.enabled && contour.width > 0 && contour.height > 0) {
    const ringOuter = createOuterShape(shape);
    const ringInner = createInsetShape(shape, contour.width);
    ringOuter.holes.push(pathFromShape(ringInner));

    const ringGeom = new THREE.ExtrudeGeometry(ringOuter, {
      depth: contour.height,
      bevelEnabled: false,
      curveSegments: 32,
    });
    ringGeom.translate(0, 0, shape.thickness);
    parts.push(ringGeom);
  }

  return mergeGeometries(parts, false);
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
