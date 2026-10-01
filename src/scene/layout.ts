import type { Size } from '../game/grid';

/** Cube centre in world space, with the whole block centred on the origin. */
export function cubePosition(size: Size, index: number): [number, number, number] {
  const x = index % size[0];
  const y = Math.floor(index / size[0]) % size[1];
  const z = Math.floor(index / (size[0] * size[1]));
  return [x - (size[0] - 1) / 2, y - (size[1] - 1) / 2, z - (size[2] - 1) / 2];
}

export function blockRadius(size: Size): number {
  return Math.hypot(size[0], size[1], size[2]) / 2;
}
