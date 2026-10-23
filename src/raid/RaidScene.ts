import Phaser from 'phaser';
import {
  LOCKED_CRATE_NOISE, LOCKED_CRATE_SEC, LOOT_ENEMY_BLOCK_TILES, LOOT_REACH_TILES, LOOT_RING_SEC,
  PLAYER_MAX_HP, PLAYER_SPEED_TILES, RAID_AUTOSAVE_SEC, TILE, WORLD, COLORS,
  RAID_ZOOM_FACTOR,
} from '../config/constants';
import { DIFFICULTY, scaling } from '../config/difficulty';
import { ABILITIES, AbilityId, ITEMS } from '../data/items';
import { EnemyType } from '../data/enemies';
import { rarityAtLeast, RARITIES } from '../data/rarity';
import {
  backpackAdd, canPocket, consume, countOf, def, ItemInst, itemLabel, itemValue, makeItem, slotOf,
  speedMult, totalProtection, weaponStats,
} from '../game/inventory';
import { rollContainer, rollItem, seeded } from '../game/loot';
import type { ContainerSnap, ExitState, RaidSnapshot, Settings } from '../save/types';
import { Enemy, EnemyManager, hasDetected, RaidCtx } from './enemies';
import { chooseExits, EXIT_NAMES, ExtractionManager } from './extraction';
import { Hud } from './hud';
import { Joystick } from './Joystick';
import { generateMap, lineClear, MapData, pointInWalls } from './map';

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
}

export interface RaidInit { snap: RaidSnapshot; settings: Settings; fresh: boolean; host: RaidHost; debug: boolean }

interface ContainerObj { snap: ContainerSnap; sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Ellipse; lock?: Phaser.GameObjects.Text; glow?: Phaser.GameObjects.Arc }

/** Escena de UI sin zoom, encima del mundo. */
export class RaidUIScene extends Phaser.Scene {
  constructor() { super('RaidUI'); }
  create(data: { ready: (s: Phaser.Scene) => void }) { data.ready(this); }
}

export function newRaidSnapshot(seed: number, loadout: RaidSnapshot['loadout'], valueIn: number): RaidSnapshot {
  const map = generateMap(seed);
  const exits = chooseExits(seeded(seed ^ 0x5bd1e995), map);
  return {
    id: 'raid-' + Date.now().toString(36), seed, startedAt: new Date().toISOString(), elapsed: 0, valueIn, kills: 0,
    player: { x: map.spawn.x, y: map.spawn.y, hp: PLAYER_MAX_HP, healLeft: 0, healRate: 0, aguantar: 0, cds: {}, reload: 0 },
    loadout, enemies: [], containers: [], exits, acid: [], spawnTimer: 0, hordeCd: 0, saves: 0,
  };
}

export class RaidScene extends Phaser.Scene implements RaidCtx {
  snap!: RaidSnapshot;
  settings!: Settings;
  host!: RaidHost;
  fresh = false;
  debug = false;
  map!: MapData;
  walls: MapData['walls'] = [];
  player!: Phaser.Physics.Arcade.Image;
  playerRadius = 18;
  enemies!: EnemyManager;
  extraction!: ExtractionManager;
  hud: Hud | null = null;
  joy: Joystick | null = null;
  ui: Phaser.Scene | null = null;
  keys: Record<string, Phaser.Input.Keyboard.Key> | null = null;
  containers: ContainerObj[] = [];
  acidGfx: Phaser.GameObjects.Graphics | null = null;
  scanGfx: Phaser.GameObjects.Graphics | null = null;
  reloadGfx: Phaser.GameObjects.Graphics | null = null;
  paused = false;
  ended = false;
  god = false;
  private attackT = 0;
  private autosaveT = 0;
  private idleT = 0;
  private scanT = 0;
  private loot: { c: ContainerObj | null; t: number; done: Set<number>; ring: Phaser.GameObjects.Graphics | null } = { c: null, t: 0, done: new Set(), ring: null };
  private noAmmoWarned = false;
  private warned13 = false;
  private nextContainerId = 1;
  private lastMove = new Phaser.Math.Vector2();
  private fpsT = 0;
  private lootBlockedMsg = false;
  private abilityIds: (AbilityId | null)[] = [null, null, null];

  constructor() { super('Raid'); }

  init(d: RaidInit) {
    this.snap = d.snap; this.settings = d.settings; this.host = d.host; this.fresh = d.fresh; this.debug = d.debug;
    this.paused = false; this.ended = false; this.containers = []; this.hud = null; this.joy = null;
    this.loot = { c: null, t: 0, done: new Set(), ring: null };
    this.warned13 = d.snap.elapsed >= DIFFICULTY.fogWarningSeconds;
    this.attackT = 0; this.autosaveT = 0; this.idleT = 0; this.scanT = 0; this.god = false; this.noAmmoWarned = false;
  }

  // ---------- RaidCtx ----------
  get world(): Phaser.Scene { return this; }
  px() { return this.player.x; }
  py() { return this.player.y; }
  elapsed() { return this.snap.elapsed; }
  minute() { return this.snap.elapsed / 60; }
  playerMelee() { return weaponStats(this.snap.loadout.arma).melee; }

  create() {
    this.map = generateMap(this.snap.seed);
    this.walls = this.map.walls;
    this.physics.world.setBounds(0, 0, WORLD, WORLD);
    this.drawWorld();

    const wallGroup = this.physics.add.staticGroup();
    for (const r of this.walls) {
      const z = this.add.zone(r.x + r.w / 2, r.y + r.h / 2, r.w, r.h);
      wallGroup.add(z);
    }

    const p = this.snap.player;
    this.player = this.physics.add.image(p.x, p.y, 'player').setDepth(10);
    this.player.setDisplaySize(44, 44);
    const tw = this.player.width;
    const pr = tw * 0.3;
    (this.player.body as Phaser.Physics.Arcade.Body).setCircle(pr, tw / 2 - pr, tw / 2 - pr).setCollideWorldBounds(true);
    this.playerRadius = 44 * 0.3;
    this.physics.add.collider(this.player, wallGroup);

    this.enemies = new EnemyManager(this);
    this.physics.add.collider(this.enemies.group, wallGroup);
    this.physics.add.collider(this.enemies.group, this.enemies.group);

    if (this.fresh) this.populate(); else this.enemies.restore(this.snap.enemies);
    for (const c of this.snap.containers) this.addContainerObj(c);
    this.nextContainerId = Math.max(0, ...this.snap.containers.map(c => c.id)) + 1;

    this.extraction = new ExtractionManager(this.snap.exits, this.map, {
      scene: this, px: () => this.player.x, py: () => this.player.y, elapsed: () => this.snap.elapsed,
      noise: (x, y, r) => this.noise(x, y, r),
      hasFlare: () => countOf(this.snap.loadout.mochila, 'bengala') + (this.snap.loadout.bolsillo?.def === 'bengala' ? 1 : 0) > 0,
      useFlare: () => this.useFlare(),
      payCandidate: () => { const it = this.payItem(); return it ? `${itemLabel(it)} (${RARITIES[it.rarity].nombre})` : null; },
      pay: () => this.pay(),
      onExtract: (e) => this.finish('extraido', { exit: e }),
      toast: (m) => this.hud?.toast(m),
    });

    this.acidGfx = this.add.graphics().setDepth(3);
    this.scanGfx = this.add.graphics().setDepth(25);
    this.reloadGfx = this.add.graphics().setDepth(26);

    const cam = this.cameras.main;
    // margen fuera del mapa para que el jugador quede siempre centrado y por encima de los botones
    const pad = 120;
    cam.setBounds(-pad, -pad, WORLD + pad * 2, WORLD + pad * 2).startFollow(this.player, true, 0.15, 0.15);
    cam.setBackgroundColor('#0d0e10');
    this.applyZoom();
    this.scale.on('resize', this.onResize, this);

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
      this.scene.stop('RaidUI');
    });

    if (!this.fresh) this.setPaused(true, 'reanudada');
    else this.persist();
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
    ui.input.on('pointerdown', (pt: Phaser.Input.Pointer) => { if (!this.paused && !this.ended && !overUi(pt)) hud.handleTap(pt.x, pt.y); });
    this.keys = ui.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,ONE,TWO,THREE,Q,I,P') as Record<string, Phaser.Input.Keyboard.Key>;
    ui.input.keyboard!.on('keydown-P', () => this.setPaused(!this.paused, 'usuario'));
    ui.input.keyboard!.on('keydown-I', () => this.toggleInventory());
    ui.input.keyboard!.on('keydown-ONE', () => this.useAbility(0));
    ui.input.keyboard!.on('keydown-TWO', () => this.useAbility(1));
    ui.input.keyboard!.on('keydown-THREE', () => this.useAbility(2));
    ui.input.keyboard!.on('keydown-Q', () => this.useQuick());
    hud.abilities.forEach((b, i) => b.onTap = () => this.useAbility(i));
    hud.quick.onTap = () => this.useQuick();
    hud.pauseBtn.onTap = () => this.setPaused(true, 'usuario');
    hud.bagBtn.onTap = () => this.toggleInventory();
    hud.pauseBtn.label.setText('');
    const pg = ui.add.graphics().setScrollFactor(0).setDepth(2005);
    const drawPause = () => { pg.clear().fillStyle(0xe8e2d0, 1); const b = hud.pauseBtn.bg; pg.fillRect(b.x - 7, b.y - 8, 5, 16).fillRect(b.x + 2, b.y - 8, 5, 16); };
    drawPause();
    hud.fps.setVisible(this.debug);
    this.scale.on('resize', drawPause);
    this.events.once('shutdown', () => this.scale.off('resize', drawPause));
    if (this.fresh) hud.toast('Planea la ruta: las salidas activas están marcadas en verde/naranja', 3.5);
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
  private drawWorld() {
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(COLORS.suelo[0], 1).fillRect(0, 0, WORLD, WORLD);
    const rng = seeded(this.snap.seed + 7);
    // Suelo: grietas y cascotes grises/ocres de bajo contraste (el verde tóxico queda reservado al peligro)
    const crackCols = [COLORS.contorno, COLORS.suelo[2], COLORS.oxido];
    for (let i = 0; i < 420; i++) {
      let x = rng() * WORLD, y = rng() * WORLD;
      let a = rng() * Math.PI * 2;
      g.lineStyle(1 + rng() * 2, crackCols[Math.floor(rng() * 3)], 0.22 + rng() * 0.12);
      g.beginPath().moveTo(x, y);
      const segs = 3 + Math.floor(rng() * 4);
      for (let s = 0; s < segs; s++) {
        a += (rng() - 0.5) * 1.2; const l = 8 + rng() * 22;
        x += Math.cos(a) * l; y += Math.sin(a) * l; g.lineTo(x, y);
        if (rng() < 0.25) { const b = a + (rng() < 0.5 ? 1 : -1) * (0.6 + rng() * 0.6); g.moveTo(x, y).lineTo(x + Math.cos(b) * l * 0.6, y + Math.sin(b) * l * 0.6).moveTo(x, y); }
      }
      g.strokePath();
    }
    for (let i = 0; i < 700; i++) {
      const x = rng() * WORLD, y = rng() * WORLD, s = 2 + rng() * 6;
      g.fillStyle(rng() < 0.65 ? COLORS.suelo[1] : COLORS.oxido, 0.3 + rng() * 0.2);
      const n = 1 + Math.floor(rng() * 3);
      for (let k = 0; k < n; k++) g.fillRect(x + (rng() - 0.5) * 14, y + (rng() - 0.5) * 14, s * (0.6 + rng()), s * (0.5 + rng() * 0.8));
    }
    g.lineStyle(2, COLORS.contorno, 0.25);
    for (let i = 0; i <= WORLD; i += TILE * 10) { g.lineBetween(i, 0, i, WORLD); g.lineBetween(0, i, WORLD, i); }
    g.lineStyle(10, COLORS.contorno, 1).strokeRect(0, 0, WORLD, WORLD);
    for (const f of this.map.floors) g.fillStyle(COLORS.suelo[2], 0.7).fillRect(f.x, f.y, f.w, f.h);
    // zona peligrosa
    const d = this.map.danger;
    g.fillStyle(COLORS.mutacion, 0.06).fillCircle(d.x, d.y, d.r);
    g.lineStyle(3, COLORS.mutacion, 0.25).strokeCircle(d.x, d.y, d.r);
    const wg = this.add.graphics().setDepth(6);
    for (const r of this.walls) {
      wg.fillStyle(COLORS.suelo[1], 1).fillRect(r.x, r.y, r.w, r.h);
      wg.lineStyle(4, COLORS.contorno, 1).strokeRect(r.x, r.y, r.w, r.h);
      if (r.w > TILE && r.h > TILE) wg.fillStyle(COLORS.oxido, 0.35).fillRect(r.x + 6, r.y + 6, r.w * 0.4, r.h * 0.3);
    }
  }

  private populate() {
    const rng = seeded(this.snap.seed + 99);
    const spawn = this.map.spawn;
    const minD = DIFFICULTY.initialMinDistTiles;
    // Reparto por sectores (4×4 de 15 casillas) para que no se amontonen; se excluyen los cercanos a la entrada
    const SECT = 4, sw = WORLD / SECT;
    const sectors: { sx: number; sy: number }[] = [];
    for (let sy = 0; sy < SECT; sy++) for (let sx = 0; sx < SECT; sx++) {
      if (Math.hypot((sx + 0.5) * sw - spawn.x, (sy + 0.5) * sw - spawn.y) >= minD * TILE) sectors.push({ sx, sy });
    }
    for (let i = sectors.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [sectors[i], sectors[j]] = [sectors[j], sectors[i]]; }
    let si = 0;
    const farPoint = (minFromSpawn: number) => {
      const sec = sectors[si++ % Math.max(1, sectors.length)];
      for (let i = 0; i < 40; i++) {
        const x = sec ? (sec.sx + 0.1 + rng() * 0.8) * sw : (2 + rng() * 56) * TILE;
        const y = sec ? (sec.sy + 0.1 + rng() * 0.8) * sw : (2 + rng() * 56) * TILE;
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
    const el = this.map.eliteBox;
    const ab = this.spawnAt('abominacion', el.x, el.y - TILE * 2);
    ab.gx = el.x; ab.gy = el.y;
    // más Errantes en la zona peligrosa
    for (let i = 0; i < DIFFICULTY.eliteGuards; i++) this.spawnAt('errante', el.x + (rng() - 0.5) * TILE * 12, el.y + (rng() - 0.5) * TILE * 12);

    // botín
    const d = this.map.danger;
    for (const c of this.map.containers) {
      if (pointInWalls(this.walls, c.x, c.y, 10)) continue;
      const bonus = Phaser.Math.Clamp(1 - Math.hypot(c.x - d.x, c.y - d.y) / (TILE * 26), 0, 1);
      this.snap.containers.push({ id: this.nextContainerId++, x: c.x, y: c.y, kind: c.kind, items: rollContainer(rng, c.kind, bonus), opened: false });
    }
    this.snap.containers.push({ id: this.nextContainerId++, x: el.x, y: el.y, kind: 'elite', items: rollContainer(rng, 'elite', 1), opened: false });
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
    for (let i = 0; i < n; i++) this.spawnAt(type, p.x + (Math.random() - 0.5) * TILE * 2, p.y + (Math.random() - 0.5) * TILE * 2);
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
      const n = DIFFICULTY.hordeSizeMin + Math.floor(Math.random() * (DIFFICULTY.hordeSizeMax - DIFFICULTY.hordeSizeMin + 1));
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
    if (Math.random() < e.def.dropChance) {
      const it = rollItem(Math.random, 0);
      this.addContainer({ id: this.nextContainerId++, x: e.x, y: e.y, kind: 'cadaver', items: [it], opened: true });
    }
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

  // ---------- Pausa / guardado ----------
  /** Al pasar a segundo plano: pausa y guarda EXACTAMENTE este instante (sin volver nunca a copias anteriores). */
  background() {
    if (this.ended) return;
    this.joy?.reset();
    if (!this.paused) this.setPaused(true, 'segundo-plano');
    this.persist();
  }

  setPaused(v: boolean, reason: 'usuario' | 'segundo-plano' | 'reanudada') {
    if (this.ended) return;
    this.paused = v;
    this.joy?.reset();
    if (v) { this.physics.pause(); this.tweens.pauseAll(); this.time.paused = true; this.host.closeInventory(); this.persist(); }
    else { this.physics.resume(); this.tweens.resumeAll(); this.time.paused = false; }
    this.host.onPauseChange(v, reason);
  }

  writeSnapshot() {
    const s = this.snap;
    const p = s.player;
    p.x = Math.round(this.player.x); p.y = Math.round(this.player.y);
    s.enemies = this.enemies.snapshot();
    s.saves++;
  }

  persist() {
    if (this.ended) return;
    this.writeSnapshot();
    this.host.persist();
  }

  // ---------- Combate ----------
  damagePlayer(n: number, cause: string, react = true) {
    if (this.ended || this.god) return;
    const p = this.snap.player;
    let dmg = n;
    if (react) dmg *= (1 - totalProtection(this.snap.loadout)) * (p.aguantar > 0 ? 0.4 : 1);
    p.hp -= dmg;
    if (react) {
      this.extraction.onHit();
      this.cameras.main.shake(90, 0.006);
      this.player.setTint(0xff4d6d);
      this.time.delayedCall(100, () => this.player.active && this.player.clearTint());
      this.hud?.flashHurt();
    }
    if (p.hp <= 0) { p.hp = 0; this.finish('muerto', { cause }); }
  }

  private finish(result: 'extraido' | 'muerto', detail: { cause?: string; exit?: ExitState }) {
    if (this.ended) return;
    this.writeSnapshot();
    this.ended = true;
    this.joy?.reset();
    this.physics.pause();
    this.host.closeInventory();
    this.host.endRaid(result, detail);
  }

  /** ¿Punto dentro de la vista de cámara (con margen interior en px de mundo)? */
  onScreen(x: number, y: number, margin = 0) {
    const v = this.cameras.main.worldView;
    return x >= v.x + margin && x <= v.right - margin && y >= v.y + margin && y <= v.bottom - margin;
  }

  pickTarget(rangePx: number, melee: boolean): Enemy | null {
    const px = this.player.x, py = this.player.y;
    const cands: { e: Enemy; d: number }[] = [];
    for (const e of this.enemies.list) {
      if (!e.targetable) continue;
      // a distancia (arco, pistola) solo se dispara a lo que se ve en pantalla
      if (!melee && !this.onScreen(e.x, e.y)) continue;
      const d = Math.hypot(e.x - px, e.y - py) - e.def.size * 0.3;
      if (d > rangePx) continue;
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

  private autoAttack(dt: number) {
    const lo = this.snap.loadout;
    const ws = weaponStats(lo.arma);
    const p = this.snap.player;
    if (p.reload > 0) {
      p.reload -= dt;
      if (p.reload <= 0 && lo.arma) { const need = (ws.mag ?? 0) - (lo.arma.mag ?? 0); lo.arma.mag = (lo.arma.mag ?? 0) + consume(lo.mochila, 'municion', need); this.host.refreshInventory(); }
      return;
    }
    // recarga automática en cuanto el cargador se vacía
    if (ws.mag && lo.arma && (lo.arma.mag ?? 0) <= 0 && countOf(lo.mochila, 'municion') > 0) { p.reload = ws.reloadSec ?? 1.5; return; }
    this.attackT -= dt;
    if (this.attackT > 0) return;
    const range = ws.rangeTiles * TILE + (ws.melee ? this.playerRadius : 0);
    const t = this.pickTarget(range, ws.melee);
    if (!t) return;
    if (ws.mag && lo.arma) {
      if ((lo.arma.mag ?? 0) <= 0) {
        if (countOf(lo.mochila, 'municion') > 0) p.reload = ws.reloadSec ?? 1.5;
        else if (!this.noAmmoWarned) { this.noAmmoWarned = true; this.hud?.toast('¡Sin munición!'); }
        return;
      }
      lo.arma.mag!--;
      this.noAmmoWarned = false;
    }
    this.attackT = 1 / ws.aps;
    this.hit(t, ws.dmg, ws.melee, 120);
    if (ws.noise > 0) this.noise(this.player.x, this.player.y, ws.noise);
  }

  private hit(t: Enemy, dmg: number, melee: boolean, knock: number) {
    const ang = Phaser.Math.Angle.Between(this.player.x, this.player.y, t.x, t.y);
    this.player.rotation = ang - Math.PI / 2;
    if (melee) {
      const arc = this.add.graphics().setDepth(11);
      arc.lineStyle(6, COLORS.hueso, 0.9).beginPath().arc(this.player.x, this.player.y, TILE * 0.9, ang - 0.7, ang + 0.7).strokePath();
      this.tweens.add({ targets: arc, alpha: 0, duration: 160, onComplete: () => arc.destroy() });
    } else if (this.snap.loadout.arma?.def === 'arco') this.arrowFx(this.player.x, this.player.y, t.x, t.y);
    else this.tracer(this.player.x, this.player.y, t.x, t.y);
    this.enemies.damage(t, dmg, { ang, force: knock });
  }

  /** Flecha del arco (arte flecha.svg, que apunta 45° arriba-derecha). */
  private arrowFx(x1: number, y1: number, x2: number, y2: number) {
    const ang = Math.atan2(y2 - y1, x2 - x1);
    const img = this.add.image(x1, y1, 'flecha').setDisplaySize(TILE * 0.8, TILE * 0.8).setRotation(ang + Math.PI / 4).setDepth(12);
    this.tweens.add({ targets: img, x: x2, y: y2, duration: Math.max(60, Math.hypot(x2 - x1, y2 - y1) / 1.6), onComplete: () => img.destroy() });
  }

  /** Anillo pequeño de recarga sobre el jugador (sustituye al texto centrado). */
  private drawReload() {
    const g = this.reloadGfx; if (!g) return;
    g.clear();
    const p = this.snap.player;
    if (p.reload <= 0) return;
    const total = weaponStats(this.snap.loadout.arma).reloadSec ?? 1.5;
    const k = Phaser.Math.Clamp(1 - p.reload / total, 0, 1);
    const x = this.player.x, y = this.player.y - 34;
    g.fillStyle(COLORS.contorno, 0.6).fillCircle(x, y, 9);
    g.lineStyle(3, COLORS.hueso, 0.35).strokeCircle(x, y, 7);
    g.lineStyle(3, COLORS.hueso, 1).beginPath().arc(x, y, 7, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2).strokePath();
  }

  private tracer(x1: number, y1: number, x2: number, y2: number, color = 0xfff2a8) {
    const g = this.add.graphics().setDepth(11);
    g.lineStyle(3, color, 0.9).lineBetween(x1, y1, x2, y2);
    this.tweens.add({ targets: g, alpha: 0, duration: 120, onComplete: () => g.destroy() });
  }

  refreshAbilities() {
    const lo = this.snap.loadout;
    const wa = lo.arma ? def(lo.arma).weapon?.ability ?? null : null;
    this.abilityIds = [wa, lo.torso ? def(lo.torso).armor?.ability ?? null : null, lo.cabeza ? def(lo.cabeza).armor?.ability ?? null : null];
  }

  useAbility(i: number) {
    if (this.paused || this.ended) return;
    const id = this.abilityIds[i];
    if (!id) return;
    const p = this.snap.player;
    if ((p.cds[id] ?? 0) > 0) return;
    const lo = this.snap.loadout;
    const ws = weaponStats(lo.arma);
    const px = this.player.x, py = this.player.y;
    let ok = true;
    switch (id) {
      case 'golpe': {
        const t = this.pickTarget(ws.rangeTiles * TILE + this.playerRadius + TILE * 0.5, true);
        if (!t) { ok = false; this.hud?.toast('Nadie a tu alcance', 1); break; }
        this.hit(t, 30 * ws.dmgMult, true, 520);
        break;
      }
      case 'torbellino': {
        const r = TILE * 1.8;
        const fx = this.add.circle(px, py, r, COLORS.hueso, 0.18).setStrokeStyle(4, COLORS.hueso).setDepth(11);
        this.tweens.add({ targets: fx, alpha: 0, angle: 360, duration: 300, onComplete: () => fx.destroy() });
        for (const e of [...this.enemies.list]) if (Math.hypot(e.x - px, e.y - py) <= r + e.def.size * 0.3) { this.enemies.damage(e, 15 * ws.dmgMult); e.bleed = 4; }
        break;
      }
      case 'perforante': {
        const t = this.pickTarget(ws.rangeTiles * TILE, false);
        const ang = t ? Math.atan2(t.y - py, t.x - px) : this.player.rotation + Math.PI / 2;
        let L = ws.rangeTiles * TILE;
        const ex = px + Math.cos(ang) * L, ey = py + Math.sin(ang) * L;
        // corta en la primera pared
        for (let s = 0; s <= 20; s++) { const k = s / 20; if (pointInWalls(this.walls, px + (ex - px) * k, py + (ey - py) * k)) { L *= k; break; } }
        const hits = this.enemies.list.filter(e => e.targetable).map(e => {
          const rx = e.x - px, ry = e.y - py;
          const along = rx * Math.cos(ang) + ry * Math.sin(ang);
          const perp = Math.abs(-rx * Math.sin(ang) + ry * Math.cos(ang));
          return { e, along, perp };
        }).filter(h => h.along > 0 && h.along < L && h.perp < h.e.def.size * 0.45).sort((a, b) => a.along - b.along).slice(0, 3);
        this.arrowFx(px, py, px + Math.cos(ang) * L, py + Math.sin(ang) * L);
        for (const h of hits) this.enemies.damage(h.e, ws.dmg * 1.5, { ang, force: 200 });
        this.noise(px, py, ws.noise);
        break;
      }
      case 'rafaga': {
        if (!lo.arma || (lo.arma.mag ?? 0) <= 0) { ok = false; this.hud?.toast('Cargador vacío', 1); break; }
        for (let k = 0; k < 5; k++) this.time.delayedCall(k * 90, () => {
          if (this.ended || !lo.arma || (lo.arma.mag ?? 0) <= 0) return;
          const t = this.pickTarget(ws.rangeTiles * TILE, false);
          if (!t) return;
          lo.arma.mag!--;
          this.hit(t, ws.dmg, false, 60);
          this.noise(this.player.x, this.player.y, ws.noise);
        });
        break;
      }
      case 'aguantar': p.aguantar = 3; this.hud?.toast('Aguantar: -60 % daño', 1.2); break;
      case 'escanear': this.scanT = 6; break;
    }
    if (ok) p.cds[id] = ABILITIES[id].cooldown;
  }

  // ---------- Consumibles ----------
  useQuick() {
    const pref = this.settings.rapido;
    const other = pref === 'vendaje' ? 'botiquin' : 'vendaje';
    this.useConsumable(this.hasItem(pref) ? pref : other);
  }

  private hasItem(id: string) { return countOf(this.snap.loadout.mochila, id) > 0 || this.snap.loadout.bolsillo?.def === id; }

  useConsumable(id: string) {
    if (this.ended || this.paused) return false;
    const p = this.snap.player;
    if (p.healLeft > 0) { this.hud?.toast('Ya te estás curando', 1); return false; }
    if (p.hp >= PLAYER_MAX_HP) { this.hud?.toast('Vida al máximo', 1); return false; }
    const h = ITEMS[id]?.heal;
    if (!h) return false;
    const lo = this.snap.loadout;
    if (consume(lo.mochila, id, 1) === 0) {
      if (lo.bolsillo?.def === id) { lo.bolsillo.qty--; if (lo.bolsillo.qty <= 0) lo.bolsillo = null; }
      else { this.hud?.toast(`No tienes ${ITEMS[id].nombre.toLowerCase()}`, 1); return false; }
    }
    p.healLeft = h.amount; p.healRate = h.amount / h.seconds;
    this.hud?.toast(`${ITEMS[id].nombre}: +${h.amount}`, 1.2);
    this.host.refreshInventory();
    return true;
  }

  private autoHeal() {
    const p = this.snap.player;
    const th = this.settings.curarUmbral;
    if (th <= 0 || p.healLeft > 0 || (p.hp / PLAYER_MAX_HP) * 100 >= th) return;
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
    return pick([...lo.mochila, ...(lo.bolsillo ? [lo.bolsillo] : [])]) ?? pick([lo.cabeza, lo.torso, lo.arma].filter((x): x is ItemInst => !!x));
  }

  private pay() {
    const it = this.payItem();
    if (!it) return false;
    this.removeItem(it.uid);
    this.host.refreshInventory();
    return true;
  }

  // ---------- Inventario (llamado desde la UI) ----------
  findItem(uid: string): { it: ItemInst; where: 'arma' | 'torso' | 'cabeza' | 'bolsillo' | 'mochila' } | null {
    const lo = this.snap.loadout;
    for (const k of ['arma', 'torso', 'cabeza', 'bolsillo'] as const) if (lo[k]?.uid === uid) return { it: lo[k]!, where: k };
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
    if (prev && !prev.free) lo.mochila.push(prev); // cabe: acabamos de liberar una casilla
    this.refreshAbilities();
    this.host.refreshInventory();
  }

  invUnequip(slot: 'arma' | 'torso' | 'cabeza') {
    if (!this.canEditInventory()) return;
    const lo = this.snap.loadout; const it = lo[slot]; if (!it) return;
    if (it.free) { lo[slot] = null; }
    else { if (backpackAdd(lo, it)) { this.hud?.toast('Mochila llena'); return; } lo[slot] = null; }
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
  private updateLoot(dt: number, moving: boolean) {
    const L = this.loot;
    const c = this.nearContainer(LOOT_REACH_TILES * TILE);
    // al alejarse, se puede volver a lootear ese contenedor
    for (const id of [...L.done]) { const o = this.containers.find(x => x.snap.id === id); if (!o || Math.hypot(o.snap.x - this.player.x, o.snap.y - this.player.y) > LOOT_REACH_TILES * TILE * 1.5) L.done.delete(id); }
    const can = c && c.snap.items.length > 0 && !L.done.has(c.snap.id) && !moving;
    if (!can || c !== L.c) { L.t = 0; L.c = can ? c : null; }
    if (!L.ring) L.ring = this.add.graphics().setDepth(12);
    L.ring.clear();
    this.lootBlockedMsg = false;
    if (!can || !c) return;
    const blocked = this.enemies.list.some(e => !e.dead && Math.hypot(e.x - this.player.x, e.y - this.player.y) < LOOT_ENEMY_BLOCK_TILES * TILE);
    if (blocked) { this.hud?.setBar('Enemigos cerca: no puedes lootear', null); this.lootBlockedMsg = true; return; }
    const need = c.snap.kind === 'cerrada' && !c.snap.opened ? LOCKED_CRATE_SEC : LOOT_RING_SEC;
    if (L.t === 0 && c.snap.kind === 'cerrada' && !c.snap.opened) { this.noise(c.snap.x, c.snap.y, LOCKED_CRATE_NOISE); this.hud?.toast('La caja cerrada cruje… hace ruido', 1.5); }
    L.t += dt;
    const k = Math.min(1, L.t / need);
    L.ring.lineStyle(6, 0x000000, 0.6).strokeCircle(c.snap.x, c.snap.y, 30);
    L.ring.lineStyle(5, COLORS.hueso, 1).beginPath().arc(c.snap.x, c.snap.y, 30, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2).strokePath();
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

  // ---------- Bucle ----------
  update(_t: number, dtMs: number) {
    if (!this.hud || this.ended) return;
    if (this.debug) { this.fpsT -= dtMs; if (this.fpsT <= 0) { this.fpsT = 500; this.hud.fps.setText(`${Math.round(this.game.loop.actualFps)} fps · ${this.enemies.list.length} enemigos · guardados ${this.snap.saves}`); } }
    if (this.paused) return;
    const dt = Math.min(dtMs, 50) / 1000;
    this.drawReload();
    const s = this.snap, p = s.player, lo = s.loadout;
    s.elapsed += dt;
    const minute = s.elapsed / 60;

    // movimiento (con penalización por peso)
    const v = this.joy!.vec.clone();
    const k = this.keys!;
    if (k.A.isDown || k.LEFT.isDown) v.x = -1; if (k.D.isDown || k.RIGHT.isDown) v.x = 1;
    if (k.W.isDown || k.UP.isDown) v.y = -1; if (k.S.isDown || k.DOWN.isDown) v.y = 1;
    if (v.length() > 1) v.normalize();
    const speed = PLAYER_SPEED_TILES * TILE * speedMult(lo);
    (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(v.x * speed, v.y * speed);
    const moving = v.lengthSq() > 0.02;
    if (moving) { this.player.rotation = Math.atan2(v.y, v.x) - Math.PI / 2; this.idleT = 0; } else this.idleT += dt;
    this.lastMove.copy(v);

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
            for (let i = 0; i < n; i++) this.spawnAt('errante', pt.x + (Math.random() - 0.5) * TILE * 3, pt.y + (Math.random() - 0.5) * TILE * 3);
          } else { sq.hinchados--; this.spawnAt('hinchado', pt.x, pt.y); }
        }
      }
    }
    if (this.idleT >= DIFFICULTY.idleCorredorSec) {
      this.idleT = 0;
      const pt = this.offscreenPoint(10, 14);
      if (pt) { const e = this.spawnAt('corredor', pt.x, pt.y); e.state = 'investigate'; e.goal = { x: this.player.x, y: this.player.y, until: s.elapsed + 15 }; }
    }

    this.enemies.update(dt);
    if (this.ended) return;

    // cooldowns, curación, aguantar
    for (const id of Object.keys(p.cds) as AbilityId[]) { p.cds[id] = Math.max(0, (p.cds[id] ?? 0) - dt); }
    if (p.aguantar > 0) p.aguantar -= dt;
    if (p.healLeft > 0) { const h = Math.min(p.healLeft, p.healRate * dt); p.healLeft -= h; p.hp = Math.min(PLAYER_MAX_HP, p.hp + h); if (p.hp >= PLAYER_MAX_HP) p.healLeft = 0; }
    this.autoHeal();
    this.autoAttack(dt);

    // ácido
    const g = this.acidGfx!.clear();
    for (let i = s.acid.length - 1; i >= 0; i--) {
      const a = s.acid[i]; a.t -= dt;
      if (a.t <= 0) { s.acid.splice(i, 1); continue; }
      g.fillStyle(COLORS.toxico, 0.25 * Math.min(1, a.t)).fillCircle(a.x, a.y, TILE * 1.4).lineStyle(2, COLORS.toxico, 0.6).strokeCircle(a.x, a.y, TILE * 1.4);
      if (Math.hypot(a.x - this.player.x, a.y - this.player.y) < TILE * 1.4) this.damagePlayer(6 * dt, 'Ácido', false);
    }

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
    else if (!this.lootBlockedMsg) this.hud.setBar('', null);
    this.hud.setAction(st.action?.label ?? null, st.action?.run ?? null);

    // escanear
    const sg = this.scanGfx!.clear();
    if (this.scanT > 0) {
      this.scanT -= dt;
      const R = TILE * 10;
      sg.lineStyle(2, 0x3c8cff, 0.5).strokeCircle(this.player.x, this.player.y, R);
      for (const e of this.enemies.list) if (Math.hypot(e.x - this.player.x, e.y - this.player.y) < R) sg.lineStyle(3, COLORS.peligro, 0.9).strokeCircle(e.x, e.y, e.def.size * 0.6);
      for (const c of this.containers) if (c.snap.items.length && Math.hypot(c.snap.x - this.player.x, c.snap.y - this.player.y) < R) {
        const best = c.snap.items.reduce((b, it) => RARITIES[it.rarity].tier > RARITIES[b.rarity].tier ? it : b, c.snap.items[0]);
        sg.lineStyle(4, parseInt(RARITIES[best.rarity].color.slice(1), 16), 1).strokeCircle(c.snap.x, c.snap.y, 26);
      }
    }

    // HUD
    this.refreshAbilities();
    const ws = weaponStats(lo.arma);
    this.hud.setHp(p.hp, PLAYER_MAX_HP, totalProtection(lo));
    const remain = Math.max(0, DIFFICULTY.raidSeconds - s.elapsed);
    this.hud.timer.setText(remain > 0 ? `${Math.floor(remain / 60)}:${String(Math.floor(remain % 60)).padStart(2, '0')}` : 'NIEBLA').setColor(remain < 120 ? '#ff3cc8' : '#e8e2d0');
    const ammo = ws.mag && lo.arma ? `  ·  ${p.reload > 0 ? 'recargando' : lo.arma.mag ?? 0}/${countOf(lo.mochila, 'municion')}` : '';
    const sm = speedMult(lo);
    this.hud.info.setText(`${lo.arma ? def(lo.arma).nombre : 'Puños'}${ammo}  ·  min ${Math.floor(minute)}${sm < 0.999 ? `  ·  vel ${Math.round(sm * 100)}%` : ''}${p.aguantar > 0 ? '  ·  AGUANTAR' : ''}${p.healLeft > 0 ? '  ·  curando' : ''}`);
    this.abilityIds.forEach((id, i) => {
      const b = this.hud!.abilities[i];
      if (!id) b.set({ icon: null, label: '', cd: 0, maxCd: 0, enabled: false });
      else b.set({ icon: ABILITIES[id].icon, label: ABILITIES[id].nombre, cd: p.cds[id] ?? 0, maxCd: ABILITIES[id].cooldown, enabled: id !== 'rafaga' || (lo.arma?.mag ?? 0) > 0 });
    });
    const qid = this.hasItem(this.settings.rapido) ? this.settings.rapido : this.settings.rapido === 'vendaje' ? 'botiquin' : 'vendaje';
    const qn = countOf(lo.mochila, qid) + (lo.bolsillo?.def === qid ? lo.bolsillo.qty : 0);
    this.hud.quick.set({ icon: ITEMS[qid].icon, label: ITEMS[qid].nombre, cd: p.healLeft > 0 ? p.healLeft : 0, maxCd: ITEMS[qid].heal!.amount, enabled: qn > 0, badge: String(qn) });
    this.hud.bagBtn.set({ icon: 'caja', label: '', cd: 0, maxCd: 0, enabled: true });
    this.hud.pauseBtn.set({ icon: null, label: '', cd: 0, maxCd: 0, enabled: true });
    const exitsView = s.exits.map(e => ({ x: e.x, y: e.y, open: this.extraction.isOpen(e), name: EXIT_NAMES[e.type] }));
    this.hud.drawArrows(this.cameras.main, exitsView);
    const threats = this.enemies.list.filter(e => hasDetected(e) && !this.onScreen(e.x, e.y)).map(e => ({ x: e.x, y: e.y, type: e.def.type as string }));
    this.hud.drawThreats(this.cameras.main, this.player, threats, s.elapsed);
    const closed = this.map.exitLocs.filter((_, i) => !s.exits.some(e => e.loc === i));
    this.hud.drawMinimap(this.player.x, this.player.y, exitsView, closed, this.scanT > 0 ? this.enemies.list.map(e => ({ x: e.x, y: e.y, color: COLORS.peligro })) : [], this.cameras.main.worldView);
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
}
