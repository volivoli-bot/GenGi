/**
 * Endurecimiento para Safari de iPhone (Pablo juega en iPhone 14): que un gesto en mitad de la raid no saque del juego.
 * - Gesto de atrás/adelante desde el borde y "tirar para recargar": overscroll-behavior:none + touch-action:none (index.html)
 *   y preventDefault en touchstart/touchmove del juego (passive:false). En la web no se puede bloquear al 100 %
 *   (iOS a veces respeta el gesto del borde igualmente); por eso los joysticks se quedan a 20 px del borde y,
 *   si aun así el navegador navega, `pagehide` pausa y guarda de forma síncrona (RaidScene.background).
 * - Los menús HTML siguen recibiendo toques: nunca se cancela el touchstart sobre un elemento interactivo
 *   (eso mataría el click), y el touchmove se deja pasar dentro de zonas con scroll.
 *
 * Se registra en `document` en fase de burbuja: Phaser escucha en el canvas (antes) y en `window` (después) e ignora
 * eventos ya cancelados, así que esto no le quita nada a Phaser sobre el canvas.
 */
const EDGE_PX = 20;
const INTERACTIVE = 'button, a, input, select, textarea, label, [data-uid], [role="button"], .ctx, .scroll';

function isCanvas(t: EventTarget | null): boolean {
  return t instanceof HTMLCanvasElement;
}

function inScrollable(t: EventTarget | null): boolean {
  return t instanceof Element && !!t.closest('.scroll');
}

function interactive(t: EventTarget | null): boolean {
  return t instanceof Element && !!t.closest(INTERACTIVE);
}

export function installIosGuard(doc: Document = document) {
  const opts: AddEventListenerOptions = { passive: false };
  doc.addEventListener('touchstart', (e: TouchEvent) => {
    if (!e.cancelable) return;
    if (isCanvas(e.target)) { e.preventDefault(); return; }
    // toque junto al borde sobre algo no interactivo (fondo de un panel, etc.): cancelar para que no arranque el gesto del borde
    const t = e.changedTouches[0];
    if (t && (t.clientX < EDGE_PX || t.clientX > window.innerWidth - EDGE_PX) && !interactive(e.target)) e.preventDefault();
  }, opts);
  doc.addEventListener('touchmove', (e: TouchEvent) => {
    if (!e.cancelable) return;
    if (inScrollable(e.target)) return; // listas con scroll (mochila, alijo, tienda)
    e.preventDefault();
  }, opts);
  // pellizco/zoom de Safari
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) doc.addEventListener(ev, e => e.preventDefault(), opts);
  // doble toque para hacer zoom
  doc.addEventListener('dblclick', e => e.preventDefault(), opts);
}
