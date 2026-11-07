// CSI · registro de actores e incentivos `cauce.csi.actores` 0.1 (bloque 4).
// Separa lo documentado (con fuente) de lo hipotético. Las relaciones sin fuente no se usan en el análisis.
// Analiza alianzas y tensiones SOLO a partir de relaciones documentadas: no supone coordinación entre actores.

import { VERSION_CSI, VERSION_CSI_2, VERSIONES_CSI, ID, esObj, L, texto, esFechaConZona, esFechaODia, claves, controlesComunes, validarFuentes, esFuenteNexus } from "./base.js";
import { validarFuentes02, esPendiente } from "./fuentes.js";
import { buscarPsicologia, buscarCoordinacion, buscarIntencion } from "./lenguaje.js";

export const CONTRATO_ACTORES = "cauce.csi.actores";
export const TIPOS_ACTOR = ["gobierno", "banco_central", "institucion_financiera", "fondo_inversion", "empresa", "organismo_internacional", "sector_economico", "participante_colectivo"];
/** Relaciones y su clase para el análisis. «alianza» = cooperación documentada, no coordinación ni intención común. */
export const TIPOS_RELACION = { coopera: "alianza", miembro_de: "alianza", compite: "tension", conflicto_de_interes: "tension", regula: "dependencia", financia: "dependencia", posee_participacion: "dependencia", contraparte: "dependencia" };
const C = {
  raiz: ["contrato", "version_contrato", "es_demo", "actualizado_en", "fuentes", "actores", "relaciones", "demo"],
  actor: ["id", "nombre", "tipo", "ficticio", "descripcion", "objetivos_documentados", "incentivos_hipoteticos", "recursos_conocidos", "restricciones", "decisiones_posibles", "incertidumbres"],
  conFuente: ["texto", "fuentes"],
  incentivo: ["texto", "basado_en"],
  restriccion: ["texto", "fuentes", "impide"],
  decision: ["id", "texto"],
  relacion: ["id", "de", "a", "tipo", "descripcion", "fuentes"],
};
/** 0.2 (bloque 3): intereses económicos documentados, decisiones históricas verificables y conflictos de interés. */
const C2 = {
  actor: [...C.actor, "intereses_economicos", "decisiones_historicas", "conflictos_interes"],
  restriccion: [...C.restriccion, "clase"],
  historica: ["id", "fecha", "texto", "fuentes"],
  conflicto: ["texto", "fuentes", "clase"],
};
export const CLASES_RESTRICCION = ["legal", "economica", "operativa", "otra"];

export function validarActores(doc) {
  const errores = [], avisos = [];
  const e = (t) => errores.push(t);
  if (!esObj(doc)) return { errores: ["El registro de actores debe ser un objeto."], avisos };
  claves(doc, C.raiz, "", e);
  if (doc.contrato !== CONTRATO_ACTORES) e(`contrato debe ser "${CONTRATO_ACTORES}".`);
  if (!VERSIONES_CSI.includes(doc.version_contrato)) e(`version_contrato debe ser uno de: ${VERSIONES_CSI.join(", ")}.`);
  const v2 = doc.version_contrato === VERSION_CSI_2;
  const K = v2 ? C2 : C;
  if (typeof doc.es_demo !== "boolean") e("es_demo debe ser true o false.");
  if (doc.demo !== undefined && doc.es_demo !== true) e("demo (ahora simulado) solo existe en DEMO.");
  if (!esFechaConZona(doc.actualizado_en)) e("actualizado_en: instante con zona.");
  if (v2) validarFuentes02(doc.fuentes, { es_demo: doc.es_demo === true, e, aviso: (t) => avisos.push(t) }); else validarFuentes(doc.fuentes, { es_demo: doc.es_demo === true, e });
  const fuentes = new Map(L(doc.fuentes).map((f) => [f.id, f]));
  const conFuentes = (lista, r, oblig) => L(lista).forEach((x, i) => {
    if (!esObj(x) || !texto(x.texto)) return e(`${r}[${i}] necesita texto.`);
    if (oblig && !L(x.fuentes).length) e(`${r}[${i}] «${x.texto}»: lo documentado necesita fuente (sin fuente es un incentivo hipotético o una incertidumbre).`);
    for (const id of L(x.fuentes)) { if (!fuentes.has(id)) e(`${r}[${i}]: fuente «${id}» no existe.`); else if (esFuenteNexus(fuentes.get(id))) e(`${r}[${i}]: Nexus no documenta actores.`); }
    if (v2 && oblig && L(x.fuentes).length && L(x.fuentes).every((id) => esPendiente(fuentes.get(id)))) e(`${r}[${i}] «${x.texto}»: todas sus fuentes están pendientes; no está documentado todavía.`);
  });
  const ids = new Set();
  L(doc.actores).forEach((a, i) => {
    const r = `actores[${i}]`;
    if (!esObj(a)) return e(`${r} debe ser un objeto.`);
    claves(a, K.actor, `${r}.`, e);
    if (typeof a.id !== "string" || !ID.test(a.id)) e(`${r}.id inválido.`); else if (ids.has(a.id)) e(`${r}.id repetido.`); else ids.add(a.id);
    if (!texto(a.nombre)) e(`${r}.nombre es obligatorio.`);
    if (!TIPOS_ACTOR.includes(a.tipo)) e(`${r}.tipo debe ser uno de: ${TIPOS_ACTOR.join(", ")} (CSI estudia instituciones y colectivos, no a personas privadas).`);
    if (typeof a.ficticio !== "boolean") e(`${r}.ficticio debe ser true o false.`);
    if (doc.es_demo === true && a.ficticio !== true) e(`${r}: en DEMO todos los actores son ficticios.`);
    if (doc.es_demo === false && a.ficticio === true) e(`${r}: un actor ficticio no puede estar en el registro REAL.`);
    for (const k of ["objetivos_documentados", "incentivos_hipoteticos", "recursos_conocidos", "restricciones", "decisiones_posibles", "incertidumbres"]) if (!Array.isArray(a[k])) e(`${r}.${k} debe ser una lista.`);
    L(a.objetivos_documentados).forEach((x, j) => claves(x, C.conFuente, `${r}.objetivos_documentados[${j}].`, e));
    L(a.recursos_conocidos).forEach((x, j) => claves(x, C.conFuente, `${r}.recursos_conocidos[${j}].`, e));
    L(a.incentivos_hipoteticos).forEach((x, j) => { claves(x, C.incentivo, `${r}.incentivos_hipoteticos[${j}].`, e); if (!texto(x?.texto)) e(`${r}.incentivos_hipoteticos[${j}] necesita texto.`); });
    L(a.restricciones).forEach((x, j) => { claves(x, K.restriccion, `${r}.restricciones[${j}].`, e); if (x?.clase !== undefined && !CLASES_RESTRICCION.includes(x.clase)) e(`${r}.restricciones[${j}].clase: ${CLASES_RESTRICCION.join(" | ")}.`); });
    if (v2) validarActor02(a, { r, e, conFuentes, fuentes, real: doc.es_demo === false });
    conFuentes(a.objetivos_documentados, `${r}.objetivos_documentados`, true);
    conFuentes(a.recursos_conocidos, `${r}.recursos_conocidos`, true);
    conFuentes(a.restricciones, `${r}.restricciones`, false);
    const dec = new Set();
    L(a.decisiones_posibles).forEach((d, j) => { claves(d, C.decision, `${r}.decisiones_posibles[${j}].`, e); if (!texto(d?.id) || !texto(d?.texto) || dec.has(d.id)) e(`${r}.decisiones_posibles[${j}]: id único y texto.`); else dec.add(d.id); });
    for (const x of L(a.restricciones)) for (const id of L(x?.impide)) if (!dec.has(id)) e(`${r}: la restricción «${x.texto}» impide «${id}», que no es una decisión posible del actor.`);
  });
  const rel = new Set();
  L(doc.relaciones).forEach((x, i) => {
    const r = `relaciones[${i}]`;
    if (!esObj(x)) return e(`${r} debe ser un objeto.`);
    claves(x, C.relacion, `${r}.`, e);
    if (!texto(x.id) || rel.has(x.id)) e(`${r}.id ausente o repetido.`); else rel.add(x.id);
    if (!ids.has(x.de) || !ids.has(x.a) || x.de === x.a) e(`${r}: de y a deben ser actores distintos del registro.`);
    if (!(x.tipo in TIPOS_RELACION)) e(`${r}.tipo debe ser uno de: ${Object.keys(TIPOS_RELACION).join(", ")}.`);
    for (const id of L(x.fuentes)) if (!fuentes.has(id)) e(`${r}: fuente «${id}» no existe.`);
    if (!L(x.fuentes).length) avisos.push(`${r} (${x.de} → ${x.a}) sin fuente: no es verificable y no entra al análisis.`);
  });
  controlesComunes(doc, e);
  return { errores, avisos };
}

function validarActor02(a, { r, e, conFuentes, fuentes, real }) {
  for (const k of ["intereses_economicos", "decisiones_historicas", "conflictos_interes"]) if (!Array.isArray(a[k])) e(`${r}.${k} debe ser una lista (vacía si no hay nada documentado).`);
  L(a.intereses_economicos).forEach((x, j) => claves(x, C.conFuente, `${r}.intereses_economicos[${j}].`, e));
  conFuentes(a.intereses_economicos, `${r}.intereses_economicos`, true);
  const hist = new Set();
  L(a.decisiones_historicas).forEach((d, j) => {
    const rr = `${r}.decisiones_historicas[${j}]`;
    claves(d, C2.historica, `${rr}.`, e);
    if (!texto(d?.id) || hist.has(d.id)) e(`${rr}: id único.`); else hist.add(d.id);
    if (!esFechaODia(d?.fecha)) e(`${rr}: fecha de la decisión (AAAA-MM-DD o instante con zona).`);
    if (!texto(d?.texto)) e(`${rr}: texto.`);
    if (!L(d?.fuentes).length) e(`${rr}: una decisión histórica es verificable solo con fuente.`);
    for (const id of L(d?.fuentes)) if (!fuentes.has(id)) e(`${rr}: fuente «${id}» no existe.`); else if (esPendiente(fuentes.get(id)) && L(d.fuentes).every((x) => esPendiente(fuentes.get(x)))) e(`${rr}: sus fuentes están pendientes.`);
  });
  L(a.conflictos_interes).forEach((c, j) => {
    const rr = `${r}.conflictos_interes[${j}]`;
    claves(c, C2.conflicto, `${rr}.`, e);
    if (!texto(c?.texto) || !["documentado", "posible"].includes(c?.clase)) e(`${rr}: texto y clase documentado | posible.`);
    if (c?.clase === "documentado" && !L(c?.fuentes).length) e(`${rr}: un conflicto «documentado» necesita fuente; sin ella es «posible».`);
    for (const id of L(c?.fuentes)) if (!fuentes.has(id)) e(`${rr}: fuente «${id}» no existe.`);
  });
  if (real) {
    // Bloque 3: sin intenciones privadas, estados psicológicos ni coordinación secreta atribuidos a actores reales.
    const textos = [a.descripcion, ...L(a.objetivos_documentados).map((x) => x?.texto), ...L(a.incentivos_hipoteticos).map((x) => x?.texto), ...L(a.intereses_economicos).map((x) => x?.texto), ...L(a.conflictos_interes).map((x) => x?.texto), ...L(a.incertidumbres)];
    for (const t of textos.filter(texto)) {
      const psi = buscarPsicologia(t), coo = buscarCoordinacion(t), int = buscarIntencion(t);
      if (psi.length) e(`${r} «${t}»: estado psicológico atribuido (${psi.join(", ")}). CSI no atribuye estados psicológicos a actores reales.`);
      if (coo.length) e(`${r} «${t}»: «${coo.join(", ")}». Una relación pública no es prueba de coordinación secreta.`);
      if (int.length) e(`${r} «${t}»: intención privada (${int.join(", ")}). Usa objetivos documentados o un incentivo hipotético en palabras neutras.`);
    }
  }
}

/** Relación verificable = con al menos una fuente que existe y no es Nexus. */
export function relacionesVerificables(doc) {
  const fuentes = new Map(L(doc?.fuentes).map((f) => [f.id, f]));
  const ok = [], sinVerificar = [];
  for (const x of L(doc?.relaciones)) (L(x.fuentes).some((id) => fuentes.has(id) && !esFuenteNexus(fuentes.get(id)) && !esPendiente(fuentes.get(id))) ? ok : sinVerificar).push(x);
  return { verificables: ok, sin_verificar: sinVerificar };
}

/**
 * Intereses contrapuestos y alianzas entre los actores pedidos, solo con relaciones verificables.
 * Un par sin relación documentada se dice así; no se rellena con coordinación supuesta.
 */
export function analizarIntereses(doc, actorIds = null) {
  const ids = actorIds ?? L(doc?.actores).map((a) => a.id);
  const { verificables } = relacionesVerificables(doc);
  const dentro = verificables.filter((x) => ids.includes(x.de) && ids.includes(x.a));
  const pares = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const rs = dentro.filter((x) => (x.de === ids[i] && x.a === ids[j]) || (x.de === ids[j] && x.a === ids[i]));
    const clases = [...new Set(rs.map((x) => TIPOS_RELACION[x.tipo]))].sort();
    pares.push({ a: ids[i], b: ids[j], relaciones: rs.map((x) => x.id), clases, lectura: !rs.length ? "sin relación documentada (no se supone coordinación ni conflicto)" : clases.includes("alianza") && clases.includes("tension") ? "relación mixta: coopera y compite a la vez" : clases.join(", ") });
  }
  // Bloques: componentes conexos SOLO por cooperación documentada.
  const padre = new Map(ids.map((x) => [x, x]));
  const raiz = (x) => (padre.get(x) === x ? x : raiz(padre.get(x)));
  for (const x of dentro) if (TIPOS_RELACION[x.tipo] === "alianza") padre.set(raiz(x.de), raiz(x.a));
  const grupos = new Map();
  for (const x of ids) { const r = raiz(x); grupos.set(r, [...(grupos.get(r) ?? []), x]); }
  const bloques = [...grupos.values()].filter((g) => g.length > 1).map((g) => g.sort());
  return { pares, bloques, nota: "Un bloque solo agrupa cooperación documentada. No implica coordinación, intención común ni que exista alguien que controle a los demás." };
}

export const actorPorId = (doc, id) => L(doc?.actores).find((a) => a.id === id) ?? null;
