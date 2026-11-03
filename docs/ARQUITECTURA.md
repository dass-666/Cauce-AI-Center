# Arquitectura

```
Ek Chuah  ──adaptador (solo lectura)──►  datos/reales/ek-chuah.json  ─┐
Compago   ──adaptador (solo lectura)──►  datos/reales/compago.json   ─┼─► servir.py (127.0.0.1) ─► navegador
(demo)    ─────────────────────────────►  datos/demo/*.json          ─┘
                                                                          │
                     app/nucleo/  contrato.js  → valida y corrige         │
                                  modelo.js    → decide qué se muestra    │
                                  estados.js   → catálogo de 6 estados    │
                     app/vistas/  vista2d.js   (hoy)  ┐ misma interfaz:   │
                                  vista3d.js   (fase 4)┘ dibujar(modelo)  │
                                  panel.js     → detalle compartido       ┘
```

## Principios

- **Una sola dirección:** los sistemas escriben un JSON; el centro lo lee. El centro nunca escribe en un sistema, nunca abre sus bases y nunca ejecuta sus comandos.
- **Las reglas viven en el núcleo, no en las vistas.** `modelo.js` decide si un dato es confiable y qué estado mostrar. La vista 2D y la futura 3D solo dibujan. Así la 3D no puede "olvidar" una regla.
- **Costo cero:** sin servicios externos, sin bibliotecas en tiempo de ejecución, sin IA. `servir.py` usa solo la biblioteca estándar de Python y escucha únicamente en `127.0.0.1`.
- **Un piso por proyecto:** cada proyecto es un piso del edificio; cada departamento, un cuarto. Agregar Tezcatlipoca o trading = un adaptador + una escena + una línea en `datos/proyectos.json`.

## Preparado para la oficina 3D (fase 4)

- `estados.js` ya define para cada estado la animación 3D (`sentado_tecleando`, `de_pie_alerta`, `levantar_mano`, `ausente`…). `ausente` = silla vacía: nunca un personaje animado sin evidencia.
- `escena/*.json` ya da posiciones en celdas con `metros_por_celda`, `ancho`, `alto` y `piso`.
- Los `indicadores` son los letreros luminosos del video.
- `vista3d.js` implementará `crearVista3D(contenedor, { alSeleccionar })` → `{ dibujar(modelo, seleccion), destruir() }`, igual que la 2D. `app.js` elegirá una u otra; *Bajo consumo* volverá a la 2D.
- Plan técnico previsto: Three.js (licencia MIT) copiado al repositorio en versión fija, cámara ortográfica, luces horneadas, sin sombras ni postprocesado en celular, dibujar solo cuando cambia algo, y recursos CC0 registrados en `docs/LICENCIAS.md`.

## Adaptadores

**Compago (fase 2, construido):** comando `exportar_cauce` en la rama `cauce/exportador-solo-lectura` de Compago (`apps/core/cauce.py`). Usa los modelos de Compago, así que funciona igual con SQLite y PostgreSQL. Garantiza solo lectura en la base (`PRAGMA query_only` / transacción `READ ONLY`), hace 18 consultas por ciclo sin importar el volumen y no exporta nombres de proveedores, productos, archivos, términos de búsqueda, usuarios ni textos de error. Si ya hay un archivo real, el visualizador lo usa; si no existe, muestra la demostración.

**Ek Chuah (pendiente):**

| Proyecto | Evidencia disponible | Limitación conocida |
|---|---|---|
| Ek Chuah | `fetch_log` (descargas con inicio, fin, estado y error), `alerts_sent`, `logs/alertas_diarias.log` | Simulaciones y análisis de riesgo no registran ejecuciones: se verán *Sin información*. |
| Compago | `ImportJob`/`ImportBatch`, `SearchRun`, `SourceCheck`, `apps/core/estado.py`, conteos de oportunidades | La importación se aplica en una sola transacción y no guarda avance por fila: no hay porcentaje real. |

Condiciones para ambos: abrir la base en modo solo lectura (o con un usuario de solo lectura), consultas acotadas e indexadas, frecuencia baja (cada 5–15 min o al terminar una tarea), y nunca en el servidor compartido.
