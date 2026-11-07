// CSI · lectura de colecciones (investigaciones, actores, escenarios, predicciones) y resumen para la interfaz.
// Primero el almacén REAL local (datos/csi/registro/, fuera de git); si no existe, el DEMO. Nunca se mezclan.

import { VERSION_CSI, L, esObj } from "./base.js";
import { validarInvestigacion, verificarHistorial, analizarInvestigacion } from "./investigacion.js";
import { validarActores, analizarIntereses, relacionesVerificables } from "./actores.js";
import { validarEscenario, simular } from "./simulador.js";
import { validarRegistroPredicciones, verificarPredicciones, resumirPredicciones } from "./predicciones.js";
import { evaluarFlujo } from "./flujo.js";
import { revisarAbogado } from "./abogado.js";
import { verificarContraAncla } from "./ancla.js";
import { expedientePendiente } from "./fuentes.js";

export const COLECCIONES = { investigaciones: "cauce.csi.investigaciones", escenarios: "cauce.csi.escenarios" };
export const coleccionVacia = (tipo, es_demo = false) => ({ contrato: COLECCIONES[tipo], version_contrato: VERSION_CSI, es_demo, [tipo]: [] });

/**
 * @param docs { actores, investigaciones, escenarios, predicciones }  (cualquiera puede faltar)
 * @returns todo lo que la oficina necesita, con errores de cada documento; lo inválido no se muestra.
 */
export async function leerCSI({ actores = null, investigaciones = null, escenarios = null, predicciones = null, anclas = null }, { ahoraMs = null } = {}) {
  const errores = [];
  const demos = [actores, investigaciones, escenarios, predicciones].filter(esObj).map((d) => d.es_demo === true);
  if (new Set(demos).size > 1) errores.push("Se mezclan documentos DEMO y REAL: no se muestra nada hasta separarlos.");
  const es_demo = demos.length ? demos[0] : true;
  const ahora = ahoraMs ?? (es_demo ? Date.parse(investigaciones?.demo?.ahora_simulado ?? predicciones?.demo?.ahora_simulado ?? actores?.demo?.ahora_simulado ?? "") : NaN);
  const ms = Number.isFinite(ahora) ? ahora : Date.now();
  if (errores.length) return { es_demo, errores, investigaciones: [], actores: null, escenarios: [], predicciones: null, ahoraMs: ms };

  let act = null;
  if (esObj(actores)) { const v = validarActores(actores); if (v.errores.length) errores.push(...v.errores.map((t) => `actores: ${t}`)); else act = actores; }
  const invs = [];
  for (const inv of L(investigaciones?.investigaciones)) {
    const v = validarInvestigacion(inv);
    if (v.errores.length) { errores.push(...v.errores.slice(0, 5).map((t) => `${inv?.id ?? "?"}: ${t}`)); continue; }
    if (inv.es_demo !== es_demo) { errores.push(`${inv.id}: DEMO/REAL distinto del resto.`); continue; }
    const h = await verificarHistorial(inv);
    invs.push({ inv, integridad: h, analisis: analizarInvestigacion(inv), avisos: v.avisos ?? [] });
  }
  const escs = [];
  for (const esc of L(escenarios?.escenarios)) {
    const v = validarEscenario(esc);
    if (v.errores.length) { errores.push(...v.errores.slice(0, 5).map((t) => `${esc?.id ?? "?"}: ${t}`)); continue; }
    escs.push({ esc, sim: simular(esc, { investigacion: invs.find((x) => x.inv.id === esc.investigacion_id)?.inv, actores: act }) });
  }
  let pred = null;
  if (esObj(predicciones)) {
    const v = validarRegistroPredicciones(predicciones);
    if (v.errores.length) errores.push(...v.errores.map((t) => `predicciones: ${t}`));
    else pred = { doc: predicciones, integridad: await verificarPredicciones(predicciones), resumen: resumirPredicciones(predicciones, ms) };
  }
  // Fase 2: la última ancla (si hay) dice qué predicciones tienen hora acreditada y cuáles solo declarada.
  if (pred) {
    const lista = (Array.isArray(anclas) ? anclas : L(anclas?.anclas)).filter(esObj);
    pred.anclas = lista.length;
    pred.verificacion = lista.length ? await verificarContraAncla(predicciones, lista.at(-1), pred.resumen) : null;
  }
  // Fase 2: flujo de 10 pasos, Abogado del Diablo y expediente de fuentes para cada investigación válida.
  const escDocs = escs.map((x) => x.esc);
  for (const x of invs) {
    x.flujo = evaluarFlujo(x.inv, { actores: act, escenarios: escDocs });
    x.abogado = revisarAbogado(x.inv, { predicciones: pred?.resumen ?? null });
    x.expediente = expedientePendiente(x.inv);
  }
  const historico = invs.length > 0 && invs.every((x) => x.inv.naturaleza_estudio === "historico");
  if (historico && pred) errores.push("Un conjunto HISTÓRICO no lleva memoria de predicciones (es retrospectivo): las predicciones van en el almacén real.");
  return {
    es_demo, naturaleza: es_demo ? "demo" : historico ? "historico" : "real", errores, ahoraMs: ms, investigaciones: invs, escenarios: escs, predicciones: pred,
    actores: act ? { doc: act, intereses: analizarIntereses(act), relaciones: relacionesVerificables(act) } : null,
  };
}
