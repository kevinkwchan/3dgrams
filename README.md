# 3dgrams

A 3D nonogram in the browser. You start with a solid block of wooden cubes and
chip away everything that isn't part of the sculpture hiding inside, using the
numbers printed on the block's outer faces. There's a full shelf of puzzles plus
one daily puzzle that's the same for everybody.

Plays with mouse, trackpad, touch, or keyboard alone.

## Running it

```sh
npm install
npm run dev
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Typecheck + production build |
| `npm test` | Unit tests for the puzzle logic |
| `npm run audit:puzzles` | Prints every sculpture as ASCII and checks it's fair |
| `node scripts/smoke.mjs` | Drives the real app in Chromium; screenshots to `.smoke/` |

The smoke test needs the dev server already running.

## How the game works

Each cube sits on three lines — one per axis. Every line has a clue: how many of
its cubes belong to the sculpture, circled if they form two separate runs and
boxed if they form three or more. Clues are painted on whichever cube is
currently frontmost in the line, so chipping one away steps the number inward.

You either **chip** a cube (it's not part of the sculpture) or **keep** it
(it is). Calling it wrong costs a slip, but the cube still resolves to the
truth, so you never get stuck. You win when every cube outside the sculpture is
gone.

To reach cubes buried inside the block, **slice** it: pick an axis and isolate a
single layer, either by dragging one of the wooden grips at the block's corners
or from the slice bar. Clue numbers re-seat onto whichever cube is frontmost in
the exposed layer, so a plate stays fully readable. Slicing is only a view —
it never changes your progress.

## Controls

| | |
| --- | --- |
| Tap / left click | Chip |
| Right click / long press | Keep |
| Drag | Turn the block |
| Drag a corner grip | Slice to a layer |
| Arrows, `[` `]` | Move the keyboard cursor |
| `Enter` | Act on the cursor |
| `Space` | Swap chip ⇄ keep |
| `Q` `E` `W` `S` | Turn the block |
| `1` `2` `3` | Slice to the cursor's layer on X / Y / Z |
| `,` `.` | Step the layer |
| `Esc` | Show the whole block again |
| `U` | Undo |
| `Shift+R` | Restart |

## Layout

```
src/
  game/       Grid model, clue derivation, win check, solvability — no React or Three
  puzzles/    Sculptures as signed distance fields, plus the daily rotation
  scene/      react-three-fiber: cubes, clue tiles, slice grips, camera, materials
  persistence/  localStorage: progress, best times, daily streak
  pages/      Home, library, play
  ui/         Isometric thumbnails and formatting
scripts/      Puzzle audit tool and the browser smoke test
```

Nothing is fetched at runtime except the web font: the wood grain, the cel
shading ramp, and the clue tiles are all drawn to a canvas on first use.

## Adding a puzzle

Sculptures live in `src/puzzles/catalog.ts` as compositions of signed distance
primitives (`sphere`, `box`, `cylinder`, `torus`, `union`, `subtract`, …) from
`src/puzzles/shape.ts`. Coordinates are in **cube units, centred on the block**,
so in a 7-wide block `x` runs from -3 to 3 and one unit is exactly one voxel.

After adding one, run:

```sh
npm run audit:puzzles <id>
```

It prints the shape layer by layer and tells you whether the clues can be
reasoned out one line at a time. If it reports cubes that "need guessing", the
puzzle isn't fair yet — adjust the shape until it is. Every shipped puzzle is
covered by a test that keeps this true.
