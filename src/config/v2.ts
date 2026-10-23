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
  /** Opacidad de la niebla detrás / tras muros (se ve el suelo). Prueba v2: 0,62 → 0,45 (diseno-v3 §8.5). */
  fogAlpha: 0.45,
  /** Borde difuminado de la niebla (casillas) y capas con que se aproxima el degradado. */
  fogFeatherTiles: 1.5,
  fogLayers: 3,
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

/**
 * Sigilo (Pablo; especificación final de Basu en diseno-v3.md §7): cada enemigo tiene su mirada, cono de visión y oído.
 * Estados: sin enterarse (idle) → sospecha (investigate, '?') → alerta (chase, '!').
 */
export const STEALTH = {
  // --- Ruido del jugador (anillo tenue alrededor del personaje) ---
  /** Joystick: < sigiloStick = sigilo, < andarStick = andar, si no correr. */
  sigiloStick: 0.4,
  andarStick: 0.85,
  /** Velocidad (fracción de la máxima) de cada paso. */
  sigiloSpeed: 0.35,
  andarSpeed: 0.7,
  /** Radio de ruido (casillas) de cada paso. Quieto = 0. */
  sigiloNoise: 1,
  andarNoise: 3,
  correrNoise: 6,
  /** Chaleco Militar o mejor: +1 casilla. */
  heavyArmorNoise: 1,
  /** Ruidos sueltos (casillas): puertas = MAP2.doorNoise (3), cajas cerradas (4), cristales/latas del suelo (5). Disparar: dato del arma (pistola 10, arco 1). */
  crateNoise: 4,
  debrisNoise: 5,
  /** Golpe cuerpo a cuerpo que conecta (no por la espalda): ruido medio. */
  meleeHitNoise: 3,
  /** El ruido atraviesa paredes a la mitad de distancia. */
  wallMuffle: 0.5,
  /** Cada cuánto se emite el ruido de pasos (s). */
  stepEverySec: 0.25,
  /** El oído de los enemigos sube un 3 % por minuto. */
  hearingPerMinute: 0.03,
  /** Oído por tipo (multiplica el radio). */
  hearing: { errante: 1, corredor: 1, hinchado: 1, abominacion: 1 } as Record<string, number>,
  /** Cristales y latas por el mapa (se ven si te fijas; ocultos en la niebla como el botín). */
  debrisCount: 70,
  /** Radio de pisada (casillas) y tiempo hasta que la misma pieza vuelve a sonar (s). */
  debrisStepTiles: 0.45,
  debrisCooldownSec: 2,

  // --- Percepción de los enemigos ---
  /** Vista: cono de 110° y 6 casillas, cortado por paredes. De espaldas no te ven. */
  coneDeg: 110,
  sightTiles: { errante: 6, corredor: 6, hinchado: 6, abominacion: 6 } as Record<string, number>,
  /** Ya en alerta te siguen localizado (sin cono) hasta este factor del alcance. */
  alertSightMult: 1.3,
  /** Medidor '?': 0,4 s si estás cerca, 1,2 s en el límite del alcance. */
  detectNearSec: 0.4,
  detectFarSec: 1.2,
  /** Dentro del cono a menos de esto (casillas): instantáneo. */
  instantTiles: 1,
  /** El medidor baja a esta velocidad (por s) cuando no te ve. */
  decayPerSec: 0.5,
  /** Cada cuánto se comprueba la vista (s). */
  checkSec: 0.1,
  /** Sospecha: se gira hacia el ruido, va al último sitio donde te notó y mira alrededor 4 s. */
  suspiciousTurnSec: 0.5,
  suspiciousLookSec: 4,
  suspiciousSpeedMult: 0.6,
  /** Los quietos giran al azar cada 3-7 s; los que deambulan cambian de rumbo. Antes de girar: pausa visible de 0,4 s. */
  turnMinSec: 3,
  turnMaxSec: 7,
  turnPauseSec: 0.4,
  turnMaxDeg: 160,
  /** '!' visible este tiempo al pasar a alerta. */
  alertMarkSec: 1.2,

  // --- Golpe por la espalda ---
  /** x2,5 de daño y crítico garantizado a quien no te ha detectado. Matar sin ser detectado no avisa a nadie. */
  backstabMult: 2.5,
  /** "Detrás" = fuera de este ángulo frontal del enemigo (grados totales). */
  backArcDeg: 180,
  /** Conos tenues en el suelo de los enemigos que están en tu cono (dificultad normal; ajuste para expertos). */
  conesMaxTiles: 10,
};

/**
 * Cambios tras la prueba de la v2 (Pablo; números finales de Basu en diseno-v3.md §8).
 */
export const PRUEBA_V2 = {
  /** §8.1 Inventario: es toque si el dedo se mueve < 8 px y dura < 300 ms. */
  tapMovePx: 8,
  tapMaxMs: 300,
  /** §8.2 Daño de todos los enemigos +25 % (Errante 6 → 7,5); la curva por minuto va encima. */
  enemyDmgMult: 1.25,
  /** §8.3 Casco, Escanear: radio 10 casillas, enemigos visibles 3 s aunque estén tras muros (antes: todo el mapa, 6 s). */
  scanTiles: 10,
  scanSec: 3,
  /** §8.4 Indicadores junto al jugador. */
  abilityIconPx: 18,
  statusIconPx: 14,
  miniHpW: 36,
  miniHpH: 4,
  /** Mini barra: fija por debajo del 35 %, o tras 2 golpes en 3 s (se queda 3 s desde el último). */
  miniHpLowPct: 0.35,
  miniHpHits: 2,
  miniHpWindowSec: 3,
  miniHpStaySec: 3,
  /** §8.6 Armas a distancia: cadencia ×0,67 (arco 0,8 → 0,53 ataques/s; pistola 2,0 → 1,33). */
  rangedApsMult: 0.67,
  /** §8.7 Veneno y sangrado acumulables (cada carga con su temporizador). */
  status: {
    /** Daño total de una carga = un golpe de Errante (6 × 1,25 = 7,5) repartido en su duración. */
    stackDmg: 7.5,
    maxStacks: 5,
    bleedSec: 6,
    poisonSec: 4,
    /** 33 % de los golpes cuerpo a cuerpo de los enemigos aplican 1 carga de sangrado. */
    bleedChance: 0.33,
    /** Charco de ácido: 1 carga de veneno por segundo dentro. Explosión del Hinchado: 1 carga. (El Escupidor es arte v3 aún no integrado.) */
    acidStackEverySec: 1,
    explosionStacks: 1,
    /** El daño se aplica en pasos de 0,5 s (sin hit-stop; destello leve en la barra). */
    tickSec: 0.5,
    /** Vendas quitan el sangrado; el botiquín quita sangrado y veneno. */
    curaSangrado: ['vendaje', 'botiquin'] as string[],
    curaVeneno: ['botiquin'] as string[],
  },
  /**
   * §8.8 Tiempo de aplicar curaciones (s). Botón rápido: mantener pulsado; soltar o recibir un golpe cancela sin gastar el objeto.
   * Mientras aplicas: te mueves al 50 %, no atacas/apuntas/cambias de arma, anillo de progreso sobre el jugador.
   * Al terminar: la curación de siempre (venda +30 en 2 s, botiquín +70 en 4 s) y se quitan los estados.
   */
  applySec: { vendaje: 1.5, botiquin: 2.5 } as Record<string, number>,
  applyMoveMult: 0.5,
};
