import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Instance, Instances } from '@react-three/drei';
import type * as THREE from 'three';
import { Cell, isInSlice } from '../game/grid';
import { usePuzzleStore } from '../game/puzzleStore';
import { blockMaterial, cubeGeometry } from './materials';
import { cubePosition } from './layout';

/** Past this much pointer travel the gesture is a camera orbit, not a tap. */
const DRAG_SLOP_PX = 8;
const LONG_PRESS_MS = 420;
const SHAKE_MS = 420;
/** Cube-widths the finished sculpture rises, clearing the results card. */
const REVEAL_LIFT = 1.1;

interface Pending {
  index: number;
  x: number;
  y: number;
  moved: boolean;
  handled: boolean;
  timer: number;
}

/**
 * Tinted overlay for hover, the keyboard cursor, and wrong calls. It sits at
 * exactly cube size — scaling it up would make it poke out past the silhouette
 * and read as a second, misaligned cube — and leans on a polygon offset to win
 * the depth test against the face it covers.
 */
function Highlight({
  position, color, opacity, renderOrder,
}: {
  position: [number, number, number];
  color: string;
  opacity: number;
  renderOrder: number;
}) {
  return (
    <mesh position={position} geometry={cubeGeometry()} renderOrder={renderOrder} raycast={() => null}>
      <meshBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-1}
        polygonOffsetUnits={-1}
      />
    </mesh>
  );
}

export function VoxelBlock() {
  const puzzle = usePuzzleStore((s) => s.puzzle);
  const cells = usePuzzleStore((s) => s.cells);
  const solved = usePuzzleStore((s) => s.solved);
  const errorAt = usePuzzleStore((s) => s.errorAt);
  const cursor = usePuzzleStore((s) => s.cursor);
  const slice = usePuzzleStore((s) => s.slice);
  const act = usePuzzleStore((s) => s.act);
  const clearError = usePuzzleStore((s) => s.clearError);

  const pending = useRef<Pending | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const group = useRef<THREE.Group>(null);
  const errorStart = useRef(0);
  const revealStart = useRef(0);

  const geometry = cubeGeometry();

  const positions = useMemo(() => {
    if (!puzzle) return [];
    return Array.from({ length: puzzle.solution.length }, (_, i) => cubePosition(puzzle.size, i));
  }, [puzzle]);

  const groups = useMemo(() => {
    if (!puzzle) return { unknown: [], marked: [], reveal: [] };
    const unknown: number[] = [];
    const marked: number[] = [];
    const reveal: number[] = [];
    for (let i = 0; i < puzzle.solution.length; i++) {
      if (solved) {
        if (puzzle.solution[i]) reveal.push(i);
        continue;
      }
      // Sliced-out cubes simply aren't rendered, which takes them out of
      // raycasting and hover as well — no separate interaction handling needed.
      if (!isInSlice(puzzle.size, slice, i)) continue;
      if (cells[i] === Cell.Unknown) unknown.push(i);
      else if (cells[i] === Cell.Marked) marked.push(i);
    }
    return { unknown, marked, reveal };
  }, [puzzle, cells, solved, slice]);

  useEffect(() => {
    if (errorAt === null) return;
    errorStart.current = performance.now();
    const id = window.setTimeout(clearError, SHAKE_MS);
    return () => window.clearTimeout(id);
  }, [errorAt, clearError]);

  useEffect(() => {
    if (solved) revealStart.current = performance.now();
  }, [solved]);

  // Global listeners so a drag that leaves the cube still cancels the tap.
  useEffect(() => {
    const cancelTimer = () => {
      if (pending.current?.timer) window.clearTimeout(pending.current.timer);
    };
    const onMove = (e: PointerEvent) => {
      const p = pending.current;
      if (!p || p.moved) return;
      if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > DRAG_SLOP_PX) {
        p.moved = true;
        cancelTimer();
      }
    };
    const onUp = () => {
      const p = pending.current;
      pending.current = null;
      if (!p) return;
      cancelTimer();
      if (!p.moved && !p.handled) act(p.index);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [act]);

  const handleDown = (index: number) => (e: ThreeEvent<PointerEvent>) => {
    if (solved) return;
    e.stopPropagation();
    const native = e.nativeEvent;

    // Secondary click is the opposite action, the way it is in most builders.
    if (native.button === 2) {
      act(index, 'mark');
      return;
    }

    const p: Pending = { index, x: native.clientX, y: native.clientY, moved: false, handled: false, timer: 0 };
    if (native.pointerType === 'touch') {
      p.timer = window.setTimeout(() => {
        if (!p.moved) {
          p.handled = true;
          act(index, 'mark');
        }
      }, LONG_PRESS_MS);
    }
    pending.current = p;
  };

  useFrame(() => {
    const node = group.current;
    if (!node) return;

    if (solved) {
      const t = Math.min(1, (performance.now() - revealStart.current) / 700);
      // Settle with a couple of decaying bounces, like the block just popped free.
      node.scale.setScalar(1 + Math.sin(t * Math.PI * 2.4) * 0.09 * (1 - t));
      node.rotation.y = (1 - t) * (1 - t) * 0.45;
      // Float up out of the way of the results card.
      node.position.y = REVEAL_LIFT * t;
    } else {
      node.scale.setScalar(1);
      node.rotation.y = 0;
      node.position.y = 0;
    }

    // The whole block flinches on a wrong call — unmissable without hiding
    // which cube it was.
    if (errorAt !== null) {
      const t = (performance.now() - errorStart.current) / SHAKE_MS;
      node.position.x = Math.sin(t * Math.PI * 9) * 0.12 * Math.max(0, 1 - t);
    } else {
      node.position.x = 0;
    }
  });

  if (!puzzle) return null;

  return (
    <group ref={group}>
      {groups.unknown.length > 0 && (
        <Instances
          key="unknown"
          limit={positions.length}
          geometry={geometry}
          material={blockMaterial(puzzle.palette.wood)}
          castShadow
          receiveShadow
        >
          {groups.unknown.map((i) => (
            <Instance
              key={i}
              position={positions[i]}
              onPointerDown={handleDown(i)}
              onPointerOver={() => setHoverIndex(i)}
              onPointerOut={() => setHoverIndex((cur) => (cur === i ? null : cur))}
            />
          ))}
        </Instances>
      )}

      {groups.marked.length > 0 && (
        <Instances
          key="marked"
          limit={positions.length}
          geometry={geometry}
          material={blockMaterial(puzzle.palette.marked)}
          castShadow
          receiveShadow
        >
          {groups.marked.map((i) => (
            <Instance key={i} position={positions[i]} />
          ))}
        </Instances>
      )}

      {groups.reveal.length > 0 && (
        <Instances
          key="reveal"
          limit={positions.length}
          geometry={geometry}
          material={blockMaterial(puzzle.palette.reveal)}
          castShadow
          receiveShadow
        >
          {groups.reveal.map((i) => (
            <Instance key={i} position={positions[i]} />
          ))}
        </Instances>
      )}

      {errorAt !== null && isInSlice(puzzle.size, slice, errorAt) && (
        <Highlight position={positions[errorAt]} color="#d8483c" opacity={0.78} renderOrder={4} />
      )}

      {!solved && cursor !== null && cells[cursor] === Cell.Unknown
        && isInSlice(puzzle.size, slice, cursor) && (
        <Highlight position={positions[cursor]} color="#4a3524" opacity={0.32} renderOrder={3} />
      )}
      {/* A cube that is chipped or sliced away unmounts without firing
          pointerout, so re-check that it is still there. */}
      {!solved && hoverIndex !== null && hoverIndex !== cursor
        && cells[hoverIndex] === Cell.Unknown && isInSlice(puzzle.size, slice, hoverIndex) && (
        <Highlight position={positions[hoverIndex]} color="#fff6e6" opacity={0.3} renderOrder={2} />
      )}
    </group>
  );
}
