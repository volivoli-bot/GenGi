import Phaser from 'phaser';
import { TILE } from '../config/constants';
import { VISION } from '../config/v2';
import { lineClear, Rect, WallIndex, segRect } from './map';

/**
 * Cono de visión (220°) con oclusión por paredes (polígono de visibilidad por rayos).
 * Detrás y tras las paredes: niebla oscura (el suelo se ve, enemigos y botín no).
 * Siempre se ve un radio pequeño alrededor del jugador ("conciencia corporal", VISION.nearTiles).
 */
export class Vision {
  poly: Phaser.Math.Vector2[] = [];
  private fog: Phaser.GameObjects.Rectangle;
  private maskG: Phaser.GameObjects.Graphics;
  private last = { x: NaN, y: NaN, a: NaN, v: -1 };
  private near: Rect[] = [];
  version = 0;
  enabled = true;
  facing = 0;
  ox = 0; oy = 0;
  readonly R = VISION.rangeTiles * TILE;
  readonly nearR = VISION.nearTiles * TILE;
  readonly half = Phaser.Math.DegToRad(VISION.coneDeg / 2);

  constructor(private sc: Phaser.Scene, private walls: () => Rect[], private index: () => WallIndex) {
    this.maskG = sc.make.graphics({}, false);
    this.fog = sc.add.rectangle(0, 0, 10, 10, 0x05060a, VISION.fogAlpha).setOrigin(0).setDepth(14);
    const m = this.maskG.createGeometryMask();
    m.setInvertAlpha(true);
    this.fog.setMask(m);
  }

  /** Recalcula el polígono si el jugador se movió o giró (o cambiaron las paredes: puertas). */
  update(x: number, y: number, facing: number, wallsVersion: number) {
    this.facing = facing; this.ox = x; this.oy = y;
    const v = this.sc.cameras.main.worldView;
    this.fog.setPosition(v.x - 40, v.y - 40).setSize(v.width + 80, v.height + 80).setVisible(this.enabled);
    if (!this.enabled) return;
    const L = this.last;
    if (Math.abs(L.x - x) < 2 && Math.abs(L.y - y) < 2 && Math.abs(Phaser.Math.Angle.Wrap(L.a - facing)) < 0.012 && L.v === wallsVersion) return;
    L.x = x; L.y = y; L.a = facing; L.v = wallsVersion;
    this.version++;
    const R = this.R;
    const near = this.index().query(x - R, y - R, x + R, y + R, this.near);
    const pts = this.poly; let n = 0;
    const ray = (ang: number, len: number) => {
      const ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len;
      let best = 1;
      const minX = Math.min(x, ex), maxX = Math.max(x, ex), minY = Math.min(y, ey), maxY = Math.max(y, ey);
      for (const r of near) {
        if (r.x > maxX || r.x + r.w < minX || r.y > maxY || r.y + r.h < minY) continue;
        const t = segRect(x, y, ex, ey, r);
        if (t !== null && t < best) best = t;
      }
      // un poco más allá del impacto: la cara visible de la pared queda iluminada
      const d = Math.min(len, best * len + (best < 1 ? 14 : 0));
      if (!pts[n]) pts[n] = new Phaser.Math.Vector2();
      pts[n++].set(x + Math.cos(ang) * d, y + Math.sin(ang) * d);
    };
    const steps = Math.ceil(VISION.coneDeg * VISION.raysPerDeg);
    const a0 = facing - this.half;
    for (let i = 0; i <= steps; i++) ray(a0 + (this.half * 2 * i) / steps, R);
    // por detrás: solo el radio cercano
    const back = Math.PI * 2 - this.half * 2, bs = 16;
    for (let i = 1; i < bs; i++) ray(facing + this.half + (back * i) / bs, this.nearR);
    pts.length = n;
    this.maskG.clear().fillStyle(0xffffff, 1).fillPoints(pts, true, true);
  }

  /** ¿El jugador ve este punto? (mismo criterio que el polígono: cono + línea de visión, o radio cercano). */
  sees(px: number, py: number, pad = 0) {
    if (!this.enabled) return true;
    const dx = px - this.ox, dy = py - this.oy, d = Math.hypot(dx, dy);
    if (d <= this.nearR + pad) return lineClear(this.walls(), this.ox, this.oy, px, py);
    if (d > this.R + pad) return false;
    const off = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(dy, dx) - this.facing));
    // el borde del cuerpo cuenta: un enemigo medio dentro del cono se ve
    const slack = d > 1 ? Math.asin(Math.min(1, pad / d)) : 0;
    if (off > this.half + slack) return false;
    return lineClear(this.walls(), this.ox, this.oy, px, py);
  }

  /** ¿Está detrás (fuera del cono)? */
  behind(px: number, py: number) {
    return Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(py - this.oy, px - this.ox) - this.facing)) > this.half;
  }

  setEnabled(v: boolean) { this.enabled = v; this.last.v = -1; this.fog.setVisible(v); }
  destroy() { this.fog.destroy(); this.maskG.destroy(); }
}
