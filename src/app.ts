import Phaser from 'phaser';
import { ITEMS } from './data/items';
import { EnemyType } from './data/enemies';
import { Rarity } from './data/rarity';
import { addToList, emptyLoadout, gearValue, itemLabel, loadMagazine, makeItem } from './game/inventory';
import { cashChapas, ensureFreeGear, equip, toBackpack } from './game/hubOps';
import { STASH_SLOTS, TILE } from './config/constants';
import { newRaidSnapshot, RaidHost, RaidScene } from './raid/RaidScene';
import { LEGACY_SAMPLE } from './save/migrations';
import { SaveManager } from './save/SaveManager';
import type { ExitState, RaidLogEntry } from './save/types';
import { chooseExits, EXIT_NAMES } from './raid/extraction';
import { generateMap } from './raid/map';
import { seeded } from './game/loot';
import { toast } from './ui/dom';
import { Hub } from './ui/hub';
import { pauseOverlay, summaryOverlay } from './ui/overlays';
import { RaidInventory } from './ui/raidInventory';

export class App implements RaidHost {
  save = new SaveManager();
  root = document.getElementById('ui')!;
  hub: Hub;
  inv: RaidInventory;
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

  startRaid() {
    const d = this.save.data;
    if (d.activeRaid) return;
    ensureFreeGear(d);
    loadMagazine(d.loadout); // se entra con el cargador lleno a partir de la munición de la mochila
    const valueIn = gearValue(d.loadout);
    const seed = (Math.random() * 2 ** 31) >>> 0;
    // El equipo pasa a la raid: sale del guardado del refugio en la MISMA escritura.
    d.activeRaid = newRaidSnapshot(seed, d.loadout, valueIn);
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
      this.inv.close();
      this.pauseEl = pauseOverlay(this.root, reason,
        () => this.raidScene()?.setPaused(false, 'usuario'),
        () => { const s = this.raidScene(); if (s) { s.setPaused(false, 'usuario'); s.damagePlayer(9999, 'Abandono', false); } });
    }
  }

  openInventory() { const s = this.raidScene(); if (s && !s.paused && !s.ended) this.inv.open(); }
  closeInventory() { this.inv.close(); }
  isInventoryOpen() { return this.inv.isOpen; }
  overUi(x: number, y: number) { return this.inv.contains(x, y); }
  refreshInventory() { this.inv.refresh(); }

  endRaid(result: 'extraido' | 'muerto', detail: { cause?: string; exit?: ExitState }) {
    const d = this.save.data;
    const snap = d.activeRaid;
    if (!snap) return;
    const lo = snap.loadout;
    const kept: string[] = [];
    let valueOut = 0;
    if (result === 'extraido') {
      valueOut = gearValue(lo);
      // la mochila pasa al alijo; si no cabe, al excedente (nunca se pierde nada)
      for (const it of lo.mochila) { const left = addToList(d.stash, it, STASH_SLOTS); if (left) d.overflow.push(left); }
      if (lo.bolsillo?.def === 'chapas') { d.chapas += lo.bolsillo.qty; lo.bolsillo = null; }
      d.loadout = { arma: lo.arma, torso: lo.torso, cabeza: lo.cabeza, bolsillo: lo.bolsillo, mochila: [] };
      cashChapas(d);
      d.stats.extracted++;
    } else {
      // muerte: se pierde todo salvo el bolsillo seguro
      d.loadout = { ...emptyLoadout(), bolsillo: lo.bolsillo };
      if (lo.bolsillo) { kept.push(itemLabel(lo.bolsillo)); valueOut = gearValue(d.loadout); }
      d.stats.deaths++;
    }
    d.stats.raids++;
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
    this.inv.close();
    this.pauseEl?.remove(); this.pauseEl = null;
    const el = summaryOverlay(this.root, entry, kept, () => { el.remove(); this.showHub(); });
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
      exitCheck: (n = 200) => { let bad = 0; const seen: Record<string, number> = {}; for (let i = 0; i < n; i++) { const m = generateMap(i * 7919 + 1); const ex = chooseExits(seeded(i + 99), m); ex.forEach(e => (seen[e.type] = (seen[e.type] ?? 0) + 1)); if (ex.length !== 2 || !ex.some(e => e.type === 'pie' || e.type === 'generador')) bad++; } return { bad, seen }; },
      raid: () => app.raidScene(),
      minute: (m: number) => { const s = app.raidScene(); if (s) s.snap.elapsed = m * 60; return s?.snap.elapsed; },
      give: (id: string, rarity: Rarity = 'comun', qty = 1) => {
        if (!ITEMS[id]) return 'objetos: ' + Object.keys(ITEMS).join(', ');
        const s = app.raidScene();
        if (s) return s.debugGive(id, rarity, qty);
        const left = addToList(app.save.data.stash, makeItem(id, rarity, qty), STASH_SLOTS);
        app.save.save(); app.hub.render(); return !left;
      },
      chapas: (n: number) => { app.save.data.chapas += n; app.save.save(); app.hub.render(); },
      god: (on = true) => { const s = app.raidScene(); if (s) s.god = on; },
      hurt: (n: number) => app.raidScene()?.damagePlayer(n, 'Depuración'),
      kill: () => app.raidScene()?.damagePlayer(99999, 'Depuración', false),
      spawn: (type: EnemyType = 'errante', n = 1) => { const s = app.raidScene(); if (!s) return; for (let i = 0; i < n; i++) s.spawnAt(type, s.player.x + (Math.random() - 0.5) * TILE * 8, s.player.y - TILE * 5); },
      exits: () => app.raidScene()?.snap.exits,
      tpExit: (i = 0) => { const s = app.raidScene(); const e = s?.snap.exits[i]; if (s && e) s.player.setPosition(e.x, e.y); },
      tpBox: () => { const s = app.raidScene(); if (!s) return; const c = s.snap.containers.filter(c => c.items.length).sort((a, b) => Math.hypot(a.x - s.player.x, a.y - s.player.y) - Math.hypot(b.x - s.player.x, b.y - s.player.y))[0]; if (c) s.player.setPosition(c.x + TILE, c.y); },
      clearEnemies: () => { const s = app.raidScene(); if (s) for (const e of [...s.enemies.list]) s.enemies.kill(e); },
      hide: () => app.raidScene()?.background(),
      pause: () => app.raidScene()?.setPaused(true, 'usuario'),
      resume: () => app.raidScene()?.setPaused(false, 'usuario'),
      inventory: () => app.openInventory(),
      loadLegacy: () => { localStorage.setItem('gengi.save', JSON.stringify(LEGACY_SAMPLE)); location.reload(); },
      reset: () => { app.save.reset(); location.reload(); },
    };
    (window as unknown as { gengi: typeof api }).gengi = api;
    console.info('GenGi debug: window.gengi →', api.help());
  }
}
