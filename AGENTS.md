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
- `src/app/`: la PWA (React). `session.ts` y `progress.ts` son la lógica pura (sesiones, FSRS por
  punto, progreso en `localStorage`); `exercises.tsx`, los 8 tipos; `App.tsx`, pantallas y navegación
  (pila de pantallas reflejada en el historial: el botón atrás de Android funciona).
- `src/content/vite-plugin.ts`: mete `content/units` en la app como `virtual:content` y valida cada
  unidad en el build (una unidad con errores rompe el build).
- `e2e/`: Playwright en móvil (Pixel 7). `app.spec.ts` juega **todas las lecciones de todas las
  unidades** con las respuestas del YAML: si un ítem no se puede responder en la interfaz, falla.
  `screens.spec.ts` solo hace capturas (claro y oscuro) para revisión visual.

## Comandos

- `npm run validate [-- <carpeta>]`: valida unidades (por defecto `content/units`).
- `npm run languagetool -- <carpeta>`: pasa las frases correctas de las unidades por LanguageTool
  (ver abajo). Da pistas, no veredictos.
- `npm test`: tests unitarios (vitest). `npm run typecheck`.
- `npm run dev` / `npm run build`: la app. `npm run e2e`: tests e2e (construye y sirve la app).
- `SCREENS=<carpeta> npx playwright test screens`: capturas para revisar a ojo.
- `npx tsx scripts/icons.ts`: regenera los PNG del icono desde `public/icon.svg`.

## LanguageTool (solo para escribir contenido)

Corrector gramatical de código abierto con catalán (el de Softcatalà se basa en él). Corre en local
como servidor en Docker (`localhost:8010`), sin mandar el contenido fuera. Es una de las capas de
control de las unidades. En el piloto cazó errores reales (*He de arribar*, *trucar el metge*). No
detecta distractores que sean correctos ni explicaciones falsas, así que no sustituye a la revisión.
**La app no lo usa.**

- Arrancarlo solo mientras se escriben o revisan unidades, y pararlo al terminar.
- Necesita Docker Desktop abierto (`C:\Program Files\Docker\Docker\Docker Desktop.exe`).
- Primera vez: `docker run -d --name languagetool -p 8010:8010 erikvl87/languagetool`.
- Después: `docker start languagetool` / `docker stop languagetool`. Tarda unos segundos en
  responder tras arrancar.
- Otro servidor: variable `LANGUAGETOOL_URL`.

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
- 2026-10-23 — Fase 4: app hecha y validada (e2e 5/5, todas las lecciones jugadas en la
  interfaz; revisión visual claro/oscuro). Criterio de interfaz: nada que no aporte o que se
  deduzca de otro elemento; inventario razonado en `docs/interfaz.md`.
- 2026-10-23 — Unidades `a2-01` y `a2-02` (Sonnet + revisión a mano + LanguageTool + e2e).
  Hechas: a2-01, a2-02, a2-03, b1-14, b2-42. Siguiente: a2-04 en adelante, de dos en dos.
  **Pendiente: feedback del usuario sobre unidades y app.**
- 2026-10-27 — Redacción masiva orquestada (MuseCode): 60/60 unidades, 3902 ítems,
  `validate` a 0 errores, jueces por unidad + doble barrido LanguageTool (delta 0).
  Informe y dudas para revisión humana en `docs/validacion-unidades.md`.
  e2e con 60 unidades: 2 fallos pendientes (aparcados, fuera de alcance «solo unidades»).
