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

`npm run e2e` juega todas las lecciones de las 60 unidades con las respuestas del contenido.
**Hecho el 2026-10-28: 65 pasados y 2 omitidos (las capturas, que solo corren con `SCREENS=`) en
2,0 minutos.** La prueba es ahora un test por unidad (antes, uno solo secuencial para todo el curso,
que tardaba ~45 min con un solo trabajador) y corre con movimiento reducido, sin esperas de
animación ni confeti.

- Si falla un ítem, el informe dice cuál (`a2-07-065`, por ejemplo). Casi siempre se arregla en el
  YAML de su unidad: una respuesta que no casa con las opciones o un orden de fichas imposible.
- Tras arreglarlo: `npm run validate` y volver a lanzar `npm run e2e`.

## 3. Generar la APK

Los pasos están en el [README](../README.md#apk-android). Build web y `npx cap sync` ya hechos
aquí, pero la carpeta `android/` de este PC no tiene proyecto Gradle (ni `gradlew` ni
`app/build.gradle`, solo los assets sincronizados): en el PC de compilación hay que crearla antes
con `npx cap add android` (si la carpeta incompleta existe, borrarla primero) y luego
`npm run build && npx cap sync` y compilar desde Android Studio.

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
