import Phaser from 'phaser';
import {
  EXIT_RADIUS_TILES, LOCKED_CRATE_SEC, LOOT_REACH_TILES, LOOT_RING_SEC,
  PLAYER_MAX_HP, PLAYER_SPEED_TILES, RAID_AUTOSAVE_SEC, TILE, WORLD, COLORS,
  RAID_ZOOM_FACTOR,
} from '../config/constants';
import { DIFFICULTY, scaling } from '../config/difficulty';
import { AIM, JUICE, MAP2, MOVE, PROJECTILE, PRUEBA_V2, STAGGER, STEALTH, SWAP, VISION } from '../config/v2';
import { ABILITIES, AbilityId, ITEMS } from '../data/items';
import { EnemyType } from '../data/enemies';
import { rarityAtLeast, RARITIES } from '../data/rarity';
import {
  backpackAdd, canPocket, consume, countOf, def, ItemInst, itemLabel, itemValue, makeItem, slotOf,
  speedMult, totalProtection, totalWeight, weaponStats,
} from '../game/inventory';
import { rollContainer, rollItem, seeded } from '../game/loot';
import type { ContainerSnap, ExitState, RaidSnapshot, Settings } from '../save/types';
import { AimStick } from './aim';
import { Enemy, EnemyManager, hasDetected, isUnaware, RaidCtx } from './enemies';
import { chooseExits, EXIT_NAMES, ExtractionManager } from './extraction';
import { FlowField } from './flow';
import { Fx } from './fx';
import { Hud } from './hud';
import { Joystick } from './Joystick';
import { Door, generateMap, lineClear, MapData, pointInWalls, rayHit, Rect, setWallIndex, WallIndex, zoneAt } from './map';
import { Proj, Projectiles } from './projectiles';
import { Rig } from './rig';
import { Vision } from './vision';

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
}

export interface RaidInit { snap: RaidSnapshot; settings: Settings; fresh: boolean; host: RaidHost; debug: boolean }

interface ContainerObj { snap: ContainerSnap; sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Ellipse; lock?: Phaser.GameObjects.Text; glow?: Phaser.GameObjects.Arc }
interface DoorObj { d: Door; img: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle; body: Phaser.GameObjects.Zone; open: boolean }

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
  stats = { shots: 0, swaps: 0, attacksDuringSwap: 0, behindWarn: 0, behindVibes: 0, hitStops: 0, crits: 0, doorsOpened: 0, arrowsRecovered: 0, lootPaused: 0, iosKick: 0, backstabs: 0, executes: 0, debrisSteps: 0, autoSkippedUnaware: 0 };
  private attackT = 0;
  private autosaveT = 0;
  private idleT = 0;
  private scanT = 0;
  private loot: { c: ContainerObj | null; t: number; done: Set<number>; ring: Phaser.GameObjects.Graphics | null; pause: number } = { c: null, t: 0, done: new Set(), ring: null, pause: 0 };
  private noAmmoWarned = false;
  private warned13 = false;
  private nextContainerId = 1;
  private lastMove = new Phaser.Math.Vector2();
  private fpsT = 0;
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
  private stuck = new Map<Enemy, number>();
  private groundArrows: { x: number; y: number; qty: number; img: Phaser.GameObjects.Image }[] = [];
  private kick = new Phaser.Math.Vector2();
  private behind: { ang: number; k: number }[] = [];
  private pendingMelee: { t: number; e: Enemy; dmg: number; crit: boolean; weapon: string; range: number; heavy: boolean }[] = [];

  constructor() { super('Raid'); }

  init(d: RaidInit) {
    this.snap = d.snap; this.settings = d.settings; this.host = d.host; this.fresh = d.fresh; this.debug = d.debug;
    this.paused = false; this.ended = false; this.containers = []; this.doors = []; this.hud = null; this.joy = null; this.aim = null;
    this.loot = { c: null, t: 0, done: new Set(), ring: null, pause: 0 };
    this.warned13 = d.snap.elapsed >= DIFFICULTY.fogWarningSeconds;
    this.attackT = 0; this.autosaveT = 0; this.idleT = 0; this.scanT = 0; this.god = false; this.markG = null; this.markImgs = new Map(); this.markTxt = new Map(); this.hitTimes = []; this.miniHpUntil = -1; this.acidStackT = 0; this.statusAcc = { bleed: 0, poison: 0 }; this.statusDealt = { bleed: 0, poison: 0 }; this.applying = null; this.healStats = { done: 0, cancelHit: 0, cancelRelease: 0 }; this.noiseRing = null; this.conesGfx = null; this.debris = []; this.execTarget = null; this.ringR = 0; this.stepT = 0; this.noAmmoWarned = false;
    this.swapT = 0; this.glanceT = 0; this.steadyT = 0; this.hitStopT = 0; this.vel.set(0, 0); this.kick.set(0, 0);
    this.stuck = new Map(); this.groundArrows = []; this.pendingMelee = []; this.behind = [];
    this.stats = { shots: 0, swaps: 0, attacksDuringSwap: 0, behindWarn: 0, behindVibes: 0, hitStops: 0, crits: 0, doorsOpened: 0, arrowsRecovered: 0, lootPaused: 0, iosKick: 0, backstabs: 0, executes: 0, debrisSteps: 0, autoSkippedUnaware: 0 };
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
    for (const d of this.map.doors) {
      const open = s.doorsOpen!.includes(d.id);
      const body = this.add.zone(d.x + d.w / 2, d.y + d.h / 2, d.w, d.h);
      doorGroup.add(body);
      body.setData('door', d.id);
      const img = this.textures.exists('puerta')
        ? this.add.image(d.horiz ? d.x : d.x + d.w / 2, d.horiz ? d.y + d.h / 2 : d.y, 'puerta').setOrigin(0, 0.5).setDisplaySize(d.horiz ? d.w : d.h, TILE * 0.42).setRotation(d.horiz ? 0 : Math.PI / 2).setDepth(6)
        : this.add.rectangle(d.x, d.y, d.w, d.h, COLORS.oxido).setOrigin(0).setDepth(6);
      const o: DoorObj = { d, img, body, open: false };
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
    this.rig = new Rig(this, p.x, p.y, { base: 'jugador', size: 44, depth: 10, weapon: s.loadout.arma?.def ?? null, v1Size: 44 });
    this.physics.add.collider(this.player, wallGroup);
    const doorHit = (_a: unknown, z: unknown) => { const id = (z as Phaser.GameObjects.Zone).getData('door') as number; const o = this.doors.find(x => x.d.id === id); if (o && !o.open) this.openDoor(o, _a === this.player); };
    this.physics.add.collider(this.player, doorGroup, doorHit as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback);

    this.enemies = new EnemyManager(this);
    this.physics.add.collider(this.enemies.group, wallGroup);
    this.physics.add.collider(this.enemies.group, doorGroup, doorHit as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback);
    this.physics.add.collider(this.enemies.group, this.enemies.group);

    this.proj = new Projectiles(this, {
      walls: () => this.walls, enemies: () => this.enemies.list,
      onHit: (pj, e) => this.onProjHit(pj, e),
      onLand: (pj, x, y) => { if (Math.random() < PROJECTILE.arrowRecoverChance) this.dropArrow(x, y, 1); void pj; },
      onWall: (pj, x, y) => { if (pj.kind === 'bala') this.fx.impact(x, y); },
    });

    if (this.fresh || legacy) this.populate(); else this.enemies.restore(s.enemies);
    for (const c of s.containers) this.addContainerObj(c);
    this.nextContainerId = Math.max(0, ...s.containers.map(c => c.id)) + 1;
    for (const a of s.arrows!) this.addGroundArrow(a.x, a.y, a.qty, false);
    this.setupStealth();

    for (const i of this.host.seenExits(this.map.id)) this.seen.add(i);
    this.extraction = new ExtractionManager(s.exits, this.map, {
      scene: this, px: () => this.player.x, py: () => this.player.y, elapsed: () => s.elapsed,
      noise: (x, y, r) => this.noise(x, y, r),
      hasFlare: () => countOf(this.snap.loadout.mochila, 'bengala') + (this.snap.loadout.bolsillo?.def === 'bengala' ? 1 : 0) > 0,
      useFlare: () => this.useFlare(),
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
    this.facing = -Math.PI / 2;
    this.vision.update(this.player.x, this.player.y, this.facing, this.wallsVersion);

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
    hud.swap.onTap = () => { if (this.execTarget) this.execute(); else this.swapWeapon(); };
    hud.pauseBtn.onTap = () => this.setPaused(true, 'usuario');
    hud.bagBtn.onTap = () => this.toggleInventory();
    hud.pauseBtn.label.setText('');
    const pg = ui.add.graphics().setScrollFactor(0).setDepth(2005);
    const drawPause = () => { pg.clear().fillStyle(0xe8e2d0, 1); const b = hud.pauseBtn.bg; pg.fillRect(b.x - 7, b.y - 8, 5, 16).fillRect(b.x + 2, b.y - 8, 5, 16); };
    drawPause();
    hud.fps.setVisible(this.debug);
    const relayout = () => { drawPause(); this.aim?.place(hud.aimRest.x, hud.aimRest.y); };
    this.scale.on('resize', relayout);
    this.events.once('shutdown', () => this.scale.off('resize', relayout));
    if (this.fresh) hud.toast(this.exitsAnnouncement(), 4.5);
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
    // suelos interiores (baldosa) y tinte por zona (alto = riesgo alto)
    for (const f of this.map.floors) {
      const o = this.textures.exists('suelo_baldosa') ? this.add.tileSprite(f.x, f.y, f.w, f.h, 'suelo_baldosa').setOrigin(0).setTileScale(0.5).setDepth(1)
        : this.add.rectangle(f.x, f.y, f.w, f.h, COLORS.suelo[2], 0.7).setOrigin(0).setDepth(1);
      this.cullables.push({ o, r: f });
    }
    const zg = this.add.graphics().setDepth(1.2);
    for (const z of this.map.zones) {
      if (z.kind !== 'alto') continue;
      zg.fillStyle(COLORS.mutacion, 0.07).fillRect(z.rect.x, z.rect.y, z.rect.w, z.rect.h);
      zg.lineStyle(3, COLORS.mutacion, 0.3).strokeRect(z.rect.x - 4, z.rect.y - 4, z.rect.w + 8, z.rect.h + 8);
      this.add.text(z.rect.x + z.rect.w / 2, z.rect.y - 10, z.name.toUpperCase(), { fontFamily: 'sans-serif', fontStyle: 'bold', fontSize: '16px', color: '#ff3cc8', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5, 1).setDepth(6.5).setAlpha(0.85);
    }
    for (const z of this.map.zones) {
      if (z.kind !== 'tienda' && z.kind !== 'casa') continue;
      if (z.name === 'Casa') continue;
      this.add.text(z.rect.x + z.rect.w / 2, z.rect.y - 10, z.name.toUpperCase(), { fontFamily: 'sans-serif', fontStyle: 'bold', fontSize: '14px', color: '#e8e2d0', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5, 1).setDepth(6.5).setAlpha(0.7);
    }
    // paredes (muro en mosaico + contorno) y coches
    const carSet = new Set(this.map.cars.map(c => `${c.x},${c.y}`));
    const outline = this.add.graphics().setDepth(6.2);
    for (const r of this.map.walls) {
      if (carSet.has(`${r.x},${r.y}`)) continue;
      const o = this.textures.exists('muro') ? this.add.tileSprite(r.x, r.y, r.w, r.h, 'muro').setOrigin(0).setTileScale(0.5).setDepth(6)
        : this.add.rectangle(r.x, r.y, r.w, r.h, COLORS.suelo[1]).setOrigin(0).setDepth(6);
      this.cullables.push({ o, r });
      outline.lineStyle(3, COLORS.contorno, 1).strokeRect(r.x, r.y, r.w, r.h);
    }
    for (const c of this.map.cars) {
      const horiz = c.w > c.h;
      const o = this.textures.exists('coche') ? this.add.image(c.x + c.w / 2, c.y + c.h / 2, 'coche').setDisplaySize(horiz ? c.h : c.w, horiz ? c.w : c.h).setRotation(c.rot).setDepth(6)
        : this.add.rectangle(c.x, c.y, c.w, c.h, COLORS.oxido).setOrigin(0).setDepth(6);
      this.cullables.push({ o, r: c });
    }
    // carteles de evacuación (la flecha del arte apunta a la derecha)
    for (const sg of this.map.signs) {
      if (this.textures.exists('cartel_evacuacion')) this.add.image(sg.x, sg.y, 'cartel_evacuacion').setDisplaySize(T * 0.9, T * 0.9).setRotation(sg.ang).setDepth(6.6);
      this.add.text(sg.x, sg.y + T * 0.55, this.map.exitLocNames[sg.exit] ?? 'Salida', { fontFamily: 'sans-serif', fontStyle: 'bold', fontSize: '11px', color: '#4cd964', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5, 0).setDepth(6.6);
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
      const ab = this.spawnAt('abominacion', el.x, el.y - TILE * 2);
      ab.gx = el.x; ab.gy = el.y;
      const z = zoneAt(this.map, el.x, el.y).rect;
      for (let i = 0; i < DIFFICULTY.eliteGuards; i++) {
        for (let k = 0; k < 10; k++) {
          const x = z.x + TILE + rng() * (z.w - TILE * 2), y = z.y + TILE + rng() * (z.h - TILE * 2);
          if (pointInWalls(this.walls, x, y, TILE * 0.6) || Math.hypot(x - spawn.x, y - spawn.y) < minD * TILE) continue;
          this.spawnAt('errante', x, y); break;
        }
      }
      this.snap.containers.push({ id: this.nextContainerId++, x: el.x, y: el.y, kind: 'elite', items: rollContainer(rng, 'elite', 1), opened: false });
    }
    // botín: calles poco, tiendas/casas medio, zonas altas mucho (bonus por zona)
    for (const c of this.map.containers) {
      if (pointInWalls(this.walls, c.x, c.y, 10)) continue;
      this.snap.containers.push({ id: this.nextContainerId++, x: c.x, y: c.y, kind: c.kind, items: rollContainer(rng, c.kind, c.bonus), opened: false });
    }
  }

  spawnAt(type: EnemyType, x: number, y: number) {
    x = Phaser.Math.Clamp(x, TILE, WORLD - TILE); y = Phaser.Math.Clamp(y, TILE, WORLD - TILE);
    if (pointInWalls(this.walls, x, y, 20)) { y += TILE * 1.5; }
    return this.enemies.spawn(type, x, y, scaling(this.minute()).stats);
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
  noise(x: number, y: number, radiusTiles: number) {
    if (radiusTiles <= 0) return;
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

  onEnemyDeath(e: Enemy) {
    this.snap.kills++;
    const items: ItemInst[] = [];
    if (Math.random() < e.def.dropChance) items.push(rollItem(Math.random, 0));
    // flechas clavadas en el cuerpo: se recuperan del cadáver
    const n = this.stuck.get(e) ?? 0;
    if (n > 0) { items.push(makeItem('flechas', 'comun', n)); this.stuck.delete(e); }
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
    for (const a of this.groundArrows) a.img.setVisible(this.visible(a.x, a.y, 8));
    for (const d of this.debris) d.img.setVisible(Math.abs(d.x - this.player.x) < 700 && Math.abs(d.y - this.player.y) < 700 && this.visible(d.x, d.y, 6));
  }

  // ---------- Flechas recuperables ----------
  private dropArrow(x: number, y: number, qty: number) {
    if (pointInWalls(this.walls, x, y, 2)) return;
    const near = this.groundArrows.find(a => Math.hypot(a.x - x, a.y - y) < TILE * 0.6);
    if (near) { near.qty += qty; this.syncArrows(); return; }
    this.addGroundArrow(x, y, qty, true);
  }

  private addGroundArrow(x: number, y: number, qty: number, save: boolean) {
    const key = this.textures.exists('proyectil_flecha') ? 'proyectil_flecha' : 'flecha';
    const img = this.add.image(x, y, key).setDepth(4.5).setRotation(Math.random() * Math.PI * 2);
    if (key === 'proyectil_flecha') img.setDisplaySize(8, 30); else img.setDisplaySize(TILE * 0.6, TILE * 0.6);
    this.groundArrows.push({ x, y, qty, img });
    if (save) this.syncArrows();
  }

  private syncArrows() { this.snap.arrows = this.groundArrows.map(a => ({ x: Math.round(a.x), y: Math.round(a.y), qty: a.qty })); }

  private pickupArrows() {
    for (let i = this.groundArrows.length - 1; i >= 0; i--) {
      const a = this.groundArrows[i];
      if (Math.hypot(a.x - this.player.x, a.y - this.player.y) > TILE * 0.9) continue;
      const it = makeItem('flechas', 'comun', a.qty);
      const left = backpackAdd(this.snap.loadout, it);
      const got = a.qty - (left?.qty ?? 0);
      if (got <= 0) continue;
      this.stats.arrowsRecovered += got;
      if (left) { a.qty = left.qty; } else { a.img.destroy(); this.groundArrows.splice(i, 1); }
      this.hud?.toast(`+${got} flecha${got > 1 ? 's' : ''}`, 0.9);
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
    if (this.paused || this.ended) return;
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
    if (crit) this.stats.crits++;
    if (backstab) this.stats.backstabs++;
    const killed = this.enemies.damage(e, dmg, { ang, weapon, crit, backstab });
    if (e.visibleNow || this.visible(e.x, e.y, e.def.size * 0.4)) { this.hitStop(crit ? JUICE.hitStopHeavyMs : stopMs); this.shakeFor(dmg * (crit ? 1.5 : 1)); }
    return killed;
  }

  private rollCrit(dmg: number) { const crit = Math.random() < JUICE.critChance; return { dmg: crit ? dmg * JUICE.critMult : dmg, crit }; }

  // ---------- Combate ----------
  damagePlayer(n: number, cause: string, react = true) {
    if (this.ended || this.god) return;
    const p = this.snap.player;
    let dmg = n;
    if (react) dmg *= (1 - totalProtection(this.snap.loadout)) * (p.aguantar > 0 ? 0.4 : 1);
    p.hp -= dmg;
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
  private isBow() { return this.snap.loadout.arma?.def === 'arco'; }
  private arrowsLeft() { const lo = this.snap.loadout; return countOf(lo.mochila, 'flechas') + (lo.bolsillo?.def === 'flechas' ? lo.bolsillo.qty : 0); }
  private takeArrow() {
    const lo = this.snap.loadout;
    if (consume(lo.mochila, 'flechas', 1) > 0) return true;
    if (lo.bolsillo?.def === 'flechas') { lo.bolsillo.qty--; if (lo.bolsillo.qty <= 0) lo.bolsillo = null; return true; }
    return false;
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
      if (countOf(lo.mochila, 'municion') > 0) p.reload = ws.reloadSec ?? 1.5;
      else if (!this.noAmmoWarned) { this.noAmmoWarned = true; this.hud?.toast('¡Sin munición!'); }
      return false;
    }
    if (this.isBow() && this.arrowsLeft() <= 0) {
      if (!this.noAmmoWarned) { this.noAmmoWarned = true; this.hud?.toast('Sin flechas'); }
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
    this.proj.fire(this.isBow() ? 'flecha' : 'bala', ox, oy, ang, ws.rangeTiles * TILE, dmg, crit, this.weaponId(), !auto);
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
    if (ws.noise > 0) this.noise(this.player.x, this.player.y, ws.noise);
    this.host.refreshInventory();
  }

  private onProjHit(pj: Proj, e: Enemy) {
    const ang = Math.atan2(pj.vy, pj.vx);
    if (pj.kind === 'flecha' && Math.random() < PROJECTILE.arrowRecoverChance) this.stuck.set(e, (this.stuck.get(e) ?? 0) + 1);
    // sigilo: un disparo apuntado (joystick derecho) a un desprevenido aplica x2,5 y crítico
    if (pj.aimed && isUnaware(e)) {
      const base = pj.crit ? pj.dmg / JUICE.critMult : pj.dmg;
      this.dealDamage(e, base * STEALTH.backstabMult, ang, pj.weapon, true, JUICE.hitStopHeavyMs, true);
      return;
    }
    this.dealDamage(e, pj.dmg, ang, pj.weapon, pj.crit, pj.kind === 'bala' ? 50 : JUICE.hitStopMs);
  }

  /** Desviación actual del disparo (grados): empieza en 9° y se estabiliza a 1,2° tras 0,4 s quieto. */
  spreadDeg() { const k = Phaser.Math.Clamp(this.steadyT / AIM.steadySec, 0, 1); return AIM.spreadStartDeg + (AIM.spreadMinDeg - AIM.spreadStartDeg) * k; }

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
        const k = Phaser.Math.Clamp(this.steadyT / AIM.steadySec, 0, 1);
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
    if (ws.noise > 0) this.noise(this.player.x, this.player.y, ws.noise);
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
      this.noise(this.player.x, this.player.y, STEALTH.meleeHitNoise);
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
    else if (p.reload > 0) { const total = weaponStats(this.snap.loadout.arma).reloadSec ?? 1.5; k = Phaser.Math.Clamp(1 - p.reload / total, 0, 1); }
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
        this.dealDamage(t, 30 * ws.dmgMult, ang, 'bate', false, JUICE.hitStopHeavyMs);
        t.body.velocity.add(new Phaser.Math.Vector2(Math.cos(ang), Math.sin(ang)).scale(380 / (STAGGER.weight[t.def.type] ?? 1)));
        break;
      }
      case 'torbellino': {
        const r = TILE * 1.8;
        const fx = this.add.circle(px, py, r, COLORS.hueso, 0.18).setStrokeStyle(4, COLORS.hueso).setDepth(11);
        this.tweens.add({ targets: fx, alpha: 0, angle: 360, duration: 300, onComplete: () => fx.destroy() });
        for (const e of [...this.enemies.list]) if (Math.hypot(e.x - px, e.y - py) <= r + e.def.size * 0.3) { this.dealDamage(e, 15 * ws.dmgMult, Math.atan2(e.y - py, e.x - px), 'machete', false); e.bleed = 4; }
        break;
      }
      case 'perforante': {
        if (this.isBow() && !this.takeArrow()) { ok = false; this.hud?.toast('Sin flechas', 1); break; }
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
        for (const h of hits) this.dealDamage(h.e, ws.dmg * 1.5, ang, 'arco', false);
        this.dropArrow(px + Math.cos(ang) * (L - 8), py + Math.sin(ang) * (L - 8), 1);
        this.noise(px, py, ws.noise);
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
  useQuick() {
    const pref = this.settings.rapido;
    const other = pref === 'vendaje' ? 'botiquin' : 'vendaje';
    this.useConsumable(this.hasItem(pref) ? pref : other, true);
  }

  private hasItem(id: string) { return countOf(this.snap.loadout.mochila, id) > 0 || this.snap.loadout.bolsillo?.def === id; }

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
    const total = PRUEBA_V2.applySec[id] ?? 0;
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
    if (consume(lo.mochila, id, 1) === 0) {
      if (lo.bolsillo?.def === id) { lo.bolsillo.qty--; if (lo.bolsillo.qty <= 0) lo.bolsillo = null; }
      else { this.hud?.toast(`No tienes ${ITEMS[id].nombre.toLowerCase()}`, 1); return false; }
    }
    this.healStats.done++;
    p.healLeft = h.amount; p.healRate = h.amount / h.seconds;
    const cured: string[] = [];
    if (S.curaSangrado.includes(id) && p.bleed?.length) { p.bleed = []; cured.push('sangrado'); }
    if (S.curaVeneno.includes(id) && p.poison?.length) { p.poison = []; cured.push('veneno'); }
    this.hud?.toast(`${ITEMS[id].nombre}: +${h.amount}${cured.length ? ' · fuera ' + cured.join(' y ') : ''}`, 1.2);
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
    if (consume(lo.mochila, 'bengala', 1) > 0) { this.host.refreshInventory(); return true; }
    if (lo.bolsillo?.def === 'bengala') { lo.bolsillo.qty--; if (lo.bolsillo.qty <= 0) lo.bolsillo = null; this.host.refreshInventory(); return true; }
    return false;
  }

  /** Objeto que se entregaría en la salida de pago: el Reforzado+ de MENOR valor (mochila y bolsillo primero, luego equipado). */
  payItem(): ItemInst | null {
    const lo = this.snap.loadout;
    const pick = (list: ItemInst[]) => list.filter(i => !i.free && rarityAtLeast(i.rarity, 'reforzado')).sort((a, b) => itemValue(a) - itemValue(b))[0] ?? null;
    return pick([...lo.mochila, ...(lo.bolsillo ? [lo.bolsillo] : [])]) ?? pick([lo.reserva ?? null, lo.cabeza, lo.torso, lo.arma].filter((x): x is ItemInst => !!x));
  }

  private pay() {
    const it = this.payItem();
    if (!it) return false;
    this.removeItem(it.uid);
    this.host.refreshInventory();
    return true;
  }

  // ---------- Inventario (llamado desde la UI) ----------
  findItem(uid: string): { it: ItemInst; where: 'arma' | 'reserva' | 'torso' | 'cabeza' | 'bolsillo' | 'mochila' } | null {
    const lo = this.snap.loadout;
    for (const k of ['arma', 'reserva', 'torso', 'cabeza', 'bolsillo'] as const) if (lo[k]?.uid === uid) return { it: lo[k]!, where: k };
    const it = lo.mochila.find(i => i.uid === uid);
    return it ? { it, where: 'mochila' } : null;
  }

  /** Quita un objeto (una sola vez, por uid: imposible duplicar). */
  removeItem(uid: string): ItemInst | null {
    const f = this.findItem(uid);
    if (!f) return null;
    const lo = this.snap.loadout;
    if (f.where === 'mochila') lo.mochila.splice(lo.mochila.indexOf(f.it), 1);
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
    const prev = lo[slot];
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

  invUnequip(slot: 'arma' | 'reserva' | 'torso' | 'cabeza') {
    if (!this.canEditInventory()) return;
    const lo = this.snap.loadout; const it = lo[slot]; if (!it) return;
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
    const prev = lo.bolsillo;
    lo.mochila.splice(lo.mochila.indexOf(f.it), 1);
    lo.bolsillo = f.it;
    if (prev) lo.mochila.push(prev);
    this.host.refreshInventory();
  }

  invFromPocket() {
    if (!this.canEditInventory()) return;
    const lo = this.snap.loadout; const it = lo.bolsillo; if (!it) return;
    if (backpackAdd(lo, it)) { this.hud?.toast('Mochila llena'); return; }
    lo.bolsillo = null;
    this.host.refreshInventory();
  }

  invDrop(uid: string) {
    if (!this.canEditInventory()) return;
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
    if (ITEMS[f.it.def].heal) this.useConsumable(f.it.def);
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
    const need = c.snap.kind === 'cerrada' && !c.snap.opened ? LOCKED_CRATE_SEC : LOOT_RING_SEC;
    if (L.t === 0 && L.pause <= 0 && c.snap.kind === 'cerrada' && !c.snap.opened) { this.noise(c.snap.x, c.snap.y, STEALTH.crateNoise); this.hud?.toast('La caja cerrada cruje… hace ruido', 1.5); }
    const paused = L.pause > 0;
    if (paused) L.pause -= dt; else L.t += dt;
    const k = Math.min(1, L.t / need);
    L.ring.lineStyle(6, 0x000000, 0.6).strokeCircle(c.snap.x, c.snap.y, 30);
    L.ring.lineStyle(5, paused ? 0xff3b30 : COLORS.hueso, 1).beginPath().arc(c.snap.x, c.snap.y, 30, -Math.PI / 2, -Math.PI / 2 + Math.max(0.001, k) * Math.PI * 2).strokePath();
    if (L.t >= need) {
      L.t = 0; L.done.add(c.snap.id);
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
      this.host.markExitSeen(this.map.id, i);
      const ex = this.snap.exits.find(e => e.loc === i);
      this.hud?.toast(`Salida descubierta: ${this.extraction.locName(i)}${ex ? ` (${EXIT_NAMES[ex.type]})` : ' · cerrada en esta raid'}`, 2.5);
    });
  }
  seenExitList() { return [...this.seen].sort(); }

  // ---------- Estados (veneno / sangrado) e indicadores ----------
  /** Añade cargas (máx. 5 por tipo; si está lleno se renueva la más gastada). Cada carga lleva su temporizador. */
  addStatus(kind: 'bleed' | 'poison', stacks: number) {
    if (this.ended || this.god || stacks <= 0) return;
    const S = PRUEBA_V2.status, p = this.snap.player;
    const arr = (kind === 'bleed' ? (p.bleed ??= []) : (p.poison ??= []));
    const dur = kind === 'bleed' ? S.bleedSec : S.poisonSec;
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

  /** Radio de ruido del paso actual (casillas): sigilo 1, andar 3, correr 6; chaleco militar +1. */
  footNoise() {
    const sp = this.vel.length();
    if (this.moveTier === 'quieto' || sp < 12) return 0;
    const base = this.moveTier === 'sigilo' ? STEALTH.sigiloNoise : this.moveTier === 'andar' ? STEALTH.andarNoise : STEALTH.correrNoise;
    return base + (this.snap.loadout.torso?.def === 'chaleco' ? STEALTH.heavyArmorNoise : 0);
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
    const killed = this.dealDamage(e, ws.dmg * STEALTH.backstabMult, ang, this.weaponId(), true, JUICE.hitStopHeavyMs, true);
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
    const max = PLAYER_SPEED_TILES * TILE * speedMult(lo) * (aiming ? MOVE.aimSpeedMult : 1) * (this.applying ? PRUEBA_V2.applyMoveMult : 1);
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
    if (this.debug) { this.fpsT -= dtMs; if (this.fpsT <= 0) { this.fpsT = 500; this.hud.fps.setText(`${Math.round(this.game.loop.actualFps)} fps · ${this.enemies.list.length} enemigos · guardados ${this.snap.saves}`); } }
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
    this.vision!.update(this.player.x, this.player.y, this.facing, this.wallsVersion);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    this.rig.update(dt, this.player.x, this.player.y, this.facing, Math.hypot(body.velocity.x, body.velocity.y) / Math.max(1, max), true);
    this.visT -= dt;
    if (this.visT <= 0) { this.visT = 0.15; this.updateVisibility(); this.cullWorld(); }
    this.exitCheckT -= dt;
    if (this.exitCheckT <= 0) { this.exitCheckT = 0.25; this.checkExitsSeen(); }

    // dificultad: oleadas y Corredor de castigo por estar quieto
    s.spawnTimer += dt * scaling(minute).spawn;
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

    this.updateBehind(dt);
    this.drawPlayerMarks(dt);

    // HUD
    this.refreshAbilities();
    const ws = weaponStats(lo.arma);
    this.hud.setHp(p.hp, PLAYER_MAX_HP, totalProtection(lo));
    const remain = Math.max(0, DIFFICULTY.raidSeconds - s.elapsed);
    this.hud.timer.setText(remain > 0 ? `${Math.floor(remain / 60)}:${String(Math.floor(remain % 60)).padStart(2, '0')}` : 'NIEBLA').setColor(remain < 120 ? '#ff3cc8' : '#e8e2d0');
    const ammo = ws.mag && lo.arma ? `  ·  ${p.reload > 0 ? 'recargando' : lo.arma.mag ?? 0}/${countOf(lo.mochila, 'municion')}` : this.isBow() ? `  ·  flechas ${this.arrowsLeft()}` : '';
    const sm = speedMult(lo);
    this.hud.info.setText(`${lo.arma ? def(lo.arma).nombre : 'Puños'}${ammo}  ·  min ${Math.floor(minute)}${sm < 0.999 ? `  ·  vel ${Math.round(sm * 100)}%` : ''}${p.healLeft > 0 ? '  ·  curando' : ''}`);
    this.abilityIds.forEach((id, i) => {
      const b = this.hud!.abilities[i];
      if (!id) b.set({ icon: null, label: '', cd: 0, maxCd: 0, enabled: false });
      else b.set({ icon: ABILITIES[id].icon, label: ABILITIES[id].nombre, cd: p.cds[id] ?? 0, maxCd: ABILITIES[id].cooldown, enabled: this.swapT <= 0 && (id !== 'rafaga' || (lo.arma?.mag ?? 0) > 0) });
    });
    const qid = this.hasItem(this.settings.rapido) ? this.settings.rapido : this.settings.rapido === 'vendaje' ? 'botiquin' : 'vendaje';
    const qn = countOf(lo.mochila, qid) + (lo.bolsillo?.def === qid ? lo.bolsillo.qty : 0);
    this.hud.quick.set({ icon: ITEMS[qid].icon, label: ITEMS[qid].nombre, cd: p.healLeft > 0 ? p.healLeft : 0, maxCd: ITEMS[qid].heal!.amount, enabled: qn > 0, badge: String(qn) });
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
    const threats = this.enemies.list.filter(e => hasDetected(e) && !(this.onScreen(e.x, e.y) && e.visibleNow)).map(e => ({ x: e.x, y: e.y, type: e.def.type as string }));
    this.hud.drawThreats(this.cameras.main, this.player, threats, s.elapsed);
    const closed = this.map.exitLocs.filter((_, i) => known(i) && !s.exits.some(e => e.loc === i));
    this.hud.drawMinimap(this.player.x, this.player.y, exitsView, closed, this.scanT > 0 ? this.enemies.list.filter(e => Math.hypot(e.x - this.player.x, e.y - this.player.y) < TILE * PRUEBA_V2.scanTiles).map(e => ({ x: e.x, y: e.y, color: COLORS.peligro })) : [], this.cameras.main.worldView);
    this.hud.drawVignette(this.behind);
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
    return { weight: w, accelSec: MOVE.accelSec * k, decelSec: MOVE.decelSec * k, max: PLAYER_SPEED_TILES * TILE * speedMult(lo) };
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
  doorList() { return this.doors.map(o => ({ id: o.d.id, x: o.d.x + o.d.w / 2, y: o.d.y + o.d.h / 2, horiz: o.d.horiz, open: o.open })); }
}
