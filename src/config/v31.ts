/**
 * v3.1 (diseno-v3.md §9, prueba de la v2.1): arco/ballesta silenciosos, daño variable y críticos,
 * memoria de visión, el Trapero y enemigos de élite. TODOS los números de la v3.1 están aquí.
 */

// ---------------------------------------------------------------- §9.1 Arco y ballesta
export const BOWS = {
  /** Velocidad del proyectil (casillas/s): flecha 7 (antes 10 → 480 px/s pasa a 336), virote 10 (480 px/s). */
  arrowTilesPerSec: 7,
  boltTilesPerSec: 10,
  /** Disparar no hace ruido; al caer (fallo) hace un ruido pequeño donde impacta (distrae: van a investigar). */
  fireNoise: 0,
  impactNoiseTiles: 1.5,
  /** Si aciertan, este % cae junto al enemigo al morir; si fallan, se quedan siempre en el suelo. */
  recoverOnHitChance: 0.6,
  /** Se recogen al pasar por encima (radio en casillas), sin anillo de saqueo. */
  pickupTiles: 0.9,
  /** Habilidad «Clavar» de la ballesta: el siguiente virote atraviesa a N enemigos. */
  clavarPierce: 2,
  clavarCooldown: 8,
};

// ---------------------------------------------------------------- §9.2 Daño variable y críticos
/**
 * Cada golpe directo (armas, ataques enemigos, explosiones) tira daño en [minFrac, maxFrac] × daño indicado
 * y luego crítico (×critMult) con critChance. Para volver al 45-100 % de Pablo basta poner minFrac 0.45 y maxFrac 1.
 * Sangrado, veneno, quemadura, ácido (charco), la niebla y el agarre del Reptante (daño por segundo) NO tiran.
 */
export const DAMAGE = {
  player: { minFrac: 0.72, maxFrac: 1.04, critChance: 0.25, critMult: 1.5 },
  enemy: { minFrac: 0.72, maxFrac: 1.04, critChance: 0.1, critMult: 1.5 },
  /** Puñalada por la espalda / Ejecutar: daño indicado × backstabMult (STEALTH), siempre crítico. ¿También tira la variación? */
  backstabRolls: false,
  /** Números: normal blanco, crítico amarillo anaranjado 1,35× más grande con «!» y rebote; recibido en rojo. */
  numColor: '#ffffff',
  critColor: '#ffb02e',
  critSize: 1.35,
  hurtColor: '#ff4d4d',
  hurtCritColor: '#ff7a2e',
  /** Crítico recibido: temblor de pantalla extra (duración ms, intensidad). */
  hurtCritShake: [160, 0.012] as [number, number],
};

// ---------------------------------------------------------------- §9.3 Memoria de visión
export const LINGER = {
  /** Lo que sale del cono sigue visible este tiempo (s) y se va apagando. */
  sec: 0.6,
  /** Cada cuánto se guarda una «foto» del polígono de visión (s). */
  sampleSec: 0.12, // v3.2: antes 0.06 (la mitad de fotos; cada una es un polígono más en las 3 máscaras de niebla)
  /** Silueta fantasma (última posición vista, quieta): color y opacidad inicial. */
  ghostTint: 0xb8c4dc,
  ghostAlpha: 0.5,
  /** Giro máximo de la mirada (grados/s), aplicado a TODO cambio de mirada (también apuntado y disparo automático). */
  maxTurnDegPerSec: 540,
};

// ---------------------------------------------------------------- §9.4 El Trapero
export const TRAPERO = {
  /** Aparece en este % de incursiones; oculto hasta que lo ves (como las salidas). */
  chance: 0.5,
  /** Compra materiales saqueados EN ESTA incursión al 70 % de su valor, en vales (solo valen en su tienda). */
  buyRate: 0.7,
  /** Vende 3 objetos (1 unidad de cada uno) con un 20 % de descuento sobre el precio de rep. 1. */
  discount: 0.2,
  stock: [
    { rarity: 'reforzado', gear: true },
    { rarity: 'militar', gear: true },
    { consumable: ['botiquin', 'adrenalina', 'granada', 'antidoto'] },
  ] as ({ rarity: 'reforzado' | 'militar'; gear: true } | { consumable: string[] })[],
  /** Cierra en este minuto o si hay un enemigo en alerta a menos de N casillas. No es zona segura. */
  closeMinute: 10,
  closeAlertTiles: 4,
  /** Distancia (casillas) para comerciar. */
  talkTiles: 1.6,
  /** Tamaño de la caseta (px) y separación mínima a salidas/spawns (casillas). */
  size: 88,
  minDistTiles: 14,
};

// ---------------------------------------------------------------- §9.5 Enemigos de élite
export const ELITE = {
  chance: 0.05,
  exclude: ['abominacion', 'enjambre'] as string[],
  maxAlive: 3,
  maxPerRaid: 6,
  hpMult: 2,
  dmgMult: 2,
  scale: 1.1,
  /** Siempre sueltan 2 objetos; uno de equipo con una rareza más que la tirada normal (tope: la más alta que cae). */
  drops: 2,
};

// ---------------------------------------------------------------- Reputación (corrección de Dott, diseno-v3 §9)
export const REP = {
  /** Vender no da reputación. */
  sellXpPerChapa: 0,
  /** Reputación máxima que da COMPRAR a un vendedor por cada renovación de su tienda (cada VENDORS.restockRaids raids). */
  buyXpCapPerRestock: 150,
  /** Misiones de ese vendedor necesarias (acumuladas) para cada nivel: índice = nivel - 1. Nivel 3 → 1, nivel 4 → 2. */
  missionsForLevel: [0, 0, 1, 2],
};

// ---------------------------------------------------------------- Jugador nuevo de Basu (gengi-art/v3/jugador)
export const PLAYER_ART = {
  /** 'v3' = capucha, gafas de soldador, bufanda naranja y mochila (nuevo). 'v2' = jugador anterior (por si Pablo lo rechaza). */
  version: 'v3' as 'v3' | 'v2',
  /** Bufanda: ondea ±8° a 1,5 ciclos/s, más fuerte al correr (×runBoost a velocidad máxima) y quieta en sigilo. */
  scarfDeg: 8,
  scarfHz: 1.5,
  scarfRunBoost: 1.8,
  /** Suavizado de la amplitud (1/s). */
  scarfEase: 6,
  /** Mochila: 1 px al andar, desfasada con el torso. */
  packBobPx: 1,
  /** Gafas: brillo de 1 fotograma al disparar o hacer crítico. */
  goggleFlashMs: 34,
};
