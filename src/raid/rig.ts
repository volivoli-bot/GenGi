import Phaser from 'phaser';

/**
 * Muñeco por piezas (arte v2 de Basu, public/art/v2, ver animacion.json) que sigue a un cuerpo físico invisible.
 * Texturas: `${base}_${pieza}` (p. ej. errante_torso). Si falta alguna, se usa la imagen única de la v1 (`base`).
 * Todo el arte v2 mira hacia arriba (-y): el contenedor rota a (mirada + 90°).
 */
export type RigKind = 'humano' | 'hinchado' | 'abominacion' | 'simple';

const HUMAN_PARTS = ['sombra', 'pie', 'torso', 'brazo', 'cabeza'];
const P = (x: number, y: number) => ({ x: x - 32, y: y - 32 });
/** Hombros y pies en coordenadas de la caja 64×64 (centro = 0,0). */
const SHOULDER_L = P(16, 30), SHOULDER_R = P(48, 30), FOOT_L = P(24, 34), FOOT_R = P(40, 34), HEAD = P(32, 26);
/** El brazo es un rect de y18 a y38 con la mano en (32,18): pivote en el hombro (32,36), la mano queda 18 px delante. */
const ARM_LEN = 18;

export interface RigOpts { base: string; size: number; depth: number; weapon?: string | null; v1Size?: number }

export class Rig {
  c: Phaser.GameObjects.Container;
  kind: RigKind;
  parts: Phaser.GameObjects.Image[] = [];
  private sombra?: Phaser.GameObjects.Image;
  private pieL?: Phaser.GameObjects.Image; private pieR?: Phaser.GameObjects.Image;
  private torso?: Phaser.GameObjects.Image; private cabeza?: Phaser.GameObjects.Image;
  private brazoL?: Phaser.GameObjects.Image; private brazoR?: Phaser.GameObjects.Image;
  private arma?: Phaser.GameObjects.Image;
  private fogonazo?: Phaser.GameObjects.Image;
  private extras: Phaser.GameObjects.Image[] = [];
  private single?: Phaser.GameObjects.Image;
  private phase = Math.random() * 10;
  private walk = 0;
  /** Animaciones en curso (s restantes). */
  private swingT = -1;
  private recoilT = 0;
  private hitT = 0; private hitDx = 0; private hitDy = 0; private hitRot = 0;
  private flashFrames = 0;
  private tintCol: number | null = null;
  aiming = false;
  /** 0..1: arma bajada (cambio de arma en curso). */
  lower = 0;
  crouch = 0;
  raise = 0;
  /** Escala extra (Hinchado a punto de explotar). */
  pump = 1;
  dead = false;
  baseScale: number;
  facing = 0;

  constructor(private sc: Phaser.Scene, x: number, y: number, private o: RigOpts) {
    const tex = (k: string) => sc.textures.exists(k);
    const b = o.base;
    this.kind = b === 'hinchado' ? (tex('hinchado_cuerpo') && tex('hinchado_pustula') ? 'hinchado' : 'simple')
      : b === 'abominacion' ? (tex('abominacion_cuerpo') && tex('abominacion_tentaculo') ? 'abominacion' : 'simple')
        : HUMAN_PARTS.every(p => tex(`${b}_${p}`)) ? 'humano' : 'simple';
    this.c = sc.add.container(x, y).setDepth(o.depth);
    const img = (k: string, ox = 0.5, oy = 0.5, w = 64, h = 64) => { const i = sc.add.image(0, 0, k).setOrigin(ox, oy).setDisplaySize(w, h); this.c.add(i); this.parts.push(i); return i; };
    if (this.kind === 'humano') {
      this.baseScale = o.size / 46;
      this.sombra = img(`${b}_sombra`);
      this.pieL = img(`${b}_pie`); this.pieR = img(`${b}_pie`);
      // pies: en el arte el pie está centrado; se recoloca en (24,34)/(40,34)
      this.brazoL = img(`${b}_brazo`, 0.5, 36 / 64); this.brazoR = img(`${b}_brazo`, 0.5, 36 / 64);
      this.torso = img(`${b}_torso`);
      if (o.weapon !== undefined) { this.arma = img('arma_bate', 0.5, 56 / 64, 44, 44).setVisible(false); this.setWeapon(o.weapon); }
      // el arma va por debajo del torso para que la empuñadura quede "en la mano"
      if (this.arma) this.c.moveBelow(this.arma, this.torso);
      this.cabeza = img(`${b}_cabeza`);
      if (tex('fx_fogonazo')) { this.fogonazo = img('fx_fogonazo', 0.5, 0.5, 26, 26).setVisible(false); }
    } else if (this.kind === 'hinchado') {
      this.baseScale = o.size / 72;
      this.sombra = tex('jugador_sombra') ? img('jugador_sombra', 0.5, 0.5, 90, 90).setAlpha(0.8) : undefined;
      this.torso = img('hinchado_cuerpo', 0.5, 0.5, 96, 96);
      for (const [px, py] of [[-22, -14], [18, -20], [20, 16], [-14, 22]]) { const pu = img('hinchado_pustula', 0.5, 0.5, 22, 22); pu.setPosition(px, py); this.extras.push(pu); }
    } else if (this.kind === 'abominacion') {
      this.baseScale = o.size / 104;
      for (let k = 0; k < 4; k++) {
        const t = img('abominacion_tentaculo', 0.5, 92 / 96, 30, 90);
        const a = Math.PI / 4 + k * Math.PI / 2;
        t.setPosition(Math.sin(a) * 34, -Math.cos(a) * 34).setRotation(a);
        t.setData('a', a);
        this.extras.push(t);
      }
      this.torso = img('abominacion_cuerpo', 0.5, 0.5, 128, 128);
    } else {
      // reserva: imagen única de la v1 (mira hacia abajo → girada 180° dentro del contenedor)
      this.baseScale = 1;
      this.single = img(b, 0.5, 0.5, o.v1Size ?? o.size, o.v1Size ?? o.size).setRotation(Math.PI);
    }
    this.c.setScale(this.baseScale);
    this.layout(0);
  }

  setWeapon(id: string | null | undefined) {
    if (!this.arma) return;
    const k = id ? `arma_${id}` : '';
    if (id && this.sc.textures.exists(k)) this.arma.setTexture(k).setDisplaySize(44, 44).setVisible(true);
    else this.arma.setVisible(false);
  }

  /** Golpe cuerpo a cuerpo: preparación -70° (0,12 s), golpe +80° (0,08 s), vuelta (0,15 s). */
  swing() { this.swingT = 0; }
  private recoilPx = 4;
  /** Retroceso del arma (px); en iOS más fuerte como contrapartida visual de la vibración. */
  recoil(px = 4) { this.recoilPx = px; this.recoilT = 0.08; if (this.fogonazo) { this.fogonazo.setVisible(true); this.sc.time.delayedCall(34, () => this.fogonazo?.setVisible(false)); } }
  /** Recibir golpe: destello blanco 1 fotograma, desplazamiento 3-8 px según la fuerza, giro ±10°. */
  hit(ang: number, force01: number) {
    this.flashFrames = 2;
    const d = 3 + 5 * Phaser.Math.Clamp(force01, 0, 1);
    this.hitDx = Math.cos(ang) * d; this.hitDy = Math.sin(ang) * d; this.hitRot = (Math.random() < 0.5 ? -1 : 1) * Phaser.Math.DegToRad(10);
    this.hitT = 0.12;
  }
  setTint(c: number | null) { this.tintCol = c; this.applyTint(); }
  private applyTint() {
    for (const p of this.parts) {
      if (p === this.fogonazo) continue;
      if (this.flashFrames > 0) p.setTintFill(0xffffff);
      else if (this.tintCol !== null) p.setTint(this.tintCol);
      else p.clearTint();
    }
  }
  setVisible(v: boolean) { if (this.c.visible !== v) this.c.setVisible(v); }

  /** Animación por fotograma. speed01 = velocidad / velocidad máxima. */
  update(dt: number, x: number, y: number, facing: number, speed01: number, visible: boolean) {
    this.facing = facing;
    const hk = this.hitT > 0 ? this.hitT / 0.12 : 0;
    this.c.setPosition(x + this.hitDx * hk, y + this.hitDy * hk);
    this.c.rotation = facing + Math.PI / 2 + this.hitRot * hk;
    if (this.hitT > 0) this.hitT -= dt;
    if (this.flashFrames > 0) { this.flashFrames--; this.applyTint(); if (this.flashFrames === 0) this.applyTint(); }
    if (this.dead) return;
    this.setVisible(visible);
    if (!visible) return;
    this.phase += dt;
    if (speed01 > 0.05) this.walk += dt * 2.5 * Math.PI * 2 * Math.min(1.4, speed01); else this.walk *= 0.9;
    if (this.swingT >= 0) { this.swingT += dt; if (this.swingT > 0.35) this.swingT = -1; }
    if (this.recoilT > 0) this.recoilT -= dt;
    this.layout(speed01);
  }

  private layout(speed01: number) {
    const s = Math.sin(this.walk), moving = speed01 > 0.05;
    if (this.kind === 'humano') {
      const base = this.o.base;
      const limp = base === 'errante';
      const step = 6 * Math.min(1, speed01 * 1.3);
      this.pieL!.setPosition(FOOT_L.x, FOOT_L.y - (moving ? s * step * (limp ? 0.5 : 1) : 0) - 4);
      this.pieR!.setPosition(FOOT_R.x, FOOT_R.y + (moving ? s * step : 0) - 4);
      // los pies del arte están en la parte de abajo de su caja: se suben para quedar bajo el torso
      const breathe = moving ? 1 : 1 + 0.015 * (1 + Math.sin(this.phase * Math.PI * 2 / 1.6));
      const lean = base === 'corredor' ? -3 : 0;
      this.torso!.setScale((64 / this.torso!.width) * breathe, (64 / this.torso!.height) * breathe * (1 - this.crouch * 0.15)).setRotation(moving ? Phaser.Math.DegToRad(4) * s : 0).setY(lean);
      this.cabeza!.setPosition(HEAD.x, HEAD.y + lean * 1.4 + (moving ? Math.abs(s) * -1 : 0) + this.crouch * 3);
      this.sombra!.setPosition(0, 2);
      // brazos
      let rl = Phaser.Math.DegToRad(-15), rr = Phaser.Math.DegToRad(15);
      if (base === 'errante' || base === 'corredor') { rl = Phaser.Math.DegToRad(-4) + (moving ? 0.08 * s : 0); rr = Phaser.Math.DegToRad(4) - (moving ? 0.08 * s : 0); }
      else if (moving && !this.aiming) { rl += 0.18 * s; rr += 0.18 * s; }
      if (this.aiming) { rl = Phaser.Math.DegToRad(12); rr = Phaser.Math.DegToRad(-12); }
      if (this.lower > 0) rr += Phaser.Math.DegToRad(100) * this.lower;
      if (this.swingT >= 0) {
        const t = this.swingT;
        const d = t < 0.12 ? -70 * (t / 0.12) : t < 0.2 ? -70 + 150 * ((t - 0.12) / 0.08) : 80 * (1 - (t - 0.2) / 0.15);
        rr = Phaser.Math.DegToRad(15 + d);
      }
      if (this.dead) { rl = Phaser.Math.DegToRad(-60); rr = Phaser.Math.DegToRad(60); }
      const rec = this.recoilT > 0 ? this.recoilPx * (this.recoilT / 0.08) : 0;
      this.brazoL!.setPosition(SHOULDER_L.x, SHOULDER_L.y + 6).setRotation(rl);
      this.brazoR!.setPosition(SHOULDER_R.x, SHOULDER_R.y + 6 + rec).setRotation(rr);
      if (this.arma) {
        const hx = SHOULDER_R.x + Math.sin(rr) * ARM_LEN, hy = SHOULDER_R.y + 6 + rec - Math.cos(rr) * ARM_LEN;
        this.arma.setPosition(hx, hy + 6).setRotation(rr);
        if (this.fogonazo) this.fogonazo.setPosition(hx + Math.sin(rr) * 40, hy - Math.cos(rr) * 40);
      }
    } else if (this.kind === 'hinchado') {
      const k = 0.9 + 0.25 * (0.5 + 0.5 * Math.sin(this.phase * Math.PI * 2 / 0.8));
      this.extras.forEach((p, i) => p.setScale((22 / p.width) * (i % 2 ? 2.05 - k : k)));
      const wob = moving ? Math.sin(this.walk) * 0.05 : 0;
      this.torso!.setRotation(wob).setScale((96 / this.torso!.width) * (1 + 0.02 * Math.sin(this.phase * 3)));
    } else if (this.kind === 'abominacion') {
      this.extras.forEach((t, i) => {
        const a = t.getData('a') as number;
        const wave = Phaser.Math.DegToRad(12) * Math.sin(this.phase * 3 + i * 1.6);
        t.setRotation(a + wave * (1 - this.raise));
        t.setScale((30 / t.width) * (1 + this.raise * 0.25), (90 / t.height) * (1 + this.raise * 0.3));
      });
      this.torso!.setRotation(moving ? Math.sin(this.walk * 0.5) * 0.04 : 0);
    } else if (this.single) {
      const wob = moving ? Math.sin(this.walk) * 0.06 : 0;
      this.single.setRotation(Math.PI + wob);
    }
    this.c.setScale(this.baseScale * this.pump);
  }

  /** Muerte: cae (escala 0,9, gira 70°, brazos abiertos) y se queda como cadáver con alfa 0,85. */
  die(onDone?: () => void) {
    this.dead = true;
    this.setVisible(true);
    this.tintCol = null; this.flashFrames = 0; this.applyTint();
    this.pump = 1;
    if (this.kind === 'humano') this.layout(0);
    this.fogonazo?.setVisible(false);
    this.c.setDepth(3.6);
    this.sc.tweens.add({ targets: this.c, scale: this.baseScale * 0.9, rotation: this.c.rotation + Phaser.Math.DegToRad(70) * (Math.random() < 0.5 ? -1 : 1), alpha: 0.85, duration: 260, ease: 'Quad.easeOut', onComplete: () => onDone?.() });
  }

  destroy() { this.c.destroy(); }
}
