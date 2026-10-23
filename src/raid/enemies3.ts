import Phaser from 'phaser';
import { TILE } from '../config/constants';
import { ENEMY_V3, MUTATIONS } from '../config/v3';
import { PRUEBA_V2, STEALTH } from '../config/v2';
import { V3_TYPES } from '../data/enemies';
import { ESCARCHA } from '../config/v42';
import { Enemy, EnemyManager, isUnaware, RaidCtx } from './enemies';
import { lineClear, rayHit } from './map';

/** Bola de ácido del Escupidor: lenta, siempre visible (por encima de la niebla). */
interface AcidBall { x: number; y: number; vx: number; vy: number; left: number; dmg: number; img: Phaser.GameObjects.Image; ice?: boolean }

const V3 = new Set<string>(V3_TYPES);
const wrap = Phaser.Math.Angle.Wrap;

/**
 * Comportamiento de los enemigos de la v3 (diseño §4 y reglas de §6). La lógica común (sigilo, percepción,
 * daño, tambaleo, muerte) sigue en EnemyManager; aquí van sus ataques y movimientos propios.
 * Regla de oro: ningún aviso empieza fuera de pantalla (canTelegraph / countTele).
 */
export class V3Behaviors {
  balls: AcidBall[] = [];
  /** v4.2: impactos de hielo de la Escarcha (QA). */
  iceHits = 0;
  /** Agarre del Reptante en curso. */
  grab: { e: Enemy; t: number; lastDir: number | null; tick: number } | null = null;
  /** Inmunidad a agarres restante (s). */
  grabImm = 0;
  /** Latidos del borde rojo por emboscada del Acechador (ángulo desde el jugador). */
  pulses: { e: Enemy; ang: number; t: number }[] = [];
  /** Enjambres: tiempo que lleva visible su aviso (mancha + borde) por grupo. */
  cue = new Map<number, number>();
  /** Bordes que vibran (ángulo) del Enjambre, para el HUD. */
  swarmEdges: { ang: number; k: number }[] = [];
  private patches = new Map<number, Phaser.GameObjects.Ellipse>();
  /** Diagnóstico QA de las reglas de justicia. */
  stats = {
    spits: 0, spitsOff: 0, spitAborts: 0, ballHits: 0,
    screams: 0, screamsOff: 0, screamWindups: 0,
    ambushes: 0, ambushHits: 0, ambushNoPulse: 0, ambushNoReveal: 0, revealMin: 99, pulseMin: 99,
    slams: 0, charges: 0, frontHits: 0, backHits: 0,
    grabs: 0, grabsDuringImm: 0, grabWarnMin: 99, grabHalved: 0,
    bites: 0, bitesNoCue: 0, cueMin: 99,
    regen: 0,
  };
  constructor(private m: EnemyManager, private c: RaidCtx) {}

  handles(e: Enemy) { return V3.has(e.ai); }

  // ------------------------------------------------------------------ visibilidad
  /**
   * Acechador: casi invisible. Se ve entero a ≤ 3 casillas o al revelarse (0,6 s antes del golpe, siempre, aunque esté fuera
   * del cono); dentro de tu cono solo como distorsión. Devuelve si cuenta como "visible".
   */
  visibility(e: Enemy, vis: boolean, dist: number) {
    if (e.def.type === 'reptante') { e.rig.setVisible(!e.submerged); return !e.submerged && vis; }
    if (e.def.type !== 'acechador') return vis;
    const A = ENEMY_V3.acechador;
    const revealed = (e.state === 'windup' && e.t <= A.revealSec) || e.state === 'attack' || e.state === 'recover';
    const near = dist <= A.nearVisibleTiles * TILE;
    const c = e.rig.c;
    if (revealed || near) {
      c.setAlpha(1); c.setDepth(vis ? 8 : 15); // fuera del cono se dibuja por encima de la niebla (depth 14)
      e.rig.setVisible(true);
      return true;
    }
    if (vis) { c.setAlpha(A.distortionAlpha * (0.7 + 0.3 * Math.sin(this.c.elapsed() * 23))); c.setDepth(8); return false; }
    return false;
  }

  /** ¿Puede empezar un aviso? El Acechador ataca fuera del cono, pero nunca fuera de pantalla. */
  canTelegraph(e: Enemy) {
    if (e.def.type === 'acechador' || e.def.type === 'reptante') return this.c.onScreen(e.x, e.y, Math.max(TILE * 0.75, e.def.size * 0.6));
    return this.m.canTelegraph(e);
  }

  // ------------------------------------------------------------------ por enemigo
  /** Devuelve true si se ha encargado del enemigo este fotograma. */
  update(e: Enemy, dt: number, dist: number, px: number, py: number): boolean {
    switch (e.ai) {
      case 'escupidor': return this.escupidor(e, dt, dist, px, py);
      case 'chillon': return this.chillon(e, dt, dist, px, py);
      case 'acechador': return this.acechador(e, dt, dist, px, py);
      case 'bruto': return this.bruto(e, dt, dist, px, py);
      case 'reptante': return this.reptante(e, dt, dist, px, py);
      case 'enjambre': return this.enjambre(e, dt, dist, px, py);
    }
    return false;
  }

  private face(e: Enemy, ang: number, rate: number, dt: number) { e.facing = Phaser.Math.Angle.RotateTo(e.facing, ang, rate * dt); }
  private faceVel(e: Enemy, dt: number, rate = 9) { const v = e.body.velocity; if (v.length() > 12) this.face(e, Math.atan2(v.y, v.x), rate, dt); }

  /** Te ha perdido: vuelve a sospecha en el último sitio donde te vio (igual que los de la v1). */
  private lost(e: Enemy, px: number, py: number) {
    if (e.sees) { e.t = Math.max(e.t, 0); return false; }
    if (e.t > -3) return false;
    const l = e.lastSeen ?? { x: px, y: py };
    e.state = 'investigate'; e.meter = 0.5; e.goal = { x: l.x, y: l.y, until: this.c.elapsed() + 6 }; e.susPhase = 'go';
    return true;
  }

  private recover(e: Enemy, dt: number) { e.body.velocity.scale(0.85); this.faceVel(e, dt, 4); if (e.t <= 0) { e.state = 'chase'; e.t = 0; } return true; }

  // ---- Escupidor: mantiene 4-7 casillas, se aleja si te acercas, escupe con aviso de 0,6 s ----
  private escupidor(e: Enemy, dt: number, dist: number, px: number, py: number) {
    const E = ENEMY_V3.escupidor, sp = e.def.speed * TILE * e.speedK;
    const ang = Math.atan2(py - e.y, px - e.x);
    if (e.state === 'windup') {
      e.body.setVelocity(0, 0);
      this.face(e, ang, 6, dt);
      e.rig.charge = Phaser.Math.Clamp(1 - e.t / E.windupSec, 0, 1);
      if (e.t > 0) return true;
      // regla §6: solo dispara si sigue en pantalla y en tu cono de visión
      if (this.m.canTelegraph(e) && lineClear(this.c.walls, e.x, e.y, px, py)) this.spit(e, e.facing);
      else this.stats.spitAborts++;
      this.m.clearTele(e);
      e.state = 'recover'; e.t = E.recoverSec; e.cd = E.cooldownSec;
      return true;
    }
    if (e.state === 'recover') return this.recover(e, dt);
    if (e.state !== 'chase') return false;
    if (this.lost(e, px, py)) return true;
    e.cd -= dt;
    if (e.sees) this.face(e, ang, 6, dt); else this.faceVel(e, dt);
    if (e.sees && dist < E.fleeTiles * TILE) this.m.moveTo(e, e.x - Math.cos(ang) * TILE * 2, e.y - Math.sin(ang) * TILE * 2, sp);
    // en vertical la pantalla es estrecha (~4 casillas a cada lado): si no está en pantalla se acerca hasta entrar,
    // porque solo puede escupir desde un sitio donde lo ves (§6)
    else if (!e.sees || dist > E.keepMaxTiles * TILE || !this.c.onScreen(e.x, e.y, TILE * 0.6)) this.m.chaseMove(e, px, py, sp, dist);
    else if (dist < E.keepMinTiles * TILE) this.m.moveTo(e, e.x - Math.cos(ang) * TILE, e.y - Math.sin(ang) * TILE, sp * 0.6);
    else { const s = e.flankSide || 1; e.body.setVelocity(-Math.sin(ang) * s * sp * 0.35, Math.cos(ang) * s * sp * 0.35); }
    if (e.cd <= 0 && e.sees && dist <= E.spitRangeTiles * TILE && this.m.canTelegraph(e) && lineClear(this.c.walls, e.x, e.y, px, py)) {
      this.m.countTele(e);
      e.state = 'windup'; e.t = E.windupSec; e.body.setVelocity(0, 0);
      e.tint(e.def.type === 'escarcha' ? 0x9fe6ff : 0xc6ff3c);
    }
    return true;
  }

  private spit(e: Enemy, ang: number) {
    const E = ENEMY_V3.escupidor;
    if (!this.c.onScreen(e.x, e.y, 0)) this.stats.spitsOff++;
    this.stats.spits++;
    const v = E.spitTilesPerSec * TILE;
    const x = e.x + Math.cos(ang) * e.def.size * 0.4, y = e.y + Math.sin(ang) * e.def.size * 0.4;
    // v4.2: la Escarcha escupe hielo (ralentiza, sin veneno)
    const ice = e.def.type === 'escarcha';
    const key = ice && this.c.world.textures.exists('v4/proyectil_hielo') ? 'v4/proyectil_hielo' : 'proyectil_acido';
    const img = this.c.world.add.image(x, y, key).setDisplaySize(24, 24).setDepth(15).setRotation(ang + Math.PI / 2);
    this.balls.push({ x, y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, left: E.spitRangeTiles * TILE * 1.25, dmg: ice ? ESCARCHA.dmg : e.dmg, img, ice });
  }

  private updateBalls(dt: number) {
    const E = ENEMY_V3.escupidor, px = this.c.px(), py = this.c.py();
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i];
      const nx = b.x + b.vx * dt, ny = b.y + b.vy * dt;
      const t = rayHit(this.c.walls, b.x, b.y, nx, ny);
      b.x += (nx - b.x) * t; b.y += (ny - b.y) * t; b.left -= Math.hypot(b.vx, b.vy) * dt;
      b.img.setPosition(b.x, b.y);
      let done = t < 1 || b.left <= 0;
      if (!done && Math.hypot(px - b.x, py - b.y) < this.c.playerRadius + E.hitRadiusPx) {
        done = true; this.stats.ballHits++;
        if (b.ice) { this.c.damagePlayer(b.dmg, 'Hielo de Escarcha'); this.c.slowPlayer?.(ESCARCHA.slow, ESCARCHA.slowSec); this.iceHits++; }
        else { this.c.damagePlayer(b.dmg, 'Ácido de Escupidor'); this.c.addStatus('poison', E.poisonStacks); }
      }
      if (done) {
        const fx = this.c.world.add.circle(b.x, b.y, 14, b.ice ? 0xbfeaff : 0xb6ff3c, 0.6).setDepth(15);
        this.c.world.tweens.add({ targets: fx, alpha: 0, scale: 1.8, duration: 220, onComplete: () => fx.destroy() });
        b.img.destroy(); this.balls.splice(i, 1);
      }
    }
  }

  // ---- Chillón: no hace daño; se yergue 1,2 s y grita (atrae a todo en 12 casillas) ----
  private chillon(e: Enemy, dt: number, dist: number, px: number, py: number) {
    const C = ENEMY_V3.chillon, sp = e.def.speed * TILE * e.speedK;
    const ang = Math.atan2(py - e.y, px - e.x);
    if (e.state === 'windup') {
      e.body.setVelocity(0, 0);
      this.face(e, ang, 4, dt);
      const k = Phaser.Math.Clamp(1 - e.t / C.windupSec, 0, 1);
      e.rig.charge = k; e.tint(Math.floor(e.t * 8) % 2 ? 0xffb347 : 0xffffff);
      if (e.warn) e.warn.setDisplaySize(TILE * (1.2 + 1.6 * k) * 2, TILE * (1.2 + 1.6 * k) * 2).setAlpha(0.35 + 0.5 * k);
      if (e.t > 0) return true;
      this.stats.screams++;
      if (!this.c.onScreen(e.x, e.y, 0)) this.stats.screamsOff++;
      const wave = this.c.world.add.image(e.x, e.y, 'fx_onda_grito').setDepth(15).setDisplaySize(TILE * 2, TILE * 2);
      this.c.world.tweens.add({ targets: wave, displayWidth: C.screamTiles * TILE * 2, displayHeight: C.screamTiles * TILE * 2, alpha: 0, duration: 700, onComplete: () => wave.destroy() });
      this.c.world.cameras.main.shake(160, 0.004);
      this.c.onScream?.(e);
      this.m.clearTele(e);
      e.state = 'recover'; e.t = 0.8; e.cd = C.cooldownSec;
      return true;
    }
    if (e.state === 'recover') return this.recover(e, dt);
    if (e.state !== 'chase') return false;
    if (this.lost(e, px, py)) return true;
    e.cd -= dt;
    if (e.sees) this.face(e, ang, 6, dt); else this.faceVel(e, dt);
    if (!e.sees || dist > C.holdTiles * TILE || !this.c.onScreen(e.x, e.y, TILE * 0.6)) this.m.chaseMove(e, px, py, sp, dist);
    else if (dist < 3.5 * TILE) this.m.moveTo(e, e.x - Math.cos(ang) * TILE, e.y - Math.sin(ang) * TILE, sp * 0.7);
    else e.body.velocity.scale(0.8);
    if (e.cd <= 0 && e.sees && this.m.canTelegraph(e)) {
      this.m.countTele(e); this.stats.screamWindups++;
      e.state = 'windup'; e.t = C.windupSec; e.body.setVelocity(0, 0);
      e.warn = this.c.world.add.image(e.x, e.y, 'fx_onda_grito').setDisplaySize(TILE * 2.4, TILE * 2.4).setDepth(5).setAlpha(0.35);
    }
    return true;
  }

  // ---- Acechador: se coloca a tu espalda; borde rojo 0,8 s + visible 0,6 s antes de golpear ----
  private acechador(e: Enemy, dt: number, dist: number, px: number, py: number) {
    const A = ENEMY_V3.acechador, sp = e.def.speed * TILE * e.speedK;
    const ang = Math.atan2(py - e.y, px - e.x);
    if (e.state === 'windup') {
      e.body.setVelocity(0, 0);
      this.face(e, ang, 8, dt);
      e.rig.crouch = 1;
      const p = this.pulses.find(q => q.e === e); if (p) p.ang = Math.atan2(e.y - py, e.x - px);
      if (e.t > 0) return true;
      // al saltar: debe haberse visto 0,6 s y, si estaba fuera del cono, el borde latió 0,8 s
      const shown = A.edgeSec - Math.max(0, e.t);
      this.stats.revealMin = Math.min(this.stats.revealMin, Math.min(shown, A.revealSec));
      if (p) this.stats.pulseMin = Math.min(this.stats.pulseMin, A.edgeSec - p.t);
      this.pulses = this.pulses.filter(q => q.e !== e);
      e.state = 'attack'; e.t = A.lungeSec; e.hitDone = false;
      e.dir.set(Math.cos(e.facing), Math.sin(e.facing));
      const v = (A.lungeTiles * TILE) / A.lungeSec;
      e.body.setVelocity(e.dir.x * v, e.dir.y * v);
      return true;
    }
    if (e.state === 'attack') {
      if (!e.hitDone && dist < this.c.playerRadius + e.def.size * 0.4) { e.hitDone = true; this.stats.ambushHits++; this.c.damagePlayer(e.dmg, 'Acechador'); if (Math.random() < PRUEBA_V2.status.bleedChance) this.c.addStatus('bleed', 1); }
      if (e.t <= 0 || !e.body.blocked.none) { this.m.clearTele(e); e.state = 'recover'; e.t = A.recoverSec; e.cd = 2; e.body.setVelocity(0, 0); }
      return true;
    }
    if (e.state === 'recover') { e.body.velocity.scale(0.85); if (e.t <= 0) { e.state = 'chase'; e.t = 0; } return true; }
    if (e.state !== 'chase') return false;
    if (this.lost(e, px, py)) return true;
    e.cd -= dt;
    // busca tu espalda: un punto detrás de hacia donde miras
    const pf = this.c.pfacing?.() ?? 0;
    const bx = px - Math.cos(pf) * A.behindTiles * TILE, by = py - Math.sin(pf) * A.behindTiles * TILE;
    const toB = Math.hypot(bx - e.x, by - e.y);
    if (toB > TILE * 0.6 && dist > A.triggerTiles * TILE * 0.8) this.m.pathMove(e, toB < dist ? bx : px, toB < dist ? by : py, sp);
    else e.body.velocity.scale(0.7);
    this.faceVel(e, dt);
    if (e.cd <= 0 && dist < A.triggerTiles * TILE * 1.3 && this.canTelegraph(e) && lineClear(this.c.walls, e.x, e.y, px, py)) {
      this.m.countTele(e); this.stats.ambushes++;
      e.state = 'windup'; e.t = A.edgeSec; e.body.setVelocity(0, 0);
      // borde rojo late fuerte en su lado (siempre; también si lo ves)
      this.pulses.push({ e, ang: Math.atan2(e.y - py, e.x - px), t: A.edgeSec });
      this.c.vibrate?.(60);
    }
    return true;
  }

  // ---- Bruto: frente blindado, gira despacio; golpe en arco y carga corta ----
  private bruto(e: Enemy, dt: number, dist: number, px: number, py: number) {
    const B = ENEMY_V3.bruto, sp = e.def.speed * TILE * e.speedK;
    const ang = Math.atan2(py - e.y, px - e.x);
    if (e.state === 'windup') {
      e.body.setVelocity(0, 0);
      e.rig.raise = 1; e.rig.charge = 1;
      e.tint(Math.floor(e.t * 10) % 2 ? 0xff3b30 : 0xffaaaa);
      if (e.t > 0) return true;
      if (e.sub === 'charge') {
        this.stats.charges++;
        e.state = 'attack'; e.t = B.chargeSec; e.hitDone = false;
        const v = (B.chargeTiles * TILE) / B.chargeSec;
        e.body.setVelocity(e.dir.x * v, e.dir.y * v);
        return true;
      }
      this.stats.slams++;
      const r = B.slamTiles * TILE, half = Phaser.Math.DegToRad(B.slamArcDeg / 2);
      if (dist <= r + this.c.playerRadius * 0.5 && Math.abs(wrap(ang - e.facing)) <= half) { this.c.damagePlayer(e.dmg, 'Bruto'); if (Math.random() < PRUEBA_V2.status.bleedChance) this.c.addStatus('bleed', 1); }
      const g = this.c.world.add.graphics().setDepth(20);
      g.fillStyle(0xff3b30, 0.4).slice(e.x, e.y, r, e.facing - half, e.facing + half, false).fillPath();
      this.c.world.tweens.add({ targets: g, alpha: 0, duration: 250, onComplete: () => g.destroy() });
      this.c.world.cameras.main.shake(110, 0.007);
      this.m.clearTele(e);
      e.state = 'recover'; e.t = B.recoverSec;
      return true;
    }
    if (e.state === 'attack') {
      if (!e.hitDone && dist < this.c.playerRadius + e.def.size * 0.45) { e.hitDone = true; this.c.damagePlayer(e.dmg * 0.6, 'Carga de Bruto'); }
      if (e.t <= 0 || !e.body.blocked.none) { this.m.clearTele(e); e.state = 'recover'; e.t = B.recoverSec; e.cd = B.chargeCooldownSec; e.body.setVelocity(0, 0); }
      return true;
    }
    if (e.state === 'recover') { e.body.velocity.scale(0.8); if (e.t <= 0) { e.state = 'chase'; e.t = 0; } return true; }
    if (e.state !== 'chase') return false;
    if (this.lost(e, px, py)) return true;
    e.cd -= dt;
    // gira despacio hacia ti: flanquearlo funciona
    const want = e.sees ? ang : Math.atan2(e.body.velocity.y, e.body.velocity.x);
    this.face(e, want, B.turnRadPerSec, dt);
    const off = Math.abs(wrap(ang - e.facing));
    if (e.sees) {
      const k = off < 0.6 ? 1 : off < 1.2 ? 0.45 : 0.15;
      e.body.setVelocity(Math.cos(e.facing) * sp * k, Math.sin(e.facing) * sp * k);
    } else this.m.chaseMove(e, px, py, sp, dist);
    if (!e.sees || !this.m.canTelegraph(e)) return true;
    if (dist < B.slamTiles * TILE * 0.85 && off < Phaser.Math.DegToRad(45)) {
      this.m.countTele(e); this.startBrute(e, 'slam');
    } else if (e.cd <= 0 && dist >= B.chargeMinTiles * TILE && dist <= B.chargeMaxTiles * TILE && off < Phaser.Math.DegToRad(15) && lineClear(this.c.walls, e.x, e.y, px, py)) {
      this.m.countTele(e); this.startBrute(e, 'charge');
    }
    return true;
  }

  private startBrute(e: Enemy, kind: 'slam' | 'charge') {
    const B = ENEMY_V3.bruto;
    e.state = 'windup'; e.t = B.windupSec; e.sub = kind; e.body.setVelocity(0, 0);
    e.dir.set(Math.cos(e.facing), Math.sin(e.facing));
    e.tele = this.c.world.add.graphics().setDepth(4);
    e.tele.fillStyle(0xff3b30, 0.25).lineStyle(2, 0xff3b30, 0.85);
    if (kind === 'slam') {
      const half = Phaser.Math.DegToRad(B.slamArcDeg / 2);
      e.tele.slice(e.x, e.y, B.slamTiles * TILE, e.facing - half, e.facing + half, false).fillPath().strokePath();
    } else {
      const L = B.chargeTiles * TILE + e.def.size * 0.4;
      e.tele.save(); e.tele.translateCanvas(e.x, e.y); e.tele.rotateCanvas(e.facing);
      e.tele.fillRect(0, -TILE * 0.6, L, TILE * 1.2); e.tele.strokeRect(0, -TILE * 0.6, L, TILE * 1.2);
      e.tele.restore();
    }
  }

  /** Frente blindado del Bruto: el golpe llega desde su arco frontal (120°) → daño ×0,3. `ang` = dirección del golpe. */
  armorMult(e: Enemy, ang: number) {
    if (e.def.type !== 'bruto') return 1;
    const B = ENEMY_V3.bruto;
    const from = ang + Math.PI; // de dónde viene el golpe, visto desde el Bruto
    const front = Math.abs(wrap(from - e.facing)) <= Phaser.Math.DegToRad(B.frontArcDeg / 2);
    if (front) { this.stats.frontHits++; const s = this.c.world.add.circle(e.x + Math.cos(e.facing) * e.def.size * 0.4, e.y + Math.sin(e.facing) * e.def.size * 0.4, 7, 0xfff2a8, 1).setDepth(12); this.c.world.tweens.add({ targets: s, alpha: 0, scale: 2, duration: 160, onComplete: () => s.destroy() }); return B.frontDamageMult; }
    this.stats.backHits++;
    return 1;
  }

  // ---- Reptante: bajo una alcantarilla; burbujea 1 s y te agarra 2 s ----
  private reptante(e: Enemy, dt: number, dist: number, px: number, py: number) {
    const R = ENEMY_V3.reptante;
    const sx = e.gx ?? e.x, sy = e.gy ?? e.y;
    e.body.setVelocity(0, 0);
    if (Math.abs(e.x - sx) > 0.5 || Math.abs(e.y - sy) > 0.5) e.sprite.setPosition(sx, sy);
    const toSewer = Math.hypot(px - sx, py - sy);
    if (e.sub === 'grab') {
      // la lógica del agarre va en updateGrab
      e.facing = Math.atan2(py - e.y, px - e.x);
      if (!this.grab || this.grab.e !== e) { this.surface(e, false); e.sub = 'up'; e.t = 1; }
      return true;
    }
    if (e.sub === 'warn') {
      if (e.warn) e.warn.setAlpha(0.6 + 0.4 * Math.sin(this.c.elapsed() * 18)).setScale(e.warn.scaleX);
      if (e.t > 0) return true;
      e.warn?.destroy(); e.warn = null;
      this.surface(e, true);
      if (!this.grab && this.grabImm <= 0 && toSewer <= R.grabTiles * TILE + this.c.playerRadius) {
        this.stats.grabs++;
        this.stats.grabWarnMin = Math.min(this.stats.grabWarnMin, R.warnSec);
        e.sub = 'grab';
        this.grab = { e, t: R.grabSec, lastDir: null, tick: 0 };
        this.c.onGrab?.(true);
      } else { e.sub = 'up'; e.t = R.surfaceSec; }
      return true;
    }
    if (e.sub === 'up') {
      this.face(e, Math.atan2(py - e.y, px - e.x), 4, dt);
      if (e.t <= 0) { this.submerge(e); e.cd = R.cooldownSec; }
      return true;
    }
    // bajo tierra
    e.sub = 'under';
    if (!e.submerged) this.submerge(e);
    e.cd -= dt;
    if (e.cd <= 0 && !this.grab && this.grabImm <= 0 && toSewer < R.triggerTiles * TILE && this.c.onScreen(sx, sy, TILE)) {
      this.m.countTele(e);
      e.sub = 'warn'; e.t = R.warnSec; e.state = 'windup';
      e.warn = this.c.world.add.image(sx, sy, 'fx_burbujas').setDisplaySize(TILE * 2.2, TILE * 2.2).setDepth(15);
    }
    return true;
  }

  private surface(e: Enemy, on: boolean) {
    e.submerged = !on;
    e.body.enable = on;
    e.state = on ? 'chase' : 'idle';
    e.rig.setVisible(on);
    if (on) { e.meter = 1; }
  }
  private submerge(e: Enemy) { this.surface(e, false); e.sub = 'under'; this.m.clearTele(e); }

  /** El jugador mueve el joystick: de lado a lado rápido acorta el agarre. */
  wiggle(vx: number, vy: number) {
    const g = this.grab; if (!g) return;
    if (Math.hypot(vx, vy) < 0.5) return;
    const a = Math.atan2(vy, vx);
    if (g.lastDir !== null && Math.abs(wrap(a - g.lastDir)) >= Phaser.Math.DegToRad(ENEMY_V3.reptante.wiggleDeg)) { g.t -= ENEMY_V3.reptante.wiggleCutSec; g.lastDir = a; }
    else if (g.lastDir === null) g.lastDir = a;
  }

  private updateGrab(dt: number) {
    if (this.grabImm > 0) this.grabImm -= dt;
    const g = this.grab; if (!g) return;
    g.t -= dt; g.tick -= dt;
    if (g.tick <= 0 && !g.e.dead) { g.tick = 0.5; this.c.damagePlayer(g.e.dmg * 0.5, 'Reptante'); }
    if (g.t <= 0 || g.e.dead) this.release();
  }

  release() {
    const g = this.grab; if (!g) return;
    this.grab = null;
    this.grabImm = ENEMY_V3.reptante.immunitySec;
    this.c.onGrab?.(false);
    if (!g.e.dead) { g.e.sub = 'up'; g.e.t = 1; }
  }

  /** Mientras te agarra, los demás te hacen la mitad de daño (§6). */
  dmgMult(cause: string) {
    if (!this.grab || cause === 'Reptante') return 1;
    this.stats.grabHalved++;
    return ENEMY_V3.reptante.othersDmgMult;
  }

  // ---- Enjambre: bichos ciegos que oyen; mancha oscura + borde que vibra antes de morder ----
  private enjambre(e: Enemy, dt: number, dist: number, px: number, py: number) {
    const S = ENEMY_V3.enjambre, sp = e.def.speed * TILE * e.speedK;
    if (e.state === 'investigate' && dist < 3 * TILE) { this.m.becomeAlert(e); return true; }
    if (e.state === 'windup') {
      e.body.velocity.scale(0.6);
      if (e.t > 0) return true;
      const reach = this.c.playerRadius + e.def.size * 0.5 + S.triggerTiles * TILE;
      if (dist <= reach * 1.3) {
        const cue = this.cue.get(e.group ?? -1) ?? 0;
        if (cue < S.cueBeforeBiteSec && !e.visibleNow) this.stats.bitesNoCue++;
        this.stats.cueMin = Math.min(this.stats.cueMin, e.visibleNow ? 99 : cue);
        this.stats.bites++;
        this.c.damagePlayer(e.dmg, 'Enjambre');
      }
      e.state = 'recover'; e.t = 0.15; e.cd = S.biteCooldownSec; e.tint(null);
      return true;
    }
    if (e.state === 'recover') return this.recover(e, dt);
    if (e.state !== 'chase') return false;
    e.cd -= dt;
    // rastrea por el oído mientras estés cerca
    if (dist > S.trackTiles * TILE * 1.4) { e.state = 'investigate'; e.goal = { x: px, y: py, until: this.c.elapsed() + 5 }; e.susPhase = 'go'; return true; }
    const ph = (e.flankPhase += dt * 3);
    const ox = Math.cos(ph) * TILE * 0.6, oy = Math.sin(ph * 1.3) * TILE * 0.6;
    this.m.pathMove(e, px + ox, py + oy, sp);
    this.faceVel(e, dt, 14);
    const reach = this.c.playerRadius + e.def.size * 0.5 + S.triggerTiles * TILE;
    if (e.cd <= 0 && dist <= reach && this.c.onScreen(e.x, e.y, 0)) {
      const cue = this.cue.get(e.group ?? -1) ?? 0;
      if (e.visibleNow || cue >= S.cueBeforeBiteSec) {
        this.m.countTele(e);
        e.state = 'windup'; e.t = S.windupSec; e.tint(0xff3b30);
      }
    }
    return true;
  }

  /** Mancha oscura por grupo (por encima de la niebla) y bordes que vibran; acumula el tiempo de aviso. */
  private updateSwarms(dt: number) {
    const S = ENEMY_V3.enjambre, px = this.c.px(), py = this.c.py();
    const groups = new Map<number, Enemy[]>();
    for (const e of this.m.list) if (e.def.type === 'enjambre' && !e.dead && e.group !== undefined) { const l = groups.get(e.group) ?? []; l.push(e); groups.set(e.group, l); }
    this.swarmEdges = [];
    for (const [id, l] of groups) {
      let cx = 0, cy = 0; for (const e of l) { cx += e.x; cy += e.y; } cx /= l.length; cy /= l.length;
      let rr = 0; for (const e of l) rr = Math.max(rr, Math.hypot(e.x - cx, e.y - cy));
      const d = Math.hypot(cx - px, cy - py);
      const coming = l.some(e => !isUnaware(e)) && d < S.cueTiles * TILE;
      let p = this.patches.get(id);
      if (!p) { p = this.c.world.add.ellipse(cx, cy, 10, 10, 0x0b0812, 0.5).setDepth(14.5); this.patches.set(id, p); }
      const w = Math.max(TILE * 1.2, rr * 2 + TILE * 0.6);
      const j = Math.sin(this.c.elapsed() * 31) * 3;
      p.setPosition(cx + j, cy - j).setSize(w, w * 0.8).setVisible(coming).setAlpha(0.45 + 0.1 * Math.sin(this.c.elapsed() * 17));
      if (coming) {
        this.cue.set(id, (this.cue.get(id) ?? 0) + dt);
        const onScr = this.c.onScreen(cx, cy, 0);
        if (!onScr || !this.c.visible(cx, cy, rr)) this.swarmEdges.push({ ang: Math.atan2(cy - py, cx - px), k: 1 - d / (S.cueTiles * TILE) });
      } else this.cue.set(id, 0);
    }
    for (const [id, p] of this.patches) if (!groups.has(id)) { p.destroy(); this.patches.delete(id); this.cue.delete(id); }
  }

  /** Regenerador: recupera vida si nadie le pega en 3 s. */
  private updateMutations(dt: number) {
    const R = MUTATIONS.regenerador, now = this.c.elapsed();
    for (const e of this.m.list) {
      if (e.mut !== 'regenerador' || e.dead || e.hp >= e.maxHp || e.state === 'swell') continue;
      if (now - e.lastHitAt < R.afterSec) continue;
      e.hp = Math.min(e.maxHp, e.hp + e.maxHp * R.pctPerSec * dt);
      this.stats.regen += e.maxHp * R.pctPerSec * dt;
    }
  }

  /** Por fotograma, después de mover a los enemigos. */
  updateGlobal(dt: number) {
    this.updateBalls(dt);
    this.updateGrab(dt);
    for (const p of this.pulses) p.t -= dt;
    this.pulses = this.pulses.filter(p => p.t > -0.2 && !p.e.dead && p.e.state === 'windup');
    this.updateSwarms(dt);
    this.updateMutations(dt);
  }

  /** Bandas de borde para el HUD: latido fuerte del Acechador. */
  vignette(): { ang: number; k: number }[] {
    const now = this.c.elapsed();
    return this.pulses.map(p => ({ ang: p.ang, k: 2.2 * (0.65 + 0.35 * Math.sin(now * 28)) }));
  }

  /** ¿Ves la mancha / los bichos? (para QA) */
  noiseHear(e: Enemy, r: number) { return Math.max(r, (STEALTH.minHearTiles[e.def.type] ?? 0) * TILE); }

  destroy() { for (const b of this.balls) b.img.destroy(); this.balls = []; for (const p of this.patches.values()) p.destroy(); this.patches.clear(); }
}
