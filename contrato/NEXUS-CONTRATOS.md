# Contratos de Nexus · `cauce.leccion` 0.2 y `cauce.recomendacion` 0.2 · reglas `nexus-R 0.2`

Implementación de `docs/CAUCE_NEXUS_ARQUITECTURA_MAESTRA_v0.2.md` (§3, §4, §5, §8). Son **independientes** de
`cauce.estado-proyecto` 1.0.0, que no cambia. Referencias ejecutables: `app/nexus/leccion.js`, `recomendacion.js`,
`gerente.js`, `registro.js`; pruebas T01–T24 en `pruebas/casos-nexus.js`.

## `cauce.leccion` 0.2

Exactamente los campos de la tabla §3 (las claves desconocidas se **rechazan**, también dentro de `origen`, `evidencia`,
`muestra`, etc.). Plantilla registrable: `contrato/ejemplos/nexus/leccion-plantilla.json`.

Interpretaciones que el documento deja abiertas (decididas así; revisables):

| Tema | Decisión |
|---|---|
| Fechas de día (`fecha_hallazgo`, `vigente_hasta`, periodos, `validado_en.fecha`) | Se aceptan `AAAA-MM-DD` (como el ejemplo §3.1). Para comparar, un día sin zona vale como intervalo de 00:00 UTC+14 a 24:00 UTC−12: si un instante cae dentro, R04 queda «no evaluado». |
| Instantes (`observado_en`, `conocido_en`, `revisiones[].fecha`, `decision_humana.fecha`, `historial[].fecha`) | Con zona obligatoria; sin zona la lección no es registrable (T17). |
| `revision` que citan las recomendaciones | Es la `version` de la última entrada de `revisiones[]` (en §4.1 se cita `"0.2"`, igual que la `version` de la revisión de §3.1). |
| Costos y ajustes (T18, T19) | En `muestra.supuestos[]` como texto o `{variable, valor, conocido}`; `ajuste_comparaciones` declara el ajuste por selección. |
| Extensiones Cauce 0.2 (opcionales) | `evidencia.exportado_en` (T07 la necesita y §3 no le da campo) y `evidencia.fraccion_estimada` (0–1, T21). |
| Tipos de evidencia con significado para las reglas | `texto_ia`, `inventario_ia`, `resumen_ia`, `auditoria_ia`, `memoria_ia` = texto de IA (no acredita hechos); `estado_tarea`, `ci`, `pr`, `etiqueta` = estado de proceso, no entregable; `informe`, `entregable`, `artefacto`, `resultado_verificado`, `verificacion_despliegue`, `despliegue` = entregable. |
| Marca de prueba | El documento no tiene `es_demo`. Los registros de prueba se marcan en el archivo (`es_demo: true`) y con ids `demo-…`; un registro real rechaza ids `demo-…` y al revés. |

## `cauce.recomendacion` 0.2

Campos obligatorios de §4, claves desconocidas rechazadas. Cada cambio de estado es una **versión nueva** en el
almacén con `historial` anexado (los eventos anteriores no cambian). Transiciones: `propuesta → revisada →
pendiente_aprobacion → aprobada | rechazada | aplazada`, `aplazada → pendiente_aprobacion`, cualquiera → `caducada`.

- **Aprobar** solo lo hace una persona (último evento `aprobada`, `autor_tipo: humano`), distinta de quien propuso, desde
  `pendiente_aprobacion`, con `decision_humana` completa, el experimento sin valores pendientes y las 10 reglas en
  `cumple` sobre las lecciones citadas **en su revisión vigente**. Lo no evaluado nunca se aprueba.
- `revision_esceptica` la calcula el gerente (`revisionEsceptica()`); si lo guardado dice `cumple` donde el cálculo no,
  el registro la rechaza (T12). `no_evaluada` no es un estado válido.
- `toca_parametros_financieros` o `toca_apuestas` = **bloqueo absoluto**: Nexus nunca registra ejecución ni adopción.
- Aprobada ≠ ejecutada ≠ adoptada ≠ desplegada; la adopción necesita referencia propia (no se deduce de la ejecución).

## Almacén (fase 1)

Dos archivos JSON que solo crecen (`datos/nexus/registro/` real, fuera de git; `datos/nexus/demo/` de prueba). Cada
entrada: `{registro, registrado_en, registrado_por: {tipo, identificador}, huella_anterior}`; `huella_anterior` es el
SHA-256 del JSON canónico de la entrada previa. Borrar, editar o reordenar se detecta; **quitar la última entrada no**
(lo cubre git o un respaldo).
