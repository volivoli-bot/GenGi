import Phaser from 'phaser';
import { WORLD } from '../config/constants';
import { AIM, HUD2, SWAP } from '../config/v2';
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
  /** v2: cambio rápido al arma de reserva (encima del arco de habilidades). */
  swap: RoundButton;
  /** v2: posición en reposo del joystick de apuntar. */
  aimRest = { x: 0, y: 0 };
  /** v2: viñeta roja del lado de un enemigo oculto detrás. */
  vignette: Phaser.GameObjects.Graphics;
  pauseBtn: RoundButton;
  bagBtn: RoundButton;
  actionBtn: Phaser.GameObjects.Text;
  barBg: Phaser.GameObjects.Rectangle;
  barFill: Phaser.GameObjects.Rectangle;
  barText: Phaser.GameObjects.Text;
  mini: Phaser.GameObjects.Graphics;
  arrows: Phaser.GameObjects.Graphics;
  threats: Phaser.GameObjects.Graphics;
  /** QA: flechas de amenaza dibujadas en el último fotograma. */
  threatShown: { type: string; x: number; y: number }[] = [];
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
    this.swap = new RoundButton(sc);
    this.vignette = sc.add.graphics().setScrollFactor(0).setDepth(D - 8);
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
    this.threats = sc.add.graphics().setScrollFactor(0).setDepth(D - 1);
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
    // v2 (Basu/Dott): joystick de apuntar grande (radio 70) abajo a la derecha, en el reposo del pulgar;
    // las 3 habilidades y el consumible en un arco más pequeño (52 px) encima y a la izquierda; el cambio de arma encima del arco.
    const ar = AIM.stickRadius;
    const cx = R - ar - HUD2.edgeInsetPx, cy = B - ar - HUD2.edgeInsetPx; // reposo a 20 px del borde (gesto de atrás de iOS)
    this.aimRest = { x: cx, y: cy };
    const br = HUD2.buttonPx / 2;
    const btns = [this.abilities[0], this.abilities[1], this.abilities[2], this.quick];
    HUD2.arcDeg.forEach((deg, i) => {
      const a = Phaser.Math.DegToRad(deg);
      btns[i].place(cx + Math.cos(a) * HUD2.arcRadius, cy + Math.sin(a) * HUD2.arcRadius, br);
    });
    const top = this.quick.bg, q2 = this.abilities[2].bg;
    this.swap.place((top.x + q2.x) / 2 + 4, Math.min(top.y, q2.y) - br - SWAP.buttonPx / 2 - 14, SWAP.buttonPx / 2);
    this.actionBtn.setPosition(Math.max(L + 80, W * 0.36), B - 232);
    this.barBg.setPosition(W / 2, H * 0.62); this.barFill.setPosition(W / 2 - 108, H * 0.62); this.barText.setPosition(W / 2, H * 0.62 - 10);
  }

  /** Hueco para el inventario compacto: derecha, entre el minimapa y la barra de progreso. */
  panelArea() {
    const W = this.sc.scale.width, H = this.sc.scale.height;
    const ins = this.insets;
    const width = Math.min(300, Math.round((W - ins.left - ins.right) * 0.64));
    let top = this.miniRect.y + this.miniRect.s + 10;
    let bottom = H * 0.62 - 28;
    if (bottom - top < 200) { top = ins.top + 60; bottom = Math.max(top + 200, H - ins.bottom - 160); }
    return { top: Math.round(top), height: Math.round(bottom - top), width, right: ins.right + 8 };
  }

  /** ¿Toca este punto algún control? (para que el joystick no lo robe) */
  hitTest(x: number, y: number) {
    const btns = [...this.abilities, this.quick, this.swap, this.pauseBtn, this.bagBtn];
    if (btns.some(b => b.contains(x, y))) return true;
    if (this.actionBtn.visible && this.actionBtn.getBounds().contains(x, y)) return true;
    return y < this.insets.top + 50;
  }

  /** Despacha un toque a los botones; devuelve true si lo ha consumido. */
  handleTap(x: number, y: number) {
    if (this.actionBtn.visible && this.actionBtn.getBounds().contains(x, y)) { this.onAction?.(); return true; }
    for (const b of [...this.abilities, this.quick, this.swap, this.pauseBtn, this.bagBtn]) if (b.contains(x, y)) { b.onTap(); return true; }
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
  /** Daño por estado: destello leve en la barra de vida (sin hit-stop ni sacudida). */
  pulseHp(color: number) {
    const f = this.hpFill;
    f.scene.tweens.killTweensOf(f);
    f.setAlpha(0.45);
    this.hpBg.setStrokeStyle(2, color, 1);
    f.scene.tweens.add({ targets: f, alpha: 1, duration: 220, onComplete: () => this.hpBg.setStrokeStyle(2, 0x14110f) });
  }

  /** Viñeta roja en el borde de pantalla hacia `ang` (enemigo oculto detrás); k 0..1 = cercanía. */
  drawVignette(list: { ang: number; k: number }[]) {
    const g = this.vignette.clear();
    if (!list.length) return;
    const W = this.sc.scale.width, H = this.sc.scale.height;
    const band = 46, steps = 6;
    for (const { ang, k } of list) {
      const dx = Math.cos(ang), dy = Math.sin(ang);
      const sides: [number, number][] = [];
      if (dx > 0.3) sides.push([0, dx]); if (dx < -0.3) sides.push([1, -dx]);
      if (dy > 0.3) sides.push([2, dy]); if (dy < -0.3) sides.push([3, -dy]);
      for (const [side, w] of sides) for (let i = 0; i < steps; i++) {
        const a = 0.34 * k * w * (1 - i / steps) / steps * 2;
        const o = (band / steps) * i, t = band / steps;
        g.fillStyle(0xff1a1a, a);
        if (side === 0) g.fillRect(W - o - t, 0, t, H); else if (side === 1) g.fillRect(o, 0, t, H);
        else if (side === 2) g.fillRect(0, H - o - t, W, t); else g.fillRect(0, o, W, t);
      }
    }
  }

  drawMinimap(px: number, py: number, exits: { x: number; y: number; open: boolean }[], closed: { x: number; y: number }[], extra: { x: number; y: number; color: number }[], view?: Phaser.Geom.Rectangle) {
    const { x, y, s } = this.miniRect;
    const k = s / WORLD;
    const g = this.mini.clear();
    g.fillStyle(0x000000, 0.55).fillRect(x, y, s, s).lineStyle(2, 0xe8e2d0, 0.5).strokeRect(x, y, s, s);
    for (const c of closed) g.fillStyle(0x777777, 0.8).fillCircle(x + c.x * k, y + c.y * k, 3);
    for (const e of exits) g.fillStyle(e.open ? 0x4cd964 : 0xffb02e, 1).fillCircle(x + e.x * k, y + e.y * k, 4.5);
    for (const e of extra) g.fillStyle(e.color, 1).fillCircle(x + e.x * k, y + e.y * k, 2);
    if (view) g.lineStyle(1, 0xe8e2d0, 0.45).strokeRect(x + Math.max(0, view.x) * k, y + Math.max(0, view.y) * k, Math.min(view.width, WORLD) * k, Math.min(view.height, WORLD) * k);
    g.fillStyle(0xffffff, 1).fillCircle(x + px * k, y + py * k, 3);
  }

  /**
   * Flechas ROJAS en el mismo borde de la pantalla: una por enemigo que te ha detectado y está fuera de vista
   * (más cercanos primero, con tope). El Corredor parpadea; el Hinchado late. Sin texto, para no confundirlas con las salidas.
   */
  drawThreats(cam: Phaser.Cameras.Scene2D.Camera, player: { x: number; y: number }, list: { x: number; y: number; type: string }[], now: number, max = 8) {
    const g = this.threats.clear();
    this.threatShown = [];
    const W = this.sc.scale.width, H = this.sc.scale.height, ins = this.insets;
    const toScr = (x: number, y: number) => ({ x: (x - cam.worldView.x) * cam.zoom, y: (y - cam.worldView.y) * cam.zoom });
    const c = toScr(player.x, player.y);
    const x0 = ins.left + 16, x1 = W - ins.right - 16, y0 = ins.top + 16, y1 = H - ins.bottom - 16;
    const sorted = list.map(e => ({ ...e, d: Math.hypot(e.x - player.x, e.y - player.y) })).sort((a, b) => a.d - b.d).slice(0, max);
    for (const e of sorted) {
      const s = toScr(e.x, e.y);
      const ang = Math.atan2(s.y - c.y, s.x - c.x);
      const dx = Math.cos(ang), dy = Math.sin(ang);
      const tx = dx > 0 ? (x1 - c.x) / dx : dx < 0 ? (x0 - c.x) / dx : Infinity;
      const ty = dy > 0 ? (y1 - c.y) / dy : dy < 0 ? (y0 - c.y) / dy : Infinity;
      const r = Math.max(0, Math.min(tx, ty));
      const ax = c.x + dx * r, ay = c.y + dy * r;
      this.threatShown.push({ type: e.type, x: ax, y: ay });
      if (e.type === 'corredor' && Math.floor(now * 6) % 2 === 1) continue; // parpadeo
      const k = (e.type === 'hinchado' ? 1 + 0.25 * Math.sin(now * 9) : 1) * (e.type === 'abominacion' ? 1.35 : 1);
      const L = 20 * k, Wd = 6.5 * k;
      g.fillStyle(0xff3b30, 0.95).lineStyle(2, 0x14110f, 1).beginPath();
      g.moveTo(ax + dx * L * 0.5, ay + dy * L * 0.5);
      g.lineTo(ax - dx * L * 0.5 - dy * Wd, ay - dy * L * 0.5 + dx * Wd);
      g.lineTo(ax - dx * L * 0.5 + dy * Wd, ay - dy * L * 0.5 - dx * Wd);
      g.closePath(); g.fillPath(); g.strokePath();
    }
  }

  /** Flechas en el borde de la pantalla apuntando a las salidas fuera de vista. */
  drawArrows(cam: Phaser.Cameras.Scene2D.Camera, exits: { x: number; y: number; open: boolean; name: string }[]) {
    const g = this.arrows.clear();
    const W = this.sc.scale.width, H = this.sc.scale.height;
    while (this.arrowTexts.length < exits.length) this.arrowTexts.push(this.sc.add.text(0, 0, '', { fontFamily: FONT, fontSize: '12px', color: '#4cd964', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setScrollFactor(0).setDepth(D - 1));
    const cx = W / 2, cy = (this.miniRect.y + this.miniRect.s + 24 + H - this.insets.bottom - 240) / 2;
    exits.forEach((e, i) => {
      // a píxeles de pantalla (la cámara del mundo tiene zoom; el HUD no)
      const sx = (e.x - cam.worldView.x) * cam.zoom, sy = (e.y - cam.worldView.y) * cam.zoom;
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
