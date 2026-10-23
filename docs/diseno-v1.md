# GenGi: diseño v1 (Basu)

## Jugador
- Vida 100. Sin regeneración; se cura con vendajes (+30 en 2 s) y botiquines (+70 en 4 s).

## Controles
- Joystick a la izquierda; ataque automático al objetivo según prioridad (cercano / débil / peligroso) dentro del alcance del arma.
- Looteo: quieto junto a caja o cadáver, anillo de 1,5 s, recoge según filtro (rareza mínima, solo si no hay enemigos a menos de 6 casillas).
- Derecha: hasta 3 botones de habilidad que salen del equipo + 1 consumible rápido.
- Inventario: no pausa el juego. Con el juego en pausa el inventario está bloqueado.

## Raid
- Duración máxima 15:00. A partir de 13:00 aviso; a 15:00 niebla tóxica: 2 % de vida máxima por segundo, creciendo 1 % cada 30 s.
- 2 extracciones: una siempre abierta (lejos) y otra cercana que exige activar un generador (10 s). Extraer = aguantar 8 s dentro de la zona.
- Bolsillo seguro: 1 casilla, su objeto se conserva al morir. Solo objetos pequeños (no armas largas ni armaduras).
- Morir: se pierde todo lo equipado y lo de la mochila, salvo el bolsillo seguro.

## Rarezas (sistema de 5, la v1 suelta solo 3)
| Tier | Color | Multiplicador | Rasgos | v1 |
|---|---|---|---|---|
| Chatarra | #8a8a8a | 0,8 | 0 | no |
| Común | #f2efe8 | 1,0 | 0 | sí (60 %) |
| Reforzado | #4cd964 | 1,2 | 1 | sí (30 %) |
| Militar | #3c8cff | 1,45 | 2 | sí (10 %) |
| Anomalía | #b44cff | 1,8 | 2 + 1 alien | no |

## Armas v1 (valores base, tier Común)
| Arma | Daño | Ataques/s | Alcance (casillas) | Ruido (radio) | Habilidad (recarga) |
|---|---|---|---|---|---|
| Bate | 12 | 1,2 | 1,2 | 0 | Golpe cargado: 30 daño + empuje (8 s) |
| Machete | 9 | 2,0 | 1,1 | 0 | Torbellino: 15 daño en área + sangrado (10 s) |
| Arco | 18 | 0,8 | 7 | 1 | Disparo perforante: atraviesa 3 enemigos (8 s) |
| Pistola | 12 | 2,0 | 6 | 10 | Ráfaga: 5 disparos rápidos (12 s). Cargador 12, recarga 1,5 s, munición escasa y de pago |

## Armaduras v1
| Ranura | Pieza | Protección | Peso | Habilidad |
|---|---|---|---|---|
| Torso | Ropa | 0 % | 0 | - |
| Torso | Tablas atadas | 15 % | 3 | - |
| Torso | Chaleco militar | 35 % | 6 | Aguantar: -60 % daño 3 s (20 s) |
| Cabeza | Casco militar | 15 % | 2 | Escanear: revela enemigos y botín 10 casillas (25 s) |
Velocidad: -2 % por punto de peso total (máx -40 %).

## Enemigos v1
| Enemigo | Vida | Daño | Velocidad | Notas |
|---|---|---|---|---|
| Errante | 30 | 6 | lenta | En grupos de 3-5, acude al ruido |
| Corredor | 18 | 5 | rápida | Aparece si estás quieto mucho rato |
| Hinchado | 40 | 0 | lenta | Al morir se hincha 1 s (aviso visual) y explota en radio 1,8 casillas: 20 daño y charco de ácido 4 s. Con arma cuerpo a cuerpo, el ataque automático lo deja para el final y avisa con un icono; da tiempo a alejarse con el joystick |
| Abominación | 300 | 18 | media | Élite, guarda caja con botín Militar garantizado |

## Refugio
- Alijo de 30 casillas. Comerciante con chapas. Equipo gratis siempre: bate Común + ropa, marcados como invendibles.

## Dificultad y habilidad (petición de Pablo: difícil, novato rara vez sobrevive)
- Todos los ataques enemigos se anuncian antes de golpear y se esquivan moviéndose:
  - Errante: se echa hacia atrás 0,6 s (destello rojo) y se lanza 1,5 casillas.
  - Corredor: se agacha 0,5 s y embiste en línea recta 4 casillas; esquivar de lado.
  - Hinchado: se hincha 1 s y explota (radio 1,8).
  - Abominación: círculo rojo en el suelo 1 s antes de su golpe en área (radio 2,5, 35 daño); cada 15 s lanza un chorro de ácido en cono.
- La dificultad sube cada minuto: +10 % de aparición de enemigos y +4 % de vida y daño enemigos por minuto (en el minuto 10: +100 % aparición, +40 % vida y daño).
  - Minuto 0-4: Errantes. Minuto 4: entran Corredores. Minuto 7: más Hinchados. Minuto 10: hordas que acuden al ruido de forma permanente.
- El botín bueno está en las zonas peligrosas y aparece más botín en cajas cerradas que hacen ruido al abrirse (2 s).

## Extracción
- El mapa tiene 3 puntos de extracción; en cada raid se activan 2: una siempre es A pie o Generador (salida garantizada) y la otra es al azar entre las demás y se ven en el mapa desde el principio, para que haya que planear la ruta.
- Tipos:
  - A pie: siempre disponible, en el extremo opuesto al punto de aparición.
  - Generador: activarlo cuesta 10 s y hace mucho ruido (atrae a todo lo cercano); luego queda abierto.
  - Bengala: solo se abre del minuto 8 al 10. Hay que lanzar una bengala (se encuentra en el mapa) y aguantar a que llegue el helicóptero.
  - De pago: hay que entregar un objeto de valor (Reforzado o mejor) para salir.
- Para extraer hay que aguantar 8 s dentro de la zona. Si te golpean, el contador se pausa y retrocede 2 s.
- En el minuto 15 llega la niebla tóxica (ver Raid).

## Cámara y avisos fuera de pantalla
- Zoom 1,4x (unas 7 casillas de ancho en vertical).
- Ningún enemigo inicia su aviso de ataque (destello, agachada, círculo) fuera de la pantalla.
- Flecha roja en el borde de la pantalla por cada enemigo que te ha detectado y está fuera de la vista; parpadea si es un Corredor.
- Principio: difícil pero nunca injusto, todo golpe se ha podido ver venir.
- Hinchado: explota siempre, también fuera de pantalla (a esa distancia no puede alcanzar al jugador). La explosión y el charco de ácido también dañan a otros enemigos.

# Cambios v2 (tras la primera partida de Pablo)

## Movimiento
- Aceleración e inercia: aceleración 0 → velocidad máxima en 0,25 s, frenado en 0,18 s, giro de dirección con derrape suave. El peso alarga ambos tiempos (+2 % por punto de peso).

## Combate
- Cuerpo a cuerpo: sigue siendo automático.
- Distancia (arco, pistola): joystick derecho de apuntado.
  - Mantener y arrastrar = apuntar: el personaje mira hacia allí y aparece la línea de disparo (corta y temblorosa al principio, se estabiliza en 0,4 s quieto = recompensa por apuntar con calma).
  - Arrastrar más allá del 85 % del radio = dispara + vibración corta. Soltar sin pasar ese umbral = cancela.
  - Mientras apuntas te mueves al 60 % de velocidad.
  - Flecha: lenta y visible (10 casillas/s), cae un poco al final, se puede recuperar del suelo o del cadáver. Bala: casi instantánea (40 casillas/s) con trazo luminoso.
- Sensación de impacto:
  - Parón de 50-80 ms en cada golpe (más en los fuertes), sacudida de cámara pequeña, destello blanco del enemigo 1 fotograma.
  - El enemigo se tambalea y retrocede según la fuerza del arma (el bate lo desequilibra, la escopeta lo tumba), en vez de un empujón uniforme.
  - Números de daño que saltan y caen; críticos más grandes en amarillo.
  - Sangre de color no realista: verde tóxico en zombificados, azul-violeta en abominaciones. Salpicadura al golpear y manchas en el suelo que se quedan toda la raid.
  - Muerte: el cuerpo cae y se queda (sirve de pista de por dónde ha pasado alguien), con explosión de partículas.

## Looteo
- Se puede lootear con enemigos cerca. El anillo de looteo se pausa (no se reinicia) si te golpean.

## Inventario
- Tocar objeto = mini menú flotante junto al objeto: Equipar / Usar / Tirar / Mover al bolsillo seguro. Mantener pulsado = ver estadísticas comparadas con lo equipado.

## Visión
- Cono de visión de 220° hacia donde mira el personaje (hacia donde apunta, o hacia donde se mueve si no apunta). Detrás, niebla oscura: se ve el suelo pero no los enemigos ni el botín.
- Las paredes cortan la visión (no se ve a través de muros ni dentro de habitaciones cerradas).
- Enemigo detrás a menos de 4 casillas: vibración que crece al acercarse + leve viñeta roja en el lado del que viene (para iPhone, donde la vibración no funciona en el navegador).

## Mapa
- Unas 3 veces el actual: 4-6 edificios grandes con 3-6 habitaciones cada uno, calles, patios, coches abandonados que bloquean.
- Puertas que se abren al pasar (y hacen algo de ruido). Interiores con mejor botín y más peligro.
- Zonas: calles (poco botín), tiendas/casas (medio), comisaría/hospital/almacén militar (alto, con Abominación).

## Extracciones
- No se muestran al empezar. Aparecen en el minimapa cuando el jugador las ve por primera vez, y a partir de ahí se ve su estado actual (abierta, cerrada, necesita generador...).
- Al empezar sí se dice el nombre de las 2 activas (ej. "Túnel norte", "Azotea del hospital") para tener una pista.
- Señales en el mapa (carteles de evacuación pintados en paredes) que apuntan hacia las salidas: premian explorar y fijarse.

## Hacia dónde mira el personaje (cono de visión)
- Si usas el joystick derecho, manda él: puedes huir hacia un lado mirando y disparando hacia el otro (es la habilidad clave para sobrevivir).
- Si no lo tocas, mira hacia donde se mueve.
- Con arma cuerpo a cuerpo el joystick derecho sirve para mirar (sin disparar), y el ataque sigue siendo automático hacia donde miras.
- Toque rápido en el joystick derecho = mirar atrás 0,8 s y volver.

## Disposición de controles (pulgar derecho)
- Joystick de apuntado abajo a la derecha, en la posición de reposo del pulgar, grande (radio 70 px).
- Los 3 botones de habilidad y el de consumible en arco alrededor, por encima y a la izquierda del joystick, más pequeños (52 px), a un movimiento corto de pulgar. Estilo de shooters móviles.
- Las habilidades con dirección (golpe cargado, disparo perforante, ráfaga) se lanzan hacia donde estás mirando.

## Cambio rápido de arma (petición de Pablo)
- Nueva ranura "Arma de reserva" junto a "Arma". Al equipar un arma nueva, la que tenías pasa a la reserva (si la reserva estaba ocupada, esa vuelve a la mochila; si no cabe, al suelo).
- Botón de cambio rápido pequeño (44 px) encima del arco de habilidades, mostrando el icono del arma de reserva. Un toque intercambia arma y reserva.
- El cambio tarda 0,4 s con animación (guardar y sacar). Durante ese tiempo no se ataca: cambiar en mitad de una horda es una decisión.
- Las habilidades de arma se actualizan al cambiar; los tiempos de recarga de cada arma se conservan.
- Ambas armas pesan y ambas se pierden al morir.

## Plataforma de referencia
- Pablo juega en iPhone 14 con Safari: no hay vibración desde la web. Toda respuesta háptica debe tener su equivalente visual (y sonoro cuando haya sonido): disparo = retroceso + sacudida de cámara más marcada; enemigo a la espalda = borde rojo que late más fuerte al acercarse.

## Notas de implementación v2 (código, sin cambiar lo anterior)
Todos los números ajustables están en `src/config/v2.ts` (MOVE, AIM, PROJECTILE, JUICE, STAGGER, VISION, MAP2, AI, SWAP, HUD2) y `src/config/difficulty.ts`.

### Números
- Movimiento: aceleración 0,25 s, frenado 0,18 s, +2 % por punto de peso en ambos (tasa = vel. máx / (t × (1 + 0,02 × peso))). Apuntando con arma a distancia: 60 % de velocidad. Giro del personaje 720°/s.
- Apuntado: radio del joystick 70 px, zona muerta 18 %, disparo al pasar el 85 %. Dispersión de la línea 9° → 1,2° tras 0,4 s quieto (mover más de 6° reinicia). Toque < 0,22 s sin arrastrar = mirar atrás 0,8 s.
- Si no se toca el joystick, el arma a distancia sigue disparando sola como en la v1, pero al 60 % de cadencia (para que no apuntar no sea mejor que apuntar).
- Proyectiles: flecha 10 casillas/s (480 px/s), cae al final, 70 % de probabilidad de quedar recuperable en el suelo; las clavadas en un enemigo se recogen del cadáver. Bala 40 casillas/s (1920 px/s) con trazo.
- Impacto: parón 55 ms (80 ms en golpes fuertes y críticos), sacudida 0,00025 por punto de daño (tope 0,009), destello blanco 1 fotograma. Crítico 10 % ×1,8, número amarillo 1,4× más grande. Números: suben 20 px en 0,6 s.
- Tambaleo (impulso px/s para masa 1, duración s): puños 140/0,12, bate 330/0,35, machete 170/0,16, arco 220/0,18, pistola 180/0,14. Masa: Errante 1, Corredor 0,8, Hinchado 1,7, Abominación 7. Un tambaleo ≥ 0,3 s corta el aviso de ataque.
- Rendimiento: máximo 160 manchas de suelo y 45 cadáveres por raid (se reciclan los más viejos).
- Visión: cono 220°, alcance 15 casillas, niebla al 45 % de opacidad con borde difuminado de 1,5 casillas (antes 62 % y borde duro; cambio de la prueba v3 §8.5). Aviso por detrás a menos de 4 casillas.
  - Decisión: hay un radio de "conciencia corporal" de 1,7 casillas siempre visible alrededor del jugador. Así nunca te golpea algo pegado a ti que no puedes ver.
- Mapa: 104 × 104 casillas (la v1 tenía 60 × 60, ≈3× de área). El trazado es fijo (semilla fija) para que se pueda aprender. Botín, enemigos y salidas activas cambian en cada raid. 31 puertas; una puerta abierta por el jugador hace ruido de 3 casillas.
- IA: un enemigo que te detecta alerta a su grupo en 6 casillas. Los Errantes flanquean en abanico de 55° hasta 3 casillas. El Corredor apunta su embestida 0,35 s por delante de ti y se abre de lado 0,6 s antes. Velocidad ×1,12 Errante, ×1,05 Corredor, ×1,1 Hinchado, ×1,05 Abominación.
- Dificultad (mapa más grande): oleadas cada 8 s, 12 grupos de Errantes y 5 Hinchados iniciales, más 8 grupos y 3 Hinchados que entran en el primer medio minuto. Máximo 90 vivos. Los Corredores siguen entrando en el minuto 4.

### Arte por piezas
- Arte de Basu en `public/art/v2/*.svg`, con nombres `<tipo>_<pieza>.svg`. Ejemplos: `errante_torso`, `corredor_pie`, `jugador_brazo`, `hinchado_pustula`, `abominacion_tentaculo`, `arma_bate`, `fx_sangre_verde_1`, `fx_mancha_suelo_azul`, `cartel_evacuacion`, `coche`.
- Formato: caja de 64 × 64 (la Abominación 128 × 128, el tentáculo 32 × 96, el coche 64 × 128), mirando hacia arriba. Se cargan a 2× de resolución.
- `src/raid/rig.ts` monta el muñeco según `animacion.json`: sombra, pies, torso, brazos con el arma en la mano y cabeza. Las animaciones son paso, golpe, retroceso, impacto, apuntar y el guardar/sacar del cambio de arma.
- Si falta alguna pieza, se usa la imagen única de la v1 (`public/art/<tipo>.svg`).

### Controles (pulgar derecho)
- Joystick de apuntar: radio 70. En reposo su borde queda a 20 px del margen de la pantalla (centro a 90 px del margen derecho e inferior dentro de la zona segura). Si el toque cae dentro de la base, se usa la base. Si cae en otro punto de la mitad derecha (fuera de botones), la base se mueve bajo el dedo y vuelve a su sitio al soltar. Los dos joysticks flotantes nunca dibujan la base a menos de 20 px + radio del borde. El vector se mide desde el punto donde tocaste, así que tocar pegado al borde no mueve al personaje.
- Arco de botones de 52 px a 116 px del centro del joystick, a 188°, 218°, 248° y 278°: habilidad del arma, torso, cabeza y consumible.
- Botón de cambio de arma de 44 px encima del arco, con el icono del arma de reserva.
- El botón de acción (lootear/abrir) se ha subido y movido a la izquierda para no tapar el arco.
- Conflicto joystick/botones: tocar un botón nunca inicia el joystick (los botones tienen prioridad). Con arma cuerpo a cuerpo el joystick solo gira al personaje.

### Arma de reserva
- Hay una ranura "Reserva" junto a "Arma". Al equipar un arma, la que tenías pasa a la reserva y la que hubiera en la reserva vuelve a la mochila (o al suelo si no cabe). Los puños no cuentan como arma.
- El cambio dura 0,4 s (bajar y subir) y durante ese tiempo no se ataca. El arma cambia al final de los 0,4 s y cada arma conserva sus tiempos de recarga.
- Las dos armas pesan y las dos se pierden al morir.

### iPhone (sin vibración)
- Se detecta con `navigator.vibrate` ausente.
- Al disparar: retroceso del arma de 8 px (3 px con vibración), golpe de cámara de 7 px y sacudida de 0,004.
- Enemigo a la espalda: la viñeta roja late más fuerte al acercarse. En Android también hay vibración.

### iPhone: gestos de Safari en mitad de la raid
- Objetivo: que el gesto de atrás/adelante desde el borde y "tirar para recargar" no saquen del juego.
- CSS: `overscroll-behavior: none` y `touch-action: none` en html/body, `body` fijo y `touch-action: none` en el canvas.
- Código (`src/ui/iosGuard.ts`): `preventDefault` en touchstart/touchmove del canvas (`passive: false`). También se cancelan el pellizco y el doble toque.
- Los menús HTML siguen funcionando: nunca se cancela el touchstart sobre un botón o una celda, y dentro de las listas con scroll se puede arrastrar. Un toque junto al borde sobre algo no interactivo también se cancela.
- Joysticks a 20 px del borde (`HUD2.edgeInsetPx`).
- Límite: en la web no se puede bloquear el gesto del borde al 100 %. Si Safari navega igualmente, `pagehide` (y `visibilitychange`/`freeze`/`beforeunload`) pausa y guarda en el acto, y al volver la raid sigue donde estaba.

### Otras decisiones
- Las salidas vistas se guardan por mapa (`seenExits`, guardado v2) y siguen vistas en las raids siguientes. Al empezar se anuncian los nombres de las 2 activas.
- En la niebla: los enemigos, las cajas y las flechas del suelo se ocultan. Los cadáveres y las manchas siguen visibles (son pistas).
- Un enemigo oculto que te detecta sigue mostrando la flecha roja de borde, pero nunca empieza su aviso de ataque mientras no lo ves.
- Lootear con enemigos cerca: el anillo se pausa (no se reinicia) si te golpean.

### Sigilo (diseno-v3.md §7)
Números en `src/config/v2.ts` → `STEALTH`.
- Pasos según el joystick: sigilo < 40 % (vel. 35 %, ruido 1 casilla), andar 40-85 % (70 %, 3), correr > 85 % (100 %, 6). Chaleco militar +1. Un paso hace ruido cada 0,25 s. Anillo tenue alrededor del jugador con el radio actual (`ui_anillo_ruido`).
- Otros ruidos: puertas 3, cajas cerradas 4 (antes 6), golpe cuerpo a cuerpo 3, disparos según arma, cristales y latas del suelo 5 (70 por mapa, con semilla; se ven como restos y avisan "¡Crac!" una vez cada 2 s).
- A través de paredes el ruido llega a la mitad de distancia. Oído de los enemigos +3 % por minuto.
- Vista enemiga: cono de 110° y 6 casillas, cortado por paredes; en alerta ven ×1,3. Medidor "?" que se llena en 0,4 s (a 1 casilla) hasta 1,2 s (a 6 casillas), interpolado; se vacía a 0,5/s. Lleno = "!" (1,2 s), persigue y avisa al grupo. Iconos `ui_sospecha` / `ui_alerta` de Basu.
- Sospecha: gira 0,5 s, va al último sitio donde te notó al 60 % de velocidad, mira alrededor 4 s y vuelve. Quietos: giran al azar cada 3-7 s (hasta 160°) con una pausa previa de 0,4 s.
- Conos tenues en el suelo de los enemigos que están en tu cono (ajuste "Sigilo → Conos enemigos: Mostrar / Ocultar (experto)", activado por defecto).
- Táctico: el ataque automático nunca apunta a enemigos desprevenidos. Detrás de uno desprevenido y a alcance cuerpo a cuerpo, el botón de cambio de arma pasa a "Ejecutar" (`ui_ejecutar`): daño del arma ×2,5 marcado como crítico. Disparo apuntado a mano contra un desprevenido: ×2,5. Matar sin ser detectado no avisa a nadie; si sobrevive, pasa a alerta.
- Decisión: los enemigos nuevos de v3 (Chillón, Acechador, Enjambre, Escupidor) no están aún en el juego; el oído por tipo está en la config (todos 1) para cuando lleguen.

### Service worker: caché por build
- `public/sw.js` usa `gengi-__BUILD_ID__`; el plugin `gengiSw` de `vite.config.ts` lo sustituye en cada `vite build` por hash del bundle + momento del build. Al activarse, borra todas las cachés `gengi*` que no sean la actual (las de otras webs del mismo origen no se tocan) y toma el control (`clients.claim`). Ya no hay que subir el número de versión a mano.

### Guardado v1 → v2
- Comprobado en QA (S13): un guardado v1 real (alijo, excedente, mochila, chapas, ajustes) se carga sin perder objetos ni chapas, y añade los campos nuevos (`seenExits`, `conosEnemigos`, reserva vacía).

### Cambios tras la prueba v2 (diseno-v3.md §8, números finales de Basu)
Números en `src/config/v2.ts` → `PRUEBA_V2` (y `VISION.fogAlpha`/`fogFeatherTiles`).

| Punto | Antes | Ahora |
|---|---|---|
| Daño Errante / Corredor / Abominación | 6 / 5 / 18 | 7,5 / 6,25 / 22,5 (×1,25; la curva por minuto va encima) |
| Explosión del Hinchado | 20 | 25 + 1 carga de veneno |
| Escanear (casco) | todo el mapa, 6 s | 10 casillas, 3 s (también tras muros) |
| Niebla fuera del cono | 62 %, borde duro | 45 %, borde difuminado 1,5 casillas (3 capas) |
| Cadencia arco | 0,8 /s | 0,536 /s (×0,67) |
| Cadencia pistola | 2,0 /s | 1,34 /s (×0,67) |
| Charco de ácido | 6 de daño/s | 1 carga de veneno por segundo dentro |
| Sangrado / veneno | no existía | cargas acumulables (abajo) |
| Vendaje / botiquín | curación al instante de pulsar | 1,5 s / 2,5 s manteniendo el botón (abajo) |
| Texto AGUANTAR arriba | sí | quitado; icono sobre la cabeza |

- Inventario: el menú se abre al soltar un toque (el dedo se mueve < 8 px y dura < 300 ms). Arreglo: al redibujar el panel se restauraba el scroll y ese evento cerraba el menú recién abierto; ahora solo cierra un scroll real de 8 px o más. El click que el navegador manda tras el toque se ignora en los botones del menú durante 0,4 s (si no, caía sobre el menú recién pintado).
- Indicadores junto al jugador: iconos de habilidad activa de 18 px sobre la cabeza con arco amarillo que se vacía, en fila (`hab_aguantar`, `hab_escanear`); si hay anillo de progreso (curación, recarga, cambio) la fila sube. Mini barra 36×4 bajo el personaje (colores de `barra_vida`): fija bajo el 35 % de vida, o tras 2 golpes en 3 s (se queda 3 s desde el último). Estados de 14 px (`estado_sangrado`, `estado_veneno`) con el número de cargas junto a la barra.
- Sangrado: 33 % de los golpes cuerpo a cuerpo enemigos (también el golpe de la Abominación), 1 carga de 6 s. Veneno: charco de ácido (1/s), explosión del Hinchado (1 carga), 4 s. Cada carga hace 7,5 en total repartido en su duración (sangrado 1,25/s, veneno 1,875/s) con su propio temporizador; se aplica cada 0,5 s. Máximo 5 por tipo (si está lleno, se renueva la más gastada). Daño de estado: destello en la barra de vida, sin hit-stop, sin cancelar curaciones. El Escupidor aún no existe.

### Curación con tiempo (diseno-v3.md §8.8)
Números en `PRUEBA_V2.applySec` (vendaje 1,5 s, botiquín 2,5 s) y `PRUEBA_V2.applyMoveMult` (0,5).
- Botón rápido de consumible: hay que mantenerlo pulsado. Soltar antes de tiempo o recibir un golpe cancela sin gastar el objeto. Un toque corto no hace nada (avisa "Curación cancelada").
- Mientras aplicas: anillo verde de progreso sobre la cabeza, movimiento al 50 %, sin atacar, apuntar, cambiar de arma, Ejecutar ni habilidades.
- Al terminar: se gasta el objeto, empieza la curación de siempre (venda +30 en 2 s, botiquín +70 en 4 s) y se quitan los estados.
- Decisión: "Usar" desde el inventario y la curación automática por umbral también tardan lo mismo, pero no requieren mantener nada; un golpe sí las cancela. El daño de estado (sangrado/veneno) no cuenta como golpe.

### Implementación v3 (diseno-v3.md §1-§6, §9; números en `src/config/v3.ts`)
- Refugio: 6 estaciones × 3 niveles (Alijo, Bolsillo seguro, Generador, Enfermería, Taller, Radio). El Generador limita el nivel del resto. Fabricar tarda 3 raids, con una cola de 2.
- Materiales (chatarra, tela, componentes, combustible, muestra mutada): salen de cajas, de maleteros de coche (14 por mapa) y de cadáveres. Muestras: Hinchado 50 %, Abominación 2-3, mutados 35 %.
- Bolsillo seguro de 1 a 4 casillas (sección propia en el inventario). Ranura "Espalda" con mochila grande (+8). No puedes quitártela si está llena: "Vacía la mochila antes de quitártela".
- Radio: el nivel 2 marca 1 salida activa; el nivel 3 pone un punto en el minimapa donde está el mejor objeto élite (la zona de la Abominación).
- 3 vendedores (Doc Reyes, Chispas, Hierro) con reputación 1-4, hasta -15 % de precio, y misiones (una activa por vendedor; se renuevan cada 3 raids). Cuando sube la reputación, el stock se repone al momento. El arma de rep. 4 de Chispas trae un 3.er rasgo.
- Recompra: lo suyo al 40 %, lo demás al 20 %. Nunca supera el 40 % del precio de venta más bajo, así que comprar y revender siempre pierde. La recompra no depende de la reputación ni tiene mínimo de 1 chapa. Comprobación: `econCheck` (5260 combinaciones objeto × rareza × cantidad, 4960 entradas de stock generadas, peor proporción 0,40, ninguna receta da beneficio).
- 6 enemigos nuevos: Escupidor (min 3), Chillón (4), Acechador (5), Bruto (6), Reptante (7, sale de 14 alcantarillas) y Enjambre (8). Ninguno avisa fuera de pantalla. Los avisos que se ven a través de la niebla van por encima de ella: ácido, Acechador revelado, burbujas, manchas del enjambre.
- Mutaciones desde el minuto 10 (20 % + 1 %/min, máx. 35 %): blindado, veloz, regenerador, volátil, cada una con su aura de color. Aviso "Minuto 10: aparecen mutados".
- Consumibles nuevos: adrenalina, antídoto, estimulante y granada (lanzada desde el inventario, 45 de daño). También salen como botín en la raid.
- Guardado v3: v1 y v2 se migran sin perder nada (alijo, chapas, estadísticas, registro, ajustes).
- Arte v3: retratos, estaciones y estrellas en `public/art/v3`. Los objetos nuevos llevan iconos provisionales.
- Rendimiento: JS 1.423 kB (395 kB gzip), +4,6 % sobre la v2. Prueba de estrés con ~100 enemigos y 3 capas de niebla: 14-20 fps (antes 16-17). `fogLayers` sigue configurable.

### QA
- `qa/qa.mjs` (v1), `qa/offscreen.mjs`, `qa/fog.mjs`, `qa/stress.mjs`.
- Nuevo `qa/v2.mjs`: 50 comprobaciones de los 7 puntos, la reserva y el endurecimiento para iPhone (actualizado: «Usar» tarda 1,5 s; cadencias nuevas; tiempos en tiempo de juego).
- Nuevo `qa/sigilo.mjs`: 25 comprobaciones de sigilo, migración de guardado v1 y caché del service worker.
- Nuevo `qa/prueba.mjs`: 36 comprobaciones de la prueba v2 (§8) y de la curación con tiempo.
- Nuevo `qa/v3.mjs`: 42 comprobaciones (economía sin arbitraje, estaciones, bolsillos/mochila, materiales, los 6 enemigos y sus reglas de juego limpio, mutaciones, consumibles, misiones, migración v1/v2 → v3).
- Capturas: `qa/shots_v2.mjs` → `shots/v2-*.png`; nuevo `qa/shots_v3.mjs` → `shots/v3-*.png` (sigilo, indicadores y estados, curación, niebla, menú del inventario); nuevo `qa/shots_v31.mjs` → `shots/v31-*.png` (refugio, tiendas, misiones, enemigos nuevos, mutados, granada, inventario).

### Problemas conocidos
- Ejecutar con el bate (12 × 2,5 = 30) solo mata de un golpe a un Errante cerca del minuto 0; con la vida por minuto ya no, y el superviviente pasa a alerta. Si se quiere que siempre sea muerte silenciosa, subir `backstabMult` o darle al Errante un tope de vida para esto.
- El borde difuminado de la niebla son 3 capas con máscara (no un degradado real): se ve un escalonado suave. Cuesta rendimiento: en la prueba de estrés (Chrome sin GPU, ~100 enemigos) 3 capas dan 16-17 fps frente a 20-24 con 1 capa, y 19 frente a 29 al principio. Hay que medirlo en el iPhone; si se nota, `VISION.fogLayers: 1` o `2` en `src/config/v2.ts` (sin tocar código).
- v3: no hay durabilidad, así que el Taller nivel 1 no repara y la misión de Hierro es "extrae con armadura Militar".
- v3: la Azotea es la "Puerta del hospital".
- v3: la granada no tiene botón rápido; solo se lanza desde el inventario.
- v3: el Escupidor y el Chillón se acercan hasta entrar en pantalla antes de atacar. En vertical solo se ven ~4 casillas a los lados y, si no, nunca podrían avisar en pantalla.
- v3: arreglado un fallo antiguo: `hitStop(0)` dejaba el mundo congelado.

### Implementación v3.1 (diseno-v3.md §9, reputación y jugador nuevo; números en `src/config/v31.ts`)
- **Arco y ballesta silenciosos**: disparar no hace ruido. Al caer, el proyectil hace un ruido de 1,5 casillas donde cae (distrae: van a mirar). La flecha va a 7 casillas/s (336 px/s, antes 480) y el virote a 10 (480 px/s).
- **Ballesta** (botín de cajas, con 5 virotes, y en la tienda de Chispas): 24 de daño, 0,4 disparos/s efectivos (0,6 × 0,67 a distancia), alcance 8, peso 3. Usa virotes. Su habilidad «Clavar» (8 s) hace que el siguiente virote atraviese a 2 enemigos y se pare en el 3.º.
- **Recuperar munición**: lo que falla se queda en el suelo con un brillo tenue. De lo que acierta, el 60 % cae junto al cuerpo al morir. Se recoge pasando por encima, sin anillo de saqueo.
- **Daño variable**: cada golpe directo hace entre ×0,72 y ×1,04 de su daño. Crítico ×1,5: 25 % del jugador, 10 % de los enemigos (configurable por lado).
  - No tiran: sangrado, veneno, ácido, niebla, el agarre del Reptante, ni la puñalada/Ejecutar/disparo a un desprevenido (×2,5 fijo y siempre crítico).
  - Números: normal blanco 17 px. Crítico #ffb02e 1,35× (23 px) con «!» y rebote.
  - Daño recibido en rojo (#ff4d4d). El crítico recibido sale naranja rojizo y hace temblar la pantalla.
  - Media: jugador ×0,99 (en la v2 ×1,08 con 10 % × 1,8, así que unos 8 % menos de daño medio). Enemigos ×0,924 (antes ×1,00).
- **Memoria de visión**: lo que sale del cono sigue visible 0,6 s y se apaga. El enemigo que dejas de ver deja una silueta fantasma quieta en su última posición, que se desvanece en 0,6 s y nunca avisa de ataques. La mirada gira como mucho 540°/s.
- **El Trapero**:
  - Aparece en el 50 % de las incursiones, a ≥14 casillas del inicio y oculto hasta que lo ves.
  - Compra solo materiales saqueados en esa incursión, al 70 % de su valor, en vales. Los vales solo valen en su caseta y se pierden al salir o al morir.
  - Vende 3 objetos (Reforzado, Militar y un consumible), 1 unidad de cada uno, al −20 % sobre el precio de reputación 1. Pagas con vales, luego con las chapas que llevas encima y luego con las del refugio.
  - Cierra en el minuto 10 o si hay un enemigo en alerta a ≤4 casillas.
  - La prueba anti-arbitraje incluye su descuento: lo que le compras se revende como mucho al 40 % del precio más bajo.
- **Élites**: el 5 % de las apariciones (nunca la Abominación ni el Enjambre). Vida ×2, daño ×2, tamaño ×1,1 y aura dorada. Sueltan 2 objetos extra, uno de equipo una rareza por encima (tope Militar). Como mucho 3 vivos y 6 por incursión. Se guardan y se restauran en el guardado de la incursión.
- **Reputación** (corrección de Dott/Basu): vender no da reputación. Comprar da como mucho 150 por cada renovación de la tienda. Los niveles 3 y 4 piden 1 y 2 misiones completadas de ese vendedor. Guardado v4: se conserva la XP, pero sin misiones el nivel se queda en 2. La tienda muestra «Comprando: +N rep. más hasta la renovación · vender no da reputación» y la misión que falta.
- **Jugador nuevo de Basu** (`public/art/v3/jugador3_*.svg`): capucha, gafas de soldador, chaqueta, mochila y bufanda naranja.
  - Orden de capas: sombra, pies, bufanda, mochila, torso, brazos, arma, cabeza.
  - La bufanda ondea ±8° a 1,5 ciclos/s, hasta ×1,8 al correr, y se queda quieta en sigilo (cambio suave).
  - La mochila se mueve 1 px al andar, a contrafase del torso.
  - Las gafas destellan 1 fotograma al disparar o al hacer crítico.
  - El jugador anterior sigue disponible con `PLAYER_ART.version = 'v2'`.

### QA v3.1
- Nuevo `qa/v31.mjs`: 48 comprobaciones de arco/ballesta, daño y críticos, memoria de visión, Trapero, élites, reputación, migración, jugador nuevo y una incursión simulada de 15 min. También informa del TTK.
- Las suites anteriores se han actualizado a los números nuevos (flecha 336 px/s, crítico #ffb02e 1,35×, golpes con variación, guardado v4, reputación 4 con misiones). Usan `?noelite` para que los élites aleatorios no cambien sus medidas.
- Capturas: nuevo `qa/shots_v32.mjs` → `shots/v3_1-*.png`.

### Problemas conocidos v3.1
- La caseta del Trapero no es sólida, y los contenedores y las flechas del suelo no tienen memoria de visión (solo el cono y los enemigos).
- El cuerpo del jugador sigue girando al instante; solo la mirada (cono) tiene el tope de 540°/s.
- Ruta material → vales → objeto → revender: ≈0,28 × valor frente a 0,216 × valor vendiendo el material a un vendedor. Mejor cambio, pero no es un bucle: necesita materiales nuevos en cada incursión.
- Rendimiento (stress.mjs en la caja con renderizado por software, 390x844): novato quieto 26 → 19 fps con 65-90 enemigos (v3: 28 → 19); minuto 12 con ~100 enemigos 16 → 10 fps (v3: 18 → 16). El sprite nuevo no es la causa: con el jugador anterior sale casi igual (16 → 12). Parece ruido de la caja (carga ≈7), pero conviene medirlo en un móvil real.

### Implementación v3.2 (pase de rendimiento; números en `src/config/v32.ts`)
- **Recortes de Basu**:
  - Como mucho 30 flechas/virotes en el suelo. Al pasar de 30 desaparece la más vieja, como si se hubiera roto.
  - El aura de élite es un único sprite teñido de dorado (#ffd86a) que late en el bucle de la escena. Ya no lleva tween infinito ni partículas.
  - Como mucho 8 siluetas fantasma a la vez; las más viejas se apagan antes.
- **Manchas de sangre** (Dott): como mucho 60. La más vieja se desvanece en 0,5 s y su objeto se reutiliza; como mucho 12 desvaneciéndose a la vez (antes 160 manchas sin reciclar).
- **Números de daño**: se sacan de una reserva de objetos de texto en vez de crearse y destruirse.
- **Niebla**:
  - El polígono de visión se recalcula a ≈30 Hz, salvo si te mueves más de 10 px o giras más de 0,15 rad.
  - La memoria de visión guarda fotos simplificadas (1 de cada 2 puntos), y solo si la mirada se ha movido.
  - Las fotos se funden en un único polígono por capa, con 120 sectores de 3°.
- **Contador de fps** siempre visible (también sin `?debug`), con el mínimo entre los minutos 12 y 15: «15 fps · mín 12-15: 13».
- **Service worker**: la lista de precarga se genera sola en cada build (plugin `gengi-sw` de `vite.config.ts`, con todo `dist/` salvo `sw.js` y los `.map`). Así ningún arte nuevo se queda fuera del modo sin conexión.

### QA v3.2
- Nuevo `qa/v32.mjs`, con 13 comprobaciones:
  - topes de flechas, fantasmas y manchas, aura sin tween y reserva de números;
  - contador de fps;
  - la precarga del SW cubre todo `dist/`;
  - prueba sin conexión: tras la primera carga, el juego arranca offline y carga todo el arte.
- Nuevo `qa/perf12.mjs`: minuto 12 con Math.random sembrado (semilla 1234), comparable entre versiones.
- Todas las suites en verde: qa, offscreen, fog, v2, sigilo, prueba, v3, v31 (48/48) y v32 (13/13).
- Arreglos del arnés:
  - en v3/v31/v32, el «pin» de enemigos ya no toca cuerpos destruidos;
  - la D6 de v31 reintenta hasta 4 veces, porque fallaba por tiempos.
- Capturas: `qa/shots_v3_2.mjs` → `shots/v3_2-memoria-fantasmas.png` y `shots/v3_2-contador-fps.png`.

### Rendimiento v3 → v3.1 → v3.2 (minuto 12, misma semilla, 3 pasadas intercaladas, caja con renderizado por software)

| Prueba | v3 | v3.1 | v3.2 |
|---|---|---|---|
| Normal: fps reales (media) | 13,5 / 14,0 / 17,7 (15,1) | 11,7 / 11,3 / 12,7 (11,9) | 12,7 / 12,3 / 16,6 (13,9) |
| Normal: mínimo | 14 / 14 / 17 | 10 / 11 / 12 | 13 / 12 / 17 |
| Estrés (arco + élites): fps reales (media) | 14,0 / 13,0 / 13,0 (13,3) | 13,0 / 13,9 / 16,7 (14,5) | 13,9 / 16,6 / 17,8 (16,1) |

- La v3.2 recupera casi toda la caída de la v3.1 (+17 % en normal). Con arco y élites, que es donde actúan los recortes, es la más rápida de las tres.
- La caja tiene ±15 % de ruido entre pasadas (la 3.ª salió más rápida en las tres versiones). Hay que confirmarlo en un móvil real.

### Implementación v4.0 (diseño de Basu, `diseno-v4.md` §1-§5; números en `src/config/v4.ts` y `src/config/levels.ts`)
- **Mochilas y peso** (§1):
  - Riñonera 8 casillas, Escolar 12 (gratuita, como el bate), Senderismo 16 (+1 rápido), Táctica 20 (+1 rápido, curas −15 %), Anómala 26 (lo de dentro pesa un 20 % menos). Sin mochila, 6 bolsillos.
  - El botín pesa por tamaño: pequeño 0,3, mediano 1, grande 2. Armas, armaduras, mochilas y munición usan su peso propio.
  - Con la carga sube el ruido al andar: +1 casilla por encima de 12 de peso, +2 por encima de 20.
  - Mochilas en cajas, en la tienda de Hierro y en el Taller (4 recetas).
- **Mapas por datos** (§5): 4 mapas (El Arrabal, Vía Muerta, El Cráter, La Colmena), con rango de nivel, dificultad, rarezas, multiplicador de experiencia y ganchos de variación por incursión. Solo El Arrabal tiene generador; los otros tres se ven en la Mesa de Mapas como «sin construir».
- **El Arrabal por piezas** (§4):
  - Rejilla 4×4 de distritos de 19×19 casillas hechos a mano, con el mismo conector de calle en los 4 bordes. Aún no se barajan.
  - 3 franjas nevadas fijas: Norte, Oeste y Este. Cada incursión elige una al azar, con su guarida de la Matriarca y su Helipuerto.
  - Distancias medidas (60 semillas × 4 inicios, en casillas):

| Franja | Inicio → nieve (mín/media/máx) | Inicio → helipuerto por camino | Guarida → salida (mín) |
|---|---|---|---|
| Norte | 25 / 25 / 25 | 78 / 96,5 / 115 | 15,6 |
| Oeste | 25 / 26,5 / 28,2 | 95,5 / 104,4 / 112 | 26,4 |
| Este | 25 / 26,4 / 27,7 | 97 / 105,6 / 112,5 | 28,4 |

  - Con la variación «al máximo» (QA): 0 salidas cortadas y 0 guaridas bloqueadas. Unas 6 cajas por incursión quedan detrás de puertas cerradas con llave (es a propósito).
- **Importar sin retroceso**:
  - El guardado (v6) lleva `profileId` y `rev`, y la marca más alta de cada partida se guarda aparte (`gengi.marcas`), también al borrar la partida.
  - Se rechaza importar una copia más vieja de la misma partida. Se aceptan una copia más nueva (cambio de móvil) y una partida distinta.
- **Niveles y experiencia** (§2, números de Basu):
  - Experiencia por muerte según el tipo (élite ×3, Matriarca 400), 2 por caja abierta la primera vez, y misiones de 60 a 150 según la reputación.
  - Al extraer: 40 + 8 por minuto. El Helipuerto da ×1,5 y además 2 objetos Militares al alijo.
  - Coste de cada nivel: 60 + 30·n hasta el 9; desde el 10, el anterior ×1,1.
  - Lo ganado en la incursión no se asegura hasta extraer. En la incursión se ve más claro en la barra (36×2 bajo el personaje), y al cruzar un nivel aparece el aviso «¡Nivel N! (se asegura al extraer)».
  - Muerte: se pierde la experiencia de la incursión y un 25 % del progreso ya ganado hacia el siguiente nivel; nunca se baja de nivel. Se configura en `XP_DEATH`, con los modos 'raid', 'raid+progreso' y 'nada'.
- **Atributos** (§3):
  - 3 puntos por nivel en 8 atributos lineales, que llegan a su efecto máximo con 50 puntos: Agilidad, Resistencia, Sigilo, Suerte, Fuerza, Pulso, Medicina y Carroñero.
  - Todos están conectados en la incursión: velocidad, saqueo, daño recibido, duración de los estados, ruido, «?», botín y subida de rareza, cuerpo a cuerpo, peso, apuntado, crítico, recarga, curas, chapas y ver el botín de las cajas a 3 casillas sin abrirlas.
  - Con 0 puntos no cambian nada, así que las pruebas con semilla siguen igual.
  - Quitar un punto cuesta 2 de los asignados y devuelve 1.
- **Estaciones nuevas**:
  - **Pizarra**: panel de atributos. Nivel 2: quitar un punto sale 1 → 1 una vez cada 3 incursiones. Nivel 3: un reinicio completo gratis cada 10 niveles.
  - **Gimnasio**: +5 al tope de un atributo por nivel (50 → 65). Pide nivel de personaje 12, 20 y 30.
  - Algunas mejoras de estación ahora piden nivel de personaje («Requiere nivel de personaje N»).
- **Interfaz**:
  - Chip «Nv N +F» con mini barra en la cabecera del refugio.
  - En la incursión, botón dorado «+3» que late junto al HUD (arte `ui_subir_nivel`). Abre la hoja lateral de atributos sin pausar; dentro de la incursión no tiene Gimnasio ni reinicio.
  - Iconos de los atributos sacados de `gengi-art/v4/`.

**Simulación de progreso** (incursión buena en el mapa 1 ≈ 530 de experiencia; normal ≈ 300):

| Nivel | Experiencia total | Incursiones buenas | Incursiones normales | Con mapas 2 (×2,5 desde el 8) y 3 (×6 desde el 18)* |
|---|---|---|---|---|
| 5 | 540 | 1,0 | 1,8 | 1,0 |
| 10 | 1890 | 3,6 | 6,3 | 2,9 |
| 15 | 4105 | 7,7 | 13,7 | 4,5 |
| 20 | 7674 | 14,5 | 25,6 | 6,5 |
| 25 | 13422 | 25,3 | 44,7 | 8,3 |

\*Hipotético (los mapas 2 y 3 aún no se pueden jugar): con el ×6 del mapa 3 se pasa del 18 al 25 en menos de 2 incursiones, así que Dott debería revisar ese multiplicador antes de abrirlo.

### QA v4.0
- `qa/v4.mjs`: 51/51. Cubre mochilas y peso, ruido por carga, mapas por datos, las 3 franjas, distancias, variación «al máximo», migraciones 4 → 5 → 6 y la raid activa del mapa viejo.
- `qa/levels.mjs`: 36/36. Cubre curva, experiencia por muerte, caja, extracción, Helipuerto, penalización por muerte, atributos y sus efectos, Pizarra, Gimnasio, interfaz, misiones e importación sin retroceso.
- Suites anteriores contra la build v4: qa, offscreen, fog, v2, sigilo, prueba, v3, v31 y v32. Solo se ajustaron las comprobaciones que daban por hecho la versión de guardado o las 6 estaciones de la v3.
- Capturas: `shots/v4_0-panel-atributos.png`, `shots/v4_0-barra-xp-mas3.png` y `shots/v4_0-pizarra-refugio.png`.
- **Pendiente**:
  - Las rarezas por mapa no están conectadas (solo se juega el mapa 1).
  - Falta la ventaja especial cada 10 niveles (Segundo aliento) y los cambios v4 de la Radio 2/3.
  - Gimnasio y Pizarra usan de icono `atributo_fuerza` y `ui_subir_nivel`, porque Basu no dibujó icono de estación.

### Implementación v4.2 (Zona Helada, primer bloque)
- **Enemigos de la nieve** (`config/v42.ts`, `SNOW_ENEMIES`; se activan solo en la franja de nieve y reutilizan la IA base):
  - Errante → **Congelado** (32 de vida): caparazón de hielo; el primer golpe hace ×0,5 y lo rompe. El caparazón se guarda en la partida.
  - Corredor → manada de 3 **Lobos mutados** que rodean por los dos lados; su mordisco sangra el 50 % de las veces.
  - Escupidor → **Escarcha**: bola de hielo que ralentiza un 40 % durante 2 s, sin veneno.
- **La Matriarca** (jefa de la guarida; sustituye a la abominación de la guarida, 2.000 de vida ×1,3 en nieve, arte de Basu con 2 brazos animados):
  - Se activa si te ve, la alertan o entras a 3,5 casillas con línea de visión, dentro de 9 casillas de la arena. Si te alejas más de 15, vuelve a casa.
  - Pisotón (anillo, 1 s, 3 casillas), 3 lanzas de hielo (aviso de 0,8 s; las paredes y columnas cortan la lanza), aliento helado (cono de 60° durante 2 s que deja 4 charcos que ralentizan 6 s).
  - Llamada al 60 % y al 30 %: 4 Congelados y 2 Lobos.
  - Fase 2 (< 40 %): más rápida, encadena pisotón y lanzas, y caen carámbanos con sombra 1 s antes.
  - Por la espalda recibe ×2 y no se tambalea. Al morir da 400 de experiencia y el botín de la guarida sigue en su caja.
  - Regla de oro respetada: ningún aviso empieza fuera de pantalla.
- **Pendiente de §4**: huellas en la nieve, nieve que amortigua y placas de hielo que crujen, inercia al resbalar en el hielo, Ventisca, búnker y remonte, y columnas propias de la arena (de momento cubren las paredes del distrito de la guarida).

### QA v4.2
- `qa/v42.mjs`: 16/16. Cubre la guarida, los cambios de la nieve, el caparazón, la sangría, la ralentización, los 4 ataques, la llamada, la fase 2, la espalda, la IA natural, la muerte y su botín, y restaurar a media pelea.
- Todas las suites anteriores se ejecutan contra la build v4.2 (`runv42all.sh`).

### Implementación v4b (reglas de la nieve y rarezas por mapa)
- **Reglas de la nieve** (`config/v42.ts`, `SNOW_RULES`; código en `raid/snow.ts`):
  - **Huellas** (arte `huella`): dejas una cada 0,6 casillas en la nieve y duran 20 s (máx. 70). Los enemigos que aún no te han detectado y encuentran una (a 1,3 casillas) siguen el rastro hacia las más nuevas. Los enemigos que se mueven cerca también dejan huellas, más oscuras.
  - **La nieve amortigua**: el ruido de los pasos ×0,7 en la nieve.
  - **Placas de hielo**: 12 placas visibles (arte `placa_hielo`), fijas por trazado y franja. Al pisarlas crujen (ruido de 5 casillas, aviso la primera vez) y resbalan (inercia ×2).
  - **Ventisca** (todo el mapa): la primera llega entre los 3 y 4 minutos, y luego cada 3-4 min. Dura 25 s con la vista del jugador y de los enemigos a 4 casillas, con aviso 5 s antes y la capa `fx_ventisca`.
  - **Columnas de la arena**: la presa ya tenía 6 columnas de 1,2 casillas (cortan las lanzas); ahora lo comprueba la QA.
- **Rarezas por mapa** (§5): la incursión fija el mapa activo y las tiradas usan su rango y sus `pesosRareza`. Mapa 1: Común-Militar, como antes (la Chatarra sigue sin caer), y solo la guarida da Anomalía. Mapa 2: Común-Anomalía. Mapa 3: Reforzado-Reliquia. Mapa 4: Militar-Reliquia. El jefe puede llegar a `rarezaJefe`.
- **Depuración**: `gengi.lootDist(mapa)` da el reparto de rarezas de las cajas, la élite y la guarida, y `enemies.despawn(e)` quita un enemigo sin dejar cadáver (para capturas).

### QA v4b
- `qa/v4b.mjs`: rarezas de los 4 mapas, placas, amortiguación, crujido, resbalón, huellas, rastreo, huellas de enemigos, Ventisca y columnas.
- **Arreglo de `qa/v3.mjs`, que fallaba a veces**:
  - La granada fallaba si el sitio de prueba caía en la nieve: el Errante salía Congelado y su caparazón partía el daño a la mitad. Ahora la suite v3 apaga los enemigos de la nieve.
  - La adrenalina fallaba con el 10 % de crítico enemigo (×1,5). Ahora esa comprobación se hace con el crítico a 0.
- Capturas: `shots/v4_2-nieve-enemigos.png` (repetida: manada de 3 lobos, sin cadáveres), `shots/v4b-ventisca.png` y `shots/v4b-placa-hielo.png`.
- **Pendiente**: búnker con código y remonte, Segundo aliento, Radio 2/3 y los iconos del Gimnasio y la Pizarra.

### Revisión de experiencia v4b (Dott y Basu)
- **Helipuerto**: el ×1,5 ya no se aplica a la experiencia del jefe (la Matriarca da 400, aparte). Fórmula al extraer: `(experiencia − jefe + extracción × mapa) × 1,5 + jefe`.
- **Mapa por su id de definición**: la incursión guarda `mapDefId` (MapDef.id) además de `mapId` (el saveId, «arrabal-v4»). Los multiplicadores se buscan por `mapDefId`; en guardados viejos se busca por el saveId.
- **Oleadas y hordas**: dan el 30 % de experiencia, sin tope. Cuenta todo lo que entra por oleada (también chillones y enjambres de la v3), las hordas por ruido, los gritos del chillón y el corredor por quedarse quieto. No cuenta la población inicial.
- **Tope blando**: cuando la experiencia base por muertes de la incursión pasa de 1.500, cada muerte siguiente da la mitad. Se aplica antes del ×mapa y el jefe siempre da la suya entera.
- Valores en `config/levels.ts`: `XP.waveMult 0,3`, `XP.killSoftCap 1500`, `XP.overCapMult 0,5`.
- **Curva** (`XP_CURVE.bands`): lineal del 1 al 9 (60 + 30n). Después cada nivel cuesta lo del anterior × 1,10 (10-14), × 1,20 (15-24) y × 1,10 (25 en adelante). El 14 cuesta 531, el 15 638, el 24 3.291 y el 25 3.620.
- **Mesa de Mapas** (encima de «▶ EMPEZAR RAID»):
  - Una polaroid por mapa.
  - Por debajo del nivel mínimo sale con candado y «Requiere nivel N». No se puede elegir ni empezar.
  - Los mapas sin generador salen con candado y «En construcción».
  - Por encima del nivel máximo sale «Superado», pero sigue disponible. Si no, un nivel 10 no tendría ningún mapa jugable hasta que exista la Vía Muerta.
  - Los rangos se aplican también al cargar y al importar. Si el mapa elegido no está permitido, se vuelve a El Arrabal. Si hay una incursión a medias en un mapa no permitido, se repuebla en El Arrabal.

**Simulación de una incursión buena en el mapa 1** (40 muertes, 2 élites, 15 cajas, una misión media de 105, extraer en el minuto 13):

| Muertes de oleada | Experiencia | Por helipuerto |
|---|---|---|
| 0 % | 530 | 795 |
| 35 % | 479 | 718 |
| 50 % | 457 | 685 |
| 100 % | 384 | 576 |

- Los componentes son: cajas 30, misión 105 (60-150), extracción 144, élites 42 y 38 muertes normales a 5,5 de media (209).
- El tope de 1.500 no se nota en una incursión normal, que hace unos 180 de base por muertes.
- Dott tenía razón: con la mitad de las muertes de oleada queda en unos 460, por debajo de 550.

**Incursiones necesarias con la curva nueva** (incursión buena ≈ 457):

| Nivel | Experiencia total (antes → ahora) | Incursiones buenas en el mapa 1 |
|---|---|---|
| 5 | 540 → 540 | 1,2 |
| 10 | 1.890 → 1.890 | 4,1 |
| 15 | 4.105 → 4.105 | 9,0 |
| 20 | 7.674 → 8.850 | 19,4 |
| 25 | 13.422 → 20.659 | 45,2 |

- **Del 18 al 25** cuesta 14.233 (antes 7.382). En el Cráter (×6) una incursión buena da unos 2.740-2.870, así que hacen falta **unas 5 incursiones buenas** (4,5 sin oleadas, 5,2 con la mitad de oleadas y 6,2 con todo oleadas). Cumple el objetivo de Dott.
- Del 10 al 18 en la Vía Muerta (×2,5) son unas 4 incursiones buenas.

### QA de la revisión de experiencia v4b
- `qa/v4b.mjs` (X1-X6 y M1-M4) comprueba:
  - la curva por tramos;
  - las oleadas ×0,3 y el tope de 1.500 con ×0,5;
  - que lo que entra por oleada lleva la marca;
  - que se guarda `mapDefId`;
  - el helipuerto sin el ×1,5 sobre el jefe (610);
  - un segundo MapDef ×2,5, resuelto por mapDefId y por saveId;
  - la Mesa de Mapas: candado, «Requiere nivel 5», no se puede empezar por debajo del nivel y «Superado» sigue disponible;
  - la importación de un guardado con un mapa no permitido.
- `__snowPt` es ahora determinista: recorre una rejilla en vez de usar puntos al azar.
- `qa/v42.mjs`: ahora es determinista.
  - B3 y B4 usan un `Math.random` con semilla (`__seed`). `__snowPt` recorre una rejilla y solo da puntos con un pasillo libre de 6 casillas.
  - B4 quita las placas de hielo mientras mide la velocidad y la mide en tiempo de juego, no de reloj.
  - Antes fallaba de vez en cuando: un 50 % medido con 600 tiradas al azar, o el jugador resbalaba sobre una placa.
- Resultado final contra la build v4b: qa 23/23, offscreen 11/11, fog sin fallos, v2 50/50, sigilo 25/25, prueba 36/36, v3 42/42, v31 48/48, v32 13/13, v4 51/51, levels 36/36, v42 16/16 y v4b 26/26.
- Captura nueva: `shots/v4b-mesa-mapas.png`.

### Implementación v4c (notas de progreso)
- Punto 1: la ventisca y las huellas se guardan en la incursión, en el campo opcional `snowState`. No hace falta subir la versión del guardado: los guardados de antes empiezan sin ventisca.
- Punto 2: `newRaidSnapshot(seed, …, defId)` y `mapForRaid()` calculan el inicio y las salidas sobre el MapDef elegido. Un mapa sin zona de nieve no tiene franja nevada, y `SnowRules.active` apaga huellas, hielo y ventisca.
- Punto 3: la cinta `cinta_superada.svg` de Basu va sobre la polaroid de los mapas superados. Entra sola en la precarga, porque se genera con todo `dist`.
- El tope de 1.500 no cambia en la v4c: se quita entero en la v4d (Basu, §7). Los mapas superados siguen dando experiencia.
- Nuevo `qa/v4c.mjs`, 7 comprobaciones:
  - K1-K2: la ventisca y las huellas siguen al reabrir la app;
  - K3: el inicio y las salidas salen del MapDef;
  - K4: un mapa sin nieve no tiene sistemas de nieve;
  - K5-K6: la cinta sale en la mesa y está en la precarga;
  - y sin errores en la página.
- Captura nueva: `shots/v4c-mesa-mapas.png` (`qa/v4cmesa.mjs`).

### QA v4c
- Todas las suites contra la build v4c (`dist-v42`, puerto 4178), un solo ejecutor cada vez: qa 23/23, offscreen 11/11, fog sin fallos, v2 50/50, sigilo 25/25, prueba 36/36, v3 42/42, v31 48/48, v32 13/13, v4 51/51, levels 36/36, v42 16/16, v4b 26/26 y v4c 7/7.
- v31 falló una vez la D6 y otra la A3/E2, siempre por tiempos (son fallos intermitentes ya conocidos). Pasada sola, dio 48/48.

### Implementación v4d (diseno-v4.md §7, cambios de Pablo; números en `src/config/v4d.ts`)
- **Rangos de mapas**: salen de `MAP_RANGES`. Cada mapa ocupa una línea, así que cambiar un rango es cambiar una línea.
  - Arrabal 1-12, Vía Muerta 5-22, Cráter 12-40 y Colmena 22-40.
  - Colmena antes no tenía máximo.
- **Experiencia**: se quita el tope de 1.500 (`XP4D.removeKillCap`). Las bajas de oleada siguen dando el 30 %. Los cazadores no cuentan como oleada y dan la experiencia entera.
- **Presión al final** (`LATE_RAID`):
  - Los enemigos escalan +4 %/min hasta el minuto 10 y +9 %/min desde ahí: ×1,40 en el minuto 10 y ×1,58 en el 12.
  - En el minuto 10 sale el aviso «⚠ Se acercan cazadores».
  - Desde el minuto 11 aparece un cazador cada 60 s. Es un élite (corredor, bruto, errante o acechador) que nace a 12-18 casillas, fuera de pantalla, y va a investigar tu último ruido (o tu posición si no has hecho ruido).
  - Desde el minuto 13, la niebla va con un reloj propio (`fogT`) que corre ×2, así que llega hacia el minuto 14. El aviso pasa a ser «⚠ La niebla tóxica avanza el doble de rápido: llega en N min», y el temporizador muestra el tiempo real que queda.
  - `fogT`, el temporizador de cazadores, el aviso y la marca de cazador de cada enemigo se guardan en la incursión.
- **Armas a distancia** (`RANGED`):
  - Ya no disparan solas; el cuerpo a cuerpo sigue siendo automático.
  - Tiempo entre disparos: pistola 0,8 s, arco 1,4 s, ballesta 1,8 s y escopeta 1,2 s. El rasgo «cadencia» sigue dando +10 %.
  - Arco y ballesta usan flechas, y la ballesta dispara su proyectil de virote con flechas. Las recuperadas y las del suelo son flechas.
  - Los virotes salen del botín y de la tienda. Guardado v7: la migración 6→7 convierte todos los virotes en flechas (refugio, equipo, incursión en curso y flechas en el suelo). La definición del objeto se queda por seguridad.
- **Munición en el HUD**:
  - Contador junto al joystick derecho: «8 / 24» si el arma tiene cargador y «14» si usa flechas.
  - El botón de cambio de arma lleva un número pequeño con la munición del arma de reserva.
  - El contador parpadea en rojo si quedan 3 o menos en total (cargador + reserva).
- **Escopeta** (`SHOTGUN`; arte de Basu: `arma_escopeta.svg`, `cartucho.svg` y `fx_cono_escopeta.svg`):
  - Disparo: 6 perdigones × 7 en un cono de 25°, con 4,5 casillas de alcance. Al 60 % a partir de 3 casillas.
  - Una sola tirada de crítico por disparo, que vale para todos los perdigones.
  - Recarga: cargador de 4 y 0,5 s por cartucho. Disparar corta la recarga si queda alguno dentro. Sin apuntar, va metiendo cartuchos sola.
  - Ruido 9 y peso 4. Tambaleo fuerte: 110 de empuje por perdigón y 0,4 s.
  - Munición «Cartuchos» (pila de 24).
  - Disponibilidad: sale en el botín (peso 2,5, y trae 4 cartuchos) y en la tienda de Chispas (170; los cartuchos, 8).
- **Habilidades temporales** (`WEAPON_BUFFS`). Ya no disparan, solo dan un efecto. Mientras duran, el botón muestra los segundos que quedan, y se guardan en la incursión.
  - Ráfaga (pistola): mitad del intervalo durante 4 s; recarga de 20 s.
  - Ojo de halcón (arco): +50 % de crítico durante 6 s; recarga de 22 s.
  - Perforación (ballesta): hasta 3 enemigos por flecha durante 6 s; recarga de 22 s.
  - Postas concentradas (escopeta): cono de 12° y +40 % de alcance durante 5 s; recarga de 20 s.
- **Botones** (`HUD4D`):
  - Arco de habilidades encima del joystick derecho, de izquierda a derecha: arma, casco y chaleco.
  - Vendaje y botiquín van fijos en dos botones de 44 px, apilados a la izquierda del arco y con su número.
  - Con `HUD4D.layout = false` vuelve la disposición anterior.
- **Niebla v2** (`FOG2`; `src/raid/vision2.ts`; `FOG2.enabled = false` vuelve a la niebla anterior):
  - Una sola RenderTexture a 1/4 de la resolución de pantalla, con filtrado lineal y opacidad del 45 %. Va anclada al mundo: al moverse la cámara, la memoria se desplaza con ella.
  - Cada frame se oscurece toda la máscara con k = 1 − exp(−dt/τ), con τ = 0,15 s. La memoria se apaga igual a 30 y a 60 fps: queda un 2 % a los 0,6 s.
  - Después se borra encima la visión actual:
    - un círculo de 2,5 casillas, también por la espalda, con borde degradado de 1 casilla;
    - el cono, en un abanico de 64 rayos con oclusión de muros, con degradado en el final (1,5 casillas) y en los lados (10°).
  - El degradado se hace por vértice y no con una textura rotada; el resultado (bordes suaves) es el mismo.
  - El giro de la vista está limitado a 540°/s.
  - Las siluetas fantasma usan la misma curva, exp(−t/τ), y las poses recientes de la máscara.
  - Detalle técnico: en Phaser 3.90, `RenderTexture.resize()` no redimensiona el framebuffer, así que las texturas se crean ya con su tamaño (y se rehacen si cambia la pantalla).
- **Depuración**: `gengi.v4d()` (configuración, estado de la incursión, HUD, máscara de niebla, cazadores y migración).
- **Arreglos durante el QA v4d**:
  - Con la mochila escolar, el botón del botiquín no hacía nada (seguía mirando los huecos rápidos de la mochila). Ahora, con `HUD4D.fixedHeal`, funciona siempre.
  - `lingerCount()` de la niebla v2 cuenta solo las poses de la memoria que aún se ven y que no son la vista actual. Quieto es 0, igual que con la niebla anterior.
- **Suites antiguas adaptadas a v4d** (en `qa/`):
  - prueba P5/P6/P8: 1 máscara; cadencias de 0,8 y 1,4 s; botón propio del botiquín.
  - v31 A2-A5: munición compartida y Perforación en lugar de Clavar. H1 va sin cazadores (se prueban en v4d L3).
  - v32 N2: con la niebla v2 no hay fotos ni polígonos.
  - v4 C1/F1 y v4b M3 / v4c K5: segundo botón siempre visible, rangos nuevos y nivel 13.
  - v4b X2: sin tope.
  - levels S1: guardado v7.
  - offscreen: el bloque del disparo automático activa `RANGED.autoFire`.
  - Arreglos de las propias pruebas:
    - qa 1b: el panel se fuerza también encima del botón nuevo.
    - v2 5: la lista de números se vacía antes de medir.

### Rendimiento v4d (niebla v2 frente a v4b, minuto 12)
- Prueba: `perf12.mjs` en 3 rondas intercaladas (v4b en el 4179, v4d en el 4178), con la misma semilla.
  - Normal: bate, sin élites.
  - Estrés: arco y élites. En v4d se activa `RANGED.autoFire=true` para que dispare igual que en v4b.
  - `perf_v4d.sh` / `perf_v4d.out`.

| Minuto 12 | fps reales (media de 3) | fps del juego (media) | p95 por fotograma | paso del juego (mediana) |
|---|---|---|---|---|
| v4b normal | 19,4 (18,5 / 19,4 / 20,4) | 21,6 | 66,7 ms | 3,4 ms |
| **v4d normal** | **26,8** (26,4 / 28,3 / 25,6) | **29,2** | **50,1 ms** | **2,5 ms** |
| v4b estrés | 19,8 (20,4 / 17,5 / 21,4) | 22,1 | 66,7-83,4 ms | 3,0 ms |
| **v4d estrés** | **26,7** (26,4 / 25,3 / 28,4) | **28,0** | **50,1 ms** | **2,7 ms** |

- La niebla v2 sustituye los ~1.500-1.750 polígonos de máscara por ráfaga de la v4b (`maskPolys`) por una sola textura a 1/4 de resolución. Mejora un 35-38 % en los dos casos.

### QA v4d
- Todas las suites se pasan contra la build v4d (`dist-v42`, puerto 4178), una detrás de otra y con un solo ejecutor (`qa-run/runv42all.sh`, salida en `runv4d_full2.out`). Los resultados se apuntan aquí al acabar cada suite.
- qa 23/23 · offscreen 11/11 · fog sin fallos · v2 50/50 · sigilo 25/25 · prueba 36/36 · v3 42/42
- v31: 47/48 en la pasada completa (fallo en la D6, el del Trapero; es el fallo intermitente de tiempos ya apuntado en la v4c). Pasada sola, 48/48.
- v32 13/13 · v4 51/51 · levels 36/36 · v42 16/16 · v4b 26/26 · v4c 7/7 · **v4d 31/31**
- Capturas: `shots/v4d-hud-armas.png`, `v4d-hud-pistola-arco.png`, `v4d-municion-baja.png`, `v4d-escopeta-disparo.png`, `v4d-aviso-cazadores.png`, `v4d-niebla-antes-quieto.png`, `v4d-niebla-antes-girando.png`, `v4d-niebla-despues-quieto.png` y `v4d-niebla-despues-girando.png`.
- Paquetes: `/workspace/gengi-v4d.tar.gz` (copiado también a `gengi-v1.tar.gz`) y `/workspace/gengi-docs-v4d.tar.gz`. No se ha subido nada a GitHub.

## v4e (B5 inestable, munición del bolsillo seguro, recarga de la escopeta)

### B5 de qa/v31 (golpe por la espalda ×2,5) a veces hacía la mitad
- **Causa (de la prueba, no del juego):** cuando la incursión ponía al jugador en la Zona Helada, el muñeco de prueba (`__dummy('errante', …)`) salía como **Congelado**. Lo hace `SNOW_ENEMIES` en `spawnAt`. Su caparazón de hielo hace ×0,5 en el primer golpe, así que salían 25 en vez de 50. Caso reproducido: `{"n":50,"loss":25,"ice0":true,"type":"congelado"}`.
- La misma causa afectaba a la E2: la vida ×1,3 de la nieve (`V4.SNOW.enemyMult`).
- **Arreglo, solo en la prueba:**
  - `__calm` de `qa/v31.mjs` apaga la nieve como hace `sigilo.mjs`: `SNOW_ENEMIES`, sonido amortiguado, huellas, ventisca, `enemyMult = 1` y placas.
  - La B5 siembra `Math.random` (mulberry32, semilla 12345) y lo restaura al terminar.
  - La B5 acepta los dos modos de `DAMAGE.backstabRolls`:
    - `false` (lo actual): exactamente 20 × 2,5 = 50;
    - `true`: cada golpe entre 20 × 0,72 × 2,5 y 20 × 1,04 × 2,5.
  - Comprueba también que el blanco es un Errante y que no hay crítico ×1,5 encima.
- **Aviso:** la nota de Basu dice que la variación 0,72-1,04 se aplica al ×2,5, pero `config/v31.ts` tiene `backstabRolls: false`. No se ha tocado; hay que decidirlo.
- Resultado: v31 10 de 10 seguidas a 48/48 (`qa-run/o42_v31_r1..10.log`) y sigilo 25/25.

### Munición del bolsillo seguro (fallo del juego)
- **Antes:** el HUD sumaba mochila + bolsillo seguro, pero la recarga de pistola y escopeta solo sacaba de la mochila. Salía «0 / 24» junto a «¡Sin munición!».
- **Ahora todas las municiones van por el mismo camino** (`RaidScene.ammoLeft(id)` / `takeAmmo(id, n)`):
  - se saca primero de la mochila y luego del bolsillo seguro (y del bolsillo extra);
  - flechas, balas y cartuchos lo usan igual, y también el HUD y la línea de depuración;
  - el número del HUD es exactamente lo que se puede recargar.

### Recarga de la escopeta (Basu, diseno-v4 §7)
- La recarga empieza solo tras `SHOTGUN.reloadDelaySec` (0,8 s) sin apuntar ni disparar.
- Luego mete 1 cartucho cada `reloadPerShellSec` (0,5 s).
- Apuntar o disparar la corta (`stats.shellCuts`), y el reloj de reposo vuelve a empezar.
- Sin cambios: cargador de 4, daño 6 × 7 y el tiempo por cartucho.
- Con algún cartucho dentro se puede disparar siempre.
- «¡Sin cartuchos!» solo sale cuando no quedan en la mochila ni en el bolsillo.

### QA v4e
- Suite nueva `qa/v4e.mjs`, 11/11:
  - K1-K5: la pistola y la escopeta recargan del bolsillo; mochila 3 + bolsillo 5 da «0 / 8» y entran las 8; sin nada, «0 / 0» y el aviso; el número del HUD coincide con lo que se recarga (16 → 12 + 4).
  - G1-G5:
    - valores en config;
    - fuego seguido (1,2 s) vacía el cargador sin meter ningún cartucho;
    - el 1.er cartucho entra a ~1,31 s de soltar;
    - apuntar corta la recarga y vuelve a esperar 0,8 s;
    - disparar la corta.
- v4d S4 se ha actualizado: el 1.er cartucho ya no entra a los 0,5 s, sino tras 0,8 s de reposo.
- Pasada completa (`qa-run/runv4e_full.out`, un solo ejecutor, `dist-v42` en el 4178):
  - qa 23/23 · offscreen 11/11 · fog sin fallos · v2 50/50 · sigilo 25/25 · prueba 36/36 · v3 42/42 · v31 48/48
  - v32 13/13 · v4 51/51 · levels 36/36 · v42 16/16 · v4b 26/26 · v4c 7/7 · v4d 31/31 · **v4e 11/11**
- Paquetes: `/workspace/gengi-v4e.tar.gz` (copiado a `gengi-v1.tar.gz`) y `/workspace/gengi-docs-v4e.tar.gz`. No se ha subido nada.
