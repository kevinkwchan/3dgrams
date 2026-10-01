import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Axis } from '../game/grid';

export interface Facing {
  axis: Axis;
  /** +1 looks at the line from its high end, -1 from its low end. */
  dir: 1 | -1;
  normal: [number, number, number];
  tilt: [number, number, number];
  /** Top and bottom faces have no natural "up", so their content follows the camera. */
  spins: boolean;
  /** Extra turn applied when following the camera. */
  spinOffset: number;
}

export const FACINGS: Facing[] = [
  { axis: 0, dir: 1, normal: [1, 0, 0], tilt: [0, Math.PI / 2, 0], spins: false, spinOffset: 0 },
  { axis: 0, dir: -1, normal: [-1, 0, 0], tilt: [0, -Math.PI / 2, 0], spins: false, spinOffset: 0 },
  { axis: 1, dir: 1, normal: [0, 1, 0], tilt: [-Math.PI / 2, 0, 0], spins: true, spinOffset: 0 },
  { axis: 1, dir: -1, normal: [0, -1, 0], tilt: [Math.PI / 2, 0, 0], spins: true, spinOffset: Math.PI },
  { axis: 2, dir: 1, normal: [0, 0, 1], tilt: [0, 0, 0], spins: false, spinOffset: 0 },
  { axis: 2, dir: -1, normal: [0, 0, -1], tilt: [0, Math.PI, 0], spins: false, spinOffset: 0 },
];

/** Eighth turns, so the default corner-on view lands exactly upright. */
export const SPIN_STEP = Math.PI / 4;

export function facingRotation(facing: Facing, steps: number): THREE.Euler {
  const [x, y, z] = facing.tilt;
  if (!facing.spins) return new THREE.Euler(x, y, z);
  // 'YXZ' applies the camera-following spin about world Y *after* the face tilt.
  return new THREE.Euler(x, steps * SPIN_STEP + facing.spinOffset, z, 'YXZ');
}

export interface FacingView {
  /** Indices into `FACINGS` for the three faces currently turned toward the camera. */
  visible: number[];
  spinSteps: number;
}

/**
 * Tracks which faces the camera can see, snapped so it only re-renders when the
 * answer actually changes rather than on every frame of an orbit.
 */
export function useFacingView(): FacingView {
  const [view, setView] = useState<FacingView>({ visible: [0, 2, 4], spinSteps: 0 });
  const lastKey = useRef('');

  useFrame(({ camera }) => {
    const p = camera.position;
    const visible: number[] = [];
    for (let i = 0; i < FACINGS.length; i++) {
      const n = FACINGS[i].normal;
      if (n[0] * p.x + n[1] * p.y + n[2] * p.z > 0) visible.push(i);
    }
    const spinSteps = Math.round(Math.atan2(p.x, p.z) / SPIN_STEP);
    const key = `${visible.join(',')}|${spinSteps}`;
    if (key !== lastKey.current) {
      lastKey.current = key;
      setView({ visible, spinSteps });
    }
  });

  return view;
}
