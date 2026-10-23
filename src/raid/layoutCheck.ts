import { MAP_TILES, TILE } from '../config/constants';
import type { ExitState } from '../save/types';
import { MapData, pointInWalls, Rect } from './map';

/**
 * v4: validador del trazado de una incursión (puro, sin escena). Rejilla de media casilla: una celda es transitable
 * si el jugador (radio ~13 px) cabe en su centro sin tocar paredes, coches ni puertas con llave (las puertas
 * normales se abren al pasar → transitables). BFS desde el inicio.
 */
export const CHECK = { cell: TILE / 2, playerR: 13 };

export interface LayoutReport {
  variant: string;
  spawn: { x: number; y: number };
  /** Salidas activas (+ helipuerto) alcanzables desde el inicio y distancia de camino (casillas). */
  exits: { loc: number; type: string; reachable: boolean; pathTiles: number }[];
  /** Objetos mal colocados: dentro de pared o fuera del mapa. */
  bad: { what: string; x: number; y: number; why: string }[];
  /** Contenedores que no se pueden alcanzar desde el inicio (informativo). */
  unreachableContainers: number;
  /** Distancias del inicio a la nieve (recta, casillas) y al helipuerto (camino, casillas). */
  spawnToSnowTiles: number | null;
  spawnToHelipadTiles: number | null;
  /** La guarida no tapa ninguna salida (distancia mínima del borde de la guarida a una salida, casillas). */
  lairToExitTiles: number | null;
  /** Todas las salidas siguen alcanzables aunque la guarida entera fuese pared (no hay que cruzarla). */
  exitsAvoidLair: boolean | null;
  cells: number;
}

export function blockedWalls(map: MapData): Rect[] {
  const locked = new Set(map.lockedDoors);
  return [...map.walls, ...map.doors.filter(d => locked.has(d.id))];
}

export function bfs(map: MapData, from: { x: number; y: number }, extraBlock: Rect[] = []) {
  const C = CHECK.cell, n = Math.ceil((MAP_TILES * TILE) / C);
  const walls = [...blockedWalls(map), ...extraBlock];
  const free = new Uint8Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = (i + 0.5) * C, y = (j + 0.5) * C;
    free[j * n + i] = x > CHECK.playerR && y > CHECK.playerR && x < MAP_TILES * TILE - CHECK.playerR && y < MAP_TILES * TILE - CHECK.playerR && !pointInWalls(walls, x, y, CHECK.playerR) ? 1 : 0;
  }
  const dist = new Int32Array(n * n).fill(-1);
  const cellOf = (x: number, y: number) => Math.max(0, Math.min(n - 1, Math.floor(y / C))) * n + Math.max(0, Math.min(n - 1, Math.floor(x / C)));
  // el inicio puede caer junto a un coche: arranca en la celda libre más cercana (radio 2 celdas)
  let s = cellOf(from.x, from.y);
  if (!free[s]) { outer: for (let r = 1; r <= 2; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) { const k = s + dj * n + di; if (k >= 0 && k < n * n && free[k]) { s = k; break outer; } } }
  const q = new Int32Array(n * n); let h = 0, t = 0;
  if (free[s]) { dist[s] = 0; q[t++] = s; }
  while (h < t) {
    const c = q[h++], ci = c % n, cj = (c - ci) / n;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const i = ci + di, j = cj + dj; if (i < 0 || j < 0 || i >= n || j >= n) continue;
      const k = j * n + i; if (!free[k] || dist[k] >= 0) continue;
      dist[k] = dist[c] + 1; q[t++] = k;
    }
  }
  /** Distancia de camino (casillas) a un punto: la celda alcanzable más cercana en un radio `r` px. */
  const reach = (x: number, y: number, r: number) => {
    let best = -1;
    const i0 = Math.floor((x - r) / C), i1 = Math.floor((x + r) / C), j0 = Math.floor((y - r) / C), j1 = Math.floor((y + r) / C);
    for (let j = Math.max(0, j0); j <= Math.min(n - 1, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(n - 1, i1); i++) {
      const cx = (i + 0.5) * C, cy = (j + 0.5) * C; if (Math.hypot(cx - x, cy - y) > r) continue;
      const d = dist[j * n + i]; if (d >= 0 && (best < 0 || d < best)) best = d;
    }
    return best < 0 ? null : (best * C) / TILE;
  };
  return { reach, cells: t };
}

export function checkLayout(map: MapData, exits: ExitState[], spawn: { x: number; y: number }, extra: { what: string; x: number; y: number; pad?: number }[] = []): LayoutReport {
  const W = MAP_TILES * TILE;
  const walls = blockedWalls(map);
  const { reach, cells } = bfs(map, spawn);
  const bad: LayoutReport['bad'] = [];
  const place = (what: string, x: number, y: number, pad = 10) => {
    if (!(x >= TILE * 0.5 && y >= TILE * 0.5 && x <= W - TILE * 0.5 && y <= W - TILE * 0.5)) bad.push({ what, x, y, why: 'fuera del mapa' });
    else if (pointInWalls(walls, x, y, pad)) bad.push({ what, x, y, why: 'dentro de una pared' });
  };
  place('inicio', spawn.x, spawn.y, 12);
  for (const c of map.containers) place('contenedor', c.x, c.y);
  for (const e of map.eliteBoxes) place(e.lair ? 'guarida' : 'caja de élite', e.x, e.y);
  for (const p of map.portals) { place('portal', p.x, p.y, 14); place('salida de portal', p.to.x, p.to.y, 14); }
  for (const x of extra) place(x.what, x.x, x.y, x.pad ?? 10);
  const R = TILE * 1.2;
  const exitRep = exits.map(e => { const d = reach(e.x, e.y, R); return { loc: e.loc, type: e.type, reachable: d !== null, pathTiles: d ?? -1 }; });
  let unreachableContainers = 0;
  for (const c of map.containers) if (reach(c.x, c.y, TILE * 0.9) === null) unreachableContainers++;
  let spawnToSnowTiles: number | null = null, spawnToHelipadTiles: number | null = null, lairToExitTiles: number | null = null, exitsAvoidLair: boolean | null = null;
  if (map.snow) {
    const sr = map.regions.find(r => r.id === map.snow!.region)!.rects;
    let d = Infinity;
    for (const r of sr) { const dx = Math.max(r.x - spawn.x, 0, spawn.x - (r.x + r.w)), dy = Math.max(r.y - spawn.y, 0, spawn.y - (r.y + r.h)); d = Math.min(d, Math.hypot(dx, dy)); }
    spawnToSnowTiles = d / TILE;
    const hp = map.exitLocs[map.snow.helipadLoc];
    spawnToHelipadTiles = hp ? reach(hp.x, hp.y, R) : null;
    const L = map.snow.lair;
    const noLair = bfs(map, spawn, [{ x: L.x, y: L.y, w: L.w, h: L.h }]);
    exitsAvoidLair = exits.every(e => noLair.reach(e.x, e.y, R) !== null);
    lairToExitTiles = Math.min(...map.exitLocs.map(p => Math.hypot(Math.max(L.x - p.x, 0, p.x - (L.x + L.w)), Math.max(L.y - p.y, 0, p.y - (L.y + L.h))) / TILE));
  }
  return { variant: map.variant, spawn, exits: exitRep, bad, unreachableContainers, spawnToSnowTiles, spawnToHelipadTiles, lairToExitTiles, exitsAvoidLair, cells };
}
