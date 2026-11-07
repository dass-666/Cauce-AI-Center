# Documentos del exportador de Ek Chuah (PR #2)

Generados con `docs/cauce/generar_ejemplos.py` de Ek Chuah, rama `claude/exportador-cauce`, commit `a23e06c`,
**con bases SQLite sintéticas** (nunca con la base real de Ek Chuah). Ek Chuah no se modificó.

- `demo-*.json`: los 4 ejemplos versionados en Ek Chuah (`docs/cauce/ejemplos/`), tal cual (`es_demo: true`).
- `real-*.json`: los mismos 4 escenarios con `generar_ejemplos.py --real <carpeta>` (`es_demo: false`,
  `fuente.tipo: "adaptador"`). "REAL" aquí solo significa que el archivo tiene la forma de una exportación
  real; **los datos son sintéticos**. Las pruebas corren sus horas a "ahora" para que estén vigentes.

Escenarios: `dia-normal` (tarea diaria terminó bien), `fallas` (una serie falló y la tarea salió con código 1),
`sin-evidencia` (base vacía, sin log ni análisis) y `sin-base` (no existe la base).
