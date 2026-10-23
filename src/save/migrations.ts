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
  /**
   * 2 → 3 (v3): refugio con estaciones (todas a nivel 1), tres vendedores sin reputación, mochila de espalda
   * y casillas extra del bolsillo vacías. No se toca nada de lo que ya había (alijo, equipo, raid activa, salidas vistas).
   */
  2: (d) => {
    const out = { ...d, saveVersion: 3 };
    const fix = (lo: AnySave) => lo ? { ...lo, espalda: lo.espalda ?? null, bolsilloExtra: Array.isArray(lo.bolsilloExtra) ? lo.bolsilloExtra : [] } : lo;
    out.loadout = fix(out.loadout);
    if (out.activeRaid) out.activeRaid = { ...out.activeRaid, loadout: fix(out.activeRaid.loadout) };
    // refugio y vendedores: los rellena normalize() con valores por defecto (nivel 1, rep. 1, sin stock: se genera al abrir la tienda)
    return out;
  },
  /**
   * 3 → 4 (v3.1, corrección de reputación): se conserva la XP de cada vendedor, pero los niveles 3 y 4 exigen ahora
   * misiones de ese vendedor. Las misiones cumplidas antes no se guardaban → cuentan 0 y el nivel se queda en 2 como máximo
   * hasta cumplir las que falten (la XP sigue ahí: al cumplirlas se recupera el nivel). El stock se regenera al nivel nuevo.
   */
  3: (d) => {
    const out = { ...d, saveVersion: 4 };
    if (out.vendors) {
      out.vendors = Object.fromEntries(Object.entries(out.vendors as Record<string, AnySave>).map(([k, v]) => [k, { ...v, missionsDone: v.missionsDone ?? 0, buyXp: 0, stockLevel: -1 }]));
    }
    return out;
  },
  /**
   * 4 → 5 (v4): mochilas con casillas propias (sin mochila = 6 bolsillos; la escolar gratuita da 12) y el mapa 1 pasa a ser
   * El Arrabal ('arrabal-v4'). Las salidas vistas 0-2 del mapa v2 siguen en el mismo sitio → se copian; el helipuerto (3) no.
   * Quien no lleve mochila recibe la escolar gratuita (también en la raid activa: así no pierde las 12 casillas que tenía).
   * Una raid activa del mapa anterior se repuebla en el mapa nuevo (se conservan equipo, vida y tiempo).
   */
  4: (d) => {
    const out = { ...d, saveVersion: 5 };
    const seen = { ...(out.seenExits ?? {}) };
    if (seen['ciudad-v2'] && !seen['arrabal-v4']) seen['arrabal-v4'] = (seen['ciudad-v2'] as number[]).filter(i => i >= 0 && i <= 2);
    out.seenExits = seen;
    let n = 0;
    const bag = (lo: AnySave) => lo && !lo.espalda ? { ...lo, espalda: { uid: 'free-mig5-' + (n++), def: 'mochila_escolar', rarity: 'comun', qty: 1, free: true } } : lo;
    out.loadout = bag(out.loadout);
    if (out.activeRaid) {
      out.activeRaid = { ...out.activeRaid, loadout: bag(out.activeRaid.loadout) };
      if (out.activeRaid.mapId !== 'arrabal-v4') out.activeRaid.repopulate = true;
    }
    return out;
  },
  /**
   * 5 → 6 (v4.0): nivel 1 sin experiencia ni atributos; id de partida derivado de createdAt (así una copia exportada
   * antes de la v4.0 se reconoce como la misma partida) y contador de guardados a 0.
   */
  5: (d) => {
    const out = { ...d, saveVersion: 6 };
    out.profileId = out.profileId ?? (out.createdAt ? profileIdFor(String(out.createdAt)) : undefined);
    out.rev = typeof out.rev === 'number' ? out.rev : 0;
    if (out.activeRaid) out.activeRaid = { ...out.activeRaid, xp: out.activeRaid.xp ?? 0 };
    return out;
  },
};

/** Id estable de una partida a partir de su fecha de creación. */
export function profileIdFor(createdAt: string) {
  let h = 2166136261;
  for (let i = 0; i < createdAt.length; i++) { h ^= createdAt.charCodeAt(i); h = Math.imul(h, 16777619); }
  return 'p' + (h >>> 0).toString(36);
}

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
