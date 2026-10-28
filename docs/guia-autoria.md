# Guía de autoría

Instrucciones para quien escribe una unidad, persona o subagente. Se leen enteras antes de empezar.
Junto con esta guía hacen falta:

- la ficha de la unidad en [`curriculo.md`](curriculo.md);
- el catálogo de tipos en [`tipos-ejercicio.md`](tipos-ejercicio.md);
- la unidad de ejemplo [`exemple/a2-00-exemple/`](exemple/a2-00-exemple/), que es el modelo de
  formato y de tono;
- el temario original del nivel en [`fuentes/`](fuentes/), para el alcance.

## Qué se entrega

Una carpeta `content/units/<id>-<slug>/` (p. ej. `content/units/b1-14-pronom-en/`) con:

- `unit.yaml`: metadatos, puntos, lecciones, vocabulario y ejercicios;
- `theory.md`: una sección por punto.

La unidad está terminada cuando `npm run validate -- content/units/<carpeta>` da **0 errores** y
los avisos que queden tienen una razón que se explica en el informe final.

## 1. Norma y variante

- **Catalán central, estándar**, según la norma del IEC vigente (GIEC 2016 y OIEC 2017). Las
  referencias son la [GEIEC](https://geiec.iec.cat), el [DIEC2](https://dlc.iec.cat) y
  l'[Optimot](https://aplicacions.llengua.gencat.cat/llc/AppJava/index.html).
- **Diacríticos: solo los 15 de 2017**: *bé, déu, és, mà, més, món, pèl, què, sé, sí, sòl, són,
  té, ús, vós*, más los plurales *béns, déus, pèls, sòls*. Se escribe **dona, vens, venen, net,
  soc, os**. Los temarios de `fuentes/` todavía usan la lista antigua: en esto no se
  siguen.
- **Si no estás seguro de que una forma es correcta, no la uses.** Una frase dudosa se cambia por
  otra que no lo sea. Nunca se inventa una regla ni una referencia (ni números de capítulo de la
  GEIEC: basta con el título del apartado).

## 2. Puntos delicados

Hay construcciones donde la norma admite más de una forma, o una forma en registro informal y otra
en formal. La regla es una sola:

> **Ninguna forma que la GEIEC admita, en ningún registro, puede aparecer como distractor, como
> `wrong_answer` ni como error de un `find-error`.**

Si la norma admite dos formas, o las dos van en `answers`, o el ejercicio se reescribe para no
depender de ello. La teoría puede explicar la diferencia de registro («en registre col·loquial
també es diu…»), pero los ejercicios solo piden lo que es inequívoco.

Puntos conocidos (lista abierta; si encuentras otro, añádelo al informe):

| Punto | Qué hacer |
|---|---|
| *ser / estar* de localización | No usar *està a casa* como error. Enseñar *és a casa* como forma preferida. |
| *hi ha / hi han* | No poner *hi han* como error salvo que el ejercicio diga explícitamente «registre formal». |
| *anar a* + infinitivo con valor de futuro | No ponerlo como error. |
| *per / per a* delante de infinitivo | Finalidad: *per* y *per a* son correctas y se aceptan las dos. Causa: solo *per* (*la van multar per aparcar*; con *per a* cambia el sentido). |
| *li* + *el/la/els/les* (*l'hi*, *li'l*…) y *els hi* | Pedir la forma estándar (*l'hi*, *els el*…); no tratar como error las formas que la GEIEC admita. Verificar antes de escribir. |
| Concordancia del participio con *el/la/els/les* | Evitar frases donde decida la respuesta. |
| *deure* / *deure de* + infinitivo | Pedir *deure* + infinitivo; no poner *deure de* como error sin verificarlo. |
| Preposiciones con verbos de régimen dudoso (*insistir a/en*, *somiar*) | Aceptar todas las admitidas. |
| *tenir lloc*, *donar un pas* y otros supuestos calcos | Comprobar en el Optimot; si se admite, no es error. |
| Formas de subjuntivo con variantes (*sàpiga / sàpigui*) | Aceptar todas las admitidas. |
| *ser / estar* con adjetivos de estado (*soc cansat* / *estic cansat*) | Las dos son correctas. Nunca *ser* como error con un adjetivo; el error claro es *tenir* (*tinc cansat*). |
| Pronombre de *ser de* + lugar de origen (*en soc* / *ho soc*) | No ejercitarlo. |
| *al* + infinitivo temporal (*al sortir*) | Enseñar *en sortir* como forma preferida; no ponerlo como error. |
| Nombre de persona sin artículo (*He vist Laia*) | El estándar valenciano lo omite: no es error. Se practica la **forma** del artículo (*la Laia*, *l'Anna*, *en Jordi*), no su presencia. |
| Fórmulas de cortesía calcadas (*encantat de conèixer-te*) | No enseñarlas; usar las genuinas (*molt de gust*). Si LanguageTool marca una expresión del currículo, gana LanguageTool hasta comprobarlo. |

En el informe final, enumera los ítems que tocan un punto delicado para que se revisen a mano.

## 3. La teoría (`theory.md`)

Siempre en catalán. Una sección por punto, en el orden de `points`, con este formato:

```markdown
<!-- point: <id del punto> -->
## <Título del punto>

<La regla, en 1–3 frases cortas.>

> <Un ejemplo antes de la regla, si ayuda a entenderla.>

<Tabla de formas, si las hay.>

- <2–5 ejemplos con la forma en **negrita**.>

> **Compte!** <El error típico, tachado con ~~…~~, y la forma correcta en **negrita**.>
```

- **El idioma, adaptado al nivel.** En A2: frases de menos de 15 palabras, vocabulario básico y el
  ejemplo antes que la regla. Términos como *complement directe* se usan, pero la primera vez van
  con un ejemplo. En B1 y B2, la prosa normal de un manual.
- **Longitud por sección:** A2 ≤ 150 palabras, B1 ≤ 220, B2 ≤ 280, sin contar las tablas.
- Se explica lo que se practica en los ejercicios, ni más ni menos. Si la regla tiene excepciones
  que no salen en la unidad, se dice que existen en una línea, sin listarlas.
- Nada copiado de la GEIEC, de Parla.cat ni de ningún manual: la explicación es propia.

## 4. Las frases de los ejercicios

- **Naturales y de adulto**: lo que diría alguien que vive en Cataluña, en el trabajo, en casa, en
  el médico o con amigos. Nada de frases de libro de texto («El gat és a sobre de la taula»).
- **Del vocabulario del nivel y del ámbito de la unidad.** Una palabra fuera del nivel solo si el
  contexto la explica.
- **Largo máximo:** A2, 15 palabras; B1, 22; B2, 30 (sin contar `reading`).
- **Variadas.** No repitas el mismo esquema de frase en ítems seguidos. Varía persona, tiempo,
  número y situación. Usa nombres diversos (Jordi, Laia, Núria, Pau, Arnau, Montse, Fàtima, Wei,
  Ibrahim, Carla…) y lugares reales de Cataluña. Cada nombre mantiene el mismo género en toda la
  unidad (*el Wei*, *la Fàtima*).
- **Con sentido en el mundo real**, sobre todo las de `no_error`: *~~A casa no tinc sucre, però
  n'hi ha al rebost~~* se contradice (el rebost está en casa).
- **Todo lo que ve el usuario es catalán correcto**, salvo lo que está mal a propósito: el `error`
  de un `find-error`, los distractores, los `wrong_answers` y el `source` de un `transform` que pide
  corregirlo. Un `source` normal (*He d'arribar…*) tiene que estar bien.
- **Tu propia prosa también.** Las explicaciones y la teoría son modelo de lengua: sin calcos
  (*se senten*, no ~~s'escolten~~, para «oír»; *de pressa*, no ~~ràpid~~, como adverbio).
- **Sin temas que distraigan**: política de partidos, sucesos violentos, religión o estereotipos.
- **Cada ítem se entiende solo**: nada de «la frase anterior».
- **Sin castellano**, salvo citado entre comillas en una `explanation` o un `why` para nombrar el
  calco (*«Hi ha que» és un calc de «hay que»*).
- Sin emojis.

## 5. Un ítem, una respuesta

El fallo más grave de un ejercicio es que haya dos respuestas correctas y se dé una por mala.

- **El contexto tiene que forzar la respuesta**: marcadores de tiempo (*ahir*, *demà*, *cada
  dia*), concordancias (*les claus* → *les*), una pregunta previa en diálogo (*—Vas a la platja?
  —Sí, ___ vaig*).
- **Prueba del nativo:** ¿podría un hablante nativo defender otra opción con alguna lectura de la
  frase? Si sí, reescribe la frase, no la explicación.
- **Un solo foco**: el ítem evalúa su `point` y nada más. El resto de la frase tiene que ser fácil.

## 6. Distractores (`choice`, `inline-choice`, `find-error`, `reading`)

- **Errores reales** de un hablante de castellano de ese nivel: el calco, el pronombre equivocado,
  el tiempo equivocado, el género del castellano, la preposición del castellano.
- **Misma categoría y longitud parecida** que la respuesta. Que la correcta no sea la más larga ni
  la más precisa (el validador avisa si es mucho más larga).
- **Nunca absurdos** ni de broma: un distractor que nadie elegiría no enseña nada.
- **Nunca una forma admitida por la norma** (sección 2).
- **`why` en cada distractor de los ítems de interferencia**, y siempre que el error tenga una
  explicación corta. El `why` explica por qué esa opción está mal, no repite la regla general.

## 7. Respuestas escritas (`fill`, `transform`)

**`answers` lista todas las respuestas correctas.** La primera es la que verá el usuario. Antes de
cerrar el ítem, repasa estas variantes:

- posición del pronombre: *Ho vull fer* / *Vull fer-ho*; *L'he de comprar* / *He de comprar-lo*;
- con y sin pronombre sujeto: *Jo hi vaig* / *Hi vaig*;
- orden alternativo de adverbios: *Encara no l'he vist* / *No l'he vist encara*;
- sinónimos, si la pista no fija la palabra;
- números en cifra y en letra, si el ítem lleva números.

**`wrong_answers`**: de 1 a 3 errores típicos, cada uno con su `why`. No hace falta prever todos los
errores, solo los que merecen una explicación concreta.

**`grading`**:

- `strict` si lo evaluado es la grafía (ortografía, acentos, apóstrofo, guion) o si la respuesta
  contiene una pareja de diacrítico que es justo lo que se pregunta (*què/que*, *és/es*…);
- `tolerant` en el resto. No pongas `strict` solo para que desaparezca el aviso del validador: si
  el acento no es lo que se evalúa (*són de Lleida* en un ítem sobre *ser*), lo correcto es
  `tolerant` y el aviso se queda, explicado en el informe.

El validador obliga a `strict` cuando un `wrong_answer` solo se diferencia de una respuesta en
acentos, y avisa cuando hay una pareja de diacrítico con `tolerant`.

**`hint`** (`fill`) dice qué hacer sin dar la respuesta: el infinitivo y el tiempo (*anar, passat
perifràstic*), la palabra base (*TRANQUIL*) o qué sustituye (*pronom per a «les claus»*).

## 8. Explicaciones (`explanation`)

- Catalán, sin «Correcte!» ni «Molt bé!»: la app ya dice si has acertado.
- **Dicen la regla aplicada a este caso**, no solo la respuesta: *«Les claus» és CD femení plural:
  el pronom és les*.
- **Longitud:** A2 ≤ 25 palabras, B1 ≤ 35, B2 ≤ 45.
- Si el ítem es de interferencia, nombra el calco.
- **Cada `explanation` y cada `why` tiene que ser verdad por sí mismo**, no solo en el contexto del
  ítem. Sin generalizaciones de más: *~~«Los» no és un pronom del català~~* es falso
  (*comprar-los*), aunque en ese ítem *compra-los* esté mal.

**Citar formas.** En `explanation`, `why`, `hint`, títulos y teoría, una forma de la que se habla
(no que se usa) va en *cursiva* con asteriscos: *Li* és complement indirecte; *Tenir que* és un
castellanisme; s'escriu amb *ss*. Un fragmento de la frase del ejercicio va entre «»: «Les claus»
és femení plural. El castellano citado, también entre «»: calc de «hay que». La app muestra la
cursiva y el corrector automático se salta lo citado. Sin esta marca, cada forma citada
(sobre todo las incorrectas) aparece como un error falso. No apostrofes delante de una forma
citada (~~el gerundi d'*escriure*~~): reescribe la frase (*Escriure* fa el gerundi *escrivint*).

## 9. Por tipo

- **`choice`**: 3 opciones en A2 y 3–4 en B1 y B2. Pregunta sin hueco solo para significado y uso
  (*Què vol dir «anar de bòlit»?*).
- **`fill`**: un hueco y una sola palabra o grupo verbal. Si la respuesta tiene más de cuatro
  palabras, es un `transform`.
- **`transform`**: marca con `[[…]]` exactamente lo que cambia. Usa `start` cuando el comienzo de
  la frase nueva no se puede deducir (estilo indirecto: `start: "Em va dir que"`).
- **`inline-choice`**: de 3 a 8 huecos en un texto coherente con título. Para ortografía, el hueco
  es la parte mínima que decide (`{ss|s}`, no la palabra entera). `∅` para «nada».
- **`find-error`**: el `error` es el segmento mínimo que hay que cambiar, y aparece una sola vez en
  la frase. Al menos 1 de cada 4 con `no_error: true`. En ellos la frase tiene que ser correcta del
  todo y parecerse a las otras, incluso contener la estructura que suele fallar.
- **`order`**: fragmentos de una palabra o de un bloque que no se separa (*l'hi*, *dona-me'l*).
  Entre 4 y 9 fragmentos. `cue` fija el sentido sin dar la frase. Lista todas las ordenaciones
  válidas en `answers`. Los `extra` son la tentación típica (*li* donde va *el*).
- **`match`**: de 4 a 6 parejas, con un solo emparejamiento posible. Si dos significados se parecen
  (*estar de mala lluna* / *tenir la mosca al nas*), van en ítems distintos.
- **`reading`**: texto propio con título. Las preguntas se responden con lo que el texto dice, no
  con cultura general ni con deducciones (si el texto no dice *por qué* llegó pronto, no se
  pregunta por qué). Las respuestas parafrasean el texto, no lo copian literalmente, y los distractores
  mencionan cosas que sí salen en él.

## 10. Composición de la unidad

- **Puntos:** los de la ficha del currículo. Normalmente 2–4 de gramática, 1 de interferencia
  («Compte amb el castellà»), 1 de expresiones y, desde B1, 1 de comprensión. `id` en kebab-case
  (`pronom-en-partitiu`).
- **Lecciones:** 5, con el reparto y los mínimos de [`tipos-ejercicio.md`](tipos-ejercicio.md#composición-de-una-unidad).
  Unos 65 ítems por unidad.
- **Vocabulario:** 25–40 entradas del ámbito, con `definition` en catalán sencillo y un `example`
  propio. Las palabras se usan en los ejercicios.
- **`id` de los ítems:** `<unidad>-001`, `-002`… en orden. Una vez publicado, un `id` no cambia ni
  se reutiliza: de él cuelga el progreso del usuario.

## 11. Antes de entregar

1. `npm run validate -- content/units/<carpeta>`: 0 errores.
2. `npm run languagetool -- content/units/<carpeta>` (necesita el servidor:
   `docker start languagetool`). Revisa cada aviso. Si es un error real, corrígelo. Si es un falso
   positivo, comprueba que la forma citada está en *cursiva* o entre «». Si de verdad lo es, dilo en
   el informe. Un aviso en un texto que ve el usuario solo es falso positivo si el texto es
   correcto: en el piloto se descartó como «falso positivo» un *He de arribar* que era un error.
   Los avisos marcados `source` pueden ser el error deliberado de un `transform`. LanguageTool no detecta todo: no sustituye a los pasos siguientes.
3. Relee cada ítem con la prueba del nativo (sección 5).
4. Comprueba que ningún distractor ni `wrong_answer` sea una forma admitida (sección 2).
5. Comprueba los diacríticos de 2017 en todo el texto (*dona*, *soc*, *vens*, *net*… sin acento).
6. Comprueba que cada `answers` incluye las variantes de la sección 7.

**Informe final** (corto):

- número de ítems por tipo y por lección;
- avisos del validador que quedan y por qué;
- ítems que tocan un punto delicado (sección 2), con el `id` y la duda;
- cualquier forma de la que no estés seguro al 100 %.
