import Phaser from 'phaser';
import { TILE, WORLD } from '../config/constants';
import { DIFFICULTY } from '../config/difficulty';
import { ATTACKS, ENEMIES, EnemyDef, EnemyType } from '../data/enemies';
import type { EnemySnap } from '../save/types';
import { AI, STAGGER } from '../config/v2';
import type { Fx } from './fx';
import type { FlowField } from './flow';
import { lineClear, Rect } from './map';
import { Rig } from './rig';

export interface RaidCtx {
  world: Phaser.Scene;
  px(): number;
  py(): number;
  playerRadius: number;
  playerMelee(): boolean;
  walls: Rect[];
  elapsed(): number;
  damagePlayer(n: number, cause: string): void;
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
}

export interface HitOpts { ang?: number; weapon?: string; crit?: boolean; silent?: boolean }

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
  private tintC: number | null = null;
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
  get targetable() { return !this.dead && this.state !== 'swell'; }
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
  private countTele(e: Enemy) { if (this.c.onScreen(e.x, e.y, 0)) this.teleStats.on++; else this.teleStats.off++; }
  constructor(private c: RaidCtx) {
    this.group = c.world.physics.add.group();
  }

  spawn(type: EnemyType, x: number, y: number, statMult = 1, extra?: Partial<EnemySnap>): Enemy {
    const d = ENEMIES[type];
    const s = this.c.world.physics.add.image(x, y, type).setDisplaySize(d.size, d.size).setDepth(type === 'abominacion' ? 9 : 8).setVisible(false);
    this.group.add(s);
    const body = s.body as Phaser.Physics.Arcade.Body;
    const texW = s.width; // tamaño de textura
    const r = texW * 0.32;
    body.setCircle(r, texW / 2 - r, texW / 2 - r).setCollideWorldBounds(true);
    if (type === 'abominacion') body.setMass(20);
    const e = new Enemy(s, type, Math.round(d.hp * statMult), d.dmg * statMult);
    e.rig = new Rig(this.c.world, x, y, { base: type, size: d.size, depth: type === 'abominacion' ? 9 : 8 });
    if (extra) {
      if (extra.hp !== undefined) e.hp = extra.hp;
      if (extra.maxHp !== undefined) e.maxHp = extra.maxHp;
      if (extra.dmg !== undefined) e.dmg = extra.dmg;
      e.gx = extra.gx; e.gy = extra.gy; e.bleed = extra.bleed ?? 0;
      if (extra.swell !== undefined) { this.startSwell(e, true); e.t = extra.swell; }
    }
    if (type === 'hinchado') {
      e.icon = this.c.world.add.text(x, y - 40, '⚠', { fontSize: '22px', color: '#b6ff3c', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5).setDepth(30).setVisible(false);
    }
    if (type === 'abominacion') {
      e.hpBar = this.c.world.add.rectangle(x, y - 60, 80, 7, 0xff3cc8).setDepth(30).setOrigin(0, 0.5);
    }
    this.list.push(e);
    return e;
  }

  /** Ruido: los enemigos en el radio acuden al punto. */
  noise(x: number, y: number, radiusTiles: number) {
    const r = radiusTiles * TILE;
    const until = this.c.elapsed() + DIFFICULTY.noiseMemorySec;
    for (const e of this.list) {
      if (e.dead || e.state === 'swell') continue;
      if (e.def.type === 'abominacion' && Math.hypot(e.x - (e.gx ?? e.x), e.y - (e.gy ?? e.y)) > TILE * 3) continue;
      if (Math.hypot(e.x - x, e.y - y) <= r) {
        e.goal = { x: x + (Math.random() - 0.5) * TILE * 2, y: y + (Math.random() - 0.5) * TILE * 2, until };
        if (e.state === 'idle') e.state = 'investigate';
      }
    }
  }

  /**
   * Daño con impacto (v2): número de daño, sangre en la dirección del golpe, destello y desplazamiento del muñeco,
   * tambaleo + empuje = fuerza del arma / peso del enemigo. Un tambaleo largo interrumpe su aviso de ataque.
   */
  damage(e: Enemy, n: number, o: HitOpts = {}) {
    if (!e.targetable) return false;
    e.hp -= n;
    const ang = o.ang ?? Math.atan2(e.y - this.c.py(), e.x - this.c.px());
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
    if (e.state === 'idle' || e.state === 'investigate') { e.state = 'chase'; this.alert(e); }
    if (e.hp <= 0) {
      if (e.def.type === 'hinchado') {
        // explota siempre, también fuera de pantalla (diseño: fuera de la vista está a >1,8 casillas y no alcanza al jugador)
        this.startSwell(e); return false;
      }
      this.kill(e);
      return true;
    }
    return false;
  }

  private startSwell(e: Enemy, restoring = false) {
    if (!restoring) { if (this.c.onScreen(e.x, e.y, 0)) this.deathSwell.on++; else this.deathSwell.off++; }
    e.state = 'swell'; e.t = ATTACKS.hinchado.swell; e.hp = 0; e.stagger = 0;
    e.body.setVelocity(0, 0);
    this.clearTele(e);
    const r = ATTACKS.hinchado.radiusTiles * TILE;
    e.warn = this.c.world.add.image(e.x, e.y, 'aviso-ataque').setDisplaySize(r * 2, r * 2).setDepth(5);
    e.icon?.setVisible(false);
  }

  kill(e: Enemy) {
    if (e.dead) return;
    e.dead = true;
    this.clearTele(e);
    e.icon?.destroy(); e.hpBar?.destroy();
    this.c.onEnemyDeath(e);
    const s = e.sprite;
    s.disableBody(true, true);
    this.c.world.time.delayedCall(0, () => s.destroy());
    // cae y se queda como cadáver (con tope: los más viejos desaparecen) + salpicadura grande en el suelo
    const azul = e.def.type === 'abominacion';
    if (e.def.type !== 'hinchado') {
      this.c.fx.stain(e.x, e.y, azul, azul ? 1.6 : 0.85);
      e.rig.die();
      this.c.fx.addCorpse(e.rig);
    } else {
      e.rig.destroy();
    }
    this.list.splice(this.list.indexOf(e), 1);
  }

  private clearTele(e: Enemy) {
    e.warn?.destroy(); e.warn = null;
    e.tele?.destroy(); e.tele = null;
    if (!e.dead) { e.tint(null); e.rig.pump = 1; e.rig.crouch = 0; e.rig.raise = 0; }
  }

  private explode(e: Enemy) {
    const A = ATTACKS.hinchado;
    const r = A.radiusTiles * TILE;
    const px = this.c.px(), py = this.c.py();
    if (Math.hypot(px - e.x, py - e.y) <= r + this.c.playerRadius * 0.5) this.c.damagePlayer(A.dmg, 'Explosión de Hinchado');
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
      const vis = this.c.visible(e.x, e.y, e.def.size * 0.4);
      e.visibleNow = vis;
      const spd = Math.hypot(b.velocity.x, b.velocity.y);
      if (spd > 12 && e.stagger <= 0 && e.state !== 'windup' && e.state !== 'cone') e.facing = Phaser.Math.Angle.RotateTo(e.facing, Math.atan2(b.velocity.y, b.velocity.x), dt * 9);
      e.rig.update(dt, e.x, e.y, e.facing, spd / Math.max(1, sp), vis);
      if (e.stagger > 0) {
        e.stagger -= dt;
        b.velocity.scale(Math.pow(0.02, dt));
        if (e.state !== 'windup' && e.state !== 'attack' && e.state !== 'cone' && e.state !== 'swell') continue;
      }

      // percepción (limitada para rendimiento)
      e.sightT -= dt;
      if (e.sightT <= 0) {
        e.sightT = 0.25;
        const was = e.sees;
        e.sees = dist < DIFFICULTY.sightTiles * TILE && lineClear(this.c.walls, e.x, e.y, px, py);
        if (e.sees && !was && e.state !== 'chase') this.alert(e);
      }
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
        case 'windup': this.updateWindup(e, dt, dist); continue;
        case 'attack': this.updateAttack(e, dt, px, py); continue;
        case 'cone': this.updateCone(e, px, py); continue;
        case 'recover': b.velocity.scale(0.85); if (e.t <= 0) e.state = 'chase'; continue;
      }

      // Abominación: guarda su caja
      if (e.def.type === 'abominacion') {
        const gx = e.gx ?? e.x, gy = e.gy ?? e.y;
        const fromGuard = Math.hypot(px - gx, py - gy);
        if (fromGuard > ATTACKS.abominacion.guardTiles * TILE * 1.6 && e.state === 'chase') e.state = 'idle';
        if (e.sees && fromGuard < ATTACKS.abominacion.guardTiles * TILE) e.state = 'chase';
        if (e.state !== 'chase') { this.moveTo(e, gx, gy, sp * 0.6, 8); continue; }
        e.coneT -= dt;
        const vis = this.canTelegraph(e);
        if (vis && e.coneT <= 0 && dist < ATTACKS.abominacion.coneTiles * TILE) { this.startCone(e, px, py); continue; }
        if (vis && dist < ATTACKS.abominacion.triggerTiles * TILE) { this.startWindup(e, px, py); continue; }
        this.chaseMove(e, px, py, sp, dist); continue;
      }

      if (e.sees) e.state = 'chase';
      if (e.state === 'chase') {
        if (!e.sees && e.t < -3) { e.state = 'investigate'; e.goal = { x: px, y: py, until: now + 4 }; }
        if (e.sees) e.t = 0;
        const trig = e.def.type === 'errante' ? ATTACKS.errante.triggerTiles : e.def.type === 'corredor' ? ATTACKS.corredor.triggerTiles : 0;
        // fuera de pantalla puede acercarse, pero no empezar el ataque
        if (trig && dist < trig * TILE && e.sees && this.canTelegraph(e)) { this.startWindup(e, px, py); continue; }
        this.chaseMove(e, px, py, sp, dist);
        continue;
      }
      if (e.state === 'investigate' && e.goal) {
        if (now > e.goal.until || Math.hypot(e.goal.x - e.x, e.goal.y - e.y) < TILE) { e.state = 'idle'; e.goal = null; continue; }
        this.pathMove(e, e.goal.x, e.goal.y, sp * 0.9);
        continue;
      }
      // deambular
      e.state = 'idle';
      e.wanderT -= dt;
      if (e.wanderT <= 0) { e.wanderT = 2 + Math.random() * 3; const a = Math.random() * Math.PI * 2; e.wander.set(Math.cos(a), Math.sin(a)).scale(Math.random() < 0.4 ? 0 : sp * 0.35); }
      b.setVelocity(e.wander.x, e.wander.y);
    }
  }

  /** Grupo: al detectarte avisa a los que están cerca (casillas AI.alertTiles). */
  private alert(src: Enemy) {
    const r = AI.alertTiles * TILE;
    for (const o of this.list) {
      if (o === src || o.dead || o.def.type === 'abominacion' || o.state === 'swell') continue;
      if (o.state !== 'idle' && o.state !== 'investigate') continue;
      if (Math.hypot(o.x - src.x, o.y - src.y) > r) continue;
      o.state = 'chase'; o.t = -1;
    }
  }

  /** Persecución v2: si te ve, va hacia ti abriéndose en abanico (flanqueo); si no, sigue el campo de flujo por puertas y pasillos. */
  private chaseMove(e: Enemy, px: number, py: number, sp: number, dist: number) {
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
  private pathMove(e: Enemy, x: number, y: number, sp: number) {
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
    if (e.hp <= 0) { if (e.def.type === 'hinchado') this.startSwell(e); else this.kill(e); }
  }

  private moveTo(e: Enemy, x: number, y: number, speed: number, stopDist = 0) {
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
    speed *= AI.speedMult[e.def.type] ?? 1;
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
      if (Math.hypot(this.c.px() - wx, this.c.py() - wy) <= r) this.c.damagePlayer(ATTACKS.abominacion.dmg * (e.dmg / ENEMIES.abominacion.dmg), 'Abominación');
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
    }));
  }

  restore(snaps: EnemySnap[]) {
    for (const s of snaps) {
      const x = Phaser.Math.Clamp(s.x, 10, WORLD - 10), y = Phaser.Math.Clamp(s.y, 10, WORLD - 10);
      this.spawn(s.type, x, y, 1, s);
    }
  }
}
