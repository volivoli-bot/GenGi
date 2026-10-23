import { ITEMS, TRAITS, TraitId } from '../data/items';
import { RARITIES, Rarity, RARITY_ORDER_ALL, V1_DROP_RARITIES } from '../data/rarity';
import { ItemInst, makeItem } from './inventory';
import { MATERIAL_LOOT, MaterialId } from '../config/v3';
import { BAG_LOOT, SNOW, type MapDef } from '../config/v4';

type Rng = () => number;

/** v4b (§5): rarezas del mapa activo (lo fija la incursión al empezar). Sin mapa o en el mapa 1 todo sigue como en la v1. */
let LOOT_MAP: MapDef | null = null;
export function setLootMap(m: MapDef | null) { LOOT_MAP = m; }
export function lootMap() { return LOOT_MAP; }
/** Lleva una rareza al rango del mapa ([mín, máx]; el jefe puede llegar a `rarezaJefe`). */
export function clampToMap(r: Rarity, boss = false): Rarity {
  const m = LOOT_MAP;
  if (!m) return r;
  const lo = RARITIES[m.rarezas[0]].tier, hi = RARITIES[boss ? m.rarezaJefe : m.rarezas[1]].tier, t = RARITIES[r].tier;
  if (t < lo) return m.rarezas[0];
  if (t > Math.max(hi, RARITIES[m.rarezas[1]].tier)) return boss ? m.rarezaJefe : m.rarezas[1];
  return r;
}

/** Tirada de rareza: 60/30/10 en la v1. `bonus` (0..1) desplaza hacia arriba en zonas peligrosas. */
export function rollRarity(rng: Rng, bonus = 0): Rarity {
  const w = LOOT_MAP?.pesosRareza;
  if (w) {
    // mapas 2-4: pesos propios; el bonus sube las rarezas por encima de la más baja del mapa
    const base = RARITIES[LOOT_MAP!.rarezas[0]].tier;
    const pool = (Object.entries(w) as [Rarity, number][]).map(([r, v]) => ({ r, w: v * (RARITIES[r].tier === base ? 1 - bonus * 0.6 : 1 + bonus * (RARITIES[r].tier - base)) }));
    let x = rng() * pool.reduce((a, p) => a + p.w, 0);
    for (const p of pool) { x -= p.w; if (x <= 0) return clampToMap(p.r); }
    return clampToMap(pool[pool.length - 1].r);
  }
  const pool = V1_DROP_RARITIES.map(r => ({ r, w: RARITIES[r].peso * (r === 'comun' ? 1 - bonus * 0.6 : 1 + bonus * (RARITIES[r].tier - 1)) }));
  const total = pool.reduce((s, p) => s + p.w, 0);
  let x = rng() * total;
  for (const p of pool) { x -= p.w; if (x <= 0) return p.r; }
  return pool[pool.length - 1].r;
}

export function rollTraits(rng: Rng, itemId: string, rarity: Rarity): TraitId[] {
  const kind = ITEMS[itemId].kind;
  if (kind !== 'arma' && kind !== 'armadura') return [];
  const options = (Object.keys(TRAITS) as TraitId[]).filter(t => TRAITS[t].for.includes(kind));
  const out: TraitId[] = [];
  for (let i = 0; i < RARITIES[rarity].rasgos && options.length; i++) {
    out.push(options.splice(Math.floor(rng() * options.length), 1)[0]);
  }
  return out;
}

export function makeRolledGear(rng: Rng, id: string, rarity: Rarity) {
  return makeItem(id, rarity, 1, rollTraits(rng, id, rarity));
}

const TABLE: { id: string; w: number; qty?: [number, number] }[] = [
  { id: 'vendaje', w: 22, qty: [1, 2] },
  { id: 'chapas', w: 22, qty: [4, 20] },
  { id: 'botiquin', w: 6 },
  { id: 'municion', w: 5, qty: [4, 10] },
  { id: 'flechas', w: 5, qty: [3, 8] },
  { id: 'virotes', w: 3, qty: [3, 6] },
  { id: 'bengala', w: 4 },
  { id: 'bate', w: 6 },
  { id: 'machete', w: 6 },
  { id: 'arco', w: 4 },
  { id: 'ballesta', w: 3 },
  { id: 'pistola', w: 3 },
  { id: 'tablas', w: 6 },
  { id: 'chaleco', w: 2.5 },
  { id: 'casco', w: 3 },
  // v3: objetos nuevos de Doc Reyes / Hierro, raros en el mapa
  { id: 'granada', w: 1.2 },
  { id: 'antidoto', w: 1.2 },
  { id: 'adrenalina', w: 0.8 },
  { id: 'estimulante', w: 0.5 },
  // v4 §1: mochilas (rareza fija; no entran en las tiradas de solo equipo)
  ...Object.entries(BAG_LOOT).map(([id, w]) => ({ id, w })),
];

/** v3: una pila de material según el sitio (MATERIAL_LOOT.byZone). */
export function rollMaterial(rng: Rng, zoneName: string): ItemInst {
  const w = MATERIAL_LOOT.byZone[zoneName] ?? MATERIAL_LOOT.byZone.Calles;
  const ents = Object.entries(w) as [MaterialId, number][];
  let x = rng() * ents.reduce((s, e) => s + e[1], 0);
  let pick = ents[0][0];
  for (const [id, k] of ents) { x -= k; if (x <= 0) { pick = id; break; } }
  const [a, b] = MATERIAL_LOOT.qty;
  return makeItem(pick, 'comun', a + Math.floor(rng() * (b - a + 1)));
}

export function rollItem(rng: Rng, bonus = 0, forceRarity?: Rarity, gearOnly = false, boss = false): ItemInst {
  const table = gearOnly ? TABLE.filter(t => ITEMS[t.id].rolls) : TABLE;
  const total = table.reduce((s, t) => s + t.w, 0);
  let x = rng() * total;
  let pick = table[0];
  for (const t of table) { x -= t.w; if (x <= 0) { pick = t; break; } }
  const d = ITEMS[pick.id];
  if (d.rolls) return makeRolledGear(rng, pick.id, forceRarity ? clampToMap(forceRarity, boss) : rollRarity(rng, bonus));
  const q = pick.qty ? pick.qty[0] + Math.floor(rng() * (pick.qty[1] - pick.qty[0] + 1)) : 1;
  return makeItem(pick.id, 'comun', q);
}

/** v3.1 §9.5: botín de élite = 2 objetos; uno de equipo una rareza por encima de la tirada normal (tope: Militar). */
export function rollEliteDrops(rng: Rng): ItemInst[] {
  const normal = rollRarity(rng, 0);
  let up: Rarity;
  if (LOOT_MAP?.pesosRareza) up = clampToMap(RARITY_ORDER_ALL[Math.min(RARITY_ORDER_ALL.length - 1, RARITY_ORDER_ALL.indexOf(normal) + 1)]);
  else { const i = V1_DROP_RARITIES.indexOf(normal); up = V1_DROP_RARITIES[Math.min(V1_DROP_RARITIES.length - 1, i + 1)]; }
  return [rollItem(rng, 0, up, true), rollItem(rng, 0)];
}

export type ContainerKind = 'caja' | 'cerrada' | 'elite' | 'cadaver';

/** Tirada con pesos explícitos por rareza (v4: botín de la nieve). */
export function rollWeighted(rng: Rng, w: Partial<Record<Rarity, number>>): Rarity {
  const e = Object.entries(w) as [Rarity, number][];
  let x = rng() * e.reduce((a, [, v]) => a + v, 0);
  for (const [r, v] of e) { x -= v; if (x <= 0) return clampToMap(r); }
  return clampToMap(e[e.length - 1][0]);
}

/** v4 §4: botín de la guarida de la Matriarca: 3 objetos (uno Militar o mejor, 15 % Anomalía) y 50 % de Tarjeta del helipuerto. */
export function rollLair(rng: Rng): ItemInst[] {
  const top = LOOT_MAP?.rarezaJefe ?? 'anomalia';
  const out = [rollItem(rng, 1, rng() < 0.15 ? top : 'militar', true, true)];
  for (let i = 0; i < 2; i++) out.push(rollItem(rng, 1, rollWeighted(rng, SNOW.rarity)));
  if (rng() < SNOW.cardChance) out.push(makeItem('tarjeta_helipuerto', 'comun', 1));
  return out;
}

export function rollContainer(rng: Rng, kind: ContainerKind, bonus: number, snow = false): ItemInst[] {
  const out: ItemInst[] = [];
  if (snow && kind !== 'elite') {
    // v4: Zona Helada → rarezas propias (Común 45 / Reforzado 37 / Militar 18)
    const n = kind === 'caja' ? 1 + Math.floor(rng() * 2) : kind === 'cerrada' ? 2 + Math.floor(rng() * 3) : 1;
    for (let i = 0; i < n; i++) out.push(rollItem(rng, 0, rollWeighted(rng, SNOW.rarity)));
    if (out.some(i => i.def === 'arco')) out.push(makeItem('flechas', 'comun', 6));
    if (out.some(i => i.def === 'ballesta')) out.push(makeItem('virotes', 'comun', 5));
    return out;
  }
  if (kind === 'elite') {
    out.push(rollItem(rng, 1, 'militar', true));
    for (let i = 0; i < 2; i++) out.push(rollItem(rng, 1));
    return out;
  }
  const n = kind === 'caja' ? 1 + Math.floor(rng() * 2) : kind === 'cerrada' ? 2 + Math.floor(rng() * 3) : 1;
  const b = Math.min(1, bonus + (kind === 'cerrada' ? 0.35 : 0));
  for (let i = 0; i < n; i++) out.push(rollItem(rng, b));
  // un arco encontrado viene con unas flechas
  if (out.some(i => i.def === 'arco')) out.push(makeItem('flechas', 'comun', 6));
  if (out.some(i => i.def === 'ballesta')) out.push(makeItem('virotes', 'comun', 5));
  return out;
}

/** Generador pseudoaleatorio reproducible (mulberry32). */
export function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
