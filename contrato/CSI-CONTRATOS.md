# Contratos de CSI (Cauce Strategic Intelligence) · versión 0.1

Independientes de `cauce.estado-proyecto` 1.0.0 (que **no** se modificó) y de los contratos de Nexus. La referencia
ejecutable está en `app/csi/`; las pruebas en `pruebas/casos-csi.js`. Reglas comunes a todos:

- **Claves desconocidas = error** (como Nexus). Un campo que el contrato no conoce no entra en silencio.
- **Sin probabilidades numéricas**: claves como `probabilidad`, `chance`, `odds`, `certeza_pct` se rechazan. La fuerza de una explicación se dice con evidencia a favor/en contra, datos que faltan e incertidumbre en palabras.
- **Privacidad**: los mismos patrones que Nexus (correo, teléfono, CURP, tarjetas, credenciales, llaves) se rechazan en cualquier texto.
- **DEMO/REAL**: en DEMO todas las fuentes llevan `ficticia: true` y los actores `ficticio: true`; en REAL ninguna. Documentos de los dos tipos nunca se muestran juntos.
- **Fechas**: instantes ISO con zona; una fecha de día sin hora se trata con margen de UTC+14 a UTC−12 (protección conservadora contra información futura).
- **Identidades declaradas** (`autenticacion: "declarada"`), nunca autenticadas.

## `cauce.csi.investigacion` 0.1 (`app/csi/investigacion.js`)

`{contrato, version_contrato, id, titulo, pregunta, creada_en, creada_por, es_demo, acontecimiento{descripcion, fecha, mercado?}, actores[], fuentes[], enunciados[], incentivos[], hipotesis[], supuestos[], incertidumbre{nivel, descripcion}, objeciones[], escenarios[], revision{estado, revisor?, fecha?, nota?}, historial[]}`

| Elemento | Regla |
|---|---|
| `fuentes[]` | `{id, titulo, editor, tipo, publicada_en, consultada_en?, enlace?, autor_actor_id?, ficticia?}`. Tipos: documento_oficial, documento_regulatorio, dato_estadistico, prensa, declaracion_publica, analisis_tercero, nexus. |
| `enunciados[].tipo` | `hecho`, `declaracion`, `inferencia`, `simulacion`, `prediccion` (bloque 3). |
| hecho / declaración | Al menos una fuente primaria (Nexus no cuenta). Ninguna fuente puede ser posterior a `registrado_en` (información futura). La declaración dice quién declaró (`actor_id`): registra lo dicho, no que sea cierto. |
| intención | `sobre: "intencion"` como **hecho** solo con documento oficial o regulatorio publicado por el propio actor. Si no, se registra como declaración o inferencia. |
| inferencia / simulación / predicción | Inferencia: `inferido_de` obligatorio. Simulación: `escenario_id`. Predicción: `prediccion_id` (memoria de predicciones). Ninguna de las tres puede ser evidencia. |
| `incentivos[]` | Siempre inferidos: `basado_en` (ids de enunciados) obligatorio. |
| `hipotesis[]` | `{id, categoria (fundamentales, liquidez, oportunista, manipulacion, otra), enunciado, a_favor[], en_contra[], supuestos[], condiciones_refutacion[], datos_faltantes[], origen?}`. Solo hechos y declaraciones como evidencia; un enunciado no puede estar a favor y en contra. |
| `objeciones[]` | Abogado del Diablo: `{id, hipotesis_id|null, tipo (explicacion_alternativa, sesgo, dato_faltante, circularidad, fuente_debil), texto, autor, estado, respuesta?}`. |
| `revision` | `borrador → en_revision → revisada | devuelta`. Revisada/devuelta la firma una **persona distinta** de quien creó la investigación; una IA no sustituye la revisión. Cualquier cambio posterior devuelve el estado a `en_revision`. |
| `historial[]` | Solo anexado: `{n, fecha, autor, accion, detalle, huella_anterior, huella_contenido, huella}` (SHA-256). `verificarHistorial` detecta entradas reescritas, faltantes o reordenadas y **contenido cambiado sin pasar por el historial**. No se borra: un enunciado se *retira* con motivo y deja de contar. |

**Estado de una hipótesis** (`analizarInvestigacion`): `incompleta` (sin evidencia a favor, sin condiciones de refutación, o manipulación sin documento regulatorio/oficial), `contradicha`, `en_disputa`, `sin_contradiccion_registrada`. Nunca «confirmada».

## `cauce.csi.actores` 0.1 (`app/csi/actores.js`)

Tipos: gobierno, banco_central, institucion_financiera, fondo_inversion, empresa, organismo_internacional, sector_economico, participante_colectivo (no personas privadas). Cada actor: objetivos documentados (**con fuente**), incentivos hipotéticos (sin fuente, marcados así), recursos conocidos (con fuente), restricciones (pueden `impide[]` decisiones), decisiones posibles `{id, texto}`, incertidumbres. Relaciones `{id, de, a, tipo, descripcion, fuentes[]}`: coopera y miembro_de = alianza; compite y conflicto_de_interes = tensión; regula, financia, posee_participacion, contraparte = dependencia. **Sin fuente no es verificable y no entra al análisis.** `analizarIntereses` dice «sin relación documentada (no se supone coordinación ni conflicto)» para los pares sin relación, y los bloques solo agrupan cooperación documentada.

## `cauce.csi.escenario` 0.1 (`app/csi/simulador.js`)

`naturaleza` siempre `"simulacion"`. `explicaciones[]` A–D (+ `otra`) con `senales_a_favor`, `senales_en_contra` (enlazables a enunciados) y `datos_faltantes`; la de manipulación exige `solo_hipotesis: true`. `arbol.nodos[] {id, padre, actor_id, decision_id, explicacion_id?, beneficios[], costos[], restricciones[], consecuencias[]}` (máx. 200 nodos, 6 niveles). `simular()` es determinista: cuenta señales observadas, marca rutas bloqueadas por restricciones documentadas y avisa decisiones que el actor no tiene registradas. `plantillaCaidaMercado()` genera las cuatro explicaciones del bloque 5.

## `cauce.csi.predicciones` 0.1 (`app/csi/predicciones.js`)

Registro **solo anexado** con cadena de huellas. Entradas `{n, tipo, contenido, registrado_en, registrado_por, huella_anterior, huella}`:

- `registro`: `{id, investigacion_id, hipotesis_id?, hipotesis_original, resultado_observable, horizonte{desde, hasta}, criterios{acertada, fallida, indeterminada}, fuentes_conocidas[], supuestos[], version_reglas, referencia{descripcion, resultado_esperado}}`. Debe registrarse **antes** de `horizonte.desde`; sus fuentes, antes del registro.
- `correccion`: versión nueva `{prediccion_id, prediccion, motivo}`; no cambia el id ni el inicio del horizonte. Si llega con el horizonte ya empezado o con una evaluación hecha, queda **posterior** y no cuenta: se evalúa la última versión anterior al horizonte.
- `evaluacion`: `{prediccion_id, resultado, resultado_referencia, evidencia[], nota}` (acertada, fallida, indeterminada). No antes del horizonte; evidencia publicada después del registro y antes de la evaluación; acertada/fallida exigen evidencia; indeterminada exige nota. Reevaluar anexa otra entrada (las anteriores se conservan).

`resumirPredicciones` cuenta TODO: pendientes, en curso, vencidas sin evaluar, acertadas, fallidas e indeterminadas, más correcciones posteriores, y compara con la referencia simple. Con menos de 10 decididas no declara ventaja. Un acierto lleva el aviso «no demuestra la explicación causal».

**Límite honesto**: las horas son declaradas. La cadena prueba el orden y detecta reescrituras; la hora absoluta solo se fija publicando la última huella fuera del equipo (p. ej. en un commit).

## `cauce.csi.propuesta-nexus` 0.1 (`app/csi/adaptador-nexus.js`)

Adaptador separado. Produce `{…, flujo, etapa: "revision_esceptica", investigacion{id, huella}, hipotesis, evidencia_primaria[], excluida[], bloqueos[], predicciones[], revision_esceptica{version_reglas, dictamen, no_cumple, no_evaluado}, decision_humana{estado: "pendiente"}, borrador_leccion}`.
El borrador es `cauce.leccion` **0.3**, siempre `validacion.estado = "propuesta"`, confianza «baja», `naturaleza_resultado: "sin_resultado"` y `naturaleza: "desconocida"` (REAL) o `"demo"`. Se excluye cualquier evidencia que cite a Nexus; si la hipótesis nació de una recomendación de Nexus queda bloqueada. Las predicciones se adjuntan como seguimiento, nunca como evidencia. **No escribe en el almacén de Nexus** y no aprueba nada.

## Piso de la oficina (`app/csi/piso.js`)

Traduce CSI a `cauce.estado-proyecto` **1.0.0 sin cambios** (proyecto `csi`, cinco departamentos = cinco estaciones). Nadie aparece «trabajando» porque CSI no corre solo: `requiere_revision` cuando hay hipótesis incompletas, relaciones sin fuente, problemas de simulación u objeciones/predicciones pendientes; `esperando` si no; `sin_datos` si el almacén está vacío.

---

# Fase 2 · versión 0.2 (compatible: todo documento 0.1 se sigue validando igual)

`cauce.csi.investigacion`, `cauce.csi.actores` y `cauce.csi.escenario` aceptan `version_contrato` `"0.1"` o `"0.2"`.
Un documento 0.1 con una clave 0.2 es un error (claves desconocidas = error). El DEMO sigue en 0.1 sin cambios.
`cauce.csi.predicciones` sigue en 0.1. `cauce.estado-proyecto` 1.0.0 no cambia. `cauce.leccion` 0.2 y 0.3 no cambian.

## Fuente 0.2 (`app/csi/fuentes.js`)

`{id, titulo, editor, tipo, clase, estado, publicada_en, consultada_en?, disponible_en?, disponible_segun?, enlace? | referencia?, autor_actor_id?, origen?, extracto?, extracto_tipo?, metodo_consulta?, huella_contenido?, copia_local?, limitaciones[], pendiente_motivo?, ficticia?}`

| Regla | Detalle |
|---|---|
| Tipos | los de 0.1 + `informe_economico`, `informe_corporativo`, `dato_mercado`, `documento_institucional` (comunicados y bancos centrales: `documento_oficial`). |
| `clase` | `primaria` (el origen), `secundaria` (reproduce o informa lo primario), `interpretacion` (análisis u opinión). Un hecho no descansa solo en interpretaciones. |
| `estado` | `consultada` (REAL: `consultada_en`, `extracto`, `extracto_tipo`, `metodo_consulta`) o `pendiente` (con `pendiente_motivo`). Una fuente pendiente no respalda hechos, declaraciones, relaciones ni decisiones históricas. |
| Tres fechas | `publicada_en` = la copia citada; `disponible_en` (+ `disponible_segun`) = cuándo la información fue pública; `consultada_en` = cuándo la leímos, **nunca** fecha de conocimiento. Consulta antes de la publicación, disponibilidad posterior a la publicación o a la consulta = error. |
| Procedencia | REAL exige `enlace` (http/https) o `referencia` y al menos una limitación. `huella_contenido` (SHA-256) exige `copia_local`. |
| Duplicados | mismo enlace (sin `?`, `#` ni `/` final) o misma huella = error. |
| Independencia | `origen` (por defecto `autor_actor_id` o `editor`): dos copias del mismo comunicado tienen el mismo origen. |

## Investigación 0.2

- Claves nuevas: `naturaleza_estudio` (`demo` ↔ `es_demo: true`; `historico` o `prospectivo` ↔ REAL) y `alcance`
  `{descripcion, periodo{desde,hasta}, incluye[], excluye[], criterios_fuentes[] (≥1), registrado_en}`.
- Acción `definir_alcance`: una sola vez y **antes de la primera fuente**; no se edita después. En un estudio histórico
  el historial debe mostrar `definir_alcance` antes del primer `agregar_fuente`.
- Histórico: sin enunciados `prediccion`; toda simulación lleva `contrafactual: true`.
- Enunciado: `cita` (texto literal que debe aparecer en el extracto `cita_textual` de una fuente consultada) y
  `contrafactual`. En REAL, un hecho o una inferencia con estados psicológicos atribuidos, o un hecho de «coordinación
  secreta», es un error (regístralo como declaración atribuida).
- Hipótesis: `observaciones_distintivas[] {texto, distingue_de[], disponible?: ya_observable|futura|no_accesible}`
  (acción `agregar_observacion`), `momento_decision`, `sobre_actor`.

## Actores 0.2

Por actor: `intereses_economicos[]` (con fuente), `decisiones_historicas[] {id, fecha, texto, fuentes}` (con fuente
consultada), `conflictos_interes[] {texto, fuentes, clase: documentado|posible}` (documentado exige fuente) y
`restricciones[].clase` (`legal`, `economica`, `operativa`, `otra`). En REAL se rechazan estados psicológicos,
intenciones privadas y coordinación secreta en los textos del actor (`app/csi/lenguaje.js`).

## Escenario 0.2

`contrafactual` (boolean, obligatorio) y `supuestos[]` (obligatorios si es contrafactual). `simular()` devuelve
`contrafactual` y un aviso propio.

## Flujo de 10 pasos (`app/csi/flujo.js`) y Abogado del Diablo (`app/csi/abogado.js`)

`evaluarFlujo` dice qué paso está registrado y qué falta. «Completo» = registrado con las reglas, no verdadero.
`revisarAbogado` hace 8 preguntas por hipótesis (`alerta | ok | no_evaluable` con su motivo), firmado
`{tipo: "codigo", identificador: "abogado-csi"}`. `objecionesSugeridas` convierte alertas en objeciones abiertas; el
código nunca puede firmar la revisión (solo una persona distinta de quien creó la investigación).

## `cauce.csi.ancla` 0.1 (`app/csi/ancla.js`)

`{contrato, version_contrato, es_demo, registro{contrato, entradas, ultima_huella}, entradas[{n, tipo, huella, id?}], incluye_ids, huella_ancla, creada_en, creada_por, publicacion}`.
Solo huellas (sin textos; ids solo con `incluir_ids`). `huella_ancla` = SHA-256 del núcleo; cambiar cualquier entrada
lo delata. `publicacion.estado`: `no_publicada` | `acreditada` `{tipo: sello_rfc3161|opentimestamps|recepcion_servicio|testigo, acreditado_en, prueba, autorizada_por}`.
Acreditar exige el texto publicado con la huella. Una fecha de commit **no** es acreditación.
`verificarContraAncla` → por predicción: `declarada`, `anclada_sin_acreditar`, `acreditada_antes_del_horizonte`, `acreditada_tarde`.
**Límite honesto**: el programa no verifica el sello del tercero (eso se hace con su herramienta: `openssl ts -verify`, `ots verify`).

## `cauce.csi.propuesta-nexus` 0.2

Flujo `investigacion → hipotesis → objecion_abogado → revision_esceptica → decision_humana → seguimiento`. Añade
`fuentes` (con procedencia), `fuentes_pendientes`, `objeciones` (humanas y del Abogado), `limitaciones`,
`condiciones_refutacion`, `datos_faltantes`, `estado_validacion` y `envio {envia, no_envia}`. Excluye evidencia sin fuente
consultada. Se niega a preparar la propuesta si encuentra datos personales o estrategias financieras privadas.
`revisarPropuesta` detecta inferencias como evidencia, evidencia sin fuente, predicciones como evidencia y decisiones no pendientes.

## `cauce.csi.expediente` 0.1 (`app/csi/expediente.js`)

Datos para construir una investigación con el motor (`crear → definir_alcance → pasos → objeciones del Abogado → pasos_finales`).
`node herramientas/csi.mjs expediente <archivo>`.
