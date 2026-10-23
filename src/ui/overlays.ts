import type { RaidLogEntry } from '../save/types';
import { h } from './dom';

export function pauseOverlay(root: HTMLElement, reason: string, onResume: () => void, onAbandon: () => void) {
  const sub = reason === 'reanudada'
    ? 'Tu raid sigue en curso: se guardó en el instante exacto en que saliste. Reanuda cuando estés listo.'
    : reason === 'segundo-plano' ? 'Pausado al salir de la app. El estado está guardado.' : 'Juego en pausa. El reloj y la niebla están detenidos.';
  const el = h('div', { class: 'overlay pause' },
    h('div', { class: 'card' },
      h('h2', {}, 'PAUSA'),
      h('p', {}, sub),
      h('p', { class: 'hint' }, '🔒 El inventario está bloqueado mientras el juego está en pausa.'),
      h('button', { class: 'btn main', onclick: onResume }, '▶ Reanudar'),
      h('button', { class: 'btn danger', onclick: () => { if (confirm('Abandonar cuenta como muerte: perderás todo menos el bolsillo seguro. ¿Seguro?')) onAbandon(); } }, 'Abandonar raid (cuenta como muerte)'),
    ),
  );
  root.append(el);
  return el;
}

export function summaryOverlay(root: HTMLElement, e: RaidLogEntry, kept: string[], onClose: () => void) {
  const ok = e.result === 'extraido';
  const el = h('div', { class: 'overlay' },
    h('div', { class: 'card' },
      h('h2', { class: ok ? 'ok' : 'bad' }, ok ? '¡EXTRAÍDO!' : 'HAS MUERTO'),
      h('p', {}, ok ? `Salida: ${e.exitType}` : `Causa: ${e.killedBy}`),
      h('div', { class: 'stats' },
        h('div', {}, 'Minuto', h('b', {}, e.minute.toFixed(1))),
        h('div', {}, 'Bajas', h('b', {}, String(e.kills))),
        h('div', {}, 'Valor al entrar', h('b', {}, String(e.valueIn))),
        h('div', {}, 'Valor al salir', h('b', {}, String(e.valueOut))),
      ),
      h('p', {}, ok ? 'Lo que llevabas en la mochila ha pasado al alijo.' : kept.length ? `Conservas: ${kept.join(', ')}` : 'Has perdido todo tu equipo.'),
      h('button', { class: 'btn main', onclick: onClose }, 'Volver al refugio'),
    ),
  );
  root.append(el);
  return el;
}
