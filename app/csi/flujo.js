// CSI fase 2 · investigador estratégico: flujo de razonamiento en 10 pasos (bloque 4). Determinista y sin red.
// No razona por la persona: dice qué paso está completo, cuál falta y por qué, con lo registrado en la investigación,
// el registro de actores y los escenarios. Un paso «completo» significa «registrado con las reglas», no «verdadero».

import { L } from "./base.js";
import { esPendiente } from "./fuentes.js";

export const PASOS = [
  ["acontecimiento", "Identificar el acontecimiento"],
  ["actores", "Determinar qué actores podrían verse afectados"],
  ["incentivos", "Identificar sus incentivos"],
  ["decisiones", "Estudiar qué decisiones tienen disponibles"],
  ["restricciones", "Examinar qué restricciones enfrentan"],
  ["alternativas", "Construir explicaciones alternativas (incluidas las ordinarias)"],
  ["simulacion", "Simular respuestas de otros actores"],
  ["evidencia", "Buscar evidencia a favor y en contra"],
  ["faltante", "Identificar información faltante"],
  ["observaciones", "Formular observaciones que distingan las hipótesis"],
];
/** Explicaciones «ordinarias» (bloque 4): las que hay que descartar antes de pensar en algo extraordinario. */
export const ORDINARIAS = ["fundamentales", "liquidez", "oportunista"];

/**
 * @param inv        cauce.csi.investigacion (0.1 o 0.2)
 * @param opciones   { actores: doc cauce.csi.actores, escenarios: [cauce.csi.escenario] }
 * @returns { pasos: [{n, id, titulo, estado: completo|incompleto, faltan[], detalle}], completos, siguiente }
 */
export function evaluarFlujo(inv, { actores = null, escenarios = [] } = {}) {
  const reg = new Map(L(actores?.actores).map((a) => [a.id, a]));
  const ids = L(inv?.actores);
  const hips = L(inv?.hipotesis);
  const vig = new Map(L(inv?.enunciados).filter((x) => !x.retirado).map((x) => [x.id, x]));
  const evid = (id) => ["hecho", "declaracion"].includes(vig.get(id)?.tipo);
  const misEsc = L(escenarios).filter((e) => e?.investigacion_id === inv?.id);
  const r = [];
  const paso = (i, faltan, detalle) => r.push({ n: i + 1, id: PASOS[i][0], titulo: PASOS[i][1], estado: faltan.length ? "incompleto" : "completo", faltan, detalle });

  // 1. Acontecimiento (y, si es histórico, su alcance registrado antes de las fuentes).
  const f1 = [];
  if (!inv?.acontecimiento?.descripcion || !inv?.acontecimiento?.fecha) f1.push("descripción y fecha del acontecimiento");
  if (inv?.naturaleza_estudio === "historico" && !inv?.alcance) f1.push("alcance y criterios de selección de fuentes (antes de analizar)");
  paso(0, f1, `${inv?.acontecimiento?.descripcion ?? "—"} (${inv?.acontecimiento?.fecha ?? "sin fecha"})`);

  // 2. Actores: al menos dos, todos en el registro.
  const f2 = [];
  if (ids.length < 2) f2.push("al menos dos actores (un acontecimiento con un solo actor no permite estudiar respuestas)");
  for (const id of ids) if (actores && !reg.has(id)) f2.push(`«${id}» no está en el registro de actores`);
  paso(1, f2, `${ids.length} actor(es)`);

  // 3. Incentivos: cada actor tiene alguno (inferido en la investigación o hipotético en el registro).
  const f3 = ids.filter((id) => !L(inv?.incentivos).some((x) => x.actor_id === id) && !L(reg.get(id)?.incentivos_hipoteticos).length).map((id) => `incentivos de «${id}»`);
  paso(2, f3, "Los incentivos son siempre inferidos o hipotéticos: no son hechos.");

  // 4. Decisiones disponibles.
  const f4 = ids.filter((id) => !L(reg.get(id)?.decisiones_posibles).length).map((id) => `decisiones posibles de «${id}»`);
  paso(3, f4, `${ids.reduce((s, id) => s + L(reg.get(id)?.decisiones_posibles).length, 0)} decisión(es) posibles registradas`);

  // 5. Restricciones (documentadas cuentan; sin fuente se muestran como supuesto).
  const conRestr = ids.filter((id) => L(reg.get(id)?.restricciones).length);
  const f5 = conRestr.length ? [] : ["al menos una restricción documentada de algún actor"];
  const docum = ids.flatMap((id) => L(reg.get(id)?.restricciones)).filter((x) => L(x.fuentes).length).length;
  paso(4, f5, `${docum} restricción(es) con fuente`);

  // 6. Explicaciones alternativas: tres o más, de dos categorías o más, con al menos una ordinaria.
  const cats = new Set(hips.map((h) => h.categoria));
  const f6 = [];
  if (hips.length < 3) f6.push(`al menos tres explicaciones (hay ${hips.length})`);
  if (cats.size < 2) f6.push("explicaciones de al menos dos categorías");
  if (!hips.some((h) => ORDINARIAS.includes(h.categoria))) f6.push("una explicación ordinaria (fundamentales, liquidez u oportunista)");
  paso(5, f6, [...cats].join(", ") || "sin hipótesis");

  // 7. Simular respuestas: un escenario de esta investigación cuyo árbol involucre a dos actores o más.
  const actoresArbol = new Set(misEsc.flatMap((e) => L(e.arbol?.nodos).map((n) => n.actor_id)));
  const f7 = [];
  if (!misEsc.length) f7.push("un escenario vinculado a la investigación");
  else if (actoresArbol.size < 2) f7.push("un árbol con decisiones de al menos dos actores (acción y respuesta)");
  paso(6, f7, misEsc.map((e) => `${e.id}${e.contrafactual ? " (contrafactual)" : ""}`).join(", ") || "sin escenarios");

  // 8. Evidencia a favor y en contra: toda hipótesis con algo a favor y la investigación buscó algo en contra.
  const f8 = hips.filter((h) => !L(h.a_favor).some(evid)).map((h) => `evidencia a favor de ${h.id}`);
  if (hips.length && !hips.some((h) => L(h.en_contra).some(evid))) f8.push("evidencia en contra de alguna hipótesis (si nada contradice nada, quizá no se buscó)");
  paso(7, f8, `${hips.reduce((s, h) => s + L(h.a_favor).filter(evid).length, 0)} a favor · ${hips.reduce((s, h) => s + L(h.en_contra).filter(evid).length, 0)} en contra`);

  // 9. Información faltante (y fuentes pendientes).
  const f9 = hips.filter((h) => !L(h.datos_faltantes).length).map((h) => `datos faltantes de ${h.id}`);
  const pend = L(inv?.fuentes).filter(esPendiente).length;
  paso(8, f9, `${hips.reduce((s, h) => s + L(h.datos_faltantes).length, 0)} dato(s) faltante(s) declarados · ${pend} fuente(s) pendiente(s)`);

  // 10. Observaciones que distingan hipótesis rivales (0.2).
  const f10 = hips.filter((h) => !L(h.observaciones_distintivas).some((o) => L(o.distingue_de).length)).map((h) => `qué observación separaría ${h.id} de sus rivales`);
  paso(9, f10, `${hips.reduce((s, h) => s + L(h.observaciones_distintivas).length, 0)} observación(es) distintivas`);

  const completos = r.filter((p) => p.estado === "completo").length;
  return { pasos: r, completos, total: PASOS.length, siguiente: r.find((p) => p.estado !== "completo")?.id ?? null };
}
