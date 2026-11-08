// Laboratorio de IA · fase 2 · informe consolidado `cauce.lab.informe` 0.1 (lo arma el Coordinador: CÓDIGO).
//
// Junta, sin reescribirlas, las salidas de los tres roles y lo que lab-V comprobó de cada cita. Cada hallazgo lleva
// su evidencia y su grado de incertidumbre; cada recomendación es una PROPUESTA que espera decisión humana y nunca
// una acción automática. Las recomendaciones que parezcan operaciones de dinero (comprar, vender, apostar…) se
// excluyen y se dice por qué. El informe nunca se declara aprobado: eso solo lo registra el trabajo, por una persona.

import { VERSION_LAB, L, esObj, clavesExactas, esFechaConZona, texto, esHuella, buscarDatosPrivados, LIMITES, tamanoDocumento } from "./base.js";
import { buscarEstrategiaFinanciera } from "../csi/lenguaje.js";

export const CONTRATO_INFORME = "cauce.lab.informe";
export const AUTOR_INFORME = Object.freeze({ tipo: "codigo", identificador: "lab-coordinador", version: `lab-coordinador ${VERSION_LAB}` });
export const INCERTIDUMBRE = ["baja", "media", "alta", "desconocida"];
/** Alertas de lab-V que significan «falta o falla la evidencia» (el trabajo pasa a requiere_evidencia). */
export const ALERTAS_DE_EVIDENCIA = ["fuente_inexistente", "extracto_no_encontrado", "extracto_ambiguo", "extracto_demasiado_corto", "posterior_al_corte", "fecha_desconocida",
  "fecha_indeterminada", "copia_alterada", "copia_ausente", "sin_huella", "fuente_pendiente", "texto_no_verificable", "posible_fuera_de_contexto", "respuesta_ia_como_fuente", "hecho_sin_cita", "hecho_sin_cita_utilizable", "salida_parcial", "ejecucion_sin_salida"];
/** Verbos de operación con dinero o apuestas: una recomendación así no sale del Laboratorio. */
const OPERACION = /\b(compr(a|ar|e|en)|vend(a|er|e|en)|apost(ar|e|a)|apuesta|invert(ir|ir en)|transfer(ir|encia)|retir(ar|o) (de )?fondos|orden de (compra|venta)|ejecutar (la )?operaci[oó]n)\b/i;
const ROL_TXT = { investigador: "Investigador", analista: "Analista", critico: "Abogado del Diablo" };

function incertidumbreDe(clase, estadoCita) {
  if (clase === "hecho_citado") return estadoCita === "con_cita_utilizable" ? "baja" : "alta";
  if (clase === "inferencia") return "media";
  if (clase === "especulacion") return "alta";
  return "desconocida";
}

/**
 * @param p { trabajo, ronda, generado_en, adaptador: {id, es_ia}, pasos: [{rol, ejecucion, verificacion}] }
 * @returns informe (documento)
 */
export function construirInforme({ trabajo, ronda, generado_en, adaptador, pasos }) {
  const hallazgos = [], hipotesis = [], objeciones = [], faltante = [], contradicciones = [], alertas = [], verificaciones = [];
  for (const { rol, ejecucion: ej, verificacion: v } of pasos) {
    verificaciones.push({ rol, ejecucion_id: ej.id, verificacion_id: v.id, resultado: v.resultado, incompleta: v.incompleta, n_citas: v.resumen?.n_citas ?? 0, n_citas_utilizables: v.resumen?.n_citas_utilizables ?? 0, n_alertas: v.resumen?.n_alertas ?? 0 });
    for (const a of L(v.alertas)) alertas.push({ rol, codigo: a.codigo, detalle: String(a.detalle).slice(0, 400) });
    const citasV = L(v.citas);
    for (const a of L(ej.afirmaciones)) {
      const va = L(v.afirmaciones).find((x) => x.afirmacion_id === a.id);
      const estado = va?.estado_cita ?? "sin_respaldo_citado";
      hallazgos.push({
        id: `${rol}:${a.id}`, rol, texto: a.texto, clase: a.clase, incertidumbre: incertidumbreDe(a.clase, estado), respaldo: estado,
        respaldo_semantico: "pendiente_revision_humana",
        citas: L(a.citas).map((c, i) => { const vc = citasV.find((x) => x.afirmacion_id === a.id && x.indice === i); return { fuente_id: c.fuente_id, extracto: c.extracto, utilizable: vc?.cita_utilizable === true, alertas: L(vc?.alertas) }; }),
        objeciones: [],
      });
    }
    for (const h of L(ej.hipotesis)) hipotesis.push({ id: `${rol}:${h.id}`, rol, enunciado: h.enunciado, se_refuta_si: h.se_refuta_si, experimento: h.experimento, alternativa_a: h.alternativa_a ? `${rol}:${h.alternativa_a}` : null, objeciones: [] });
    for (const o of L(ej.objeciones)) objeciones.push({ id: `${rol}:${o.id}`, rol, a: o.a, tipo: o.tipo, texto: o.texto });
    for (const d of L(ej.dudas)) faltante.push({ rol, texto: d });
    for (const c of L(ej.contradicciones)) contradicciones.push({ rol, fuentes: c.fuentes, texto: c.texto });
  }
  // Enlaza cada objeción con lo que objeta («<ejecución>#<id>» → hallazgo o hipótesis del rol que la produjo).
  const rolDeEj = new Map(pasos.map((p) => [p.ejecucion.id, p.rol]));
  for (const o of objeciones) {
    const [ej, local] = String(o.a).split("#");
    const destino = local && rolDeEj.has(ej) ? `${rolDeEj.get(ej)}:${local}` : `${o.rol}:${o.a}`;
    o.objeta = destino;
    (hallazgos.find((x) => x.id === destino) ?? hipotesis.find((x) => x.id === destino))?.objeciones.push(o.id);
  }
  for (const a of alertas.filter((x) => ALERTAS_DE_EVIDENCIA.includes(x.codigo))) faltante.push({ rol: a.rol, texto: `lab-V (${a.codigo}): ${a.detalle}` });

  // Recomendaciones: SIEMPRE propuestas para una persona. Nunca acciones automáticas.
  const recs = [], excluidas = [];
  const rec = (tipo, t, base) => {
    const motivo = OPERACION.test(t) ? "parece una operación con dinero o una apuesta" : buscarEstrategiaFinanciera(t).length ? "parece una estrategia financiera privada" : null;
    if (motivo) { excluidas.push({ texto: t, motivo: `${motivo}: el Laboratorio no recomienda operaciones; solo análisis.` }); return; }
    recs.push({ id: `r${recs.length + 1}`, tipo, texto: t, base, requiere_decision_humana: true, accion_automatica: false });
  };
  for (const h of hipotesis.filter((x) => x.alternativa_a === null)) {
    const alt = hipotesis.filter((x) => x.alternativa_a === h.id);
    rec("experimento", `Distinguir entre «${h.enunciado}»${alt.length ? ` y ${alt.length} alternativa(s)` : ""}: ${h.experimento}`, [h.id, ...alt.map((x) => x.id)]);
  }
  for (const o of objeciones.filter((x) => x.tipo === "supuesto")) rec("revisar", `Comprobar el supuesto que señala el Abogado del Diablo antes de concluir: ${o.texto}`, [o.id]);
  for (const o of objeciones.filter((x) => x.tipo === "evidencia")) rec("obtener_evidencia", `Conseguir la evidencia que pide el Abogado del Diablo: ${o.texto}`, [o.id]);
  if (alertas.some((x) => ALERTAS_DE_EVIDENCIA.includes(x.codigo))) rec("revisar", "Revisar las citas que lab-V no pudo comprobar antes de usar cualquier conclusión que dependa de ellas.", alertas.filter((x) => ALERTAS_DE_EVIDENCIA.includes(x.codigo)).map((x) => `${x.rol}:${x.codigo}`).slice(0, 10));

  const hayFallaEvidencia = alertas.some((x) => ALERTAS_DE_EVIDENCIA.includes(x.codigo)) || verificaciones.some((x) => x.incompleta);
  const limitaciones = [
    ...(adaptador.es_ia ? [] : ["SIN MODELO: las salidas de los roles las produjo un guion determinista escrito a mano (DEMO). No es una IA y no entiende nada; solo prueba el flujo."]),
    ...(trabajo.es_demo ? ["Datos DEMO: no describen el estado real de ningún motor."] : []),
    "Una sola fuente: la ficha que publica el propio motor. Nada fue contrastado con una fuente independiente.",
    "lab-V comprueba que cada extracto exista literalmente en la fuente; si la cita APOYA lo que se afirma lo decide una persona.",
    ...(contradicciones.length ? [] : ["No se declararon contradicciones: con una sola fuente no hay con qué contrastar."]),
  ];
  return {
    contrato: CONTRATO_INFORME, version_contrato: VERSION_LAB,
    id: `${trabajo.id.replace("lab-trb-", "lab-inf-")}-r${ronda}`, es_demo: trabajo.es_demo, trabajo_id: trabajo.id, ronda, generado_en,
    autor: { ...AUTOR_INFORME },
    modo: { adaptador: adaptador.id, es_ia: adaptador.es_ia === true, aviso: adaptador.es_ia ? "Salidas de un modelo de IA: contenido no confiable, verificado por lab-V; el respaldo semántico lo decide una persona." : "Guion determinista sin modelo (DEMO): no es IA." },
    pregunta: trabajo.pregunta,
    origen: { motor: trabajo.origen.motor, nombre: trabajo.origen.nombre, generado_en: trabajo.origen.generado_en, sha256_documento: trabajo.origen.sha256_documento, fuente_id: trabajo.origen.fuente_id },
    estado_propuesto: hayFallaEvidencia ? "requiere_evidencia" : "requiere_revision",
    hallazgos, hipotesis, objeciones, informacion_faltante: faltante.slice(0, 60), contradicciones, limitaciones,
    recomendaciones: recs.slice(0, 12), recomendaciones_excluidas: excluidas, verificaciones, alertas: alertas.slice(0, 200),
    revision_humana: { estado: "pendiente" },
  };
}

const C_INF = ["contrato", "version_contrato", "id", "es_demo", "trabajo_id", "ronda", "generado_en", "autor", "modo", "pregunta", "origen", "estado_propuesto", "hallazgos", "hipotesis", "objeciones", "informacion_faltante", "contradicciones", "limitaciones", "recomendaciones", "recomendaciones_excluidas", "verificaciones", "alertas", "revision_humana"];

export function validarInforme(doc) {
  const errores = []; const e = (t) => errores.push(t);
  if (!clavesExactas(doc, C_INF, "", e)) return { ok: false, errores };
  if (tamanoDocumento(doc) > LIMITES.bytes_documento) return { ok: false, errores: ["informe demasiado grande."] };
  if (doc.contrato !== CONTRATO_INFORME || doc.version_contrato !== VERSION_LAB) e(`contrato debe ser ${CONTRATO_INFORME} ${VERSION_LAB}.`);
  if (typeof doc.es_demo !== "boolean") e("es_demo debe ser true o false.");
  else if (typeof doc.id !== "string" || !doc.id.startsWith(`${doc.es_demo ? "demo-" : ""}lab-inf-`) || (!doc.es_demo && doc.id.startsWith("demo-"))) e("id inválido o de otro mundo DEMO/REAL.");
  if (typeof doc.trabajo_id !== "string" || doc.trabajo_id.startsWith("demo-") !== (doc.es_demo === true)) e("trabajo_id de otro mundo DEMO/REAL.");
  if (!Number.isInteger(doc.ronda) || doc.ronda < 1) e("ronda debe ser entero ≥ 1.");
  if (!esFechaConZona(doc.generado_en)) e("generado_en debe ser instante con zona.");
  if (!esObj(doc.autor) || doc.autor.tipo !== "codigo" || doc.autor.identificador !== AUTOR_INFORME.identificador) e("autor debe ser el Coordinador (código): una IA no firma informes consolidados.");
  if (!esObj(doc.modo) || typeof doc.modo.es_ia !== "boolean" || !texto(doc.modo.aviso)) e("modo debe declarar si hubo IA y su aviso.");
  if (doc.modo?.adaptador === "sin-modelo" && (doc.modo.es_ia !== false || doc.es_demo !== true)) e("un informe del guion sin modelo es DEMO y declara es_ia = false.");
  if (!esObj(doc.origen) || !esHuella(doc.origen.sha256_documento)) e("origen debe fijar el documento del motor con su huella.");
  if (!["requiere_revision", "requiere_evidencia"].includes(doc.estado_propuesto)) e("estado_propuesto debe ser requiere_revision | requiere_evidencia (un informe nunca se propone aprobado).");
  for (const k of ["hallazgos", "hipotesis", "objeciones", "informacion_faltante", "contradicciones", "limitaciones", "recomendaciones", "recomendaciones_excluidas", "verificaciones", "alertas"]) if (!Array.isArray(doc[k])) e(`${k} debe ser una lista.`);
  L(doc.hallazgos).forEach((h, i) => {
    if (!INCERTIDUMBRE.includes(h?.incertidumbre)) e(`hallazgos[${i}].incertidumbre inválida.`);
    if (h?.incertidumbre === "baja" && !L(h.citas).some((c) => c.utilizable === true)) e(`hallazgos[${i}]: incertidumbre baja sin ninguna cita verificada.`);
    if (h?.respaldo_semantico !== "pendiente_revision_humana") e(`hallazgos[${i}].respaldo_semantico debe quedar pendiente de revisión humana.`);
  });
  L(doc.recomendaciones).forEach((r, i) => {
    if (r?.requiere_decision_humana !== true || r?.accion_automatica !== false) e(`recomendaciones[${i}]: debe requerir decisión humana y no ser automática.`);
    if (OPERACION.test(String(r?.texto)) || buscarEstrategiaFinanciera(String(r?.texto)).length) e(`recomendaciones[${i}]: parece una operación con dinero o apuesta (no permitido).`);
  });
  if (!esObj(doc.revision_humana) || doc.revision_humana.estado !== "pendiente" || Object.keys(doc.revision_humana).length !== 1) e("revision_humana debe ser {estado: «pendiente»}: la decisión vive en el trabajo y la toma una persona.");
  for (const p of buscarDatosPrivados(doc)) e(`Dato privado no permitido en ${p.ruta}: ${p.motivo}.`);
  return { ok: errores.length === 0, errores };
}

/** Informe en Markdown, para leer o guardar. Los textos se copian tal cual (son datos). */
export function informeMarkdown(inf, trabajo = null) {
  const l = [];
  const marca = inf.es_demo ? "DEMO" : "REAL";
  l.push(`# Informe del Laboratorio de IA · ${marca}`, "");
  l.push(`- Informe: \`${inf.id}\` (ronda ${inf.ronda}) · generado ${inf.generado_en} por ${inf.autor.identificador} (código)`);
  l.push(`- Modo: ${inf.modo.aviso}`);
  l.push(`- Origen (solo lectura): ${inf.origen.nombre} · lectura del ${inf.origen.generado_en} · huella \`${inf.origen.sha256_documento.slice(0, 16)}…\``);
  if (trabajo) l.push(`- Estado del trabajo: **${trabajo.estado}**${trabajo.decision_humana ? ` · decisión de ${trabajo.decision_humana.por.identificador} (${trabajo.decision_humana.por.autenticacion}): ${trabajo.decision_humana.motivo}` : " · sin decisión humana"}`);
  l.push("", `**Pregunta:** ${inf.pregunta}`, "", "## Hallazgos", "");
  for (const h of inf.hallazgos) {
    l.push(`- **${ROL_TXT[h.rol] ?? h.rol}** · ${h.clase} · incertidumbre ${h.incertidumbre} · ${h.respaldo}: ${h.texto}`);
    for (const c of h.citas) l.push(`  - cita ${c.utilizable ? "verificada" : "NO verificada"} (${c.fuente_id}): «${c.extracto}»${c.alertas.length ? ` · ${c.alertas.join(", ")}` : ""}`);
    if (h.objeciones.length) l.push(`  - objeciones: ${h.objeciones.join(", ")}`);
  }
  l.push("", "## Hipótesis", "");
  for (const h of inf.hipotesis) l.push(`- \`${h.id}\`${h.alternativa_a ? ` (alternativa a ${h.alternativa_a})` : ""}: ${h.enunciado}`, `  - se refuta si: ${h.se_refuta_si}`, `  - experimento: ${h.experimento}`);
  if (!inf.hipotesis.length) l.push("- (ninguna)");
  l.push("", "## Objeciones del Abogado del Diablo", "");
  for (const o of inf.objeciones) l.push(`- \`${o.id}\` (${o.tipo}) sobre ${o.objeta}: ${o.texto}`);
  if (!inf.objeciones.length) l.push("- (ninguna)");
  l.push("", "## Información que falta", "", ...(inf.informacion_faltante.length ? inf.informacion_faltante.map((x) => `- ${x.texto}`) : ["- (nada declarado)"]));
  l.push("", "## Limitaciones", "", ...inf.limitaciones.map((x) => `- ${x}`));
  l.push("", "## Recomendaciones (propuestas: todas requieren decisión humana)", "", ...(inf.recomendaciones.length ? inf.recomendaciones.map((r) => `- [${r.tipo}] ${r.texto}`) : ["- (ninguna)"]));
  if (inf.recomendaciones_excluidas.length) l.push("", "Excluidas:", ...inf.recomendaciones_excluidas.map((r) => `- ${r.motivo} — «${r.texto}»`));
  l.push("", "## Verificación (lab-V)", "", ...inf.verificaciones.map((v) => `- ${ROL_TXT[v.rol] ?? v.rol}: ${v.resultado}${v.incompleta ? " (incompleta)" : ""} · ${v.n_citas_utilizables}/${v.n_citas} citas verificadas · ${v.n_alertas} alerta(s)`));
  l.push("", "_Este informe no es una aprobación. Encontrar un extracto no demuestra que una afirmación sea verdadera._", "");
  return l.join("\n");
}
