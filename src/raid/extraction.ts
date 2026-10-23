import Phaser from 'phaser';
import {
  EXIT_RADIUS_TILES, EXTRACT_HIT_PAUSE_SEC, EXTRACT_HIT_PENALTY_SEC, EXTRACT_HOLD_SEC,
  FLARE_CLOSE_MIN, FLARE_OPEN_MIN, FLARE_WINDOW_SEC, GENERATOR_NOISE, GENERATOR_SEC, TILE,
} from '../config/constants';
import type { ExitState, ExitType } from '../save/types';
import type { MapData } from './map';

export const EXIT_NAMES: Record<ExitType, string> = { pie: 'A pie', generador: 'Generador', bengala: 'Bengala', pago: 'De pago' };

/**
 * Elige las 2 salidas activas de la raid entre las 3 del mapa.
 * Regla: una SIEMPRE es "a pie" o "generador" (salida garantizada sin requisitos de objetos).
 * "A pie" va en el extremo opuesto a la aparición (loc 0); el generador, en uno de los laterales (más cerca).
 */
export function chooseExits(rng: () => number, map: MapData): ExitState[] {
  const guaranteed: ExitType = rng() < 0.5 ? 'pie' : 'generador';
  const others: ExitType[] = (['pie', 'generador', 'bengala', 'pago'] as ExitType[]).filter(t => t !== guaranteed);
  const second = others[Math.floor(rng() * others.length)];
  const used = new Set<number>();
  const place = (t: ExitType): number => {
    if (t === 'pie') { used.add(0); return 0; }
    const side = [1, 2].filter(l => !used.has(l));
    const pool = t === 'generador' ? side : [0, 1, 2].filter(l => !used.has(l) && !(l === 0 && (guaranteed === 'pie')));
    const l = (pool.length ? pool : [0, 1, 2].filter(x => !used.has(x)))[Math.floor(rng() * (pool.length || 1))];
    used.add(l); return l;
  };
  // colocar primero el que exige posición fija
  const order = guaranteed === 'pie' ? [guaranteed, second] : second === 'pie' ? [second, guaranteed] : [guaranteed, second];
  return order.map(t => {
    const loc = place(t);
    const p = map.exitLocs[loc];
    return { loc, type: t, x: p.x, y: p.y, gen: 0, unlocked: t === 'pie', flareAt: null };
  });
}

export interface ExtractionHooks {
  scene: Phaser.Scene;
  px(): number; py(): number;
  elapsed(): number;
  noise(x: number, y: number, r: number): void;
  hasFlare(): boolean;
  useFlare(): boolean;
  /** Objeto Reforzado o mejor que se entregaría (nombre) o null. */
  payCandidate(): string | null;
  pay(): boolean;
  onExtract(exit: ExitState): void;
  toast(msg: string): void;
  /** v2: ¿se dibuja esta salida (vista alguna vez en este mapa, o a la vista ahora)? */
  shown?(loc: number): boolean;
}

export interface ExtractionStatus {
  exit: ExitState | null;
  text: string;
  progress: number;
  action: { label: string; run: () => void } | null;
  hitPaused: boolean;
}

export class ExtractionManager {
  hold = 0;
  hitPause = 0;
  private current: ExitState | null = null;
  private genNoiseT = 0;
  private gfx: { exit: ExitState; img: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text; icon?: Phaser.GameObjects.Image }[] = [];
  private closedGfx: { loc: number; objs: Phaser.GameObjects.GameObject[] }[] = [];

  constructor(public exits: ExitState[], private map: MapData, private h: ExtractionHooks) {
    const sc = h.scene;
    const r = EXIT_RADIUS_TILES * TILE;
    const nm = (i: number) => map.exitLocNames?.[i] ?? '';
    map.exitLocs.forEach((p, i) => {
      if (exits.some(e => e.loc === i)) return;
      const a = sc.add.image(p.x, p.y, 'extraccion').setDisplaySize(r * 2, r * 2).setTint(0x555555).setAlpha(0.5).setDepth(2);
      const b = sc.add.text(p.x, p.y + r + 6, `${nm(i)}\nCERRADA`, { fontFamily: 'sans-serif', fontSize: '14px', color: '#888', stroke: '#000', strokeThickness: 3, align: 'center' }).setOrigin(0.5, 0).setDepth(2);
      this.closedGfx.push({ loc: i, objs: [a, b] });
    });
    for (const e of exits) {
      const img = sc.add.image(e.x, e.y, 'extraccion').setDisplaySize(r * 2, r * 2).setDepth(2);
      sc.tweens.add({ targets: img, angle: 360, duration: 12000, repeat: -1 });
      const iconK = e.type === 'generador' ? 'generador' : e.type === 'bengala' ? 'bengala' : e.type === 'pago' ? 'chapa' : null;
      const icon = iconK ? sc.add.image(e.x, e.y, iconK).setDisplaySize(TILE * 1.1, TILE * 1.1).setDepth(3) : undefined;
      const label = sc.add.text(e.x, e.y - r - 6, '', { fontFamily: 'sans-serif', fontSize: '15px', fontStyle: 'bold', color: '#4cd964', stroke: '#000', strokeThickness: 4, align: 'center' }).setOrigin(0.5, 1).setDepth(3);
      this.gfx.push({ exit: e, img, label, icon });
    }
  }

  /** Nombre del sitio de una salida (p. ej. "Túnel norte"). */
  locName(loc: number) { return this.map.exitLocNames?.[loc] ?? `Salida ${loc + 1}`; }

  isOpen(e: ExitState) {
    if (e.type === 'bengala') return e.unlocked && e.flareAt !== null && this.h.elapsed() < e.flareAt + FLARE_WINDOW_SEC;
    return e.unlocked;
  }

  /** Golpe recibido: si estás extrayendo, el contador se pausa y retrocede 2 s (sin bajar de 0). */
  onHit() {
    if (this.current && this.hold > 0) {
      this.hold = Math.max(0, this.hold - EXTRACT_HIT_PENALTY_SEC);
      this.hitPause = EXTRACT_HIT_PAUSE_SEC;
    }
  }

  update(dt: number): ExtractionStatus {
    const px = this.h.px(), py = this.h.py();
    const r = EXIT_RADIUS_TILES * TILE;
    const minute = this.h.elapsed() / 60;
    const shown = (loc: number) => !this.h.shown || this.h.shown(loc);
    for (const c of this.closedGfx) { const v = shown(c.loc); for (const o of c.objs) (o as Phaser.GameObjects.Image).setVisible(v); }
    for (const g of this.gfx) {
      const v = shown(g.exit.loc);
      g.img.setVisible(v); g.label.setVisible(v); g.icon?.setVisible(v);
      if (!v) continue;
      const open = this.isOpen(g.exit);
      g.img.setTint(open ? 0xffffff : 0x888888);
      g.label.setText(`${this.locName(g.exit.loc)}\n${EXIT_NAMES[g.exit.type]}` + (open ? '' : this.lockReason(g.exit, minute))).setColor(open ? '#4cd964' : '#e8e2d0');
    }
    const inside = this.exits.find(e => Math.hypot(px - e.x, py - e.y) <= r) ?? null;
    if (inside !== this.current) { this.hold = 0; this.hitPause = 0; this.current = inside; }
    const st: ExtractionStatus = { exit: inside, text: '', progress: 0, action: null, hitPaused: false };
    if (!inside) return st;
    const e = inside;

    if (!this.isOpen(e)) {
      if (e.type === 'generador') {
        if (e.gen === 0) { this.h.noise(e.x, e.y, GENERATOR_NOISE); this.h.toast('¡El generador hace muchísimo ruido!'); }
        e.gen += dt;
        this.genNoiseT -= dt;
        if (this.genNoiseT <= 0) { this.genNoiseT = 2.5; this.h.noise(e.x, e.y, GENERATOR_NOISE); }
        st.text = `Arrancando generador… ${Math.ceil(GENERATOR_SEC - e.gen)} s`;
        st.progress = e.gen / GENERATOR_SEC;
        if (e.gen >= GENERATOR_SEC) { e.unlocked = true; this.h.toast('Generador en marcha: salida abierta'); }
        return st;
      }
      if (e.type === 'bengala') {
        if (minute < FLARE_OPEN_MIN) st.text = `La bengala solo sirve del minuto ${FLARE_OPEN_MIN} al ${FLARE_CLOSE_MIN}`;
        else if (minute >= FLARE_CLOSE_MIN) st.text = 'Demasiado tarde: el helicóptero ya no viene';
        else if (!this.h.hasFlare()) st.text = 'Necesitas una bengala';
        else {
          st.text = 'Lanza la bengala para llamar al helicóptero';
          st.action = { label: 'Lanzar bengala', run: () => { if (this.h.elapsed() / 60 >= FLARE_OPEN_MIN && this.h.elapsed() / 60 < FLARE_CLOSE_MIN && this.h.useFlare()) { e.unlocked = true; e.flareAt = this.h.elapsed(); this.h.noise(e.x, e.y, 8); this.h.toast('Bengala lanzada: aguanta en la zona'); } } };
        }
        return st;
      }
      if (e.type === 'pago') {
        const c = this.h.payCandidate();
        if (!c) st.text = 'Hay que entregar un objeto Reforzado o mejor';
        else {
          st.text = `Entrega: ${c}`;
          st.action = { label: `Pagar`, run: () => { if (!e.unlocked && this.h.pay()) { e.unlocked = true; this.h.toast('Pago entregado: aguanta en la zona'); } } };
        }
        return st;
      }
    }

    if (this.hitPause > 0) { this.hitPause -= dt; st.hitPaused = true; }
    else this.hold += dt;
    st.progress = Math.min(1, this.hold / EXTRACT_HOLD_SEC);
    st.text = st.hitPaused ? '¡Te golpean! Extracción pausada' : `Extrayendo… ${Math.max(0, EXTRACT_HOLD_SEC - this.hold).toFixed(1)} s`;
    if (this.hold >= EXTRACT_HOLD_SEC) this.h.onExtract(e);
    return st;
  }

  private lockReason(e: ExitState, minute: number) {
    if (e.type === 'generador') return '\n(arranca 10 s)';
    if (e.type === 'bengala') return e.flareAt !== null ? '\n(se fue)' : minute < FLARE_OPEN_MIN ? `\n(min ${FLARE_OPEN_MIN}-${FLARE_CLOSE_MIN})` : minute >= FLARE_CLOSE_MIN ? '\n(cerrada)' : '\n(¡ahora!)';
    if (e.type === 'pago') return '\n(Reforzado+)';
    return '';
  }
}
