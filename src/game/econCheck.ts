import { ITEMS } from '../data/items';
import { RARITY_ORDER } from '../data/rarity';
import { RECIPES, VENDORS, VENDOR_IDS } from '../config/v3';
import type { SaveData } from '../save/types';
import { makeItem, sellPrice } from './inventory';
import { bestBuyback, buybackPrice, buyPrice, MAX_REP, minBuyPrice } from './prices';
import { genStock } from './vendors';

/**
 * QA (diseno-v3 §6): prueba exhaustiva de que no hay arbitraje. Para cada objeto que se puede comprar
 * (todo el stock posible de los 3 vendedores, reputación 1-4, muchas renovaciones) y cada rareza/cantidad:
 * lo que te pagan ≤ 40 % del precio más bajo de compra, y siempre < lo que cuesta comprarlo.
 */
export function econCheck(d: SaveData, renewals = 60) {
  let checked = 0, worst = 0, bad: string[] = [];
  const test = (id: string, rarity: typeof RARITY_ORDER[number], qty: number, traits?: string[]) => {
    const it = { ...makeItem(id, rarity, qty), traits: traits as never };
    const low = minBuyPrice(id, rarity, qty);
    const sell = Math.max(bestBuyback(it).price, sellPrice(it), ...VENDOR_IDS.map(v => buybackPrice(it, v)));
    let minBuy = Infinity;
    for (const v of VENDOR_IDS) for (let r = 1; r <= MAX_REP; r++) minBuy = Math.min(minBuy, buyPrice(id, rarity, qty, r));
    checked++;
    const ratio = sell / Math.max(1e-9, low);
    worst = Math.max(worst, ratio);
    if (sell > VENDORS.buyOwn * low + 1e-9 || sell >= minBuy) bad.push(`${id}/${rarity}×${qty}: vende ${sell}, compra mín ${minBuy}`);
  };
  // 1) todo objeto × rareza × cantidades
  for (const id of Object.keys(ITEMS)) {
    if (id === 'chapas') continue;
    for (const r of RARITY_ORDER) for (const q of [1, 2, 5, 12, 20]) if (q <= Math.max(1, ITEMS[id].maxStack)) test(id, r, q);
  }
  // 2) stock real generado (rasgos incluidos), todas las reputaciones y muchas renovaciones
  const fake = { ...d, stats: { ...d.stats } } as SaveData;
  let stockSeen = 0;
  for (let n = 0; n < renewals; n++) {
    fake.stats.raids = n;
    for (const v of VENDOR_IDS) for (let lv = 1; lv <= MAX_REP; lv++) for (const e of genStock(fake, v, lv)) { test(e.id, e.rarity, e.qty, e.traits); stockSeen++; }
  }
  // 3) fabricar no crea dinero a partir de cosas compradas: ningún coste de receta se puede comprar
  const buyable = new Set<string>();
  for (const v of VENDOR_IDS) for (let lv = 1; lv <= MAX_REP; lv++) for (const e of genStock(fake, v, lv)) buyable.add(e.id);
  const craftLoops = RECIPES.filter(r => Object.keys(r.cost).some(k => k !== 'chapas' && buyable.has(k))).map(r => r.id);
  return { checked, stockSeen, worstRatio: +worst.toFixed(4), bad: bad.slice(0, 20), nBad: bad.length, craftLoops };
}
