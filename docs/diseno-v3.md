# GenGi: diseño v3 (Basu). Refugio, vendedores y enemigos

## 1. Materiales (nuevo tipo de botín)
Se encuentran en raids y sirven para mejorar el refugio. Pequeños, apilables, se pierden al morir (salvo en el bolsillo seguro).
| Material | Dónde abunda | Uso |
|---|---|---|
| Chatarra | Calles, coches | Alijo, Taller |
| Tela | Casas, tiendas | Enfermería, Bolsillo seguro |
| Componentes | Comisaría, almacén | Radio, Taller, Generador |
| Combustible | Coches, gasolinera | Generador |
| Muestra mutada | Cadáver de Hinchado/Abominación | Enfermería n3, misiones |

## 2. Refugio: estaciones (nivel 1 → 3)
Mejorar cuesta chapas + materiales. Algunas exigen el Generador a cierto nivel (cuello de botella intencionado).
| Estación | Nivel 1 (inicial) | Nivel 2 | Nivel 3 |
|---|---|---|---|
| Alijo | 30 casillas | 45 (400 chapas, 10 chatarra) | 70 (1200, 20 chatarra, 5 componentes) |
| Bolsillo seguro | 1 casilla | 2 casillas (600, 8 tela) | 4 casillas (2000, 15 tela, 5 componentes) |
| Generador | Básico | Permite nivel 2 del resto (500, 6 combustible) | Permite nivel 3 (1500, 12 combustible, 6 componentes) |
| Enfermería | — | Fabrica vendajes con tela (300, 6 tela) | Fabrica botiquines y adrenalina (1000, 4 muestras) |
| Taller | Repara durabilidad | Fabrica munición y flechas (400, 10 chatarra) | Mejora 1 rasgo extra de un arma o armadura (1400, 8 componentes) |
| Radio | Sabes los nombres de las extracciones | Al empezar se revela 1 extracción (700, 6 componentes) | Sabes en qué zona está la Abominación y su botín (1600, 10 componentes) |
Fabricar tarda "3 raids" (no tiempo real, para que funcione sin conexión y sin trampas con el reloj).

## 3. Vendedores
Cada uno tiene reputación (nivel 1-4). Sube comerciando con él y completando sus misiones. Más reputación = mejores rarezas en la tienda y mejores precios (-5 % por nivel).
El stock se renueva cada 3 raids. Cada vendedor compra su categoría al 40 % (ver sección 6); el resto de categorías y los materiales al 20 %. El equipo gratis no se vende.

| Vendedor | Vende | Nivel 1 | Nivel 2 | Nivel 3 | Nivel 4 |
|---|---|---|---|---|---|
| Doc Reyes (médica de campaña) | Vendajes, botiquines, adrenalina, granadas, bengalas | Vendajes | Botiquines, bengalas | Adrenalina, granadas | Antídoto de ácido, estimulante de visión |
| Chispas (armero) | Armas, munición, flechas | Común | Reforzado | Militar | 1 arma Militar con rasgo garantizado por renovación |
| Hierro (chatarrero blindado) | Armaduras, cascos, mochilas | Común | Reforzado | Militar | Mochilas grandes |

Misiones (3 activas por vendedor, se elige una). Ejemplos:
- Doc Reyes: "Trae 3 muestras mutadas", "Extrae con menos de 20 de vida", "Cúrate 5 veces en una raid".
- Chispas: "Mata 10 Corredores con arma a distancia", "Extrae por la Azotea del hospital", "Mata una Abominación".
- Hierro: "Extrae llevando armadura Militar sin que se rompa", "Recibe 300 de daño en una raid y sobrevive", "Trae 15 chatarra".
Recompensa: chapas + reputación + a veces un objeto.

## 4. Enemigos nuevos (por minuto de aparición)
Todos siguen la regla de oro: el ataque se anuncia y se puede esquivar; ninguno empieza a atacar fuera de pantalla.
| Enemigo | Desde | Ataque | Aviso | Cómo contrarrestarlo |
|---|---|---|---|---|
| Escupidor | min 3 | Escupe una bola de ácido lenta (6 casillas/s) desde lejos y se aleja si te acercas | Se infla la garganta 0,6 s, brillo verde | Moverse de lado; acortar distancia por coberturas |
| Chillón | min 4 | No hace daño: grita y atrae a todo en 12 casillas, y sube la dificultad local 2 min | Se yergue y abre la boca 1,2 s | Matarlo antes de que grite (prioridad), o huir de la zona |
| Acechador | min 5, interiores | Emboscada por la espalda (25 daño) | Es casi invisible: solo se ve a menos de 3 casillas o en tu cono de visión como distorsión; borde rojo si está detrás | Usar el cono de visión, mirar atrás, no lootear dando la espalda a puertas |
| Bruto | min 6 | Golpe en arco frontal (30) y carga corta | Levanta los brazos 0,8 s; arco rojo en el suelo | Su frente blindado reduce el daño un 70 %: hay que flanquearlo |
| Reptante | min 7 | Sale de alcantarillas y te agarra 2 s (inmoviliza) | Charco que burbujea 1 s antes | Pisar fuera; si te agarra, mover el joystick rápido de lado a lado acorta el agarre |
| Enjambre | min 8 | 8-12 bichos pequeños y rápidos (5 de vida, 3 de daño) | Mancha oscura que se acerca + borde que vibra visualmente (y ruido de patas si hay sonido) | Armas de área (machete, escopeta, Hinchado cerca) |

Mutaciones (a partir del min 10): cualquier enemigo puede salir mutado con un aura de color y un rasgo: Veloz (+40 % velocidad), Blindado (+60 % vida), Volátil (explota al morir como un Hinchado), Regenerador (recupera vida si no le pegas 3 s). Mucha variedad con poco arte nuevo.

## 5. Orden recomendado para programar
1. Materiales + 3 vendedores con reputación (sin misiones).
2. Estaciones Alijo, Bolsillo seguro y Generador.
3. Escupidor, Chillón y Bruto (son los que más cambian el combate).
4. Misiones, resto de estaciones y resto de enemigos.
5. Mutaciones.

## 6. Reglas de seguridad (aportadas por Dott)
- Economía: cualquier vendedor compra como máximo al 40 % del precio de venta más bajo de ese objeto en cualquier tienda (con la reputación máxima incluida). Comprar y vender nunca da beneficio.
- Ataques a distancia (Escupidor y futuros): solo dispara si está en pantalla y dentro de tu cono de visión; su proyectil siempre es visible, también al atravesar la niebla.
- Ataques por la espalda (Acechador): está en pantalla aunque fuera del cono; antes de atacar, el borde rojo late fuerte en su lado 0,8 s. Siempre hay aviso, aunque no lo veas.
- Acechador: antes de atacar se vuelve visible 0,6 s (siempre, aunque esté fuera del cono).
- Reptante: tras un agarre, 4 s de inmunidad a agarres; mientras te agarra, el resto de enemigos te hace un 50 % menos de daño.

## 7. Sigilo (idea de Pablo)
### Ruido del jugador (anillo tenue alrededor del personaje que muestra su alcance)
| Movimiento | Joystick | Velocidad | Radio de ruido |
|---|---|---|---|
| Sigilo | menos del 40 % | 35 % | 1 casilla |
| Andar | 40-85 % | 70 % | 3 casillas |
| Correr | más del 85 % | 100 % | 6 casillas |
- Suman ruido: armadura pesada (+1 casilla con chaleco militar), abrir puertas (3), cajas cerradas (4), disparar (según arma), cristales y latas del suelo (5, se ven si te fijas).
- El ruido se oye a través de paredes a la mitad de distancia.

### Percepción de los enemigos
- Vista: cono de 110° y 6 casillas, cortado por paredes. De espaldas no te ven.
- Oído: si estás dentro de tu radio de ruido, lo oyen aunque estén de espaldas.
- Medidor sobre la cabeza del enemigo: "?" que se llena (0,4 s si estás cerca, 1,2 s si estás lejos). Lleno = "!" y pasa a perseguirte y avisa a los cercanos.
- Si sales de su vista antes de llenarse, queda en "sospecha": va al último sitio donde te notó, mira alrededor 4 s y vuelve a su rutina.
- La mala suerte: los enemigos quietos giran al azar cada 3-7 s, y los que deambulan cambian de rumbo. Se ve venir: antes de girarse hacen una pequeña pausa de 0,4 s.
- Ruido y vista de los enemigos que estén en tu cono de visión se muestran como un cono tenue en el suelo (solo en dificultad normal; se puede quitar en ajustes para los expertos).

### Recompensa por jugar táctico
- Golpe por la espalda a un enemigo que no te ha detectado: x2,5 de daño y crítico garantizado (con cuerpo a cuerpo suele ser muerte silenciosa).
- Matar sin ser detectado no avisa a los cercanos.
- Ciertos enemigos lo cambian: el Chillón tiene oído doble, el Acechador oye el sigilo a 2 casillas, el Enjambre no ve pero oye todo.
- La dificultad por minuto también aumenta el oído de los enemigos (+3 % por minuto).
- Ataque automático y sigilo: el ataque automático nunca se dirige a enemigos que no te han detectado. Contra ellos solo se ataca a propósito: al estar detrás de uno desprevenido y a alcance de arma cuerpo a cuerpo aparece un botón contextual "Ejecutar" (sustituye temporalmente al botón de cambio rápido). Con armas a distancia, disparar con el joystick derecho a uno desprevenido también aplica el x2,5.

## 8. Cambios tras la prueba de la v2 (Pablo)
1. Inventario: el mini menú debe abrirse al tocar un objeto también después de hacer scroll. Distinguir toque de arrastre: es toque si el dedo se mueve menos de 8 px y dura menos de 300 ms.
2. Daño de todos los enemigos +25 % (Errante 6 → 7,5). La curva por minuto sigue igual encima.
3. Casco, Escanear: radio de 10 casillas alrededor del jugador (antes todo el mapa). Muestra los enemigos 3 s, aunque estén detrás de muros.
4. Indicadores junto al jugador:
   - Habilidad activa: icono de 18 px encima del personaje con un arco que se vacía según el tiempo que le queda. Si hay varias, se ponen en fila. Se quita el texto de arriba.
   - Mini barra de vida (36×4 px, debajo del personaje): aparece si la vida baja del 35 % (fija) o si recibes 2 golpes en 3 s (se queda 3 s desde el último golpe).
   - Estados (veneno y sangrado): icono de 14 px con el número de cargas, al lado de la barra.
5. Niebla fuera del cono: oscurecer al 45 % (antes casi negro), con un borde difuminado de 1,5 casillas. Lo que no ves no aparece (enemigos ocultos), pero el mapa se intuye.
6. Armas a distancia: cadencia ×0,67 (arco 0,8 → 0,53 ataques/s, pistola 2,0 → 1,33 ataques/s).
7. Veneno y sangrado acumulables:
   - Sangrado: el 33 % de los golpes cuerpo a cuerpo de los enemigos aplica 1 carga. Dura 6 s.
   - Veneno: lo aplican el charco de ácido (1 carga por segundo dentro), la explosión del Hinchado y el proyectil del Escupidor. Dura 4 s.
   - Cada carga hace en total el daño de un golpe de Errante (7,5) repartido en su duración: sangrado 1,25/s y veneno 1,9/s. Cada carga lleva su propio temporizador.
   - Máximo 5 cargas de cada tipo. Las vendas quitan el sangrado y el botiquín quita ambos.
   - Al recibir daño por estado: un destello leve en la barra de vida, sin hit-stop.
8. Tiempo de aplicar curaciones: venda 1,5 s y botiquín 2,5 s. Mientras aplicas te mueves al 50 %, no atacas y se ve un anillo de progreso sobre el jugador. Si recibes un golpe o sueltas el botón, se cancela sin gastar el objeto. Al terminar se aplica la curación de siempre (venda +30 en 2 s, botiquín +70 en 4 s) y se quitan los estados.

## 9. Cambios tras la prueba de la v2.1 (Pablo)
1. Arco y ballesta silenciosos:
   - Disparar no hace ruido. Al caer, la flecha hace un ruido de 1,5 casillas donde impacta, que sirve para distraer (el enemigo va a investigar ahí).
   - Velocidad: flecha de arco 7 casillas/s (antes 10). Virote de ballesta 10 casillas/s.
   - Ballesta: 24 de daño, 0,4 ataques/s, alcance 8, peso 3, munición propia (virotes). Habilidad «Clavar»: el siguiente virote atraviesa a 2 enemigos.
   - Recuperar munición: las flechas y virotes que fallan se quedan en el suelo (brillo tenue) hasta el final de la incursión. Si aciertan, el 60 % cae junto al enemigo al morir. Se recogen al pasar por encima, sin anillo de saqueo.
2. Daño variable y críticos:
   - Cada golpe hace entre el 72 % y el 104 % del daño indicado (25 pasa a ser 18-26). Con los críticos, la media queda igual que antes.
   - Crítico: +50 % de daño. Probabilidad del 25 % en las armas del jugador y del 10 % en los enemigos (con un 25 % para los enemigos, los picos de daño serían demasiado frecuentes con 100 de vida).
   - Sangrado, veneno, quemadura, ácido y la niebla nunca hacen crítico.
   - Puñalada por la espalda: sustituye el ×1,5 por ×2,5 y siempre es crítica.
   - Número normal blanco. Número crítico amarillo anaranjado (#ffb02e), 1,35 veces más grande, con «!» y un pequeño rebote. Daño recibido en rojo; el crítico recibido además hace temblar la pantalla.
3. Memoria de visión al girarte:
   - Lo que sale del cono se queda visible 0,6 s y se va apagando.
   - Para que girar como una peonza no sirva de truco, durante esos 0,6 s los enemigos se quedan como silueta fantasma en la última posición donde los viste: no se mueven ni muestran ataques nuevos. Solo ves lo que había, no lo que pasa ahora.
   - Además, el giro de la mirada tiene un límite de 540°/s.
4. Comerciante de incursión, «el Trapero»:
   - Caseta pequeña. Aparece en el 50 % de las incursiones y está oculto hasta que lo encuentras, como las extracciones.
   - Paga en vales, no en chapas. Los vales solo valen en su tienda y se pierden al salir de la incursión (idea de Dott). Compra materiales al 70 % de su valor en vales, y solo los saqueados en esa incursión.
   - Se pueden combinar vales y chapas para comprar.
   - Vende 3 objetos: uno Reforzado y uno Militar o mejor, con un 20 % de descuento. Una unidad de cada uno.
   - Cierra en el minuto 10 o si hay un enemigo en alerta a menos de 4 casillas. No es zona segura.
5. Enemigos de élite:
   - El 5 % de los enemigos son de élite (nunca la Abominación ni los bichos del Enjambre).
   - Vida ×2, daño ×2 y algo más de tamaño (×1,1).
   - Llevan un contorno y brillo dorado tenue con partículas (aura_elite).
   - Siempre sueltan 2 objetos, y uno es como mínimo una rareza por encima de la normal.
   - Límite: 3 élites vivos a la vez y unos 6 por incursión.
- Reputación de los vendedores (corrección de Dott):
   - Vender no da reputación.
   - La reputación por comprar tiene un tope por cada renovación de tienda.
   - Los niveles 3 y 4 exigen además una misión de ese vendedor, para que no se puedan comprar solo con chapas.
