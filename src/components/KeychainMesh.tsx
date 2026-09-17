import * as THREE from 'three';
import { useMemo } from 'react';
import type { ColoredPiece } from '../geometry/buildKeychain';

interface PieceMeshProps {
  piece: ColoredPiece;
}

function PieceMesh({ piece }: PieceMeshProps) {
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: piece.color,
        roughness: 0.55,
        metalness: 0.05,
        side: THREE.DoubleSide,
      }),
    [piece.color],
  );

  return <mesh geometry={piece.geometry} material={material} castShadow receiveShadow />;
}

interface Props {
  pieces: ColoredPiece[] | null;
}

export function KeychainMesh({ pieces }: Props) {
  if (!pieces) return null;

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      {pieces.map((piece) => (
        <PieceMesh key={piece.id} piece={piece} />
      ))}
    </group>
  );
}
