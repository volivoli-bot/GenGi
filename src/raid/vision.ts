import Phaser from 'phaser';
import { TILE } from '../config/constants';
import { VISION } from '../config/v2';
import { LINGER } from '../config/v31';
import { PERF } from '../config/v32';
import { lineClear, Rect, WallIndex, segRect } from './map';

/**
 * Cono de visión (220°) con oclusión por paredes (polígono de visibilidad por rayos).
 * Detrás y tras las paredes: niebla oscura (el suelo se ve, enemigos y botín no).
 * Siempre se ve un radio pequeño alrededor del jugador ("conciencia corporal", VISION.nearTiles).
 */
export class Vision {
  poly: Phaser.Math.Vector2[] = [];
  /** Niebla en capas (diseno-v3 §8.5): oscurece al 45 % con un borde difuminado de 1,5 casillas. */
  private fogs: Phaser.GameObjects.Rectangle[] = [];
  private masks: Phaser.GameObjects.Graphics[] = [];
  private polys: Phaser.Math.Vector2[][] = [];
  private rays: { ang: number; d: number; back: boolean }[] = [];
  private last = { x: NaN, y: NaN, a: NaN, v: -1 };
  /** v3.1 §9.3: «fotos» recientes del polígono (por capa) que siguen visibles LINGER.sec y se apagan por capas. */
  private hist: { t: number; layers: Float32Array[] }[] = [];
  private lastSample = -1e9;
  /** v3.2: arrays de fotos caducadas para reutilizar, último recálculo (ms reales) y clave de la última máscara dibujada. */
  private spare: Float32Array[][] = [];
  private lastCalcMs = -1e9;
  private lastMaskKey = NaN;
  private samplePose = { x: NaN, y: NaN, a: NaN, v: -1 };
  private bins = new Float32Array(0);
  private wallNow() { return this.sc.time.now; }
  /** QA: redibujos por memoria y fotos vivas. */
  lingerStats = { redraws: 0, samples: 0, polys: 0 };
  private near: Rect[] = [];
  version = 0;
  enabled = true;
  facing = 0;
  ox = 0; oy = 0;
  /** v4b: la Ventisca lo baja a 4 casillas. */
  R = VISION.rangeTiles * TILE;
  readonly nearR = VISION.nearTiles * TILE;
  readonly half = Phaser.Math.DegToRad(VISION.coneDeg / 2);

  constructor(private sc: Phaser.Scene, private walls: () => Rect[], private index: () => WallIndex) {
    // n capas iguales cuya suma da fogAlpha: 1-(1-a)^n = fogAlpha
    const n = Math.max(1, VISION.fogLayers);
    const a = 1 - Math.pow(1 - VISION.fogAlpha, 1 / n);
    for (let i = 0; i < n; i++) {
      const g = sc.make.graphics({}, false);
      const f = sc.add.rectangle(0, 0, 10, 10, 0x05060a, a).setOrigin(0).setDepth(14);
      const m = g.createGeometryMask();
      m.setInvertAlpha(true);
      f.setMask(m);
      this.masks.push(g); this.fogs.push(f); this.polys.push([]);
    }
  }

  /** Recalcula el polígono si el jugador se movió o giró (o cambiaron las paredes: puertas). */
  update(x: number, y: number, facing: number, wallsVersion: number, now = 0) {
    this.facing = facing; this.ox = x; this.oy = y;
    const v = this.sc.cameras.main.worldView;
    for (const f of this.fogs) f.setPosition(v.x - 40, v.y - 40).setSize(v.width + 80, v.height + 80).setVisible(this.enabled);
    if (!this.enabled) { this.hist.length = 0; return; }
    const L = this.last;
    const had = this.hist.length > 0;
    while (this.hist.length && now - this.hist[0].t >= LINGER.sec) { const h = this.hist.shift()!; if (this.spare.length < 4) this.spare.push(h.layers); }
    const dA = Math.abs(Phaser.Math.Angle.Wrap(L.a - facing)), dP = Math.max(Math.abs(L.x - x), Math.abs(L.y - y));
    const still = dP < 2 && dA < 0.012 && L.v === wallsVersion;
    // v3.2: recálculo con tope (≈30 Hz) salvo saltos grandes o cambio de paredes
    const throttled = !still && L.v === wallsVersion && dP < PERF.fogForcePx && dA < PERF.fogForceRad && this.wallNow() - this.lastCalcMs < PERF.fogMinRedrawMs;
    if (still || throttled) {
      // quieto: solo se redibuja cuando una foto de la memoria deja de contar en alguna capa
      if (had && this.maskKey(now) !== this.lastMaskKey) { this.drawMasks(now); this.lingerStats.redraws++; }
      return;
    }
    this.lastCalcMs = this.wallNow();
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
      const rr = this.rays[n - 1] ?? (this.rays[n - 1] = { ang: 0, d: 0, back: false });
      rr.ang = ang; rr.d = d; rr.back = len < R;
    };
    const steps = Math.ceil(VISION.coneDeg * VISION.raysPerDeg);
    const a0 = facing - this.half;
    for (let i = 0; i <= steps; i++) ray(a0 + (this.half * 2 * i) / steps, R);
    // por detrás: solo el radio cercano
    const back = Math.PI * 2 - this.half * 2, bs = 16;
    for (let i = 1; i < bs; i++) ray(facing + this.half + (back * i) / bs, this.nearR);
    pts.length = n; this.rays.length = n;
    // capa 0 = polígono exacto; las interiores se encogen (distancia y bordes del cono) para el degradado
    const NL = this.masks.length, step = (VISION.fogFeatherTiles * TILE) / NL;
    for (let k = 0; k < NL; k++) {
      const poly = this.polys[k]; poly.length = n;
      const shrink = step * k, edge = this.half - (shrink / (R * 0.35));
      for (let i = 0; i < n; i++) {
        const r = this.rays[i];
        const off = Math.abs(Phaser.Math.Angle.Wrap(r.ang - facing));
        let d = r.back ? Math.max(this.nearR * 0.5, r.d - shrink * 0.4) : Math.max(this.nearR * 0.5, r.d - shrink);
        if (!r.back && off > edge) d = Math.min(d, Math.max(this.nearR * 0.5, this.nearR - shrink * 0.4));
        if (!poly[i]) poly[i] = new Phaser.Math.Vector2();
        poly[i].set(x + Math.cos(r.ang) * d, y + Math.sin(r.ang) * d);
      }
    }
    this.drawMasks(now);
    // foto para la memoria (si no se repite demasiado seguido)
    // v3.2: no se guarda foto si la mirada apenas cambió desde la anterior (la anterior ya cubre esa zona)
    const sp = this.samplePose;
    const moved = Math.abs(sp.x - x) > PERF.lingerMinPx || Math.abs(sp.y - y) > PERF.lingerMinPx || Math.abs(Phaser.Math.Angle.Wrap(sp.a - facing)) > PERF.lingerMinRad || sp.v !== wallsVersion;
    if (LINGER.sec > 0 && now - this.lastSample >= LINGER.sampleSec && moved) {
      this.lastSample = now; this.lingerStats.samples++; sp.x = x; sp.y = y; sp.a = facing; sp.v = wallsVersion;
      // v3.2: foto simplificada (1 de cada PERF.lingerDecimate puntos) y arrays reciclados de las fotos caducadas
      const st = Math.max(1, PERF.lingerDecimate);
      const spare = this.spare.pop();
      const layers = this.polys.map((pl, k) => {
        const m = Math.ceil(pl.length / st);
        let a = spare?.[k];
        if (!a || a.length !== m * 2) a = new Float32Array(m * 2);
        for (let i = 0, j = 0; i < pl.length; i += st, j++) { a[j * 2] = pl[i].x; a[j * 2 + 1] = pl[i].y; }
        return a;
      });
      this.hist.push({ t: now, layers });
    }
  }

  /** Máscaras = polígono actual ∪ fotos recientes. La capa k guarda una foto mientras edad < sec·(NL-k)/NL: se apaga por pasos. */
  /** Qué fotos cuentan en cada capa ahora (si no cambia, la máscara es la misma y no hace falta redibujar). */
  private maskKey(now: number) {
    const NL = this.masks.length; let key = this.hist.length ? this.hist[0].t * 1000 : 0;
    for (let k = 0; k < NL; k++) { const keep = LINGER.sec * (NL - k) / NL; let c = 0; for (const h of this.hist) if (now - h.t < keep) c++; key = key * 31 + c; }
    return key;
  }
  private drawMasks(now: number) {
    this.lastMaskKey = this.maskKey(now);
    const NL = this.masks.length;
    for (let k = 0; k < NL; k++) {
      const g = this.masks[k].clear().fillStyle(0xffffff, 1);
      g.fillPoints(this.polys[k], true, true); this.lingerStats.polys++;
      const keep = LINGER.sec * (NL - k) / NL;
      // v3.2: las fotos vivas de esta capa se funden en UN polígono (unión radial desde el jugador: por cada sector
      // angular, la distancia máxima). Antes: un polígono por foto (hasta 10 por capa, cada uno rellenando el stencil).
      let alive = 0, only: Float32Array | null = null;
      for (const h of this.hist) { if (now - h.t >= keep) continue; const a = h.layers[k]; if (!a || a.length < 6) continue; alive++; only = a; }
      if (alive === 0) continue;
      if (alive === 1 && only) {
        g.beginPath(); g.moveTo(only[0], only[1]);
        for (let i = 2; i < only.length; i += 2) g.lineTo(only[i], only[i + 1]);
        g.closePath(); g.fillPath(); this.lingerStats.polys++;
        continue;
      }
      const B = PERF.lingerBins, bins = this.bins.length === B ? this.bins : (this.bins = new Float32Array(B));
      bins.fill(0);
      const ox = this.ox, oy = this.oy, TWO_PI = Math.PI * 2;
      for (const h of this.hist) {
        if (now - h.t >= keep) continue;
        const a = h.layers[k];
        if (!a || a.length < 6) continue;
        for (let i = 0; i < a.length; i += 2) {
          const dx = a[i] - ox, dy = a[i + 1] - oy, d = Math.sqrt(dx * dx + dy * dy);
          let bi = Math.floor(((Math.atan2(dy, dx) + Math.PI) / TWO_PI) * B); if (bi >= B) bi = 0;
          if (d > bins[bi]) bins[bi] = d;
        }
      }
      const floor = this.nearR * 0.5;
      g.beginPath();
      for (let i = 0; i < B; i++) {
        const ang = -Math.PI + ((i + 0.5) / B) * TWO_PI, d = Math.max(bins[i], floor);
        const x = ox + Math.cos(ang) * d, y = oy + Math.sin(ang) * d;
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.closePath(); g.fillPath(); this.lingerStats.polys++;
    }
  }

  /** ¿Sigue este punto en la memoria de visión (fuera del cono actual pero visto hace < LINGER.sec)? */
  lingering(px: number, py: number) {
    for (const h of this.hist) { const a = h.layers[0]; if (a && pointInPoly(a, px, py)) return true; }
    return false;
  }
  lingerCount() { return this.hist.length; }

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

  setEnabled(v: boolean) { this.enabled = v; this.last.v = -1; for (const f of this.fogs) f.setVisible(v); }
  /** QA: opacidad total de la niebla y número de capas. */
  fogInfo() { const a = this.fogs[0]?.fillAlpha ?? 0; return { layers: this.fogs.length, layerAlpha: a, total: 1 - Math.pow(1 - a, this.fogs.length) }; }
  destroy() { for (const f of this.fogs) f.destroy(); for (const g of this.masks) g.destroy(); }
}

function pointInPoly(a: Float32Array, x: number, y: number) {
  let inside = false;
  const n = a.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = a[i * 2], yi = a[i * 2 + 1], xj = a[j * 2], yj = a[j * 2 + 1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
