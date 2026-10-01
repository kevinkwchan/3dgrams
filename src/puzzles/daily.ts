import { PUZZLES, type Puzzle } from './catalog';

/** Day 0 of the rotation. */
const EPOCH = Date.UTC(2024, 0, 1);
const DAY_MS = 86_400_000;

export function dateKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function dayNumber(key: string): number {
  return Math.floor((Date.parse(`${key}T00:00:00Z`) - EPOCH) / DAY_MS);
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Each cycle is a fresh shuffle of the whole catalog, so a puzzle never repeats
 * until every other one has had its day. Derived purely from the date, which
 * keeps everyone on the same puzzle without a server.
 */
function cycleOrder(cycle: number): Puzzle[] {
  const rng = mulberry32(cycle * 2654435761 + 12345);
  const order = [...PUZZLES];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

export function dailyPuzzle(key: string = dateKey()): Puzzle {
  const day = dayNumber(key);
  const n = PUZZLES.length;
  const cycle = Math.floor(day / n);
  const offset = ((day % n) + n) % n;
  return cycleOrder(cycle)[offset];
}

/** Milliseconds until the next daily puzzle unlocks. */
export function msUntilNextDaily(now: Date = new Date()): number {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return next - now.getTime();
}
