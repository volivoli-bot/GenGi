import Phaser from 'phaser';
import { Joystick } from './Joystick';

const WORLD = 2400;

type Enemy = Phaser.GameObjects.Image & { hp: number; maxHp: number; speed: number; dmg: number; hitCd: number };

export class RaidScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Image;
  private body_!: Phaser.Physics.Arcade.Body;
  private joy!: Joystick;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private enemies!: Phaser.Physics.Arcade.Group;
  private walls!: Phaser.Physics.Arcade.StaticGroup;
  private hp = 100;
  private readonly maxHp = 100;
  // Arma equipada (provisional: bate de béisbol)
  private weapon = { name: 'Bate', range: 70, dmg: 18, cooldown: 600 };
  private attackTimer = 0;
  private hud!: Phaser.GameObjects.Text;
  private paused = false;

  constructor() { super('Raid'); }

  preload() {
    for (const k of ['player', 'errante', 'corredor', 'hinchado', 'abominacion', 'caja', 'bate'])
      this.load.svg(k, `art/${k}.svg`, { width: 128, height: 128 });
  }

  create() {
    this.physics.world.setBounds(0, 0, WORLD, WORLD);
    this.drawGround();

    this.walls = this.physics.add.staticGroup();
    const rng = new Phaser.Math.RandomDataGenerator([String(Date.now())]);
    for (let i = 0; i < 60; i++) {
      const w = rng.between(60, 220), h = rng.between(60, 220);
      const x = rng.between(150, WORLD - 150), y = rng.between(150, WORLD - 150);
      if (Phaser.Math.Distance.Between(x, y, WORLD / 2, WORLD / 2) < 250) continue;
      const r = this.add.rectangle(x, y, w, h, 0x4a4842).setStrokeStyle(5, 0x14110f);
      this.walls.add(r);
    }

    this.player = this.add.image(WORLD / 2, WORLD / 2, 'player').setDisplaySize(56, 56).setDepth(10);
    this.physics.add.existing(this.player);
    this.body_ = this.player.body as Phaser.Physics.Arcade.Body;
    this.body_.setCircle(40, 24, 24).setCollideWorldBounds(true);
    this.physics.add.collider(this.player, this.walls);

    this.enemies = this.physics.add.group();
    this.physics.add.collider(this.enemies, this.walls);
    this.physics.add.collider(this.enemies, this.enemies);
    for (let i = 0; i < 25; i++) this.spawnEnemy(rng);
    this.time.addEvent({ delay: 8000, loop: true, callback: () => this.spawnEnemy(rng) });

    this.cameras.main.setBounds(0, 0, WORLD, WORLD).startFollow(this.player, true, 0.15, 0.15);
    this.joy = new Joystick(this);
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Record<string, Phaser.Input.Keyboard.Key>;
    this.hud = this.add.text(12, 12, '', { fontFamily: 'sans-serif', fontSize: '16px', color: '#e8e2d0', stroke: '#000', strokeThickness: 4 }).setScrollFactor(0).setDepth(2000);

    // Pausa automática al interrumpirse (llamada, cambio de app, bloqueo de pantalla)
    const onHide = () => { if (document.hidden) this.setPaused(true); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', () => this.setPaused(true));
    this.events.once('shutdown', () => document.removeEventListener('visibilitychange', onHide));
    this.input.keyboard!.on('keydown-P', () => this.setPaused(!this.paused));
  }

  private drawGround() {
    const g = this.add.graphics();
    g.fillStyle(0x3b3a36, 1).fillRect(0, 0, WORLD, WORLD);
    g.lineStyle(1, 0x4a4842, 0.5);
    for (let i = 0; i <= WORLD; i += 80) { g.lineBetween(i, 0, i, WORLD); g.lineBetween(0, i, WORLD, i); }
  }

  private spawnEnemy(rng: Phaser.Math.RandomDataGenerator) {
    let x = 0, y = 0;
    do { x = rng.between(50, WORLD - 50); y = rng.between(50, WORLD - 50); }
    while (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < 500);
    const e = this.add.image(x, y, 'errante').setDisplaySize(52, 52) as Enemy;
    e.hp = e.maxHp = 40; e.speed = 70; e.dmg = 8; e.hitCd = 0;
    this.enemies.add(e);
    (e.body as Phaser.Physics.Arcade.Body).setCircle(40, 24, 24);
  }

  private setPaused(v: boolean) {
    this.paused = v;
    if (v) this.physics.pause(); else this.physics.resume();
    this.time.paused = v;
  }

  update(_t: number, dtMs: number) {
    if (this.paused) { this.hud.setText('PAUSA (toca para reanudar)'); if (this.input.activePointer.isDown) this.setPaused(false); return; }
    const dt = dtMs;

    // Movimiento
    const v = this.joy.vec.clone();
    const k = this.keys;
    if (k.A.isDown || k.LEFT.isDown) v.x = -1; if (k.D.isDown || k.RIGHT.isDown) v.x = 1;
    if (k.W.isDown || k.UP.isDown) v.y = -1; if (k.S.isDown || k.DOWN.isDown) v.y = 1;
    if (v.length() > 1) v.normalize();
    this.body_.setVelocity(v.x * 220, v.y * 220);
    if (v.lengthSq() > 0.01) this.player.rotation = Math.atan2(v.y, v.x) - Math.PI / 2;

    // Enemigos persiguen si te ven cerca
    const list = this.enemies.getChildren() as Enemy[];
    for (const e of list) {
      const d = Phaser.Math.Distance.Between(e.x, e.y, this.player.x, this.player.y);
      const b = e.body as Phaser.Physics.Arcade.Body;
      if (d < 420) { this.physics.moveToObject(e, this.player, e.speed); e.rotation = Math.atan2(this.player.y - e.y, this.player.x - e.x) - Math.PI / 2; } else b.setVelocity(0, 0);
      e.hitCd -= dt;
      if (d < 36 && e.hitCd <= 0) { e.hitCd = 900; this.damagePlayer(e.dmg); }
    }

    // Ataque automático al enemigo más cercano dentro del alcance
    this.attackTimer -= dt;
    if (this.attackTimer <= 0) {
      let target: Enemy | null = null, best = Infinity;
      for (const e of list) {
        const d = Phaser.Math.Distance.Between(e.x, e.y, this.player.x, this.player.y);
        if (d < this.weapon.range + 16 && d < best) { best = d; target = e; }
      }
      if (target) { this.attackTimer = this.weapon.cooldown; this.swing(target); }
    }

    this.hud.setText(`Vida ${Math.ceil(this.hp)}/${this.maxHp}   Arma: ${this.weapon.name}   Enemigos: ${list.length}`);
  }

  private swing(target: Enemy) {
    const ang = Phaser.Math.Angle.Between(this.player.x, this.player.y, target.x, target.y);
    const arc = this.add.graphics().setDepth(11);
    arc.lineStyle(6, 0xb6ff3c, 0.9).beginPath().arc(this.player.x, this.player.y, this.weapon.range * 0.8, ang - 0.7, ang + 0.7).strokePath();
    this.tweens.add({ targets: arc, alpha: 0, duration: 180, onComplete: () => arc.destroy() });
    target.hp -= this.weapon.dmg;
    target.setTintFill(0xffffff);
    this.time.delayedCall(80, () => target.active && target.clearTint());
    const b = target.body as Phaser.Physics.Arcade.Body;
    b.velocity.add(new Phaser.Math.Vector2(Math.cos(ang), Math.sin(ang)).scale(250));
    if (target.hp <= 0) target.destroy();
  }

  private damagePlayer(n: number) {
    this.hp -= n;
    this.cameras.main.shake(100, 0.006);
    this.player.setTint(0xff4d6d);
    this.time.delayedCall(100, () => this.player.clearTint());
    if (this.hp <= 0) { this.hp = this.maxHp; this.scene.restart(); }
  }
}
