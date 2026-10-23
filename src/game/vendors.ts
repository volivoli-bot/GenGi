import { MISSION_OFFERS, MISSIONS, MissionDef, VENDORS, VendorId, VENDOR_IDS } from '../config/v3';
import { ITEMS, TraitId } from '../data/items';
import type { Rarity } from '../data/rarity';
import type { RaidSnapshot, RaidTrack, SaveData, StockEntry, VendorState } from '../save/types';
import { newVendor } from '../save/SaveManager';
import { addToList, consume, countOf, ItemInst, makeItem } from './inventory';
import { rollTraits, seeded } from './loot';
import { buybackPrice, buyPrice } from './prices';
import { takeForSale } from './hubOps';
import { stashSlots } from './refugio';
import { TRAITS } from '../data/items';
import { REP } from '../config/v31';

/** Vendedores v3 (diseno-v3 §3): reputación 1-4, stock que se renueva cada 3 raids, misiones. */
export function vstate(d: SaveData, v: VendorId): VendorState { return (d.vendors[v] ??= newVendor()); }
/** Nivel solo por XP (sin contar las misiones). */
export function repLevel(xp: number) { let lv = 1; VENDORS.repXp.forEach((t, i) => { if (xp >= t) lv = i + 1; }); return lv; }
/** v3.1: nivel máximo que permiten las misiones cumplidas (niveles 3 y 4 exigen misiones de ese vendedor). */
export function missionCap(done: number) { let lv = 1; REP.missionsForLevel.forEach((n, i) => { if (done >= n) lv = i + 1; }); return lv; }
/** Nivel real: XP y misiones. */
export function repLevelOf(s: VendorState) { return Math.min(repLevel(s.xp), missionCap(s.missionsDone ?? 0)); }
export const rep = (d: SaveData, v: VendorId) => repLevelOf(vstate(d, v));
/** Progreso hacia el siguiente nivel ([xp en el nivel, xp necesaria]) o null si es el máximo; `mission` = le falta una misión. */
export function repProgress(s: VendorState): { cur: number; need: number; mission: number } | null {
  const lv = repLevelOf(s); const next = VENDORS.repXp[lv]; if (next === undefined) return null;
  const base = VENDORS.repXp[lv - 1];
  const mission = Math.max(0, (REP.missionsForLevel[lv] ?? 0) - (s.missionsDone ?? 0));
  return { cur: Math.min(s.xp, next) - base, need: next - base, mission };
}
/** Reputación que aún se puede ganar comprando en esta renovación. */
export const buyXpLeft = (d: SaveData, v: VendorId) => Math.max(0, REP.buyXpCapPerRestock - (vstate(d, v).buyXp ?? 0));

function hash(s: string) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

/** Genera el stock de un vendedor para su nivel actual (determinista por raid, nivel y partida). */
export function genStock(d: SaveData, v: VendorId, lv: number): StockEntry[] {
  const rng = seeded(hash(`${v}|${d.stats.raids}|${lv}|${d.createdAt}`));
  const out: StockEntry[] = [];
  const gear = (ids: string[]) => VENDORS.gearSlots[lv - 1].forEach((r) => {
    const id = ids[Math.floor(rng() * ids.length)];
    out.push({ id, rarity: r as Rarity, qty: 1, left: 1, traits: rollTraits(rng, id, r as Rarity) });
  });
  if (v === 'doc') VENDORS.docStock.slice(0, lv).flat().forEach(([id, n]) => out.push({ id, rarity: 'comun', qty: 1, left: n }));
  if (v === 'chispas') {
    gear(VENDORS.chispasGear);
    for (const [id, q, n] of VENDORS.chispasAmmo) out.push({ id, rarity: 'comun', qty: q, left: n });
    if (lv >= 4) {
      // rep. 4: un arma Militar con rasgo garantizado (3 rasgos en vez de 2)
      const id = VENDORS.chispasGear[Math.floor(rng() * VENDORS.chispasGear.length)];
      const t = rollTraits(rng, id, 'militar');
      const extra = (Object.keys(TRAITS) as TraitId[]).filter(x => TRAITS[x].for.includes('arma') && !t.includes(x));
      if (extra.length) t.push(extra[Math.floor(rng() * extra.length)]);
      out.push({ id, rarity: 'militar', qty: 1, left: 1, traits: t });
    }
  }
  if (v === 'hierro') {
    gear(VENDORS.hierroGear);
    for (const [id, q, n] of [...VENDORS.hierroBags, ...(lv >= 4 ? VENDORS.hierroBagsRep4 : [])]) out.push({ id, rarity: 'comun', qty: q, left: n });
  }
  return out;
}

/** Renueva stock y ofertas de misión si toca (cada N raids o al subir de nivel). */
export function refreshVendor(d: SaveData, v: VendorId, force = false) {
  const s = vstate(d, v);
  const lv = repLevelOf(s);
  const periodic = s.stockAt < 0 || d.stats.raids - s.stockAt >= VENDORS.restockRaids;
  const due = force || periodic || s.stockLevel !== lv;
  if (!due) return false;
  // el tope de reputación por compras se renueva con la tienda (no al subir de nivel: no se puede encadenar)
  if (periodic) s.buyXp = 0;
  s.stock = genStock(d, v, lv);
  s.stockAt = d.stats.raids; s.stockLevel = lv;
  // ofertas: 3 misiones del vendedor (la activa se mantiene)
  const pool = MISSIONS.filter(m => m.vendor === v && m.id !== s.active);
  const rng = seeded(hash(`m|${v}|${d.stats.raids}|${d.createdAt}`));
  const pick: string[] = [];
  while (pick.length < MISSION_OFFERS - (s.active ? 1 : 0) && pool.length) pick.push(pool.splice(Math.floor(rng() * pool.length), 1)[0].id);
  s.offers = s.active ? [s.active, ...pick] : pick;
  return true;
}
export function refreshAll(d: SaveData) { for (const v of VENDOR_IDS) refreshVendor(d, v); }
export const raidsToRestock = (d: SaveData, v: VendorId) => Math.max(0, VENDORS.restockRaids - (d.stats.raids - vstate(d, v).stockAt));

type R = { ok: true; msg?: string } | { ok: false; msg: string };

function gainXp(d: SaveData, v: VendorId, xp: number, src: 'compra' | 'venta' | 'mision'): string | undefined {
  const s = vstate(d, v); const before = repLevelOf(s);
  let add = Math.max(0, Math.round(xp));
  if (src === 'venta') add = 0; // v3.1: vender no da reputación
  if (src === 'compra') { add = Math.min(add, buyXpLeft(d, v)); s.buyXp = (s.buyXp ?? 0) + add; }
  s.xp += add;
  const after = repLevelOf(s);
  if (after > before) { refreshVendor(d, v, true); return `¡${VENDORS.defs[v].nombre}: reputación ${after}! Stock nuevo.`; }
  return undefined;
}

export function stockPrice(d: SaveData, v: VendorId, e: StockEntry) { return buyPrice(e.id, e.rarity, e.qty, rep(d, v)); }

export function buyStock(d: SaveData, v: VendorId, idx: number): R {
  const s = vstate(d, v); const e = s.stock[idx];
  if (!e || e.left <= 0) return { ok: false, msg: 'Agotado' };
  const price = stockPrice(d, v, e);
  if (d.chapas < price) return { ok: false, msg: 'No tienes chapas suficientes' };
  const it = makeItem(e.id, e.rarity, e.qty, e.traits);
  const left = addToList(d.stash, it, stashSlots(d));
  if (left) { if (left.qty === e.qty) return { ok: false, msg: 'Alijo lleno' }; d.overflow.push(left); }
  d.chapas -= price; e.left--;
  return { ok: true, msg: gainXp(d, v, price * VENDORS.xpPerBuyChapa, 'compra') };
}

export function sellTo(d: SaveData, v: VendorId, uid: string): R {
  const all = [...d.stash, ...d.overflow, ...d.loadout.mochila];
  const it0 = all.find(i => i.uid === uid) ?? [d.loadout.arma, d.loadout.reserva, d.loadout.torso, d.loadout.cabeza, d.loadout.espalda, d.loadout.bolsillo, ...(d.loadout.bolsilloExtra ?? [])].find(i => i?.uid === uid);
  if (!it0) return { ok: false, msg: 'No encontrado' };
  if (it0.free) return { ok: false, msg: 'El equipo gratis no se puede vender' };
  const price = buybackPrice(it0, v);
  if (price <= 0) return { ok: false, msg: 'No te da nada por eso' };
  const it = takeForSale(d, uid); if (!it) return { ok: false, msg: 'No se puede vender' };
  d.chapas += price;
  return { ok: true, msg: gainXp(d, v, price * REP.sellXpPerChapa, 'venta') };
}

// ---------------------------------------------------------------- misiones
export const missionDef = (id: string | null) => MISSIONS.find(m => m.id === id) ?? null;
export function acceptMission(d: SaveData, v: VendorId, id: string): R {
  const s = vstate(d, v);
  if (!s.offers.includes(id)) return { ok: false, msg: 'No disponible' };
  if (s.active !== id) { s.active = id; s.progress = 0; }
  return { ok: true };
}
export function abandonMission(d: SaveData, v: VendorId) { const s = vstate(d, v); s.active = null; s.progress = 0; }

/** Progreso visible [hecho, total] de la misión activa. */
export function missionProgress(d: SaveData, m: MissionDef): [number, number] | null {
  const k = m.kind;
  if (k.t === 'entregar') return [Math.min(k.n, countOf([...d.stash, ...d.overflow], k.item)), k.n];
  if (k.t === 'matar') return [Math.min(k.n, vstate(d, m.vendor).progress), k.n];
  return null;
}

function reward(d: SaveData, m: MissionDef): string {
  const s = vstate(d, m.vendor);
  d.chapas += m.chapas;
  if (m.item) { const it = makeItem(m.item[0], m.item[1] as Rarity, m.item[2], rollTraits(Math.random, m.item[0], m.item[1] as Rarity)); const left = addToList(d.stash, it, stashSlots(d)); if (left) d.overflow.push(left); }
  s.active = null; s.progress = 0;
  s.offers = s.offers.filter(o => o !== m.id);
  s.missionsDone = (s.missionsDone ?? 0) + 1;
  const up = gainXp(d, m.vendor, m.xp, 'mision');
  return `Misión de ${VENDORS.defs[m.vendor].nombre} cumplida: +${m.chapas} chapas${m.item ? ` + ${ITEMS[m.item[0]].nombre}` : ''}` + (up ? `. ${up}` : '');
}

export function deliverMission(d: SaveData, v: VendorId): R {
  const m = missionDef(vstate(d, v).active);
  if (!m || m.kind.t !== 'entregar') return { ok: false, msg: 'Nada que entregar' };
  const k = m.kind;
  if (countOf([...d.stash, ...d.overflow], k.item) < k.n) return { ok: false, msg: `Te faltan ${ITEMS[k.item].nombre.toLowerCase()}` };
  const got = consume(d.overflow, k.item, k.n); consume(d.stash, k.item, k.n - got);
  return { ok: true, msg: reward(d, m) };
}

export const emptyTrack = (): RaidTrack => ({ heals: 0, dmgTaken: 0, kills: {} });

/** Al acabar una raid: avanza y cobra las misiones activas. Devuelve los mensajes de misiones cumplidas. */
export function evalMissions(d: SaveData, snap: RaidSnapshot, extracted: boolean, exitLoc: string | null, lo: { torso: ItemInst | null; cabeza: ItemInst | null }): string[] {
  const t = snap.track ?? emptyTrack();
  const out: string[] = [];
  for (const v of VENDOR_IDS) {
    const s = vstate(d, v); const m = missionDef(s.active); if (!m) continue;
    const k = m.kind; let done = false;
    if (k.t === 'matar') {
      let n = 0;
      for (const [type, c] of Object.entries(t.kills)) if (k.enemy === '*' || k.enemy === type) n += k.ranged ? c.r : k.melee ? c.m : c.m + c.r + c.o;
      s.progress += n; done = s.progress >= k.n;
    } else if (k.t === 'curarse') done = t.heals >= k.n;
    else if (k.t === 'extraerVida') done = extracted && snap.player.hp < k.below;
    else if (k.t === 'salida') done = extracted && exitLoc === k.loc;
    else if (k.t === 'armaduraMilitar') done = extracted && [lo.torso, lo.cabeza].some(i => i && !i.free && i.rarity === 'militar' && ITEMS[i.def].kind === 'armadura');
    else if (k.t === 'danoSobrevive') done = extracted && t.dmgTaken >= k.n;
    if (done) out.push(reward(d, m));
  }
  return out;
}
