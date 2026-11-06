# Contratos de Nexus · `cauce.leccion` y `cauce.recomendacion` · versión 0.2.0 (PROVISIONAL)

> **Importante:** el documento maestro `CAUCE_NEXUS_ARQUITECTURA_MAESTRA_v0.2.md` no estaba disponible al escribir
> esto. Estos contratos se reconstruyeron a partir de los requisitos de la fase 1 que dio Diego. Cuando llegue el
> documento hay que contrastarlos campo por campo; cualquier diferencia se corrige subiendo a 0.2.x o 0.3.0.

Son **independientes** de `cauce.estado-proyecto` 1.0.0 (ese contrato no cambia). Las referencias ejecutables son
`app/nexus/leccion.js`, `app/nexus/recomendacion.js` y `app/nexus/registro.js`; las pruebas en `pruebas/casos-nexus.js`.

## Reglas comunes

1. **Fechas con zona horaria siempre** (`2026-11-06T10:00:00-06:00` o `…Z`). Sin zona → rechazada.
2. **Sin datos privados:** credenciales, llaves, tokens, URL con clave, correos, teléfonos, CURP y tarjetas → rechazado.
3. **Solo crece:** nada se edita ni se borra. Corregir = nueva entrada. Cada entrada lleva `huella_anterior`
   (SHA-256 del JSON canónico de la entrada previa del archivo); borrar, editar o reordenar rompe la cadena y se detecta.
   Limitación: quitar la **última** entrada no se detecta con la cadena (lo cubre la copia de respaldo o git).
4. `es_demo` obligatorio; un registro de prueba no admite datos reales ni al revés.

## `cauce.leccion` (cada objeto es una versión)

| Campo | Oblig. | Descripción |
|---|---|---|
| `contrato`, `version_contrato` | Sí | `"cauce.leccion"`, `"0.2.x"` |
| `id` | Sí | `lec-…` (minúsculas, números, guiones). Igual en todas sus revisiones. |
| `revision` | Sí | 1, 2, 3… sin saltos. |
| `tipo_cambio` | Sí | `alta` (solo rev. 1), `correccion`, `revision` (p. ej. agregar una validación), `retiro`. |
| `motivo_cambio` | Rev. > 1 | Por qué cambia. |
| `registrado_en`, `registrado_por` | Sí | Cuándo y quién la registró (`{tipo: humano|ia|proceso, id}`). |
| `autor_conclusion`, `fecha_conclusion` | Sí | Quién sacó la conclusión y cuándo (para detectar información futura). |
| `titulo`, `enunciado` | Sí | Lo aprendido. |
| `proyecto_origen`, `proyectos_destino[]` | Sí | Ids de proyecto. |
| `naturaleza_resultado` | Sí | `exito`, `fracaso`, `neutro`, `mixto`, `inconcluso`. |
| `nivel_validacion` | Sí | `hipotesis` < `validada_en_origen` < `validada_independiente_en_destino`. Es lo que se **declara**; el gerente calcula lo que se **sostiene**. |
| `declara_reproducible` | No | `true` exige artefacto (referencia + huella SHA-256 + procedimiento); `false` lo deja claro; sin declarar = no evaluado. |
| `evidencias[]` | Sí (puede estar vacía) | `{id, tipo: experimento|registro|metrica|documento|afirmacion, uso: conclusion|validacion, descripcion, referencia?, huella?, procedimiento?, producida_por?, obtenida_en?, usa_datos_hasta?, periodo?, muestra?: {id, fuente?, tamano?, periodo?, solapa_con[], derivada_de[]}, metodo?: {configuraciones_probadas, evaluacion: en_muestra|fuera_de_muestra|validacion_cruzada|desconocida, datos_entrenamiento_hasta?, datos_prueba_desde?}}`. Una referencia `leccion:<id>` cita otra lección. |
| `antecedentes[]` | No | `{leccion_id, relacion: apoya|deriva_de|contradice|reemplaza}`. |
| `validaciones[]` | No | `{por, en, ambito: origen|destino, proyecto, resultado: confirma|refuta|inconcluso, evidencias: [ids]}`. |
| `vigencia.caduca_en` | Recomendado | Sin él, la regla de vigencia queda «no evaluado». |

Plantilla: `contrato/ejemplos/nexus/leccion-plantilla.json` (válida tal cual; cambia id, textos, fechas y evidencias). Para declarar reproducible: `declara_reproducible: true` y en la evidencia `huella` (SHA-256, 64 hex) + `procedimiento`.

## `cauce.recomendacion` (cada objeto es un evento)

`{contrato, version_contrato, id: "rec-…", secuencia, tipo, en, por, es_demo, …}`. Etapas:

```
propuesta ─revision─► en_revision ─aprobacion (persona)─► aprobada ─experimento─► en_experimento ─resultado─► con_resultado
    ▲  correccion ◄────────┘                                                                         │ adopcion (persona, solo si «mejora»)
    └──────────────────────────────────────────────────────────────────────────────────────────────── adoptada ─despliegue (persona)─► desplegada
rechazo (persona) → rechazada · retiro → retirada (desde cualquier etapa no final)
```

- `propuesta`/`correccion` llevan `contenido: {titulo, descripcion, proyecto_destino, lecciones: [{id, revision}], reversible, criterio_exito, …}`.
- `revision` lleva `dictamen: sin_objeciones|con_objeciones|incompleto`. La del gerente la genera `revisionDelGerente()`.
- `aprobacion`: solo una **persona**, distinta de quien propone, tras una revisión «sin objeciones» posterior a la última
  corrección, y con **todas** las lecciones citadas en su revisión vigente y «sin objeciones» al momento de aprobar
  (lo no evaluado nunca se aprueba). En la fase 1 `alcance` solo puede ser `experimento`.
- `resultado` exige evidencia con referencia que no sea solo una afirmación; `adopcion` exige resultado «mejora»;
  `despliegue` exige `referencia` (PR o commit del proyecto destino) y solo **registra** lo que una persona hizo fuera de Nexus.
- **Aprobada ≠ implementada:** `implementada` solo es verdadero en `desplegada`.
