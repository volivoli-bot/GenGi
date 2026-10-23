/**
 * v4.0 (diseno-v4.md §2-§3): nivel, experiencia y atributos. Todos los números de experiencia en una sola tabla
 * para que Dott los ajuste con el registro de incursiones.
 */
export const XP = {
  /** Al matar (por tipo). Élite ×eliteMult; el jefe de la Zona Helada, `boss`. */
  kill: { errante: 4, corredor: 5, hinchado: 6, escupidor: 7, chillon: 7, acechador: 9, bruto: 12, reptante: 8, enjambre: 1, abominacion: 120, congelado: 5, lobo: 6, escarcha: 7 } as Record<string, number>,
  eliteMult: 3,
  boss: 400,
  /** Al abrir una caja (no cuenta reabrirla). */
  container: 2,
  /** Por misión de vendedor: min + (max−min) × dificultad (0-1, según la reputación del vendedor). */
  mission: { min: 60, max: 150 },
  /** Al extraer: base + porMinuto × minutos sobrevividos. */
  extractBase: 40,
  extractPerMin: 8,
  /** Extraer por el helipuerto multiplica la experiencia de la incursión. */
  helipadMult: 1.5,
  /** v4b (Basu): las oleadas y hordas dan el 30 %. */
  waveMult: 0.3,
  /** v4b (Basu): a partir de 1.500 de experiencia base por muertes en una incursión, cada muerte da la mitad (antes del ×mapa). */
  killSoftCap: 1500,
  overCapMult: 0.5,
};

/**
 * Coste de pasar del nivel n al n+1: niveles 1-9 → base + perLevel × n; del 10 en adelante, el anterior × growth.
 * (90, 120, …, 330, 363, 399, …)
 */
export const XP_CURVE = {
  base: 60, perLevel: 30, linearUntil: 9,
  /** v4b (Dott/Basu): crecimiento por tramos [desde el nivel, ×]: 10-14 ×1,10; 15-24 ×1,20; 25+ ×1,10. */
  bands: [[10, 1.1], [15, 1.2], [25, 1.1]] as [number, number][],
};

/**
 * Muerte. Modos (para que Dott pruebe):
 * - 'raid': solo se pierde la experiencia aún no asegurada de la incursión.
 * - 'raid+progreso' (por defecto, Pablo): además se pierde un `progressLoss` (25 %) de la experiencia ya ganada hacia el
 *   siguiente nivel. Nunca se baja de nivel.
 * - 'nada': la experiencia de la incursión se conserva aunque mueras (solo para pruebas).
 */
export type XpDeathMode = 'raid' | 'raid+progreso' | 'nada';
export const XP_DEATH: { mode: XpDeathMode; progressLoss: number } = { mode: 'raid+progreso', progressLoss: 0.25 };

/** Tope de nivel (por seguridad; el diseño no fija ninguno). */
export const LEVEL_MAX = 99;

export type AttrId = 'agilidad' | 'resistencia' | 'sigilo' | 'suerte' | 'fuerza' | 'pulso' | 'medicina' | 'carronero';
export const ATTR_IDS: AttrId[] = ['agilidad', 'resistencia', 'sigilo', 'suerte', 'fuerza', 'pulso', 'medicina', 'carronero'];
/**
 * Atributos (§2): todos lineales; `max` es el efecto con 50 puntos (con el Gimnasio se pasa de 50: sigue lineal).
 * Los valores son fracciones (0,15 = 15 %) salvo los marcados.
 */
export const ATTRS: Record<AttrId, { nombre: string; icon: string; texto: string; max: Record<string, number> }> = {
  agilidad: { nombre: 'Agilidad', icon: 'v4/atributo_agilidad', texto: '+15 % velocidad · saqueo 35 % más rápido', max: { speed: 0.15, loot: 0.35 } },
  resistencia: { nombre: 'Resistencia', icon: 'v4/atributo_resistencia', texto: '−15 % daño recibido · sangrado y veneno duran un 20 % menos', max: { dmgTaken: 0.15, dot: 0.2 } },
  sigilo: { nombre: 'Sigilo', icon: 'v4/atributo_sigilo', texto: '−35 % radio de ruido · el «?» se llena un 30 % más lento', max: { noise: 0.35, suspicion: 0.3 } },
  suerte: { nombre: 'Suerte', icon: 'v4/atributo_suerte', texto: '+20 % botín · +8 % de subir una rareza', max: { loot: 0.2, rarityUp: 0.08 } },
  fuerza: { nombre: 'Fuerza', icon: 'v4/atributo_fuerza', texto: '+15 % daño cuerpo a cuerpo · +6 de peso sin ralentizarte', max: { melee: 0.15, weight: 6 } },
  pulso: { nombre: 'Pulso', icon: 'v4/atributo_pulso', texto: 'apuntado estable un 40 % antes · +6 % crítico a distancia · recarga 25 % más rápida', max: { aim: 0.4, crit: 0.06, reload: 0.25 } },
  medicina: { nombre: 'Medicina', icon: 'v4/atributo_medicina', texto: 'curas un 40 % más rápidas y un 20 % más fuertes', max: { time: 0.4, heal: 0.2 } },
  carronero: { nombre: 'Carroñero', icon: 'v4/atributo_carronero', texto: 'ves el botín de las cajas a 3 casillas sin abrirlas · +15 % chapas', max: { peekTiles: 3, chapas: 0.15 } },
};
export const ATTR_RULES = {
  pointsPerLevel: 3,
  /** Puntos con los que se alcanza el efecto `max` (y tope sin Gimnasio). */
  refPoints: 50,
  cap: 50,
  /** Gimnasio: +5 al tope de UN atributo elegido por nivel de la estación (50 → 55 → 60 → 65). */
  gymPerLevel: 5,
  /** Quitar un punto: cuesta `respecCost` de los asignados y devuelve `respecRefund` libre (Pizarra 2: 1 → 1 una vez cada 3 incursiones). */
  respecCost: 2,
  respecRefund: 1,
  pizarraCheapEveryRaids: 3,
};

/** Interfaz de la barra (§2): 36×2 px dorada bajo el personaje; la no asegurada, más clara. */
/** Colores de ui_barra_xp.svg (Basu): dorado #ffd23c, lo no asegurado al 40 %, fondo #14110f. */
export const XP_UI = { barW: 36, barH: 2, color: 0xffd23c, pendingColor: 0xffd23c, pendingAlpha: 0.4, back: 0x14110f, offsetY: 30 };

/** Helipuerto: además de ×1,5 de experiencia, una caja de suministros Militar al alijo. */
export const HELI_SUPPLY = { rarity: 'militar' as const, items: 2 };
