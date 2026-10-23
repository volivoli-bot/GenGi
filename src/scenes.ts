import Phaser from 'phaser';
import { COLORS } from './config/constants';

export const ART = ['player', 'errante', 'corredor', 'hinchado', 'abominacion', 'caja', 'bate', 'machete', 'arco', 'pistola',
  'casco', 'chaleco', 'tablas', 'vendaje', 'botiquin', 'bengala', 'generador', 'chapa', 'extraccion', 'aviso-ataque'];

/** Carga el arte vectorial y avisa a la app. */
export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  preload() {
    for (const k of ART) {
      const big = k === 'abominacion' || k === 'extraccion' || k === 'aviso-ataque';
      this.load.svg(k, `art/${k}.svg`, { width: big ? 256 : 128, height: big ? 256 : 128 });
    }
  }
  create() { this.game.events.emit('gengi-ready'); }
}

/** Fondo animado del refugio (detrás de la interfaz HTML). */
export class HubBgScene extends Phaser.Scene {
  constructor() { super('HubBg'); }
  create() {
    const draw = () => {
      this.children.removeAll(true);
      const W = this.scale.width, H = this.scale.height;
      const g = this.add.graphics();
      g.fillStyle(COLORS.suelo[0], 1).fillRect(0, 0, W, H);
      for (let i = 0; i < 40; i++) g.fillStyle(i % 2 ? COLORS.suelo[1] : COLORS.musgo, 0.4).fillCircle(Math.random() * W, Math.random() * H, 20 + Math.random() * 60);
      const kinds = ['errante', 'corredor', 'hinchado', 'caja', 'bate'];
      for (let i = 0; i < 9; i++) {
        const im = this.add.image(Math.random() * W, Math.random() * H, kinds[i % kinds.length]).setDisplaySize(56, 56).setAlpha(0.35).setRotation(Math.random() * 6);
        this.tweens.add({ targets: im, x: im.x + (Math.random() - 0.5) * 80, y: im.y + (Math.random() - 0.5) * 80, duration: 4000 + Math.random() * 3000, yoyo: true, repeat: -1 });
      }
    };
    draw();
    this.scale.on('resize', draw);
    this.events.once('shutdown', () => this.scale.off('resize', draw));
  }
}
