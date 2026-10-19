@AGENTS.md

# Específico de Claude Code

- Producción de unidades (Fase 3): un subagente por unidad, modelo `sonnet`, despachados en
  paralelo. El encargo incluye la ficha de `docs/curriculo.md` y la orden de leer
  `docs/guia-autoria.md`, `docs/tipos-ejercicio.md` y `docs/exemple/` antes de escribir, y de
  terminar con `npm run validate` a 0 errores. Haiku no redacta catalán.
- La revisión lingüística de una unidad la hace un agente distinto del que la escribió.
