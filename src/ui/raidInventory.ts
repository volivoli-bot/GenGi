import { BACKPACK_SLOTS } from '../config/constants';
import { ITEMS } from '../data/items';
import { RARITIES } from '../data/rarity';
import { canPocket, ItemInst, itemLabel, speedMult, totalWeight } from '../game/inventory';
import type { RaidScene } from '../raid/RaidScene';
import { h, itemCell, itemMeta } from './dom';

/** Inventario durante la raid: NO pausa el juego (los enemigos siguen). Bloqueado con el juego en pausa. */
export class RaidInventory {
  el: HTMLElement | null = null;
  sel: { uid: string; from: 'yo' | 'cerca' } | null = null;
  private timer: number | undefined;
  private lastNear = '';
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
    this.el?.remove(); this.el = null;
  }

  refresh() { if (this.el) this.render(); }

  render() {
    const sc = this.scene();
    if (!sc) return this.close();
    const lo = sc.snap.loadout;
    const near = sc.openContainerNear();
    this.lastNear = near ? near.id + ':' + near.items.length : '';
    const cell = (it: ItemInst | null, from: 'yo' | 'cerca', label?: string) =>
      itemCell(it, { label, selected: !!it && this.sel?.uid === it.uid, onClick: it ? () => { this.sel = this.sel?.uid === it.uid ? null : { uid: it.uid, from }; this.render(); } : undefined });
    const el = h('div', { class: 'sheet' },
      h('div', { class: 'row' },
        h('b', {}, 'Mochila'),
        h('span', { class: 'hint' }, ` · el juego NO se pausa · peso ${totalWeight(lo).toFixed(1)} (vel ${Math.round(speedMult(lo) * 100)} %)`),
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn', style: 'padding:6px 14px', onclick: () => this.close() }, '✕'),
      ),
      h('div', { class: 'scroll' },
        h('h3', {}, 'Equipado'),
        h('div', { class: 'slots' }, cell(lo.arma, 'yo', 'Arma'), cell(lo.torso, 'yo', 'Torso'), cell(lo.cabeza, 'yo', 'Cabeza'), cell(lo.bolsillo, 'yo', 'Bolsillo')),
        h('h3', {}, h('span', {}, 'Mochila'), h('span', {}, `${lo.mochila.length}/${BACKPACK_SLOTS}`)),
        h('div', { class: 'grid' }, ...Array.from({ length: BACKPACK_SLOTS }, (_, i) => cell(lo.mochila[i] ?? null, 'yo'))),
        near ? h('h3', {}, h('span', {}, 'En el suelo / contenedor'), h('span', {}, String(near.items.length))) : null,
        near ? (near.items.length ? h('div', { class: 'grid' }, ...near.items.map(it => cell(it, 'cerca'))) : h('p', { class: 'hint' }, 'Vacío')) : null,
        this.detail(sc, near?.id ?? null),
      ),
    );
    this.el?.remove();
    this.root.append(el);
    this.el = el;
  }

  private detail(sc: RaidScene, nearId: number | null) {
    if (!this.sel) return null;
    const lo = sc.snap.loadout;
    let it: ItemInst | null = null;
    if (this.sel.from === 'yo') it = sc.findItem(this.sel.uid)?.it ?? null;
    else it = sc.openContainerNear()?.items.find(i => i.uid === this.sel!.uid) ?? null;
    if (!it) { this.sel = null; return null; }
    const acts: HTMLElement[] = [];
    const a = (label: string, fn: () => void) => acts.push(h('button', { class: 'btn', onclick: () => { fn(); this.sel = null; this.render(); } }, label));
    const uid = it.uid;
    if (this.sel.from === 'cerca') { if (nearId !== null) a('Coger', () => sc.invTake(nearId, uid)); }
    else {
      const where = sc.findItem(uid)!.where;
      const d = ITEMS[it.def];
      if (d.heal) a('Usar', () => sc.invUse(uid));
      if (where === 'mochila' && d.slot) a('Equipar', () => sc.invEquip(uid));
      if (where === 'arma' || where === 'torso' || where === 'cabeza') a(it.free ? 'Quitar (se descarta)' : 'Quitar', () => sc.invUnequip(where));
      if (where === 'mochila' && canPocket(it) && !it.free) a('Al bolsillo', () => sc.invToPocket(uid));
      if (where === 'bolsillo') a('A la mochila', () => sc.invFromPocket());
      a('Tirar', () => sc.invDrop(uid));
    }
    void lo;
    return h('div', { class: 'detail' },
      h('div', { class: 'name', style: `color:${RARITIES[it.rarity].color}` }, itemLabel(it)),
      h('div', { class: 'meta', html: itemMeta(it) }),
      h('div', { class: 'acts' }, ...acts),
    );
  }
}
