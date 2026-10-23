import { ITEMS } from '../data/items';
import { RARITIES } from '../data/rarity';
import { armorProtection, backpackSlots, canPocket, def, ItemInst, itemLabel, itemWeight, speedMult, totalWeight, weaponStats } from '../game/inventory';
import type { RaidScene } from '../raid/RaidScene';
import { h, itemCell, itemMeta } from './dom';
import { PRUEBA_V2 } from '../config/v2';

const LONG_PRESS_MS = 450;
type From = 'yo' | 'cerca';

/**
 * Inventario durante la raid: NO pausa el juego (los enemigos siguen). Bloqueado con el juego en pausa.
 * v2: tocar un objeto abre un menú flotante junto a él (Equipar / Usar / Tirar / Mover al bolsillo seguro, Coger, Quitar…);
 * mantener pulsado muestra sus estadísticas comparadas con lo equipado. Sin bajar hasta un botón al final.
 * El menú vive DENTRO del panel (recortado a sus bordes), así nunca tapa ni roba toques a los joysticks.
 */
export class RaidInventory {
  el: HTMLElement | null = null;
  sel: { uid: string; from: From; mode: 'menu' | 'compare' } | null = null;
  private timer: number | undefined;
  private lastNear = '';
  private anchor: { x: number; y: number; w: number; h: number } | null = null;
  /** Pulsación larga: en la instancia (no en la celda) para sobrevivir a un redibujado a mitad de pulsación (p. ej. al recargar). */
  private lpT: number | undefined;
  private lpLong = false;
  /** Toque vs arrastre (§8.1): inicio del dedo y scroll de referencia del menú abierto. */
  private down: { x: number; y: number; t: number; uid: string } | null = null;
  private menuScroll = 0;
  /** QA: toques reconocidos. */
  taps = 0;
  private tapHandled = false;
  /** El menú se abre en el pointerup: el click sintético que llega justo después caería sobre un botón del menú recién pintado. */
  private openedAt = -1e9;
  constructor(private root: HTMLElement, private scene: () => RaidScene | null) {}

  get isOpen() { return !!this.el; }

  open() {
    const sc = this.scene();
    if (!sc || sc.paused || sc.ended) return;
    this.sel = null;
    this.render();
    this.timer = window.setInterval(() => {
      const s = this.scene();
      const near = s?.openContainerNear();
      const key = near ? near.id + ':' + near.items.length : '';
      if (key !== this.lastNear) this.render();
    }, 400);
  }

  close() {
    clearInterval(this.timer);
    this.el?.remove(); this.el = null; this.sel = null;
  }

  refresh() { if (this.el) this.render(); }

  private cell(it: ItemInst | null, from: From, label?: string) {
    const el = itemCell(it, { label, selected: !!it && this.sel?.uid === it.uid });
    if (!it) { el.addEventListener('click', () => { if (this.sel) { this.sel = null; this.render(); } }); return el; }
    el.dataset.uid = it.uid;
    const anchorOf = () => {
      const cur = (this.el?.querySelector(`[data-uid="${it.uid}"]`) as HTMLElement | null) ?? el;
      const r = cur.getBoundingClientRect(), p = this.el!.getBoundingClientRect();
      this.anchor = { x: r.left - p.left, y: r.top - p.top, w: r.width, h: r.height };
    };
    const open = () => {
      anchorOf();
      this.sel = this.sel?.uid === it.uid && this.sel.mode === 'menu' ? null : { uid: it.uid, from, mode: 'menu' };
      this.taps++; this.openedAt = performance.now();
      this.render();
    };
    el.addEventListener('pointerdown', (ev: PointerEvent) => {
      this.down = { x: ev.clientX, y: ev.clientY, t: performance.now(), uid: it.uid };
      this.tapHandled = false;
      this.lpLong = false; clearTimeout(this.lpT);
      this.lpT = window.setTimeout(() => { this.lpLong = true; anchorOf(); this.sel = { uid: it.uid, from, mode: 'compare' }; this.render(); }, LONG_PRESS_MS);
    });
    const cancel = () => clearTimeout(this.lpT);
    // es toque si el dedo se mueve < 8 px y dura < 300 ms (vale también justo después de hacer scroll)
    el.addEventListener('pointermove', (ev: PointerEvent) => { const d = this.down; if (d && Math.hypot(ev.clientX - d.x, ev.clientY - d.y) >= PRUEBA_V2.tapMovePx) { this.down = null; cancel(); } });
    el.addEventListener('pointerup', (ev: PointerEvent) => {
      cancel();
      this.tapHandled = true; // el click sintético que sigue a este dedo no cuenta: decide solo la regla del toque
      const d = this.down; this.down = null;
      if (!d || d.uid !== it.uid || this.lpLong) return;
      if (Math.hypot(ev.clientX - d.x, ev.clientY - d.y) >= PRUEBA_V2.tapMovePx || performance.now() - d.t >= PRUEBA_V2.tapMaxMs) return;
      open();
    });
    el.addEventListener('pointercancel', () => { this.down = null; cancel(); });
    // si la celda se ha redibujado bajo el dedo no cuenta como "salir"
    el.addEventListener('pointerleave', () => { if (el.isConnected) cancel(); });
    el.addEventListener('contextmenu', e => e.preventDefault());
    // el click que sigue a un toque ya tratado se ignora; sin puntero (teclado/accesibilidad) abre el menú
    el.addEventListener('click', () => {
      clearTimeout(this.lpT);
      if (this.lpLong) { this.lpLong = false; return; }
      if (this.tapHandled) { this.tapHandled = false; return; }
      open();
    });
    return el;
  }

  render() {
    const sc = this.scene();
    if (!sc) return this.close();
    const lo = sc.snap.loadout;
    const near = sc.openContainerNear();
    this.lastNear = near ? near.id + ':' + near.items.length : '';
    const el = h('div', { class: 'sheet side' },
      h('div', { class: 'row' },
        h('b', {}, 'Mochila'),
        h('span', { class: 'hint' }, `sin pausa · peso ${totalWeight(lo).toFixed(1)} · vel ${Math.round(speedMult(lo) * 100)}%`),
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn x', onclick: () => this.close() }, '✕'),
      ),
      h('div', { class: 'scroll' },
        h('h3', {}, 'Equipado'),
        h('div', { class: 'slots five' }, this.cell(lo.arma, 'yo', 'Arma'), this.cell(lo.reserva ?? null, 'yo', 'Reserva'), this.cell(lo.torso, 'yo', 'Torso'), this.cell(lo.cabeza, 'yo', 'Cabeza'), this.cell(lo.espalda ?? null, 'yo', 'Espalda')),
        h('h3', {}, h('span', {}, 'Bolsillo seguro'), h('span', {}, `${(lo.bolsillo ? 1 : 0) + (lo.bolsilloExtra?.length ?? 0)}/${Math.max(sc.snap.pocketSlots ?? 1, 1 + (lo.bolsilloExtra?.length ?? 0))}`)),
        h('div', { class: 'slots five' }, ...Array.from({ length: Math.max(sc.snap.pocketSlots ?? 1, 1 + (lo.bolsilloExtra?.length ?? 0)) }, (_, i) => this.cell(i === 0 ? lo.bolsillo : lo.bolsilloExtra?.[i - 1] ?? null, 'yo', 'Bolsillo'))),
        h('h3', {}, h('span', {}, 'Mochila'), h('span', {}, `${lo.mochila.length}/${backpackSlots(lo)}`)),
        h('div', { class: 'grid' }, ...Array.from({ length: Math.max(backpackSlots(lo), lo.mochila.length) }, (_, i) => this.cell(lo.mochila[i] ?? null, 'yo'))),
        near ? h('h3', {}, h('span', {}, 'En el suelo / contenedor'), h('span', {}, String(near.items.length))) : null,
        near ? (near.items.length ? h('div', { class: 'grid' }, ...near.items.map(it => this.cell(it, 'cerca'))) : h('p', { class: 'hint' }, 'Vacío')) : null,
        h('p', { class: 'hint' }, 'Toca un objeto para ver acciones · mantén pulsado para comparar'),
      ),
    );
    // Panel compacto a la derecha, entre el minimapa y la barra de progreso: la zona del joystick
    // (abajo a la izquierda) y el joystick de apuntar con sus botones (abajo a la derecha) quedan libres.
    const keepScroll = this.el?.querySelector('.scroll')?.scrollTop ?? 0;
    if (this.el) {
      // se reutiliza el mismo panel (posición/tamaño estables): solo cambia el contenido
      this.el.replaceChildren(...Array.from(el.childNodes));
    } else {
      const g = sc.hud?.panelArea();
      if (g) Object.assign(el.style, { top: g.top + 'px', height: g.height + 'px', width: g.width + 'px', right: g.right + 'px' });
      // Ningún toque sobre el panel llega al juego (joystick/botones) aunque el navegador los propague.
      for (const ev of ['pointerup', 'pointercancel']) el.addEventListener(ev, () => clearTimeout(this.lpT));
      for (const ev of ['pointerdown', 'pointermove', 'pointerup', 'touchstart', 'touchmove', 'touchend', 'mousedown', 'mouseup']) {
        el.addEventListener(ev, e => e.stopPropagation(), { passive: true });
      }
      this.root.append(el);
      this.el = el;
    }
    const sc2 = this.el.querySelector('.scroll');
    if (sc2) {
      // al redibujar se restaura el scroll: ese evento «scroll» (programático) NO debe cerrar el menú recién abierto
      // (era el fallo: tras hacer scroll, tocar un objeto abría el menú y el propio redibujado lo cerraba al instante)
      sc2.scrollTop = keepScroll; this.menuScroll = sc2.scrollTop;
      sc2.addEventListener('scroll', () => {
        if (this.sel && Math.abs(sc2.scrollTop - this.menuScroll) >= PRUEBA_V2.tapMovePx) { this.sel = null; this.el?.querySelector('.ctx')?.remove(); }
      }, { passive: true });
    }
    this.popup(sc, near?.id ?? null);
  }

  /** ¿El punto (en píxeles CSS de la ventana) cae sobre el panel (o su menú, que está dentro)? */
  contains(x: number, y: number) {
    if (!this.el) return false;
    const r = this.el.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }

  private find(sc: RaidScene): ItemInst | null {
    if (!this.sel) return null;
    if (this.sel.from === 'yo') return sc.findItem(this.sel.uid)?.it ?? null;
    return sc.openContainerNear()?.items.find(i => i.uid === this.sel!.uid) ?? null;
  }

  private popup(sc: RaidScene, nearId: number | null) {
    const it = this.find(sc);
    if (!this.sel || !it || !this.el || !this.anchor) { this.sel = null; return; }
    const uid = it.uid;
    const box = this.sel.mode === 'menu' ? this.menu(sc, it, nearId) : this.compare(sc, it);
    const menu = h('div', { class: 'ctx' + (this.sel.mode === 'compare' ? ' cmp' : '') },
      h('div', { class: 'name', style: `color:${RARITIES[it.rarity].color}` }, itemLabel(it)), box);
    menu.dataset.uid = uid;
    // la comparación se cierra tocándola
    // (con un toque NUEVO: el «click» que llega al levantar el dedo de la pulsación larga no la cierra)
    if (this.sel.mode === 'compare') menu.addEventListener('pointerdown', () => { this.sel = null; window.setTimeout(() => this.render(), 0); });
    this.el.append(menu);
    // junto a la casilla: a la izquierda si cabe, si no a la derecha; siempre dentro del panel
    const P = this.el.getBoundingClientRect();
    const mw = menu.offsetWidth, mh = menu.offsetHeight, a = this.anchor;
    let x = a.x - mw - 4; if (x < 4) x = a.x + a.w + 4; if (x + mw > P.width - 4) x = Math.max(4, P.width - mw - 4);
    let y = a.y + a.h / 2 - mh / 2; y = Math.max(4, Math.min(P.height - mh - 4, y));
    Object.assign(menu.style, { left: x + 'px', top: y + 'px' });
  }

  private menu(sc: RaidScene, it: ItemInst, nearId: number | null) {
    const acts: HTMLElement[] = [];
    const a = (label: string, fn: () => void, cls = '') => acts.push(h('button', { class: 'btn ' + cls, onclick: (e: Event) => { e.stopPropagation(); if (e.isTrusted && performance.now() - this.openedAt < 400) return; fn(); this.sel = null; this.render(); } }, label));
    const uid = it.uid;
    const d = ITEMS[it.def];
    if (this.sel!.from === 'cerca') { if (nearId !== null) a('Coger', () => sc.invTake(nearId, uid)); }
    else {
      const where = sc.findItem(uid)!.where;
      if (d.heal || d.effect) a('Usar', () => sc.invUse(uid));
      if (d.kind === 'granada') a('Lanzar', () => sc.invUse(uid));
      if (where === 'mochila' && d.slot) a('Equipar', () => sc.invEquip(uid));
      if (where === 'reserva') a('Cambiar a esta', () => sc.swapWeapon());
      if (where === 'arma' || where === 'torso' || where === 'cabeza' || where === 'reserva' || where === 'espalda') a(it.free ? 'Quitar (se descarta)' : 'Quitar', () => sc.invUnequip(where));
      if (where === 'mochila' && canPocket(it) && !it.free) a('Mover al bolsillo seguro', () => sc.invToPocket(uid));
      if (where === 'bolsillo' || where === 'bolsilloExtra') a('A la mochila', () => sc.invFromPocket(uid));
      a('Tirar', () => sc.invDrop(uid), 'danger');
    }
    a('✕', () => undefined, 'ghost');
    return h('div', { class: 'acts' }, ...acts);
  }

  /** Estadísticas comparadas con lo equipado en la misma ranura (verde mejor, rojo peor). */
  private compare(sc: RaidScene, it: ItemInst) {
    const lo = sc.snap.loadout;
    const d = def(it);
    const rows: [string, number, number | null, number][] = []; // nombre, valor, equipado, decimales
    const slot = d.slot;
    const eq = slot ? (lo[slot] && lo[slot]!.uid !== it.uid ? lo[slot] : slot === 'arma' && lo.reserva && lo.reserva.uid !== it.uid && lo.arma?.uid === it.uid ? lo.reserva : null) : null;
    if (d.weapon) {
      const w = weaponStats(it), e = eq ? weaponStats(eq) : null;
      rows.push(['Daño', w.dmg, e?.dmg ?? null, 1], ['Golpes/s', w.aps, e?.aps ?? null, 1], ['Daño/s', w.dmg * w.aps, e ? e.dmg * e.aps : null, 1], ['Alcance', w.rangeTiles, e?.rangeTiles ?? null, 1], ['Ruido', -w.noise, e ? -e.noise : null, 0]);
    }
    if (d.armor) rows.push(['Protección %', armorProtection(it) * 100, eq ? armorProtection(eq) * 100 : null, 0]);
    rows.push(['Peso', -itemWeight(it), eq ? -itemWeight(eq) : null, 1]);
    const fmt = (v: number, dec: number, neg: boolean) => (neg ? Math.abs(v) : v).toFixed(dec);
    const tbl = h('table', { class: 'cmp' },
      h('tr', {}, h('th', {}, ''), h('th', {}, 'Este'), h('th', {}, eq ? 'Equipado' : '—')),
      ...rows.map(([n, v, e, dec]) => {
        const neg = n === 'Ruido' || n === 'Peso';
        const cls = e === null || Math.abs(v - e) < 1e-6 ? '' : v > e ? 'up' : 'down';
        return h('tr', {}, h('td', {}, n), h('td', { class: cls }, fmt(v, dec, neg)), h('td', {}, e === null ? '' : fmt(e, dec, neg)));
      }),
    );
    return h('div', {}, tbl, h('div', { class: 'meta', html: itemMeta(it) }));
  }
}
