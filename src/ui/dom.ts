import { ABILITIES, ITEMS, TRAITS } from '../data/items';
import { RARITIES } from '../data/rarity';
import { armorProtection, canSell, def, ItemInst, itemValue, itemWeight, sellPrice, weaponStats } from '../game/inventory';

type Attrs = Record<string, string | number | boolean | ((e: Event) => void) | undefined>;

export function h(tag: string, attrs: Attrs = {}, ...kids: (Node | string | null | undefined | false)[]): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (typeof v === 'function') el.addEventListener(k.replace(/^on/, '').toLowerCase(), v as EventListener);
    else if (k === 'class') el.className = String(v);
    else if (k === 'html') el.innerHTML = String(v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of kids) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

const PLACEHOLDER: Record<string, string> = { ropa: '👕', municion: '🔸' };

export function itemIcon(id: string): HTMLElement {
  const d = ITEMS[id];
  if (d.icon) return h('img', { src: `art/${d.icon}.svg`, alt: d.nombre, draggable: 'false' });
  return h('span', { class: 'ph' }, PLACEHOLDER[id] ?? '?');
}

/** Casilla de objeto. La rareza se marca por color Y por letra + puntos (daltonismo). */
export function itemCell(it: ItemInst | null, opts: { label?: string; selected?: boolean; onClick?: () => void } = {}) {
  if (!it) return h('div', { class: 'cell empty', onclick: opts.onClick }, opts.label ?? '');
  const r = RARITIES[it.rarity];
  const d = def(it);
  const cell = h('div', { class: 'cell' + (opts.selected ? ' sel' : '') + (opts.label ? ' haslbl' : ''), style: `border-color:${r.color}`, onclick: opts.onClick, title: d.nombre },
    itemIcon(it.def),
    d.rolls ? h('span', { class: 'r', style: `background:${r.color}` }, r.letra) : null,
    d.rolls ? h('span', { class: 'pips', style: `color:${r.color}` }, ...Array.from({ length: r.tier }, () => h('i'))) : null,
    it.qty > 1 ? h('span', { class: 'q' }, String(it.qty)) : null,
    it.free ? h('span', { class: 'tag' }, 'GRATIS') : null,
    opts.label ? h('span', { class: 'lbl' }, opts.label) : null,
  );
  return cell;
}

export function itemMeta(it: ItemInst): string {
  const d = def(it);
  const r = RARITIES[it.rarity];
  const parts: string[] = [];
  if (d.rolls) parts.push(`${r.nombre} (×${r.mult})`);
  if (d.weapon) {
    const w = weaponStats(it);
    parts.push(`Daño ${w.dmg.toFixed(1)} · ${w.aps.toFixed(1)} golpes/s · alcance ${w.rangeTiles.toFixed(1)} · ruido ${w.noise}`);
    if (w.mag) parts.push(`Cargador ${it.mag ?? 0}/${w.mag}`);
    parts.push(`Habilidad: ${ABILITIES[w.ability].nombre} (${ABILITIES[w.ability].cooldown} s)`);
  }
  if (d.armor) {
    parts.push(`Protección ${Math.round(armorProtection(it) * 100)} %`);
    if (d.armor.ability) parts.push(`Habilidad: ${ABILITIES[d.armor.ability].nombre} (${ABILITIES[d.armor.ability].cooldown} s)`);
  }
  if (it.traits?.length) parts.push('Rasgos: ' + it.traits.map(t => TRAITS[t].nombre).join(', '));
  parts.push(d.desc);
  parts.push(`Peso ${itemWeight(it).toFixed(1)} · Valor ${itemValue(it)} · ${canSell(it) ? `Venta ${sellPrice(it)} chapas` : 'Invendible'}`);
  if (d.small && d.kind !== 'armadura') parts.push('Cabe en el bolsillo seguro');
  return parts.join('<br>');
}

let toastT: number | undefined;
export function toast(msg: string, ms = 2200) {
  const root = document.getElementById('ui')!;
  root.querySelector('.toast')?.remove();
  const t = h('div', { class: 'toast' }, msg);
  root.append(t);
  clearTimeout(toastT);
  toastT = window.setTimeout(() => t.remove(), ms);
}
