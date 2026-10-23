/* Service worker de GenGi: funciona sin conexión tras la primera carga. Sube CACHE al publicar cambios grandes. */
const CACHE = 'gengi-v1';
const PRECACHE = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
   "./art/abominacion.svg",  "./art/arco.svg",  "./art/aviso-ataque.svg",  "./art/bate.svg",  "./art/bengala.svg",  "./art/botiquin.svg",  "./art/caja.svg",  "./art/casco.svg",  "./art/chaleco.svg",  "./art/chapa.svg",  "./art/corredor.svg",  "./art/errante.svg",  "./art/extraccion.svg",  "./art/generador.svg",  "./art/hinchado.svg",  "./art/hoja.svg",  "./art/machete.svg",  "./art/pistola.svg",  "./art/player.svg",  "./art/rarezas.svg",  "./art/tablas.svg",  "./art/vendaje.svg", './art/palette.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    // red primero (para recibir actualizaciones), caché si no hay conexión
    e.respondWith(fetch(req).then((r) => { const cp = r.clone(); caches.open(CACHE).then((c) => c.put('./index.html', cp)); return r; })
      .catch(() => caches.match('./index.html')));
    return;
  }
  // recursos: caché primero y actualización en segundo plano
  e.respondWith(caches.match(req).then((hit) => {
    const net = fetch(req).then((r) => { if (r.ok) { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); } return r; }).catch(() => hit);
    return hit || net;
  }));
});
