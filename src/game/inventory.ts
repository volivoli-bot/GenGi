import { ITEMS, ItemDef, Slot, TraitId, WeaponStats } from '../data/items';
import { RARITIES, Rarity } from '../data/rarity';
import { BACKPACK_SLOTS, SPEED_PENALTY_MAX, SPEED_PENALTY_PER_WEIGHT } from '../config/constants';

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
}

export interface Loadout {
  arma: ItemInst | null;
  torso: ItemInst | null;
  cabeza: ItemInst | null;
  mochila: ItemInst[];
  bolsillo: ItemInst | null;
  /** v2: arma de reserva (cambio rápido en raid). Pesa y se pierde al morir como el resto. */
  reserva: ItemInst | null;
}

export const emptyLoadout = (): Loadout => ({ arma: null, torso: null, cabeza: null, mochila: [], bolsillo: null, reserva: null });

let counter = 0;
export function uid() {
  counter = (counter + 1) % 1e6;
  return Date.now().toString(36) + '-' + counter.toString(36) + '-' + Math.random().toString(36).slice(2, 7);
}

export function def(it: ItemInst): ItemDef { return ITEMS[it.def]; }

export function makeItem(id: string, rarity: Rarity = 'comun', qty = 1, traits?: TraitId[]): ItemInst {
  const d = ITEMS[id];
  const it: ItemInst = { uid: uid(), def: id, rarity: d.rolls ? rarity : 'comun', qty: Math.min(qty, d.maxStack) };
  if (traits && traits.length) it.traits = traits;
  if (d.weapon?.mag) it.mag = 0;
  return it;
}

export function itemValue(it: ItemInst): number {
  if (it.free) return 0;
  const d = def(it);
  return Math.round(d.value * RARITIES[it.rarity].valor * it.qty);
}
export function canSell(it: ItemInst) { return !it.free && it.def !== 'chapas'; }
export function sellPrice(it: ItemInst) { return canSell(it) ? Math.max(1, Math.floor(itemValue(it) * 0.4)) : 0; }

export function itemWeight(it: ItemInst) {
  return def(it).weight * it.qty * (it.traits?.includes('ligero') ? 0.7 : 1);
}

export function weaponStats(it: ItemInst | null): WeaponStats & { dmgMult: number } {
  const base = it ? def(it).weapon : undefined;
  if (!it || !base) return { dmg: 4, aps: 1.2, rangeTiles: 0.9, noise: 0, melee: true, ability: 'golpe', dmgMult: 1 }; // puños
  const r = RARITIES[it.rarity];
  const t = it.traits ?? [];
  const dmgMult = r.mult * (t.includes('dano') ? 1.1 : 1);
  return { ...base, dmg: base.dmg * dmgMult, dmgMult, aps: base.aps * (t.includes('cadencia') ? 1.1 : 1), rangeTiles: base.rangeTiles * (t.includes('alcance') ? 1.15 : 1) };
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
  return [l.arma, l.reserva ?? null, l.torso, l.cabeza, l.bolsillo, ...l.mochila].filter((x): x is ItemInst => !!x);
}
export function totalWeight(l: Loadout) { return allItems(l).reduce((s, it) => s + itemWeight(it), 0); }
export function speedMult(l: Loadout) {
  return 1 - Math.min(SPEED_PENALTY_MAX, totalWeight(l) * SPEED_PENALTY_PER_WEIGHT);
}
export function gearValue(l: Loadout) { return allItems(l).reduce((s, it) => s + itemValue(it), 0); }

export function canPocket(it: ItemInst) {
  const d = def(it);
  return d.small && d.kind !== 'armadura';
}

/** Mete un objeto en una lista con límite de casillas, apilando. Devuelve lo que no cabe (o null). */
export function addToList(list: ItemInst[], it: ItemInst, maxSlots: number): ItemInst | null {
  const d = def(it);
  if (d.maxStack > 1) {
    for (const o of list) {
      if (o.def === it.def && o.rarity === it.rarity && !o.free && o.qty < d.maxStack) {
        const n = Math.min(d.maxStack - o.qty, it.qty);
        o.qty += n; it.qty -= n;
        if (it.qty <= 0) return null;
      }
    }
  }
  if (list.length < maxSlots) { list.push(it); return null; }
  return it;
}

export function backpackAdd(l: Loadout, it: ItemInst) { return addToList(l.mochila, it, BACKPACK_SLOTS); }

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

/** Equipo gratis siempre disponible: bate Común + ropa, invendibles. */
export function freeItem(id: 'bate' | 'ropa'): ItemInst {
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
