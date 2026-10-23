import { STASH_SLOTS, BACKPACK_SLOTS } from '../config/constants';
import { ITEMS } from '../data/items';
import type { SaveData } from '../save/types';
import { addToList, canPocket, canSell, freeItem, ItemInst, makeItem, sellPrice, slotOf, itemValue } from './inventory';

/**
 * Operaciones del refugio sobre el guardado. Cada operación localiza el objeto por uid en UN solo
 * sitio, lo quita y lo pone en el destino (o lo devuelve si no cabe): no hay forma de duplicar.
 */
export type Place = 'stash' | 'overflow' | 'mochila' | 'arma' | 'torso' | 'cabeza' | 'bolsillo' | 'reserva';

export function locate(d: SaveData, uid: string): { it: ItemInst; place: Place } | null {
  const lo = d.loadout;
  for (const k of ['arma', 'torso', 'cabeza', 'bolsillo', 'reserva'] as const) if (lo[k]?.uid === uid) return { it: lo[k]!, place: k };
  for (const [place, list] of [['stash', d.stash], ['overflow', d.overflow], ['mochila', lo.mochila]] as const) {
    const it = list.find(i => i.uid === uid);
    if (it) return { it, place };
  }
  return null;
}

function take(d: SaveData, uid: string): { it: ItemInst; place: Place } | null {
  const f = locate(d, uid);
  if (!f) return null;
  const lo = d.loadout;
  if (f.place === 'stash') d.stash.splice(d.stash.indexOf(f.it), 1);
  else if (f.place === 'overflow') d.overflow.splice(d.overflow.indexOf(f.it), 1);
  else if (f.place === 'mochila') lo.mochila.splice(lo.mochila.indexOf(f.it), 1);
  else lo[f.place] = null;
  return f;
}

/** Devuelve un objeto a donde estaba (cuando un movimiento falla). */
function putBack(d: SaveData, f: { it: ItemInst; place: Place }) {
  const lo = d.loadout;
  if (f.place === 'stash') d.stash.push(f.it);
  else if (f.place === 'overflow') d.overflow.push(f.it);
  else if (f.place === 'mochila') lo.mochila.push(f.it);
  else lo[f.place] = f.it;
}

export type OpResult = { ok: true } | { ok: false; msg: string };
const fail = (msg: string): OpResult => ({ ok: false, msg });
const OK: OpResult = { ok: true };

export function toStash(d: SaveData, uid: string): OpResult {
  const f = take(d, uid); if (!f) return fail('No encontrado');
  if (f.it.free) { ensureFreeGear(d); return OK; } // el equipo gratis no se guarda: se descarta
  const left = addToList(d.stash, f.it, STASH_SLOTS);
  if (left) { putBack(d, f); return fail('Alijo lleno (30 casillas)'); }
  return OK;
}

export function toBackpack(d: SaveData, uid: string): OpResult {
  const f = take(d, uid); if (!f) return fail('No encontrado');
  if (f.it.free) { putBack(d, f); return fail('El equipo gratis solo se puede llevar equipado'); }
  const left = addToList(d.loadout.mochila, f.it, BACKPACK_SLOTS);
  if (left) { putBack(d, f); return fail('Mochila llena'); }
  return OK;
}

export function equip(d: SaveData, uid: string): OpResult {
  const f0 = locate(d, uid); if (!f0) return fail('No encontrado');
  const slot = slotOf(f0.it); if (!slot) return fail('No se puede equipar');
  const f = take(d, uid)!;
  let prev = d.loadout[slot];
  d.loadout[slot] = f.it;
  // v2: el arma anterior pasa a la ranura de reserva (y la reserva anterior va a donde estaba la nueva)
  if (slot === 'arma' && prev && !prev.free && f.place !== 'reserva') { const r = d.loadout.reserva ?? null; d.loadout.reserva = prev; prev = r; }
  else if (slot === 'arma' && f.place === 'reserva' && prev && !prev.free) { d.loadout.reserva = prev; prev = null; }
  if (prev && !prev.free) {
    // el anterior va a donde estaba el nuevo (o al alijo)
    const dest = f.place === 'mochila' ? d.loadout.mochila : d.stash;
    const max = f.place === 'mochila' ? BACKPACK_SLOTS : STASH_SLOTS;
    if (addToList(dest, prev, max)) d.overflow.push(prev);
  }
  return OK;
}

export function toPocket(d: SaveData, uid: string): OpResult {
  const f0 = locate(d, uid); if (!f0) return fail('No encontrado');
  if (!canPocket(f0.it) || f0.it.free) return fail('Solo objetos pequeños (no armas largas ni armaduras)');
  const f = take(d, uid)!;
  const prev = d.loadout.bolsillo;
  d.loadout.bolsillo = f.it;
  if (prev && addToList(d.stash, prev, STASH_SLOTS)) d.overflow.push(prev);
  return OK;
}

export function sell(d: SaveData, uid: string): OpResult {
  const f0 = locate(d, uid); if (!f0) return fail('No encontrado');
  if (!canSell(f0.it)) return fail(f0.it.free ? 'El equipo gratis no se puede vender' : 'No se puede vender');
  const price = sellPrice(f0.it);
  take(d, uid);
  d.chapas += price;
  ensureFreeGear(d);
  return OK;
}

/** Ingresa chapas sueltas que haya en el alijo (p. ej. tras extraer). */
export function cashChapas(d: SaveData) {
  for (const list of [d.stash, d.overflow]) {
    for (let i = list.length - 1; i >= 0; i--) if (list[i].def === 'chapas') { d.chapas += list[i].qty; list.splice(i, 1); }
  }
}

export interface ShopEntry { id: string; qty: number; price: number }
export const SHOP: ShopEntry[] = [
  { id: 'vendaje', qty: 1, price: 20 },
  { id: 'botiquin', qty: 1, price: 80 },
  { id: 'municion', qty: 12, price: 70 },
  { id: 'bengala', qty: 1, price: 90 },
  { id: 'machete', qty: 1, price: 60 },
  { id: 'arco', qty: 1, price: 95 },
  { id: 'flechas', qty: 12, price: 30 },
  { id: 'pistola', qty: 1, price: 150 },
  { id: 'tablas', qty: 1, price: 55 },
];

export function buy(d: SaveData, e: ShopEntry): OpResult {
  if (d.chapas < e.price) return fail('No tienes chapas suficientes');
  const it = makeItem(e.id, 'comun', e.qty);
  const left = addToList(d.stash, it, STASH_SLOTS);
  if (left) {
    // si apiló parte, deshacer no es trivial: solo permitimos si cabe entero
    if (left.qty !== e.qty) { /* apilado parcial: lo que sobró va al excedente */ d.overflow.push(left); }
    else return fail('Alijo lleno');
  }
  d.chapas -= e.price;
  return OK;
}

/** Equipo gratis siempre: si no tienes arma o torso, se te da bate Común / ropa invendibles. */
export function ensureFreeGear(d: SaveData) {
  if (d.loadout.reserva === undefined) d.loadout.reserva = null;
  if (!d.loadout.arma) d.loadout.arma = freeItem('bate');
  if (!d.loadout.torso) d.loadout.torso = freeItem('ropa');
}

/** Pasa el excedente al alijo si hay sitio. */
export function settleOverflow(d: SaveData) {
  for (const it of [...d.overflow]) {
    if (!addToList(d.stash, it, STASH_SLOTS)) d.overflow.splice(d.overflow.indexOf(it), 1);
  }
}

export const itemName = (id: string) => ITEMS[id]?.nombre ?? id;
export { itemValue };
