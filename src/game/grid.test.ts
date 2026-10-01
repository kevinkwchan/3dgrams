import { describe, expect, it } from 'vitest';
import {
  AXES, Cell, allLines, analyzeSolvability, cellCoords, cellCount, cellIndex,
  clueForLine, clueFromValues, clueShape, isInSlice, isLineResolved, isSolved,
  lineCells, type Size,
} from './grid';
import { PUZZLES } from '../puzzles/catalog';

const SIZE: Size = [3, 4, 2];

describe('indexing', () => {
  it('round-trips coordinates', () => {
    for (let z = 0; z < SIZE[2]; z++)
      for (let y = 0; y < SIZE[1]; y++)
        for (let x = 0; x < SIZE[0]; x++)
          expect(cellCoords(SIZE, cellIndex(SIZE, x, y, z))).toEqual([x, y, z]);
  });
});

describe('clueFromValues', () => {
  it('counts an empty line as zero groups', () => {
    expect(clueFromValues([false, false, false])).toEqual({ count: 0, groups: 0 });
  });

  it('treats a solid run as one group', () => {
    expect(clueFromValues([true, true, true])).toEqual({ count: 3, groups: 1 });
  });

  it('splits runs separated by gaps', () => {
    expect(clueFromValues([true, false, true, true])).toEqual({ count: 3, groups: 2 });
    expect(clueFromValues([true, false, true, false, true])).toEqual({ count: 3, groups: 3 });
  });

  it('counts runs touching either end', () => {
    expect(clueFromValues([false, true, true, false])).toEqual({ count: 2, groups: 1 });
  });
});

describe('clueShape', () => {
  it('marks two runs with a circle and three or more with a square', () => {
    expect(clueShape({ count: 0, groups: 0 })).toBe('plain');
    expect(clueShape({ count: 4, groups: 1 })).toBe('plain');
    expect(clueShape({ count: 3, groups: 2 })).toBe('circle');
    expect(clueShape({ count: 3, groups: 3 })).toBe('square');
  });
});

describe('lines', () => {
  it('covers every cell exactly once per axis', () => {
    const lines = allLines(SIZE);
    for (const axis of [0, 1, 2] as const) {
      const seen = new Set<number>();
      for (const line of lines.filter((l) => l.axis === axis)) {
        for (const i of lineCells(SIZE, line)) {
          expect(seen.has(i)).toBe(false);
          seen.add(i);
        }
      }
      expect(seen.size).toBe(SIZE[0] * SIZE[1] * SIZE[2]);
    }
  });

  it('orders cells along the line axis', () => {
    const cells = lineCells(SIZE, { axis: 1, a: 1, b: 0 });
    expect(cells.map((i) => cellCoords(SIZE, i)[1])).toEqual([0, 1, 2, 3]);
  });

  it('reads a clue from the solution along the line', () => {
    const solution = new Array(24).fill(false);
    solution[cellIndex(SIZE, 0, 0, 0)] = true;
    solution[cellIndex(SIZE, 2, 0, 0)] = true;
    expect(clueForLine(SIZE, solution, { axis: 0, a: 0, b: 0 })).toEqual({ count: 2, groups: 2 });
  });
});

describe('completion', () => {
  const size: Size = [2, 1, 1];
  const solution = [true, false];

  it('needs every non-sculpture cube broken, and nothing more', () => {
    const cells = new Uint8Array([Cell.Unknown, Cell.Unknown]);
    expect(isSolved(cells, solution)).toBe(false);

    cells[1] = Cell.Broken;
    expect(isSolved(cells, solution)).toBe(true);
  });

  it('does not count a marked cube as broken', () => {
    expect(isSolved(new Uint8Array([Cell.Marked, Cell.Marked]), solution)).toBe(false);
  });

  it('resolves a line only once no cube in it is unknown', () => {
    const line = { axis: 0, a: 0, b: 0 } as const;
    expect(isLineResolved(new Uint8Array([Cell.Marked, Cell.Unknown]), size, line)).toBe(false);
    expect(isLineResolved(new Uint8Array([Cell.Marked, Cell.Broken]), size, line)).toBe(true);
  });
});

describe('isInSlice', () => {
  const all = Array.from({ length: cellCount(SIZE) }, (_, i) => i);

  it('shows the whole block when nothing is sliced', () => {
    expect(all.every((i) => isInSlice(SIZE, null, i))).toBe(true);
  });

  it('keeps exactly one plate, on every axis', () => {
    for (const axis of AXES) {
      const kept = all.filter((i) => isInSlice(SIZE, { axis, layer: 1 }, i));
      const [other, another] = AXES.filter((a) => a !== axis);
      expect(kept.length).toBe(SIZE[other] * SIZE[another]);
      expect(kept.every((i) => cellCoords(SIZE, i)[axis] === 1)).toBe(true);
    }
  });

  it('keeps the plates at both ends of an axis', () => {
    for (const layer of [0, SIZE[1] - 1]) {
      const kept = all.filter((i) => isInSlice(SIZE, { axis: 1, layer }, i));
      expect(kept.every((i) => cellCoords(SIZE, i)[1] === layer)).toBe(true);
      expect(kept.length).toBe(SIZE[0] * SIZE[2]);
    }
  });

  it('partitions the block across all layers of an axis', () => {
    const counted = new Set<number>();
    for (let layer = 0; layer < SIZE[2]; layer++) {
      for (const i of all) if (isInSlice(SIZE, { axis: 2, layer }, i)) counted.add(i);
    }
    expect(counted.size).toBe(all.length);
  });
});

describe('analyzeSolvability', () => {
  it('accepts a block that is entirely solid', () => {
    expect(analyzeSolvability([2, 2, 2], new Array(8).fill(true)).status).toBe('unique');
  });

  it('accepts a block that is entirely empty', () => {
    expect(analyzeSolvability([2, 2, 2], new Array(8).fill(false)).status).toBe('unique');
  });

  it('rejects a shape whose clues allow two different sculptures', () => {
    // Alternating corners of a 2x2x2 block. Every line holds exactly one cube
    // either way, so the four opposite corners are an equally valid answer.
    const size: Size = [2, 2, 2];
    const solution = [true, false, false, true, false, true, true, false];
    expect(analyzeSolvability(size, solution).status).toBe('ambiguous');
  });

  it('keeps every shipped puzzle fair', () => {
    for (const puzzle of PUZZLES) {
      expect(
        `${puzzle.id}: ${analyzeSolvability(puzzle.size, puzzle.solution).status}`,
      ).toBe(`${puzzle.id}: unique`);
    }
  });
});
