import { ITEMS } from '../data/items';
import type { SaveData } from '../save/types';
import { addToList, backpackSlots, canPocket, canSell, freeItem, ItemInst, slotOf, itemValue } from './inventory';
import { pocketSlots, stashSlots } from './refugio';

/**
 * Operaciones del refugio sobre el guardado. Cada operación localiza el objeto por uid en UN solo
 * sitio, lo quita y lo pone en el destino (o lo devuelve si no cabe): no hay forma de duplicar.
 */
export type Place = 'stash' | 'overflow' | 'mochila' | 'arma' | 'torso' | 'cabeza' | 'bolsillo' | 'reserva' | 'espalda' | 'bolsilloExtra';

export function locate(d: SaveData, uid: string): { it: ItemInst; place: Place } | null {
  const lo = d.loadout;
  for (const k of ['arma', 'torso', 'cabeza', 'bolsillo', 'reserva', 'espalda'] as const) if (lo[k]?.uid === uid) return { it: lo[k]!, place: k };
  lo.bolsilloExtra ??= [];
  for (const [place, list] of [['stash', d.stash], ['overflow', d.overflow], ['mochila', lo.mochila], ['bolsilloExtra', lo.bolsilloExtra]] as const) {
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
  else if (f.place === 'bolsilloExtra') lo.bolsilloExtra!.splice(lo.bolsilloExtra!.indexOf(f.it), 1);
  else lo[f.place] = null;
  return f;
}

/** Devuelve un objeto a donde estaba (cuando un movimiento falla). */
function putBack(d: SaveData, f: { it: ItemInst; place: Place }) {
  const lo = d.loadout;
  if (f.place === 'stash') d.stash.push(f.it);
  else if (f.place === 'overflow') d.overflow.push(f.it);
  else if (f.place === 'mochila') lo.mochila.push(f.it);
  else if (f.place === 'bolsilloExtra') (lo.bolsilloExtra ??= []).push(f.it);
  else lo[f.place] = f.it;
}

/** Quitar la mochila de espalda solo si lo que llevas cabe en la mochila base. */
function bagBlock(d: SaveData, f: { place: Place }, newBag: ItemInst | null = null): string | null {
  if (f.place !== 'espalda') return null;
  const lo = d.loadout;
  const cap = backpackSlots({ ...lo, espalda: newBag });
  return lo.mochila.length > cap ? `Vacía la mochila primero (caben ${cap})` : null;
}

export type OpResult = { ok: true } | { ok: false; msg: string };
const fail = (msg: string): OpResult => ({ ok: false, msg });
const OK: OpResult = { ok: true };

export function toStash(d: SaveData, uid: string): OpResult {
  const f0 = locate(d, uid); if (!f0) return fail('No encontrado');
  const why = bagBlock(d, f0); if (why) return fail(why);
  const f = take(d, uid)!;
  if (f.it.free) { ensureFreeGear(d); return OK; } // el equipo gratis no se guarda: se descarta
  const left = addToList(d.stash, f.it, stashSlots(d));
  if (left) { putBack(d, f); return fail(`Alijo lleno (${stashSlots(d)} casillas)`); }
  return OK;
}

export function toBackpack(d: SaveData, uid: string): OpResult {
  const f0 = locate(d, uid); if (!f0) return fail('No encontrado');
  if (f0.place === 'espalda') return fail('Es la mochila que llevas puesta');
  const f = take(d, uid)!;
  if (f.it.free) { putBack(d, f); return fail('El equipo gratis solo se puede llevar equipado'); }
  const left = addToList(d.loadout.mochila, f.it, backpackSlots(d.loadout));
  if (left) { putBack(d, f); return fail('Mochila llena'); }
  return OK;
}

export function equip(d: SaveData, uid: string): OpResult {
  const f0 = locate(d, uid); if (!f0) return fail('No encontrado');
  const slot = slotOf(f0.it); if (!slot) return fail('No se puede equipar');
  if (slot === 'espalda') {
    if (f0.place === 'mochila') return fail('Sácala de la mochila primero');
    const cap = backpackSlots({ ...d.loadout, espalda: f0.it });
    if (d.loadout.mochila.length > cap) return fail(`Vacía la mochila primero (caben ${cap})`);
  }
  const f = take(d, uid)!;
  let prev = d.loadout[slot] ?? null;
  d.loadout[slot] = f.it;
  // v2: el arma anterior pasa a la ranura de reserva (y la reserva anterior va a donde estaba la nueva)
  if (slot === 'arma' && prev && !prev.free && f.place !== 'reserva') { const r = d.loadout.reserva ?? null; d.loadout.reserva = prev; prev = r; }
  else if (slot === 'arma' && f.place === 'reserva' && prev && !prev.free) { d.loadout.reserva = prev; prev = null; }
  if (prev && !prev.free) {
    // el anterior va a donde estaba el nuevo (o al alijo)
    const dest = f.place === 'mochila' ? d.loadout.mochila : d.stash;
    const max = f.place === 'mochila' ? backpackSlots(d.loadout) : stashSlots(d);
    if (addToList(dest, prev, max)) d.overflow.push(prev);
  }
  return OK;
}

export function toPocket(d: SaveData, uid: string): OpResult {
  const f0 = locate(d, uid); if (!f0) return fail('No encontrado');
  if (!canPocket(f0.it) || f0.it.free) return fail('Solo objetos pequeños (no armas largas ni armaduras)');
  const lo = d.loadout;
  lo.bolsilloExtra ??= [];
  if (f0.place === 'bolsillo' || f0.place === 'bolsilloExtra') return fail('Ya está en el bolsillo seguro');
  const f = take(d, uid)!;
  // v3: varias casillas (estación Bolsillo). Primero una libre; si no hay, se cambia por la casilla base.
  if (!lo.bolsillo) { lo.bolsillo = f.it; return OK; }
  if (1 + lo.bolsilloExtra.length < pocketSlots(d)) { lo.bolsilloExtra.push(f.it); return OK; }
  const prev = lo.bolsillo;
  lo.bolsillo = f.it;
  if (addToList(d.stash, prev, stashSlots(d))) d.overflow.push(prev);
  return OK;
}

/** Ingresa chapas sueltas que haya en el alijo (p. ej. tras extraer). */
export function cashChapas(d: SaveData) {
  for (const list of [d.stash, d.overflow]) {
    for (let i = list.length - 1; i >= 0; i--) if (list[i].def === 'chapas') { d.chapas += list[i].qty; list.splice(i, 1); }
  }
}

/** Quita un objeto (venta a un vendedor): lo localiza y lo saca de donde esté. */
export function takeForSale(d: SaveData, uid: string): ItemInst | null {
  const f0 = locate(d, uid); if (!f0 || !canSell(f0.it)) return null;
  if (bagBlock(d, f0)) return null;
  const f = take(d, uid)!;
  ensureFreeGear(d);
  return f.it;
}
export { bagBlock };

/** Equipo gratis siempre: si no tienes arma o torso, se te da bate Común / ropa invendibles. */
export function ensureFreeGear(d: SaveData) {
  if (d.loadout.reserva === undefined) d.loadout.reserva = null;
  if (!d.loadout.arma) d.loadout.arma = freeItem('bate');
  if (!d.loadout.torso) d.loadout.torso = freeItem('ropa');
}

/** Pasa el excedente al alijo si hay sitio. */
export function settleOverflow(d: SaveData) {
  for (const it of [...d.overflow]) {
    if (!addToList(d.stash, it, stashSlots(d))) d.overflow.splice(d.overflow.indexOf(it), 1);
  }
}

export const itemName = (id: string) => ITEMS[id]?.nombre ?? id;
export { itemValue };
