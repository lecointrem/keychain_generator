import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { LogoConfig, ReliefMode } from '../types';
import { buildLogoGrid } from './buildLogo';
import { buildReliefGeometry, computeReliefLayout, reliefZPlacement, type ReliefGrid } from './relief';

export interface SvgLogoData {
  shapes: THREE.Shape[];
  refMinX: number; // the SVG's own reference box (viewBox, or width/height), in its user-unit space
  refMinY: number;
  refWidth: number;
  refHeight: number;
  /** Rasterized <text> content (SVGLoader can't parse it), pre-aligned to the same ref box. */
  textGrid: ReliefGrid | null;
  /**
   * False if the SVG has content this parser can't faithfully turn into vector shapes: a
   * stroke-only path (fill:none). `toShapes()` only reads fill geometry, so a stroke-only
   * path (e.g. a thin outline stroke) would otherwise be silently dropped or, worse,
   * wrongly filled in solid. When false, the caller should fall back to the raster
   * pipeline entirely instead of using `shapes`.
   */
  isFullyVectorizable: boolean;
}

const VISUAL_TAGS = new Set(['path', 'rect', 'circle', 'polygon', 'line', 'ellipse', 'polyline', 'use', 'image']);

/**
 * The SVG's own declared coordinate box — the same space its <path> data and viewBox live
 * in. This must NOT be derived from an <img>'s naturalWidth/naturalHeight (a CSS rendering
 * size the browser can default to something unrelated, e.g. 150x150 for an SVG that only
 * declares a viewBox) — using that as the scale reference silently blows shapes up by an
 * arbitrary factor. Falls back to the parsed shapes' own bounding box only as a last
 * resort, for the rare SVG with neither a viewBox nor width/height attributes.
 */
function parseSvgRefBox(
  root: Element,
  shapes: THREE.Shape[],
): { minX: number; minY: number; width: number; height: number } {
  const viewBoxAttr = root.getAttribute('viewBox');
  if (viewBoxAttr) {
    const parts = viewBoxAttr.trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n)) && parts[2] > 0 && parts[3] > 0) {
      return { minX: parts[0], minY: parts[1], width: parts[2], height: parts[3] };
    }
  }
  const w = parseFloat(root.getAttribute('width') || '');
  const h = parseFloat(root.getAttribute('height') || '');
  if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
    return { minX: 0, minY: 0, width: w, height: h };
  }
  return computeShapesBounds(shapes);
}

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

/**
 * Builds a variant of the SVG with every non-text visual element hidden (display:none) and
 * its root width/height forced to the reference box — so rasterizing it (via the existing
 * raster pipeline) yields just the text's ink, on a canvas that lines up exactly with the
 * vector shapes' coordinate frame. Returns null if the SVG has no <text> at all.
 */
function buildTextOnlySvgDataUrl(
  doc: Document,
  refBox: { minX: number; minY: number; width: number; height: number },
): string | null {
  const root = doc.documentElement;
  if (root.getElementsByTagName('text').length === 0) return null;

  const toHide: Element[] = [];
  const visit = (el: Element) => {
    if (VISUAL_TAGS.has(el.tagName.toLowerCase())) {
      toHide.push(el);
      return;
    }
    Array.from(el.children).forEach(visit);
  };
  visit(root);
  toHide.forEach((el) => el.setAttribute('display', 'none'));

  root.setAttribute('width', String(refBox.width));
  root.setAttribute('height', String(refBox.height));
  if (!root.getAttribute('viewBox')) {
    root.setAttribute('viewBox', `${refBox.minX} ${refBox.minY} ${refBox.width} ${refBox.height}`);
  }

  const svgString = new XMLSerializer().serializeToString(doc);
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgString)))}`;
}

/**
 * Parses an SVG logo into extrudable vector shapes for a crisp relief instead of a pixel-
 * box one. Any <text> (SVGLoader only parses path/shape geometry, never text) is rasterized
 * separately and returned pre-aligned as `textGrid`, so the caller can merge a clean
 * vectorized diamond/icon with correctly-positioned pixelated text, say, in one piece.
 */
export async function parseSvgLogo(logo: LogoConfig): Promise<SvgLogoData | null> {
  if (!logo.imageDataUrl) return null;
  const svgText = await fetch(logo.imageDataUrl).then((r) => r.text());

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

  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  const refBox = parseSvgRefBox(doc.documentElement, shapes);
  if (!(refBox.width > 0) || !(refBox.height > 0)) return null;

  const textOnlyUrl = buildTextOnlySvgDataUrl(doc, refBox);
  const textGrid = textOnlyUrl ? await buildLogoGrid({ ...logo, imageDataUrl: textOnlyUrl }).catch(() => null) : null;

  return {
    shapes,
    refMinX: refBox.minX,
    refMinY: refBox.minY,
    refWidth: refBox.width,
    refHeight: refBox.height,
    textGrid,
    isFullyVectorizable: !hasStrokeOnlyPath,
  };
}

function shapeNetArea(shape: THREE.Shape): number {
  const outer = Math.abs(THREE.ShapeUtils.area(shape.getPoints()));
  const holesArea = shape.holes.reduce((sum, h) => sum + Math.abs(THREE.ShapeUtils.area(h.getPoints())), 0);
  return Math.max(0, outer - holesArea);
}

/** Fraction of the SVG's reference box covered by ink, according to the vector shapes alone. */
function vectorCoverageRatio(data: SvgLogoData): number {
  const refArea = data.refWidth * data.refHeight;
  if (refArea <= 0) return 0;
  const totalArea = data.shapes.reduce((sum, s) => sum + shapeNetArea(s), 0);
  return totalArea / refArea;
}

/**
 * Cross-checks the vectorized shapes against the raster rasterization of the same logo.
 * SVGLoader's `toShapes()` only detects holes heuristically from winding order — it gets
 * this wrong on some real-world logos (particularly artwork using fill-rule="evenodd" or
 * overlapping compound paths), producing a solid blob where the artwork should have
 * cutouts/facets. When the vector shapes cover far more of the reference box than the
 * raster ink coverage does, that mismatch means the vector result is likely wrong, so the
 * caller should fall back to the (always-correct, browser-rendered) raster pipeline
 * instead. Skipped when the logo has its own separately-rasterized text (comparing against
 * the full raster, text included, would be an apples-to-oranges skew) — the absolute
 * near-total-fill check below still catches the same failure mode.
 */
export function isVectorTrustworthy(svg: SvgLogoData, grid: ReliefGrid | null): boolean {
  if (!svg.isFullyVectorizable) return false;
  const vectorRatio = vectorCoverageRatio(svg);
  if (vectorRatio > 0.85) return false; // near-total fill is almost never real logo artwork
  if (svg.textGrid || !grid || grid.cells.length === 0) return true; // nothing comparable to cross-check against
  const filled = grid.cells.reduce((n, c) => n + (c ? 1 : 0), 0);
  const rasterRatio = filled / grid.cells.length;
  return Math.abs(vectorRatio - rasterRatio) <= 0.35;
}

/**
 * Extrudes an SVG's real vector paths instead of rasterizing to a box grid — clean
 * diagonal/curved edges instead of the staircase artifacts a pixel relief produces at the
 * same feature size — and merges in a rasterized-text overlay when the SVG has <text>, so
 * the two stay aligned as one piece. Positioned/sized/rotated like the raster logo path.
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
  const scale = sizeMm / Math.max(data.refWidth, data.refHeight);
  const centerX = data.refMinX + data.refWidth / 2;
  const centerY = data.refMinY + data.refHeight / 2;

  const pieces: THREE.BufferGeometry[] = [];
  for (const shape of data.shapes) {
    const geom = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, curveSegments: 24 });
    // Center the ref box around (0,0), then fit it to sizeMm and flip Y (SVG space is
    // Y-down; ours is Y-up). Extrude spans 0..1 in Z before this scale.
    geom.translate(-centerX, -centerY, -0.5);
    geom.scale(scale, -scale, boxDepth);
    pieces.push(geom);
  }

  if (data.textGrid) {
    // Built with the SAME sizeMm/aspect as the vector shapes (the text raster's canvas was
    // forced to the identical ref box), so it lines up exactly once both are merged.
    const layout = computeReliefLayout(data.textGrid.cols, data.textGrid.rows, sizeMm, 0, 0);
    const textGeom = buildReliefGeometry(data.textGrid, layout, height, zTop, mode, thickness);
    if (textGeom) pieces.push(textGeom);
  }
  if (pieces.length === 0) return null;

  let merged = pieces.length === 1 ? pieces[0] : mergeGeometries(pieces, false);
  if (pieces.length > 1) pieces.forEach((p) => p.dispose());
  if (!merged) return null;

  const rad = (rotation * Math.PI) / 180;
  merged.rotateZ(rad);
  merged.translate(offsetX, offsetY, zCenter);

  return merged.index ? merged.toNonIndexed() : merged;
}
