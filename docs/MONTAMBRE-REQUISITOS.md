# Montambre en Cauce: qué hay y qué falta (fase I)

**Revisado el 2026-11-04**, solo lectura, en `dass-666/MONTAMBRE`, rama `main` (README «Estado de archivos» y carpetas `apps/`, `packages/`, `tools/`). No se modificó nada en Montambre.

## Hechos comprobados
| Pieza | Estado en `main` | Naturaleza para Cauce |
|---|---|---|
| `apps/web`: búsqueda, mapa, ficha | Existe | Módulo: responde a quien lo usa, no corre solo |
| `apps/web`: `/registrar`, `/mis-lugares` | Existe (acceso de desarrollo sin verificación) | Módulo usado por una persona |
| `apps/web`: `/moderacion` | Existe | Decisión **humana** |
| `tools/coverage-test` | Existe, sin datos reales | Herramienta que se corre a mano |
| `apps/worker` (pg-boss, importador) | **Solo README** | No existe todavía |
| `packages/agents` (agentes de IA, fase 2) | **Solo README** | No existe todavía |
| CI de GitHub | Existe | Infraestructura de desarrollo; no es un proceso del producto |

**Conclusión:** hoy Montambre **no tiene ningún proceso automático ni agente** que representar. Cauce lo muestra «Sin conexión», con 4 cuartos vacíos (`escena/montambre.json`) y sin personajes. No hay DEMO a propósito: inventar actividad de ejemplo sería engañoso.

## Qué haría falta para conectarlo (cuando exista algo que observar)
1. Que exista `apps/worker` con su cola (pg-boss guarda cada trabajo con estado y horas: sería la evidencia).
2. Un exportador de **solo lectura** en Montambre que escriba `datos/reales/montambre.json` con el contrato v1, sin datos personales de negocios ni usuarios (solo conteos y estados).
3. `escena/montambre-naturaleza.json`: worker = automático/reactivo según cómo se dispare; moderación = humano; web = módulo.
4. Autorización de Diego para tocar el repositorio de Montambre (esta fase no lo hizo).

Hasta entonces no hay nada que construir del lado de Cauce: el piso ya está listo para recibir el archivo.
