/**
 * Diseño v3 (Basu, gengi-art/diseno-v3.md §1-§6): refugio, materiales, vendedores, enemigos nuevos y mutaciones.
 * TODOS los números de la v3 están aquí; el resto del código solo los lee.
 */

// ---------------------------------------------------------------- §1 Materiales
export type MaterialId = 'mat_chatarra' | 'mat_tela' | 'mat_componentes' | 'mat_combustible' | 'mat_muestra';
export const MATERIAL_IDS: MaterialId[] = ['mat_chatarra', 'mat_tela', 'mat_componentes', 'mat_combustible', 'mat_muestra'];

/** Botín de materiales: probabilidad de que un contenedor lleve además una pila, y qué sale según el sitio. */
export const MATERIAL_LOOT = {
  /** Probabilidad por tipo de contenedor de añadir 1 pila de material. */
  chance: { caja: 0.5, cerrada: 0.7, elite: 1, coche: 0.85 } as Record<string, number>,
  qty: [1, 3] as [number, number],
  /** Pesos por nombre de zona (map.ts). 'Coche' = maletero de un coche abandonado. */
  byZone: {
    Calles: { mat_chatarra: 3, mat_combustible: 1, mat_tela: 0.4 },
    Aparcamiento: { mat_chatarra: 2, mat_combustible: 2 },
    Plaza: { mat_chatarra: 2, mat_tela: 1 },
    Parque: { mat_chatarra: 1.5, mat_tela: 1 },
    Casas: { mat_tela: 3, mat_chatarra: 1 },
    'Bloque de pisos': { mat_tela: 3, mat_chatarra: 1 },
    Supermercado: { mat_tela: 3, mat_chatarra: 1, mat_componentes: 0.4 },
    Hospital: { mat_tela: 2, mat_componentes: 1 },
    Comisaría: { mat_componentes: 3, mat_chatarra: 1 },
    'Almacén militar': { mat_componentes: 3, mat_combustible: 1, mat_chatarra: 1 },
    Coche: { mat_chatarra: 2, mat_combustible: 2.5 },
  } as Record<string, Partial<Record<MaterialId, number>>>,
  /** Coches con maletero registrable (fracción de los coches del mapa). */
  carTrunkChance: 0.35,
  /** Muestra mutada: cadáver de Hinchado (explota: cae en el charco) / Abominación / enemigo mutado. */
  muestra: { hinchado: 0.5, abominacion: 1, abominacionQty: [2, 3] as [number, number], mutado: 0.35 },
};

// ---------------------------------------------------------------- §2 Refugio
export type StationId = 'alijo' | 'bolsillo' | 'generador' | 'enfermeria' | 'taller' | 'radio';
export const STATION_IDS: StationId[] = ['alijo', 'bolsillo', 'generador', 'enfermeria', 'taller', 'radio'];
export type Cost = Partial<Record<'chapas' | MaterialId, number>>;

export interface StationDef { nombre: string; icon: string; levels: { desc: string; cost?: Cost }[] }
export const STATIONS: Record<StationId, StationDef> = {
  alijo: { nombre: 'Alijo', icon: 'estacion_alijo', levels: [
    { desc: '30 casillas' },
    { desc: '45 casillas', cost: { chapas: 400, mat_chatarra: 10 } },
    { desc: '70 casillas', cost: { chapas: 1200, mat_chatarra: 20, mat_componentes: 5 } }] },
  bolsillo: { nombre: 'Bolsillo seguro', icon: 'estacion_bolsillo', levels: [
    { desc: '1 casilla (se conserva al morir)' },
    { desc: '2 casillas', cost: { chapas: 600, mat_tela: 8 } },
    { desc: '4 casillas', cost: { chapas: 2000, mat_tela: 15, mat_componentes: 5 } }] },
  generador: { nombre: 'Generador', icon: 'estacion_generador', levels: [
    { desc: 'Básico' },
    { desc: 'Permite el nivel 2 del resto', cost: { chapas: 500, mat_combustible: 6 } },
    { desc: 'Permite el nivel 3 del resto', cost: { chapas: 1500, mat_combustible: 12, mat_componentes: 6 } }] },
  enfermeria: { nombre: 'Enfermería', icon: 'estacion_enfermeria', levels: [
    { desc: 'Sin construir' },
    { desc: 'Fabrica vendajes con tela', cost: { chapas: 300, mat_tela: 6 } },
    { desc: 'Fabrica botiquines y adrenalina', cost: { chapas: 1000, mat_muestra: 4 } }] },
  taller: { nombre: 'Taller', icon: 'estacion_taller', levels: [
    { desc: 'Mesa básica' },
    { desc: 'Fabrica munición y flechas', cost: { chapas: 400, mat_chatarra: 10 } },
    { desc: '+1 rasgo extra a un arma o armadura', cost: { chapas: 1400, mat_componentes: 8 } }] },
  radio: { nombre: 'Radio', icon: 'estacion_radio', levels: [
    { desc: 'Sabes los nombres de las salidas' },
    { desc: 'Revela 1 salida activa al empezar', cost: { chapas: 700, mat_componentes: 6 } },
    { desc: 'Sabes dónde está la Abominación y su botín', cost: { chapas: 1600, mat_componentes: 10 } }] },
};
export const STASH_BY_LEVEL = [30, 45, 70];
export const POCKET_BY_LEVEL = [1, 2, 4];
/** Fabricar tarda N raids (no tiempo real). */
export const CRAFT_RAIDS = 3;
export const CRAFT_QUEUE_MAX = 2;
export interface Recipe { id: string; station: StationId; level: number; out: string; qty: number; cost: Cost; nombre: string }
export const RECIPES: Recipe[] = [
  { id: 'vendajes', station: 'enfermeria', level: 2, out: 'vendaje', qty: 2, cost: { mat_tela: 3, chapas: 10 }, nombre: '2 vendajes' },
  { id: 'botiquin', station: 'enfermeria', level: 3, out: 'botiquin', qty: 1, cost: { mat_tela: 3, mat_muestra: 1 }, nombre: 'Botiquín' },
  { id: 'adrenalina', station: 'enfermeria', level: 3, out: 'adrenalina', qty: 1, cost: { mat_muestra: 2, mat_componentes: 1 }, nombre: 'Adrenalina' },
  { id: 'municion', station: 'taller', level: 2, out: 'municion', qty: 12, cost: { mat_chatarra: 4 }, nombre: '12 balas 9 mm' },
  { id: 'flechas', station: 'taller', level: 2, out: 'flechas', qty: 12, cost: { mat_chatarra: 3, mat_tela: 1 }, nombre: '12 flechas' },
];
/** Taller nivel 3: un rasgo extra (instantáneo; una vez por objeto, Reforzado o mejor). */
export const TRAIT_UPGRADE_COST: Cost = { chapas: 150, mat_componentes: 3 };

// ---------------------------------------------------------------- §3 Vendedores
export type VendorId = 'doc' | 'chispas' | 'hierro';
export const VENDOR_IDS: VendorId[] = ['doc', 'chispas', 'hierro'];
export const VENDORS = {
  /** XP de reputación para cada nivel 1-4 (se gana comerciando y con misiones). */
  repXp: [0, 300, 800, 1600],
  /** -5 % de precio por nivel por encima del 1. */
  discountPerLevel: 0.05,
  /** XP por chapa gastada comprando / recibida vendiendo. */
  xpPerBuyChapa: 1,
  xpPerSellChapa: 0.5,
  /** El stock se renueva cada N raids (y al subir de nivel). */
  restockRaids: 3,
  /** Recompra (§6): fracción del precio de venta MÁS BAJO (cualquier tienda, rep. máxima incluida). */
  buyOwn: 0.4,
  buyOther: 0.2,
  /** Precio base (Común, rep. 1, por unidad). Lo que no esté aquí: valor × refPriceMult. */
  basePrice: {
    vendaje: 20, botiquin: 80, bengala: 90, adrenalina: 120, granada: 110, antidoto: 90, estimulante: 140,
    bate: 28, machete: 60, arco: 95, ballesta: 130, pistola: 150, municion: 6, flechas: 2.5, virotes: 3.5,
    tablas: 55, chaleco: 190, casco: 120, mochila_media: 160, mochila_grande: 420,
  } as Record<string, number>,
  refPriceMult: 1.35,
  defs: {
    doc: { nombre: 'Doc Reyes', retrato: 'vendedor_doc_reyes', desc: 'Medicina y consumibles' },
    chispas: { nombre: 'Chispas', retrato: 'vendedor_chispas', desc: 'Armas y munición' },
    hierro: { nombre: 'Hierro', retrato: 'vendedor_hierro', desc: 'Armaduras, cascos y mochilas' },
  } as Record<VendorId, { nombre: string; retrato: string; desc: string }>,
  /** Doc Reyes: qué desbloquea cada nivel (unidades por renovación). */
  docStock: [
    [['vendaje', 6]],
    [['botiquin', 3], ['bengala', 2]],
    [['adrenalina', 2], ['granada', 3]],
    [['antidoto', 2], ['estimulante', 1]],
  ] as [string, number][][],
  /** Chispas / Hierro: casillas de equipo por renovación y rareza de cada casilla según el nivel. */
  gearSlots: [['comun', 'comun', 'comun', 'comun'], ['comun', 'reforzado', 'comun', 'reforzado'], ['comun', 'reforzado', 'militar', 'reforzado'], ['comun', 'reforzado', 'militar', 'reforzado']],
  chispasGear: ['bate', 'machete', 'arco', 'ballesta', 'pistola'],
  chispasAmmo: [['municion', 12, 4], ['flechas', 12, 4], ['virotes', 10, 3]] as [string, number, number][],
  hierroGear: ['tablas', 'chaleco', 'casco'],
  hierroBags: [['mochila_media', 1, 1]] as [string, number, number][],
  hierroBagsRep4: [['mochila_grande', 1, 1]] as [string, number, number][],
};

export type MissionKind =
  | { t: 'entregar'; item: string; n: number }
  | { t: 'matar'; enemy: string; n: number; ranged?: boolean; melee?: boolean }
  | { t: 'extraerVida'; below: number }
  | { t: 'curarse'; n: number }
  | { t: 'salida'; loc: string }
  | { t: 'armaduraMilitar' }
  | { t: 'danoSobrevive'; n: number };
export interface MissionDef { id: string; vendor: VendorId; texto: string; kind: MissionKind; chapas: number; xp: number; item?: [string, string, number] }
export const MISSIONS: MissionDef[] = [
  { id: 'doc_muestras', vendor: 'doc', texto: 'Trae 3 muestras mutadas', kind: { t: 'entregar', item: 'mat_muestra', n: 3 }, chapas: 220, xp: 250, item: ['botiquin', 'comun', 1] },
  { id: 'doc_vida', vendor: 'doc', texto: 'Extrae con menos de 20 de vida', kind: { t: 'extraerVida', below: 20 }, chapas: 180, xp: 200 },
  { id: 'doc_curas', vendor: 'doc', texto: 'Cúrate 5 veces en una raid', kind: { t: 'curarse', n: 5 }, chapas: 150, xp: 180 },
  { id: 'doc_escupidores', vendor: 'doc', texto: 'Mata 3 Escupidores', kind: { t: 'matar', enemy: 'escupidor', n: 3 }, chapas: 200, xp: 200 },
  { id: 'doc_tela', vendor: 'doc', texto: 'Trae 6 telas', kind: { t: 'entregar', item: 'mat_tela', n: 6 }, chapas: 120, xp: 150, item: ['vendaje', 'comun', 3] },
  { id: 'chispas_corredores', vendor: 'chispas', texto: 'Mata 10 Corredores con arma a distancia', kind: { t: 'matar', enemy: 'corredor', n: 10, ranged: true }, chapas: 260, xp: 260, item: ['municion', 'comun', 24] },
  // diseño: "Extrae por la Azotea del hospital" → el mapa no tiene azotea: la salida del hospital
  { id: 'chispas_hospital', vendor: 'chispas', texto: 'Extrae por la Puerta del hospital', kind: { t: 'salida', loc: 'Puerta del hospital' }, chapas: 200, xp: 220 },
  { id: 'chispas_abominacion', vendor: 'chispas', texto: 'Mata una Abominación', kind: { t: 'matar', enemy: 'abominacion', n: 1 }, chapas: 450, xp: 350 },
  { id: 'chispas_brutos', vendor: 'chispas', texto: 'Mata 2 Brutos', kind: { t: 'matar', enemy: 'bruto', n: 2 }, chapas: 260, xp: 240 },
  { id: 'chispas_componentes', vendor: 'chispas', texto: 'Trae 6 componentes', kind: { t: 'entregar', item: 'mat_componentes', n: 6 }, chapas: 200, xp: 200 },
  // diseño: "sin que se rompa" → no hay durabilidad: basta con extraer llevándola puesta
  { id: 'hierro_militar', vendor: 'hierro', texto: 'Extrae llevando armadura Militar', kind: { t: 'armaduraMilitar' }, chapas: 300, xp: 260 },
  { id: 'hierro_dano', vendor: 'hierro', texto: 'Recibe 300 de daño en una raid y sobrevive', kind: { t: 'danoSobrevive', n: 300 }, chapas: 260, xp: 240 },
  { id: 'hierro_chatarra', vendor: 'hierro', texto: 'Trae 15 chatarra', kind: { t: 'entregar', item: 'mat_chatarra', n: 15 }, chapas: 200, xp: 220, item: ['casco', 'reforzado', 1] },
  { id: 'hierro_cuerpo', vendor: 'hierro', texto: 'Mata 20 enemigos cuerpo a cuerpo', kind: { t: 'matar', enemy: '*', n: 20, melee: true }, chapas: 180, xp: 200 },
  { id: 'hierro_combustible', vendor: 'hierro', texto: 'Trae 4 de combustible', kind: { t: 'entregar', item: 'mat_combustible', n: 4 }, chapas: 140, xp: 160 },
];
export const MISSION_OFFERS = 3;

// ---------------------------------------------------------------- Objetos nuevos (Doc / Hierro)
export const NEW_ITEMS = {
  adrenalina: { sec: 8, speedMult: 1.25, dmgTakenMult: 0.7 },
  antidoto: { immuneSec: 30 },
  estimulante: { sec: 25, tiles: 8 },
  granada: { throwTiles: 5, fuseSec: 1.0, radiusTiles: 2.2, dmg: 45, noise: 12, selfMult: 0.5 },
  mochila: { mochila_media: 4, mochila_grande: 8 } as Record<string, number>,
};

// ---------------------------------------------------------------- §4 Enemigos nuevos
export const ENEMY_V3 = {
  escupidor: { fromMinute: 3, keepMinTiles: 4, keepMaxTiles: 7, fleeTiles: 3.5, windupSec: 0.6, spitTilesPerSec: 6, spitRangeTiles: 9, cooldownSec: 2.6, poisonStacks: 1, hitRadiusPx: 14, recoverSec: 0.5 },
  chillon: { fromMinute: 4, windupSec: 1.2, screamTiles: 12, localSec: 120, localSpawnMult: 1.6, cooldownSec: 25, holdTiles: 5.5, hordeMin: 4, hordeMax: 6, maxAlive: 2 },
  acechador: { fromMinute: 5, edgeSec: 0.8, revealSec: 0.6, nearVisibleTiles: 3, distortionAlpha: 0.2, triggerTiles: 1.5, lungeTiles: 1.6, lungeSec: 0.2, recoverSec: 1.2, behindTiles: 2.2, maxAlive: 3 },
  bruto: { fromMinute: 6, windupSec: 0.8, slamTiles: 2.2, slamArcDeg: 110, chargeTiles: 2.5, chargeSec: 0.35, chargeMinTiles: 3, chargeMaxTiles: 6, chargeCooldownSec: 6, frontArcDeg: 120, frontDamageMult: 0.3, turnRadPerSec: 1.8, recoverSec: 1.1, maxAlive: 3 },
  reptante: { fromMinute: 7, warnSec: 1, grabSec: 2, immunitySec: 4, othersDmgMult: 0.5, triggerTiles: 2.4, grabTiles: 1.4, grabDps: 4, wiggleCutSec: 0.25, wiggleDeg: 70, surfaceSec: 2.2, cooldownSec: 7, sewers: 14, maxAlive: 4 },
  enjambre: { fromMinute: 8, count: [8, 12] as [number, number], windupSec: 0.3, biteCooldownSec: 0.9, triggerTiles: 0.7, cueTiles: 9, cueBeforeBiteSec: 0.8, trackTiles: 10, maxGroups: 2 },
};
/** Probabilidad extra de cada tipo nuevo en una oleada (se quita del Errante), a partir de su minuto. */
export const WAVE_V3: Record<string, number> = { escupidor: 0.09, chillon: 0.04, acechador: 0.05, bruto: 0.05, reptante: 0.05, enjambre: 0.035 };

// ---------------------------------------------------------------- Mutaciones (min 10)
export type MutationId = 'veloz' | 'blindado' | 'volatil' | 'regenerador';
export const MUTATION_IDS: MutationId[] = ['veloz', 'blindado', 'volatil', 'regenerador'];
export const MUTATIONS = {
  fromMinute: 10,
  /** Probabilidad de que un enemigo que aparece desde el minuto 10 venga mutado (+1 % por minuto extra). */
  chance: 0.2, chancePerMinute: 0.01, maxChance: 0.35,
  veloz: { speedMult: 1.4 },
  blindado: { hpMult: 1.6 },
  volatil: {},
  regenerador: { afterSec: 3, pctPerSec: 0.05 },
  nombres: { veloz: 'Veloz', blindado: 'Blindado', volatil: 'Volátil', regenerador: 'Regenerador' } as Record<MutationId, string>,
  /** Tipos que nunca mutan. */
  exclude: ['abominacion', 'enjambre', 'reptante', 'hinchado'],
};
