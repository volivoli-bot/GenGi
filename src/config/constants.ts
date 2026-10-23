/** Tamaño de una "casilla" del diseño en píxeles del mundo. */
export const TILE = 48;
/** Mapa en casillas. */
export const MAP_TILES = 60;
export const WORLD = TILE * MAP_TILES;

export const PLAYER_MAX_HP = 100;
/** Velocidad base del jugador en casillas/s. */
export const PLAYER_SPEED_TILES = 4;
export const BACKPACK_SLOTS = 12;
export const STASH_SLOTS = 30;
export const SAFE_POCKET_SLOTS = 1;

export const LOOT_RING_SEC = 1.5;
export const LOCKED_CRATE_SEC = 2;
export const LOCKED_CRATE_NOISE = 6;
export const LOOT_REACH_TILES = 1.3;
export const LOOT_ENEMY_BLOCK_TILES = 6;

export const EXTRACT_HOLD_SEC = 8;
export const EXTRACT_HIT_PENALTY_SEC = 2;
export const EXTRACT_HIT_PAUSE_SEC = 1;
export const GENERATOR_SEC = 10;
export const GENERATOR_NOISE = 14;
export const FLARE_OPEN_MIN = 8;
export const FLARE_CLOSE_MIN = 10;
/** Una vez lanzada la bengala, el helicóptero espera este tiempo (s). */
export const FLARE_WINDOW_SEC = 60;
export const EXIT_RADIUS_TILES = 2;

/** Penalización de velocidad por peso. */
export const SPEED_PENALTY_PER_WEIGHT = 0.02;
export const SPEED_PENALTY_MAX = 0.4;

/** Autoguardado periódico de la raid (s), además del guardado al pasar a segundo plano. */
export const RAID_AUTOSAVE_SEC = 3;

export const COLORS = {
  contorno: 0x14110f,
  suelo: [0x3b3a36, 0x4a4842, 0x5c5547],
  oxido: 0x8a5a3a,
  musgo: 0x5b6b4a,
  toxico: 0xb6ff3c,
  mutacion: 0xff3cc8,
  peligro: 0xff3b30,
  hueso: 0xe8e2d0,
};

/** Acercamiento de la cámara de la raid respecto a la v0 (Basu: 1,5–2×). */
export const RAID_ZOOM_FACTOR = 1.6;
