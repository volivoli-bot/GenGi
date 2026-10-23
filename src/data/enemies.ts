import { TILE } from '../config/constants';

export type EnemyType = 'errante' | 'corredor' | 'hinchado' | 'abominacion'
  | 'escupidor' | 'chillon' | 'acechador' | 'bruto' | 'reptante' | 'enjambre'
  // v4.2 Zona Helada (diseno-v4 §4)
  | 'congelado' | 'lobo' | 'escarcha' | 'matriarca';

/** Enemigos de la v3 (comportamiento en raid/enemies3.ts). */
export const V3_TYPES: EnemyType[] = ['escupidor', 'chillon', 'acechador', 'bruto', 'reptante', 'enjambre'];

export interface EnemyDef {
  type: EnemyType;
  nombre: string;
  hp: number;
  dmg: number;
  /** casillas/s */
  speed: number;
  size: number;
  /** Prioridad "peligroso" del ataque automático (más alto = antes). */
  danger: number;
  /** Probabilidad de soltar botín al morir. */
  dropChance: number;
  /** v4.2: comportamiento que reutiliza (el Congelado ataca como el Errante, el Lobo como el Corredor…). */
  ai?: EnemyType;
}

export const ENEMIES: Record<EnemyType, EnemyDef> = {
  errante: { type: 'errante', nombre: 'Errante', hp: 30, dmg: 6, speed: 1.7, size: 44, danger: 1, dropChance: 0.15 },
  corredor: { type: 'corredor', nombre: 'Corredor', hp: 18, dmg: 5, speed: 4.6, size: 40, danger: 2, dropChance: 0.15 },
  hinchado: { type: 'hinchado', nombre: 'Hinchado', hp: 40, dmg: 0, speed: 1.3, size: 52, danger: 0, dropChance: 0.3 },
  abominacion: { type: 'abominacion', nombre: 'Abominación', hp: 300, dmg: 18, speed: 2.6, size: 96, danger: 3, dropChance: 0 },
  // v3 (diseño §4). dmg: Escupidor = bola de ácido; Reptante = daño por segundo del agarre; Enjambre = mordisco.
  escupidor: { type: 'escupidor', nombre: 'Escupidor', hp: 28, dmg: 6, speed: 1.8, size: 44, danger: 3, dropChance: 0.15 },
  chillon: { type: 'chillon', nombre: 'Chillón', hp: 22, dmg: 0, speed: 2.1, size: 44, danger: 4, dropChance: 0.15 },
  acechador: { type: 'acechador', nombre: 'Acechador', hp: 35, dmg: 25, speed: 3.2, size: 44, danger: 3, dropChance: 0.2 },
  bruto: { type: 'bruto', nombre: 'Bruto', hp: 160, dmg: 30, speed: 1.5, size: 72, danger: 3, dropChance: 0.3 },
  reptante: { type: 'reptante', nombre: 'Reptante', hp: 45, dmg: 4, speed: 0, size: 52, danger: 3, dropChance: 0.2 },
  enjambre: { type: 'enjambre', nombre: 'Enjambre', hp: 5, dmg: 3, speed: 3.8, size: 18, danger: 1, dropChance: 0 },
  // v4.2 Zona Helada (§4). Los números de sus ataques están en config/v42.ts.
  congelado: { type: 'congelado', nombre: 'Congelado', hp: 32, dmg: 7, speed: 1.5, size: 46, danger: 1, dropChance: 0.15, ai: 'errante' },
  lobo: { type: 'lobo', nombre: 'Lobo mutado', hp: 24, dmg: 6, speed: 4.6, size: 44, danger: 2, dropChance: 0.1, ai: 'corredor' },
  escarcha: { type: 'escarcha', nombre: 'Escarcha', hp: 26, dmg: 2, speed: 1.8, size: 44, danger: 3, dropChance: 0.15, ai: 'escupidor' },
  matriarca: { type: 'matriarca', nombre: 'La Matriarca', hp: 2000, dmg: 30, speed: 1.6, size: 168, danger: 5, dropChance: 0 },
};
/** Comportamiento base de cada tipo (el propio si no reutiliza otro). */
export const aiOf = (t: EnemyType): EnemyType => ENEMIES[t].ai ?? t;

/** Textura del cuerpo físico invisible (el radio del círculo sale del ancho de la textura). */
export const BODY_TEX: Record<string, string> = { escupidor: 'errante', chillon: 'errante', acechador: 'errante', bruto: 'errante', reptante: 'errante', enjambre: 'errante', congelado: 'errante', lobo: 'errante', escarcha: 'errante', matriarca: 'abominacion' };

/** Telegrafiado de ataques (diseño v1). */
export const ATTACKS = {
  errante: { triggerTiles: 1.6, windup: 0.6, lungeTiles: 1.5, lungeSec: 0.22, recover: 0.7 },
  corredor: { triggerTiles: 4.5, windup: 0.5, chargeTiles: 4, chargeSec: 0.4, recover: 0.9 },
  hinchado: { swell: 1, radiusTiles: 1.8, dmg: 20, acidSec: 4, acidDps: 6 },
  abominacion: { triggerTiles: 2.2, windup: 1, radiusTiles: 2.5, dmg: 35, recover: 1.0,
    coneEvery: 15, coneWindup: 0.8, coneTiles: 5, coneAngle: 0.9, coneDmg: 18, guardTiles: 7 },
};

export const px = (tilesN: number) => tilesN * TILE;
