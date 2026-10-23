import { SAVE_VERSION } from './types';

/**
 * Migraciones del formato de guardado: MIGRATIONS[n] convierte un guardado de la versión n a la n+1.
 * Versión 0 = formato del prototipo (sin campo saveVersion): { chapas, alijo: [{ id, rareza }] }.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySave = any;

export const MIGRATIONS: Record<number, (d: AnySave) => AnySave> = {
  0: (d) => {
    const now = new Date().toISOString();
    return {
      saveVersion: 1,
      createdAt: now,
      updatedAt: now,
      chapas: Number(d.chapas) || 0,
      stash: (Array.isArray(d.alijo) ? d.alijo : []).map((o: AnySave, i: number) => ({
        uid: 'mig-' + i + '-' + Math.random().toString(36).slice(2, 6),
        def: String(o.id), rarity: o.rareza ?? 'comun', qty: Number(o.cantidad) || 1,
      })),
      overflow: [],
      loadout: { arma: null, torso: null, cabeza: null, mochila: [], bolsillo: null },
      raidLog: [],
      activeRaid: null,
    };
  },
};

export function migrate(raw: AnySave): AnySave {
  let d = raw;
  let v = typeof d.saveVersion === 'number' ? d.saveVersion : 0;
  if (v > SAVE_VERSION) throw new Error(`Guardado de una versión más nueva (${v}) que el juego (${SAVE_VERSION}). Actualiza el juego.`);
  while (v < SAVE_VERSION) {
    const m = MIGRATIONS[v];
    if (!m) throw new Error(`No hay migración desde la versión ${v}`);
    d = m(d);
    v = d.saveVersion;
  }
  return d;
}

/** Ejemplo de guardado antiguo para probar la migración (gancho de depuración). */
export const LEGACY_SAMPLE = { chapas: 77, alijo: [{ id: 'machete', rareza: 'reforzado' }, { id: 'vendaje', cantidad: 3 }] };
