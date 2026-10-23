/**
 * v4.2 Zona Helada (diseno-v4.md §4): enemigos de la nieve y La Matriarca. Todos los números de diseño, aquí.
 */
import type { EnemyType } from '../data/enemies';

/** En la nieve, los enemigos normales que aparecen se cambian por su versión helada. */
export const SNOW_ENEMIES = {
  enabled: true,
  swap: { errante: 'congelado', corredor: 'lobo', escupidor: 'escarcha' } as Partial<Record<EnemyType, EnemyType>>,
  /** Los Lobos van en manadas de 3. */
  wolfPack: 3,
};

/** Congelado: el primer golpe solo rompe el caparazón de hielo (50 % de daño). */
export const CONGELADO = { shellMult: 0.5, tint: 0xcfeaff };

/** Lobo mutado: rodea por los lados (flanqueo más abierto) y su mordisco sangra el 50 % de las veces. */
export const LOBO = { bleedChance: 0.5, flankDeg: 70, flankUntilTiles: 2.2 };

/** Escarcha: escupe hielo (como el Escupidor) que ralentiza un 40 % durante 2 s, sin daño grande. */
export const ESCARCHA = { slow: 0.4, slowSec: 2, dmg: 2 };

/** La Matriarca (jefe de la Zona Helada). Todos sus ataques se avisan y solo empiezan en pantalla. */
export const MATRIARCA = {
  /** Se activa si te ve a menos de esto de su guarida; te deja de perseguir a `leashTiles` de ella. */
  arenaTiles: 9, leashTiles: 15,
  /** Aunque no te vea, te nota si estás a menos de esto con línea de visión (por la espalda sigue habiendo puñalada). */
  feelTiles: 3.5,
  /** Peso para el tambaleo (resistente: casi no la mueve ningún arma). */
  staggerWeight: 40,
  /** Pausa entre ataques (s); en fase 2 ×p2Cooldown. */
  cooldownSec: 1.6, recoverSec: 0.7,
  /** 1. Pisotón: se agacha `stompWindup` s y lanza un anillo de `stompTiles` casillas. */
  stompWindup: 1, stompTiles: 3, stompDmg: 28,
  /** 2. Lanzas de hielo: 3 líneas marcadas `lanceWarn` s; las columnas (paredes) cortan la línea. */
  lanceWarn: 0.8, lanceTiles: 9, lanceWidthTiles: 0.8, lanceSpreadRad: 0.38, lanceDmg: 22,
  /** 3. Aliento helado: cono de 60° durante 2 s que ralentiza mucho; deja charcos de hielo 6 s. */
  breathWarn: 0.6, breathSec: 2, breathTiles: 5, breathDeg: 60, breathTurnRad: 0.7, breathSlow: 0.65, breathDps: 6,
  puddleSec: 6, puddles: 4, puddleTiles: 0.9, puddleSlow: 0.4,
  /** 4. Llamada: con un 60 % y un 30 % de vida grita y salen 4 Congelados y 2 Lobos. */
  callAt: [0.6, 0.3], callWindup: 1, callSpawn: { congelado: 4, lobo: 2 } as Partial<Record<EnemyType, number>>,
  /** 5. Fase 2 (por debajo del 40 %): más rápida, encadena pisotón + lanzas y caen carámbanos (sombra 1 s antes). */
  phase2At: 0.4, p2Speed: 1.4, p2Cooldown: 0.6,
  icicleEverySec: 2.6, icicles: 3, icicleWarn: 1, icicleTiles: 0.8, icicleSpreadTiles: 2.2, icicleDmg: 14,
  /** Punto débil: las pústulas de la espalda (daño ×2 si le das por detrás, arco de `backArcDeg`). */
  backMult: 2, backArcDeg: 120,
  /** Barra de vida sobre ella. */
  barW: 140,
};
