import { DAMAGE } from '../config/v31';

export type DmgSide = 'player' | 'enemy';
export interface DmgRoll { dmg: number; crit: boolean }

/** QA: últimas tiradas por lado (base, resultado, crítico). */
export const DMG_LOG: Record<DmgSide, { base: number; dmg: number; crit: boolean }[]> = { player: [], enemy: [] };

/**
 * v3.1 §9.2: daño directo = base × U[minFrac, maxFrac], y crítico ×critMult con critChance.
 * Nunca se llama para daño por segundo (sangrado, veneno, ácido, niebla, agarre del Reptante).
 */
export function rollDamage(base: number, side: DmgSide, rng: () => number = Math.random): DmgRoll {
  const c = DAMAGE[side];
  let dmg = base * (c.minFrac + (c.maxFrac - c.minFrac) * rng());
  const crit = rng() < c.critChance;
  if (crit) dmg *= c.critMult;
  const log = DMG_LOG[side]; log.push({ base, dmg, crit }); if (log.length > 4000) log.shift();
  return { dmg, crit };
}

/** Multiplicador medio esperado de una tirada (para informes de TTK). */
export function meanMult(side: DmgSide) {
  const c = DAMAGE[side];
  return ((c.minFrac + c.maxFrac) / 2) * (1 + c.critChance * (c.critMult - 1));
}
