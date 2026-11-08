// Laboratorio de IA · fase 2 · contrato `cauce.lab.trabajo` 0.1 y su máquina de estados.
//
// Un TRABAJO es una solicitud de análisis de una persona sobre lo que entregó un motor (solo lectura). El Coordinador
// (código, no IA) lo hace avanzar por Investigador → Analista → Abogado del Diablo, cada salida pasa por lab-V y el
// resultado queda para REVISIÓN HUMANA. Reglas que no se pueden saltar con datos:
//   · solo una persona aprueba o rechaza (por.tipo = "humano", con motivo); ni el código ni una IA pueden;
//   · solo se aprueba lo que llegó a «requiere_revision» con su informe; aprobar un informe no lo convierte en lección;
//   · el guion sin modelo (adaptador «sin-modelo») solo existe en DEMO: nunca se presenta como IA real;
//   · el origen es siempre de solo lectura y del mismo mundo DEMO/REAL que el trabajo;
//   · el historial es solo-anexado: cada versión nueva conserva intacto el historial anterior.

import { VERSION_LAB, ROLES, esObj, L, clavesExactas, esFechaConZona, texto, esHuella, buscarDatosPrivados, tieneInvisibles, LIMITES, tamanoDocumento, esIdLab } from "./base.js";
import { MOTORES } from "./motores.js";

export const CONTRATO_TRABAJO = "cauce.lab.trabajo";
export const ESTADOS_TRABAJO = ["pendiente", "en_analisis", "requiere_evidencia", "requiere_revision", "aprobado_por_humano", "rechazado", "error"];
export const ESTADOS_FINALES = ["aprobado_por_humano", "rechazado"];
export const ETIQUETA_ESTADO = Object.freeze({
  pendiente: "Pendiente", en_analisis: "En análisis", requiere_evidencia: "Requiere evidencia", requiere_revision: "Requiere revisión humana",
  aprobado_por_humano: "Aprobado por una persona", rechazado: "Rechazado", error: "Error",
});
/** Adaptadores de modelo que un trabajo puede pedir (ver adaptadores.js). «sin-modelo» = guion determinista, solo DEMO. */
export const ADAPTADORES_TRABAJO = ["sin-modelo", "manual-claude", "ollama", "automatico"];
export const COORDINADOR = Object.freeze({ tipo: "codigo", identificador: "lab-coordinador" });
export const MAX_INTENTOS = 3;

/**
 * Transiciones permitidas: de → { a: quién puede }. «codigo» = el Coordinador; «humano» = una persona declarada.
 * Nadie más (en particular, ninguna IA) aparece en esta tabla.
 */
export const TRANSICIONES = Object.freeze({
  pendiente: { en_analisis: ["codigo"], rechazado: ["humano"] },
  en_analisis: { requiere_evidencia: ["codigo"], requiere_revision: ["codigo"], error: ["codigo"], pendiente: ["codigo"] },
  requiere_evidencia: { pendiente: ["humano"], requiere_revision: ["humano"], rechazado: ["humano"] },
  requiere_revision: { aprobado_por_humano: ["humano"], rechazado: ["humano"], requiere_evidencia: ["humano"] },
  error: { pendiente: ["codigo", "humano"], rechazado: ["humano"] },
  aprobado_por_humano: {},
  rechazado: {},
});

const C_TRB = ["contrato", "version_contrato", "id", "es_demo", "titulo", "pregunta", "origen", "solicitado_por", "creado_en", "adaptador", "estado", "intentos", "pasos", "espera", "informe", "historial", "decision_humana"];
const C_ORIGEN = ["motor", "nombre", "contrato", "version", "modo", "es_demo", "generado_en", "leido_en", "sha256_documento", "ficha", "fuente_id"];
const C_PASO = ["rol", "encargo_id", "ejecuciones", "verificacion_id", "resultado_verificacion"];
const C_HIST = ["n", "de", "a", "en", "por", "motivo"];
const CUERPO = /^(?!.*\.\.)[a-z0-9][a-z0-9._-]{0,63}$/;
export const esIdTrabajo = (id, esDemo) => typeof id === "string" && id.startsWith(`${esDemo ? "demo-" : ""}lab-trb-`) && CUERPO.test(id.slice(`${esDemo ? "demo-" : ""}lab-trb-`.length)) && (esDemo || !id.startsWith("demo-"));
const esPor = (p) => esObj(p) && ["humano", "codigo"].includes(p.tipo) && texto(p.identificador) && p.identificador.length <= 80;

/** ¿Puede `por` llevar el trabajo de `de` a `a`? Devuelve null si sí, o el motivo si no. */
export function motivoTransicionInvalida(de, a, por) {
  if (!ESTADOS_TRABAJO.includes(a)) return `estado «${a}» inválido.`;
  const quienes = TRANSICIONES[de]?.[a];
  if (!quienes) return `transición ${de} → ${a} no permitida.`;
  if (!esPor(por)) return "por debe ser {tipo: humano | codigo, identificador}: una IA nunca cambia el estado de un trabajo.";
  if (!quienes.includes(por.tipo)) return `${de} → ${a} solo la puede hacer ${quienes.map((q) => (q === "humano" ? "una persona" : "el Coordinador (código)")).join(" o ")}.`;
  if (por.tipo === "codigo" && por.identificador !== COORDINADOR.identificador) return `el único código que mueve trabajos es ${COORDINADOR.identificador}.`;
  return null;
}

/**
 * Aplica una transición y devuelve una COPIA nueva del trabajo (el original no cambia). Lanza si no es válida.
 * Una decisión humana final exige motivo y deja constancia en decision_humana.
 */
export function transitar(trabajo, a, { por, motivo, en }) {
  const de = trabajo.estado;
  const malo = motivoTransicionInvalida(de, a, por);
  if (malo) throw new Error(`Trabajo ${trabajo.id}: ${malo}`);
  if (!esFechaConZona(en)) throw new Error("transitar: «en» debe ser instante con zona.");
  if (!texto(motivo)) throw new Error("transitar: el motivo es obligatorio (queda en el historial).");
  const previo = trabajo.historial.at(-1);
  if (previo && Date.parse(en) < Date.parse(previo.en)) throw new Error(`transitar: ${en} es anterior al último cambio (${previo.en}).`);
  if (por.tipo === "humano" && motivo.trim().length < 10) throw new Error("transitar: una decisión humana necesita un motivo de al menos 10 caracteres.");
  if (a === "aprobado_por_humano" && !trabajo.informe) throw new Error("transitar: no se aprueba un trabajo sin informe.");
  if (de === "error" && a === "pendiente" && trabajo.intentos.usados >= trabajo.intentos.maximo) throw new Error(`Trabajo ${trabajo.id}: se agotaron los ${trabajo.intentos.maximo} reintentos; solo queda que una persona lo rechace o cree otro trabajo.`);
  const t = structuredClone(trabajo);
  t.estado = a;
  if (de === "error" && a === "pendiente") t.intentos.usados += 1;
  // Nueva ronda: la persona aportó evidencia o pidió más. Lo anterior queda en el registro; el análisis empieza de cero.
  if (de === "requiere_evidencia" && a === "pendiente") { t.pasos = []; t.informe = null; }
  t.historial.push({ n: t.historial.length + 1, de, a, en, por: { tipo: por.tipo, identificador: por.identificador }, motivo: motivo.trim().slice(0, LIMITES.texto) });
  if (ESTADOS_FINALES.includes(a)) t.decision_humana = { decision: a === "aprobado_por_humano" ? "aprobado" : "rechazado", por: { tipo: "humano", identificador: por.identificador, autenticacion: "declarada" }, en, motivo: motivo.trim().slice(0, LIMITES.texto) };
  if (a !== "pendiente") t.espera = null;
  return t;
}

/** Ronda de análisis (1, 2, …): cuántas veces una persona devolvió el trabajo a pendiente con evidencia nueva, más uno. */
export const rondaDe = (trabajo) => 1 + L(trabajo?.historial).filter((h) => h.de === "requiere_evidencia" && h.a === "pendiente").length;

/** Trabajo nuevo, en «pendiente». Lo crea una persona; el historial empieza con su solicitud. */
export function nuevoTrabajo({ id, es_demo, titulo, pregunta, origen, solicitado_por, creado_en, adaptador, max_intentos = MAX_INTENTOS }) {
  return {
    contrato: CONTRATO_TRABAJO, version_contrato: VERSION_LAB, id, es_demo, titulo, pregunta, origen, solicitado_por, creado_en, adaptador,
    estado: "pendiente", intentos: { usados: 0, maximo: max_intentos }, pasos: [], espera: null, informe: null,
    historial: [{ n: 1, de: null, a: "pendiente", en: creado_en, por: { tipo: "humano", identificador: solicitado_por?.identificador }, motivo: "Solicitud de análisis creada por una persona." }],
    decision_humana: null,
  };
}

const resultado = (errores) => ({ ok: errores.length === 0, errores });

export function validarTrabajo(doc) {
  const errores = []; const e = (t) => errores.push(t);
  if (!clavesExactas(doc, C_TRB, "", e)) return resultado(errores);
  if (tamanoDocumento(doc) > LIMITES.bytes_documento) return resultado([`documento demasiado grande (límite ${LIMITES.bytes_documento}).`]);
  if (doc.contrato !== CONTRATO_TRABAJO) e(`contrato debe ser «${CONTRATO_TRABAJO}».`);
  if (doc.version_contrato !== VERSION_LAB) e(`version_contrato debe ser «${VERSION_LAB}».`);
  if (typeof doc.es_demo !== "boolean") e("es_demo debe ser true o false.");
  else if (!esIdTrabajo(doc.id, doc.es_demo)) e(`id «${doc.id}» inválido (${doc.es_demo ? "demo-" : ""}lab-trb-…).`);
  for (const k of ["titulo", "pregunta"]) {
    if (!texto(doc[k])) e(`${k} es obligatorio.`);
    else { if (doc[k].length > LIMITES.texto) e(`${k} supera ${LIMITES.texto} caracteres.`); if (tieneInvisibles(doc[k])) e(`${k} contiene caracteres invisibles.`); }
  }
  if (clavesExactas(doc.origen, C_ORIGEN, "origen.", e)) {
    const o = doc.origen;
    if (!MOTORES[o.motor]) e(`origen.motor «${o.motor}» sin integración (${Object.keys(MOTORES).join(" | ")}).`);
    if (o.modo !== "solo_lectura") e("origen.modo debe ser «solo_lectura»: el Laboratorio nunca escribe en un motor.");
    if (o.es_demo !== doc.es_demo) e(`mezcla DEMO/REAL: el origen es ${o.es_demo ? "DEMO" : "REAL"} y el trabajo ${doc.es_demo ? "DEMO" : "REAL"}.`);
    if (!esHuella(o.sha256_documento)) e("origen.sha256_documento debe fijar el documento leído con su huella.");
    if (!esFechaConZona(o.generado_en)) e("origen.generado_en debe ser instante con zona.");
    if (!esFechaConZona(o.leido_en)) e("origen.leido_en debe ser instante con zona.");
    if (typeof o.fuente_id !== "string" || (doc.es_demo === true) !== o.fuente_id.startsWith("demo-")) e("origen.fuente_id inválido o de otro mundo DEMO/REAL.");
  }
  if (clavesExactas(doc.solicitado_por, ["tipo", "identificador"], "solicitado_por.", e)) {
    if (doc.solicitado_por.tipo !== "humano") e("solicitado_por.tipo debe ser «humano»: una IA no se encarga trabajo a sí misma.");
    if (!texto(doc.solicitado_por.identificador)) e("solicitado_por.identificador es obligatorio.");
  }
  if (!esFechaConZona(doc.creado_en)) e("creado_en debe ser instante con zona.");
  if (clavesExactas(doc.adaptador, ["id", "modelo"], "adaptador.", e)) {
    if (!ADAPTADORES_TRABAJO.includes(doc.adaptador.id)) e(`adaptador.id debe ser ${ADAPTADORES_TRABAJO.join(" | ")}.`);
    if (doc.adaptador.id === "sin-modelo" && doc.es_demo !== true) e("adaptador «sin-modelo» solo en DEMO: un guion determinista nunca se presenta como análisis real.");
    if (!(doc.adaptador.modelo === null || texto(doc.adaptador.modelo))) e("adaptador.modelo debe ser texto o null.");
  }
  if (!ESTADOS_TRABAJO.includes(doc.estado)) e(`estado «${doc.estado}» inválido: ${ESTADOS_TRABAJO.join(" | ")}.`);
  if (clavesExactas(doc.intentos, ["usados", "maximo"], "intentos.", e)) {
    if (!Number.isInteger(doc.intentos.maximo) || doc.intentos.maximo < 1 || doc.intentos.maximo > 10) e("intentos.maximo debe ser entero entre 1 y 10.");
    if (!Number.isInteger(doc.intentos.usados) || doc.intentos.usados < 0 || doc.intentos.usados > doc.intentos.maximo) e("intentos.usados debe ser entero entre 0 y maximo.");
  }
  if (!Array.isArray(doc.pasos) || doc.pasos.length > ROLES.length) e(`pasos debe ser una lista de hasta ${ROLES.length}.`);
  L(doc.pasos).forEach((p, i) => {
    const r = `pasos[${i}].`;
    if (!clavesExactas(p, C_PASO, r, e)) return;
    if (p.rol !== ROLES[i]) e(`${r}rol debe ser «${ROLES[i]}» (orden fijo: ${ROLES.join(" → ")}).`);
    if (!esIdLab(p.encargo_id, "encargo", doc.es_demo === true)) e(`${r}encargo_id inválido o de otro mundo.`);
    if (!Array.isArray(p.ejecuciones) || p.ejecuciones.some((x) => !esIdLab(x, "ejecucion", doc.es_demo === true))) e(`${r}ejecuciones: lista de ids de ejecución del mismo mundo.`);
    if (!(p.verificacion_id === null || esIdLab(p.verificacion_id, "verificacion", doc.es_demo === true))) e(`${r}verificacion_id inválido.`);
    if (!(p.resultado_verificacion === null || ["apta_para_revision_humana", "con_fallas", "rechazada", "sin_salida"].includes(p.resultado_verificacion))) e(`${r}resultado_verificacion inválido.`);
  });
  if (!(doc.espera === null || (esObj(doc.espera) && ROLES.includes(doc.espera.rol) && texto(doc.espera.motivo) && Object.keys(doc.espera).every((k) => ["rol", "motivo", "encargo_id"].includes(k))))) e("espera debe ser null o {rol, motivo, encargo_id}.");
  if (!(doc.informe === null || (esObj(doc.informe) && typeof doc.informe.id === "string" && esHuella(doc.informe.sha256) && Object.keys(doc.informe).length === 2))) e("informe debe ser null o {id, sha256}.");

  // Historial: se reproduce desde el principio; el estado final debe coincidir y cada paso debe estar permitido.
  if (!Array.isArray(doc.historial) || !doc.historial.length) e("historial debe empezar con la solicitud.");
  else {
    let estado = null, antes = null;
    doc.historial.forEach((h, i) => {
      const r = `historial[${i}].`;
      if (!clavesExactas(h, C_HIST, r, e)) return;
      if (h.n !== i + 1) e(`${r}n debe ser ${i + 1}.`);
      if (!esFechaConZona(h.en)) e(`${r}en debe ser instante con zona.`);
      else { if (antes !== null && Date.parse(h.en) < antes) e(`${r}en es anterior al cambio previo.`); antes = Date.parse(h.en); }
      if (!texto(h.motivo)) e(`${r}motivo es obligatorio.`);
      if (i === 0) {
        if (h.de !== null || h.a !== "pendiente" || h.por?.tipo !== "humano") e(`${r}el historial empieza con la solicitud de una persona (null → pendiente).`);
      } else {
        if (h.de !== estado) e(`${r}de «${h.de}» no es el estado anterior «${estado}».`);
        const malo = motivoTransicionInvalida(h.de, h.a, h.por);
        if (malo) e(`${r}${malo}`);
      }
      estado = h.a;
    });
    const reintentos = doc.historial.filter((h) => h.de === "error" && h.a === "pendiente").length;
    if (esObj(doc.intentos) && reintentos !== doc.intentos.usados) e(`intentos.usados = ${doc.intentos.usados} no cuadra con el historial (${reintentos} reintento(s)).`);
    if (estado !== doc.estado) e(`estado «${doc.estado}» no coincide con el historial («${estado}»).`);
  }
  const fin = ESTADOS_FINALES.includes(doc.estado);
  if (fin) {
    const d = doc.decision_humana, ult = L(doc.historial).at(-1);
    if (esObj(d?.por) && d.por.autenticacion !== "declarada") e(`decision_humana.por.autenticacion «${d.por.autenticacion}»: no hay proveedor de identidad en este proyecto, así que una autenticación no puede declararse en los datos (solo «declarada»).`);
    if (!esObj(d) || d.por?.tipo !== "humano" || d.por?.autenticacion !== "declarada" || !texto(d.motivo) || d.decision !== (doc.estado === "aprobado_por_humano" ? "aprobado" : "rechazado") || d.en !== ult?.en || d.por?.identificador !== ult?.por?.identificador)
      e("decision_humana debe coincidir con la última transición: {decision, por: {tipo: humano, identificador, autenticacion: declarada}, en, motivo}.");
  } else if (doc.decision_humana !== null) e("decision_humana solo existe en aprobado_por_humano o rechazado.");
  if (doc.estado === "aprobado_por_humano" && !doc.informe) e("aprobado_por_humano sin informe (estado imposible).");
  for (const p of buscarDatosPrivados(doc)) e(`Dato privado no permitido en ${p.ruta}: ${p.motivo}.`);
  return resultado(errores);
}

/** La versión `nueva` de un trabajo extiende a `vieja` (mismo id y mismo historial anterior intacto). */
export function extiendeA(nueva, vieja) {
  if (!vieja) return true;
  if (nueva?.id !== vieja.id || L(nueva?.historial).length < L(vieja.historial).length) return false;
  return JSON.stringify(vieja.historial) === JSON.stringify(nueva.historial.slice(0, vieja.historial.length));
}
