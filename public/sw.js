/* Service worker de GenGi: funciona sin conexión tras la primera carga.
 * El nombre de la caché y la lista de precarga los pone el build (vite.config.ts → plugin gengi-sw) con el hash de los ficheros: no hay que subirlo a mano.
 * Al activarse, se borran todas las cachés de versiones anteriores. */
const CACHE = 'gengi-__BUILD_ID__';
/* Lista generada en el build (vite.config.ts → gengi-sw): todo lo que hay en dist (public/art, iconos, manifiesto y
 * el bundle con su hash) salvo el propio sw.js. No se edita a mano. */
const PRECACHE = __PRECACHE__;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('gengi') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
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
