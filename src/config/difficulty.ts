/**
 * Curva de dificultad de GenGi: TODOS los parámetros ajustables están aquí.
 * Dott/Basu: cambiad estos números tras cada ronda de pruebas; no hace falta tocar el resto del código.
 */
export const DIFFICULTY = {
  /** Duración máxima antes de la niebla (s). */
  raidSeconds: 15 * 60,
  /** Aviso de niebla (s). */
  fogWarningSeconds: 13 * 60,
  /** Niebla: % de vida máxima por segundo al empezar y cuánto crece cada 30 s. */
  fogDpsPct: 2,
  fogDpsGrowthPctPer30s: 1,

  /** +10 % de aparición de enemigos por minuto. */
  spawnRatePerMinute: 0.10,
  /** +4 % de vida y daño enemigos por minuto. */
  statScalePerMinute: 0.04,
  /** Segundos entre oleadas de aparición en el minuto 0 (se divide por el multiplicador de aparición). */
  baseSpawnIntervalSec: 9,
  /** Población inicial. */
  initialErranteGroups: 9,
  erranteGroupMin: 3,
  erranteGroupMax: 5,
  initialHinchados: 4,
  /** Límite de enemigos vivos a la vez (rendimiento en móvil). */
  maxAlive: 75,

  /** Minuto en que entran los Corredores en las oleadas. */
  corredorFromMinute: 4,
  /** Minuto a partir del cual salen más Hinchados. */
  moreHinchadosFromMinute: 7,
  /** Minuto a partir del cual el ruido atrae hordas de forma permanente. */
  hordeFromMinute: 10,
  hordeSizeMin: 5,
  hordeSizeMax: 8,
  /** Ruido mínimo (radio en casillas) que dispara una horda tras el minuto de hordas. */
  hordeNoiseThreshold: 6,
  hordeCooldownSec: 20,
  /** A partir del minuto de hordas, el ruido llega este factor más lejos. */
  hordeNoiseRadiusMult: 1.6,

  /** Corredor de castigo si estás quieto este tiempo (s). */
  idleCorredorSec: 20,

  /** Probabilidades de cada tipo en una oleada normal según la fase. */
  waveMix: {
    early: { errante: 1 },
    corredores: { errante: 0.75, corredor: 0.25 },
    hinchados: { errante: 0.6, corredor: 0.25, hinchado: 0.15 },
  },

  /** Radio de detección por vista (casillas). */
  sightTiles: 7,
  /** Cuánto tiempo recuerdan los enemigos una fuente de ruido (s). */
  noiseMemorySec: 8,
};

/** Multiplicadores para un minuto dado (fracción continua permitida). */
export function scaling(minute: number) {
  return {
    spawn: 1 + DIFFICULTY.spawnRatePerMinute * minute,
    stats: 1 + DIFFICULTY.statScalePerMinute * minute,
  };
}
