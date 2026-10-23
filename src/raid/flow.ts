import { MAP_TILES, TILE } from '../config/constants';
import type { Rect } from './map';

/**
 * Campo de flujo (BFS en rejilla de media casilla) hacia el jugador: los enemigos que no te ven
 * rodean paredes y entran por las puertas en vez de quedarse pegados al muro.
 */
export class FlowField {
  readonly cs = TILE / 2;
  readonly n = MAP_TILES * 2;
  blocked: Uint8Array;
  dist: Int32Array;
  private queue: Int32Array;
  private tx = -1; private ty = -1;
  constructor() {
    this.blocked = new Uint8Array(this.n * this.n);
    this.dist = new Int32Array(this.n * this.n).fill(-1);
    this.queue = new Int32Array(this.n * this.n);
  }
  setWalls(walls: Rect[]) {
    this.blocked.fill(0);
    const { cs, n } = this;
    for (const r of walls) {
      const x0 = Math.max(0, Math.floor((r.x + 2) / cs)), x1 = Math.min(n - 1, Math.floor((r.x + r.w - 2) / cs));
      const y0 = Math.max(0, Math.floor((r.y + 2) / cs)), y1 = Math.min(n - 1, Math.floor((r.y + r.h - 2) / cs));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.blocked[y * n + x] = 1;
    }
    this.tx = -1;
  }
  /** Recalcula desde la posición del jugador (barato: ~43 000 celdas). */
  compute(px: number, py: number, maxSteps = 140) {
    const { cs, n } = this;
    const sx = Math.min(n - 1, Math.max(0, Math.floor(px / cs))), sy = Math.min(n - 1, Math.max(0, Math.floor(py / cs)));
    if (sx === this.tx && sy === this.ty) return;
    this.tx = sx; this.ty = sy;
    const d = this.dist; d.fill(-1);
    const q = this.queue; let h = 0, t = 0;
    const s = sy * n + sx; d[s] = 0; q[t++] = s;
    while (h < t) {
      const c = q[h++]; const cd = d[c];
      if (cd >= maxSteps) continue;
      const x = c % n, y = (c / n) | 0;
      if (x > 0) { const k = c - 1; if (d[k] < 0 && !this.blocked[k]) { d[k] = cd + 1; q[t++] = k; } }
      if (x < n - 1) { const k = c + 1; if (d[k] < 0 && !this.blocked[k]) { d[k] = cd + 1; q[t++] = k; } }
      if (y > 0) { const k = c - n; if (d[k] < 0 && !this.blocked[k]) { d[k] = cd + 1; q[t++] = k; } }
      if (y < n - 1) { const k = c + n; if (d[k] < 0 && !this.blocked[k]) { d[k] = cd + 1; q[t++] = k; } }
    }
  }
  /** Dirección (unitaria) a seguir desde (x,y), o null si no hay camino conocido. */
  dir(x: number, y: number): { x: number; y: number } | null {
    const { cs, n } = this;
    const cx = Math.floor(x / cs), cy = Math.floor(y / cs);
    if (cx < 0 || cy < 0 || cx >= n || cy >= n) return null;
    let best = -1, bd = 1e9;
    const here = this.dist[cy * n + cx];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
      const k = ny * n + nx, v = this.dist[k];
      if (v < 0) continue;
      // diagonal solo si no corta una esquina
      if (dx && dy && (this.blocked[cy * n + nx] || this.blocked[ny * n + cx])) continue;
      const score = v + (dx && dy ? 0.4 : 0);
      if (score < bd) { bd = score; best = k; }
    }
    if (best < 0 || (here >= 0 && bd >= here + 0.5)) return null;
    const tx = (best % n + 0.5) * cs, ty = (((best / n) | 0) + 0.5) * cs;
    const l = Math.hypot(tx - x, ty - y) || 1;
    return { x: (tx - x) / l, y: (ty - y) / l };
  }
}
