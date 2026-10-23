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
