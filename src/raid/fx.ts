import Phaser from 'phaser';
import { JUICE } from '../config/v2';
import { DAMAGE } from '../config/v31';

const FONT = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';

/** Efectos de impacto: números de daño, sangre, manchas de suelo (toda la raid, con tope), fogonazos, impactos. */
export class Fx {
  private nums: Phaser.GameObjects.Text[] = [];
  private stains: Phaser.GameObjects.Image[] = [];
  corpses: { destroy(): void }[] = [];
  /** QA: últimos números de daño mostrados. */
  shown: { n: number; crit: boolean; color: string; size: number; text?: string; hurt?: boolean }[] = [];
  stainCount = 0;

  constructor(private sc: Phaser.Scene) {}

  private tex(k: string) { return this.sc.textures.exists(k); }

  /** Número de daño: blanco con contorno #14110f 3 px; crítico amarillo 1,4×; salta 20 px con curva y se desvanece en 0,6 s. */
  /**
   * v3.1 §9.2: número normal blanco; crítico #ffb02e, 1,35× más grande, con «!» y rebote (estilo ui_num_critico:
   * contorno #14110f de 4). `hurt` = daño recibido (rojo; crítico recibido naranja rojizo).
   */
  damageNumber(x: number, y: number, n: number, crit: boolean, hurt = false) {
    let t = this.nums.find(o => !o.active);
    const size = crit ? Math.round(17 * DAMAGE.critSize) : 17;
    const color = hurt ? (crit ? DAMAGE.hurtCritColor : DAMAGE.hurtColor) : crit ? DAMAGE.critColor : DAMAGE.numColor;
    if (!t) {
      t = this.sc.add.text(0, 0, '', { fontFamily: FONT, fontStyle: '900', fontSize: '17px', color: '#fff', stroke: '#14110f', strokeThickness: 3 }).setOrigin(0.5).setDepth(31);
      this.nums.push(t);
    }
    const txt = String(Math.max(1, Math.round(n))) + (crit ? '!' : '');
    t.setActive(true).setVisible(true).setAlpha(1).setText(txt).setFontSize(size).setColor(color).setStroke('#14110f', crit ? 4 : 3).setPosition(x, y - 18).setScale(1);
    this.shown.push({ n: Math.round(n), crit, color, size, text: txt, hurt }); if (this.shown.length > 30) this.shown.shift();
    const side = (Math.random() - 0.5) * 24;
    const x0 = x, y0 = y - 18;
    const o = { k: 0 };
    this.sc.tweens.add({
      targets: o, k: 1, duration: JUICE.dmgNumSec * 1000 * (crit ? 1.15 : 1), ease: 'Linear',
      onUpdate: () => {
        const k = o.k;
        t!.setPosition(x0 + side * k, y0 - JUICE.dmgNumRise * Math.sin(k * Math.PI * 0.6) / Math.sin(Math.PI * 0.6));
        // crítico: pequeño rebote (sale grande, se encoge por debajo de 1 y vuelve)
        const sc = crit ? (k < 0.12 ? 1.45 - k * 3.75 : k < 0.24 ? 1 - Math.sin((k - 0.12) / 0.12 * Math.PI) * 0.12 : 1) : (k < 0.15 ? 1 + (0.15 - k) * 2 : 1);
        t!.setAlpha(k < 0.5 ? 1 : 1 - (k - 0.5) / 0.5).setScale(sc);
      },
      onComplete: () => t!.setActive(false).setVisible(false),
    });
  }

  /** 1-3 salpicaduras en la dirección del golpe + mancha de suelo que se queda toda la raid. */
  blood(x: number, y: number, ang: number, azul: boolean, strong = false) {
    const col = azul ? 'azul' : 'verde';
    const n = 1 + Math.floor(Math.random() * (strong ? 3 : 2));
    for (let i = 0; i < n; i++) {
      const k = `fx_sangre_${col}_${1 + (i % 2)}`;
      if (!this.tex(k)) break;
      const a = ang + (Math.random() - 0.5) * 0.7;
      const s = 0.3 + Math.random() * 0.3;
      const im = this.sc.add.image(x, y, k).setDisplaySize(64 * s, 64 * s).setRotation(a + Math.PI / 2).setDepth(11);
      const d = 18 + Math.random() * 26;
      this.sc.tweens.add({ targets: im, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, alpha: 0, duration: 260 + Math.random() * 120, ease: 'Quad.easeOut', onComplete: () => im.destroy() });
    }
    if (Math.random() < (strong ? 1 : 0.6)) this.stain(x + Math.cos(ang) * 14, y + Math.sin(ang) * 14, azul, 0.35 + Math.random() * 0.25);
  }

  /** Mancha de suelo persistente (reciclando las más viejas por encima del tope). */
  stain(x: number, y: number, azul: boolean, scale = 0.6) {
    const k = azul ? 'fx_mancha_suelo_azul' : 'fx_mancha_suelo_verde';
    if (!this.tex(k)) return;
    let im: Phaser.GameObjects.Image;
    if (this.stains.length >= JUICE.maxStains) { im = this.stains.shift()!; im.setTexture(k); }
    else im = this.sc.add.image(0, 0, k).setDepth(2);
    im.setPosition(x, y).setDisplaySize(64 * scale * 1.4, 64 * scale * 1.4).setRotation(Math.random() * 6.28).setAlpha(0.8);
    this.stains.push(im);
    this.stainCount++;
  }

  muzzle(x: number, y: number, ang: number) {
    if (!this.tex('fx_fogonazo')) return;
    const im = this.sc.add.image(x, y, 'fx_fogonazo').setDisplaySize(30, 30).setRotation(ang + Math.PI / 2).setDepth(13).setBlendMode(Phaser.BlendModes.ADD);
    this.sc.time.delayedCall(40, () => im.destroy());
  }

  impact(x: number, y: number) {
    if (!this.tex('fx_impacto')) return;
    const im = this.sc.add.image(x, y, 'fx_impacto').setDisplaySize(26, 26).setDepth(13).setRotation(Math.random() * 6);
    this.sc.tweens.add({ targets: im, alpha: 0, scale: im.scale * 1.4, duration: 140, onComplete: () => im.destroy() });
  }

  /** Registra un cadáver; por encima del tope se borran los más viejos. */
  addCorpse(c: { destroy(): void }) {
    this.corpses.push(c);
    while (this.corpses.length > JUICE.maxCorpses) this.corpses.shift()!.destroy();
  }
}
