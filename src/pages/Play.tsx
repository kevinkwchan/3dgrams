import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { getPuzzle } from '../puzzles/catalog';
import { dailyPuzzle, dateKey } from '../puzzles/daily';
import { usePuzzleStore } from '../game/puzzleStore';
import * as save from '../persistence/store';
import { formatTime } from '../ui/format';

// Three.js is the bulk of the bundle and only the play view needs it, so the
// home and library screens stay quick to open.
const PuzzleScene = lazy(() =>
  import('../scene/PuzzleScene').then((m) => ({ default: m.PuzzleScene })),
);

const KEY_HELP: [string, string][] = [
  ['Tap / click', 'Chip the cube away'],
  ['Right-click / hold', 'Keep the cube'],
  ['Drag', 'Turn the block'],
  ['Arrows / [ ]', 'Move the cursor'],
  ['Enter', 'Act on the cursor'],
  ['Space', 'Swap chip ⇄ keep'],
  ['Q E W S', 'Turn the block'],
  ['1 2 3', 'Slice to a layer'],
  [', .', 'Step the layer'],
  ['Esc', 'Show the whole block'],
  ['U', 'Undo'],
];

const AXIS_LABELS = ['X', 'Y', 'Z'] as const;

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-white/70 px-2.5 py-1 text-xs font-bold whitespace-nowrap text-bark-700 ring-1 ring-bark-200 sm:px-3 sm:text-sm">
      {children}
    </span>
  );
}

function useTicker(active: boolean) {
  const [, force] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => force((n) => n + 1), 500);
    return () => window.clearInterval(id);
  }, [active]);
}

export function Play({ daily = false }: { daily?: boolean }) {
  const { id } = useParams();
  const today = dateKey();
  const puzzle = useMemo(
    () => (daily ? dailyPuzzle(today) : id ? getPuzzle(id) : undefined),
    [daily, today, id],
  );

  const store = usePuzzleStore();
  const { loadPuzzle, act, toggleMode, undo, reset, moveCursor, setSlice, stepSlice, sliceToCursor } =
    store;
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    if (puzzle) loadPuzzle(puzzle, true);
  }, [puzzle, loadPuzzle]);

  useEffect(() => {
    document.body.classList.add('no-scroll');
    return () => document.body.classList.remove('no-scroll');
  }, []);

  // A daily win is written once and never overwritten, so the first attempt stands.
  useEffect(() => {
    if (daily && puzzle && store.solved && store.finishedMs !== null) {
      save.recordDaily(today, {
        puzzleId: puzzle.id,
        elapsedMs: store.finishedMs,
        mistakes: store.mistakes,
      });
    }
  }, [daily, puzzle, store.solved, store.finishedMs, store.mistakes, today]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const cursor = usePuzzleStore.getState().cursor;
      switch (e.key) {
        case 'ArrowLeft': moveCursor(0, -1); break;
        case 'ArrowRight': moveCursor(0, 1); break;
        case 'ArrowUp': moveCursor(1, 1); break;
        case 'ArrowDown': moveCursor(1, -1); break;
        case '[': moveCursor(2, -1); break;
        case ']': moveCursor(2, 1); break;
        case 'Enter': if (cursor !== null) act(cursor); break;
        case ' ': toggleMode(); break;
        case '1': sliceToCursor(0); break;
        case '2': sliceToCursor(1); break;
        case '3': sliceToCursor(2); break;
        case ',': stepSlice(-1); break;
        case '.': stepSlice(1); break;
        case 'Escape': setSlice(null); break;
        case 'u': case 'U': undo(); break;
        case 'R': reset(); break;
        case '?': setShowHelp((v) => !v); break;
        default: return;
      }
      e.preventDefault();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [act, toggleMode, undo, reset, moveCursor, setSlice, stepSlice, sliceToCursor]);

  useTicker(!!puzzle && !store.solved);

  if (!puzzle) return <Navigate to="/library" replace />;

  const remaining = store.remaining();

  return (
    <div className="fixed inset-0 flex flex-col">
      <header className="flex items-center gap-2 px-3 pt-[max(0.6rem,env(safe-area-inset-top))] pb-2 sm:gap-3 sm:px-4 sm:pb-3">
        <Link
          to={daily ? '/' : '/library'}
          aria-label="Back"
          className="rounded-full bg-white/70 px-3.5 py-2 font-bold text-bark-700 ring-1 ring-bark-200 transition hover:bg-white sm:px-4"
        >
          ←
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold text-bark-800 sm:text-base">
            {store.solved ? puzzle.name : daily ? "Today's Block" : 'Mystery Block'}
          </p>
          <p className="truncate text-xs font-semibold text-bark-500">
            {puzzle.size.join('×')} · {remaining} to clear
          </p>
        </div>
        <Pill>{formatTime(store.elapsedMs())}</Pill>
        <Pill>
          {store.mistakes}
          <span className="hidden sm:inline"> slips</span>
          <span className="sm:hidden">✕</span>
        </Pill>
        <button
          onClick={() => setShowHelp((v) => !v)}
          aria-label="Controls"
          className="rounded-full bg-white/70 px-3 py-2 text-sm font-bold text-bark-700 ring-1 ring-bark-200 transition hover:bg-white"
        >
          ?
        </button>
      </header>

      <div className="relative min-h-0 flex-1">
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center text-sm font-bold text-bark-400">
              Fetching the block…
            </div>
          }
        >
          <PuzzleScene />
        </Suspense>

        {showHelp && (
          <div className="animate-rise absolute top-3 right-3 w-64 rounded-2xl bg-white/95 p-4 shadow-xl ring-1 ring-bark-200">
            <h2 className="mb-2 font-extrabold text-bark-800">Controls</h2>
            <dl className="space-y-1.5 text-xs">
              {KEY_HELP.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="font-bold text-bark-500">{k}</dt>
                  <dd className="text-right text-bark-700">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {store.solved && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-5">
            <div className="animate-rise pointer-events-auto w-full max-w-sm rounded-[28px] bg-white/80 p-5 text-center shadow-2xl ring-1 ring-bark-200 backdrop-blur-md">
              <p className="text-xs font-bold tracking-widest text-bark-400 uppercase">Carved</p>
              <h2 className="mt-1 text-3xl font-extrabold text-bark-800">{puzzle.name}</h2>
              <p className="mt-2 text-bark-600">{puzzle.flavor}</p>
              <div className="mt-4 flex justify-center gap-3">
                <Pill>{formatTime(store.finishedMs ?? 0)}</Pill>
                <Pill>{store.mistakes} slips</Pill>
              </div>
              <div className="mt-5 flex justify-center gap-3">
                <Link
                  to={daily ? '/' : '/library'}
                  className="rounded-full bg-bark-600 px-6 py-2.5 font-bold text-bark-50 shadow transition hover:bg-bark-700 active:scale-95"
                >
                  {daily ? 'Home' : 'The shelf'}
                </Link>
                <button
                  onClick={reset}
                  className="rounded-full bg-white px-6 py-2.5 font-bold text-bark-700 ring-1 ring-bark-200 transition hover:bg-bark-50 active:scale-95"
                >
                  Carve again
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {!store.solved && (
        <div className="flex flex-wrap items-center justify-center gap-2 px-4 pt-2">
          <div className="flex items-center rounded-full bg-white/70 p-1 ring-1 ring-bark-200">
            <span className="px-2 text-xs font-bold text-bark-400 uppercase">Slice</span>
            {AXIS_LABELS.map((label, axis) => (
              <button
                key={label}
                onClick={() =>
                  store.slice?.axis === axis ? setSlice(null) : sliceToCursor(axis as 0 | 1 | 2)
                }
                aria-pressed={store.slice?.axis === axis}
                className={`w-8 rounded-full py-1.5 text-sm font-bold transition ${
                  store.slice?.axis === axis
                    ? 'bg-bark-600 text-bark-50 shadow'
                    : 'text-bark-600 hover:bg-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {store.slice && (
            <div className="flex items-center gap-1 rounded-full bg-white/70 p-1 ring-1 ring-bark-200">
              <button
                onClick={() => stepSlice(-1)}
                disabled={store.slice.layer === 0}
                aria-label="Previous layer"
                className="rounded-full px-3 py-1.5 font-bold text-bark-700 transition hover:bg-white disabled:opacity-35"
              >
                ‹
              </button>
              <span className="min-w-14 text-center text-xs font-bold text-bark-600">
                {store.slice.layer + 1} / {puzzle.size[store.slice.axis]}
              </span>
              <button
                onClick={() => stepSlice(1)}
                disabled={store.slice.layer === puzzle.size[store.slice.axis] - 1}
                aria-label="Next layer"
                className="rounded-full px-3 py-1.5 font-bold text-bark-700 transition hover:bg-white disabled:opacity-35"
              >
                ›
              </button>
              <button
                onClick={() => setSlice(null)}
                className="rounded-full px-3 py-1.5 text-xs font-bold text-bark-500 transition hover:bg-white"
              >
                Whole block
              </button>
            </div>
          )}
        </div>
      )}

      {!store.solved && (
        <footer className="flex items-center justify-center gap-3 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex rounded-full bg-white/70 p-1 ring-1 ring-bark-200">
            <button
              onClick={() => store.setMode('chip')}
              className={`rounded-full px-5 py-2 font-bold transition ${
                store.mode === 'chip' ? 'bg-bark-600 text-bark-50 shadow' : 'text-bark-600'
              }`}
            >
              Chip
            </button>
            <button
              onClick={() => store.setMode('mark')}
              className={`rounded-full px-5 py-2 font-bold transition ${
                store.mode === 'mark' ? 'bg-bark-600 text-bark-50 shadow' : 'text-bark-600'
              }`}
            >
              Keep
            </button>
          </div>
          <button
            onClick={undo}
            disabled={store.history.length === 0}
            className="rounded-full bg-white/70 px-5 py-2.5 font-bold text-bark-700 ring-1 ring-bark-200 transition hover:bg-white disabled:opacity-40"
          >
            Undo
          </button>
          <button
            onClick={reset}
            className="rounded-full bg-white/70 px-5 py-2.5 font-bold text-bark-700 ring-1 ring-bark-200 transition hover:bg-white"
          >
            Restart
          </button>
        </footer>
      )}
    </div>
  );
}
