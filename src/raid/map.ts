import { MAP_TILES, TILE } from '../config/constants';
import { ContainerKind, seeded } from '../game/loot';

export interface Rect { x: number; y: number; w: number; h: number }
export interface MapData {
  walls: Rect[];
  /** Interiores de ruinas (para dibujar suelo distinto). */
  floors: Rect[];
  spawn: { x: number; y: number };
  /** 3 puntos de extracción: 0 = extremo opuesto a la aparición (norte), 1 = oeste, 2 = este. */
  exitLocs: { x: number; y: number }[];
  containers: { x: number; y: number; kind: ContainerKind }[];
  danger: { x: number; y: number; r: number };
  eliteBox: { x: number; y: number };
}

const T = TILE;

/** Mapa "ciudad en ruinas" reproducible a partir de la semilla de la raid. */
export function generateMap(seed: number): MapData {
  const rng = seeded(seed);
  const walls: Rect[] = [];
  const floors: Rect[] = [];
  const containers: MapData['containers'] = [];
  const spawn = { x: (12 + Math.floor(rng() * 36)) * T, y: (MAP_TILES - 4) * T };
  const exitLocs = [
    { x: (MAP_TILES - spawn.x / T) * T, y: 3 * T },
    { x: 3 * T, y: (24 + Math.floor(rng() * 10)) * T },
    { x: (MAP_TILES - 3) * T, y: (24 + Math.floor(rng() * 10)) * T },
  ];
  const danger = { x: 30 * T, y: 28 * T, r: 9 * T };
  const eliteBox = { x: danger.x, y: danger.y };
  const keepClear = [spawn, ...exitLocs];

  const block = 10;
  for (let by = 0; by < MAP_TILES / block; by++) {
    for (let bx = 0; bx < MAP_TILES / block; bx++) {
      const cx = (bx * block + block / 2) * T, cy = (by * block + block / 2) * T;
      if (keepClear.some(p => Math.hypot(p.x - cx, p.y - cy) < 7 * T)) continue;
      if (Math.hypot(danger.x - cx, danger.y - cy) < 4 * T) { // plaza central abierta con escombros
        continue;
      }
      if (rng() < 0.18) continue;
      const w = (5 + Math.floor(rng() * 3)) * T, h = (5 + Math.floor(rng() * 3)) * T;
      const x = cx - w / 2 + (rng() - 0.5) * 2 * T, y = cy - h / 2 + (rng() - 0.5) * 2 * T;
      const th = 0.6 * T;
      floors.push({ x, y, w, h });
      // 4 paredes con huecos (puertas / derrumbes)
      const sides: Rect[][] = [];
      const gap = 1.6 * T;
      const doorSides = new Set<number>();
      doorSides.add(Math.floor(rng() * 4));
      if (rng() < 0.6) doorSides.add(Math.floor(rng() * 4));
      for (let s = 0; s < 4; s++) {
        const horiz = s < 2;
        const len = horiz ? w : h;
        const sx = s === 3 ? x + w - th : x, sy = s === 1 ? y + h - th : y;
        if (!doorSides.has(s)) { sides.push([horiz ? { x: sx, y: sy, w: len, h: th } : { x: sx, y: sy, w: th, h: len }]); continue; }
        const at = th + rng() * (len - gap - 2 * th);
        const a = at, b = len - at - gap;
        const seg: Rect[] = [];
        if (horiz) { seg.push({ x: sx, y: sy, w: a, h: th }); seg.push({ x: sx + a + gap, y: sy, w: b, h: th }); }
        else { seg.push({ x: sx, y: sy, w: th, h: a }); seg.push({ x: sx, y: sy + a + gap, w: th, h: b }); }
        sides.push(seg);
      }
      for (const s of sides) walls.push(...s.filter(r => r.w > 4 && r.h > 4));
      // botín dentro
      const n = 1 + Math.floor(rng() * 2);
      for (let i = 0; i < n; i++) {
        const px = x + th + T * 0.8 + rng() * (w - 2 * th - 1.6 * T);
        const py = y + th + T * 0.8 + rng() * (h - 2 * th - 1.6 * T);
        const d = Math.hypot(px - danger.x, py - danger.y);
        containers.push({ x: px, y: py, kind: rng() < (d < 16 * T ? 0.45 : 0.2) ? 'cerrada' : 'caja' });
      }
    }
  }
  // escombros sueltos
  for (let i = 0; i < 26; i++) {
    const w = (0.8 + rng() * 1.6) * T, h = (0.8 + rng() * 1.6) * T;
    const x = (3 + rng() * (MAP_TILES - 6)) * T, y = (3 + rng() * (MAP_TILES - 6)) * T;
    if (keepClear.some(p => Math.hypot(p.x - x, p.y - y) < 5 * T)) continue;
    if (Math.hypot(eliteBox.x - x, eliteBox.y - y) < 2.5 * T) continue;
    if (floors.some(f => x + w > f.x - T && x < f.x + f.w + T && y + h > f.y - T && y < f.y + f.h + T)) continue;
    walls.push({ x, y, w, h });
  }
  // cajas en la calle
  for (let i = 0; i < 10; i++) {
    const x = (4 + rng() * (MAP_TILES - 8)) * T, y = (4 + rng() * (MAP_TILES - 8)) * T;
    if (walls.some(r => x > r.x - T && x < r.x + r.w + T && y > r.y - T && y < r.y + r.h + T)) continue;
    containers.push({ x, y, kind: 'caja' });
  }
  return { walls, floors, spawn, exitLocs, containers, danger, eliteBox };
}

export function pointInWalls(walls: Rect[], x: number, y: number, pad = 0) {
  return walls.some(r => x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad);
}

/** ¿Hay línea de visión entre dos puntos? */
export function lineClear(walls: Rect[], x1: number, y1: number, x2: number, y2: number) {
  const minX = Math.min(x1, x2), maxX = Math.max(x1, x2), minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
  for (const r of walls) {
    if (r.x > maxX || r.x + r.w < minX || r.y > maxY || r.y + r.h < minY) continue;
    if (segRect(x1, y1, x2, y2, r)) return false;
  }
  return true;
}

function segRect(x1: number, y1: number, x2: number, y2: number, r: Rect) {
  // Liang–Barsky
  let t0 = 0, t1 = 1;
  const dx = x2 - x1, dy = y2 - y1;
  const p = [-dx, dx, -dy, dy], q = [x1 - r.x, r.x + r.w - x1, y1 - r.y, r.y + r.h - y1];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) { if (q[i] < 0) return false; continue; }
    const t = q[i] / p[i];
    if (p[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
    else { if (t < t0) return false; if (t < t1) t1 = t; }
  }
  return true;
}
