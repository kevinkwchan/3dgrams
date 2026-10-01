import { create } from 'zustand';
import type { Puzzle } from '../puzzles/catalog';
import * as save from '../persistence/store';
import {
  Cell, allLines, cellCoords, cellCount, cellIndex, clueForLine, isSolved,
  lineCells, remainingToBreak,
  type Axis, type CellState, type Clue, type LineId, type Slice,
} from './grid';

export type Mode = 'chip' | 'mark';

export interface LineInfo {
  line: LineId;
  clue: Clue;
  /** Cell indices ordered along the line's axis. */
  cells: number[];
}

interface Move {
  index: number;
  from: CellState;
  to: CellState;
  wasMistake: boolean;
}

interface PuzzleState {
  puzzle: Puzzle | null;
  lines: LineInfo[];
  cells: Uint8Array;
  history: Move[];
  mistakes: number;
  mode: Mode;
  solved: boolean;
  /** Cube that was just guessed wrong, for the shake animation. */
  errorAt: number | null;
  /** Cube under the keyboard cursor, or null when playing with pointer only. */
  cursor: number | null;
  /** Isolated plate, or null to show the whole block. Never persisted. */
  slice: Slice | null;
  startedAt: number;
  /** Time already banked from previous sessions on this puzzle. */
  baseElapsedMs: number;
  finishedMs: number | null;

  loadPuzzle: (puzzle: Puzzle, resume: boolean) => void;
  act: (index: number, mode?: Mode) => void;
  setMode: (mode: Mode) => void;
  toggleMode: () => void;
  undo: () => void;
  reset: () => void;
  clearError: () => void;
  setCursor: (index: number | null) => void;
  moveCursor: (axis: Axis, delta: number) => void;
  setSlice: (slice: Slice | null) => void;
  stepSlice: (delta: number) => void;
  /** Isolates the plate holding the keyboard cursor, or the middle one. */
  sliceToCursor: (axis: Axis) => void;
  elapsedMs: () => number;
  remaining: () => number;
}

function buildLines(puzzle: Puzzle): LineInfo[] {
  return allLines(puzzle.size).map((line) => ({
    line,
    clue: clueForLine(puzzle.size, puzzle.solution, line),
    cells: lineCells(puzzle.size, line),
  }));
}

export const usePuzzleStore = create<PuzzleState>((set, get) => ({
  puzzle: null,
  lines: [],
  cells: new Uint8Array(0),
  history: [],
  mistakes: 0,
  mode: 'chip',
  solved: false,
  errorAt: null,
  cursor: null,
  slice: null,
  startedAt: Date.now(),
  baseElapsedMs: 0,
  finishedMs: null,

  loadPuzzle: (puzzle, resume) => {
    const total = cellCount(puzzle.size);
    const record = resume ? save.getRecord(puzzle.id) : undefined;
    const restored = record?.cells ? save.decodeCells(record.cells, total) : null;
    set({
      puzzle,
      lines: buildLines(puzzle),
      cells: restored ?? new Uint8Array(total),
      history: [],
      mistakes: restored ? (record?.mistakes ?? 0) : 0,
      solved: false,
      errorAt: null,
      cursor: null,
      slice: null,
      startedAt: Date.now(),
      baseElapsedMs: restored ? (record?.elapsedMs ?? 0) : 0,
      finishedMs: null,
    });
  },

  act: (index, overrideMode) => {
    const state = get();
    const { puzzle } = state;
    if (!puzzle || state.solved) return;
    if (state.cells[index] !== Cell.Unknown) return;

    const mode = overrideMode ?? state.mode;
    const belongsToSculpture = puzzle.solution[index];
    const playerKeepsIt = mode === 'mark';
    const mistake = playerKeepsIt !== belongsToSculpture;

    // Either way the cube resolves to the truth, so a wrong guess still moves
    // the puzzle forward — it just costs you on the results card.
    const to: CellState = belongsToSculpture ? Cell.Marked : Cell.Broken;
    const cells = Uint8Array.from(state.cells);
    cells[index] = to;

    const solved = isSolved(cells, puzzle.solution);
    const elapsed = state.baseElapsedMs + (Date.now() - state.startedAt);

    set({
      cells,
      history: [...state.history, { index, from: Cell.Unknown, to, wasMistake: mistake }],
      mistakes: state.mistakes + (mistake ? 1 : 0),
      errorAt: mistake ? index : null,
      solved,
      finishedMs: solved ? elapsed : null,
      // The reveal should always show the whole sculpture, never a lone plate.
      slice: solved ? null : state.slice,
    });

    if (solved) {
      save.recordSolve(puzzle.id, elapsed, state.mistakes + (mistake ? 1 : 0));
    } else {
      save.saveProgress(puzzle.id, cells, state.mistakes + (mistake ? 1 : 0), elapsed);
    }
  },

  setMode: (mode) => set({ mode }),
  toggleMode: () => set((s) => ({ mode: s.mode === 'chip' ? 'mark' : 'chip' })),

  undo: () => {
    const state = get();
    if (state.solved || state.history.length === 0 || !state.puzzle) return;
    const last = state.history[state.history.length - 1];
    const cells = Uint8Array.from(state.cells);
    cells[last.index] = last.from;
    const mistakes = state.mistakes - (last.wasMistake ? 1 : 0);
    set({
      cells,
      history: state.history.slice(0, -1),
      mistakes,
      errorAt: null,
    });
    save.saveProgress(state.puzzle.id, cells, mistakes, state.elapsedMs());
  },

  reset: () => {
    const { puzzle } = get();
    if (!puzzle) return;
    save.clearProgress(puzzle.id);
    get().loadPuzzle(puzzle, false);
  },

  clearError: () => set({ errorAt: null }),
  setCursor: (index) => set({ cursor: index }),

  moveCursor: (axis, delta) => {
    const { puzzle, cursor } = get();
    if (!puzzle) return;
    const size = puzzle.size;
    // The first press just places the cursor; only later ones move it.
    const coords: [number, number, number] =
      cursor === null
        ? [Math.floor(size[0] / 2), Math.floor(size[1] / 2), Math.floor(size[2] / 2)]
        : cellCoords(size, cursor);
    if (cursor !== null) {
      coords[axis] = Math.min(size[axis] - 1, Math.max(0, coords[axis] + delta));
    }

    // Keep the cursor inside the visible plate, otherwise it steers blind.
    const { slice } = get();
    if (slice) coords[slice.axis] = slice.layer;

    set({ cursor: cellIndex(size, coords[0], coords[1], coords[2]) });
  },

  setSlice: (slice) => set({ slice }),

  stepSlice: (delta) => {
    const { puzzle, slice } = get();
    if (!puzzle || !slice) return;
    const layer = Math.min(puzzle.size[slice.axis] - 1, Math.max(0, slice.layer + delta));
    set({ slice: { axis: slice.axis, layer } });
  },

  sliceToCursor: (axis) => {
    const { puzzle, cursor } = get();
    if (!puzzle) return;
    const layer =
      cursor === null
        ? Math.floor(puzzle.size[axis] / 2)
        : cellCoords(puzzle.size, cursor)[axis];
    set({ slice: { axis, layer } });
  },

  elapsedMs: () => {
    const s = get();
    if (s.finishedMs !== null) return s.finishedMs;
    return s.baseElapsedMs + (Date.now() - s.startedAt);
  },

  remaining: () => {
    const s = get();
    return s.puzzle ? remainingToBreak(s.cells, s.puzzle.solution) : 0;
  },
}));

if (import.meta.env.DEV) {
  // Lets the browser smoke test drive a puzzle to completion without 200 clicks.
  (window as unknown as { puzzleStore: typeof usePuzzleStore }).puzzleStore = usePuzzleStore;
}
