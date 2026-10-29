# Siguientes pasos

Estado a 2026-10-29: las 60 unidades (3.902 ejercicios) están escritas y revisadas ítem a ítem,
los issues #1 (refinamiento), #2 (hardening) y #3 (auditoría/contraste/APK v1.1.1) están mergeados en
`main` y la APK [v1.1.1](https://github.com/iggykimi/catala/releases/tag/v1.1.1) publicada ya los
lleva. El issue #4 (feel Android nativo: respuesta al toque, avance automático, atrás nativo) está
hecho en la rama `issue-4-android-feel` con 88 e2e verdes y APK local `catala-issue4.apk`, pendiente
de merge y release. Esto es lo que queda, en orden.

## 0. Instalar la v1.1.1 y probarla en el móvil

Descargar la APK desde el [release](https://github.com/iggykimi/catala/releases/tag/v1.1.1) e
instalarla encima de la anterior si la tienes. Para regenerarla desde código, en el PC con Android
Studio (`android/` ya es un proyecto Gradle completo con los iconos del drac):

```bash
npm run build && npx cap sync
```

y compilar desde Android Studio. Tras cambiar contenido o código: `npm run build && npx cap sync`.

Qué mirar en el móvil:

- Sonido y vibración al acertar y al fallar (se apagan en el menú).
- El botón atrás de Android vuelve a la pantalla anterior.
- El icono (drac sobre amarillo) en el lanzador.
- Que **Comprova** / **Continua** queda siempre abajo, también con el teclado abierto.
- Respuesta al toque y avance automático tras acierto (Ajustos → Avanç automàtic).
- Cerrar la app a mitad de lección y comprobar que ofrece reprenderla.
- Cambiar el tema en Ajustos (Automàtic/Clar/Fosc).
- Borrar el progreso con una sesión pendiente: no debe reaparecer.
- Importar una copia: pide confirmación con resumen y sustituye todo.
- Probar sin conexión: abrir, estudiar, guardar y reanudar.

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
