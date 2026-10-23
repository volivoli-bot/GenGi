import Phaser from 'phaser';
import { TILE } from '../config/constants';
import { PROJECTILE } from '../config/v2';
import { BOWS } from '../config/v31';
import { SHOTGUN } from '../config/v4d';
import type { Enemy } from './enemies';
import { rayHit, Rect } from './map';

export type ProjKind = 'flecha' | 'virote' | 'bala' | 'perdigon';
/** Flecha y virote: proyectiles físicos que caen al suelo y se recuperan. */
export const isPhysical = (k: ProjKind) => k === 'flecha' || k === 'virote';
export interface Proj {
  kind: ProjKind; x: number; y: number; vx: number; vy: number; ang: number;
  /** Punto de salida (v4d: caída de daño de los perdigones). */
  ox: number; oy: number;
  travelled: number; max: number; dmg: number; crit: boolean; weapon: string;
  /** Daño base del arma (sin tirada): para la puñalada a distancia. */
  base: number;
  /** Disparado a propósito con el joystick derecho (sigilo: x2,5 a un desprevenido). */
  aimed: boolean;
  /** «Clavar»: enemigos que aún puede atravesar, y los ya atravesados. */
  pierce: number; pierced: Set<Enemy> | null;
  img: Phaser.GameObjects.Image | null; trail: Phaser.GameObjects.Graphics | null; dead: boolean;
}

export interface ProjHooks {
  walls(): Rect[];
  enemies(): Enemy[];
  onHit(p: Proj, e: Enemy): void;
  /** Flecha que termina en el suelo (fin de alcance o contra una pared): recuperable. */
  onLand(p: Proj, x: number, y: number): void;
  onWall(p: Proj, x: number, y: number): void;
}

/**
 * Proyectiles reales (v2; v3.1 §9.1: flecha 7 casillas/s, virote 10). Flecha/virote: visible, cae un poco al final del alcance y se puede recuperar.
 * Bala: 40 casillas/s con trazadora brillante. Las paredes los paran.
 */
export class Projectiles {
  list: Proj[] = [];
  /** QA: velocidades medidas (px/s) de los últimos disparos. */
  fired: { kind: ProjKind; speed: number }[] = [];
  constructor(private sc: Phaser.Scene, private h: ProjHooks) {}

  fire(kind: ProjKind, x: number, y: number, ang: number, rangePx: number, dmg: number, crit: boolean, weapon: string, aimed = false) {
    const sp = (kind === 'flecha' ? BOWS.arrowTilesPerSec : kind === 'virote' ? BOWS.boltTilesPerSec : kind === 'perdigon' ? SHOTGUN.pelletTilesPerSec : PROJECTILE.bulletTilesPerSec) * TILE;
    const p: Proj = { kind, x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, ang, ox: x, oy: y, travelled: 0, max: rangePx, dmg, crit, weapon, base: dmg, aimed, pierce: 0, pierced: null, img: null, trail: null, dead: false };
    const key = kind === 'flecha' ? 'proyectil_flecha' : kind === 'virote' ? 'proyectil_virote' : 'proyectil_bala';
    if (this.sc.textures.exists(key)) {
      p.img = this.sc.add.image(x, y, key).setRotation(ang + Math.PI / 2).setDepth(12.5);
      if (kind === 'flecha') p.img.setDisplaySize(9, 36); else if (kind === 'virote') p.img.setDisplaySize(10, 30); else if (kind === 'perdigon') p.img.setDisplaySize(4, 14).setBlendMode(Phaser.BlendModes.ADD); else p.img.setDisplaySize(6, 30).setBlendMode(Phaser.BlendModes.ADD);
    } else if (kind === 'flecha') p.img = this.sc.add.image(x, y, 'flecha').setDisplaySize(TILE * 0.8, TILE * 0.8).setRotation(ang + Math.PI / 4).setDepth(12.5);
    if (kind === 'bala') p.trail = this.sc.add.graphics().setDepth(12.4).setBlendMode(Phaser.BlendModes.ADD);
    this.list.push(p);
    this.fired.push({ kind, speed: sp }); if (this.fired.length > 20) this.fired.shift();
    return p;
  }

  update(dt: number) {
    for (const p of this.list) {
      if (p.dead) continue;
      let step = Math.hypot(p.vx, p.vy) * dt;
      // la flecha "cae" en el último 20 % del alcance: frena y se encoge un poco (se va al suelo)
      const left = p.max - p.travelled;
      if (step > left) step = Math.max(0, left);
      const ux = Math.cos(p.ang), uy = Math.sin(p.ang);
      const x2 = p.x + ux * step, y2 = p.y + uy * step;
      // primer enemigo cruzado
      let best: Enemy | null = null, bt = 1;
      const mx = (p.x + x2) / 2, my = (p.y + y2) / 2;
      for (const e of this.h.enemies()) {
        if (!e.targetable || p.pierced?.has(e)) continue;
        const r = e.def.size * 0.38;
        if (Math.abs(e.x - mx) > step / 2 + r || Math.abs(e.y - my) > step / 2 + r) continue;
        const t = segCircle(p.x, p.y, x2, y2, e.x, e.y, r);
        if (t !== null && t < bt) { bt = t; best = e; }
      }
      const wt = rayHit(this.h.walls(), p.x, p.y, x2, y2);
      if (wt < 1 && (!best || wt < bt)) {
        const hx = p.x + (x2 - p.x) * wt - ux * 4, hy = p.y + (y2 - p.y) * wt - uy * 4;
        this.h.onWall(p, hx, hy);
        if (isPhysical(p.kind)) this.h.onLand(p, hx, hy);
        this.kill(p); continue;
      }
      if (best) {
        const ox = p.x, oy = p.y;
        p.x += (x2 - p.x) * bt; p.y += (y2 - p.y) * bt;
        if (p.pierce > 0) {
          // «Clavar»: atraviesa y sigue volando
          p.pierce--; (p.pierced ??= new Set()).add(best);
          this.h.onHit(p, best);
          p.travelled += Math.hypot(p.x - ox, p.y - oy);
          p.img?.setPosition(p.x, p.y);
          continue;
        }
        this.h.onHit(p, best);
        this.kill(p); continue;
      }
      p.x = x2; p.y = y2; p.travelled += step;
      if (p.img) {
        p.img.setPosition(p.x, p.y);
        if (isPhysical(p.kind)) {
          const k = Phaser.Math.Clamp((p.travelled / p.max - 0.8) / 0.2, 0, 1);
          p.img.setScale(p.img.scaleX * (1 - 0.04 * k * dt * 60), p.img.scaleY * (1 - 0.04 * k * dt * 60));
          p.img.y += k * 6;
        }
      }
      if (p.trail) {
        const L = Math.min(p.travelled, 70);
        p.trail.clear().lineStyle(4, 0xffb347, 0.35).lineBetween(p.x - ux * L, p.y - uy * L, p.x, p.y).lineStyle(2, 0xfff2a8, 0.95).lineBetween(p.x - ux * L * 0.6, p.y - uy * L * 0.6, p.x, p.y);
      }
      if (p.travelled >= p.max - 0.5) {
        if (isPhysical(p.kind)) this.h.onLand(p, p.x, p.y + 6);
        this.kill(p);
      }
    }
    if (this.list.length > 40 || this.list.some(p => p.dead)) this.list = this.list.filter(p => !p.dead);
  }

  private kill(p: Proj) {
    p.dead = true;
    p.img?.destroy(); p.img = null;
    if (p.trail) { const g = p.trail; p.trail = null; this.sc.tweens.add({ targets: g, alpha: 0, duration: 60, onComplete: () => g.destroy() }); }
  }

  clear() { for (const p of this.list) this.kill(p); this.list = []; }
}

/** t (0..1) del primer punto del segmento dentro del círculo, o null. */
export function segCircle(x1: number, y1: number, x2: number, y2: number, cx: number, cy: number, r: number): number | null {
  const dx = x2 - x1, dy = y2 - y1;
  const fx = x1 - cx, fy = y1 - cy;
  const a = dx * dx + dy * dy, b = 2 * (fx * dx + fy * dy), c = fx * fx + fy * fy - r * r;
  if (c <= 0) return 0;
  if (a < 1e-9) return null;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t >= 0 && t <= 1 ? t : null;
}
