// CSI · memoria de predicciones `cauce.csi.predicciones` 0.1 (bloque 6).
// Registro de SOLO ANEXADO con cadena de huellas: registro → correcciones (versiones nuevas) → evaluaciones.
// - Una predicción se registra ANTES de su horizonte; sus fuentes deben ser anteriores al registro (sin información futura).
// - Corregir crea una versión nueva; si la corrección llega cuando el horizonte ya empezó o hay evaluación, queda
//   marcada «posterior» y NO cuenta: se evalúa la última versión anterior al horizonte.
// - Se conservan aciertos, fallos, indeterminadas y las que nunca se evaluaron; y se comparan con una referencia simple.
// Limitación honesta: las horas las declara quien registra. La cadena prueba el ORDEN y detecta reescrituras; la hora
// absoluta solo se prueba con un ancla externa (p. ej. un commit publicado).

import { VERSION_CSI, ID, esObj, L, texto, esAutor, esFechaConZona, ms, huellaDe, claves, controlesComunes, seguroAntes, seguroDespues } from "./base.js";

export const CONTRATO_PREDICCIONES = "cauce.csi.predicciones";
export const TIPOS_ENTRADA = ["registro", "correccion", "evaluacion"];
export const RESULTADOS = ["acertada", "fallida", "indeterminada"];
const C = {
  raiz: ["contrato", "version_contrato", "es_demo", "entradas", "demo"],
  entrada: ["n", "tipo", "contenido", "registrado_en", "registrado_por", "huella_anterior", "huella"],
  prediccion: ["id", "investigacion_id", "hipotesis_id", "hipotesis_original", "resultado_observable", "horizonte", "criterios", "fuentes_conocidas", "supuestos", "version_reglas", "referencia"],
  criterios: ["acertada", "fallida", "indeterminada"],
  fuente: ["titulo", "publicada_en", "enlace", "ficticia"],
  referencia: ["descripcion", "resultado_esperado"],
  correccion: ["prediccion_id", "prediccion", "motivo"],
  evaluacion: ["prediccion_id", "resultado", "resultado_referencia", "evidencia", "nota"],
};

export const registroVacioPredicciones = (es_demo = false) => ({ contrato: CONTRATO_PREDICCIONES, version_contrato: VERSION_CSI, es_demo, entradas: [] });

function validarPrediccion(p, { es_demo, e, r = "contenido." }) {
  if (!esObj(p)) return e(`${r} debe ser un objeto.`);
  claves(p, C.prediccion, r, e);
  if (typeof p.id !== "string" || !ID.test(p.id)) e(`${r}id inválido.`);
  if (!texto(p.investigacion_id)) e(`${r}investigacion_id es obligatorio.`);
  for (const k of ["hipotesis_original", "resultado_observable", "version_reglas"]) if (!texto(p[k])) e(`${r}${k} es obligatorio.`);
  if (!esObj(p.horizonte) || !esFechaConZona(p.horizonte.desde) || !esFechaConZona(p.horizonte.hasta) || ms(p.horizonte.hasta) <= ms(p.horizonte.desde)) e(`${r}horizonte: {desde, hasta} instantes con zona, hasta > desde.`);
  if (!esObj(p.criterios)) e(`${r}criterios: {acertada, fallida, indeterminada}.`);
  else { claves(p.criterios, C.criterios, `${r}criterios.`, e); for (const k of C.criterios) if (!texto(p.criterios[k])) e(`${r}criterios.${k}: di de antemano cuándo cuenta como ${k}.`); }
  if (!Array.isArray(p.fuentes_conocidas)) e(`${r}fuentes_conocidas debe ser una lista (lo que se sabía al registrar).`);
  L(p.fuentes_conocidas).forEach((f, i) => { claves(f, C.fuente, `${r}fuentes_conocidas[${i}].`, e); if (!texto(f?.titulo)) e(`${r}fuentes_conocidas[${i}].titulo es obligatorio.`); if (es_demo !== (f?.ficticia === true)) e(`${r}fuentes_conocidas[${i}]: ${es_demo ? "en DEMO las fuentes son ficticias" : "una fuente ficticia no va en el registro REAL"}.`); });
  if (!Array.isArray(p.supuestos)) e(`${r}supuestos debe ser una lista.`);
  if (!esObj(p.referencia) || !texto(p.referencia.descripcion) || !texto(p.referencia.resultado_esperado)) e(`${r}referencia: {descripcion, resultado_esperado} de una predicción simple con la que comparar (p. ej. «sin cambio»).`);
  else claves(p.referencia, C.referencia, `${r}referencia.`, e);
}

/** Estado de cada predicción según el registro (todas sus versiones, correcciones y evaluaciones). */
function indice(doc) {
  const m = new Map();
  for (const en of L(doc?.entradas)) {
    const c = en.contenido ?? {};
    if (en.tipo === "registro") m.set(c.id, { id: c.id, original: c, registrado_en: en.registrado_en, registrado_por: en.registrado_por, versiones: [{ version: 1, prediccion: c, registrado_en: en.registrado_en, n: en.n, posterior: false }], evaluaciones: [] });
    const x = m.get(c.prediccion_id);
    if (!x) continue;
    const desde = ms(x.original.horizonte?.desde);
    if (en.tipo === "correccion") {
      const posterior = ms(en.registrado_en) >= desde || x.evaluaciones.length > 0;
      x.versiones.push({ version: x.versiones.length + 1, prediccion: c.prediccion, motivo: c.motivo, registrado_en: en.registrado_en, n: en.n, posterior });
    }
    if (en.tipo === "evaluacion") x.evaluaciones.push({ ...c, registrado_en: en.registrado_en, registrado_por: en.registrado_por, n: en.n });
  }
  return m;
}
/** La versión que cuenta: la última registrada ANTES del horizonte (las posteriores se muestran, no cuentan). */
const vigente = (x) => x.versiones.filter((v) => !v.posterior).at(-1);

/**
 * Anexa una entrada. Valida contra TODO el historial: orden de fechas, información futura, registro previo al
 * horizonte, evidencia del resultado posterior al registro. @returns {ok, doc, errores}
 */
export async function agregarEntrada(doc, { tipo, contenido, registrado_en, registrado_por }) {
  const errores = [];
  const e = (t) => errores.push(t);
  const v = validarRegistroPredicciones(doc);
  if (v.errores.length) return { ok: false, errores: ["El registro ya tiene errores:", ...v.errores] };
  if (!TIPOS_ENTRADA.includes(tipo)) e(`tipo debe ser uno de: ${TIPOS_ENTRADA.join(", ")}.`);
  if (!esFechaConZona(registrado_en)) e("registrado_en: instante con zona.");
  if (!esAutor(registrado_por)) e("registrado_por: {tipo, identificador} (declarado, sin autenticar).");
  const ultima = L(doc.entradas).at(-1);
  if (ultima && esFechaConZona(registrado_en) && ms(registrado_en) < ms(ultima.registrado_en)) e(`registrado_en ${registrado_en} es anterior a la última entrada (${ultima.registrado_en}): el registro no admite entradas hacia atrás.`);
  const idx = indice(doc);
  const es_demo = doc.es_demo === true;
  const sinFuturo = (p) => { for (const f of L(p?.fuentes_conocidas)) if (esFechaConZona(registrado_en) && !seguroAntes(f, registrado_en)) e(`fuente «${f.titulo}» (${f.publicada_en ?? "sin fecha"}) no se conocía con seguridad al registrar: información futura.`); };
  if (tipo === "registro") {
    validarPrediccion(contenido, { es_demo, e });
    if (idx.has(contenido?.id)) e(`La predicción «${contenido.id}» ya existe: para cambiarla registra una corrección (versión nueva).`);
    if (esFechaConZona(registrado_en) && esFechaConZona(contenido?.horizonte?.desde) && ms(registrado_en) >= ms(contenido.horizonte.desde)) e("Se registra ANTES del acontecimiento: registrado_en debe ser anterior a horizonte.desde.");
    sinFuturo(contenido);
  }
  if (tipo === "correccion") {
    claves(contenido, C.correccion, "contenido.", e);
    const x = idx.get(contenido?.prediccion_id);
    if (!x) e(`No existe la predicción «${contenido?.prediccion_id}».`);
    if (!texto(contenido?.motivo)) e("Una corrección explica su motivo.");
    validarPrediccion(contenido?.prediccion, { es_demo, e, r: "contenido.prediccion." });
    if (x && contenido?.prediccion?.id !== x.id) e("La corrección no puede cambiar el id de la predicción.");
    if (x && contenido?.prediccion?.horizonte && contenido.prediccion.horizonte.desde !== x.original.horizonte.desde) e("La corrección no puede mover el inicio del horizonte (cambiaría qué se predijo antes del acontecimiento).");
    sinFuturo(contenido?.prediccion);
  }
  if (tipo === "evaluacion") {
    claves(contenido, C.evaluacion, "contenido.", e);
    const x = idx.get(contenido?.prediccion_id);
    if (!x) e(`No existe la predicción «${contenido?.prediccion_id}».`);
    if (!RESULTADOS.includes(contenido?.resultado)) e(`resultado: ${RESULTADOS.join(", ")}.`);
    if (!RESULTADOS.includes(contenido?.resultado_referencia)) e(`resultado_referencia (de la predicción simple): ${RESULTADOS.join(", ")}.`);
    if (!Array.isArray(contenido?.evidencia)) e("evidencia debe ser una lista.");
    if (["acertada", "fallida"].includes(contenido?.resultado) && !L(contenido?.evidencia).length) e("Acertada o fallida exige evidencia del resultado.");
    if (contenido?.resultado === "indeterminada" && !texto(contenido?.nota)) e("Indeterminada exige una nota (por qué no se puede decidir).");
    if (x && esFechaConZona(registrado_en) && ms(registrado_en) < ms(x.original.horizonte.desde)) e("No se evalúa antes de que empiece el horizonte.");
    L(contenido?.evidencia).forEach((f, i) => {
      claves(f, C.fuente, `contenido.evidencia[${i}].`, e);
      if (!texto(f?.titulo)) e(`evidencia[${i}].titulo es obligatorio.`);
      if (x && !seguroDespues(f, x.registrado_en)) e(`evidencia[${i}] «${f?.titulo}» se publicó antes de registrar la predicción: no es evidencia del resultado.`);
      if (esFechaConZona(registrado_en) && !seguroAntes(f, registrado_en)) e(`evidencia[${i}] «${f?.titulo}» es posterior a la evaluación.`);
      if (es_demo !== (f?.ficticia === true)) e(`evidencia[${i}]: DEMO y REAL no se mezclan.`);
    });
  }
  controlesComunes(contenido, e);
  if (errores.length) return { ok: false, errores };
  const entrada = { n: L(doc.entradas).length + 1, tipo, contenido, registrado_en, registrado_por: { tipo: registrado_por.tipo, identificador: registrado_por.identificador, autenticacion: "declarada" }, huella_anterior: ultima?.huella ?? null };
  entrada.huella = await huellaDe(entrada);
  return { ok: true, doc: { ...doc, entradas: [...L(doc.entradas), entrada] }, errores: [] };
}

export function validarRegistroPredicciones(doc) {
  const errores = [];
  const e = (t) => errores.push(t);
  if (!esObj(doc)) return { errores: ["El registro debe ser un objeto."] };
  claves(doc, C.raiz, "", e);
  if (doc.contrato !== CONTRATO_PREDICCIONES || doc.version_contrato !== VERSION_CSI) e(`contrato ${CONTRATO_PREDICCIONES} ${VERSION_CSI}.`);
  if (typeof doc.es_demo !== "boolean") e("es_demo debe ser true o false.");
  if (doc.demo !== undefined && doc.es_demo !== true) e("demo solo existe en DEMO.");
  if (!Array.isArray(doc.entradas)) e("entradas debe ser una lista.");
  L(doc.entradas).forEach((x, i) => { claves(x, C.entrada, `entradas[${i}].`, e); if (x?.n !== i + 1) e(`entradas[${i}].n debe ser ${i + 1}.`); });
  return { errores };
}

/** Cadena de huellas: detecta entradas reescritas, borradas o reordenadas (una predicción no cambia en silencio). */
export async function verificarPredicciones(doc) {
  const problemas = [];
  let anterior = null;
  for (const [i, x] of L(doc?.entradas).entries()) {
    if (x.n !== i + 1) problemas.push(`Entrada ${i + 1}: número ${x.n} (falta o sobra una entrada).`);
    if ((x.huella_anterior ?? null) !== anterior) problemas.push(`Entrada ${x.n}: no enlaza con la anterior.`);
    const sin = { ...x }; delete sin.huella;
    if (await huellaDe(sin) !== x.huella) problemas.push(`Entrada ${x.n} (${x.tipo} ${x.contenido?.id ?? x.contenido?.prediccion_id ?? ""}): se modificó después de registrarse.`);
    anterior = x.huella;
  }
  return { ok: !problemas.length, problemas, entradas: L(doc?.entradas).length, ultima_huella: anterior };
}

/**
 * Resumen honesto: cuenta TODO (aciertos, fallos, indeterminadas, pendientes y vencidas sin evaluar) y compara con la
 * referencia simple. Un acierto no demuestra la explicación causal; con pocas evaluaciones no hay conclusión.
 */
export function resumirPredicciones(doc, ahoraMs = Date.now()) {
  const filas = [...indice(doc).values()].map((x) => {
    const v = vigente(x), p = v.prediccion;
    const ev = x.evaluaciones.at(-1) ?? null;
    const vencida = ahoraMs >= ms(p.horizonte.hasta);
    const estado = ev ? ev.resultado : vencida ? "sin_evaluar" : ahoraMs >= ms(p.horizonte.desde) ? "en_curso" : "pendiente";
    return { id: x.id, investigacion_id: p.investigacion_id, hipotesis_id: p.hipotesis_id ?? null, texto: p.hipotesis_original, observable: p.resultado_observable, horizonte: p.horizonte, criterios: p.criterios,
      registrado_en: x.registrado_en, registrado_por: x.registrado_por, version_evaluada: v.version, versiones: x.versiones.length, correcciones_posteriores: x.versiones.filter((y) => y.posterior).map((y) => ({ version: y.version, registrado_en: y.registrado_en, motivo: y.motivo })),
      version_reglas: p.version_reglas, referencia: p.referencia, estado, resultado_referencia: ev?.resultado_referencia ?? null, evaluaciones: x.evaluaciones.length, evidencia: ev?.evidencia ?? [], nota: ev?.nota ?? null,
      advertencia: ev?.resultado === "acertada" ? "Acertó el resultado observable; eso no demuestra que la explicación causal sea correcta." : null };
  });
  const cuenta = (k) => filas.filter((f) => f.estado === k).length;
  const decididas = filas.filter((f) => f.estado === "acertada" || f.estado === "fallida");
  const refDec = filas.filter((f) => ["acertada", "fallida"].includes(f.resultado_referencia) && ["acertada", "fallida", "indeterminada"].includes(f.estado));
  const comparacion = {
    modelo: { acertadas: cuenta("acertada"), fallidas: cuenta("fallida"), decididas: decididas.length },
    referencia: { acertadas: refDec.filter((f) => f.resultado_referencia === "acertada").length, fallidas: refDec.filter((f) => f.resultado_referencia === "fallida").length, decididas: refDec.length },
  };
  comparacion.lectura = decididas.length < 10
    ? `Solo ${decididas.length} predicción(es) decidida(s): no alcanza para afirmar que el modelo supera a la referencia simple.`
    : comparacion.modelo.acertadas > comparacion.referencia.acertadas ? "El modelo acertó más que la referencia en estas predicciones; revisar si la diferencia se sostiene con más casos." : "El modelo no supera a la referencia simple.";
  return {
    filas, total: filas.length, pendientes: cuenta("pendiente"), en_curso: cuenta("en_curso"), sin_evaluar: cuenta("sin_evaluar"),
    acertadas: cuenta("acertada"), fallidas: cuenta("fallida"), indeterminadas: cuenta("indeterminada"),
    correcciones_posteriores: filas.reduce((s, f) => s + f.correcciones_posteriores.length, 0), comparacion,
  };
}
