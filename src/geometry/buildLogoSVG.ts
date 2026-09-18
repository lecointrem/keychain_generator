import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { ReliefMode } from '../types';
import { reliefZPlacement } from './relief';

export interface SvgLogoData {
  shapes: THREE.Shape[];
  width: number; // reference width, in the SVG's own user units
  height: number; // reference height, in the SVG's own user units
  /**
   * False if the SVG has content this parser can't faithfully turn into vector shapes —
   * <text> (SVGLoader doesn't parse it), or a stroke-only path (fill:none). `toShapes()`
   * only reads fill geometry, so a stroke-only path (e.g. a thin outline stroke) would
   * otherwise be silently dropped or, worse, wrongly filled in solid. When false, the
   * caller should fall back to the raster pipeline instead of using `shapes`.
   */
  isFullyVectorizable: boolean;
}

function loadImageSize(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth || 1, height: img.naturalHeight || 1 });
    img.onerror = () => reject(new Error("Impossible de charger le SVG"));
    img.src = src;
  });
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

  const { width, height } = await loadImageSize(dataUrl);
  const hasTextElements = /<text[\s>]/i.test(svgText);
  return { shapes, width, height, isFullyVectorizable: !hasTextElements && !hasStrokeOnlyPath };
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

  const pieces: THREE.BufferGeometry[] = [];
  for (const shape of data.shapes) {
    const geom = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, curveSegments: 24 });
    // Center the SVG's top-left-origin, Y-down space around (0,0), then fit it to
    // sizeMm and flip Y to match our Y-up convention (extrude spans 0..1 in Z).
    geom.translate(-data.width / 2, -data.height / 2, -0.5);
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
