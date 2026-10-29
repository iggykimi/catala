# Siguientes pasos

Estado a 2026-10-29: las 60 unidades (3.902 ejercicios) están escritas y revisadas ítem a ítem, la
app está rediseñada y el [issue #1](https://github.com/iggykimi/catala/issues/1) (refinamiento
integral) está implementado en la rama `issue-1-refinament`, pendiente de merge. La APK v1.0 está
publicada, pero es anterior al issue #1. Esto es lo que queda, en orden.

## 0. Mergear el issue #1

Revisar la rama `issue-1-refinament` (paleta accesible, sesiones recuperables, tema, diálogos,
export/import, PWA manual, CI), mergear a `main` y cerrar el issue. Comprobación rápida:

```bash
git checkout issue-1-refinament
npm install
npm test           # 53 tests: corrector, validador, sesiones, borradores, ejercicios
npm run typecheck
npm run validate   # 60 unidades, 0 errores
npm run e2e        # 72 pasados en menos de 2 minutos
```

## 1. Generar la APK v1.1

La [v1.0](https://github.com/iggykimi/catala/releases/tag/v1.0) no lleva lo del issue #1. Tras el
merge, en el PC con Android Studio (`android/` ya es un proyecto Gradle completo con los iconos
del drac):

```bash
npm run build && npx cap sync
```

y compilar desde Android Studio. Tras cambiar contenido o código: `npm run build && npx cap sync`.

Qué mirar en el móvil:

- Sonido y vibración al acertar y al fallar (se apagan en el menú).
- El botón atrás de Android vuelve a la pantalla anterior.
- El icono (drac sobre amarillo) en el lanzador.
- Que **Comprova** queda siempre abajo, también con el teclado abierto.
- Cerrar la app a mitad de lección y comprobar que ofrece reprenderla.
- Cambiar el tema en Ajustos (Automàtic/Clar/Fosc).

## 2. Usarla y dar feedback

Pendiente de tu opinión:

- **El rediseño**: si ya no es «sosa», si sobra o falta algo. El porqué de cada elemento está en
  [`interfaz.md`](interfaz.md).
- **El contenido**: la bandera de la hoja de resultado marca un ejercicio sospechoso. Los marcados
  se listan en Ajustes; pásamelos y los reviso.

## 3. Ideas aparcadas

- **Prueba de nivel** al final de A2, B1 y B2, con ítems de todas las unidades del nivel. No está
  hecha.
- Fase 7 del issue #1 (panot refinado, repaso voluntario, panel de dificultades, más animaciones
  del dragón): documentada como opcional, sin implementar por decisión.
- Revisión de las unidades por una persona nativa o docente. La revisión hecha es de modelos, con la
  guía (`guia-autoria.md` §2) y LanguageTool.
