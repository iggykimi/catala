# Interfaz: qué hay en pantalla y por qué

Criterio: un elemento está en pantalla solo si el usuario lo necesita para decidir o para aprender, y
si no se deduce ya de otro. Cualquier cambio de la interfaz se justifica aquí.

## Identidad

| Elemento | Por qué |
|---|---|
| **Baldosa *panot*** (flor de cuatro pétalos y centro) | Es el único rasgo visual propio. La baldosa de las aceras de Barcelona tiene cinco piezas, como las cinco lecciones de una unidad, así que el progreso de cada unidad se lee sin números. |
| **Atkinson Hyperlegible** en interfaz y ejercicios | Diseñada para distinguir letras parecidas. En un ejercicio de *è/é* o *l·l* la forma de cada letra importa. |
| **Literata** en teoría, lecturas y explicaciones | Serif de lectura larga. Separa «lo que lees para aprender» de «lo que tocas para responder». |
| Colores: piedra, tinta pizarra, azul azulejo y azafrán | El azul marca lo accionable y el progreso. El azafrán marca el centro de la baldosa (unidad completa) y la racha. El verde y el carmín solo significan acierto y fallo. |
| Fuentes empaquetadas | La app funciona sin conexión. |

## Inicio

| Elemento | Por qué |
|---|---|
| Lista de unidades por nivel (A2, B1, B2) | Saber dónde estás en el curso y poder entrar en cualquier unidad. El nivel es la única agrupación con sentido para el usuario. |
| Baldosa de cada unidad | Lecciones hechas, sin texto. |
| Botón **Continua**, con el título de la unidad encima | La acción de cada día. El título se repite porque, con 60 unidades, la actual no suele estar a la vista. Al abrir, la lista se desplaza hasta ella. |
| **Repàs** con número | Solo aparece si hay puntos pendientes de repaso. El número dice cuánto es antes de empezar. |
| Racha (baldosa pequeña y número de días) | Solo aparece si es mayor que cero. Un «0» no aporta nada. |
| Menú (tres rayas) | Copia del progreso y ejercicios marcados: uso raro, por eso queda escondido. |

**Quitado:** la unidad actual en negrita. Repetía lo que ya dice el botón.

## Unidad

| Elemento | Por qué |
|---|---|
| Baldosa grande, título y resumen | El resumen dice qué se aprende en una frase; es lo que decide si entras. |
| **Teoria** y **Vocabulari** | Consulta libre antes o después de practicar. |
| Lecciones numeradas, con el número relleno cuando está hecha | Las lecciones son una secuencia de verdad (presentar, practicar, producir, repasar), así que aquí el número informa. |

## Ejercicio

| Elemento | Por qué |
|---|---|
| Barra de progreso fina | Cuánto falta. Si fallas, la lección se alarga (el ítem vuelve al final) y la barra lo refleja. |
| Aspa para salir | Pide confirmación solo si ya has respondido algo, porque solo entonces se pierde trabajo. |
| Consigna en gris pequeño | Solo cuando el tipo de ejercicio no se explica solo («Toca la part incorrecta», «Reescriu la frase»). Una elección múltiple no la lleva. |
| La opción elegida aparece en el hueco de la frase | Lees la frase completa antes de comprobar: así se decide en contexto. |
| **Comprova**, gris hasta que hay respuesta | Botón siempre en el mismo sitio, al alcance del pulgar. Gris significa «aún no». |
| Pista bajo el hueco (`fill`) | Dice qué forma hace falta («*comprar*, present»). Sin ella, el hueco sería ambiguo. |
| Fragmento usado que deja hueco en el banco (`order`) | Los demás fragmentos no se mueven mientras ordenas. |

## Resultado (hoja inferior)

| Elemento | Por qué |
|---|---|
| **Correcte** / **Incorrecte** con barra de color | El veredicto, legible de un vistazo. |
| Solución | **Solo cuando no está ya en pantalla.** En elección múltiple, la opción buena ya sale en verde. En huecos con opciones, el hueco fallado enseña tu opción tachada y la buena al lado. Se muestra para lo escrito, al ordenar y en «toca el error» si tocaste otra palabra. |
| «Compte amb l'accent: …» | Lo escribiste bien salvo un acento. Cuenta como acierto, pero tienes que ver la forma buena. |
| Por qué tu opción está mal (en carmín) | Explica tu error concreto, no la regla general. |
| Explicación | La regla aplicada a este caso. |
| **Teoria** | Abre solo la sección de este punto, sin salir de la lección. |
| Bandera | Marcar un ejercicio sospechoso para revisar el contenido. Sin texto: es una acción secundaria y el icono basta. |

## Animación

Cada animación responde a una acción y muestra qué ha cambiado. No hay animaciones de entrada decorativas.

| Animación | Por qué |
|---|---|
| La hoja de resultado sube desde abajo (0,28 s) | Aparece donde estaba el botón que pulsaste. |
| Sacudida al fallar | Confirma el fallo antes de leer. |
| El pétalo nuevo crece y gira al terminar una lección | El único momento celebrado: el progreso real de la unidad. |
| Botones que se hunden al pulsar | Confirma el toque en móvil, donde no hay estado *hover*. |

Con «reducir movimiento» activado en el sistema, no hay ninguna.

## Navegación

- Una pila de pantallas reflejada en el historial: el botón atrás de Android vuelve a la pantalla anterior.
- Al terminar una lección, **Continua** vuelve al inicio, que ya muestra la siguiente lección.
