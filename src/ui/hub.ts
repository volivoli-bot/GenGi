import { BACKPACK_SLOTS, STASH_SLOTS } from '../config/constants';
import { ITEMS } from '../data/items';
import { RARITIES, RARITY_ORDER, V1_DROP_RARITIES } from '../data/rarity';
import { buy, equip, locate, Place, sell, SHOP, toBackpack, toPocket, toStash, ensureFreeGear, settleOverflow, cashChapas } from '../game/hubOps';
import { canPocket, canSell, gearValue, itemLabel, sellPrice, speedMult, totalWeight, makeItem } from '../game/inventory';
import type { SaveManager } from '../save/SaveManager';
import { h, itemCell, itemIcon, itemMeta, toast } from './dom';

export interface HubHost {
  save: SaveManager;
  startRaid(): void;
  exportSave(): void;
  importSave(file: File): void;
  debug: boolean;
}

type Tab = 'equipo' | 'comerciante' | 'ajustes' | 'registro';

export class Hub {
  tab: Tab = 'equipo';
  sel: string | null = null;
  el: HTMLElement | null = null;
  private scrollTop = 0;
  constructor(private root: HTMLElement, private host: HubHost) {}

  get d() { return this.host.save.data; }

  show() { this.render(); }
  hide() { this.el?.remove(); this.el = null; }

  private commit(r: { ok: boolean; msg?: string }) {
    if (!r.ok && r.msg) toast(r.msg);
    ensureFreeGear(this.d);
    settleOverflow(this.d);
    this.host.save.save();
    this.render();
  }

  render() {
    const d = this.d;
    ensureFreeGear(d);
    cashChapas(d);
    const prevScroll = this.el?.querySelector('.scroll') as HTMLElement | null;
    if (prevScroll) this.scrollTop = prevScroll.scrollTop;
    const tabs: [Tab, string][] = [['equipo', 'Equipo'], ['comerciante', 'Comerciante'], ['ajustes', 'Ajustes'], ['registro', 'Registro']];
    const body = this.tab === 'equipo' ? this.equipo() : this.tab === 'comerciante' ? this.shop() : this.tab === 'ajustes' ? this.ajustes() : this.registro();
    const el = h('div', { class: 'screen hub' },
      h('div', { class: 'hub-head' },
        h('div', { class: 'logo' }, 'GENGI', h('small', {}, 'REFUGIO')),
        h('div', { class: 'chapas' }, h('img', { src: 'art/chapa.svg', alt: '' }), String(d.chapas)),
      ),
      h('div', { class: 'tabs' }, ...tabs.map(([t, n]) => h('button', { class: this.tab === t ? 'on' : '', onclick: () => { this.tab = t; this.sel = null; this.scrollTop = 0; this.render(); } }, n))),
      h('div', { class: 'scroll' }, body),
      h('div', { class: 'footer' },
        h('button', { class: 'btn main', onclick: () => this.host.startRaid() }, '▶ EMPEZAR RAID'),
      ),
    );
    this.el?.remove();
    this.root.append(el);
    this.el = el;
    const sc = el.querySelector('.scroll') as HTMLElement;
    sc.scrollTop = this.scrollTop;
  }

  private pick(uid: string) { this.sel = this.sel === uid ? null : uid; this.render(); }

  private cell(it: Parameters<typeof itemCell>[0], label?: string) {
    return itemCell(it, { label, selected: !!it && it.uid === this.sel, onClick: it ? () => this.pick(it.uid) : undefined });
  }

  private detail() {
    if (!this.sel) return null;
    const f = locate(this.d, this.sel);
    if (!f) { this.sel = null; return null; }
    const it = f.it;
    const d = ITEMS[it.def];
    const acts: HTMLElement[] = [];
    const a = (label: string, fn: () => { ok: boolean; msg?: string }, cls = '') => acts.push(h('button', { class: 'btn ' + cls, onclick: () => { const r = fn(); if (r.ok) this.sel = null; this.commit(r); } }, label));
    const equipped = (['arma', 'torso', 'cabeza'] as Place[]).includes(f.place);
    if (d.slot && !equipped) a('Equipar', () => equip(this.d, it.uid));
    if (f.place !== 'mochila' && !it.free) a('A la mochila', () => toBackpack(this.d, it.uid));
    if (f.place !== 'stash' && !it.free) a('Al alijo', () => toStash(this.d, it.uid));
    if (f.place !== 'bolsillo' && canPocket(it) && !it.free) a('Al bolsillo seguro', () => toPocket(this.d, it.uid));
    if (canSell(it)) a(`Vender (${sellPrice(it)})`, () => sell(this.d, it.uid), 'danger');
    return h('div', { class: 'detail' },
      h('div', { class: 'name', style: `color:${RARITIES[it.rarity].color}` }, itemLabel(it) + (it.free ? ' · GRATIS' : '')),
      h('div', { class: 'meta', html: itemMeta(it) + (it.free ? '<br>Equipo gratis: invendible y se repone siempre.' : '') }),
      h('div', { class: 'acts' }, ...acts),
    );
  }

  private equipo() {
    const d = this.d, lo = d.loadout;
    const w = totalWeight(lo), sm = speedMult(lo);
    return h('div', {},
      h('h3', {}, h('span', {}, 'Equipo de raid'), h('span', {}, `Valor ${gearValue(lo)} · peso ${w.toFixed(1)} · vel ${Math.round(sm * 100)} %`)),
      h('div', { class: 'slots' },
        this.cell(lo.arma, 'Arma'), this.cell(lo.torso, 'Torso'), this.cell(lo.cabeza, 'Cabeza'), this.cell(lo.bolsillo, 'Bolsillo'),
      ),
      h('p', { class: 'hint' }, 'El bolsillo seguro (1 casilla, solo objetos pequeños) se conserva aunque mueras. Todo lo demás se pierde.'),
      h('h3', {}, h('span', {}, 'Mochila'), h('span', {}, `${lo.mochila.length}/${BACKPACK_SLOTS}`)),
      h('div', { class: 'grid' }, ...Array.from({ length: BACKPACK_SLOTS }, (_, i) => this.cell(lo.mochila[i] ?? null))),
      this.detail(),
      d.overflow.length ? h('div', { class: 'warn' }, `Alijo lleno: ${d.overflow.length} objeto(s) en excedente. No se pierden; vende o mueve algo para hacer sitio.`) : null,
      d.overflow.length ? h('div', { class: 'grid' }, ...d.overflow.map(it => this.cell(it))) : null,
      h('h3', {}, h('span', {}, 'Alijo'), h('span', {}, `${d.stash.length}/${STASH_SLOTS}`)),
      h('div', { class: 'grid' }, ...Array.from({ length: STASH_SLOTS }, (_, i) => this.cell(d.stash[i] ?? null))),
    );
  }

  private shop() {
    const d = this.d;
    return h('div', {},
      h('p', { class: 'hint' }, 'Lo comprado va al alijo. Para vender, toca un objeto en Equipo. El bate y la ropa gratis no se pueden vender.'),
      h('div', { class: 'shop' }, ...SHOP.map(e => {
        const it = makeItem(e.id, 'comun', e.qty);
        return h('div', { class: 'item' },
          itemCell(it),
          h('div', { class: 'info' }, h('b', {}, itemLabel(it)), ITEMS[e.id].desc),
          h('button', { class: 'btn', disabled: d.chapas < e.price, onclick: () => this.commit(buy(d, e)) }, h('img', { src: 'art/chapa.svg', style: 'width:18px' }), String(e.price)),
        );
      })),
    );
  }

  private ajustes() {
    const s = this.d.settings;
    const seg = <T extends string>(opts: [T, string][], cur: T, set: (v: T) => void) =>
      h('div', { class: 'seg' }, ...opts.map(([v, n]) => h('button', { class: v === cur ? 'on' : '', onclick: () => { set(v); this.host.save.save(); this.render(); } }, n)));
    const range = h('input', { type: 'range', min: 0, max: 90, step: 5, value: s.curarUmbral }) as HTMLInputElement;
    const rl = h('span', {}, s.curarUmbral ? `${s.curarUmbral} %` : 'nunca');
    range.addEventListener('input', () => { s.curarUmbral = Number(range.value); rl.textContent = s.curarUmbral ? `${s.curarUmbral} %` : 'nunca'; });
    range.addEventListener('change', () => this.host.save.save());
    const file = h('input', { type: 'file', accept: '.json,application/json', style: 'display:none' }) as HTMLInputElement;
    file.addEventListener('change', () => { if (file.files?.[0]) this.host.importSave(file.files[0]); file.value = ''; });
    return h('div', {},
      h('h3', {}, 'Comportamiento automático'),
      h('label', { class: 'set' }, 'Atacar primero a'),
      seg([['cercano', 'Más cercano'], ['debil', 'Más débil'], ['peligroso', 'Más peligroso']], s.prioridad, v => s.prioridad = v),
      h('label', { class: 'set' }, 'Rareza mínima de equipo que recoges'),
      seg(RARITY_ORDER.map(r => [r, `${RARITIES[r].letra} · ${RARITIES[r].nombre}`] as [typeof r, string]), s.rarezaMin, v => s.rarezaMin = v),
      h('p', { class: 'hint' }, `En la v1 solo caen ${V1_DROP_RARITIES.map(r => RARITIES[r].nombre).join(', ')}. Consumibles, munición, bengalas y chapas se recogen siempre.`),
      h('label', { class: 'set' }, 'Curarse solo por debajo de ', rl),
      range,
      h('label', { class: 'set' }, 'Botón de consumible rápido'),
      seg([['vendaje', 'Vendaje'], ['botiquin', 'Botiquín']], s.rapido, v => s.rapido = v),
      h('h3', {}, 'Partida'),
      h('p', { class: 'hint' }, 'Safari borra los datos de webs no instaladas tras 7 días sin abrirlas: instala GenGi en la pantalla de inicio y exporta la partida de vez en cuando.'),
      h('div', { class: 'row wrap' },
        h('button', { class: 'btn', onclick: () => this.host.exportSave() }, '⬇ Exportar partida'),
        h('button', { class: 'btn', onclick: () => file.click() }, '⬆ Importar partida'),
        file,
      ),
      h('p', { class: 'hint' }, `Formato de guardado v${this.d.saveVersion} · almacenamiento: ${this.host.save.storage.name}${this.host.save.lastError ? ' · ⚠ ' + this.host.save.lastError : ''}`),
      this.host.debug ? h('div', { class: 'row wrap' },
        h('button', { class: 'btn danger', onclick: () => { if (confirm('¿Borrar toda la partida?')) { this.host.save.reset(); this.render(); } } }, 'Borrar partida (debug)'),
        h('button', { class: 'btn', onclick: () => { this.d.chapas += 500; this.host.save.save(); this.render(); } }, '+500 chapas (debug)'),
      ) : null,
    );
  }

  private registro() {
    const log = [...this.d.raidLog].reverse();
    const st = this.d.stats;
    return h('div', {},
      h('div', { class: 'stats' },
        h('div', {}, 'Raids', h('b', {}, String(st.raids))),
        h('div', {}, 'Supervivencia', h('b', {}, st.raids ? `${Math.round((st.extracted / st.raids) * 100)} %` : '—')),
      ),
      h('p', { class: 'hint' }, 'El registro se incluye en la exportación de la partida.'),
      log.length ? h('table', { class: 'log' },
        h('tr', {}, h('th', {}, 'Min'), h('th', {}, 'Resultado'), h('th', {}, 'Causa'), h('th', {}, 'Entra'), h('th', {}, 'Sale')),
        ...log.slice(0, 50).map(r => h('tr', {},
          h('td', {}, r.minute.toFixed(1)),
          h('td', { class: r.result === 'extraido' ? 'ok' : 'bad' }, r.result === 'extraido' ? 'Extraído' : 'Muerto'),
          h('td', {}, r.killedBy ?? (r.exitType ?? '')),
          h('td', {}, String(r.valueIn)), h('td', {}, String(r.valueOut)),
        )),
      ) : h('p', { class: 'hint' }, 'Aún no hay raids.'),
    );
  }
}
export { itemIcon };
