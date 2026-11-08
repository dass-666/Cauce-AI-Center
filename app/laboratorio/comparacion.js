// Laboratorio de IA · fase 3.1 · BANCO DE COMPARACIÓN de modelos (preparado; sin resultados todavía).
//
// Para comparar más adelante dos modelos (p. ej. Claude por intercambio manual y un modelo local) hace falta medir lo
// mismo, de la misma manera, sobre los mismos trabajos. Este módulo mide un expediente ya terminado (o en curso) con
// criterios que el código SÍ puede contar, y agrupa por modelo DECLARADO:
//   · validez estructural: intentos de importación aceptados / intentos;
//   · citas existentes y literales: cuántas citas existen en el catálogo y coinciden literalmente (o normalizadas);
//   · cobertura de evidencia: hechos citados con al menos una cita utilizable / hechos citados;
//   · contradicciones detectadas: declaradas por el modelo y marcadas por lab-V (sin decidir si son reales);
//   · afirmaciones sin respaldo: hechos sin cita e inferencias sin base;
//   · errores de seguridad: posibles inyecciones y comandos incrustados;
//   · tiempo de procesamiento: de la creación del encargo a la importación (incluye a la persona, en el intercambio
//     manual; en un proveedor automático, inicio→fin de la ejecución);
//   · costo de inferencia: lo que registre la ejecución (en manual es $0; en automático lo informa el adaptador).
//
// Lo que NO mide: si una afirmación es verdadera, si una cita APOYA lo afirmado o si una objeción tiene razón. Eso lo
// decide una persona y, cuando lo haga, se puede anexar como «puntuacion_humana». Un modelo que no se ejecutó no
// tiene fila: aquí no se inventan calificaciones.

import { L, esObj, ROLES } from "./base.js";
import { ETIQUETA_ROL } from "./coordinador.js";

export const CONTRATO_COMPARACION = "cauce.lab.comparacion";
export const VERSION_COMPARACION = "0.1";
export const CRITERIOS = Object.freeze(["validez_estructural", "citas_literales", "cobertura_evidencia", "contradicciones_detectadas", "afirmaciones_sin_respaldo", "errores_seguridad", "tiempo_segundos", "costo_mxn"]);
const SEGURIDAD = new Set(["posible_inyeccion_de_instrucciones", "contiene_instrucciones_no_ejecutadas"]);
const seg = (a, b) => { const d = (Date.parse(b) - Date.parse(a)) / 1000; return Number.isFinite(d) && d >= 0 ? Math.round(d) : null; };
const razon = (n, d) => (d ? Math.round((n / d) * 1000) / 1000 : null);

/** Métricas de un expediente, por rol. No usa el texto de las respuestas: solo verificaciones, contadores y tiempos. */
export function medirExpediente(x) {
  const t = x.trabajo;
  const roles = {};
  for (const rol of ROLES) {
    const paso = L(t.pasos).find((p) => p.rol === rol);
    const ej = paso ? x.ejecuciones.get(paso.ejecuciones.at(-1)) : null;
    const v = ej ? x.verificaciones.get(ej.id) : null;
    const enc = paso ? x.encargos.get(paso.encargo_id) : null;
    const imps = L(x.importaciones).filter((i) => i.rol === rol);
    if (!ej) { roles[rol] = { ejecutado: false, intentos: imps.length, aceptados: imps.filter((i) => i.aceptada).length }; continue; }
    const citas = L(v?.citas), afs = L(v?.afirmaciones), alertas = L(v?.alertas);
    const hechos = L(ej.afirmaciones).filter((a) => a.clase === "hecho_citado");
    const hechosCubiertos = afs.filter((a) => a.estado_cita === "con_cita_utilizable" && hechos.some((h) => h.id === a.afirmacion_id)).length;
    const tiempo = ej.autor?.tipo === "ia_manual" ? seg(enc?.creado_en, ej.intercambio?.importado_en) : seg(ej.inicio, ej.fin);
    roles[rol] = {
      ejecutado: true, autoria: ej.autor?.tipo ?? null, modelo: ej.autor?.modelo ?? null, intentos: imps.length, aceptados: imps.filter((i) => i.aceptada).length,
      validez_estructural: imps.length ? razon(imps.filter((i) => i.aceptada).length, imps.length) : null,
      correcciones_de_forma: imps.flatMap((i) => L(i.correcciones)).length,
      citas: { total: citas.length, existentes: citas.filter((c) => c.existencia === "registrada").length, literales: citas.filter((c) => c.coincidencia === "literal").length, normalizadas: citas.filter((c) => c.coincidencia === "normalizada").length, no_encontradas: citas.filter((c) => c.coincidencia === "no_encontrada").length, fuente_inexistente: citas.filter((c) => c.existencia === "inexistente").length, utilizables: citas.filter((c) => c.cita_utilizable).length },
      citas_literales: razon(citas.filter((c) => ["literal", "normalizada"].includes(c.coincidencia)).length, citas.length),
      cobertura_evidencia: razon(hechosCubiertos, hechos.length), hechos: hechos.length,
      contradicciones_detectadas: L(ej.contradicciones).length + alertas.filter((a) => a.codigo === "posible_contradiccion_declarada").length,
      afirmaciones_sin_respaldo: alertas.filter((a) => ["hecho_sin_cita", "hecho_sin_cita_utilizable", "inferencia_sin_base"].includes(a.codigo)).length,
      errores_seguridad: alertas.filter((a) => SEGURIDAD.has(a.codigo)).length,
      alertas_total: alertas.length, resultado_lab_v: v?.resultado ?? null,
      tiempo_segundos: tiempo, costo_mxn: typeof ej.uso?.costo_mxn === "number" ? ej.uso.costo_mxn : null,
    };
  }
  const modelos = [...new Set(Object.values(roles).map((r) => r.modelo).filter(Boolean))];
  return { trabajo_id: t.id, es_demo: t.es_demo, estado: t.estado, adaptador: t.adaptador?.id ?? null, modelo: modelos.length === 1 ? modelos[0] : modelos.length ? modelos.join(" + ") : null, autoria: [...new Set(Object.values(roles).map((r) => r.autoria).filter(Boolean))], roles, puntuacion_humana: null };
}

/**
 * Agrupa las medidas por modelo DECLARADO y las suma. Solo entran expedientes con autoría de IA (manual o automática):
 * el guion DEMO no es un modelo y no se compara. Si no hay ninguno, el resultado lo dice (sin_datos: true).
 */
export function compararModelos(expedientes, { generado_en = null } = {}) {
  const medidas = L(expedientes).map(medirExpediente).filter((m) => m.autoria.some((a) => a === "ia_manual" || a === "ia_automatica"));
  const grupos = new Map();
  for (const m of medidas) {
    const k = m.modelo ?? "modelo no declarado";
    const g = grupos.get(k) ?? { modelo: k, trabajos: 0, roles_ejecutados: 0, intentos: 0, aceptados: 0, correcciones_de_forma: 0, citas: 0, citas_literales: 0, citas_utilizables: 0, hechos: 0, hechos_cubiertos: 0, contradicciones_detectadas: 0, afirmaciones_sin_respaldo: 0, errores_seguridad: 0, tiempo_segundos: 0, tiempos_medidos: 0, costo_mxn: 0, costos_medidos: 0, trabajos_ids: [] };
    g.trabajos++; g.trabajos_ids.push(m.trabajo_id);
    for (const r of Object.values(m.roles)) {
      g.intentos += r.intentos; g.aceptados += r.aceptados;
      if (!r.ejecutado) continue;
      g.roles_ejecutados++; g.correcciones_de_forma += r.correcciones_de_forma;
      g.citas += r.citas.total; g.citas_literales += r.citas.literales + r.citas.normalizadas; g.citas_utilizables += r.citas.utilizables;
      g.hechos += r.hechos; g.hechos_cubiertos += r.cobertura_evidencia === null ? 0 : Math.round(r.cobertura_evidencia * r.hechos);
      g.contradicciones_detectadas += r.contradicciones_detectadas; g.afirmaciones_sin_respaldo += r.afirmaciones_sin_respaldo; g.errores_seguridad += r.errores_seguridad;
      if (r.tiempo_segundos !== null) { g.tiempo_segundos += r.tiempo_segundos; g.tiempos_medidos++; }
      if (r.costo_mxn !== null) { g.costo_mxn += r.costo_mxn; g.costos_medidos++; }
    }
    grupos.set(k, g);
  }
  const filas = [...grupos.values()].map((g) => ({ ...g, validez_estructural: razon(g.aceptados, g.intentos), citas_literales_razon: razon(g.citas_literales, g.citas), cobertura_evidencia: razon(g.hechos_cubiertos, g.hechos), tiempo_medio_segundos: g.tiempos_medidos ? Math.round(g.tiempo_segundos / g.tiempos_medidos) : null, costo_mxn: g.costos_medidos ? g.costo_mxn : null }));
  return {
    contrato: CONTRATO_COMPARACION, version_contrato: VERSION_COMPARACION, generado_en, criterios: [...CRITERIOS], sin_datos: !filas.length,
    aviso: "Mide lo que el código puede contar. No mide verdad, apoyo semántico ni calidad del razonamiento: eso requiere puntuación humana por trabajo (puntuacion_humana). Un modelo sin trabajos no aparece: no se inventan calificaciones.",
    modelos: filas, trabajos: medidas,
  };
}

/** La comparación en Markdown (una fila por modelo declarado). */
export function comparacionMarkdown(c) {
  const p = [`# Comparación de modelos · Laboratorio de IA`, "", c.generado_en ? `Generada ${c.generado_en}.` : "", `> ${c.aviso}`, ""];
  if (c.sin_datos) { p.push("**Sin datos:** ningún expediente con autoría de IA. Cuando haya trabajos con respuestas reales, exporta sus expedientes y corre `node herramientas/comparar-modelos.mjs <expedientes…>`."); return `${p.filter((l) => l !== "").join("\n")}\n`; }
  p.push("| Modelo (declarado) | Trabajos | Roles | Validez estructural | Citas literales | Cobertura de evidencia | Contradicciones | Sin respaldo | Seguridad | Tiempo medio (s) | Costo (MXN) | Correcciones de forma |", "|---|---|---|---|---|---|---|---|---|---|---|---|");
  const pct = (v) => (v === null ? "—" : `${Math.round(v * 100)} %`);
  for (const m of c.modelos) p.push(`| ${m.modelo} | ${m.trabajos} | ${m.roles_ejecutados} | ${pct(m.validez_estructural)} (${m.aceptados}/${m.intentos}) | ${pct(m.citas_literales_razon)} (${m.citas_literales}/${m.citas}) | ${pct(m.cobertura_evidencia)} (${m.hechos_cubiertos}/${m.hechos}) | ${m.contradicciones_detectadas} | ${m.afirmaciones_sin_respaldo} | ${m.errores_seguridad} | ${m.tiempo_medio_segundos ?? "no medido"} | ${m.costo_mxn ?? "no medido"} | ${m.correcciones_de_forma} |`);
  p.push("", "## Trabajos medidos", "");
  for (const t of c.trabajos) p.push(`- ${t.trabajo_id} (${t.es_demo ? "DEMO" : "REAL"}, ${t.estado}, modelo ${t.modelo ?? "no declarado"}): ${ROLES.filter((r) => t.roles[r].ejecutado).map((r) => `${ETIQUETA_ROL[r]} lab-V «${t.roles[r].resultado_lab_v}», citas útiles ${t.roles[r].citas.utilizables}/${t.roles[r].citas.total}`).join("; ") || "sin roles ejecutados"}${t.puntuacion_humana ? "" : " · puntuación humana: pendiente"}`);
  return `${p.filter((l) => l !== null).join("\n")}\n`;
}

/** Validación mínima del documento. */
export function validarComparacion(c) {
  const errores = [];
  if (!esObj(c) || c.contrato !== CONTRATO_COMPARACION || c.version_contrato !== VERSION_COMPARACION) errores.push(`No es ${CONTRATO_COMPARACION} ${VERSION_COMPARACION}.`);
  else { if (!Array.isArray(c.modelos)) errores.push("modelos debe ser una lista."); if (typeof c.sin_datos !== "boolean") errores.push("sin_datos debe ser booleano."); }
  return { ok: !errores.length, errores };
}
