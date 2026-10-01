export type Size = readonly [number, number, number];

/** 0 = x, 1 = y, 2 = z. A line runs parallel to its axis. */
export type Axis = 0 | 1 | 2;

export const AXES: readonly Axis[] = [0, 1, 2];

export interface Clue {
  /** How many cubes of this line belong to the finished sculpture. */
  count: number;
  /** How many contiguous runs those cubes form. 0 when count is 0. */
  groups: number;
}

/** Identifies one line of the block. `a`/`b` are the two coordinates the line holds fixed. */
export interface LineId {
  axis: Axis;
  a: number;
  b: number;
}

export const Cell = {
  Unknown: 0,
  /** Player marked it as part of the sculpture. */
  Marked: 1,
  /** Player chipped it away. */
  Broken: 2,
} as const;

export type CellState = (typeof Cell)[keyof typeof Cell];

export function cellIndex(size: Size, x: number, y: number, z: number): number {
  return x + size[0] * (y + size[1] * z);
}

export function cellCoords(size: Size, index: number): [number, number, number] {
  const x = index % size[0];
  const y = Math.floor(index / size[0]) % size[1];
  const z = Math.floor(index / (size[0] * size[1]));
  return [x, y, z];
}

export function cellCount(size: Size): number {
  return size[0] * size[1] * size[2];
}

/**
 * Isolates a single plate of the block so the player can see and work on cubes
 * buried inside it. Pure view state — it never affects clues or the win check.
 */
export interface Slice {
  axis: Axis;
  layer: number;
}

export function isInSlice(size: Size, slice: Slice | null, index: number): boolean {
  if (!slice) return true;
  return cellCoords(size, index)[slice.axis] === slice.layer;
}

/** The two axes a line of `axis` holds fixed, in the order its `a`/`b` coordinates use. */
export function fixedAxes(axis: Axis): [Axis, Axis] {
  if (axis === 0) return [1, 2];
  if (axis === 1) return [0, 2];
  return [0, 1];
}

export function lineLength(size: Size, axis: Axis): number {
  return size[axis];
}

/** Cell indices along a line, ordered by increasing coordinate on `axis`. */
export function lineCells(size: Size, line: LineId): number[] {
  const [fa, fb] = fixedAxes(line.axis);
  const coords: [number, number, number] = [0, 0, 0];
  coords[fa] = line.a;
  coords[fb] = line.b;
  const out: number[] = [];
  for (let i = 0; i < size[line.axis]; i++) {
    coords[line.axis] = i;
    out.push(cellIndex(size, coords[0], coords[1], coords[2]));
  }
  return out;
}

/** Every line of the block, grouped by axis. */
export function allLines(size: Size): LineId[] {
  const out: LineId[] = [];
  for (const axis of AXES) {
    const [fa, fb] = fixedAxes(axis);
    for (let a = 0; a < size[fa]; a++) {
      for (let b = 0; b < size[fb]; b++) {
        out.push({ axis, a, b });
      }
    }
  }
  return out;
}

export function clueFromValues(values: boolean[]): Clue {
  let count = 0;
  let groups = 0;
  let prev = false;
  for (const v of values) {
    if (v) {
      count++;
      if (!prev) groups++;
    }
    prev = v;
  }
  return { count, groups };
}

export function clueForLine(size: Size, solution: boolean[], line: LineId): Clue {
  return clueFromValues(lineCells(size, line).map((i) => solution[i]));
}

/**
 * Picross-style clue decoration: a lone run needs no mark, two runs get a circle,
 * three or more get a square. Mirrors the notation players already know.
 */
export type ClueShape = 'plain' | 'circle' | 'square';

export function clueShape(clue: Clue): ClueShape {
  if (clue.groups >= 3) return 'square';
  if (clue.groups === 2) return 'circle';
  return 'plain';
}

/** A line is done once none of its cubes are still undecided. */
export function isLineResolved(cells: Uint8Array, size: Size, line: LineId): boolean {
  return lineCells(size, line).every((i) => cells[i] !== Cell.Unknown);
}

/** The puzzle is won once every cube outside the sculpture has been chipped away. */
export function isSolved(cells: Uint8Array, solution: boolean[]): boolean {
  for (let i = 0; i < solution.length; i++) {
    if (!solution[i] && cells[i] !== Cell.Broken) return false;
  }
  return true;
}

export function remainingToBreak(cells: Uint8Array, solution: boolean[]): number {
  let n = 0;
  for (let i = 0; i < solution.length; i++) {
    if (!solution[i] && cells[i] !== Cell.Broken) n++;
  }
  return n;
}

/** Cube is still physically present in the block (not chipped away). */
export function isPresent(cells: Uint8Array, index: number): boolean {
  return cells[index] !== Cell.Broken;
}

// ---------------------------------------------------------------------------
// Solvability
// ---------------------------------------------------------------------------

/** Every arrangement of `length` cells matching the clue. Cached — lines are short. */
const arrangementCache = new Map<string, boolean[][]>();

export function arrangements(length: number, clue: Clue): boolean[][] {
  const key = `${length}:${clue.count}:${clue.groups}`;
  const hit = arrangementCache.get(key);
  if (hit) return hit;

  const out: boolean[][] = [];
  const total = 1 << length;
  for (let mask = 0; mask < total; mask++) {
    const values: boolean[] = [];
    for (let i = 0; i < length; i++) values.push((mask & (1 << i)) !== 0);
    const c = clueFromValues(values);
    if (c.count === clue.count && c.groups === clue.groups) out.push(values);
  }
  arrangementCache.set(key, out);
  return out;
}

export type SolveResult =
  | { status: 'unique' }
  /** Single-line deduction stalls before the block is fully determined. */
  | { status: 'ambiguous'; undetermined: number }
  /** Clues contradict each other — the puzzle data is broken. */
  | { status: 'contradiction'; line: LineId };

/**
 * Checks the puzzle can be reasoned out one line at a time, the way a player does:
 * repeatedly intersect every arrangement a line still allows, until nothing new
 * is learned. If that fully determines the block, the puzzle is fair.
 */
export function analyzeSolvability(size: Size, solution: boolean[]): SolveResult {
  const lines = allLines(size);
  const clues = lines.map((line) => clueForLine(size, solution, line));
  // 0 = unknown, 1 = definitely filled, 2 = definitely empty
  const known = new Uint8Array(cellCount(size));

  let changed = true;
  while (changed) {
    changed = false;
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      const cells = lineCells(size, line);
      if (cells.every((i) => known[i] !== 0)) continue;

      const options = arrangements(cells.length, clues[li]).filter((opt) =>
        opt.every((v, i) => {
          const k = known[cells[i]];
          return k === 0 || (k === 1) === v;
        }),
      );
      if (options.length === 0) return { status: 'contradiction', line };

      for (let i = 0; i < cells.length; i++) {
        if (known[cells[i]] !== 0) continue;
        const first = options[0][i];
        if (options.every((opt) => opt[i] === first)) {
          known[cells[i]] = first ? 1 : 2;
          changed = true;
        }
      }
    }
  }

  let undetermined = 0;
  for (let i = 0; i < known.length; i++) if (known[i] === 0) undetermined++;
  return undetermined === 0 ? { status: 'unique' } : { status: 'ambiguous', undetermined };
}
