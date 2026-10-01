import { describe, expect, it } from 'vitest';
import { PUZZLES } from './catalog';
import { dailyPuzzle, dateKey, dayNumber } from './daily';

describe('daily rotation', () => {
  it('gives everyone the same puzzle for a given date', () => {
    expect(dailyPuzzle('2026-03-14').id).toBe(dailyPuzzle('2026-03-14').id);
  });

  it('works out the UTC date key', () => {
    expect(dateKey(new Date('2026-03-14T23:30:00Z'))).toBe('2026-03-14');
  });

  it('advances one day at a time', () => {
    expect(dayNumber('2024-01-02') - dayNumber('2024-01-01')).toBe(1);
  });

  it('uses the whole catalog before repeating a puzzle', () => {
    const start = dayNumber('2026-01-01');
    const cycleStart = Math.floor(start / PUZZLES.length) * PUZZLES.length;
    const seen = new Set<string>();
    for (let i = 0; i < PUZZLES.length; i++) {
      const day = new Date(Date.UTC(2024, 0, 1 + cycleStart + i));
      seen.add(dailyPuzzle(dateKey(day)).id);
    }
    expect(seen.size).toBe(PUZZLES.length);
  });
});
