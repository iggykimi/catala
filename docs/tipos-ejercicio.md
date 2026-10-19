# Tipos de ejercicio

Catálogo cerrado: la app solo sabe mostrar estos ocho tipos. Cada uno tiene un ejemplo real en
[`docs/exemple/a2-00-exemple/unit.yaml`](exemple/a2-00-exemple/unit.yaml), que el validador
comprueba (`npm run validate -- docs/exemple`). El contrato exacto de campos está en
[`src/content/schema.ts`](../src/content/schema.ts).

Fuera del catálogo, a propósito:

- **Audio y dictado.** El audio sintético en catalán suena artificial y el dictado depende de él.
- **Traducción libre del castellano.** Hay demasiadas respuestas válidas para corregirla con una
  lista. Lo que aporta (las interferencias) lo cubren `find-error` y `choice`, que se pueden corregir
  sin ambigüedad.
- **Redacción libre.** No se puede corregir sin un LLM en tiempo de ejecución.

## Campos comunes

| Campo | Qué es |
|---|---|
| `id` | `<unidad>-NNN`, p. ej. `b1-14-023`. Único y estable: el progreso del usuario cuelga de él. |
| `type` | Uno de los ocho tipos. |
| `point` | El punto de la unidad que trabaja (`points[].id`). El repaso espaciado va por punto. |
| `lesson` | Número de lección dentro de la unidad (1…N). |
| `instruction` | Opcional. Sustituye la consigna por defecto del tipo. |
| `explanation` | Obligatoria. El porqué de la respuesta, en catalán; se muestra siempre después de responder. |

Las opciones de `choice`, `inline-choice`, `find-error`, `match`, `order` y `reading` **las baraja
la app** al mostrarlas. En el YAML la respuesta correcta va siempre en un sitio fijo (campo propio o
primera opción), así que el autor no tiene que pensar en el orden y la posición no delata nada.

## Marcas en el texto

| Marca | Dónde | Significado |
|---|---|---|
| `___` | `prompt` de `choice` y `fill` | El hueco. Exactamente uno en `fill`; uno o ninguno (pregunta directa) en `choice`. |
| `{correcta\|mal1\|mal2}` | `text` de `inline-choice` | Hueco con opciones; la **primera** es la correcta. `∅` = «nada» (p. ej. `{h\|∅}i haurà`). |
| `[[…]]` | `source` de `transform` | Segmento resaltado: lo que hay que transformar. |

## Los ocho tipos

### `choice`: elección múltiple

Frase con un hueco (o una pregunta) y 3–4 opciones. Sirve para presentar y reconocer: un punto nuevo
en la lección 1, el significado de una expresión o la palabra exacta en contexto.

- `prompt`, `answer`, `distractors` (2–3, cada uno con `why` opcional, que se muestra si el
  usuario lo elige).
- Sin escritura, así que no hay corrección tolerante.

### `fill`: hueco escrito

Frase con un hueco que el usuario escribe a partir de una pista: el verbo en infinitivo y el tiempo,
la palabra base en mayúsculas (como en el examen: `(TRANQUIL)`), o qué sustituye el pronombre.

- `prompt`, `hint`, `answers` (todas las válidas; la primera es la que se muestra), `wrong_answers`
  (errores típicos con su `why`), `grading`.
- Es la producción controlada: el usuario tiene que recordar la forma, no solo reconocerla.

### `transform`: transformar la frase

Se da una frase con partes resaltadas y una instrucción: sustituir por pronombres, pasar a estilo
indirecto, a negativa, a otra persona o a otro tiempo. Es el ejercicio 4 del examen B2 y el mejor
para pronombres febles y subjuntivo.

- `source` (con `[[…]]`), `instruction`, `start` opcional (comienzo fijo que la app escribe antes
  del campo), `answers` (frases completas, incluido `start`), `wrong_answers`, `grading`.

### `inline-choice`: huecos con opciones dentro de un texto

Un texto breve con varios huecos de opciones que se tocan, sin teclado. Cubre dos ejercicios del
examen:

- **Ortografía**: letras que faltan (`{v|b}eïns`, `{ss|s}`, `{h|∅}`), acentos
  (`{què|que}`) y apóstrofos (`{l'|la }`). Así se evita teclear letras sueltas en el móvil y la
  corrección es exacta.
- **Palabras en contexto**: preposiciones, conectores y pronombres dentro de un texto con sentido.

Campos: `title` opcional y `text`. Entre 3 y 8 huecos.

### `find-error`: encontrar y corregir el error

Una frase. El usuario toca la palabra o el segmento incorrecto y luego elige la corrección entre
3–4 opciones. Es el ejercicio principal de **interferencias del castellano**.

- Con error: `sentence`, `error` (segmento literal, que aparece una sola vez), `fix`,
  `fix_distractors`.
- Sin error: `sentence`, `no_error: true`. El usuario tiene que pulsar «No hi ha cap error». Al
  menos uno de cada cuatro `find-error` tiene que ser así, para que no baste con buscar algo raro.

### `order`: ordenar fragmentos

Fragmentos desordenados que hay que colocar. Útil para la posición de los pronombres febles, el
orden de la negación y los adverbios, y la estructura de las subordinadas.

- `cue` (contexto que fija el sentido), `chunks` (en el orden canónico), `extra` (0–3 fragmentos
  sobrantes), `answers` (todas las ordenaciones válidas; la primera es `chunks` en orden).
- Mayúscula inicial y puntuación final no cuentan.

### `match`: emparejar

4–6 parejas: expresión ↔ significado, verbo ↔ preposición que rige, palabra ↔ sinónimo, o mitades
de frase. Cada lado tiene que tener una sola pareja posible.

### `reading`: lectura con preguntas

Un texto (A2: 80–150 palabras; B1: 150–250; B2: 250–350) con 3–5 preguntas de elección múltiple.
Hay como mucho una por lección. A partir de B1, en la última lección de cada unidad.

## Corrección de lo escrito (`fill` y `transform`)

El usuario escribe en el móvil: tiene que importar lo que se evalúa, no el teclado.

**Siempre se ignora:** mayúsculas, espacios de más, la puntuación final, `¿¡` iniciales, la variante
de apóstrofo (`'` `’`), la variante de ela geminada (`l·l`, `l.l`, `ŀl`) y las comillas.

**`grading: strict`**: tiene que coincidir con una de las `answers`. Se usa cuando lo evaluado es la
grafía: ortografía, acentos, apóstrofo, guion, y siempre que la respuesta incluya una pareja que
solo distingue el acento (`què/que`, `és/es`, `més/mes`, `sé/se`, `sí/si`, `té/te`, `són/son`…) y
ese acento sea lo que se pregunta.

**`grading: tolerant`** (por defecto en gramática y léxico). Se acepta **con aviso** («Correcte,
però s'escriu *cançó*»):

1. Un error **solo de diacríticos** en cualquier palabra: acento, diéresis, `ç`, punto de la ela
   geminada.
2. **Una errata** (una letra cambiada, sobrante, que falta o dos letras intercambiadas) **solo en
   palabras de 4 o más letras que el usuario copia de la frase original**. Las palabras que tiene
   que producir él (el pronombre, la forma verbal, la preposición) tienen que estar bien. Una letra
   ahí suele ser otra forma (*menjarem/menjareu*, *el/la*).

Un aviso cuenta como acierto en el repaso espaciado.

**`wrong_answers`** se comprueban antes que la tolerancia. Si el usuario escribe uno de esos errores,
o algo que solo se diferencia de él en acentos, es un fallo y ve el `why` correspondiente.

El validador comprueba todo esto con el mismo corrector que usará la app:

- cada `answer` se corrige como acierto;
- cada `wrong_answer` se corrige como fallo;
- un `wrong_answer` que solo se diferencia de una respuesta en acentos obliga a `strict`;
- con `tolerant` y una pareja de diacrítico en la respuesta, avisa para que alguien decida.

## Composición de una unidad

5 lecciones × 12–14 ítems ≈ 65 ítems. Una lección dura unos 6–8 minutos.

| Lección | Para qué | Tipos predominantes |
|---|---|---|
| 1 | Presentar los puntos 1–2 | `choice`, `match`, `inline-choice` |
| 2 | Practicar los puntos 1–2 | `fill`, `order`, `choice` |
| 3 | Punto 3 e interferencia | `find-error`, `fill`, `choice` |
| 4 | Producir, todo junto | `transform`, `fill`, `order` |
| 5 | Repaso mezclado + lectura | todos, `reading` |

Mínimos que comprueba el validador (avisos):

- ≥ 10 ítems y ≥ 3 tipos por lección;
- ≥ 6 ítems por punto (para que el repaso pueda rotar entre ítems distintos y no se memorice una
  frase);
- `choice` ≤ 40 % de la unidad.

Reparto orientativo por unidad:

| Tipo | Ítems |
|---|---|
| `choice` | 15–20 |
| `fill` | 12–15 |
| `transform` | 6–10 |
| `find-error` | 6–8 |
| `order` | 5–7 |
| `inline-choice` | 3–5 |
| `match` | 2–3 |
| `reading` | 1–2 |

## Repaso espaciado (para la Fase 4)

El repaso se programa **por punto, no por ítem**, con FSRS (`ts-fsrs`). Cuando toca repasar un
punto, la app elige un ítem de ese punto: primero los fallados, luego los menos vistos, y nunca el
mismo dos veces seguidas. Un fallo programa el punto para pronto. Así se repasa la regla y no la
frase concreta que ya te sabes de memoria.
