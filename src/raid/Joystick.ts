import Phaser from 'phaser';

/** Joystick virtual flotante: aparece donde tocas en la mitad izquierda. */
export class Joystick {
  vec = new Phaser.Math.Vector2();
  private base: Phaser.GameObjects.Arc;
  private knob: Phaser.GameObjects.Arc;
  private pointerId: number | null = null;
  private readonly radius = 60;

  constructor(private scene: Phaser.Scene, private blocked: (x: number, y: number, p?: Phaser.Input.Pointer) => boolean = () => false) {
    this.base = scene.add.circle(0, 0, this.radius, 0xffffff, 0.08).setStrokeStyle(3, 0xffffff, 0.35).setScrollFactor(0).setDepth(1000).setVisible(false);
    this.knob = scene.add.circle(0, 0, 26, 0xe8e2d0, 0.5).setScrollFactor(0).setDepth(1001).setVisible(false);

    scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.pointerId !== null || p.x > scene.scale.width / 2 || this.blocked(p.x, p.y, p)) return;
      this.pointerId = p.id;
      this.base.setPosition(p.x, p.y).setVisible(true);
      this.knob.setPosition(p.x, p.y).setVisible(true);
    });
    scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.id !== this.pointerId) return;
      const dx = p.x - this.base.x, dy = p.y - this.base.y;
      const len = Math.hypot(dx, dy);
      const k = len > this.radius ? this.radius / len : 1;
      this.knob.setPosition(this.base.x + dx * k, this.base.y + dy * k);
      this.vec.set(dx * k / this.radius, dy * k / this.radius);
    });
    const release = (p: Phaser.Input.Pointer) => {
      if (p.id !== this.pointerId) return;
      this.pointerId = null;
      this.vec.set(0, 0);
      this.base.setVisible(false);
      this.knob.setVisible(false);
    };
    scene.input.on('pointerup', release);
    scene.input.on('pointerupoutside', release);
  }

  /** Suelta el joystick (al pausar o abrir menús). */
  reset() {
    this.pointerId = null;
    this.vec.set(0, 0);
    this.base.setVisible(false);
    this.knob.setVisible(false);
  }
}
