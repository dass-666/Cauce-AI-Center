// CSI · simulador de decisiones `cauce.csi.escenario` 0.1 (bloque 5). Determinista: mismo escenario → mismo resultado.
// Sin probabilidades: cada explicación se mide por señales observadas (enunciados registrados) a favor y en contra,
// y por los datos que faltan. Cada ruta del árbol es una SIMULACIÓN, nunca un resultado real ni una predicción.

import { VERSION_CSI, ID, esObj, L, texto, esAutor, esFechaConZona, claves, controlesComunes } from "./base.js";
import { EVIDENCIABLES } from "./investigacion.js";
import { actorPorId } from "./actores.js";

export const CONTRATO_ESCENARIO = "cauce.csi.escenario";
export const CLAVES_EXPLICACION = ["A", "B", "C", "D", "otra"];
const MAX_NODOS = 200, MAX_PROFUNDIDAD = 6;
const C = {
  raiz: ["contrato", "version_contrato", "id", "investigacion_id", "titulo", "es_demo", "naturaleza", "creado_en", "creado_por", "detonante", "explicaciones", "arbol"],
  explicacion: ["id", "clave", "categoria", "hipotesis_id", "descripcion", "senales_a_favor", "senales_en_contra", "datos_faltantes", "solo_hipotesis"],
  senal: ["texto", "enunciado_id"],
  nodo: ["id", "padre", "actor_id", "decision_id", "explicacion_id", "beneficios", "costos", "restricciones", "consecuencias"],
};

export function validarEscenario(x) {
  const errores = [], avisos = [];
  const e = (t) => errores.push(t);
  if (!esObj(x)) return { errores: ["El escenario debe ser un objeto."], avisos };
  claves(x, C.raiz, "", e);
  if (x.contrato !== CONTRATO_ESCENARIO) e(`contrato debe ser "${CONTRATO_ESCENARIO}".`);
  if (x.version_contrato !== VERSION_CSI) e(`version_contrato debe ser "${VERSION_CSI}".`);
  if (!ID.test(String(x.id ?? "")) || !ID.test(String(x.investigacion_id ?? ""))) e("id e investigacion_id son obligatorios.");
  if (x.naturaleza !== "simulacion") e('naturaleza debe ser "simulacion": un escenario nunca es un resultado real.');
  if (typeof x.es_demo !== "boolean") e("es_demo debe ser true o false.");
  if (!texto(x.titulo) || !texto(x.detonante)) e("titulo y detonante son obligatorios.");
  if (!esFechaConZona(x.creado_en) || !esAutor(x.creado_por)) e("creado_en (con zona) y creado_por son obligatorios.");
  const exps = new Set();
  L(x.explicaciones).forEach((p, i) => {
    const r = `explicaciones[${i}].`;
    claves(p, C.explicacion, r, e);
    if (!texto(p?.id) || exps.has(p.id)) e(`${r}id ausente o repetido.`); else exps.add(p.id);
    if (!CLAVES_EXPLICACION.includes(p?.clave)) e(`${r}clave: ${CLAVES_EXPLICACION.join(", ")}.`);
    if (!texto(p?.descripcion)) e(`${r}descripcion es obligatoria.`);
    for (const k of ["senales_a_favor", "senales_en_contra", "datos_faltantes"]) if (!Array.isArray(p?.[k])) e(`${r}${k} debe ser una lista.`);
    for (const k of ["senales_a_favor", "senales_en_contra"]) L(p?.[k]).forEach((s, j) => { claves(s, C.senal, `${r}${k}[${j}].`, e); if (!texto(s?.texto)) e(`${r}${k}[${j}] necesita texto.`); });
    if (p?.categoria === "manipulacion" && p.solo_hipotesis !== true) e(`${r}una explicación de manipulación se marca solo_hipotesis: true (requiere evidencia).`);
  });
  if (!L(x.explicaciones).length) e("explicaciones: al menos una (lo ideal: varias alternativas).");
  const nodos = L(x.arbol?.nodos);
  if (!esObj(x.arbol) || !Array.isArray(x.arbol.nodos)) e("arbol.nodos debe ser una lista.");
  if (nodos.length > MAX_NODOS) e(`arbol: máximo ${MAX_NODOS} nodos.`);
  const nid = new Set();
  nodos.forEach((n, i) => {
    const r = `arbol.nodos[${i}].`;
    claves(n, C.nodo, r, e);
    if (!texto(n?.id) || nid.has(n.id)) e(`${r}id ausente o repetido.`); else nid.add(n.id);
    if (!texto(n?.actor_id) || !texto(n?.decision_id)) e(`${r}actor_id y decision_id son obligatorios.`);
    if (n?.explicacion_id !== undefined && !exps.has(n.explicacion_id)) e(`${r}explicacion_id «${n.explicacion_id}» no existe.`);
    for (const k of ["beneficios", "costos", "restricciones", "consecuencias"]) if (!Array.isArray(n?.[k])) e(`${r}${k} debe ser una lista (beneficios y costos son hipotéticos, en palabras).`);
  });
  for (const n of nodos) if (n?.padre !== null && !nid.has(n?.padre)) e(`nodo ${n?.id}: padre «${n?.padre}» no existe.`);
  if (nodos.length && !nodos.some((n) => n.padre === null)) e("arbol: falta un nodo raíz (padre null).");
  controlesComunes(x, e);
  return { errores, avisos };
}

/**
 * Corre el escenario contra la investigación y el registro de actores. Devuelve explicaciones con sus señales
 * observadas/pendientes y las rutas del árbol (raíz → hoja) con problemas detectados. Nada aleatorio.
 */
export function simular(esc, { investigacion = null, actores = null } = {}) {
  const enun = new Map(L(investigacion?.enunciados).map((x) => [x.id, x]));
  const observada = (s) => { const x = s?.enunciado_id ? enun.get(s.enunciado_id) : null; return x && !x.retirado && EVIDENCIABLES.includes(x.tipo) ? x : null; };
  const explicaciones = L(esc?.explicaciones).slice().sort((a, b) => String(a.clave).localeCompare(String(b.clave)) || String(a.id).localeCompare(String(b.id))).map((p) => {
    const favor = L(p.senales_a_favor).map((s) => ({ texto: s.texto, enunciado_id: s.enunciado_id ?? null, observada: !!observada(s) }));
    const contra = L(p.senales_en_contra).map((s) => ({ texto: s.texto, enunciado_id: s.enunciado_id ?? null, observada: !!observada(s) }));
    const f = favor.filter((s) => s.observada).length, c = contra.filter((s) => s.observada).length;
    const estado = !f && !c ? "sin_evidencia" : f && c ? "mixta" : f ? "con_senales_a_favor" : "con_senales_en_contra";
    return { id: p.id, clave: p.clave, categoria: p.categoria ?? null, descripcion: p.descripcion, solo_hipotesis: p.solo_hipotesis === true || p.categoria === "manipulacion", estado,
      a_favor: { observadas: f, de: favor.length, senales: favor }, en_contra: { observadas: c, de: contra.length, senales: contra }, datos_faltantes: L(p.datos_faltantes) };
  });

  const nodos = L(esc?.arbol?.nodos);
  const porId = new Map(nodos.map((n) => [n.id, n]));
  const hijos = new Map();
  for (const n of nodos) if (n.padre !== null) hijos.set(n.padre, [...(hijos.get(n.padre) ?? []), n]);
  for (const l of hijos.values()) l.sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const problemas = [];
  const info = (n) => {
    const a = actorPorId(actores, n.actor_id);
    const dec = L(a?.decisiones_posibles).find((d) => d.id === n.decision_id);
    const bloquea = L(a?.restricciones).filter((r) => L(r.impide).includes(n.decision_id)).map((r) => r.texto);
    if (!a) problemas.push(`Nodo ${n.id}: el actor «${n.actor_id}» no está en el registro.`);
    else if (!dec) problemas.push(`Nodo ${n.id}: «${n.decision_id}» no es una decisión posible registrada de ${a.nombre}.`);
    return { nodo: n.id, actor: a?.nombre ?? n.actor_id, decision: dec?.texto ?? n.decision_id, bloqueada: bloquea.length > 0, por: bloquea, beneficios: L(n.beneficios), costos: L(n.costos), restricciones: L(n.restricciones), consecuencias: L(n.consecuencias), explicacion_id: n.explicacion_id ?? null };
  };
  const rutas = [];
  const recorrer = (n, camino, vistos) => {
    if (vistos.has(n.id)) { problemas.push(`Ciclo en el árbol en ${n.id}.`); return; }
    if (camino.length >= MAX_PROFUNDIDAD) { problemas.push(`Ruta por ${n.id} supera ${MAX_PROFUNDIDAD} niveles: se corta.`); return; }
    const paso = info(n);
    const c2 = [...camino, paso];
    const hs = hijos.get(n.id) ?? [];
    if (!hs.length) rutas.push({ id: c2.map((p) => p.nodo).join(">"), pasos: c2, viable: c2.every((p) => !p.bloqueada), naturaleza: "simulacion" });
    for (const h of hs) recorrer(h, c2, new Set([...vistos, n.id]));
  };
  for (const r of nodos.filter((n) => n.padre === null).sort((a, b) => String(a.id).localeCompare(String(b.id)))) recorrer(r, [], new Set());
  for (const n of nodos) if (n.padre !== null && !porId.has(n.padre)) problemas.push(`Nodo ${n.id} sin padre válido.`);
  return {
    escenario_id: esc?.id ?? null, naturaleza: "simulacion",
    aviso: "SIMULACIÓN determinista: muestra opciones y respuestas posibles con la evidencia registrada. No es un resultado real, no es una predicción y no asigna probabilidades.",
    explicaciones, rutas, problemas: [...new Set(problemas)],
  };
}

/**
 * Plantilla «caída abrupta de un mercado» con las cuatro explicaciones del bloque 5 (A–D). Solo esqueleto: las señales
 * no tienen enunciado hasta que la persona registre evidencia. D (manipulación) nace marcada como solo hipótesis.
 */
export function plantillaCaidaMercado({ id, investigacion_id, mercado, autor, fecha, es_demo = false }) {
  const s = (t) => ({ texto: t });
  return {
    contrato: CONTRATO_ESCENARIO, version_contrato: VERSION_CSI, id, investigacion_id, titulo: `Caída abrupta: ${mercado}`, es_demo, naturaleza: "simulacion",
    creado_en: fecha, creado_por: { tipo: autor.tipo, identificador: autor.identificador }, detonante: `${mercado} cae bruscamente en una sesión.`,
    explicaciones: [
      { id: "A", clave: "A", categoria: "fundamentales", descripcion: "Cambio económico fundamental (expectativas de crecimiento, tasas, utilidades).", senales_a_favor: [s("Revisión pública de indicadores o pronósticos anterior a la caída"), s("Anuncio de política monetaria o fiscal relevante")], senales_en_contra: [s("Sin noticias fundamentales en la ventana de la caída"), s("Recuperación rápida sin cambio de fundamentales")], datos_faltantes: ["Calendario de publicaciones oficiales de la ventana", "Revisión de utilidades del sector"] },
      { id: "B", clave: "B", categoria: "liquidez", descripcion: "Problema de liquidez y ventas forzadas (llamadas de margen, rescates de fondos).", senales_a_favor: [s("Reportes de llamadas de margen o rescates"), s("Diferenciales de compra-venta ampliados")], senales_en_contra: [s("Volumen normal y diferenciales estables")], datos_faltantes: ["Flujos de fondos por día", "Datos de margen de la cámara de compensación"] },
      { id: "C", clave: "C", categoria: "oportunista", descripcion: "Compras oportunistas de grandes participantes tras la caída.", senales_a_favor: [s("Reportes regulatorios de compras en bloque posteriores a la caída")], senales_en_contra: [s("Sin cambios de tenencia reportados en el plazo legal")], datos_faltantes: ["Reportes de tenencias de los participantes grandes"] },
      { id: "D", clave: "D", categoria: "manipulacion", solo_hipotesis: true, descripcion: "Posible manipulación. SOLO hipótesis: requiere evidencia (investigación o sanción del regulador, registros de órdenes).", senales_a_favor: [s("Investigación o sanción publicada por el regulador"), s("Registros de órdenes con patrón documentado por una autoridad")], senales_en_contra: [s("El regulador revisa y descarta irregularidades")], datos_faltantes: ["Registros de órdenes (solo los tiene el regulador)", "Comunicados oficiales del regulador"] },
    ],
    arbol: { nodos: [] },
  };
}
