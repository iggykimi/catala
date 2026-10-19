# catala

App personal para aprender catalán de A2 a B2: 60 unidades con gramática explícita, ejercicios de
ocho tipos y repaso espaciado de los errores. Explicaciones en catalán, variante central.

Estado: **Fase 1**. Hay currículo, especificación de ejercicios, guía de autoría y validador; la
app todavía no existe. El detalle está en [`AGENTS.md`](AGENTS.md).

```bash
npm install
npm test                         # tests del corrector y del validador
npm run validate -- docs/exemple # valida la unidad de ejemplo
```

- [Currículo](docs/curriculo.md)
- [Tipos de ejercicio y corrección](docs/tipos-ejercicio.md)
- [Guía de autoría](docs/guia-autoria.md)
