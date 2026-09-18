import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { LogoConfig, ReliefMode } from '../types';
import { buildLogoGrid } from './buildLogo';
import { buildReliefGeometry, computeReliefLayout, reliefZPlacement, type ReliefGrid } from './relief';

export interface SvgLogoData {
  shapes: THREE.Shape[];
  /** Pre-extruded solid stroke ribbons (outline-only paths), spanning z:[0,1] — the same
   *  raw convention as `new THREE.ExtrudeGeometry(shape, { depth: 1 })` before centering,
   *  so both go through the same transform in buildSvgLogoGeometry. */
  strokeGeometries: THREE.BufferGeometry[];
  refMinX: number; // the SVG's own reference box (viewBox, or width/height), in its user-unit space
  refMinY: number;
  refWidth: number;
  refHeight: number;
  /** Rasterized <text> content (SVGLoader can't parse it), pre-aligned to the same ref box. */
  textGrid: ReliefGrid | null;
}

const VISUAL_TAGS = new Set(['path', 'rect', 'circle', 'polygon', 'line', 'ellipse', 'polyline', 'use', 'image']);

/**
 * Luminance of an SVGLoader-resolved fill color, matching the raster path's own formula
 * (buildLogo.ts) so "which parts become raised material" means the same thing whether the
 * logo goes through vector or pixel mode. SVGLoader resolves any fill (hex, named color,
 * inline style) through the browser's CSSOM, which always normalizes to "rgb(r, g, b)" —
 * so a simple regex is enough; returns null only for something unparseable (a gradient
 * url(...) reference, most commonly).
 */
function fillLuminance(fillStr: string | undefined): number | null {
  if (!fillStr) return null;
  const m = fillStr.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!m) return null;
  const r = Number(m[1]);
  const g = Number(m[2]);
  const b = Number(m[3]);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * The SVG's own declared coordinate box — the same space its <path> data and viewBox live
 * in. This must NOT be derived from an <img>'s naturalWidth/naturalHeight (a CSS rendering
 * size the browser can default to something unrelated, e.g. 150x150 for an SVG that only
 * declares a viewBox) — using that as the scale reference silently blows shapes up by an
 * arbitrary factor. Falls back to the bounding box of every parsed path's own points only
 * as a last resort, for the rare SVG with neither a viewBox nor width/height attributes.
 */
function parseSvgRefBox(
  root: Element,
  paths: THREE.ShapePath[],
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
  return computeAllPathsBounds(paths);
}

function computeAllPathsBounds(paths: THREE.ShapePath[]): { minX: number; minY: number; width: number; height: number } {
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
  for (const path of paths) {
    for (const subPath of path.subPaths) consider(subPath.getPoints());
  }
  return { minX, minY, width: maxX - minX, height: maxY - minY };
}

/** Signed volume of a closed triangle-soup mesh (non-indexed); negative means inward-facing normals. */
function signedVolume(positions: Float32Array, triCount: number): number {
  let vol = 0;
  for (let t = 0; t < triCount; t++) {
    const o = t * 9;
    const ax = positions[o], ay = positions[o + 1], az = positions[o + 2];
    const bx = positions[o + 3], by = positions[o + 4], bz = positions[o + 5];
    const cx = positions[o + 6], cy = positions[o + 7], cz = positions[o + 8];
    vol += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
  }
  return vol / 6;
}

/**
 * Extrudes a flat (Z≈0), non-indexed triangle mesh into a closed solid spanning z:[0,1] —
 * used for a stroke ribbon (from `SVGLoader.pointsToStroke`), which is flat 2D geometry
 * with no thickness of its own. Duplicates it as top/bottom caps, then finds the mesh's
 * boundary edges (edges belonging to exactly one triangle — the ribbon's silhouette) and
 * builds a wall quad along each one. Winding is verified and corrected globally via the
 * mesh's signed volume, rather than assumed, since `pointsToStroke`'s own winding isn't
 * documented.
 */
function extrudeFlatMesh(flat: THREE.BufferGeometry): THREE.BufferGeometry {
  const pos = flat.attributes.position;
  const triCount = pos.count / 3;
  const verts: { x: number; y: number }[] = new Array(pos.count);
  for (let i = 0; i < pos.count; i++) verts[i] = { x: pos.getX(i), y: pos.getY(i) };

  const keyOf = (p: { x: number; y: number }) => `${p.x.toFixed(4)},${p.y.toFixed(4)}`;
  const edgeKey = (a: { x: number; y: number }, b: { x: number; y: number }) => `${keyOf(a)}>${keyOf(b)}`;
  const edgeSet = new Set<string>();
  for (let t = 0; t < triCount; t++) {
    const [p0, p1, p2] = [verts[t * 3], verts[t * 3 + 1], verts[t * 3 + 2]];
    edgeSet.add(edgeKey(p0, p1));
    edgeSet.add(edgeKey(p1, p2));
    edgeSet.add(edgeKey(p2, p0));
  }
  const boundary: [{ x: number; y: number }, { x: number; y: number }][] = [];
  for (let t = 0; t < triCount; t++) {
    const tri = [verts[t * 3], verts[t * 3 + 1], verts[t * 3 + 2]];
    for (let e = 0; e < 3; e++) {
      const a = tri[e];
      const b = tri[(e + 1) % 3];
      if (!edgeSet.has(edgeKey(b, a))) boundary.push([a, b]);
    }
  }

  const TOP = 1;
  const BOTTOM = 0;
  const positions: number[] = [];
  const pushTri = (a: [number, number, number], b: [number, number, number], c: [number, number, number]) => {
    positions.push(...a, ...b, ...c);
  };
  for (let t = 0; t < triCount; t++) {
    const [p0, p1, p2] = [verts[t * 3], verts[t * 3 + 1], verts[t * 3 + 2]];
    pushTri([p0.x, p0.y, TOP], [p1.x, p1.y, TOP], [p2.x, p2.y, TOP]);
    pushTri([p0.x, p0.y, BOTTOM], [p2.x, p2.y, BOTTOM], [p1.x, p1.y, BOTTOM]);
  }
  for (const [a, b] of boundary) {
    pushTri([a.x, a.y, BOTTOM], [b.x, b.y, BOTTOM], [b.x, b.y, TOP]);
    pushTri([a.x, a.y, BOTTOM], [b.x, b.y, TOP], [a.x, a.y, TOP]);
  }

  const positionsArr = new Float32Array(positions);
  const solidTriCount = positionsArr.length / 9;
  if (signedVolume(positionsArr, solidTriCount) < 0) {
    // Flip every triangle's winding (swap its 2nd/3rd vertex) so normals point outward.
    for (let t = 0; t < solidTriCount; t++) {
      const o1 = t * 9 + 3;
      const o2 = t * 9 + 6;
      for (let k = 0; k < 3; k++) {
        const tmp = positionsArr[o1 + k];
        positionsArr[o1 + k] = positionsArr[o2 + k];
        positionsArr[o2 + k] = tmp;
      }
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positionsArr, 3));
  // Unused (flat-colored material, no texture) but required: mergeGeometries() refuses to
  // combine geometries whose attribute sets differ, and ExtrudeGeometry/BoxGeometry (the
  // shapes/text pieces this gets merged with) both carry a uv attribute.
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((positionsArr.length / 3) * 2), 2));
  geom.computeVertexNormals();
  return geom;
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
 * Parses an SVG logo into extrudable vector geometry for a crisp relief instead of a
 * pixel-box one: filled paths become THREE.Shapes (extruded later), stroke-only paths
 * (fill:none) are extruded directly from their stroke ribbon since `toShapes()` only reads
 * fill geometry and would otherwise drop or wrongly solid-fill them, and any <text>
 * (SVGLoader never parses text) is rasterized separately and pre-aligned as `textGrid` —
 * so the caller can merge a clean vectorized icon with correctly-positioned pixel text.
 */
export async function parseSvgLogo(logo: LogoConfig): Promise<SvgLogoData | null> {
  if (!logo.imageDataUrl) return null;
  const svgText = await fetch(logo.imageDataUrl).then((r) => r.text());

  const loader = new SVGLoader();
  const svgData = loader.parse(svgText);
  console.log(`[svg-logo] parsed ${svgData.paths.length} path(s) from the source SVG`);

  const shapes: THREE.Shape[] = [];
  const strokeGeometries: THREE.BufferGeometry[] = [];
  let pathIdx = 0;
  for (const path of svgData.paths) {
    pathIdx++;
    const style = (
      path.userData as
        | { style?: { fill?: string; stroke?: string; strokeWidth?: number } }
        | undefined
    )?.style;
    const isFilled = !style || style.fill === undefined || style.fill !== 'none';
    const luminance = fillLuminance(style?.fill);
    // Same rule as the raster path: only "dark" (below threshold) fill counts as ink that
    // should become raised material — otherwise a background/highlight layer (e.g. a
    // full-bleed backdrop rect, or a light bevel facet) would get extruded right along
    // with the actual icon, merging into one undifferentiated block. A color that can't be
    // read as a resolved rgb() (typically a gradient) defaults to "ink", same as the
    // raster path treats anything it can't classify.
    let isInk = luminance === null ? true : luminance < logo.threshold;
    if (logo.invert) isInk = !isInk;
    console.log(
      `[svg-logo] path ${pathIdx}: fill=${style?.fill ?? '(default #000)'} luminance=${luminance?.toFixed(0) ?? 'n/a'} ` +
        `stroke=${style?.stroke ?? '(none)'} strokeWidth=${style?.strokeWidth ?? '(none)'} ` +
        `subPaths=${path.subPaths.length} isFilled=${isFilled} isInk=${isInk}`,
    );
    if (isFilled && isInk) {
      const newShapes = path.toShapes();
      console.log(`[svg-logo]   -> toShapes() produced ${newShapes.length} shape(s)`);
      shapes.push(...newShapes);
    }

    const strokeLuminance = fillLuminance(style?.stroke);
    let strokeIsInk = strokeLuminance === null ? true : strokeLuminance < logo.threshold;
    if (logo.invert) strokeIsInk = !strokeIsInk;
    if (style?.stroke && style.stroke !== 'none' && style.strokeWidth && strokeIsInk) {
      for (const subPath of path.subPaths) {
        const points = subPath.getPoints();
        if (points.length < 2) continue;
        try {
          // `style` (from path.userData) is a plain object; SVGLoader's own JSDoc types
          // don't precisely describe it, but it already carries every field pointsToStroke
          // needs (populated with defaults during parse()).
          const strokeGeom = SVGLoader.pointsToStroke(points, style as never);
          if (strokeGeom) {
            strokeGeometries.push(extrudeFlatMesh(strokeGeom));
            strokeGeom.dispose();
            console.log(`[svg-logo]   -> stroke solid built (${points.length} points)`);
          } else {
            console.log(`[svg-logo]   -> pointsToStroke() returned null for ${points.length} points`);
          }
        } catch (e) {
          console.error(`[svg-logo]   -> stroke extrusion threw:`, e);
        }
      }
    }
  }
  console.log(`[svg-logo] totals: ${shapes.length} filled shape(s), ${strokeGeometries.length} stroke solid(s)`);
  if (shapes.length === 0 && strokeGeometries.length === 0) {
    console.log('[svg-logo] nothing vectorizable found -> falling back to raster');
    return null;
  }

  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  const refBox = parseSvgRefBox(doc.documentElement, svgData.paths);
  console.log('[svg-logo] reference box:', refBox);
  if (!(refBox.width > 0) || !(refBox.height > 0)) {
    console.log('[svg-logo] degenerate reference box -> falling back to raster');
    return null;
  }

  const textOnlyUrl = buildTextOnlySvgDataUrl(doc, refBox);
  const textGrid = textOnlyUrl ? await buildLogoGrid({ ...logo, imageDataUrl: textOnlyUrl }).catch(() => null) : null;
  console.log(`[svg-logo] text overlay: ${textOnlyUrl ? (textGrid ? 'built' : 'FAILED to rasterize') : 'no <text> found'}`);

  return {
    shapes,
    strokeGeometries,
    refMinX: refBox.minX,
    refMinY: refBox.minY,
    refWidth: refBox.width,
    refHeight: refBox.height,
    textGrid,
  };
}

/**
 * Extrudes an SVG's real vector paths (fills and strokes alike) instead of rasterizing to
 * a box grid — clean diagonal/curved edges instead of the staircase artifacts a pixel
 * relief produces at the same feature size — and merges in a rasterized-text overlay when
 * the SVG has <text>, so all of it stays aligned as one piece. Positioned/sized/rotated
 * like the raster logo path.
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

  // Center the ref box around (0,0), fit it to sizeMm, flip Y (SVG space is Y-down; ours
  // is Y-up), and place it at its final world Z right away — buildReliefGeometry (used for
  // the text piece below) already bakes zCenter into its output rather than leaving it
  // local-centered, so everything needs to land at the same final Z *before* merging, not
  // via a shared translate afterward (that would shift the text piece a second time).
  // Both shapes and pre-built stroke solids span z:0..1 raw.
  const placeInFrame = (geom: THREE.BufferGeometry) => {
    geom.translate(-centerX, -centerY, -0.5);
    geom.scale(scale, -scale, boxDepth);
    geom.translate(0, 0, zCenter);
    return geom;
  };

  const pieces: THREE.BufferGeometry[] = [];
  for (const shape of data.shapes) {
    const geom = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, curveSegments: 24 });
    pieces.push(placeInFrame(geom));
  }
  for (const strokeGeom of data.strokeGeometries) {
    pieces.push(placeInFrame(strokeGeom.clone()));
  }

  if (data.textGrid) {
    // Built with the SAME sizeMm/aspect as the vector shapes (the text raster's canvas was
    // forced to the identical ref box), so it lines up exactly once both are merged. Its Z
    // placement is already final (see comment above), unlike the pieces built by this
    // function.
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
  merged.translate(offsetX, offsetY, 0);

  return merged.index ? merged.toNonIndexed() : merged;
}
