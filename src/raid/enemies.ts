import Phaser from 'phaser';
import { TILE, WORLD } from '../config/constants';
import { DIFFICULTY } from '../config/difficulty';
import { ATTACKS, BODY_TEX, ENEMIES, EnemyDef, EnemyType } from '../data/enemies';
import { MUTATIONS, MutationId } from '../config/v3';
import { V3Behaviors } from './enemies3';
import { ENEMY_V3 } from '../config/v3';
const ENEMY_V3_TRACK = ENEMY_V3.enjambre.trackTiles;
/** Los v3 ya multiplican su velocidad por la mutación Veloz en enemies3.ts. */
const V3_SPEEDK: Record<string, 1> = { escupidor: 1, chillon: 1, acechador: 1, bruto: 1, reptante: 1, enjambre: 1 };
import type { EnemySnap } from '../save/types';
import { AI, PRUEBA_V2, STAGGER, STEALTH } from '../config/v2';
import type { Fx } from './fx';
import type { FlowField } from './flow';
import { lineClear, Rect } from './map';
import { Rig } from './rig';
import { ELITE, LINGER } from '../config/v31';

export interface RaidCtx {
  world: Phaser.Scene;
  px(): number;
  py(): number;
  playerRadius: number;
  playerMelee(): boolean;
  walls: Rect[];
  elapsed(): number;
  damagePlayer(n: number, cause: string): void;
  /** Estados acumulables en el jugador (veneno / sangrado). */
  addStatus(kind: 'bleed' | 'poison', stacks: number): void;
  addAcid(x: number, y: number, r?: number): void;
  onEnemyDeath(e: Enemy): void;
  /** ¿El punto está dentro de la vista de cámara, con un margen interior (px de mundo)? */
  onScreen(x: number, y: number, margin?: number): boolean;
  /** v2: ¿lo ve el jugador (cono de visión + línea de visión)? Un enemigo en la niebla cuenta como NO visible. */
  visible(x: number, y: number, pad?: number): boolean;
  /** v2: velocidad actual del jugador (previsión del Corredor). */
  pvx(): number;
  pvy(): number;
  flow: FlowField;
  fx: Fx;
  // ---- v3 ----
  /** Hacia dónde mira el jugador (el Acechador busca tu espalda). */
  pfacing?(): number;
  /** Un Chillón ha gritado. */
  onScream?(e: Enemy): void;
  /** Empieza / acaba un agarre del Reptante. */
  onGrab?(on: boolean): void;
  vibrate?(ms: number): void;
}

export interface HitOpts { ang?: number; weapon?: string; crit?: boolean; silent?: boolean; backstab?: boolean }

/** Sigilo: no te ha detectado (sin enterarse o solo en sospecha). El ataque automático nunca lo elige. */
export function isUnaware(e: Enemy) {
  return !e.dead && (e.state === 'idle' || e.state === 'investigate');
}

/** Ha detectado al jugador (lo persigue o le está atacando). */
export function hasDetected(e: Enemy) {
  return !e.dead && (e.state === 'chase' || e.state === 'windup' || e.state === 'attack' || e.state === 'recover' || e.state === 'cone');
}

type State = 'idle' | 'chase' | 'investigate' | 'windup' | 'attack' | 'recover' | 'swell' | 'cone';

export class Enemy {
  def: EnemyDef;
  hp: number; maxHp: number; dmg: number;
  state: State = 'idle';
  t = 0;
  dir = new Phaser.Math.Vector2();
  hitDone = false;
  sightT = Math.random() * 0.3;
  sees = false;
  goal: { x: number; y: number; until: number } | null = null;
  gx?: number; gy?: number;
  coneT = ATTACKS.abominacion.coneEvery;
  bleed = 0;
  wander = new Phaser.Math.Vector2();
  wanderT = 0;
  detourT = 0;
  detour = new Phaser.Math.Vector2();
  warn: Phaser.GameObjects.Image | null = null;
  tele: Phaser.GameObjects.Graphics | null = null;
  icon: Phaser.GameObjects.Text | null = null;
  hpBar: Phaser.GameObjects.Rectangle | null = null;
  dead = false;
  rig!: Rig;
  facing = Math.random() * Math.PI * 2;
  /** Tambaleo restante (s): no se mueve por su cuenta. */
  stagger = 0;
  /** Flanqueo: -1 / 0 / +1 (lado por el que te rodea). */
  flankSide = 0;
  visibleNow = true;
  // ---- sigilo ----
  /** Medidor '?' (0..1): lleno = '!' (alerta). */
  meter = 0;
  checkAcc = Math.random() * STEALTH.checkSec;
  /** Último sitio donde te notó (vista). */
  lastSeen: { x: number; y: number } | null = null;
  /** Sospecha: girarse hacia el ruido → ir → mirar alrededor. */
  susPhase: 'turn' | 'go' | 'look' = 'go';
  susT = 0;
  lookBase = 0;
  /** Giros al azar: tiempo al siguiente, pausa previa (visible) y destino. */
  turnT = STEALTH.turnMinSec + Math.random() * (STEALTH.turnMaxSec - STEALTH.turnMinSec);
  pauseT = 0;
  turnTo: number | null = null;
  nextAng = 0;
  nextWalk = false;
  markT = 0;
  markBase: Phaser.GameObjects.Image | null = null;
  markFill: Phaser.GameObjects.Image | null = null;
  markAlert: Phaser.GameObjects.Image | null = null;
  private tintC: number | null = null;
  // ---- v3 ----
  /** Mutación (min 10) y grupo (Enjambre). */
  mut?: MutationId;
  group?: number;
  /** Enfriamiento propio (escupitajo, grito, carga, salida del Reptante, mordisco). */
  cd = 0;
  /** Sub-estado del comportamiento v3 (Bruto: slam/charge; Reptante: under/warn/grab/up). */
  sub = '';
  speedK = 1;
  submerged = false;
  lastHitAt = -99;
  /** v3.1: último instante en que el jugador lo vio (silueta fantasma) y si es de élite. */
  seenAt = -99;
  elite = false;
  flankPhase = Math.random() * 10;
  /** Último arma que le golpeó (misiones "mata con arma a distancia"). */
  lastWeapon?: string;
  constructor(public sprite: Phaser.Physics.Arcade.Image, type: EnemyType, hp: number, dmg: number) {
    this.def = ENEMIES[type];
    this.hp = this.maxHp = hp; this.dmg = dmg;
    this.flankSide = type === 'errante' ? [-1, 0, 1][Math.floor(Math.random() * 3)] : type === 'corredor' ? (Math.random() < 0.5 ? -1 : 1) : 0;
  }
  tint(c: number | null) { if (c !== this.tintC) { this.tintC = c; this.rig?.setTint(c); } }
  get x() { return this.sprite.x; }
  get y() { return this.sprite.y; }
  get body() { return this.sprite.body as Phaser.Physics.Arcade.Body; }
  /** ¿Se puede apuntar? (un Hinchado hinchándose ya no) */
  get targetable() { return !this.dead && this.state !== 'swell' && !this.submerged; }
}

export class EnemyManager {
  list: Enemy[] = [];
  group: Phaser.Physics.Arcade.Group;
  /** Diagnóstico QA: avisos de ataque iniciados dentro/fuera de pantalla (fuera debe ser siempre 0). */
  teleStats = { on: 0, off: 0 };
  /** Hinchazones de muerte (no son avisos de ataque: no se limitan a pantalla). */
  deathSwell = { on: 0, off: 0 };
  /** Explosiones de Hinchado: posición y si estaba en pantalla (QA). */
  explosions: { x: number; y: number; on: boolean; hit: number }[] = [];
  /** Margen interior para que el aviso se lea entero: un poco más que el cuerpo del enemigo. */
  private teleMargin(e: Enemy) { return Math.max(TILE * 0.75, e.def.size * 0.6); }
  /** Regla de diseño: ningún aviso de ataque empieza fuera de la pantalla. */
  canTelegraph(e: Enemy) { return this.c.onScreen(e.x, e.y, this.teleMargin(e)) && this.c.visible(e.x, e.y, e.def.size * 0.3); }
  /** v3: comportamientos de los enemigos nuevos. */
  v3: V3Behaviors;
  countTele(e: Enemy) { if (this.c.onScreen(e.x, e.y, 0)) this.teleStats.on++; else this.teleStats.off++; }
  constructor(private c: RaidCtx) {
    this.group = c.world.physics.add.group();
    this.v3 = new V3Behaviors(this, c);
  }

  spawn(type: EnemyType, x: number, y: number, statMult = 1, extra?: Partial<EnemySnap>): Enemy {
    const d = ENEMIES[type];
    const s = this.c.world.physics.add.image(x, y, BODY_TEX[type] ?? type).setDisplaySize(d.size, d.size).setDepth(type === 'abominacion' ? 9 : 8).setVisible(false);
    this.group.add(s);
    const body = s.body as Phaser.Physics.Arcade.Body;
    const texW = s.width; // tamaño de textura
    const r = texW * 0.32;
    body.setCircle(r, texW / 2 - r, texW / 2 - r).setCollideWorldBounds(true);
    if (type === 'abominacion') body.setMass(20);
    if (type === 'bruto' || type === 'reptante') body.setMass(type === 'bruto' ? 6 : 10);
    const e = new Enemy(s, type, Math.round(d.hp * statMult), d.dmg * statMult * PRUEBA_V2.enemyDmgMult);
    e.rig = new Rig(this.c.world, x, y, { base: type, size: d.size, depth: type === 'abominacion' ? 9 : 8 });
    if (extra) {
      if (extra.hp !== undefined) e.hp = extra.hp;
      if (extra.maxHp !== undefined) e.maxHp = extra.maxHp;
      if (extra.dmg !== undefined) e.dmg = extra.dmg;
      e.gx = extra.gx; e.gy = extra.gy; e.bleed = extra.bleed ?? 0;
      if (extra.group !== undefined) e.group = extra.group;
      if (extra.mut) this.mutate(e, extra.mut as MutationId, true);
      if (extra.elite) { e.elite = true; e.rig.setElite(ELITE.scale); }
      if (extra.swell !== undefined) { this.startSwell(e, true); e.t = extra.swell; }
    }
    if (type === 'reptante') { e.gx ??= x; e.gy ??= y; e.submerged = true; e.sub = 'under'; e.cd = 1; body.enable = false; e.rig.setVisible(false); }
    if (type === 'hinchado') {
      e.icon = this.c.world.add.text(x, y - 40, '⚠', { fontSize: '22px', color: '#b6ff3c', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5).setDepth(30).setVisible(false);
    }
    if (type === 'abominacion') {
      e.hpBar = this.c.world.add.rectangle(x, y - 60, 80, 7, 0xff3cc8).setDepth(30).setOrigin(0, 0.5);
    }
    this.list.push(e);
    return e;
  }

  /** v3.1 §9.5: convierte en élite (vida ×2, daño ×2, ×1,1, aura dorada). */
  makeElite(e: Enemy) {
    if (e.dead || e.elite || ELITE.exclude.includes(e.def.type)) return false;
    e.elite = true;
    e.maxHp = Math.round(e.maxHp * ELITE.hpMult); e.hp = Math.round(e.hp * ELITE.hpMult);
    e.dmg *= ELITE.dmgMult;
    e.rig.setElite(ELITE.scale);
    return true;
  }
  eliteAlive() { let n = 0; for (const e of this.list) if (e.elite && !e.dead) n++; return n; }

  /** Mutación (diseño §4, min 10): aura de color + rasgo. `restoring` = ya trae la vida guardada. */
  mutate(e: Enemy, m: MutationId, restoring = false) {
    if (e.dead || MUTATIONS.exclude.includes(e.def.type)) return false;
    e.mut = m;
    e.rig.setAura(`aura_${m}`);
    if (m === 'veloz') e.speedK = MUTATIONS.veloz.speedMult;
    if (m === 'blindado' && !restoring) { e.maxHp = Math.round(e.maxHp * MUTATIONS.blindado.hpMult); e.hp = Math.round(e.hp * MUTATIONS.blindado.hpMult); }
    return true;
  }

  /** Diagnóstico QA del sigilo. */
  stealthStats = { heard: 0, suspects: 0, alerts: 0, silentKills: 0, backstabs: 0 };
  /** QA v3.1: fotogramas mostrados como silueta fantasma. */
  ghostFrames = 0;

  /**
   * Ruido (sigilo): lo oyen aunque estén de espaldas si están dentro del radio (a través de paredes, a la mitad).
   * Sin enterarse → sospecha: se gira hacia el ruido, va a mirar y mira alrededor. En alerta no cambia nada.
   */
  noise(x: number, y: number, radiusTiles: number) {
    const now = this.c.elapsed();
    const hm = 1 + STEALTH.hearingPerMinute * (now / 60);
    for (const e of this.list) {
      if (e.dead || e.state === 'swell') continue;
      if (e.def.type === 'abominacion' && Math.hypot(e.x - (e.gx ?? e.x), e.y - (e.gy ?? e.y)) > TILE * 3) continue;
      if (e.def.type === 'reptante') continue;
      const r = Math.max(radiusTiles * TILE * hm * (STEALTH.hearing[e.def.type] ?? 1), radiusTiles > 0 ? (STEALTH.minHearTiles[e.def.type] ?? 0) * TILE : 0);
      const d = Math.hypot(e.x - x, e.y - y);
      if (d > r) continue;
      if (d > r * STEALTH.wallMuffle && !lineClear(this.c.walls, e.x, e.y, x, y)) continue;
      this.stealthStats.heard++;
      if (!isUnaware(e)) continue;
      // el Enjambre no ve, pero lo oye todo: si el ruido está cerca, va directo a por ti
      if (e.def.type === 'enjambre' && d < TILE * 5) { this.becomeAlert(e); continue; }
      const jx = x + (Math.random() - 0.5) * TILE, jy = y + (Math.random() - 0.5) * TILE;
      // ya yendo a mirar: solo actualiza el destino (los pasos suenan cada 0,25 s)
      if (e.state === 'investigate' && e.goal && e.susPhase !== 'look') { e.goal.x = jx; e.goal.y = jy; e.goal.until = now + DIFFICULTY.noiseMemorySec; continue; }
      this.suspect(e, jx, jy);
    }
  }

  /** Pasa a sospecha ('?'): se gira hacia el punto, va allí y mira alrededor. */
  suspect(e: Enemy, x: number, y: number) {
    if (!isUnaware(e)) return;
    this.stealthStats.suspects++;
    e.state = 'investigate';
    e.goal = { x, y, until: this.c.elapsed() + DIFFICULTY.noiseMemorySec };
    e.susPhase = 'turn'; e.susT = STEALTH.suspiciousTurnSec;
    e.pauseT = 0; e.turnTo = null;
  }

  /** Pasa a alerta ('!'): te persigue y avisa a los cercanos. */
  becomeAlert(e: Enemy, spread = true) {
    if (e.dead || e.state === 'swell') return;
    if (isUnaware(e)) { e.state = 'chase'; e.t = 0; }
    e.meter = 1; e.sees = true; e.markT = STEALTH.alertMarkSec; e.goal = null;
    e.lastSeen = { x: this.c.px(), y: this.c.py() };
    this.stealthStats.alerts++;
    if (spread) this.alert(e);
  }

  /** ¿Estás a su espalda (fuera de su arco frontal)? */
  behind(e: Enemy, x: number, y: number) {
    const off = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(y - e.y, x - e.x) - e.facing));
    return off > Phaser.Math.DegToRad(STEALTH.backArcDeg / 2);
  }

  /** Vista con cono + medidor (solo si no te ha detectado); en alerta te tiene localizado sin cono. */
  private perceive(e: Enemy, acc: number, dist: number, px: number, py: number) {
    const range = (STEALTH.sightTiles[e.def.type] ?? 6) * TILE;
    if (e.def.type === 'reptante') return;
    if (!isUnaware(e)) {
      // el Enjambre te rastrea de oído mientras estés cerca
      if (e.def.type === 'enjambre') { e.sees = dist < ENEMY_V3_TRACK * TILE; if (e.sees) e.lastSeen = { x: px, y: py }; return; }
      e.sees = dist < range * STEALTH.alertSightMult && lineClear(this.c.walls, e.x, e.y, px, py);
      if (e.sees) e.lastSeen = { x: px, y: py };
      return;
    }
    e.sees = false;
    const off = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(py - e.y, px - e.x) - e.facing));
    const inCone = dist < range && off <= Phaser.Math.DegToRad(STEALTH.coneDeg / 2);
    if (inCone && lineClear(this.c.walls, e.x, e.y, px, py)) {
      e.lastSeen = { x: px, y: py };
      if (dist < STEALTH.instantTiles * TILE) e.meter = 1;
      else {
        // 0,4 s justo fuera del radio instantáneo → 1,2 s en el límite de la vista
        const k = Phaser.Math.Clamp((dist - STEALTH.instantTiles * TILE) / (range - STEALTH.instantTiles * TILE), 0, 1);
        e.meter += acc / (STEALTH.detectNearSec + (STEALTH.detectFarSec - STEALTH.detectNearSec) * k);
      }
      if (e.meter >= 1) this.becomeAlert(e);
      return;
    }
    if (e.meter > 0) {
      // saliste de su vista antes de llenarse: sospecha, va al último sitio donde te notó
      if (e.lastSeen) { const l = e.lastSeen; e.lastSeen = null; this.suspect(e, l.x, l.y); }
      e.meter = Math.max(0, e.meter - STEALTH.decayPerSec * acc);
    }
  }

  /** '?' que se llena (sospecha) y '!' (alerta) sobre la cabeza; solo si el jugador lo ve. */
  private updateMarks(e: Enemy, vis: boolean, dt: number) {
    if (e.markT > 0) e.markT -= dt;
    const y = e.y - e.def.size * 0.55 - 16;
    const showAlert = vis && e.markT > 0 && !e.dead;
    const showSus = vis && !showAlert && isUnaware(e) && (e.meter > 0.01 || e.state === 'investigate');
    if (showAlert && !e.markAlert) e.markAlert = this.c.world.add.image(e.x, y, 'ui_alerta').setDisplaySize(24, 30).setDepth(31);
    if (e.markAlert) e.markAlert.setVisible(showAlert).setPosition(e.x, y);
    if (showSus && !e.markBase) {
      e.markBase = this.c.world.add.image(e.x, y, 'ui_sospecha').setDisplaySize(24, 30).setDepth(31).setAlpha(0.35);
      e.markFill = this.c.world.add.image(e.x, y, 'ui_sospecha').setDisplaySize(24, 30).setDepth(31.1);
    }
    if (e.markBase && e.markFill) {
      e.markBase.setVisible(showSus).setPosition(e.x, y);
      e.markFill.setVisible(showSus && e.meter > 0.01).setPosition(e.x, y);
      if (showSus) {
        const fh = e.markFill.frame.height, fw = e.markFill.frame.width;
        const m = Phaser.Math.Clamp(e.meter, 0, 1);
        e.markFill.setCrop(0, fh * (1 - m), fw, fh * m);
      }
    }
  }

  private destroyMarks(e: Enemy) {
    e.markBase?.destroy(); e.markFill?.destroy(); e.markAlert?.destroy();
    e.markBase = e.markFill = e.markAlert = null;
  }

  /**
   * Daño con impacto (v2): número de daño, sangre en la dirección del golpe, destello y desplazamiento del muñeco,
   * tambaleo + empuje = fuerza del arma / peso del enemigo. Un tambaleo largo interrumpe su aviso de ataque.
   */
  damage(e: Enemy, n: number, o: HitOpts = {}) {
    if (!e.targetable) return false;
    const ang = o.ang ?? Math.atan2(e.y - this.c.py(), e.x - this.c.px());
    // Bruto: frente blindado (×0,3 desde su arco frontal)
    n *= this.v3.armorMult(e, ang);
    e.hp -= n;
    e.lastHitAt = this.c.elapsed();
    if (o.weapon) e.lastWeapon = o.weapon;
    const w = o.weapon ? STAGGER.weapon[o.weapon] : null;
    const weight = STAGGER.weight[e.def.type] ?? 1;
    const vis = this.c.visible(e.x, e.y, e.def.size * 0.4);
    if (!o.silent) {
      if (vis) this.c.fx.damageNumber(e.x, e.y - e.def.size * 0.3, n, !!o.crit);
      this.c.fx.blood(e.x, e.y, ang, e.def.type === 'abominacion', !!o.crit || (w ? w[0] > 250 : false));
    }
    e.rig.hit(ang, w ? Phaser.Math.Clamp(w[0] / weight / 330, 0, 1) : 0.3);
    if (w) {
      const imp = w[0] / weight;
      e.body.velocity.add(new Phaser.Math.Vector2(Math.cos(ang), Math.sin(ang)).scale(imp));
      const st = w[1] / Math.sqrt(weight);
      if (e.state !== 'swell') e.stagger = Math.max(e.stagger, Math.min(STAGGER.impulseSec + st, 0.6));
      if (st >= STAGGER.interruptSec && (e.state === 'windup' || e.state === 'attack') && e.def.type !== 'abominacion') { e.state = 'recover'; e.t = 0.4; this.clearTele(e); }
    }
    const wasUnaware = isUnaware(e);
    if (o.backstab && wasUnaware) this.stealthStats.backstabs++;
    if (e.hp <= 0) {
      // matar sin ser detectado no avisa a los cercanos
      if (e.def.type === 'hinchado' || e.mut === 'volatil') {
        // explota siempre, también fuera de pantalla (diseño: fuera de la vista está a >1,8 casillas y no alcanza al jugador)
        this.startSwell(e); return false;
      }
      if (wasUnaware) this.stealthStats.silentKills++;
      this.kill(e);
      return true;
    }
    // sobrevive al golpe: se entera y avisa a los cercanos
    if (wasUnaware) this.becomeAlert(e);
    return false;
  }

  startSwell(e: Enemy, restoring = false) {
    if (!restoring) { if (this.c.onScreen(e.x, e.y, 0)) this.deathSwell.on++; else this.deathSwell.off++; }
    e.state = 'swell'; e.t = ATTACKS.hinchado.swell; e.hp = 0; e.stagger = 0;
    if (this.v3.grab?.e === e) this.v3.release();
    e.body.setVelocity(0, 0);
    this.clearTele(e);
    const r = ATTACKS.hinchado.radiusTiles * TILE;
    e.warn = this.c.world.add.image(e.x, e.y, 'aviso-ataque').setDisplaySize(r * 2, r * 2).setDepth(5);
    e.icon?.setVisible(false);
  }

  kill(e: Enemy) {
    if (e.dead) return;
    e.dead = true;
    if (this.v3.grab?.e === e) this.v3.release();
    this.clearTele(e);
    e.icon?.destroy(); e.hpBar?.destroy();
    this.destroyMarks(e);
    this.c.onEnemyDeath(e);
    const s = e.sprite;
    s.disableBody(true, true);
    this.c.world.time.delayedCall(0, () => s.destroy());
    // cae y se queda como cadáver (con tope: los más viejos desaparecen) + salpicadura grande en el suelo
    const azul = e.def.type === 'abominacion';
    if (e.def.type !== 'hinchado' && e.mut !== 'volatil' && !e.submerged) {
      this.c.fx.stain(e.x, e.y, azul, azul ? 1.6 : 0.85);
      e.rig.die();
      this.c.fx.addCorpse(e.rig);
    } else {
      e.rig.destroy();
    }
    this.list.splice(this.list.indexOf(e), 1);
  }

  clearTele(e: Enemy) {
    e.warn?.destroy(); e.warn = null;
    e.tele?.destroy(); e.tele = null;
    if (!e.dead) { e.tint(null); e.rig.pump = 1; e.rig.crouch = 0; e.rig.raise = 0; e.rig.charge = 0; }
  }

  private explode(e: Enemy) {
    const A = ATTACKS.hinchado;
    const r = A.radiusTiles * TILE;
    const px = this.c.px(), py = this.c.py();
    if (Math.hypot(px - e.x, py - e.y) <= r + this.c.playerRadius * 0.5) { this.c.damagePlayer(A.dmg * PRUEBA_V2.enemyDmgMult * (e.elite ? ELITE.dmgMult : 1), 'Explosión de Hinchado'); this.c.addStatus('poison', PRUEBA_V2.status.explosionStacks); }
    let hit = 0;
    for (const o of [...this.list]) if (o !== e && !o.dead && Math.hypot(o.x - e.x, o.y - e.y) <= r) { if (o.targetable) hit++; this.damage(o, A.dmg); }
    this.explosions.push({ x: e.x, y: e.y, on: this.c.onScreen(e.x, e.y, 0), hit });
    if (this.explosions.length > 20) this.explosions.shift();
    this.c.addAcid(e.x, e.y, r * 0.8);
    this.c.fx.stain(e.x, e.y, false, 1.4);
    const fx = this.c.world.add.circle(e.x, e.y, r, 0xb6ff3c, 0.5).setDepth(20);
    this.c.world.tweens.add({ targets: fx, alpha: 0, scale: 1.2, duration: 350, onComplete: () => fx.destroy() });
    this.kill(e);
  }

  update(dt: number) {
    const px = this.c.px(), py = this.c.py();
    const now = this.c.elapsed();
    const melee = this.c.playerMelee();
    for (const e of [...this.list]) {
      if (e.dead) continue;
      const b = e.body;
      const dx = px - e.x, dy = py - e.y;
      const dist = Math.hypot(dx, dy);
      const sp = e.def.speed * TILE;
      if (e.bleed > 0) { e.bleed -= dt; this.damageTick(e, 3 * dt); if (e.dead) continue; }
      e.t -= dt;
      // muñeco por piezas: sigue al cuerpo físico; oculto en la niebla
      const isV3 = this.v3.handles(e);
      const rawVis = this.c.visible(e.x, e.y, e.def.size * 0.4);
      const vis = isV3 ? this.v3.visibility(e, rawVis, dist) : rawVis;
      e.visibleNow = vis;
      const spd = Math.hypot(b.velocity.x, b.velocity.y);
      if (!isV3 && spd > 12 && e.stagger <= 0 && e.state !== 'windup' && e.state !== 'cone') e.facing = Phaser.Math.Angle.RotateTo(e.facing, Math.atan2(b.velocity.y, b.velocity.x), dt * 9);
      const shown = e.def.type === 'acechador' ? (vis || rawVis) : e.submerged ? false : vis;
      if (shown) { e.seenAt = now; e.rig.setGhost(0); e.rig.update(dt, e.x, e.y, e.facing, spd / Math.max(1, sp), true); }
      else {
        // v3.1 §9.3: recién salido del cono → silueta fantasma QUIETA donde lo viste (no se mueve ni muestra ataques), si ese sitio ya no se ve
        const age = now - e.seenAt, rc = e.rig.c;
        if (LINGER.sec > 0 && age < LINGER.sec && !e.submerged && !this.c.visible(rc.x, rc.y, e.def.size * 0.4)) { e.rig.setGhost(LINGER.ghostAlpha * (1 - age / LINGER.sec)); this.ghostFrames++; }
        else { e.rig.setGhost(0); e.rig.update(dt, e.x, e.y, e.facing, spd / Math.max(1, sp), false); }
      }
      if (e.stagger > 0) {
        e.stagger -= dt;
        b.velocity.scale(Math.pow(0.02, dt));
        if (e.state !== 'windup' && e.state !== 'attack' && e.state !== 'cone' && e.state !== 'swell') continue;
      }

      // percepción (sigilo): vista con cono + medidor, cada STEALTH.checkSec
      e.checkAcc += dt;
      if (e.checkAcc >= STEALTH.checkSec) { const acc = e.checkAcc; e.checkAcc = 0; this.perceive(e, acc, dist, px, py); }
      this.updateMarks(e, vis, dt);
      if (e.icon) { e.icon.setPosition(e.x, e.y - 38).setVisible(vis && melee && dist < TILE * 3.2 && e.state !== 'swell'); }
      if (e.hpBar) { e.hpBar.setPosition(e.x - 40, e.y - 58).setVisible(vis).width = 80 * Math.max(0, e.hp / e.maxHp); }

      switch (e.state) {
        case 'swell': {
          const k = 1 + (1 - Math.max(0, e.t)) * 0.5 + Math.sin(now * 40) * 0.05;
          e.rig.pump = k; e.tint(0xb6ff3c);
          b.setVelocity(0, 0);
          if (e.t <= 0) this.explode(e);
          continue;
        }
      }
      if (isV3 && this.v3.update(e, dt, dist, px, py)) continue;
      switch (e.state) {
        case 'windup': this.updateWindup(e, dt, dist); continue;
        case 'attack': this.updateAttack(e, dt, px, py); continue;
        case 'cone': this.updateCone(e, px, py); continue;
        case 'recover': b.velocity.scale(0.85); if (e.t <= 0) e.state = 'chase'; continue;
      }

      // Abominación: guarda su caja
      if (e.def.type === 'abominacion') {
        const gx = e.gx ?? e.x, gy = e.gy ?? e.y;
        const fromGuard = Math.hypot(px - gx, py - gy);
        if (fromGuard > ATTACKS.abominacion.guardTiles * TILE * 1.6 && e.state === 'chase') { e.state = 'idle'; e.meter = 0; }
        if (e.sees && fromGuard < ATTACKS.abominacion.guardTiles * TILE) e.state = 'chase';
        // sospecha: no abandona la caja; se gira hacia el ruido y mira
        if (e.state === 'investigate' && e.goal) {
          b.setVelocity(0, 0);
          e.facing = Phaser.Math.Angle.RotateTo(e.facing, Math.atan2(e.goal.y - e.y, e.goal.x - e.x), dt * 4);
          e.susT -= dt;
          if (e.susPhase === 'turn') { if (e.susT <= 0) { e.susPhase = 'look'; e.susT = STEALTH.suspiciousLookSec; } }
          else if (e.susT <= 0) { e.state = 'idle'; e.goal = null; e.meter = 0; }
          continue;
        }
        if (e.state !== 'chase') { this.moveTo(e, gx, gy, sp * 0.6, 8); continue; }
        e.coneT -= dt;
        const vis = this.canTelegraph(e);
        if (vis && e.coneT <= 0 && dist < ATTACKS.abominacion.coneTiles * TILE) { this.startCone(e, px, py); continue; }
        if (vis && dist < ATTACKS.abominacion.triggerTiles * TILE) { this.startWindup(e, px, py); continue; }
        this.chaseMove(e, px, py, sp, dist); continue;
      }

      if (e.state === 'chase') {
        if (!e.sees && e.t < -3) {
          // te ha perdido: sospecha en el último sitio donde te vio
          const l = e.lastSeen ?? { x: px, y: py };
          e.state = 'investigate'; e.meter = 0.5; e.goal = { x: l.x, y: l.y, until: now + 6 }; e.susPhase = 'go';
          continue;
        }
        if (e.sees) e.t = 0;
        const trig = e.def.type === 'errante' ? ATTACKS.errante.triggerTiles : e.def.type === 'corredor' ? ATTACKS.corredor.triggerTiles : 0;
        // fuera de pantalla puede acercarse, pero no empezar el ataque
        if (trig && dist < trig * TILE && e.sees && this.canTelegraph(e)) { this.startWindup(e, px, py); continue; }
        this.chaseMove(e, px, py, sp, dist);
        continue;
      }
      if (e.state === 'investigate' && e.goal) {
        const g = e.goal;
        if (e.susPhase === 'turn') {
          b.setVelocity(0, 0);
          e.facing = Phaser.Math.Angle.RotateTo(e.facing, Math.atan2(g.y - e.y, g.x - e.x), dt * (e.def.type === 'bruto' ? 1.8 : 6));
          e.susT -= dt; if (e.susT <= 0) e.susPhase = 'go';
          continue;
        }
        if (e.susPhase === 'go') {
          if (now > g.until || Math.hypot(g.x - e.x, g.y - e.y) < TILE) { e.susPhase = 'look'; e.susT = STEALTH.suspiciousLookSec; e.lookBase = e.facing; b.setVelocity(0, 0); }
          else { this.moveTo(e, g.x, g.y, sp * STEALTH.suspiciousSpeedMult); if (isV3) e.facing = Phaser.Math.Angle.RotateTo(e.facing, Math.atan2(b.velocity.y, b.velocity.x), dt * (e.def.type === 'bruto' ? 1.8 : 9)); }
          continue;
        }
        // mira alrededor y vuelve a su rutina
        b.setVelocity(0, 0);
        e.susT -= dt;
        e.facing = e.lookBase + Math.sin((STEALTH.suspiciousLookSec - e.susT) * 1.4) * 1.3;
        if (e.susT <= 0) { e.state = 'idle'; e.goal = null; e.meter = 0; }
        continue;
      }
      // sin enterarse: deambula; cada 3-7 s cambia de rumbo o mira a otro lado, tras una pausa visible de 0,4 s
      e.state = 'idle';
      if (e.pauseT > 0) {
        e.pauseT -= dt; b.setVelocity(0, 0);
        if (e.pauseT <= 0) {
          e.turnTo = e.nextAng;
          if (e.nextWalk) e.wander.set(Math.cos(e.nextAng), Math.sin(e.nextAng)).scale(sp * 0.35); else e.wander.set(0, 0);
        }
        continue;
      }
      e.turnT -= dt;
      if (e.turnT <= 0) {
        e.turnT = STEALTH.turnMinSec + Math.random() * (STEALTH.turnMaxSec - STEALTH.turnMinSec);
        e.pauseT = STEALTH.turnPauseSec;
        e.nextWalk = Math.random() < 0.55;
        e.nextAng = e.nextWalk ? Math.random() * Math.PI * 2 : e.facing + (Math.random() * 2 - 1) * Phaser.Math.DegToRad(STEALTH.turnMaxDeg);
        b.setVelocity(0, 0);
        continue;
      }
      if (e.turnTo !== null) {
        e.facing = Phaser.Math.Angle.RotateTo(e.facing, e.turnTo, dt * 5);
        if (Math.abs(Phaser.Math.Angle.Wrap(e.facing - e.turnTo)) < 0.05) e.turnTo = null;
      }
      b.setVelocity(e.wander.x, e.wander.y);
      if (isV3 && spd > 12) e.facing = Phaser.Math.Angle.RotateTo(e.facing, Math.atan2(b.velocity.y, b.velocity.x), dt * (e.def.type === 'bruto' ? 1.8 : 9));
    }
    this.v3.updateGlobal(dt);
  }

  /** Grupo: al detectarte avisa a los que están cerca (casillas AI.alertTiles). */
  private alert(src: Enemy) {
    const r = AI.alertTiles * TILE;
    for (const o of this.list) {
      if (o === src || o.dead || o.def.type === 'abominacion' || o.def.type === 'reptante' || o.state === 'swell') continue;
      if (o.state !== 'idle' && o.state !== 'investigate') continue;
      if (Math.hypot(o.x - src.x, o.y - src.y) > r) continue;
      o.state = 'chase'; o.t = -1; o.meter = 1; o.markT = STEALTH.alertMarkSec; o.goal = null;
    }
  }

  /** Persecución v2: si te ve, va hacia ti abriéndose en abanico (flanqueo); si no, sigue el campo de flujo por puertas y pasillos. */
  chaseMove(e: Enemy, px: number, py: number, sp: number, dist: number) {
    if (e.sees) {
      let ax = px - e.x, ay = py - e.y;
      if (e.flankSide && dist > AI.flankUntilTiles * TILE) {
        const k = Phaser.Math.Clamp((dist - AI.flankUntilTiles * TILE) / (TILE * 4), 0, 1);
        const a = Math.atan2(ay, ax) + e.flankSide * Phaser.Math.DegToRad(AI.flankDeg) * k;
        const tx = e.x + Math.cos(a) * dist, ty = e.y + Math.sin(a) * dist;
        if (lineClear(this.c.walls, e.x, e.y, (e.x + tx) / 2, (e.y + ty) / 2)) { ax = tx - e.x; ay = ty - e.y; }
      }
      this.moveTo(e, e.x + ax, e.y + ay, sp);
    } else this.pathMove(e, px, py, sp);
  }

  /** Movimiento hacia un punto rodeando paredes con el campo de flujo (calculado hacia el jugador). */
  pathMove(e: Enemy, x: number, y: number, sp: number) {
    const nearPlayer = Math.hypot(x - this.c.px(), y - this.c.py()) < TILE * 3;
    if (nearPlayer && !lineClear(this.c.walls, e.x, e.y, x, y)) {
      const d = this.c.flow.dir(e.x, e.y);
      if (d) { this.moveTo(e, e.x + d.x * TILE, e.y + d.y * TILE, sp); return; }
    }
    this.moveTo(e, x, y, sp);
  }

  /** Daño continuo (sangrado, charco de ácido). */
  damageTick(e: Enemy, n: number) {
    if (e.dead || e.state === 'swell') return;
    e.hp -= n;
    if (e.hp <= 0) { if (e.def.type === 'hinchado' || e.mut === 'volatil') this.startSwell(e); else this.kill(e); }
  }

  moveTo(e: Enemy, x: number, y: number, speed: number, stopDist = 0) {
    const b = e.body;
    let vx = x - e.x, vy = y - e.y;
    const d = Math.hypot(vx, vy);
    if (d <= stopDist) { b.setVelocity(0, 0); return; }
    vx /= d; vy /= d;
    // rodeo simple al chocar con paredes
    if (e.detourT > 0) { e.detourT -= 1 / 60; vx = vx * 0.3 + e.detour.x; vy = vy * 0.3 + e.detour.y; }
    else if (!b.blocked.none) {
      const side = Math.random() < 0.5 ? 1 : -1;
      e.detour.set(-vy * side, vx * side); e.detourT = 0.6;
    }
    const l = Math.hypot(vx, vy) || 1;
    speed *= (AI.speedMult[e.def.type] ?? 1) * (e.def.type in V3_SPEEDK ? 1 : e.speedK);
    b.setVelocity((vx / l) * speed, (vy / l) * speed);
  }

  private startWindup(e: Enemy, px: number, py: number) {
    this.countTele(e);
    e.state = 'windup';
    e.hitDone = false;
    const sc = this.c.world;
    // Corredor: apunta a donde vas a estar (previsión), sin pasarse de su carga
    let tx = px, ty = py;
    if (e.def.type === 'corredor') { tx += this.c.pvx() * AI.corredorLeadSec; ty += this.c.pvy() * AI.corredorLeadSec; }
    e.dir.set(tx - e.x, ty - e.y).normalize();
    e.facing = Math.atan2(e.dir.y, e.dir.x);
    if (e.def.type === 'errante') { e.t = ATTACKS.errante.windup; e.tint(0xff3b30); }
    if (e.def.type === 'corredor') {
      e.t = ATTACKS.corredor.windup;
      e.tint(0xff3b30); e.rig.crouch = 1;
      const L = ATTACKS.corredor.chargeTiles * TILE;
      e.tele = sc.add.graphics().setDepth(4);
      e.tele.fillStyle(0xff3b30, 0.25).lineStyle(2, 0xff3b30, 0.8);
      const ang = Math.atan2(e.dir.y, e.dir.x);
      e.tele.save(); e.tele.translateCanvas(e.x, e.y); e.tele.rotateCanvas(ang);
      e.tele.fillRect(0, -TILE * 0.45, L, TILE * 0.9); e.tele.strokeRect(0, -TILE * 0.45, L, TILE * 0.9);
      e.tele.restore();
    }
    if (e.def.type === 'abominacion') {
      e.t = ATTACKS.abominacion.windup;
      const r = ATTACKS.abominacion.radiusTiles * TILE;
      e.warn = sc.add.image(e.x, e.y, 'aviso-ataque').setDisplaySize(r * 2, r * 2).setDepth(5);
      sc.tweens.add({ targets: e.warn, alpha: { from: 0.5, to: 1 }, duration: 250, yoyo: true, repeat: 2 });
      e.rig.raise = 1;
    }
    e.body.setVelocity(0, 0);
  }

  private updateWindup(e: Enemy, _dt: number, _dist: number) {
    const b = e.body;
    if (e.def.type === 'errante') {
      b.setVelocity(-e.dir.x * 25, -e.dir.y * 25); // se echa hacia atrás
      const flash = Math.floor(e.t * 10) % 2 === 0;
      e.tint(flash ? 0xff3b30 : 0xffaaaa); e.rig.crouch = 0.6;
    } else b.setVelocity(0, 0);
    if (e.t > 0) return;
    if (e.def.type === 'abominacion') {
      const r = ATTACKS.abominacion.radiusTiles * TILE;
      const wx = e.warn?.x ?? e.x, wy = e.warn?.y ?? e.y;
      if (Math.hypot(this.c.px() - wx, this.c.py() - wy) <= r) { this.c.damagePlayer(ATTACKS.abominacion.dmg * (e.dmg / ENEMIES.abominacion.dmg), 'Abominación'); if (Math.random() < PRUEBA_V2.status.bleedChance) this.c.addStatus('bleed', 1); }
      const fx = this.c.world.add.circle(wx, wy, r, 0xff3b30, 0.45).setDepth(20);
      this.c.world.tweens.add({ targets: fx, alpha: 0, duration: 250, onComplete: () => fx.destroy() });
      this.c.world.cameras.main.shake(120, 0.008);
      this.c.fx.stain(wx, wy, true, 1.2);
      this.clearTele(e);
      e.state = 'recover'; e.t = ATTACKS.abominacion.recover;
      return;
    }
    e.state = 'attack';
    const A = e.def.type === 'errante' ? ATTACKS.errante : ATTACKS.corredor;
    const tilesLen = e.def.type === 'errante' ? ATTACKS.errante.lungeTiles : ATTACKS.corredor.chargeTiles;
    const dur = e.def.type === 'errante' ? ATTACKS.errante.lungeSec : ATTACKS.corredor.chargeSec;
    e.t = dur;
    const v = (tilesLen * TILE) / dur;
    b.setVelocity(e.dir.x * v, e.dir.y * v);
    void A;
  }

  private updateAttack(e: Enemy, _dt: number, px: number, py: number) {
    const d = Math.hypot(px - e.x, py - e.y);
    if (!e.hitDone && d < this.c.playerRadius + e.def.size * 0.35) {
      e.hitDone = true;
      this.c.damagePlayer(e.dmg, e.def.nombre);
      if (Math.random() < PRUEBA_V2.status.bleedChance) this.c.addStatus('bleed', 1);
    }
    if (e.t <= 0 || !e.body.blocked.none) {
      this.clearTele(e);
      e.state = 'recover';
      e.t = e.def.type === 'errante' ? ATTACKS.errante.recover : ATTACKS.corredor.recover;
      e.body.setVelocity(0, 0);
    }
  }

  private startCone(e: Enemy, px: number, py: number) {
    this.countTele(e);
    const A = ATTACKS.abominacion;
    e.state = 'cone'; e.t = A.coneWindup; e.coneT = A.coneEvery;
    e.body.setVelocity(0, 0);
    e.dir.set(px - e.x, py - e.y).normalize();
    const ang = Math.atan2(e.dir.y, e.dir.x);
    e.facing = ang; e.rig.raise = 0.6;
    e.tele = this.c.world.add.graphics().setDepth(4);
    e.tele.fillStyle(0xb6ff3c, 0.25).lineStyle(3, 0xff3b30, 0.9);
    e.tele.slice(e.x, e.y, A.coneTiles * TILE, ang - A.coneAngle / 2, ang + A.coneAngle / 2, false).fillPath().strokePath();
  }

  private updateCone(e: Enemy, px: number, py: number) {
    if (e.t > 0) return;
    const A = ATTACKS.abominacion;
    const ang = Math.atan2(e.dir.y, e.dir.x);
    const d = Math.hypot(px - e.x, py - e.y);
    const a = Math.atan2(py - e.y, px - e.x);
    if (d <= A.coneTiles * TILE && Math.abs(Phaser.Math.Angle.Wrap(a - ang)) <= A.coneAngle / 2) this.c.damagePlayer(A.coneDmg * (e.dmg / ENEMIES.abominacion.dmg), 'Ácido de Abominación');
    this.c.addAcid(e.x + e.dir.x * TILE * 3, e.y + e.dir.y * TILE * 3, TILE * 1.2);
    this.clearTele(e);
    e.state = 'recover'; e.t = 0.6;
  }

  snapshot(): EnemySnap[] {
    return this.list.filter(e => !e.dead).map(e => ({
      type: e.def.type, x: Math.round(e.x), y: Math.round(e.y), hp: e.hp, maxHp: e.maxHp, dmg: e.dmg,
      gx: e.gx, gy: e.gy, swell: e.state === 'swell' ? Math.max(0, e.t) : undefined, bleed: e.bleed || undefined,
      mut: e.mut, group: e.group, elite: e.elite || undefined,
    }));
  }

  restore(snaps: EnemySnap[]) {
    for (const s of snaps) {
      const x = Phaser.Math.Clamp(s.x, 10, WORLD - 10), y = Phaser.Math.Clamp(s.y, 10, WORLD - 10);
      this.spawn(s.type, x, y, 1, s);
    }
  }
}
