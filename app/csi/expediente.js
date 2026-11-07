// CSI fase 2 · construir una investigación desde un EXPEDIENTE (archivo de datos), con el mismo motor que usa una
// persona: crearInvestigacion → definir_alcance → fuentes → enunciados → hipótesis → objeciones. Así el historial y las
// huellas son reales y el orden (alcance antes de fuentes) queda demostrado. El contenido vive en el expediente, no en
// el código: el motor es público, una investigación solo se publica si Diego lo autoriza.

import { L, clon } from "./base.js";
import { crearInvestigacion, aplicarCambio, verificarHistorial } from "./investigacion.js";
import { validarActores } from "./actores.js";
import { validarEscenario } from "./simulador.js";
import { revisarAbogado, objecionesSugeridas, AUTOR_ABOGADO } from "./abogado.js";

export const CONTRATO_EXPEDIENTE = "cauce.csi.expediente";

/**
 * @param exp { contrato, version_contrato, investigacion: {id, titulo, pregunta, acontecimiento, autor, fecha, actores, naturaleza_estudio},
 *              alcance: {datos, fecha}, pasos: [{accion, datos, fecha, autor?}], abogado?: {fecha}, pasos_finales: [...], actores, escenarios[] }
 * @returns { ok, errores, docs: {actores, investigaciones, escenarios} }
 */
export async function construirDesdeExpediente(exp) {
  const errores = [];
  if (exp?.contrato !== CONTRATO_EXPEDIENTE) return { ok: false, errores: [`contrato debe ser ${CONTRATO_EXPEDIENTE}.`] };
  const c = exp.investigacion ?? {};
  const r0 = await crearInvestigacion({ ...c, version: "0.2", es_demo: false });
  if (!r0.ok) return { ok: false, errores: r0.errores.map((t) => `crear: ${t}`) };
  let inv = r0.inv;
  const aplicar = async (accion, datos, fecha, autor = c.autor) => {
    const r = await aplicarCambio(inv, { accion, datos }, { autor, fecha });
    if (!r.ok) { errores.push(`${accion} ${datos?.fuente?.id ?? datos?.enunciado?.id ?? datos?.hipotesis?.id ?? datos?.objecion?.id ?? ""}: ${r.errores.join(" | ")}`); return false; }
    inv = r.inv; return true;
  };
  if (exp.alcance) await aplicar("definir_alcance", exp.alcance.datos, exp.alcance.fecha);
  for (const p of L(exp.pasos)) if (!(await aplicar(p.accion, p.datos, p.fecha, p.autor ?? c.autor))) break;
  if (!errores.length && exp.abogado?.fecha) {
    // El Abogado del Diablo (código) registra sus alertas como objeciones abiertas; no responde por nadie.
    for (const o of objecionesSugeridas(inv, revisarAbogado(inv))) if (!(await aplicar("agregar_objecion", { objecion: o }, exp.abogado.fecha, AUTOR_ABOGADO))) break;
  }
  if (!errores.length) for (const p of L(exp.pasos_finales)) if (!(await aplicar(p.accion, p.datos, p.fecha, p.autor ?? c.autor))) break;
  const va = exp.actores ? validarActores(exp.actores) : { errores: [] };
  errores.push(...va.errores.map((t) => `actores: ${t}`));
  for (const esc of L(exp.escenarios)) errores.push(...validarEscenario(esc).errores.map((t) => `${esc.id}: ${t}`));
  const h = await verificarHistorial(inv);
  if (!h.ok) errores.push(...h.problemas);
  return {
    ok: !errores.length, errores,
    docs: {
      actores: exp.actores ? clon(exp.actores) : null,
      investigaciones: { contrato: "cauce.csi.investigaciones", version_contrato: "0.1", es_demo: false, investigaciones: [inv] },
      escenarios: { contrato: "cauce.csi.escenarios", version_contrato: "0.1", es_demo: false, escenarios: clon(L(exp.escenarios)) },
    },
  };
}
