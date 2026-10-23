import Phaser from 'phaser';
import { WORLD } from '../config/constants';
import { safeInsets } from '../ui/safe';

const FONT = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
const D = 2000;

export interface HudButtonState { icon: string | null; label: string; cd: number; maxCd: number; enabled: boolean; badge?: string }

class RoundButton {
  bg: Phaser.GameObjects.Arc;
  icon: Phaser.GameObjects.Image;
  cd: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  badge: Phaser.GameObjects.Text;
  r = 30;
  onTap: () => void = () => undefined;
  constructor(sc: Phaser.Scene) {
    this.bg = sc.add.circle(0, 0, 30, 0x14110f, 0.65).setStrokeStyle(3, 0xe8e2d0, 0.8).setScrollFactor(0).setDepth(D);
    this.icon = sc.add.image(0, 0, 'bate').setScrollFactor(0).setDepth(D + 1);
    this.cd = sc.add.graphics().setScrollFactor(0).setDepth(D + 2);
    this.label = sc.add.text(0, 0, '', { fontFamily: FONT, fontSize: '11px', color: '#e8e2d0', stroke: '#000', strokeThickness: 3, align: 'center' }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(D + 3);
    this.badge = sc.add.text(0, 0, '', { fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: '#fff', stroke: '#000', strokeThickness: 4 }).setOrigin(1, 1).setScrollFactor(0).setDepth(D + 3);
  }
  place(x: number, y: number, r: number) {
    this.r = r;
    this.bg.setPosition(x, y).setRadius(r);
    this.bg.setOrigin(0.5);
    this.icon.setPosition(x, y).setDisplaySize(r * 1.2, r * 1.2);
    this.label.setPosition(x, y + r + 2);
    this.badge.setPosition(x + r, y + r);
  }
  set(s: HudButtonState) {
    if (s.icon) this.icon.setTexture(s.icon).setVisible(true).setDisplaySize(this.r * 1.2, this.r * 1.2); else this.icon.setVisible(false);
    this.icon.setAlpha(s.enabled ? 1 : 0.35);
    this.bg.setStrokeStyle(3, s.enabled && s.cd <= 0 ? 0xb6ff3c : 0xe8e2d0, s.enabled ? 0.9 : 0.3);
    this.label.setText(s.label);
    this.badge.setText(s.badge ?? '');
    this.cd.clear();
    if (s.cd > 0 && s.maxCd > 0) {
      const k = s.cd / s.maxCd;
      this.cd.fillStyle(0x000000, 0.6).slice(this.bg.x, this.bg.y, this.r, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2, false).fillPath();
    }
  }
  contains(x: number, y: number) { return Math.hypot(x - this.bg.x, y - this.bg.y) <= this.r + 6; }
}

/** HUD de la raid: vida, reloj, botones de habilidad, consumible, extracción, minimapa y flechas a las salidas. */
export class Hud {
  hpBg: Phaser.GameObjects.Rectangle;
  hpFill: Phaser.GameObjects.Rectangle;
  hpText: Phaser.GameObjects.Text;
  timer: Phaser.GameObjects.Text;
  info: Phaser.GameObjects.Text;
  msg: Phaser.GameObjects.Text;
  abilities: RoundButton[];
  quick: RoundButton;
  pauseBtn: RoundButton;
  bagBtn: RoundButton;
  actionBtn: Phaser.GameObjects.Text;
  barBg: Phaser.GameObjects.Rectangle;
  barFill: Phaser.GameObjects.Rectangle;
  barText: Phaser.GameObjects.Text;
  mini: Phaser.GameObjects.Graphics;
  arrows: Phaser.GameObjects.Graphics;
  arrowTexts: Phaser.GameObjects.Text[] = [];
  fog: Phaser.GameObjects.Rectangle;
  hurt: Phaser.GameObjects.Rectangle;
  fps: Phaser.GameObjects.Text;
  onAction: (() => void) | null = null;
  miniRect = { x: 0, y: 0, s: 96 };
  private msgT = 0;
  insets = { top: 0, right: 0, bottom: 0, left: 0 };

  constructor(private sc: Phaser.Scene) {
    const t = (size: number, color = '#e8e2d0') => sc.add.text(0, 0, '', { fontFamily: FONT, fontSize: size + 'px', color, stroke: '#000', strokeThickness: 4 }).setScrollFactor(0).setDepth(D);
    this.fog = sc.add.rectangle(0, 0, 10, 10, 0xb6ff3c, 0).setOrigin(0).setScrollFactor(0).setDepth(D - 10);
    this.hurt = sc.add.rectangle(0, 0, 10, 10, 0xff3b30, 0).setOrigin(0).setScrollFactor(0).setDepth(D - 9);
    this.hpBg = sc.add.rectangle(0, 0, 150, 16, 0x000000, 0.6).setOrigin(0, 0.5).setStrokeStyle(2, 0x14110f).setScrollFactor(0).setDepth(D);
    this.hpFill = sc.add.rectangle(0, 0, 146, 12, 0x4cd964).setOrigin(0, 0.5).setScrollFactor(0).setDepth(D);
    this.hpText = t(13);
    this.timer = t(22).setOrigin(0.5, 0).setFontStyle('bold');
    this.info = t(12);
    this.msg = t(16).setOrigin(0.5).setAlign('center').setWordWrapWidth(320);
    this.fps = t(11, '#b6ff3c').setVisible(false);
    this.abilities = [new RoundButton(sc), new RoundButton(sc), new RoundButton(sc)];
    this.quick = new RoundButton(sc);
    this.pauseBtn = new RoundButton(sc);
    this.bagBtn = new RoundButton(sc);
    this.pauseBtn.icon.setVisible(false);
    this.pauseBtn.label.setText('');
    this.actionBtn = sc.add.text(0, 0, '', { fontFamily: FONT, fontSize: '17px', fontStyle: 'bold', color: '#14110f', backgroundColor: '#b6ff3c', padding: { x: 16, y: 10 } })
      .setOrigin(0.5).setScrollFactor(0).setDepth(D + 5).setVisible(false);
    this.barBg = sc.add.rectangle(0, 0, 220, 14, 0x000000, 0.6).setStrokeStyle(2, 0x14110f).setScrollFactor(0).setDepth(D).setVisible(false);
    this.barFill = sc.add.rectangle(0, 0, 216, 10, 0x4cd964).setOrigin(0, 0.5).setScrollFactor(0).setDepth(D).setVisible(false);
    this.barText = t(14).setOrigin(0.5, 1).setVisible(false);
    this.mini = sc.add.graphics().setScrollFactor(0).setDepth(D);
    this.arrows = sc.add.graphics().setScrollFactor(0).setDepth(D - 1);
    this.layout();
  }

  /** Recoloca todo según tamaño de pantalla y márgenes seguros (vertical u horizontal). */
  layout() {
    const W = this.sc.scale.width, H = this.sc.scale.height;
    const ins = this.insets = safeInsets();
    const L = ins.left + 12, T = ins.top + 12, R = W - ins.right - 12, B = H - ins.bottom - 12;
    this.fog.setSize(W, H); this.hurt.setSize(W, H);
    this.hpBg.setPosition(L, T + 10); this.hpFill.setPosition(L + 2, T + 10);
    this.hpText.setPosition(L + 156, T + 2);
    this.timer.setPosition(W / 2, T + 46);
    this.info.setPosition(L, T + 24);
    this.fps.setPosition(L, H - ins.bottom - 20);
    this.msg.setPosition(W / 2, H * 0.36).setWordWrapWidth(Math.min(340, W - 40));
    this.pauseBtn.place(R - 22, T + 22, 22);
    this.bagBtn.place(R - 74, T + 22, 22);
    this.bagBtn.icon.setTexture('caja');
    const s = Math.min(96, Math.max(72, W * 0.22));
    this.miniRect = { x: R - s, y: T + 56, s };
    // Botones en abanico en la esquina inferior derecha (alcance del pulgar)
    const big = Math.min(40, Math.max(32, Math.min(W, H) * 0.095)), small = big * 0.78;
    const cx = R - big - 4, cy = B - big - 18;
    this.abilities[0].place(cx, cy, big);
    this.abilities[1].place(cx - big * 2.35, cy + big * 0.2, small);
    this.abilities[2].place(cx + big * 0.1, cy - big * 2.45, small);
    this.quick.place(cx - big * 1.95, cy - big * 1.85, small);
    this.actionBtn.setPosition(W / 2, B - 150);
    this.barBg.setPosition(W / 2, H * 0.62); this.barFill.setPosition(W / 2 - 108, H * 0.62); this.barText.setPosition(W / 2, H * 0.62 - 10);
  }

  /** ¿Toca este punto algún control? (para que el joystick no lo robe) */
  hitTest(x: number, y: number) {
    const btns = [...this.abilities, this.quick, this.pauseBtn, this.bagBtn];
    if (btns.some(b => b.contains(x, y))) return true;
    if (this.actionBtn.visible && this.actionBtn.getBounds().contains(x, y)) return true;
    return y < this.insets.top + 50;
  }

  /** Despacha un toque a los botones; devuelve true si lo ha consumido. */
  handleTap(x: number, y: number) {
    if (this.actionBtn.visible && this.actionBtn.getBounds().contains(x, y)) { this.onAction?.(); return true; }
    for (const b of [...this.abilities, this.quick, this.pauseBtn, this.bagBtn]) if (b.contains(x, y)) { b.onTap(); return true; }
    return false;
  }

  setHp(hp: number, max: number, protection: number) {
    const k = Math.max(0, hp / max);
    this.hpFill.width = 146 * k;
    this.hpFill.fillColor = k > 0.5 ? 0x4cd964 : k > 0.25 ? 0xffb02e : 0xff3b30;
    this.hpText.setText(`${Math.ceil(hp)}  🛡${Math.round(protection * 100)}%`);
  }

  toast(m: string, sec = 2.2) { this.msg.setText(m).setAlpha(1); this.msgT = sec; }

  setBar(text: string, progress: number | null, color = 0x4cd964) {
    const v = progress !== null;
    this.barBg.setVisible(v); this.barFill.setVisible(v); this.barText.setVisible(v || !!text);
    this.barText.setText(text);
    if (v) { this.barFill.width = 216 * Phaser.Math.Clamp(progress!, 0, 1); this.barFill.fillColor = color; }
  }

  setAction(label: string | null, run: (() => void) | null) {
    this.actionBtn.setVisible(!!label);
    if (label) this.actionBtn.setText(label);
    this.onAction = run;
  }

  update(dt: number) {
    if (this.msgT > 0) { this.msgT -= dt; if (this.msgT < 0.5) this.msg.setAlpha(Math.max(0, this.msgT / 0.5)); }
    if (this.hurt.fillAlpha > 0) this.hurt.fillAlpha = Math.max(0, this.hurt.fillAlpha - dt * 1.5);
  }

  flashHurt() { this.hurt.fillAlpha = 0.28; }

  drawMinimap(px: number, py: number, exits: { x: number; y: number; open: boolean }[], closed: { x: number; y: number }[], extra: { x: number; y: number; color: number }[]) {
    const { x, y, s } = this.miniRect;
    const k = s / WORLD;
    const g = this.mini.clear();
    g.fillStyle(0x000000, 0.55).fillRect(x, y, s, s).lineStyle(2, 0xe8e2d0, 0.5).strokeRect(x, y, s, s);
    for (const c of closed) g.fillStyle(0x777777, 0.8).fillCircle(x + c.x * k, y + c.y * k, 3);
    for (const e of exits) g.fillStyle(e.open ? 0x4cd964 : 0xffb02e, 1).fillCircle(x + e.x * k, y + e.y * k, 4.5);
    for (const e of extra) g.fillStyle(e.color, 1).fillCircle(x + e.x * k, y + e.y * k, 2);
    g.fillStyle(0xffffff, 1).fillCircle(x + px * k, y + py * k, 3);
  }

  /** Flechas en el borde de la pantalla apuntando a las salidas fuera de vista. */
  drawArrows(cam: Phaser.Cameras.Scene2D.Camera, exits: { x: number; y: number; open: boolean; name: string }[]) {
    const g = this.arrows.clear();
    const W = this.sc.scale.width, H = this.sc.scale.height;
    while (this.arrowTexts.length < exits.length) this.arrowTexts.push(this.sc.add.text(0, 0, '', { fontFamily: FONT, fontSize: '12px', color: '#4cd964', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setScrollFactor(0).setDepth(D - 1));
    const cx = W / 2, cy = (this.miniRect.y + this.miniRect.s + 24 + H - this.insets.bottom - 240) / 2;
    exits.forEach((e, i) => {
      const sx = e.x - cam.worldView.x, sy = e.y - cam.worldView.y;
      const txt = this.arrowTexts[i];
      if (sx > 0 && sx < W && sy > 0 && sy < H) { txt.setVisible(false); return; }
      const ang = Math.atan2(sy - cy, sx - cx);
      // rectángulo libre de HUD: debajo del minimapa y por encima de los botones
      const x0 = this.insets.left + 40, x1 = W - this.insets.right - 40;
      const y0 = this.miniRect.y + this.miniRect.s + 24, y1 = H - this.insets.bottom - 240;
      const dx = Math.cos(ang), dy = Math.sin(ang);
      const tx = dx > 0 ? (x1 - cx) / dx : dx < 0 ? (x0 - cx) / dx : Infinity;
      const ty = dy > 0 ? (y1 - cy) / dy : dy < 0 ? (y0 - cy) / dy : Infinity;
      const r = Math.max(0, Math.min(tx, ty));
      const ax = cx + Math.cos(ang) * r, ay = cy + Math.sin(ang) * r;
      const col = e.open ? 0x4cd964 : 0xffb02e;
      g.fillStyle(col, 0.9).lineStyle(2, 0x000000, 1);
      g.beginPath();
      g.moveTo(ax + Math.cos(ang) * 14, ay + Math.sin(ang) * 14);
      g.lineTo(ax + Math.cos(ang + 2.5) * 10, ay + Math.sin(ang + 2.5) * 10);
      g.lineTo(ax + Math.cos(ang - 2.5) * 10, ay + Math.sin(ang - 2.5) * 10);
      g.closePath(); g.fillPath(); g.strokePath();
      const dist = Math.round(Math.hypot(e.x - cam.midPoint.x, e.y - cam.midPoint.y) / 48);
      txt.setVisible(true).setText(`${e.name} ${dist}m`).setColor(e.open ? '#4cd964' : '#ffb02e').setPosition(ax - Math.cos(ang) * 26, ay - Math.sin(ang) * 18);
    });
  }
}
