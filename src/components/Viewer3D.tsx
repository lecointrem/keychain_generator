import { Canvas } from '@react-three/fiber';
import { Grid, OrbitControls, Center } from '@react-three/drei';
import * as THREE from 'three';
import { KeychainMesh } from './KeychainMesh';

interface Props {
  geometry: THREE.BufferGeometry | null;
  color: string;
  error: string | null;
}

export function Viewer3D({ geometry, color, error }: Props) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Canvas
        shadows
        camera={{ position: [60, 55, 70], fov: 40, near: 0.1, far: 2000 }}
        dpr={[1, 2]}
      >
        <color attach="background" args={['#101116']} />
        <ambientLight intensity={0.6} />
        <directionalLight
          position={[40, 60, 30]}
          intensity={1.2}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
        <directionalLight position={[-30, 20, -40]} intensity={0.35} />
        <hemisphereLight args={['#ffffff', '#40424e', 0.5]} />

        <Center>
          <KeychainMesh geometry={geometry} color={color} />
        </Center>

        <Grid
          position={[0, -0.01, 0]}
          args={[200, 200]}
          cellSize={5}
          cellThickness={0.5}
          sectionSize={50}
          sectionThickness={1}
          sectionColor="#4a4d5c"
          cellColor="#2a2c36"
          fadeDistance={250}
          infiniteGrid
        />

        <OrbitControls makeDefault enableDamping dampingFactor={0.1} minDistance={20} maxDistance={400} />
      </Canvas>

      {error && (
        <div className="viewer-overlay viewer-error">
          Erreur de génération : {error}
        </div>
      )}
      {!geometry && !error && <div className="viewer-overlay">Génération en cours…</div>}
    </div>
  );
}
