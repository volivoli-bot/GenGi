import Phaser from 'phaser';
import { TILE, WORLD } from '../config/constants';
import { SNOW_RULES } from '../config/v42';
import { seeded } from '../game/loot';
import type { RaidScene } from './RaidScene';
import { pointInWalls } from './map';

interface Print { x: number; y: number; ang: number; t: number; enemy: boolean; img: Phaser.GameObjects.Image | null }
interface Plate { x: number; y: number; w: number; h: number; img: Phaser.GameObjects.Image | null }

/**
 * v4b (§4): reglas de la nieve.
 * - Huellas (tuyas y de los enemigos, 20 s); los enemigos que encuentran las tuyas las siguen.
 * - La nieve amortigua los pasos (×0,7); las placas de hielo crujen (5 casillas) y resbalan (inercia ×2).
 * - Ventisca: cada 3-4 min, 25 s con la vista de todos a 4 casillas (aviso 5 s antes).
 */
export class SnowRules {
  prints: Print[] = [];
  plates: Plate[] = [];
  private lastPrint: { x: number; y: number } | null = null;
  private enemyPrintT = 0;
  private checkT = 0;
  private creakCd = 0;
  private onPlate = -1;
  private side = 1;
  /** Ventisca: tiempo hasta la siguiente, y lo que le queda a la actual. */
  ventT: number;
  ventLeft = 0;
  warned = false;
  private overlay: Phaser.GameObjects.TileSprite | null = null;
  private rng: () => number;
  stats = { prints: 0, enemyPrints: 0, followed: 0, creaks: 0, ventiscas: 0, slipFrames: 0 };

  constructor(private s: RaidScene) {
    const R = SNOW_RULES;
    this.rng = seeded((s.snap.seed ^ R.ice.seedSalt) >>> 0);
    const [a, b] = R.ventisca.firstSec;
    this.ventT = a + this.rng() * (b - a);
    if (s.map.snow) this.placePlates();
  }

  private placePlates() {
    const R = SNOW_RULES.ice, m = this.s.map, L = m.snow!.lair;
    const w = R.wTiles * TILE, h = R.hTiles * TILE;
    // las placas son fijas por trazado (no cambian en cada incursión)
    let hs = this.s.mapDef.layoutSeed ^ R.seedSalt;
    for (const ch of m.snow!.region) hs = Math.imul(hs ^ ch.charCodeAt(0), 0x01000193);
    const rng = seeded(hs >>> 0);
    for (let i = 0; i < 4000 && this.plates.length < R.plates; i++) {
      const x = rng() * WORLD, y = rng() * WORLD;
      if (!this.s.snowy(x, y) || Math.hypot(x - L.cx, y - L.cy) < R.minFromLairTiles * TILE) continue;
      if (pointInWalls(this.s.walls, x, y, Math.max(w, h) * 0.6)) continue;
      if (this.plates.some(p => Math.hypot(p.x - x, p.y - y) < TILE * 5)) continue;
      const img = this.s.textures.exists('v4/placa_hielo') ? this.s.add.image(x, y, 'v4/placa_hielo').setDisplaySize(w, h).setDepth(0.6).setAlpha(0.9) : null;
      this.plates.push({ x, y, w, h, img });
    }
  }

  plateAt(x: number, y: number) {
    for (let i = 0; i < this.plates.length; i++) { const p = this.plates[i]; if (Math.abs(x - p.x) < p.w / 2 && Math.abs(y - p.y) < p.h / 2) return i; }
    return -1;
  }
  /** Multiplicador del ruido de pasos: nieve ×0,7 (en las placas, no: crujen aparte). */
  noiseMult(x: number, y: number) { return this.s.snowy(x, y) && this.plateAt(x, y) < 0 ? SNOW_RULES.muffle : 1; }
  /** Multiplicador de inercia (tiempos de acelerar/frenar). */
  inertiaMult(x: number, y: number) { return this.plateAt(x, y) >= 0 ? SNOW_RULES.ice.inertiaMult : 1; }
  /** Tope de vista (casillas) durante la Ventisca. */
  sightCap() { return this.ventLeft > 0 ? SNOW_RULES.ventisca.sightTiles : 99; }

  private addPrint(x: number, y: number, ang: number, enemy: boolean) {
    const P = SNOW_RULES.prints;
    const own = this.prints.filter(p => p.enemy === enemy);
    if (own.length >= (enemy ? P.enemyMax : P.max)) { const old = own[0]; old.img?.destroy(); this.prints.splice(this.prints.indexOf(old), 1); }
    this.side = -this.side;
    const ox = Math.cos(ang + Math.PI / 2) * 5 * this.side, oy = Math.sin(ang + Math.PI / 2) * 5 * this.side;
    const img = this.s.textures.exists('v4/huella') ? this.s.add.image(x + ox, y + oy, 'v4/huella').setDisplaySize(12, 18).setRotation(ang + Math.PI / 2).setDepth(0.7).setAlpha(P.alpha) : null;
    if (enemy) img?.setTint(0x9a6a6a);
    this.prints.push({ x, y, ang, t: P.lifeSec, enemy, img });
    if (enemy) this.stats.enemyPrints++; else this.stats.prints++;
  }

  update(dt: number) {
    const s = this.s, P = SNOW_RULES.prints;
    if (!s.map.snow) { this.updateVentisca(dt); return; }
    const px = s.player.x, py = s.player.y;
    // huellas: envejecen y se borran
    for (let i = this.prints.length - 1; i >= 0; i--) {
      const p = this.prints[i]; p.t -= dt;
      if (p.t <= 0) { p.img?.destroy(); this.prints.splice(i, 1); continue; }
      if (p.t < 3) p.img?.setAlpha(P.alpha * p.t / 3);
    }
    if (P.enabled) {
      if (s.snowy(px, py) && s.vel.length() > 12) {
        if (!this.lastPrint || Math.hypot(px - this.lastPrint.x, py - this.lastPrint.y) >= P.everyTiles * TILE) { this.lastPrint = { x: px, y: py }; this.addPrint(px, py, Math.atan2(s.vel.y, s.vel.x), false); }
      } else if (!s.snowy(px, py)) this.lastPrint = null;
      // huellas de los enemigos cercanos que se mueven por la nieve
      this.enemyPrintT -= dt;
      if (this.enemyPrintT <= 0) {
        this.enemyPrintT = P.enemyEverySec;
        for (const e of s.enemies.list) {
          const b = e.sprite.body as Phaser.Physics.Arcade.Body | null;
          if (!b || e.def.type === 'matriarca' || Math.hypot(b.velocity.x, b.velocity.y) < 20 || !s.snowy(e.x, e.y) || Math.hypot(e.x - px, e.y - py) > TILE * 14) continue;
          this.addPrint(e.x, e.y, Math.atan2(b.velocity.y, b.velocity.x), true);
        }
      }
      // los enemigos que no te han detectado siguen tus huellas
      this.checkT -= dt;
      if (this.checkT <= 0) { this.checkT = P.checkEverySec; this.follow(); }
    }
    // placas de hielo: crujen al pisarlas
    this.creakCd -= dt;
    const pi = this.plateAt(px, py);
    if (pi >= 0 && s.vel.length() > 12) this.stats.slipFrames++;
    if (pi >= 0 && pi !== this.onPlate && s.vel.length() > 12 && s.moveTier !== 'quieto' && this.creakCd <= 0) {
      this.creakCd = SNOW_RULES.ice.creakCdSec; this.stats.creaks++;
      s.noise(px, py, SNOW_RULES.ice.creakTiles);
      if (this.stats.creaks === 1) s.hud?.toast('El hielo cruje… (hace ruido y resbala)', 2);
      s.cameras.main.shake(80, 0.002);
    }
    this.onPlate = pi;
    this.updateVentisca(dt);
  }

  private follow() {
    const s = this.s, P = SNOW_RULES.prints;
    const mine = this.prints.filter(p => !p.enemy);
    if (!mine.length) return;
    for (const e of s.enemies.list) {
      if (e.def.type === 'matriarca' || (e.state !== 'idle' && e.state !== 'investigate') || !s.snowy(e.x, e.y)) continue;
      let k = -1;
      for (let i = mine.length - 1; i >= 0; i--) if (Math.hypot(mine[i].x - e.x, mine[i].y - e.y) < P.findTiles * TILE) { k = i; break; }
      if (k < 0) continue;
      const g = mine[Math.min(mine.length - 1, k + P.aheadPrints)];
      if (e.state === 'idle') this.stats.followed++;
      e.state = 'investigate'; e.goal = { x: g.x, y: g.y, until: s.snap.elapsed + P.followSec };
      (e as unknown as { tracking?: boolean }).tracking = true;
    }
  }

  private updateVentisca(dt: number) {
    const V = SNOW_RULES.ventisca, s = this.s;
    if (!V.enabled) return;
    if (this.ventLeft > 0) {
      this.ventLeft -= dt;
      if (this.ventLeft <= 0) {
        this.ventLeft = 0; const [a, b] = V.everySec; this.ventT = a + this.rng() * (b - a); this.warned = false;
        s.hud?.toast('La ventisca amaina', 2);
      }
    } else {
      this.ventT -= dt;
      if (!this.warned && this.ventT <= V.warnSec) { this.warned = true; s.hud?.toast('❄ Se acerca una ventisca (en 5 s no se verá a más de 4 casillas)', 3); }
      if (this.ventT <= 0) { this.ventLeft = V.durationSec; this.stats.ventiscas++; s.hud?.toast('❄ Ventisca', 2); }
    }
    const on = this.ventLeft > 0;
    if (s.vision) { this.baseR ??= s.vision.R; s.vision.R = on ? V.sightTiles * TILE : this.baseR; }
    if (on && !this.overlay && s.textures.exists('v4/fx_ventisca')) {
      const cam = s.cameras.main;
      this.overlay = s.add.tileSprite(0, 0, cam.width, cam.height, 'v4/fx_ventisca').setOrigin(0).setScrollFactor(0).setDepth(900).setAlpha(V.overlayAlpha);
    }
    if (this.overlay) {
      this.overlay.setVisible(on);
      if (on) { this.overlay.tilePositionX -= dt * 260; this.overlay.tilePositionY -= dt * 40; this.overlay.setAlpha(V.overlayAlpha * Math.min(1, this.ventLeft / 2, (V.durationSec - this.ventLeft) / 2 + 0.2)); }
    }
  }
  private baseR?: number;

  destroy() { for (const p of this.prints) p.img?.destroy(); for (const p of this.plates) p.img?.destroy(); this.overlay?.destroy(); this.prints = []; }
}
