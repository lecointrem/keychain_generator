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

/** Computes a centered layout for a cols x rows grid occupying `sizeMm` on its longest side. */
export function computeReliefLayout(
  cols: number,
  rows: number,
  sizeMm: number,
  offsetX: number,
  offsetY: number,
): ReliefLayout {
  const moduleSize = sizeMm / Math.max(cols, rows);
  const gridW = cols * moduleSize;
  const gridH = rows * moduleSize;
  return {
    moduleSize,
    originX: offsetX - gridW / 2,
    originY: offsetY + gridH / 2,
  };
}

const EMBED = 0.2; // mm, extra overlap driven into the base plate for a strong bond
const POKE = 0.2; // mm, extra depth an engraving cutter pokes above the surface

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

  const embed = Math.min(EMBED, thickness * 0.5);
  const boxDepth = mode === 'raised' ? height + embed : height + POKE;
  const zCenter =
    mode === 'raised' ? zTop - embed / 2 + height / 2 : zTop - height / 2 + POKE / 2;

  const boxes: THREE.BufferGeometry[] = [];
  const unitBox = new THREE.BoxGeometry(moduleSize, moduleSize, boxDepth);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!cells[r * cols + c]) continue;
      const x = originX + (c + 0.5) * moduleSize;
      const y = originY - (r + 0.5) * moduleSize;
      const g = unitBox.clone();
      g.translate(x, y, zCenter);
      boxes.push(g);
    }
  }

  unitBox.dispose();
  if (boxes.length === 0) return null;

  const merged = mergeGeometries(boxes, false);
  boxes.forEach((b) => b.dispose());
  // Match the (non-indexed) attribute layout produced by ExtrudeGeometry for the plate,
  // so this can later be merged with it via BufferGeometryUtils.mergeGeometries.
  const nonIndexed = merged.toNonIndexed();
  merged.dispose();
  return nonIndexed;
}
