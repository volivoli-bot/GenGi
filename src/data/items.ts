import { TILE } from '../config/constants';

export type Slot = 'arma' | 'torso' | 'cabeza';
export type ItemKind = 'arma' | 'armadura' | 'consumible' | 'municion' | 'bengala' | 'chapas';
export type AbilityId = 'golpe' | 'torbellino' | 'perforante' | 'rafaga' | 'aguantar' | 'escanear';

export interface WeaponStats {
  dmg: number; aps: number; rangeTiles: number; noise: number; melee: boolean;
  ability: AbilityId; mag?: number; reloadSec?: number;
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
  desc: string;
}

export const ITEMS: Record<string, ItemDef> = {
  bate: { id: 'bate', nombre: 'Bate', kind: 'arma', slot: 'arma', icon: 'bate', weight: 2, value: 20, small: false, rolls: true, maxStack: 1,
    weapon: { dmg: 12, aps: 1.2, rangeTiles: 1.2, noise: 0, melee: true, ability: 'golpe' }, desc: 'Silencioso. Golpe cargado con empuje.' },
  machete: { id: 'machete', nombre: 'Machete', kind: 'arma', slot: 'arma', icon: 'machete', weight: 1.5, value: 45, small: false, rolls: true, maxStack: 1,
    weapon: { dmg: 9, aps: 2.0, rangeTiles: 1.1, noise: 0, melee: true, ability: 'torbellino' }, desc: 'Rápido. Torbellino con sangrado.' },
  arco: { id: 'arco', nombre: 'Arco', kind: 'arma', slot: 'arma', icon: 'arco', weight: 2, value: 70, small: false, rolls: true, maxStack: 1,
    weapon: { dmg: 18, aps: 0.8, rangeTiles: 7, noise: 1, melee: false, ability: 'perforante' }, desc: 'Largo alcance y casi sin ruido.' },
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
  municion: { id: 'municion', nombre: 'Munición 9 mm', kind: 'municion', icon: null, weight: 0.02, value: 4, small: true, rolls: false, maxStack: 48, desc: 'Escasa y cara.' },
  bengala: { id: 'bengala', nombre: 'Bengala', kind: 'bengala', icon: 'bengala', weight: 0.5, value: 50, small: true, rolls: false, maxStack: 2, desc: 'Abre la extracción de bengala (min 8-10).' },
  chapas: { id: 'chapas', nombre: 'Chapas', kind: 'chapas', icon: 'chapa', weight: 0, value: 1, small: true, rolls: false, maxStack: 999, desc: 'Moneda. Se ingresa al extraer.' },
};

export interface AbilityDef { id: AbilityId; nombre: string; cooldown: number; icon: string }
export const ABILITIES: Record<AbilityId, AbilityDef> = {
  golpe: { id: 'golpe', nombre: 'Golpe cargado', cooldown: 8, icon: 'bate' },
  torbellino: { id: 'torbellino', nombre: 'Torbellino', cooldown: 10, icon: 'machete' },
  perforante: { id: 'perforante', nombre: 'Perforante', cooldown: 8, icon: 'arco' },
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
