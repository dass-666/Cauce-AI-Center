// Laboratorio de IA · fase 3 · guardar y reanudar un expediente (trabajo + todos sus documentos) sin perder nada.
//
// Un trabajo con respuestas manuales puede durar horas (copiar, esperar a Claude, pegar). Para no perderlo al cerrar
// la pestaña, la vista lo guarda en el navegador y se puede exportar como archivo. Al reanudar NADA se cree a ciegas:
//   · la ficha se recalcula desde su texto y debe tener la huella registrada (si alguien la tocó, no se carga);
//   · cada documento se valida con su contrato y debe ser del mismo trabajo y del mismo mundo DEMO/REAL;
//   · cada versión del trabajo debe extender a la anterior (historial solo-anexado) y el historial se reproduce;
//   · el informe debe ser el que el trabajo cita, con su huella;
//   · (auditoría) las huellas se cruzan entre documentos: cada ejecución fija su encargo, cada verificación se
//     RECALCULA con lab-V sobre la ejecución y el encargo guardados y debe salir idéntica, cada paso del trabajo
//     cita documentos que existen y coinciden, cada importación aceptada corresponde a una ejecución importada, y
//     los hechos, el origen y la vigencia de la ficha deben cuadrar con su texto y con el trabajo.
// Si algo no cuadra, el expediente no se carga y se dice por qué (el archivo guardado no se borra).

import { L, esObj, sha256, jsonCanonico, esHuella, ROLES } from "./base.js";
import { validarEncargo, validarEjecucion, validarVerificacion } from "./contratos.js";
import { validarTrabajo, extiendeA, transitar, COORDINADOR } from "./trabajo.js";
import { validarInforme } from "./informe.js";
import { huellaDoc, verificar } from "./verificador.js";
import { nuevoExpediente, avanzar, relojDesde } from "./coordinador.js";
import { crearAdaptadorManual } from "./adaptadores.js";

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
  const cruce = await cruzarHuellas(x, docs, o);
  if (cruce.length) return { ok: false, errores: cruce.slice(0, 12) };
  // (auditoría) «en_analisis» es un estado transitorio del Coordinador: un guardado que quedó ahí (cierre a mitad del
  // análisis o archivo recortado) no tendría salida. Se devuelve a pendiente con constancia en el historial; nada se
  // pierde (los pasos ya verificados se conservan y se reutilizan).
  if (x.trabajo.estado === "en_analisis") {
    const en = new Date(Math.max(Date.now(), Date.parse(x.trabajo.historial.at(-1).en) + 1000)).toISOString().replace(/\.\d{3}Z$/, "Z");
    x.trabajo = transitar(x.trabajo, "pendiente", { por: COORDINADOR, motivo: "Reanudación: el guardado quedó a mitad del análisis; vuelve a pendiente para poder continuar.", en });
    x.documentos.push({ tipo: "trabajo", documento: x.trabajo });
    // Un trabajo manual vuelve a ESPERAR la respuesta del rol que toque (los pasos verificados se reutilizan).
    if (x.trabajo.adaptador.id === "manual-claude") await avanzar(x, { adaptador: crearAdaptadorManual(new Map()), reloj: relojDesde(en) });
  }
  x.importaciones = L(o.importaciones).filter((i) => esObj(i)).slice(0, 200);
  return { ok: true, errores: [], expediente: x };
}

const C_IMPORTACION = ["en", "rol", "encargo_id", "respuesta_sha256", "aceptada", "errores", "avisos", "declarado_por", "fallos", "correcciones"];

/**
 * Cruce de huellas entre los documentos guardados. Ningún documento se cree solo porque cumple su contrato: se
 * comprueba que los demás lo fijen. Devuelve la lista de errores (vacía si todo cuadra).
 */
async function cruzarHuellas(x, docs, o) {
  const err = [];
  const t = x.trabajo, f = x.ficha;
  // Ficha: hechos ↔ texto, origen ↔ trabajo, vigencia ↔ lectura.
  const textoDeHechos = `${L(f.hechos).map((h) => h?.linea).join("\n")}\n`;
  if (!L(f.hechos).length || textoDeHechos !== f.copia.texto) err.push("ficha.hechos no reproducen el texto de la ficha: se modificaron después de guardarse.");
  const lectura = L(f.hechos).find((h) => h?.tipo === "lectura");
  if (!lectura || lectura.generado_en !== t.origen.generado_en || !String(lectura.linea).includes(`generada el ${lectura.generado_en} con vigencia de ${lectura.vigencia_segundos} segundos`)) err.push("ficha.hechos: la lectura no coincide con el origen del trabajo.");
  if (!esObj(f.origen) || jsonCanonico(f.origen) !== jsonCanonico(t.origen)) err.push("ficha.origen no es el origen que declara el trabajo.");
  if (f.vigencia !== null) {
    const v = f.vigencia, ref = Date.parse(v?.referencia), gen = Date.parse(lectura?.generado_en);
    const bien = esObj(v) && v.vigencia_segundos === lectura?.vigencia_segundos && (v.vencida === null
      ? v.edad_segundos === null
      : Number.isFinite(ref) && Number.isFinite(gen) && v.edad_segundos === Math.round((ref - gen) / 1000) && v.vencida === (v.edad_segundos > v.vigencia_segundos)
        && (v.referencia_es !== "leido_en" || v.referencia === t.origen.leido_en));
    if (!bien) err.push("ficha.vigencia no se deduce de la lectura guardada: se modificó.");
  }
  // Documentos, en orden, con el registro tal como estaba cuando se produjo cada uno.
  const registro = { encargos: new Map(), ejecuciones: new Map(), verificaciones: new Map() };
  const porId = new Map();
  for (const [i, d] of docs.entries()) {
    const doc = d.documento, r = `documentos[${i}] (${d.tipo})`;
    if (d.tipo === "encargo") {
      if (!String(doc.pregunta).startsWith(`${t.pregunta}\n\nRol `)) err.push(`${r}: la pregunta del encargo no es la del trabajo.`);
      const fp = L(doc.fuentes_permitidas)[0], ins = L(doc.insumos).find((z) => z.tipo === "copia_fuente");
      if (!fp || fp.fuente_id !== f.fuente.fuente_id || fp.sha256 !== f.fuente.sha256 || !ins || ins.ref !== f.fuente.fuente_id || ins.sha256 !== f.fuente.sha256) err.push(`${r}: la fuente permitida no es la ficha guardada (o su huella cambió).`);
      for (const z of L(doc.insumos)) if (z.tipo === "lab_ejecucion_verificada" && (!registro.ejecuciones.has(z.ref) || (await huellaDoc(registro.ejecuciones.get(z.ref))) !== z.sha256)) err.push(`${r}: el insumo ${z.ref} no es una ejecución guardada con esa huella.`);
      registro.encargos.set(doc.id, doc);
    } else if (d.tipo === "ejecucion") {
      const enc = registro.encargos.get(doc.encargo_id);
      if (!enc) err.push(`${r}: cita un encargo que no está guardado antes (${doc.encargo_id}).`);
      else if ((await huellaDoc(enc)) !== doc.encargo_sha256) err.push(`${r}: la huella del encargo no coincide: el encargo o la ejecución cambiaron después de guardarse.`);
      registro.ejecuciones.set(doc.id, doc);
    } else if (d.tipo === "verificacion") {
      const ej = registro.ejecuciones.get(doc.ejecucion_id), enc = registro.encargos.get(doc.encargo_id);
      if (!ej || !enc) { err.push(`${r}: cita una ejecución o un encargo que no están guardados antes.`); continue; }
      let otra = null;
      try { otra = (await verificar({ encargo: enc, ejecucion: ej, copias: new Map([[f.fuente.fuente_id, f.copia]]), registro, ahora: doc.verificado_en })).verificacion; } catch (e) { err.push(`${r}: no se pudo recalcular con lab-V (${String(e?.message ?? e).slice(0, 120)}).`); continue; }
      if (jsonCanonico(otra) !== jsonCanonico(doc)) err.push(`${r}: lab-V no reproduce esta verificación con la ejecución y el encargo guardados: alguno de los tres se modificó.`);
      registro.verificaciones.set(doc.ejecucion_id, doc);
      porId.set(doc.id, doc);
    }
  }
  // Pasos del trabajo ↔ documentos.
  for (const [i, p] of L(t.pasos).entries()) {
    const r = `pasos[${i}]`;
    if (!registro.encargos.has(p.encargo_id)) err.push(`${r}: cita un encargo que no está guardado.`);
    for (const id of p.ejecuciones) if (registro.ejecuciones.get(id)?.encargo_id !== p.encargo_id) err.push(`${r}: la ejecución ${id} no es de su encargo.`);
    if (p.verificacion_id !== null) {
      const v = porId.get(p.verificacion_id);
      if (!v || v.ejecucion_id !== p.ejecuciones.at(-1) || v.resultado !== p.resultado_verificacion) err.push(`${r}: la verificación que cita no existe, no es de su última ejecución o su resultado cambió.`);
    } else if (p.resultado_verificacion !== null) err.push(`${r}: resultado sin verificación.`);
  }
  // Importaciones: estructura y, si fueron aceptadas, la ejecución importada con esa huella.
  const huellasImportadas = new Set([...registro.ejecuciones.values()].map((ej) => ej?.intercambio?.respuesta_sha256).filter(Boolean));
  for (const [i, im] of L(o.importaciones).entries()) {
    const r = `importaciones[${i}]`;
    if (!esObj(im) || Object.keys(im).some((k) => !C_IMPORTACION.includes(k)) || !ROLES.includes(im.rol) || typeof im.aceptada !== "boolean" || !Array.isArray(im.errores) || !Array.isArray(im.avisos) || typeof im.declarado_por !== "string") { err.push(`${r}: estructura desconocida.`); continue; }
    if (!registro.encargos.has(im.encargo_id) || registro.encargos.get(im.encargo_id).rol !== im.rol) err.push(`${r}: cita un encargo que no está guardado o de otro rol.`);
    if (im.aceptada && !(esHuella(im.respuesta_sha256) && huellasImportadas.has(im.respuesta_sha256))) err.push(`${r}: se dice aceptada pero ninguna ejecución guardada trae esa respuesta.`);
  }
  return err;
}
