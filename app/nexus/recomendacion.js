// Contrato `cauce.recomendacion` 0.2 (PROVISIONAL; ver docs/NEXUS-FASE-1.md). Una recomendación es una cadena de
// EVENTOS que solo crece: propuesta → revisión → aprobación HUMANA → experimento → resultado → adopción → despliegue.
// «Aprobada» no es «implementada»: cada paso posterior necesita su propio evento con evidencia.
// En la fase 1 Nexus solo REGISTRA lo que hicieron personas fuera de Nexus: no ejecuta nada en ningún proyecto.

import { esFechaConZona, esActor, mismoActor, texto, buscarDatosPrivados, ms } from "./comun.js";

export const CONTRATO_RECOMENDACION = "cauce.recomendacion";
export const VERSION_RECOMENDACION = "0.2.0";
export const TIPOS_EVENTO = ["propuesta", "correccion", "revision", "aprobacion", "rechazo", "experimento", "resultado", "adopcion", "despliegue", "retiro"];

/** Etapa → eventos permitidos a continuación. */
export const TRANSICIONES = {
  propuesta: ["revision", "correccion", "rechazo", "retiro"],
  en_revision: ["revision", "correccion", "aprobacion", "rechazo", "retiro"],
  aprobada: ["experimento", "retiro"],
  en_experimento: ["resultado", "retiro"],
  con_resultado: ["adopcion", "experimento", "rechazo", "retiro"],
  adoptada: ["despliegue", "retiro"],
  desplegada: ["retiro"],
  rechazada: [],
  retirada: [],
};
const ETAPA_TRAS = {
  propuesta: "propuesta", correccion: "propuesta", revision: "en_revision", aprobacion: "aprobada", rechazo: "rechazada",
  experimento: "en_experimento", resultado: "con_resultado", adopcion: "adoptada", despliegue: "desplegada", retiro: "retirada",
};
export const ETIQUETA_ETAPA = {
  propuesta: "Propuesta (sin revisar)", en_revision: "En revisión", aprobada: "Aprobada por una persona · sin implementar",
  en_experimento: "En experimento", con_resultado: "Con resultado", adoptada: "Adoptada · sin desplegar",
  desplegada: "Desplegada (registrada por una persona)", rechazada: "Rechazada", retirada: "Retirada",
};
/** Pasos que solo puede dar una persona. */
const SOLO_HUMANO = ["aprobacion", "rechazo", "adopcion", "despliegue"];
const ID_REC = /^rec-[a-z0-9][a-z0-9-]{2,62}$/;
const CONCLUSIONES = ["mejora", "sin_efecto", "empeora", "inconcluso"];

/** Forma de UN evento (sin mirar la historia). */
export function validarEventoForma(ev) {
  const errores = [];
  const e = (t) => errores.push(t);
  if (!ev || typeof ev !== "object" || Array.isArray(ev)) return { errores: ["El evento debe ser un objeto JSON."] };
  if (ev.contrato !== CONTRATO_RECOMENDACION) e(`contrato debe ser "${CONTRATO_RECOMENDACION}".`);
  if (typeof ev.version_contrato !== "string" || !/^0\.2\.\d+$/.test(ev.version_contrato)) e("version_contrato debe ser 0.2.x.");
  if (typeof ev.id !== "string" || !ID_REC.test(ev.id)) e("id debe empezar con «rec-» y usar minúsculas, números o guiones.");
  if (!Number.isInteger(ev.secuencia) || ev.secuencia < 1) e("secuencia debe ser un entero desde 1.");
  if (!TIPOS_EVENTO.includes(ev.tipo)) e(`tipo debe ser uno de: ${TIPOS_EVENTO.join(", ")}.`);
  if (!esFechaConZona(ev.en)) e(`en «${ev.en}» debe ser fecha y hora con zona horaria.`);
  if (!esActor(ev.por)) e("por necesita {tipo: humano|ia|proceso, id}.");
  if (typeof ev.es_demo !== "boolean") e("es_demo es obligatorio.");
  if (ev.tipo === "propuesta" || ev.tipo === "correccion") {
    const c = ev.contenido;
    if (!c || typeof c !== "object") e("contenido es obligatorio en propuesta y corrección.");
    else {
      for (const k of ["titulo", "descripcion", "proyecto_destino", "criterio_exito"]) if (!texto(c[k])) e(`contenido.${k} es obligatorio.`);
      if (typeof c.reversible !== "boolean") e("contenido.reversible debe ser true o false.");
      if (!Array.isArray(c.lecciones) || !c.lecciones.length) e("contenido.lecciones: cita al menos una lección {id, revision}.");
      else c.lecciones.forEach((x, i) => { if (!texto(x?.id) || !Number.isInteger(x?.revision)) e(`contenido.lecciones[${i}] necesita id y revision.`); });
    }
  }
  if (ev.tipo === "correccion" && !texto(ev.nota)) e("Una corrección necesita nota con el motivo.");
  if (["rechazo", "retiro"].includes(ev.tipo) && !texto(ev.nota)) e(`${ev.tipo} necesita nota con el motivo.`);
  if (ev.tipo === "aprobacion" && !["experimento"].includes(ev.alcance)) e("aprobacion.alcance debe ser «experimento» (fase 1: se aprueba probar, no adoptar directamente).");
  if (ev.tipo === "experimento" && !texto(ev.plan)) e("experimento necesita plan (qué se prueba, dónde y cómo se mide).");
  if (ev.tipo === "resultado") {
    if (!CONCLUSIONES.includes(ev.conclusion)) e(`resultado.conclusion debe ser: ${CONCLUSIONES.join(", ")}.`);
    if (!Array.isArray(ev.evidencias) || !ev.evidencias.some((x) => x && x.tipo && x.tipo !== "afirmacion" && texto(x.referencia)))
      e("resultado necesita al menos una evidencia con referencia que no sea solo una afirmación.");
  }
  if (ev.tipo === "despliegue" && !texto(ev.referencia)) e("despliegue necesita referencia (ej. PR o commit del proyecto destino).");
  for (const p of buscarDatosPrivados(ev)) e(`Dato privado no permitido en ${p.ruta}: ${p.motivo}.`);
  return { errores };
}

/**
 * Reconstruye una recomendación a partir de sus eventos (en orden) y dice si cada evento era válido en su momento.
 * @param eventos   eventos de UNA recomendación
 * @param ctx       { evaluarLeccionCitada(id, revision) → { estado, motivo } } para la aprobación
 */
export function plegarRecomendacion(eventos, { evaluarLeccionCitada = () => ({ estado: "desconocida", motivo: "sin registro de lecciones" }) } = {}) {
  const r = { id: eventos[0]?.id ?? null, etapa: null, contenido: null, proponente: null, historial: [], errores: [], es_demo: eventos.every((x) => x.es_demo === true), implementada: false };
  let ultimaRevision = null;
  let ultimoResultado = null;
  for (const ev of eventos) {
    const motivo = rechazoDeEvento(ev, r, { ultimaRevision, ultimoResultado, evaluarLeccionCitada });
    if (motivo) { r.errores.push(`Evento ${ev.secuencia} (${ev.tipo}): ${motivo}`); continue; }
    if (ev.tipo === "propuesta") { r.contenido = ev.contenido; r.proponente = ev.por; }
    if (ev.tipo === "correccion") { r.contenido = ev.contenido; ultimaRevision = null; }
    if (ev.tipo === "revision") ultimaRevision = ev;
    if (ev.tipo === "resultado") ultimoResultado = ev;
    r.etapa = ETAPA_TRAS[ev.tipo];
    r.historial.push(ev);
  }
  r.implementada = r.etapa === "desplegada";
  r.etiqueta = ETIQUETA_ETAPA[r.etapa] ?? "Sin propuesta válida";
  return r;
}

function rechazoDeEvento(ev, r, { ultimaRevision, ultimoResultado, evaluarLeccionCitada }) {
  const forma = validarEventoForma(ev).errores;
  if (forma.length) return forma.join(" ");
  if (ev.secuencia !== r.historial.length + 1 + r.errores.length) return `secuencia ${ev.secuencia} fuera de orden.`;
  const anterior = r.historial.at(-1);
  if (anterior && ms(ev.en) < ms(anterior.en)) return "su fecha es anterior al evento previo.";
  if (r.etapa === null) return ev.tipo === "propuesta" ? null : "la primera acción debe ser una propuesta.";
  if (ev.tipo === "propuesta") return "ya existe la propuesta; use una corrección.";
  if (!TRANSICIONES[r.etapa].includes(ev.tipo)) return `no se puede pasar de «${r.etapa}» con «${ev.tipo}».`;
  if (SOLO_HUMANO.includes(ev.tipo) && ev.por.tipo !== "humano") return "solo una persona puede dar este paso.";
  if (ev.tipo === "aprobacion") {
    if (mismoActor(ev.por, r.proponente)) return "quien propone no puede aprobar su propia recomendación.";
    if (!ultimaRevision) return "falta una revisión posterior a la última corrección.";
    if (ultimaRevision.dictamen !== "sin_objeciones") return `la última revisión dice «${ultimaRevision.dictamen ?? "sin dictamen"}»; solo se aprueba sin objeciones.`;
    for (const c of r.contenido.lecciones) {
      const ev2 = evaluarLeccionCitada(c.id, c.revision);
      if (ev2.estado !== "sin_objeciones") return `la lección ${c.id} (rev. ${c.revision}) está «${ev2.estado}»: ${ev2.motivo}. Lo no evaluado nunca se aprueba.`;
    }
  }
  if (ev.tipo === "revision" && !["sin_objeciones", "con_objeciones", "incompleto"].includes(ev.dictamen)) return "revision.dictamen debe ser sin_objeciones, con_objeciones o incompleto.";
  if (ev.tipo === "revision" && ev.dictamen === "sin_objeciones" && mismoActor(ev.por, r.proponente)) return "quien propone no puede revisar sin objeciones su propia recomendación.";
  if (ev.tipo === "adopcion" && ultimoResultado?.conclusion !== "mejora") return "solo se adopta tras un resultado que muestre mejora.";
  return null;
}
