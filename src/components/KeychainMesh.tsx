import * as THREE from 'three';
import { useMemo } from 'react';

interface Props {
  geometry: THREE.BufferGeometry | null;
  color: string;
}

export function KeychainMesh({ geometry, color }: Props) {
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.55,
        metalness: 0.05,
        side: THREE.DoubleSide,
      }),
    [color],
  );

  if (!geometry) return null;

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      <mesh geometry={geometry} material={material} castShadow receiveShadow />
    </group>
  );
}
