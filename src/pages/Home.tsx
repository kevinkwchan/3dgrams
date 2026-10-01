import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { PUZZLES } from '../puzzles/catalog';
import { dailyPuzzle, dateKey, msUntilNextDaily } from '../puzzles/daily';
import * as save from '../persistence/store';
import { Thumbnail } from '../ui/Thumbnail';
import { formatCountdown, formatDate, formatTime } from '../ui/format';

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl bg-white/60 px-5 py-3 shadow-sm ring-1 ring-bark-200">
      <span className="text-2xl font-extrabold text-bark-700">{value}</span>
      <span className="text-xs font-semibold tracking-wide text-bark-500 uppercase">{label}</span>
    </div>
  );
}

export function Home() {
  const today = dateKey();
  const puzzle = useMemo(() => dailyPuzzle(today), [today]);
  const data = useMemo(() => save.load(), []);

  const todayResult = data.daily[today];
  const streak = save.currentStreak(data.daily, today);
  const solvedCount = PUZZLES.filter((p) => data.puzzles[p.id]?.solved).length;

  // Today's block stays a secret until it's carved.
  const blockFilled = useMemo(
    () => new Array(puzzle.solution.length).fill(true),
    [puzzle],
  );

  return (
    <main className="mx-auto flex min-h-full max-w-3xl flex-col gap-10 px-5 py-12 sm:py-16">
      <header className="text-center">
        <h1 className="text-5xl font-extrabold tracking-tight text-bark-800 sm:text-6xl">
          3dgrams
        </h1>
        <p className="mt-3 text-lg text-bark-600">
          Chip away a wooden block until a little sculpture is left behind.
        </p>
      </header>

      <section className="animate-rise rounded-[28px] bg-white/70 p-6 shadow-[0_18px_40px_-24px_rgba(74,49,34,0.6)] ring-1 ring-bark-200 sm:p-8">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
          <Thumbnail
            size={puzzle.size}
            filled={todayResult ? puzzle.solution : blockFilled}
            color={todayResult ? puzzle.palette.reveal : puzzle.palette.wood}
            className="h-36 w-36 shrink-0"
          />
          <div className="flex-1 text-center sm:text-left">
            <p className="text-xs font-bold tracking-widest text-bark-400 uppercase">
              Today · {formatDate(today)}
            </p>
            <h2 className="mt-1 text-3xl font-extrabold text-bark-800">
              {todayResult ? puzzle.name : "Today's Block"}
            </h2>
            <p className="mt-2 text-bark-600">
              {todayResult
                ? `Carved in ${formatTime(todayResult.elapsedMs)} with ${todayResult.mistakes} slip${
                    todayResult.mistakes === 1 ? '' : 's'
                  }. Next one in ${formatCountdown(msUntilNextDaily())}.`
                : 'One puzzle, the same for everyone, every day.'}
            </p>
            <Link
              to="/daily"
              className="mt-5 inline-block rounded-full bg-bark-600 px-7 py-3 font-bold text-bark-50 shadow-md transition hover:bg-bark-700 active:scale-95"
            >
              {todayResult ? 'Look at it again' : "Carve today's puzzle"}
            </Link>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-3">
        <Stat value={String(streak)} label="day streak" />
        <Stat value={`${solvedCount}/${PUZZLES.length}`} label="carved" />
        <Stat value={String(Object.keys(data.daily).length)} label="dailies" />
      </section>

      <section className="text-center">
        <Link
          to="/library"
          className="inline-block rounded-full bg-white/70 px-7 py-3 font-bold text-bark-700 ring-1 ring-bark-200 transition hover:bg-white active:scale-95"
        >
          Browse the whole shelf →
        </Link>
      </section>
    </main>
  );
}
