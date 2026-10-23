import Phaser from 'phaser';
import { AIM, HUD2 } from '../config/v2';

/**
 * Joystick derecho de apuntar (twin-stick). Reposa abajo a la derecha (radio 70 px).
 * Solo nace de toques en la mitad derecha que NO caen sobre botones/HUD (predicado `blocked`).
 * Si el toque cae dentro de la base en reposo, el centro es la base; si cae en otro sitio de la mitad derecha, la base
 * se mueve bajo el dedo (flotante) y vuelve a su sitio al soltar.
 */
export class AimStick {
  /** Vector -1..1 (longitud = fracción del radio). */
  vec = new Phaser.Math.Vector2();
  active = false;
  pointerId: number | null = null;
  rest = { x: 0, y: 0 };
  readonly radius = AIM.stickRadius;
  private base: Phaser.GameObjects.Arc;
  private ring: Phaser.GameObjects.Arc;
  private knob: Phaser.GameObjects.Arc;
  private downAt = 0;
  private maxLen = 0;
  /** Toque rápido sin arrastrar (mirar atrás). Se consume al leerlo. */
  tapped = false;
  /** Pulso visual al disparar (iOS: sin vibración). */
  private pulseT = 0;
  private ox = 0; private oy = 0;

  constructor(private scene: Phaser.Scene, private blocked: (x: number, y: number, p?: Phaser.Input.Pointer) => boolean) {
    const D = 1000;
    this.base = scene.add.circle(0, 0, this.radius, 0xffffff, 0.06).setStrokeStyle(3, 0xffffff, 0.28).setScrollFactor(0).setDepth(D);
    this.ring = scene.add.circle(0, 0, this.radius * AIM.fireThreshold, 0x000000, 0).setStrokeStyle(2, 0xff6b4a, 0.35).setScrollFactor(0).setDepth(D);
    this.knob = scene.add.circle(0, 0, 24, 0xe8e2d0, 0.35).setScrollFactor(0).setDepth(D + 1);
    scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.pointerId !== null || p.x <= scene.scale.width / 2 || this.blocked(p.x, p.y, p)) return;
      this.pointerId = p.id; this.active = true; this.tapped = false;
      this.downAt = scene.time.now; this.maxLen = 0;
      const inRest = Math.hypot(p.x - this.rest.x, p.y - this.rest.y) <= this.radius * 1.15;
      // flotante: el vector se mide desde el toque (neutro), pero la base se dibuja a ≥ edgeInsetPx + radio del borde
      const m = HUD2.edgeInsetPx + this.radius, W = scene.scale.width, H = scene.scale.height;
      this.ox = inRest ? this.rest.x : p.x; this.oy = inRest ? this.rest.y : p.y;
      const cx = inRest ? this.rest.x : Phaser.Math.Clamp(p.x, m, Math.max(m, W - m)), cy = inRest ? this.rest.y : Phaser.Math.Clamp(p.y, m, Math.max(m, H - m));
      this.base.setPosition(cx, cy); this.ring.setPosition(cx, cy);
      this.move(p);
    });
    scene.input.on('pointermove', (p: Phaser.Input.Pointer) => { if (p.id === this.pointerId) this.move(p); });
    const release = (p: Phaser.Input.Pointer) => {
      if (p.id !== this.pointerId) return;
      const quick = scene.time.now - this.downAt < AIM.tapMaxSec * 1000 && this.maxLen < 0.35;
      this.reset();
      if (quick) this.tapped = true;
    };
    scene.input.on('pointerup', release);
    scene.input.on('pointerupoutside', release);
  }

  private move(p: Phaser.Input.Pointer) {
    const dx = p.x - this.ox, dy = p.y - this.oy;
    const len = Math.hypot(dx, dy);
    const k = len > this.radius ? this.radius / len : 1;
    this.knob.setPosition(this.base.x + dx * k, this.base.y + dy * k);
    this.vec.set((dx * k) / this.radius, (dy * k) / this.radius);
    this.maxLen = Math.max(this.maxLen, this.vec.length());
  }

  /** Coloca la base en reposo. */
  place(x: number, y: number) {
    this.rest = { x, y };
    if (!this.active) { this.base.setPosition(x, y); this.ring.setPosition(x, y); this.knob.setPosition(x, y); }
  }

  get magnitude() { return this.vec.length(); }
  get angle() { return Math.atan2(this.vec.y, this.vec.x); }
  /** ¿Apuntando de verdad (fuera de la zona muerta)? */
  get aiming() { return this.active && this.magnitude > AIM.deadZone; }
  get overThreshold() { return this.active && this.magnitude >= AIM.fireThreshold; }

  pulse() { this.pulseT = 0.12; }

  update(dt: number, ranged: boolean) {
    this.ring.setVisible(ranged);
    if (this.pulseT > 0) this.pulseT -= dt;
    const pk = this.pulseT > 0 ? 1 + 0.18 * (this.pulseT / 0.12) : 1;
    this.base.setScale(pk);
    this.base.setFillStyle(this.pulseT > 0 ? 0xff6b4a : 0xffffff, this.pulseT > 0 ? 0.2 : this.active ? 0.1 : 0.05);
    this.knob.setAlpha(this.active ? 0.6 : 0.3);
    this.ring.setStrokeStyle(2, 0xff6b4a, this.overThreshold ? 0.9 : 0.35);
  }

  reset() {
    this.pointerId = null; this.active = false; this.vec.set(0, 0);
    this.base.setPosition(this.rest.x, this.rest.y); this.ring.setPosition(this.rest.x, this.rest.y); this.knob.setPosition(this.rest.x, this.rest.y);
  }

  /** QA / depuración: simula el dedo en (vx, vy) ∈ [-1, 1] relativo a la base; null = soltar. */
  debugSet(v: { x: number; y: number } | null) {
    if (!v) { if (this.pointerId === -99) { const quick = this.scene.time.now - this.downAt < AIM.tapMaxSec * 1000 && this.maxLen < 0.35; this.reset(); if (quick) this.tapped = true; } return; }
    if (this.pointerId === null) { this.pointerId = -99; this.active = true; this.downAt = this.scene.time.now; this.maxLen = 0; }
    const len = Math.hypot(v.x, v.y), k = len > 1 ? 1 / len : 1;
    this.vec.set(v.x * k, v.y * k); this.maxLen = Math.max(this.maxLen, this.vec.length());
    this.knob.setPosition(this.base.x + this.vec.x * this.radius, this.base.y + this.vec.y * this.radius);
  }

  /** ¿Toca la base en reposo? */
  contains(x: number, y: number) { return Math.hypot(x - this.rest.x, y - this.rest.y) <= this.radius; }
}
