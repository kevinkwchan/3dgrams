import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import type { PerspectiveCamera } from 'three';
import type { OrbitControls } from 'three-stdlib';

/** Leaves room around the block for the clue numbers on its outer faces. */
const MARGIN = 1.06;

/**
 * Pulls the camera back far enough that the block fits whichever screen
 * dimension is tighter — without this a tall phone crops the sides off.
 */
export function CameraFit({ radius }: { radius: number }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const controls = useThree((s) => s.controls) as OrbitControls | null;

  useEffect(() => {
    const vFov = (camera.fov * Math.PI) / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
    const distance = (radius * MARGIN) / Math.sin(Math.min(vFov, hFov) / 2);

    camera.position.setLength(distance);
    camera.updateProjectionMatrix();

    if (controls) {
      // OrbitControls is configured imperatively by design; there is no
      // declarative way to re-clamp it and refresh in the same pass.
      // oxlint-disable-next-line react/immutability
      controls.minDistance = distance * 0.5;
      controls.maxDistance = distance * 1.8;
      controls.update();
    }
  }, [camera, controls, radius, size]);

  return null;
}
