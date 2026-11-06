// Contrato `cauce.recomendacion` 0.2 (CAUCE_NEXUS_ARQUITECTURA_MAESTRA_v0.2 §4) y su revisión escéptica.
// Una recomendación es una propuesta falsable, NO una autorización. Aprobación ≠ ejecución ≠ adopción ≠ despliegue.
// En la fase 1 Nexus solo registra: no ejecuta ni adopta nada, y con toca_parametros_financieros o toca_apuestas
// nunca habrá ejecución ni adopción por Nexus (bloqueo absoluto §4).

import { esFechaConZona, esFechaODia, texto, mismoId, buscarDatosPrivados } from "./comun.js";
import { evaluarLeccion, buscarEstrategia, VERSION_REGLAS, ESTADOS, REGLAS } from "./gerente.js";
import { versionDe } from "./leccion.js";

export const ESQUEMA_RECOMENDACION = "cauce.recomendacion";
export const ESTADOS_REC = ["propuesta", "revisada", "pendiente_aprobacion", "aprobada", "rechazada", "aplazada", "caducada"];
export const ESTADOS_EJECUCION = ["no_iniciada", "ejecutada", "fallida", "cancelada"];
export const ESTADOS_ADOPCION = ["no_adoptada", "en_pr", "fusionada", "desplegada", "revertida"];
const CAMPOS = ["id", "esquema", "version_esquema", "estado", "destino", "lecciones", "problema", "hipotesis", "accion_propuesta", "experimento", "riesgos", "permisos_requeridos",
  "toca_parametros_financieros", "toca_apuestas", "revision_esceptica", "decision_humana", "ejecucion", "adopcion", "historial"];
const EXPERIMENTO = ["metrica_primaria", "linea_base", "muestra", "unidad_independencia", "n_minimo", "ventana", "criterio_exito", "criterio_fracaso", "parada", "aislamiento", "reversion", "preregistro_ref"];
const DECISION = ["estado", "responsable", "fecha", "alcance", "vigencia", "condiciones", "referencia"];
/** De qué estado se puede pasar a cuál (entre versiones registradas). */
export const TRANSICIONES = {
  propuesta: ["propuesta", "revisada", "caducada"],
  revisada: ["propuesta", "revisada", "pendiente_aprobacion", "caducada"],
  pendiente_aprobacion: ["aprobada", "rechazada", "aplazada", "propuesta", "caducada"],
  aplazada: ["pendiente_aprobacion", "caducada"],
  aprobada: ["aprobada", "caducada"], // una aprobada solo cambia su ejecución/adopción (registro de lo hecho fuera) o caduca
  rechazada: [],
  caducada: [],
};
export const ETIQUETA = {
  propuesta: "Propuesta", revisada: "Revisada", pendiente_aprobacion: "Pendiente de aprobación humana", aprobada: "Aprobada por una persona",
  rechazada: "Rechazada", aplazada: "Aplazada", caducada: "Caducada",
};
const esObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const L = (v) => (Array.isArray(v) ? v : []);

/** Forma del documento. */
export function validarRecomendacion(r) {
  const errores = [];
  const e = (t) => errores.push(t);
  if (!esObj(r)) return { errores: ["La recomendación debe ser un objeto JSON."] };
  for (const k of Object.keys(r)) if (!CAMPOS.includes(k)) e(`${k}: clave desconocida.`);
  for (const k of CAMPOS) if (!(k in r)) e(`${k} es obligatorio.`);
  if (!texto(r.id)) e("id es obligatorio.");
  if (r.esquema !== ESQUEMA_RECOMENDACION) e(`esquema debe ser "${ESQUEMA_RECOMENDACION}".`);
  if (r.version_esquema !== "0.2") e('version_esquema debe ser "0.2".');
  if (!ESTADOS_REC.includes(r.estado)) e(`estado debe ser uno de: ${ESTADOS_REC.join(", ")}.`);
  if (!esObj(r.destino) || !texto(r.destino.proyecto) || !texto(r.destino.componente)) e("destino necesita proyecto y componente.");
  if (!Array.isArray(r.lecciones) || !r.lecciones.length || r.lecciones.some((x) => !texto(x?.id) || !texto(String(x?.revision ?? "")))) e("lecciones: al menos una {id, revision}.");
  for (const k of ["problema", "hipotesis", "accion_propuesta"]) if (!texto(r[k])) e(`${k} es obligatorio.`);
  for (const k of ["riesgos", "permisos_requeridos"]) if (!Array.isArray(r[k])) e(`${k} debe ser una lista.`);
  for (const k of ["toca_parametros_financieros", "toca_apuestas"]) if (typeof r[k] !== "boolean") e(`${k} debe ser true o false.`);
  if (!esObj(r.experimento)) e("experimento debe ser un objeto.");
  else { for (const k of Object.keys(r.experimento)) if (!EXPERIMENTO.includes(k)) e(`experimento.${k}: clave desconocida.`); for (const k of EXPERIMENTO) if (!(k in r.experimento)) e(`experimento.${k} es obligatorio (null solo en borrador).`); }
  const re = r.revision_esceptica;
  if (!esObj(re)) e("revision_esceptica debe ser un objeto.");
  else {
    if (!Array.isArray(re.reglas)) e("revision_esceptica.reglas debe ser una lista.");
    else re.reglas.forEach((x, i) => { if (!ESTADOS.includes(x?.estado)) e(`revision_esceptica.reglas[${i}].estado «${x?.estado}» no existe: solo cumple, no_cumple o no_evaluado (nunca «no_evaluada»).`); });
    if (!esObj(re.revisor) || !texto(re.revisor.tipo) || !texto(re.revisor.identificador)) e("revision_esceptica.revisor necesita tipo e identificador.");
  }
  if (!esObj(r.decision_humana)) e("decision_humana debe ser un objeto.");
  else {
    for (const k of DECISION) if (!(k in r.decision_humana)) e(`decision_humana.${k} es obligatorio (puede ser null).`);
    if (r.decision_humana.fecha !== null && r.decision_humana.fecha !== undefined && !esFechaConZona(r.decision_humana.fecha)) e("decision_humana.fecha debe ser instante con zona o null.");
  }
  if (!esObj(r.ejecucion) || !ESTADOS_EJECUCION.includes(r.ejecucion.estado) || !Array.isArray(r.ejecucion.resultados)) e(`ejecucion necesita estado (${ESTADOS_EJECUCION.join(", ")}) y resultados [].`);
  if (!esObj(r.adopcion) || !ESTADOS_ADOPCION.includes(r.adopcion.estado)) e(`adopcion.estado debe ser uno de: ${ESTADOS_ADOPCION.join(", ")}.`);
  if (!Array.isArray(r.historial) || !r.historial.length) e("historial: al menos un evento.");
  else r.historial.forEach((h, i) => {
    if (!texto(h?.evento)) e(`historial[${i}].evento es obligatorio.`);
    if (!esFechaConZona(h?.fecha)) e(`historial[${i}].fecha debe ser instante con zona.`);
    if (!["humano", "codigo", "ia"].includes(h?.autor_tipo)) e(`historial[${i}].autor_tipo debe ser humano, codigo o ia.`);
  });
  for (const p of buscarDatosPrivados(r)) e(`Dato privado no permitido en ${p.ruta}: ${p.motivo}.`);
  return { errores };
}

/**
 * Revisión escéptica de una recomendación: recalcula las reglas sobre sus lecciones y agrega las propias.
 * @returns { reglas, bloqueos[], aprobable, inconsistencias[] }
 *  - `reglas`: peor estado por regla entre las lecciones citadas, con R07/R09/R10 de la propia recomendación.
 *  - `inconsistencias`: lo guardado en revision_esceptica que no coincide con lo recalculado (T12 → se rechaza).
 */
export function evaluarRecomendacion(r, { lecciones = new Map(), ahora = Date.now() } = {}) {
  const bloqueos = [];
  const peor = new Map(REGLAS.map((x) => [x.id, { id: x.id, nombre: x.nombre, estado: "cumple", motivo: [], referencia: [], version: VERSION_REGLAS }]));
  const orden = { cumple: 0, no_evaluado: 1, no_cumple: 2 };
  const sumar = (id, estado, motivo, ref) => { const p = peor.get(id); if (orden[estado] > orden[p.estado]) p.estado = estado; if (estado !== "cumple") p.motivo.push(motivo); if (ref) p.referencia.push(ref); };
  for (const c of L(r?.lecciones)) {
    const l = lecciones.get(c?.id);
    if (!l) { bloqueos.push(`La lección ${c?.id} no está en el registro.`); for (const x of REGLAS) sumar(x.id, "no_evaluado", `${c?.id}: no está en el registro`); continue; }
    if (String(versionDe(l)) !== String(c.revision)) { bloqueos.push(`La lección ${c.id} va en la revisión «${versionDe(l)}», no en «${c.revision}».`); for (const x of REGLAS) sumar(x.id, "no_evaluado", `${c.id}: revisión citada desactualizada`); continue; }
    for (const x of evaluarLeccion(l, { ahora, lecciones }).reglas) sumar(x.id, x.estado, `${c.id}: ${x.motivo}`, c.id);
  }
  // Reglas propias de la recomendación.
  const priv = buscarDatosPrivados(r), est = buscarEstrategia(r);
  if (priv.length || est.length) sumar("R07", "no_cumple", "La recomendación contiene datos privados o detalles de estrategia.");
  const x = r?.experimento ?? {};
  const pendientes = EXPERIMENTO.filter((k) => x[k] === null || x[k] === undefined || x[k] === "");
  if (pendientes.length) sumar("R10", "no_cumple", `Experimento con valores pendientes (${pendientes.join(", ")}): es un borrador no aprobable.`);
  const absoluto = r?.toca_parametros_financieros === true || r?.toca_apuestas === true;
  if (absoluto && (r?.ejecucion?.estado !== "no_iniciada" || r?.adopcion?.estado !== "no_adoptada"))
    sumar("R10", "no_cumple", "Toca parámetros financieros o apuestas: Nexus nunca registra ejecución ni adopción (bloqueo absoluto §4, T09).");
  if (r?.ejecucion?.estado === "ejecutada" && !L(r.ejecucion.resultados).some((y) => texto(y?.referencia))) sumar("R09", "no_cumple", "Ejecución «ejecutada» sin resultados con referencia.");
  if (r?.adopcion?.estado && r.adopcion.estado !== "no_adoptada" && !texto(r.adopcion.referencia)) sumar("R09", "no_cumple", `Adopción «${r.adopcion.estado}» sin referencia: la adopción no se deduce de la ejecución.`);
  if (["ejecutada", "fallida"].includes(r?.ejecucion?.estado) && r?.estado !== "aprobada") sumar("R10", "no_cumple", "Hay ejecución registrada sin aprobación humana.");

  const reglas = [...peor.values()].map((p) => ({ ...p, motivo: p.estado === "cumple" ? "Cumple en todas las lecciones citadas." : [...new Set(p.motivo)].join(" · "), referencia: [...new Set(p.referencia)] }));
  // T12: lo guardado no puede decir «cumple» donde el cálculo no lo dice.
  const inconsistencias = [];
  const guardadas = L(r?.revision_esceptica?.reglas);
  if (guardadas.length && r?.revision_esceptica?.version_reglas !== VERSION_REGLAS) inconsistencias.push(`version_reglas debe ser «${VERSION_REGLAS}».`);
  for (const g of guardadas) {
    const real = peor.get(g?.id);
    if (!real) { inconsistencias.push(`Regla desconocida ${g?.id}.`); continue; }
    if (g.estado === "cumple" && reglas.find((y) => y.id === g.id).estado !== "cumple") inconsistencias.push(`${g.id} se presenta como «cumple» pero el gerente obtiene «${reglas.find((y) => y.id === g.id).estado}» (T12).`);
  }
  if (absoluto) bloqueos.push("Bloqueo absoluto: toca parámetros financieros o apuestas. Una persona puede aprobar estudiarla; Nexus nunca la ejecutará ni adoptará.");
  for (const y of reglas) if (y.estado !== "cumple") bloqueos.push(`${y.id} ${y.nombre}: ${y.estado}.`);
  return { reglas, bloqueos, inconsistencias, aprobable: reglas.every((y) => y.estado === "cumple") && !inconsistencias.length && !bloqueos.some((b) => !b.startsWith("Bloqueo absoluto")) };
}

/** Revisión escéptica lista para guardar en el documento (la genera el gerente; revisor = código). */
export function revisionEsceptica(r, ctx) {
  const ev = evaluarRecomendacion({ ...r, revision_esceptica: { reglas: [] } }, ctx);
  return { version_reglas: VERSION_REGLAS, reglas: ev.reglas.map((x) => ({ id: x.id, estado: x.estado, motivo: x.motivo, evidencia_consultada: x.referencia })), revisor: { tipo: "codigo", identificador: "gerente-esceptico" } };
}

/**
 * Comprueba el paso de una versión a la siguiente (historial que solo crece, transición permitida, aprobación humana).
 * @returns lista de errores (vacía si el paso es válido)
 */
export function validarPaso(anterior, nueva, { lecciones = new Map(), ahora = Date.now() } = {}) {
  const errores = [];
  const hA = L(anterior?.historial), hN = L(nueva?.historial);
  if (anterior) {
    if (hN.length <= hA.length || JSON.stringify(hN.slice(0, hA.length)) !== JSON.stringify(hA)) errores.push("historial: solo se puede anexar; los eventos anteriores no cambian y debe haber al menos uno nuevo.");
    if (!L(TRANSICIONES[anterior.estado]).includes(nueva.estado)) errores.push(`No se puede pasar de «${anterior.estado}» a «${nueva.estado}».`);
  } else if (!["propuesta"].includes(nueva.estado)) errores.push("Una recomendación nueva empieza como «propuesta».");
  const ultimo = hN.at(-1);
  if (ultimo && hA.length && Date.parse(ultimo.fecha) < Date.parse(hA.at(-1).fecha)) errores.push("El evento nuevo tiene fecha anterior al previo.");
  const d = nueva.decision_humana ?? {};
  if (nueva.estado === "aprobada" && anterior?.estado !== "aprobada") {
    const proponente = hN[0];
    if (ultimo?.evento !== "aprobada" || ultimo.autor_tipo !== "humano") errores.push("La aprobación debe registrarla una persona (último evento «aprobada», autor_tipo humano).");
    if (d.estado !== "aprobada" || !texto(d.responsable) || !esFechaConZona(d.fecha) || !texto(d.alcance) || !(esFechaODia(d.vigencia) || texto(d.vigencia))) errores.push("decision_humana aprobada necesita responsable, fecha con zona, alcance y vigencia.");
    if (proponente && mismoId(d.responsable, proponente.autor)) errores.push("Quien propone no puede aprobar su propia recomendación.");
    if (mismoId(d.responsable, "gerente-esceptico") || ultimo?.autor_tipo !== "humano") errores.push("El gerente (código) o una IA no aprueban.");
    const ev = evaluarRecomendacion(nueva, { lecciones, ahora });
    if (!ev.aprobable) errores.push(`No es aprobable: ${[...ev.inconsistencias, ...ev.bloqueos.filter((b) => !b.startsWith("Bloqueo absoluto"))].join(" ")} Lo no evaluado nunca se aprueba.`);
  }
  if (nueva.estado !== "aprobada" && d.estado === "aprobada") errores.push("decision_humana dice «aprobada» pero el estado no.");
  if (nueva.estado === "pendiente_aprobacion" && !L(nueva.revision_esceptica?.reglas).length) errores.push("Para pedir aprobación hace falta la revisión escéptica.");
  if (nueva.estado !== "aprobada" && nueva.ejecucion?.estado !== "no_iniciada") errores.push("Sin aprobación humana no hay ejecución.");
  if ((nueva.toca_parametros_financieros || nueva.toca_apuestas) && (nueva.ejecucion?.estado !== "no_iniciada" || nueva.adopcion?.estado !== "no_adoptada")) errores.push("Bloqueo absoluto: Nexus no registra ejecución ni adopción de algo que toca dinero o apuestas.");
  const inc = evaluarRecomendacion(nueva, { lecciones, ahora }).inconsistencias;
  if (inc.length) errores.push(...inc.map((t) => `revision_esceptica: ${t}`));
  return errores;
}

/** Resumen honesto de dónde está: aprobada ≠ ejecutada ≠ adoptada ≠ desplegada. */
export function situacion(r) {
  const partes = [ETIQUETA[r.estado] ?? r.estado];
  if (r.estado === "aprobada") partes.push(r.ejecucion?.estado === "no_iniciada" ? "sin ejecutar" : `ejecución: ${r.ejecucion?.estado}`);
  partes.push(r.adopcion?.estado === "no_adoptada" ? "no adoptada" : `adopción: ${r.adopcion?.estado}`);
  return partes.join(" · ");
}
