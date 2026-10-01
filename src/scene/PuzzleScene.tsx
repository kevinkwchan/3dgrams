import { Suspense, useEffect, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { ContactShadows, OrbitControls } from '@react-three/drei';
import { usePuzzleStore } from '../game/puzzleStore';
import { blockRadius } from './layout';
import { VoxelBlock } from './VoxelBlock';
import { ClueLabels } from './ClueLabels';
import { SliceHandles } from './SliceHandles';
import { KeyboardCamera } from './KeyboardCamera';
import { CameraFit } from './CameraFit';

/** Dev-only: lets the browser smoke test project world points to screen pixels. */
function DevSceneHandle() {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls);
  useEffect(() => {
    (window as unknown as { scene3d: unknown }).scene3d = { camera, controls };
  }, [camera, controls]);
  return null;
}

export function PuzzleScene() {
  const puzzle = usePuzzleStore((s) => s.puzzle);
  const solved = usePuzzleStore((s) => s.solved);

  const radius = puzzle ? blockRadius(puzzle.size) : 4;
  const distance = radius * 3.1;
  const floorY = puzzle ? -puzzle.size[1] / 2 - 0.35 : -3;

  const camera = useMemo(
    () => ({ position: [distance * 0.62, distance * 0.5, distance * 0.62] as [number, number, number], fov: 38 }),
    [distance],
  );

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={camera}
      gl={{ antialias: true, alpha: true }}
      onContextMenu={(e) => e.preventDefault()}
      style={{ touchAction: 'none' }}
    >
      <Suspense fallback={null}>
        <hemisphereLight args={['#fff3dd', '#8a7355', 0.85]} />
        <directionalLight
          position={[6, 9, 5]}
          intensity={2.1}
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-12}
          shadow-camera-right={12}
          shadow-camera-top={12}
          shadow-camera-bottom={-12}
        />
        <directionalLight position={[-7, 3, -5]} intensity={0.5} color="#cfe0ff" />

        <VoxelBlock />
        <ClueLabels />
        <SliceHandles />
        <KeyboardCamera />

        <ContactShadows
          position={[0, floorY, 0]}
          scale={radius * 4}
          blur={2.6}
          opacity={0.38}
          far={radius * 2}
          color="#5a4126"
        />

        <OrbitControls
          makeDefault
          enablePan={false}
          enableDamping
          dampingFactor={0.12}
          rotateSpeed={0.85}
          zoomSpeed={0.7}
          autoRotate={solved}
          autoRotateSpeed={0.9}
        />
        <CameraFit radius={radius} />
        {import.meta.env.DEV && <DevSceneHandle />}
      </Suspense>
    </Canvas>
  );
}
