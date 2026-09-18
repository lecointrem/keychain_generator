import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { ReliefMode } from '../types';

export interface ReliefGrid {
  cols: number;
  rows: number;
  /** true = filled/dark cell that should become relief material */
  cells: boolean[];
}

export interface ReliefLayout {
  moduleSize: number;
  originX: number; // local X of the top-left corner of the grid (col 0, row 0)
  originY: number; // local Y of the top-left corner of the grid (col 0, row 0), grid extends downward (-Y)
}

/** Centers a cols x rows grid of the given module size around (offsetX, offsetY). */
export function layoutFromModuleSize(
  cols: number,
  rows: number,
  moduleSize: number,
  offsetX: number,
  offsetY: number,
): ReliefLayout {
  const gridW = cols * moduleSize;
  const gridH = rows * moduleSize;
  return {
    moduleSize,
    originX: offsetX - gridW / 2,
    originY: offsetY + gridH / 2,
  };
}

/** Computes a centered layout for a cols x rows grid occupying `sizeMm` on its longest side. */
export function computeReliefLayout(
  cols: number,
  rows: number,
  sizeMm: number,
  offsetX: number,
  offsetY: number,
): ReliefLayout {
  return layoutFromModuleSize(cols, rows, sizeMm / Math.max(cols, rows), offsetX, offsetY);
}

/** Computes a centered layout for a cols x rows grid whose physical height is `heightMm`. */
export function computeReliefLayoutByHeight(
  cols: number,
  rows: number,
  heightMm: number,
  offsetX: number,
  offsetY: number,
): ReliefLayout {
  return layoutFromModuleSize(cols, rows, heightMm / rows, offsetX, offsetY);
}

/** Rotates a relief geometry in-place (around the Z/thickness axis) about its anchor point. */
export function rotateReliefGeometry(
  geometry: THREE.BufferGeometry,
  degrees: number,
  aboutX: number,
  aboutY: number,
): THREE.BufferGeometry {
  if (!degrees) return geometry;
  const rad = (degrees * Math.PI) / 180;
  geometry.translate(-aboutX, -aboutY, 0);
  geometry.rotateZ(rad);
  geometry.translate(aboutX, aboutY, 0);
  return geometry;
}

const EMBED = 0.2; // mm, extra overlap driven into the base plate for a strong bond
const POKE = 0.2; // mm, extra depth an engraving cutter pokes above the surface

/**
 * Computes the Z span (depth + center) a piece of relief material should occupy, shared
 * by every relief geometry builder (box-grid raster and SVG vector extrusion alike) so
 * raised/engraved pieces bond and cut the same way regardless of how they were shaped.
 */
export function reliefZPlacement(
  height: number,
  zTop: number,
  mode: ReliefMode,
  thickness: number,
): { boxDepth: number; zCenter: number } {
  const embed = Math.min(EMBED, thickness * 0.5);
  const boxDepth = mode === 'raised' ? height + embed : height + POKE;
  const zCenter = mode === 'raised' ? zTop - embed / 2 + height / 2 : zTop - height / 2 + POKE / 2;
  return { boxDepth, zCenter };
}

interface Rect {
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
}

/**
 * Greedily decomposes the filled cells of a grid into as few axis-aligned rectangles
 * as possible (merge horizontal runs, then extend them downward while the row below
 * repeats the same run). This is what keeps QR/text/logo relief cheap to build and
 * export: a solid block (a QR finder square, a letter's stem) becomes one box instead
 * of dozens of unit boxes, which is what CSG and the 3MF/STL writers actually pay for.
 */
function computeRectangles(cols: number, rows: number, cells: boolean[]): Rect[] {
  const consumed = new Array<boolean>(cols * rows).fill(false);
  const rects: Rect[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      if (!cells[idx] || consumed[idx]) continue;

      let colSpan = 1;
      while (c + colSpan < cols && cells[r * cols + c + colSpan] && !consumed[r * cols + c + colSpan]) {
        colSpan++;
      }

      let rowSpan = 1;
      rowGrowth: while (r + rowSpan < rows) {
        for (let cc = 0; cc < colSpan; cc++) {
          const below = (r + rowSpan) * cols + c + cc;
          if (!cells[below] || consumed[below]) break rowGrowth;
        }
        rowSpan++;
      }

      for (let rr = 0; rr < rowSpan; rr++) {
        for (let cc = 0; cc < colSpan; cc++) {
          consumed[(r + rr) * cols + c + cc] = true;
        }
      }
      rects.push({ col: c, row: r, colSpan, rowSpan });
    }
  }

  return rects;
}

/**
 * Builds a merged box-grid geometry for the given relief cells.
 * `mode` = 'raised' returns material to be unioned onto the plate.
 * `mode` = 'engraved' returns a cutter volume to be boolean-subtracted from the plate.
 */
export function buildReliefGeometry(
  grid: ReliefGrid,
  layout: ReliefLayout,
  height: number,
  zTop: number,
  mode: ReliefMode,
  thickness: number,
): THREE.BufferGeometry | null {
  const { cols, rows, cells } = grid;
  const { moduleSize, originX, originY } = layout;
  if (cols === 0 || rows === 0 || height <= 0) return null;

  const { boxDepth, zCenter } = reliefZPlacement(height, zTop, mode, thickness);

  const rects = computeRectangles(cols, rows, cells);
  if (rects.length === 0) return null;

  const boxes: THREE.BufferGeometry[] = [];
  for (const rect of rects) {
    const w = rect.colSpan * moduleSize;
    const h = rect.rowSpan * moduleSize;
    const x = originX + (rect.col + rect.colSpan / 2) * moduleSize;
    const y = originY - (rect.row + rect.rowSpan / 2) * moduleSize;
    const g = new THREE.BoxGeometry(w, h, boxDepth);
    g.translate(x, y, zCenter);
    boxes.push(g);
  }

  const merged = mergeGeometries(boxes, false);
  boxes.forEach((b) => b.dispose());
  // Match the (non-indexed) attribute layout produced by ExtrudeGeometry for the plate,
  // so this can later be merged with it via BufferGeometryUtils.mergeGeometries.
  const nonIndexed = merged.toNonIndexed();
  merged.dispose();
  return nonIndexed;
}
