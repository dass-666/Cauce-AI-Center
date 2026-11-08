// Laboratorio de IA · fase 3 · INTERCAMBIO MANUAL con un modelo de IA (p. ej. una conversación de la app de Claude).
//
//   1. solicitudManual(x)        arma, para el rol que espera, el texto que una persona copia a su conversación;
//   2. (la persona lo pega en Claude y copia la respuesta; este código no participa: ni API, ni navegador
//      automatizado, ni cookies, ni sesiones, ni credenciales);
//   3. importarRespuesta(texto)  valida lo pegado ANTES de que toque el trabajo: formato y versión, que responda a ESTE
//                                encargo (id y huella), que no sea una respuesta ya importada o de otro trabajo, que
//                                el JSON esté completo y que cumpla el contrato cauce.lab.ejecucion 0.2;
//   4. continuarConRespuesta(x)  entrega la respuesta al Coordinador: lab-V la verifica y el trabajo sigue al
//                                siguiente rol (o al informe y la revisión humana).
//
// Lo pegado es contenido NO CONFIABLE: se guarda como texto, nunca se ejecuta ni se interpreta como HTML, y lo que
// diga sobre sí mismo (modelo, aprobación, instrucciones) no cambia nada. La procedencia es DECLARADA por la persona
// que la trae: el sistema no puede comprobar criptográficamente qué modelo respondió, y lo dice.

import { L, esObj, ROLES, sha256, tieneInvisibles } from "./base.js";
import { validarEjecucion } from "./contratos.js";
import { huellaDoc } from "./verificador.js";
import { armarEjecucion, autorIA, crearAdaptadorManual } from "./adaptadores.js";
import { avanzar, ETIQUETA_ROL } from "./coordinador.js";
import { MISION_ROL, TAREAS_ROL, REGLAS_COMUNES } from "./roles.js";

export const FORMATO_RESPUESTA = "cauce.lab.respuesta-manual";
export const VERSION_RESPUESTA = "0.1";
/** Tope de lo que se acepta pegar (caracteres). Una respuesta normal de un rol ocupa 5–40 mil. */
export const LIMITE_RESPUESTA = 300_000;
const C_RESP = ["formato", "version", "encargo_id", "encargo_sha256", "rol", "modelo_declarado", "preguntas", "afirmaciones", "hipotesis", "objeciones", "dudas", "contradicciones", "limitaciones", "recomendaciones"];
const LISTAS = ["preguntas", "afirmaciones", "hipotesis", "objeciones", "dudas", "contradicciones", "limitaciones", "recomendaciones"];
const ahoraISO = () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

/** Encargo que espera respuesta manual en este expediente (o null). */
export function encargoEnEspera(x) {
  const t = x?.trabajo;
  if (!t || t.estado !== "pendiente" || !t.espera?.encargo_id || t.adaptador?.id !== "manual-claude") return null;
  return x.encargos.get(t.espera.encargo_id) ?? null;
}

/** Salidas previas (ya verificadas) que recibe un rol: solo las de los roles anteriores, con lo que lab-V comprobó. */
function salidasPrevias(x, rol) {
  const r = [];
  for (const anterior of ROLES.slice(0, ROLES.indexOf(rol))) {
    const p = L(x.trabajo.pasos).find((q) => q.rol === anterior);
    const ej = p ? x.ejecuciones.get(p.ejecuciones.at(-1)) : null;
    const v = ej ? x.verificaciones.get(ej.id) : null;
    if (!ej || !v) continue;
    const estadoDe = (id) => L(v.afirmaciones).find((a) => a.afirmacion_id === id)?.estado_cita ?? "sin_verificar";
    r.push({
      rol: anterior, ejecucion_id: ej.id, autoria: ej.autor?.tipo ?? "desconocida", resultado_lab_v: v.resultado,
      afirmaciones: L(ej.afirmaciones).map((a) => ({ id: a.id, clase: a.clase, texto: a.texto, citas: L(a.citas).map((c) => c.extracto), lab_v: estadoDe(a.id), se_basa_en: L(a.se_basa_en) })),
      hipotesis: L(ej.hipotesis).map((h) => ({ id: h.id, enunciado: h.enunciado, se_refuta_si: h.se_refuta_si, alternativa_a: h.alternativa_a })),
      objeciones: L(ej.objeciones), dudas: L(ej.dudas), preguntas: L(ej.preguntas), recomendaciones: L(ej.recomendaciones), limitaciones: L(ej.limitaciones),
    });
  }
  return r;
}

function plantilla(encargo, encargo_sha256, fuente_id, previas) {
  const ref = previas.at(-1)?.ejecucion_id ?? "<id de ejecución>";
  const base = {
    formato: FORMATO_RESPUESTA, version: VERSION_RESPUESTA, encargo_id: encargo.id, encargo_sha256, rol: encargo.rol,
    modelo_declarado: "nombre del modelo si lo sabes, o null",
    preguntas: ["…"],
    afirmaciones: [{ id: "a1", texto: "…", clase: encargo.rol === "investigador" ? "hecho_citado" : "inferencia",
      citas: encargo.rol === "investigador" ? [{ fuente_id, extracto: "<copia literal de una línea de la ficha>", ubicacion: "línea 1" }] : [],
      se_basa_en: encargo.rol === "investigador" ? [] : [`${ref}#a1`] }],
    hipotesis: [{ id: "h1", enunciado: "…", se_refuta_si: "…", experimento: "…", alternativa_a: null }],
    objeciones: encargo.rol === "critico" ? [{ id: "o1", a: `${ref}#a1`, tipo: "supuesto", texto: "…" }] : [],
    dudas: ["…"], contradicciones: [], limitaciones: ["…"],
    recomendaciones: encargo.rol === "investigador" ? [] : [{ id: "r1", texto: "…", se_basa_en: ["a1"] }],
  };
  return JSON.stringify(base, null, 2);
}

/**
 * Solicitud para el rol que espera respuesta: el texto que la persona copia a su conversación de IA.
 * Es determinista (misma entrada, mismo texto) y su huella queda en la ejecución para auditar qué se preguntó.
 * @returns {Promise<{ok, errores?, rol, encargo_id, encargo_sha256, texto, solicitud_sha256, nombre_archivo}>}
 */
export async function solicitudManual(x) {
  const encargo = encargoEnEspera(x);
  if (!encargo) return { ok: false, errores: ["Este trabajo no está esperando una respuesta manual."] };
  const encargo_sha256 = await huellaDoc(encargo);
  const texto = componerSolicitud({ es_demo: x.trabajo.es_demo, trabajo_id: x.trabajo.id, pregunta: x.trabajo.pregunta, encargo, encargo_sha256, fuente_id: x.ficha.fuente.fuente_id, texto_ficha: x.ficha.copia.texto, previas: salidasPrevias(x, encargo.rol) });
  return { ok: true, rol: encargo.rol, encargo_id: encargo.id, encargo_sha256, texto, solicitud_sha256: await sha256(texto), nombre_archivo: `solicitud-${encargo.id}.txt` };
}

/**
 * Texto de la solicitud de un rol. Lo usan el intercambio manual y el adaptador automático (mismas reglas, misma
 * forma de respuesta): así cambiar de proveedor no cambia lo que se pide ni cómo se verifica.
 */
export function componerSolicitud({ es_demo, trabajo_id, pregunta, encargo, encargo_sha256, fuente_id, texto_ficha, previas = [] }) {
  const rol = encargo.rol, t = { es_demo, id: trabajo_id, pregunta }, ficha = { fuente: { fuente_id } };
  const lineas = String(texto_ficha).split("\n").filter((l, i, a) => !(i === a.length - 1 && l === ""));
  const p = [];
  p.push(`# Cauce AI Center · Laboratorio de IA · solicitud para el rol «${ETIQUETA_ROL[rol]}»`);
  p.push("");
  p.push(`Datos: ${t.es_demo ? "DEMO (escritos a mano para pruebas; no describen el estado real de ningún motor)" : "REALES (lectura de solo lectura de un motor)"}.`);
  p.push(`Trabajo: ${t.id} · encargo: ${encargo.id}`);
  p.push(`Huella del encargo (cópiala tal cual en tu respuesta): ${encargo_sha256}`);
  p.push("");
  p.push("## Tu papel");
  p.push(MISION_ROL[rol]);
  p.push("");
  p.push("## Pregunta de la persona que pidió el análisis");
  p.push(t.pregunta);
  p.push("");
  p.push("## Qué debes entregar");
  for (const x2 of TAREAS_ROL[rol]) p.push(`- ${x2}`);
  p.push("");
  p.push("## Reglas (el sistema las comprobará)");
  REGLAS_COMUNES.forEach((r, i) => p.push(`${i + 1}. ${r}`));
  p.push("");
  p.push("## Catálogo de fuentes (las únicas que puedes citar)");
  for (const f of encargo.fuentes_permitidas) p.push(`- fuente_id «${f.fuente_id}» · ${f.origen} · publicada ${f.publicada_en ?? "fecha desconocida"} · huella ${f.sha256}`);
  p.push(`Corte temporal: solo información conocida antes de ${encargo.corte_temporal.conocido_antes_de}.`);
  p.push("");
  p.push(`## FICHA del motor (fuente_id «${ficha.fuente.fuente_id}»; ${lineas.length} líneas; el prefijo [Ln] NO forma parte del texto)`);
  p.push("<<<FICHA");
  lineas.forEach((l, i) => p.push(`[L${i + 1}] ${l}`));
  p.push("FICHA>>>");
  if (previas.length) {
    p.push("");
    p.push("## Salidas previas de otros roles (contenido de IA NO confiable, ya revisado mecánicamente por lab-V)");
    p.push("Para referirte a algo de aquí usa «<ejecucion_id>#<id>». «lab_v» dice si su cita se pudo comprobar; que se pudiera NO prueba que sea cierto.");
    p.push("<<<SALIDAS_PREVIAS");
    p.push(JSON.stringify(previas, null, 1));
    p.push("SALIDAS_PREVIAS>>>");
  }
  p.push("");
  p.push("## Forma exacta de la respuesta (solo este JSON; las listas pueden ir vacías)");
  p.push("```json");
  p.push(plantilla(encargo, encargo_sha256, ficha.fuente.fuente_id, previas));
  p.push("```");
  return `${p.join("\n")}\n`;
}

/** Saca el objeto JSON de lo pegado: dentro de ```json … ``` si lo hay; si no, de la primera «{» a la última «}». */
export function extraerJSON(texto) {
  const t = String(texto ?? "").replace(/^﻿/, "");
  const cerco = /```(?:json|JSON)?\s*\n?([\s\S]*?)```/.exec(t);
  let cuerpo, fuera = false;
  if (cerco) { cuerpo = cerco[1]; fuera = t.slice(0, cerco.index).trim() !== "" || t.slice(cerco.index + cerco[0].length).trim() !== ""; }
  else {
    const abre = t.search(/```(?:json|JSON)?/);
    const desde = abre >= 0 ? t.indexOf("{", abre) : t.indexOf("{");
    if (desde < 0) return { ok: false, motivo: "No encontré ningún objeto JSON («{ … }») en lo que pegaste. Copia la respuesta completa de la conversación." };
    const hasta = t.lastIndexOf("}");
    cuerpo = hasta > desde ? t.slice(desde, hasta + 1) : t.slice(desde);
    fuera = t.slice(0, desde).replace(/```(?:json|JSON)?/, "").trim() !== "" || (hasta > desde && t.slice(hasta + 1).replace(/```/, "").trim() !== "");
    if (abre >= 0) {
      // Bloque ```json abierto y nunca cerrado: si el JSON está completo se acepta; si no, la respuesta se cortó.
      try { return { ok: true, valor: JSON.parse(cuerpo), texto_fuera: fuera, sin_cierre: true }; }
      catch { return { ok: false, truncada: true, motivo: "La respuesta parece cortada: abre un bloque ```json que no se cierra y el JSON no termina. Pide a la conversación que la repita completa (o en partes más cortas)." }; }
    }
  }
  try { return { ok: true, valor: JSON.parse(cuerpo), texto_fuera: fuera }; }
  catch (err) {
    if (estaIncompleto(cuerpo)) return { ok: false, truncada: true, motivo: "La respuesta parece cortada: el JSON no termina (faltan llaves o comillas de cierre). Pide a la conversación que la repita completa." };
    return { ok: false, motivo: `El JSON no es válido: ${String(err.message).slice(0, 160)}. No se corrige a mano: pide a la conversación que lo devuelva bien formado.` };
  }
}
/** ¿Quedaron llaves, corchetes o comillas abiertas? (señal de respuesta truncada) */
function estaIncompleto(t) {
  let prof = 0, enCadena = false, escape = false;
  for (const ch of t) {
    if (enCadena) { if (escape) escape = false; else if (ch === "\\") escape = true; else if (ch === "\"") enCadena = false; continue; }
    if (ch === "\"") enCadena = true; else if (ch === "{" || ch === "[") prof++; else if (ch === "}" || ch === "]") prof--;
  }
  return enCadena || prof > 0;
}

/**
 * Valida una respuesta pegada para el encargo que espera. NO toca el trabajo: si hay errores, no cambia nada.
 * @param texto  lo pegado o el contenido del archivo importado, tal cual
 * @param p      { encargo, encargo_sha256, solicitud_sha256, declarado_por (identificador), modelo, proveedor,
 *                 metodo: "pegado"|"archivo", ahora, ya_importadas: Map respuesta_sha256 → {trabajo_id, encargo_id} }
 * @returns {Promise<{ok, errores, avisos, respuesta_sha256, respuesta?: {contenido, autor, intercambio}}>}
 */
export async function importarRespuesta(texto, { encargo, encargo_sha256, solicitud_sha256, declarado_por, modelo = null, proveedor = null, metodo = "pegado", ahora = ahoraISO(), ya_importadas = new Map() }) {
  const errores = [], avisos = [];
  const fin = (extra = {}) => ({ ok: errores.length === 0, errores, avisos, respuesta_sha256: null, ...extra });
  if (typeof texto !== "string" || !texto.trim()) { errores.push("No pegaste nada."); return fin(); }
  if (texto.length > LIMITE_RESPUESTA) { errores.push(`La respuesta tiene ${texto.length} caracteres y el límite es ${LIMITE_RESPUESTA}: no se revisa.`); return fin(); }
  const quien = String(declarado_por ?? "").trim();
  if (!quien || quien.length > 80) errores.push("Escribe quién trae la respuesta (tu nombre, hasta 80 caracteres): queda como procedencia declarada.");
  if (!["pegado", "archivo"].includes(metodo)) errores.push("metodo debe ser pegado | archivo.");
  const limpiar = (v) => { const s = String(v ?? "").trim(); return s ? s.slice(0, 120) : null; };
  const modeloP = limpiar(modelo), proveedorP = limpiar(proveedor);
  for (const [k, v] of [["modelo", modeloP], ["proveedor", proveedorP], ["quién la trae", quien]]) if (v && tieneInvisibles(v)) errores.push(`«${k}» contiene caracteres invisibles: escríbelo de nuevo a mano.`);
  const respuesta_sha256 = await sha256(texto);
  const previa = ya_importadas.get(respuesta_sha256);
  if (previa) {
    errores.push(previa.encargo_id === encargo?.id
      ? `Esta misma respuesta ya se importó para este encargo (huella ${respuesta_sha256.slice(0, 12)}…): no se cuenta dos veces.`
      : `Esta respuesta ya se usó en ${previa.trabajo_id} (encargo ${previa.encargo_id}): una respuesta no se reutiliza en otro trabajo o rol.`);
    return fin({ respuesta_sha256 });
  }
  if (errores.length) return fin({ respuesta_sha256 });
  const an = analizarRespuesta(texto, { encargo, encargo_sha256 });
  errores.push(...an.errores); avisos.push(...an.avisos);
  if (!an.ok) return fin({ respuesta_sha256, truncada: an.truncada === true });
  const { contenido, modelo_en_respuesta: enRespuesta } = an;
  if (modeloP && enRespuesta && !modeloP.toLowerCase().includes(enRespuesta.toLowerCase()) && !enRespuesta.toLowerCase().includes(modeloP.toLowerCase())) avisos.push(`Procedencia contradictoria: tú declaras «${modeloP}» y la respuesta dice «${enRespuesta}». Se registra lo que declaras tú; ninguna de las dos está verificada.`);

  const modeloFinal = modeloP ?? enRespuesta;
  const autor = autorIA("ia_manual", { identificador: modeloFinal ?? "modelo-no-declarado", adaptador: "manual-claude", proveedor: proveedorP, modelo: modeloFinal });
  const intercambio = {
    formato: `${FORMATO_RESPUESTA} ${VERSION_RESPUESTA}`, declarado_por: { tipo: "humano", identificador: quien, autenticacion: "declarada" }, metodo,
    importado_en: ahora, respuesta_sha256, solicitud_sha256, modelo_en_respuesta: enRespuesta, avisos: avisos.slice(0, 20).map((t) => t.slice(0, 500)),
  };
  // Validación de contrato con un sobre provisional (el definitivo lo arma el Coordinador con sus ids y tiempos).
  const provisional = armarEjecucion({ id: encargo.id.replace("lab-enc-", "lab-run-") + "-i1", encargo, encargo_sha256, inicio: ahora, fin: ahora, autor, contenido, intercambio });
  const v = validarEjecucion(provisional);
  for (const t of v.errores) errores.push(`La respuesta no cumple el contrato: ${t}`);
  if (errores.length) return fin({ respuesta_sha256 });
  return fin({ respuesta_sha256, respuesta: { contenido, autor, intercambio } });
}

/**
 * Análisis de FORMA de una respuesta (común al intercambio manual y al adaptador automático): extrae el JSON, rechaza
 * campos desconocidos, comprueba formato, rol, encargo y huella, y deja vacías las listas opcionales ausentes.
 * No decide nada sobre el contenido: eso es del contrato, de lab-V y de una persona.
 * @returns {{ok, errores, avisos, truncada?, contenido?, modelo_en_respuesta?}}
 */
export function analizarRespuesta(texto, { encargo, encargo_sha256 }) {
  const errores = [], avisos = [];
  const fin = (extra = {}) => ({ ok: errores.length === 0, errores, avisos, ...extra });
  const j = extraerJSON(texto);
  if (!j.ok) { errores.push(j.motivo); return fin({ truncada: j.truncada === true }); }
  if (j.texto_fuera) avisos.push("Había texto fuera del JSON: se ignoró (no forma parte del análisis), pero queda dentro de la huella de lo pegado.");
  const r = j.valor;
  if (!esObj(r)) { errores.push("La respuesta debe ser un objeto JSON («{ … }»)."); return fin(); }
  const desconocidas = Object.keys(r).filter((k) => !C_RESP.includes(k));
  if (desconocidas.length) errores.push(`Campos que el formato no conoce: ${desconocidas.slice(0, 8).join(", ")}. No se aceptan (p. ej. una respuesta no puede traer su propio estado ni su aprobación).`);
  if (r.formato !== FORMATO_RESPUESTA || r.version !== VERSION_RESPUESTA) errores.push(`Formato «${r.formato} ${r.version}» no reconocido: se espera «${FORMATO_RESPUESTA} ${VERSION_RESPUESTA}» (copia la solicitud entera, incluida su plantilla).`);
  if (r.rol !== encargo.rol) errores.push(`La respuesta dice ser del rol «${r.rol}» y se espera la del ${ETIQUETA_ROL[encargo.rol]}: ¿pegaste la de otro rol?`);
  if (r.encargo_id !== encargo.id) errores.push(`La respuesta es para el encargo «${String(r.encargo_id).slice(0, 80)}», no para «${encargo.id}»: probablemente pertenece a otro trabajo, otro rol u otra ronda.`);
  else if (r.encargo_sha256 !== encargo_sha256) errores.push("La huella del encargo de la respuesta no coincide con la de este encargo: se respondió a una versión distinta de la solicitud. Copia la solicitud actual otra vez.");
  for (const k of LISTAS) if (k in r && !Array.isArray(r[k])) errores.push(`«${k}» debe ser una lista.`);
  if (!("modelo_declarado" in r)) avisos.push("La respuesta no dice qué modelo la produjo (modelo_declarado).");
  const enRespuesta = typeof r.modelo_declarado === "string" && r.modelo_declarado.trim() && !/^nombre del modelo/i.test(r.modelo_declarado) ? r.modelo_declarado.trim().slice(0, 120) : null;
  if (errores.length) return fin();

  // Campos opcionales ausentes = listas vacías / null. Se avisa: no se inventa ningún contenido.
  const completados = [];
  const contenido = {};
  for (const k of LISTAS) { if (k in r) contenido[k] = r[k]; else { contenido[k] = []; completados.push(k); } }
  contenido.afirmaciones = contenido.afirmaciones.map((a) => {
    if (!esObj(a)) return a;
    const b = { ...a };
    if (!("citas" in b)) { b.citas = []; completados.push("citas"); }
    if (!("se_basa_en" in b)) { b.se_basa_en = []; completados.push("se_basa_en"); }
    b.citas = Array.isArray(b.citas) ? b.citas.map((c) => (esObj(c) && !("ubicacion" in c) ? { ...c, ubicacion: null } : c)) : b.citas;
    return b;
  });
  contenido.hipotesis = contenido.hipotesis.map((h) => (esObj(h) && !("alternativa_a" in h) ? (completados.push("alternativa_a"), { ...h, alternativa_a: null }) : h));
  if (completados.length) avisos.push(`Campos opcionales ausentes que se dejaron vacíos: ${[...new Set(completados)].join(", ")}.`);
  return fin({ contenido, modelo_en_respuesta: enRespuesta });
}

/**
 * Importa la respuesta del rol que espera y hace avanzar el trabajo (lab-V verifica; si todo sigue, el trabajo queda
 * esperando al rol siguiente o en revisión humana). Deja constancia de cada intento de importación en
 * `x.importaciones` (aceptados y rechazados), que viaja con el expediente exportado.
 */
export async function continuarConRespuesta(x, texto, { declarado_por, modelo = null, proveedor = null, metodo = "pegado", ahora = ahoraISO(), reloj, ya_importadas = new Map() }) {
  const encargo = encargoEnEspera(x);
  if (!encargo) return { ok: false, errores: ["Este trabajo no está esperando una respuesta manual."], avisos: [] };
  const sol = await solicitudManual(x);
  const r = await importarRespuesta(texto, { encargo, encargo_sha256: sol.encargo_sha256, solicitud_sha256: sol.solicitud_sha256, declarado_por, modelo, proveedor, metodo, ahora, ya_importadas });
  x.importaciones = [...L(x.importaciones), { en: ahora, rol: encargo.rol, encargo_id: encargo.id, respuesta_sha256: r.respuesta_sha256, aceptada: r.ok, errores: r.errores.slice(0, 10), avisos: r.avisos.slice(0, 10), declarado_por: String(declarado_por ?? "").slice(0, 80) }];
  if (!r.ok) return r;
  const antes = x.trabajo.estado;
  await avanzar(x, { adaptador: crearAdaptadorManual(new Map([[encargo.rol, r.respuesta]]), { modelo: r.respuesta.autor.modelo ?? "no declarado" }), reloj });
  return { ...r, estado_antes: antes, estado: x.trabajo.estado, verificacion: x.verificaciones.get(L(x.trabajo.pasos).find((p) => p.rol === encargo.rol)?.ejecuciones.at(-1)) ?? null };
}

/** Todas las huellas de respuestas ya aceptadas en estos expedientes (para detectar repeticiones y reutilizaciones). */
export function huellasImportadas(expedientes) {
  const m = new Map();
  for (const x of L(expedientes)) for (const i of L(x.importaciones)) if (i.aceptada && i.respuesta_sha256) m.set(i.respuesta_sha256, { trabajo_id: x.trabajo.id, encargo_id: i.encargo_id });
  return m;
}
