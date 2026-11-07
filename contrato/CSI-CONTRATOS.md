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
