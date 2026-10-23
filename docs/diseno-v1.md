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
- Visión: cono 220°, alcance 15 casillas, niebla al 62 % de opacidad (el suelo se ve). Aviso por detrás a menos de 4 casillas.
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

### QA
- `qa/qa.mjs` (v1), `qa/offscreen.mjs`, `qa/fog.mjs`, `qa/stress.mjs`.
- Nuevo `qa/v2.mjs`: 50 comprobaciones de los 7 puntos, la reserva y el endurecimiento para iPhone.
- Nuevo `qa/shots_v2.mjs`: capturas en `shots/v2-*.png`.
