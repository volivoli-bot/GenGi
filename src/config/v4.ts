import { MAP_RANGES } from './v4d';
/**
 * v4 (diseño de Basu, diseno-v4.md §1 y §5): mochilas, peso del botín y sistema de mapas por datos.
 * Todos los números de diseño de la v4 están aquí.
 */
import type { Rarity } from '../data/rarity';

// ======================= §1 Mochilas =======================
export interface BagDef {
  /** Casillas de inventario de la incursión. */
  slots: number;
  /** Peso propio de la mochila. */
  weight: number;
  /** Casillas de consumible rápido extra (botón rápido adicional). */
  quickExtra: number;
  /** Multiplicador del tiempo de aplicar consumibles (0,85 = un 15 % más rápido). */
  useTimeMult: number;
  /** Multiplicador del peso de lo que va DENTRO de la mochila (0,8 = cuenta un 20 % menos). */
  contentWeightMult: number;
}
/** Sin mochila: los bolsillos. */
export const NO_BAG: BagDef = { slots: 6, weight: 0, quickExtra: 0, useTimeMult: 1, contentWeightMult: 1 };
/** Tabla §1: mochila → datos. (mochila_media y mochila_grande conservan su id de la v3 para no tocar guardados.) */
export const BAGS: Record<string, BagDef & { rarity: Rarity }> = {
  rinonera: { rarity: 'chatarra', slots: 8, weight: 0.5, quickExtra: 0, useTimeMult: 1, contentWeightMult: 1 },
  mochila_escolar: { rarity: 'comun', slots: 12, weight: 1, quickExtra: 0, useTimeMult: 1, contentWeightMult: 1 },
  mochila_media: { rarity: 'reforzado', slots: 16, weight: 1.5, quickExtra: 1, useTimeMult: 1, contentWeightMult: 1 },
  mochila_grande: { rarity: 'militar', slots: 20, weight: 2, quickExtra: 1, useTimeMult: 0.85, contentWeightMult: 1 },
  mochila_anomala: { rarity: 'anomalia', slots: 26, weight: 1, quickExtra: 0, useTimeMult: 1, contentWeightMult: 0.8 },
};
/** La mochila gratuita (como el bate y la ropa): invendible, se repone al volver al refugio. */
export const FREE_BAG = 'mochila_escolar';

/** Peso del botín por tamaño (§1). Armas, armaduras, mochilas y munición usan su peso propio. */
export const LOOT_SIZE_WEIGHT = { pequeno: 0.3, mediano: 1, grande: 2 };
/**
 * Tamaño de cada objeto de botín (peso por unidad: una pila de 10 chatarras pesa 3). Lo que no esté aquí usa su peso
 * de items.ts: armas, armaduras y mochilas (§1) y la munición (pesa por bala/flecha; 30 flechas = 1,5).
 */
export const LOOT_SIZE: Record<string, keyof typeof LOOT_SIZE_WEIGHT> = {
  mat_chatarra: 'pequeno', mat_tela: 'pequeno', mat_componentes: 'pequeno', mat_muestra: 'pequeno',
  vendaje: 'pequeno', adrenalina: 'pequeno', antidoto: 'pequeno', estimulante: 'pequeno',
  granada: 'pequeno', bengala: 'pequeno', tarjeta_helipuerto: 'pequeno',
  mat_combustible: 'mediano', botiquin: 'mediano',
};

/** Ruido extra al andar por la carga: por encima de `over` de peso, +`tiles` casillas (§1). */
export const LOAD_NOISE: { over: number; tiles: number }[] = [{ over: 20, tiles: 2 }, { over: 12, tiles: 1 }];

/** Mochilas en el botín de cajas (peso en la tabla de loot.ts; sustituye a la antigua entrada mochila_media 0,6). */
export const BAG_LOOT: Record<string, number> = { rinonera: 0.3, mochila_escolar: 0.15, mochila_media: 0.25, mochila_grande: 0.07 };
/** Precio base en tienda (Común, rep. 1). */
export const BAG_PRICES: Record<string, number> = { rinonera: 45, mochila_escolar: 80, mochila_media: 160, mochila_grande: 420, mochila_anomala: 1400 };
/** Hierro: mochilas por renovación [id, unidades, desde el nivel de reputación]. */
export const HIERRO_BAGS: [string, number, number][] = [['rinonera', 1, 1], ['mochila_media', 1, 1], ['mochila_grande', 1, 4]];
/** Taller: recetas de mochilas (nivel de estación, coste en materiales). Tardan como el resto (CRAFT_RAIDS). */
export const BAG_RECIPES: { id: string; level: number; out: string; cost: Record<string, number>; nombre: string }[] = [
  { id: 'bag_rinonera', level: 1, out: 'rinonera', cost: { mat_tela: 3, mat_chatarra: 1 }, nombre: 'Riñonera' },
  { id: 'bag_senderismo', level: 2, out: 'mochila_media', cost: { mat_tela: 6, mat_chatarra: 3, mat_componentes: 1 }, nombre: 'Mochila de senderismo' },
  { id: 'bag_tactica', level: 3, out: 'mochila_grande', cost: { mat_tela: 8, mat_chatarra: 4, mat_componentes: 3, mat_combustible: 1 }, nombre: 'Mochila táctica' },
  { id: 'bag_anomala', level: 3, out: 'mochila_anomala', cost: { mat_tela: 6, mat_componentes: 4, mat_muestra: 6 }, nombre: 'Mochila anómala' },
];

// ======================= §5 Mapas =======================
/** Variación por incursión (modelo mixto: trazado fijo por mapa + estas variaciones por semilla de la incursión). */
export interface MapVariation {
  /** Fracción de contenedores del trazado que aparecen en cada incursión (1 = todos). */
  containerKeep: number;
  /** Desplazamiento aleatorio de cada contenedor (casillas; se descarta si cae en pared). */
  containerJitterTiles: number;
  /** Salidas activas por incursión (de las exitLocs del mapa). */
  activeExits: number;
  /** Probabilidad de que una puerta quede cerrada con llave esta incursión (nunca corta el camino a una salida activa). */
  lockedDoorChance: number;
  /** ¿La decoración del suelo (grietas, manchas) cambia en cada incursión? */
  decorPerRaid: boolean;
  /** Edificios (por nombre de zona) cuyo interior (habitaciones) se rehace en cada incursión. */
  variableInteriors: string[];
}
export interface MapZoneDef { id: string; nombre: string; bioma: 'urbano' | 'nieve' | 'industrial' | 'anomalo' | 'subterraneo' }
export interface MapDef {
  id: string;
  nombre: string;
  /** Rango de nivel: no se entra por debajo de nivelMin; por encima de nivelMax se ve «Zona superada» (null = sin tope). */
  nivelMin: number;
  nivelMax: number | null;
  /** Multiplicador de vida y daño de los enemigos. */
  dificultad: number;
  /** Calaveras de la tarjeta (1-5). */
  calaveras: number;
  /** Rarezas que suelta [mín, máx] y la del jefe. */
  rarezas: [Rarity, Rarity];
  rarezaJefe: Rarity;
  /** Pesos de rareza propios del mapa (si faltan, los de la v1: 60/30/10). */
  pesosRareza?: Partial<Record<Rarity, number>>;
  /** Multiplicador de experiencia (§2; lo usa la v4.0 de niveles). */
  xpMult: number;
  zonas: MapZoneDef[];
  /** Conjunto de edificios que usa el generador. */
  edificios: string[];
  /** Generador del trazado (null = mapa aún sin construir: se ve en la Mesa de Mapas pero no se puede entrar). */
  generador: 'arrabal' | null;
  /** Semilla fija del trazado. */
  layoutSeed: number;
  /** Id con el que se guardan las salidas vistas (el mapa 1 pasa de 'ciudad-v2' a 'arrabal-v4' con migración: las salidas 0-2 no se mueven). */
  saveId: string;
  variacion: MapVariation;
  jefe: string;
  extraccionEspecial: string;
  mecanica: string;
}

const FIXED_VARIATION: MapVariation = { containerKeep: 1, containerJitterTiles: 0, activeExits: 2, lockedDoorChance: 0, decorPerRaid: false, variableInteriors: [] };

export const MAPS: MapDef[] = [
  {
    id: 'arrabal', nombre: 'El Arrabal', nivelMin: MAP_RANGES.arrabal[0], nivelMax: MAP_RANGES.arrabal[1], dificultad: 1, calaveras: 1,
    rarezas: ['chatarra', 'militar'], rarezaJefe: 'anomalia', xpMult: 1,
    zonas: [{ id: 'arrabal', nombre: 'Arrabal', bioma: 'urbano' }, { id: 'helada', nombre: 'Zona Helada', bioma: 'nieve' }],
    edificios: ['casas', 'parque', 'comisaria', 'hospital', 'aparcamiento', 'plaza', 'bloque', 'super', 'almacen'],
    generador: 'arrabal', layoutSeed: 0x9e3779b1, saveId: 'arrabal-v4',
    // v4 base: el mapa 1 se juega igual que en la v3.2 (las variaciones nuevas están listas, apagadas hasta la v4.1)
    variacion: { ...FIXED_VARIATION },
    jefe: 'La Matriarca', extraccionEspecial: 'Helipuerto', mecanica: 'Ventisca',
  },
  {
    id: 'via_muerta', nombre: 'Vía Muerta', nivelMin: MAP_RANGES.via_muerta[0], nivelMax: MAP_RANGES.via_muerta[1], dificultad: 1.8, calaveras: 2,
    rarezas: ['comun', 'anomalia'], rarezaJefe: 'anomalia', xpMult: 2.5,
    pesosRareza: { comun: 50, reforzado: 32, militar: 14, anomalia: 4 },
    zonas: [{ id: 'estacion', nombre: 'Estación de mercancías', bioma: 'industrial' }, { id: 'poligono', nombre: 'Polígono', bioma: 'industrial' }],
    edificios: ['nave', 'andén', 'vagones', 'grúa', 'contenedores', 'paso_a_nivel'],
    generador: null, layoutSeed: 0x51ed270b, saveId: 'via_muerta',
    variacion: { ...FIXED_VARIATION, containerKeep: 0.85, lockedDoorChance: 0.15, variableInteriors: ['Nave'] },
    jefe: 'El Maquinista', extraccionEspecial: 'Tren en marcha', mecanica: 'Tren Fantasma',
  },
  {
    id: 'crater', nombre: 'El Cráter', nivelMin: MAP_RANGES.crater[0], nivelMax: MAP_RANGES.crater[1], dificultad: 3, calaveras: 4,
    rarezas: ['reforzado', 'reliquia'], rarezaJefe: 'reliquia', xpMult: 6,
    pesosRareza: { reforzado: 52, militar: 33, anomalia: 13, reliquia: 2 },
    zonas: [{ id: 'crater', nombre: 'Cráter', bioma: 'anomalo' }, { id: 'ruinas', nombre: 'Ciudad partida', bioma: 'urbano' }],
    edificios: ['ruina', 'refugio_plomo', 'cristales', 'portal'],
    generador: null, layoutSeed: 0x2f6b9d43, saveId: 'crater',
    variacion: { ...FIXED_VARIATION, containerKeep: 0.8, containerJitterTiles: 1, lockedDoorChance: 0.1, decorPerRaid: true },
    jefe: 'El Eco', extraccionEspecial: 'Portal estable (40 s)', mecanica: 'Anomalías',
  },
  {
    id: 'colmena', nombre: 'La Colmena', nivelMin: MAP_RANGES.colmena[0], nivelMax: MAP_RANGES.colmena[1], dificultad: 5, calaveras: 5,
    rarezas: ['militar', 'reliquia'], rarezaJefe: 'reliquia', xpMult: 6,
    pesosRareza: { militar: 62, anomalia: 32, reliquia: 6 },
    zonas: [{ id: 'metro', nombre: 'Metro', bioma: 'subterraneo' }, { id: 'nido', nombre: 'Nido', bioma: 'subterraneo' }],
    edificios: ['tunel', 'anden_metro', 'alcantarilla', 'nido', 'pozo'],
    generador: null, layoutSeed: 0x7a3c1e59, saveId: 'colmena',
    variacion: { ...FIXED_VARIATION, containerKeep: 0.75, containerJitterTiles: 1, lockedDoorChance: 0.2, decorPerRaid: true, variableInteriors: ['Nido'] },
    jefe: 'La Reina', extraccionEspecial: 'Pozo', mecanica: 'Derrumbes',
  },
];
export const DEFAULT_MAP = 'arrabal';
export function mapDef(id: string | undefined | null): MapDef { return MAPS.find(m => m.id === id) ?? MAPS[0]; }
/** v4b: mapa de una incursión guardada: por `mapDefId` (MapDef.id) y, en guardados viejos, por el saveId de `mapId`. */
export function mapOfSnap(s: { mapDefId?: string; mapId?: string } | null | undefined): MapDef {
  return MAPS.find(m => m.id === s?.mapDefId) ?? MAPS.find(m => m.saveId === s?.mapId || m.id === s?.mapId) ?? MAPS[0];
}
/** v4b: ¿se puede entrar? (por debajo del nivel mínimo, no; por encima del máximo sí, marcado «superado»). */
export function mapAllowed(m: MapDef, level: number) { const g = mapGate(m, level); return g === 'ok' || g === 'superado'; }
/** v4b: aplica los rangos de nivel al guardado (al cargar e importar): mapa elegido y raid a medias en un mapa no permitido. */
export function enforceMapGate(d: { mapSel?: string; prog?: { level: number }; activeRaid?: { mapDefId?: string; mapId?: string; repopulate?: boolean } | null }): string[] {
  const lv = d.prog?.level ?? 1, out: string[] = [];
  if (d.mapSel && !mapAllowed(mapDef(d.mapSel), lv) || d.mapSel && !MAPS.some(m => m.id === d.mapSel)) { out.push(`mapSel ${d.mapSel} → ${DEFAULT_MAP}`); d.mapSel = DEFAULT_MAP; }
  const r = d.activeRaid;
  if (r && (r.mapDefId || r.mapId)) {
    const m = mapOfSnap(r);
    const known = MAPS.some(x => x.id === r.mapDefId || x.saveId === r.mapId);
    if (!known || !mapAllowed(m, lv)) { out.push(`raid ${r.mapDefId ?? r.mapId} → ${DEFAULT_MAP}`); r.mapDefId = DEFAULT_MAP; r.repopulate = true; }
  }
  return out;
}
/** ¿Se puede entrar con este nivel? (los niveles llegan en la v4.0: hasta entonces todos son nivel 1). */
export function mapGate(m: MapDef, level: number): 'ok' | 'bloqueado' | 'superado' | 'sin_construir' {
  if (!m.generador) return 'sin_construir';
  if (level < m.nivelMin) return 'bloqueado';
  if (m.nivelMax !== null && level > m.nivelMax) return 'superado';
  return 'ok';
}

/** QA / pruebas: variación «al máximo» para comprobar que los ganchos funcionan sobre el mapa 1. */
export const VARIATION_STRESS: MapVariation = { containerKeep: 0.7, containerJitterTiles: 1.5, activeExits: 2, lockedDoorChance: 0.35, decorPerRaid: true, variableInteriors: ['Hospital', 'Comisaría', 'Almacén militar', 'Supermercado', 'Bloque de pisos', 'Casas'] };

// ======================= §4 Mapa 1 por franjas (Zona Helada) =======================
/**
 * Trazado del mapa 1 como piezas: una rejilla 4×4 de distritos de 19×19 casillas separados por calles de 6.
 * Cada distrito es una pieza hecha a mano con el mismo conector en sus 4 bordes (calle de 6 casillas con entradas
 * hacia fuera), así que una actualización futura puede barajar su posición como un puzle sin rehacer nada.
 * (La v4 aún NO baraja: el orden de PLAN es fijo.)
 */
export const ARRABAL = {
  /** Distrito de cada casilla de la rejilla [fila][columna], de norte a sur. */
  plan: [
    ['casas', 'parque', 'comisaria', 'casas'],
    ['hospital', 'aparcamiento', 'plaza', 'bloque'],
    ['casas', 'super', 'aparcamiento', 'almacen'],
    ['casas', 'parque', 'casas', 'casas'],
  ],
  /**
   * 3 franjas fijas (columna, fila de la rejilla). En cada incursión una al azar es la Zona Helada.
   * `exit` = índice de la salida normal que queda en esa franja; `lair` = distrito que pasa a ser la guarida de la
   * Matriarca en la versión nevada; `helipad` = Helipuerto del radar (casillas), solo en la versión nevada.
   */
  strips: [
    { id: 'norte', nombre: 'Norte', cells: [[0, 0], [1, 0], [2, 0], [3, 0], [1, 1], [2, 1]] as [number, number][], exit: 0, lair: [0, 0] as [number, number], helipad: { x: 82, y: 2.6 } },
    { id: 'oeste', nombre: 'Oeste', cells: [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3]] as [number, number][], exit: 1, lair: [1, 3] as [number, number], helipad: { x: 2.6, y: 78 } },
    { id: 'este', nombre: 'Este', cells: [[3, 1], [3, 2], [3, 3], [2, 2], [2, 3]] as [number, number][], exit: 2, lair: [2, 3] as [number, number], helipad: { x: 101.4, y: 78 } },
  ],
  /** Inicio del jugador: 4 puntos por variante, fuera de la nieve, a unas `targetTiles` casillas de ella y unas `heliTargetTiles` (en línea recta) del helipuerto, y lejos de las salidas. */
  spawn: { count: 4, minFromSnowTiles: 22, targetTiles: 30, heliTargetTiles: 80, minFromExitTiles: 20, minApartTiles: 12 },
  /** Probabilidad de cada franja de ser la nevada (iguales). */
  snowWeights: [1, 1, 1],
};
/** Zona Helada (§4): números de diseño que usa la v4 base (el resto de reglas de la nieve llega con la v4.2). */
export const SNOW = {
  /** Frontera: la nieve cubre el asfalto en 3 casillas. */
  edgeTiles: 3,
  /** Enemigos ×1,3 de vida y daño dentro de la nieve. */
  enemyMult: 1.3,
  /** Botín de la nieve: Común 45 %, Reforzado 37 %, Militar 18 %. */
  rarity: { comun: 45, reforzado: 37, militar: 18 } as Partial<Record<Rarity, number>>,
  /** Helipuerto: espera del helicóptero (s) tras usar la Tarjeta y radio de ruido (casillas). */
  heliWaitSec: 30, heliNoiseTiles: 15, heliNoiseEverySec: 4,
  /** Probabilidad de la Tarjeta del helipuerto en el botín de la guarida. */
  cardChance: 0.5,
  /** Nombres «nevados» de los distritos (solo se cambia el nombre visible). */
  snowNames: { Casas: 'Cabañas', Parque: 'Bosque nevado', Plaza: 'Plaza helada', Aparcamiento: 'Aparcamiento nevado', Hospital: 'Hospital helado', Comisaría: 'Comisaría helada', 'Almacén militar': 'Radar militar', Supermercado: 'Invernadero congelado', 'Bloque de pisos': 'Bloque helado' } as Record<string, string>,
};

// ======================= Importar sin retroceso =======================
/**
 * Importar una copia ANTERIOR de la misma partida (menos incursiones jugadas, o las mismas pero con menos guardados)
 * se rechaza: así no se puede exportar antes de una incursión, morir y volver atrás. Se puede importar una copia más
 * nueva de la misma partida (cambio de móvil) o una partida distinta. La «marca más alta» de cada partida se guarda
 * aparte (`storageKey`), también al borrar la partida.
 */
export const ANTI_ROLLBACK = { enabled: true, storageKey: 'gengi.marcas' };
