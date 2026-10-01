import { cellIndex, type Size } from '../game/grid';

/**
 * Shapes are authored as signed distance fields in *cube units*, centred on the
 * block: for a 7-wide block x runs from -3 to 3. Thinking in whole cubes keeps
 * hand-tuning a sculpture tractable, since one unit is exactly one voxel.
 */
export type Field = (x: number, y: number, z: number) => number;

export function sphere(cx: number, cy: number, cz: number, r: number): Field {
  return (x, y, z) => Math.hypot(x - cx, y - cy, z - cz) - r;
}

export function ellipsoid(
  cx: number, cy: number, cz: number,
  rx: number, ry: number, rz: number,
): Field {
  return (x, y, z) => Math.hypot((x - cx) / rx, (y - cy) / ry, (z - cz) / rz) - 1;
}

export function box(
  cx: number, cy: number, cz: number,
  hx: number, hy: number, hz: number,
): Field {
  return (x, y, z) => {
    const dx = Math.abs(x - cx) - hx;
    const dy = Math.abs(y - cy) - hy;
    const dz = Math.abs(z - cz) - hz;
    const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0), Math.max(dz, 0));
    return outside + Math.min(Math.max(dx, Math.max(dy, dz)), 0);
  };
}

/** Axis-aligned cylinder. `axis` is the direction it runs along. */
export function cylinder(
  axis: 'x' | 'y' | 'z',
  cx: number, cy: number, cz: number,
  r: number, halfLength: number,
): Field {
  return (x, y, z) => {
    const dx = x - cx, dy = y - cy, dz = z - cz;
    const [radial, along] =
      axis === 'x' ? [Math.hypot(dy, dz), dx]
      : axis === 'y' ? [Math.hypot(dx, dz), dy]
      : [Math.hypot(dx, dy), dz];
    const a = radial - r;
    const b = Math.abs(along) - halfLength;
    return Math.hypot(Math.max(a, 0), Math.max(b, 0)) + Math.min(Math.max(a, b), 0);
  };
}

/** Ring lying in the plane perpendicular to `axis`. */
export function torus(
  axis: 'x' | 'y' | 'z',
  cx: number, cy: number, cz: number,
  ringRadius: number, tubeRadius: number,
): Field {
  return (x, y, z) => {
    const dx = x - cx, dy = y - cy, dz = z - cz;
    const [radial, along] =
      axis === 'x' ? [Math.hypot(dy, dz), dx]
      : axis === 'y' ? [Math.hypot(dx, dz), dy]
      : [Math.hypot(dx, dy), dz];
    return Math.hypot(radial - ringRadius, along) - tubeRadius;
  };
}

/** Half-space kept on the negative side of the plane. */
export function plane(nx: number, ny: number, nz: number, offset: number): Field {
  const len = Math.hypot(nx, ny, nz) || 1;
  return (x, y, z) => (x * nx + y * ny + z * nz) / len - offset;
}

export function union(...fields: Field[]): Field {
  return (x, y, z) => Math.min(...fields.map((f) => f(x, y, z)));
}

export function intersect(...fields: Field[]): Field {
  return (x, y, z) => Math.max(...fields.map((f) => f(x, y, z)));
}

export function subtract(base: Field, ...cutters: Field[]): Field {
  return (x, y, z) => Math.max(base(x, y, z), ...cutters.map((f) => -f(x, y, z)));
}

/** Pushes the surface outward, rounding concave detail away — good for cuddly shapes. */
export function inflate(field: Field, amount: number): Field {
  return (x, y, z) => field(x, y, z) - amount;
}

export function translate(field: Field, dx: number, dy: number, dz: number): Field {
  return (x, y, z) => field(x - dx, y - dy, z - dz);
}

/** Mirrors the field across x = 0, so you only author one side of a symmetric sculpture. */
export function mirrorX(field: Field): Field {
  return (x, y, z) => Math.min(field(x, y, z), field(-x, y, z));
}

/** Rotation about the z axis, in degrees. */
export function rotateZ(field: Field, degrees: number): Field {
  const t = (degrees * Math.PI) / 180;
  const c = Math.cos(t), s = Math.sin(t);
  return (x, y, z) => field(c * x + s * y, -s * x + c * y, z);
}

/** Rotation about the x axis, in degrees. */
export function rotateX(field: Field, degrees: number): Field {
  const t = (degrees * Math.PI) / 180;
  const c = Math.cos(t), s = Math.sin(t);
  return (x, y, z) => field(x, c * y + s * z, -s * y + c * z);
}

/** Centre of cube (x,y,z) in the block's centred coordinate space. */
export function voxelCenter(size: Size, x: number, y: number, z: number): [number, number, number] {
  return [x - (size[0] - 1) / 2, y - (size[1] - 1) / 2, z - (size[2] - 1) / 2];
}

/** Samples a field at every cube centre. A cube belongs to the sculpture when it is inside. */
export function voxelize(size: Size, field: Field): boolean[] {
  const out = new Array<boolean>(size[0] * size[1] * size[2]).fill(false);
  for (let z = 0; z < size[2]; z++) {
    for (let y = 0; y < size[1]; y++) {
      for (let x = 0; x < size[0]; x++) {
        const [px, py, pz] = voxelCenter(size, x, y, z);
        out[cellIndex(size, x, y, z)] = field(px, py, pz) <= 0;
      }
    }
  }
  return out;
}

/**
 * Drops cubes that only touch the sculpture at an edge or corner, and keeps the
 * single largest face-connected body. A sculpture that falls apart into floating
 * crumbs never reads as the thing it is meant to be.
 */
export function largestConnectedBody(size: Size, filled: boolean[]): boolean[] {
  const seen = new Int32Array(filled.length).fill(-1);
  let best: number[] = [];
  let component = 0;

  for (let start = 0; start < filled.length; start++) {
    if (!filled[start] || seen[start] !== -1) continue;
    const stack = [start];
    const members: number[] = [];
    seen[start] = component;
    while (stack.length) {
      const i = stack.pop()!;
      members.push(i);
      const x = i % size[0];
      const y = Math.floor(i / size[0]) % size[1];
      const z = Math.floor(i / (size[0] * size[1]));
      const neighbours: [number, number, number][] = [
        [x + 1, y, z], [x - 1, y, z],
        [x, y + 1, z], [x, y - 1, z],
        [x, y, z + 1], [x, y, z - 1],
      ];
      for (const [nx, ny, nz] of neighbours) {
        if (nx < 0 || ny < 0 || nz < 0) continue;
        if (nx >= size[0] || ny >= size[1] || nz >= size[2]) continue;
        const ni = cellIndex(size, nx, ny, nz);
        if (filled[ni] && seen[ni] === -1) {
          seen[ni] = component;
          stack.push(ni);
        }
      }
    }
    if (members.length > best.length) best = members;
    component++;
  }

  const out = new Array<boolean>(filled.length).fill(false);
  for (const i of best) out[i] = true;
  return out;
}

/** Text dump of the block, one y-layer at a time, for eyeballing a shape while tuning it. */
export function asciiPreview(size: Size, filled: boolean[]): string {
  const layers: string[] = [];
  for (let y = size[1] - 1; y >= 0; y--) {
    const rows: string[] = [];
    for (let z = size[2] - 1; z >= 0; z--) {
      let row = '';
      for (let x = 0; x < size[0]; x++) {
        row += filled[cellIndex(size, x, y, z)] ? '##' : '. ';
      }
      rows.push(row);
    }
    layers.push(`y=${y}\n${rows.join('\n')}`);
  }
  return layers.join('\n\n');
}
