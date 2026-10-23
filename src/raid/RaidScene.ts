import Phaser from 'phaser';
import {
  EXIT_RADIUS_TILES, LOCKED_CRATE_SEC, LOOT_REACH_TILES, LOOT_RING_SEC,
  PLAYER_MAX_HP, PLAYER_SPEED_TILES, RAID_AUTOSAVE_SEC, TILE, WORLD, COLORS,
  RAID_ZOOM_FACTOR,
} from '../config/constants';
import { DIFFICULTY, scaling } from '../config/difficulty';
import { AIM, JUICE, MAP2, MOVE, PROJECTILE, PRUEBA_V2, STAGGER, STEALTH, SWAP, VISION } from '../config/v2';
import { ABILITIES, AbilityId, ITEMS } from '../data/items';
import { EnemyType, V3_TYPES } from '../data/enemies';
import { ENEMY_V3, MATERIAL_LOOT, MUTATION_IDS, MUTATIONS, NEW_ITEMS, WAVE_V3 } from '../config/v3';
import { rarityAtLeast, RARITIES } from '../data/rarity';
import {
  backpackAdd, backpackSlots, canPocket, loadNoiseTiles, quickSlots, useTimeMult, consume, countOf, def, ItemInst, itemLabel, itemValue, makeItem, slotOf,
  speedMult, totalProtection, totalWeight, weaponStats,
} from '../game/inventory';
import { rollContainer, rollEliteDrops, rollItem, rollLair, rollMaterial, seeded } from '../game/loot';
import { mapDef, SNOW } from '../config/v4';
import { SNOW_ENEMIES } from '../config/v42';
import { AttrId, XP, XP_UI } from '../config/levels';
import { attrK, killXp, xpToNext } from '../game/levels';
import { RARITY_ORDER } from '../data/rarity';
import type { ContainerSnap, ExitState, RaidSnapshot, SaveData, Settings } from '../save/types';
import { AimStick } from './aim';
import { Enemy, EnemyManager, hasDetected, isUnaware, RaidCtx } from './enemies';
import { chooseExits, EXIT_NAMES, ExtractionManager, ExtractionStatus, helipadExit } from './extraction';
const HELI_CARD = 'tarjeta_helipuerto';
/** v4: tintes del «vestido» nevado (paredes, coches, suelos interiores). */
const SNOW_TINT = { wall: 0xdfe9f2, car: 0xcfe0ee, floor: 0xd6e6f2 };
import { FlowField } from './flow';
import { Fx } from './fx';
import { Hud } from './hud';
import { Joystick } from './Joystick';
import { Door, generateMap, lineClear, MapData, pointInWalls, rayHit, Rect, regionAt, setWallIndex, snowAt, WallIndex, zoneAt } from './map';
import { Proj, Projectiles, isPhysical } from './projectiles';
import { BOWS, DAMAGE, ELITE, LINGER, PLAYER_ART, TRAPERO } from '../config/v31';
import { PERF } from '../config/v32';
import { rollDamage } from '../game/damage';
import { Rig } from './rig';
import { Vision } from './vision';
import { genTrapero, traperoRejects, valesFor } from './trapero';

export interface RaidHost {
  persist(): void;
  endRaid(result: 'extraido' | 'muerto', detail: { cause?: string; exit?: ExitState }): void;
  openInventory(): void;
  closeInventory(): void;
  isInventoryOpen(): boolean;
  /** ¿El punto de pantalla está sobre un panel DOM (inventario)? Esos toques nunca llegan al juego. */
  overUi(x: number, y: number): boolean;
  refreshInventory(): void;
  onPauseChange(paused: boolean, reason: 'usuario' | 'segundo-plano' | 'reanudada'): void;
  /** v2: salidas ya vistas en este mapa (persisten entre raids). */
  seenExits(mapId: string): number[];
  markExitSeen(mapId: string, loc: number): void;
  /** v3.1 (Trapero): chapas del refugio y gastarlas (se guarda con la incursión). */
  bankChapas(): number;
  spendBankChapas(n: number): boolean;
  /** v4.0: guardado (nivel y atributos, que se aplican al momento) y abrir el panel de atributos. */
  saveData?(): SaveData;
  openAttributes?(): void;
}

export interface RaidInit { snap: RaidSnapshot; settings: Settings; fresh: boolean; host: RaidHost; debug: boolean }

interface ContainerObj { snap: ContainerSnap; sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Ellipse; lock?: Phaser.GameObjects.Text; glow?: Phaser.GameObjects.Arc }
interface DoorObj { d: Door; img: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle; body: Phaser.GameObjects.Zone; open: boolean; locked?: boolean }

/** Escena de UI sin zoom, encima del mundo. */
export class RaidUIScene extends Phaser.Scene {
  constructor() { super('RaidUI'); }
  create(data: { ready: (s: Phaser.Scene) => void }) { data.ready(this); }
}

/** ¿Sin vibración (iOS Safari)? Entonces se usa la contrapartida visual: más retroceso y sacudida. */
export const NO_VIBRATE = typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function';
function vibrate(ms: number | number[]) { try { if (!NO_VIBRATE) navigator.vibrate(ms); } catch { /* sin vibración */ } }

export function newRaidSnapshot(seed: number, loadout: RaidSnapshot['loadout'], valueIn: number): RaidSnapshot {
  const map = generateMap(seed);
  const exits = chooseExits(seeded(seed ^ 0x5bd1e995), map);
  const heli = helipadExit(map); if (heli) exits.push(heli);
  const sp = map.spawns[Math.floor(seeded(seed ^ 0x2545f491)() * map.spawns.length)] ?? map.spawn;
  return {
    id: 'raid-' + Date.now().toString(36), seed, startedAt: new Date().toISOString(), elapsed: 0, valueIn, kills: 0,
    player: { x: sp.x, y: sp.y, hp: PLAYER_MAX_HP, healLeft: 0, healRate: 0, aguantar: 0, cds: {}, reload: 0 },
    loadout, enemies: [], containers: [], exits, acid: [], spawnTimer: 0, hordeCd: 0, saves: 0,
    mapId: map.id, doorsOpen: [], arrows: [],
  };
}

export class RaidScene extends Phaser.Scene implements RaidCtx {
  snap!: RaidSnapshot;
  settings!: Settings;
  host!: RaidHost;
  fresh = false;
  debug = false;
  map!: MapData;
  /** v4: definición del mapa (dificultad, rarezas, XP). */
  get mapDef() { return mapDef(this.map?.defId); }
  /** Paredes que bloquean AHORA (fijas + puertas cerradas). Se sustituye al abrir una puerta. */
  walls: Rect[] = [];
  wallsVersion = 0;
  wallIndex!: WallIndex;
  flow!: FlowField;
  fx!: Fx;
  vision: Vision | null = null;
  proj!: Projectiles;
  player!: Phaser.Physics.Arcade.Image;
  rig!: Rig;
  playerRadius = 18;
  enemies!: EnemyManager;
  extraction!: ExtractionManager;
  hud: Hud | null = null;
  joy: Joystick | null = null;
  aim: AimStick | null = null;
  ui: Phaser.Scene | null = null;
  keys: Record<string, Phaser.Input.Keyboard.Key> | null = null;
  containers: ContainerObj[] = [];
  doors: DoorObj[] = [];
  acidGfx: Phaser.GameObjects.Graphics | null = null;
  scanGfx: Phaser.GameObjects.Graphics | null = null;
  reloadGfx: Phaser.GameObjects.Graphics | null = null;
  aimGfx: Phaser.GameObjects.Graphics | null = null;
  paused = false;
  ended = false;
  god = false;
  /** Mirada actual (rad) y velocidad real (inercia). */
  facing = -Math.PI / 2;
  vel = new Phaser.Math.Vector2();
  /** Cambio de arma en curso (s restantes): no se ataca. */
  swapT = 0;
  /** QA / diagnóstico v2. */
  stats = { shots: 0, swaps: 0, attacksDuringSwap: 0, behindWarn: 0, behindVibes: 0, hitStops: 0, crits: 0, critsTaken: 0, doorsOpened: 0, arrowsRecovered: 0, impactNoises: 0, clavarShots: 0, lootPaused: 0, iosKick: 0, backstabs: 0, executes: 0, debrisSteps: 0, autoSkippedUnaware: 0 };
  private attackT = 0;
  private autosaveT = 0;
  private idleT = 0;
  private scanT = 0;
  private loot: { c: ContainerObj | null; t: number; done: Set<number>; ring: Phaser.GameObjects.Graphics | null; pause: number } = { c: null, t: 0, done: new Set(), ring: null, pause: 0 };
  private noAmmoWarned = false;
  private warned13 = false;
  private nextContainerId = 1;
  private lastMove = new Phaser.Math.Vector2();
  /** v3.2: fps reales por ventanas de 0,5 s y mínimo entre los minutos PERF.fpsMinFrom y fpsMinTo (QA y contador). */
  fpsNow = 0;
  fpsMin1215 = Infinity;
  private fpsFrames = 0;
  private fpsWin = 0;
  private fpsWarm = 0;
  private abilityIds: (AbilityId | null)[] = [null, null, null];
  private glanceT = 0;
  // ---- prueba v2: estados e indicadores junto al jugador ----
  private acidStackT = 0;
  private statusAcc = { bleed: 0, poison: 0 };
  private statusTickT = 0;
  hitTimes: number[] = [];
  miniHpUntil = -1;
  private markG: Phaser.GameObjects.Graphics | null = null;
  private markImgs = new Map<string, Phaser.GameObjects.Image>();
  private markTxt = new Map<string, Phaser.GameObjects.Text>();
  /** QA: daño de estados aplicado. */
  statusDealt = { bleed: 0, poison: 0 };
  // ---- sigilo ----
  /** Paso actual según el joystick (sigilo / andar / correr) y ruido que hace ahora (casillas). */
  moveTier: 'quieto' | 'sigilo' | 'andar' | 'correr' = 'quieto';
  noiseTiles = 0;
  private stepT = 0;
  private noiseRing: Phaser.GameObjects.Image | null = null;
  private ringR = 0;
  private conesGfx: Phaser.GameObjects.Graphics | null = null;
  /** Cristales y latas del suelo (5 casillas de ruido al pisarlos). */
  debris: { x: number; y: number; img: Phaser.GameObjects.Image; cd: number }[] = [];
  /** Enemigo desprevenido a tu alcance y de espaldas: el botón de cambio pasa a "Ejecutar". */
  execTarget: Enemy | null = null;
  private glanceBase = 0;
  private steadyT = 0;
  private steadyRef = 0;
  private fireLatch = false;
  private hitStopT = 0;
  private behindT = 0;
  private exitCheckT = 0;
  private visT = 0;
  private seen = new Set<number>();
  /** Flechas/virotes clavados en un enemigo (caen junto a él al morir). */
  private stuck = new Map<Enemy, Record<string, number>>();
  /** «Clavar»: el siguiente virote atraviesa. */
  private clavarArmed = false;
  /** Dirección del cono de visión (sigue a `facing` con el giro limitado). */
  viewFacing = -Math.PI / 2;
  /** QA v3.2: flechas del suelo retiradas por el tope. */
  arrowsCulled = 0;
  private groundArrows: { x: number; y: number; qty: number; def: string; img: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Arc | null }[] = [];
  private kick = new Phaser.Math.Vector2();
  private behind: { ang: number; k: number }[] = [];
  private pendingMelee: { t: number; e: Enemy; dmg: number; crit: boolean; weapon: string; range: number; heavy: boolean }[] = [];
  // ---- v3 ----
  /** Alcantarillas del Reptante (fijas por mapa). */
  sewers: { x: number; y: number }[] = [];
  private sewerImgs: { img: Phaser.GameObjects.Image; r: Rect }[] = [];
  /** Granadas en el aire / con la mecha encendida. */
  private grenades: { x: number; y: number; t: number; warn: Phaser.GameObjects.Graphics; img: Phaser.GameObjects.Text }[] = [];
  private estimGfx: Phaser.GameObjects.Graphics | null = null;
  private warnedMut = false;
  /** Radio nivel 3: zona de élite con el mejor objeto (punto en el minimapa). */
  private radioDot: { x: number; y: number } | null = null;
  /** QA v3. */
  v3s = { mats: 0, trunks: 0, muestras: 0, grenades: 0, grenadeHits: 0, mutated: 0, screamsSpawned: 0 };
  v31s = { eliteKills: 0, eliteDrops: 0, traperoSold: 0, traperoBought: 0 };
  /** v4.2: diagnóstico de la Zona Helada (QA). */
  v42s = { packs: 0, bossKills: 0, spawned: { congelado: 0, lobo: 0, escarcha: 0, matriarca: 0 } };

  constructor() { super('Raid'); }

  init(d: RaidInit) {
    this.snap = d.snap; this.settings = d.settings; this.host = d.host; this.fresh = d.fresh; this.debug = d.debug;
    this.paused = false; this.ended = false; this.containers = []; this.doors = []; this.hud = null; this.joy = null; this.aim = null;
    this.loot = { c: null, t: 0, done: new Set(), ring: null, pause: 0 };
    this.warned13 = d.snap.elapsed >= DIFFICULTY.fogWarningSeconds;
    this.attackT = 0; this.autosaveT = 0; this.idleT = 0; this.scanT = 0; this.god = false; this.markG = null; this.markImgs = new Map(); this.markTxt = new Map(); this.hitTimes = []; this.miniHpUntil = -1; this.acidStackT = 0; this.statusAcc = { bleed: 0, poison: 0 }; this.statusDealt = { bleed: 0, poison: 0 }; this.applying = null; this.healStats = { done: 0, cancelHit: 0, cancelRelease: 0 }; this.noiseRing = null; this.conesGfx = null; this.debris = []; this.execTarget = null; this.ringR = 0; this.stepT = 0; this.noAmmoWarned = false; this.fpsMin1215 = Infinity; this.fpsFrames = 0; this.fpsWin = 0; this.fpsWarm = 0; this.fpsNow = 0; this.peekTxt = new Map(); this.lvlWarned = 0; this.chill = { k: 0, t: 0 }; this.chillTinted = false;
    this.swapT = 0; this.glanceT = 0; this.steadyT = 0; this.hitStopT = 0; this.vel.set(0, 0); this.kick.set(0, 0);
    this.stuck = new Map(); this.clavarArmed = false; this.groundArrows = []; this.arrowsCulled = 0; this.pendingMelee = []; this.behind = [];
    this.sewers = []; this.sewerImgs = []; this.grenades = []; this.estimGfx = null; this.radioDot = null;
    this.warnedMut = d.snap.elapsed >= MUTATIONS.fromMinute * 60;
    this.v3s = { mats: 0, trunks: 0, muestras: 0, grenades: 0, grenadeHits: 0, mutated: 0, screamsSpawned: 0 };
    this.v31s = { eliteKills: 0, eliteDrops: 0, traperoSold: 0, traperoBought: 0 };
    this.v42s = { packs: 0, bossKills: 0, spawned: { congelado: 0, lobo: 0, escarcha: 0, matriarca: 0 } };
    this.stats = { shots: 0, swaps: 0, attacksDuringSwap: 0, behindWarn: 0, behindVibes: 0, hitStops: 0, crits: 0, critsTaken: 0, doorsOpened: 0, arrowsRecovered: 0, impactNoises: 0, clavarShots: 0, lootPaused: 0, iosKick: 0, backstabs: 0, executes: 0, debrisSteps: 0, autoSkippedUnaware: 0 };
  }

  // ---------- RaidCtx ----------
  get world(): Phaser.Scene { return this; }
  px() { return this.player.x; }
  py() { return this.player.y; }
  pvx() { return (this.player.body as Phaser.Physics.Arcade.Body).velocity.x; }
  pvy() { return (this.player.body as Phaser.Physics.Arcade.Body).velocity.y; }
  elapsed() { return this.snap.elapsed; }
  minute() { return this.snap.elapsed / 60; }
  playerMelee() { return weaponStats(this.snap.loadout.arma).melee; }
  pfacing() { return this.facing; }
  vibrate(ms: number) { vibrate(ms); }
  // ---------- v4.2 Zona Helada ----------
  /** Ralentización por frío (Escarcha, aliento y charcos de la Matriarca): se queda la más fuerte mientras dure. */
  chill = { k: 0, t: 0 };
  slowPlayer(k: number, sec: number) {
    if (this.god && !this.chillInGod) return;
    if (k >= this.chill.k || this.chill.t <= 0) this.chill.k = k;
    this.chill.t = Math.max(this.chill.t, sec);
  }
  /** QA: aplicar la ralentización también en modo dios. */
  chillInGod = false;
  private chillTinted = false;
  summon(type: EnemyType, x: number, y: number) { return this.enemies.list.length < DIFFICULTY.maxAlive + 12 ? this.spawnAt(type, x, y, undefined, false) : null; }
  toast(msg: string, sec = 2) { this.hud?.toast(msg, sec); }
  /** Chillón: atrae a todo en 12 casillas, horda cercana y +60 % de aparición en la zona 2 min. */
  onScream(e: Enemy) {
    const C = ENEMY_V3.chillon, s = this.snap;
    for (const o of this.enemies.list) if (o !== e && !o.dead && o.def.type !== 'reptante' && Math.hypot(o.x - e.x, o.y - e.y) <= C.screamTiles * TILE) {
      if (isUnaware(o)) { o.state = 'investigate'; o.goal = { x: this.player.x, y: this.player.y, until: s.elapsed + 15 }; o.susPhase = 'go'; }
    }
    (s.screams ??= []).push({ x: e.x, y: e.y, until: s.elapsed + C.localSec });
    const p = this.offscreenPoint(10, 16, e.x, e.y);
    if (p && this.enemies.list.length < DIFFICULTY.maxAlive) {
      const n = Math.min(DIFFICULTY.maxAlive - this.enemies.list.length, C.hordeMin + Math.floor(Math.random() * (C.hordeMax - C.hordeMin + 1)));
      for (let i = 0; i < n; i++) { const o = this.spawnAt(Math.random() < 0.3 ? 'corredor' : 'errante', p.x + (Math.random() - 0.5) * TILE * 3, p.y + (Math.random() - 0.5) * TILE * 3); o.state = 'investigate'; o.goal = { x: e.x, y: e.y, until: s.elapsed + 20 }; o.susPhase = 'go'; this.v3s.screamsSpawned++; }
    }
    this.hud?.toast('¡Un Chillón ha gritado! Todo viene hacia aquí', 2.5);
    vibrate([60, 40, 60]);
  }
  onGrab(on: boolean) {
    if (on) { this.hud?.toast('¡Te ha agarrado! Mueve el joystick de lado a lado', 1.8); this.cancelApply('golpe'); vibrate(120); }
    this.snap.fx = { ...(this.snap.fx ?? {}), grabImm: this.enemies.v3.grabImm };
  }
  /** Multiplicador de aparición por gritos de Chillón activos cerca del jugador. */
  private localSpawnMult() {
    const s = this.snap, C = ENEMY_V3.chillon;
    if (!s.screams?.length) return 1;
    s.screams = s.screams.filter(k => k.until > s.elapsed);
    return s.screams.some(k => Math.hypot(k.x - this.player.x, k.y - this.player.y) < C.screamTiles * TILE * 2) ? C.localSpawnMult : 1;
  }
  /** ¿Lo ve el jugador? (cono de 220° + línea de visión; en la niebla = no visible). */
  visible(x: number, y: number, pad = 0) { return this.vision ? this.vision.sees(x, y, pad) : true; }

  create() {
    this.map = generateMap(this.snap.seed);
    const s = this.snap;
    // Guardado de la v1 (otro mapa): se repuebla en el mapa nuevo conservando equipo, vida y tiempo.
    const legacy = !this.fresh && (s.repopulate || s.mapId !== this.map.id);
    if (legacy) this.repopulateLegacy();
    s.mapId = this.map.id;
    s.doorsOpen ??= []; s.arrows ??= [];
    this.physics.world.setBounds(0, 0, WORLD, WORLD);
    this.fx = new Fx(this);
    this.flow = new FlowField();
    this.wallIndex = new WallIndex([]);
    this.drawWorld();

    const wallGroup = this.physics.add.staticGroup();
    for (const r of this.map.walls) wallGroup.add(this.add.zone(r.x + r.w / 2, r.y + r.h / 2, r.w, r.h));
    const doorGroup = this.physics.add.staticGroup();
    const locked = new Set(this.map.lockedDoors);
    for (const d of this.map.doors) {
      const open = !locked.has(d.id) && s.doorsOpen!.includes(d.id);
      const body = this.add.zone(d.x + d.w / 2, d.y + d.h / 2, d.w, d.h);
      doorGroup.add(body);
      body.setData('door', d.id);
      const img = this.textures.exists('puerta')
        ? this.add.image(d.horiz ? d.x : d.x + d.w / 2, d.horiz ? d.y + d.h / 2 : d.y, 'puerta').setOrigin(0, 0.5).setDisplaySize(d.horiz ? d.w : d.h, TILE * 0.42).setRotation(d.horiz ? 0 : Math.PI / 2).setDepth(6)
        : this.add.rectangle(d.x, d.y, d.w, d.h, COLORS.oxido).setOrigin(0).setDepth(6);
      const o: DoorObj = { d, img, body, open: false };
      // v4: puerta cerrada con candado (según la variación del mapa) = pared; no se abre
      if (locked.has(d.id)) { o.locked = true; img.setAlpha(0.9); if (this.textures.exists('v4/candado')) this.add.image(d.x + d.w / 2, d.y + d.h / 2, 'v4/candado').setDisplaySize(TILE * 0.6, TILE * 0.6).setDepth(6.7); }
      this.doors.push(o);
      if (open) this.openDoor(o, false, true);
    }
    this.rebuildWalls();

    const p = s.player;
    this.player = this.physics.add.image(p.x, p.y, 'player').setDepth(10).setVisible(false);
    this.player.setDisplaySize(44, 44);
    const tw = this.player.width;
    const pr = tw * 0.3;
    (this.player.body as Phaser.Physics.Arcade.Body).setCircle(pr, tw / 2 - pr, tw / 2 - pr).setCollideWorldBounds(true);
    this.playerRadius = 44 * 0.3;
    this.rig = new Rig(this, p.x, p.y, { base: PLAYER_ART.version === 'v3' && this.textures.exists('jugador3_torso') ? 'jugador3' : 'jugador', size: 44, depth: 10, weapon: s.loadout.arma?.def ?? null, v1Size: 44 });
    this.physics.add.collider(this.player, wallGroup);
    const doorHit = (_a: unknown, z: unknown) => { const id = (z as Phaser.GameObjects.Zone).getData('door') as number; const o = this.doors.find(x => x.d.id === id); if (o && !o.open && !o.locked) this.openDoor(o, _a === this.player); };
    this.physics.add.collider(this.player, doorGroup, doorHit as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback);

    this.enemies = new EnemyManager(this);
    this.physics.add.collider(this.enemies.group, wallGroup);
    this.physics.add.collider(this.enemies.group, doorGroup, doorHit as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback);
    this.physics.add.collider(this.enemies.group, this.enemies.group);

    this.proj = new Projectiles(this, {
      walls: () => this.walls, enemies: () => this.enemies.list,
      onHit: (pj, e) => this.onProjHit(pj, e),
      // v3.1 §9.1: el fallo se queda SIEMPRE en el suelo y hace un ruido pequeño donde cae (distrae)
      onLand: (pj, x, y) => { this.dropArrow(x, y, 1, pj.kind === 'virote' ? 'virotes' : 'flechas'); if (BOWS.impactNoiseTiles > 0) { this.noise(x, y, BOWS.impactNoiseTiles); this.stats.impactNoises++; } },
      onWall: (pj, x, y) => { if (pj.kind === 'bala') this.fx.impact(x, y); },
    });

    this.setupSewers();
    if (this.fresh || legacy) this.populate(); else this.enemies.restore(s.enemies);
    s.fx ??= {}; s.track ??= { heals: 0, dmgTaken: 0, kills: {} };
    this.enemies.v3.grabImm = s.fx.grabImm ?? 0;
    for (const c of s.containers) this.addContainerObj(c);
    this.nextContainerId = Math.max(0, ...s.containers.map(c => c.id)) + 1;
    for (const a of s.arrows!) this.addGroundArrow(a.x, a.y, a.qty, false, a.def ?? 'flechas');
    this.setupStealth();
    this.setupTrapero();

    // v4: el helipuerto (índice 3) cambia de sitio según la franja nevada → no se guarda como «vista»
    for (const i of this.host.seenExits(this.map.id)) if (i < 3) this.seen.add(i);
    this.applyRadio();
    this.extraction = new ExtractionManager(s.exits, this.map, {
      scene: this, px: () => this.player.x, py: () => this.player.y, elapsed: () => s.elapsed,
      noise: (x, y, r) => this.noise(x, y, r),
      hasFlare: () => countOf(this.snap.loadout.mochila, 'bengala') + this.pocketCount('bengala') > 0,
      useFlare: () => this.useFlare(),
      hasCard: () => this.hasItem(HELI_CARD),
      useCard: () => { const lo = this.snap.loadout; if (consume(lo.mochila, HELI_CARD, 1) > 0 || this.pocketTake(HELI_CARD)) { this.host.refreshInventory(); return true; } return false; },
      payCandidate: () => { const it = this.payItem(); return it ? `${itemLabel(it)} (${RARITIES[it.rarity].nombre})` : null; },
      pay: () => this.pay(),
      onExtract: (e) => this.finish('extraido', { exit: e }),
      toast: (m) => this.hud?.toast(m),
      shown: (loc) => this.seen.has(loc) || this.exitVisibleNow(loc),
    });

    this.acidGfx = this.add.graphics().setDepth(3);
    this.scanGfx = this.add.graphics().setDepth(25);
    this.reloadGfx = this.add.graphics().setDepth(26);
    this.aimGfx = this.add.graphics().setDepth(13);

    const cam = this.cameras.main;
    // margen fuera del mapa para que el jugador quede siempre centrado y por encima de los botones
    const pad = 120;
    cam.setBounds(-pad, -pad, WORLD + pad * 2, WORLD + pad * 2).startFollow(this.player, true, 0.15, 0.15);
    cam.setBackgroundColor('#0d0e10');
    this.applyZoom();
    this.scale.on('resize', this.onResize, this);
    this.vision = new Vision(this, () => this.walls, () => this.wallIndex);
    this.facing = -Math.PI / 2; this.viewFacing = this.facing;
    this.vision.update(this.player.x, this.player.y, this.facing, this.wallsVersion, this.snap.elapsed);

    this.scene.launch('RaidUI', { ready: (ui: Phaser.Scene) => this.buildUi(ui) });

    // Guardado instantáneo y pausa al pasar a segundo plano (llamada, cambio de app, bloqueo, cierre)
    const onHide = () => { if (document.visibilityState === 'hidden') this.background(); };
    const onPageHide = () => this.background();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('freeze', onPageHide);
    window.addEventListener('beforeunload', onPageHide);
    this.events.once('shutdown', () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('freeze', onPageHide);
      window.removeEventListener('beforeunload', onPageHide);
      this.scale.off('resize', this.onResize, this);
      setWallIndex(null);
      this.vision?.destroy(); this.vision = null;
      this.scene.stop('RaidUI');
    });

    if (!this.fresh) this.setPaused(true, 'reanudada');
    else this.persist();
  }

  /** Raid guardada con el mapa de la v1: misma vida, equipo y tiempo; mundo nuevo (enemigos, botín, salidas). */
  private repopulateLegacy() {
    const s = this.snap;
    const sp = this.map.spawns[1] ?? this.map.spawn;
    s.player.x = sp.x; s.player.y = sp.y;
    s.enemies = []; s.containers = []; s.acid = []; s.doorsOpen = []; s.arrows = [];
    s.exits = chooseExits(seeded(s.seed ^ 0x5bd1e995), this.map);
    const heli = helipadExit(this.map); if (heli) s.exits.push(heli);
    s.repopulate = false;
  }

  private buildUi(ui: Phaser.Scene) {
    this.ui = ui;
    const hud = this.hud = new Hud(ui);
    const overUi = (pt: Phaser.Input.Pointer) => {
      const ev = pt.event as Event | undefined;
      const cv = this.game.canvas;
      // el toque empezó fuera del canvas (sobre el DOM) o cae dentro del panel abierto
      if (ev && ev.target && ev.target !== cv) return true;
      const r = cv.getBoundingClientRect();
      return this.host.overUi(r.left + pt.x * (r.width / this.scale.width), r.top + pt.y * (r.height / this.scale.height));
    };
    this.joy = new Joystick(ui, (x, y, pt) => hud.hitTest(x, y) || this.paused || (!!pt && overUi(pt)));
    // Joystick de apuntar: solo nace de toques que NO caen en botones/HUD (ni en el minimapa de arriba)
    this.aim = new AimStick(ui, (x, y, pt) => hud.hitTest(x, y) || this.paused || this.ended || y < hud.miniRect.y + hud.miniRect.s + 8 || (!!pt && overUi(pt)));
    this.aim.place(hud.aimRest.x, hud.aimRest.y);
    ui.input.on('pointerdown', (pt: Phaser.Input.Pointer) => { if (!this.paused && !this.ended && !overUi(pt)) { this.tapPointer = pt.id; hud.handleTap(pt.x, pt.y); this.tapPointer = null; } });
    // curación con el botón rápido: hay que mantenerlo; soltar antes de terminar cancela sin gastar
    const release = (pt: Phaser.Input.Pointer) => { const a = this.applying; if (a?.hold && (a.pointerId === null || a.pointerId === pt.id)) this.cancelApply('soltar'); };
    ui.input.on('pointerup', release); ui.input.on('pointerupoutside', release);
    ui.input.keyboard!.on('keyup-Q', () => { if (this.applying?.hold && this.applying.pointerId === null) this.cancelApply('soltar'); });
    this.keys = ui.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,ONE,TWO,THREE,Q,I,P,R') as Record<string, Phaser.Input.Keyboard.Key>;
    ui.input.keyboard!.on('keydown-P', () => this.setPaused(!this.paused, 'usuario'));
    ui.input.keyboard!.on('keydown-I', () => this.toggleInventory());
    ui.input.keyboard!.on('keydown-ONE', () => this.useAbility(0));
    ui.input.keyboard!.on('keydown-TWO', () => this.useAbility(1));
    ui.input.keyboard!.on('keydown-THREE', () => this.useAbility(2));
    ui.input.keyboard!.on('keydown-Q', () => this.useQuick());
    ui.input.keyboard!.on('keydown-R', () => this.swapWeapon());
    hud.abilities.forEach((b, i) => b.onTap = () => this.useAbility(i));
    hud.quick.onTap = () => this.useQuick();
    hud.quick2.onTap = () => this.useQuick(2);
    hud.quick2.setShown(false);
    hud.swap.onTap = () => { if (this.execTarget) this.execute(); else this.swapWeapon(); };
    hud.pauseBtn.onTap = () => this.setPaused(true, 'usuario');
    hud.bagBtn.onTap = () => this.toggleInventory();
    hud.lvlBtn.onTap = () => this.host.openAttributes?.();
    hud.pauseBtn.label.setText('');
    const pg = ui.add.graphics().setScrollFactor(0).setDepth(2005);
    const drawPause = () => { pg.clear().fillStyle(0xe8e2d0, 1); const b = hud.pauseBtn.bg; pg.fillRect(b.x - 7, b.y - 8, 5, 16).fillRect(b.x + 2, b.y - 8, 5, 16); };
    drawPause();
    hud.fps.setVisible(this.debug || PERF.showFps);
    const relayout = () => { drawPause(); this.aim?.place(hud.aimRest.x, hud.aimRest.y); };
    this.scale.on('resize', relayout);
    this.events.once('shutdown', () => this.scale.off('resize', relayout));
    if (this.fresh) hud.toast(this.exitsAnnouncement() + this.radioNews.map(n => '\n' + n).join(''), 4.5 + this.radioNews.length * 1.5);
  }

  /** "Salidas activas: Túnel norte (A pie) y Muelle del almacén (Generador)". */
  exitsAnnouncement() {
    const n = this.snap.exits.map(e => `${this.extraction.locName(e.loc)} (${EXIT_NAMES[e.type]})`);
    return `Salidas activas: ${n.join(' y ')}`;
  }

  private onResize() { this.applyZoom(); this.hud?.layout(); }
  private applyZoom() {
    const m = Math.min(this.scale.width, this.scale.height);
    // Diseño (Cámara y avisos): zoom 1,4× respecto a la v0 (~7 casillas de ancho en vertical) para que jugador y avisos se lean en el móvil
    const z = Phaser.Math.Clamp((m / 480) * RAID_ZOOM_FACTOR, 1.1, 2);
    this.cameras.main.setZoom(z);
    // el jugador queda ~60 px de pantalla por encima del centro (los botones están abajo)
    this.cameras.main.setFollowOffset(0, -60 / z);
  }

  // ---------- Mundo ----------
  /** Objetos de mundo grandes que se ocultan fuera de cámara (rendimiento en móvil). */
  private cullables: { o: Phaser.GameObjects.Components.Visible & Phaser.GameObjects.GameObject; r: Rect }[] = [];

  private drawWorld() {
    const T = TILE;
    // suelo: asfalto en mosaico (una sola pieza) + grietas por trozos (se ocultan fuera de cámara)
    if (this.textures.exists('suelo_asfalto')) this.add.tileSprite(0, 0, WORLD, WORLD, 'suelo_asfalto').setOrigin(0).setTileScale(0.75).setDepth(0);
    else this.add.rectangle(0, 0, WORLD, WORLD, COLORS.suelo[0]).setOrigin(0).setDepth(0);
    const rng = seeded(MAP2.layoutSeed + 7);
    const CH = 8, cw = WORLD / CH;
    const crackCols = [COLORS.contorno, COLORS.suelo[2], COLORS.oxido];
    for (let cy = 0; cy < CH; cy++) for (let cx = 0; cx < CH; cx++) {
      const g = this.add.graphics().setDepth(0.5);
      for (let i = 0; i < 26; i++) {
        let x = (cx + rng()) * cw, y = (cy + rng()) * cw;
        let a = rng() * Math.PI * 2;
        g.lineStyle(1 + rng() * 2, crackCols[Math.floor(rng() * 3)], 0.22 + rng() * 0.12);
        g.beginPath().moveTo(x, y);
        const segs = 3 + Math.floor(rng() * 4);
        for (let s = 0; s < segs; s++) { a += (rng() - 0.5) * 1.2; const l = 8 + rng() * 22; x += Math.cos(a) * l; y += Math.sin(a) * l; g.lineTo(x, y); }
        g.strokePath();
      }
      for (let i = 0; i < 30; i++) {
        const x = (cx + rng()) * cw, y = (cy + rng()) * cw, s = 2 + rng() * 6;
        g.fillStyle(rng() < 0.65 ? COLORS.suelo[1] : COLORS.oxido, 0.3 + rng() * 0.2).fillRect(x, y, s * (0.6 + rng()), s * (0.5 + rng() * 0.8));
      }
      this.cullables.push({ o: g, r: { x: cx * cw - 40, y: cy * cw - 40, w: cw + 80, h: cw + 80 } });
    }
    const border = this.add.graphics().setDepth(6);
    border.lineStyle(10, COLORS.contorno, 1).strokeRect(0, 0, WORLD, WORLD);
    this.drawSnow();
    // suelos interiores (baldosa) y tinte por zona (alto = riesgo alto)
    for (const f of this.map.floors) {
      const o = this.textures.exists('suelo_baldosa') ? this.add.tileSprite(f.x, f.y, f.w, f.h, 'suelo_baldosa').setOrigin(0).setTileScale(0.5).setDepth(1)
        : this.add.rectangle(f.x, f.y, f.w, f.h, COLORS.suelo[2], 0.7).setOrigin(0).setDepth(1);
      if (this.snowy(f.x + f.w / 2, f.y + f.h / 2) && o instanceof Phaser.GameObjects.TileSprite) o.setTint(SNOW_TINT.floor);
      this.cullables.push({ o, r: f });
    }
    const zg = this.add.graphics().setDepth(1.2);
    for (const z of this.map.zones) {
      if (z.kind !== 'alto') continue;
      zg.fillStyle(COLORS.mutacion, 0.07).fillRect(z.rect.x, z.rect.y, z.rect.w, z.rect.h);
      zg.lineStyle(3, COLORS.mutacion, 0.3).strokeRect(z.rect.x - 4, z.rect.y - 4, z.rect.w + 8, z.rect.h + 8);
      this.add.text(z.rect.x + z.rect.w / 2, z.rect.y - 10, this.zoneName(z).toUpperCase(), { fontFamily: 'sans-serif', fontStyle: 'bold', fontSize: '16px', color: '#ff3cc8', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5, 1).setDepth(6.5).setAlpha(0.85);
    }
    for (const z of this.map.zones) {
      if (z.kind !== 'tienda' && z.kind !== 'casa') continue;
      if (z.name === 'Casa') continue;
      this.add.text(z.rect.x + z.rect.w / 2, z.rect.y - 10, this.zoneName(z).toUpperCase(), { fontFamily: 'sans-serif', fontStyle: 'bold', fontSize: '14px', color: '#e8e2d0', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5, 1).setDepth(6.5).setAlpha(0.7);
    }
    // paredes (muro en mosaico + contorno) y coches
    const carSet = new Set(this.map.cars.map(c => `${c.x},${c.y}`));
    const outline = this.add.graphics().setDepth(6.2);
    for (const r of this.map.walls) {
      if (carSet.has(`${r.x},${r.y}`)) continue;
      const o = this.textures.exists('muro') ? this.add.tileSprite(r.x, r.y, r.w, r.h, 'muro').setOrigin(0).setTileScale(0.5).setDepth(6)
        : this.add.rectangle(r.x, r.y, r.w, r.h, COLORS.suelo[1]).setOrigin(0).setDepth(6);
      if (this.snowy(r.x + r.w / 2, r.y + r.h / 2) && o instanceof Phaser.GameObjects.TileSprite) o.setTint(SNOW_TINT.wall);
      this.cullables.push({ o, r });
      outline.lineStyle(3, COLORS.contorno, 1).strokeRect(r.x, r.y, r.w, r.h);
    }
    for (const c of this.map.cars) {
      const horiz = c.w > c.h;
      const o = this.textures.exists('coche') ? this.add.image(c.x + c.w / 2, c.y + c.h / 2, 'coche').setDisplaySize(horiz ? c.h : c.w, horiz ? c.w : c.h).setRotation(c.rot).setDepth(6)
        : this.add.rectangle(c.x, c.y, c.w, c.h, COLORS.oxido).setOrigin(0).setDepth(6);
      if (this.snowy(c.x + c.w / 2, c.y + c.h / 2) && o instanceof Phaser.GameObjects.Image) o.setTint(SNOW_TINT.car);
      this.cullables.push({ o, r: c });
    }
    // carteles de evacuación (la flecha del arte apunta a la derecha)
    for (const sg of this.map.signs) {
      if (this.textures.exists('cartel_evacuacion')) this.add.image(sg.x, sg.y, 'cartel_evacuacion').setDisplaySize(T * 0.9, T * 0.9).setRotation(sg.ang).setDepth(6.6);
      this.add.text(sg.x, sg.y + T * 0.55, this.map.exitLocNames[sg.exit] ?? 'Salida', { fontFamily: 'sans-serif', fontStyle: 'bold', fontSize: '11px', color: '#4cd964', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5, 0).setDepth(6.6);
    }
  }

  /** v4: ¿punto dentro de la Zona Helada (pasada la frontera)? */
  snowy(x: number, y: number) { return snowAt(this.map, x, y) > 0.5; }
  /** v4: nombre visible de una zona (en la nieve, el «nevado»: Cabañas, Radar militar…). */
  zoneName(z: { name: string; rect: Rect }) { return this.snowy(z.rect.x + z.rect.w / 2, z.rect.y + z.rect.h / 2) ? SNOW.snowNames[z.name] ?? z.name : z.name; }

  /** v4 §4: suelo nevado sobre la franja de esta incursión; la frontera (SNOW.edgeTiles) se difumina en 3 bandas. */
  private drawSnow() {
    const sn = this.map.snow; if (!sn || !this.textures.exists('v4/suelo_nieve')) return;
    const g = this.map.regions.find(r => r.id === sn.region)!;
    const E = SNOW.edgeTiles * TILE, B = 3, bw = E / B;
    const foreign = (x: number, y: number) => { const r = regionAt(this.map, x, y); return !!r && r !== g; };
    const tile = (x: number, y: number, w: number, h: number, a: number) => {
      if (w <= 0 || h <= 0) return;
      const o = this.add.tileSprite(x, y, w, h, 'v4/suelo_nieve').setOrigin(0).setTileScale(0.75).setTilePosition(x / 0.75, y / 0.75).setDepth(0.6).setAlpha(a);
      this.cullables.push({ o, r: { x, y, w, h } });
    };
    for (const r of g.rects) {
      // lados que tocan otra franja (no el borde del mapa ni otro rectángulo de la misma franja)
      const L = foreign(r.x - 4, r.y + r.h / 2), R = foreign(r.x + r.w + 4, r.y + r.h / 2);
      const U = foreign(r.x + r.w / 2, r.y - 4), D = foreign(r.x + r.w / 2, r.y + r.h + 4);
      const x0 = r.x + (L ? E : 0), x1 = r.x + r.w - (R ? E : 0), y0 = r.y + (U ? E : 0), y1 = r.y + r.h - (D ? E : 0);
      tile(x0, y0, x1 - x0, y1 - y0, 1);
      for (let k = 0; k < B; k++) {
        const a = (k + 0.5) / B;
        if (L) tile(r.x + k * bw, y0, bw, y1 - y0, a);
        if (R) tile(r.x + r.w - (k + 1) * bw, y0, bw, y1 - y0, a);
        if (U) tile(x0, r.y + k * bw, x1 - x0, bw, a);
        if (D) tile(x0, r.y + r.h - (k + 1) * bw, x1 - x0, bw, a);
      }
    }
    // la guarida: placas de hielo
    if (this.textures.exists('v4/placa_hielo')) {
      const rng = seeded(this.snap.seed ^ 0x1ce);
      for (let i = 0; i < 6; i++) this.add.image(sn.lair.x + (0.2 + rng() * 0.6) * sn.lair.w, sn.lair.y + (0.2 + rng() * 0.6) * sn.lair.h, 'v4/placa_hielo').setDisplaySize(TILE * 2, TILE * 1.33).setDepth(0.7).setAlpha(0.85).setRotation(rng() * Math.PI);
    }
  }

  private cullWorld() {
    const v = this.cameras.main.worldView;
    const x0 = v.x - TILE, y0 = v.y - TILE, x1 = v.right + TILE, y1 = v.bottom + TILE;
    for (const c of this.cullables) {
      const vis = c.r.x < x1 && c.r.x + c.r.w > x0 && c.r.y < y1 && c.r.y + c.r.h > y0;
      if (c.o.visible !== vis) c.o.setVisible(vis);
    }
  }

  /** Paredes activas = fijas + puertas cerradas. Reindexa rayos, campo de flujo y visión. */
  private rebuildWalls() {
    this.walls = [...this.map.walls, ...this.doors.filter(o => !o.open).map(o => o.d)];
    this.wallIndex.rebuild(this.walls);
    setWallIndex(this.wallIndex);
    this.flow.setWalls(this.walls);
    this.wallsVersion++;
  }

  /** Las puertas se abren al pasar (jugador o enemigos) y hacen ruido si las abres tú. */
  openDoor(o: DoorObj, byPlayer: boolean, silent = false) {
    if (o.open) return;
    o.open = true;
    (o.body.body as Phaser.Physics.Arcade.StaticBody).enable = false;
    const ang = o.d.horiz ? -Math.PI / 2 * 0.85 : Math.PI / 2 + Math.PI / 2 * 0.85;
    if (silent) o.img.setRotation(ang).setAlpha(0.8);
    else this.tweens.add({ targets: o.img, rotation: ang, alpha: 0.8, duration: 180, ease: 'Quad.easeOut' });
    if (!this.snap.doorsOpen!.includes(o.d.id)) this.snap.doorsOpen!.push(o.d.id);
    if (!silent) {
      this.rebuildWalls();
      if (byPlayer) { this.stats.doorsOpened++; this.noise(o.d.x + o.d.w / 2, o.d.y + o.d.h / 2, MAP2.doorNoise); }
    }
  }

  private populate() {
    const rng = seeded(this.snap.seed + 99);
    const spawn = { x: this.snap.player.x, y: this.snap.player.y };
    const minD = DIFFICULTY.initialMinDistTiles;
    // Reparto por sectores (6×6) para que no se amontonen; se excluyen los cercanos a la entrada
    const SECT = 6, sw = WORLD / SECT;
    const sectors: { sx: number; sy: number }[] = [];
    for (let sy = 0; sy < SECT; sy++) for (let sx = 0; sx < SECT; sx++) {
      if (Math.hypot((sx + 0.5) * sw - spawn.x, (sy + 0.5) * sw - spawn.y) >= minD * TILE) sectors.push({ sx, sy });
    }
    for (let i = sectors.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [sectors[i], sectors[j]] = [sectors[j], sectors[i]]; }
    let si = 0;
    const farPoint = (minFromSpawn: number) => {
      const sec = sectors[si++ % Math.max(1, sectors.length)];
      for (let i = 0; i < 40; i++) {
        const x = sec ? (sec.sx + 0.1 + rng() * 0.8) * sw : (2 + rng() * 100) * TILE;
        const y = sec ? (sec.sy + 0.1 + rng() * 0.8) * sw : (2 + rng() * 100) * TILE;
        if (Math.hypot(x - spawn.x, y - spawn.y) < minFromSpawn * TILE) continue;
        if (pointInWalls(this.walls, x, y, TILE * 0.8)) continue;
        return { x, y };
      }
      return { x: WORLD / 2, y: WORLD / 3 };
    };
    this.snap.stream = { groups: DIFFICULTY.streamErranteGroups, hinchados: DIFFICULTY.streamHinchados, t: DIFFICULTY.streamIntervalSec };
    for (let g = 0; g < DIFFICULTY.initialErranteGroups; g++) {
      const c = farPoint(minD);
      const n = DIFFICULTY.erranteGroupMin + Math.floor(rng() * (DIFFICULTY.erranteGroupMax - DIFFICULTY.erranteGroupMin + 1));
      for (let i = 0; i < n; i++) this.spawnAt('errante', c.x + (rng() - 0.5) * TILE * 3, c.y + (rng() - 0.5) * TILE * 3);
    }
    for (let i = 0; i < DIFFICULTY.initialHinchados; i++) { const c = farPoint(minD); this.spawnAt('hinchado', c.x, c.y); }
    // una Abominación por zona de riesgo alto (comisaría, hospital, almacén militar), con su caja de élite y guardias
    for (const el of this.map.eliteBoxes) {
      // v4.2: en la guarida de la Zona Helada vive La Matriarca (el resto de zonas altas, una Abominación)
      const ab = this.spawnAt(el.lair ? 'matriarca' : 'abominacion', el.x, el.y - TILE * 2, undefined, el.lair ? false : undefined);
      ab.gx = el.x; ab.gy = el.y;
      if (el.lair) ab.lair = true;
      const z = zoneAt(this.map, el.x, el.y).rect;
      for (let i = 0; i < DIFFICULTY.eliteGuards; i++) {
        for (let k = 0; k < 10; k++) {
          const x = z.x + TILE + rng() * (z.w - TILE * 2), y = z.y + TILE + rng() * (z.h - TILE * 2);
          if (pointInWalls(this.walls, x, y, TILE * 0.6) || Math.hypot(x - spawn.x, y - spawn.y) < minD * TILE) continue;
          this.spawnAt('errante', x, y); break;
        }
      }
      this.snap.containers.push({ id: this.nextContainerId++, x: el.x, y: el.y, kind: 'elite', items: this.luck(el.lair ? rollLair(rng) : rollContainer(rng, 'elite', 1), rng), opened: false });
    }
    // botín: calles poco, tiendas/casas medio, zonas altas mucho (bonus por zona)
    for (const c of this.map.containers) {
      if (pointInWalls(this.walls, c.x, c.y, 10)) continue;
      this.snap.containers.push({ id: this.nextContainerId++, x: c.x, y: c.y, kind: c.kind, items: this.luck(rollContainer(rng, c.kind, c.bonus, snowAt(this.map, c.x, c.y) > 0.5), rng), opened: false });
    }
    this.addMaterials();
    // v3.1 §9.4: el Trapero (50 %), con su propio generador
    this.snap.trapero = genTrapero(seeded((this.snap.seed ^ 0x74726170) >>> 0), this.walls, spawn, this.snap.exits.map(e => ({ x: e.x, y: e.y })));
  }

  /** v3.1: marca un objeto como saqueado en ESTA incursión (lo único que compra el Trapero). */
  tagRaid(it: ItemInst) { if (ITEMS[it.def].kind === 'material') it.raid = this.snap.id; return it; }

  // ---------- v3.1 §9.4: el Trapero ----------
  private trapImg: Phaser.GameObjects.Image | null = null;
  private trapNearToast = false;
  traperoStats = { closedByAlert: 0, closedByTime: 0, rejected: 0 };

  private setupTrapero() {
    const t = this.snap.trapero;
    if (!t) return;
    const key = this.textures.exists('caseta_trapero') ? 'caseta_trapero' : 'caja';
    this.trapImg = this.add.image(t.x, t.y, key).setDisplaySize(TRAPERO.size, TRAPERO.size).setDepth(4.6).setVisible(false);
  }

  /** Estado actual: ¿abierto?, motivo si está cerrado y si estás al lado. */
  traperoState(): { t: NonNullable<RaidSnapshot['trapero']>; open: boolean; why: string | null; near: boolean } | null {
    const t = this.snap.trapero;
    if (!t || !t.found) return null;
    const near = Math.hypot(this.player.x - t.x, this.player.y - t.y) <= TRAPERO.talkTiles * TILE + TRAPERO.size / 2;
    let why: string | null = null;
    if (this.minute() >= TRAPERO.closeMinute) why = 'El Trapero ya ha recogido la caseta';
    else if (this.enemies.list.some(e => hasDetected(e) && Math.hypot(e.x - t.x, e.y - t.y) <= TRAPERO.closeAlertTiles * TILE)) why = '¡Hay un enemigo en alerta cerca! El Trapero ha cerrado';
    return { t, open: !why, why, near };
  }

  private updateTrapero() {
    const t = this.snap.trapero;
    if (!t || !this.trapImg) return;
    const v = this.visible(t.x, t.y, TRAPERO.size * 0.45);
    this.trapImg.setVisible(v || t.found && Math.hypot(this.player.x - t.x, this.player.y - t.y) < TILE * 2);
    if (v && !t.found) { t.found = true; this.hud?.toast('Has encontrado al Trapero', 1.6); }
    const st = this.traperoState();
    this.trapImg.setAlpha(st && !st.open ? 0.6 : 1);
    if (st?.near && !this.trapNearToast) { this.trapNearToast = true; this.hud?.toast(st.open ? 'El Trapero: abre la mochila para comerciar' : st.why!, 1.6); }
    if (!st?.near) this.trapNearToast = false;
  }

  /** Vende una pila de materiales saqueados en esta incursión a cambio de vales. */
  traperoSell(uid: string): { ok: boolean; msg: string } {
    const st = this.traperoState();
    if (!st?.near) return { ok: false, msg: 'El Trapero no está aquí' };
    if (!st.open) return { ok: false, msg: st.why! };
    const lo = this.snap.loadout;
    const i = lo.mochila.findIndex(x => x.uid === uid);
    if (i < 0) return { ok: false, msg: 'Solo desde la mochila' };
    const it = lo.mochila[i];
    const no = traperoRejects(it, this.snap.id);
    if (no) { this.traperoStats.rejected++; return { ok: false, msg: no }; }
    const v = valesFor(it);
    lo.mochila.splice(i, 1);
    st.t.vales += v; this.v31s.traperoSold++;
    this.host.persist(); this.host.refreshInventory();
    return { ok: true, msg: `+${v} vales` };
  }

  /** Chapas que llevas encima (pilas de chapas en mochila y bolsillos) + las del refugio. */
  private carriedChapas() { return countOf(this.snap.loadout.mochila, 'chapas') + this.pocketCount('chapas'); }
  traperoFunds() { const t = this.snap.trapero; return { vales: t?.vales ?? 0, carried: this.carriedChapas(), bank: this.host.bankChapas() }; }

  /** Compra: primero vales, luego chapas que llevas encima y por último las del refugio. */
  traperoBuy(idx: number): { ok: boolean; msg: string } {
    const st = this.traperoState();
    if (!st?.near) return { ok: false, msg: 'El Trapero no está aquí' };
    if (!st.open) return { ok: false, msg: st.why! };
    const e = st.t.stock[idx];
    if (!e || e.sold) return { ok: false, msg: 'Agotado' };
    const f = this.traperoFunds();
    if (f.vales + f.carried + f.bank < e.price) return { ok: false, msg: 'No te llega' };
    const lo = this.snap.loadout;
    const it: ItemInst = { ...e.item, uid: e.item.uid + '-' + Date.now().toString(36) };
    const left = backpackAdd(lo, it);
    if (left) return { ok: false, msg: 'Mochila llena' };
    let rest = e.price;
    const fromVales = Math.min(st.t.vales, rest); st.t.vales -= fromVales; rest -= fromVales;
    let fromCarried = Math.min(rest, f.carried);
    rest -= fromCarried;
    fromCarried -= consume(lo.mochila, 'chapas', fromCarried);
    while (fromCarried > 0) { const pk = this.pocketList().find(x => x.def === 'chapas'); if (!pk) break; const k = Math.min(pk.qty, fromCarried); pk.qty -= k; fromCarried -= k; if (pk.qty <= 0) { if (lo.bolsillo === pk) lo.bolsillo = null; else lo.bolsilloExtra = (lo.bolsilloExtra ?? []).filter(x => x !== pk); } }
    if (rest > 0) this.host.spendBankChapas(rest);
    e.sold = true; this.v31s.traperoBought++;
    this.host.persist(); this.host.refreshInventory();
    return { ok: true, msg: `Comprado: ${ITEMS[it.def].nombre}` };
  }

  /**
   * v3 §1: materiales en contenedores (según zona) y maleteros de coches. Con su propio generador para no cambiar
   * el botín de la v2 de una semilla dada.
   */
  private addMaterials() {
    const rng = seeded((this.snap.seed ^ 0x6d617431) >>> 0);
    const L = MATERIAL_LOOT;
    for (const c of this.snap.containers) {
      if (rng() >= (L.chance[c.kind] ?? 0)) continue;
      c.items.push(this.tagRaid(rollMaterial(rng, zoneAt(this.map, c.x, c.y).name))); this.v3s.mats++;
    }
    for (const car of this.map.cars) {
      if (rng() >= L.carTrunkChance) continue;
      // el maletero queda junto al lado largo del coche, en la calle
      const horiz = car.w > car.h;
      const cands = horiz ? [{ x: car.x + car.w / 2, y: car.y - TILE * 0.55 }, { x: car.x + car.w / 2, y: car.y + car.h + TILE * 0.55 }]
        : [{ x: car.x - TILE * 0.55, y: car.y + car.h / 2 }, { x: car.x + car.w + TILE * 0.55, y: car.y + car.h / 2 }];
      const p = cands.find(q => !pointInWalls(this.walls, q.x, q.y, 12));
      if (!p) continue;
      const items = [this.tagRaid(rollMaterial(rng, 'Coche'))];
      if (rng() < L.chance.coche - 0.5) items.push(this.tagRaid(rollMaterial(rng, 'Coche')));
      this.snap.containers.push({ id: this.nextContainerId++, x: p.x, y: p.y, kind: 'caja', items, opened: false });
      this.v3s.trunks++; this.v3s.mats += items.length;
    }
  }

  /** Alcantarillas (Reptante): en la calle, deterministas por mapa (no tocan el generador del mapa). */
  private setupSewers() {
    const rng = seeded((MAP2.layoutSeed ^ 0x5e3e2) >>> 0);
    const N = ENEMY_V3.reptante.sewers;
    const sp = this.map.spawns.length ? this.map.spawns : [this.map.spawn];
    for (let tries = 0; this.sewers.length < N && tries < N * 80; tries++) {
      const x = TILE * 3 + rng() * (WORLD - TILE * 6), y = TILE * 3 + rng() * (WORLD - TILE * 6);
      if (zoneAt(this.map, x, y).kind !== 'calle' || pointInWalls(this.walls, x, y, TILE * 1.2)) continue;
      if (sp.some(q => Math.hypot(q.x - x, q.y - y) < TILE * 8)) continue;
      if (this.map.exitLocs.some(q => Math.hypot(q.x - x, q.y - y) < TILE * 5)) continue;
      if (this.sewers.some(q => Math.hypot(q.x - x, q.y - y) < TILE * 12)) continue;
      this.sewers.push({ x, y });
    }
    for (const q of this.sewers) this.addSewerImg(q.x, q.y);
  }
  addSewerImg(x: number, y: number) {
    if (!this.textures.exists('alcantarilla')) return;
    const img = this.add.image(x, y, 'alcantarilla').setDisplaySize(TILE * 1.1, TILE * 1.1).setDepth(1.6);
    const r = { x: x - TILE, y: y - TILE, w: TILE * 2, h: TILE * 2 };
    this.sewerImgs.push({ img, r });
    this.cullables.push({ o: img, r });
  }

  /** Radio del refugio: nivel 2 revela una salida activa; nivel 3 dice dónde está el mejor objeto de élite. */
  private radioNews: string[] = [];
  private applyRadio() {
    const s = this.snap, lv = s.radio ?? 0;
    this.radioNews = [];
    if (lv >= 2) {
      const hidden = s.exits.find(e => !this.seen.has(e.loc) && e.type !== 'helipuerto');
      const ex = hidden ?? s.exits[0];
      if (ex && this.fresh) { this.seen.add(ex.loc); this.host.markExitSeen(this.map.id, ex.loc); }
      if (ex) this.radioNews.push(`📻 Radio: salida activa en ${this.extraction?.locName(ex.loc) ?? this.map.exitLocNames[ex.loc]}`);
    }
    if (lv >= 3) {
      const el = s.containers.filter(c => c.kind === 'elite' && c.items.length);
      let best: { c: ContainerSnap; it: ItemInst } | null = null;
      for (const c of el) for (const it of c.items) if (!best || itemValue(it) > itemValue(best.it)) best = { c, it };
      if (best) { this.radioDot = { x: best.c.x, y: best.c.y }; this.radioNews.push(`📻 Radio: ${itemLabel(best.it)} en ${zoneAt(this.map, best.c.x, best.c.y).name}`); }
    }
  }

  /** `elite`: true = fuerza élite (depuración), false = nunca (depuración), undefined = tirada normal. */
  spawnAt(type: EnemyType, x: number, y: number, group?: number, elite?: boolean, pack = false): Enemy {
    x = Phaser.Math.Clamp(x, TILE, WORLD - TILE); y = Phaser.Math.Clamp(y, TILE, WORLD - TILE);
    // v4.2: en la Zona Helada salen las versiones de la nieve (Congelado, Lobo mutado en manada de 3, Escarcha)
    const icy = SNOW_ENEMIES.enabled ? SNOW_ENEMIES.swap[type] : undefined;
    if (icy && snowAt(this.map, x, y) > 0.5) {
      if (icy === 'lobo' && !pack) {
        const lead = this.spawnAt('lobo', x, y, group, elite, true);
        const sides = [-1, 1];
        lead.flankSide = 0;
        for (let i = 1; i < SNOW_ENEMIES.wolfPack; i++) {
          const o = this.spawnAt('lobo', x + (Math.random() - 0.5) * TILE * 2, y + (Math.random() - 0.5) * TILE * 2, group, false, true);
          o.flankSide = sides[(i - 1) % 2]; o.state = lead.state; o.goal = lead.goal; o.susPhase = lead.susPhase; o.meter = lead.meter;
        }
        this.v42s.packs++;
        return lead;
      }
      type = icy;
    }
    if (type !== 'reptante' && pointInWalls(this.walls, x, y, 20)) { y += TILE * 1.5; }
    // v4: dificultad del mapa (×1 en El Arrabal) y ×1,3 dentro de la Zona Helada
    const mult = scaling(this.minute()).stats * this.mapDef.dificultad * (snowAt(this.map, x, y) > 0.5 ? SNOW.enemyMult : 1);
    const e = this.enemies.spawn(type, x, y, mult, type === 'enjambre' ? { group: group ?? this.newGroup() } : undefined);
    if (type in this.v42s.spawned) this.v42s.spawned[type as 'congelado']++;
    if (type === 'reptante' && !this.sewers.some(q => Math.hypot(q.x - x, q.y - y) < 4)) this.addSewerImg(x, y);
    // mutaciones desde el minuto 10
    const m = this.minute();
    if (m >= MUTATIONS.fromMinute && !MUTATIONS.exclude.includes(type)) {
      const ch = Math.min(MUTATIONS.maxChance, MUTATIONS.chance + MUTATIONS.chancePerMinute * (m - MUTATIONS.fromMinute));
      if (Math.random() < ch && this.enemies.mutate(e, MUTATION_IDS[Math.floor(Math.random() * MUTATION_IDS.length)])) this.v3s.mutated++;
    }
    // v3.1 §9.5: élite (5 %), con tope de vivos y por incursión
    if (elite) this.forceElite(e);
    else if (elite === undefined && !ELITE.exclude.includes(type) && (this.snap.elites ?? 0) < ELITE.maxPerRaid && this.enemies.eliteAlive() < ELITE.maxAlive && Math.random() < ELITE.chance) this.forceElite(e);
    return e;
  }
  forceElite(e: Enemy) { if (this.enemies.makeElite(e)) { this.snap.elites = (this.snap.elites ?? 0) + 1; return true; } return false; }
  private newGroup() { const s = this.snap; s.nextGroup = (s.nextGroup ?? 1) + 1; return s.nextGroup; }

  /** Enjambre: un grupo de 8-12 bichos. */
  spawnSwarm(x: number, y: number, n?: number) {
    const [a, b] = ENEMY_V3.enjambre.count;
    const k = n ?? a + Math.floor(Math.random() * (b - a + 1));
    const g = this.newGroup();
    const out: Enemy[] = [];
    for (let i = 0; i < k; i++) out.push(this.spawnAt('enjambre', x + (Math.random() - 0.5) * TILE * 1.6, y + (Math.random() - 0.5) * TILE * 1.6, g));
    return out;
  }

  /** v3: ¿toca un enemigo nuevo en esta oleada? (probabilidad por tipo desde su minuto, con tope de vivos). */
  private spawnV3(m: number): boolean {
    for (const t of V3_TYPES) {
      const E = ENEMY_V3[t as keyof typeof ENEMY_V3];
      if (m < E.fromMinute || Math.random() >= (WAVE_V3[t] ?? 0)) continue;
      const alive = this.enemies.list.filter(e => e.def.type === t);
      if (t === 'enjambre') {
        if (new Set(alive.map(e => e.group)).size >= ENEMY_V3.enjambre.maxGroups) continue;
        const p = this.offscreenPoint(12, 20); if (!p) continue;
        this.spawnSwarm(p.x, p.y); return true;
      }
      if ('maxAlive' in E && alive.length >= (E as { maxAlive: number }).maxAlive) continue;
      if (t === 'reptante') {
        const v = this.cameras.main.worldView;
        const free = this.sewers.filter(q => !v.contains(q.x, q.y) && !alive.some(e => Math.hypot((e.gx ?? 0) - q.x, (e.gy ?? 0) - q.y) < 4) && Math.hypot(q.x - this.player.x, q.y - this.player.y) < TILE * 26);
        if (!free.length) continue;
        const q = free[Math.floor(Math.random() * free.length)];
        this.spawnAt('reptante', q.x, q.y); return true;
      }
      if (t === 'acechador') {
        // solo en interiores (suelos de baldosa), fuera de cámara
        const v = this.cameras.main.worldView;
        const fl = this.map.floors.filter(f => { const cx = f.x + f.w / 2, cy = f.y + f.h / 2; const d = Math.hypot(cx - this.player.x, cy - this.player.y); return d > TILE * 8 && d < TILE * 28 && !v.contains(cx, cy); });
        if (!fl.length) continue;
        const f = fl[Math.floor(Math.random() * fl.length)];
        const x = f.x + TILE + Math.random() * Math.max(1, f.w - TILE * 2), y = f.y + TILE + Math.random() * Math.max(1, f.h - TILE * 2);
        if (pointInWalls(this.walls, x, y, TILE * 0.6)) continue;
        this.spawnAt('acechador', x, y); return true;
      }
      const p = this.offscreenPoint(12, 22); if (!p) continue;
      this.spawnAt(t, p.x, p.y); return true;
    }
    return false;
  }

  /** Punto fuera de cámara a cierta distancia del jugador (o de otro punto). */
  private offscreenPoint(minT: number, maxT: number, ox = this.player.x, oy = this.player.y) {
    const view = this.cameras.main.worldView;
    for (let i = 0; i < 30; i++) {
      const a = Math.random() * Math.PI * 2, r = (minT + Math.random() * (maxT - minT)) * TILE;
      const x = ox + Math.cos(a) * r, y = oy + Math.sin(a) * r;
      if (x < TILE || y < TILE || x > WORLD - TILE || y > WORLD - TILE) continue;
      if (view.contains(x, y)) continue;
      if (pointInWalls(this.walls, x, y, TILE * 0.7)) continue;
      return { x, y };
    }
    return null;
  }

  private spawnWave() {
    if (this.enemies.list.length >= DIFFICULTY.maxAlive) return;
    const m = this.minute();
    if (this.spawnV3(m)) return;
    const mix = m >= DIFFICULTY.moreHinchadosFromMinute ? DIFFICULTY.waveMix.hinchados : m >= DIFFICULTY.corredorFromMinute ? DIFFICULTY.waveMix.corredores : DIFFICULTY.waveMix.early;
    let x = Math.random();
    let type: EnemyType = 'errante';
    for (const [k, w] of Object.entries(mix)) { x -= w; if (x <= 0) { type = k as EnemyType; break; } }
    const p = this.offscreenPoint(12, 22);
    if (!p) return;
    const n = type === 'errante' ? DIFFICULTY.erranteGroupMin + Math.floor(Math.random() * (DIFFICULTY.erranteGroupMax - DIFFICULTY.erranteGroupMin + 1)) : 1;
    const room = DIFFICULTY.maxAlive - this.enemies.list.length; // el tope se respeta también dentro del grupo
    for (let i = 0; i < Math.min(n, room); i++) this.spawnAt(type, p.x + (Math.random() - 0.5) * TILE * 2, p.y + (Math.random() - 0.5) * TILE * 2);
  }

  /** Ruido en el mundo. Desde el minuto 10, el ruido fuerte atrae hordas. */
  /** QA: últimos ruidos (x, y, radio, t). */
  noiseLog: { x: number; y: number; r: number; t: number }[] = [];
  noise(x: number, y: number, radiusTiles: number) {
    if (radiusTiles <= 0) return;
    this.noiseLog.push({ x: Math.round(x), y: Math.round(y), r: radiusTiles, t: this.snap.elapsed }); if (this.noiseLog.length > 300) this.noiseLog.shift();
    const m = this.minute();
    const horde = m >= DIFFICULTY.hordeFromMinute;
    this.enemies.noise(x, y, radiusTiles * (horde ? DIFFICULTY.hordeNoiseRadiusMult : 1));
    if (horde && radiusTiles >= DIFFICULTY.hordeNoiseThreshold && this.snap.hordeCd <= 0 && this.enemies.list.length < DIFFICULTY.maxAlive) {
      this.snap.hordeCd = DIFFICULTY.hordeCooldownSec;
      const p = this.offscreenPoint(12, 18, x, y);
      if (!p) return;
      const n = Math.min(DIFFICULTY.maxAlive - this.enemies.list.length, DIFFICULTY.hordeSizeMin + Math.floor(Math.random() * (DIFFICULTY.hordeSizeMax - DIFFICULTY.hordeSizeMin + 1)));
      for (let i = 0; i < n; i++) {
        const e = this.spawnAt(Math.random() < 0.25 ? 'corredor' : 'errante', p.x + (Math.random() - 0.5) * TILE * 3, p.y + (Math.random() - 0.5) * TILE * 3);
        e.goal = { x, y, until: this.snap.elapsed + 20 }; e.state = 'investigate';
      }
      this.hud?.toast('¡Una horda acude al ruido!');
    }
  }

  addAcid(x: number, y: number, r = TILE * 1.4) { this.snap.acid.push({ x, y, t: 4 }); void r; }

  /** v4.0 Carroñero: etiquetas con el contenido de las cajas sin abrir a ≤ peekTiles casillas. */
  private peekTxt = new Map<number, Phaser.GameObjects.Text>();
  peekShown() { return [...this.peekTxt.entries()].filter(([, t]) => t.visible).map(([id, t]) => ({ id, text: t.text })); }
  private updatePeek() {
    const k = this.att('carronero', 'peekTiles') * TILE;
    const seen = new Set<number>();
    if (k > 0) for (const c of this.containers) {
      const sn = c.snap;
      if (sn.opened || !sn.items.length || sn.kind === 'cadaver') continue;
      if (Math.hypot(sn.x - this.player.x, sn.y - this.player.y) > k + TILE * 0.5) continue;
      seen.add(sn.id);
      let t = this.peekTxt.get(sn.id);
      const txt = sn.items.slice(0, 3).map(it => ITEMS[it.def]?.nombre ?? it.def).join('\n') + (sn.items.length > 3 ? `\n+${sn.items.length - 3}` : '');
      if (!t) { t = this.add.text(sn.x, sn.y - TILE * 0.6, '', { fontFamily: 'system-ui, sans-serif', fontSize: '10px', color: '#ffe7a0', stroke: '#000', strokeThickness: 3, align: 'center' }).setOrigin(0.5, 1).setDepth(900); this.peekTxt.set(sn.id, t); }
      if (t.text !== txt) t.setText(txt);
      t.setVisible(true);
    }
    for (const [id, t] of this.peekTxt) if (!seen.has(id)) { if (!this.containers.some(c => c.snap.id === id && !c.snap.opened)) { t.destroy(); this.peekTxt.delete(id); } else t.setVisible(false); }
  }
  /** v4.0: al juntar experiencia para subir de nivel (se asegura al extraer): destello dorado y aviso, una vez por nivel. */
  private lvlWarned = 0;
  private checkLevelPending() {
    const pr = this.host?.saveData?.()?.prog; if (!pr) return;
    let lv = pr.level, xp = pr.xp + (this.snap.xp ?? 0);
    while (xp >= xpToNext(lv)) { xp -= xpToNext(lv); lv++; }
    if (lv > pr.level && lv > this.lvlWarned) {
      const first = this.lvlWarned === 0 && (this.snap.elapsed < 1);
      this.lvlWarned = lv;
      if (first) return; // al retomar una incursión ya avisada no se repite
      const f = this.add.circle(this.player.x, this.player.y, TILE * 0.6, 0xffc94a, 0.55).setDepth(950).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: f, scale: 3, alpha: 0, duration: 650, onComplete: () => f.destroy() });
      this.hud?.toast(`¡Nivel ${lv}! (se asegura al extraer)`);
    }
  }

  /** v4.0: efecto de un atributo (0 sin puntos). */
  att(a: AttrId, key: string) { return attrK(this.host?.saveData?.(), a, key); }
  /** v4.0: Medicina (+10 % de efecto por nivel de Enfermería por encima del 1). */
  private medK(key: string) { const d = this.host?.saveData?.(); return this.att('medicina', key) * (1 + 0.1 * Math.max(0, (d?.refugio.levels.enfermeria ?? 1) - 1)); }
  /** v4.0: velocidad con la carga (Fuerza: peso que no ralentiza) y la Agilidad. */
  spd(lo = this.snap.loadout) { return speedMult(lo, this.att('fuerza', 'weight')) * (1 + this.att('agilidad', 'speed')); }
  /** v4.0: experiencia de la incursión (sin asegurar hasta extraer), con el multiplicador del mapa. */
  gainXp(n: number, by: 'kills' | 'cajas' | 'mision' | 'extraer') {
    if (n <= 0) return;
    const v = n * this.mapDef.xpMult;
    this.snap.xp = (this.snap.xp ?? 0) + v;
    const b = (this.snap.xpBy ??= {}); b[by] = (b[by] ?? 0) + v;
  }
  /** v4.0: Suerte (+botín, +rareza) y Carroñero (+chapas) sobre lo que sale en un contenedor. Sin puntos no toca el rng. */
  private luck(items: ItemInst[], rng: () => number) {
    const up = this.att('suerte', 'rarityUp'), more = this.att('suerte', 'loot'), ch = this.att('carronero', 'chapas');
    if (more > 0 && items.length && rng() < more) items.push(rollItem(rng, 0));
    for (const it of items) {
      if (up > 0 && ITEMS[it.def].rolls && rng() < up) { const i = RARITY_ORDER.indexOf(it.rarity); if (i >= 0 && i < RARITY_ORDER.length - 1) it.rarity = RARITY_ORDER[i + 1]; }
      if (ch > 0 && it.def === 'chapas') it.qty = Math.round(it.qty * (1 + ch));
    }
    return items;
  }

  /** Depuración: clearEnemies no muestra avisos. */
  quietKills = false;

  onEnemyDeath(e: Enemy) {
    this.snap.kills++;
    this.gainXp(killXp(e.def.type, !!e.elite, e.def.type === 'matriarca'), 'kills');
    if (e.def.type === 'matriarca') { this.v42s.bossKills++; if (!this.quietKills) this.hud?.toast('Has abatido a La Matriarca', 2.5); }
    const items: ItemInst[] = [];
    if (e.elite) { const drops = rollEliteDrops(Math.random); items.push(...drops); this.v31s.eliteKills++; this.v31s.eliteDrops += drops.length; }
    else if (Math.random() < e.def.dropChance * (1 + this.att('suerte', 'loot'))) items.push(rollItem(Math.random, 0));
    // v3: muestras mutadas (Hinchado 50 %, Abominación 2-3, mutado 35 %)
    const M = MATERIAL_LOOT.muestra;
    let muestras = 0;
    if (e.def.type === 'hinchado' && Math.random() < M.hinchado) muestras = 1;
    if (e.def.type === 'abominacion') muestras = M.abominacionQty[0] + Math.floor(Math.random() * (M.abominacionQty[1] - M.abominacionQty[0] + 1));
    if (e.mut && Math.random() < M.mutado) muestras += 1;
    if (muestras) { items.push(this.tagRaid(makeItem('mat_muestra', 'comun', muestras))); this.v3s.muestras += muestras; }
    // registro para misiones: muertes por tipo y arma (m = cuerpo a cuerpo, r = a distancia, o = otras)
    const tr = this.snap.track ??= { heals: 0, dmgTaken: 0, kills: {} };
    const k = tr.kills[e.def.type] ??= { m: 0, r: 0, o: 0 };
    const w = e.lastWeapon ? ITEMS[e.lastWeapon]?.weapon : undefined;
    if (e.lastWeapon === 'punos' || (w && w.melee)) k.m++; else if (w) k.r++; else k.o++;
    // flechas/virotes clavados: caen al suelo junto al cuerpo (se recogen al pasar por encima)
    const st = this.stuck.get(e);
    if (st) { let k = 0; for (const [id, n] of Object.entries(st)) if (n > 0) this.dropArrow(e.x + 14 * Math.cos(k * 2.4), e.y + 10 + 14 * Math.sin(k++ * 2.4), n, id); this.stuck.delete(e); }
    if (items.length) this.addContainer({ id: this.nextContainerId++, x: e.x, y: e.y, kind: 'cadaver', items, opened: true });
  }

  private addContainer(c: ContainerSnap) { this.snap.containers.push(c); this.addContainerObj(c); }

  private addContainerObj(c: ContainerSnap) {
    let sprite: ContainerObj['sprite'];
    const o: ContainerObj = { snap: c, sprite: null as unknown as ContainerObj['sprite'] };
    if (c.kind === 'cadaver') sprite = this.add.ellipse(c.x, c.y, 30, 20, 0x2a1d17, 0.9).setStrokeStyle(3, COLORS.contorno).setDepth(4);
    else {
      const size = c.kind === 'elite' ? 54 : 40;
      sprite = this.add.image(c.x, c.y, 'caja').setDisplaySize(size, size).setDepth(4);
      if (c.kind === 'cerrada') { (sprite as Phaser.GameObjects.Image).setTint(0xc89a7a); o.lock = this.add.text(c.x + 12, c.y - 16, '🔒', { fontSize: '14px' }).setDepth(5); }
      if (c.kind === 'elite') o.glow = this.add.circle(c.x, c.y, 34, 0x3c8cff, 0.25).setStrokeStyle(3, 0x3c8cff).setDepth(3);
    }
    o.sprite = sprite;
    this.containers.push(o);
    this.refreshContainer(o);
  }

  private refreshContainer(o: ContainerObj) {
    const empty = o.snap.items.length === 0;
    if (o.lock && o.snap.opened) { o.lock.destroy(); o.lock = undefined; }
    if (empty && o.snap.kind === 'cadaver') {
      o.sprite.destroy(); o.glow?.destroy();
      this.containers.splice(this.containers.indexOf(o), 1);
      this.snap.containers.splice(this.snap.containers.indexOf(o.snap), 1);
      return;
    }
    o.sprite.setAlpha(empty ? 0.4 : 1);
    if (empty) o.glow?.setVisible(false);
  }

  /** Botín y flechas en la niebla no se ven (las cajas reaparecen al entrar en tu cono). */
  private updateVisibility() {
    for (const c of this.containers) {
      const near = Math.abs(c.snap.x - this.player.x) < 900 && Math.abs(c.snap.y - this.player.y) < 900;
      const v = near && this.visible(c.snap.x, c.snap.y, 16);
      if (c.sprite.visible !== v) { c.sprite.setVisible(v); c.lock?.setVisible(v); c.glow?.setVisible(v && c.snap.items.length > 0); }
    }
    const ga = 0.115 + 0.045 * Math.cos(this.time.now / 900 * Math.PI);
    for (const a of this.groundArrows) { const v = this.visible(a.x, a.y, 8); a.img.setVisible(v); if (a.glow) { a.glow.setVisible(v); if (v) a.glow.setAlpha(ga); } }
    for (const d of this.debris) d.img.setVisible(Math.abs(d.x - this.player.x) < 700 && Math.abs(d.y - this.player.y) < 700 && this.visible(d.x, d.y, 6));
  }

  // ---------- Flechas recuperables ----------
  private dropArrow(x: number, y: number, qty: number, id = 'flechas') {
    if (pointInWalls(this.walls, x, y, 2)) {
      // dentro de una pared: se queda pegada al borde más cercano por donde vino (si no hay hueco, se pierde)
      const ang = Math.atan2(this.player.y - y, this.player.x - x);
      let ok = false;
      for (let d = 6; d <= 30 && !ok; d += 6) { const nx = x + Math.cos(ang) * d, ny = y + Math.sin(ang) * d; if (!pointInWalls(this.walls, nx, ny, 2)) { x = nx; y = ny; ok = true; } }
      if (!ok) return;
    }
    const near = this.groundArrows.find(a => a.def === id && Math.hypot(a.x - x, a.y - y) < TILE * 0.6);
    if (near) { near.qty += qty; this.syncArrows(); return; }
    this.addGroundArrow(x, y, qty, true, id);
  }

  /** v3.1: flecha/virote en el suelo con brillo tenue (flecha_suelo de Basu) hasta el final de la incursión. */
  private addGroundArrow(x: number, y: number, qty: number, save: boolean, id = 'flechas') {
    const rot = Math.random() * Math.PI * 2;
    let img: Phaser.GameObjects.Image, glow: Phaser.GameObjects.Arc | null = null;
    if (id === 'virotes' && this.textures.exists('proyectil_virote')) {
      glow = this.add.circle(x, y, 17, 0xffe7a0, 0.16).setDepth(4.4).setBlendMode(Phaser.BlendModes.ADD);
      img = this.add.image(x, y, 'proyectil_virote').setDepth(4.5).setRotation(rot).setDisplaySize(11, 32);
    } else if (this.textures.exists('flecha_suelo')) {
      img = this.add.image(x, y, 'flecha_suelo').setDepth(4.5).setRotation(rot).setDisplaySize(40, 40);
    } else {
      const key = this.textures.exists('proyectil_flecha') ? 'proyectil_flecha' : 'flecha';
      img = this.add.image(x, y, key).setDepth(4.5).setRotation(rot);
      if (key === 'proyectil_flecha') img.setDisplaySize(8, 30); else img.setDisplaySize(TILE * 0.6, TILE * 0.6);
    }
    // v3.2: sin tween infinito por virote; el brillo late en updateVisibility con una sola fase compartida
    this.groundArrows.push({ x, y, qty, def: id, img, glow });
    // v3.2: tope de flechas en el suelo (las más viejas desaparecen)
    while (this.groundArrows.length > PERF.maxGroundArrows) { const o = this.groundArrows.shift()!; o.img.destroy(); o.glow?.destroy(); this.arrowsCulled++; }
    if (save) this.syncArrows();
  }

  private syncArrows() { this.snap.arrows = this.groundArrows.map(a => ({ x: Math.round(a.x), y: Math.round(a.y), qty: a.qty, def: a.def })); }

  private pickupArrows() {
    for (let i = this.groundArrows.length - 1; i >= 0; i--) {
      const a = this.groundArrows[i];
      if (Math.hypot(a.x - this.player.x, a.y - this.player.y) > TILE * BOWS.pickupTiles) continue;
      const it = makeItem(a.def, 'comun', a.qty);
      const left = backpackAdd(this.snap.loadout, it);
      const got = a.qty - (left?.qty ?? 0);
      if (got <= 0) continue;
      this.stats.arrowsRecovered += got;
      if (left) { a.qty = left.qty; } else { a.img.destroy(); a.glow?.destroy(); this.groundArrows.splice(i, 1); }
      this.hud?.toast(a.def === 'virotes' ? `+${got} virote${got > 1 ? 's' : ''}` : `+${got} flecha${got > 1 ? 's' : ''}`, 0.9);
      this.syncArrows();
      this.host.refreshInventory();
    }
  }

  // ---------- Pausa / guardado ----------
  /** Al pasar a segundo plano: pausa y guarda EXACTAMENTE este instante (sin volver nunca a copias anteriores). */
  background() {
    if (this.ended) return;
    this.joy?.reset(); this.aim?.reset();
    if (!this.paused) this.setPaused(true, 'segundo-plano');
    this.persist();
  }

  setPaused(v: boolean, reason: 'usuario' | 'segundo-plano' | 'reanudada') {
    if (this.ended) return;
    this.paused = v;
    this.joy?.reset(); this.aim?.reset();
    this.endHitStop();
    if (v) { this.physics.pause(); this.tweens.pauseAll(); this.time.paused = true; this.host.closeInventory(); this.persist(); }
    else { this.physics.resume(); this.tweens.resumeAll(); this.time.paused = false; }
    this.host.onPauseChange(v, reason);
  }

  writeSnapshot() {
    const s = this.snap;
    const p = s.player;
    p.x = Math.round(this.player.x); p.y = Math.round(this.player.y);
    s.enemies = this.enemies.snapshot();
    s.fx = { ...(s.fx ?? {}), grabImm: this.enemies.v3.grabImm };
    this.syncArrows();
    s.saves++;
  }

  persist() {
    if (this.ended) return;
    this.writeSnapshot();
    this.host.persist();
  }

  // ---------- Impacto (hit-stop, sacudida) ----------
  /** Congela el mundo unos ms (50-80) para que el golpe "pese". */
  hitStop(ms: number) {
    if (this.paused || this.ended || ms <= 0) return; // 0 ms: sin congelar (antes dejaba el mundo a cámara lenta)
    if (this.hitStopT <= 0) this.stats.hitStops++;
    this.hitStopT = Math.max(this.hitStopT, ms);
    this.physics.world.timeScale = 40;
    this.tweens.timeScale = 0.05;
  }
  hitStopActive() { return this.hitStopT > 0; }
  private endHitStop() { this.hitStopT = 0; this.physics.world.timeScale = 1; this.tweens.timeScale = 1; }

  private shakeFor(dmg: number) {
    const i = Math.min(JUICE.shakeMax, dmg * JUICE.shakePerDmg);
    if (i > 0.0005) this.cameras.main.shake(70 + Math.min(80, dmg * 2), i);
  }

  /** Daño a un enemigo con todo el "juice": número, sangre, tambaleo, hit-stop y sacudida según el daño. */
  dealDamage(e: Enemy, dmg: number, ang: number, weapon: string, crit: boolean, stopMs = JUICE.hitStopMs, backstab = false) {
    if (crit) { this.stats.crits++; this.rig.flashGoggles(); }
    if (backstab) this.stats.backstabs++;
    const killed = this.enemies.damage(e, dmg, { ang, weapon, crit, backstab });
    if (e.visibleNow || this.visible(e.x, e.y, e.def.size * 0.4)) { this.hitStop(crit ? JUICE.hitStopHeavyMs : stopMs); this.shakeFor(dmg * (crit ? 1.5 : 1)); }
    return killed;
  }

  /** v3.1 §9.2: variación de daño + crítico del jugador (sustituye el crítico de la v2). */
  /** v4.0: Fuerza (+daño cuerpo a cuerpo) y Pulso (+crítico a distancia). */
  private rollCrit(dmg: number) { const melee = this.playerMelee(); return rollDamage(dmg * (melee ? 1 + this.att('fuerza', 'melee') : 1), 'player', Math.random, melee ? 0 : this.att('pulso', 'crit')); }

  /** Puñalada / Ejecutar / disparo apuntado a un desprevenido: ×2,5 (STEALTH.backstabMult), siempre crítico. */
  private backstabDmg(base: number) { const c = DAMAGE.player; return (DAMAGE.backstabRolls ? base * (c.minFrac + (c.maxFrac - c.minFrac) * Math.random()) : base) * STEALTH.backstabMult; }

  // ---------- Combate ----------
  damagePlayer(n: number, cause: string, react = true) {
    if (this.ended || this.god) return;
    const p = this.snap.player;
    // v3.1 §9.2: golpes directos (react) tiran variación y crítico enemigo; los daños por segundo no (el agarre del Reptante tampoco)
    const rolls = react && cause !== 'Reptante' && cause !== 'Depuración';
    const roll = rolls ? rollDamage(n, 'enemy') : { dmg: n, crit: false };
    let dmg = roll.dmg;
    if (react) dmg *= (1 - totalProtection(this.snap.loadout)) * (p.aguantar > 0 ? 0.4 : 1);
    dmg *= 1 - this.att('resistencia', 'dmgTaken');
    // v3: el Reptante te agarra → el resto te hace la mitad; adrenalina → -30 %
    dmg *= this.enemies?.v3.dmgMult(cause) ?? 1;
    if ((this.snap.fx?.adren ?? 0) > 0) dmg *= NEW_ITEMS.adrenalina.dmgTakenMult;
    p.hp -= dmg;
    if (this.snap.track) this.snap.track.dmgTaken += Math.min(dmg, Math.max(0, p.hp + dmg));
    if (react && this.applying) this.cancelApply('golpe');
    if (react) {
      // mini barra de vida: 2 golpes en 3 s → visible 3 s desde el último
      const now = this.snap.elapsed;
      this.hitTimes = this.hitTimes.filter(t => now - t < PRUEBA_V2.miniHpWindowSec); this.hitTimes.push(now);
      if (this.hitTimes.length >= PRUEBA_V2.miniHpHits) this.miniHpUntil = now + PRUEBA_V2.miniHpStaySec;
      this.extraction.onHit();
      // el anillo de looteo se PAUSA (no se reinicia) al recibir un golpe
      if (this.loot.c && this.loot.t > 0) { this.loot.pause = 0.6; this.stats.lootPaused++; }
      this.cameras.main.shake(90, 0.006);
      // daño recibido en rojo; el crítico recibido además hace temblar la pantalla
      if (dmg >= 0.5) this.fx.damageNumber(this.player.x, this.player.y - 26, dmg, roll.crit, true);
      if (roll.crit) { this.stats.critsTaken++; this.cameras.main.shake(DAMAGE.hurtCritShake[0], DAMAGE.hurtCritShake[1], true); }
      this.rig.hit(Math.random() * Math.PI * 2, 0.5);
      this.rig.setTint(0xff4d6d);
      this.time.delayedCall(100, () => this.rig && this.rig.setTint(null));
      this.hud?.flashHurt();
      vibrate(40);
    }
    if (p.hp <= 0) { p.hp = 0; this.finish('muerto', { cause }); }
  }

  private finish(result: 'extraido' | 'muerto', detail: { cause?: string; exit?: ExitState }) {
    if (this.ended) return;
    this.endHitStop();
    this.writeSnapshot();
    this.ended = true;
    this.joy?.reset(); this.aim?.reset();
    this.physics.pause();
    this.host.closeInventory();
    this.host.endRaid(result, detail);
  }

  /** ¿Punto dentro de la vista de cámara (con margen interior en px de mundo)? */
  onScreen(x: number, y: number, margin = 0) {
    const v = this.cameras.main.worldView;
    return x >= v.x + margin && x <= v.right - margin && y >= v.y + margin && y <= v.bottom - margin;
  }

  /**
   * Objetivo automático. A distancia: solo lo que está en pantalla Y se ve (cono + línea de visión).
   * Cuerpo a cuerpo: dentro de ±arcDeg de la mirada si se indica.
   */
  pickTarget(rangePx: number, melee: boolean, arcDeg = 0): Enemy | null {
    const px = this.player.x, py = this.player.y;
    const cands: { e: Enemy; d: number }[] = [];
    for (const e of this.enemies.list) {
      if (!e.targetable) continue;
      // sigilo: el ataque automático NUNCA elige a quien no te ha detectado (a esos se les ataca a propósito)
      if (isUnaware(e)) { this.stats.autoSkippedUnaware++; continue; }
      if (!melee && (!this.onScreen(e.x, e.y) || !this.visible(e.x, e.y, e.def.size * 0.3))) continue;
      if (e.def.type === 'acechador' && !e.visibleNow) continue; // casi invisible: no se apunta solo
      const d = Math.hypot(e.x - px, e.y - py) - e.def.size * 0.3;
      if (d > rangePx) continue;
      if (arcDeg > 0 && d > this.playerRadius) {
        const off = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(e.y - py, e.x - px) - this.facing));
        if (off > Phaser.Math.DegToRad(arcDeg)) continue;
      }
      if (!lineClear(this.walls, px, py, e.x, e.y)) continue;
      cands.push({ e, d });
    }
    if (!cands.length) return null;
    // Con cuerpo a cuerpo, el Hinchado se deja para el final.
    let pool = cands;
    if (melee) { const nonH = cands.filter(c => c.e.def.type !== 'hinchado'); if (nonH.length) pool = nonH; }
    const pr = this.settings.prioridad;
    pool.sort((a, b) => pr === 'debil' ? a.e.hp - b.e.hp || a.d - b.d : pr === 'peligroso' ? b.e.def.danger - a.e.def.danger || a.d - b.d : a.d - b.d);
    return pool[0].e;
  }

  private weaponId() { return this.snap.loadout.arma?.def ?? 'punos'; }
  /** Arco o ballesta (proyectil físico recuperable, munición propia). */
  private isBow() { const d = this.snap.loadout.arma?.def; return d === 'arco' || d === 'ballesta'; }
  private bowAmmo() { return this.snap.loadout.arma?.def === 'ballesta' ? 'virotes' : 'flechas'; }
  private arrowsLeft() { const lo = this.snap.loadout, id = this.bowAmmo(); return countOf(lo.mochila, id) + this.pocketCount(id); }
  private takeArrow() {
    const lo = this.snap.loadout, id = this.bowAmmo();
    if (consume(lo.mochila, id, 1) > 0) return true;
    return this.pocketTake(id);
  }
  private noAmmoText() { return this.bowAmmo() === 'virotes' ? 'Sin virotes' : 'Sin flechas'; }
  /** v3: bolsillo seguro con varias casillas (bolsillo + bolsilloExtra). */
  pocketList(): ItemInst[] { const lo = this.snap.loadout; return [lo.bolsillo ?? null, ...(lo.bolsilloExtra ?? [])].filter((x): x is ItemInst => !!x); }
  pocketCount(id: string) { return this.pocketList().filter(i => i.def === id).reduce((s, i) => s + i.qty, 0); }
  private pocketTake(id: string) {
    const lo = this.snap.loadout;
    if (lo.bolsillo?.def === id) { lo.bolsillo.qty--; if (lo.bolsillo.qty <= 0) lo.bolsillo = null; return true; }
    const ex = lo.bolsilloExtra ?? [];
    const i = ex.findIndex(x => x.def === id);
    if (i < 0) return false;
    ex[i].qty--; if (ex[i].qty <= 0) ex.splice(i, 1);
    return true;
  }

  /** ¿Puede disparar ya? Gestiona recarga y munición (cargador / flechas). Devuelve false si no. */
  private readyRanged(dt: number): boolean {
    const lo = this.snap.loadout, ws = weaponStats(lo.arma), p = this.snap.player;
    if (p.reload > 0) {
      p.reload -= dt;
      if (p.reload <= 0 && lo.arma) { const need = (ws.mag ?? 0) - (lo.arma.mag ?? 0); lo.arma.mag = (lo.arma.mag ?? 0) + consume(lo.mochila, 'municion', need); this.host.refreshInventory(); }
      return false;
    }
    if (ws.mag && lo.arma && (lo.arma.mag ?? 0) <= 0) {
      if (countOf(lo.mochila, 'municion') > 0) p.reload = (ws.reloadSec ?? 1.5) * (1 - this.att('pulso', 'reload'));
      else if (!this.noAmmoWarned) { this.noAmmoWarned = true; this.hud?.toast('¡Sin munición!'); }
      return false;
    }
    if (this.isBow() && this.arrowsLeft() <= 0) {
      if (!this.noAmmoWarned) { this.noAmmoWarned = true; this.hud?.toast(this.noAmmoText()); }
      return false;
    }
    return true;
  }

  /** Dispara un proyectil real hacia `ang`. */
  private fireRanged(ang: number, auto: boolean) {
    const lo = this.snap.loadout, ws = weaponStats(lo.arma);
    if (this.swapT > 0) { this.stats.attacksDuringSwap++; return; }
    if (ws.mag && lo.arma) { lo.arma.mag!--; }
    if (this.isBow() && !this.takeArrow()) return;
    this.noAmmoWarned = false;
    this.attackT = 1 / (ws.aps * (auto ? AIM.autoFireRateMult : 1));
    const { dmg, crit } = this.rollCrit(ws.dmg);
    const ox = this.player.x + Math.cos(ang) * 20, oy = this.player.y + Math.sin(ang) * 20;
    const pj: Proj = this.proj.fire(this.isBow() ? (this.bowAmmo() === 'virotes' ? 'virote' : 'flecha') : 'bala', ox, oy, ang, ws.rangeTiles * TILE, dmg, crit, this.weaponId(), !auto);
    pj.base = ws.dmg;
    if (this.clavarArmed && pj.kind === 'virote') { pj.pierce = BOWS.clavarPierce; this.clavarArmed = false; this.stats.clavarShots++; }
    this.stats.shots++;
    if (!this.isBow()) this.fx.muzzle(this.player.x + Math.cos(ang) * 34, this.player.y + Math.sin(ang) * 34, ang);
    // retroceso: en Android vibración corta; en iOS (sin vibración) más retroceso del arma + golpe y sacudida de cámara
    if (NO_VIBRATE) {
      this.stats.iosKick++;
      this.rig.recoil(AIM.iosRecoilPx);
      this.kick.set(-Math.cos(ang) * AIM.iosCameraKickPx, -Math.sin(ang) * AIM.iosCameraKickPx);
      this.cameras.main.shake(70, AIM.iosShake);
      this.aim?.pulse();
    } else {
      vibrate(AIM.vibrateMs);
      this.rig.recoil(4);
      this.kick.set(-Math.cos(ang) * AIM.cameraKickPx, -Math.sin(ang) * AIM.cameraKickPx);
    }
    if (ws.noise > 0) this.noise(this.player.x, this.player.y, ws.noise * (1 - this.att('sigilo', 'noise')));
    this.host.refreshInventory();
  }

  private onProjHit(pj: Proj, e: Enemy) {
    const ang = Math.atan2(pj.vy, pj.vx);
    // v3.1: si acierta, el 60 % cae junto al enemigo al morir (atravesado por «Clavar»: no se queda clavado)
    const through = pj.pierce > 0 || !!pj.pierced?.has(e);
    if (isPhysical(pj.kind) && !through && Math.random() < BOWS.recoverOnHitChance) { const st = this.stuck.get(e) ?? {}; const id = pj.kind === 'virote' ? 'virotes' : 'flechas'; st[id] = (st[id] ?? 0) + 1; this.stuck.set(e, st); }
    // sigilo: un disparo apuntado (joystick derecho) a un desprevenido aplica x2,5 y crítico
    if (pj.aimed && isUnaware(e)) {
      this.dealDamage(e, this.backstabDmg(pj.base), ang, pj.weapon, true, JUICE.hitStopHeavyMs, true);
      return;
    }
    this.dealDamage(e, pj.dmg, ang, pj.weapon, pj.crit, pj.kind === 'bala' ? 50 : JUICE.hitStopMs);
  }

  /** Desviación actual del disparo (grados): empieza en 9° y se estabiliza a 1,2° tras 0,4 s quieto. */
  spreadDeg() { const k = Phaser.Math.Clamp(this.steadyT / (AIM.steadySec * (1 - this.att('pulso', 'aim'))), 0, 1); return AIM.spreadStartDeg + (AIM.spreadMinDeg - AIM.spreadStartDeg) * k; }

  /** Combate por fotograma: apuntado twin-stick (a distancia), automático (cuerpo a cuerpo o sin tocar el joystick). */
  private combat(dt: number) {
    const lo = this.snap.loadout, ws = weaponStats(lo.arma);
    const aim = this.aim!;
    this.attackT -= dt;
    const g = this.aimGfx!.clear();
    this.rig.aiming = false;
    if (this.swapT > 0 || this.applying) return; // cambiando de arma o curándote: no se ataca ni se apunta
    if (!ws.melee) {
      const ready = this.readyRanged(dt);
      if (aim.aiming) {
        // línea de apuntado (respeta paredes): corta y temblorosa al principio, estable tras 0,4 s quieto
        this.rig.aiming = true;
        if (Math.abs(Phaser.Math.Angle.Wrap(aim.angle - this.steadyRef)) > Phaser.Math.DegToRad(AIM.steadyToleranceDeg)) { this.steadyRef = aim.angle; this.steadyT = 0; }
        else this.steadyT += dt;
        const k = Phaser.Math.Clamp(this.steadyT / (AIM.steadySec * (1 - this.att('pulso', 'aim'))), 0, 1);
        const sp = Phaser.Math.DegToRad(this.spreadDeg());
        const jit = (Math.random() - 0.5) * sp * (1 - k * 0.7);
        const a = aim.angle + jit;
        const R = ws.rangeTiles * TILE * (0.35 + 0.65 * k);
        const x0 = this.player.x + Math.cos(a) * 22, y0 = this.player.y + Math.sin(a) * 22;
        const x1 = this.player.x + Math.cos(a) * R, y1 = this.player.y + Math.sin(a) * R;
        const t = rayHit(this.walls, x0, y0, x1, y1);
        const ex = x0 + (x1 - x0) * t, ey = y0 + (y1 - y0) * t;
        const col = aim.overThreshold ? 0xff6b4a : 0xfff2a8;
        g.lineStyle(5, 0x000000, 0.35).lineBetween(x0, y0, ex, ey);
        g.lineStyle(2, col, 0.55 + 0.4 * k).lineBetween(x0, y0, ex, ey);
        if (t < 1) g.fillStyle(col, 0.9).fillCircle(ex, ey, 3);
        // cono de dispersión
        g.lineStyle(1, col, 0.25).lineBetween(x0, y0, this.player.x + Math.cos(aim.angle + sp / 2) * R * 0.5, this.player.y + Math.sin(aim.angle + sp / 2) * R * 0.5)
          .lineBetween(x0, y0, this.player.x + Math.cos(aim.angle - sp / 2) * R * 0.5, this.player.y + Math.sin(aim.angle - sp / 2) * R * 0.5);
        // pasar del 85 % del radio dispara; soltar antes cancela. Pistola: mantener = fuego continuo a su cadencia
        if (aim.overThreshold) {
          const can = ready && this.attackT <= 0 && (!this.fireLatch || !this.isBow());
          if (can) { this.fireRanged(aim.angle + (Math.random() - 0.5) * sp, false); this.fireLatch = true; }
        } else this.fireLatch = false;
      } else {
        this.steadyT = 0; this.fireLatch = false;
        // sin tocar el joystick de apuntar: disparo automático (más lento) a lo que se ve en pantalla
        if (AIM.autoFireWhenIdle && !aim.active && ready && this.attackT <= 0) {
          const t = this.pickTarget(ws.rangeTiles * TILE, false);
          if (t) { const a = Math.atan2(t.y - this.player.y, t.x - this.player.x); this.facing = a; this.fireRanged(a, true); }
        }
      }
      return;
    }
    // cuerpo a cuerpo: automático hacia donde miras (±75°); el daño entra tras la preparación del golpe (0,12 s)
    if (this.attackT > 0) return;
    const range = ws.rangeTiles * TILE + this.playerRadius;
    const t = this.pickTarget(range, true, 75);
    if (!t) return;
    this.attackT = 1 / ws.aps;
    this.rig.swing();
    const { dmg, crit } = this.rollCrit(ws.dmg);
    const w = this.weaponId();
    this.pendingMelee.push({ t: 0.12, e: t, dmg, crit, weapon: w, range: range * 1.25, heavy: (STAGGER.weapon[w]?.[0] ?? 0) > 250 });
    if (ws.noise > 0) this.noise(this.player.x, this.player.y, ws.noise * (1 - this.att('sigilo', 'noise')));
  }

  private updatePendingMelee(dt: number) {
    for (let i = this.pendingMelee.length - 1; i >= 0; i--) {
      const m = this.pendingMelee[i];
      m.t -= dt;
      if (m.t > 0) continue;
      this.pendingMelee.splice(i, 1);
      if (this.swapT > 0) continue;
      const e = m.e;
      if (e.dead || !e.targetable) continue;
      const d = Math.hypot(e.x - this.player.x, e.y - this.player.y) - e.def.size * 0.3;
      if (d > m.range) continue;
      const ang = Math.atan2(e.y - this.player.y, e.x - this.player.x);
      const arc = this.add.graphics().setDepth(11);
      arc.lineStyle(6, COLORS.hueso, 0.9).beginPath().arc(this.player.x, this.player.y, TILE * 0.9, ang - 0.7, ang + 0.7).strokePath();
      this.tweens.add({ targets: arc, alpha: 0, duration: 160, onComplete: () => arc.destroy() });
      this.dealDamage(e, m.dmg, ang, m.weapon, m.crit, m.heavy ? JUICE.hitStopHeavyMs : JUICE.hitStopMs);
      // golpe que conecta: ruido medio
      this.noise(this.player.x, this.player.y, STEALTH.meleeHitNoise * (1 - this.att('sigilo', 'noise')));
    }
  }

  /** Anillo pequeño de recarga / cambio de arma sobre el jugador. */
  private drawReload() {
    const g = this.reloadGfx; if (!g) return;
    g.clear();
    const p = this.snap.player;
    let k = -1;
    const ap = this.applying;
    if (ap) k = Phaser.Math.Clamp(ap.t / ap.total, 0, 1);
    else if (this.swapT > 0) k = 1 - this.swapT / SWAP.sec;
    else if (p.reload > 0) { const total = (weaponStats(this.snap.loadout.arma).reloadSec ?? 1.5) * (1 - this.att('pulso', 'reload')); k = Phaser.Math.Clamp(1 - p.reload / total, 0, 1); }
    if (k < 0) return;
    const x = this.player.x, y = this.player.y - 34, r = ap ? 10 : 7; // curación: anillo verde algo mayor
    g.fillStyle(COLORS.contorno, 0.6).fillCircle(x, y, r + 2);
    g.lineStyle(3, COLORS.hueso, 0.35).strokeCircle(x, y, r);
    g.lineStyle(ap ? 4 : 3, ap ? 0x4cd964 : this.swapT > 0 ? 0x3c8cff : COLORS.hueso, 1).beginPath().arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2).strokePath();
  }

  // ---------- Arma de reserva ----------
  /** Cambio rápido arma principal ↔ reserva: 0,4 s sin poder atacar. */
  swapWeapon() {
    if (this.paused || this.ended || this.swapT > 0 || this.applying) return false;
    const lo = this.snap.loadout;
    if (!lo.reserva) { this.hud?.toast('Sin arma de reserva', 1); return false; }
    this.swapT = SWAP.sec;
    this.pendingMelee = [];
    this.snap.player.reload = 0;
    this.stats.swaps++;
    return true;
  }

  private finishSwap() {
    const lo = this.snap.loadout;
    const a = lo.arma; lo.arma = lo.reserva ?? null; lo.reserva = a ?? null;
    this.rig.setWeapon(lo.arma?.def ?? null);
    this.refreshAbilities();
    this.attackT = 0; this.noAmmoWarned = false;
    this.hud?.toast(lo.arma ? def(lo.arma).nombre : 'Puños', 0.8);
    this.host.refreshInventory();
  }

  refreshAbilities() {
    const lo = this.snap.loadout;
    const wa = lo.arma ? def(lo.arma).weapon?.ability ?? null : null;
    this.abilityIds = [wa, lo.torso ? def(lo.torso).armor?.ability ?? null : null, lo.cabeza ? def(lo.cabeza).armor?.ability ?? null : null];
  }

  /** Habilidades: las direccionales (golpe, perforante, ráfaga) salen hacia donde miras. */
  useAbility(i: number) {
    if (this.paused || this.ended || this.applying) return;
    const id = this.abilityIds[i];
    if (!id) return;
    const p = this.snap.player;
    if ((p.cds[id] ?? 0) > 0) return;
    const lo = this.snap.loadout;
    const ws = weaponStats(lo.arma);
    const px = this.player.x, py = this.player.y;
    if (this.swapT > 0 && (id === 'golpe' || id === 'perforante' || id === 'rafaga' || id === 'torbellino')) { this.stats.attacksDuringSwap++; return; }
    let ok = true;
    switch (id) {
      case 'golpe': {
        const t = this.pickTarget(ws.rangeTiles * TILE + this.playerRadius + TILE * 0.5, true, 60);
        if (!t) { ok = false; this.hud?.toast('Nadie delante a tu alcance', 1); break; }
        this.rig.swing();
        const ang = Math.atan2(t.y - py, t.x - px);
        const arc = this.add.graphics().setDepth(11);
        arc.lineStyle(8, COLORS.hueso, 0.95).beginPath().arc(px, py, TILE * 1.0, ang - 0.8, ang + 0.8).strokePath();
        this.tweens.add({ targets: arc, alpha: 0, duration: 200, onComplete: () => arc.destroy() });
        { const r = this.rollCrit(30 * ws.dmgMult); this.dealDamage(t, r.dmg, ang, 'bate', r.crit, JUICE.hitStopHeavyMs); }
        t.body.velocity.add(new Phaser.Math.Vector2(Math.cos(ang), Math.sin(ang)).scale(380 / (STAGGER.weight[t.def.type] ?? 1)));
        break;
      }
      case 'torbellino': {
        const r = TILE * 1.8;
        const fx = this.add.circle(px, py, r, COLORS.hueso, 0.18).setStrokeStyle(4, COLORS.hueso).setDepth(11);
        this.tweens.add({ targets: fx, alpha: 0, angle: 360, duration: 300, onComplete: () => fx.destroy() });
        for (const e of [...this.enemies.list]) if (Math.hypot(e.x - px, e.y - py) <= r + e.def.size * 0.3) { const r = this.rollCrit(15 * ws.dmgMult); this.dealDamage(e, r.dmg, Math.atan2(e.y - py, e.x - px), 'machete', r.crit); e.bleed = 4; }
        break;
      }
      case 'perforante': {
        if (this.isBow() && !this.takeArrow()) { ok = false; this.hud?.toast(this.noAmmoText(), 1); break; }
        const ang = this.facing;
        let L = ws.rangeTiles * TILE;
        L *= rayHit(this.walls, px, py, px + Math.cos(ang) * L, py + Math.sin(ang) * L);
        const hits = this.enemies.list.filter(e => e.targetable).map(e => {
          const rx = e.x - px, ry = e.y - py;
          const along = rx * Math.cos(ang) + ry * Math.sin(ang);
          const perp = Math.abs(-rx * Math.sin(ang) + ry * Math.cos(ang));
          return { e, along, perp };
        }).filter(h => h.along > 0 && h.along < L && h.perp < h.e.def.size * 0.45).sort((a, b) => a.along - b.along).slice(0, 3);
        const tr = this.add.graphics().setDepth(12);
        tr.lineStyle(4, 0xfff2a8, 0.9).lineBetween(px, py, px + Math.cos(ang) * L, py + Math.sin(ang) * L);
        this.tweens.add({ targets: tr, alpha: 0, duration: 200, onComplete: () => tr.destroy() });
        for (const h of hits) { const r = this.rollCrit(ws.dmg * 1.5); this.dealDamage(h.e, r.dmg, ang, 'arco', r.crit); }
        this.dropArrow(px + Math.cos(ang) * (L - 8), py + Math.sin(ang) * (L - 8), 1);
        if (ws.noise > 0) this.noise(px, py, ws.noise);
        break;
      }
      case 'clavar': {
        if (this.arrowsLeft() <= 0) { ok = false; this.hud?.toast('Sin virotes', 1); break; }
        this.clavarArmed = true;
        this.hud?.toast('Clavar: el siguiente virote atraviesa', 1.2);
        break;
      }
      case 'rafaga': {
        if (!lo.arma || (lo.arma.mag ?? 0) <= 0) { ok = false; this.hud?.toast('Cargador vacío', 1); break; }
        for (let k = 0; k < 5; k++) this.time.delayedCall(k * 90, () => {
          if (this.ended || this.swapT > 0 || !lo.arma || (lo.arma.mag ?? 0) <= 0 || lo.arma.def !== 'pistola') return;
          this.attackT = 0;
          this.fireRanged(this.facing + (Math.random() - 0.5) * Phaser.Math.DegToRad(6), false);
        });
        break;
      }
      case 'aguantar': p.aguantar = 3; break; // sin texto arriba: icono sobre el personaje (§8.4)
      case 'escanear': this.scanT = PRUEBA_V2.scanSec; break;
    }
    if (ok) p.cds[id] = ABILITIES[id].cooldown;
  }
  // ---------- Consumibles ----------
  useQuick(slot: 1 | 2 = 1) {
    if (slot === 2 && quickSlots(this.snap.loadout) < 2) return;
    this.useConsumable(this.quickItem(slot), true);
  }
  /** Consumible de cada botón rápido: el 1.º el preferido (o el otro si no tienes); el 2.º (v4, mochila), el otro. */
  quickItem(slot: 1 | 2): string {
    const pref = this.settings.rapido;
    const other = pref === 'vendaje' ? 'botiquin' : 'vendaje';
    const first = this.hasItem(pref) ? pref : other;
    return slot === 1 ? first : first === pref ? other : pref;
  }

  private hasItem(id: string) { return countOf(this.snap.loadout.mochila, id) > 0 || this.pocketCount(id) > 0; }

  /** Curación en curso (§8.8): se aplica al terminar; hold = desde el botón rápido (soltar cancela). */
  applying: { id: string; t: number; total: number; hold: boolean; pointerId: number | null } | null = null;
  /** QA: curaciones completadas / canceladas (y por qué). */
  healStats = { done: 0, cancelHit: 0, cancelRelease: 0 };
  private tapPointer: number | null = null;

  cancelApply(why: 'golpe' | 'soltar') {
    if (!this.applying) return;
    this.applying = null;
    if (why === 'golpe') this.healStats.cancelHit++; else this.healStats.cancelRelease++;
    this.hud?.toast(why === 'golpe' ? 'Curación interrumpida por un golpe (no se gasta)' : 'Curación cancelada (no se gasta)', 1.2);
  }

  private updateApply(dt: number) {
    const a = this.applying; if (!a) return;
    a.t += dt;
    if (a.t >= a.total) { this.applying = null; this.finishConsumable(a.id); }
  }

  /** Empieza a aplicar un consumible (no se gasta hasta terminar). */
  useConsumable(id: string, hold = false) {
    if (this.ended || this.paused) return false;
    if (this.applying) return false;
    const p = this.snap.player;
    const S = PRUEBA_V2.status;
    const cures = (S.curaSangrado.includes(id) && (p.bleed?.length ?? 0) > 0) || (S.curaVeneno.includes(id) && (p.poison?.length ?? 0) > 0);
    if (p.healLeft > 0 && !cures) { this.hud?.toast('Ya te estás curando', 1); return false; }
    if (p.hp >= PLAYER_MAX_HP && !cures) { this.hud?.toast('Vida al máximo', 1); return false; }
    const h = ITEMS[id]?.heal;
    if (!h) return false;
    if (!this.hasItem(id)) { this.hud?.toast(`No tienes ${ITEMS[id].nombre.toLowerCase()}`, 1); return false; }
    const total = (PRUEBA_V2.applySec[id] ?? 0) * useTimeMult(this.snap.loadout) * (1 - this.medK('time')); // v4: mochila táctica −15 %; v4.0: Medicina
    if (total <= 0) return this.finishConsumable(id);
    this.applying = { id, t: 0, total, hold, pointerId: hold ? this.tapPointer : null };
    this.pendingMelee = [];
    return true;
  }

  private finishConsumable(id: string) {
    const p = this.snap.player, S = PRUEBA_V2.status;
    const h = ITEMS[id]?.heal;
    if (!h) return false;
    const lo = this.snap.loadout;
    if (consume(lo.mochila, id, 1) === 0 && !this.pocketTake(id)) { this.hud?.toast(`No tienes ${ITEMS[id].nombre.toLowerCase()}`, 1); return false; }
    this.healStats.done++;
    if (this.snap.track) this.snap.track.heals++;
    const amt = h.amount * (1 + this.medK('heal'));
    p.healLeft = amt; p.healRate = amt / h.seconds;
    const cured: string[] = [];
    if (S.curaSangrado.includes(id) && p.bleed?.length) { p.bleed = []; cured.push('sangrado'); }
    if (S.curaVeneno.includes(id) && p.poison?.length) { p.poison = []; cured.push('veneno'); }
    this.hud?.toast(`${ITEMS[id].nombre}: +${Math.round(amt)}${cured.length ? ' · fuera ' + cured.join(' y ') : ''}`, 1.2);
    this.host.refreshInventory();
    return true;
  }

  private autoHeal() {
    const p = this.snap.player;
    const th = this.settings.curarUmbral;
    if (th <= 0 || p.healLeft > 0 || this.applying || (p.hp / PLAYER_MAX_HP) * 100 >= th) return;
    const deficit = PLAYER_MAX_HP - p.hp;
    const order = deficit > 45 ? ['botiquin', 'vendaje'] : ['vendaje', 'botiquin'];
    for (const id of order) if (this.hasItem(id)) { this.useConsumable(id); return; }
  }

  private useFlare() {
    const lo = this.snap.loadout;
    if (consume(lo.mochila, 'bengala', 1) > 0 || this.pocketTake('bengala')) { this.host.refreshInventory(); return true; }
    return false;
  }

  /** Objeto que se entregaría en la salida de pago: el Reforzado+ de MENOR valor (mochila y bolsillo primero, luego equipado). */
  payItem(): ItemInst | null {
    const lo = this.snap.loadout;
    const pick = (list: ItemInst[]) => list.filter(i => !i.free && rarityAtLeast(i.rarity, 'reforzado')).sort((a, b) => itemValue(a) - itemValue(b))[0] ?? null;
    return pick([...lo.mochila, ...this.pocketList()]) ?? pick([lo.reserva ?? null, lo.cabeza, lo.torso, lo.arma].filter((x): x is ItemInst => !!x));
  }

  private pay() {
    const it = this.payItem();
    if (!it) return false;
    this.removeItem(it.uid);
    this.host.refreshInventory();
    return true;
  }

  // ---------- Inventario (llamado desde la UI) ----------
  findItem(uid: string): { it: ItemInst; where: 'arma' | 'reserva' | 'torso' | 'cabeza' | 'bolsillo' | 'espalda' | 'bolsilloExtra' | 'mochila' } | null {
    const lo = this.snap.loadout;
    for (const k of ['arma', 'reserva', 'torso', 'cabeza', 'bolsillo', 'espalda'] as const) if (lo[k]?.uid === uid) return { it: lo[k]!, where: k };
    const ex = lo.bolsilloExtra?.find(i => i.uid === uid);
    if (ex) return { it: ex, where: 'bolsilloExtra' };
    const it = lo.mochila.find(i => i.uid === uid);
    return it ? { it, where: 'mochila' } : null;
  }

  /** Quita un objeto (una sola vez, por uid: imposible duplicar). */
  removeItem(uid: string): ItemInst | null {
    const f = this.findItem(uid);
    if (!f) return null;
    const lo = this.snap.loadout;
    if (f.where === 'mochila') lo.mochila.splice(lo.mochila.indexOf(f.it), 1);
    else if (f.where === 'bolsilloExtra') lo.bolsilloExtra!.splice(lo.bolsilloExtra!.indexOf(f.it), 1);
    else lo[f.where] = null;
    if (f.where === 'arma' || f.where === 'torso' || f.where === 'cabeza') this.refreshAbilities();
    if (f.where === 'arma') this.rig.setWeapon(null);
    return f.it;
  }

  invEquip(uid: string) {
    if (!this.canEditInventory()) return;
    const f = this.findItem(uid); if (!f || f.where !== 'mochila') return;
    const slot = slotOf(f.it); if (!slot) return;
    const lo = this.snap.loadout;
    const prev = lo[slot] ?? null;
    if (slot === 'espalda' && lo.mochila.length - 1 + (prev && !prev.free ? 1 : 0) > backpackSlots({ ...lo, espalda: f.it })) { this.hud?.toast('No cabe todo en esa mochila'); return; }
    lo.mochila.splice(lo.mochila.indexOf(f.it), 1);
    lo[slot] = f.it;
    if (slot === 'arma' && prev && !prev.free) {
      // v2 (Basu): el arma anterior pasa a la reserva; la que había en reserva vuelve a la mochila
      const old = lo.reserva ?? null;
      lo.reserva = prev;
      if (old) lo.mochila.push(old);
    } else if (prev && !prev.free) lo.mochila.push(prev); // cabe: acabamos de liberar una casilla
    if (slot === 'arma') { this.rig.setWeapon(f.it.def); this.swapT = 0; }
    this.refreshAbilities();
    this.host.refreshInventory();
  }

  invUnequip(slot: 'arma' | 'reserva' | 'torso' | 'cabeza' | 'espalda') {
    if (!this.canEditInventory()) return;
    const lo = this.snap.loadout; const it = lo[slot]; if (!it) return;
    if (slot === 'espalda') {
      // la mochila puesta pasa a ocupar una casilla de la mochila base: tiene que caber todo
      // v4: sin mochila quedan los bolsillos (6); la escolar gratuita se descarta al quitarla
      if (lo.mochila.length + (it.free ? 0 : 1) > backpackSlots({ ...lo, espalda: null })) { this.hud?.toast('Vacía la mochila antes de quitártela'); return; }
      lo.espalda = null; if (!it.free) lo.mochila.push(it); this.host.refreshInventory(); return;
    }
    if (it.free) { lo[slot] = null; }
    else { if (backpackAdd(lo, it)) { this.hud?.toast('Mochila llena'); return; } lo[slot] = null; }
    if (slot === 'arma') this.rig.setWeapon(null);
    this.refreshAbilities();
    this.host.refreshInventory();
  }

  invToPocket(uid: string) {
    if (!this.canEditInventory()) return;
    const lo = this.snap.loadout;
    const f = this.findItem(uid); if (!f || f.where !== 'mochila') return;
    if (!canPocket(f.it)) { this.hud?.toast('Solo objetos pequeños en el bolsillo seguro'); return; }
    lo.mochila.splice(lo.mochila.indexOf(f.it), 1);
    const slots = this.snap.pocketSlots ?? 1;
    lo.bolsilloExtra ??= [];
    if (!lo.bolsillo) lo.bolsillo = f.it;
    else if (1 + lo.bolsilloExtra.length < slots) lo.bolsilloExtra.push(f.it);
    else { const prev = lo.bolsillo; lo.bolsillo = f.it; lo.mochila.push(prev); }
    this.host.refreshInventory();
  }

  invFromPocket(uid?: string) {
    if (!this.canEditInventory()) return;
    const lo = this.snap.loadout;
    const f = uid ? this.findItem(uid) : lo.bolsillo ? { it: lo.bolsillo, where: 'bolsillo' as const } : null;
    if (!f || (f.where !== 'bolsillo' && f.where !== 'bolsilloExtra')) return;
    if (backpackAdd(lo, f.it)) { this.hud?.toast('Mochila llena'); return; }
    this.removeItem(f.it.uid);
    // el bolsillo principal no se queda vacío si hay extras
    if (!lo.bolsillo && lo.bolsilloExtra?.length) lo.bolsillo = lo.bolsilloExtra.shift()!;
    this.host.refreshInventory();
  }

  invDrop(uid: string) {
    if (!this.canEditInventory()) return;
    const lo = this.snap.loadout;
    if (lo.espalda?.uid === uid && lo.mochila.length > backpackSlots({ ...lo, espalda: null })) { this.hud?.toast('Vacía la mochila antes de tirarla'); return; }
    const it = this.removeItem(uid); if (!it) return;
    if (it.free) { this.host.refreshInventory(); return; }
    const near = this.nearContainer(LOOT_REACH_TILES * TILE);
    if (near && near.snap.kind === 'cadaver') near.snap.items.push(it);
    else this.addContainer({ id: this.nextContainerId++, x: this.player.x + 10, y: this.player.y + 10, kind: 'cadaver', items: [it], opened: true });
    this.host.refreshInventory();
  }

  invTake(containerId: number, uid: string) {
    if (!this.canEditInventory()) return;
    const o = this.containers.find(c => c.snap.id === containerId);
    if (!o || !o.snap.opened || Math.hypot(o.snap.x - this.player.x, o.snap.y - this.player.y) > LOOT_REACH_TILES * TILE * 1.3) return;
    const idx = o.snap.items.findIndex(i => i.uid === uid); if (idx < 0) return;
    const it = o.snap.items[idx];
    const left = backpackAdd(this.snap.loadout, it);
    if (left) { this.hud?.toast('Mochila llena'); return; }
    o.snap.items.splice(idx, 1);
    this.refreshContainer(o);
    this.host.refreshInventory();
  }

  invUse(uid: string) {
    const f = this.findItem(uid); if (!f) return;
    const d = ITEMS[f.it.def];
    if (d.heal) this.useConsumable(f.it.def);
    else if (d.effect) this.useEffect(f.it.def);
    else if (d.kind === 'granada') this.throwGrenade();
  }

  /** Consume 1 de la mochila o del bolsillo. */
  private takeOne(id: string) { return consume(this.snap.loadout.mochila, id, 1) > 0 || this.pocketTake(id); }

  /** v3: adrenalina, antídoto, estimulante de visión (instantáneos). */
  useEffect(id: string) {
    if (this.ended || this.paused) return false;
    const fx = this.snap.fx ??= {};
    const N = NEW_ITEMS;
    if (!this.takeOne(id)) return false;
    if (id === 'adrenalina') { fx.adren = N.adrenalina.sec; this.hud?.toast('Adrenalina: +25 % velocidad, -30 % daño (8 s)', 1.5); }
    if (id === 'antidoto') { fx.antidoto = N.antidoto.immuneSec; this.snap.player.poison = []; this.hud?.toast('Antídoto: sin veneno y protegido 30 s', 1.5); }
    if (id === 'estimulante') { fx.estim = N.estimulante.sec; this.hud?.toast('Estimulante: ves enemigos a 8 casillas (25 s)', 1.5); }
    this.host.refreshInventory();
    return true;
  }

  /** v3: granada hacia donde miras (5 casillas o hasta la pared); aviso en el suelo y 1 s de mecha. */
  throwGrenade() {
    if (this.ended || this.paused) return false;
    const G = NEW_ITEMS.granada;
    if (!this.takeOne('granada')) { this.hud?.toast('No tienes granadas', 1); return false; }
    const a = this.aim?.aiming ? this.aim.angle : this.facing;
    const L = G.throwTiles * TILE;
    const t = rayHit(this.walls, this.player.x, this.player.y, this.player.x + Math.cos(a) * L, this.player.y + Math.sin(a) * L);
    const x = this.player.x + Math.cos(a) * L * Math.max(0, t - 0.04), y = this.player.y + Math.sin(a) * L * Math.max(0, t - 0.04);
    const warn = this.add.graphics().setDepth(15);
    const img = this.add.text(this.player.x, this.player.y, '💣', { fontSize: '20px' }).setOrigin(0.5).setDepth(15.5);
    this.tweens.add({ targets: img, x, y, duration: 260, ease: 'Quad.easeOut' });
    this.grenades.push({ x, y, t: G.fuseSec, warn, img });
    this.v3s.grenades++;
    this.host.refreshInventory();
    return true;
  }

  private updateGrenades(dt: number) {
    const G = NEW_ITEMS.granada, r = G.radiusTiles * TILE;
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      g.t -= dt;
      const k = 1 - Math.max(0, g.t) / G.fuseSec;
      g.warn.clear().fillStyle(0xff3b30, 0.12 + 0.18 * k).fillCircle(g.x, g.y, r).lineStyle(3, 0xff3b30, 0.9).strokeCircle(g.x, g.y, r);
      if (g.t > 0) continue;
      g.warn.destroy(); g.img.destroy(); this.grenades.splice(i, 1);
      for (const e of [...this.enemies.list]) {
        if (!e.targetable || Math.hypot(e.x - g.x, e.y - g.y) > r + e.def.size * 0.3) continue;
        if (!lineClear(this.walls, g.x, g.y, e.x, e.y)) continue;
        this.v3s.grenadeHits++;
        { const r = this.rollCrit(G.dmg); this.dealDamage(e, r.dmg, Math.atan2(e.y - g.y, e.x - g.x), 'granada', r.crit, JUICE.hitStopHeavyMs); }
      }
      if (Math.hypot(this.player.x - g.x, this.player.y - g.y) <= r && lineClear(this.walls, g.x, g.y, this.player.x, this.player.y)) this.damagePlayer(G.dmg * G.selfMult, 'Tu granada');
      const fx = this.add.circle(g.x, g.y, r, 0xffb347, 0.55).setDepth(20);
      this.tweens.add({ targets: fx, alpha: 0, scale: 1.25, duration: 320, onComplete: () => fx.destroy() });
      this.fx.stain(g.x, g.y, false, 1.1);
      this.cameras.main.shake(140, 0.009);
      this.noise(g.x, g.y, G.noise);
      vibrate(80);
    }
  }

  canEditInventory() { return !this.paused && !this.ended; }

  toggleInventory() {
    if (this.paused || this.ended) { this.hud?.toast('Con el juego en pausa el inventario está bloqueado', 1.5); return; }
    if (this.host.isInventoryOpen()) this.host.closeInventory(); else this.host.openInventory();
  }

  nearContainer(reach: number): ContainerObj | null {
    let best: ContainerObj | null = null, bd = reach;
    for (const c of this.containers) {
      const d = Math.hypot(c.snap.x - this.player.x, c.snap.y - this.player.y);
      if (d <= bd) { bd = d; best = c; }
    }
    return best;
  }

  /** Contenedor abierto cercano para la UI del inventario. */
  openContainerNear(): ContainerSnap | null {
    const c = this.nearContainer(LOOT_REACH_TILES * TILE * 1.3);
    return c && c.snap.opened ? c.snap : null;
  }

  // ---------- Looteo ----------
  /** v2: se puede lootear con enemigos cerca (en tiempo real). Un golpe PAUSA el anillo (~0,6 s), no lo reinicia. */
  private updateLoot(dt: number, moving: boolean) {
    const L = this.loot;
    const c = this.nearContainer(LOOT_REACH_TILES * TILE);
    // al alejarse, se puede volver a lootear ese contenedor
    for (const id of [...L.done]) { const o = this.containers.find(x => x.snap.id === id); if (!o || Math.hypot(o.snap.x - this.player.x, o.snap.y - this.player.y) > LOOT_REACH_TILES * TILE * 1.5) L.done.delete(id); }
    const can = c && c.snap.items.length > 0 && !L.done.has(c.snap.id) && !moving;
    if (!can || c !== L.c) { L.t = 0; L.pause = 0; L.c = can ? c : null; }
    if (!L.ring) L.ring = this.add.graphics().setDepth(12);
    L.ring.clear();
    if (!can || !c) return;
    const need = (c.snap.kind === 'cerrada' && !c.snap.opened ? LOCKED_CRATE_SEC : LOOT_RING_SEC) / (1 + this.att('agilidad', 'loot'));
    if (L.t === 0 && L.pause <= 0 && c.snap.kind === 'cerrada' && !c.snap.opened) { this.noise(c.snap.x, c.snap.y, STEALTH.crateNoise); this.hud?.toast('La caja cerrada cruje… hace ruido', 1.5); }
    const paused = L.pause > 0;
    if (paused) L.pause -= dt; else L.t += dt;
    const k = Math.min(1, L.t / need);
    L.ring.lineStyle(6, 0x000000, 0.6).strokeCircle(c.snap.x, c.snap.y, 30);
    L.ring.lineStyle(5, paused ? 0xff3b30 : COLORS.hueso, 1).beginPath().arc(c.snap.x, c.snap.y, 30, -Math.PI / 2, -Math.PI / 2 + Math.max(0.001, k) * Math.PI * 2).strokePath();
    if (L.t >= need) {
      L.t = 0; L.done.add(c.snap.id);
      if (!c.snap.opened && c.snap.kind !== 'cadaver') this.gainXp(XP.container, 'cajas');
      c.snap.opened = true;
      const got: string[] = []; let full = false;
      const min = this.settings.rarezaMin;
      for (const it of [...c.snap.items]) {
        if (ITEMS[it.def].rolls && !rarityAtLeast(it.rarity, min)) continue;
        const before = it.qty;
        const left = backpackAdd(this.snap.loadout, it);
        if (!left) { c.snap.items.splice(c.snap.items.indexOf(it), 1); got.push(itemLabel({ ...it, qty: before })); }
        else { full = true; if (left.qty < before) got.push(`${ITEMS[it.def].nombre} ×${before - left.qty}`); }
      }
      this.refreshContainer(c);
      this.hud?.toast((got.length ? 'Recogido: ' + got.join(', ') : 'Nada que cumpla tu filtro') + (full ? '\nMochila llena' : '') + (c.snap.items.length ? '\n(abre la mochila para ver el resto)' : ''), 2.5);
      this.host.refreshInventory();
      this.persist();
    }
  }

  /** Estado del looteo (QA). */
  lootState() { return { id: this.loot.c?.snap.id ?? null, t: this.loot.t, paused: this.loot.pause > 0 }; }

  // ---------- Salidas vistas ----------
  private exitVisibleNow(loc: number) {
    const p = this.map.exitLocs[loc];
    return !!p && this.visible(p.x, p.y, EXIT_RADIUS_TILES * TILE * 0.6);
  }

  private checkExitsSeen() {
    this.map.exitLocs.forEach((_, i) => {
      if (this.seen.has(i) || !this.exitVisibleNow(i)) return;
      this.seen.add(i);
      if (i < 3) this.host.markExitSeen(this.map.id, i);
      const ex = this.snap.exits.find(e => e.loc === i);
      this.hud?.toast(`Salida descubierta: ${this.extraction.locName(i)}${ex ? ` (${EXIT_NAMES[ex.type]})` : ' · cerrada en esta raid'}`, 2.5);
    });
  }
  seenExitList() { return [...this.seen].sort(); }
  private inSnow = false;
  /** QA: último estado de la extracción. */
  lastExt: ExtractionStatus | null = null;
  /** v4: aviso al entrar en la Zona Helada. */
  private checkSnowEnter() {
    const now = this.snowy(this.player.x, this.player.y);
    if (now && !this.inSnow) this.hud?.toast('❄ Zona Helada: enemigos más duros, mejor botín', 2.5);
    this.inSnow = now;
  }

  // ---------- Estados (veneno / sangrado) e indicadores ----------
  /** Añade cargas (máx. 5 por tipo; si está lleno se renueva la más gastada). Cada carga lleva su temporizador. */
  detectSlow() { return this.att('sigilo', 'suspicion'); }
  addStatus(kind: 'bleed' | 'poison', stacks: number) {
    if (this.ended || this.god || stacks <= 0) return;
    if (kind === 'poison' && (this.snap.fx?.antidoto ?? 0) > 0) return;
    const S = PRUEBA_V2.status, p = this.snap.player;
    const arr = (kind === 'bleed' ? (p.bleed ??= []) : (p.poison ??= []));
    const dur = (kind === 'bleed' ? S.bleedSec : S.poisonSec) * (1 - this.att('resistencia', 'dot'));
    for (let i = 0; i < stacks; i++) {
      if (arr.length < S.maxStacks) arr.push(dur);
      else { let m = 0; for (let k = 1; k < arr.length; k++) if (arr[k] < arr[m]) m = k; arr[m] = dur; }
    }
  }

  /** Cada carga hace 7,5 en total repartido en su duración (sangrado 1,25/s, veneno 1,9/s); se aplica cada 0,5 s sin hit-stop. */
  private updateStatus(dt: number) {
    const S = PRUEBA_V2.status, p = this.snap.player;
    for (const kind of ['bleed', 'poison'] as const) {
      const arr = kind === 'bleed' ? p.bleed : p.poison;
      if (!arr || !arr.length) continue;
      const dps = S.stackDmg / (kind === 'bleed' ? S.bleedSec : S.poisonSec);
      for (let i = arr.length - 1; i >= 0; i--) {
        const t = Math.min(dt, arr[i]);
        this.statusAcc[kind] += dps * t;
        arr[i] -= dt;
        if (arr[i] <= 1e-6) arr.splice(i, 1);
      }
    }
    this.statusTickT -= dt;
    const empty = !(p.bleed?.length) && !(p.poison?.length);
    if (this.statusTickT <= 0 || empty) {
      this.statusTickT = S.tickSec;
      for (const kind of ['bleed', 'poison'] as const) {
        const n = this.statusAcc[kind];
        if (n <= 0) continue;
        this.statusAcc[kind] = 0;
        this.statusDealt[kind] += n;
        this.damagePlayer(n, kind === 'bleed' ? 'Sangrado' : 'Veneno', false);
        this.hud?.pulseHp(kind === 'bleed' ? 0xff3b30 : 0x9fe03a);
        this.miniFlashT = 0.25;
      }
    }
  }
  private miniFlashT = 0;
  /** QA: ¿se ve la mini barra de vida? */
  miniShown = false;

  /** Iconos de habilidad activa (18 px, arco que se vacía), mini barra de vida (36×4) y estados (14 px con cargas). */
  private drawPlayerMarks(dt: number) {
    const g = this.markG ??= this.add.graphics().setDepth(32);
    g.clear();
    const P = PRUEBA_V2, p = this.snap.player, x = this.player.x, y = this.player.y;
    const used = new Set<string>();
    const img = (key: string, px: number, ix: number, iy: number) => {
      let o = this.markImgs.get(key);
      if (!o) { o = this.add.image(0, 0, key).setDepth(31.5); this.markImgs.set(key, o); }
      o.setTexture(key).setDisplaySize(px, px).setPosition(ix, iy).setVisible(true);
      used.add(key);
      return o;
    };
    // habilidades activas en fila sobre la cabeza
    const act = [
      { key: 'hab_aguantar', left: p.aguantar, total: 3 },
      { key: 'hab_escanear', left: this.scanT, total: P.scanSec },
    ].filter(a => a.left > 0);
    const ringOn = !!this.applying || this.swapT > 0 || p.reload > 0; // el anillo de progreso va justo encima de la cabeza: la fila sube
    const s = P.abilityIconPx, gap = 4, ay = y - (ringOn ? 62 : 46);
    act.forEach((a, i) => {
      const ax = x + (i - (act.length - 1) / 2) * (s + gap);
      img(a.key, s, ax, ay);
      const k = Phaser.Math.Clamp(a.left / a.total, 0, 1);
      g.lineStyle(2.5, 0x14110f, 0.8).strokeCircle(ax, ay, s / 2 + 2);
      g.lineStyle(2, 0xffd23c, 1).beginPath().arc(ax, ay, s / 2 + 2, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2, false).strokePath();
    });
    // mini barra de vida bajo el personaje
    const k = Phaser.Math.Clamp(p.hp / PLAYER_MAX_HP, 0, 1);
    const showBar = k < P.miniHpLowPct || this.snap.elapsed < this.miniHpUntil;
    this.miniShown = showBar;
    if (this.miniFlashT > 0) this.miniFlashT -= dt;
    const bw = P.miniHpW, bh = P.miniHpH, bx = x - bw / 2, by = y + 30;
    if (showBar) {
      // mismos colores y forma que barra_vida.svg de Basu
      g.fillStyle(0x14110f, 0.9).fillRoundedRect(bx - 1, by - 1, bw + 2, bh + 2, 3);
      g.fillStyle(this.miniFlashT > 0 ? 0xffffff : k < P.miniHpLowPct ? 0xff3b30 : 0x4cd964, 1).fillRoundedRect(bx, by, Math.max(1, bw * k), bh, 2);
    }
    // v4.0: barra de experiencia dorada (36×2) bajo el personaje; la mini barra de vida va encima. Lo no asegurado, más claro.
    { const pr = this.host?.saveData?.()?.prog;
      if (pr) {
        const need = xpToNext(pr.level), U = XP_UI, xw = U.barW, xx = x - xw / 2, xy = by + bh + 3;
        const kb = Phaser.Math.Clamp(pr.xp / need, 0, 1), kp = Phaser.Math.Clamp((pr.xp + (this.snap.xp ?? 0)) / need, 0, 1);
        g.fillStyle(U.back, 0.85).fillRect(xx - 1, xy - 1, xw + 2, U.barH + 2);
        if (kp > kb) g.fillStyle(U.pendingColor, U.pendingAlpha).fillRect(xx, xy, xw * kp, U.barH);
        g.fillStyle(U.color, 1).fillRect(xx, xy, Math.max(0.5, xw * kb), U.barH);
      } }
    // estados con número de cargas, al lado de la barra
    const st = [
      { key: 'estado_sangrado', n: p.bleed?.length ?? 0 },
      { key: 'estado_veneno', n: p.poison?.length ?? 0 },
    ].filter(a => a.n > 0);
    st.forEach((a, i) => {
      const ix = x + bw / 2 + 10 + i * 26, iy = by + bh / 2;
      img(a.key, P.statusIconPx, ix, iy);
      let t = this.markTxt.get(a.key);
      if (!t) { t = this.add.text(0, 0, '', { fontFamily: 'system-ui, sans-serif', fontSize: '11px', fontStyle: 'bold', color: '#fff', stroke: '#000', strokeThickness: 3 }).setOrigin(0, 0.5).setDepth(31.6); this.markTxt.set(a.key, t); }
      t.setText(String(a.n)).setPosition(ix + 7, iy + 2).setVisible(true);
    });
    for (const [k2, o] of this.markImgs) if (!used.has(k2)) o.setVisible(false);
    for (const [k2, t] of this.markTxt) if (!st.some(a => a.key === k2)) t.setVisible(false);
  }

  // ---------- Sigilo ----------
  private setupStealth() {
    this.makeDebrisTextures();
    const ringKey = this.textures.exists('ui_anillo_ruido') ? 'ui_anillo_ruido' : null;
    if (ringKey) this.noiseRing = this.add.image(this.player.x, this.player.y, ringKey).setDepth(4.6).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
    this.conesGfx = this.add.graphics().setDepth(4.4);
    // cristales y latas: reproducibles por semilla (no hace falta guardarlos)
    const rng = seeded((this.snap.seed ^ 0x5eed1e) >>> 0);
    const floors = this.map.floors;
    const sp = this.map.spawn;
    for (let i = 0, tries = 0; i < STEALTH.debrisCount && tries < STEALTH.debrisCount * 20; tries++) {
      let x: number, y: number;
      if (floors.length && rng() < 0.7) { const f = floors[Math.floor(rng() * floors.length)]; x = f.x + TILE * 0.5 + rng() * Math.max(1, f.w - TILE); y = f.y + TILE * 0.5 + rng() * Math.max(1, f.h - TILE); }
      else { x = TILE * 2 + rng() * (WORLD - TILE * 4); y = TILE * 2 + rng() * (WORLD - TILE * 4); }
      if (pointInWalls(this.walls, x, y, TILE * 0.4) || Math.hypot(x - sp.x, y - sp.y) < TILE * 5) continue;
      const lata = rng() < 0.4;
      const img = this.add.image(x, y, lata ? 'suelo_lata' : 'suelo_cristal').setDepth(4.3).setRotation(rng() * Math.PI * 2).setVisible(false);
      this.debris.push({ x, y, img, cd: 0 });
      i++;
    }
  }

  /** Texturas de suelo hechas a mano (no son arte de Basu): cristales rotos y lata aplastada. */
  private makeDebrisTextures() {
    if (!this.textures.exists('suelo_cristal')) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xbfe6ff, 0.85);
      g.fillTriangle(4, 14, 12, 3, 15, 12); g.fillTriangle(17, 18, 26, 9, 25, 20); g.fillTriangle(9, 24, 15, 19, 18, 28); g.fillTriangle(22, 4, 28, 3, 26, 8);
      g.lineStyle(1, 0xffffff, 0.9); g.lineBetween(12, 3, 15, 12); g.lineBetween(26, 9, 25, 20);
      g.generateTexture('suelo_cristal', 32, 32); g.destroy();
    }
    if (!this.textures.exists('suelo_lata')) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0x8a8f96, 1).fillRoundedRect(6, 10, 20, 12, 3);
      g.fillStyle(0xc8473a, 1).fillRect(11, 10, 8, 12);
      g.fillStyle(0xd8dde2, 1).fillEllipse(6, 16, 5, 12);
      g.lineStyle(1, 0x2a2420, 0.9).strokeRoundedRect(6, 10, 20, 12, 3);
      g.generateTexture('suelo_lata', 32, 32); g.destroy();
    }
  }

  /** Radio de ruido del paso actual (casillas): sigilo 1, andar 3, correr 6; chaleco militar +1; carga +1/+2 (v4). */
  footNoise() {
    const sp = this.vel.length();
    if (this.moveTier === 'quieto' || sp < 12) return 0;
    const base = this.moveTier === 'sigilo' ? STEALTH.sigiloNoise : this.moveTier === 'andar' ? STEALTH.andarNoise : STEALTH.correrNoise;
    // v4 §1: ir cargado hace ruido (>12 de peso +1 casilla, >20 +2)
    return (base + (this.snap.loadout.torso?.def === 'chaleco' ? STEALTH.heavyArmorNoise : 0) + loadNoiseTiles(this.snap.loadout)) * (1 - this.att('sigilo', 'noise'));
  }

  private updateStealth(dt: number) {
    const px = this.player.x, py = this.player.y;
    // pasos: ruido cada 0,25 s (no atrae hordas: solo el ruido fuerte puntual)
    this.noiseTiles = this.footNoise();
    this.stepT -= dt;
    if (this.stepT <= 0) { this.stepT = STEALTH.stepEverySec; if (this.noiseTiles > 0) this.enemies.noise(px, py, this.noiseTiles); }
    // anillo de ruido (arte de Basu: anillo de radio 60 en 128)
    const want = this.noiseTiles * TILE;
    this.ringR += (want - this.ringR) * Math.min(1, dt * 10);
    if (this.noiseRing) {
      const vis = this.ringR > 4;
      this.noiseRing.setVisible(vis).setPosition(px, py);
      if (vis) this.noiseRing.setDisplaySize(this.ringR * 2 * 128 / 120, this.ringR * 2 * 128 / 120).setAlpha(0.22 + 0.25 * Math.min(1, this.noiseTiles / STEALTH.correrNoise));
    }
    // cristales y latas
    for (const d of this.debris) {
      if (d.cd > 0) d.cd -= dt;
      if (Math.abs(d.x - px) > TILE || Math.abs(d.y - py) > TILE) continue;
      if (d.cd > 0 || this.vel.length() < 12 || Math.hypot(d.x - px, d.y - py) > STEALTH.debrisStepTiles * TILE + this.playerRadius) continue;
      d.cd = STEALTH.debrisCooldownSec;
      this.stats.debrisSteps++;
      this.noise(d.x, d.y, STEALTH.debrisNoise);
      this.tweens.add({ targets: d.img, angle: d.img.angle + 25, duration: 90, yoyo: true });
      this.hud?.toast(d.img.texture.key === 'suelo_lata' ? '¡Clonc! Has pisado una lata' : '¡Crac! Has pisado cristales', 1);
    }
    this.execTarget = this.findExecTarget();
    this.drawCones();
  }

  /** Enemigo desprevenido, de espaldas, a alcance cuerpo a cuerpo y sin pared en medio (el más cercano). */
  findExecTarget(): Enemy | null {
    const ws = weaponStats(this.snap.loadout.arma);
    if (!ws.melee || this.swapT > 0 || this.applying) return null;
    const px = this.player.x, py = this.player.y;
    const range = ws.rangeTiles * TILE + this.playerRadius;
    let best: Enemy | null = null, bd = Infinity;
    for (const e of this.enemies.list) {
      if (!e.targetable || !isUnaware(e)) continue;
      const d = Math.hypot(e.x - px, e.y - py) - e.def.size * 0.3;
      if (d > range || d >= bd) continue;
      if (!this.enemies.behind(e, px, py) || !lineClear(this.walls, px, py, e.x, e.y)) continue;
      best = e; bd = d;
    }
    return best;
  }

  /** "Ejecutar": golpe por la espalda a propósito. x2,5 y crítico; si muere, nadie se entera. */
  execute() {
    const e = this.execTarget;
    if (!e || e.dead || this.paused || this.ended || this.swapT > 0 || this.applying || this.attackT > 0 || !isUnaware(e)) return false;
    const ws = weaponStats(this.snap.loadout.arma);
    this.attackT = 1 / ws.aps;
    const ang = Math.atan2(e.y - this.player.y, e.x - this.player.x);
    this.facing = ang;
    this.rig.swing();
    this.stats.executes++;
    const arc = this.add.graphics().setDepth(11);
    arc.lineStyle(7, 0xff4a3c, 0.95).beginPath().arc(this.player.x, this.player.y, TILE * 0.9, ang - 0.7, ang + 0.7).strokePath();
    this.tweens.add({ targets: arc, alpha: 0, duration: 200, onComplete: () => arc.destroy() });
    const killed = this.dealDamage(e, this.backstabDmg(ws.dmg), ang, this.weaponId(), true, JUICE.hitStopHeavyMs, true);
    this.execTarget = null;
    return killed;
  }

  /** Conos tenues de vista en el suelo de los enemigos que ves (ajuste "Conos de visión"). */
  private drawCones() {
    const g = this.conesGfx; if (!g) return;
    g.clear();
    if (this.settings.conosEnemigos === false) return;
    const half = Phaser.Math.DegToRad(STEALTH.coneDeg / 2);
    const max = STEALTH.conesMaxTiles * TILE;
    for (const e of this.enemies.list) {
      if (e.dead || !e.visibleNow || e.state === 'swell') continue;
      if (Math.abs(e.x - this.player.x) > max || Math.abs(e.y - this.player.y) > max) continue;
      const r = (STEALTH.sightTiles[e.def.type] ?? 6) * TILE;
      const unaware = isUnaware(e);
      const col = !unaware ? 0xff3b30 : e.state === 'investigate' || e.meter > 0.01 ? 0xffc83c : 0xe8e2d0;
      const a = !unaware ? 0.07 : e.state === 'investigate' || e.meter > 0.01 ? 0.11 : 0.07;
      g.fillStyle(col, a).slice(e.x, e.y, r, e.facing - half, e.facing + half, false).fillPath();
    }
  }

  // ---------- Movimiento / mirada ----------
  /** Inercia: 0 → máx en 0,25 s, frenada en 0,18 s; cada punto de peso alarga ambos un 2 %. Derrape suave al girar. */
  private move(dt: number) {
    const lo = this.snap.loadout;
    const v = this.joy!.vec.clone();
    const k = this.keys!;
    if (k.A.isDown || k.LEFT.isDown) v.x = -1; if (k.D.isDown || k.RIGHT.isDown) v.x = 1;
    if (k.W.isDown || k.UP.isDown) v.y = -1; if (k.S.isDown || k.DOWN.isDown) v.y = 1;
    if (v.length() > 1) v.normalize();
    const ranged = !weaponStats(lo.arma).melee;
    const aiming = !!this.aim?.aiming && ranged;
    const grabbed = !!this.enemies.v3.grab;
    if (grabbed) { this.enemies.v3.wiggle(v.x, v.y); v.set(0, 0); }
    const chilled = this.chill.t > 0 ? 1 - this.chill.k : 1;
    const max = PLAYER_SPEED_TILES * TILE * this.spd(lo) * chilled * (aiming ? MOVE.aimSpeedMult : 1) * (this.applying ? PRUEBA_V2.applyMoveMult : 1) * ((this.snap.fx?.adren ?? 0) > 0 ? NEW_ITEMS.adrenalina.speedMult : 1);
    const wk = 1 + MOVE.weightTimePct * totalWeight(lo);
    // sigilo: tres pasos según cuánto empujas el joystick (teclado = correr)
    const mag = Math.min(1, v.length());
    this.moveTier = mag < 0.02 ? 'quieto' : mag < STEALTH.sigiloStick ? 'sigilo' : mag < STEALTH.andarStick ? 'andar' : 'correr';
    const tierK = this.moveTier === 'sigilo' ? STEALTH.sigiloSpeed : this.moveTier === 'andar' ? STEALTH.andarSpeed : 1;
    const target = mag < 0.02 ? new Phaser.Math.Vector2() : v.clone().normalize().scale(max * tierK);
    const accel = (PLAYER_SPEED_TILES * TILE) / (MOVE.accelSec * wk);
    const decel = (PLAYER_SPEED_TILES * TILE) / (MOVE.decelSec * wk);
    const dvx = target.x - this.vel.x, dvy = target.y - this.vel.y;
    const dl = Math.hypot(dvx, dvy);
    // acelerar hacia la nueva dirección (derrape) o frenar si sueltas
    const rate = target.lengthSq() < 1 ? decel : accel;
    const step = rate * dt;
    if (dl <= step) this.vel.copy(target); else this.vel.add(new Phaser.Math.Vector2(dvx / dl * step, dvy / dl * step));
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    // si una pared nos frena, la inercia no se "acumula" contra ella
    if (body.blocked.left && this.vel.x < 0 || body.blocked.right && this.vel.x > 0) this.vel.x = 0;
    if (body.blocked.up && this.vel.y < 0 || body.blocked.down && this.vel.y > 0) this.vel.y = 0;
    body.setVelocity(this.vel.x, this.vel.y);
    const moving = v.lengthSq() > 0.02;
    this.lastMove.copy(v);
    return { moving, v, max };
  }

  /**
   * Mirada: el joystick derecho la fija mientras lo tocas (con cuerpo a cuerpo solo gira al personaje);
   * si no, mira hacia donde te mueves. Toque rápido = mirar atrás 0,8 s. Quieto con arma de mano: se gira solo
   * hacia el enemigo detectado más cercano (≤ 2,5 casillas) para que el golpe automático funcione.
   */
  private updateFacing(dt: number, moving: boolean, v: Phaser.Math.Vector2) {
    const aim = this.aim!;
    if (aim.tapped) { aim.tapped = false; this.glanceT = AIM.glanceBackSec; this.glanceBase = this.facing; }
    let want = this.facing;
    if (aim.aiming) { want = aim.angle; this.glanceT = 0; }
    else if (this.glanceT > 0) { this.glanceT -= dt; want = this.glanceBase + Math.PI; }
    else if (moving) want = Math.atan2(v.y, v.x);
    else if (this.playerMelee()) {
      let best: Enemy | null = null, bd = TILE * 2.5;
      for (const e of this.enemies.list) {
        if (!e.targetable || !hasDetected(e)) continue;
        const d = Math.hypot(e.x - this.player.x, e.y - this.player.y);
        if (d < bd) { bd = d; best = e; }
      }
      if (best) want = Math.atan2(best.y - this.player.y, best.x - this.player.x);
    }
    const turn = Phaser.Math.DegToRad(MOVE.turnDegPerSec) * dt * (aim.aiming ? 1.6 : 1);
    this.facing = Phaser.Math.Angle.RotateTo(this.facing, want, turn);
  }

  /** Enemigo oculto (en la niebla) a ≤ 4 casillas: vibración creciente + viñeta roja de ese lado. */
  private updateBehind(dt: number) {
    const R = VISION.behindWarnTiles * TILE;
    const list: { ang: number; k: number }[] = [];
    let nearest = 0;
    for (const e of this.enemies.list) {
      if (e.dead || e.visibleNow) continue;
      const d = Math.hypot(e.x - this.player.x, e.y - this.player.y);
      if (d > R || !e.sees) continue;
      const k = 1 - d / R;
      list.push({ ang: Math.atan2(e.y - this.player.y, e.x - this.player.x), k });
      nearest = Math.max(nearest, k);
    }
    this.behind = list;
    if (list.length) this.stats.behindWarn++;
    this.behindT -= dt;
    if (nearest > 0 && this.behindT <= 0) {
      this.behindT = 0.9 - 0.65 * nearest;
      vibrate(Math.round(18 + 40 * nearest));
      this.stats.behindVibes++;
    }
    // la cámara sigue con un pequeño golpe de retroceso al disparar
    this.kick.scale(Math.pow(0.0005, dt));
    this.cameras.main.scrollX += this.kick.x * 0.25; this.cameras.main.scrollY += this.kick.y * 0.25;
  }

  // ---------- Bucle ----------
  update(_t: number, dtMs: number) {
    if (!this.hud || this.ended) return;
    // v3.2: contador de fps (también fuera de ?debug si PERF.showFps) con el mínimo entre los minutos 12 y 15
    this.fpsFrames++;
    { const nowMs = this.game.loop.now, win = nowMs - this.fpsWin;
      if (win >= 500) {
        const cur = this.fpsFrames * 1000 / win; this.fpsFrames = 0; this.fpsWin = nowMs; this.fpsNow = cur;
        const m = this.snap.elapsed / 60;
        // el primer medio segundo tras empezar/reanudar no cuenta (carga)
        if (m >= PERF.fpsMinFrom && m < PERF.fpsMinTo && win < 2000 && this.fpsWarm++ >= 1) this.fpsMin1215 = Math.min(this.fpsMin1215, cur);
        if (this.debug || PERF.showFps) {
          const mn = Number.isFinite(this.fpsMin1215) ? String(Math.round(this.fpsMin1215)) : '—';
          this.hud.fps.setText(`${Math.round(cur)} fps · mín ${PERF.fpsMinFrom}-${PERF.fpsMinTo}: ${mn}` + (this.debug ? ` · ${this.enemies.list.length} enemigos · guardados ${this.snap.saves}` : ''));
        }
      } }
    if (this.paused) return;
    // hit-stop: el mundo se congela unos ms (la UI sigue)
    if (this.hitStopT > 0) {
      this.hitStopT -= dtMs;
      if (this.hitStopT <= 0) this.endHitStop();
      else { this.hud.update(dtMs / 1000); return; }
    }
    const dt = Math.min(dtMs, 50) / 1000;
    const s = this.snap, p = s.player, lo = s.loadout;
    s.elapsed += dt;
    const minute = s.elapsed / 60;

    // movimiento con inercia + mirada
    const { moving, v, max } = this.move(dt);
    if (moving) this.idleT = 0; else this.idleT += dt;
    this.updateFacing(dt, moving, v);
    const ws0 = weaponStats(lo.arma);
    this.aim!.update(dt, !ws0.melee);

    // cambio de arma (0,4 s sin atacar)
    if (this.swapT > 0) { this.swapT -= dt; this.rig.lower = Math.sin(Math.PI * Phaser.Math.Clamp(1 - this.swapT / SWAP.sec, 0, 1)); if (this.swapT <= 0) { this.swapT = 0; this.rig.lower = 0; this.finishSwap(); } }

    // visión (cono hacia donde miras) y muñeco del jugador
    // v3.1 §9.3: la mirada (cono) gira como mucho LINGER.maxTurnDegPerSec, también al apuntar o con giros instantáneos
    this.viewFacing = Phaser.Math.Angle.RotateTo(this.viewFacing, this.facing, Phaser.Math.DegToRad(LINGER.maxTurnDegPerSec) * dt);
    this.vision!.update(this.player.x, this.player.y, this.viewFacing, this.wallsVersion, this.snap.elapsed);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    this.rig.sneaking = this.moveTier === 'sigilo';
    this.rig.update(dt, this.player.x, this.player.y, this.facing, Math.hypot(body.velocity.x, body.velocity.y) / Math.max(1, max), true);
    this.visT -= dt;
    if (this.visT <= 0) { this.visT = 0.15; this.updateVisibility(); this.cullWorld(); this.updateTrapero(); this.updatePeek(); this.checkLevelPending(); }
    this.exitCheckT -= dt;
    if (this.exitCheckT <= 0) { this.exitCheckT = 0.25; this.checkExitsSeen(); this.checkSnowEnter(); }

    // dificultad: oleadas y Corredor de castigo por estar quieto
    s.spawnTimer += dt * scaling(minute).spawn * this.localSpawnMult();
    if (!this.warnedMut && minute >= MUTATIONS.fromMinute) { this.warnedMut = true; this.hud.toast('⚠ Minuto 10: aparecen mutados (aura de color: amarilla veloz, gris blindado, naranja volátil, verde regenerador)', 4); }
    const fxs = s.fx ??= {};
    for (const k of ['adren', 'antidoto', 'estim'] as const) if ((fxs[k] ?? 0) > 0) fxs[k] = Math.max(0, fxs[k]! - dt);
    fxs.grabImm = this.enemies.v3.grabImm;
    if (s.spawnTimer >= DIFFICULTY.baseSpawnIntervalSec) { s.spawnTimer = 0; this.spawnWave(); }
    if (s.hordeCd > 0) s.hordeCd -= dt;
    // resto de la población inicial, en goteo y fuera de cámara (no todo de golpe)
    const sq = s.stream;
    if (sq && sq.groups + sq.hinchados > 0) {
      sq.t -= dt;
      if (sq.t <= 0) {
        sq.t = DIFFICULTY.streamIntervalSec;
        const pt = this.offscreenPoint(14, 28);
        if (pt && this.enemies.list.length < DIFFICULTY.maxAlive) {
          if (sq.groups > 0) {
            sq.groups--;
            const n = DIFFICULTY.erranteGroupMin + Math.floor(Math.random() * (DIFFICULTY.erranteGroupMax - DIFFICULTY.erranteGroupMin + 1));
            for (let i = 0; i < Math.min(n, DIFFICULTY.maxAlive - this.enemies.list.length); i++) this.spawnAt('errante', pt.x + (Math.random() - 0.5) * TILE * 3, pt.y + (Math.random() - 0.5) * TILE * 3);
          } else { sq.hinchados--; this.spawnAt('hinchado', pt.x, pt.y); }
        }
      }
    }
    if (this.idleT >= DIFFICULTY.idleCorredorSec) {
      this.idleT = 0;
      const pt = this.offscreenPoint(10, 14);
      if (pt) { const e = this.spawnAt('corredor', pt.x, pt.y); e.state = 'investigate'; e.goal = { x: this.player.x, y: this.player.y, until: s.elapsed + 15 }; }
    }

    this.flow.compute(this.player.x, this.player.y);
    this.updateStealth(dt);
    this.enemies.update(dt);
    if (this.ended) return;

    // cooldowns, curación, aguantar
    for (const id of Object.keys(p.cds) as AbilityId[]) { p.cds[id] = Math.max(0, (p.cds[id] ?? 0) - dt); }
    if (p.aguantar > 0) p.aguantar -= dt;
    if (p.healLeft > 0) { const h = Math.min(p.healLeft, p.healRate * dt); p.healLeft -= h; p.hp = Math.min(PLAYER_MAX_HP, p.hp + h); if (p.hp >= PLAYER_MAX_HP) p.healLeft = 0; }
    this.updateApply(dt);
    this.autoHeal();
    this.combat(dt);
    this.updatePendingMelee(dt);
    this.proj.update(dt);
    this.updateGrenades(dt);
    this.pickupArrows();
    this.drawReload();
    if (this.ended) return;

    // ácido
    const g = this.acidGfx!.clear();
    let inAcid = false;
    for (let i = s.acid.length - 1; i >= 0; i--) {
      const a = s.acid[i]; a.t -= dt;
      if (a.t <= 0) { s.acid.splice(i, 1); continue; }
      g.fillStyle(COLORS.toxico, 0.25 * Math.min(1, a.t)).fillCircle(a.x, a.y, TILE * 1.4).lineStyle(2, COLORS.toxico, 0.6).strokeCircle(a.x, a.y, TILE * 1.4);
      if (Math.hypot(a.x - this.player.x, a.y - this.player.y) < TILE * 1.4) inAcid = true;
      for (const e of [...this.enemies.list]) if (Math.hypot(a.x - e.x, a.y - e.y) < TILE * 1.4) this.enemies.damageTick(e, 6 * dt);
    }

    // charco de ácido: 1 carga de veneno por segundo dentro (§8.7)
    this.acidStackT -= dt;
    if (inAcid && this.acidStackT <= 0) { this.acidStackT = PRUEBA_V2.status.acidStackEverySec; this.addStatus('poison', 1); }
    this.updateStatus(dt);
    if (this.chill.t > 0) { this.chill.t -= dt; if (this.chill.t <= 0) this.chill.k = 0; }
    { const c = this.chill.t > 0; if (c !== this.chillTinted) { this.chillTinted = c; this.rig?.setTint(c ? 0xbfe6ff : null); } }
    if (this.ended) return;

    // niebla tóxica
    if (s.elapsed >= DIFFICULTY.fogWarningSeconds && !this.warned13) { this.warned13 = true; this.hud.toast('⚠ La niebla tóxica llega en 2 minutos', 4); }
    if (s.elapsed >= DIFFICULTY.raidSeconds) {
      const over = s.elapsed - DIFFICULTY.raidSeconds;
      const pct = DIFFICULTY.fogDpsPct + Math.floor(over / 30) * DIFFICULTY.fogDpsGrowthPctPer30s;
      this.damagePlayer((pct / 100) * PLAYER_MAX_HP * dt, 'Niebla tóxica', false);
      this.hud.fog.fillAlpha = Math.min(0.45, 0.18 + over / 300);
    } else this.hud.fog.fillAlpha = 0;
    if (this.ended) return;

    // looteo
    this.updateLoot(dt, moving);

    // extracción
    const st = this.extraction.update(dt);
    this.lastExt = st;
    if (this.ended) return;
    if (st.exit) this.hud.setBar(st.text, st.progress > 0 || st.exit.unlocked ? st.progress : null, st.hitPaused ? 0xff3b30 : 0x4cd964);
    else if (this.loot.pause > 0) this.hud.setBar('¡Te golpean! Looteo pausado', null, 0xff3b30);
    else this.hud.setBar('', null);
    this.hud.setAction(st.action?.label ?? null, st.action?.run ?? null);

    // escanear
    const sg = this.scanGfx!.clear();
    if (this.scanT > 0) {
      this.scanT -= dt;
      const R = TILE * PRUEBA_V2.scanTiles;
      sg.lineStyle(2, 0x3c8cff, 0.5).strokeCircle(this.player.x, this.player.y, R);
      for (const e of this.enemies.list) if (Math.hypot(e.x - this.player.x, e.y - this.player.y) < R) sg.lineStyle(3, COLORS.peligro, 0.9).strokeCircle(e.x, e.y, e.def.size * 0.6);
      for (const c of this.containers) if (c.snap.items.length && Math.hypot(c.snap.x - this.player.x, c.snap.y - this.player.y) < R) {
        const best = c.snap.items.reduce((b, it) => RARITIES[it.rarity].tier > RARITIES[b.rarity].tier ? it : b, c.snap.items[0]);
        sg.lineStyle(4, parseInt(RARITIES[best.rarity].color.slice(1), 16), 1).strokeCircle(c.snap.x, c.snap.y, 26);
      }
    }

    // estimulante de visión: marca enemigos a 8 casillas, también tras muros
    const eg = this.estimGfx ??= this.add.graphics().setDepth(25);
    eg.clear();
    if ((fxs.estim ?? 0) > 0) {
      const R = TILE * NEW_ITEMS.estimulante.tiles;
      eg.lineStyle(2, 0xc6ff3c, 0.35).strokeCircle(this.player.x, this.player.y, R);
      for (const e of this.enemies.list) if (!e.dead && !e.submerged && Math.hypot(e.x - this.player.x, e.y - this.player.y) < R) eg.lineStyle(3, 0xc6ff3c, 0.9).strokeCircle(e.x, e.y, e.def.size * 0.55);
    }

    this.updateBehind(dt);
    this.drawPlayerMarks(dt);

    // HUD
    this.refreshAbilities();
    const ws = weaponStats(lo.arma);
    this.hud.setHp(p.hp, PLAYER_MAX_HP, totalProtection(lo));
    { const pr = this.host?.saveData?.()?.prog; if (pr) this.hud.setLevel(pr.level, pr.free, s.elapsed); }
    const remain = Math.max(0, DIFFICULTY.raidSeconds - s.elapsed);
    this.hud.timer.setText(remain > 0 ? `${Math.floor(remain / 60)}:${String(Math.floor(remain % 60)).padStart(2, '0')}` : 'NIEBLA').setColor(remain < 120 ? '#ff3cc8' : '#e8e2d0');
    const ammo = ws.mag && lo.arma ? `  ·  ${p.reload > 0 ? 'recargando' : lo.arma.mag ?? 0}/${countOf(lo.mochila, 'municion')}` : this.isBow() ? `  ·  ${this.bowAmmo()} ${this.arrowsLeft()}${this.clavarArmed ? ' · Clavar' : ''}` : '';
    const sm = this.spd(lo);
    this.hud.info.setText(`${lo.arma ? def(lo.arma).nombre : 'Puños'}${ammo}  ·  min ${Math.floor(minute)}${sm < 0.999 ? `  ·  vel ${Math.round(sm * 100)}%` : ''}${p.healLeft > 0 ? '  ·  curando' : ''}`);
    this.abilityIds.forEach((id, i) => {
      const b = this.hud!.abilities[i];
      if (!id) b.set({ icon: null, label: '', cd: 0, maxCd: 0, enabled: false });
      else b.set({ icon: ABILITIES[id].icon, label: ABILITIES[id].nombre, cd: p.cds[id] ?? 0, maxCd: ABILITIES[id].cooldown, enabled: this.swapT <= 0 && (id !== 'rafaga' || (lo.arma?.mag ?? 0) > 0) });
    });
    const qid = this.quickItem(1);
    const qn = countOf(lo.mochila, qid) + this.pocketCount(qid);
    this.hud.quick.set({ icon: ITEMS[qid].icon, label: ITEMS[qid].nombre, cd: p.healLeft > 0 ? p.healLeft : 0, maxCd: ITEMS[qid].heal!.amount, enabled: qn > 0, badge: String(qn) });
    const q2 = quickSlots(lo) >= 2;
    this.hud.quick2.setShown(q2);
    if (q2) { const id2 = this.quickItem(2), n2 = countOf(lo.mochila, id2) + this.pocketCount(id2); this.hud.quick2.set({ icon: ITEMS[id2].icon, label: ITEMS[id2].nombre, cd: p.healLeft > 0 ? p.healLeft : 0, maxCd: ITEMS[id2].heal!.amount, enabled: n2 > 0, badge: String(n2) }); }
    const rv = lo.reserva ?? null;
    if (this.execTarget) this.hud.swap.set({ icon: 'ui_ejecutar', label: 'Ejecutar', cd: 0, maxCd: 0, enabled: this.attackT <= 0 });
    else this.hud.swap.set({ icon: rv ? ITEMS[rv.def].icon ?? null : null, label: rv ? 'Cambiar' : '', cd: this.swapT, maxCd: SWAP.sec, enabled: !!rv, badge: rv ? '⇄' : undefined });
    this.hud.bagBtn.set({ icon: 'caja', label: '', cd: 0, maxCd: 0, enabled: true });
    this.hud.pauseBtn.set({ icon: null, label: '', cd: 0, maxCd: 0, enabled: true });
    // salidas: solo las vistas alguna vez en este mapa (o a la vista ahora); flechas de borde solo de las activas vistas
    const known = (loc: number) => this.seen.has(loc) || this.exitVisibleNow(loc);
    const exitsView = s.exits.filter(e => known(e.loc)).map(e => ({ x: e.x, y: e.y, open: this.extraction.isOpen(e), name: `${this.extraction.locName(e.loc)} · ${EXIT_NAMES[e.type]}` }));
    this.hud.drawArrows(this.cameras.main, exitsView);
    // amenazas: detectado y NO (en pantalla y visible) → flecha de borde; en la niebla cuenta como no visible
    const threats = this.enemies.list.filter(e => hasDetected(e) && !(this.onScreen(e.x, e.y) && e.visibleNow) && !(e.def.type === 'acechador' && !e.visibleNow) && !e.submerged && e.def.type !== 'enjambre').map(e => ({ x: e.x, y: e.y, type: e.def.type as string }));
    this.hud.drawThreats(this.cameras.main, this.player, threats, s.elapsed);
    const closed = this.map.exitLocs.filter((_, i) => known(i) && !s.exits.some(e => e.loc === i));
    const extra = this.scanT > 0 ? this.enemies.list.filter(e => Math.hypot(e.x - this.player.x, e.y - this.player.y) < TILE * PRUEBA_V2.scanTiles).map(e => ({ x: e.x, y: e.y, color: COLORS.peligro })) : [];
    if (this.radioDot && this.containers.some(c => c.snap.kind === 'elite' && c.snap.x === this.radioDot!.x && c.snap.y === this.radioDot!.y && c.snap.items.length)) extra.push({ x: this.radioDot.x, y: this.radioDot.y, color: 0x3c8cff });
    if (s.trapero?.found) extra.push({ x: s.trapero.x, y: s.trapero.y, color: 0xd9a441 });
    this.hud.drawMinimap(this.player.x, this.player.y, exitsView, closed, extra, this.cameras.main.worldView);
    // borde rojo: enemigos ocultos detrás + latido fuerte del Acechador; borde oscuro que vibra: Enjambre
    this.hud.drawVignette([...this.behind, ...this.enemies.v3.vignette()], this.enemies.v3.swarmEdges, s.elapsed);
    this.hud.update(dt);

    this.autosaveT += dt;
    if (this.autosaveT >= RAID_AUTOSAVE_SEC) { this.autosaveT = 0; this.persist(); }
  }

  // ---------- Depuración ----------
  debugGive(id: string, rarity: ItemInst['rarity'] = 'comun', qty = 1) {
    const it = makeItem(id, rarity, qty);
    const left = backpackAdd(this.snap.loadout, it);
    this.host.refreshInventory();
    return !left;
  }
  /** QA: tiempos de inercia esperados con el peso actual. */
  inertia() {
    const lo = this.snap.loadout, w = totalWeight(lo), k = 1 + MOVE.weightTimePct * w;
    return { weight: w, accelSec: MOVE.accelSec * k, decelSec: MOVE.decelSec * k, max: PLAYER_SPEED_TILES * TILE * this.spd(lo) };
  }
  /** QA: punto (px) sin paredes en `r` casillas a la redonda, buscando en espiral desde el jugador. */
  openSpot(r = 5) {
    const R = r * TILE, out: Rect[] = [];
    for (let ring = 0; ring < 60; ring++) for (let a = 0; a < Math.max(1, ring * 6); a++) {
      const ang = (a / Math.max(1, ring * 6)) * Math.PI * 2;
      const x = this.player.x + Math.cos(ang) * ring * TILE * 2, y = this.player.y + Math.sin(ang) * ring * TILE * 2;
      if (x < R + TILE || y < R + TILE || x > WORLD - R - TILE || y > WORLD - R - TILE) continue;
      out.length = 0;
      if (!this.wallIndex.query(x - R, y - R, x + R, y + R, out).some(w => w.x < x + R && w.x + w.w > x - R && w.y < y + R && w.y + w.h > y - R) && !this.doors.some(o => Math.hypot(o.d.x - x, o.d.y - y) < R + TILE)) return { x, y };
    }
    return null;
  }
  setVision(on: boolean) { this.vision?.setEnabled(on); }
  /** QA v3: reglas de justicia, materiales, efectos. */
  v3Stats() {
    const v = this.enemies.v3;
    return {
      ...this.v3s, fair: { ...v.stats }, tele: { ...this.enemies.teleStats }, grab: v.grab ? { t: v.grab.t } : null, grabImm: v.grabImm,
      sewers: this.sewers.length, fx: { ...(this.snap.fx ?? {}) }, track: this.snap.track, pocketSlots: this.snap.pocketSlots ?? 1,
      backpack: backpackSlots(this.snap.loadout), screams: (this.snap.screams ?? []).length, localMult: this.localSpawnMult(),
      types: this.enemies.list.reduce((m, e) => { m[e.def.type] = (m[e.def.type] ?? 0) + 1; return m; }, {} as Record<string, number>),
      muts: this.enemies.list.filter(e => e.mut).map(e => ({ type: e.def.type, mut: e.mut, hp: e.hp, maxHp: e.maxHp })),
    };
  }
  doorList() { return this.doors.map(o => ({ id: o.d.id, x: o.d.x + o.d.w / 2, y: o.d.y + o.d.h / 2, horiz: o.d.horiz, open: o.open })); }
}
