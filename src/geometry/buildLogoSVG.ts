import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { ReliefMode } from '../types';
import { reliefZPlacement, type ReliefGrid } from './relief';

export interface SvgLogoData {
  shapes: THREE.Shape[];
  minX: number; // bounding box of the shapes themselves, in SVGLoader's own path-unit space
  minY: number;
  width: number;
  height: number;
  /**
   * False if the SVG has content this parser can't faithfully turn into vector shapes —
   * <text> (SVGLoader doesn't parse it), or a stroke-only path (fill:none). `toShapes()`
   * only reads fill geometry, so a stroke-only path (e.g. a thin outline stroke) would
   * otherwise be silently dropped or, worse, wrongly filled in solid. When false, the
   * caller should fall back to the raster pipeline instead of using `shapes`.
   */
  isFullyVectorizable: boolean;
}

/**
 * Bounding box of the parsed shapes, in the same coordinate space SVGLoader used to build
 * them. Deliberately NOT derived from an <img>'s naturalWidth/naturalHeight: that's a CSS
 * rendering size (which, for an SVG with only a viewBox and no explicit width/height
 * attributes, the browser defaults to a fixed 300x150 unrelated to the path data) — using
 * it as the scale reference could blow the shapes up by a large, arbitrary factor, leaving
 * only a flat, featureless fragment of one oversized shape on screen.
 */
function computeShapesBounds(shapes: THREE.Shape[]): { minX: number; minY: number; width: number; height: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const consider = (points: THREE.Vector2[]) => {
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
  };
  for (const shape of shapes) {
    consider(shape.getPoints());
    for (const hole of shape.holes) consider(hole.getPoints());
  }
  return { minX, minY, width: maxX - minX, height: maxY - minY };
}

/** Parses an SVG data URL into extrudable vector shapes, for a crisp logo instead of a pixel-box relief. */
export async function parseSvgLogo(dataUrl: string): Promise<SvgLogoData | null> {
  const svgText = await fetch(dataUrl).then((r) => r.text());

  const loader = new SVGLoader();
  const svgData = loader.parse(svgText);

  const shapes: THREE.Shape[] = [];
  let hasStrokeOnlyPath = false;
  for (const path of svgData.paths) {
    const style = (path.userData as { style?: { fill?: string; stroke?: string } } | undefined)?.style;
    const isFilled = !style || style.fill === undefined || style.fill !== 'none';
    if (isFilled) {
      shapes.push(...path.toShapes());
    } else if (style?.stroke && style.stroke !== 'none') {
      hasStrokeOnlyPath = true;
    }
  }
  if (shapes.length === 0) return null;

  const { minX, minY, width, height } = computeShapesBounds(shapes);
  if (!(width > 0) || !(height > 0)) return null;

  const hasTextElements = /<text[\s>]/i.test(svgText);
  return { shapes, minX, minY, width, height, isFullyVectorizable: !hasTextElements && !hasStrokeOnlyPath };
}

function shapeNetArea(shape: THREE.Shape): number {
  const outer = Math.abs(THREE.ShapeUtils.area(shape.getPoints()));
  const holesArea = shape.holes.reduce((sum, h) => sum + Math.abs(THREE.ShapeUtils.area(h.getPoints())), 0);
  return Math.max(0, outer - holesArea);
}

/** Fraction of the SVG's reference box actually covered by ink, according to the vector shapes. */
function vectorCoverageRatio(data: SvgLogoData): number {
  const refArea = data.width * data.height;
  if (refArea <= 0) return 0;
  const totalArea = data.shapes.reduce((sum, s) => sum + shapeNetArea(s), 0);
  return totalArea / refArea;
}

/**
 * Cross-checks the vectorized shapes against the raster rasterization of the same logo.
 * SVGLoader's `toShapes()` only detects holes heuristically from winding order — it gets
 * this wrong on some real-world logos (particularly artwork using fill-rule="evenodd" or
 * overlapping compound paths), producing a solid blob where the artwork should have
 * cutouts/facets. When the vector shapes cover far more (or less) of the reference box
 * than the raster ink coverage does, that mismatch means the vector result is likely
 * wrong, so the caller should fall back to the (always-correct, browser-rendered) raster
 * pipeline instead.
 */
export function isVectorTrustworthy(svg: SvgLogoData, grid: ReliefGrid | null): boolean {
  if (!svg.isFullyVectorizable) return false;
  const vectorRatio = vectorCoverageRatio(svg);
  if (vectorRatio > 0.85) return false; // near-total fill is almost never real logo artwork
  if (!grid || grid.cells.length === 0) return true; // nothing to cross-check against, trust it
  const filled = grid.cells.reduce((n, c) => n + (c ? 1 : 0), 0);
  const rasterRatio = filled / grid.cells.length;
  return Math.abs(vectorRatio - rasterRatio) <= 0.35;
}

/**
 * Extrudes an SVG's real vector paths instead of rasterizing to a box grid — clean
 * diagonal/curved edges instead of the staircase artifacts a pixel relief produces at
 * the same feature size. Positioned/sized/rotated the same way as the raster logo path.
 */
export function buildSvgLogoGeometry(
  data: SvgLogoData,
  sizeMm: number,
  offsetX: number,
  offsetY: number,
  rotation: number,
  zTop: number,
  height: number,
  mode: ReliefMode,
  thickness: number,
): THREE.BufferGeometry | null {
  if (height <= 0 || sizeMm <= 0) return null;
  const { boxDepth, zCenter } = reliefZPlacement(height, zTop, mode, thickness);
  const scale = sizeMm / Math.max(data.width, data.height);
  const centerX = data.minX + data.width / 2;
  const centerY = data.minY + data.height / 2;

  const pieces: THREE.BufferGeometry[] = [];
  for (const shape of data.shapes) {
    const geom = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, curveSegments: 24 });
    // Center the shapes' own bounding box around (0,0), then fit it to sizeMm and flip Y
    // (SVG space is Y-down; ours is Y-up). Extrude spans 0..1 in Z before this scale.
    geom.translate(-centerX, -centerY, -0.5);
    geom.scale(scale, -scale, boxDepth);
    pieces.push(geom);
  }

  let merged = pieces.length === 1 ? pieces[0] : mergeGeometries(pieces, false);
  if (pieces.length > 1) pieces.forEach((p) => p.dispose());
  if (!merged) return null;

  const rad = (rotation * Math.PI) / 180;
  merged.rotateZ(rad);
  merged.translate(offsetX, offsetY, zCenter);

  return merged.index ? merged.toNonIndexed() : merged;
}
