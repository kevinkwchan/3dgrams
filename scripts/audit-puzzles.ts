/**
 * Dev tool: prints every puzzle as layered ASCII and reports whether it can be
 * solved by pure line deduction. Run with `npm run audit:puzzles` while tuning
 * a sculpture's signed distance field.
 */
import { analyzeSolvability } from '../src/game/grid';
import { PUZZLES } from '../src/puzzles/catalog';
import { asciiPreview } from '../src/puzzles/shape';

const only = process.argv[2];
let failures = 0;

for (const puzzle of PUZZLES) {
  if (only && puzzle.id !== only) continue;
  const filledCount = puzzle.solution.filter(Boolean).length;
  const total = puzzle.solution.length;
  const result = analyzeSolvability(puzzle.size, puzzle.solution);
  if (result.status !== 'unique') failures++;

  console.log('='.repeat(60));
  console.log(
    `${puzzle.name} (${puzzle.id})  ${puzzle.size.join('x')}  ` +
      `${filledCount}/${total} cubes  [${puzzle.difficulty}]`,
  );
  console.log(
    result.status === 'unique'
      ? 'solvable: yes (single-line deduction)'
      : result.status === 'ambiguous'
        ? `solvable: NO - ${result.undetermined} cubes need guessing`
        : `solvable: CONTRADICTION on axis ${result.line.axis}`,
  );
  console.log('-'.repeat(60));
  console.log(asciiPreview(puzzle.size, puzzle.solution));
  console.log();
}

console.log('='.repeat(60));
console.log(failures === 0 ? 'All puzzles are fair.' : `${failures} puzzle(s) need tuning.`);
