import { useRef, useState } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { OrbitControls } from 'three-stdlib';
import type { Axis } from '../game/grid';
import { usePuzzleStore } from '../game/puzzleStore';
import { blockMaterial, cubeGeometry } from './materials';
import { FACINGS, useFacingView } from './facings';

/** How far outside the block's edge a grip floats, in cube widths. */
const EDGE_OUT = 1.5;
/** Dragged this far past the outermost layer, the slice lets go entirely. */
const RELEASE_MARGIN = 1.4;
/**
 * Pointer target for a grip. Kept close to the visible peg: a grip that
 * over-reaches steals taps aimed at the cubes behind it.
 */
const GRAB_RADIUS = 0.6;

const AXIS_UNIT: Record<Axis, THREE.Vector3> = {
  0: new THREE.Vector3(1, 0, 0),
  1: new THREE.Vector3(0, 1, 0),
  2: new THREE.Vector3(0, 0, 1),
};

/**
 * Which axis a grip is pushed out along to clear the block. Each axis picks a
 * different one, so the three grips sit on three different sides instead of
 * piling up on the near corner and hiding clues.
 */
const OFFSET_AXIS: Record<Axis, Axis> = { 0: 2, 1: 0, 2: 1 };

/**
 * Signed distance along `dir` from `lineOrigin` to the point on that line
 * closest to `ray`. Solving in 3D makes the grip track the pointer exactly at
 * any camera angle, with no pixels-per-unit factor to drift out of date.
 */
function rayToLineDistance(
  ray: THREE.Ray,
  lineOrigin: THREE.Vector3,
  dir: THREE.Vector3,
): number | null {
  const w0 = lineOrigin.clone().sub(ray.origin);
  const a = dir.dot(dir);
  const b = dir.dot(ray.direction);
  const c = ray.direction.dot(ray.direction);
  const d = dir.dot(w0);
  const e = ray.direction.dot(w0);
  const denom = a * c - b * b;
  // Near zero when sighting straight down the axis; there is no useful answer.
  if (Math.abs(denom) < 1e-6) return null;
  return (b * e - c * d) / denom;
}

export function SliceHandles() {
  const puzzle = usePuzzleStore((s) => s.puzzle);
  const solved = usePuzzleStore((s) => s.solved);
  const slice = usePuzzleStore((s) => s.slice);
  const setSlice = usePuzzleStore((s) => s.setSlice);

  const controls = useThree((s) => s.controls) as OrbitControls | null;
  const view = useFacingView();
  const [dragging, setDragging] = useState<Axis | null>(null);
  const [hovered, setHovered] = useState<Axis | null>(null);
  const active = useRef<Axis | null>(null);

  if (!puzzle || solved) return null;

  const size = puzzle.size;
  const halfOf = (axis: Axis) => (size[axis] - 1) / 2;

  /** Which end of each axis currently faces the camera. */
  const facingDir = {} as Record<Axis, 1 | -1>;
  for (const i of view.visible) facingDir[FACINGS[i].axis] = FACINGS[i].dir;

  /**
   * A grip rides its own axis but is pushed clear of the block sideways, so it
   * never floats over the plate the player is trying to click.
   */
  function gripPosition(axis: Axis, along: number): THREE.Vector3 {
    const out = OFFSET_AXIS[axis];
    const p = new THREE.Vector3();
    p.setComponent(axis, along);
    p.setComponent(out, (facingDir[out] ?? 1) * (halfOf(out) + EDGE_OUT));
    return p;
  }

  /**
   * Where the grip rests: on its slice layer, or — when that axis isn't
   * sliced — parked just past the block so it never covers a clue.
   */
  function restingAlong(axis: Axis): number {
    if (slice && slice.axis === axis) return slice.layer - halfOf(axis);
    return (facingDir[axis] ?? 1) * (halfOf(axis) + RELEASE_MARGIN);
  }

  const applyDrag = (axis: Axis, event: ThreeEvent<PointerEvent>) => {
    const lineOrigin = gripPosition(axis, 0);
    const along = rayToLineDistance(event.ray, lineOrigin, AXIS_UNIT[axis]);
    if (along === null) return;

    const half = halfOf(axis);
    const dir = facingDir[axis] ?? 1;
    if (dir * along > half + RELEASE_MARGIN) {
      setSlice(null);
      return;
    }
    const layer = Math.min(size[axis] - 1, Math.max(0, Math.round(along + half)));
    setSlice({ axis, layer });
  };

  const onDown = (axis: Axis) => (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    active.current = axis;
    setDragging(axis);
    // OrbitControls listens on the canvas itself, so stopping the R3F event is
    // not enough to keep the camera still underneath the drag.
    if (controls) controls.enabled = false;
    // Deliberately no slice change yet — a plain tap on a grip should sit
    // still rather than snapping the block to some other layer.
  };

  const onMove = (e: ThreeEvent<PointerEvent>) => {
    if (active.current === null) return;
    e.stopPropagation();
    applyDrag(active.current, e);
  };

  const endDrag = () => {
    if (active.current === null) return;
    active.current = null;
    setDragging(null);
    // oxlint-disable-next-line react/immutability -- OrbitControls is configured imperatively.
    if (controls) controls.enabled = true;
  };

  if (import.meta.env.DEV) {
    // Dev-only: the browser smoke test needs somewhere to aim a drag.
    // oxlint-disable-next-line react/immutability -- test scaffolding, stripped from builds.
    (window as unknown as { sliceGrips: Record<number, THREE.Vector3> }).sliceGrips =
      Object.fromEntries(
        view.visible.map((fi) => {
          const axis = FACINGS[fi].axis;
          return [axis, gripPosition(axis, restingAlong(axis))];
        }),
      );
  }

  return (
    <group>
      {view.visible.map((fi) => {
        const axis = FACINGS[fi].axis;
        const position = gripPosition(axis, restingAlong(axis));
        const lit = dragging === axis || hovered === axis;
        // Stretch along the drag direction so the peg reads as a slider.
        const scale = new THREE.Vector3(0.5, 0.5, 0.5).setComponent(axis, 0.78);
        if (lit) scale.multiplyScalar(1.18);

        return (
          <group key={axis} position={position}>
            <mesh
              onPointerDown={onDown(axis)}
              onPointerMove={onMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onPointerLeave={endDrag}
              onPointerOver={() => setHovered(axis)}
              onPointerOut={() => setHovered((cur) => (cur === axis ? null : cur))}
            >
              <sphereGeometry args={[GRAB_RADIUS, 12, 8]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
            <mesh
              geometry={cubeGeometry()}
              material={blockMaterial(lit ? '#7a4d28' : '#a5743f')}
              scale={scale}
              raycast={() => null}
              castShadow
            />
          </group>
        );
      })}
    </group>
  );
}
