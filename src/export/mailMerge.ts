import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { exportTo3MF } from 'three-3mf-exporter';
import JSZip from 'jszip';
import type { KeychainConfig } from '../types';
import { buildKeychainGeometry, buildKeychainPieces, type KeychainInputs } from '../geometry/buildKeychain';
import { buildQRGrid } from '../geometry/buildQR';
import { buildTextGrid } from '../geometry/buildText';
import { collectGrids } from '../geometry/collectGrids';
import { shapeBounds } from '../geometry/shapeOutline';
import { buildPrintJobConfig } from './printProfile';
import { downloadBlob } from '../utils/download';

export type MailMergeFormat = 'stl' | '3mf';

export interface MailMergeMapping {
  qr: string | null;
  text1: string | null;
  text2: string | null;
  text3: string | null;
}

export interface MailMergeRow {
  qr: string | null;
  text1: string | null;
  text2: string | null;
  text3: string | null;
}

export const EMPTY_MAPPING: MailMergeMapping = { qr: null, text1: null, text2: null, text3: null };

/** Turns parsed CSV rows into per-person overrides according to the column mapping. */
export function buildMailMergeRows(
  headers: string[],
  csvRows: string[][],
  mapping: MailMergeMapping,
): MailMergeRow[] {
  const indexOf = (col: string | null) => (col === null ? -1 : headers.indexOf(col));
  const qrIdx = indexOf(mapping.qr);
  const t1Idx = indexOf(mapping.text1);
  const t2Idx = indexOf(mapping.text2);
  const t3Idx = indexOf(mapping.text3);

  return csvRows.map((r) => ({
    qr: qrIdx >= 0 ? (r[qrIdx] ?? '') : null,
    text1: t1Idx >= 0 ? (r[t1Idx] ?? '') : null,
    text2: t2Idx >= 0 ? (r[t2Idx] ?? '') : null,
    text3: t3Idx >= 0 ? (r[t3Idx] ?? '') : null,
  }));
}

function applyRow(template: KeychainConfig, row: MailMergeRow): KeychainConfig {
  const cfg = { ...template };
  if (row.qr !== null) cfg.qr = { ...template.qr, text: row.qr, enabled: true };
  if (row.text1 !== null) cfg.text1 = { ...template.text1, text: row.text1, enabled: true };
  if (row.text2 !== null) cfg.text2 = { ...template.text2, text: row.text2, enabled: true };
  if (row.text3 !== null) cfg.text3 = { ...template.text3, text: row.text3, enabled: true };
  return cfg;
}

async function buildPersonGrids(
  personCfg: KeychainConfig,
  row: MailMergeRow,
  shared: KeychainInputs,
): Promise<KeychainInputs> {
  return {
    qrGrid: row.qr !== null ? buildQRGrid(personCfg.qr) : shared.qrGrid,
    logoGrid: shared.logoGrid,
    text1Grid: row.text1 !== null ? await buildTextGrid(personCfg.text1) : shared.text1Grid,
    text2Grid: row.text2 !== null ? await buildTextGrid(personCfg.text2) : shared.text2Grid,
    text3Grid: row.text3 !== null ? await buildTextGrid(personCfg.text3) : shared.text3Grid,
  };
}

function slug(s: string): string {
  const cleaned = s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || 'item';
}

function filenameFor(row: MailMergeRow, index: number): string {
  const base = row.text3 || row.text2 || row.text1 || row.qr || `item_${index + 1}`;
  return slug(base);
}

function geometryToMesh(geom: THREE.BufferGeometry): THREE.Mesh {
  return new THREE.Mesh(geom, new THREE.MeshStandardMaterial());
}

function yieldToUI(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export type ProgressCallback = (done: number, total: number) => void;

/** Exports one STL or 3MF file per CSV row, all bundled in a single ZIP. */
export async function exportMailMergeIndividual(
  template: KeychainConfig,
  rows: MailMergeRow[],
  format: MailMergeFormat,
  onProgress?: ProgressCallback,
): Promise<void> {
  const shared = await collectGrids(template);
  const zip = new JSZip();
  const usedNames = new Set<string>();
  const stlExporter = format === 'stl' ? new STLExporter() : null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cfg = applyRow(template, row);
    const grids = await buildPersonGrids(cfg, row, shared);

    let name = filenameFor(row, i);
    if (usedNames.has(name)) name = `${name}_${i + 1}`;
    usedNames.add(name);

    if (format === 'stl' && stlExporter) {
      const geom = buildKeychainGeometry(cfg, grids);
      const stl = stlExporter.parse(geometryToMesh(geom), { binary: true });
      zip.file(`${name}.stl`, stl.buffer as ArrayBuffer);
      geom.dispose();
    } else {
      const pieces = buildKeychainPieces(cfg, grids);
      const group = new THREE.Group();
      for (const piece of pieces) {
        const mesh = new THREE.Mesh(piece.geometry, new THREE.MeshStandardMaterial({ color: piece.color }));
        mesh.name = piece.label;
        group.add(mesh);
      }
      const blob = await exportTo3MF(group, buildPrintJobConfig(template.export.printProfile));
      zip.file(`${name}.3mf`, blob);
      pieces.forEach((p) => p.geometry.dispose());
    }

    onProgress?.(i + 1, rows.length);
    await yieldToUI();
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(blob, `publipostage_${format}_${rows.length}.zip`);
}

function cellOffset(
  index: number,
  cols: number,
  rowsInPlate: number,
  cellW: number,
  cellH: number,
): { x: number; y: number } {
  const col = index % cols;
  const row = Math.floor(index / cols);
  return {
    x: (col - (cols - 1) / 2) * cellW,
    y: ((rowsInPlate - 1) / 2 - row) * cellH,
  };
}

/**
 * Exports one file per "plate" (as many CSV rows as fit on the given bed size, tiled in
 * a grid), bundled in a ZIP. For 3MF, same-role pieces (all bases, all QR codes, ...)
 * across every person on a plate are merged into one colored object each, since they
 * all share the same template color — keeping the object count manageable.
 */
export async function exportMailMergePlated(
  template: KeychainConfig,
  rows: MailMergeRow[],
  format: MailMergeFormat,
  bedWidth: number,
  bedDepth: number,
  spacing: number,
  onProgress?: ProgressCallback,
): Promise<void> {
  const shared = await collectGrids(template);
  const bounds = shapeBounds(template.shape);
  const cellW = bounds.width + spacing;
  const cellH = bounds.height + spacing;
  const cols = Math.max(1, Math.floor((bedWidth + spacing) / cellW));
  const rowsPerPlate = Math.max(1, Math.floor((bedDepth + spacing) / cellH));
  const perPlate = cols * rowsPerPlate;
  const numPlates = Math.max(1, Math.ceil(rows.length / perPlate));

  const zip = new JSZip();
  const stlExporter = format === 'stl' ? new STLExporter() : null;
  let done = 0;

  for (let plateIdx = 0; plateIdx < numPlates; plateIdx++) {
    const plateRows = rows.slice(plateIdx * perPlate, (plateIdx + 1) * perPlate);
    const rowsInThisPlate = Math.max(1, Math.ceil(plateRows.length / cols));

    if (format === 'stl' && stlExporter) {
      const geoms: THREE.BufferGeometry[] = [];
      for (let i = 0; i < plateRows.length; i++) {
        const row = plateRows[i];
        const cfg = applyRow(template, row);
        const grids = await buildPersonGrids(cfg, row, shared);
        const geom = buildKeychainGeometry(cfg, grids);
        const { x, y } = cellOffset(i, cols, rowsInThisPlate, cellW, cellH);
        geom.translate(x, y, 0);
        geoms.push(geom);
        done++;
        onProgress?.(done, rows.length);
        await yieldToUI();
      }
      const merged = geoms.length === 1 ? geoms[0] : mergeGeometries(geoms, false);
      const stl = stlExporter.parse(geometryToMesh(merged), { binary: true });
      zip.file(`plateau_${plateIdx + 1}.stl`, stl.buffer as ArrayBuffer);
      geoms.forEach((g) => g.dispose());
    } else {
      const buckets = new Map<string, { label: string; color: string; parts: THREE.BufferGeometry[] }>();
      for (let i = 0; i < plateRows.length; i++) {
        const row = plateRows[i];
        const cfg = applyRow(template, row);
        const grids = await buildPersonGrids(cfg, row, shared);
        const pieces = buildKeychainPieces(cfg, grids);
        const { x, y } = cellOffset(i, cols, rowsInThisPlate, cellW, cellH);
        for (const piece of pieces) {
          piece.geometry.translate(x, y, 0);
          let bucket = buckets.get(piece.id);
          if (!bucket) {
            bucket = { label: piece.label, color: piece.color, parts: [] };
            buckets.set(piece.id, bucket);
          }
          bucket.parts.push(piece.geometry);
        }
        done++;
        onProgress?.(done, rows.length);
        await yieldToUI();
      }
      const group = new THREE.Group();
      for (const bucket of buckets.values()) {
        const merged = bucket.parts.length === 1 ? bucket.parts[0] : mergeGeometries(bucket.parts, false);
        const mesh = new THREE.Mesh(merged, new THREE.MeshStandardMaterial({ color: bucket.color }));
        mesh.name = bucket.label;
        group.add(mesh);
        bucket.parts.forEach((p) => p.dispose());
      }
      const blob = await exportTo3MF(group, buildPrintJobConfig(template.export.printProfile, bedWidth, bedDepth));
      zip.file(`plateau_${plateIdx + 1}.3mf`, blob);
    }
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(blob, `publipostage_plateaux_${format}_${numPlates}.zip`);
}

/** How many plates a batch would need for the given bed size — used to preview before exporting. */
export function estimatePlates(
  template: KeychainConfig,
  count: number,
  bedWidth: number,
  bedDepth: number,
  spacing: number,
): { cols: number; rowsPerPlate: number; perPlate: number; plates: number } {
  const bounds = shapeBounds(template.shape);
  const cellW = bounds.width + spacing;
  const cellH = bounds.height + spacing;
  const cols = Math.max(1, Math.floor((bedWidth + spacing) / cellW));
  const rowsPerPlate = Math.max(1, Math.floor((bedDepth + spacing) / cellH));
  const perPlate = cols * rowsPerPlate;
  return { cols, rowsPerPlate, perPlate, plates: Math.max(1, Math.ceil(count / perPlate)) };
}
