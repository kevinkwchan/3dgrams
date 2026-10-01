import { useEffect, useRef } from 'react';
import type { Size } from '../game/grid';

interface Props {
  size: Size;
  /** Which cubes to draw. Pass the solution to reveal, or a full block to keep it secret. */
  filled: boolean[];
  color: string;
  className?: string;
}

function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const r = clamp(((n >> 16) & 255) * amount);
  const g = clamp(((n >> 8) & 255) * amount);
  const b = clamp((n & 255) * amount);
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * A flat isometric drawing of the block. Cheap enough to put dozens on a page
 * without spinning up a WebGL context per card.
 */
export function Thumbnail({ size, filled, color, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = canvas.clientWidth || 200;
    const cssH = canvas.clientHeight || 200;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const cubes: [number, number, number][] = [];
    for (let z = 0; z < size[2]; z++) {
      for (let y = 0; y < size[1]; y++) {
        for (let x = 0; x < size[0]; x++) {
          if (filled[x + size[0] * (y + size[1] * z)]) cubes.push([x, y, z]);
        }
      }
    }
    if (cubes.length === 0) return;

    // Fit a unit-sized drawing to the canvas, then scale up to fill it.
    const project = (x: number, y: number, z: number, w: number) => {
      const h = w / 2;
      return [(x - z) * w, (x + z) * h - y * w] as const;
    };

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [x, y, z] of cubes) {
      const [px, py] = project(x, y, z, 1);
      minX = Math.min(minX, px - 1); maxX = Math.max(maxX, px + 1);
      minY = Math.min(minY, py); maxY = Math.max(maxY, py + 1.5);
    }

    const pad = 10;
    const w = Math.min((cssW - pad * 2) / (maxX - minX), (cssH - pad * 2) / (maxY - minY));
    const offX = cssW / 2 - ((minX + maxX) / 2) * w;
    const offY = cssH / 2 - ((minY + maxY) / 2) * w;

    cubes.sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]));

    const top = shade(color, 1.12);
    const right = shade(color, 0.86);
    const left = shade(color, 0.64);
    const edge = shade(color, 0.5);

    const h = w / 2;
    ctx.lineWidth = Math.max(0.6, w * 0.05);
    ctx.strokeStyle = edge;
    ctx.lineJoin = 'round';

    for (const [x, y, z] of cubes) {
      const [px, py] = project(x, y, z, w);
      const ox = px + offX;
      const oy = py + offY;

      const face = (points: [number, number][], fill: string) => {
        ctx.beginPath();
        ctx.moveTo(ox + points[0][0], oy + points[0][1]);
        for (let i = 1; i < points.length; i++) ctx.lineTo(ox + points[i][0], oy + points[i][1]);
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.stroke();
      };

      face([[0, 0], [w, h], [0, 2 * h], [-w, h]], top);
      face([[-w, h], [0, 2 * h], [0, 2 * h + w], [-w, h + w]], left);
      face([[w, h], [0, 2 * h], [0, 2 * h + w], [w, h + w]], right);
    }
  }, [size, filled, color]);

  return <canvas ref={ref} className={className} aria-hidden />;
}
