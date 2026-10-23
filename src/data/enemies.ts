import { TILE } from '../config/constants';

export type EnemyType = 'errante' | 'corredor' | 'hinchado' | 'abominacion';

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
}

export const ENEMIES: Record<EnemyType, EnemyDef> = {
  errante: { type: 'errante', nombre: 'Errante', hp: 30, dmg: 6, speed: 1.7, size: 44, danger: 1, dropChance: 0.15 },
  corredor: { type: 'corredor', nombre: 'Corredor', hp: 18, dmg: 5, speed: 4.6, size: 40, danger: 2, dropChance: 0.15 },
  hinchado: { type: 'hinchado', nombre: 'Hinchado', hp: 40, dmg: 0, speed: 1.3, size: 52, danger: 0, dropChance: 0.3 },
  abominacion: { type: 'abominacion', nombre: 'Abominación', hp: 300, dmg: 18, speed: 2.6, size: 96, danger: 3, dropChance: 0 },
};

/** Telegrafiado de ataques (diseño v1). */
export const ATTACKS = {
  errante: { triggerTiles: 1.6, windup: 0.6, lungeTiles: 1.5, lungeSec: 0.22, recover: 0.7 },
  corredor: { triggerTiles: 4.5, windup: 0.5, chargeTiles: 4, chargeSec: 0.4, recover: 0.9 },
  hinchado: { swell: 1, radiusTiles: 1.8, dmg: 20, acidSec: 4, acidDps: 6 },
  abominacion: { triggerTiles: 2.2, windup: 1, radiusTiles: 2.5, dmg: 35, recover: 1.0,
    coneEvery: 15, coneWindup: 0.8, coneTiles: 5, coneAngle: 0.9, coneDmg: 18, guardTiles: 7 },
};

export const px = (tilesN: number) => tilesN * TILE;
