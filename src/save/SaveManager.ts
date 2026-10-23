import { ITEMS } from '../data/items';
import { RARITIES } from '../data/rarity';
import { emptyLoadout, ItemInst } from '../game/inventory';
import { migrate, profileIdFor } from './migrations';
import { newProgress } from '../game/levels';
import { ATTR_IDS } from '../config/levels';
import { ANTI_ROLLBACK } from '../config/v4';
import { createStorage, SaveStorage } from './storage';
import { SAVE_VERSION, SaveData, Settings, Refugio, VendorState } from './types';
import { STATION_IDS, StationDef, STATIONS, VENDOR_IDS, VendorId } from '../config/v3';

export const newRefugio = (): Refugio => ({ levels: { alijo: 1, bolsillo: 1, generador: 1, enfermeria: 1, taller: 1, radio: 1, gimnasio: 1, pizarra: 1 }, crafts: [] });
export const newVendor = (): VendorState => ({ xp: 0, stock: [], stockAt: -1, stockLevel: 0, offers: [], active: null, progress: 0, missionsDone: 0, buyXp: 0 });
const newVendors = () => Object.fromEntries(VENDOR_IDS.map(v => [v, newVendor()])) as Record<VendorId, VendorState>;

export const defaultSettings = (): Settings => ({ prioridad: 'cercano', rarezaMin: 'comun', curarUmbral: 35, rapido: 'vendaje', conosEnemigos: true });

export function newSave(): SaveData {
  const now = new Date().toISOString();
  return {
    saveVersion: SAVE_VERSION, createdAt: now, updatedAt: now,
    chapas: 60, stash: [], overflow: [], loadout: emptyLoadout(),
    settings: defaultSettings(), raidLog: [], activeRaid: null,
    stats: { raids: 0, extracted: 0, deaths: 0 },
    seenExits: {},
    refugio: newRefugio(),
    vendors: newVendors(),
    prog: newProgress(),
    profileId: profileIdFor(now + ':' + Math.random()),
    rev: 0,
  };
}

/** Rellena campos que falten y descarta objetos desconocidos (robustez ante ediciones/migraciones). */
function normalize(d: Partial<SaveData>): SaveData {
  const base = newSave();
  const okItem = (it: ItemInst | null | undefined): it is ItemInst => !!it && !!ITEMS[it.def] && !!RARITIES[it.rarity] && it.qty > 0;
  const lo = { ...emptyLoadout(), ...(d.loadout ?? {}) };
  return {
    ...base, ...d,
    saveVersion: SAVE_VERSION,
    settings: { ...base.settings, ...(d.settings ?? {}) },
    stats: { ...base.stats, ...(d.stats ?? {}) },
    stash: (d.stash ?? []).filter(okItem),
    overflow: (d.overflow ?? []).filter(okItem),
    loadout: { arma: okItem(lo.arma) ? lo.arma : null, torso: okItem(lo.torso) ? lo.torso : null, cabeza: okItem(lo.cabeza) ? lo.cabeza : null, bolsillo: okItem(lo.bolsillo) ? lo.bolsillo : null, reserva: okItem(lo.reserva) ? lo.reserva : null, mochila: (lo.mochila ?? []).filter(okItem),
      espalda: okItem(lo.espalda) ? lo.espalda : null, bolsilloExtra: (Array.isArray(lo.bolsilloExtra) ? lo.bolsilloExtra : []).filter(okItem) },
    refugio: normRefugio(d.refugio),
    vendors: Object.fromEntries(VENDOR_IDS.map(v => {
      const o = (d.vendors as Record<string, Partial<VendorState>> | undefined)?.[v] ?? {};
      return [v, { ...newVendor(), ...o, stock: Array.isArray(o.stock) ? o.stock.filter(s => !!ITEMS[s.id]) : [], offers: Array.isArray(o.offers) ? o.offers : [] }];
    })) as Record<VendorId, VendorState>,
    raidLog: d.raidLog ?? [],
    activeRaid: d.activeRaid ?? null,
    seenExits: d.seenExits && typeof d.seenExits === 'object' ? d.seenExits : {},
    prog: normProg(d.prog),
    profileId: typeof d.profileId === 'string' && d.profileId ? d.profileId : d.createdAt ? profileIdFor(String(d.createdAt)) : base.profileId,
    rev: Number.isFinite(d.rev) ? Math.max(0, Math.floor(d.rev!)) : 0,
  } as SaveData;
}

function normProg(p: Partial<SaveData['prog']> | undefined): SaveData['prog'] {
  const b = newProgress();
  if (!p || typeof p !== 'object') return b;
  const int = (v: unknown, min: number) => Number.isFinite(v) ? Math.max(min, Math.floor(v as number)) : min;
  const attrs = { ...b.attrs };
  for (const a of ATTR_IDS) attrs[a] = int(p.attrs?.[a], 0);
  const gym: SaveData['prog']['gym'] = {};
  for (const a of ATTR_IDS) if (p.gym?.[a]) gym[a] = int(p.gym[a], 0);
  return { ...b, level: int(p.level, 1), xp: int(p.xp, 0), total: int(p.total, 0), free: int(p.free, 0), attrs, gym,
    cheapRespecAt: Number.isFinite(p.cheapRespecAt) ? p.cheapRespecAt! : -999, freeResets: int(p.freeResets, 0), lastLevelUp: int(p.lastLevelUp, 0) };
}

/** Marca más alta (incursiones jugadas, guardados) vista de cada partida en este dispositivo. */
type Mark = { raids: number; rev: number };
function readMarks(): Record<string, Mark> {
  try { const o = JSON.parse(localStorage.getItem(ANTI_ROLLBACK.storageKey) ?? '{}'); return o && typeof o === 'object' ? o : {}; } catch { return {}; }
}
function writeMark(id: string, m: Mark) {
  try {
    const all = readMarks(); const o = all[id];
    if (o && (o.raids > m.raids || (o.raids === m.raids && o.rev >= m.rev))) return;
    all[id] = m; localStorage.setItem(ANTI_ROLLBACK.storageKey, JSON.stringify(all));
  } catch { /* sin espacio */ }
}
/** ¿Es `m` anterior a la marca guardada? */
export function isRollback(id: string, m: Mark) {
  const o = readMarks()[id];
  return !!o && (m.raids < o.raids || (m.raids === o.raids && m.rev < o.rev));
}

function normRefugio(r: Partial<Refugio> | undefined): Refugio {
  const base = newRefugio();
  const lv = { ...base.levels };
  for (const k of STATION_IDS) {
    const n = Number(r?.levels?.[k]);
    const max = (STATIONS[k] as StationDef).levels.length;
    if (n >= 1) lv[k] = Math.min(max, Math.floor(n));
  }
  return { levels: lv, crafts: Array.isArray(r?.crafts) ? r!.crafts.filter(c => c && typeof c.recipe === 'string') : [] };
}

export class SaveManager {
  data: SaveData;
  lastError: string | null = null;
  constructor(public storage: SaveStorage = createStorage()) {
    this.data = this.load();
  }

  load(): SaveData {
    const raw = this.storage.read();
    if (!raw) return newSave();
    try { return normalize(migrate(JSON.parse(raw))); }
    catch (e) {
      this.lastError = String(e);
      // No machacamos un guardado que no entendemos: se aparta como copia de seguridad.
      try { localStorage.setItem('gengi.save.corrupto.' + Date.now(), raw); } catch { /* sin espacio */ }
      return newSave();
    }
  }

  /** Escritura síncrona inmediata. Siempre sobrescribe: nunca se vuelve a un estado anterior. */
  save() {
    this.data.updatedAt = new Date().toISOString();
    this.data.rev = (this.data.rev ?? 0) + 1;
    writeMark(this.data.profileId, { raids: this.data.stats.raids, rev: this.data.rev });
    try { this.storage.write(JSON.stringify(this.data)); this.lastError = null; }
    catch (e) { this.lastError = 'No se pudo guardar: ' + e; }
  }

  exportString() { return JSON.stringify({ ...this.data, exportedAt: new Date().toISOString() }, null, 1); }

  /** Importa un guardado (de esta versión o anterior). Lanza error si no es válido. */
  importString(s: string) {
    const parsed = JSON.parse(s);
    if (typeof parsed !== 'object' || !parsed) throw new Error('Archivo no válido');
    if (parsed.saveVersion !== undefined && typeof parsed.saveVersion !== 'number') throw new Error('Archivo no válido');
    const d = normalize(migrate(parsed));
    delete (d as unknown as Record<string, unknown>).exportedAt;
    // anti-retroceso: una copia anterior de la misma partida no se puede importar
    if (ANTI_ROLLBACK.enabled) {
      writeMark(this.data.profileId, { raids: this.data.stats.raids, rev: this.data.rev });
      if (isRollback(d.profileId, { raids: d.stats.raids, rev: d.rev }))
        throw new Error('Esa copia es anterior a tu partida actual: no se puede volver atrás. Solo se puede importar una copia más reciente de esta partida o una partida distinta.');
    }
    this.data = d;
    this.save();
  }

  reset() { this.data = newSave(); this.save(); }
}
