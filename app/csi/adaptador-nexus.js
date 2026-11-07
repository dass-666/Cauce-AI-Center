// CSI → Nexus · adaptador SEPARADO (bloque 7). CSI investiga, Nexus cuestiona, Diego decide.
// Flujo: investigación → hipótesis → escenario → revisión escéptica → propuesta → decisión humana → seguimiento.
// Este módulo solo PREPARA una propuesta `cauce.csi.propuesta-nexus` 0.1 y un BORRADOR de `cauce.leccion` 0.3 que el
// gerente de Nexus puede revisar. Nunca escribe en el almacén de Nexus, nunca marca nada como validado y nunca usa
// lo que dijo Nexus como evidencia de la hipótesis que se le presenta (circularidad).

import { VERSION_CSI, L, texto, esFechaConZona, esAutor, esFuenteNexus, buscarDatosPrivados } from "./base.js";
import { esPendiente } from "./fuentes.js";
import { revisarAbogado } from "./abogado.js";
import { buscarEstrategiaFinanciera } from "./lenguaje.js";
import { analizarInvestigacion, EVIDENCIABLES } from "./investigacion.js";
import { validarLeccion } from "../nexus/leccion.js";
import { evaluarLeccion } from "../nexus/gerente.js";

export const CONTRATO_PROPUESTA = "cauce.csi.propuesta-nexus";
/** Fase 2 (bloque 8): CSI investiga → CSI formula hipótesis → Abogado del Diablo objeta → Nexus revisa → Diego decide. */
export const FLUJO = ["investigacion", "hipotesis", "objecion_abogado", "revision_esceptica", "decision_humana", "seguimiento"];
export const VERSION_PROPUESTA = "0.2";
/** Lo que el adaptador ENVÍA y lo que NUNCA envía (se comprueba en cada propuesta). */
export const ENVIA = ["identificador de investigación", "hipótesis", "fuentes con procedencia", "evidencia y procedencia", "objeciones", "limitaciones", "estado de validación", "condiciones de refutación"];
export const NO_ENVIA = ["conclusiones sin fuente como hechos", "predicciones como evidencia causal", "estrategias financieras privadas", "información personal", "datos sensibles", "aprobaciones ficticias"];
const dia = (iso) => new Date(Date.parse(iso)).toISOString().slice(0, 10);
const masDias = (iso, d) => new Date(Date.parse(iso) + d * 864e5).toISOString().slice(0, 10);

/**
 * @param investigacion  cauce.csi.investigacion 0.1 (válida)
 * @param hipotesisId    hipótesis a presentar
 * @param opciones       { autor, fecha, predicciones: resumen de resumirPredicciones() (opcional), ahoraMs }
 * @returns { ok, propuesta, errores }
 */
export function prepararPropuesta(investigacion, hipotesisId, { autor, fecha, predicciones = null, ahoraMs = Date.parse(fecha) } = {}) {
  const errores = [];
  if (!esAutor(autor)) errores.push("autor declarado obligatorio.");
  if (!esFechaConZona(fecha)) errores.push("fecha: instante con zona.");
  const h = L(investigacion?.hipotesis).find((x) => x.id === hipotesisId);
  if (!h) errores.push(`La hipótesis «${hipotesisId}» no existe.`);
  if (errores.length) return { ok: false, errores };
  const inv = investigacion;
  const fuentes = new Map(L(inv.fuentes).map((f) => [f.id, f]));
  const enun = new Map(L(inv.enunciados).map((x) => [x.id, x]));
  const origenNexus = /^recomendaci[oó]n:|^nexus:/i.test(String(h.origen ?? ""));
  const evidencia = [], excluida = [];
  for (const [sentido, ids] of [["a_favor", h.a_favor], ["en_contra", h.en_contra]]) for (const id of L(ids)) {
    const x = enun.get(id);
    if (!x) { excluida.push({ id, motivo: "no existe" }); continue; }
    if (x.retirado) { excluida.push({ id, motivo: `retirado: ${x.retirado.motivo}` }); continue; }
    if (!EVIDENCIABLES.includes(x.tipo)) { excluida.push({ id, motivo: `${x.tipo}: no es evidencia` }); continue; }
    const fs = L(x.fuentes).map((f) => fuentes.get(f)).filter(Boolean);
    if (fs.some(esFuenteNexus)) { excluida.push({ id, motivo: "cita a Nexus: lo que Nexus recomendó no es evidencia primaria de la hipótesis que se le presenta (circularidad)" }); continue; }
    if (!fs.length || fs.every(esPendiente)) { excluida.push({ id, motivo: "sin fuente consultada: una conclusión sin fuente no se envía como hecho" }); continue; }
    const usadas = fs.filter((f) => !esPendiente(f));
    evidencia.push({ enunciado_id: id, sentido, tipo: x.tipo, texto: x.texto, registrado_en: x.registrado_en, ...(x.cita ? { cita: x.cita } : {}), fuentes: usadas.map((f) => ({ id: f.id, titulo: f.titulo, editor: f.editor, tipo: f.tipo, publicada_en: f.publicada_en, ...(f.clase ? { clase: f.clase } : {}), ...(f.ficticia ? { ficticia: true } : {}) })) });
  }
  const analisis = analizarInvestigacion(inv).hipotesis.find((x) => x.id === h.id);
  const bloqueos = [];
  if (!evidencia.some((x) => x.sentido === "a_favor")) bloqueos.push("Sin evidencia primaria a favor: la propuesta llega incompleta.");
  if (origenNexus) bloqueos.push(`La hipótesis nació de Nexus (${h.origen}): Nexus no puede revisar con independencia su propia idea; hace falta evidencia primaria y una persona.`);
  if (analisis?.objeciones_abiertas) bloqueos.push(`${analisis.objeciones_abiertas} objeción(es) del Abogado del Diablo siguen abiertas.`);
  if (inv.revision?.estado !== "revisada") bloqueos.push(`La investigación no tiene revisión humana independiente (estado: ${inv.revision?.estado}).`);
  const abogado = revisarAbogado(inv, { predicciones }).hipotesis.find((x) => x.id === h.id);
  const usadasIds = new Set(evidencia.flatMap((x) => x.fuentes.map((f) => f.id)));
  const fuentesProc = L(inv.fuentes).filter((f) => usadasIds.has(f.id)).map((f) => ({ id: f.id, titulo: f.titulo, editor: f.editor, tipo: f.tipo, clase: f.clase ?? "no_declarada", estado: f.estado ?? "no_declarado",
    enlace: f.enlace ?? null, referencia: f.referencia ?? null, publicada_en: f.publicada_en, disponible_en: f.disponible_en ?? null, consultada_en: f.consultada_en ?? null, metodo_consulta: f.metodo_consulta ?? null, huella_contenido: f.huella_contenido ?? null, limitaciones: L(f.limitaciones), ...(f.ficticia ? { ficticia: true } : {}) }));
  const limitaciones = [...new Set(["Es una hipótesis, no un hecho.", ...(inv.naturaleza_estudio === "historico" ? ["Estudio retrospectivo: no demuestra capacidad de anticipar."] : []), ...fuentesProc.flatMap((f) => f.limitaciones.map((l) => `${f.id}: ${l}`)), ...(fuentesProc.some((f) => !f.huella_contenido) ? ["Hay fuentes sin copia verificable (sin huella de contenido)."] : [])])];
  const objeciones = [...L(inv.objeciones).filter((o) => o.hipotesis_id === h.id || o.hipotesis_id === null).map((o) => ({ id: o.id, tipo: o.tipo, texto: o.texto, estado: o.estado, autor: o.autor, ...(o.respuesta ? { respuesta: o.respuesta } : {}) })),
    ...L(abogado?.comprobaciones).filter((c) => c.resultado === "alerta" && !L(inv.objeciones).some((o) => o.id === `abg-${h.id}-${c.id}`.toLowerCase())).map((c) => ({ id: `abg-${h.id}-${c.id}`.toLowerCase(), tipo: c.tipo_objecion, texto: `${c.pregunta} ${c.detalle}`, estado: "abierta", autor: { tipo: "codigo", identificador: "abogado-csi" } }))];
  const preds = L(predicciones?.filas).filter((p) => p.investigacion_id === inv.id && (!p.hipotesis_id || p.hipotesis_id === h.id))
    .map((p) => ({ id: p.id, estado: p.estado, nota: p.estado === "acertada" ? "Un acierto no demuestra la explicación causal: es seguimiento, no evidencia." : null }));

  // Borrador de lección 0.3: SIEMPRE «propuesta», confianza baja y sin resultado medido. Lo juzga el gerente.
  const borrador = {
    id: `csi.${inv.id}.${h.id}`.toLowerCase().replace(/[^a-z0-9._-]/g, "-").slice(0, 80),
    esquema: "cauce.leccion", version_esquema: "0.3", tipo: "hallazgo",
    origen: { proyecto: "csi", componente: "investigaciones", version_sistema: `csi ${VERSION_CSI}`, tipo: autor.tipo === "ia" ? "texto_ia" : "revision_humana" },
    autor: { tipo: autor.tipo, identificador: autor.identificador },
    hallazgo: `[HIPÓTESIS CSI${inv.es_demo ? " · DEMO" : ""}] ${h.enunciado}`,
    antecedentes: [],
    evidencia: evidencia.map((x) => ({ tipo: x.tipo === "hecho" ? "fuente_documental" : "declaracion_publica", referencia: `csi:${inv.id}#${x.enunciado_id} (${x.sentido}) · ${x.fuentes.map((f) => f.titulo).join("; ")}`, ubicacion: "fuera_de_repo", base_conocimiento: "observed", conocido_en: x.registrado_en, proyecto_ejecutor: "csi", reproducible_declarado: false })),
    procedencia: { metodo: "Investigación CSI: hechos y declaraciones con fuente fechada, separados de inferencias y simulaciones; sin IA de pago.", alcance: inv.pregunta, limitaciones_fuente: ["Fuentes elegidas por quien investiga: puede haber sesgo de selección."] },
    fecha_hallazgo: dia(fecha), vigente_hasta: masDias(fecha, 90),
    muestra: { n: evidencia.length, unidad: "enunciado con fuente", n_efectivo: null, independencia: "no evaluada", naturaleza: inv.es_demo ? "demo" : "desconocida", naturaleza_resultado: "sin_resultado", seleccion_en_muestra: false, cobertura: `Investigación ${inv.id}: solo la evidencia registrada; datos faltantes: ${L(h.datos_faltantes).join("; ") || "no declarados"}.`, supuestos: L(h.supuestos).map(String) },
    confianza: { nivel: "baja", objeto: "efecto_operativo", justificacion: "Hipótesis estratégica sin resultado medido; CSI no afirma causalidad." },
    limitaciones: ["Es una hipótesis, no un hecho.", ...L(h.condiciones_refutacion).map((c) => `Se refuta si: ${c}`)],
    aplicaciones_posibles: [],
    validacion: { estado: "propuesta", validado_en: [] },
    revisiones: [{ fecha, autor_tipo: autor.tipo, autor: autor.identificador, decision: "propuesta", justificacion: "Presentada por CSI para revisión escéptica de Nexus. No es una aprobación.", version: "r1" }],
    sensibilidad: "interno",
  };
  const forma = validarLeccion(borrador);
  const dictamen = evaluarLeccion(borrador, { ahora: ahoraMs });
  const propuesta = {
    contrato: CONTRATO_PROPUESTA, version_contrato: VERSION_PROPUESTA, id: `prop-${inv.id}-${h.id}`, es_demo: inv.es_demo === true, creada_en: fecha, creada_por: { tipo: autor.tipo, identificador: autor.identificador, autenticacion: "declarada" },
    flujo: FLUJO, etapa: "revision_esceptica",
    investigacion: { id: inv.id, titulo: inv.titulo, huella: inv.historial?.at(-1)?.huella ?? null, revision: inv.revision?.estado ?? null },
    hipotesis: { id: h.id, categoria: h.categoria, enunciado: h.enunciado, estado_csi: analisis?.estado ?? null, motivos: analisis?.motivos ?? [] },
    naturaleza_estudio: inv.naturaleza_estudio ?? (inv.es_demo ? "demo" : "no_declarada"),
    evidencia_primaria: evidencia, excluida, bloqueos, predicciones: preds,
    fuentes: fuentesProc, fuentes_pendientes: L(inv.fuentes).filter(esPendiente).map((f) => ({ id: f.id, titulo: f.titulo, motivo: f.pendiente_motivo })),
    objeciones, limitaciones, condiciones_refutacion: L(h.condiciones_refutacion), datos_faltantes: L(h.datos_faltantes),
    estado_validacion: { csi: analisis?.estado ?? null, revision_humana: inv.revision?.estado ?? null, abogado_alertas: abogado?.alertas ?? 0, nexus: dictamen.dictamen.estado, decision: "pendiente" },
    envio: { envia: ENVIA, no_envia: NO_ENVIA },
    revision_esceptica: { version_reglas: dictamen.version_reglas, dictamen: dictamen.dictamen.estado, no_cumple: dictamen.dictamen.no_cumple, no_evaluado: dictamen.dictamen.no_evaluado, errores_forma: forma.errores },
    decision_humana: { estado: "pendiente", aprobador: null, nota: "Nexus no aprueba. Solo una persona (aprobador declarado) decide; esta propuesta no cambia nada por sí sola." },
    borrador_leccion: borrador,
  };
  // Filtro de envío (bloque 8): nada personal, sensible ni de estrategia financiera privada sale hacia Nexus.
  const privados = buscarDatosPrivados(propuesta);
  const finanzas = [h.enunciado, ...L(h.supuestos), ...evidencia.map((x) => x.texto), ...L(inv.supuestos)].flatMap((t) => buscarEstrategiaFinanciera(t));
  if (privados.length) return { ok: false, errores: privados.map((p) => `No se envía: dato privado en ${p.ruta} (${p.motivo}).`) };
  if (finanzas.length) return { ok: false, errores: [`No se envía: parece una estrategia financiera privada (${[...new Set(finanzas)].join(", ")}). CSI estudia instituciones; no prepara operaciones.`] };
  return { ok: true, propuesta, dictamen, errores: [] };
}

/** Comprueba que una propuesta no se haya «autoaprobado» (para pruebas y para la importación manual). */
export function revisarPropuesta(p) {
  const problemas = [];
  if (p?.contrato !== CONTRATO_PROPUESTA) problemas.push("No es una propuesta CSI.");
  if (p?.decision_humana?.estado !== "pendiente" && !texto(p?.decision_humana?.aprobador)) problemas.push("Decisión marcada sin aprobador humano.");
  if (p?.borrador_leccion?.validacion?.estado !== "propuesta") problemas.push("El borrador de lección no puede llegar validado.");
  if (L(p?.evidencia_primaria).some((x) => L(x.fuentes).some((f) => f.tipo === "nexus"))) problemas.push("Evidencia primaria citando a Nexus (circular).");
  if (L(p?.evidencia_primaria).some((x) => !["hecho", "declaracion"].includes(x.tipo))) problemas.push("Una inferencia, simulación o predicción llegó como evidencia.");
  if (L(p?.evidencia_primaria).some((x) => !L(x.fuentes).length)) problemas.push("Evidencia sin fuente presentada como hecho.");
  if (L(p?.predicciones).some((x) => x.evidencia !== undefined)) problemas.push("Una predicción se envió como evidencia.");
  if (p?.decision_humana?.estado !== "pendiente" || p?.estado_validacion?.decision && p.estado_validacion.decision !== "pendiente") problemas.push("La decisión humana debe llegar pendiente: CSI no envía aprobaciones.");
  return { ok: !problemas.length, problemas };
}
