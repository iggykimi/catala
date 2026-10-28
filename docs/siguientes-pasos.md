# Siguientes pasos

Estado a 2026-10-28: las 60 unidades (3.902 ejercicios) están escritas y revisadas ítem a ítem, y la
app está rediseñada. Esto es lo que queda, en orden.

## 1. Comprobar en el otro PC

```bash
git pull
npm install
npm test           # 18 tests: corrector, validador, sesiones
npm run typecheck
npm run validate   # 60 unidades, 0 errores
```

## 2. Pasar la prueba completa en la interfaz

`npm run e2e` juega todas las lecciones de las 60 unidades con las respuestas del contenido. Es la
única prueba que no se ha completado tras la revisión del contenido: en este PC el sistema la cortó
dos veces por falta de memoria, no por un fallo. Las pruebas cortas (error, recarga, repaso, aviso
de acento, botón atrás) sí pasaron con el diseño nuevo.

- Tarda unos 45 minutos. Mejor con el equipo libre y en primer plano.
- Si falla un ítem, el informe dice cuál (`a2-07-065`, por ejemplo). Casi siempre se arregla en el
  YAML de su unidad: una respuesta que no casa con las opciones o un orden de fichas imposible.
- Tras arreglarlo: `npm run validate` y volver a lanzar `npm run e2e`.

## 3. Generar la APK

Los pasos están en el [README](../README.md#apk-android). Si ya existe la carpeta `android/`, basta
con `npm run build && npx cap sync` y compilar desde Android Studio.

Qué mirar en el móvil:

- Sonido y vibración al acertar y al fallar (se apagan en el menú).
- El botón atrás de Android vuelve a la pantalla anterior.
- El icono (drac sobre amarillo) en el lanzador.
- Que **Comprova** queda siempre abajo, también con el teclado abierto.

## 4. Usarla y dar feedback

Pendiente de tu opinión:

- **El rediseño**: si ya no es «sosa», si sobra o falta algo. El porqué de cada elemento está en
  [`interfaz.md`](interfaz.md).
- **El contenido**: la bandera de la hoja de resultado marca un ejercicio sospechoso. Los marcados
  se listan en Ajustes; pásamelos y los reviso.

## 5. Ideas aparcadas

- **Prueba de nivel** al final de A2, B1 y B2, con ítems de todas las unidades del nivel. No está
  hecha.
- Revisión de las unidades por una persona nativa o docente. La revisión hecha es de modelos, con la
  guía (`guia-autoria.md` §2) y LanguageTool.
