# GenGi: diseño v4 (mochilas, niveles, zona helada y camino de mapas)

## 1. Mochilas
- Nuevo espacio de equipo: Mochila. Se pierde al morir, como el resto del equipo.
- Las casillas del inventario de la incursión dependen de la mochila:

| Mochila | Rareza | Casillas | Peso propio | Extra |
|---|---|---|---|---|
| Sin mochila (bolsillos) | — | 6 | 0 | — |
| Riñonera | Chatarra | 8 | 0,5 | — |
| Mochila escolar | Común | 12 | 1 | — |
| Mochila de senderismo | Reforzado | 16 | 1,5 | +1 casilla de consumible rápido |
| Mochila táctica | Militar | 20 | 2 | +1 consumible rápido; consumibles un 15 % más rápidos |
| Mochila anómala | Anomalía | 26 | 1 | El peso de lo que lleva cuenta un 20 % menos |

- Peso del botín: pequeño 0,3, mediano 1, grande 2 (armas y armaduras usan su peso).
- Ralentización, como antes: −2 % de velocidad por punto de peso, con un máximo de −40 %.
- Además, por encima de 12 de peso haces +1 casilla de ruido al andar (cosas que chocan), y por encima de 20, +2. Ir cargado es más lento y más ruidoso, así que es una decisión de riesgo.
- La mochila Común gratuita (como el bate y los trapos) no se puede vender.
- Hierro vende mochilas, y el Taller las fabrica.

## 2. Niveles y atributos
### Muerte
- Como antes: pierdes lo que llevabas y lo que habías saqueado en esa incursión. Conservas el nivel, los atributos, el alijo, las chapas y el refugio.
- Penalización (idea de Dott, la elegida): la experiencia de la incursión solo se suma si extraes. En la barra se ve aparte la experiencia aún no asegurada.

### Experiencia
- Al matar: Errante 4, Corredor 5, Hinchado 6, Escupidor y Chillón 7, Acechador 9, Bruto 12, Reptante 8, bicho del Enjambre 1, Abominación 120. Los élites dan ×3 y el jefe de la zona helada 400.
- Al abrir una caja, 2. Por cada misión de vendedor, 60-150.
- Al extraer, +40 más 8 por cada minuto que hayas sobrevivido.
- La experiencia de la incursión solo se queda si extraes. Si mueres, todo se pierde de todos modos.
- Mapas más difíciles dan multiplicador: mapa 1 ×1, mapa 2 ×2,5, mapa 3 ×6.
- Referencia: una buena incursión en el mapa 1 da unos 550 de experiencia (40 muertes, 2 élites, 15 cajas, una misión y extraer en el minuto 13).
- Experiencia para pasar del nivel n al n+1:
  - Niveles 1 a 9: 60 + 30 × n (90, 120, 150, 180, 210, 240, 270, 300, 330).
  - Niveles 10 a 14: la del nivel anterior × 1,10. Niveles 15 a 24: × 1,20. Del 25 en adelante: × 1,10 (Dott). Objetivo: del 18 al 25, unas 5 incursiones buenas en el Cráter.
- Las oleadas y hordas dan el 30 % de la experiencia normal. A partir de 1.500 de experiencia base por muertes en una incursión, las muertes dan la mitad (antes del multiplicador del mapa).
- El ×1,5 del helipuerto no se aplica a la experiencia del jefe.
- Resultado:
  - Llegar al nivel 5 cuesta 540, una incursión muy buena.
  - Del 5 al 10 cuesta 1.350, unas 2-3 incursiones buenas.
  - Cada nivel siguiente cuesta un 10 % más, y los mapas 2 y 3 dan ×2,5 y ×6 de experiencia.
- Todos los números de experiencia están en una sola tabla para que Dott los ajuste con el registro de incursiones.

### Atributos
- 3 puntos por nivel. Máximo 50 por atributo. Todos son lineales: un punto apenas se nota y 50 se nota mucho.
- Quitar un punto cuesta 2 de los asignados y devuelve 1 libre.

| Atributo | Al máximo (50) |
|---|---|
| Agilidad | +15 % velocidad de movimiento, saqueo un 35 % más rápido |
| Resistencia | −15 % de daño recibido, +20 % de resistencia a sangrado y veneno (dura menos) |
| Sigilo | −35 % de radio de ruido, el "?" de los enemigos se llena un 30 % más lento |
| Suerte | +20 % de probabilidad de botín, +8 % de probabilidad de subir una rareza |
| Fuerza (nuevo) | +15 % de daño cuerpo a cuerpo, +6 de peso antes de ralentizarte (va muy bien con las mochilas) |
| Pulso (nuevo) | La línea de apuntar se estabiliza un 40 % antes, +6 % de crítico a distancia, recarga un 25 % más rápida |
| Medicina (nuevo) | Curas un 40 % más rápidas de aplicar y un 20 % más fuertes |
| Carroñero (nuevo) | Ves los objetos dentro de las cajas al acercarte, sin abrirlas, en un radio de hasta 3 casillas, y un 15 % más de chapas |

- En el nivel 40 tienes 117 puntos: da para llegar al máximo en 2 atributos y algo de un tercero. Obliga a especializarse.
- Cada 10 niveles hay una mejora especial a elegir entre 2 (por ejemplo, "Segundo aliento": una vez por incursión, al bajar del 15 % de vida, te curas 25 en 3 s).

### Interfaz
- Barra de experiencia dorada muy fina (36×2 px) justo debajo del personaje, siempre visible. La mini barra de vida, cuando aparece, va encima de ella.
- Al subir de nivel: destello dorado sobre el personaje y "+3" en la esquina del retrato de arriba a la izquierda, que brilla hasta que gastes los puntos. Al tocarlo se abre el panel de atributos. No pausa el juego, igual que el inventario.
- En el refugio, la estación «Pizarra» muestra el mismo panel.

## 3. Refugio conectado con los niveles
- Estación nueva, el Gimnasio (3 niveles): cada nivel sube en +5 el máximo de un atributo a tu elección (de 50 a 55, 60 y 65). Es el objetivo a largo plazo del refugio.
- Estación nueva, la Pizarra (3 niveles): mejora el reparto de puntos. En el nivel 2, quitar un punto cuesta 1 y devuelve 1 una vez por cada 3 incursiones. En el nivel 3 da 1 cambio gratis completo por cada 10 niveles.
- Enfermería: cada nivel suma un 10 % al efecto de Medicina.
- Taller: en el nivel 2 fabrica mochilas Reforzadas y en el nivel 3, Militares.
- Radio: en el nivel 2 muestra al empezar si hay Trapero en la incursión. En el nivel 3 marca la zona del jefe de la zona helada y si está despierto.
- Algunas mejoras del refugio exigen un nivel mínimo de personaje (por ejemplo, Gimnasio 2 a partir del nivel 12), para que las dos progresiones se empujen entre sí.

## 4. Mapa 1 renovado: el «Arrabal» y la «Zona Helada»
### Más variedad (los dos tercios del sur)
- Tipos de edificio, cada uno con su propio botín:
  - Supermercado: comida y consumibles.
  - Farmacia o ambulatorio: medicinas.
  - Comisaría: munición y armas, con una caja fuerte que necesita llave.
  - Gasolinera: combustible.
  - Taller mecánico: componentes.
  - Colegio: tela, mochilas escolares.
  - Bloque de pisos de 2 alturas, con escalera y botín mezclado.
  - Nave industrial: grande y abierta, con chatarra.
- Decoración: autobuses quemados, barricadas de sacos, tiendas de campaña, hogueras apagadas, grafitis, postes caídos con cables, charcos, coches con el maletero abierto (se pueden saquear) y vegetación que invade el asfalto.
- Ambiente: farolas que parpadean, polvo en el aire, viento, cuervos que echan a volar si pasas corriendo (ruido de 4 casillas: otra trampa para el sigilo).

### Mapa por bloques (para que no se pueda ir siempre al mismo sitio)
- El mapa 1 se divide en 3 franjas grandes (norte, este y oeste). En cada incursión, una al azar es la Zona Helada y las otras dos son Arrabal.
- Cada franja se diseña dos veces, en versión normal y en versión nevada, con las mismas calles. Así el mapa sigue siendo aprendible, pero no sabes dónde estará la nieve ni la Matriarca.
- La zona de inicio del jugador es una de 4 al azar, siempre lejos de la Zona Helada.
- Los demás mapas seguirán la misma idea: su zona especial (el tren, el cráter central…) cambia de franja.

### Zona Helada (un tercio del mapa)
- Una frontera clara: el asfalto se va cubriendo de nieve en 3 casillas. Se avisa en pantalla con «Zona Helada».
- Enemigos ×1,3 de vida y daño. El botín pesa más hacia arriba: Común 45 %, Reforzado 37 %, Militar 18 %.
- Reglas de la nieve:
  - Huellas: dejas huellas durante 20 s y los enemigos que las encuentran las siguen. Tú también ves las suyas.
  - La nieve amortigua: andar hace un 30 % menos ruido, pero el hielo cruje (placas visibles que hacen 5 casillas de ruido).
  - Hielo resbaladizo: en las placas, la inercia es el doble.
  - Ventisca: cada 3-4 minutos, durante 25 s, el cono de visión baja a 4 casillas para todos (también para los enemigos). Se avisa 5 s antes.
- Edificios propios: cabañas de madera, estación de esquí con remonte, radar militar, invernadero congelado, búnker (botín Militar, cerrado con código que se encuentra en la zona).
- Enemigos nuevos:
  - Congelado: Errante con caparazón de hielo; el primer golpe solo rompe el hielo (50 % de daño).
  - Lobo mutado: en manadas de 3, rodea y ataca por los lados, y su mordisco sangra el 50 % de las veces.
  - Escarcha: escupe hielo que ralentiza un 40 % durante 2 s, sin daño grande.
- **Jefe: «La Matriarca»**, una abominación gigante cubierta de hielo y pústulas azules (2.000 de vida y resistente al tambaleo). Vive en la presa congelada, una arena grande y abierta con columnas para cubrirse. Todos sus ataques se avisan:
  1. Pisotón: se agacha 1 s y lanza una onda en anillo de 3 casillas. Se esquiva saliendo del anillo.
  2. Lanzas de hielo: marca 3 líneas en el suelo durante 0,8 s y salen picos. Las columnas te protegen.
  3. Aliento helado: un cono de 60° durante 2 s que ralentiza mucho. Al terminar, los charcos de hielo se quedan 6 s.
  4. Llamada: con un 60 % de vida y con un 30 %, grita y salen 4 Congelados y 2 Lobos.
  5. Fase 2 (por debajo del 40 %): va más rápida, encadena pisotón y lanzas, y caen carámbanos del techo (sombra 1 s antes).
  - Su punto débil son las pústulas brillantes de la espalda: daño ×2 si le das por detrás. Así encaja con el sigilo y la puñalada.
  - Botín: 3 objetos asegurados, uno Militar o mejor, un 15 % de probabilidad de Anomalía y un 50 % de probabilidad de soltar la **Tarjeta del helipuerto**.
- **Extracción especial: Helipuerto del radar.**
  - Solo con la Tarjeta. Al usarla, el helicóptero tarda 30 s en llegar. Es muy ruidoso: atrae a todo en 15 casillas.
  - Premio: la experiencia de esa incursión ×1,5 y 1 caja de suministros (botín Militar) al subir.
  - Si no consigues la Tarjeta, la zona sigue teniendo una extracción normal (el remonte, que hay que activar con combustible).

## 5. Camino de mapas
Cada mapa tiene una mecánica propia del escenario que puede volverse contra ti o a tu favor, su jefe y su extracción especial.

### Mapa 1 · El Arrabal (niveles 1-9)
Barrio de las afueras con la Zona Helada al norte (sección 4). Peligro del escenario: la ventisca.

### Mapa 2 · Vía Muerta (niveles 5-25, dificultad ×1,8)
- Ambiente: estación de mercancías y polígono industrial al atardecer, que oscurece durante la incursión (en el minuto 8 ya hace falta la linterna, que hace ruido visual: los enemigos ven su luz). Hay vagones volcados, contenedores, grúas y naves.
- **El Tren Fantasma**, idea de Pablo: un tren automático cruza el mapa por 2 vías cada 90-120 s.
  - Aviso: suena una bocina 6 s antes, las vías se iluminan en rojo, vibra la pantalla (y hay borde en el iPhone) y un icono en el borde señala por dónde llega.
  - Arrolla todo lo que esté en la vía, a ti también: muerte instantánea para los enemigos normales, la mitad de su vida para los élites y 80 de daño para ti.
  - Atraer una horda a la vía justo a tiempo da experiencia ×1,5 por cada muerte del tren.
  - Pasos a nivel: puedes bajar la barrera (2 s, ruidosa) para frenar a los enemigos.
- Mecánica propia: subirse a los vagones parados da posición elevada, con un cono de visión de 9 casillas, pero no puedes saquear desde arriba.
- Jefe: **el Maquinista**, un mutado fusionado con una locomotora que embiste por las vías, lanza chatarra y suelta vapor que tapa la visión. Se le hace daño desviándolo con las agujas de cambio de vía.
- Extracción especial: subirse al tren en marcha en el andén (hay que estar quieto en la marca cuando pasa).

### Mapa 3 · El Cráter (niveles 15-40, dificultad ×3)
- Ambiente: ciudad partida por el impacto de algo desconocido, con cristales morados, radiación y gravedad rara.
- Mecánica propia: **anomalías**. Hay zonas que te repelen, otras que te ralentizan y portales cortos que conectan dos puntos. Sirven para escapar o para lanzar enemigos dentro de ellas.
- Seguridad (Dott): los portales tienen salidas fijas que se comprueban al generar el mapa. Nunca te dejan dentro de un muro, fuera del mapa ni a menos de 2 casillas de un enemigo; si la salida está ocupada, el portal no se activa (se ve apagado).
- Radiación: va subiendo mientras estás fuera de los refugios de plomo y baja tu vida máxima de forma temporal.
- Jefe: **el Eco**, que se divide en copias y solo la verdadera tiene sombra.
- Extracción especial: un portal estable que solo se abre 40 s en un momento al azar de la incursión.

### Mapa 4 · La Colmena (nivel 30 en adelante, dificultad ×5)
- Ambiente: metro y alcantarillas convertidos en un nido orgánico.
- Mecánica propia: **derrumbes**. Los túneles se cierran a lo largo de la incursión y el mapa cambia en cada partida. La niebla tóxica entra por los conductos.
- Seguridad (Dott): cada derrumbe se avisa 4 s antes (polvo que cae, grietas en el suelo y temblor). Nunca puede cortar el último camino entre el jugador y una extracción activa, ni dejarte atrapado.
- Jefe: **la Reina**, que pone huevos que eclosionan si no los rompes.
- Extracción especial: subir por un pozo mientras sube la marea de bichos.

### Rarezas por mapa
| Mapa | Rarezas |
|---|---|
| 1 | Chatarra-Militar (el jefe, Anomalía) |
| 2 | Común-Anomalía |
| 3 | Reforzado-Reliquia |
| 4 | Militar-Reliquia |

Rareza nueva para el final: **Reliquia**, con 1 efecto único por objeto (por ejemplo, un machete que roba vida o una mochila que te hace invisible 3 s).

### En el refugio: la Mesa de Mapas
- Para salir a una incursión, en vez de un botón tienes una mesa con un mapa de corcho clavado a la pared y fotos de cada zona.
- Cada mapa es una tarjeta de polaroid con su nombre, el rango de nivel, la dificultad (calaveras de 1 a 5), las rarezas que suelta y el jefe (silueta oscura hasta que lo matas).
- Los mapas bloqueados se ven con un candado y "Nivel 5". Si ya has superado el rango, se ve con una cinta de "Zona superada" y no deja entrar.
- Al tocar una tarjeta se ve la información de la Radio (Trapero, jefe despierto, clima) antes de confirmar.
- La estación Radio y la Mesa de Mapas están juntas en el refugio.

## 6. Orden de desarrollo propuesto
1. v4.0: mochilas, peso del botín, nivel, experiencia, atributos, Gimnasio y Pizarra.
2. v4.1: edificios nuevos, decoración y ambiente del Arrabal.
3. v4.2: Zona Helada, enemigos de la nieve, la Matriarca y el Helipuerto.
4. v5: mapa 2.
