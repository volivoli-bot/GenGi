import Phaser from 'phaser';
import './ui/styles.css';
import { App } from './app';
import { RaidScene, RaidUIScene } from './raid/RaidScene';
import { BootScene, HubBgScene } from './scenes';
import { installIosGuard } from './ui/iosGuard';

installIosGuard();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#14161a',
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  physics: { default: 'arcade', arcade: { debug: false } },
  input: { activePointers: 3 },
  render: { antialias: true },
  scene: [BootScene, HubBgScene, RaidScene, RaidUIScene],
});

const app = new App(game);
game.events.once('gengi-ready', () => {
  app.boot();
  // Ganchos solo para capturas automáticas (?debug=1&shot=raid|inv)
  const shot = new URLSearchParams(location.search).get('shot');
  if (app.debug && shot && shot !== 'hub' && !app.save.data.activeRaid) {
    const g = (window as unknown as { gengi: Record<string, (...a: unknown[]) => unknown> }).gengi;
    g.give('chaleco', 'militar'); g.give('casco', 'reforzado'); g.give('vendaje', 'comun', 3); g.give('botiquin'); g.give('pistola', 'reforzado'); g.give('municion', 'comun', 24);
    const d = app.save.data;
    const pick = (id: string) => d.stash.find(i => i.def === id)!;
    d.loadout.torso = pick('chaleco'); d.loadout.cabeza = pick('casco'); d.loadout.arma = pick('pistola');
    d.stash = d.stash.filter(i => ![d.loadout.torso, d.loadout.cabeza, d.loadout.arma].includes(i));
    d.loadout.mochila = d.stash.splice(0, d.stash.length);
    app.startRaid();
    if (shot === 'inv') setTimeout(() => app.openInventory(), 1200);
  }
});

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => undefined));
}
