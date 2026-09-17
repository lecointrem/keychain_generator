import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import JSZip from 'jszip';
import type { KeychainConfig } from '../types';
import { buildKeychainGeometry, buildKeychainParts, type KeychainInputs } from '../geometry/buildKeychain';
import { downloadBlob } from '../utils/download';

function geometryToMesh(geom: THREE.BufferGeometry): THREE.Mesh {
  return new THREE.Mesh(geom, new THREE.MeshStandardMaterial());
}

/** Generates the STL (or a ZIP of two STLs for multi-color printing) and triggers a download. */
export async function exportKeychainSTL(config: KeychainConfig, inputs: KeychainInputs) {
  const exporter = new STLExporter();
  const filename = (config.export.filename || 'porte-cle').trim() || 'porte-cle';

  if (config.export.splitParts) {
    const { base, relief } = buildKeychainParts(config, inputs);
    if (relief) {
      const zip = new JSZip();
      const baseSTL = exporter.parse(geometryToMesh(base), { binary: true });
      const reliefSTL = exporter.parse(geometryToMesh(relief), { binary: true });
      zip.file(`${filename}_base.stl`, baseSTL.buffer as ArrayBuffer);
      zip.file(`${filename}_relief.stl`, reliefSTL.buffer as ArrayBuffer);
      const blob = await zip.generateAsync({ type: 'blob' });
      downloadBlob(blob, `${filename}.zip`);
      return;
    }
  }

  const full = buildKeychainGeometry(config, inputs);
  const stl = exporter.parse(geometryToMesh(full), { binary: true });
  downloadBlob(new Blob([stl.buffer as ArrayBuffer], { type: 'model/stl' }), `${filename}.stl`);
}
