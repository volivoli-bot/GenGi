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
  /**
   * 1 → 2 (v2): salidas descubiertas por mapa (vacío: hay que volver a verlas en el mapa nuevo, 3× más grande)
   * y una raid activa del mapa v1 queda marcada para repoblarse en el mapa nuevo (se conservan equipo, vida y tiempo).
   */
  1: (d) => {
    const out = { ...d, saveVersion: 2, seenExits: d.seenExits ?? {} };
    // nueva ranura de arma de reserva
    if (out.loadout) out.loadout = { ...out.loadout, reserva: out.loadout.reserva ?? null };
    if (out.activeRaid?.loadout) out.activeRaid = { ...out.activeRaid, loadout: { ...out.activeRaid.loadout, reserva: out.activeRaid.loadout.reserva ?? null } };
    if (out.activeRaid && !out.activeRaid.mapId) out.activeRaid = { ...out.activeRaid, repopulate: true };
    // el arco ahora gasta flechas: quien ya tuviera arco recibe un carcaj para no quedarse sin poder usarlo
    const lo = out.activeRaid?.loadout ?? out.loadout ?? {};
    const all = [...(out.stash ?? []), ...(out.overflow ?? []), lo.arma, ...(lo.mochila ?? [])].filter(Boolean);
    if (all.some((i: AnySave) => i.def === 'arco')) (out.stash = out.stash ?? []).push({ uid: 'mig2-flechas', def: 'flechas', rarity: 'comun', qty: 12 });
    return out;
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
