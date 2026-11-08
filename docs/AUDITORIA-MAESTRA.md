# Auditoría maestra de cierre (2026-11-08)

Rama `claude/auditoria-maestra`, sobre `claude/laboratorio-fase-3-1` (PR #32). Entorno: contenedor Linux, Node 22, Chromium
con SwiftShader. **Nada se midió en la Intel UHD de la MSI ni se probó con Claude de verdad**; toda respuesta «de modelo»
de las pruebas es sintética y se declara como tal. El informe completo está en la carpeta del proyecto
(`cauce/laboratorio-ia/auditoria/INFORME-AUDITORIA-MAESTRA.md`); este documento resume lo que vive en el repositorio.

## Qué se corrigió (defectos confirmados, reproducidos antes de tocar código)

| ID | Gravedad | Módulo | Defecto | Corrección | Prueba |
|---|---|---|---|---|---|
| A-01 | media | `laboratorio/expediente.js` | Reanudar un expediente no cruzaba huellas entre documentos: una ejecución, un encargo, una verificación, las importaciones, los hechos o la vigencia de la ficha podían alterarse en el archivo y se cargaban igual (solo lab-V lo notaba al correr el rol siguiente). | `cruzarHuellas()`: cada verificación se **recalcula** con lab-V y debe salir idéntica; ejecución↔encargo, pasos↔documentos, importaciones aceptadas↔ejecuciones, hechos/origen/vigencia↔ficha. | `casos-auditoria.js` A-01 (4 pruebas); fase 3 «una ejecución cambiada…» actualizada |
| A-02 | media | `laboratorio/verificador.js` | Una afirmación del Investigador **sin respaldo** (cita inexistente) servía de base válida a inferencias y recomendaciones del Analista: su verificación salía «apta». La salida de un rol se volvía evidencia por repetirse. | Alerta `base_sin_respaldo` (categoría evidencia) → `con_fallas` e informe `requiere_evidencia`. lab-V pasa a **0.2**. | A-02 |
| A-03 | baja | `laboratorio/expediente.js` | Un guardado que quedó en `en_analisis` (cierre a mitad o archivo recortado) se cargaba sin salida posible en la vista. | Vuelve a `pendiente` con constancia y, si es manual, vuelve a esperar al rol que toca reutilizando pasos verificados. | A-03 |
| A-04 | media | `laboratorio/propuesta-nexus.js`, `nexus/registro.js` | El borrador de lección de un trabajo **DEMO** no llevaba el prefijo `demo-`: el almacén de prueba lo rechazaba y, con huellas añadidas a mano, el almacén REAL lo **admitía**. | Prefijo `demo-` cuando el trabajo es DEMO; `admisionReal` rechaza `muestra.naturaleza = "demo"`. | A-04; `nexus-cli.mjs` 17 OK |
| A-05 | media (ergonomía) | `laboratorio/roles.js`, `manual.js` | La solicitud decía «usa alternativa_a para enlazar alternativas» y el contrato exige **un** id o null: una respuesta con `[]` o `["h2"]` se rechazaba entera. | Solicitud: «el id de UNA hipótesis rival, o null». `[]`→null y `[id]`→id se declaran; varios → error de contrato claro. | A-05 |
| A-06 | compat. | `base.js`, `contratos.js`, `expediente.js` | Añadir una regla a lab-V habría invalidado verificaciones guardadas al recalcularlas. | Contrato acepta `lab-V 0.1` y `0.2`; al reanudar, misma versión = idéntica; versión anterior = lo literal idéntico y la nueva solo añade alertas. | A-06 |

Pruebas nuevas además: **A-07** invariante fundamental de punta a punta (inyección, dinero, HTML, comandos, prototipos,
decisión fabricada, autoaprobación, Nexus) y **A-08** 400 mutaciones deterministas sin excepciones.

## Resultados

| Conjunto | Antes | Después |
|---|---|---|
| Node `pruebas/ejecutar.mjs` | 499 / 0 | **510 / 0** |
| `pruebas.html` en Chromium | 499 / 0 | **510 / 0**, sin errores de consola |
| `laboratorio-fase3.cjs` / `laboratorio-fase3-1.cjs` | 27/27 · 16/16 | 27/27 · 16/16 |
| `nexus-cli.mjs` / `laboratorio-node.mjs` / `piloto-node.mjs` | 17 · 9 · 6 | 17 · 9 · 6 |

## Lo que se comprobó y NO falló (pruebas específicas)

Transiciones imposibles, aprobación temprana, cambio de adaptador, reloj que retrocede, documentos reordenados, ids
repetidos, `__proto__`/`constructor`, `<script>` como texto, recomendación con dinero excluida, IA que intenta aprobar,
DEMO/REAL mezclados, propuesta a Nexus sin aprobación; en la oficina 3D: geometrías y texturas constantes tras 30
aperturas del Laboratorio, 15 de sala/Nexus/CSI, 25 recargas y 6 cambios de modo (SwiftShader).

## Límites de diseño que siguen (documentados, no corregidos)

- lab-V comprueba **existencia literal**, no apoyo: una afirmación que niega su propia cita sale «apta» (lo decide una persona).
- Un extracto con comillas cambiadas (`«»` → `""`), minúsculas o guion distinto sale «no encontrada». Propuesta (decisión de Diego): tratar la equivalencia de comillas como corrección de forma declarada.
- El detector de inyección da falsos positivos («no conviene ignorar las reglas…») y manda a `requiere_evidencia`: conservador.
- La procedencia del modelo es declarada; el guardado local es del navegador; truncar el registro de Nexus no lo detecta la cadena (ancla fuera del equipo).

## Ascensor (#29): pausa al llegar a un piso

Medido en una copia local instrumentada de la rama (la rama no se tocó): construir el piso cuesta 2–80 ms y compilar
sombreadores 4–13 ms; el hueco de 300–430 ms lo causa el **primer dibujo** del piso nuevo (146–191 ms en SwiftShader) más
tareas largas fuera del cuadro. **Sin ascensor** los mismos cambios de piso dan huecos de 110–322 ms. La pausa es del
primer dibujo, no del ascensor; #29 la concentra tras el velo y la hace más visible con la cámara en movimiento. Hay que
medir en la UHD (`?medir=1`) antes de decidir; mitigación posible (en #29): precalentar el piso destino fuera de cámara.

## Integración de PR

`main` es ancestro de toda la cadena (#27→#28→#30→#31→#32→auditoría) y de #29. #29 sobre la cadena choca solo en
`pruebas.html` y `pruebas/ejecutar.mjs` (ambos añaden import y registro de casos: se unen). `app/app.js` se fusiona solo.

## Ficha 0.2 (`error.mensaje`, `actividad`): propuesta, no implementada

Valor real: el Investigador podría citar la causa del error de un agente. Riesgo: `error.mensaje` es texto libre de un
motor externo (puede traer rutas, SQL, nombres de host) que viajaría a la conversación de Claude y al expediente; además
cambia `VERSION_FICHA` y con ello las huellas de toda ficha. Hoy no hay expedientes reales, así que el momento de hacerlo
es **antes** de acumularlos, pero solo con: filtro `buscarDatosPrivados`, recorte de longitud y una línea por agente.
Decisión de Diego.
