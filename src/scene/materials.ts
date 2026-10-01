import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three-stdlib';
import type { ClueShape } from '../game/grid';

/**
 * Everything the scene needs is drawn at runtime rather than shipped as image
 * files: the game stays a single small bundle and works offline on first load.
 */

function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const el = document.createElement('canvas');
  el.width = size;
  el.height = size;
  return [el, el.getContext('2d')!];
}

let woodCache: THREE.CanvasTexture | null = null;

/** Warm end-grain: soft rings plus a fine fibre streak, so blocks read as timber. */
export function woodTexture(): THREE.CanvasTexture {
  if (woodCache) return woodCache;
  const S = 256;
  const [el, ctx] = canvas(S);

  ctx.fillStyle = '#f0dcc0';
  ctx.fillRect(0, 0, S, S);

  const rings = 26;
  for (let i = 0; i < rings; i++) {
    const t = i / rings;
    ctx.strokeStyle = `rgba(150, 105, 62, ${0.05 + 0.07 * Math.abs(Math.sin(i * 1.7))})`;
    ctx.lineWidth = 2 + 5 * Math.abs(Math.sin(i * 0.9));
    ctx.beginPath();
    for (let x = 0; x <= S; x += 4) {
      const wobble = Math.sin(x * 0.019 + i) * 5 + Math.sin(x * 0.047 + i * 2.3) * 2.5;
      const y = t * S + wobble;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  ctx.globalAlpha = 0.12;
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    ctx.fillStyle = Math.random() > 0.5 ? '#8a5a30' : '#fff3e0';
    ctx.fillRect(x, y, 1 + Math.random() * 6, 1);
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(el);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  woodCache = tex;
  return tex;
}

let gradientCache: THREE.DataTexture | null = null;

/** Four-band ramp — enough steps to stay soft, few enough to read as cel shading. */
export function toonGradient(): THREE.DataTexture {
  if (gradientCache) return gradientCache;
  const steps = new Uint8Array([90, 150, 205, 255]);
  const tex = new THREE.DataTexture(steps, steps.length, 1, THREE.RedFormat);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  gradientCache = tex;
  return tex;
}

let geometryCache: RoundedBoxGeometry | null = null;

/** Chamfered cube — the single most important detail for the hand-made toy feel. */
export function cubeGeometry(): RoundedBoxGeometry {
  if (!geometryCache) geometryCache = new RoundedBoxGeometry(0.94, 0.94, 0.94, 2, 0.1);
  return geometryCache;
}

const clueCache = new Map<string, THREE.CanvasTexture>();

/**
 * Picross notation on a tile: the count, wrapped in a circle when the cubes sit
 * in two runs and a square when they sit in three or more.
 */
export function clueTexture(count: number, shape: ClueShape, resolved: boolean): THREE.CanvasTexture {
  const key = `${count}|${shape}|${resolved}`;
  const hit = clueCache.get(key);
  if (hit) return hit;

  const S = 128;
  const [el, ctx] = canvas(S);
  const ink = resolved ? 'rgba(92, 68, 46, 0.32)' : 'rgba(58, 38, 22, 0.95)';
  const c = S / 2;

  ctx.clearRect(0, 0, S, S);
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineWidth = 7;
  ctx.lineJoin = 'round';

  if (shape === 'circle') {
    ctx.beginPath();
    ctx.arc(c, c, 46, 0, Math.PI * 2);
    ctx.stroke();
  } else if (shape === 'square') {
    ctx.beginPath();
    ctx.roundRect(c - 44, c - 44, 88, 88, 12);
    ctx.stroke();
  }

  ctx.font = `700 ${shape === 'plain' ? 86 : 64}px ui-rounded, "SF Pro Rounded", "Nunito", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(count), c, c + 4);

  const tex = new THREE.CanvasTexture(el);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  clueCache.set(key, tex);
  return tex;
}

const materialCache = new Map<string, THREE.MeshToonMaterial>();

export function blockMaterial(color: string, opts: { translucent?: boolean } = {}): THREE.MeshToonMaterial {
  const key = `${color}|${opts.translucent ?? false}`;
  const hit = materialCache.get(key);
  if (hit) return hit;
  const mat = new THREE.MeshToonMaterial({
    color: new THREE.Color(color),
    map: woodTexture(),
    gradientMap: toonGradient(),
    transparent: opts.translucent,
    opacity: opts.translucent ? 0.55 : 1,
  });
  materialCache.set(key, mat);
  return mat;
}

const clueMaterialCache = new Map<string, THREE.MeshBasicMaterial>();

export function clueMaterial(count: number, shape: ClueShape, resolved: boolean): THREE.MeshBasicMaterial {
  const key = `${count}|${shape}|${resolved}`;
  const hit = clueMaterialCache.get(key);
  if (hit) return hit;
  const mat = new THREE.MeshBasicMaterial({
    map: clueTexture(count, shape, resolved),
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  clueMaterialCache.set(key, mat);
  return mat;
}
