// Registro de Nexus (fase 1): lecciones y recomendaciones en dos archivos JSON que SOLO crecen.
// Cada entrada lleva `huella_anterior` (SHA-256 de la entrada previa): si alguien borra o edita una entrada
// del historial, la cadena se rompe y el registro lo dice. Nada aquí escribe en disco: las funciones devuelven
// un documento nuevo y quien llama (herramientas/nexus.mjs o la descarga del navegador) decide guardarlo.

import { huellaDe, ms } from "./comun.js";
import { validarLeccion, VERSION_LECCION } from "./leccion.js";
import { evaluarLeccion } from "./gerente.js";
import { plegarRecomendacion, validarEventoForma, CONTRATO_RECOMENDACION, VERSION_RECOMENDACION } from "./recomendacion.js";

export const REGISTRO_LECCIONES = "cauce.leccion.registro";
export const REGISTRO_RECOMENDACIONES = "cauce.recomendacion.registro";

export function registroVacio(tipo, { es_demo = false } = {}) {
  return tipo === "lecciones"
    ? { contrato: REGISTRO_LECCIONES, version_contrato: VERSION_LECCION, es_demo, versiones: [] }
    : { contrato: REGISTRO_RECOMENDACIONES, version_contrato: VERSION_RECOMENDACION, es_demo, eventos: [] };
}

/** Revisa que ninguna entrada se haya borrado, cambiado o reordenado. */
export async function verificarCadena(entradas) {
  const errores = [];
  let previa = null;
  for (let i = 0; i < entradas.length; i++) {
    const esperada = previa === null ? null : await huellaDe(previa);
    if ((entradas[i]?.huella_anterior ?? null) !== esperada)
      errores.push(`Entrada ${i + 1}: la huella no coincide con la entrada anterior (se borró, editó o reordenó el historial).`);
    previa = entradas[i];
  }
  return { ok: errores.length === 0, errores };
}

function forma(doc, tipo) {
  const campo = tipo === "lecciones" ? "versiones" : "eventos";
  const contrato = tipo === "lecciones" ? REGISTRO_LECCIONES : REGISTRO_RECOMENDACIONES;
  if (!doc || doc.contrato !== contrato || !Array.isArray(doc[campo])) return { errores: [`El registro de ${tipo} debe tener contrato "${contrato}" y la lista «${campo}».`], lista: [] };
  return { errores: [], lista: doc[campo] };
}

/**
 * Lee los dos registros y arma el estado de Nexus. Nunca lanza error: lo que esté mal queda en `errores`.
 * @returns { versiones, ultimas: Map(id → última versión válida), historial: Map(id → versiones), recomendaciones: [...], errores, avisos, es_demo }
 */
export async function leerNexus({ lecciones, recomendaciones }) {
  const errores = [];
  const avisos = [];
  const fl = forma(lecciones, "lecciones");
  const fr = forma(recomendaciones ?? registroVacio("recomendaciones"), "recomendaciones");
  errores.push(...fl.errores, ...fr.errores);
  for (const [t, f] of [["lecciones", fl], ["recomendaciones", fr]]) {
    const c = await verificarCadena(f.lista);
    errores.push(...c.errores.map((x) => `Registro de ${t}: ${x}`));
  }
  const historial = new Map();
  const ultimas = new Map();
  for (const v of fl.lista) {
    const r = validarLeccion(v);
    if (r.errores.length) { errores.push(`Lección ${v?.id ?? "?"} rev. ${v?.revision ?? "?"}: ${r.errores.join(" ")}`); continue; }
    const previas = historial.get(v.id) ?? [];
    if (v.revision !== previas.length + 1) { errores.push(`Lección ${v.id}: revisión ${v.revision} fuera de orden (se esperaba ${previas.length + 1}).`); continue; }
    previas.push(v);
    historial.set(v.id, previas);
    ultimas.set(v.id, v);
  }
  const porRec = new Map();
  for (const ev of fr.lista) { const k = ev?.id ?? "?"; porRec.set(k, [...(porRec.get(k) ?? []), ev]); }
  const recs = [...porRec.values()].map((evs) => plegarRecomendacion(evs, { evaluarLeccionCitada: evaluarCitadaEnSuMomento(ultimas, historial, evs) }));
  for (const r of recs) errores.push(...r.errores.map((x) => `Recomendación ${r.id}: ${x}`));
  const es_demo = lecciones?.es_demo === true || recomendaciones?.es_demo === true;
  return { versiones: fl.lista, ultimas, historial, recomendaciones: recs, errores, avisos, es_demo };
}

/** Para validar una aprobación: la lección citada debe ser la vigente y el gerente no debe tener objeciones ni pendientes. */
function citador(ultimas, ahoraMs) {
  return (id, revision) => {
    const ult = ultimas.get(id);
    if (!ult) return { estado: "desconocida", motivo: "no está en el registro" };
    if (ult.revision !== revision) return { estado: "desactualizada", motivo: `la vigente es la revisión ${ult.revision}` };
    const d = evaluarLeccion(ult, { ahora: ahoraMs, lecciones: ultimas }).dictamen;
    return { estado: d.estado, motivo: d.estado === "sin_objeciones" ? "" : `reglas ${[...d.no_cumple, ...d.no_evaluado].join(", ")}` };
  };
}

/** Una aprobación del pasado se juzga con la información que había en SU fecha (las revisiones de lecciones de entonces). */
function evaluarCitadaEnSuMomento(ultimas, historial, eventos) {
  return (id, revision) => {
    const aprob = [...eventos].reverse().find((e) => e.tipo === "aprobacion");
    const cuando = ms(aprob?.en) ?? Date.now();
    const deEntonces = new Map();
    for (const [k, vs] of historial) {
      const v = vs.filter((x) => (ms(x.registrado_en) ?? 0) <= cuando).at(-1);
      if (v) deEntonces.set(k, v);
    }
    return citador(deEntonces, cuando)(id, revision);
  };
}

/** Agrega una versión de lección. Devuelve { ok, doc, errores }; con errores el documento NO cambia. */
export async function agregarLeccion(doc, version) {
  const f = forma(doc, "lecciones");
  if (f.errores.length) return { ok: false, doc, errores: f.errores };
  const cadena = await verificarCadena(f.lista);
  if (!cadena.ok) return { ok: false, doc, errores: ["El registro ya está alterado; no se agrega nada.", ...cadena.errores] };
  const limpia = { ...version };
  delete limpia.huella_anterior;
  const { errores } = validarLeccion(limpia);
  if (errores.length) return { ok: false, doc, errores };
  if (limpia.es_demo !== (doc.es_demo === true)) return { ok: false, doc, errores: [doc.es_demo ? "Este registro es de prueba: la lección debe llevar es_demo: true." : "Este registro es real: no admite lecciones de prueba (es_demo: true)."] };
  const previas = f.lista.filter((v) => v.id === limpia.id);
  if (limpia.revision !== previas.length + 1) return { ok: false, doc, errores: [previas.length ? `La lección ${limpia.id} va en la revisión ${previas.length}; la siguiente debe ser ${previas.length + 1}.` : `La lección ${limpia.id} no existe: debe empezar en la revisión 1.`] };
  if (previas.length && previas.at(-1).tipo_cambio === "retiro") return { ok: false, doc, errores: [`La lección ${limpia.id} fue retirada; registre una lección nueva.`] };
  const ultima = previas.at(-1);
  if (ultima && ms(limpia.registrado_en) < ms(ultima.registrado_en)) return { ok: false, doc, errores: ["La revisión nueva tiene fecha anterior a la previa."] };
  limpia.huella_anterior = f.lista.length ? await huellaDe(f.lista.at(-1)) : null;
  return { ok: true, doc: { ...doc, versiones: [...f.lista, limpia] }, errores: [] };
}

/** Agrega un evento de recomendación, comprobando la historia completa y las reglas de aprobación. */
export async function agregarEvento(docRec, evento, docLecciones) {
  const f = forma(docRec, "recomendaciones");
  if (f.errores.length) return { ok: false, doc: docRec, errores: f.errores };
  const cadena = await verificarCadena(f.lista);
  if (!cadena.ok) return { ok: false, doc: docRec, errores: ["El registro ya está alterado; no se agrega nada.", ...cadena.errores] };
  const limpio = { ...evento };
  delete limpio.huella_anterior;
  const fe = validarEventoForma(limpio).errores;
  if (fe.length) return { ok: false, doc: docRec, errores: fe };
  if (limpio.es_demo !== (docRec.es_demo === true)) return { ok: false, doc: docRec, errores: ["es_demo del evento no coincide con el del registro."] };
  const nx = await leerNexus({ lecciones: docLecciones, recomendaciones: { ...docRec, eventos: [] } });
  const previos = f.lista.filter((x) => x.id === limpio.id);
  const r = plegarRecomendacion([...previos, limpio], { evaluarLeccionCitada: citador(nx.ultimas, ms(limpio.en) ?? Date.now()) });
  const nuevo = r.errores.find((x) => x.startsWith(`Evento ${limpio.secuencia} `));
  if (nuevo || r.historial.at(-1) !== limpio) return { ok: false, doc: docRec, errores: [nuevo ?? "El evento no se pudo aplicar.", ...r.errores.filter((x) => x !== nuevo)] };
  limpio.huella_anterior = f.lista.length ? await huellaDe(f.lista.at(-1)) : null;
  return { ok: true, doc: { ...docRec, eventos: [...f.lista, limpio] }, errores: [] };
}

/** Revisión automática del gerente para una recomendación: el peor dictamen de sus lecciones citadas. */
export function revisionDelGerente(nexus, recomendacion, { en, secuencia, es_demo }) {
  const orden = ["sin_objeciones", "incompleto", "con_objeciones"];
  let peor = "sin_objeciones";
  const detalle = [];
  for (const c of recomendacion.contenido?.lecciones ?? []) {
    const r = citador(nexus.ultimas, ms(en) ?? Date.now())(c.id, c.revision);
    const estado = orden.includes(r.estado) ? r.estado : "incompleto";
    if (orden.indexOf(estado) > orden.indexOf(peor)) peor = estado;
    detalle.push(`${c.id} rev. ${c.revision}: ${r.estado}${r.motivo ? ` (${r.motivo})` : ""}`);
  }
  return { contrato: CONTRATO_RECOMENDACION, version_contrato: VERSION_RECOMENDACION, id: recomendacion.id, secuencia, tipo: "revision", en,
    por: { tipo: "proceso", id: "gerente-esceptico" }, dictamen: peor, nota: detalle.join("; "), es_demo };
}

/** Consulta de lecciones vigentes (la última versión de cada una). */
export function consultarLecciones(nexus, { proyecto = null, nivel = null, texto: buscar = "", incluirRetiradas = false } = {}) {
  const q = buscar.trim().toLowerCase();
  return [...nexus.ultimas.values()].filter((l) =>
    (incluirRetiradas || l.tipo_cambio !== "retiro")
    && (!proyecto || l.proyecto_origen === proyecto || l.proyectos_destino.includes(proyecto))
    && (!nivel || l.nivel_validacion === nivel)
    && (!q || `${l.titulo} ${l.enunciado}`.toLowerCase().includes(q)));
}

/** Modelo para la oficina Nexus: todo lo que se muestra sale de aquí (la vista no decide nada). */
export function resumirNexus(nexus, { ahora = Date.now() } = {}) {
  const ahoraMs = ahora instanceof Date ? ahora.getTime() : ahora;
  const lecciones = consultarLecciones(nexus, { incluirRetiradas: true }).map((l) => ({
    leccion: l, revisiones: nexus.historial.get(l.id)?.length ?? 1, evaluacion: evaluarLeccion(l, { ahora: ahoraMs, lecciones: nexus.ultimas }), retirada: l.tipo_cambio === "retiro",
  }));
  const alertas = lecciones.filter((x) => !x.retirada && x.evaluacion.dictamen.estado === "con_objeciones")
    .flatMap((x) => x.evaluacion.reglas.filter((r) => r.resultado === "no_cumple").map((r) => ({ leccion_id: x.leccion.id, titulo: x.leccion.titulo, regla: r })));
  const cita = citador(nexus.ultimas, ahoraMs);
  const recomendaciones = nexus.recomendaciones.map((r) => {
    const bloqueos = [];
    if (r.etapa === "en_revision") {
      const rev = [...r.historial].reverse().find((e) => e.tipo === "revision");
      if (rev?.dictamen !== "sin_objeciones") bloqueos.push(`La última revisión dice «${rev?.dictamen ?? "?"}».`);
      for (const c of r.contenido?.lecciones ?? []) { const x = cita(c.id, c.revision); if (x.estado !== "sin_objeciones") bloqueos.push(`${c.id} rev. ${c.revision}: ${x.estado}${x.motivo ? ` (${x.motivo})` : ""}.`); }
    }
    return { ...r, bloqueos, espera_aprobacion: r.etapa === "en_revision" };
  });
  const cuenta = (f) => lecciones.filter((x) => !x.retirada && f(x)).length;
  return {
    es_demo: nexus.es_demo,
    errores: nexus.errores,
    lecciones,
    recomendaciones,
    pendientes: recomendaciones.filter((r) => r.espera_aprobacion),
    alertas,
    cifras: {
      lecciones: cuenta(() => true),
      sin_objeciones: cuenta((x) => x.evaluacion.dictamen.estado === "sin_objeciones"),
      incompletas: cuenta((x) => x.evaluacion.dictamen.estado === "incompleto"),
      con_objeciones: cuenta((x) => x.evaluacion.dictamen.estado === "con_objeciones"),
      pendientes: recomendaciones.filter((r) => r.espera_aprobacion).length,
      aprobadas_sin_implementar: recomendaciones.filter((r) => ["aprobada", "en_experimento", "con_resultado", "adoptada"].includes(r.etapa)).length,
      desplegadas: recomendaciones.filter((r) => r.implementada).length,
    },
  };
}

