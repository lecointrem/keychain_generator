import * as THREE from 'three';
import type { ShapeConfig } from '../types';

/** Effective bounding box (mm) of the shape, used for centering QR/logo/hole. */
export function shapeBounds(shape: ShapeConfig): { width: number; height: number } {
  if (shape.type === 'circle') {
    return { width: shape.width, height: shape.width };
  }
  return { width: shape.width, height: shape.height };
}

function roundedRectPath(w: number, h: number, r: number): THREE.Shape {
  const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  const x = -w / 2;
  const y = -h / 2;
  const s = new THREE.Shape();
  s.moveTo(x + rr, y);
  s.lineTo(x + w - rr, y);
  s.quadraticCurveTo(x + w, y, x + w, y + rr);
  s.lineTo(x + w, y + h - rr);
  s.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  s.lineTo(x + rr, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - rr);
  s.lineTo(x, y + rr);
  s.quadraticCurveTo(x, y, x + rr, y);
  return s;
}

function circlePath(diameter: number): THREE.Shape {
  const s = new THREE.Shape();
  s.absarc(0, 0, diameter / 2, 0, Math.PI * 2, false);
  return s;
}

function hexagonPath(w: number, h: number): THREE.Shape {
  const s = new THREE.Shape();
  const rx = w / 2;
  const ry = h / 2;
  const pts: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    pts.push([rx * Math.cos(a), ry * Math.sin(a)]);
  }
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  return s;
}

function pillPath(w: number, h: number): THREE.Shape {
  // Fully rounded ends (stadium shape), like a classic luggage tag.
  return roundedRectPath(w, h, h / 2);
}

/** Builds the outer 2D outline of the keychain in the XY plane, centered at origin. */
export function createOuterShape(shape: ShapeConfig): THREE.Shape {
  switch (shape.type) {
    case 'circle':
      return circlePath(shape.width);
    case 'hexagon':
      return hexagonPath(shape.width, shape.height);
    case 'tag':
      return pillPath(shape.width, shape.height);
    case 'rounded-rect':
    default:
      return roundedRectPath(shape.width, shape.height, shape.cornerRadius);
  }
}

/** Builds an inset version of the outline (used for the inner edge of the contour ring). */
export function createInsetShape(shape: ShapeConfig, inset: number): THREE.Shape {
  const w = Math.max(0.1, shape.width - inset * 2);
  switch (shape.type) {
    case 'circle':
      return circlePath(w);
    case 'hexagon':
      return hexagonPath(w, Math.max(0.1, shape.height - inset * 2));
    case 'tag': {
      const h = Math.max(0.1, shape.height - inset * 2);
      return pillPath(w, h);
    }
    case 'rounded-rect':
    default: {
      const h = Math.max(0.1, shape.height - inset * 2);
      const r = Math.max(0, shape.cornerRadius - inset);
      return roundedRectPath(w, h, r);
    }
  }
}
