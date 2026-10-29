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
| Unidades como tarjetas con su número de curso y su baldosa | El número informa porque el curso es una secuencia. Al volver desde una de ellas, la lista conserva la posición; al abrir la app se ve la tarjeta Continua. |
| **Héroe de sesión pendiente** («Tens una lliçó pendent», X de Y, **Reprèn** / Descarta-la) | Solo si se cerró la app a mitad de lección: sustituye a la tarjeta Continua en vez de aparecer debajo apagada. Descartar con respuestas hechas pide confirmación. |
| Aviso de borrador ilegible con Descarta-la | Si lo guardado no se puede reanudar, se dice y se ofrece quitarlo: nunca se sobrescribe en silencio ni se empieza otra cosa encima. |
| **Aviso de nueva versión** con **Actualitza** | Solo en el inicio y solo con una actualización descargada: nunca recarga a mitad de sesión. |
| Menú | Sonido, vibración, tema, copia del progreso y ejercicios marcados: uso raro, escondido. |

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
| **Següent** / **Comença**, con **Anterior** desde la segunda tarjeta | Releer una tarjeta no debía obligar a salir y volver a entrar. Sin botón de omitir: la teoría es el contrato de cada unidad. |

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
| En un fallo escrito, **tu respuesta junto a la esperada** | Comparar enseña más que leer la solución: ves tu error al lado de la forma correcta. En aceptadas con aviso basta la línea de solución. |
| En lecturas, **veredicto por pregunta** con su explicación | El ejercicio sigue contando como un ítem, pero cada pregunta dice si acertó y por qué. |
| En emparejamientos con fallos, **cuántos intentos fallaron** | Completar las parejas tras fallar ya no puntúa como acierto limpio sin decir por qué. |
| En un fallo, **por qué tu respuesta está mal** | Lo mínimo para aprender del error. |
| **Per què?** | La regla completa y el acceso a la **Teoria**, plegados: las explicaciones son útiles pero largas, y así solo las lee quien quiere. |
| Bandera | Marcar un ejercicio sospechoso para revisar el contenido. |
| **Continua** del color del veredicto | Cierra el momento con la misma emoción. |

## Final de lección

| Elemento | Por qué |
|---|---|
| **Confeti**, sonido y el pétalo nuevo de la baldosa creciendo | El momento de recompensa: el progreso real de la unidad, celebrado. El confeti se para al salir. |
| «12 de 13 a la primera» | Cómo te ha ido, sin porcentajes. |
| «Has practicat N punts gramaticals» | Qué has trabajado, calculado de tus respuestas: el resumen habla de gramática, no solo de aciertos. |
| Diálogos nativos para salir, borrar, vaciar, descartar y restaurar | El `confirm()` del navegador rompía el tono y en móvil se lee mal; el diálogo explica la consecuencia y nombra la acción. La teoría contextual también es un diálogo nativo, con foco y Escape correctos. |

## Ajustes

| Elemento | Por qué |
|---|---|
| Selector de tema (Automàtic/Clar/Fosc) | El modo oscuro existía pero lo imponía el sistema; quien estudia de noche en modo claro lo pedía. |
| Exportar/Importar la copia en un archivo, con resumen de la copia | Pegar JSON a mano en el móvil es frágil; el archivo se guarda donde quieras y antes de restaurar ves qué contiene. |
| Restaurar (pegado o archivo) echa abajo la sesión pendiente | Borrar o sustituir el progreso genera una generación nueva: ningún borrador viejo puede reaparecer ni mezclarse. |
| Lista de ejercicios marcados con su unidad y **Desmarca** | La bandera servía para avisar, pero no veías qué habías marcado ni podías quitar uno solo. |
| Racha creciendo (fuego y días) | Solo en la primera lección del día, que es cuando la racha cambia. |

## Animación y movimiento

Todas responden a una acción y muestran qué ha cambiado. Con «reducir movimiento» activado en el
sistema no hay ninguna, y las ilustraciones animadas pasan a su imagen fija.

Las animaciones de entrada no dejan transformaciones activas al terminar. Si lo hicieran, los
elementos fijos de dentro (la barra de **Comprova**) dejarían de estar pegados abajo.

## Navegación

- Una pila de pantallas reflejada en el historial: el botón atrás de Android vuelve a la anterior.
- Atrás sigue las mismas reglas que Surt: primero cierra el modal abierto, descarta una sesión vacía
  sin preguntar y pide confirmación antes de dejar una a medias.
- Al terminar una lección, **Continua** vuelve al inicio, que ya muestra la siguiente.
