import { ITEMS } from '../data/items';
import { RARITIES } from '../data/rarity';
import { VENDORS, VendorId, VENDOR_IDS } from '../config/v3';
import type { ItemInst } from './inventory';
import { TRAPERO } from '../config/v31';

/**
 * Precios v3 (diseno-v3 §3 y §6). Regla anti-arbitraje: lo que paga un vendedor es como mucho el 40 %
 * del precio MÁS BAJO al que se puede comprar ese objeto (cualquier tienda, reputación máxima incluida).
 */
export const MAX_REP = VENDORS.repXp.length;

/** Precio por unidad Común a reputación 1. */
export function basePrice(id: string) {
  return VENDORS.basePrice[id] ?? ITEMS[id].value * VENDORS.refPriceMult;
}
export function repMult(rep: number) { return 1 - VENDORS.discountPerLevel * (Math.max(1, Math.min(MAX_REP, rep)) - 1); }

/** Precio de compra de una pila (id, rareza, cantidad) con la reputación dada. */
export function buyPrice(id: string, rarity: ItemInst['rarity'], qty: number, rep: number) {
  const r = ITEMS[id].rolls ? RARITIES[rarity].valor : 1;
  return Math.ceil(basePrice(id) * r * qty * repMult(rep));
}
/** El precio más bajo posible en cualquier tienda (reputación máxima). */
export function minBuyPrice(id: string, rarity: ItemInst['rarity'], qty: number) {
  const r = ITEMS[id].rolls ? RARITIES[rarity].valor : 1;
  // v3.1: el Trapero vende con un 20 % de descuento sobre el precio de rep. 1 → también cuenta como tienda
  return basePrice(id) * r * qty * Math.min(repMult(MAX_REP), 1 - TRAPERO.discount);
}

/** Categoría de un objeto: qué vendedor lo compra al 40 %. Materiales: nadie (20 % en todos). */
export function categoryOf(id: string): VendorId | null {
  const k = ITEMS[id].kind;
  if (k === 'consumible' || k === 'bengala' || k === 'granada') return 'doc';
  if (k === 'arma' || k === 'municion') return 'chispas';
  if (k === 'armadura' || k === 'mochila') return 'hierro';
  return null;
}

/** Lo que paga el vendedor `v` por el objeto (0 = no lo compra / no vale nada). */
export function buybackPrice(it: ItemInst, v: VendorId) {
  if (it.free || it.def === 'chapas') return 0;
  const rate = categoryOf(it.def) === v ? VENDORS.buyOwn : VENDORS.buyOther;
  // mejorado en el Taller: no sube el precio de recompra (evita fabricar dinero con componentes)
  return Math.floor(rate * minBuyPrice(it.def, it.rarity, it.qty));
}
export function bestBuyback(it: ItemInst): { price: number; vendor: VendorId } {
  let best = { price: 0, vendor: VENDOR_IDS[0] };
  for (const v of VENDOR_IDS) { const p = buybackPrice(it, v); if (p > best.price) best = { price: p, vendor: v }; }
  return best;
}
