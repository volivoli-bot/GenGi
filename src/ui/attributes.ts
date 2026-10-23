/** v4.0 §2: panel de atributos (durante la raid NO pausa, como el inventario; en el refugio lo abre la Pizarra). */
import { ATTR_IDS, ATTR_RULES, ATTRS, AttrId } from '../config/levels';
import { attrCap, assignPoint, freeResetsLeft, fullReset, gymRaise, gymSlotsLeft, prog, respecCost, respecPoint, xpToNext } from '../game/levels';
import { stationLevel } from '../game/refugio';
import type { SaveData } from '../save/types';
import { h, toast } from './dom';

const ABS = new Set(['weight', 'peekTiles']);
const LBL: Record<string, string> = { speed: 'vel.', loot: 'botín/saqueo', dmgTaken: 'daño', dot: 'estados', noise: 'ruido', suspicion: '«?»', rarityUp: 'rareza', melee: 'cuerpo a cuerpo', weight: 'peso', aim: 'apuntado', crit: 'crítico', reload: 'recarga', time: 'tiempo de cura', heal: 'curación', peekTiles: 'casillas', chapas: 'chapas' };

function effectNow(a: AttrId, pts: number) {
  const m = ATTRS[a].max;
  return Object.entries(m).map(([k, v]) => {
    const x = (pts / ATTR_RULES.refPoints) * v;
    return ABS.has(k) ? `${LBL[k]} +${(Math.round(x * 10) / 10).toString().replace('.', ',')}` : `${LBL[k]} ${(Math.round(x * 1000) / 10).toString().replace('.', ',')} %`;
  }).join(' · ');
}

/** Contenido del panel. `onChange` tras cada cambio (para guardar y redibujar). `inRaid`: sin Gimnasio ni cambios de la Pizarra. */
export function attrPanel(d: SaveData, onChange: () => void, inRaid = false): HTMLElement {
  const p = prog(d), piz = stationLevel(d, 'pizarra'), gym = stationLevel(d, 'gimnasio');
  const gymLeft = inRaid ? 0 : gymSlotsLeft(d, gym);
  const rc = respecCost(d, piz), resets = inRaid ? 0 : freeResetsLeft(d, piz);
  const act = (why: string | null) => { if (why) toast(why); onChange(); };
  return h('div', { class: 'attrs', 'data-free': String(p.free) },
    h('div', { class: 'attr-head' },
      h('b', {}, `Nivel ${p.level}`),
      h('span', { class: 'hint' }, ` · ${Math.floor(p.xp)}/${xpToNext(p.level)} exp`),
      h('span', { class: 'attr-free' + (p.free > 0 ? ' on' : '') }, `${p.free} punto${p.free === 1 ? '' : 's'} libre${p.free === 1 ? '' : 's'}`)),
    h('p', { class: 'hint' }, `Quitar un punto: cuesta ${rc.cost} de los asignados y devuelve 1${rc.cheap ? ' (Pizarra: tarifa reducida disponible)' : ''}.` + (gymLeft ? ` Gimnasio: puedes subir ${gymLeft} tope${gymLeft > 1 ? 's' : ''} en +${ATTR_RULES.gymPerLevel}.` : '')),
    ...ATTR_IDS.map(a => {
      const pts = p.attrs[a], cap = attrCap(d, a), A = ATTRS[a];
      return h('div', { class: 'attr', 'data-attr': a },
        h('img', { src: `art/${A.icon}.svg`, alt: '' }),
        h('div', { class: 'attr-info' },
          h('div', {}, h('b', {}, A.nombre), h('span', { class: 'hint' }, ` ${pts}/${cap}`)),
          h('div', { class: 'attr-bar' }, h('i', { style: `width:${Math.min(100, (pts / cap) * 100)}%` })),
          h('div', { class: 'hint' }, pts ? effectNow(a, pts) : A.texto)),
        h('div', { class: 'attr-btns' },
          h('button', { class: 'btn x', 'data-act': 'menos', disabled: pts < rc.cost, onclick: () => act(respecPoint(d, a, piz)) }, '−'),
          h('button', { class: 'btn x', 'data-act': 'mas', disabled: p.free <= 0 || pts >= cap, onclick: () => act(assignPoint(d, a)) }, '+'),
          gymLeft ? h('button', { class: 'btn x', 'data-act': 'tope', onclick: () => act(gymRaise(d, a, gym)) }, `tope +${ATTR_RULES.gymPerLevel}`) : null));
    }),
    resets ? h('button', { class: 'btn', 'data-act': 'reset', onclick: () => { if (confirm('¿Devolver todos los puntos asignados? (cambio completo gratis)')) act(fullReset(d, piz)); } }, `Cambio completo gratis (${resets})`) : null,
  );
}

/** Hoja lateral durante la raid (no pausa; mismos huecos que el inventario). */
export class AttrSheet {
  el: HTMLElement | null = null;
  constructor(private root: HTMLElement, private data: () => SaveData, private save: () => void, private area: () => { top: number; height: number; width: number; right: number } | undefined) {}
  get isOpen() { return !!this.el; }
  toggle() { if (this.el) this.close(); else this.open(); }
  open() {
    const el = h('div', { class: 'sheet side attr-sheet' });
    const g = this.area();
    if (g) Object.assign(el.style, { top: g.top + 'px', height: g.height + 'px', width: g.width + 'px', right: g.right + 'px' });
    for (const ev of ['pointerdown', 'pointermove', 'pointerup', 'touchstart', 'touchmove', 'touchend', 'mousedown', 'mouseup']) el.addEventListener(ev, e => e.stopPropagation(), { passive: true });
    this.el = el; this.root.append(el); this.render();
  }
  render() {
    if (!this.el) return;
    const keep = this.el.querySelector('.scroll')?.scrollTop ?? 0;
    this.el.replaceChildren(
      h('div', { class: 'row' }, h('b', {}, 'Atributos'), h('button', { class: 'btn x', onclick: () => this.close() }, '✕')),
      h('div', { class: 'scroll' }, attrPanel(this.data(), () => { this.save(); this.render(); }, true)));
    const sc = this.el.querySelector('.scroll'); if (sc) sc.scrollTop = keep;
  }
  close() { this.el?.remove(); this.el = null; }
  contains(x: number, y: number) { const r = this.el?.getBoundingClientRect(); return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; }
}
