import { ITEMS } from '../data/items';
import { RARITIES } from '../data/rarity';
import { emptyLoadout, ItemInst } from '../game/inventory';
import { migrate } from './migrations';
import { createStorage, SaveStorage } from './storage';
import { SAVE_VERSION, SaveData, Settings } from './types';

export const defaultSettings = (): Settings => ({ prioridad: 'cercano', rarezaMin: 'comun', curarUmbral: 35, rapido: 'vendaje' });

export function newSave(): SaveData {
  const now = new Date().toISOString();
  return {
    saveVersion: SAVE_VERSION, createdAt: now, updatedAt: now,
    chapas: 60, stash: [], overflow: [], loadout: emptyLoadout(),
    settings: defaultSettings(), raidLog: [], activeRaid: null,
    stats: { raids: 0, extracted: 0, deaths: 0 },
    seenExits: {},
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
    loadout: { arma: okItem(lo.arma) ? lo.arma : null, torso: okItem(lo.torso) ? lo.torso : null, cabeza: okItem(lo.cabeza) ? lo.cabeza : null, bolsillo: okItem(lo.bolsillo) ? lo.bolsillo : null, reserva: okItem(lo.reserva) ? lo.reserva : null, mochila: (lo.mochila ?? []).filter(okItem) },
    raidLog: d.raidLog ?? [],
    activeRaid: d.activeRaid ?? null,
    seenExits: d.seenExits && typeof d.seenExits === 'object' ? d.seenExits : {},
  } as SaveData;
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
    this.data = d;
    this.save();
  }

  reset() { this.data = newSave(); this.save(); }
}
