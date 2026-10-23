import type { AbilityId } from '../data/items';
import type { EnemyType } from '../data/enemies';
import type { Rarity } from '../data/rarity';
import type { ItemInst, Loadout } from '../game/inventory';
import type { ContainerKind } from '../game/loot';

/** Versión actual del formato de guardado. Súbela y añade una migración en migrations.ts al cambiar el formato. */
export const SAVE_VERSION = 1;

export type TargetPriority = 'cercano' | 'debil' | 'peligroso';

export interface Settings {
  prioridad: TargetPriority;
  /** Rareza mínima de equipo que se recoge solo (consumibles, munición, bengalas y chapas se recogen siempre). */
  rarezaMin: Rarity;
  /** Curarse solo por debajo de este % de vida (0 = nunca). */
  curarUmbral: number;
  /** Consumible del botón rápido. */
  rapido: 'vendaje' | 'botiquin';
  /** Mano del joystick: izquierda por defecto. */
}

export type RaidResult = 'extraido' | 'muerto';

export interface RaidLogEntry {
  id: string;
  startedAt: string;
  endedAt: string;
  /** Minuto (con decimales) en que acabó. */
  minute: number;
  result: RaidResult;
  /** Qué mató al jugador (si murió). */
  killedBy: string | null;
  valueIn: number;
  valueOut: number;
  kills: number;
  exitType: string | null;
}

export type ExitType = 'pie' | 'generador' | 'bengala' | 'pago';

export interface ExitState {
  loc: number;
  type: ExitType;
  x: number;
  y: number;
  /** Generador: segundos acumulados de activación. */
  gen: number;
  /** Generador encendido / bengala lanzada / pago entregado. */
  unlocked: boolean;
  /** Momento (s de raid) en que se lanzó la bengala. */
  flareAt: number | null;
}

export interface EnemySnap {
  type: EnemyType; x: number; y: number; hp: number; maxHp: number; dmg: number;
  /** Abominación: punto que guarda. */
  gx?: number; gy?: number;
  /** Hinchado ya hinchándose: segundos que le quedan. */
  swell?: number;
  bleed?: number;
}

export interface ContainerSnap { id: number; x: number; y: number; kind: ContainerKind; items: ItemInst[]; opened: boolean }

export interface RaidSnapshot {
  id: string;
  seed: number;
  startedAt: string;
  elapsed: number;
  valueIn: number;
  kills: number;
  player: { x: number; y: number; hp: number; healLeft: number; healRate: number; aguantar: number; cds: Partial<Record<AbilityId, number>>; reload: number };
  loadout: Loadout;
  enemies: EnemySnap[];
  containers: ContainerSnap[];
  exits: ExitState[];
  acid: { x: number; y: number; t: number }[];
  spawnTimer: number;
  /** Población inicial pendiente de entrar en streaming (persistida para retomar exacto). */
  stream?: { groups: number; hinchados: number; t: number };
  hordeCd: number;
  /** Contador monotónico de guardados de esta raid (diagnóstico). */
  saves: number;
}

export interface SaveData {
  saveVersion: number;
  createdAt: string;
  updatedAt: string;
  chapas: number;
  stash: ItemInst[];
  /** Objetos que no cupieron en el alijo al extraer (nunca se pierden). */
  overflow: ItemInst[];
  loadout: Loadout;
  settings: Settings;
  raidLog: RaidLogEntry[];
  activeRaid: RaidSnapshot | null;
  stats: { raids: number; extracted: number; deaths: number };
}
