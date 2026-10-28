# Interfaz: qué hay en pantalla y por qué

Criterio: un elemento está en pantalla solo si el usuario lo necesita para decidir, aprender o
sentir que avanza, y si no se deduce ya de otro. Cualquier cambio de la interfaz se justifica aquí.

Rediseño del 2026-10-28, a partir del feedback «práctica pero sosa» y del estudio de Duolingo:
cada toque responde, el progreso se celebra y la racha diaria es el único elemento de juego.

## Identidad

| Elemento | Por qué |
|---|---|
| **El drac** (Noto Animated Emoji, Google, CC BY 4.0) | Personaje que reacciona a los aciertos y fallos y da vida sin añadir texto. El dragón de Sant Jordi es el símbolo catalán más querido. Animado en el inicio y estático en la hoja de resultado, para no distraer mientras lees. |
| Icono: drac sobre amarillo | El verde del dragón contrasta con el amarillo, que además evoca la senyera. |
| **Botones y tarjetas con relieve** (borde inferior sólido que desaparece al pulsar) | El toque se nota sin vibrar. Es lo que hace que la app se sienta física y no plana. |
| **Color por nivel**: A2 verde azulado, B1 azul, B2 violeta | Dice dónde estás en el curso sin leer nada. |
| Verde = acierto, rojo = fallo, naranja = racha | Cada color tiene un único significado en toda la app. |
| **Nunito** en la interfaz | Redondeada, cálida y muy legible en negrita, adecuada para botones y frases cortas. |
| **Literata** en teoría, lecturas y explicaciones | Serif de lectura larga. Separa «lo que lees para aprender» de «lo que tocas para responder». |
| Baldosa *panot* por unidad | Cinco piezas, cinco lecciones: el progreso de cada unidad sin números. |

## Inicio

| Elemento | Por qué |
|---|---|
| **Racha** (fuego y número de días) | El único elemento de juego. El fuego está animado si ya has practicado hoy y gris si aún no: dice si hoy toca. Basta una lección al día para mantenerla. |
| **Tarjeta de la siguiente lección**, del color del nivel, con el drac, el título, puntos de lección y **Continua** | La acción de cada día, en lo primero que ves. Los puntos dicen cuánto falta de la unidad; el que late es el siguiente. |
| **Repàs** con número | Solo aparece si hay puntos pendientes de repaso. |
| Unidades como tarjetas con su número de curso y su baldosa | El número informa porque el curso es una secuencia. Al abrir, la lista se desplaza hasta la unidad actual. |
| Menú | Sonido, vibración, copia del progreso y ejercicios marcados: uso raro, escondido. |

## Unidad

| Elemento | Por qué |
|---|---|
| Cabecera del color del nivel, con baldosa, título y resumen | El resumen dice qué se aprende en una frase. |
| **Teoria** y **Vocabulari** | Consulta libre antes o después de practicar. |
| Lecciones numeradas; las hechas, con un check verde | Las lecciones son una secuencia de verdad (presentar, practicar, producir, repasar). |

## Teoría antes de empezar

| Elemento | Por qué |
|---|---|
| **Tarjetas, una por punto**, antes de la primera lección de cada unidad | La teoría completa en una página era larga. En tarjetas se lee un punto cada vez y se avanza con un toque. |
| Puntos arriba | Cuántas tarjetas quedan. |
| **Següent** / **Comença** | Un solo botón; en la última tarjeta dice lo que pasa al pulsarlo. |

## Ejercicio

| Elemento | Por qué |
|---|---|
| Barra de progreso gruesa y verde, con rebote al avanzar | Cuánto falta. Si fallas, el ítem vuelve al final y la barra lo refleja. |
| Aspa para salir | Pide confirmación solo si ya has respondido algo. |
| Cada ejercicio entra deslizándose | Se ve que ha cambiado el ejercicio, no hay un salto. |
| La opción elegida aparece en el hueco de la frase | Lees la frase completa antes de comprobar. |
| **Comprova**, siempre abajo y gris hasta que hay respuesta | Al alcance del pulgar, en el mismo sitio en todos los ejercicios. |
| Consigna en gris | Solo cuando el tipo de ejercicio no se explica solo. |

## Resultado

| Elemento | Por qué |
|---|---|
| Banda verde o roja que sube desde abajo, con **sonido** y **vibración** | El veredicto se siente antes de leerlo. Sonido y vibración se pueden apagar en el menú. |
| El drac salta (acierto) o se encoge (fallo) | Reacción emocional sin texto. |
| **Correcte** / **Incorrecte** | El veredicto en una palabra. |
| Solución | Solo cuando no está ya en pantalla (la opción buena ya sale en verde). |
| En un fallo, **por qué tu respuesta está mal** | Lo mínimo para aprender del error. |
| **Per què?** | La regla completa y el acceso a la **Teoria**, plegados: las explicaciones son útiles pero largas, y así solo las lee quien quiere. |
| Bandera | Marcar un ejercicio sospechoso para revisar el contenido. |
| **Continua** del color del veredicto | Cierra el momento con la misma emoción. |

## Final de lección

| Elemento | Por qué |
|---|---|
| **Confeti**, sonido y el pétalo nuevo de la baldosa creciendo | El momento de recompensa: el progreso real de la unidad, celebrado. El confeti se para al salir. |
| «12 de 13 a la primera» | Cómo te ha ido, sin porcentajes. |
| Racha creciendo (fuego y días) | Solo en la primera lección del día, que es cuando la racha cambia. |

## Animación y movimiento

Todas responden a una acción y muestran qué ha cambiado. Con «reducir movimiento» activado en el
sistema no hay ninguna, y las ilustraciones animadas pasan a su imagen fija.

Las animaciones de entrada no dejan transformaciones activas al terminar. Si lo hicieran, los
elementos fijos de dentro (la barra de **Comprova**) dejarían de estar pegados abajo.

## Navegación

- Una pila de pantallas reflejada en el historial: el botón atrás de Android vuelve a la anterior.
- Al terminar una lección, **Continua** vuelve al inicio, que ya muestra la siguiente.
