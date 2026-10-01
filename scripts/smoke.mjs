/**
 * Browser smoke test: drives the real app in Chromium, fails on any console
 * error, and drops screenshots in .smoke/ for eyeballing the visual style.
 */
import { mkdirSync } from 'node:fs';
import { chromium, devices } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:5173';
const OUT = '.smoke';
mkdirSync(OUT, { recursive: true });

const problems = [];

async function newPage(context, label) {
  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`[${label}] console: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`[${label}] pageerror: ${e.message}`));
  return page;
}

const browser = await chromium.launch();

// --- Desktop ---------------------------------------------------------------
const desktop = await browser.newContext({ viewport: { width: 1280, height: 860 } });

for (const [label, path] of [['home', '/'], ['library', '/library']]) {
  const page = await newPage(desktop, label);
  await page.goto(BASE + path, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${OUT}/${label}.png` });
  await page.close();
}

const play = await newPage(desktop, 'play');
await play.goto(`${BASE}/play/smiley`, { waitUntil: 'networkidle' });
await play.waitForSelector('canvas');
await play.waitForTimeout(1200);
await play.screenshot({ path: `${OUT}/play-start.png` });

const box = await play.locator('canvas').boundingBox();
await play.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
await play.waitForTimeout(700);
await play.screenshot({ path: `${OUT}/play-after-click.png` });

// Orbit with a drag, which must not also chip a cube.
const before = await play.evaluate(() => window.puzzleStore.getState().history.length);
await play.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await play.mouse.down();
await play.mouse.move(box.x + box.width / 2 + 160, box.y + box.height / 2 + 40, { steps: 12 });
await play.mouse.up();
await play.waitForTimeout(500);
const after = await play.evaluate(() => window.puzzleStore.getState().history.length);
if (after !== before) problems.push(`[play] dragging to orbit also chipped a cube (${before} -> ${after})`);
await play.screenshot({ path: `${OUT}/play-after-drag.png` });

// A wrong call should cost a slip but still resolve the cube truthfully.
const slip = await play.evaluate(() => {
  const { puzzle } = window.puzzleStore.getState();
  const target = puzzle.solution.findIndex((inSculpture) => inSculpture);
  window.puzzleStore.getState().act(target, 'chip');
  const s = window.puzzleStore.getState();
  return { mistakes: s.mistakes, cell: s.cells[target], errorAt: s.errorAt };
});
if (slip.mistakes !== 1) problems.push(`[play] wrong call not counted (${slip.mistakes})`);
if (slip.cell !== 1) problems.push('[play] a sculpture cube was destroyed by a wrong call');
if (slip.errorAt === null) problems.push('[play] no error feedback after a wrong call');
await play.waitForTimeout(200);
await play.screenshot({ path: `${OUT}/play-mistake.png` });
await play.evaluate(() => window.puzzleStore.getState().reset());
await play.waitForTimeout(300);

// --- Slicing ---------------------------------------------------------------
// The whole point is reaching cubes buried inside the block, so check that a
// cube which was NOT on the outer surface becomes clickable once sliced to.
const SLICE_AXIS = 1;
const SLICE_LAYER = 3;
const plate = await play.evaluate(
  ([axis, layer]) => {
    const store = window.puzzleStore.getState();
    store.setSlice({ axis, layer });
    const size = store.puzzle.size;
    return { size, expected: size[(axis + 1) % 3] * size[(axis + 2) % 3] };
  },
  [SLICE_AXIS, SLICE_LAYER],
);
await play.waitForTimeout(600);

const onSurface = ([x, y, z], size) =>
  x === 0 || y === 0 || z === 0 ||
  x === size[0] - 1 || y === size[1] - 1 || z === size[2] - 1;

const sliceHit = await play.evaluate(() => {
  const s = window.puzzleStore.getState();
  return { before: s.history.length, cells: s.cells.length };
});
await play.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
await play.waitForTimeout(500);

const sliced = await play.evaluate(() => {
  const s = window.puzzleStore.getState();
  const last = s.history[s.history.length - 1];
  const size = s.puzzle.size;
  const i = last?.index;
  return {
    acted: s.history.length,
    index: i,
    coords: i === undefined
      ? null
      : [i % size[0], Math.floor(i / size[0]) % size[1], Math.floor(i / (size[0] * size[1]))],
    size,
  };
});
if (sliced.acted !== sliceHit.before + 1) {
  problems.push('[slice] clicking the exposed plate did not act on a cube');
} else if (sliced.coords[SLICE_AXIS] !== SLICE_LAYER) {
  problems.push(
    `[slice] clicked a cube outside the plate (${sliced.coords} vs layer ${SLICE_LAYER})`,
  );
} else if (onSurface(sliced.coords, sliced.size)) {
  problems.push(`[slice] clicked cube ${sliced.coords} was on the surface, not interior`);
}
if (plate.expected < 1) problems.push('[slice] plate has no cubes');
await play.screenshot({ path: `${OUT}/slice-plate.png` });

// Clue numbers must re-seat onto the plate, or it cannot be reasoned about.
const clueCount = await play.evaluate(() => {
  const s = window.puzzleStore.getState();
  return s.lines.filter((l) => l.clue.count > 0).length;
});
if (clueCount === 0) problems.push('[slice] no clues available on the sliced plate');

// Stepping the layer from the panel.
const grip = await play.evaluate(() => {
  const s = window.puzzleStore.getState();
  s.setSlice({ axis: 1, layer: s.puzzle.size[1] - 1 });
  return s.puzzle.size[1];
});
await play.waitForTimeout(400);
await play.evaluate(() => window.puzzleStore.getState().stepSlice(-1));
await play.waitForTimeout(300);
const stepped = await play.evaluate(() => window.puzzleStore.getState().slice.layer);
if (stepped !== grip - 2) problems.push(`[slice] stepping the layer did not take (${stepped})`);

// Dragging the Y grip must move the plate WITHOUT orbiting the camera —
// OrbitControls listens on the canvas, so it has to be disabled mid-drag.
const gripScreen = await play.evaluate(() => {
  const { camera } = window.scene3d;
  const g = window.sliceGrips[1];
  if (!g) return null;
  const Vec3 = camera.position.constructor;
  const ndc = new Vec3(g.x, g.y, g.z).project(camera);
  const canvas = document.querySelector('canvas').getBoundingClientRect();
  return {
    x: canvas.left + ((ndc.x + 1) / 2) * canvas.width,
    y: canvas.top + ((1 - ndc.y) / 2) * canvas.height,
    layer: window.puzzleStore.getState().slice.layer,
    azimuth: Math.atan2(camera.position.x, camera.position.z),
  };
});

if (!gripScreen) {
  problems.push('[slice] no Y grip was exposed to drag');
} else {
  await play.mouse.move(gripScreen.x, gripScreen.y);
  await play.mouse.down();
  // Downward on screen steps toward lower layers on the Y rail.
  for (let i = 1; i <= 10; i++) {
    await play.mouse.move(gripScreen.x, gripScreen.y + i * 9);
    await play.waitForTimeout(16);
  }
  await play.mouse.up();
  await play.waitForTimeout(400);

  const dragged = await play.evaluate(() => {
    const { camera, controls } = window.scene3d;
    return {
      layer: window.puzzleStore.getState().slice?.layer ?? null,
      azimuth: Math.atan2(camera.position.x, camera.position.z),
      controlsEnabled: controls?.enabled,
    };
  });
  if (dragged.layer === gripScreen.layer) {
    problems.push(`[slice] dragging the grip did not move the plate (still ${dragged.layer})`);
  }
  if (Math.abs(dragged.azimuth - gripScreen.azimuth) > 0.02) {
    problems.push('[slice] dragging the grip also orbited the camera');
  }
  if (dragged.controlsEnabled !== true) {
    problems.push('[slice] camera controls were left disabled after the drag');
  }
  await play.screenshot({ path: `${OUT}/slice-dragged.png` });
}

// Clearing brings the whole block back.
await play.evaluate(() => window.puzzleStore.getState().setSlice(null));
await play.waitForTimeout(400);
if (await play.evaluate(() => window.puzzleStore.getState().slice !== null)) {
  problems.push('[slice] the block did not return to whole');
}
await play.evaluate(() => window.puzzleStore.getState().reset());
await play.waitForTimeout(300);

// Drive it to a win to check the reveal and the results card.
await play.evaluate(() => {
  const store = window.puzzleStore.getState();
  const { puzzle } = store;
  for (let i = 0; i < puzzle.solution.length; i++) {
    window.puzzleStore.getState().act(i, puzzle.solution[i] ? 'mark' : 'chip');
  }
});
await play.waitForTimeout(1400);
await play.screenshot({ path: `${OUT}/play-solved.png` });
const solved = await play.evaluate(() => window.puzzleStore.getState().solved);
if (!solved) problems.push('[play] block did not register as solved');
const mistakes = await play.evaluate(() => window.puzzleStore.getState().mistakes);
if (mistakes !== 0) problems.push(`[play] perfect play recorded ${mistakes} mistakes`);
await play.close();

// Library should now show the solved sculpture rather than a blank block.
const lib = await newPage(desktop, 'library-solved');
await lib.goto(`${BASE}/library`, { waitUntil: 'networkidle' });
await lib.waitForTimeout(500);
await lib.screenshot({ path: `${OUT}/library-solved.png` });
if (!(await lib.getByText('Hello There').count())) {
  problems.push('[library] solved puzzle name is not shown');
}
await lib.close();

// --- Phone -----------------------------------------------------------------
const phone = await browser.newContext({ ...devices['iPhone 13'] });
const mobileHome = await newPage(phone, 'mobile-home');
await mobileHome.goto(BASE, { waitUntil: 'networkidle' });
await mobileHome.screenshot({ path: `${OUT}/mobile-home.png` });
await mobileHome.close();

const mobilePlay = await newPage(phone, 'mobile-play');
await mobilePlay.goto(`${BASE}/daily`, { waitUntil: 'networkidle' });
await mobilePlay.waitForSelector('canvas');
await mobilePlay.waitForTimeout(1200);
await mobilePlay.screenshot({ path: `${OUT}/mobile-play.png` });

// A tap should chip; a long press should keep.
const mbox = await mobilePlay.locator('canvas').boundingBox();
const cx = mbox.x + mbox.width / 2;
// Aim at the block's body rather than the exact canvas centre: on a tall
// portrait canvas the centre line sits near the block's lower edge.
const cy = mbox.y + mbox.height * 0.38;
await mobilePlay.touchscreen.tap(cx, cy);
await mobilePlay.waitForTimeout(400);
if ((await mobilePlay.evaluate(() => window.puzzleStore.getState().history.length)) === 0) {
  problems.push('[mobile] tapping a cube did nothing');
}
await mobilePlay.screenshot({ path: `${OUT}/mobile-play-tapped.png` });
await mobilePlay.close();

await browser.close();

if (problems.length) {
  console.error(`\n${problems.length} problem(s):`);
  for (const p of problems) console.error(' - ' + p);
  process.exit(1);
}
console.log(`Smoke test passed. Screenshots in ${OUT}/`);
