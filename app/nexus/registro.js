// Almacén propio de Nexus (fase 1): dos archivos JSON que SOLO crecen, uno de lecciones y otro de recomendaciones.
// Cada entrada es un sobre {registro, registrado_en, registrado_por, huella_anterior}: `registro` es el documento del
// contrato 0.2 tal cual (sin campos ajenos) y `huella_anterior` es el SHA-256 de la entrada previa del archivo. Borrar,
// editar o reordenar rompe la cadena y se detecta. Una versión nueva de una lección debe anexar revisiones; de una
// recomendación, anexar eventos al historial. Nada aquí escribe en disco: se devuelve el documento nuevo.

import { huellaDe, esFechaConZona, esActor } from "./comun.js";
import { validarLeccion, versionDe } from "./leccion.js";
import { evaluarLeccion } from "./gerente.js";
import { validarRecomendacion, validarPaso, evaluarRecomendacion, situacion } from "./recomendacion.js";

export const REGISTRO = { lecciones: "cauce.nexus.registro-lecciones", recomendaciones: "cauce.nexus.registro-recomendaciones" };

export function registroVacio(tipo, { es_demo = false } = {}) {
  return { contrato: REGISTRO[tipo], version_contrato: "0.2", es_demo, entradas: [] };
}

/** Revisa que ninguna entrada se haya borrado, cambiado o reordenado. */
export async function verificarCadena(entradas) {
  const errores = [];
  let previa = null;
  for (let i = 0; i < entradas.length; i++) {
    const esperada = previa === null ? null : await huellaDe(previa);
    if ((entradas[i]?.huella_anterior ?? null) !== esperada) errores.push(`Entrada ${i + 1}: la huella no coincide con la anterior (se borró, editó o reordenó el historial).`);
    previa = entradas[i];
  }
  return { ok: errores.length === 0, errores };
}

const lista = (doc, tipo) => (doc && doc.contrato === REGISTRO[tipo] && Array.isArray(doc.entradas) ? doc.entradas : null);

/** Lecciones vigentes en un instante (las registradas hasta entonces), para juzgar una decisión en su momento. */
function leccionesHasta(entradasLecciones, hastaMs = Infinity) {
  const m = new Map();
  for (const e of entradasLecciones) if (Date.parse(e.registrado_en) <= hastaMs && e.registro?.id) m.set(e.registro.id, e.registro);
  return m;
}

function revisarSobre(e, i) {
  const errores = [];
  if (!e || typeof e !== "object") return [`Entrada ${i + 1}: no es un objeto.`];
  for (const k of Object.keys(e)) if (!["registro", "registrado_en", "registrado_por", "huella_anterior"].includes(k)) errores.push(`Entrada ${i + 1}: clave desconocida ${k}.`);
  if (!esFechaConZona(e.registrado_en)) errores.push(`Entrada ${i + 1}: registrado_en «${e.registrado_en}» debe tener zona horaria (T17).`);
  if (!esActor(e.registrado_por)) errores.push(`Entrada ${i + 1}: registrado_por necesita {tipo: humano|codigo|ia, identificador}.`);
  return errores;
}

/**
 * Lee ambos registros. Nunca lanza: lo que esté mal va a `errores` y esa entrada no se usa.
 * @returns { ultimas: Map(id → lección), historial: Map(id → [versiones]), recomendaciones: [{registro, versiones, errores}], errores, es_demo }
 */
export async function leerNexus({ lecciones, recomendaciones }) {
  const errores = [];
  const eL = lista(lecciones, "lecciones");
  const eR = recomendaciones ? lista(recomendaciones, "recomendaciones") : [];
  if (!eL) errores.push(`El registro de lecciones debe tener contrato "${REGISTRO.lecciones}" y la lista «entradas».`);
  if (!eR) errores.push(`El registro de recomendaciones debe tener contrato "${REGISTRO.recomendaciones}" y la lista «entradas».`);
  for (const [t, ent] of [["lecciones", eL ?? []], ["recomendaciones", eR ?? []]]) errores.push(...(await verificarCadena(ent)).errores.map((x) => `Registro de ${t}: ${x}`));
  const historial = new Map(), ultimas = new Map(), validas = [];
  (eL ?? []).forEach((e, i) => {
    const err = [...revisarSobre(e, i), ...validarLeccion(e?.registro).errores];
    const previa = ultimas.get(e?.registro?.id);
    if (!err.length && previa) err.push(...pasoLeccion(previa, e.registro));
    if (err.length) { errores.push(`Lección ${e?.registro?.id ?? "?"} (entrada ${i + 1}): ${err.join(" ")}`); return; }
    historial.set(e.registro.id, [...(historial.get(e.registro.id) ?? []), e]);
    ultimas.set(e.registro.id, e.registro);
    validas.push(e);
  });
  const porId = new Map();
  (eR ?? []).forEach((e, i) => {
    const err = [...revisarSobre(e, i), ...validarRecomendacion(e?.registro).errores];
    const id = e?.registro?.id ?? "?";
    const previas = porId.get(id) ?? [];
    if (!err.length) err.push(...validarPaso(previas.at(-1)?.registro ?? null, e.registro, { lecciones: leccionesHasta(validas, Date.parse(e.registrado_en)), ahora: Date.parse(e.registrado_en) }));
    if (err.length) { errores.push(`Recomendación ${id} (entrada ${i + 1}): ${err.join(" ")}`); return; }
    porId.set(id, [...previas, e]);
  });
  const recs = [...porId.values()].map((v) => ({ registro: v.at(-1).registro, versiones: v }));
  return { ultimas, historial, recomendaciones: recs, errores, es_demo: lecciones?.es_demo === true || recomendaciones?.es_demo === true };
}

/** Una versión nueva de lección: mismo id, revisiones anexadas (las anteriores intactas), sin revivir una caducada/refutada. */
function pasoLeccion(previa, nueva) {
  const a = previa.revisiones ?? [], b = nueva.revisiones ?? [];
  const err = [];
  if (b.length <= a.length || JSON.stringify(b.slice(0, a.length)) !== JSON.stringify(a)) err.push("revisiones: solo se puede anexar; las anteriores no cambian y debe haber al menos una nueva.");
  if (b.length && a.length && Date.parse(b.at(-1).fecha) < Date.parse(a.at(-1).fecha)) err.push("La revisión nueva tiene fecha anterior a la previa.");
  if (versionDe(nueva) === versionDe(previa)) err.push(`La revisión nueva debe llevar otra «version» (la vigente es «${versionDe(previa)}»).`);
  return err;
}

async function agregar(doc, tipo, sobre, comprobar) {
  const ent = lista(doc, tipo);
  if (!ent) return { ok: false, doc, errores: [`No es un registro de ${tipo}.`] };
  const cadena = await verificarCadena(ent);
  if (!cadena.ok) return { ok: false, doc, errores: ["El registro ya está alterado; no se agrega nada.", ...cadena.errores] };
  const limpio = { registro: sobre.registro, registrado_en: sobre.registrado_en, registrado_por: sobre.registrado_por };
  const errores = [...revisarSobre(limpio, ent.length), ...(await comprobar(limpio, ent))];
  if (ent.length && Date.parse(limpio.registrado_en) < Date.parse(ent.at(-1).registrado_en)) errores.push("registrado_en es anterior a la última entrada del registro.");
  if (errores.length) return { ok: false, doc, errores };
  limpio.huella_anterior = ent.length ? await huellaDe(ent.at(-1)) : null;
  return { ok: true, doc: { ...doc, entradas: [...ent, limpio] }, errores: [] };
}

/** Agrega una versión de lección: {registro, registrado_en, registrado_por}. */
export function agregarLeccion(doc, sobre) {
  return agregar(doc, "lecciones", sobre, async (s, ent) => {
    const err = validarLeccion(s.registro).errores;
    if (err.length) return err;
    if (s.registro.id.startsWith("demo-") !== (doc.es_demo === true)) return [doc.es_demo ? "Registro de prueba: el id debe empezar con «demo-»." : "Registro real: un id «demo-…» no se admite."];
    const previa = [...ent].reverse().find((e) => e.registro?.id === s.registro.id)?.registro;
    return previa ? pasoLeccion(previa, s.registro) : [];
  });
}

/** Agrega una versión de recomendación, con sus reglas de paso (aprobación humana, bloqueos, T12). */
export function agregarRecomendacion(docRec, sobre, docLecciones) {
  return agregar(docRec, "recomendaciones", sobre, async (s, ent) => {
    const err = validarRecomendacion(s.registro).errores;
    if (err.length) return err;
    if (s.registro.id.startsWith("demo-") !== (docRec.es_demo === true)) return [docRec.es_demo ? "Registro de prueba: el id debe empezar con «demo-»." : "Registro real: un id «demo-…» no se admite."];
    const previa = [...ent].reverse().find((e) => e.registro?.id === s.registro.id)?.registro ?? null;
    const nx = await leerNexus({ lecciones: docLecciones, recomendaciones: null });
    return validarPaso(previa, s.registro, { lecciones: leccionesHasta([...nx.historial.values()].flat(), Date.parse(s.registrado_en)), ahora: Date.parse(s.registrado_en) });
  });
}

/** Consulta de lecciones vigentes. */
export function consultarLecciones(nexus, { proyecto = null, estado = null, texto: q = "" } = {}) {
  const b = q.trim().toLowerCase();
  return [...nexus.ultimas.values()].filter((l) =>
    (!proyecto || l.origen.proyecto === proyecto || l.aplicaciones_posibles.some((a) => a.proyecto === proyecto))
    && (!estado || l.validacion.estado === estado)
    && (!b || `${l.id} ${l.hallazgo}`.toLowerCase().includes(b)));
}

/** Modelo para la oficina Nexus: todo lo que se muestra sale de aquí. */
export function resumirNexus(nexus, { ahora = Date.now() } = {}) {
  const ahoraMs = ahora instanceof Date ? ahora.getTime() : ahora;
  const lecciones = consultarLecciones(nexus).map((l) => ({ leccion: l, versiones: nexus.historial.get(l.id)?.length ?? 1, evaluacion: evaluarLeccion(l, { ahora: ahoraMs, lecciones: nexus.ultimas }) }));
  const alertas = lecciones.flatMap((x) => x.evaluacion.reglas.filter((r) => r.estado === "no_cumple").map((r) => ({ leccion_id: x.leccion.id, regla: r })));
  const recomendaciones = nexus.recomendaciones.map(({ registro: r, versiones }) => {
    const ev = evaluarRecomendacion(r, { lecciones: nexus.ultimas, ahora: ahoraMs });
    return { registro: r, versiones: versiones.length, evaluacion: ev, situacion: situacion(r), espera_decision: r.estado === "pendiente_aprobacion" };
  });
  const cuenta = (f) => lecciones.filter(f).length;
  return {
    es_demo: nexus.es_demo, errores: nexus.errores, lecciones, recomendaciones, alertas,
    pendientes: recomendaciones.filter((r) => r.espera_decision),
    cifras: {
      lecciones: lecciones.length,
      sin_objeciones: cuenta((x) => x.evaluacion.dictamen.estado === "sin_objeciones"),
      incompletas: cuenta((x) => x.evaluacion.dictamen.estado === "incompleto"),
      con_objeciones: cuenta((x) => x.evaluacion.dictamen.estado === "con_objeciones"),
      pendientes: recomendaciones.filter((r) => r.espera_decision).length,
      aprobadas_sin_ejecutar: recomendaciones.filter((r) => r.registro.estado === "aprobada" && r.registro.ejecucion.estado === "no_iniciada").length,
      adoptadas: recomendaciones.filter((r) => r.registro.adopcion.estado !== "no_adoptada").length,
    },
  };
}


