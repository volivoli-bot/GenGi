import type { AttrId } from '../config/levels';
import type { AbilityId } from '../data/items';
import type { EnemyType } from '../data/enemies';
import type { Rarity } from '../data/rarity';
import type { ItemInst, Loadout } from '../game/inventory';
import type { ContainerKind } from '../game/loot';
import type { MutationId, StationId, VendorId } from '../config/v3';

/** Versión actual del formato de guardado. Súbela y añade una migración en migrations.ts al cambiar el formato. */
export const SAVE_VERSION = 6;

export type TargetPriority = 'cercano' | 'debil' | 'peligroso';

export interface Settings {
  prioridad: TargetPriority;
  /** Rareza mínima de equipo que se recoge solo (consumibles, munición, bengalas y chapas se recogen siempre). */
  rarezaMin: Rarity;
  /** Curarse solo por debajo de este % de vida (0 = nunca). */
  curarUmbral: number;
  /** Consumible del botón rápido. */
  rapido: 'vendaje' | 'botiquin';
  /** Sigilo: conos tenues de visión de los enemigos en el suelo (dificultad normal). Los expertos pueden quitarlos. */
  conosEnemigos: boolean;
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

export type ExitType = 'pie' | 'generador' | 'bengala' | 'pago' | 'helipuerto';

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

export interface TraperoSnap {
  x: number; y: number;
  /** Visto alguna vez (aparece en el minimapa). */
  found: boolean;
  vales: number;
  stock: { item: ItemInst; price: number; sold: boolean }[];
}

export interface EnemySnap {
  type: EnemyType; x: number; y: number; hp: number; maxHp: number; dmg: number;
  /** Abominación: punto que guarda. */
  gx?: number; gy?: number;
  /** Hinchado ya hinchándose: segundos que le quedan. */
  swell?: number;
  bleed?: number;
  /** v3: mutación (min 10), grupo de enjambre, alcantarilla del Reptante. */
  mut?: MutationId;
  group?: number;
  sewer?: number;
  /** v3.1: élite (vida/daño ya multiplicados en hp/dmg). */
  elite?: boolean;
  /** v4: guardián helado de la guarida. */
  lair?: boolean;
  /** v4b: salió en una oleada/horda (da el 30 % de experiencia). */
  wave?: boolean;
  /** v4.2: el Congelado conserva el caparazón. */
  ice?: boolean;
}

export interface ContainerSnap { id: number; x: number; y: number; kind: ContainerKind; items: ItemInst[]; opened: boolean }

export interface RaidSnapshot {
  id: string;
  seed: number;
  startedAt: string;
  elapsed: number;
  valueIn: number;
  kills: number;
  player: { x: number; y: number; hp: number; healLeft: number; healRate: number; aguantar: number; cds: Partial<Record<AbilityId, number>>; reload: number;
    /** Prueba v2: cargas de sangrado / veneno (segundos que le quedan a cada una). */
    bleed?: number[]; poison?: number[] };
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
  /** v2: id del mapa de la raid y estado del mundo que cambia (puertas abiertas, salidas vistas en esta raid). */
  mapId?: string;
  doorsOpen?: number[];
  /** v2: guardado antiguo (mapa v1) que hay que repoblar en el mapa nuevo al reanudar. */
  repopulate?: boolean;
  /** v2: flechas clavadas/caídas por el suelo, recuperables. */
  arrows?: { x: number; y: number; qty: number; def?: string }[];
  /** v3.1: élites aparecidos en esta incursión (tope ELITE.maxPerRaid). */
  elites?: number;
  /** v3.1 §9.4: el Trapero de esta incursión (null = no hay). Los vales viven aquí: se pierden al acabar la incursión. */
  trapero?: TraperoSnap | null;
  /** v3: casillas del bolsillo seguro y nivel de radio con que se entró (estaciones del refugio). */
  pocketSlots?: number;
  radio?: number;
  /** v3: seguimiento para las misiones de los vendedores. */
  track?: RaidTrack;
  /** v3: gritos de Chillón activos (zona de dificultad local). */
  screams?: { x: number; y: number; until: number }[];
  /** v3: efectos del jugador (adrenalina, antídoto, estimulante, inmunidad al agarre). */
  fx?: { adren?: number; antidoto?: number; estim?: number; grabImm?: number };
  /** v3: siguiente id de grupo de enjambre. */
  nextGroup?: number;
  /** v4.0: experiencia de la incursión aún no asegurada (se suma al extraer) y su desglose. */
  xp?: number;
  xpBy?: Partial<Record<'kills' | 'cajas' | 'mision' | 'extraer' | 'boss', number>>;
  /** v4b: id de la definición del mapa (MapDef.id; `mapId` es su saveId) y experiencia base por muertes acumulada (para el tope de 1.500). */
  mapDefId?: string;
  killBase?: number;
}

export interface RaidTrack {
  heals: number;
  dmgTaken: number;
  /** Bajas por tipo: m = cuerpo a cuerpo, r = a distancia, o = otras (explosiones, ácido...). */
  kills: Record<string, { m: number; r: number; o: number }>;
}

export interface StockEntry { id: string; rarity: Rarity; qty: number; left: number; traits?: ItemInst['traits'] }
export interface VendorState {
  xp: number;
  stock: StockEntry[];
  /** Nº de raids (stats.raids) cuando se generó el stock / nivel con que se generó. */
  stockAt: number;
  stockLevel: number;
  offers: string[];
  active: string | null;
  /** Progreso de la misión activa (acumulativas). */
  progress: number;
  /** v3.1: misiones cumplidas de este vendedor (niveles 3-4) y reputación ganada comprando en la renovación actual (tope). */
  missionsDone?: number;
  buyXp?: number;
}
export interface CraftJob { recipe: string; readyAt: number }
export interface Refugio { levels: Record<StationId, number>; crafts: CraftJob[] }

export interface SaveData {
  saveVersion: number;
  /** v4b: mapa elegido en la Mesa de Mapas (MapDef.id). */
  mapSel?: string;
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
  /** v2: salidas descubiertas (vistas al menos una vez) por mapa: índices de exitLocs. */
  seenExits: Record<string, number[]>;
  /** v3: estaciones del refugio y cola de fabricación. */
  refugio: Refugio;
  /** v3: los tres vendedores (reputación, stock, misiones). */
  vendors: Record<VendorId, VendorState>;
  /** v4.0: nivel, experiencia asegurada y atributos. */
  prog: Progress;
  /** v4.0 (anti-retroceso): id de la partida (no cambia nunca) y contador de guardados (solo sube). */
  profileId: string;
  rev: number;
}

/** v4.0 §2: progreso del personaje. `xp` = experiencia asegurada hacia el siguiente nivel. */
export interface Progress {
  level: number;
  xp: number;
  /** Experiencia total asegurada (estadística). */
  total: number;
  /** Puntos de atributo sin asignar. */
  free: number;
  attrs: Record<AttrId, number>;
  /** Gimnasio: tope extra por atributo (+5 por mejora). */
  gym: Partial<Record<AttrId, number>>;
  /** Pizarra 2: stats.raids de la última vez que se quitó un punto barato. */
  cheapRespecAt: number;
  /** Pizarra 3: cambios completos gratis ya usados. */
  freeResets?: number;
  lastLevelUp: number;
}
