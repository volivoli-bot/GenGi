import { MAP_TILES, TILE } from '../config/constants';
import { ARRABAL, DEFAULT_MAP, MapDef, MapVariation, mapDef, SNOW } from '../config/v4';
import { ContainerKind, seeded } from '../game/loot';

export interface Rect { x: number; y: number; w: number; h: number }
export type ZoneKind = 'calle' | 'casa' | 'tienda' | 'alto';
export interface Zone { kind: ZoneKind; name: string; rect: Rect; bonus: number }
export interface Door extends Rect { id: number; horiz: boolean }
export interface Region { id: string; nombre: string; rects: Rect[]; biome: 'urbano' | 'nieve' }
export interface MapData {
  id: string;
  /** v4: id de la definición del mapa (config/v4 MAPS) y variante de esta incursión (franja nevada). */
  defId: string;
  variant: string;
  walls: Rect[];
  cars: (Rect & { rot: number })[];
  doors: Door[];
  /** v4: puertas cerradas con llave en esta incursión (ids; se tratan como pared). */
  lockedDoors: number[];
  floors: Rect[];
  zones: Zone[];
  /** v4: franjas del mapa y su bioma en esta incursión. */
  regions: Region[];
  /** v4: región nevada de esta incursión (null = sin nieve) con la guarida y el helipuerto. */
  snow: { region: string; lair: Rect & { cx: number; cy: number }; helipadLoc: number } | null;
  /** Puntos de aparición posibles (4 por variante, lejos de la nieve). */
  spawns: { x: number; y: number }[];
  spawn: { x: number; y: number };
  /** Salidas: 0 = norte, 1 = oeste, 2 = este; 3 = helipuerto (solo con nieve). */
  exitLocs: { x: number; y: number }[];
  exitLocNames: string[];
  containers: { x: number; y: number; kind: ContainerKind; bonus: number }[];
  eliteBoxes: { x: number; y: number; zone: string; lair?: boolean }[];
  signs: { x: number; y: number; ang: number; exit: number }[];
  /** v4: portales (mapa 3); el mapa 1 no tiene. Se validan igual que el botín. */
  portals: { x: number; y: number; to: { x: number; y: number } }[];
  danger: { x: number; y: number; r: number };
  eliteBox: { x: number; y: number };
}

const T = TILE;
const TH = 0.5 * T; // grosor de pared
/** Conector estándar de las piezas: distrito de BLOCK casillas rodeado de calle de STREET casillas. */
export const BLOCK = 19, STREET = 6, ORIGIN = 4;
export const blockX = (i: number) => ORIGIN + i * (BLOCK + STREET);
const blockY = blockX;
/** Centro de la calle a la izquierda/arriba de la columna/fila i (en casillas). */
export const streetC = (i: number) => blockX(i) - STREET / 2;

const BIG: Record<string, { name: string; kind: ZoneKind; rooms: [number, number] }> = {
  hospital: { name: 'Hospital', kind: 'alto', rooms: [5, 6] },
  comisaria: { name: 'Comisaría', kind: 'alto', rooms: [4, 6] },
  almacen: { name: 'Almacén militar', kind: 'alto', rooms: [3, 5] },
  super: { name: 'Supermercado', kind: 'tienda', rooms: [3, 4] },
  bloque: { name: 'Bloque de pisos', kind: 'casa', rooms: [5, 6] },
};
const BONUS: Record<ZoneKind, number> = { calle: 0, casa: 0.3, tienda: 0.4, alto: 0.85 };

interface Seg { horiz: boolean; c: number; a: number; b: number; outer: boolean } // en casillas: línea c, de a a b

/** Lo que una pieza puede construir (coordenadas absolutas en casillas; la pieza solo conoce su origen). */
interface ChunkApi {
  rng: () => number;
  /** rng que cambia en cada incursión (interiores variables). */
  raidRng: () => number;
  variableInterior: (zoneName: string) => boolean;
  building(bx: number, by: number, bw: number, bh: number, nRooms: number, z: Zone, entrances: number, doorChance: number, elite: boolean, sides?: number[]): void;
  car(x: number, y: number, horiz: boolean): void;
  cover(x: number, y: number, w: number, h: number): void;
  zone(z: Zone): void;
  container(x: number, y: number, kind: ContainerKind, bonus: number): void;
  eliteBox(x: number, y: number, zone: string, lair?: boolean): void;
  wall(r: Rect): void;
  keepClear: { x: number; y: number }[];
}
/** Pieza (distrito) hecha a mano: mismo conector (calle) en los 4 lados. */
export interface DistrictDef { id: string; build(api: ChunkApi, x0: number, y0: number): void }

export const DISTRICTS: Record<string, DistrictDef> = {
  ...Object.fromEntries(Object.keys(BIG).map(id => [id, { id, build(api: ChunkApi, x0: number, y0: number) {
    const b = BIG[id], rng = api.rng;
    const n = b.rooms[0] + Math.floor(rng() * (b.rooms[1] - b.rooms[0] + 1));
    api.building(x0 + 1, y0 + 1, BLOCK - 2, BLOCK - 2, n, { kind: b.kind, name: b.name, rect: { x: (x0 + 1) * T, y: (y0 + 1) * T, w: (BLOCK - 2) * T, h: (BLOCK - 2) * T }, bonus: BONUS[b.kind] }, b.kind === 'alto' ? 2 : 3, b.kind === 'alto' ? 0.75 : 0.5, b.kind === 'alto');
  } }])),
  casas: { id: 'casas', build(api, x0, y0) {
    // 3-4 casas pequeñas de 1-2 habitaciones con patio; las entradas dan a la calle (nunca a la casa de al lado)
    const rng = api.rng;
    const slots = [[0, 0], [9.5, 0], [0, 9.5], [9.5, 9.5]].sort(() => rng() - 0.5).slice(0, 3 + (rng() < 0.5 ? 1 : 0));
    for (const [ox, oy] of slots) {
      const w = 7 + Math.floor(rng() * 2), h = 7 + Math.floor(rng() * 2);
      const hx = x0 + ox + 0.5 + rng() * (8.5 - w), hy = y0 + oy + 0.5 + rng() * (8.5 - h);
      api.building(Math.round(hx), Math.round(hy), w, h, rng() < 0.6 ? 2 : 1, { kind: 'casa', name: 'Casas', rect: { x: Math.round(hx) * T, y: Math.round(hy) * T, w: w * T, h: h * T }, bonus: BONUS.casa }, 1 + (rng() < 0.4 ? 1 : 0), 0.55, false, [oy === 0 ? 0 : 1, ox === 0 ? 2 : 3]);
    }
  } },
  aparcamiento: { id: 'aparcamiento', build(api, x0, y0) {
    const rng = api.rng;
    api.zone({ kind: 'calle', name: 'Aparcamiento', rect: { x: x0 * T, y: y0 * T, w: BLOCK * T, h: BLOCK * T }, bonus: 0.1 });
    for (let row = 0; row < 3; row++) for (let c = 0; c < 6; c++) if (rng() < 0.6) api.car((x0 + 2 + c * 3) * T, (y0 + 3 + row * 6.5) * T, false);
    api.container((x0 + BLOCK / 2) * T, (y0 + BLOCK / 2) * T, 'caja', 0.1);
  } },
  ...Object.fromEntries((['parque', 'plaza'] as const).map(id => [id, { id, build(api: ChunkApi, x0: number, y0: number) {
    // parque / plaza: muretes y jardineras como cobertura
    const rng = api.rng;
    api.zone({ kind: 'calle', name: id === 'plaza' ? 'Plaza' : 'Parque', rect: { x: x0 * T, y: y0 * T, w: BLOCK * T, h: BLOCK * T }, bonus: 0.05 });
    for (let k = 0; k < 9; k++) {
      const horiz = rng() < 0.5;
      const w = horiz ? 2 + rng() * 2.5 : 0.7, h = horiz ? 0.7 : 2 + rng() * 2.5;
      const x = x0 + 1.5 + rng() * (BLOCK - 5), y = y0 + 1.5 + rng() * (BLOCK - 5);
      if (api.keepClear.some(p => Math.hypot(p.x - x * T, p.y - y * T) < 5 * T)) continue;
      api.cover(x, y, w, h);
    }
    for (let k = 0; k < 2; k++) api.container((x0 + 3 + rng() * (BLOCK - 6)) * T, (y0 + 3 + rng() * (BLOCK - 6)) * T, 'caja', 0.05);
  } }])),
  /** Guarida de la Matriarca (solo en la franja nevada): presa helada, arena abierta con columnas y 4 entradas anchas. */
  presa: { id: 'presa', build(api, x0, y0) {
    const z: Zone = { kind: 'alto', name: 'Presa helada', rect: { x: (x0 + 1) * T, y: (y0 + 1) * T, w: (BLOCK - 2) * T, h: (BLOCK - 2) * T }, bonus: BONUS.alto };
    api.zone(z);
    const a = 1, b = BLOCK - 1, gap = 5, m0 = (BLOCK - gap) / 2, m1 = m0 + gap;
    // murete perimetral con un hueco de 5 casillas en el centro de cada lado
    for (const [c, horiz] of [[a, true], [b, true], [a, false], [b, false]] as [number, boolean][]) {
      for (const [p0, p1] of [[a, m0], [m1, b]]) {
        if (horiz) api.wall({ x: (x0 + p0) * T, y: (y0 + c) * T - TH / 2, w: (p1 - p0) * T, h: TH });
        else api.wall({ x: (x0 + c) * T - TH / 2, y: (y0 + p0) * T, w: TH, h: (p1 - p0) * T });
      }
    }
    // 6 columnas para cubrirse
    for (const [cx, cy] of [[5, 5], [14, 5], [5, 14], [14, 14], [9.5, 4.5], [9.5, 14.5]]) api.cover(x0 + cx - 0.6, y0 + cy - 0.6, 1.2, 1.2);
    api.eliteBox((x0 + BLOCK / 2) * T, (y0 + BLOCK / 2) * T, z.name, true);
  } },
};

/** Semilla de pieza: cada distrito tiene su propio generador (no depende de lo que haya alrededor → piezas intercambiables). */
const chunkSeed = (base: number, district: string, i: number, j: number) => {
  let h = (base ^ Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(j + 1, 0x85ebca6b)) >>> 0;
  for (let k = 0; k < district.length; k++) h = Math.imul(h ^ district.charCodeAt(k), 0x01000193) >>> 0;
  return h;
};

export interface GenOptions {
  /** Franja nevada forzada (índice) o null = sin nieve; por defecto la elige la semilla de la incursión. */
  snowStrip?: number | null;
  /** Variación por incursión (por defecto la de la definición del mapa). */
  variation?: MapVariation;
  def?: MapDef;
}

/** Franja nevada de una incursión (una de 3, al azar con la semilla). */
export function snowStripFor(raidSeed: number) {
  const w = ARRABAL.snowWeights, tot = w.reduce((a, b) => a + b, 0);
  let x = seeded((raidSeed ^ 0x736e6f77) >>> 0)() * tot;
  for (let i = 0; i < w.length; i++) { x -= w[i]; if (x < 0) return i; }
  return w.length - 1;
}

/** Rectángulos de una franja: sus distritos más media calle alrededor (hasta el borde del mapa si tocan el borde). */
function stripRects(cells: [number, number][]): Rect[] {
  const N = MAP_TILES;
  return cells.map(([i, j]) => {
    const x0 = i === 0 ? 0 : blockX(i) - STREET / 2, x1 = i === 3 ? N : blockX(i) + BLOCK + STREET / 2;
    const y0 = j === 0 ? 0 : blockX(j) - STREET / 2, y1 = j === 3 ? N : blockX(j) + BLOCK + STREET / 2;
    return { x: x0 * T, y: y0 * T, w: (x1 - x0) * T, h: (y1 - y0) * T };
  });
}
export function distToRects(rects: Rect[], x: number, y: number) {
  let best = Infinity;
  for (const r of rects) {
    const dx = Math.max(r.x - x, 0, x - (r.x + r.w)), dy = Math.max(r.y - y, 0, y - (r.y + r.h));
    best = Math.min(best, Math.hypot(dx, dy));
  }
  return best;
}
export function regionAt(map: MapData, x: number, y: number): Region | null {
  for (const g of map.regions) if (g.rects.some(r => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h)) return g;
  return null;
}
/** 0..1: cuánta nieve hay en este punto (frontera de SNOW.edgeTiles casillas). */
export function snowAt(map: MapData, x: number, y: number) {
  if (!map.snow) return 0;
  const g = map.regions.find(r => r.id === map.snow!.region)!;
  if (!g.rects.some(r => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h)) return 0;
  // distancia al exterior de la región
  const others = map.regions.filter(r => r !== g).flatMap(r => r.rects);
  const d = distToRects(others, x, y) / T;
  return Math.max(0, Math.min(1, d / SNOW.edgeTiles));
}

/**
 * Mapa 1 «El Arrabal» por piezas: trazado FIJO (las calles y las salidas 0-2 son siempre iguales); en cada incursión
 * cambian la franja nevada (con su guarida y helipuerto), los puntos de inicio y lo que diga la variación del mapa.
 */
export function generateMap(raidSeed = 0, opts: GenOptions = {}): MapData {
  const def = opts.def ?? mapDef(DEFAULT_MAP);
  const V = opts.variation ?? def.variacion;
  // v4c: un mapa sin zona de nieve en su definición no tiene franja nevada
  const hasSnowZone = def.zonas.some(z => z.bioma === 'nieve');
  const snowIdx = !hasSnowZone ? null : opts.snowStrip === undefined ? snowStripFor(raidSeed) : opts.snowStrip;
  const rng = seeded(def.layoutSeed);
  const raidRng = seeded((raidSeed ^ 0x51a7e) >>> 0);
  const walls: Rect[] = [], floors: Rect[] = [], zones: Zone[] = [], doors: Door[] = [];
  const cars: MapData['cars'] = [];
  const containers: MapData['containers'] = [];
  const eliteBoxes: MapData['eliteBoxes'] = [];
  const signs: MapData['signs'] = [];
  const N = MAP_TILES;
  const exitLocs = [
    { x: streetC(2) * T, y: 2.2 * T },
    { x: 2 * T, y: (blockX(1) + BLOCK / 2) * T },
    { x: (N - 2.2) * T, y: (blockX(2) + BLOCK / 2) * T },
  ];
  const exitLocNames = ['Túnel norte', 'Puerta del hospital', 'Muelle del almacén'];
  const helipads = ARRABAL.strips.map(s => ({ x: s.helipad.x * T, y: s.helipad.y * T }));
  // candidatos de inicio: cruces de calles y puntos del borde sur (en casillas → px)
  const lines = [2.6, streetC(1), streetC(2), streetC(3), N - 2.6];
  const cands: { x: number; y: number }[] = [];
  const along = [2.6, 14, streetC(1), 39, streetC(2), 64, streetC(3), 89, N - 2.6];
  for (const a of lines) for (const b of along) { cands.push({ x: a * T, y: b * T }); if (!lines.includes(b)) cands.push({ x: b * T, y: a * T }); }
  // las calles y los coches no dependen de la variante: se aparta de TODOS los sitios posibles
  const keepClear = [...cands, ...exitLocs, ...helipads];
  let doorId = 0;

  const addSegWalls = (s: Seg, gaps: [number, number][]) => {
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

  const makeApi = (crng: () => number): ChunkApi => {
    const api: ChunkApi = {
      rng: crng, raidRng, keepClear,
      variableInterior: (n) => V.variableInteriors.includes(n),
      zone: (z) => { zones.push(z); },
      container: (x, y, kind, bonus) => { containers.push({ x, y, kind, bonus }); },
      eliteBox: (x, y, zone, lair) => { eliteBoxes.push(lair ? { x, y, zone, lair } : { x, y, zone }); },
      wall: (r) => { walls.push(r); },
      cover: (x, y, w, h) => { walls.push({ x: x * T, y: y * T, w: w * T, h: h * T }); },
      car: (x, y, horiz) => {
        const w = horiz ? 2.4 * T : 1.1 * T, h = horiz ? 1.1 * T : 2.4 * T;
        const r = { x: x - w / 2, y: y - h / 2, w, h };
        if (keepClear.some(p => Math.abs(p.x - x) < 4 * T && Math.abs(p.y - y) < 4 * T)) return;
        if (walls.some(o => o.x < r.x + r.w + 8 && o.x + o.w > r.x - 8 && o.y < r.y + r.h + 8 && o.y + o.h > r.y - 8)) return;
        walls.push(r); cars.push({ ...r, rot: horiz ? Math.PI / 2 : 0 });
      },
      building: (bx, by, bw, bh, nRooms, z, entrances, doorChance, elite, allowed) => {
        // interior variable: las habitaciones (no la fachada ni las entradas) se rehacen con la semilla de la incursión
        const ir = api.variableInterior(z.name) ? raidRng : crng;
        zones.push(z);
        floors.push({ x: bx * T, y: by * T, w: bw * T, h: bh * T });
        const rooms: Rect[] = [{ x: bx, y: by, w: bw, h: bh }];
        const segs: Seg[] = [
          { horiz: true, c: by, a: bx, b: bx + bw, outer: true }, { horiz: true, c: by + bh, a: bx, b: bx + bw, outer: true },
          { horiz: false, c: bx, a: by, b: by + bh, outer: true }, { horiz: false, c: bx + bw, a: by, b: by + bh, outer: true },
        ];
        let guard = 0;
        while (rooms.length < nRooms && guard++ < 50) {
          rooms.sort((p, q) => q.w * q.h - p.w * p.h);
          const r = rooms[0];
          const vertical = r.w > r.h ? true : r.w < r.h ? false : ir() < 0.5;
          const len = vertical ? r.w : r.h;
          if (len < 10) break;
          const cut = Math.round(len * (0.38 + ir() * 0.24));
          rooms.shift();
          if (vertical) {
            rooms.push({ x: r.x, y: r.y, w: cut, h: r.h }, { x: r.x + cut, y: r.y, w: r.w - cut, h: r.h });
            segs.push({ horiz: false, c: r.x + cut, a: r.y, b: r.y + r.h, outer: false });
          } else {
            rooms.push({ x: r.x, y: r.y, w: r.w, h: cut }, { x: r.x, y: r.y + cut, w: r.w, h: r.h - cut });
            segs.push({ horiz: true, c: r.y + cut, a: r.x, b: r.x + r.w, outer: false });
          }
        }
        const pickGap = (s: Seg, len: number, g: () => number): [number, number] => {
          const junctions: number[] = [];
          for (const o of segs) {
            if (o === s || o.horiz === s.horiz) continue;
            if ((Math.abs(o.a - s.c) < 0.01 || Math.abs(o.b - s.c) < 0.01) && o.c > s.a - 0.01 && o.c < s.b + 0.01) junctions.push(o.c);
          }
          for (let i = 0; i < 30; i++) {
            const g0 = s.a + 0.8 + g() * Math.max(0, s.b - s.a - len - 1.6), g1 = g0 + len;
            if (junctions.every(j => j < g0 - 0.7 || j > g1 + 0.7)) return [g0, g1];
          }
          const m = (s.a + s.b) / 2; return [m - len / 2, m + len / 2];
        };
        const outer = segs.filter(s => s.outer);
        const sides = (allowed ?? [0, 1, 2, 3]).slice().sort(() => crng() - 0.5).slice(0, entrances);
        outer.forEach((s, i) => {
          if (!sides.includes(i)) { addSegWalls(s, []); return; }
          const g = pickGap(s, 2, ir);
          addSegWalls(s, [g]);
          if (crng() < doorChance) addDoor(s, g[0], g[1]);
        });
        for (const s of segs.filter(s => !s.outer)) {
          const g = pickGap(s, 1.9, ir);
          addSegWalls(s, [g]);
          if (crng() < doorChance) addDoor(s, g[0], g[1]);
        }
        rooms.sort((p, q) => q.w * q.h - p.w * p.h);
        rooms.forEach((r, i) => {
          const cx = (r.x + r.w / 2) * T, cy = (r.y + r.h / 2) * T;
          if (elite && i === 0) { eliteBoxes.push({ x: cx, y: cy, zone: z.name }); return; }
          const n = 1 + (ir() < (z.kind === 'alto' ? 0.6 : 0.3) ? 1 : 0);
          for (let k = 0; k < n; k++) {
            const px = (r.x + 1.2 + ir() * Math.max(0.1, r.w - 2.4)) * T, py = (r.y + 1.2 + ir() * Math.max(0.1, r.h - 2.4)) * T;
            containers.push({ x: px, y: py, kind: ir() < (z.kind === 'alto' ? 0.5 : z.kind === 'calle' ? 0.05 : 0.25) ? 'cerrada' : 'caja', bonus: z.bonus });
          }
        });
      },
    };
    return api;
  };

  // piezas: cada distrito con su propio generador; en la franja nevada, la guarida sustituye a su distrito
  const snowStrip = snowIdx === null ? null : ARRABAL.strips[snowIdx];
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
    let id = ARRABAL.plan[j][i];
    if (snowStrip && snowStrip.lair[0] === i && snowStrip.lair[1] === j) id = 'presa';
    DISTRICTS[id].build(makeApi(seeded(chunkSeed(def.layoutSeed, id, i, j))), blockX(i), blockY(j));
  }
  // calles (conectores entre piezas): coches abandonados (sin cerrarlas: dejan siempre carril) y cajas sueltas
  const street = makeApi(rng);
  for (let k = 0; k < 26; k++) {
    const vertical = rng() < 0.5;
    const s = Math.floor(rng() * 5);
    const along = (5 + rng() * (N - 10)) * T;
    const lane = (s === 0 ? 2 : streetC(s)) + (rng() < 0.5 ? -1.4 : 1.4);
    if (vertical) street.car(lane * T, along, false); else street.car(along, lane * T, true);
  }
  for (let k = 0; k < 14; k++) {
    const s = Math.floor(rng() * 4) + 1, along = (5 + rng() * (N - 10)) * T;
    const x = rng() < 0.5 ? streetC(s) * T : along, y = x === along ? streetC(s) * T : along;
    if (walls.some(r => x > r.x - T && x < r.x + r.w + T && y > r.y - T && y < r.y + r.h + T)) continue;
    containers.push({ x, y, kind: 'caja', bonus: 0 });
  }
  // helipuerto: salida extra (índice 3) solo en la variante nevada
  if (snowStrip) { exitLocs.push(helipads[snowIdx!]); exitLocNames.push('Helipuerto del radar'); }
  // carteles de evacuación (apuntan a la salida normal más cercana)
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
    const x0 = blockX(i), y0 = blockY(j);
    const corners = [[x0 - 0.2, y0 - 0.2], [x0 + BLOCK + 0.2, y0 + BLOCK + 0.2]];
    const [cx, cy] = corners[(i + j) % 2];
    const px = cx * T, py = cy * T;
    let best = 0, bd = Infinity;
    exitLocs.slice(0, 3).forEach((e, k) => { const d = Math.hypot(e.x - px, e.y - py); if (d < bd) { bd = d; best = k; } });
    if (rng() < 0.33) continue;
    signs.push({ x: px, y: py, ang: Math.atan2(exitLocs[best].y - py, exitLocs[best].x - px), exit: best });
  }
  zones.push({ kind: 'calle', name: 'Calles', rect: { x: 0, y: 0, w: N * T, h: N * T }, bonus: 0 });

  // regiones (franjas) y bioma de esta incursión
  const regions: Region[] = ARRABAL.strips.map((s, k) => ({ id: s.id, nombre: s.nombre, rects: stripRects(s.cells), biome: k === snowIdx ? 'nieve' : 'urbano' }));
  let snow: MapData['snow'] = null;
  if (snowStrip) {
    const [li, lj] = snowStrip.lair;
    const lx = blockX(li), ly = blockY(lj);
    snow = { region: snowStrip.id, lair: { x: lx * T, y: ly * T, w: BLOCK * T, h: BLOCK * T, cx: (lx + BLOCK / 2) * T, cy: (ly + BLOCK / 2) * T }, helipadLoc: 3 };
  }
  // inicio: 4 puntos lejos de la nieve (a unas targetTiles casillas), separados entre sí
  const S = ARRABAL.spawn;
  let spawns: { x: number; y: number }[];
  if (snow) {
    const sr = regions.find(r => r.id === snow!.region)!.rects;
    const hp = helipads[snowIdx!];
    // puntuación: cerca de la distancia objetivo a la nieve y al helipuerto (iguales en las 3 variantes)
    const score = (p: { x: number; y: number }) => Math.abs(distToRects(sr, p.x, p.y) / T - S.targetTiles) / S.targetTiles + Math.abs(Math.hypot(p.x - hp.x, p.y - hp.y) / T - S.heliTargetTiles) / S.heliTargetTiles;
    const ok = cands.filter(p => !pointInWalls(walls, p.x, p.y, T) && distToRects(sr, p.x, p.y) >= S.minFromSnowTiles * T && exitLocs.every(e => Math.hypot(e.x - p.x, e.y - p.y) >= S.minFromExitTiles * T))
      .sort((a, b) => score(a) - score(b));
    spawns = [];
    for (const p of ok) { if (spawns.length >= S.count) break; if (spawns.every(q => Math.hypot(q.x - p.x, q.y - p.y) >= S.minApartTiles * T)) spawns.push(p); }
  } else spawns = [1, 2, 3].map(i => ({ x: streetC(i) * T, y: (N - 2.5) * T }));

  // variación por incursión: contenedores, puertas con llave (las comprueba el validador: nunca cortan una salida)
  const vr = seeded((raidSeed ^ 0x7a71a) >>> 0);
  const lockedDoors = V.lockedDoorChance > 0 ? doors.filter(() => vr() < V.lockedDoorChance).map(d => d.id) : [];
  // una puerta con llave cuenta como pared: el botín no puede quedar en su hueco
  const solid = lockedDoors.length ? [...walls, ...doors.filter(d => lockedDoors.includes(d.id))] : walls;
  // saneado: nada de botín dentro de una pared o fuera del mapa (antes lo filtraba la escena al poblar)
  let conts = containers.filter(c => !pointInWalls(solid, c.x, c.y, 10) && c.x > T && c.y > T && c.x < (N - 1) * T && c.y < (N - 1) * T);
  if (V.containerKeep < 1 || V.containerJitterTiles > 0) {
    const src = conts;
    conts = [];
    for (const c of src) {
      if (vr() >= V.containerKeep) continue;
      let { x, y } = c;
      if (V.containerJitterTiles > 0) {
        const nx = x + (vr() - 0.5) * 2 * V.containerJitterTiles * T, ny = y + (vr() - 0.5) * 2 * V.containerJitterTiles * T;
        if (!pointInWalls(solid, nx, ny, 14) && nx > T && ny > T && nx < (N - 1) * T && ny < (N - 1) * T) { x = nx; y = ny; }
      }
      conts.push({ ...c, x, y });
    }
  }

  const hi = zones.find(z => z.kind === 'alto')!;
  const danger = { x: hi.rect.x + hi.rect.w / 2, y: hi.rect.y + hi.rect.h / 2, r: hi.rect.w / 2 };
  return {
    id: def.saveId, defId: def.id, variant: snowStrip ? `nieve-${snowStrip.id}` : 'sin-nieve',
    walls, cars, doors, lockedDoors, floors, zones, regions, snow, spawns, spawn: spawns[1] ?? spawns[0], exitLocs, exitLocNames,
    containers: conts, eliteBoxes, signs, portals: [], danger, eliteBox: eliteBoxes[0] ?? { x: danger.x, y: danger.y },
  };
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
