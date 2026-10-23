import Phaser from 'phaser';
import { COLORS } from './config/constants';

export const ART = ['player', 'errante', 'corredor', 'hinchado', 'abominacion', 'caja', 'bate', 'machete', 'arco', 'pistola',
  'casco', 'chaleco', 'tablas', 'vendaje', 'botiquin', 'bengala', 'generador', 'chapa', 'extraccion', 'aviso-ataque', 'municion', 'flecha'];

/** Arte v2 por piezas (Basu, public/art/v2): [clave, ancho, alto] del viewBox. Se rasteriza a 2× para que no se vea borroso con zoom. */
/** Arte v3 de Basu: interfaz de sigilo e indicadores. */
export const ART_V3_UI: [string, number, number][] = [['ui_sospecha', 32, 40], ['ui_alerta', 32, 40], ['ui_ejecutar', 64, 64], ['ui_anillo_ruido', 128, 128],
  // indicadores junto al jugador (diseno-v3 §8.4)
  ['hab_aguantar', 32, 32], ['hab_escanear', 32, 32], ['estado_sangrado', 32, 32], ['estado_veneno', 32, 32], ['barra_vida', 40, 8]];

/** Arte v3 de Basu para la raid (enemigos nuevos, auras de mutación, efectos y alcantarilla). */
export const ART_V3: [string, number, number][] = [['escupidor_cuerpo', 64, 64], ['escupidor_saco', 32, 32], ['proyectil_acido', 32, 32],
  ['chillon_cuerpo', 64, 64], ['chillon_boca', 32, 32], ['fx_onda_grito', 128, 128], ['acechador_cuerpo', 64, 64],
  ['bruto_cuerpo', 96, 96], ['bruto_placa', 96, 40], ['reptante', 64, 64], ['alcantarilla', 64, 64], ['fx_burbujas', 64, 64],
  ['enjambre_bicho', 32, 32], ['aura_veloz', 128, 128], ['aura_blindado', 128, 128], ['aura_volatil', 128, 128], ['aura_regenerador', 128, 128]];

export const ART_V2: [string, number, number][] = [
  ['abominacion_cuerpo', 128, 128],
  ['abominacion_tentaculo', 32, 96],
  ['arma_arco', 64, 64],
  ['arma_bate', 64, 64],
  ['arma_machete', 64, 64],
  ['arma_pistola', 64, 64],
  ['cartel_evacuacion', 64, 64],
  ['coche', 64, 128],
  ['corredor_brazo', 64, 64],
  ['corredor_cabeza', 64, 64],
  ['corredor_pie', 64, 64],
  ['corredor_sombra', 64, 64],
  ['corredor_torso', 64, 64],
  ['errante_brazo', 64, 64],
  ['errante_cabeza', 64, 64],
  ['errante_pie', 64, 64],
  ['errante_sombra', 64, 64],
  ['errante_torso', 64, 64],
  ['fx_charco_acido', 128, 128],
  ['fx_fogonazo', 64, 64],
  ['fx_impacto', 64, 64],
  ['fx_mancha_suelo_azul', 64, 64],
  ['fx_mancha_suelo_verde', 64, 64],
  ['fx_sangre_azul_1', 64, 64],
  ['fx_sangre_azul_2', 64, 64],
  ['fx_sangre_verde_1', 64, 64],
  ['fx_sangre_verde_2', 64, 64],
  ['hinchado_cuerpo', 96, 96],
  ['hinchado_pustula', 32, 32],
  ['jugador_brazo', 64, 64],
  ['jugador_cabeza', 64, 64],
  ['jugador_pie', 64, 64],
  ['jugador_sombra', 64, 64],
  ['jugador_torso', 64, 64],
  ['muro', 64, 64],
  ['proyectil_bala', 8, 48],
  ['proyectil_flecha', 16, 64],
  ['puerta', 64, 16],
  ['suelo_asfalto', 64, 64],
  ['suelo_baldosa', 64, 64],
];

/** Carga el arte vectorial y avisa a la app. */
export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  preload() {
    for (const k of ART) {
      const big = k === 'abominacion' || k === 'extraccion' || k === 'aviso-ataque';
      this.load.svg(k, `art/${k}.svg`, { width: big ? 256 : 128, height: big ? 256 : 128 });
    }
    // si falta alguna pieza, el muñeco usa la imagen única de la v1 (ver rig.ts)
    for (const [k, w, h] of ART_V2) this.load.svg(k, `art/v2/${k}.svg`, { width: w * 2, height: h * 2 });
    // v3 (Basu): solo la interfaz de sigilo por ahora ('?', '!', Ejecutar, anillo de ruido)
    for (const [k, w, h] of ART_V3_UI) this.load.svg(k, `art/v3/${k}.svg`, { width: w * 2, height: h * 2 });
    for (const [k, w, h] of ART_V3) this.load.svg(k, `art/v3/${k}.svg`, { width: w * 2, height: h * 2 });
  }
  create() { this.game.events.emit('gengi-ready'); }
}

/** Fondo animado del refugio (detrás de la interfaz HTML). */
export class HubBgScene extends Phaser.Scene {
  constructor() { super('HubBg'); }
  create() {
    const draw = () => {
      this.children.removeAll(true);
      const W = this.scale.width, H = this.scale.height;
      const g = this.add.graphics();
      g.fillStyle(COLORS.suelo[0], 1).fillRect(0, 0, W, H);
      for (let i = 0; i < 40; i++) g.fillStyle(i % 2 ? COLORS.suelo[1] : COLORS.musgo, 0.4).fillCircle(Math.random() * W, Math.random() * H, 20 + Math.random() * 60);
      const kinds = ['errante', 'corredor', 'hinchado', 'caja', 'bate'];
      for (let i = 0; i < 9; i++) {
        const im = this.add.image(Math.random() * W, Math.random() * H, kinds[i % kinds.length]).setDisplaySize(56, 56).setAlpha(0.35).setRotation(Math.random() * 6);
        this.tweens.add({ targets: im, x: im.x + (Math.random() - 0.5) * 80, y: im.y + (Math.random() - 0.5) * 80, duration: 4000 + Math.random() * 3000, yoyo: true, repeat: -1 });
      }
    };
    draw();
    this.scale.on('resize', draw);
    this.events.once('shutdown', () => this.scale.off('resize', draw));
  }
}
