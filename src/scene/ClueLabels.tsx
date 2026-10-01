import { useMemo } from 'react';
import * as THREE from 'three';
import { Cell, clueShape, isInSlice } from '../game/grid';
import { usePuzzleStore } from '../game/puzzleStore';
import { clueMaterial } from './materials';
import { cubePosition } from './layout';
import { FACINGS, facingRotation, useFacingView } from './facings';

/**
 * Clues live on the outside of the block, so a number rides on whichever cube is
 * currently frontmost in its line — chip that cube away, or slice it out of
 * view, and the number steps inward onto the next one.
 */
export function ClueLabels() {
  const puzzle = usePuzzleStore((s) => s.puzzle);
  const cells = usePuzzleStore((s) => s.cells);
  const lines = usePuzzleStore((s) => s.lines);
  const solved = usePuzzleStore((s) => s.solved);
  const slice = usePuzzleStore((s) => s.slice);

  const view = useFacingView();
  const geometry = useMemo(() => new THREE.PlaneGeometry(0.8, 0.8), []);

  const labels = useMemo(() => {
    if (!puzzle || solved) return [];
    const out: {
      key: string;
      position: [number, number, number];
      rotation: THREE.Euler;
      count: number;
      shape: ReturnType<typeof clueShape>;
      resolved: boolean;
    }[] = [];

    for (const fi of view.visible) {
      const facing = FACINGS[fi];
      for (const info of lines) {
        if (info.line.axis !== facing.axis) continue;

        const ordered = facing.dir === 1 ? [...info.cells].reverse() : info.cells;
        const front = ordered.find(
          (i) => cells[i] !== Cell.Broken && isInSlice(puzzle.size, slice, i),
        );
        if (front === undefined) continue;

        const base = cubePosition(puzzle.size, front);
        out.push({
          key: `${fi}:${info.line.a}:${info.line.b}`,
          position: [
            base[0] + facing.normal[0] * 0.52,
            base[1] + facing.normal[1] * 0.52,
            base[2] + facing.normal[2] * 0.52,
          ],
          rotation: facingRotation(facing, view.spinSteps),
          count: info.clue.count,
          shape: clueShape(info.clue),
          resolved: info.cells.every((i) => cells[i] !== Cell.Unknown),
        });
      }
    }
    return out;
  }, [puzzle, lines, cells, view, solved, slice]);

  if (!puzzle) return null;

  return (
    <group>
      {labels.map((l) => (
        <mesh
          key={l.key}
          geometry={geometry}
          material={clueMaterial(l.count, l.shape, l.resolved)}
          position={l.position}
          rotation={l.rotation}
          renderOrder={1}
          raycast={() => null}
        />
      ))}
    </group>
  );
}
