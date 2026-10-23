import { TILE } from '../config/constants';
import type { Rarity } from './rarity';

export type Slot = 'arma' | 'torso' | 'cabeza' | 'espalda';
export type ItemKind = 'arma' | 'armadura' | 'consumible' | 'municion' | 'bengala' | 'chapas' | 'material' | 'mochila' | 'granada' | 'llave';
export type AbilityId = 'golpe' | 'torbellino' | 'perforante' | 'rafaga' | 'aguantar' | 'escanear' | 'clavar';

export interface WeaponStats {
  dmg: number; aps: number; rangeTiles: number; noise: number; melee: boolean;
  ability: AbilityId; mag?: number; reloadSec?: number;
  /** v2: munición que gasta cada disparo directamente de la mochila (arco → flechas). */
  ammo?: string;
}
export interface ArmorStats { protection: number; ability?: AbilityId }

export interface ItemDef {
  id: string;
  nombre: string;
  kind: ItemKind;
  slot?: Slot;
  /** Icono en public/art (sin extensión) o null para icono dibujado por CSS. */
  icon: string | null;
  weight: number;
  /** Valor base en chapas (tier Común). */
  value: number;
  /** Pequeño = cabe en el bolsillo seguro. */
  small: boolean;
  /** ¿Tiene rareza propia? (consumibles, munición... siempre Común) */
  rolls: boolean;
  maxStack: number;
  weapon?: WeaponStats;
  armor?: ArmorStats;
  heal?: { amount: number; seconds: number };
  /** v3: consumible con efecto especial (adrenalina, antídoto, estimulante). */
  effect?: 'adrenalina' | 'antidoto' | 'estimulante';
  /** v4: rareza fija del objeto (mochilas: la rareza va con el modelo, no se tira). */
  fixedRarity?: Rarity;
  desc: string;
}

export const ITEMS: Record<string, ItemDef> = {
  bate: { id: 'bate', nombre: 'Bate', kind: 'arma', slot: 'arma', icon: 'bate', weight: 2, value: 20, small: false, rolls: true, maxStack: 1,
    weapon: { dmg: 12, aps: 1.2, rangeTiles: 1.2, noise: 0, melee: true, ability: 'golpe' }, desc: 'Silencioso. Golpe cargado con empuje.' },
  machete: { id: 'machete', nombre: 'Machete', kind: 'arma', slot: 'arma', icon: 'machete', weight: 1.5, value: 45, small: false, rolls: true, maxStack: 1,
    weapon: { dmg: 9, aps: 2.0, rangeTiles: 1.1, noise: 0, melee: true, ability: 'torbellino' }, desc: 'Rápido. Torbellino con sangrado.' },
  arco: { id: 'arco', nombre: 'Arco', kind: 'arma', slot: 'arma', icon: 'arco', weight: 2, value: 70, small: false, rolls: true, maxStack: 1,
    weapon: { dmg: 18, aps: 0.8, rangeTiles: 7, noise: 0, melee: false, ability: 'perforante', ammo: 'flechas' }, desc: 'Largo alcance y silencioso. Las flechas se recogen del suelo.' },
  /** v3.1 (§9.1): 24 de daño, 0,4 ataques/s finales (0,6 × 0,67 de la cadencia a distancia), alcance 8, peso 3. */
  ballesta: { id: 'ballesta', nombre: 'Ballesta', kind: 'arma', slot: 'arma', icon: 'v3/arma_ballesta', weight: 3, value: 95, small: false, rolls: true, maxStack: 1,
    weapon: { dmg: 24, aps: 0.6, rangeTiles: 8, noise: 0, melee: false, ability: 'clavar', ammo: 'virotes' }, desc: 'Silenciosa, lenta y potente. Los virotes se recogen del suelo.' },
  pistola: { id: 'pistola', nombre: 'Pistola', kind: 'arma', slot: 'arma', icon: 'pistola', weight: 1, value: 110, small: true, rolls: true, maxStack: 1,
    weapon: { dmg: 12, aps: 2.0, rangeTiles: 6, noise: 10, melee: false, ability: 'rafaga', mag: 12, reloadSec: 1.5 }, desc: 'Mucho daño pero MUCHO ruido. Gasta munición.' },
  ropa: { id: 'ropa', nombre: 'Ropa', kind: 'armadura', slot: 'torso', icon: null, weight: 0, value: 5, small: false, rolls: false, maxStack: 1,
    armor: { protection: 0 }, desc: 'No protege nada.' },
  tablas: { id: 'tablas', nombre: 'Tablas atadas', kind: 'armadura', slot: 'torso', icon: 'tablas', weight: 3, value: 40, small: false, rolls: true, maxStack: 1,
    armor: { protection: 0.15 }, desc: 'Protección casera.' },
  chaleco: { id: 'chaleco', nombre: 'Chaleco militar', kind: 'armadura', slot: 'torso', icon: 'chaleco', weight: 6, value: 140, small: false, rolls: true, maxStack: 1,
    armor: { protection: 0.35, ability: 'aguantar' }, desc: 'Habilidad Aguantar.' },
  casco: { id: 'casco', nombre: 'Casco militar', kind: 'armadura', slot: 'cabeza', icon: 'casco', weight: 2, value: 90, small: false, rolls: true, maxStack: 1,
    armor: { protection: 0.15, ability: 'escanear' }, desc: 'Habilidad Escanear.' },
  vendaje: { id: 'vendaje', nombre: 'Vendaje', kind: 'consumible', icon: 'vendaje', weight: 0.2, value: 15, small: true, rolls: false, maxStack: 5,
    heal: { amount: 30, seconds: 2 }, desc: '+30 de vida en 2 s.' },
  botiquin: { id: 'botiquin', nombre: 'Botiquín', kind: 'consumible', icon: 'botiquin', weight: 0.8, value: 60, small: true, rolls: false, maxStack: 3,
    heal: { amount: 70, seconds: 4 }, desc: '+70 de vida en 4 s.' },
  flechas: { id: 'flechas', nombre: 'Flechas', kind: 'municion', icon: 'flecha', weight: 0.05, value: 3, small: true, rolls: false, maxStack: 30, desc: 'Para el arco. Se pueden recoger del suelo o del cadáver.' },
  virotes: { id: 'virotes', nombre: 'Virotes', kind: 'municion', icon: 'v3/proyectil_virote', weight: 0.08, value: 4, small: true, rolls: false, maxStack: 24, desc: 'Para la ballesta. Se pueden recoger del suelo o del cadáver.' },
  municion: { id: 'municion', nombre: 'Munición 9 mm', kind: 'municion', icon: 'municion', weight: 0.02, value: 4, small: true, rolls: false, maxStack: 48, desc: 'Escasa y cara.' },
  bengala: { id: 'bengala', nombre: 'Bengala', kind: 'bengala', icon: 'bengala', weight: 0.5, value: 50, small: true, rolls: false, maxStack: 2, desc: 'Abre la extracción de bengala (min 8-10).' },
  // ---- v3 (diseno-v3 §1/§3): materiales del refugio y objetos nuevos de Doc Reyes / Hierro
  mat_chatarra: { id: 'mat_chatarra', nombre: 'Chatarra', kind: 'material', icon: 'v3/material_chatarra', weight: 0.4, value: 8, small: true, rolls: false, maxStack: 20, desc: 'Material. Alijo, Taller (munición).' },
  mat_tela: { id: 'mat_tela', nombre: 'Tela', kind: 'material', icon: 'v3/material_tela', weight: 0.2, value: 9, small: true, rolls: false, maxStack: 20, desc: 'Material. Bolsillo seguro, Enfermería (vendajes).' },
  mat_componentes: { id: 'mat_componentes', nombre: 'Componentes', kind: 'material', icon: 'v3/material_componentes', weight: 0.3, value: 22, small: true, rolls: false, maxStack: 20, desc: 'Material escaso. Radio, Taller, mejoras de nivel 3.' },
  mat_combustible: { id: 'mat_combustible', nombre: 'Combustible', kind: 'material', icon: 'v3/material_combustible', weight: 0.6, value: 18, small: true, rolls: false, maxStack: 20, desc: 'Material. Generador.' },
  mat_muestra: { id: 'mat_muestra', nombre: 'Muestra mutada', kind: 'material', icon: 'v3/material_muestra', weight: 0.2, value: 45, small: true, rolls: false, maxStack: 20, desc: 'De Hinchados, mutados y la Abominación. Enfermería nivel 3.' },
  adrenalina: { id: 'adrenalina', nombre: 'Adrenalina', kind: 'consumible', icon: null, weight: 0.2, value: 90, small: true, rolls: false, maxStack: 3,
    effect: 'adrenalina', desc: '8 s: +25 % velocidad y -30 % daño recibido.' },
  antidoto: { id: 'antidoto', nombre: 'Antídoto', kind: 'consumible', icon: null, weight: 0.2, value: 65, small: true, rolls: false, maxStack: 3,
    effect: 'antidoto', desc: 'Quita el veneno y te protege de él 30 s.' },
  estimulante: { id: 'estimulante', nombre: 'Estimulante de visión', kind: 'consumible', icon: null, weight: 0.2, value: 100, small: true, rolls: false, maxStack: 2,
    effect: 'estimulante', desc: '25 s: ves a los enemigos a 8 casillas, incluso tras muros.' },
  granada: { id: 'granada', nombre: 'Granada', kind: 'granada', icon: null, weight: 0.5, value: 80, small: true, rolls: false, maxStack: 3,
    desc: 'Se lanza 5 casillas hacia donde miras. Explota en 1 s (45 de daño). MUCHO ruido.' },
  // v4 §1: mochilas (casillas, peso propio y extras en config/v4.ts BAGS). Ids media/grande de la v3 = senderismo/táctica.
  rinonera: { id: 'rinonera', nombre: 'Riñonera', kind: 'mochila', slot: 'espalda', icon: 'v4/mochila_rinonera', weight: 0.5, value: 30, small: false, rolls: false, fixedRarity: 'chatarra', maxStack: 1, desc: '8 casillas.' },
  mochila_escolar: { id: 'mochila_escolar', nombre: 'Mochila escolar', kind: 'mochila', slot: 'espalda', icon: 'v4/mochila_escolar', weight: 1, value: 55, small: false, rolls: false, fixedRarity: 'comun', maxStack: 1, desc: '12 casillas.' },
  mochila_media: { id: 'mochila_media', nombre: 'Mochila de senderismo', kind: 'mochila', slot: 'espalda', icon: 'v4/mochila_senderismo', weight: 1.5, value: 120, small: false, rolls: false, fixedRarity: 'reforzado', maxStack: 1, desc: '16 casillas y +1 consumible rápido.' },
  mochila_grande: { id: 'mochila_grande', nombre: 'Mochila táctica', kind: 'mochila', slot: 'espalda', icon: 'v4/mochila_tactica', weight: 2, value: 300, small: false, rolls: false, fixedRarity: 'militar', maxStack: 1, desc: '20 casillas, +1 consumible rápido y consumibles un 15 % más rápidos.' },
  mochila_anomala: { id: 'mochila_anomala', nombre: 'Mochila anómala', kind: 'mochila', slot: 'espalda', icon: 'v4/mochila_anomala', weight: 1, value: 1000, small: false, rolls: false, fixedRarity: 'anomalia', maxStack: 1, desc: '26 casillas. Lo que lleva pesa un 20 % menos.' },
  // v4 §4: llave del helipuerto del radar (la suelta la Matriarca). Pequeña: cabe en el bolsillo seguro.
  tarjeta_helipuerto: { id: 'tarjeta_helipuerto', nombre: 'Tarjeta del helipuerto', kind: 'llave', icon: 'v4/tarjeta_helipuerto', weight: 0.1, value: 60, small: true, rolls: false, maxStack: 1, desc: 'Abre el Helipuerto del radar (Zona Helada): el helicóptero tarda 30 s y hace muchísimo ruido.' },
  chapas: { id: 'chapas', nombre: 'Chapas', kind: 'chapas', icon: 'chapa', weight: 0, value: 1, small: true, rolls: false, maxStack: 999, desc: 'Moneda. Se ingresa al extraer.' },
};

export interface AbilityDef { id: AbilityId; nombre: string; cooldown: number; icon: string }
export const ABILITIES: Record<AbilityId, AbilityDef> = {
  golpe: { id: 'golpe', nombre: 'Golpe cargado', cooldown: 8, icon: 'bate' },
  torbellino: { id: 'torbellino', nombre: 'Torbellino', cooldown: 10, icon: 'machete' },
  perforante: { id: 'perforante', nombre: 'Perforante', cooldown: 8, icon: 'arco' },
  clavar: { id: 'clavar', nombre: 'Clavar', cooldown: 8, icon: 'arma_ballesta' },
  rafaga: { id: 'rafaga', nombre: 'Ráfaga', cooldown: 12, icon: 'pistola' },
  aguantar: { id: 'aguantar', nombre: 'Aguantar', cooldown: 20, icon: 'chaleco' },
  escanear: { id: 'escanear', nombre: 'Escanear', cooldown: 25, icon: 'casco' },
};

/** Rasgos que añaden las rarezas Reforzado (1) y Militar (2). */
export type TraitId = 'dano' | 'cadencia' | 'alcance' | 'ligero' | 'proteccion';
export const TRAITS: Record<TraitId, { nombre: string; for: ('arma' | 'armadura')[] }> = {
  dano: { nombre: '+10 % daño', for: ['arma'] },
  cadencia: { nombre: '+10 % cadencia', for: ['arma'] },
  alcance: { nombre: '+15 % alcance', for: ['arma'] },
  ligero: { nombre: '-30 % peso', for: ['arma', 'armadura'] },
  proteccion: { nombre: '+5 % protección', for: ['armadura'] },
};

export const tiles = (t: number) => t * TILE;
