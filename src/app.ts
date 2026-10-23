import * as V31CFG from './config/v31';
import * as V42CFG from './config/v42';
import * as V32CFG from './config/v32';
import { DMG_LOG, rollDamage, meanMult } from './game/damage';
import { genTrapero, valesFor, traperoPrice } from './raid/trapero';
import { lootMap, rollContainer, rollEliteDrops, rollItem, rollLair, setLootMap } from './game/loot';
import * as V3CFG from './config/v3';
import { basePrice, buyPrice } from './game/prices';
import { canSell, freeItem } from './game/inventory';
import { ENEMIES } from './data/enemies';
import { weaponStats } from './game/inventory';
import Phaser from 'phaser';
import { ITEMS } from './data/items';
import { EnemyType } from './data/enemies';
import { Rarity } from './data/rarity';
import { addToList, emptyLoadout, gearValue, itemLabel, loadMagazine, makeItem } from './game/inventory';
import { cashChapas, ensureFreeGear, equip, toBackpack } from './game/hubOps';
import { TILE } from './config/constants';
import { pocketSlots, stashSlots, stationLevel, deliverCrafts } from './game/refugio';
import { emptyTrack, evalMissions, refreshAll } from './game/vendors';
import { newRaidSnapshot, RaidHost, RaidScene } from './raid/RaidScene';
import { LEGACY_SAMPLE } from './save/migrations';
import { SaveManager } from './save/SaveManager';
import type { ExitState, RaidLogEntry } from './save/types';
import { chooseExits, EXIT_NAMES, helipadExit } from './raid/extraction';
import * as V4CFG from './config/v4';
import { checkLayout } from './raid/layoutCheck';
import { bagOf, backpackSlots, itemWeight, loadNoiseTiles, quickSlots, speedMult, totalWeight, useTimeMult } from './game/inventory';
import { generateMap, snowStripFor } from './raid/map';
import { seeded } from './game/loot';
import { econCheck } from './game/econCheck';
import * as V3OPS from './game/vendors';
import * as REFOPS from './game/refugio';
import * as HUBOPS from './game/hubOps';
import { sellPrice } from './game/inventory';
import { toast } from './ui/dom';
import { Hub } from './ui/hub';
import { pauseOverlay, summaryOverlay } from './ui/overlays';
import { RaidInventory } from './ui/raidInventory';
import { AttrSheet } from './ui/attributes';
import { bankXp, deathPenalty, extractRaidXp, keepRaidXpOnDeath, prog, xpToNext } from './game/levels';
import * as LVCFG from './config/levels';
import * as LVOPS from './game/levels';

export class App implements RaidHost {
  save = new SaveManager();
  root = document.getElementById('ui')!;
  hub: Hub;
  inv: RaidInventory;
  attrs: AttrSheet;
  pauseEl: HTMLElement | null = null;
  debug: boolean;

  constructor(public game: Phaser.Game) {
    const q = new URLSearchParams(location.search);
    if (q.get('debug') === '1') localStorage.setItem('gengi.debug', '1');
    if (q.get('debug') === '0') localStorage.removeItem('gengi.debug');
    this.debug = localStorage.getItem('gengi.debug') === '1';
    this.hub = new Hub(this.root, {
      save: this.save, debug: this.debug,
      startRaid: () => this.startRaid(),
      exportSave: () => this.exportSave(),
      importSave: (f) => this.importSave(f),
    });
    this.inv = new RaidInventory(this.root, () => this.raidScene());
    this.attrs = new AttrSheet(this.root, () => this.save.data, () => this.save.save(), () => this.raidScene()?.hud?.panelArea());
    if (this.save.lastError) toast('Guardado ilegible: se apartó una copia y se empezó de cero');
  }

  raidScene(): RaidScene | null {
    const s = this.game.scene.getScene('Raid') as RaidScene | null;
    return s && s.scene.isActive() ? s : null;
  }

  boot() {
    if (this.save.data.activeRaid) this.launchRaid(false); // siempre se retoma desde el último instante guardado
    else this.showHub();
    if (this.debug) this.installDebug();
  }

  showHub() {
    this.game.scene.stop('Raid');
    this.game.scene.stop('RaidUI');
    if (!this.game.scene.isActive('HubBg')) this.game.scene.start('HubBg');
    this.hub.show();
  }

  /** QA: semilla de la próxima incursión (null = al azar). */
  nextSeed: number | null = null;
  startRaid() {
    const d = this.save.data;
    if (d.activeRaid) return;
    ensureFreeGear(d);
    loadMagazine(d.loadout); // se entra con el cargador lleno a partir de la munición de la mochila
    const valueIn = gearValue(d.loadout);
    const seed = this.nextSeed ?? (Math.random() * 2 ** 31) >>> 0;
    this.nextSeed = null;
    // El equipo pasa a la raid: sale del guardado del refugio en la MISMA escritura.
    // v4b: Mesa de Mapas: solo se entra en un mapa permitido por nivel
    const sel = V4CFG.mapDef(d.mapSel ?? V4CFG.DEFAULT_MAP);
    if (!V4CFG.mapAllowed(sel, d.prog?.level ?? 1)) { toast(V4CFG.mapGate(sel, d.prog?.level ?? 1) === 'sin_construir' ? 'Ese mapa aún está en construcción' : `Requiere nivel ${sel.nivelMin}`); d.mapSel = V4CFG.DEFAULT_MAP; this.hub.render(); return; }
    d.activeRaid = newRaidSnapshot(seed, d.loadout, valueIn);
    d.activeRaid.mapDefId = sel.id;
    // v3: estaciones que afectan a la raid
    d.activeRaid.pocketSlots = pocketSlots(d);
    d.activeRaid.radio = stationLevel(d, 'radio');
    d.activeRaid.track = emptyTrack();
    d.loadout = emptyLoadout();
    this.save.save();
    this.launchRaid(true);
  }

  private launchRaid(fresh: boolean) {
    this.hub.hide();
    this.game.scene.stop('HubBg');
    this.game.scene.start('Raid', { snap: this.save.data.activeRaid!, settings: this.save.data.settings, fresh, host: this, debug: this.debug });
  }

  // ---------- RaidHost ----------
  persist() { this.save.save(); }

  onPauseChange(paused: boolean, reason: string) {
    this.pauseEl?.remove(); this.pauseEl = null;
    if (paused) {
      this.inv.close(); this.attrs.close();
      this.pauseEl = pauseOverlay(this.root, reason,
        () => this.raidScene()?.setPaused(false, 'usuario'),
        () => { const s = this.raidScene(); if (s) { s.setPaused(false, 'usuario'); s.damagePlayer(9999, 'Abandono', false); } });
    }
  }

  openInventory() { const s = this.raidScene(); if (s && !s.paused && !s.ended) { this.attrs.close(); this.inv.open(); } }
  saveData() { return this.save.data; }
  /** v4.0: «+3» → panel de atributos (no pausa). */
  openAttributes() { const s = this.raidScene(); if (!s || s.paused || s.ended) return; this.inv.close(); this.attrs.toggle(); }
  closeInventory() { this.inv.close(); }
  isInventoryOpen() { return this.inv.isOpen; }
  overUi(x: number, y: number) { return this.inv.contains(x, y) || this.attrs.contains(x, y); }
  refreshInventory() { this.inv.refresh(); }
  seenExits(mapId: string) { return [...(this.save.data.seenExits[mapId] ?? [])]; }
  /** v3.1: el Trapero acepta chapas del refugio (se descuentan y se guarda en el acto). */
  bankChapas() { return this.save.data.chapas; }
  spendBankChapas(n: number) { const d = this.save.data; if (d.chapas < n) return false; d.chapas -= Math.ceil(n); this.save.save(); return true; }
  markExitSeen(mapId: string, loc: number) {
    const l = (this.save.data.seenExits[mapId] ??= []);
    if (!l.includes(loc)) { l.push(loc); this.save.save(); }
  }

  endRaid(result: 'extraido' | 'muerto', detail: { cause?: string; exit?: ExitState }) {
    const d = this.save.data;
    const snap = d.activeRaid;
    if (!snap) return;
    const lo = snap.loadout;
    // v3.1: lo saqueado deja de ser «de esta incursión» (el Trapero ya no lo compraría) y los vales se pierden con el snapshot
    for (const it of [lo.arma, lo.reserva, lo.torso, lo.cabeza, lo.espalda, lo.bolsillo, ...(lo.bolsilloExtra ?? []), ...lo.mochila]) if (it) delete it.raid;
    const kept: string[] = [];
    let valueOut = 0;
    if (result === 'extraido') {
      valueOut = gearValue(lo);
      // la mochila pasa al alijo; si no cabe, al excedente (nunca se pierde nada)
      for (const it of lo.mochila) { const left = addToList(d.stash, it, stashSlots(d)); if (left) d.overflow.push(left); }
      if (lo.bolsillo?.def === 'chapas') { d.chapas += lo.bolsillo.qty; lo.bolsillo = null; }
      const extra = (lo.bolsilloExtra ?? []).filter(it => { if (it.def === 'chapas') { d.chapas += it.qty; return false; } return true; });
      d.loadout = { arma: lo.arma, torso: lo.torso, cabeza: lo.cabeza, bolsillo: lo.bolsillo, reserva: lo.reserva ?? null, mochila: [], espalda: lo.espalda ?? null, bolsilloExtra: extra };
      cashChapas(d);
      d.stats.extracted++;
    } else {
      // muerte: se pierde todo salvo el bolsillo seguro (también el arma de reserva)
      d.loadout = { ...emptyLoadout(), bolsillo: lo.bolsillo, bolsilloExtra: [...(lo.bolsilloExtra ?? [])] };
      for (const it of [lo.bolsillo, ...(lo.bolsilloExtra ?? [])]) if (it) kept.push(itemLabel(it));
      valueOut = gearValue(d.loadout);
      d.stats.deaths++;
    }
    // v4.0 §2: experiencia. Solo se asegura al extraer (+ extraer, ×mapa, ×1,5 helipuerto); al morir se pierde y, según XP_DEATH, un 25 % del progreso.
    const xpNews: string[] = [];
    const lv0 = prog(d).level;
    if (result === 'extraido') {
      const heli = detail.exit?.type === 'helipuerto';
      // v4b: el mapa por su MapDef.id (snap.mapId es el saveId); el ×1,5 del helipuerto no toca la experiencia del jefe
      const mult = V4CFG.mapOfSnap(snap).xpMult;
      const raw = extractRaidXp(snap.xp ?? 0, snap.xpBy?.boss ?? 0, snap.elapsed / 60, mult, heli);
      bankXp(d, raw);
      xpNews.push(`+${Math.round(raw)} de experiencia${heli ? ' (helipuerto ×1,5)' : ''}`);
      if (heli) {
        // caja de suministros Militar al alijo
        const got: string[] = [];
        for (let i = 0; i < LVCFG.HELI_SUPPLY.items; i++) { const it = rollItem(Math.random, 0, LVCFG.HELI_SUPPLY.rarity, true); got.push(itemLabel(it)); const left = addToList(d.stash, it, stashSlots(d)); if (left) d.overflow.push(left); }
        xpNews.push('Suministros del helicóptero: ' + got.join(', '));
      }
    } else if (keepRaidXpOnDeath()) bankXp(d, snap.xp ?? 0);
    else {
      const lost = deathPenalty(d);
      xpNews.push(`Experiencia de la incursión perdida (${Math.round(snap.xp ?? 0)})` + (lost ? ` y −${lost} de tu progreso de nivel` : ''));
    }
    d.stats.raids++;
    // v3: misiones de los vendedores, fabricación terminada y renovación de stock
    const exitLoc = detail.exit ? (this.raidScene()?.map.exitLocNames[detail.exit.loc] ?? null) : null;
    const news = evalMissions(d, snap, result === 'extraido', exitLoc, lo);
    const crafted = deliverCrafts(d);
    if (crafted.length) news.push('Fabricado: ' + crafted.join(', '));
    news.unshift(...xpNews);
    if (prog(d).level > lv0) news.unshift(`¡Nivel ${prog(d).level}! +${(prog(d).level - lv0) * LVCFG.ATTR_RULES.pointsPerLevel} puntos de atributo (toca «+» en la incursión o la Pizarra del refugio)`);
    refreshAll(d);
    const entry: RaidLogEntry = {
      id: snap.id, startedAt: snap.startedAt, endedAt: new Date().toISOString(),
      minute: Math.round((snap.elapsed / 60) * 100) / 100, result,
      killedBy: result === 'muerto' ? detail.cause ?? 'Desconocido' : null,
      valueIn: snap.valueIn, valueOut, kills: snap.kills,
      exitType: detail.exit ? EXIT_NAMES[detail.exit.type] : null,
    };
    d.raidLog.push(entry);
    if (d.raidLog.length > 500) d.raidLog.splice(0, d.raidLog.length - 500);
    d.activeRaid = null;
    ensureFreeGear(d);
    this.save.save(); // una sola escritura atómica: resultado + inventario + registro
    this.inv.close(); this.attrs.close();
    this.pauseEl?.remove(); this.pauseEl = null;
    const el = summaryOverlay(this.root, entry, kept, news, () => { el.remove(); this.showHub(); });
  }

  // ---------- Exportar / importar ----------
  exportSave() {
    const data = this.save.exportString();
    const name = `gengi-partida-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`;
    const blob = new Blob([data], { type: 'application/json' });
    const file = new File([blob], name, { type: 'application/json' });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.canShare?.({ files: [file] }) && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
      navigator.share({ files: [file], title: 'Partida de GenGi' }).catch(() => this.download(blob, name));
    } else this.download(blob, name);
  }

  private download(blob: Blob, name: string) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    toast('Partida exportada');
  }

  async importSave(f: File) {
    try {
      const txt = await f.text();
      if (!confirm('Importar sustituirá tu partida actual. ¿Seguir?')) return;
      this.save.importString(txt);
      toast('Partida importada');
      if (this.save.data.activeRaid) this.launchRaid(false); else this.hub.render();
    } catch (e) { toast('No se pudo importar: ' + (e as Error).message, 3500); }
  }

  // ---------- Ganchos de depuración para QA (?debug=1) ----------
  installDebug() {
    const app = this;
    // QA de versiones anteriores: ?noelite desactiva los élites (5 % por aparición) para que sus medidas no varíen
    if (new URLSearchParams(location.search).has('noelite')) V31CFG.ELITE.chance = 0;
    const api = {
      help: () => Object.keys(api).join(', '),
      state: () => JSON.parse(JSON.stringify(app.save.data)),
      start: () => app.startRaid(),
      /** Refugio: equipa el primer objeto del alijo con ese id / pasa una pila del alijo a la mochila. */
      equipFromStash: (id: string) => { const it = app.save.data.stash.find(i => i.def === id); const r = it ? equip(app.save.data, it.uid) : null; app.save.save(); app.hub.render(); return r; },
      stashToBackpack: (id: string) => { const it = app.save.data.stash.find(i => i.def === id); const r = it ? toBackpack(app.save.data, it.uid) : null; app.save.save(); app.hub.render(); return r; },
      exportStr: () => app.save.exportString(),
      importStr: (str: string) => { app.save.importString(str); return JSON.parse(JSON.stringify(app.save.data)); },
      /** Comprueba en n semillas que siempre hay una salida a pie o generador. */
      /**
       * v4 §4: comprueba las 3 variantes nevadas en n semillas (y con la variación de estrés): salidas alcanzables, la guarida
       * no tapa ninguna salida, nada dentro de paredes / fuera del mapa, y distancias inicio→nieve / inicio→helipuerto.
       */
      layoutCheck: (n = 40, stress = false) => {
        const out: Record<string, { raids: number; spawnsChecked: number; exitFail: number; lairBlock: number; lairMinTiles: number; bad: number; badSample: string[]; unreachableContainers: number; snow: number[]; heli: number[]; trapero: number }> = {};
        for (let k = 0; k < 3; k++) {
          const acc = { raids: 0, spawnsChecked: 0, exitFail: 0, lairBlock: 0, lairMinTiles: Infinity, bad: 0, badSample: [] as string[], unreachableContainers: 0, snow: [] as number[], heli: [] as number[], trapero: 0 };
          for (let i = 0; i < n; i++) {
            const seed = (i * 7919 + 17 + k * 104729) >>> 0;
            const m = generateMap(seed, { snowStrip: k, ...(stress ? { variation: V4CFG.VARIATION_STRESS } : {}) });
            const active = chooseExits(seeded(seed ^ 0x5bd1e995), m); const heli = helipadExit(m); if (heli) active.push(heli);
            // todas las salidas posibles del mapa (no solo las activas) + el helipuerto
            const all = m.exitLocs.map((p, loc) => ({ loc, type: active.find(e => e.loc === loc)?.type ?? 'pie', x: p.x, y: p.y, gen: 0, unlocked: true, flareAt: null } as ExitState));
            acc.raids++;
            for (const sp of m.spawns) {
              const tr = genTrapero(seeded((seed ^ 0x74726170) >>> 0), m.walls, sp, active.map(e => ({ x: e.x, y: e.y })));
              const extra = tr ? [{ what: 'trapero', x: tr.x, y: tr.y, pad: 12 }] : [];
              if (tr) acc.trapero++;
              const r = checkLayout(m, all, sp, extra);
              acc.spawnsChecked++;
              if (r.exits.some(e => !e.reachable)) acc.exitFail++;
              if (r.exitsAvoidLair === false) acc.lairBlock++;
              if (r.lairToExitTiles !== null) acc.lairMinTiles = Math.min(acc.lairMinTiles, r.lairToExitTiles);
              acc.bad += r.bad.length; for (const b of r.bad) if (acc.badSample.length < 5) acc.badSample.push(`${b.what} ${(b.x / TILE).toFixed(1)},${(b.y / TILE).toFixed(1)} ${b.why}`);
              acc.unreachableContainers += r.unreachableContainers;
              if (r.spawnToSnowTiles !== null) acc.snow.push(r.spawnToSnowTiles);
              if (r.spawnToHelipadTiles !== null) acc.heli.push(r.spawnToHelipadTiles);
            }
          }
          out[V4CFG.ARRABAL.strips[k].id] = acc;
        }
        const stats = (a: number[]) => a.length ? { min: +Math.min(...a).toFixed(1), avg: +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1), max: +Math.max(...a).toFixed(1) } : null;
        return Object.fromEntries(Object.entries(out).map(([id, a]) => [id, { ...a, snow: stats(a.snow), heli: stats(a.heli) }]));
      },
      /** v4: config y cálculos de mochilas / carga (QA). */
      /** QA v4: la próxima incursión usa esta semilla / una semilla cuya franja nevada sea k (0 norte, 1 oeste, 2 este). */
      seedNext: (seed: number | null) => { app.nextSeed = seed; },
      snowSeed: (k: number, from = 1) => { for (let i = from; i < from + 5000; i++) if (snowStripFor(i) === k) return i; return null; },
      /** QA v4: guardado de la v3.2 (versión 4) sin mochila, con salidas vistas del mapa v2 y una raid activa del mapa viejo. */
      loadV4old: (withRaid = false) => { localStorage.setItem('gengi.save', JSON.stringify({ ...JSON.parse(JSON.stringify(app.save.data)), saveVersion: 4, seenExits: { 'ciudad-v2': [0, 2] }, loadout: { ...emptyLoadout(), arma: null, espalda: null, mochila: [makeItem('vendaje', 'comun', 2)] }, activeRaid: withRaid ? { ...newRaidSnapshot(4242, { ...emptyLoadout(), espalda: null, mochila: [makeItem('vendaje', 'comun', 1)] }, 0), mapId: 'ciudad-v2' } : null })); location.reload(); },
      /** v4.0 niveles: configuración, operaciones puras y atajos sobre el guardado. */
      v4b: () => ({ app, save: app.save, cfg: V4CFG, setLevel: (n: number) => { prog(app.save.data).level = n; app.save.save(); if (!app.raidScene()) app.hub.render(); } }),
      lv: () => ({ cfg: LVCFG, ops: LVOPS, prog: () => JSON.parse(JSON.stringify(prog(app.save.data))), bank: (n: number) => { const up = bankXp(app.save.data, n); app.save.save(); if (!app.raidScene() && !app.save.data.activeRaid) app.hub.render(); return up; },
        setAttr: (a: string, n: number) => { prog(app.save.data).attrs[a as LVCFG.AttrId] = n; app.save.save(); }, setFree: (n: number) => { prog(app.save.data).free = n; app.save.save(); },
        setStation: (sid: string, n: number) => { (app.save.data.refugio.levels as Record<string, number>)[sid] = n; app.save.save(); if (!app.raidScene() && !app.save.data.activeRaid) app.hub.render(); },
        data: () => app.save.data, openAttrs: () => app.openAttributes(), attrsOpen: () => app.attrs.isOpen, xpToNext }),
      v4: () => ({ genStock: (v: string, lv: number) => V3OPS.genStock(app.save.data, v as never, lv), rollItem, seededRng: seeded, recipes: V3CFG.RECIPES, basePrice, buyPrice, canSell, freeItem, makeItem, cfg: V4CFG, bagOf, backpackSlots, totalWeight, speedMult, loadNoiseTiles, quickSlots, useTimeMult, itemWeight, mapDef: V4CFG.mapDef }),
      exitCheck: (n = 200) => { let bad = 0; const seen: Record<string, number> = {}; for (let i = 0; i < n; i++) { const m = generateMap(i * 7919 + 1); const ex = chooseExits(seeded(i + 99), m); ex.forEach(e => (seen[e.type] = (seen[e.type] ?? 0) + 1)); if (ex.length !== 2 || !ex.some(e => e.type === 'pie' || e.type === 'generador')) bad++; } return { bad, seen }; },
      raid: () => app.raidScene(),
      /** v3.1: configuración mutable (QA) y diagnóstico. */
      cfg31: V31CFG,
      cfg42: V42CFG,
      cfg32: V32CFG,
      dmgLog: DMG_LOG,
      /** QA v3.1: n tiradas de daño (base, lado). */
      rollDmg: (base: number, side: 'player' | 'enemy', n = 10000) => { const out: { dmg: number; crit: boolean }[] = []; for (let i = 0; i < n; i++) out.push(rollDamage(base, side)); DMG_LOG[side].length = 0; return { out, mean: meanMult(side) }; },
      /** v4b: reparto de rarezas del equipo en un mapa (cajas normales, de élite y la guarida). */
      lootDist: (mapId: string, n = 3000, seed = 5) => {
        const prev = lootMap(); setLootMap(V4CFG.mapDef(mapId)); const rng = seeded(seed); const out: Record<string, Record<string, number>> = { caja: {}, elite: {}, lair: {} };
        const add = (k: string, its: { rarity: string; def: string }[]) => { for (const it of its) if (ITEMS[it.def]?.rolls) out[k][it.rarity] = (out[k][it.rarity] ?? 0) + 1; };
        for (let i = 0; i < n; i++) { add('caja', rollContainer(rng, 'cerrada', 0.2)); add('elite', rollEliteDrops(rng)); if (i < n / 5) add('lair', rollLair(rng)); }
        setLootMap(prev); return out;
      },
      eliteDrops: (n = 1000, seed = 7) => { const rng = seeded(seed); const out: { a: string; ar: string; b: string; br: string }[] = []; for (let i = 0; i < n; i++) { const [x, y] = rollEliteDrops(rng); out.push({ a: x.def, ar: x.rarity, b: y.def, br: y.rarity }); } return out; },
      traperoRate: (n = 1000) => { let c = 0; for (let i = 0; i < n; i++) if (genTrapero(seeded(1000 + i), [], { x: 0, y: 0 }, [])) c++; return c / n; },
      valesFor: (id: string, qty = 1) => valesFor(makeItem(id, 'comun', qty)),
      traperoPrice: (id: string, rarity: string) => traperoPrice(makeItem(id, rarity as never, 1)),
      defs: () => ({ enemies: JSON.parse(JSON.stringify(ENEMIES)), weapons: Object.fromEntries(Object.entries(ITEMS).filter(([, d]) => d.weapon).map(([id]) => [id, weaponStats(makeItem(id, 'comun', 1))])), items: JSON.parse(JSON.stringify(ITEMS)) }),
      /** Misiones completadas con un vendedor (reputación 3-4). */
      missions: (v: string, n: number) => { (app.save.data.vendors as Record<string, { missionsDone: number }>)[v].missionsDone = n; refreshAll(app.save.data); app.save.save(); app.hub.render(); },
      v31: () => { const s = app.raidScene(); if (!s) return null; return { ...s.v31s, elites: s.snap.elites ?? 0, eliteAlive: s.enemies.eliteAlive(), ghostFrames: s.enemies.ghostFrames, linger: s.vision?.lingerCount() ?? 0, lingerStats: s.vision?.lingerStats, viewFacing: s.viewFacing, facing: s.facing, groundArrows: s.snap.arrows, trapero: s.snap.trapero ?? null }; },
      minute: (m: number) => { const s = app.raidScene(); if (s) s.snap.elapsed = m * 60; return s?.snap.elapsed; },
      give: (id: string, rarity: Rarity = 'comun', qty = 1) => {
        if (!ITEMS[id]) return 'objetos: ' + Object.keys(ITEMS).join(', ');
        const s = app.raidScene();
        if (s) return s.debugGive(id, rarity, qty);
        const left = addToList(app.save.data.stash, makeItem(id, rarity, qty), stashSlots(app.save.data));
        app.save.save(); app.hub.render(); return !left;
      },
      chapas: (n: number) => { app.save.data.chapas += n; app.save.save(); app.hub.render(); },
      god: (on = true) => { const s = app.raidScene(); if (s) s.god = on; },
      hurt: (n: number) => app.raidScene()?.damagePlayer(n, 'Depuración'),
      kill: () => app.raidScene()?.damagePlayer(99999, 'Depuración', false),
      spawn: (type: EnemyType = 'errante', n = 1) => { const s = app.raidScene(); if (!s) return; for (let i = 0; i < n; i++) s.spawnAt(type, s.player.x + (Math.random() - 0.5) * TILE * 8, s.player.y - TILE * 5, undefined, false); },
      /** v3.1: fuerza un élite (y devuelve el enemigo). */
      elite: (type: EnemyType = 'errante', dx = 0, dy = -5) => { const s = app.raidScene(); if (!s) return null; return s.spawnAt(type, s.player.x + dx * TILE, s.player.y + dy * TILE, undefined, true); },
      exits: () => app.raidScene()?.snap.exits,
      tpExit: (i = 0) => { const s = app.raidScene(); const e = s?.snap.exits[i]; if (s && e) s.player.setPosition(e.x, e.y); },
      tpBox: () => { const s = app.raidScene(); if (!s) return; const c = s.snap.containers.filter(c => c.items.length).sort((a, b) => Math.hypot(a.x - s.player.x, a.y - s.player.y) - Math.hypot(b.x - s.player.x, b.y - s.player.y))[0]; if (c) s.player.setPosition(c.x + TILE, c.y); },
      clearEnemies: () => { const s = app.raidScene(); if (s) { s.quietKills = true; for (const e of [...s.enemies.list]) s.enemies.kill(e); s.quietKills = false; } },
      hide: () => app.raidScene()?.background(),
      pause: () => app.raidScene()?.setPaused(true, 'usuario'),
      resume: () => app.raidScene()?.setPaused(false, 'usuario'),
      inventory: () => app.openInventory(),
      // ---- v2 ----
      vision: (on = true) => app.raidScene()?.setVision(on),
      /** Joystick de apuntar simulado: aim(x, y) con x,y ∈ [-1,1]; aim(null) suelta. */
      aim: (x: number | null, y = 0) => app.raidScene()?.aim?.debugSet(x === null ? null : { x, y }),
      stats: () => { const s = app.raidScene(); return s ? { ...s.stats, swapT: s.swapT, facing: s.facing, vel: { x: s.vel.x, y: s.vel.y }, seen: s.seenExitList(), loot: s.lootState(), stains: s.fx.stainCount, dmgNums: s.fx.shown.slice(-20), fired: s.proj.fired.slice(-20), hitStop: s.hitStopActive() } : null; },
      saveData: () => JSON.parse(JSON.stringify(app.save.data)),
      seenExits: () => JSON.parse(JSON.stringify(app.save.data.seenExits)),
      doors: () => app.raidScene()?.doorList(),
      swap: () => app.raidScene()?.swapWeapon(),
      equip: (uid: string) => app.raidScene()?.invEquip(uid),
      face: (deg: number) => { const s = app.raidScene(); if (s) s.facing = deg * Math.PI / 180; },
      tp: (tx: number, ty: number) => { const s = app.raidScene(); if (s) { s.player.setPosition(tx * TILE, ty * TILE); s.vel.set(0, 0); } },
      // ---- sigilo ----
      /** Todos los enemigos pasan a alerta (como antes del sigilo; útil para pruebas de combate). */
      alertAll: () => { const s = app.raidScene(); if (s) for (const e of s.enemies.list) s.enemies.becomeAlert(e, false); },
      stealth: () => { const s = app.raidScene(); return s ? { tier: s.moveTier, noise: s.noiseTiles, exec: s.execTarget ? s.enemies.list.indexOf(s.execTarget) : -1, ...s.enemies.stealthStats, enemies: s.enemies.list.map(e => ({ type: e.def.type, state: e.state, meter: +e.meter.toFixed(2), x: Math.round(e.x), y: Math.round(e.y), facing: e.facing, hp: e.hp })) } : null; },
      execute: () => app.raidScene()?.execute(),
      move: (x: number, y: number) => { const s = app.raidScene(); if (s) s.joy!.vec.set(x, y); },
      loadLegacy: () => { localStorage.setItem('gengi.save', JSON.stringify(LEGACY_SAMPLE)); location.reload(); },
      reset: () => { app.save.reset(); location.reload(); },
      // ---- v3 ----
      /** Sube estaciones del refugio sin coste: station('alijo', 3). */
      station: (id: string, lv: number) => { (app.save.data.refugio.levels as Record<string, number>)[id] = lv; app.save.save(); app.hub.render(); return app.save.data.refugio.levels; },
      /** XP de reputación de un vendedor. */
      repXp: (v: string, xp: number) => { (app.save.data.vendors as Record<string, { xp: number }>)[v].xp = xp; refreshAll(app.save.data); app.save.save(); app.hub.render(); },
      raids: (n: number) => { app.save.data.stats.raids = n; app.save.save(); app.hub.render(); },
      tab: (t: string, v?: string) => { (app.hub as unknown as { tab: string }).tab = t; if (v) (app.hub as unknown as { vendor: string }).vendor = v; app.hub.render(); },
      /** Muta un enemigo cercano / todos los vivos. */
      mutate: (m: string, all = false) => { const s = app.raidScene(); if (!s) return; const l = all ? s.enemies.list : s.enemies.list.slice(-1); for (const e of l) s.enemies.mutate(e, m as never); },
      v3: () => { const s = app.raidScene(); return s ? s.v3Stats() : null; },
      /** Prueba exhaustiva anti-arbitraje (§6). */
      econ: (n = 60) => econCheck(app.save.data, n),
      /** Operaciones del refugio/vendedores sobre la partida: op('upgrade','alijo'), op('buyStock','doc',0)… */
      op: (name: string, ...args: unknown[]) => {
        const all = { ...V3OPS, ...REFOPS, ...HUBOPS } as unknown as Record<string, (...a: unknown[]) => unknown>;
        const f = all[name]; if (!f) return 'ops: ' + Object.keys(all).join(', ');
        const r = f(app.save.data, ...args); app.save.save(); app.hub.render(); return JSON.parse(JSON.stringify(r ?? null));
      },
      sellPrice: (uid: string) => { const it = [...app.save.data.stash].find(i => i.uid === uid); return it ? sellPrice(it) : null; },
      /** Simula el fin de N raids en el refugio (entregas de fabricación, renovación de stock). */
      endRaids: (n = 1) => { const d = app.save.data; const out: string[] = []; for (let i = 0; i < n; i++) { d.stats.raids++; out.push(...deliverCrafts(d)); refreshAll(d); } app.save.save(); app.hub.render(); return out; },
      /** Enjambre de n bichos a (dx, dy) casillas del jugador. */
      swarm: (dx = 10, dy = 0, n?: number) => { const s = app.raidScene(); if (!s) return; return s.spawnSwarm(s.player.x + dx * TILE, s.player.y + dy * TILE, n).length; },
      /** Reptante con su alcantarilla a (dx, dy) casillas del jugador. */
      reptante: (dx = 3, dy = 0) => { const s = app.raidScene(); if (!s) return; const e = s.spawnAt('reptante', s.player.x + dx * TILE, s.player.y + dy * TILE); return s.enemies.list.indexOf(e); },
      grenade: () => app.raidScene()?.throwGrenade(),
      useFx: (id: string) => app.raidScene()?.useEffect(id),
      /** Carga un guardado v2 de ejemplo (sin refugio ni vendedores) y recarga. */
      loadV2: () => { localStorage.setItem('gengi.save', JSON.stringify({ saveVersion: 2, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', chapas: 345, stash: [{ uid: 'v2a', def: 'pistola', rarity: 'militar', qty: 1, traits: [] }, { uid: 'v2b', def: 'vendaje', rarity: 'comun', qty: 4 }], overflow: [], loadout: { arma: { uid: 'v2c', def: 'machete', rarity: 'reforzado', qty: 1 }, torso: null, cabeza: null, mochila: [{ uid: 'v2d', def: 'municion', rarity: 'comun', qty: 20 }], bolsillo: { uid: 'v2e', def: 'botiquin', rarity: 'comun', qty: 1 }, reserva: null }, raidLog: [{ id: 'r1', startedAt: '2026-01-01T00:00:00.000Z', endedAt: '2026-01-01T00:10:00.000Z', minute: 10, result: 'extraido', killedBy: null, valueIn: 10, valueOut: 99, kills: 4, exitType: 'A pie' }], activeRaid: null, seenExits: { m1: [0, 2] }, settings: undefined, stats: { raids: 7, extracted: 5, deaths: 2 } })); location.reload(); },
    };
    (window as unknown as { gengi: typeof api }).gengi = api;
    console.info('GenGi debug: window.gengi →', api.help());
  }
}
