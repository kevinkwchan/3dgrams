import { Cell, type CellState } from '../game/grid';

const KEY = '3dgrams.save.v1';

export interface PuzzleRecord {
  /** One character per cube: '0' unknown, '1' marked, '2' broken. */
  cells?: string;
  mistakes: number;
  elapsedMs: number;
  solved: boolean;
  bestMs?: number;
  bestMistakes?: number;
}

export interface DailyResult {
  puzzleId: string;
  elapsedMs: number;
  mistakes: number;
}

export interface SaveData {
  puzzles: Record<string, PuzzleRecord>;
  /** Keyed by UTC date, `YYYY-MM-DD`. */
  daily: Record<string, DailyResult>;
}

const EMPTY: SaveData = { puzzles: {}, daily: {} };

export function encodeCells(cells: Uint8Array): string {
  let out = '';
  for (let i = 0; i < cells.length; i++) out += cells[i];
  return out;
}

export function decodeCells(encoded: string, length: number): Uint8Array | null {
  if (encoded.length !== length) return null;
  const out = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    const v = encoded.charCodeAt(i) - 48;
    if (v !== Cell.Unknown && v !== Cell.Marked && v !== Cell.Broken) return null;
    out[i] = v as CellState;
  }
  return out;
}

export function load(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(EMPTY);
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    return { puzzles: parsed.puzzles ?? {}, daily: parsed.daily ?? {} };
  } catch {
    return structuredClone(EMPTY);
  }
}

function save(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // A full or blocked storage quota shouldn't interrupt play.
  }
}

export function update(mutate: (data: SaveData) => void): SaveData {
  const data = load();
  mutate(data);
  save(data);
  return data;
}

export function getRecord(puzzleId: string): PuzzleRecord | undefined {
  return load().puzzles[puzzleId];
}

export function saveProgress(
  puzzleId: string,
  cells: Uint8Array,
  mistakes: number,
  elapsedMs: number,
): void {
  update((data) => {
    const prev = data.puzzles[puzzleId];
    data.puzzles[puzzleId] = {
      ...prev,
      cells: encodeCells(cells),
      mistakes,
      elapsedMs,
      solved: prev?.solved ?? false,
    };
  });
}

export function clearProgress(puzzleId: string): void {
  update((data) => {
    const prev = data.puzzles[puzzleId];
    if (!prev) return;
    delete prev.cells;
    prev.mistakes = 0;
    prev.elapsedMs = 0;
  });
}

export function recordSolve(puzzleId: string, elapsedMs: number, mistakes: number): void {
  update((data) => {
    const prev = data.puzzles[puzzleId];
    data.puzzles[puzzleId] = {
      mistakes: 0,
      elapsedMs: 0,
      cells: undefined,
      solved: true,
      bestMs: prev?.bestMs === undefined ? elapsedMs : Math.min(prev.bestMs, elapsedMs),
      bestMistakes:
        prev?.bestMistakes === undefined ? mistakes : Math.min(prev.bestMistakes, mistakes),
    };
  });
}

export function recordDaily(dateKey: string, result: DailyResult): void {
  update((data) => {
    if (!data.daily[dateKey]) data.daily[dateKey] = result;
  });
}

/** Consecutive solved days ending today (or yesterday, if today isn't done yet). */
export function currentStreak(daily: Record<string, DailyResult>, todayKey: string): number {
  const cursor = new Date(`${todayKey}T00:00:00Z`);
  if (!daily[todayKey]) cursor.setUTCDate(cursor.getUTCDate() - 1);
  let streak = 0;
  for (;;) {
    const key = cursor.toISOString().slice(0, 10);
    if (!daily[key]) return streak;
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
}
