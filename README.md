# catala

App personal para aprender catalán de A2 a B2: 60 unidades con gramática explícita, ejercicios de
ocho tipos y repaso espaciado de los errores. Explicaciones en catalán, variante central.

Estado y estructura en [`AGENTS.md`](AGENTS.md).

```bash
npm install
npm test                         # tests del corrector y del validador
npm run validate -- docs/exemple # valida la unidad de ejemplo
npm run dev                      # la app en el navegador
npm run e2e                      # juega todas las lecciones en un móvil simulado
```

## APK (Android)

En el PC con Android Studio:

```bash
npm install
npm run build
npx cap add android   # solo la primera vez
npx cap sync
npx cap open android  # compila y genera la APK desde Android Studio
```

Tras cambiar contenido o código: `npm run build && npx cap sync`.

- [Currículo](docs/curriculo.md)
- [Tipos de ejercicio y corrección](docs/tipos-ejercicio.md)
- [Guía de autoría](docs/guia-autoria.md)
