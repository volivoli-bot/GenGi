/**
 * Números de diseño de la v2 (Basu, diseno-v1.md → "Cambios v2"). Todo lo ajustable de las mecánicas nuevas vive aquí.
 * Unidades: casillas (TILE = 48 px de mundo), segundos, grados.
 */
export const MOVE = {
  /** 0 → velocidad máxima (s). */
  accelSec: 0.25,
  /** velocidad máxima → 0 (s): frenado con derrape. */
  decelSec: 0.18,
  /** Cada punto de peso alarga aceleración y frenado un 2 %. */
  weightTimePct: 0.02,
  /** Mientras apuntas con un arma a distancia te mueves al 60 %. */
  aimSpeedMult: 0.6,
  /** Giro del personaje (grados/s) hacia la dirección de mirada (giro suave). */
  turnDegPerSec: 720,
};

export const AIM = {
  /** Radio del joystick de apuntado (px de pantalla). */
  stickRadius: 70,
  /** Arrastrar más allá de este % del radio = dispara. */
  fireThreshold: 0.85,
  /** Por debajo de esto el toque no apunta (zona muerta). */
  deadZone: 0.18,
  /** Toque rápido (sin arrastrar) = mirar atrás este tiempo. */
  tapMaxSec: 0.22,
  glanceBackSec: 0.8,
  /** Dispersión de la línea (grados a cada lado) al empezar y al estabilizar. */
  spreadStartDeg: 9,
  spreadMinDeg: 1.2,
  /** Tiempo con el stick quieto para estabilizar del todo. */
  steadySec: 0.4,
  /** Cambio de ángulo (grados) que se considera "mover el stick" (reinicia la estabilización). */
  steadyToleranceDeg: 6,
  /** Vibración al disparar (ms). iOS: pulso visual del stick + golpe de cámara. */
  vibrateMs: 18,
  cameraKickPx: 3,
  /** iOS (sin vibración): contrapartida visual más fuerte = más retroceso del arma + golpe y sacudida de cámara. */
  iosRecoilPx: 8,
  iosCameraKickPx: 7,
  iosShake: 0.004,
  /** Sin tocar el stick, el arma a distancia sigue disparando sola (como en la v1) pero más despacio. */
  autoFireWhenIdle: true,
  autoFireRateMult: 0.6,
};

export const PROJECTILE = {
  /** Flecha: lenta y visible (casillas/s); cae un poco al final; recuperable. */
  arrowTilesPerSec: 10,
  arrowRecoverChance: 0.7,
  /** Bala: casi instantánea (casillas/s) con trazo luminoso. */
  bulletTilesPerSec: 40,
};

export const JUICE = {
  /** Parón de impacto (ms): normal y golpes fuertes / críticos. */
  hitStopMs: 55,
  hitStopHeavyMs: 80,
  /** Sacudida de cámara: intensidad por punto de daño, con tope. */
  shakePerDmg: 0.00025,
  shakeMax: 0.009,
  /** Críticos. */
  critChance: 0.1,
  critMult: 1.8,
  /** Números de daño: salto (px), duración (s). Crítico amarillo y 1,4× más grande. */
  dmgNumRise: 20,
  dmgNumSec: 0.6,
  critColor: '#ffd27a',
  /** Topes de rendimiento: manchas de suelo y cadáveres que se quedan en la raid (los más viejos se reciclan). */
  maxStains: 160,
  maxCorpses: 45,
};

/** Tambaleo: impulso corto + tambaleo; los pesados se mueven menos. */
export const STAGGER = {
  /** Masa relativa por tipo (divide el impulso). */
  weight: { errante: 1, corredor: 0.8, hinchado: 1.7, abominacion: 7 } as Record<string, number>,
  /** Fuerza del arma (px/s de impulso para masa 1) y duración del tambaleo (s). */
  weapon: { punos: [140, 0.12], bate: [330, 0.35], machete: [170, 0.16], arco: [220, 0.18], pistola: [180, 0.14] } as Record<string, [number, number]>,
  impulseSec: 0.12,
  /** Un tambaleo de al menos esto (s) interrumpe un aviso de ataque. */
  interruptSec: 0.3,
};

export const VISION = {
  /** Cono de visión total (grados) hacia donde mira el personaje. */
  coneDeg: 220,
  /** Alcance de visión (casillas). */
  rangeTiles: 15,
  /** Conciencia corporal: radio pequeño siempre visible alrededor del jugador (casillas). Decisión de implementación: ver diseño v2. */
  nearTiles: 1.7,
  /** Rayos del polígono de visibilidad (por cada grado del cono). */
  raysPerDeg: 0.9,
  /** Opacidad de la niebla detrás / tras muros (se ve el suelo). */
  fogAlpha: 0.62,
  /** Aviso de enemigo oculto detrás (casillas). */
  behindWarnTiles: 4,
};

export const MAP2 = {
  /** Casillas por lado: ~3× el área de la v1 (60 × 60 → 104 × 104). */
  tiles: 104,
  /** Identificador del mapa (las salidas vistas se guardan por mapa). */
  id: 'ciudad-v2',
  /** Semilla fija del trazado (el mapa es siempre el mismo; botín, enemigos y salidas activas cambian cada raid). */
  layoutSeed: 0x9e3779b1,
  doorNoise: 3,
};

export const AI = {
  /** Un enemigo que te detecta avisa a los de su grupo en este radio (casillas). */
  alertTiles: 6,
  /** Flanqueo: ángulo de abanico de los Errantes al rodearte (grados) y distancia a la que van ya directos. */
  flankDeg: 55,
  flankUntilTiles: 3,
  /** Corredor: apunta su embestida a donde VAS a estar (s de previsión), y se abre de lado antes de cargar. */
  corredorLeadSec: 0.35,
  corredorStrafeSec: 0.6,
  /** Ajuste de velocidad v2 (más difícil). */
  speedMult: { errante: 1.12, corredor: 1.05, hinchado: 1.1, abominacion: 1.05 } as Record<string, number>,
};

/** Arma de reserva (Basu, especificación final del cambio de arma). */
export const SWAP = {
  /** Duración del cambio (s): no se puede atacar mientras dura. */
  sec: 0.4,
  /** Diámetro del botón de cambio rápido (px): encima del arco de habilidades. */
  buttonPx: 44, // Basu: botón pequeño de 44 px
};

/** Botones de habilidad / consumible en arco encima y a la izquierda del joystick de apuntar. */
export const HUD2 = {
  buttonPx: 52,
  /** Distancia del centro del joystick de apuntar al arco de botones (px). */
  arcRadius: 116,
  /** Ángulos (grados, 180 = izquierda, 270 = arriba) de: habilidad arma, torso, cabeza, consumible. */
  arcDeg: [188, 218, 248, 278],
  /** iOS: los joysticks (base y zona muerta) nunca quedan a menos de esto del borde de la pantalla (px), lejos del gesto de atrás/adelante. */
  edgeInsetPx: 20,
};
