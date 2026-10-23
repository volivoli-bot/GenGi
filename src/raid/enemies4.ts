import Phaser from 'phaser';
import { TILE } from '../config/constants';
import { MATRIARCA } from '../config/v42';
import type { EnemyType } from '../data/enemies';
import type { Enemy, EnemyManager, RaidCtx } from './enemies';
import { lineClear, pointInWalls, rayHit } from './map';

const wrap = Phaser.Math.Angle.Wrap;
type Attack = 'stomp' | 'lances' | 'breath' | 'call';

/** Estado propio de la Matriarca (lo que no cabe en Enemy). */
interface BossState {
  engaged: boolean;
  /** Umbrales de llamada ya usados. */
  calls: number[];
  atk: Attack | null;
  /** Fase del ataque: aviso → activo. */
  phase: 'warn' | 'active';
  lines: { ang: number; len: number }[];
  gfx: Phaser.GameObjects.GameObject[];
  breathAng: number;
  breathTick: number;
  icicleT: number;
  chain: boolean;
  /** Tiempo que le queda a la fase del ataque (s). */
  t: number;
  look: number;
}
interface Puddle { x: number; y: number; t: number; img: Phaser.GameObjects.Image }
interface Icicle { x: number; y: number; t: number; img: Phaser.GameObjects.Image }

/**
 * v4.2 (diseno-v4 §4): La Matriarca. Guarda su arena; todos sus ataques se avisan y ninguno empieza fuera de pantalla.
 * 1 pisotón en anillo · 2 lanzas de hielo (las paredes/columnas cortan la línea) · 3 aliento helado (cono que ralentiza,
 * deja charcos) · 4 llamada al 60 % y al 30 % · 5 fase 2 por debajo del 40 % (más rápida, pisotón + lanzas, carámbanos).
 * Punto débil: la espalda (×2).
 */
export class V4Boss {
  private st = new WeakMap<Enemy, BossState>();
  puddles: Puddle[] = [];
  icicles: Icicle[] = [];
  /** Diagnóstico QA. */
  stats = { stomps: 0, stompHits: 0, lances: 0, lanceHits: 0, lanceBlocked: 0, breaths: 0, breathTicks: 0, calls: 0, summoned: 0, icicles: 0, icicleHits: 0, backHits: 0, frontHits: 0, teleOff: 0, phase2: false, shellBreaks: 0 };
  constructor(private m: EnemyManager, private c: RaidCtx) {}

  state(e: Enemy) {
    let s = this.st.get(e);
    if (!s) {
      const k = e.hp / e.maxHp;
      s = { engaged: false, calls: MATRIARCA.callAt.filter(t => k <= t), atk: null, phase: 'warn', lines: [], gfx: [], breathAng: 0, breathTick: 0, icicleT: MATRIARCA.icicleEverySec, chain: false, t: 0, look: Math.random() * 10 };
      this.st.set(e, s);
    }
    return s;
  }

  /** Daño ×2 si el golpe le llega por la espalda (`ang` = dirección en la que viaja el golpe). */
  backMult(e: Enemy, ang: number) {
    const back = Math.abs(wrap(ang - e.facing)) <= Phaser.Math.DegToRad(MATRIARCA.backArcDeg / 2);
    if (back) { this.stats.backHits++; return MATRIARCA.backMult; }
    this.stats.frontHits++; return 1;
  }

  /** Congelado: el caparazón salta en esquirlas. */
  shatter(e: Enemy) {
    this.stats.shellBreaks++;
    const w = this.c.world;
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = w.add.rectangle(e.x, e.y, 6, 3, 0xdff4ff, 1).setDepth(12).setRotation(a);
      w.tweens.add({ targets: s, x: e.x + Math.cos(a) * 26, y: e.y + Math.sin(a) * 26, alpha: 0, duration: 260, onComplete: () => s.destroy() });
    }
  }

  private phase2(e: Enemy) { return e.hp / e.maxHp < MATRIARCA.phase2At; }
  private clear(s: BossState) { for (const g of s.gfx) g.destroy(); s.gfx.length = 0; }

  update(e: Enemy, dt: number, dist: number, px: number, py: number): boolean {
    const M = MATRIARCA, s = this.state(e), b = e.body;
    const gx = e.gx ?? e.x, gy = e.gy ?? e.y;
    const p2 = this.phase2(e);
    if (p2 && !this.stats.phase2) { this.stats.phase2 = true; this.c.toast?.('La Matriarca se enfurece', 2); }
    const sp = e.def.speed * TILE * (p2 ? M.p2Speed : 1);
    const fromGuard = Math.hypot(px - gx, py - gy);
    const ang = Math.atan2(py - e.y, px - e.x);
    // fase 2: carámbanos (siguen cayendo durante sus ataques)
    if (p2 && s.engaged) this.iciclesTick(s, dt, px, py);
    // un ataque empezado siempre termina
    if (s.atk) return this.runAttack(e, s, dt, px, py, ang, p2);
    // activación / correa
    if (!s.engaged) {
      // te ve, la alertan (ruido fuerte, golpe) o entras a menos de `feelTiles` de ella con línea de visión
      const feel = dist < M.feelTiles * TILE && lineClear(this.c.walls, e.x, e.y, px, py);
      if ((e.sees || e.state === 'chase' || feel) && fromGuard < M.arenaTiles * TILE) { s.engaged = true; e.state = 'chase'; e.meter = 1; e.cd = 0.8; }
      else {
        b.setVelocity(0, 0);
        if (Math.hypot(e.x - gx, e.y - gy) > TILE) this.m.moveTo(e, gx, gy, sp * 0.6, TILE * 0.5);
        if (e.state === 'investigate' && e.goal) e.facing = Phaser.Math.Angle.RotateTo(e.facing, Math.atan2(e.goal.y - e.y, e.goal.x - e.x), dt * 2);
        else { s.look += dt; e.facing += Math.sin(s.look * 0.5) * 0.25 * dt; } // vigila la arena girando despacio
        return true;
      }
    }
    if (fromGuard > M.leashTiles * TILE) { s.engaged = false; e.state = 'idle'; e.meter = 0; return true; }
    // llamada (60 % / 30 %): tiene prioridad sobre el siguiente ataque
    const k = e.hp / e.maxHp;
    const callAt = M.callAt.find(t => k <= t && !s.calls.includes(t));
    if (callAt !== undefined && this.m.canTelegraph(e)) { s.calls.push(callAt); this.start(e, s, 'call'); return true; }
    e.cd -= dt;
    if (e.cd <= 0 && this.m.canTelegraph(e)) {
      if (dist < M.stompTiles * TILE * 1.05) this.start(e, s, 'stomp');
      else if (dist < M.breathTiles * TILE * 0.9 && Math.random() < 0.45) this.start(e, s, 'breath');
      else this.start(e, s, 'lances');
      return true;
    }
    // se acerca (gira despacio: es grande)
    e.facing = Phaser.Math.Angle.RotateTo(e.facing, ang, dt * 2.2);
    if (dist > M.stompTiles * TILE * 0.6) this.m.chaseMove(e, px, py, sp, dist); else b.setVelocity(0, 0);
    return true;
  }

  private start(e: Enemy, s: BossState, atk: Attack) {
    const M = MATRIARCA, w = this.c.world;
    if (!this.c.onScreen(e.x, e.y, 0)) this.stats.teleOff++;
    this.m.countTele(e);
    s.atk = atk; s.phase = 'warn'; e.body.setVelocity(0, 0);
    const px = this.c.px(), py = this.c.py();
    const ang = Math.atan2(py - e.y, px - e.x);
    if (atk === 'stomp') {
      s.t = M.stompWindup; e.rig.crouch = 1; this.stats.stomps++;
      const r = M.stompTiles * TILE;
      const key = w.textures.exists('v4/aviso_onda') ? 'v4/aviso_onda' : 'aviso-ataque';
      const im = w.add.image(e.x, e.y, key).setDisplaySize(r * 2, r * 2).setDepth(5).setAlpha(0.5);
      w.tweens.add({ targets: im, alpha: { from: 0.45, to: 1 }, duration: 250, yoyo: true, repeat: 1 });
      s.gfx.push(im);
    } else if (atk === 'lances') {
      s.t = M.lanceWarn; e.rig.raise = 0.7; this.stats.lances++;
      e.facing = ang;
      s.lines = [-1, 0, 1].map(i => {
        const a = ang + i * M.lanceSpreadRad;
        const L = M.lanceTiles * TILE;
        const tx = e.x + Math.cos(a) * L, ty = e.y + Math.sin(a) * L;
        return { ang: a, len: L * rayHit(this.c.walls, e.x, e.y, tx, ty) };
      });
      const key = w.textures.exists('v4/aviso_lanza_hielo') ? 'v4/aviso_lanza_hielo' : null;
      for (const l of s.lines) {
        const wd = M.lanceWidthTiles * TILE;
        if (key) s.gfx.push(w.add.image(e.x, e.y, key).setOrigin(0.5, 1).setDisplaySize(wd, l.len).setRotation(l.ang + Math.PI / 2).setDepth(5).setAlpha(0.9));
        else { const g = w.add.graphics().setDepth(5); g.fillStyle(0x9fe6ff, 0.35).save(); g.translateCanvas(e.x, e.y); g.rotateCanvas(l.ang); g.fillRect(0, -wd / 2, l.len, wd); g.restore(); s.gfx.push(g); }
      }
    } else if (atk === 'breath') {
      s.t = M.breathWarn; e.rig.raise = 0.4; this.stats.breaths++;
      e.facing = ang; s.breathAng = ang; s.breathTick = 0;
      const g = w.add.graphics().setDepth(5); s.gfx.push(g);
      this.drawCone(g, e, s.breathAng, false);
    } else {
      s.t = M.callWindup; e.rig.raise = 1; this.stats.calls++;
      this.c.toast?.('¡La Matriarca llama a la manada!', 2);
      const ring = w.add.circle(e.x, e.y, TILE * 2, 0x9fe6ff, 0.25).setDepth(5).setStrokeStyle(3, 0xdff4ff, 0.9);
      w.tweens.add({ targets: ring, scale: 3, alpha: 0, duration: M.callWindup * 1000 });
      s.gfx.push(ring);
    }
  }

  private drawCone(g: Phaser.GameObjects.Graphics, e: Enemy, ang: number, active: boolean) {
    const M = MATRIARCA, half = Phaser.Math.DegToRad(M.breathDeg / 2);
    g.clear();
    g.fillStyle(0xbfeaff, active ? 0.45 : 0.18).lineStyle(3, active ? 0xffffff : 0x6ad8ff, 0.9);
    g.slice(e.x, e.y, M.breathTiles * TILE, ang - half, ang + half, false).fillPath().strokePath();
  }

  private inCone(e: Enemy, ang: number, px: number, py: number) {
    const M = MATRIARCA;
    const d = Math.hypot(px - e.x, py - e.y);
    return d <= M.breathTiles * TILE + this.c.playerRadius * 0.5 && Math.abs(wrap(Math.atan2(py - e.y, px - e.x) - ang)) <= Phaser.Math.DegToRad(M.breathDeg / 2) && lineClear(this.c.walls, e.x, e.y, px, py);
  }

  private runAttack(e: Enemy, s: BossState, dt: number, px: number, py: number, ang: number, p2: boolean): boolean {
    const M = MATRIARCA, w = this.c.world;
    e.body.setVelocity(0, 0);
    if (s.atk === 'breath' && s.phase === 'active') {
      // el cono sigue al jugador despacio
      s.breathAng = Phaser.Math.Angle.RotateTo(s.breathAng, ang, M.breathTurnRad * dt);
      e.facing = s.breathAng;
      this.drawCone(s.gfx[0] as Phaser.GameObjects.Graphics, e, s.breathAng, true);
      if (this.inCone(e, s.breathAng, px, py)) {
        this.c.slowPlayer?.(M.breathSlow, 0.3);
        s.breathTick += dt;
        if (s.breathTick >= 0.5) { s.breathTick -= 0.5; this.stats.breathTicks++; this.c.damagePlayer(M.breathDps * 0.5, 'Aliento de la Matriarca'); }
      }
    }
    s.t -= dt;
    if (s.t > 0) return true;
    const pr = this.c.playerRadius;
    if (s.atk === 'stomp') {
      const r = M.stompTiles * TILE;
      if (Math.hypot(px - e.x, py - e.y) <= r + pr * 0.5) { this.stats.stompHits++; this.c.damagePlayer(M.stompDmg, 'Pisotón de la Matriarca'); }
      const fx = w.add.circle(e.x, e.y, r, 0xdff4ff, 0.45).setDepth(20);
      w.tweens.add({ targets: fx, alpha: 0, scale: 1.1, duration: 260, onComplete: () => fx.destroy() });
      w.cameras.main.shake(140, 0.01);
      this.c.vibrate?.(60);
      this.end(e, s);
      if (p2) { s.chain = true; this.start(e, s, 'lances'); }
      return true;
    }
    if (s.atk === 'lances') {
      let hit = false;
      for (const l of s.lines) {
        const cx = Math.cos(l.ang), cy = Math.sin(l.ang);
        // picos a lo largo de la línea (arte pico_hielo)
        const key = w.textures.exists('v4/pico_hielo') ? 'v4/pico_hielo' : null;
        for (let d = TILE * 1.2; d < l.len; d += TILE * 0.9) {
          const ix = e.x + cx * d, iy = e.y + cy * d;
          const o = key ? w.add.image(ix, iy, key).setDisplaySize(TILE * 0.75, TILE).setDepth(12).setRotation(l.ang + Math.PI / 2) : w.add.triangle(ix, iy, 0, 14, 7, -14, 14, 14, 0xdff4ff).setDepth(12);
          w.tweens.add({ targets: o, alpha: 0, delay: 350, duration: 400, onComplete: () => o.destroy() });
        }
        // ¿el jugador está en la franja (antes de la pared)?
        const rx = px - e.x, ry = py - e.y;
        const along = rx * cx + ry * cy, across = Math.abs(-rx * cy + ry * cx);
        if (along > 0 && across <= M.lanceWidthTiles * TILE / 2 + pr * 0.5) {
          if (along <= l.len + pr * 0.3) hit = true; else this.stats.lanceBlocked++;
        }
      }
      if (hit) { this.stats.lanceHits++; this.c.damagePlayer(M.lanceDmg, 'Lanzas de hielo'); }
      this.end(e, s);
      return true;
    }
    if (s.atk === 'breath') {
      if (s.phase === 'warn') { s.phase = 'active'; s.t = M.breathSec; return true; }
      // charcos de hielo en el cono (6 s)
      const half = Phaser.Math.DegToRad(M.breathDeg / 2);
      for (let i = 0; i < M.puddles; i++) {
        for (let k = 0; k < 6; k++) {
          const a = s.breathAng + (Math.random() * 2 - 1) * half, d = (0.35 + Math.random() * 0.6) * M.breathTiles * TILE;
          const x = e.x + Math.cos(a) * d, y = e.y + Math.sin(a) * d;
          if (pointInWalls(this.c.walls, x, y, 8) || !lineClear(this.c.walls, e.x, e.y, x, y)) continue;
          const key = w.textures.exists('v4/placa_hielo') ? 'v4/placa_hielo' : 'aviso-ataque';
          const img = w.add.image(x, y, key).setDisplaySize(M.puddleTiles * TILE * 2, M.puddleTiles * TILE * 1.4).setDepth(0.8).setAlpha(0.9).setRotation(Math.random() * Math.PI);
          this.puddles.push({ x, y, t: M.puddleSec, img });
          break;
        }
      }
      this.end(e, s);
      return true;
    }
    // llamada: salen 4 Congelados y 2 Lobos alrededor de la arena
    for (const [type, n] of Object.entries(M.callSpawn) as [EnemyType, number][]) {
      for (let i = 0; i < n; i++) {
        for (let k = 0; k < 8; k++) {
          const a = Math.random() * Math.PI * 2, d = TILE * (4 + Math.random() * 3);
          const x = e.x + Math.cos(a) * d, y = e.y + Math.sin(a) * d;
          if (pointInWalls(this.c.walls, x, y, TILE * 0.6)) continue;
          const o = this.c.summon?.(type, x, y);
          if (o) { o.state = 'chase'; o.meter = 1; o.t = -1; o.lastSeen = { x: px, y: py }; this.stats.summoned++; }
          break;
        }
      }
    }
    this.end(e, s);
    return true;
  }

  private end(e: Enemy, s: BossState) {
    this.clear(s);
    s.atk = null; s.chain = false;
    e.rig.crouch = 0; e.rig.raise = 0;
    e.state = 'chase';
    e.cd = MATRIARCA.cooldownSec * (this.phase2(e) ? MATRIARCA.p2Cooldown : 1) + MATRIARCA.recoverSec;
  }

  private iciclesTick(s: BossState, dt: number, px: number, py: number) {
    const M = MATRIARCA, w = this.c.world;
    s.icicleT -= dt;
    if (s.icicleT > 0) return;
    s.icicleT = M.icicleEverySec;
    for (let i = 0; i < M.icicles; i++) {
      const a = Math.random() * Math.PI * 2, d = i === 0 ? 0 : Math.random() * M.icicleSpreadTiles * TILE;
      const x = px + Math.cos(a) * d, y = py + Math.sin(a) * d;
      if (!this.c.onScreen(x, y, 0)) continue;
      const key = w.textures.exists('v4/caramb_sombra') ? 'v4/caramb_sombra' : 'aviso-ataque';
      const r = M.icicleTiles * TILE;
      const img = w.add.image(x, y, key).setDisplaySize(r * 0.8, r * 0.8).setDepth(5).setAlpha(0.7);
      w.tweens.add({ targets: img, displayWidth: r * 2, displayHeight: r * 2, duration: M.icicleWarn * 1000 });
      this.icicles.push({ x, y, t: M.icicleWarn, img });
      this.stats.icicles++;
    }
  }

  /** Charcos (ralentizan) y carámbanos (caen tras su sombra); limpia los avisos de una Matriarca muerta. */
  updateGlobal(dt: number) {
    const M = MATRIARCA, px = this.c.px(), py = this.c.py(), pr = this.c.playerRadius;
    for (let i = this.puddles.length - 1; i >= 0; i--) {
      const p = this.puddles[i];
      p.t -= dt;
      if (p.t < 1) p.img.setAlpha(0.9 * Math.max(0, p.t));
      if (Math.hypot(px - p.x, py - p.y) <= M.puddleTiles * TILE) this.c.slowPlayer?.(M.puddleSlow, 0.2);
      if (p.t <= 0) { p.img.destroy(); this.puddles.splice(i, 1); }
    }
    for (let i = this.icicles.length - 1; i >= 0; i--) {
      const c = this.icicles[i];
      c.t -= dt;
      if (c.t > 0) continue;
      if (Math.hypot(px - c.x, py - c.y) <= M.icicleTiles * TILE + pr * 0.3) { this.stats.icicleHits++; this.c.damagePlayer(M.icicleDmg, 'Carámbano'); }
      const w = this.c.world;
      const fx = w.add.circle(c.x, c.y, M.icicleTiles * TILE, 0xdff4ff, 0.6).setDepth(20);
      w.tweens.add({ targets: fx, alpha: 0, duration: 220, onComplete: () => fx.destroy() });
      c.img.destroy(); this.icicles.splice(i, 1);
    }
  }

  /** Al morir: quita sus avisos en curso. */
  onDeath(e: Enemy) { const s = this.st.get(e); if (s) { this.clear(s); s.atk = null; } }
}
