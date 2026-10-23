/**
 * GenGi v4d — cambios de Pablo (22:22), especificación de Basu en diseno-v4.md §7.
 * Todos los números de v4d viven aquí (Dott/Basu: ajustad aquí).
 */

/** Rangos de nivel por mapa [mín, máx]. Siempre 2 mapas disponibles a partir del nivel 5. */
export const MAP_RANGES: Record<string, [number, number]> = {
  arrabal: [1, 12],
  via_muerta: [5, 22],
  crater: [12, 40], // hasta que llegue el mapa 5 (Dott/Basu)
  colmena: [22, 40],
};

/** Experiencia: sin tope por incursión. Las muertes de oleada siguen dando el 30 %. */
export const XP4D = { removeKillCap: true };

/** Presión del final de la incursión. */
export const LATE_RAID = {
  /** Vida y daño enemigos: +4 %/min hasta el minuto 10; desde ahí +9 %/min. */
  statPerMinEarly: 0.04,
  statPerMinLate: 0.09,
  lateFromMinute: 10,
  /** Aviso en el minuto 10. */
  warnMinute: 10,
  warnText: 'Se acercan cazadores',
  /** Cazadores: desde el minuto 11, 1 élite cada 60 s que va directo a tu último ruido. */
  huntersFromMinute: 11,
  hunterEverySec: 60,
  /** Tipos que pueden salir como cazador (élite). */
  hunterTypes: ['corredor', 'bruto', 'errante', 'acechador'] as string[],
  /** Aparecen fuera de pantalla, a esta distancia del jugador (casillas). */
  hunterSpawnTiles: [12, 18] as [number, number],
  /** Minuto 13: la niebla avanza el doble de rápido (el reloj de la niebla corre ×2). */
  fogFastFromMinute: 13,
  fogFastMult: 2,
};

/** Armas a distancia: sin disparo automático; tiempo entre disparos (s). */
export const RANGED = {
  autoFire: false,
  intervalSec: { pistola: 0.8, arco: 1.4, ballesta: 1.8, escopeta: 1.2 } as Record<string, number>,
  /** El contador de munición parpadea en rojo con esto o menos. */
  lowAmmo: 3,
};

/** Escopeta (nueva). */
export const SHOTGUN = {
  pellets: 6,
  coneDeg: 25,
  rangeTiles: 4.5,
  pelletDmg: 7,
  /** A partir de 3 casillas cada perdigón hace el 60 %. */
  falloffFromTiles: 3,
  falloffMult: 0.6,
  mag: 4,
  reloadPerShellSec: 0.5,
  /** v4e (Basu): la recarga solo empieza tras este tiempo sin apuntar ni disparar; apuntar o disparar la corta. */
  reloadDelaySec: 0.8,
  noiseTiles: 9,
  /** Peso del arma (kg): en items.ts. */
  weight: 4,
  /** Tambaleo fuerte: empuje por perdigón (px/s para masa 1; se suman) y duración (s, ≥ 0,3 interrumpe avisos). */
  knockbackPerPellet: 110,
  staggerSec: 0.4,
  /** Velocidad de los perdigones (casillas/s). */
  pelletTilesPerSec: 16,
  ammo: 'cartuchos',
  /** Precio base del arma y de cada cartucho en el Trapero (se multiplica por la rareza). */
  price: 170,
  shellPrice: 8,
};

/** Habilidades de armas a distancia: temporales, no disparos. */
export const WEAPON_BUFFS = {
  rafaga: { nombre: 'Ráfaga', sec: 4, cooldown: 20, intervalMult: 0.5 },
  ojo_halcon: { nombre: 'Ojo de halcón', sec: 6, cooldown: 22, critAdd: 0.5 },
  perforacion: { nombre: 'Perforación', sec: 6, cooldown: 22, pierce: 3 },
  postas: { nombre: 'Postas concentradas', sec: 5, cooldown: 20, coneDeg: 12, rangeMult: 1.4 },
};
export type BuffId = keyof typeof WEAPON_BUFFS;
export const isBuff = (id: string): id is BuffId => id in WEAPON_BUFFS;

/** HUD v4d: venda y botiquín a la izquierda del arco (44 px, uno encima del otro). */
export const HUD4D = {
  /** false = disposición anterior (v4). */
  layout: true,
  /** Venda y botiquín fijos en sus botones (si no, el consumible preferido va primero). */
  fixedHeal: true,
  healButtonPx: 44,
  /** Separación entre los dos botones y respecto del primer botón del arco (px). */
  healGapPx: 8,
  /** Ángulos del arco (180 = izquierda, 270 = arriba): arma, casco, chaleco. */
  arcDeg: [200, 235, 270],
};

/**
 * Niebla v2 (Basu, diseno-v4 §7 «Niebla v2»): una sola RenderTexture a 1/4 de resolución con filtrado lineal.
 * Cada frame se oscurece toda (memoria que se apaga en ~0,6 s, según el tiempo del frame: igual a 30 y a 60 fps)
 * y se borra encima la visión actual (círculo de 2,5 casillas + cono con oclusión por ~64 rayos, bordes degradados).
 */
export const FOG2 = {
  /** false = niebla anterior (capas + fotos de memoria, v3.2). */
  enabled: true,
  /** Resolución de la textura respecto a la pantalla. */
  resDiv: 4,
  /** Opacidad de la niebla. */
  alpha: 0.45,
  /** La memoria llega a ~0 (2 %) en este tiempo: visibilidad × exp(-dt/τ), τ = trailSec / trailK. */
  trailSec: 0.6,
  trailK: 4,
  /** Círculo siempre visible (también la espalda) y ancho de su borde degradado (casillas). */
  nearTiles: 2.5,
  nearFeatherTiles: 1,
  /** Rayos de oclusión del cono. */
  rays: 64,
  /** Borde degradado del cono: al final del alcance / contra muros (casillas) y en los lados (grados). */
  coneFeatherTiles: 1.5,
  coneEdgeDeg: 10,
  /** Giro máximo del cono (grados/s). */
  maxTurnDegPerSec: 540,
};
