import Phaser from 'phaser';
import { TILE } from '../config/constants';
import { FOG2 } from '../config/v4d';
import { Rect, WallIndex, segRect } from './map';
import { Vision } from './vision';

/**
 * v4d — Niebla v2 (diseno-v4 §7): UNA RenderTexture de niebla a 1/4 de resolución (filtrado lineal = bordes suaves).
 * Cada frame: se copia la máscara anterior (anclada al mundo), se oscurece entera con 1 − exp(−dt/τ) (la memoria se apaga
 * igual a 30 y a 60 fps) y se borra encima la visión actual: círculo de 2,5 casillas con borde degradado y el cono
 * (abanico de ~64 rayos con oclusión de muros) con degradado por vértice en los lados y al final. Sin trozos sueltos.
 * Las siluetas fantasma usan la misma curva de memoria (ghostFade) y las mismas poses recientes (lingering).
 */
let fogSeq = 0;

export class VisionV2 extends Vision {
  private rtA: Phaser.GameObjects.RenderTexture;
  private rtB: Phaser.GameObjects.RenderTexture;
  private shade: Phaser.GameObjects.Graphics;
  private vg: Phaser.GameObjects.Graphics;
  private prevView = { x: NaN, y: NaN, w: 0, h: 0 };
  private rays2: { ang: number; d: number }[] = [];
  private near2: Rect[] = [];
  /** Poses recientes (para fantasmas y QA): x, y, mirada, t. */
  private poses: { x: number; y: number; a: number; t: number }[] = [];
  private lastT = NaN;
  /** QA: frames dibujados, último dt usado y oscurecimiento aplicado. */
  fog2Stats = { frames: 0, lastDt: 0, lastShade: 0, w: 0, h: 0 };
  readonly tau = FOG2.trailSec / FOG2.trailK;

  constructor(sc: Phaser.Scene, walls: () => Rect[], index: () => WallIndex) {
    super(sc, walls, index, 0);
    this.nearR = FOG2.nearTiles * TILE;
    this.rtA = this.mk(8, 8); this.rtB = this.mk(8, 8); this.rtB.setVisible(false);
    this.shade = sc.make.graphics({}, false);
    this.vg = sc.make.graphics({}, false);
  }

  /** RenderTexture de máscara de W×H. Se crea ya con su tamaño: resize() no redimensiona el framebuffer en Phaser 3.90. */
  private mk(W: number, H: number) {
      const sc = this.sc;
      const rt = sc.add.renderTexture(0, 0, W, H).setOrigin(0).setDepth(14).setAlpha(FOG2.alpha);
      // clave propia: la máscara anterior se copia con drawFrame (sin el alfa de pantalla del objeto)
      rt.saveTexture(`fog2-${++fogSeq}`);
      rt.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
      return rt;
  }

  private drop(rt: Phaser.GameObjects.RenderTexture) { const k = rt.texture.key; rt.destroy(); if (k && this.sc.textures.exists(k)) this.sc.textures.remove(k); }

  /** Fracción de memoria que queda tras `age` s (misma curva que la máscara). */
  ghostFade(age: number) { return age >= FOG2.trailSec ? 0 : Math.exp(-age / this.tau); }

  override update(x: number, y: number, facing: number, wallsVersion: number, now = 0, dtIn?: number) {
    this.facing = facing; this.ox = x; this.oy = y;
    const cam = this.sc.cameras.main, v = cam.worldView;
    if (!this.enabled) { this.rtA.setVisible(false); this.poses.length = 0; this.lastT = now; return; }
    const dt = Math.max(0, Math.min(0.25, dtIn ?? (Number.isFinite(this.lastT) ? now - this.lastT : 0)));
    this.lastT = now;
    this.version++;
    // poses recientes (para fantasmas): como mucho una cada 30 ms
    const P = this.poses;
    while (P.length && now - P[0].t > FOG2.trailSec) P.shift();
    if (!P.length || now - P[P.length - 1].t >= 0.03) P.push({ x, y, a: facing, t: now }); // la pose actual ya la cubre visible()

    // tamaño de la textura: la vista de la cámara a 1/resDiv de los píxeles de pantalla
    const W = Math.max(8, Math.ceil(v.width * cam.zoom / FOG2.resDiv)), H = Math.max(8, Math.ceil(v.height * cam.zoom / FOG2.resDiv));
    if (this.rtA.width !== W || this.rtA.height !== H) {
      // cambio de tamaño de pantalla (raro): se rehacen las dos texturas y la memoria empieza en niebla
      this.drop(this.rtA); this.drop(this.rtB);
      this.rtA = this.mk(W, H); this.rtB = this.mk(W, H); this.rtB.setVisible(false); this.prevView.x = NaN;
    }
    const prev = this.rtA, next = this.rtB;
    const sx = W / v.width, sy = H / v.height; // mundo → píxel de la textura
    next.clear();
    const pv = this.prevView;
    if (Number.isFinite(pv.x) && prev.width === W && prev.height === H && Math.abs(pv.w - v.width) < 0.5) {
      // la memoria va anclada al mundo: se copia la máscara anterior desplazada lo que se movió la cámara
      const dx = (pv.x - v.x) * sx, dy = (pv.y - v.y) * sy;
      next.drawFrame(prev.texture.key, undefined, dx, dy, 1);
      // lo que entra por los bordes nace en niebla
      if (dx > 0) next.fill(0x05060a, 1, 0, 0, Math.ceil(dx) + 1, H);
      if (dx < 0) next.fill(0x05060a, 1, Math.floor(W + dx) - 1, 0, Math.ceil(-dx) + 2, H);
      if (dy > 0) next.fill(0x05060a, 1, 0, 0, W, Math.ceil(dy) + 1);
      if (dy < 0) next.fill(0x05060a, 1, 0, Math.floor(H + dy) - 1, W, Math.ceil(-dy) + 2);
      // oscurecer: visibilidad × exp(−dt/τ) → con el tiempo de cada frame (igual a 30 y a 60 fps)
      const k = 1 - Math.exp(-dt / this.tau);
      if (k > 0) { this.shade.clear().fillStyle(0x05060a, k).fillRect(0, 0, W, H); next.draw(this.shade, 0, 0); }
      this.fog2Stats.lastShade = k;
    } else next.fill(0x05060a, 1);
    pv.x = v.x; pv.y = v.y; pv.w = v.width; pv.h = v.height;

    // visión actual → se borra de la niebla con alfa degradado
    const g = this.vg.clear();
    const cx = (x - v.x) * sx, cy = (y - v.y) * sy;
    this.drawNear(g, cx, cy, sx);
    this.castRays(x, y, facing);
    this.drawCone(g, cx, cy, sx, facing);
    next.erase(g, 0, 0);

    next.setPosition(v.x, v.y).setDisplaySize(v.width, v.height).setVisible(true);
    prev.setVisible(false);
    this.rtA = next; this.rtB = prev;
    const f = this.fog2Stats; f.frames++; f.lastDt = dt; f.w = W; f.h = H;
    void wallsVersion;
  }

  /** Círculo siempre visible con borde degradado (abanico: centro opaco, anillo interior opaco, anillo exterior a 0). */
  private drawNear(g: Phaser.GameObjects.Graphics, cx: number, cy: number, s: number) {
    const R = this.nearR * s, Ri = Math.max(0, (this.nearR - FOG2.nearFeatherTiles * TILE)) * s, N = 28;
    g.fillStyle(0xffffff, 1).fillCircle(cx, cy, Ri);
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2;
      const ix0 = cx + Math.cos(a0) * Ri, iy0 = cy + Math.sin(a0) * Ri, ix1 = cx + Math.cos(a1) * Ri, iy1 = cy + Math.sin(a1) * Ri;
      const ox0 = cx + Math.cos(a0) * R, oy0 = cy + Math.sin(a0) * R, ox1 = cx + Math.cos(a1) * R, oy1 = cy + Math.sin(a1) * R;
      g.fillGradientStyle(0xffffff, 0xffffff, 0xffffff, 0xffffff, 1, 0, 1, 0);
      g.fillTriangle(ix0, iy0, ox0, oy0, ix1, iy1);
      g.fillGradientStyle(0xffffff, 0xffffff, 0xffffff, 0xffffff, 0, 0, 1, 1);
      g.fillTriangle(ox0, oy0, ox1, oy1, ix1, iy1);
    }
  }

  /** ~64 rayos de oclusión por el cono. */
  private castRays(x: number, y: number, facing: number) {
    const R = this.R, near = this.index().query(x - R, y - R, x + R, y + R, this.near2);
    const n = FOG2.rays, a0 = facing - this.half;
    const out = this.rays2; out.length = n + 1;
    for (let i = 0; i <= n; i++) {
      const ang = a0 + (this.half * 2 * i) / n;
      const ex = x + Math.cos(ang) * R, ey = y + Math.sin(ang) * R;
      let best = 1;
      const minX = Math.min(x, ex), maxX = Math.max(x, ex), minY = Math.min(y, ey), maxY = Math.max(y, ey);
      for (const r of near) {
        if (r.x > maxX || r.x + r.w < minX || r.y > maxY || r.y + r.h < minY) continue;
        const t = segRect(x, y, ex, ey, r);
        if (t !== null && t < best) best = t;
      }
      const d = Math.min(R, best * R + (best < 1 ? 14 : 0));
      out[i] = out[i] ?? { ang: 0, d: 0 };
      out[i].ang = ang; out[i].d = d;
    }
  }

  /** Cono: por cada par de rayos, un tramo opaco hasta d − borde y un tramo degradado hasta d; los lados se apagan en coneEdgeDeg. */
  private drawCone(g: Phaser.GameObjects.Graphics, cx: number, cy: number, s: number, facing: number) {
    const rs = this.rays2, F = FOG2.coneFeatherTiles * TILE, edge = Phaser.Math.DegToRad(FOG2.coneEdgeDeg);
    const side = (ang: number) => { const off = this.half - Math.abs(Phaser.Math.Angle.Wrap(ang - facing)); return Phaser.Math.Clamp(off / edge, 0, 1); };
    for (let i = 0; i < rs.length - 1; i++) {
      const A = rs[i], B = rs[i + 1];
      const ka = side(A.ang), kb = side(B.ang);
      const ia = Math.max(0, A.d - F) * s, ib = Math.max(0, B.d - F) * s, oa = A.d * s, ob = B.d * s;
      const cA = Math.cos(A.ang), sA = Math.sin(A.ang), cB = Math.cos(B.ang), sB = Math.sin(B.ang);
      const pia = [cx + cA * ia, cy + sA * ia], pib = [cx + cB * ib, cy + sB * ib], poa = [cx + cA * oa, cy + sA * oa], pob = [cx + cB * ob, cy + sB * ob];
      // centro → anillo interior (alfa por lado del cono)
      g.fillGradientStyle(0xffffff, 0xffffff, 0xffffff, 0xffffff, Math.max(ka, kb), ka, kb, kb);
      g.fillTriangle(cx, cy, pia[0], pia[1], pib[0], pib[1]);
      // anillo interior → final (degradado a 0)
      g.fillGradientStyle(0xffffff, 0xffffff, 0xffffff, 0xffffff, ka, 0, kb, 0);
      g.fillTriangle(pia[0], pia[1], poa[0], poa[1], pib[0], pib[1]);
      g.fillGradientStyle(0xffffff, 0xffffff, 0xffffff, 0xffffff, 0, 0, kb, 0);
      g.fillTriangle(poa[0], poa[1], pob[0], pob[1], pib[0], pib[1]);
    }
  }

  /** ¿Sigue este punto en la memoria? (alguna pose reciente lo veía y aún le queda ≥ 10 % de visibilidad). */
  override lingering(px: number, py: number) {
    const now = this.lastT;
    for (const p of this.poses) {
      if (this.ghostFade(now - p.t) < 0.1) continue;
      if (this.seesFrom(p.x, p.y, p.a, px, py)) return true;
    }
    return false;
  }
  /** Poses de la memoria que aún se ven (< trailSec) y que no son la vista actual (se ha movido o girado). */
  override lingerCount() {
    const now = this.lastT; let n = 0;
    for (const p of this.poses) {
      if (now - p.t >= FOG2.trailSec) continue;
      const da = Math.abs(Phaser.Math.Angle.Wrap(p.a - this.facing));
      if (Math.hypot(p.x - this.ox, p.y - this.oy) > 2 || da > 0.02) n++;
    }
    return n;
  }

  /** QA: la máscara actual como alfa de niebla (0 = se ve, 1 = niebla) en una cuadrícula de la textura. */
  readMask(): Promise<{ w: number; h: number; view: { x: number; y: number; w: number; h: number }; a: number[] }> {
    const rt = this.rtA, v = this.prevView;
    return new Promise(res => rt.snapshot((img) => {
      const im = img as HTMLImageElement;
      const c = document.createElement('canvas'); c.width = rt.width; c.height = rt.height;
      const cx = c.getContext('2d')!; cx.drawImage(im, 0, 0);
      const d = cx.getImageData(0, 0, c.width, c.height).data;
      const a: number[] = new Array(c.width * c.height);
      for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3] / 255;
      res({ w: c.width, h: c.height, view: { x: v.x, y: v.y, w: v.w, h: v.h }, a });
    }));
  }

  override setEnabled(v: boolean) { this.enabled = v; this.rtA.setVisible(v); if (!v) this.rtB.setVisible(false); this.prevView.x = NaN; }
  override fogInfo() { return { layers: 1, layerAlpha: FOG2.alpha, total: FOG2.alpha, v2: true }; }
  override destroy() {
    this.drop(this.rtA); this.drop(this.rtB);
    this.shade.destroy(); this.vg.destroy(); }
}
