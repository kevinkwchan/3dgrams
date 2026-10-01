import type { Size } from '../game/grid';
import {
  box, cylinder, ellipsoid, intersect, largestConnectedBody, mirrorX, plane,
  rotateZ, sphere, subtract, torus, union, voxelize, type Field,
} from './shape';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Palette {
  /** Untouched block. */
  wood: string;
  /** Cubes the player has marked as part of the sculpture. */
  marked: string;
  /** The finished sculpture, once revealed. */
  reveal: string;
}

export interface PuzzleDef {
  id: string;
  name: string;
  /** Shown on the results card — a little note about what you just carved. */
  flavor: string;
  difficulty: Difficulty;
  size: Size;
  palette: Palette;
  field: Field;
}

export interface Puzzle extends Omit<PuzzleDef, 'field'> {
  solution: boolean[];
}

const OAK: Palette = { wood: '#d9b183', marked: '#c98f5a', reveal: '#e8a765' };
const ROSE: Palette = { wood: '#d9b183', marked: '#cf8f7e', reveal: '#e4776f' };
const MOSS: Palette = { wood: '#d9b183', marked: '#a8b183', reveal: '#8fb072' };
const SKY: Palette = { wood: '#d9b183', marked: '#9fb4c9', reveal: '#7fa8cc' };
const STONE: Palette = { wood: '#cdc3b4', marked: '#a9a094', reveal: '#9c948a' };

/** A cone tapering along +y, from `radius` at its base to a point at `height`. */
function coneY(cx: number, cy: number, cz: number, radius: number, height: number): Field {
  return (x, y, z) => {
    const h = y - cy;
    if (h > height) return h - height;
    const allowed = radius * (1 - Math.max(h, 0) / height);
    return Math.max(Math.hypot(x - cx, z - cz) - allowed, -h, h - height);
  };
}

const DEFS: PuzzleDef[] = [
  {
    id: 'heart',
    name: 'Little Heart',
    flavor: 'Where every collection ought to begin.',
    difficulty: 'easy',
    size: [6, 6, 5],
    palette: ROSE,
    field: intersect(
      union(
        sphere(-1.15, 0.25, 0, 1.8),
        sphere(1.15, 0.25, 0, 1.8),
        rotateZ(box(0, -0.5, 0, 1.7, 1.7, 2), 45),
      ),
      ellipsoid(0, -0.5, 0, 3.4, 3.6, 2.3),
    ),
  },
  {
    id: 'smiley',
    name: 'Hello There',
    flavor: 'A friendly face, hiding in plain sight.',
    difficulty: 'medium',
    size: [7, 7, 7],
    palette: OAK,
    field: subtract(
      sphere(0, 0, 0, 3.3),
      sphere(-1.35, 1.0, 2.3, 1.0),
      sphere(1.35, 1.0, 2.3, 1.0),
      intersect(
        torus('z', 0, 0.1, 2.6, 1.85, 0.7),
        plane(0, 1, 0, -0.5),
      ),
    ),
  },
  {
    id: 'apple',
    name: 'One Apple',
    flavor: 'Picked this morning. Mind the stem.',
    difficulty: 'easy',
    size: [5, 6, 5],
    palette: ROSE,
    field: union(
      subtract(ellipsoid(0, -0.5, 0, 2.3, 2.1, 2.3), sphere(0, 2.6, 0, 1.2)),
      cylinder('y', 0, 1.7, 0, 0.42, 1.0),
      box(1.3, 2.0, 0, 0.9, 0.5, 0.55),
    ),
  },
  {
    id: 'mushroom',
    name: 'Toadstool',
    flavor: 'Found it growing quietly under the workbench.',
    difficulty: 'easy',
    size: [5, 6, 5],
    palette: MOSS,
    field: union(
      intersect(sphere(0, 0.5, 0, 2.5), plane(0, -1, 0, -0.4)),
      cylinder('y', 0, -1.4, 0, 1.05, 1.7),
    ),
  },
  {
    id: 'mug',
    name: 'Morning Mug',
    flavor: 'Still warm. Careful with the handle.',
    difficulty: 'easy',
    size: [6, 5, 5],
    palette: SKY,
    field: union(
      subtract(
        cylinder('y', -0.6, 0, 0, 1.95, 2.1),
        intersect(cylinder('y', -0.6, 0, 0, 1.05, 3), plane(0, -1, 0, -0.4)),
      ),
      torus('z', 1.75, 0.1, 0, 1.05, 0.55),
    ),
  },
  {
    id: 'rocket',
    name: 'Pocket Rocket',
    flavor: 'Small enough to launch from the kitchen table.',
    difficulty: 'medium',
    size: [5, 8, 5],
    palette: SKY,
    field: union(
      cylinder('y', 0, -1.0, 0, 1.45, 2.3),
      coneY(0, 0.8, 0, 1.45, 2.8),
      mirrorX(intersect(
        box(1.7, -2.4, 0, 1.0, 1.1, 0.55),
        rotateZ(plane(0, 1, 0, -0.3), -40),
      )),
    ),
  },
  {
    id: 'duck',
    name: 'Bath Duck',
    flavor: 'Unsinkable. Reliably cheerful.',
    difficulty: 'medium',
    size: [7, 6, 5],
    palette: OAK,
    field: union(
      ellipsoid(-0.4, -0.7, 0, 2.7, 1.8, 2.0),
      sphere(1.5, 1.5, 0, 1.5),
      box(3.0, 1.2, 0, 0.9, 0.45, 0.6),
      intersect(box(-2.7, 0.5, 0, 1.0, 1.0, 0.7), rotateZ(plane(1, 0, 0, 0.2), 30)),
    ),
  },
  {
    id: 'cat',
    name: 'Shelf Cat',
    flavor: 'Has decided this is her spot now.',
    difficulty: 'medium',
    size: [7, 7, 7],
    palette: MOSS,
    field: union(
      ellipsoid(0, -1.4, 0.6, 1.8, 1.6, 2.2),
      sphere(0, 1.3, -1.2, 1.7),
      mirrorX(box(1.05, 2.6, -1.2, 0.45, 0.75, 0.45)),
      mirrorX(box(1.0, -2.6, 1.9, 0.5, 1.0, 0.7)),
      intersect(torus('x', 0, -0.4, 2.7, 1.3, 0.55), plane(0, -1, 0, -0.4)),
    ),
  },
  {
    id: 'moai',
    name: 'Moai',
    flavor: 'One of the quiet watchers of Rapa Nui.',
    difficulty: 'hard',
    size: [7, 9, 5],
    palette: STONE,
    field: subtract(
      union(
        intersect(
          box(0, 0.7, -0.2, 1.9, 2.9, 1.3),
          ellipsoid(0, 0.4, -0.3, 2.9, 4.4, 2.4),
        ),
        box(0, -3.1, 0, 2.6, 1.0, 1.8),
        box(0, 2.0, 1.1, 1.9, 0.5, 0.5),
        box(0, 0.5, 1.2, 0.55, 1.6, 0.6),
        mirrorX(box(2.2, 0.6, -0.4, 0.5, 1.5, 0.7)),
      ),
      mirrorX(box(1.15, 1.1, 1.5, 0.55, 0.45, 0.6)),
      box(0, -1.5, 1.4, 1.0, 0.35, 0.6),
    ),
  },
  {
    id: 'thinker',
    name: 'The Thinker',
    flavor: 'After Rodin. Elbow on knee, lost in it.',
    difficulty: 'hard',
    size: [7, 8, 7],
    palette: STONE,
    field: union(
      box(0, -3.0, 0.6, 2.3, 0.8, 2.3),
      ellipsoid(0, -0.9, -0.3, 1.7, 1.9, 1.5),
      box(0, -2.4, 1.3, 1.6, 0.9, 1.6),
      sphere(0.2, 1.6, 0.4, 1.35),
      intersect(box(1.5, -0.4, 0.9, 0.7, 1.9, 0.7), plane(0, 0, 0, 9)),
      box(1.4, 0.9, 0.7, 0.6, 0.8, 0.6),
      box(-1.5, -1.6, -0.2, 0.6, 1.6, 0.6),
    ),
  },
  {
    id: 'venus',
    name: 'Torso',
    flavor: 'A fragment, the way the museums keep them.',
    difficulty: 'hard',
    size: [6, 9, 5],
    palette: STONE,
    field: union(
      ellipsoid(0, 2.0, 0, 2.2, 2.0, 1.5),
      ellipsoid(0, 0.0, 0, 1.7, 1.7, 1.3),
      ellipsoid(0, -2.0, 0, 2.2, 1.8, 1.6),
      mirrorX(sphere(1.9, 3.1, 0, 1.0)),
      mirrorX(cylinder('y', 1.1, -3.6, 0, 1.0, 1.1)),
    ),
  },
];

function build(def: PuzzleDef): Puzzle {
  const { field, ...rest } = def;
  return { ...rest, solution: largestConnectedBody(def.size, voxelize(def.size, field)) };
}

export const PUZZLES: Puzzle[] = DEFS.map(build);

export const PUZZLE_DEFS = DEFS;

export function getPuzzle(id: string): Puzzle | undefined {
  return PUZZLES.find((p) => p.id === id);
}
