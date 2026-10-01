import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { PUZZLES, type Difficulty, type Puzzle } from '../puzzles/catalog';
import * as save from '../persistence/store';
import { Thumbnail } from '../ui/Thumbnail';
import { formatTime } from '../ui/format';

const GROUPS: { key: Difficulty; title: string; blurb: string }[] = [
  { key: 'easy', title: 'Warm-ups', blurb: 'Small blocks, gentle clues.' },
  { key: 'medium', title: 'Workshop', blurb: 'Room for a real shape to hide in.' },
  { key: 'hard', title: 'The Gallery', blurb: 'Sculptures worth the patience.' },
];

function Card({ puzzle, record }: { puzzle: Puzzle; record?: save.PuzzleRecord }) {
  const solved = record?.solved ?? false;
  const inProgress = !solved && !!record?.cells;
  const blockFilled = useMemo(
    () => new Array(puzzle.solution.length).fill(true),
    [puzzle],
  );

  return (
    <Link
      to={`/play/${puzzle.id}`}
      className="group flex flex-col items-center rounded-3xl bg-white/70 p-4 shadow-sm ring-1 ring-bark-200 transition hover:-translate-y-1 hover:shadow-lg active:scale-95"
    >
      <Thumbnail
        size={puzzle.size}
        filled={solved ? puzzle.solution : blockFilled}
        color={solved ? puzzle.palette.reveal : puzzle.palette.wood}
        className="h-28 w-full"
      />
      <h3 className="mt-3 text-center font-extrabold text-bark-800">
        {solved ? puzzle.name : '???'}
      </h3>
      <p className="text-xs font-semibold text-bark-400">{puzzle.size.join('×')}</p>
      <p className="mt-1 text-xs font-semibold text-bark-500">
        {solved
          ? `${formatTime(record!.bestMs ?? 0)} · ${record!.bestMistakes ?? 0} slips`
          : inProgress
            ? 'In progress'
            : 'Untouched'}
      </p>
    </Link>
  );
}

export function Library() {
  const data = useMemo(() => save.load(), []);

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <Link to="/" className="text-sm font-bold text-bark-500 hover:text-bark-700">
        ← Home
      </Link>
      <h1 className="mt-4 text-4xl font-extrabold text-bark-800">The shelf</h1>
      <p className="mt-2 text-bark-600">
        Every block starts a mystery. Carve it to find out what it was.
      </p>

      {GROUPS.map((group) => {
        const puzzles = PUZZLES.filter((p) => p.difficulty === group.key);
        if (puzzles.length === 0) return null;
        return (
          <section key={group.key} className="mt-10">
            <h2 className="text-xl font-extrabold text-bark-700">{group.title}</h2>
            <p className="text-sm text-bark-500">{group.blurb}</p>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {puzzles.map((p) => (
                <Card key={p.id} puzzle={p} record={data.puzzles[p.id]} />
              ))}
            </div>
          </section>
        );
      })}
    </main>
  );
}
