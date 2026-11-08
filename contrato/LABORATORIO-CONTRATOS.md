# Contratos del Laboratorio de IA · versión 0.1 (fase 1)

Son tres contratos nuevos y **aditivos**. No cambia ningún contrato existente:

- Compago v1
- `cauce.csi.*`
- `cauce.nexus.*`

El código está en `app/laboratorio/contratos.js` y las pruebas en `pruebas/casos-laboratorio.js`.
La validación es **estricta**: una clave desconocida, otra versión, un id mal formado, un estado o rol desconocido o una fecha sin zona hacen que el documento se rechace.

| Contrato | Quién lo firma | Para qué |
|---|---|---|
| `cauce.lab.encargo` 0.1 | Una persona (`creado_por.tipo = "humano"`) | Qué se le pide a **un** rol, con qué fuentes, hasta qué fecha y con qué límites. |
| `cauce.lab.ejecucion` 0.1 | Una IA (`autor.tipo = "ia"`) | Lo que respondió el modelo, tal cual, con su estado (incluidos fallos). |
| `cauce.lab.verificacion` 0.1 | Solo el código `lab-V 0.1` | Qué se pudo comprobar mecánicamente. **Nunca** declara verdadera una afirmación. |

## Identificadores y mundos DEMO/REAL

- Prefijos: `lab-enc-`, `lab-run-`, `lab-ver-`. En DEMO, `demo-` delante (y solo en DEMO). Ejemplo: `demo-lab-run-001`.
- Un encargo, su ejecución y su verificación deben ser del mismo mundo. Un registro REAL no admite documentos DEMO, ni al revés.

## `cauce.lab.encargo`

Claves, todas obligatorias salvo `nota`:

- `contrato`, `version_contrato`, `id`, `es_demo`
- `rol`, `pregunta`
- `insumos[]`: cada uno `{tipo, ref, sha256}`
- `fuentes_permitidas[]`: cada una `{fuente_id, estado, origen, sha256, texto_sha256, publicada_en, conocida_en}`
- `corte_temporal{conocido_antes_de}`
- `herramientas{red, dominios_permitidos, ejecutar_comandos}`
- `limites{max_minutos, max_tokens_salida, max_consultas_web}`
- `modelo_solicitado{adaptador, nombre}`
- `creado_por{tipo, identificador}`, `creado_en`

Reglas que no se pueden saltar con datos:

- **Roles separados**: `investigador | analista | critico`. Cada rol es una ejecución distinta.
- **Investigador**: no recibe salidas de otros roles (`lab_ejecucion_verificada`). Trabaja con fuentes.
- **Banco de evaluación**: solo puede ser insumo del **crítico**.
- **Una respuesta de IA no es una fuente**: un id `lab-*` no puede aparecer como `fuente_id`, ni como `copia_fuente` o `csi_investigacion`.
- **No existe «memoria»**: el tipo de insumo no existe. Cada insumo se fija por su huella SHA-256.
- **Una IA no se encarga trabajo a sí misma**: `creado_por.tipo` debe ser `humano`.
- **Comandos**: `ejecutar_comandos` debe ser `false`.
- **Red**: `ninguna` (y entonces 0 consultas y sin dominios) o `lectura_publica`. Esta última solo es para el investigador y exige una lista de dominios.
- **Fuente consultada**: necesita la huella de su copia (`sha256`). `texto_sha256` es la huella del texto extraído (PDF/HTML → texto) que una persona aprobó.
- **Privacidad**: se rechazan datos privados (mismas reglas que Nexus).

## `cauce.lab.ejecucion`

Claves:

- `encargo_id` y `encargo_sha256`: la huella del encargo exacto.
- `rol`, `estado`
- `inicio`, `fin`, `latido`
- `autor{tipo:"ia", identificador, adaptador}`
- `afirmaciones[]`: cada una `{id, texto, clase, citas[{fuente_id, extracto, ubicacion}]}`. Clase: `hecho_citado | inferencia | especulacion | desconocido`.
- `hipotesis[]`: cada una `{id, enunciado, se_refuta_si, experimento, alternativa_a}`. Sin condición de refutación ni experimento no es válida.
- `objeciones[]`, `dudas[]`
- `contradicciones[]`: al menos dos fuentes.
- `consultas_web[]`: cada una `{url https, consultado_en, sha256_respuesta, publicado_en}`.
- `uso{tokens_entrada, tokens_salida, costo_mxn}`
- `error`

Estados:

- `en_cola`, `ejecutando`, `terminado`, `fallo`, `cancelado`, `sin_conexion`, `excedio_limite`.
- `fallo` y `sin_conexion` exigen el error literal y no admiten afirmaciones.
- `terminado` exige `error: null` y una salida no vacía.
- `cancelado` y `excedio_limite` son salidas parciales: se verifican tal cual y nunca quedan «aptas».

## `cauce.lab.verificacion`

- `autor` debe ser exactamente `{tipo:"codigo", identificador:"lab-V", version:"lab-V 0.1"}`.
- `resultado`: `apta_para_revision_humana | con_fallas | rechazada | sin_salida`.
- Por cada cita, se evalúan **por separado** cuatro cosas que no se mezclan:

| Eje | Valores | Qué significa |
|---|---|---|
| Existencia | `registrada`, `inexistente`, `respuesta_ia` | ¿La fuente está en el catálogo del encargo? ¿Es una salida de IA disfrazada? |
| Integridad de la fuente | `integra`, `alterada`, `copia_ausente`, `sin_huella_registrada`, `pendiente` | Huella SHA-256 de la copia local contra la registrada. |
| Coincidencia textual | `literal`, `normalizada`, `no_encontrada`, `no_evaluable` | ¿El extracto aparece en la fuente? «Normalizada» solo une espacios y forma NFC. |
| Validez temporal | `dentro_de_corte`, `posterior_al_corte`, `fecha_desconocida`, `indeterminada`, `sin_corte` | ¿La fuente se conocía antes del corte del encargo? |
| Respaldo semántico | siempre `pendiente_revision_humana` | Si la cita **dice lo que la afirmación dice**: eso lo decide una persona. |

- `revision_humana` siempre es `{estado:"pendiente"}` en la fase 1.
- «Apta para revisión humana» **no** significa «verdadera». Significa que nada mecánico la descalifica.

Las seis cosas que lab-V deja **separadas** (y dónde quedan en el documento):

| # | Qué | Dónde | Quién decide |
|---|---|---|---|
| 1 | Integridad del documento (copia y texto con su huella) | `fuentes[].integridad`, `fuentes[].texto`, `citas[].integridad` | código |
| 2 | Coincidencia literal de la cita | `citas[].coincidencia`, `citas[].apariciones` | código |
| 3 | Validez temporal | `citas[].temporal`, alerta `menciona_fecha_posterior_al_corte` | código |
| 4 | Posible contradicción | alerta `posible_contradiccion_declarada` (la declara la IA; lab-V solo deja constancia y el estado de sus fuentes) | persona |
| 5 | Respaldo semántico | `afirmaciones[].respaldo_semantico` = siempre `pendiente_revision_humana` | persona |
| 6 | Aprobación humana | `revision_humana` = siempre `{estado:"pendiente"}` | persona |

### Fase 1.1 (auditoría): reglas añadidas sin cambiar la forma de los contratos

- **Tamaño**: un documento de más de 2 000 000 caracteres (JSON) se rechaza entero con un solo error, sin recorrerlo. Textos (pregunta, afirmación, hipótesis, objeción, duda, contradicción, error, ubicación) hasta 8 000 caracteres; extracto hasta 2 000; listas con tope (500 afirmaciones, 100 hipótesis, 500 objeciones, 200 dudas, 200 contradicciones, 20 citas por afirmación, 50 consultas, 200 insumos, 500 fuentes). Si un texto supera su límite, la búsqueda de datos privados no se ejecuta (ya está rechazado): antes una respuesta enorme bloqueaba la validación durante minutos.
- **Caracteres invisibles**: anchura cero (U+200B…U+200F, U+2060…U+2064), control bidireccional (U+202A…U+202E, U+2066…U+2069), BOM (U+FEFF) y guion suave (U+00AD) se rechazan en cualquier texto o extracto.
- **Ids**: ningún id (fuente, insumo, documento) contiene `..`; los ids nombran archivos de copias.
- **Referencias**: `objeciones[].a` apunta a una afirmación o hipótesis de la misma salida o a `<insumo>#<id>` (una entidad de un insumo del encargo, p. ej. `banco-bns-2015-v1#e01`; lab-V exige que el insumo exista: `objecion_a_insumo_desconocido`); `hipotesis[].alternativa_a` apunta a otra hipótesis de la misma salida; ids de objeciones únicos; fuentes de una contradicción son ids válidos y distintos.
- **Mundos**: un encargo DEMO no usa ejecuciones REALES como insumo (ni al revés).
- **Orden de los hechos** (lab-V): `ejecucion_antes_del_encargo` y `verificacion_antes_de_la_ejecucion` son errores; `latido` debe estar entre `inicio` y `fin`.
- **Límites del encargo** (lab-V): superar `max_minutos` o `max_tokens_salida` se avisa (`excede_max_minutos`, `excede_max_tokens`); la salida se verifica tal cual.
- **Verificación coherente**: `resumen` debe cuadrar con las listas; «apta» exige cero errores, cero alertas, `incompleta:false` y todas las citas utilizables; «sin_salida» no trae citas ni afirmaciones; `apariciones` entero ≥ 0; cada alerta es `{codigo, ruta, detalle}`.
- **Id de verificación**: `lab-ver-<ejecución>-<instante>`: una ejecución puede verificarse más de una vez y cada verificación se distingue.
- **Registro**: una entrada fechada antes que la anterior se niega (`orden_temporal`); un id ya registrado como válido no se anexa otra vez (`id_duplicado`); un documento inválido sí puede volver a registrarse corregido con el mismo id.
- **Herramienta**: no lee copias ni documentos a través de enlaces simbólicos; JSON hasta 4 MB y copias hasta 50 MB; una fuente con más de una copia original es error.

## Registro auditable `cauce.lab.registro` (JSONL)

- Cada línea es una entrada encadenada: `n`, `sha256_documento`, `sha256_anterior`, `sha256_entrada`.
- Se registra **también** lo inválido (`valido:false` con sus errores): los fallos se auditan.
- `verificarRegistro` informa cada problema con su línea y nunca descarta nada:
  - línea corrupta o truncada
  - cadena rota
  - numeración saltada
  - documento o entrada modificados
  - mezcla DEMO/REAL
- La escritura en disco la hace solo `herramientas/laboratorio.mjs`, con reemplazo atómico. Un registro dañado no se anexa ni se repara solo.

---

# Fase 2 · contratos nuevos (aditivos; los tres de arriba no cambian)

Código: `app/laboratorio/trabajo.js`, `app/laboratorio/informe.js`, `app/laboratorio/propuesta-nexus.js`. Pruebas: `pruebas/casos-laboratorio-fase2.js`.

| Contrato | Quién lo firma | Para qué |
|---|---|---|
| `cauce.lab.trabajo` 0.1 | Lo pide una persona; lo mueve el Coordinador (código `lab-coordinador`); lo cierra **solo** una persona | Una solicitud de análisis sobre lo que entregó un motor, con su máquina de estados e historial solo-anexado. |
| `cauce.lab.informe` 0.1 | Solo el Coordinador (código) | Consolida hallazgos (con evidencia e incertidumbre), hipótesis, objeciones, faltantes, limitaciones y recomendaciones. **Nunca** se declara aprobado. |
| `cauce.lab.propuesta-nexus` 0.1 | El Laboratorio, solo para trabajos aprobados por una persona | Borrador de `cauce.leccion` 0.3 en estado «propuesta» con el dictamen previo de Nexus. **No se escribe** en el almacén de Nexus. |

## `cauce.lab.trabajo`

- Id: `lab-trb-…` (`demo-lab-trb-…` en DEMO).
- `origen`: `{motor, nombre, contrato, version, modo: "solo_lectura", es_demo, generado_en, leido_en, sha256_documento, ficha, fuente_id}`. `modo` distinto de `solo_lectura` o un `es_demo` distinto al del trabajo = inválido.
- `adaptador.id`: `sin-modelo` (guion determinista; **solo DEMO**) · `manual-claude` · `ollama`.
- `estado`: `pendiente`, `en_analisis`, `requiere_evidencia`, `requiere_revision`, `aprobado_por_humano`, `rechazado`, `error`.
- `historial[]`: `{n, de, a, en, por: {tipo: humano|codigo, identificador}, motivo}`. El validador lo **reproduce** desde la solicitud: cada paso debe estar permitido y el estado final debe coincidir. Ninguna IA aparece nunca en `por`.
- `intentos {usados, maximo}`: cuántas veces se reintentó tras «error» (debe cuadrar con el historial).
- `decision_humana`: solo en los estados finales; `{decision, por: {tipo: "humano", identificador, autenticacion: "declarada"}, en, motivo}`.

Transiciones (quién puede):

| De → a | Quién |
|---|---|
| pendiente → en_analisis | Coordinador |
| en_analisis → requiere_evidencia · requiere_revision · error · pendiente (interrupción) | Coordinador |
| requiere_evidencia → pendiente (evidencia nueva: ronda nueva) · requiere_revision · rechazado | Persona |
| requiere_revision → aprobado_por_humano · rechazado · requiere_evidencia | Persona |
| error → pendiente (reintento, con tope) | Coordinador o persona |
| error · pendiente → rechazado | Persona |
| aprobado_por_humano, rechazado | Finales |

Aprobar exige informe y un motivo de al menos 10 caracteres.

## `cauce.lab.informe`

- `autor` = `{tipo: "codigo", identificador: "lab-coordinador"}`; `modo.es_ia` dice si hubo modelo (el guion DEMO declara `false`).
- `hallazgos[]`: cada afirmación de los roles con `clase`, `incertidumbre` (baja solo con cita comprobada por lab-V), `respaldo`, `respaldo_semantico: "pendiente_revision_humana"`, sus citas y las objeciones que recibió.
- `estado_propuesto`: `requiere_evidencia` si lab-V no pudo comprobar alguna cita; si no, `requiere_revision`. Nunca «aprobado».
- `recomendaciones[]`: siempre `requiere_decision_humana: true` y `accion_automatica: false`. Las que parecen operaciones con dinero o apuestas van a `recomendaciones_excluidas` con su motivo.
- `revision_humana`: siempre `{estado: "pendiente"}` (la decisión vive en el trabajo).

## Registro

`cauce.lab.registro` acepta además `trabajo` (una entrada por versión: la clave única es id + largo del historial; una versión que no conserve intacto el historial anterior se marca `historial_reescrito`) e `informe`.

# Fase 3 · contrato 0.2 (autoría) y formatos del intercambio manual

Motivo: el 0.1 obligaba a declarar `autor.tipo = "ia"` en toda ejecución, también cuando la escribía el guion DEMO.
Eso permitía que un resultado DEMO pareciera análisis de IA. El 0.2 lo corrige sin reescribir nada de lo registrado.

## Vocabulario común de autoría (`TIPOS_AUTORIA`, `app/laboratorio/base.js`)

| Autoría | Qué es | Dónde aparece |
|---|---|---|
| `guion_demo` | Reglas escritas a mano o un transporte de prueba. **No es IA.** Solo con datos DEMO. | ejecución |
| `ia_manual` | Un modelo de IA cuya respuesta una persona copió y pegó. Procedencia **declarada**. | ejecución |
| `ia_automatica` | Un modelo llamado por un adaptador automático. Procedencia informada por el adaptador. | ejecución |
| `codigo` | Resultado determinista del sistema (lab-V, Coordinador). | verificación, informe, historial |
| `humano` | Intervención de una persona, con identidad **declarada**. | encargo, historial, decisión |

## `cauce.lab.ejecucion` 0.2

Todo lo del 0.1, más:

- `autor`: `{tipo, identificador, adaptador, proveedor, modelo, procedencia, verificada}`.
  - `tipo` ∈ `guion_demo | ia_manual | ia_automatica` (ni `codigo` ni `humano`: una ejecución es la salida de un rol).
  - `verificada` es siempre `false`: este proyecto no puede comprobar criptográficamente qué modelo respondió.
  - `guion_demo`: solo `es_demo: true`; adaptador `ninguno` (o `automatico` con proveedor `prueba`); procedencia
    `no_aplica`; `modelo: null`; `intercambio: null`.
  - `ia_manual`: adaptador `manual-claude`; procedencia `declarada`; con `intercambio` si terminó.
  - `ia_automatica`: adaptador `ollama | automatico`; proveedor real (no `prueba`); procedencia `informada_por_adaptador`.
  - Un identificador de guion (`guion…`, `sin-modelo`) o el adaptador `ninguno` no pueden declararse IA.
- `intercambio` (solo `ia_manual`): `{formato: "cauce.lab.respuesta-manual 0.1", declarado_por: {tipo: humano,
  identificador, autenticacion: declarada}, metodo: pegado|archivo, importado_en, respuesta_sha256 (huella del texto
  pegado tal cual), solicitud_sha256 (huella de lo que se pidió), modelo_en_respuesta, avisos}`.
- `preguntas`, `limitaciones`: listas de texto.
- `recomendaciones`: `[{id, texto, se_basa_en}]`; `se_basa_en` no puede ir vacío (sin justificación no hay recomendación).
- `afirmaciones[].se_basa_en`: ids locales o `«<insumo>#<id>»`; nunca a sí misma.
- Objeciones: además de los tipos 0.1, `error_razonamiento`, `riesgo`, `explicacion_rival`.

**Compatibilidad.** El 0.1 se sigue aceptando para LEER lo registrado (sus huellas están citadas en verificaciones e
informes, así que no se migra reescribiendo). `autoriaDeEjecucion()` lo interpreta por su adaptador (`ninguno` →
guion DEMO) y lo marca `legado: true`. Todo lo nuevo se produce en 0.2. `cauce.lab.encargo` y
`cauce.lab.verificacion` siguen en 0.1 (se añadió el valor `automatico` a la lista de adaptadores).

## `cauce.lab.informe` 0.2

Igual que 0.1, con `modo.autoria = [{rol, tipo, identificador, proveedor, modelo, procedencia, verificada: false,
declarado_por, legado}]`. Reglas: no se mezcla `guion_demo` con IA en un informe; con guion, `es_demo` y
`es_ia: false`; todo IA, `es_ia: true`; manual = procedencia declarada. Las preguntas de los roles entran en
«información que falta», sus limitaciones en «limitaciones» y sus recomendaciones como `propuesta_del_rol`
(siempre `requiere_decision_humana`, nunca automáticas; las de dinero se excluyen).

## `cauce.lab.respuesta-manual` 0.1 (lo que se pega)

`{formato, version, encargo_id, encargo_sha256, rol, modelo_declarado, preguntas, afirmaciones, hipotesis, objeciones,
dudas, contradicciones, limitaciones, recomendaciones}`. Campos desconocidos (p. ej. `estado`, `decision_humana`) se
rechazan. Listas opcionales ausentes quedan vacías y se avisa. Se rechaza: JSON truncado o inválido, otro encargo,
otra huella, otro rol, una respuesta ya importada o usada en otro trabajo, más de 300 000 caracteres.

## `cauce.lab.expediente-local` 0.1 (guardar y reanudar)

`{formato, version, exportado_en, trabajo_id, es_demo, ficha: {fuente, texto, hechos, origen, vigencia}, documentos,
importaciones}`. Al reanudar: la ficha debe tener su huella, cada documento valida con su contrato, el trabajo
extiende a sus versiones anteriores, el informe es el que cita el trabajo. Si algo no cuadra, no se carga.

## Identidad de quien revisa

`decision_humana.por.autenticacion` solo admite `declarada`: no hay proveedor de identidad. Un `autenticada` escrito
en los datos se rechaza. Interfaz preparada: `app/laboratorio/identidad.js` (`proveedorIdentidad()`, hoy «ninguno»).
