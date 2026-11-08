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

// ------------------------------------------------------------------ fase 3.1 · errores con código y categoría
/**
 * Categorías de un fallo de importación (para el diagnóstico y para que la persona sepa qué hacer):
 *   formato   → lo pegado no se pudo leer como JSON (truncado, roto, sin JSON);
 *   contrato  → el JSON se leyó pero no es la respuesta que se esperaba (campos, versión, rol, encargo, contrato 0.2);
 *   seguridad → tamaño, repetición, reutilización, caracteres invisibles o campos que intentan traer estado/aprobación;
 *   evidencia → (solo lab-V, después de importar) citas y respaldos.
 * «recuperable» = volver a pedir el texto o copiarlo bien suele bastar; NO significa que el sistema lo arregle solo.
 */
export const CATEGORIAS_FALLO = Object.freeze(["formato", "contrato", "seguridad", "evidencia"]);
const CLAVES_DE_ESTADO = /^(estado|aprobad[oa]|aprobacion|decision(_humana)?|revision_humana|verificad[oa]|resultado|autenticacion)$/i;
const detalle = (codigo, categoria, texto, extra = {}) => ({ codigo, categoria, texto, recuperable: extra.recuperable ?? false, ...(extra.fragmento ? { fragmento: extra.fragmento } : {}) });

/** Etiquetas en español de las correcciones de FORMA que el sistema aplica solas (nunca cambian el significado). */
export const ETIQUETA_CORRECCION = Object.freeze({
  bloque_elegido_entre_varios: "había varios bloques de código: se tomó el que trae el formato de respuesta",
  comas_finales_quitadas: "se quitaron comas sobrantes antes de «}» o «]»",
  comillas_tipograficas_convertidas: "todas las comillas eran tipográficas (“ ”): se convirtieron a comillas rectas",
  rol_normalizado: "el rol venía con mayúsculas o espacios: se normalizó",
  lista_nula_vaciada: "una lista venía como null: se dejó vacía",
  plantilla_sin_rellenar_quitada: "se quitaron entradas «…» que son marcadores de la plantilla, no contenido",
  prefijo_linea_quitado: "un extracto traía el prefijo [Ln] de la solicitud, que no forma parte de la ficha: se quitó",
  comillas_envolventes_quitadas: "un extracto venía entre comillas: se quitaron las comillas externas",
  ubicacion_convertida_a_texto: "una ubicación venía como número: se guardó como texto",
  alternativa_desenvuelta: "alternativa_a venía como lista de un elemento: se guardó ese id",
});
const PLACEHOLDER = /^[\s…<>.]*$|^<[^>]{0,80}>$/u;
const esPlaceholder = (v) => typeof v === "string" && (PLACEHOLDER.test(v) || /^(…|\.\.\.)$/.test(v.trim()));

/** Línea, columna y un fragmento corto alrededor del lugar donde JSON.parse se detuvo (para mostrar, no para guardar). */
export function ubicarErrorJSON(cuerpo, err) {
  const m = /position (\d+)/.exec(String(err?.message ?? ""));
  const pos = m ? Number(m[1]) : (/line (\d+) column (\d+)/.exec(String(err?.message ?? "")) ? null : null);
  if (pos === null || !Number.isFinite(pos)) return { posicion: null, linea: null, columna: null, fragmento: null };
  const antes = cuerpo.slice(0, pos);
  const linea = antes.split("\n").length, columna = pos - antes.lastIndexOf("\n");
  const fragmento = `${pos > 40 ? "…" : ""}${cuerpo.slice(Math.max(0, pos - 40), pos)}⟵AQUÍ⟶${cuerpo.slice(pos, pos + 40)}${pos + 40 < cuerpo.length ? "…" : ""}`.replace(/\s+/g, " ");
  return { posicion: pos, linea, columna, fragmento };
}

/** Quita comas antes de «}» o «]» fuera de cadenas (error típico de respuestas largas). No toca el contenido de las cadenas. */
function quitarComasFinales(t) {
  let salida = "", enCadena = false, escape = false, cambios = 0;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (enCadena) { salida += ch; if (escape) escape = false; else if (ch === "\\") escape = true; else if (ch === "\"") enCadena = false; continue; }
    if (ch === "\"") { enCadena = true; salida += ch; continue; }
    if (ch === ",") { const resto = t.slice(i + 1).match(/^\s*([}\]])/); if (resto) { cambios++; continue; } }
    salida += ch;
  }
  return { texto: salida, cambios };
}

/**
 * Saca el objeto JSON de lo pegado: dentro de ```json … ``` si lo hay (si hay varios bloques, el que trae el formato de
 * respuesta); si no, de la primera «{» a la última «}». Si el JSON no se lee, intenta SOLO reparaciones de forma que no
 * cambian el significado (comas finales; comillas tipográficas cuando TODAS lo son) y las declara en `correcciones`.
 * @returns {{ok, valor?, texto_fuera?, sin_cierre?, correcciones: string[], truncada?, motivo?, ubicacion?}}
 */
export function extraerJSON(texto) {
  const t = String(texto ?? "").replace(/^﻿/, "");
  const correcciones = [];
  const bloques = [...t.matchAll(/```(?:json|JSON)?[ \t]*\n?([\s\S]*?)```/g)];
  let cerco = bloques[0] ?? null;
  if (bloques.length > 1) {
    const conFormato = bloques.filter((b) => b[1].includes(FORMATO_RESPUESTA));
    cerco = conFormato.length ? conFormato.at(-1) : bloques.reduce((a, b) => (b[1].length > a[1].length ? b : a));
    correcciones.push("bloque_elegido_entre_varios");
  }
  let cuerpo, fuera = false, sinCierre = false;
  if (cerco) { cuerpo = cerco[1]; fuera = t.slice(0, cerco.index).trim() !== "" || t.slice(cerco.index + cerco[0].length).trim() !== ""; }
  else {
    const abre = t.search(/```(?:json|JSON)?/);
    const desde = abre >= 0 ? t.indexOf("{", abre) : t.indexOf("{");
    if (desde < 0) return { ok: false, correcciones, motivo: "No encontré ningún objeto JSON («{ … }») en lo que pegaste. Copia la respuesta completa de la conversación." };
    const hasta = t.lastIndexOf("}");
    cuerpo = hasta > desde ? t.slice(desde, hasta + 1) : t.slice(desde);
    fuera = t.slice(0, desde).replace(/```(?:json|JSON)?/, "").trim() !== "" || (hasta > desde && t.slice(hasta + 1).replace(/```/, "").trim() !== "");
    sinCierre = abre >= 0;
  }
  const intentar = (c) => { try { return { valor: JSON.parse(c) }; } catch (err) { return { err }; } };
  let r = intentar(cuerpo);
  if (r.err) {
    const q = quitarComasFinales(cuerpo);
    if (q.cambios && !intentar(q.texto).err) { cuerpo = q.texto; correcciones.push("comas_finales_quitadas"); r = intentar(cuerpo); }
  }
  if (r.err && !cuerpo.includes("\"") && /[“”„]/.test(cuerpo)) {
    const c2 = cuerpo.replace(/[“”„]/g, "\"");
    if (!intentar(c2).err) { cuerpo = c2; correcciones.push("comillas_tipograficas_convertidas"); r = intentar(cuerpo); }
  }
  if (!r.err) return { ok: true, valor: r.valor, texto_fuera: fuera, sin_cierre: sinCierre, correcciones };
  if (sinCierre) return { ok: false, correcciones, truncada: true, motivo: "La respuesta parece cortada: abre un bloque ```json que no se cierra y el JSON no termina. Pide a la conversación que la repita completa (o en partes más cortas)." };
  if (estaIncompleto(cuerpo)) return { ok: false, correcciones, truncada: true, motivo: "La respuesta parece cortada: el JSON no termina (faltan llaves o comillas de cierre). Pide a la conversación que la repita completa." };
  const u = ubicarErrorJSON(cuerpo, r.err);
  const donde = u.linea ? ` Falla en la línea ${u.linea}, columna ${u.columna} del JSON.` : "";
  return { ok: false, correcciones, ubicacion: u, motivo: `El JSON no es válido: ${String(r.err.message).replace(/ in JSON at position \d+.*$/, "").slice(0, 120)}.${donde} Solo se corrigen solos comas sobrantes y comillas tipográficas; lo demás, pídelo de nuevo bien formado (tu texto sigue en el cuadro).` };
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
 * @returns {Promise<{ok, errores, avisos, detalles, correcciones, respuesta_sha256, respuesta?: {contenido, autor, intercambio}}>}
 *   errores/avisos: textos para la persona · detalles: [{codigo, categoria, recuperable, texto, fragmento?}] (el
 *   fragmento es para mostrar en pantalla; no se guarda en el expediente) · correcciones: códigos de ETIQUETA_CORRECCION.
 */
export async function importarRespuesta(texto, { encargo, encargo_sha256, solicitud_sha256, declarado_por, modelo = null, proveedor = null, metodo = "pegado", ahora = ahoraISO(), ya_importadas = new Map() }) {
  const errores = [], avisos = [], detalles = [];
  const err = (codigo, categoria, t, extra) => { errores.push(t); detalles.push(detalle(codigo, categoria, t, extra)); };
  const fin = (extra = {}) => ({ ok: errores.length === 0, errores, avisos, detalles, correcciones: [], respuesta_sha256: null, ...extra });
  if (typeof texto !== "string" || !texto.trim()) { err("vacia", "formato", "No pegaste nada.", { recuperable: true }); return fin(); }
  if (texto.length > LIMITE_RESPUESTA) { err("demasiado_larga", "seguridad", `La respuesta tiene ${texto.length} caracteres y el límite es ${LIMITE_RESPUESTA}: no se revisa. Pide al modelo una respuesta más corta (menos afirmaciones por rol) o divide la consulta.`, { recuperable: true }); return fin(); }
  const quien = String(declarado_por ?? "").trim();
  if (!quien || quien.length > 80) err("sin_declarante", "contrato", "Escribe quién trae la respuesta (tu nombre, hasta 80 caracteres): queda como procedencia declarada.", { recuperable: true });
  if (!["pegado", "archivo"].includes(metodo)) err("metodo_invalido", "contrato", "metodo debe ser pegado | archivo.");
  const limpiar = (v) => { const s = String(v ?? "").trim(); return s ? s.slice(0, 120) : null; };
  const modeloP = limpiar(modelo), proveedorP = limpiar(proveedor);
  for (const [k, v] of [["modelo", modeloP], ["proveedor", proveedorP], ["quién la trae", quien]]) if (v && tieneInvisibles(v)) err("invisibles_en_formulario", "seguridad", `«${k}» contiene caracteres invisibles: escríbelo de nuevo a mano.`, { recuperable: true });
  const respuesta_sha256 = await sha256(texto);
  const previa = ya_importadas.get(respuesta_sha256);
  if (previa) {
    if (previa.encargo_id === encargo?.id) err("respuesta_repetida", "seguridad", `Esta misma respuesta ya se importó para este encargo (huella ${respuesta_sha256.slice(0, 12)}…): no se cuenta dos veces.`);
    else err("respuesta_reutilizada", "seguridad", `Esta respuesta ya se usó en ${previa.trabajo_id} (encargo ${previa.encargo_id}): una respuesta no se reutiliza en otro trabajo o rol.`);
    return fin({ respuesta_sha256 });
  }
  if (errores.length) return fin({ respuesta_sha256 });
  const an = analizarRespuesta(texto, { encargo, encargo_sha256 });
  errores.push(...an.errores); avisos.push(...an.avisos); detalles.push(...an.detalles);
  if (!an.ok) return fin({ respuesta_sha256, correcciones: an.correcciones, truncada: an.truncada === true });
  const { contenido, modelo_en_respuesta: enRespuesta, correcciones } = an;
  if (modeloP && enRespuesta && !modeloP.toLowerCase().includes(enRespuesta.toLowerCase()) && !enRespuesta.toLowerCase().includes(modeloP.toLowerCase())) avisos.push(`Procedencia contradictoria: tú declaras «${modeloP}» y la respuesta dice «${enRespuesta}». Se registra lo que declaras tú; ninguna de las dos está verificada.`);

  const modeloFinal = modeloP ?? enRespuesta;
  const autor = autorIA("ia_manual", { identificador: modeloFinal ?? "modelo-no-declarado", adaptador: "manual-claude", proveedor: proveedorP, modelo: modeloFinal });
  const intercambio = {
    formato: `${FORMATO_RESPUESTA} ${VERSION_RESPUESTA}`, declarado_por: { tipo: "humano", identificador: quien, autenticacion: "declarada" }, metodo,
    importado_en: ahora, respuesta_sha256, solicitud_sha256, modelo_en_respuesta: enRespuesta, avisos: avisos.slice(0, 20).map((t) => t.slice(0, 500)),
    ...(correcciones.length ? { correcciones: [...new Set(correcciones)] } : {}),
  };
  // Validación de contrato con un sobre provisional (el definitivo lo arma el Coordinador con sus ids y tiempos).
  const provisional = armarEjecucion({ id: encargo.id.replace("lab-enc-", "lab-run-") + "-i1", encargo, encargo_sha256, inicio: ahora, fin: ahora, autor, contenido, intercambio });
  const v = validarEjecucion(provisional);
  for (const t of v.errores) err("contrato_ejecucion", /desconocida/.test(t) && CLAVES_DE_ESTADO.test(t.split(":")[0].split(".").pop()) ? "seguridad" : "contrato", `La respuesta no cumple el contrato: ${t}`);
  if (errores.length) return fin({ respuesta_sha256, correcciones });
  return fin({ respuesta_sha256, correcciones, respuesta: { contenido, autor, intercambio } });
}

/**
 * Análisis de FORMA de una respuesta (común al intercambio manual y al adaptador automático): extrae el JSON, aplica
 * SOLO correcciones de forma que no cambian el significado (y las declara), rechaza campos desconocidos, comprueba
 * formato, rol, encargo y huella, y deja vacías las listas opcionales ausentes.
 * No decide nada sobre el contenido: eso es del contrato, de lab-V y de una persona. Nunca inventa contenido.
 * @returns {{ok, errores, avisos, detalles, correcciones, truncada?, contenido?, modelo_en_respuesta?}}
 */
export function analizarRespuesta(texto, { encargo, encargo_sha256 }) {
  const errores = [], avisos = [], detalles = [];
  const err = (codigo, categoria, t, extra) => { errores.push(t); detalles.push(detalle(codigo, categoria, t, extra)); };
  const j = extraerJSON(texto);
  const correcciones = [...j.correcciones];
  const fin = (extra = {}) => ({ ok: errores.length === 0, errores, avisos, detalles, correcciones, ...extra });
  if (!j.ok) { err(j.truncada ? "json_truncado" : "json_invalido", "formato", j.motivo, { recuperable: true, fragmento: j.ubicacion?.fragmento ?? null }); return fin({ truncada: j.truncada === true }); }
  if (j.texto_fuera) avisos.push("Había texto fuera del JSON: se ignoró (no forma parte del análisis), pero queda dentro de la huella de lo pegado.");
  const r = j.valor;
  if (!esObj(r)) { err("no_es_objeto", "formato", "La respuesta debe ser un objeto JSON («{ … }»).", { recuperable: true }); return fin(); }
  const desconocidas = Object.keys(r).filter((k) => !C_RESP.includes(k));
  if (desconocidas.length) {
    const deEstado = desconocidas.filter((k) => CLAVES_DE_ESTADO.test(k));
    err("campos_desconocidos", deEstado.length ? "seguridad" : "contrato", `Campos que el formato no conoce: ${desconocidas.slice(0, 8).join(", ")}. No se aceptan (p. ej. una respuesta no puede traer su propio estado ni su aprobación).`);
  }
  // Correcciones de forma en la cabecera (no cambian el significado).
  const rolN = typeof r.rol === "string" ? r.rol.trim().toLowerCase() : r.rol;
  if (rolN !== r.rol && ROLES.includes(rolN)) correcciones.push("rol_normalizado");
  const formato = typeof r.formato === "string" ? r.formato.trim() : r.formato, version = typeof r.version === "string" ? r.version.trim() : r.version;
  if (formato !== FORMATO_RESPUESTA || version !== VERSION_RESPUESTA) err("formato_desconocido", "contrato", `Formato «${r.formato} ${r.version}» no reconocido: se espera «${FORMATO_RESPUESTA} ${VERSION_RESPUESTA}» (copia la solicitud entera, incluida su plantilla).`, { recuperable: true });
  if (rolN !== encargo.rol) err("rol_distinto", "contrato", `La respuesta dice ser del rol «${r.rol}» y se espera la del ${ETIQUETA_ROL[encargo.rol]}: ¿pegaste la de otro rol?`, { recuperable: true });
  if (r.encargo_id !== encargo.id) err("encargo_distinto", "contrato", `La respuesta es para el encargo «${String(r.encargo_id).slice(0, 80)}», no para «${encargo.id}»: probablemente pertenece a otro trabajo, otro rol u otra ronda.`, { recuperable: true });
  else if (r.encargo_sha256 !== encargo_sha256) err("huella_encargo_distinta", "contrato", "La huella del encargo de la respuesta no coincide con la de este encargo: se respondió a una versión distinta de la solicitud. Copia la solicitud actual otra vez.", { recuperable: true });
  for (const k of LISTAS) if (k in r && r[k] !== null && !Array.isArray(r[k])) err("lista_invalida", "contrato", `«${k}» debe ser una lista.`);
  if (!("modelo_declarado" in r)) avisos.push("La respuesta no dice qué modelo la produjo (modelo_declarado).");
  const enRespuesta = typeof r.modelo_declarado === "string" && r.modelo_declarado.trim() && !/^nombre del modelo/i.test(r.modelo_declarado) ? r.modelo_declarado.trim().slice(0, 120) : null;
  if (errores.length) return fin();

  // Campos opcionales ausentes = listas vacías / null. Se avisa: no se inventa ningún contenido.
  const completados = [];
  const contenido = {};
  for (const k of LISTAS) {
    if (!(k in r)) { contenido[k] = []; completados.push(k); }
    else if (r[k] === null) { contenido[k] = []; correcciones.push("lista_nula_vaciada"); }
    else contenido[k] = r[k];
  }
  // Marcadores de la plantilla («…») en listas de texto: no son contenido; en entidades: la plantilla no se rellenó.
  for (const k of ["preguntas", "dudas", "limitaciones"]) {
    const sin = contenido[k].filter((v) => !esPlaceholder(v));
    if (sin.length !== contenido[k].length) { contenido[k] = sin; correcciones.push("plantilla_sin_rellenar_quitada"); }
  }
  const campoTexto = { afirmaciones: "texto", hipotesis: "enunciado", objeciones: "texto", recomendaciones: "texto", contradicciones: "texto" };
  for (const [k, campo] of Object.entries(campoTexto)) for (const [i, v] of contenido[k].entries()) if (esObj(v) && esPlaceholder(v[campo])) err("plantilla_sin_rellenar", "contrato", `${k}[${i}].${campo} es el marcador «…» de la plantilla: la respuesta no se rellenó. Si el rol no tiene nada que decir ahí, la lista debe ir vacía.`, { recuperable: true });
  if (errores.length) return fin();
  contenido.afirmaciones = contenido.afirmaciones.map((a) => {
    if (!esObj(a)) return a;
    const b = { ...a };
    if (!("citas" in b)) { b.citas = []; completados.push("citas"); }
    if (!("se_basa_en" in b)) { b.se_basa_en = []; completados.push("se_basa_en"); }
    if (b.citas === null) { b.citas = []; correcciones.push("lista_nula_vaciada"); }
    if (b.se_basa_en === null) { b.se_basa_en = []; correcciones.push("lista_nula_vaciada"); }
    b.citas = Array.isArray(b.citas) ? b.citas.map((c) => (esObj(c) ? limpiarCita(c, correcciones) : c)) : b.citas;
    return b;
  });
  contenido.hipotesis = contenido.hipotesis.map((h, i) => {
    if (!esObj(h)) return h;
    const b = { ...h };
    if (!("alternativa_a" in b)) { b.alternativa_a = null; completados.push("alternativa_a"); }
    // (auditoría) La solicitud habla de «enlazar alternativas» y el contrato pide UN id o null: una lista vacía es null y
    // una lista de un elemento es ese elemento (forma, no significado). Con varios, se pide elegir: no se descarta nada.
    if (Array.isArray(b.alternativa_a)) {
      if (b.alternativa_a.length === 0) { b.alternativa_a = null; correcciones.push("lista_nula_vaciada"); }
      else if (b.alternativa_a.length === 1) { b.alternativa_a = b.alternativa_a[0]; correcciones.push("alternativa_desenvuelta"); }
      else err("alternativa_multiple", "contrato", `hipotesis[${i}].alternativa_a trae ${b.alternativa_a.length} ids y el contrato admite uno (la hipótesis rival principal) o null: elige uno o reparte en varias hipótesis.`);
    }
    return b;
  });
  if (errores.length) return fin();
  if (completados.length) avisos.push(`Campos opcionales ausentes que se dejaron vacíos: ${[...new Set(completados)].join(", ")}.`);
  const unicas = [...new Set(correcciones)];
  if (unicas.length) avisos.push(`Correcciones de forma aplicadas (no cambian el significado y quedan registradas): ${unicas.map((c) => ETIQUETA_CORRECCION[c] ?? c).join("; ")}.`);
  correcciones.splice(0, correcciones.length, ...unicas);
  return fin({ contenido, modelo_en_respuesta: enRespuesta });
}

/** Cita tal cual la trajo el modelo → cita comparable: sin el prefijo [Ln] de la solicitud ni comillas externas. */
function limpiarCita(c, correcciones) {
  const d = { ...c };
  if (!("ubicacion" in d)) d.ubicacion = null;
  if (typeof d.ubicacion === "number") { d.ubicacion = String(d.ubicacion); correcciones.push("ubicacion_convertida_a_texto"); }
  if (typeof d.extracto === "string") {
    let e = d.extracto;
    // Primero las comillas que envuelven todo el extracto, después el prefijo [Ln] de la solicitud.
    const env = /^\s*(["“])(.+)(["”])\s*$/s.exec(e);
    if (env && env[2].trim()) { e = env[2]; correcciones.push("comillas_envolventes_quitadas"); }
    const m = /^\s*\[L\d+\]\s+/.exec(e);
    if (m) { e = e.slice(m[0].length); correcciones.push("prefijo_linea_quitado"); }
    d.extracto = e;
  }
  return d;
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
  x.importaciones = [...L(x.importaciones), { en: ahora, rol: encargo.rol, encargo_id: encargo.id, respuesta_sha256: r.respuesta_sha256, aceptada: r.ok, errores: r.errores.slice(0, 10), avisos: r.avisos.slice(0, 10), declarado_por: String(declarado_por ?? "").slice(0, 80),
    // fase 3.1: códigos y categorías (sin fragmentos del texto) para el diagnóstico; correcciones de forma aplicadas
    fallos: L(r.detalles).slice(0, 10).map((d) => ({ codigo: d.codigo, categoria: d.categoria, recuperable: d.recuperable })), correcciones: L(r.correcciones) }];
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
