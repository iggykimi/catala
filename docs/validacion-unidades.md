# Validación de las 60 unidades (2026-10-27)

60/60 unidades en `content/units`, 3902 ítems, `npm run validate`: **0 errores**.
Este informe es la puerta de revisión humana: todo lo mecánico está verde; abajo va
lo que necesita ojo humano.

## Método (resumen)

1. Lectura completa de las 5 unidades de Claude (a2-01, a2-02, a2-03, b1-14, b2-42)
   + guía de autoría + tipos + unidad modelo → rasgos de estilo fijados por escrito.
2. Piloto (a2-04, a2-05) con jueces, luego redacción masiva en paralelo (máx. 14
   vías) con juez por unidad + oleada de correcciones. Drafts existentes (a2-04,
   a2-05) preservados.
3. `validate` global a 0 errores; tests 16/16 y typecheck limpios; build OK
   (se subió el límite de caché de workbox a 4 MB por el tamaño del curso).
4. Dos barridos LanguageTool (servidor local en Docker, puerto 8010): 611
   hallazgos → oleada de 54 correctores (uno por unidad) → rebarrido con
   ≈430 residuales triados y **0 grupos nuevos**.
5. El orquestador cazó a mano 2 errores reales que pasaron los filtros
   (b1-29 `tosseix→serveix` en ítem y teoría; b1-18 `sàpigui` en why y teoría)
   y leyó muestras directas (teorías a2-06 y b2-45, ítems a2-06-001/006):
   catalán correcto, nivel ajustado, distractores plausibles con `why` citado,
   explicaciones coherentes con la teoría.

## Tabla por unidad

LT2 = hallazgos residuales del 2.º barrido LanguageTool, todos triados
(metalenguaje, errores deliberados en `source`, expresiones enseñadas,
`el + día habitual`, etc.). Veredicto OK = `validate` a 0 + LT triado.

| Unidad | Ítems | LT2 | Veredicto | Dudas |
|---|---|---|---|---|
| a2-01 | 65 | 0 | OK (Claude, intacta) | — |
| a2-02 | 65 | 0 | OK (Claude, intacta) | — |
| a2-03 | 65 | 0 | OK (Claude, intacta) | — |
| a2-04 | 65 | 2 | OK (piloto + jueces) | `el dissabte` habitual (aceptado) |
| a2-05 | 65 | 3 | OK (piloto + jueces) | `ni fu ni fa` enseñado (aceptado) |
| a2-06 | 65 | 1 | OK (muestra leída) | — |
| a2-07 | 65 | 3 | OK | — |
| a2-08 | 65 | 3 | OK | — |
| a2-09 | 65 | 6 | OK | — |
| a2-10 | 65 | 4 | OK | — |
| a2-11 | 65 | 2 | OK | — |
| a2-12 | 65 | 16 | OK | LT alto: revisar triaje si hay tiempo |
| b1-13 | 64 | 5 | OK | — |
| b1-14 | 65 | 0 | OK (Claude + 1 fix LT mío) | — |
| b1-15 | 65 | 11 | OK | — |
| b1-16 | 65 | 3 | OK | — |
| b1-17 | 66 | 2 | OK | — |
| b1-18 | 65 | 10 | OK | `sàpigui` como distractor (why corregido) |
| b1-19 | 65 | 19 | OK | LT alto: revisar triaje si hay tiempo |
| b1-20 | 65 | 7 | OK | — |
| b1-21 | 65 | 4 | OK | — |
| b1-22 | 65 | 1 | OK | — |
| b1-23 | 65 | 2 | OK | — |
| b1-24 | 65 | 1 | OK | — |
| b1-25 | 65 | 4 | OK | — |
| b1-26 | 65 | 3 | OK | — |
| b1-27 | 65 | 26 | OK | LT alto: revisar triaje si hay tiempo |
| b1-28 | 65 | 53 | OK | LT más alto (ortografía): revisar triaje |
| b1-29 | 66 | 2 | OK | `serveix` (error real, ya corregido) |
| b1-30 | 66 | 17 | OK | LT alto: revisar triaje si hay tiempo |
| b1-31 | 67 | 10 | OK | — |
| b1-32 | 65 | 15 | OK | LT alto: revisar triaje si hay tiempo |
| b1-33 | 65 | 7 | OK | — |
| b1-34 | 65 | 19 | OK | LT alto: revisar triaje si hay tiempo |
| b1-35 | 65 | 1 | OK | `que si` (aceptado, revisar) |
| b1-36 | 65 | 3 | OK | — |
| b2-37 | 66 | 5 | OK | — |
| b2-38 | 64 | 2 | OK | — |
| b2-39 | 65 | 2 | OK | — |
| b2-40 | 64 | 7 | OK | — |
| b2-41 | 65 | 6 | OK | — |
| b2-42 | 64 | 2 | OK (Claude, intacta) | — |
| b2-43 | 65 | 2 | OK | — |
| b2-44 | 65 | 0 | OK | — |
| b2-45 | 65 | 1 | OK (muestra leída) | `insistir en/a`: teoría acepta ambas |
| b2-46 | 66 | 18 | OK | LT alto: revisar triaje si hay tiempo |
| b2-47 | 65 | 2 | OK | — |
| b2-48 | 65 | 1 | OK | — |
| b2-49 | 64 | 13 | OK | — |
| b2-50 | 66 | 11 | OK | — |
| b2-51 | 65 | 26 | OK | LT alto (`fer-se el suec` ×22, aceptado) |
| b2-52 | 65 | 2 | OK | — |
| b2-53 | 64 | 14 | OK | — |
| b2-54 | 65 | 15 | OK | LT alto: revisar triaje si hay tiempo |
| b2-55 | 63 | 6 | OK | 63 ítems (mínimo del curso, válido) |
| b2-56 | 66 | 1 | OK | — |
| b2-57 | 65 | 1 | OK | — |
| b2-58 | 66 | 9 | OK | — |
| b2-59 | 64 | 21 | OK | LT alto: revisar triaje si hay tiempo |
| b2-60 | 66 | 5 | OK | `comerciar` intransitivo (DIEC, revisar); `al més aviat possible` como error deliberado en source |

## Para revisión humana (orden de prioridad)

1. **b1-28** (53 residuales LT, el más alto): confirmar que el triaje no coló
   ningún error real en una unidad de ortografía.
2. **b2-60-050** (`va comerciar` como distractor): el autor verificó en DIEC
   que *comerciar* es solo intransitivo; confirmar.
3. **b1-18** (`sàpigui` como distractor con why corregido): confirmar que el
   tratamiento es el pedagógicamente adecuado.
4. **b2-45-030** (`insistir en/a`): la teoría acepta ambas; confirmar criterio.
5. Aceptaciones globales: `fer-se el suec` (×22), `tot i així`,
   `el + día de la semana` habitual, `que si` (b1-35).
6. Unidades con LT alto (b1-27, b2-51, b1-19, b1-34, b2-46, b2-59, b1-30,
   a2-12, b1-32, b2-54): vistazo al triaje si hay tiempo.

## Límites honestos de esta validación

- No he leído íntegras las 55 unidades nuevas: la garantía es proceso
  (estilo + jueces + fixes + doble barrido LT con delta 0) más muestras
  directas, no lectura total.
- El e2e con 60 unidades tiene 2 fallos pendientes de triaje (uno es el
  localizador `Continua` del test que colisiona con una opción legítima
  «Continuaria…»; el otro, un botón Repàs inesperado): fuera del alcance
  «solo unidades», aparcado por indicación del usuario.
