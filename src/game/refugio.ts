import { CRAFT_QUEUE_MAX, CRAFT_RAIDS, Cost, MATERIAL_IDS, POCKET_BY_LEVEL, RECIPES, Recipe, STASH_BY_LEVEL, StationId, STATIONS, TRAIT_UPGRADE_COST } from '../config/v3';
import { ITEMS, TRAITS, TraitId } from '../data/items';
import { RARITIES } from '../data/rarity';
import type { SaveData } from '../save/types';
import { addToList, countOf, consume, ItemInst, makeItem } from './inventory';

/** Refugio v3 (diseno-v3 §2): estaciones con 3 niveles, materiales del alijo, fabricación por raids. */
export const stationLevel = (d: SaveData, s: StationId) => d.refugio?.levels?.[s] ?? 1;
export const stashSlots = (d: SaveData) => STASH_BY_LEVEL[stationLevel(d, 'alijo') - 1] ?? STASH_BY_LEVEL[0];
export const pocketSlots = (d: SaveData) => POCKET_BY_LEVEL[stationLevel(d, 'bolsillo') - 1] ?? 1;

export type R = { ok: true } | { ok: false; msg: string };
const fail = (msg: string): R => ({ ok: false, msg });

/** Material disponible para gastar: alijo + excedente (no lo que llevas encima). */
export function have(d: SaveData, id: string) {
  if (id === 'chapas') return d.chapas;
  return countOf(d.stash, id) + countOf(d.overflow, id);
}
export function canAfford(d: SaveData, c: Cost) { return Object.entries(c).every(([k, n]) => have(d, k) >= (n ?? 0)); }
export function pay(d: SaveData, c: Cost) {
  for (const [k, n] of Object.entries(c)) {
    if (!n) continue;
    if (k === 'chapas') { d.chapas -= n; continue; }
    const got = consume(d.overflow, k, n);
    consume(d.stash, k, n - got);
  }
}
export function costText(c: Cost) {
  return Object.entries(c).map(([k, n]) => k === 'chapas' ? `${n} chapas` : `${n} ${ITEMS[k].nombre.toLowerCase()}`).join(' + ');
}
export function materialCounts(d: SaveData) { return MATERIAL_IDS.map(id => ({ id, n: have(d, id) })); }

/** ¿Se puede subir la estación? Devuelve el motivo si no. */
export function upgradeBlock(d: SaveData, s: StationId): string | null {
  const lv = stationLevel(d, s);
  const next = STATIONS[s].levels[lv];
  if (!next) return 'Nivel máximo';
  if (next.minLevel && (d.prog?.level ?? 1) < next.minLevel) return `Requiere nivel de personaje ${next.minLevel}`;
  // v4.0: el Gimnasio tiene 4 niveles; el Generador solo llega al 3
  const gen = Math.min(lv + 1, STATIONS.generador.levels.length);
  if (s !== 'generador' && stationLevel(d, 'generador') < gen) return `Requiere Generador nivel ${gen}`;
  if (!canAfford(d, next.cost!)) return 'Faltan materiales';
  return null;
}
export function upgrade(d: SaveData, s: StationId): R {
  const why = upgradeBlock(d, s); if (why) return fail(why);
  pay(d, STATIONS[s].levels[stationLevel(d, s)].cost!);
  d.refugio.levels[s] = stationLevel(d, s) + 1;
  return { ok: true };
}

// ---------- fabricación (Enfermería / Taller): tarda CRAFT_RAIDS raids
export const recipesFor = (s: StationId) => RECIPES.filter(r => r.station === s);
export function craftBlock(d: SaveData, r: Recipe): string | null {
  if (stationLevel(d, r.station) < r.level) return `Requiere ${STATIONS[r.station].nombre} nivel ${r.level}`;
  if (d.refugio.crafts.filter(c => RECIPES.find(x => x.id === c.recipe)?.station === r.station).length >= CRAFT_QUEUE_MAX) return 'Cola llena';
  if (!canAfford(d, r.cost)) return 'Faltan materiales';
  return null;
}
export function craft(d: SaveData, id: string): R {
  const r = RECIPES.find(x => x.id === id); if (!r) return fail('Receta desconocida');
  const why = craftBlock(d, r); if (why) return fail(why);
  pay(d, r.cost);
  d.refugio.crafts.push({ recipe: r.id, readyAt: d.stats.raids + CRAFT_RAIDS });
  return { ok: true };
}
/** Entrega al alijo lo que ya esté listo. Devuelve los nombres entregados. */
export function deliverCrafts(d: SaveData): string[] {
  const out: string[] = [];
  d.refugio.crafts = d.refugio.crafts.filter(c => {
    if (d.stats.raids < c.readyAt) return true;
    const r = RECIPES.find(x => x.id === c.recipe);
    if (r) { const it = makeItem(r.out, 'comun', r.qty); const left = addToList(d.stash, it, stashSlots(d)); if (left) d.overflow.push(left); out.push(r.nombre); }
    return false;
  });
  return out;
}

// ---------- Taller nivel 3: +1 rasgo
export function traitOptions(it: ItemInst): TraitId[] {
  const kind = ITEMS[it.def].kind;
  if (kind !== 'arma' && kind !== 'armadura') return [];
  return (Object.keys(TRAITS) as TraitId[]).filter(t => TRAITS[t].for.includes(kind) && !(it.traits ?? []).includes(t));
}
export function traitBlock(d: SaveData, it: ItemInst): string | null {
  if (stationLevel(d, 'taller') < 3) return 'Requiere Taller nivel 3';
  if (it.free) return 'El equipo gratis no se mejora';
  if (it.mejorado) return 'Ya tiene el rasgo extra';
  if (RARITIES[it.rarity].tier < RARITIES.reforzado.tier) return 'Solo Reforzado o mejor';
  if (!traitOptions(it).length) return 'No le caben más rasgos';
  if (!canAfford(d, TRAIT_UPGRADE_COST)) return 'Faltan materiales';
  return null;
}
export function addTrait(d: SaveData, it: ItemInst, rng = Math.random): R {
  const why = traitBlock(d, it); if (why) return fail(why);
  pay(d, TRAIT_UPGRADE_COST);
  const opts = traitOptions(it);
  it.traits = [...(it.traits ?? []), opts[Math.floor(rng() * opts.length)]];
  it.mejorado = true;
  return { ok: true };
}
