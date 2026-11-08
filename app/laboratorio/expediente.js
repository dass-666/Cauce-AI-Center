// Laboratorio de IA · fase 3 · guardar y reanudar un expediente (trabajo + todos sus documentos) sin perder nada.
//
// Un trabajo con respuestas manuales puede durar horas (copiar, esperar a Claude, pegar). Para no perderlo al cerrar
// la pestaña, la vista lo guarda en el navegador y se puede exportar como archivo. Al reanudar NADA se cree a ciegas:
//   · la ficha se recalcula desde su texto y debe tener la huella registrada (si alguien la tocó, no se carga);
//   · cada documento se valida con su contrato y debe ser del mismo trabajo y del mismo mundo DEMO/REAL;
//   · cada versión del trabajo debe extender a la anterior (historial solo-anexado) y el historial se reproduce;
//   · el informe debe ser el que el trabajo cita, con su huella.
// Si algo no cuadra, el expediente no se carga y se dice por qué (el archivo guardado no se borra).

import { L, esObj, sha256 } from "./base.js";
import { validarEncargo, validarEjecucion, validarVerificacion } from "./contratos.js";
import { validarTrabajo, extiendeA } from "./trabajo.js";
import { validarInforme } from "./informe.js";
import { huellaDoc } from "./verificador.js";
import { nuevoExpediente } from "./coordinador.js";

export const FORMATO_EXPEDIENTE = "cauce.lab.expediente-local";
export const VERSION_EXPEDIENTE = "0.1";
const VALIDA = { trabajo: validarTrabajo, encargo: validarEncargo, ejecucion: validarEjecucion, verificacion: validarVerificacion, informe: validarInforme };

/** Expediente → objeto JSON (para guardar en el navegador o descargar). */
export function exportarExpediente(x, { exportado_en = null } = {}) {
  return {
    formato: FORMATO_EXPEDIENTE, version: VERSION_EXPEDIENTE, exportado_en, trabajo_id: x.trabajo.id, es_demo: x.trabajo.es_demo,
    ficha: { fuente: x.ficha.fuente, texto: x.ficha.copia.texto, hechos: x.ficha.hechos, origen: x.ficha.origen ?? null, vigencia: x.ficha.vigencia ?? null },
    documentos: x.documentos, importaciones: L(x.importaciones),
  };
}

/**
 * Objeto exportado → expediente vivo, solo si todo cuadra.
 * @returns {Promise<{ok, errores, expediente?}>}
 */
export async function restaurarExpediente(o) {
  const errores = []; const e = (t) => errores.push(t);
  if (!esObj(o) || o.formato !== FORMATO_EXPEDIENTE || o.version !== VERSION_EXPEDIENTE) return { ok: false, errores: [`No es un expediente ${FORMATO_EXPEDIENTE} ${VERSION_EXPEDIENTE}.`] };
  if (!esObj(o.ficha) || typeof o.ficha.texto !== "string" || !esObj(o.ficha.fuente)) return { ok: false, errores: ["El expediente no trae su ficha."] };
  if ((await sha256(o.ficha.texto)) !== o.ficha.fuente.sha256) return { ok: false, errores: ["La ficha guardada no tiene la huella registrada: se modificó después de guardarse. No se carga."] };
  const docs = L(o.documentos);
  if (!docs.length || docs[0]?.tipo !== "trabajo") return { ok: false, errores: ["El expediente debe empezar con su trabajo."] };
  let trabajo = null;
  for (const [i, d] of docs.entries()) {
    const f = VALIDA[d?.tipo];
    if (!f) { e(`documentos[${i}]: tipo «${d?.tipo}» desconocido.`); continue; }
    const v = f(d.documento);
    if (!v.ok) { e(`documentos[${i}] (${d.tipo}): ${v.errores.slice(0, 2).join(" ")}`); continue; }
    if (d.documento.es_demo !== o.es_demo) e(`documentos[${i}]: mezcla DEMO/REAL.`);
    if (d.tipo === "trabajo") {
      if (d.documento.id !== o.trabajo_id) e(`documentos[${i}]: es de otro trabajo (${d.documento.id}).`);
      if (trabajo && !extiendeA(d.documento, trabajo)) e(`documentos[${i}]: esta versión del trabajo reescribe el historial anterior.`);
      trabajo = d.documento;
    }
  }
  if (trabajo && trabajo.origen.fuente_id !== o.ficha.fuente.fuente_id) e("El trabajo cita otra ficha.");
  if (errores.length) return { ok: false, errores: errores.slice(0, 12) };
  const ficha = { fuente: o.ficha.fuente, copia: { bytes: new TextEncoder().encode(o.ficha.texto), texto: o.ficha.texto }, hechos: L(o.ficha.hechos), origen: o.ficha.origen, vigencia: o.ficha.vigencia ?? null };
  const x = nuevoExpediente(docs[0].documento, ficha);
  x.documentos = [];
  for (const d of docs) {
    x.documentos.push(d);
    if (d.tipo === "encargo") x.encargos.set(d.documento.id, d.documento);
    if (d.tipo === "ejecucion") x.ejecuciones.set(d.documento.id, d.documento);
    if (d.tipo === "verificacion") x.verificaciones.set(d.documento.ejecucion_id, d.documento);
    if (d.tipo === "informe") x.informe = d.documento;
  }
  x.trabajo = trabajo;
  if (trabajo.informe) {
    if (!x.informe || x.informe.id !== trabajo.informe.id || (await huellaDoc(x.informe)) !== trabajo.informe.sha256) return { ok: false, errores: ["El informe guardado no es el que cita el trabajo (o su huella cambió)."] };
  } else x.informe = null;
  for (const p of L(trabajo.pasos)) for (const id of p.ejecuciones) if (!x.ejecuciones.has(id)) return { ok: false, errores: [`Falta la ejecución ${id} que cita el trabajo.`] };
  if (trabajo.espera?.encargo_id && !x.encargos.has(trabajo.espera.encargo_id)) return { ok: false, errores: ["Falta el encargo que el trabajo está esperando."] };
  x.importaciones = L(o.importaciones).filter((i) => esObj(i)).slice(0, 200);
  return { ok: true, errores: [], expediente: x };
}
