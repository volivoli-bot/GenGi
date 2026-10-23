import { TILE, WORLD } from '../config/constants';
import { TRAPERO } from '../config/v31';
import { ITEMS } from '../data/items';
import type { ItemInst } from '../game/inventory';
import { makeItem } from '../game/inventory';
import { rollItem } from '../game/loot';
import { buyPrice } from '../game/prices';
import type { TraperoSnap } from '../save/types';
import { pointInWalls, Rect } from './map';

type Rng = () => number;

/**
 * v3.1 §9.4: el Trapero. Lógica pura (generación, precios, qué compra) para poder probarla sin escena.
 * Los vales viven en el snapshot de la incursión (snap.trapero.vales): al extraer o morir el snapshot desaparece y con él los vales.
 */
export function genTrapero(rng: Rng, walls: Rect[], spawn: { x: number; y: number }, avoid: { x: number; y: number }[]): TraperoSnap | null {
  if (rng() >= TRAPERO.chance) return null;
  const minD = TRAPERO.minDistTiles * TILE;
  let pos: { x: number; y: number } | null = null;
  for (let i = 0; i < 400 && !pos; i++) {
    const x = (3 + rng() * (WORLD / TILE - 6)) * TILE, y = (3 + rng() * (WORLD / TILE - 6)) * TILE;
    if (Math.hypot(x - spawn.x, y - spawn.y) < minD) continue;
    if (avoid.some(a => Math.hypot(a.x - x, a.y - y) < TILE * 6)) continue;
    if (pointInWalls(walls, x, y, TRAPERO.size * 0.75)) continue;
    pos = { x, y };
  }
  if (!pos) return null;
  const stock = TRAPERO.stock.map(s => {
    const item = 'gear' in s ? rollItem(rng, 0, s.rarity, true) : makeItem(s.consumable[Math.floor(rng() * s.consumable.length)], 'comun', 1);
    item.qty = 1;
    return { item, price: traperoPrice(item), sold: false };
  });
  return { x: Math.round(pos.x), y: Math.round(pos.y), found: false, vales: 0, stock };
}

/** Precio con el 20 % de descuento sobre el precio normal (reputación 1). */
export function traperoPrice(it: ItemInst) { return Math.ceil(buyPrice(it.def, it.rarity, it.qty, 1) * (1 - TRAPERO.discount)); }

/** Por qué no lo compra (o null si sí): solo materiales saqueados EN ESTA incursión. */
export function traperoRejects(it: ItemInst, raidId: string): string | null {
  if (ITEMS[it.def].kind !== 'material') return 'Solo compra materiales';
  if (it.raid !== raidId) return 'Solo compra lo saqueado en esta incursión';
  return null;
}

/** Vales que paga por una pila (70 % de su valor). */
export function valesFor(it: ItemInst) { return Math.floor(ITEMS[it.def].value * it.qty * TRAPERO.buyRate); }
