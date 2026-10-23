/** v4.0 §2: nivel, experiencia y atributos (lógica pura; los números están en config/levels.ts). */
import { ATTR_IDS, ATTR_RULES, ATTRS, AttrId, LEVEL_MAX, XP, XP_CURVE, XP_DEATH } from '../config/levels';
import type { Progress, SaveData } from '../save/types';

export const newProgress = (): Progress => ({ level: 1, xp: 0, total: 0, free: 0, attrs: Object.fromEntries(ATTR_IDS.map(a => [a, 0])) as Record<AttrId, number>, gym: {}, cheapRespecAt: -999, lastLevelUp: 0 });

/** Experiencia para pasar del nivel n al n+1. */
export function xpToNext(n: number): number {
  const C = XP_CURVE;
  if (n <= C.linearUntil) return C.base + C.perLevel * n;
  let v = C.base + C.perLevel * C.linearUntil;
  for (let i = C.linearUntil + 1; i <= n; i++) { let g = 1; for (const [from, k] of C.bands) if (i >= from) g = k; v *= g; }
  return Math.round(v);
}
/** Experiencia total para llegar al nivel n desde el 1. */
export function xpForLevel(n: number) { let s = 0; for (let i = 1; i < n; i++) s += xpToNext(i); return s; }

export function prog(d: SaveData): Progress { return (d.prog ??= newProgress()); }

/** Suma experiencia asegurada; devuelve los niveles subidos. Cada nivel da `pointsPerLevel` puntos libres. */
export function bankXp(d: SaveData, amount: number): number {
  const p = prog(d); let up = 0;
  amount = Math.max(0, Math.round(amount));
  p.total += amount; p.xp += amount;
  while (p.level < LEVEL_MAX && p.xp >= xpToNext(p.level)) { p.xp -= xpToNext(p.level); p.level++; up++; p.free += ATTR_RULES.pointsPerLevel; }
  if (p.level >= LEVEL_MAX) p.xp = Math.min(p.xp, xpToNext(p.level) - 1);
  if (up) p.lastLevelUp = Date.now();
  return up;
}

/** Penalización por muerte (§2 + Pablo): la de la incursión nunca se suma; además, según el modo, se pierde un 25 % del progreso al siguiente nivel. Nunca se baja de nivel. */
export function deathPenalty(d: SaveData): number {
  if (XP_DEATH.mode !== 'raid+progreso') return 0;
  const p = prog(d);
  const lost = Math.floor(p.xp * XP_DEATH.progressLoss);
  p.xp -= lost; p.total -= lost;
  return lost;
}
/** ¿La experiencia de la incursión se conserva al morir? (solo el modo de pruebas 'nada'). */
export const keepRaidXpOnDeath = () => XP_DEATH.mode === 'nada';

/** Experiencia por matar a un enemigo (tipo, élite, jefe). */
export function killXp(type: string, elite: boolean, boss = false) {
  if (boss) return XP.boss;
  return (XP.kill[type] ?? 0) * (elite ? XP.eliteMult : 1);
}
/** v4b: experiencia base de una muerte con las reglas de Basu (oleada ×0,3; pasado el tope de 1.500 base por incursión, ×0,5). Devuelve la base que suma al contador. */
export function killXpRaid(base: number, wave: boolean, killBaseSoFar: number) {
  let v = base * (wave ? XP.waveMult : 1);
  if (killBaseSoFar >= XP.killSoftCap) v *= XP.overCapMult;
  return v;
}
/** v4b: experiencia que se asegura al extraer. El ×1,5 del helipuerto no se aplica a la del jefe. `raidXp` y `bossXp` ya llevan el ×mapa. */
export function extractRaidXp(raidXp: number, bossXp: number, minutes: number, mapMult: number, heli: boolean) {
  const rest = Math.max(0, raidXp - bossXp) + extractXp(minutes) * mapMult;
  return rest * (heli ? XP.helipadMult : 1) + bossXp;
}
export const extractXp = (minutes: number) => XP.extractBase + XP.extractPerMin * Math.floor(minutes);
/** Misión: 60-150 según la dificultad (0-1). */
export const missionXp = (difficulty: number) => Math.round(XP.mission.min + (XP.mission.max - XP.mission.min) * Math.max(0, Math.min(1, difficulty)));

// ---------- atributos ----------
export function attrCap(d: SaveData, a: AttrId) { return ATTR_RULES.cap + (prog(d).gym[a] ?? 0); }
/** Efecto de un atributo: puntos / 50 × efecto máximo (lineal; pasa de 50 con el Gimnasio). */
export function attrK(d: SaveData | null | undefined, a: AttrId, key: string): number {
  if (!d) return 0;
  const pts = prog(d).attrs[a] ?? 0;
  return (pts / ATTR_RULES.refPoints) * (ATTRS[a].max[key] ?? 0);
}
export function assignPoint(d: SaveData, a: AttrId): string | null {
  const p = prog(d);
  if (p.free <= 0) return 'No tienes puntos libres';
  if (p.attrs[a] >= attrCap(d, a)) return `Máximo de ${ATTRS[a].nombre}: ${attrCap(d, a)}`;
  p.attrs[a]++; p.free--; return null;
}
/** Coste de quitar un punto ahora (Pizarra 2: 1 → 1 una vez cada 3 incursiones). */
export function respecCost(d: SaveData, pizarraLevel: number) {
  if (pizarraLevel >= 2 && d.stats.raids - prog(d).cheapRespecAt >= ATTR_RULES.pizarraCheapEveryRaids) return { cost: 1, cheap: true };
  return { cost: ATTR_RULES.respecCost, cheap: false };
}
/** Quitar un punto: cuesta 2 asignados (el que quitas y otro del mismo atributo) y devuelve 1 libre. */
export function respecPoint(d: SaveData, a: AttrId, pizarraLevel: number): string | null {
  const p = prog(d); const { cost, cheap } = respecCost(d, pizarraLevel);
  if (p.attrs[a] < cost) return `Hacen falta ${cost} puntos en ${ATTRS[a].nombre} para quitar uno`;
  p.attrs[a] -= cost; p.free += ATTR_RULES.respecRefund;
  if (cheap) p.cheapRespecAt = d.stats.raids;
  return null;
}
/** Pizarra 3: cambios completos gratis (1 por cada 10 niveles alcanzados, menos los usados). */
export function freeResetsLeft(d: SaveData, pizarraLevel: number) {
  if (pizarraLevel < 3) return 0;
  return Math.max(0, Math.floor(prog(d).level / 10) - (prog(d).freeResets ?? 0));
}
/** Cambio completo: todos los puntos asignados vuelven a libres. */
export function fullReset(d: SaveData, pizarraLevel: number): string | null {
  if (freeResetsLeft(d, pizarraLevel) <= 0) return 'Sin cambios completos gratis (Pizarra 3: 1 cada 10 niveles)';
  const p = prog(d);
  for (const a of ATTR_IDS) { p.free += p.attrs[a]; p.attrs[a] = 0; }
  p.freeResets = (p.freeResets ?? 0) + 1;
  return null;
}
/** Experiencia de una misión: 60-150 según lo exigente (su XP de reputación). */
export function missionXpFor(repXp: number, minRep: number, maxRep: number) {
  return missionXp(maxRep > minRep ? (repXp - minRep) / (maxRep - minRep) : 0.5);
}

/** Gimnasio: sube +5 el tope de un atributo (uno por nivel de la estación, a partir del 2). */
export function gymSlotsLeft(d: SaveData, gymLevel: number) {
  const used = Object.values(prog(d).gym).reduce((s, v) => s + (v ?? 0), 0) / ATTR_RULES.gymPerLevel;
  return Math.max(0, gymLevel - 1 - used);
}
export function gymRaise(d: SaveData, a: AttrId, gymLevel: number): string | null {
  if (gymSlotsLeft(d, gymLevel) <= 0) return 'Mejora el Gimnasio para subir otro tope';
  const g = prog(d).gym; g[a] = (g[a] ?? 0) + ATTR_RULES.gymPerLevel; return null;
}
