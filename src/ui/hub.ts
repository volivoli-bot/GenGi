import { attrPanel } from './attributes';
import { gymSlotsLeft, prog, xpToNext } from '../game/levels';
import { ITEMS } from '../data/items';
import { RARITIES, RARITY_ORDER, V1_DROP_RARITIES } from '../data/rarity';
import { equip, locate, Place, toBackpack, toPocket, toStash, ensureFreeGear, settleOverflow, cashChapas } from '../game/hubOps';
import { backpackSlots, canPocket, canSell, gearValue, ItemInst, itemLabel, makeItem, speedMult, totalWeight } from '../game/inventory';
import { bestBuyback, buybackPrice } from '../game/prices';
import { addTrait, costText, craft, craftBlock, deliverCrafts, have, materialCounts, pocketSlots, recipesFor, stashSlots, stationLevel, traitBlock, upgrade, upgradeBlock } from '../game/refugio';
import { abandonMission, acceptMission, buyXpLeft, buyStock, deliverMission, missionDef, missionProgress, raidsToRestock, refreshAll, rep, repProgress, sellTo, stockPrice, vstate } from '../game/vendors';
import { CRAFT_RAIDS, MISSIONS, RECIPES, STATION_IDS, STATIONS, TRAIT_UPGRADE_COST, VENDOR_IDS, VENDORS, VendorId } from '../config/v3';
import type { SaveManager } from '../save/SaveManager';
import { h, itemCell, itemIcon, itemMeta, toast } from './dom';

export interface HubHost {
  save: SaveManager;
  startRaid(): void;
  exportSave(): void;
  importSave(file: File): void;
  debug: boolean;
}

type Tab = 'equipo' | 'refugio' | 'tiendas' | 'ajustes' | 'registro';

export class Hub {
  tab: Tab = 'equipo';
  vendor: VendorId = 'doc';
  sel: string | null = null;
  el: HTMLElement | null = null;
  private scrollTop = 0;
  constructor(private root: HTMLElement, private host: HubHost) {}

  get d() { return this.host.save.data; }

  show() { this.render(); }
  hide() { this.el?.remove(); this.el = null; }

  private commit(r: { ok: boolean; msg?: string }) {
    if (r.msg) toast(r.msg);
    ensureFreeGear(this.d);
    settleOverflow(this.d);
    this.host.save.save();
    this.render();
  }

  render() {
    const d = this.d;
    ensureFreeGear(d);
    cashChapas(d);
    // v3: fabricación terminada → alijo; stock / misiones de los vendedores al día
    const done = deliverCrafts(d);
    refreshAll(d);
    if (done.length) { toast('Fabricado: ' + done.join(', ')); this.host.save.save(); }
    const prevScroll = this.el?.querySelector('.scroll') as HTMLElement | null;
    if (prevScroll) this.scrollTop = prevScroll.scrollTop;
    const tabs: [Tab, string][] = [['equipo', 'Equipo'], ['refugio', 'Refugio'], ['tiendas', 'Tiendas'], ['ajustes', 'Ajustes'], ['registro', 'Registro']];
    const body = this.tab === 'equipo' ? this.equipo() : this.tab === 'refugio' ? this.refugio() : this.tab === 'tiendas' ? this.tiendas() : this.tab === 'ajustes' ? this.ajustes() : this.registro();
    const el = h('div', { class: 'screen hub' },
      h('div', { class: 'hub-head' },
        h('div', { class: 'logo' }, 'GENGI', h('small', {}, 'REFUGIO')),
        h('div', { class: 'nivel' + (prog(d).free > 0 ? ' on' : ''), onclick: () => { this.tab = 'refugio'; this.render(); setTimeout(() => this.root.querySelector('[data-st=pizarra]')?.scrollIntoView({ block: 'start' }), 0); } },
          h('b', {}, `Nv ${prog(d).level}`), prog(d).free > 0 ? h('span', {}, ` +${prog(d).free}`) : null,
          h('i', {}, h('u', { style: `width:${Math.round((prog(d).xp / xpToNext(prog(d).level)) * 100)}%` }))),
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
    const equipped = (['arma', 'torso', 'cabeza', 'espalda'] as Place[]).includes(f.place);
    if (d.slot && !equipped) a(f.place === 'reserva' ? 'Usar como principal' : 'Equipar', () => equip(this.d, it.uid));
    if (f.place !== 'mochila' && f.place !== 'espalda' && !it.free) a('A la mochila', () => toBackpack(this.d, it.uid));
    if (f.place !== 'stash' && !it.free) a('Al alijo', () => toStash(this.d, it.uid));
    if (f.place !== 'bolsillo' && f.place !== 'bolsilloExtra' && canPocket(it) && !it.free) a('Al bolsillo seguro', () => toPocket(this.d, it.uid));
    if (stationLevel(this.d, 'taller') >= 3 && (d.kind === 'arma' || d.kind === 'armadura') && !it.free) {
      const why = traitBlock(this.d, it);
      acts.push(h('button', { class: 'btn', disabled: !!why, title: why ?? '', onclick: () => this.commit(addTrait(this.d, it)) }, why && why !== 'Faltan materiales' ? `Rasgo extra: ${why.toLowerCase()}` : `Rasgo extra (${costText(TRAIT_UPGRADE_COST)})`));
    }
    if (canSell(it)) {
      const b = bestBuyback(it);
      if (b.price > 0) a(`Vender a ${VENDORS.defs[b.vendor].nombre} (${b.price})`, () => sellTo(this.d, b.vendor, it.uid), 'danger');
    }
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
        this.cell(lo.arma, 'Arma'), this.cell(lo.reserva ?? null, 'Reserva'), this.cell(lo.torso, 'Torso'), this.cell(lo.cabeza, 'Cabeza'), this.cell(lo.espalda ?? null, 'Espalda'),
        ...Array.from({ length: Math.max(pocketSlots(d), 1 + (lo.bolsilloExtra?.length ?? 0)) }, (_, i) => this.cell(i === 0 ? lo.bolsillo : lo.bolsilloExtra?.[i - 1] ?? null, 'Bolsillo')),
      ),
      h('p', { class: 'hint' }, `El bolsillo seguro (${pocketSlots(d)} casilla${pocketSlots(d) > 1 ? 's' : ''}, solo objetos pequeños) se conserva aunque mueras. Todo lo demás se pierde, también el arma de reserva. Al equipar un arma nueva, la anterior pasa a la reserva.`),
      h('h3', {}, h('span', {}, 'Mochila'), h('span', {}, `${lo.mochila.length}/${backpackSlots(lo)}`)),
      h('div', { class: 'grid' }, ...Array.from({ length: Math.max(backpackSlots(lo), lo.mochila.length) }, (_, i) => this.cell(lo.mochila[i] ?? null))),
      this.detail(),
      d.overflow.length ? h('div', { class: 'warn' }, `Alijo lleno: ${d.overflow.length} objeto(s) en excedente. No se pierden; vende o mueve algo para hacer sitio.`) : null,
      d.overflow.length ? h('div', { class: 'grid' }, ...d.overflow.map(it => this.cell(it))) : null,
      h('h3', {}, h('span', {}, 'Alijo'), h('span', {}, `${d.stash.length}/${stashSlots(d)}`)),
      h('div', { class: 'grid' }, ...Array.from({ length: stashSlots(d) }, (_, i) => this.cell(d.stash[i] ?? null))),
    );
  }

  // ---------------------------------------------------------------- v3: Refugio (diseno-v3 §2)
  private stars(lv: number, max = 3) {
    return h('span', { class: 'stars' }, ...Array.from({ length: max }, (_, i) => h('img', { src: 'art/v3/refugio/nivel_estrella.svg', alt: '', class: i < lv ? 'on' : '' })));
  }
  private refugio() {
    const d = this.d;
    return h('div', { class: 'refugio', style: "background:linear-gradient(#0009,#0009),url('art/v3/refugio/suelo_refugio.svg') repeat;background-size:auto,64px 64px" },
      h('h3', {}, h('span', {}, 'Materiales'), h('span', {}, 'del alijo')),
      h('div', { class: 'mats' }, ...materialCounts(d).map(m => h('div', { class: 'mat' }, h('img', { src: `art/${ITEMS[m.id].icon}.svg`, alt: '' }), h('b', {}, String(m.n)), h('small', {}, ITEMS[m.id].nombre)))),
      h('p', { class: 'hint' }, 'Los materiales salen de cajas, maleteros de coches y cadáveres. El Generador limita el nivel del resto de estaciones.'),
      ...STATION_IDS.map(sid => {
        const st = STATIONS[sid], lv = stationLevel(d, sid), next = st.levels[lv];
        const why = upgradeBlock(d, sid);
        const recs = recipesFor(sid);
        const queue = d.refugio.crafts.filter(c => RECIPES.find(r => r.id === c.recipe)?.station === sid);
        return h('div', { class: 'station', 'data-st': sid },
          h('div', { class: 'st-head' },
            h('img', { src: st.icon.includes('/') ? `art/${st.icon}.svg` : `art/v3/refugio/${st.icon}.svg`, alt: '' }),
            h('div', { class: 'st-info' }, h('b', {}, st.nombre), this.stars(lv), h('div', { class: 'hint' }, st.levels[lv - 1].desc)),
          ),
          next ? h('div', { class: 'st-next' },
            h('div', {}, h('b', {}, `Nivel ${lv + 1}: `), next.desc),
            h('div', { class: 'cost' }, ...Object.entries(next.cost!).map(([k, n]) => h('span', { class: have(d, k) >= (n ?? 0) ? 'ok' : 'bad' }, k === 'chapas' ? `${n} chapas` : `${n} ${ITEMS[k].nombre.toLowerCase()}`))),
            h('button', { class: 'btn', disabled: !!why, onclick: () => this.commit(upgrade(d, sid)) }, why && why !== 'Faltan materiales' ? why : 'Mejorar'),
          ) : h('div', { class: 'hint' }, 'Nivel máximo.'),
          recs.length ? h('div', { class: 'recipes' },
            ...recs.map(r => {
              const w = craftBlock(d, r);
              return h('div', { class: 'recipe' + (stationLevel(d, sid) < r.level ? ' locked' : '') },
                h('span', {}, h('b', {}, r.nombre), ' ← ', costText(r.cost)),
                h('button', { class: 'btn', disabled: !!w, onclick: () => this.commit(craft(d, r.id)) }, w && w !== 'Faltan materiales' ? w : `Fabricar (${CRAFT_RAIDS} raids)`));
            }),
            queue.length ? h('div', { class: 'hint' }, 'En marcha: ' + queue.map(c => `${RECIPES.find(r => r.id === c.recipe)!.nombre} (listo en ${Math.max(0, c.readyAt - d.stats.raids)} raid${c.readyAt - d.stats.raids === 1 ? '' : 's'})`).join(' · ')) : null,
          ) : null,
          sid === 'pizarra' ? attrPanel(d, () => { this.host.save.save(); this.render(); }) : null,
          sid === 'gimnasio' && lv >= 2 ? h('p', { class: 'hint' }, `Topes subidos: ${lv - 1 - gymSlotsLeft(d, lv)}/${lv - 1}. Elige el atributo en la Pizarra (botón «tope +5»).`) : null,
          sid === 'taller' && lv >= 3 ? h('p', { class: 'hint' }, `Rasgo extra: toca un arma o armadura Reforzado+ en Equipo (${costText(TRAIT_UPGRADE_COST)}).`) : null,
        );
      }),
    );
  }

  // ---------------------------------------------------------------- v3: Tiendas (diseno-v3 §3)
  private tiendas() {
    const d = this.d, v = this.vendor, def = VENDORS.defs[v], s = vstate(d, v), lv = rep(d, v), pr = repProgress(s);
    const sellable = [...d.stash, ...d.overflow, ...d.loadout.mochila].filter(it => canSell(it));
    const active = missionDef(s.active);
    return h('div', { class: 'tiendas' },
      h('div', { class: 'vendors' }, ...VENDOR_IDS.map(id => h('button', { class: 'vend' + (id === v ? ' on' : ''), onclick: () => { this.vendor = id; this.render(); } },
        h('img', { src: `art/v3/${VENDORS.defs[id].retrato}.svg`, alt: '' }), h('span', {}, VENDORS.defs[id].nombre), h('small', {}, `Rep. ${rep(d, id)}`)))),
      h('div', { class: 'vhead' },
        h('div', {}, h('b', {}, def.nombre), h('div', { class: 'hint' }, def.desc + ` · compra lo suyo al ${VENDORS.buyOwn * 100} %, lo demás al ${VENDORS.buyOther * 100} %`)),
        h('div', { class: 'rep' }, `Reputación ${lv}/4`, h('div', { class: 'bar' }, h('i', { style: `width:${pr ? Math.round(pr.cur / pr.need * 100) : 100}%` })),
          h('small', {}, pr ? `${pr.cur}/${pr.need} · -${Math.round((lv - 1) * VENDORS.discountPerLevel * 100)} % precio` : 'Máxima · -15 % precio'),
          pr && pr.mission > 0 ? h('small', { class: 'hint' }, `Nivel ${lv + 1}: cumple ${pr.mission === 1 ? 'una misión' : pr.mission + ' misiones'} de ${def.nombre}`) : null,
          h('small', { class: 'hint' }, `Comprando: +${buyXpLeft(d, v)} rep. más hasta la renovación · vender no da reputación`)),
      ),
      h('h3', {}, h('span', {}, 'Misiones'), h('span', {}, 'elige una')),
      h('div', { class: 'missions' }, ...s.offers.map(id => {
        const m = missionDef(id)!; const on = s.active === id; const p = on ? missionProgress(d, m) : null;
        return h('div', { class: 'mission' + (on ? ' on' : '') },
          h('div', { class: 'mt' }, h('b', {}, m.texto), h('small', {}, `+${m.chapas} chapas · +${m.xp} rep.` + (m.item ? ` · ${ITEMS[m.item[0]].nombre}` + (m.item[2] > 1 ? ` ×${m.item[2]}` : '') : '') + (p ? ` · ${p[0]}/${p[1]}` : ''))),
          on ? h('div', { class: 'row' },
            m.kind.t === 'entregar' ? h('button', { class: 'btn', disabled: !p || p[0] < p[1], onclick: () => this.commit(deliverMission(d, v)) }, 'Entregar') : h('span', { class: 'tag-on' }, 'ACTIVA'),
            h('button', { class: 'btn ghost', onclick: () => { abandonMission(d, v); this.commit({ ok: true }); } }, '✕'))
            : h('button', { class: 'btn', disabled: !!active, onclick: () => this.commit(acceptMission(d, v, id)) }, 'Aceptar'),
        );
      }), s.offers.length ? null : h('p', { class: 'hint' }, 'Sin misiones ahora. Vuelve tras la próxima renovación.')),
      h('h3', {}, h('span', {}, 'Comprar'), h('span', {}, `stock nuevo en ${raidsToRestock(d, v)} raid${raidsToRestock(d, v) === 1 ? '' : 's'}`)),
      h('div', { class: 'shop' }, ...s.stock.map((e, i) => {
        const it = makeItem(e.id, e.rarity, e.qty, e.traits);
        const price = stockPrice(d, v, e);
        return h('div', { class: 'item' + (e.left <= 0 ? ' gone' : '') },
          itemCell(it),
          h('div', { class: 'info' }, h('b', { style: ITEMS[e.id].rolls ? `color:${RARITIES[e.rarity].color}` : '' }, itemLabel(it)), h('span', { html: itemMeta(it).split('<br>').slice(0, 2).join(' · ') }), h('small', {}, e.left > 0 ? ` · quedan ${e.left}` : ' · agotado')),
          h('button', { class: 'btn', disabled: d.chapas < price || e.left <= 0, onclick: () => this.commit(buyStock(d, v, i)) }, h('img', { src: 'art/chapa.svg', style: 'width:18px' }), String(price)),
        );
      })),
      h('h3', {}, h('span', {}, 'Vender'), h('span', {}, 'alijo y mochila')),
      sellable.length ? h('div', { class: 'shop' }, ...sellable.map(it => {
        const p = buybackPrice(it, v);
        return h('div', { class: 'item' },
          itemCell(it),
          h('div', { class: 'info' }, h('b', {}, itemLabel(it)), h('small', {}, p > 0 ? (bestBuyback(it).price > p ? `Otro vendedor paga ${bestBuyback(it).price}` : 'Mejor precio') : 'No te da nada')),
          h('button', { class: 'btn danger', disabled: p <= 0, onclick: () => this.commit(sellTo(d, v, it.uid)) }, '+' + p),
        );
      })) : h('p', { class: 'hint' }, 'Nada que vender. El bate y la ropa gratis no se venden.'),
      h('p', { class: 'hint' }, `Hay ${MISSIONS.filter(m => m.vendor === v).length} misiones posibles de ${def.nombre}; cada ${VENDORS.restockRaids} raids cambian las ofertas y el stock.`),
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
      h('h3', {}, 'Sigilo'),
      h('label', { class: 'set' }, 'Conos de visión de los enemigos en el suelo'),
      seg([['si', 'Mostrar'], ['no', 'Ocultar (experto)']], s.conosEnemigos === false ? 'no' : 'si', v => s.conosEnemigos = v === 'si'),
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
