# catala: memoria del proyecto

App personal para pasar de A2 a B2 en catalán: unidades con gramática explícita y ejercicios tipo
Duolingo, con repaso espaciado de los errores. Uso personal; repo privado.

## Decisiones (no reabrir sin preguntar)

- **Variante central, norma IEC 2016/2017** (15 diacríticos). Registro estándar.
- **Teoría, explicaciones y feedback siempre en catalán.** Lenguaje sencillo en A2.
- **PWA para móvil** (React + Vite + TS), estática y offline, preparada para empaquetar con
  Capacitor. **El usuario compila la APK en otro PC: aquí solo se escribe código.** Nada de
  despliegues ni builds nativos.
- **Sin audio generado ni dictado.** Sin traducción libre ni redacción libre.
- **Corrección tolerante** (acentos y erratas en palabras copiadas pasan con aviso), **estricta en
  ortografía**. Ver `docs/tipos-ejercicio.md`.
- **Repaso espaciado por punto gramatical** (FSRS, `ts-fsrs`), rotando ítems del punto.

## Estructura

- `docs/curriculo.md`: las 60 unidades (a2-01…b2-60).
- `docs/tipos-ejercicio.md`: los 8 tipos, marcas y reglas de corrección.
- `docs/guia-autoria.md`: instrucciones para escribir unidades (persona o subagente).
- `docs/exemple/a2-00-exemple/`: unidad modelo con un ítem de cada tipo.
- `docs/fuentes/`: temarios UAB A2/B1/B2 y modelo de examen B2 en texto (solo como alcance).
- `content/units/<id>-<slug>/{unit.yaml,theory.md}`: el contenido.
- `src/content/schema.ts`: contrato del contenido (Zod). `src/content/check.ts`: comprobaciones.
- `src/grading/grade.ts`: corrector de respuestas escritas, compartido por validador y app.

## Comandos

- `npm run validate [-- <carpeta>]`: valida unidades (por defecto `content/units`).
- `npm run languagetool -- <carpeta>`: pasa las frases correctas de las unidades por LanguageTool
  (`docker start languagetool`; la primera vez,
  `docker run -d --name languagetool -p 8010:8010 erikvl87/languagetool`). Da pistas, no veredictos.
- `npm test`: tests (vitest). `npm run typecheck`.

## Reglas

- Contenido (YAML, teoría) en catalán; código, comentarios y commits en inglés; docs en español.
- Un `id` de ítem publicado no cambia ni se reutiliza: de él cuelga el progreso.
- Ninguna forma admitida por la GEIEC puede ser distractor ni error (`docs/guia-autoria.md` §2).
- Una unidad se da por buena con `validate` a 0 errores **y** revisión de los puntos delicados.

## Estado

- 2026-10-19 — Fase 1 hecha: currículo, catálogo de tipos, guía de autoría, esquema, validador y
  corrector con tests.
- 2026-10-19 — Fase 2 (piloto): `a2-03`, `b1-14` y `b2-42` escritas por subagentes Sonnet con la
  guía y revisadas a mano; los fallos encontrados están ya como reglas en la guía (§2, §4, §7, §8,
  §11). Añadido `npm run languagetool`. **Pendiente: revisión de las tres unidades por el usuario.**
  Después: Fase 3 (producción de las 57 restantes); Fase 4, la app.
