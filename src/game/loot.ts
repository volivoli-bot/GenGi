import { ITEMS, TRAITS, TraitId } from '../data/items';
import { RARITIES, Rarity, V1_DROP_RARITIES } from '../data/rarity';
import { ItemInst, makeItem } from './inventory';

type Rng = () => number;

/** Tirada de rareza: 60/30/10 en la v1. `bonus` (0..1) desplaza hacia arriba en zonas peligrosas. */
export function rollRarity(rng: Rng, bonus = 0): Rarity {
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
  { id: 'bengala', w: 4 },
  { id: 'bate', w: 6 },
  { id: 'machete', w: 6 },
  { id: 'arco', w: 4 },
  { id: 'pistola', w: 3 },
  { id: 'tablas', w: 6 },
  { id: 'chaleco', w: 2.5 },
  { id: 'casco', w: 3 },
];

export function rollItem(rng: Rng, bonus = 0, forceRarity?: Rarity, gearOnly = false): ItemInst {
  const table = gearOnly ? TABLE.filter(t => ITEMS[t.id].rolls) : TABLE;
  const total = table.reduce((s, t) => s + t.w, 0);
  let x = rng() * total;
  let pick = table[0];
  for (const t of table) { x -= t.w; if (x <= 0) { pick = t; break; } }
  const d = ITEMS[pick.id];
  if (d.rolls) return makeRolledGear(rng, pick.id, forceRarity ?? rollRarity(rng, bonus));
  const q = pick.qty ? pick.qty[0] + Math.floor(rng() * (pick.qty[1] - pick.qty[0] + 1)) : 1;
  return makeItem(pick.id, 'comun', q);
}

export type ContainerKind = 'caja' | 'cerrada' | 'elite' | 'cadaver';

export function rollContainer(rng: Rng, kind: ContainerKind, bonus: number): ItemInst[] {
  const out: ItemInst[] = [];
  if (kind === 'elite') {
    out.push(rollItem(rng, 1, 'militar', true));
    for (let i = 0; i < 2; i++) out.push(rollItem(rng, 1));
    return out;
  }
  const n = kind === 'caja' ? 1 + Math.floor(rng() * 2) : kind === 'cerrada' ? 2 + Math.floor(rng() * 3) : 1;
  const b = Math.min(1, bonus + (kind === 'cerrada' ? 0.35 : 0));
  for (let i = 0; i < n; i++) out.push(rollItem(rng, b));
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
