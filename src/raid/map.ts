import { MAP_TILES, TILE } from '../config/constants';
import { MAP2 } from '../config/v2';
import { ContainerKind, seeded } from '../game/loot';

export interface Rect { x: number; y: number; w: number; h: number }
export type ZoneKind = 'calle' | 'casa' | 'tienda' | 'alto';
export interface Zone { kind: ZoneKind; name: string; rect: Rect; bonus: number }
export interface Door extends Rect { id: number; horiz: boolean }
export interface MapData {
  id: string;
  /** Paredes fijas (las puertas cerradas van aparte, en `doors`). */
  walls: Rect[];
  /** Coches abandonados (bloquean como paredes; también están en `walls`). */
  cars: (Rect & { rot: number })[];
  doors: Door[];
  /** Suelos interiores (baldosa). */
  floors: Rect[];
  zones: Zone[];
  /** Puntos de aparición posibles (sur). */
  spawns: { x: number; y: number }[];
  /** Punto de aparición elegido por defecto (compatibilidad). */
  spawn: { x: number; y: number };
  /** 3 puntos de extracción: 0 = norte (opuesto a la aparición), 1 = oeste, 2 = este. */
  exitLocs: { x: number; y: number }[];
  exitLocNames: string[];
  containers: { x: number; y: number; kind: ContainerKind; bonus: number }[];
  /** Cajas de élite custodiadas por una Abominación (una por zona de riesgo alto). */
  eliteBoxes: { x: number; y: number; zone: string }[];
  /** Carteles de evacuación: posición y ángulo (rad) hacia la salida a la que apuntan. */
  signs: { x: number; y: number; ang: number; exit: number }[];
  /** Compatibilidad con la v1: la primera zona alta. */
  danger: { x: number; y: number; r: number };
  eliteBox: { x: number; y: number };
}

const T = TILE;
const TH = 0.5 * T; // grosor de pared
const BLOCK = 19, STREET = 6, ORIGIN = 4;
const blockX = (i: number) => ORIGIN + i * (BLOCK + STREET);

/** Plano de manzanas (fila = norte→sur). */
const PLAN: string[][] = [
  ['casas', 'parque', 'comisaria', 'casas'],
  ['hospital', 'aparcamiento', 'plaza', 'bloque'],
  ['casas', 'super', 'aparcamiento', 'almacen'],
  ['casas', 'parque', 'casas', 'casas'],
];
const BIG: Record<string, { name: string; kind: ZoneKind; rooms: [number, number] }> = {
  hospital: { name: 'Hospital', kind: 'alto', rooms: [5, 6] },
  comisaria: { name: 'Comisaría', kind: 'alto', rooms: [4, 6] },
  almacen: { name: 'Almacén militar', kind: 'alto', rooms: [3, 5] },
  super: { name: 'Supermercado', kind: 'tienda', rooms: [3, 4] },
  bloque: { name: 'Bloque de pisos', kind: 'casa', rooms: [5, 6] },
};
const BONUS: Record<ZoneKind, number> = { calle: 0, casa: 0.3, tienda: 0.4, alto: 0.85 };

interface Seg { horiz: boolean; c: number; a: number; b: number; outer: boolean } // en casillas: línea c, de a a b

/** Mapa "ciudad v2": trazado FIJO (siempre el mismo, para que las salidas vistas sirvan entre raids). */
export function generateMap(_raidSeed?: number): MapData {
  const rng = seeded(MAP2.layoutSeed);
  const walls: Rect[] = [], floors: Rect[] = [], zones: Zone[] = [], doors: Door[] = [];
  const cars: MapData['cars'] = [];
  const containers: MapData['containers'] = [];
  const eliteBoxes: MapData['eliteBoxes'] = [];
  const signs: MapData['signs'] = [];
  const N = MAP_TILES;
  const streetC = (i: number) => blockX(i) - STREET / 2; // centro de la calle a la izquierda/arriba de la manzana i
  const exitLocs = [
    { x: streetC(2) * T, y: 2.2 * T },
    { x: 2 * T, y: (blockX(1) + BLOCK / 2) * T },
    { x: (N - 2.2) * T, y: (blockX(2) + BLOCK / 2) * T },
  ];
  const exitLocNames = ['Túnel norte', 'Puerta del hospital', 'Muelle del almacén'];
  const spawns = [1, 2, 3].map(i => ({ x: streetC(i) * T, y: (N - 2.5) * T }));
  const keepClear = [...spawns, ...exitLocs];
  let doorId = 0;

  const addSegWalls = (s: Seg, gaps: [number, number][]) => {
    // pared de a→b menos los huecos
    const parts: [number, number][] = [];
    let cur = s.a;
    for (const [g0, g1] of gaps.sort((p, q) => p[0] - q[0])) { if (g0 > cur) parts.push([cur, g0]); cur = Math.max(cur, g1); }
    if (cur < s.b) parts.push([cur, s.b]);
    for (const [p0, p1] of parts) {
      const ext0 = p0 === s.a ? TH / 2 : 0, ext1 = p1 === s.b ? TH / 2 : 0;
      if ((p1 - p0) * T + ext0 + ext1 < 6) continue;
      if (s.horiz) walls.push({ x: p0 * T - ext0, y: s.c * T - TH / 2, w: (p1 - p0) * T + ext0 + ext1, h: TH });
      else walls.push({ x: s.c * T - TH / 2, y: p0 * T - ext0, w: TH, h: (p1 - p0) * T + ext0 + ext1 });
    }
  };
  const addDoor = (s: Seg, g0: number, g1: number) => {
    const d: Door = s.horiz
      ? { id: doorId++, horiz: true, x: g0 * T, y: s.c * T - TH * 0.35, w: (g1 - g0) * T, h: TH * 0.7 }
      : { id: doorId++, horiz: false, x: s.c * T - TH * 0.35, y: g0 * T, w: TH * 0.7, h: (g1 - g0) * T };
    doors.push(d);
  };
  /** Elige un hueco de `len` casillas en el segmento sin pisar uniones en T. */
  const pickGap = (s: Seg, segs: Seg[], len: number): [number, number] => {
    const junctions: number[] = [];
    for (const o of segs) {
      if (o === s || o.horiz === s.horiz) continue;
      if ((Math.abs(o.a - s.c) < 0.01 || Math.abs(o.b - s.c) < 0.01) && o.c > s.a - 0.01 && o.c < s.b + 0.01) junctions.push(o.c);
    }
    for (let i = 0; i < 30; i++) {
      const g0 = s.a + 0.8 + rng() * Math.max(0, s.b - s.a - len - 1.6);
      const g1 = g0 + len;
      if (junctions.every(j => j < g0 - 0.7 || j > g1 + 0.7)) return [g0, g1];
    }
    const m = (s.a + s.b) / 2; return [m - len / 2, m + len / 2];
  };

  const building = (bx: number, by: number, bw: number, bh: number, nRooms: number, z: Zone, entrances: number, doorChance: number, elite: boolean) => {
    zones.push(z);
    floors.push({ x: bx * T, y: by * T, w: bw * T, h: bh * T });
    // BSP de habitaciones
    const rooms: { x: number; y: number; w: number; h: number }[] = [{ x: bx, y: by, w: bw, h: bh }];
    const segs: Seg[] = [
      { horiz: true, c: by, a: bx, b: bx + bw, outer: true }, { horiz: true, c: by + bh, a: bx, b: bx + bw, outer: true },
      { horiz: false, c: bx, a: by, b: by + bh, outer: true }, { horiz: false, c: bx + bw, a: by, b: by + bh, outer: true },
    ];
    let guard = 0;
    while (rooms.length < nRooms && guard++ < 50) {
      rooms.sort((p, q) => q.w * q.h - p.w * p.h);
      const r = rooms[0];
      const vertical = r.w > r.h ? true : r.w < r.h ? false : rng() < 0.5;
      const len = vertical ? r.w : r.h;
      if (len < 10) break;
      const cut = Math.round(len * (0.38 + rng() * 0.24));
      rooms.shift();
      if (vertical) {
        rooms.push({ x: r.x, y: r.y, w: cut, h: r.h }, { x: r.x + cut, y: r.y, w: r.w - cut, h: r.h });
        segs.push({ horiz: false, c: r.x + cut, a: r.y, b: r.y + r.h, outer: false });
      } else {
        rooms.push({ x: r.x, y: r.y, w: r.w, h: cut }, { x: r.x, y: r.y + cut, w: r.w, h: r.h - cut });
        segs.push({ horiz: true, c: r.y + cut, a: r.x, b: r.x + r.w, outer: false });
      }
    }
    // entradas en paredes exteriores (orden aleatorio de lados)
    const outer = segs.filter(s => s.outer);
    const sides = [0, 1, 2, 3].sort(() => rng() - 0.5).slice(0, entrances);
    outer.forEach((s, i) => {
      if (!sides.includes(i)) { addSegWalls(s, []); return; }
      const g = pickGap(s, segs, 2);
      addSegWalls(s, [g]);
      if (rng() < doorChance) addDoor(s, g[0], g[1]);
    });
    for (const s of segs.filter(s => !s.outer)) {
      const g = pickGap(s, segs, 1.9);
      addSegWalls(s, [g]);
      if (rng() < doorChance) addDoor(s, g[0], g[1]);
    }
    // botín por habitación; élite en la habitación más grande
    rooms.sort((p, q) => q.w * q.h - p.w * p.h);
    rooms.forEach((r, i) => {
      const cx = (r.x + r.w / 2) * T, cy = (r.y + r.h / 2) * T;
      if (elite && i === 0) { eliteBoxes.push({ x: cx, y: cy, zone: z.name }); return; }
      const n = 1 + (rng() < (z.kind === 'alto' ? 0.6 : 0.3) ? 1 : 0);
      for (let k = 0; k < n; k++) {
        const px = (r.x + 1.2 + rng() * Math.max(0.1, r.w - 2.4)) * T, py = (r.y + 1.2 + rng() * Math.max(0.1, r.h - 2.4)) * T;
        containers.push({ x: px, y: py, kind: rng() < (z.kind === 'alto' ? 0.5 : z.kind === 'calle' ? 0.05 : 0.25) ? 'cerrada' : 'caja', bonus: z.bonus });
      }
    });
  };

  const car = (x: number, y: number, horiz: boolean) => {
    const w = horiz ? 2.4 * T : 1.1 * T, h = horiz ? 1.1 * T : 2.4 * T;
    const r = { x: x - w / 2, y: y - h / 2, w, h };
    if (keepClear.some(p => Math.abs(p.x - x) < 4 * T && Math.abs(p.y - y) < 4 * T)) return;
    if (walls.some(o => o.x < r.x + r.w + 8 && o.x + o.w > r.x - 8 && o.y < r.y + r.h + 8 && o.y + o.h > r.y - 8)) return;
    walls.push(r); cars.push({ ...r, rot: horiz ? Math.PI / 2 : 0 });
  };
  const cover = (x: number, y: number, w: number, h: number) => { walls.push({ x: x * T, y: y * T, w: w * T, h: h * T }); };

  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
    const kind = PLAN[j][i];
    const x0 = blockX(i), y0 = blockX(j);
    if (BIG[kind]) {
      const b = BIG[kind];
      const n = b.rooms[0] + Math.floor(rng() * (b.rooms[1] - b.rooms[0] + 1));
      building(x0 + 1, y0 + 1, BLOCK - 2, BLOCK - 2, n, { kind: b.kind, name: b.name, rect: { x: (x0 + 1) * T, y: (y0 + 1) * T, w: (BLOCK - 2) * T, h: (BLOCK - 2) * T }, bonus: BONUS[b.kind] }, b.kind === 'alto' ? 2 : 3, b.kind === 'alto' ? 0.75 : 0.5, b.kind === 'alto');
      continue;
    }
    if (kind === 'casas') {
      // 3-4 casas pequeñas de 1-2 habitaciones con patio
      const slots = [[0, 0], [9.5, 0], [0, 9.5], [9.5, 9.5]].sort(() => rng() - 0.5).slice(0, 3 + (rng() < 0.5 ? 1 : 0));
      for (const [ox, oy] of slots) {
        const w = 7 + Math.floor(rng() * 2), h = 7 + Math.floor(rng() * 2);
        const hx = x0 + ox + 0.5 + rng() * (8.5 - w), hy = y0 + oy + 0.5 + rng() * (8.5 - h);
        building(Math.round(hx), Math.round(hy), w, h, rng() < 0.6 ? 2 : 1, { kind: 'casa', name: 'Casas', rect: { x: Math.round(hx) * T, y: Math.round(hy) * T, w: w * T, h: h * T }, bonus: BONUS.casa }, 1 + (rng() < 0.4 ? 1 : 0), 0.55, false);
      }
      continue;
    }
    if (kind === 'aparcamiento') {
      zones.push({ kind: 'calle', name: 'Aparcamiento', rect: { x: x0 * T, y: y0 * T, w: BLOCK * T, h: BLOCK * T }, bonus: 0.1 });
      for (let row = 0; row < 3; row++) for (let c = 0; c < 6; c++) if (rng() < 0.6) car((x0 + 2 + c * 3) * T, (y0 + 3 + row * 6.5) * T, false);
      containers.push({ x: (x0 + BLOCK / 2) * T, y: (y0 + BLOCK / 2) * T, kind: 'caja', bonus: 0.1 });
      continue;
    }
    // parque / plaza: muretes y jardineras como cobertura
    zones.push({ kind: 'calle', name: kind === 'plaza' ? 'Plaza' : 'Parque', rect: { x: x0 * T, y: y0 * T, w: BLOCK * T, h: BLOCK * T }, bonus: 0.05 });
    for (let k = 0; k < 9; k++) {
      const horiz = rng() < 0.5;
      const w = horiz ? 2 + rng() * 2.5 : 0.7, h = horiz ? 0.7 : 2 + rng() * 2.5;
      const x = x0 + 1.5 + rng() * (BLOCK - 5), y = y0 + 1.5 + rng() * (BLOCK - 5);
      if (keepClear.some(p => Math.hypot(p.x - x * T, p.y - y * T) < 5 * T)) continue;
      cover(x, y, w, h);
    }
    for (let k = 0; k < 2; k++) containers.push({ x: (x0 + 3 + rng() * (BLOCK - 6)) * T, y: (y0 + 3 + rng() * (BLOCK - 6)) * T, kind: 'caja', bonus: 0.05 });
  }
  // coches abandonados en las calles (sin cerrarlas: dejan siempre carril)
  for (let k = 0; k < 26; k++) {
    const vertical = rng() < 0.5;
    const s = Math.floor(rng() * 5);
    const along = (5 + rng() * (N - 10)) * T;
    const lane = (s === 0 ? 2 : streetC(s)) + (rng() < 0.5 ? -1.4 : 1.4);
    if (vertical) car(lane * T, along, false); else car(along, lane * T, true);
  }
  // cajas sueltas en la calle (poco botín)
  for (let k = 0; k < 14; k++) {
    const s = Math.floor(rng() * 4) + 1, along = (5 + rng() * (N - 10)) * T;
    const x = rng() < 0.5 ? streetC(s) * T : along, y = x === along ? streetC(s) * T : along;
    if (walls.some(r => x > r.x - T && x < r.x + r.w + T && y > r.y - T && y < r.y + r.h + T)) continue;
    containers.push({ x, y, kind: 'caja', bonus: 0 });
  }
  // carteles de evacuación en las esquinas de las manzanas que dan a cruces: apuntan a la salida más cercana
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
    const x0 = blockX(i), y0 = blockX(j);
    const corners = [[x0 - 0.2, y0 - 0.2], [x0 + BLOCK + 0.2, y0 + BLOCK + 0.2]];
    const [cx, cy] = corners[(i + j) % 2];
    const px = cx * T, py = cy * T;
    let best = 0, bd = Infinity;
    exitLocs.forEach((e, k) => { const d = Math.hypot(e.x - px, e.y - py); if (d < bd) { bd = d; best = k; } });
    // no todas las esquinas: ~2 de cada 3
    if (rng() < 0.33) continue;
    signs.push({ x: px, y: py, ang: Math.atan2(exitLocs[best].y - py, exitLocs[best].x - px), exit: best });
  }
  zones.push({ kind: 'calle', name: 'Calles', rect: { x: 0, y: 0, w: N * T, h: N * T }, bonus: 0 });
  const hi = zones.find(z => z.kind === 'alto')!;
  const danger = { x: hi.rect.x + hi.rect.w / 2, y: hi.rect.y + hi.rect.h / 2, r: hi.rect.w / 2 };
  return { id: MAP2.id, walls, cars, doors, floors, zones, spawns, spawn: spawns[1], exitLocs, exitLocNames, containers, eliteBoxes, signs, danger, eliteBox: eliteBoxes[0] ?? { x: danger.x, y: danger.y } };
}

/** Zona (la más específica) que contiene un punto. */
export function zoneAt(map: MapData, x: number, y: number): Zone {
  return map.zones.find(z => x >= z.rect.x && x <= z.rect.x + z.rect.w && y >= z.rect.y && y <= z.rect.y + z.rect.h) ?? map.zones[map.zones.length - 1];
}

/** Índice espacial de paredes (rejilla) para rayos, línea de visión y proyectiles en un mapa grande. */
export class WallIndex {
  private cells = new Map<number, Rect[]>();
  private readonly cs = TILE * 4;
  private stamp = new Map<Rect, number>();
  private q = 0;
  constructor(public walls: Rect[]) { this.rebuild(walls); }
  rebuild(walls: Rect[]) {
    this.walls = walls; this.cells.clear();
    for (const r of walls) {
      const x0 = Math.floor(r.x / this.cs), x1 = Math.floor((r.x + r.w) / this.cs), y0 = Math.floor(r.y / this.cs), y1 = Math.floor((r.y + r.h) / this.cs);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const k = y * 4096 + x; let l = this.cells.get(k); if (!l) this.cells.set(k, l = []); l.push(r); }
    }
  }
  query(minX: number, minY: number, maxX: number, maxY: number, out: Rect[] = []): Rect[] {
    out.length = 0; this.q++;
    const x0 = Math.floor(minX / this.cs), x1 = Math.floor(maxX / this.cs), y0 = Math.floor(minY / this.cs), y1 = Math.floor(maxY / this.cs);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const l = this.cells.get(y * 4096 + x); if (!l) continue;
      for (const r of l) { if (this.stamp.get(r) === this.q) continue; this.stamp.set(r, this.q); out.push(r); }
    }
    return out;
  }
}

export function pointInWalls(walls: Rect[], x: number, y: number, pad = 0) {
  return walls.some(r => x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad);
}

let activeIndex: WallIndex | null = null;
/** La escena registra su índice para acelerar lineClear/rayos con muchas paredes. */
export function setWallIndex(ix: WallIndex | null) { activeIndex = ix; }
const tmp: Rect[] = [];

/** ¿Hay línea de visión entre dos puntos? */
export function lineClear(walls: Rect[], x1: number, y1: number, x2: number, y2: number) {
  const minX = Math.min(x1, x2), maxX = Math.max(x1, x2), minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
  const list = activeIndex && activeIndex.walls === walls ? activeIndex.query(minX, minY, maxX, maxY, tmp) : walls;
  for (const r of list) {
    if (r.x > maxX || r.x + r.w < minX || r.y > maxY || r.y + r.h < minY) continue;
    if (segRect(x1, y1, x2, y2, r) !== null) return false;
  }
  return true;
}

/** Distancia (0..1 del segmento) al primer muro, o 1 si no choca. */
export function rayHit(walls: Rect[], x1: number, y1: number, x2: number, y2: number) {
  const minX = Math.min(x1, x2), maxX = Math.max(x1, x2), minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
  const list = activeIndex && activeIndex.walls === walls ? activeIndex.query(minX, minY, maxX, maxY, tmp) : walls;
  let best = 1;
  for (const r of list) {
    if (r.x > maxX || r.x + r.w < minX || r.y > maxY || r.y + r.h < minY) continue;
    const t = segRect(x1, y1, x2, y2, r);
    if (t !== null && t < best) best = t;
  }
  return best;
}

/** Liang–Barsky: t de entrada (0..1) o null. */
export function segRect(x1: number, y1: number, x2: number, y2: number, r: Rect): number | null {
  let t0 = 0, t1 = 1;
  const dx = x2 - x1, dy = y2 - y1;
  const p0 = -dx, p1 = dx, p2 = -dy, p3 = dy;
  const q0 = x1 - r.x, q1 = r.x + r.w - x1, q2 = y1 - r.y, q3 = r.y + r.h - y1;
  const ps = [p0, p1, p2, p3], qs = [q0, q1, q2, q3];
  for (let i = 0; i < 4; i++) {
    const p = ps[i], q = qs[i];
    if (p === 0) { if (q < 0) return null; continue; }
    const t = q / p;
    if (p < 0) { if (t > t1) return null; if (t > t0) t0 = t; }
    else { if (t < t0) return null; if (t < t1) t1 = t; }
  }
  return t0;
}
