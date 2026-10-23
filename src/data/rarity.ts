/** Sistema de rarezas: 5 tiers (palette.json), la v1 solo suelta 3. */
export type Rarity = 'chatarra' | 'comun' | 'reforzado' | 'militar' | 'anomalia';

export interface RarityDef {
  id: Rarity;
  nombre: string;
  /** Letra para distinguir sin depender del color (daltonismo). */
  letra: string;
  /** Orden 0..4; también es el nº de puntos que se dibujan. */
  tier: number;
  color: string;
  mult: number;
  rasgos: number;
  alien: boolean;
  /** Multiplicador de valor en chapas. */
  valor: number;
  /** Peso en la tirada de botín (0 = no sale en la v1). */
  peso: number;
}

export const RARITIES: Record<Rarity, RarityDef> = {
  chatarra: { id: 'chatarra', nombre: 'Chatarra', letra: 'X', tier: 0, color: '#8a8a8a', mult: 0.8, rasgos: 0, alien: false, valor: 0.5, peso: 0 },
  comun: { id: 'comun', nombre: 'Común', letra: 'C', tier: 1, color: '#f2efe8', mult: 1.0, rasgos: 0, alien: false, valor: 1, peso: 60 },
  reforzado: { id: 'reforzado', nombre: 'Reforzado', letra: 'R', tier: 2, color: '#4cd964', mult: 1.2, rasgos: 1, alien: false, valor: 2.5, peso: 30 },
  militar: { id: 'militar', nombre: 'Militar', letra: 'M', tier: 3, color: '#3c8cff', mult: 1.45, rasgos: 2, alien: false, valor: 6, peso: 10 },
  anomalia: { id: 'anomalia', nombre: 'Anomalía', letra: 'A', tier: 4, color: '#b44cff', mult: 1.8, rasgos: 2, alien: true, valor: 15, peso: 0 },
};

export const RARITY_ORDER: Rarity[] = ['chatarra', 'comun', 'reforzado', 'militar', 'anomalia'];
/** Rarezas que pueden caer en la v1 (activar las demás aquí cuando toque). */
export const V1_DROP_RARITIES: Rarity[] = ['comun', 'reforzado', 'militar'];

export function rarityAtLeast(r: Rarity, min: Rarity) {
  return RARITIES[r].tier >= RARITIES[min].tier;
}
export function colorNum(r: Rarity) {
  return parseInt(RARITIES[r].color.slice(1), 16);
}
