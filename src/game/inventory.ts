import { ITEMS, ItemDef, Slot, TraitId, WeaponStats } from '../data/items';
import { RARITIES, Rarity } from '../data/rarity';
import { BACKPACK_SLOTS, SPEED_PENALTY_MAX, SPEED_PENALTY_PER_WEIGHT } from '../config/constants';
import { PRUEBA_V2 } from '../config/v2';
import { BAGS, FREE_BAG, LOAD_NOISE, LOOT_SIZE, LOOT_SIZE_WEIGHT, NO_BAG } from '../config/v4';
import { bestBuyback } from './prices';

/** Instancia concreta de un objeto (lo que se guarda). */
export interface ItemInst {
  uid: string;
  def: string;
  rarity: Rarity;
  qty: number;
  traits?: TraitId[];
  /** Equipo gratis: invendible, valor 0, se descarta al quitarlo. */
  free?: boolean;
  /** Balas en el cargador (pistola). */
  mag?: number;
  /** v3: ya tiene el rasgo extra del Taller (una vez por objeto). */
  mejorado?: boolean;
  /** v3.1: saqueado en esta incursión (id del snapshot). Solo eso compra el Trapero; se borra al acabar la incursión. */
  raid?: string;
}

export interface Loadout {
  arma: ItemInst | null;
  torso: ItemInst | null;
  cabeza: ItemInst | null;
  mochila: ItemInst[];
  bolsillo: ItemInst | null;
  /** v2: arma de reserva (cambio rápido en raid). Pesa y se pierde al morir como el resto. */
  reserva: ItemInst | null;
  /** v3: mochila mejor (Hierro): más casillas. */
  espalda?: ItemInst | null;
  /** v3: casillas extra del bolsillo seguro (estación Bolsillo nivel 2-3). Se conservan al morir. */
  bolsilloExtra?: ItemInst[];
}

export const emptyLoadout = (): Loadout => ({ arma: null, torso: null, cabeza: null, mochila: [], bolsillo: null, reserva: null, espalda: null, bolsilloExtra: [] });

/** Todo lo que va en el bolsillo seguro (casilla base + extras). */
export function pockets(l: Loadout): ItemInst[] {
  return [l.bolsillo, ...(l.bolsilloExtra ?? [])].filter((x): x is ItemInst => !!x);
}
/** v4 §1: la mochila equipada (o «sin mochila» = bolsillos). */
export function bagOf(l: Loadout) { return (l.espalda && BAGS[l.espalda.def]) || NO_BAG; }
/** Casillas de mochila según la mochila equipada (sin mochila 6 · riñonera 8 · escolar 12 · senderismo 16 · táctica 20 · anómala 26). */
export function backpackSlots(l: Loadout) {
  return bagOf(l).slots;
}
/** v4: casillas de consumible rápido (1 + la de la mochila de senderismo / táctica). */
export function quickSlots(l: Loadout) { return 1 + bagOf(l).quickExtra; }
/** v4: multiplicador del tiempo de aplicar consumibles (táctica: 15 % más rápido). */
export function useTimeMult(l: Loadout) { return bagOf(l).useTimeMult; }
/** v3: BACKPACK_SLOTS sigue siendo la mochila escolar gratuita. */
export const FREE_BAG_SLOTS = BACKPACK_SLOTS;

let counter = 0;
export function uid() {
  counter = (counter + 1) % 1e6;
  return Date.now().toString(36) + '-' + counter.toString(36) + '-' + Math.random().toString(36).slice(2, 7);
}

export function def(it: ItemInst): ItemDef { return ITEMS[it.def]; }

export function makeItem(id: string, rarity: Rarity = 'comun', qty = 1, traits?: TraitId[]): ItemInst {
  const d = ITEMS[id];
  const it: ItemInst = { uid: uid(), def: id, rarity: d.fixedRarity ?? (d.rolls ? rarity : 'comun'), qty: Math.min(qty, d.maxStack) };
  if (traits && traits.length) it.traits = traits;
  if (d.weapon?.mag) it.mag = 0;
  return it;
}

export function itemValue(it: ItemInst): number {
  if (it.free) return 0;
  const d = def(it);
  // v4: solo el equipo con rareza tirada multiplica por rareza (las mochilas tienen rareza fija y precio propio)
  return Math.round(d.value * (d.rolls ? RARITIES[it.rarity].valor : 1) * it.qty);
}
export function canSell(it: ItemInst) { return !it.free && it.def !== 'chapas'; }
/** v3: lo máximo que te paga algún vendedor (40 % del precio mínimo de su tienda, §6). */
export function sellPrice(it: ItemInst) { return canSell(it) ? bestBuyback(it).price : 0; }

export function itemWeight(it: ItemInst) {
  // v4 §1: el botín pesa por tamaño (pequeño 0,3 · mediano 1 · grande 2); armas, armaduras y mochilas, su peso
  const sz = LOOT_SIZE[it.def];
  const w = sz ? LOOT_SIZE_WEIGHT[sz] : def(it).weight;
  return w * it.qty * (it.traits?.includes('ligero') ? 0.7 : 1);
}

export function weaponStats(it: ItemInst | null): WeaponStats & { dmgMult: number } {
  const base = it ? def(it).weapon : undefined;
  if (!it || !base) return { dmg: 4, aps: 1.2, rangeTiles: 0.9, noise: 0, melee: true, ability: 'golpe', dmgMult: 1 }; // puños
  const r = RARITIES[it.rarity];
  const t = it.traits ?? [];
  const dmgMult = r.mult * (t.includes('dano') ? 1.1 : 1);
  return { ...base, dmg: base.dmg * dmgMult, dmgMult, aps: base.aps * (t.includes('cadencia') ? 1.1 : 1) * (base.melee ? 1 : PRUEBA_V2.rangedApsMult), rangeTiles: base.rangeTiles * (t.includes('alcance') ? 1.15 : 1) };
}

export function armorProtection(it: ItemInst | null) {
  if (!it) return 0;
  const a = def(it).armor; if (!a) return 0;
  return Math.min(0.75, a.protection * RARITIES[it.rarity].mult + (it.traits?.includes('proteccion') ? 0.05 : 0));
}

export function totalProtection(l: Loadout) {
  return Math.min(0.8, 1 - (1 - armorProtection(l.torso)) * (1 - armorProtection(l.cabeza)));
}

export function allItems(l: Loadout): ItemInst[] {
  return [l.arma, l.reserva ?? null, l.torso, l.cabeza, l.espalda ?? null, l.bolsillo, ...(l.bolsilloExtra ?? []), ...l.mochila].filter((x): x is ItemInst => !!x);
}
/** Peso total: lo de la mochila cuenta según la mochila (anómala: −20 %); lo equipado y los bolsillos, entero. */
export function totalWeight(l: Loadout) {
  const k = bagOf(l).contentWeightMult;
  const inBag = l.mochila.reduce((s, it) => s + itemWeight(it), 0);
  const rest = allItems(l).filter(it => !l.mochila.includes(it)).reduce((s, it) => s + itemWeight(it), 0);
  return rest + inBag * k;
}
/** v4 §1: casillas de ruido extra al andar por ir cargado (>12 → +1, >20 → +2). */
export function loadNoiseTiles(l: Loadout) {
  const w = totalWeight(l);
  for (const r of LOAD_NOISE) if (w > r.over) return r.tiles;
  return 0;
}
/** `freeWeight` (v4.0, Fuerza): peso que no ralentiza. */
export function speedMult(l: Loadout, freeWeight = 0) {
  return 1 - Math.min(SPEED_PENALTY_MAX, Math.max(0, totalWeight(l) - freeWeight) * SPEED_PENALTY_PER_WEIGHT);
}
export function gearValue(l: Loadout) { return allItems(l).reduce((s, it) => s + itemValue(it), 0); }

export function canPocket(it: ItemInst) {
  const d = def(it);
  return d.small && d.kind !== 'armadura' && d.kind !== 'mochila';
}

/** Mete un objeto en una lista con límite de casillas, apilando. Devuelve lo que no cabe (o null). */
export function addToList(list: ItemInst[], it: ItemInst, maxSlots: number): ItemInst | null {
  const d = def(it);
  if (d.maxStack > 1) {
    for (const o of list) {
      if (o.def === it.def && o.rarity === it.rarity && !o.free && (o.raid ?? null) === (it.raid ?? null) && o.qty < d.maxStack) {
        const n = Math.min(d.maxStack - o.qty, it.qty);
        o.qty += n; it.qty -= n;
        if (it.qty <= 0) return null;
      }
    }
  }
  if (list.length < maxSlots) { list.push(it); return null; }
  return it;
}

export function backpackAdd(l: Loadout, it: ItemInst) { return addToList(l.mochila, it, backpackSlots(l)); }

export function countOf(list: ItemInst[], id: string) { return list.filter(i => i.def === id).reduce((s, i) => s + i.qty, 0); }

/** Consume n unidades de un tipo de la lista. Devuelve cuántas consumió. */
export function consume(list: ItemInst[], id: string, n: number) {
  let left = n;
  for (let i = list.length - 1; i >= 0 && left > 0; i--) {
    const o = list[i];
    if (o.def !== id) continue;
    const k = Math.min(o.qty, left);
    o.qty -= k; left -= k;
    if (o.qty <= 0) list.splice(i, 1);
  }
  return n - left;
}

export function slotOf(it: ItemInst): Slot | undefined { return def(it).slot; }

/** Equipo gratis siempre disponible: bate Común + ropa + mochila escolar (v4), invendibles. */
export function freeItem(id: 'bate' | 'ropa' | typeof FREE_BAG): ItemInst {
  const it = makeItem(id, 'comun');
  it.free = true;
  return it;
}

export function itemLabel(it: ItemInst) {
  const d = def(it);
  return d.nombre + (it.qty > 1 ? ` ×${it.qty}` : '');
}

/**
 * Llena el cargador del arma equipada con la munición que llevas en la mochila.
 * Se llama al entrar en la raid: se entra con el arma cargada (la munición sale de la mochila
 * y queda guardada en el arma, `mag`, dentro del loadout/instantánea). Devuelve las balas cargadas.
 */
export function loadMagazine(lo: Loadout): number {
  let got = 0;
  for (const w of [lo.arma, lo.reserva ?? null]) {
    const ws = weaponStats(w);
    if (!w || !ws.mag) continue;
    const need = ws.mag - (w.mag ?? 0);
    if (need <= 0) continue;
    const g = consume(lo.mochila, 'municion', need);
    w.mag = (w.mag ?? 0) + g; got += g;
  }
  return got;
}
