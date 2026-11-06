# CAUCE NEXUS — Arquitectura maestra v0.2

**Estado:** propuesta consolidada para aprobación humana; **no implementada**. **Fecha:** 2026-11-06. **Origen:** arquitectura v0.1 y revisiones de Compago, Ek Chuah y Tezcatlipoca. Este documento sustituye v0.1 como *borrador de diseño*, no modifica contratos o repositorios existentes.

## 1. Decisión y fronteras

Cauce Nexus será un **gerente supervisado de conocimiento**: recibe lecciones autorizadas, exige evidencia, detecta objeciones, propone experimentos aislados y registra decisiones humanas. No aprende automáticamente por almacenar historial; no ejecuta apuestas, operaciones financieras, compras, cambios de riesgo, escrituras en repositorios ni despliegues. Cauce AI Center visualiza, no gobierna. La Fase 1 es **manual, sin exportadores nuevos ni IA**.

Se preserva **`cauce.estado-proyecto` 1.0.0** sin modificarlo. La información de Nexus tendrá un esquema independiente `cauce.nexus-resumen` 0.2, opcional y futuro. No se inventará una versión 1.1 ni se insertarán campos ajenos en 1.0.0. La integración visual podrá usar un proyecto adicional conforme al contrato vigente, previa validación, sin suponer que el exportador actual de Tezcatlipoca es compatible: su formato fue señalado como incompatible por su propio validador.

## 2. Modelo conceptual y vocabulario

**Lección** = afirmación delimitada, con evidencia y restricciones. **Recomendación** = propuesta falsable de actuación; no es autorización. **Experimento** = protocolo prerregistrado y ejecución documentada. **Adopción** = incorporación del cambio a código/configuración; **despliegue** = instalación efectiva; **resultado** = artefacto comprobado. Son estados diferentes.

**Autoría**: `humano`, `codigo`, `ia`. Una salida de IA puede proponer hipótesis u objeciones, nunca ser por sí sola evidencia independiente. **Procedencia del origen**: `medicion`, `revision_humana`, `texto_ia`; el último no cuenta como evidencia de hechos. Una auditoría asistida por IA no se convierte en confirmación independiente por haber sido repetida en dos proyectos.

**Naturaleza de datos** (`muestra.naturaleza`): `sintetica`, `demo`, `real_historica`, `real_comercial`. **Naturaleza de resultado** (`muestra.naturaleza_resultado`): `prueba_tecnica`, `backtest`, `simulacion`, `resultado_operativo_real`, `sin_resultado`. Son ejes independientes: un backtest puede usar series históricas reales sin representar rendimiento real.

**Confianza** (`baja`, `media`, `alta`) se aplica a una **afirmación específica** y no se hereda entre proyectos. Alta en funcionamiento técnico puede justificarse con pruebas independientes reproducibles y cobertura suficiente; alta en beneficio comercial/financiero exige resultados reales pertinentes, diseño adecuado y evaluación independiente. Una muestra sintética de n=1 jamás prueba prevalencia ni mejora económica.

## 3. Contrato `cauce.leccion` versión 0.2

JSON/YAML, una lección por registro; el validador futuro rechazará claves desconocidas, salvo extensión versionada y aprobada. Los campos marcados `?` son opcionales o nulos con motivo; los demás son obligatorios para una **lección registrable**. Una propuesta incompleta puede existir en un borrador fuera del catálogo validado.

| Campo | Especificación |
|---|---|
| `id`, `esquema`, `version_esquema` | ID estable; `cauce.leccion`; `0.2` |
| `tipo` | `metodo`, `hallazgo`, `estrategia`. `estrategia` = restringida; no se exporta entre proyectos |
| `origen` | `{proyecto, componente, version_sistema, commit?, tipo: medicion/revision_humana/texto_ia}` |
| `autor` | `{tipo: humano/codigo/ia, identificador}`; no publicar identificadores personales sensibles |
| `hallazgo` | Afirmación comprobable, sin promesa causal no demostrada |
| `antecedentes` | Lista de IDs de lecciones derivadas, incluso de otros proyectos; vacía si no existen |
| `evidencia[]` | `{tipo, referencia, ubicacion, commit?, observado_en?, conocido_en?, base_conocimiento, proyecto_ejecutor, dataset_id?, sha256?, reproducible_declarado, reproduccion_independiente?}` |
| `procedencia` | `{metodo, periodo_inicio?, periodo_fin?, comando?, alcance, limitaciones_fuente[]}`; comandos solo permitidos si no revelan secretos |
| `fecha_hallazgo`, `vigente_hasta` | Fechas ISO; caducidad explícita, revisión al cambiar motor, fuente o dominio |
| `muestra` | `{n?, n_rango?, unidad, n_independiente?, unidad_independencia?, n_efectivo?, independencia, naturaleza, naturaleza_resultado, seleccion_en_muestra, n_comparaciones?, cobertura?, supuestos[]}` |
| `confianza` | `{nivel, objeto: metodo/efecto_operativo/beneficio_economico, justificacion}` |
| `limitaciones` | Lista explícita, incluyendo `no_aplica_si` en texto estructurado o campo propio |
| `aplicaciones_posibles[]` | `{proyecto, hipotesis}`; propuestas, nunca validaciones |
| `validacion` | `{estado, validado_en:[{proyecto, prueba_ref, commit?, fecha, resultado, dataset_id?, sha256?}]}` |
| `revisiones[]` | Eventos con autor, tipo, fecha ISO con zona, decisión, justificación, versión; historial de solo anexado |
| `sensibilidad` | `sin-datos-comerciales`, `interno`, `restringida`; restringida no exportable |

**Detalle de `evidencia[]`:** `ubicacion` = `main`, `pr_abierto`, `desplegado`, `fuera_de_repo`; para fuentes que no son código se usa `fuera_de_repo` con referencia y conservación verificable. La ubicación NO demuestra ejecución; un PR verde tampoco. `observado_en` es instante ISO 8601 con zona o `null` con motivo. `conocido_en` (`known_at`) es el instante en que el dato estuvo disponible, separado de la observación y de la exportación. `base_conocimiento` = `vintage`, `observed`, `estimated`, `desconocida`; si se estima, declarar fracción estimada cuando sea medible. Una fecha sin zona es inválida para comparaciones temporales estrictas, salvo que se marque como desconocida y la regla R04 no apruebe. `reproduccion_independiente` contiene `{quien, fecha, referencia, sha256?}`; `reproducible_declarado=true` no implica reproducción externa.

**Independencia:** `n` es conteo bruto; `n_independiente` cuenta unidades únicas; `n_efectivo` representa la muestra estadísticamente efectiva y puede ser `null` si no se estima (R03/R08 no aprobarán afirmaciones que lo requieran). Para datos sensibles `n_rango` reemplaza `n` cuando basta un rango; no se divulgarán recuentos comerciales exactos por defecto. `n_comparaciones` documenta búsqueda de mejores alternativas; `seleccion_en_muestra=true` impide atribuir validación fuera de muestra a la misma selección.

**Validación:** estados `propuesta`, `en_prueba`, `validada_en_origen`, `validada_en_destino`, `refutada`, `caducada`. `validada_en_origen` requiere una prueba pertinente identificable, resultado verificable y revisión independiente; para **correcciones de código** requiere evidencia de la versión integrada en `main` (o despliegue verificado si el objeto es operativo), no solo PR. Una prueba técnica puede validar que el código hace algo, sin validar su impacto económico. `validada_en_destino` requiere prueba nueva y propia del destino, posterior al planteamiento, con referencia, criterio prerregistrado y revisión ajena al autor. Los estados no se asignan automáticamente por una etiqueta ni por CI aislada. Se permite conservar como `propuesta` una lección útil aun cuando su reproducción esté pendiente.

### 3.1 Ejemplo de lección registrable, no validada

```json
{
  "id":"compago-L3-2026-11-06", "esquema":"cauce.leccion", "version_esquema":"0.2",
  "tipo":"metodo",
  "origen":{"proyecto":"compago","componente":"revisor-esceptico","version_sistema":"reglas 1.6.0 (detección introducida en 1.3.0)","commit":"57c166e","tipo":"revision_humana"},
  "autor":{"tipo":"humano","identificador":"revision-documental"},
  "hallazgo":"Dos registros duplicados no son dos observaciones independientes.",
  "antecedentes":[],
  "evidencia":[{"tipo":"evaluacion-sintetica","referencia":"evaluacion/LEEME.md caso C16","ubicacion":"main","commit":"57c166e","observado_en":null,"conocido_en":null,"base_conocimiento":"desconocida","proyecto_ejecutor":"compago","reproducible_declarado":true,"reproduccion_independiente":null}],
  "procedencia":{"metodo":"evaluacion_sintetica","periodo_inicio":"2026-10-28","periodo_fin":"2026-10-28","alcance":"caso C16; sin frecuencia real","limitaciones_fuente":[]},
  "fecha_hallazgo":"2026-10-28","vigente_hasta":"2027-05-06",
  "muestra":{"n":1,"unidad":"caso sintético","n_independiente":1,"unidad_independencia":"caso","n_efectivo":1,"independencia":"no_aplica","naturaleza":"sintetica","naturaleza_resultado":"prueba_tecnica","seleccion_en_muestra":false,"n_comparaciones":1,"cobertura":null,"supuestos":[]},
  "confianza":{"nivel":"baja","objeto":"metodo","justificacion":"Demuestra un defecto en un caso; no mide su prevalencia."},
  "limitaciones":["Solo duplicados exactos","no_aplica_si: existe prueba de independencia entre registros"],
  "aplicaciones_posibles":[{"proyecto":"tezcatlipoca","hipotesis":"Contar partidos únicos en vez de filas cambia alguna conclusión."}],
  "validacion":{"estado":"propuesta","validado_en":[]},
  "revisiones":[{"fecha":"2026-11-06T17:00:00-06:00","autor_tipo":"humano","autor":"revision-documental","decision":"propuesta","justificacion":"Ejemplo de contrato; no incorporación real a Nexus","version":"0.2"}],
  "sensibilidad":"sin-datos-comerciales"
}
```

El ejemplo es **ilustrativo** y no equivale a una lección incorporada o a una prueba ejecutada en este turno. La fecha exacta del evento de revisión es ilustrativa. Las referencias y versiones proceden de la revisión de Compago, que leyó el código pero no volvió a ejecutar pruebas.

## 4. Contrato `cauce.recomendacion` versión 0.2

Campos obligatorios: `id`, `esquema`, `version_esquema`, `estado`, `destino`, `lecciones` (ID y revisión), `problema`, `hipotesis`, `accion_propuesta`, `experimento`, `riesgos`, `permisos_requeridos`, `toca_parametros_financieros`, `toca_apuestas`, `revision_esceptica`, `decision_humana`, `ejecucion`, `adopcion`, `historial`.

`estado`: `propuesta`, `revisada`, `pendiente_aprobacion`, `aprobada`, `rechazada`, `aplazada`, `caducada`. `experimento`: `{metrica_primaria, linea_base, muestra, unidad_independencia, n_minimo, ventana, criterio_exito, criterio_fracaso, parada, aislamiento, reversion, preregistro_ref}`. Los valores pendientes se permiten **solo** en borradores no aprobables. `revision_esceptica`: `{version_reglas:"nexus-R 0.2", reglas:[{id, estado, motivo, evidencia_consultada}], revisor:{tipo, identificador}}`; estado de regla: `cumple`, `no_cumple`, `no_evaluado` (nunca `no_evaluada`). `decision_humana`: `{estado, responsable, fecha, alcance, vigencia, condiciones, referencia}`; aprobación no predeterminada. `ejecucion`: `{estado: no_iniciada/ejecutada/fallida/cancelada, resultados:[]}`. `adopcion`: `{estado: no_adoptada/en_pr/fusionada/desplegada/revertida, referencia?}`; la adopción nunca se deduce de la ejecución experimental.

**Bloqueos absolutos de Nexus:** `toca_parametros_financieros=true` o `toca_apuestas=true` → no hay ejecución ni adopción por Nexus, incluso si una persona aprueba estudiar la propuesta; cualquier modificación de esas áreas se realiza fuera de Nexus mediante procesos específicos del proyecto. El gerente puede proponer una evaluación de solo lectura, nunca transferir una estrategia, instrucción de apuesta, límite, banca, umbral sensible o cartera. Las recomendaciones hacia Tezcatlipoca **no** se copiarán a `data/lecciones.json` ni a prompts automáticos.

### 4.1 Ejemplo de recomendación de borrador (no aprobable)

```json
{
  "id":"nexus-rec-0001","esquema":"cauce.recomendacion","version_esquema":"0.2","estado":"propuesta",
  "destino":{"proyecto":"tezcatlipoca","componente":"evaluacion-conteos-aislada"},
  "lecciones":[{"id":"compago-L3-2026-11-06","revision":"0.2"}],
  "problema":"Se desconoce si contar filas como eventos únicos altera conclusiones.",
  "hipotesis":"Contar partidos únicos en una copia histórica cambia al menos una conclusión de conteo.",
  "accion_propuesta":"Diseñar comparación de 88 filas, 72 selecciones y 62 partidos solo si existe respaldo autorizado y reproducible.",
  "experimento":{"metrica_primaria":"diferencia entre conteos y decisiones","linea_base":"conteo por fila","muestra":null,"unidad_independencia":"partido","n_minimo":null,"ventana":null,"criterio_exito":null,"criterio_fracaso":null,"parada":"sin evidencia reproducible o ante datos restringidos","aislamiento":"copia autorizada y desensibilizada","reversion":"eliminar copia conservando informe sin secretos","preregistro_ref":null},
  "riesgos":["no hay instantánea reproducible verificada"],"permisos_requeridos":["solo lectura de copia autorizada"],
  "toca_parametros_financieros":false,"toca_apuestas":false,
  "revision_esceptica":{"version_reglas":"nexus-R 0.2","reglas":[],"revisor":{"tipo":"humano","identificador":"pendiente"}},
  "decision_humana":{"estado":"pendiente_aprobacion","responsable":null,"fecha":null,"alcance":null,"vigencia":null,"condiciones":[],"referencia":null},
  "ejecucion":{"estado":"no_iniciada","resultados":[]},"adopcion":{"estado":"no_adoptada","referencia":null},
  "historial":[{"evento":"borrador","fecha":"2026-11-06T17:00:00-06:00","autor_tipo":"humano"}]
}
```

Este JSON demuestra la **forma de un borrador**, no un registro listo para validar. No se debe aprobar mientras falten muestra, preregistro, evidencia y reglas.

## 5. Gerente escéptico `nexus-R 0.2`

Cada regla entrega `cumple`, `no_cumple` o `no_evaluado`, motivo, referencia y versión. Cualquier `no_cumple` bloquea aprobación; `no_evaluado` bloquea validación/aprobación cuando el control sea pertinente. Un control no aplicable requiere justificación estructurada y revisión, no se convierte silenciosamente en `cumple`.

| Regla | Criterio verificable |
|---|---|
| R01 Procedencia y separación | Proyecto, commit/versión, autor humano/código/IA, método y revisor independiente. Texto de IA no acredita hechos |
| R02 Evidencia y cobertura | Referencias verificables; distinguir evidencia primaria de inventario de IA; declarar cobertura, faltantes y sesgo de supervivencia |
| R03 Independencia y circularidad | Contar entidades únicas, n independiente/efectivo, antecedentes y hashes; prohibir A→B→A como doble confirmación |
| R04 Temporalidad | Observación, `known_at`, base y zona horaria; estimación no acredita disponibilidad exacta; no mirar el futuro |
| R05 Reproducción y vigencia | Evidencia declarada ≠ reproducida independientemente; prueba/corrida con artefacto, fecha, versión y caducidad |
| R06 Transferencia | Validación en destino con prueba independiente, ventana posterior y preregistro; convergencia de ideas no es validación |
| R07 Privacidad y estrategia | Lista blanca y revisión local; bloquear tokens, datos privados, estrategias, umbrales, ligas, casas, banca, límites y cuentas |
| R08 Inferencia y robustez | n efectivo, n comparaciones, selección en muestra, supuestos, costos desconocidos ≠ 0, línea base, intervalos y alcance de confianza |
| R09 Resultado y estado operativo | Distinguir PR, CI, main, despliegue, tarea exitosa y entregable verificado; sin resultado, no hay éxito |
| R10 Autorización y aislamiento | Experimento preregistrado, aprobado por humano, limitado y aislado; sin escritura ni realimentación a prompts automáticos |

**Política de confianza:** no hay fórmula numérica universal; un revisor documenta qué afirmación está respaldada. `estimated` en fechas críticas impide confianza alta sobre ausencia de look-ahead; resultados de backtest sin corrida archivada quedan sin validación reproducible; un CLV favorable no prueba rentabilidad; `n=88 filas` no sustituye `n_independiente=62 partidos`; una prueba unitaria de regla no prueba mejora económica. **No se presume que una prueba refuta una lección por no hallar efecto**: un resultado nulo con potencia insuficiente queda inconcluso. Los criterios de refutación deben ser previamente definidos y considerar incertidumbre.

## 6. Prevención de circularidad y contaminación

Cada evidencia tiene `proyecto_ejecutor`, `dataset_id` si está permitido, `sha256` si existe y referencias a antecedentes. Nexus mantiene el grafo de dependencia: una lección de B derivada de A no valida A al regresar. Dos auditorías asistidas por el mismo modelo pueden converger, pero no cuentan como revisiones independientes. Las recomendaciones para Tezcatlipoca no entran a `data/lecciones.json` ni a prompts; su memoria semanal generada por IA no es fuente primaria. Los IDs de registros privados no salen de los proyectos. Si faltan hashes o instantáneas, se marca explícitamente y se limita el estado.

## 7. Seguridad, privacidad y permisos

Fase 1: lecciones escritas/revisadas manualmente en Nexus, con referencias a repositorios públicos o artefactos desensibilizados autorizados. **Sin acceso directo a bases privadas**, `.env`, tokens, webhooks, diarios, cuentas, montos, posiciones, perfiles, proveedores, SKU, nichos, estrategias ni infraestructura sensible. El filtro determinista usa **lista blanca**, detección de patrones y listas locales de términos prohibidos; ninguna lista negra garantiza ausencia de filtraciones, así que la aprobación humana de exportación sigue siendo necesaria. No leer ni copiar datos de UNIQ sin consentimiento de Ronaldo. Las huellas de evidencia no autorizan compartir su contenido.

El registro de decisiones será append-only, con versiones y referencias; no borrará objeciones ni resultados negativos. Acceso de solo lectura a fuentes permitidas, y escritura únicamente al almacén propio de Nexus en una futura implementación aprobada. Los prompts no sustituyen límites de permisos del sistema operativo.

## 8. Pruebas de aceptación de diseño (no ejecutadas)

| Prueba | Entrada | Resultado esperado |
|---|---|---|
| T01 | Sin fuente primaria | R01/R02 no cumple |
| T02 | Tarea `succeeded` sin informe | R09 no cumple |
| T03 | Duplicados exactos | R03 detecta dependencia |
| T04 | `known_at` posterior al evento | R04 no cumple |
| T05 | `validado_en` sin `prueba_ref` | R06 no cumple |
| T06 | Backtest histórico etiquetado como beneficio real | R08 no cumple |
| T07 | Fecha de exportación presentada como observación | R04 no cumple |
| T08 | PR con CI verde presentado como desplegado | R09 no cumple |
| T09 | Aprobación sin ejecución; cambio de riesgo | No se ejecuta; R10 bloquea |
| T10 | Lección A→B→A como prueba independiente | R03/R06 no cumple |
| T11 | Lección caducada | R05 no cumple |
| T12 | Regla no evaluada presentada como cumple | Se rechaza |
| T13 | Token o estrategia en texto libre | R07 bloquea exportación |
| T14 | Caso sintético n=1 presentado como éxito comercial | R08 no cumple |
| T15 | 88 filas / 72 selecciones / 62 partidos | Usa unidad independiente, no filas |
| T16 | Mejor umbral elegido y probado en misma muestra | R08 no cumple para generalización |
| T17 | `registrado_en` sin zona | R04 no evaluado/no cumple para temporalidad estricta |
| T18 | 218 alternativas y sin ajuste por selección | R08 impide afirmación de ventaja robusta |
| T19 | Costos desconocidos codificados como cero | R08 no cumple |
| T20 | Autor IA igual a revisor IA | R01 no cumple para validación independiente |
| T21 | `known_at` 82% estimado y conclusión temporal fuerte | R04/R08 limitan confianza |
| T22 | Fuente de IA repetida en dos proyectos | No cuenta como dos validaciones |
| T23 | Resumen Nexus insertado como campo extraño de `estado-proyecto` 1.0.0 | Contrato existente rechaza; usar esquema aparte |
| T24 | Evidencia declarada reproducible sin prueba externa | No se eleva a validada en destino |

## 9. Catálogo inicial de lecciones candidatas (no incorporadas)

**Compago:** L3 duplicados (main, sintética); L1 desconocido ≠ cero (main, pruebas); L4 comparabilidad (main, sin ventas reales); L8 separación DEMO/REAL (solo PR #10); L6 el evaluador falla (log original sin versionar). Todas propuestas, sin resultado comercial demostrado.

**Ek Chuah:** L001 tiempo dual (`known_at`, 82% estimado); L003 no evaluado ≠ aprobado; L005 selección y validación fuera de muestra (sin corrida archivada, no validable aún); L007 `succeeded` ≠ entregable; L008 costo desconocido ≠ cero. Primeras recomendadas para Fase 1: L001, L003, L007. No exportar mezclas, límites ni rendimiento simulado como real.

**Tezcatlipoca:** L5 contar partidos y no filas (88/72/62, copia 5-nov, no verificación nueva); L3 temporalidad de contradicciones (26 pruebas en copia); L6 no seleccionar umbrales con la misma muestra; L9 no realimentar texto IA sin revisión; L10 marcas de tiempo con zona (60/60 sin zona en copia). Las cinco se documentan **manualmente** con limitaciones; no se exportan desde el bot ni se elevan a validadas. Las cifras provienen de auditoría previa, no de ejecución de este documento. Las lecciones temporales y CLV no pueden validarse hasta resolver zona horaria y reproducibilidad.

**Prioridad transversal:** duplicados (Compago L3 ↔ Tezcatlipoca L5), desconocido ≠ cero (Compago L1 ↔ Ek Chuah L008), temporalidad (Ek Chuah L001 ↔ Tezcatlipoca L10), entregable verificado (Ek Chuah L007 ↔ Compago L6). Estas son convergencias metodológicas, **no** pruebas cruzadas independientes.

## 10. Fases y criterios de salida

- **Fase 0 — diseño:** consolidar contrato v0.2, reglas, permisos, casos T01–T24 y aprobación humana; sin código.
- **Fase 1 — memoria manual:** registrar un conjunto pequeño de lecciones no sensibles, verificadas documentalmente, con estado `propuesta` y revisión humana. Sin requerir WSL, Docker, exportadores ni IA. Puede comenzar sin backtests archivados; esos casos se excluyen.
- **Fase 2 — validador determinista:** solo tras autorización, crear esquema, tests, filtros, historial append-only y evaluación de reglas; no tocar motores.
- **Fase 3 — experimentos aislados:** preregistro, aprobación específica, datos desensibilizados y resultado negativo conservado; no automatizar apuestas ni inversiones.
- **Fase 4 — visualización Cauce:** verificar contrato `cauce.estado-proyecto` 1.0.0, compatibilidad de cada exportador, salud real de tareas, sin métricas inventadas. El análisis semanal defectuoso de Ek Chuah bloquea representar su resultado como confiable, no Fase 1.
- **Fase 5 — asistencia IA opcional:** objeciones limitadas, presupuesto y apagado, conjunto de casos adversariales; nunca juez final.

**Dependencias por proyecto, no globales:** instalar Docker/WSL en MSI es del piloto de Compago, no de Fase 1 Nexus. Para lecciones de backtest de Ek Chuah hace falta archivar y reproducir una corrida con autorización previa. Para Tezcatlipoca temporal/CLV hacen falta zona horaria y respaldo reproducible. Para exportación visual, validar primero los formatos reales; no suponer que Tezcatlipoca cumple 1.0.0.

## 11. Decisiones pendientes antes de implementación

1. **Aprobar formalmente v0.2** y el alcance inicial de Fase 1; este documento no equivale a esa aprobación.
2. Definir responsable humano y ubicación del almacén propio de Nexus, sin escribir en proyectos de origen.
3. Decidir política de conservación de referencias y huellas, acceso, caducidad por dominio y clasificación de datos.
4. Definir el conjunto inicial de lecciones manuales y quién verifica sus referencias; las 15 son candidatas, no incorporaciones automáticas.
5. Determinar si el resumen visual necesita `cauce.nexus-resumen` 0.2 o puede presentarse mediante un proyecto del contrato 1.0.0; **sin modificar el contrato vigente**.

## 12. Trazabilidad y límites de esta consolidación

Base: `CAUCE_NEXUS_ARQUITECTURA_MAESTRA_v0.1.md`; `REVISION-NEXUS-v0.1.md` (Compago, 6-nov); `REVISION-NEXUS-DESDE-EK-CHUAH-20261106T152818-ca62.md`; revisión de Tezcatlipoca compartida en la conversación el 6-nov. Los informes tienen distintos alcances: Compago verificó referencias leyendo código pero no reejecutó tests; Ek Chuah no ejecutó pruebas nuevas; Tezcatlipoca citó una copia de base del 5-nov y no verificó procesos activos en la PC. **Ninguna prueba T01–T24 se ha ejecutado para Nexus y ninguna de las 15 lecciones se ha transferido ni validado entre proyectos.**
