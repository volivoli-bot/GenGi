/**
 * GenGi v3.2: pase de rendimiento (caída de fps al final de la incursión). Recortes aprobados por Basu y Dott.
 * Todos los topes reciclan lo más viejo: el jugador no pierde nada importante (las flechas viejas que desaparecen
 * se pierden, como si se hubieran roto).
 */
export const PERF = {
  /** Flechas/virotes en el suelo a la vez; por encima desaparece el más viejo (Basu). */
  maxGroundArrows: 30,
  /** Siluetas fantasma (memoria de visión) a la vez; las más viejas se apagan antes (Basu). */
  maxGhosts: 8,
  /** Manchas de sangre en el suelo a la vez; las más viejas se desvanecen (Dott). Antes 160. */
  maxStains: 60,
  /** Duración del desvanecido de una mancha reciclada (ms). */
  stainFadeMs: 500,
  /** Manchas desvaneciéndose a la vez como máximo (en ráfagas se recicla la más vieja). */
  maxStainsFading: 12,
  /** Niebla: como mucho un recálculo del polígono de visión cada X ms (≈30 Hz) salvo saltos grandes. */
  fogMinRedrawMs: 33,
  /** Si el jugador se mueve/gira más que esto desde el último recálculo, se recalcula ya (px / rad). */
  fogForcePx: 10,
  fogForceRad: 0.15,
  /** Memoria de visión: se guarda cada «foto» de un polígono simplificado (1 de cada N puntos). */
  lingerDecimate: 2,
  /** Memoria de visión: solo se guarda otra foto si la mirada se movió más de esto desde la anterior (px / rad). */
  lingerMinPx: 6,
  /** Memoria de visión: sectores angulares de la unión de fotos (1 polígono por capa; 120 = 3° por sector). */
  lingerBins: 120,
  lingerMinRad: 0.06,
  /** Contador de fps en pantalla también fuera de ?debug (con el mínimo entre los minutos 12 y 15). */
  showFps: true,
  /** Ventana (min) cuyo mínimo de fps muestra el contador. */
  fpsMinFrom: 12,
  fpsMinTo: 15,
};
