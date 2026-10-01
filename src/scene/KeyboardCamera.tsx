import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const ORBIT_KEYS: Record<string, [number, number]> = {
  q: [-1, 0],
  e: [1, 0],
  w: [0, 1],
  s: [0, -1],
};

const SPEED = 1.5;
const MAX_POLAR = Math.PI / 2 - 0.08;
const MIN_POLAR = 0.08;

/** Q/E and W/S swing the block around, so the puzzle is playable without a pointer. */
export function KeyboardCamera() {
  const camera = useThree((s) => s.camera);
  const held = useRef(new Set<string>());

  useEffect(() => {
    const isTyping = (t: EventTarget | null) =>
      t instanceof HTMLElement && /^(INPUT|TEXTAREA)$/.test(t.tagName);

    const down = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (!(key in ORBIT_KEYS) || e.metaKey || e.ctrlKey || isTyping(e.target)) return;
      e.preventDefault();
      held.current.add(key);
    };
    const up = (e: KeyboardEvent) => held.current.delete(e.key.toLowerCase());
    const blur = () => held.current.clear();

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);

  useFrame((_, delta) => {
    if (held.current.size === 0) return;
    let az = 0;
    let pol = 0;
    for (const key of held.current) {
      az += ORBIT_KEYS[key][0];
      pol += ORBIT_KEYS[key][1];
    }
    if (az === 0 && pol === 0) return;

    const spherical = new THREE.Spherical().setFromVector3(camera.position);
    spherical.theta += az * SPEED * delta;
    spherical.phi = Math.min(MAX_POLAR, Math.max(MIN_POLAR, spherical.phi - pol * SPEED * delta));
    camera.position.setFromSpherical(spherical);
    camera.lookAt(0, 0, 0);
  });

  return null;
}
