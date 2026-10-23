# GenGi

GenGi v1: un juego 2D top-down para móvil (roguelike de extracción) hecho con Phaser 3, TypeScript y Vite.

## Qué incluye

- **Refugio:** equipar, vender y preparar la siguiente incursión.
- **Botín e inventario:** rarezas, mochila, bolsillo seguro y alijo (lo que no cabe pasa a excedente). El panel de la incursión es compacto y no deja pasar los toques al mapa. Al entrar, el cargador sale lleno con la munición de la mochila.
- **Extracción:** salidas a pie, de generador, con bengala y de pago.
- **Raid:** cámara a 1,6×, suelo nuevo, anillo de recarga y arte de munición y flechas.
- **Guardado versionado:** la partida queda en el navegador, se puede exportar e importar, y una incursión a medias se retoma donde se dejó.
- **Registro de incursiones.**
- **PWA:** manifiesto e iconos, y service worker en la build de producción.
- Scripts de QA en `qa/` (`qa.mjs`, `fog.mjs`, `stress.mjs`, `shots.mjs`; Puppeteer contra el preview local). No los ejecuta `npm run build` ni el workflow de GitHub Pages.

## Requisitos

- Node.js 22
- npm

## Ejecutar en local

```bash
npm ci
npm run dev
```

Vite muestra una dirección local (por defecto `http://localhost:5173`). Ábrela en el navegador. Para probarlo en el móvil, usa la URL de red que imprime la terminal, con el teléfono en la misma red.

## Compilar

```bash
npm run build
npm run preview
```

`npm run build` comprueba los tipos con TypeScript y deja el sitio estático en `dist/`.

La versión publicada está en https://volivoli-bot.github.io/GenGi/.

## Depuración (`?debug=1`)

Abre el juego con `?debug=1` (por ejemplo `http://localhost:5173/?debug=1`). El modo queda guardado en este navegador hasta que entres con `?debug=0`.

En el refugio aparecen botones para borrar la partida y sumar 500 chapas. En la consola, `window.gengi` expone:

- `help()` — lista los ganchos.
- `state()` — copia del guardado.
- `start()` — empieza una incursión.
- `give(id, rareza, cantidad)` — añade un objeto al alijo o, en raid, a la mochila.
- `equipFromStash(id)` — en el refugio, equipa el primer objeto del alijo con ese id.
- `stashToBackpack(id)` — pasa una pila del alijo a la mochila.
- `chapas(n)` — suma chapas.
- `god(on)` — invulnerabilidad.
- `hurt(n)` / `kill()` — daño o muerte.
- `spawn(tipo, n)` / `clearEnemies()` — genera o elimina enemigos.
- `minute(m)` — adelanta el reloj de la incursión.
- `exits()` / `tpExit(i)` / `tpBox()` — salidas y teletransporte.
- `pause()` / `resume()` / `inventory()` — pausa, reanudar y abrir el inventario.
- `exportStr()` / `importStr(texto)` — exportar e importar la partida.
- `exitCheck(n)` — comprueba que n mapas tienen salida a pie o de generador.
- `loadLegacy()` — carga un guardado antiguo y recarga.
- `reset()` — borra la partida y recarga.

`?debug=1&shot=raid` o `?debug=1&shot=inv` prepara una incursión de ejemplo (y abre el inventario si `shot=inv`).
