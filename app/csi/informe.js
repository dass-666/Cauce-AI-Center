// CSI · expediente legible (Markdown) de una investigación. Determinista, sin red y sin IA: corre igual en Node y en el
// navegador. No añade ninguna conclusión: solo ordena lo registrado (fuentes, enunciados por clase, hipótesis con su
// estado, objeciones, flujo de 10 pasos y Abogado del Diablo) y marca con claridad qué es DEMO, HISTÓRICO o REAL.
// El Markdown se escribe a mano (sin biblioteca) y escapa los caracteres que podrían cambiar la estructura del texto.

import { L } from "./base.js";
import { analizarInvestigacion } from "./investigacion.js";
import { evaluarFlujo } from "./flujo.js";
import { revisarAbogado } from "./abogado.js";
import { expedientePendiente, fechaConocimiento } from "./fuentes.js";

export const VERSION_INFORME = "csi-informe 0.1";

const NATURALEZA_TXT = {
  demo: "DEMO · CASO FICTICIO. País, mercado, actores, fuentes y cifras inventados: nada describe a una institución real.",
  historico: "HISTÓRICO · REAL RETROSPECTIVO. Acontecimiento real ya ocurrido, analizado después con fuentes públicas fechadas. No es una predicción.",
  prospectivo: "REAL · PROSPECTIVO. Investigación en curso sobre un acontecimiento que todavía no se resolvió. Identidades declaradas, sin autenticar.",
};
const TIPO_TXT = { hecho: "Hechos", declaracion: "Declaraciones (atribuidas a una fuente)", inferencia: "Inferencias (interpretación razonada)", simulacion: "Simulaciones (resultados posibles bajo supuestos)", prediccion: "Predicciones (registradas antes de su horizonte)" };
const ESTADO_HIP = { incompleta: "Incompleta", contradicha: "Contradicha", en_disputa: "En disputa", sin_contradiccion_registrada: "Sin contradicción registrada (no es confirmación)" };
const RES_TXT = { alerta: "ALERTA", ok: "sin alerta", no_evaluable: "no evaluable" };

/** Texto plano dentro de Markdown: sin saltos de línea ni «|», y sin que un «#» o «-» al inicio cambie la estructura. */
export const md = (v) => String(v ?? "").replace(/\r?\n+/g, " ").replace(/\|/g, "\\|").replace(/^([#>\-*+]|\d+\.)\s/, "\\$1 ").trim();
const celda = (v) => (md(v) === "" ? "—" : md(v));
const fila = (...c) => `| ${c.map(celda).join(" | ")} |`;
const tabla = (cabeceras, filas) => (filas.length ? [fila(...cabeceras), `|${cabeceras.map(() => "---").join("|")}|`, ...filas] : ["_Nada registrado._"]);
const lista = (xs, vacio = "_Nada registrado._") => (xs.length ? xs.map((x) => `- ${md(x)}`) : [vacio]);
const dia = (f) => (typeof f === "string" && f.length >= 10 ? f.slice(0, 10) : f ? String(f) : "—");

/**
 * @param inv       cauce.csi.investigacion (0.1 o 0.2), tal como está en el almacén
 * @param opciones  { actores, escenarios, naturaleza (demo|historico|real), ahora (instante ISO; opcional), origen (texto; opcional) }
 * @returns texto Markdown
 */
export function informeInvestigacion(inv, { actores = null, escenarios = [], naturaleza = null, ahora = null, origen = null } = {}) {
  const an = analizarInvestigacion(inv);
  const flujo = evaluarFlujo(inv, { actores, escenarios });
  const abogado = revisarAbogado(inv);
  const exp = expedientePendiente(inv);
  const nat = inv.es_demo ? "demo" : (inv.naturaleza_estudio === "historico" || naturaleza === "historico") ? "historico" : "prospectivo";
  const fuentes = new Map(L(inv.fuentes).map((f) => [f.id, f]));
  const vigentes = L(inv.enunciados).filter((x) => !x.retirado);
  const ref = (ids) => L(ids).map((id) => (fuentes.has(id) ? `[${id}]` : `[${id}?]`)).join(" ") || "sin fuente";
  const txt = (id) => { const x = L(inv.enunciados).find((y) => y.id === id); return x ? `${x.id} [${x.tipo}] ${x.texto}${x.retirado ? " (RETIRADO)" : ""}` : `${id} (no existe)`; };
  const s = [];
  s.push(`# Expediente CSI · ${md(inv.titulo)}`, "");
  s.push(`> **${NATURALEZA_TXT[nat]}**`);
  s.push(`> Lo investigó ${md(inv.creada_por?.identificador ?? "?")} (${md(inv.creada_por?.tipo ?? "?")}, identidad declarada). Revisión humana: **${md(inv.revision?.estado ?? "borrador")}**${inv.revision?.revisor ? ` por ${md(inv.revision.revisor.identificador)}` : ""}.`);
  s.push(`> Este documento solo ordena lo registrado en la investigación; no añade conclusiones. ${ahora ? `Generado ${md(ahora)}.` : ""}${origen ? ` Origen: ${md(origen)}.` : ""}`.trimEnd(), "");

  s.push("## 1. Pregunta y acontecimiento", "");
  s.push(`- **Id:** ${md(inv.id)} · contrato ${md(inv.contrato)} ${md(inv.version_contrato)} · creada ${md(inv.creada_en)}`);
  s.push(`- **Pregunta:** ${md(inv.pregunta)}`);
  s.push(`- **Acontecimiento:** ${md(inv.acontecimiento?.descripcion)} (${dia(inv.acontecimiento?.fecha)})`);
  s.push(`- **Actores:** ${L(inv.actores).map(md).join(", ") || "—"}`);
  s.push(`- **Incertidumbre declarada:** ${md(inv.incertidumbre?.nivel)} — ${md(inv.incertidumbre?.descripcion)}`, "");
  if (inv.alcance) {
    const a = inv.alcance;
    s.push("## 2. Alcance (registrado antes de la primera fuente)", "");
    s.push(`${md(a.descripcion)}`, "", `- **Periodo:** ${dia(a.periodo?.desde)} → ${dia(a.periodo?.hasta)} · registrado ${md(a.registrado_en)}`);
    s.push(`- **Criterios de selección de fuentes:** ${L(a.criterios_fuentes).map(md).join("; ") || "—"}`);
    s.push(`- **Incluye:** ${L(a.incluye).map(md).join("; ") || "—"}`, `- **Excluye:** ${L(a.excluye).map(md).join("; ") || "—"}`, "");
  } else s.push("## 2. Alcance", "", inv.version_contrato === "0.2" ? "_Sin alcance registrado (en una investigación 0.2 se registra antes de la primera fuente)._" : "_El contrato 0.1 no registra alcance._", "");

  s.push(`## 3. Fuentes (${exp.consultadas.length} consultadas · ${exp.pendientes.length} pendientes · ${exp.sin_huella.length} sin copia verificable)`, "");
  s.push("Tres fechas distintas: publicada (la copia citada), disponible (desde cuándo era pública; es la que cuenta para «qué se podía saber») y consultada (cuándo se leyó; nunca cuenta como conocimiento). Una fuente PENDIENTE no respalda ningún enunciado. La huella SHA-256 identifica la copia privada que se usó; las copias de terceros no se publican.", "");
  s.push(...tabla(["Id", "Fuente", "Clase", "Estado", "Publicada", "Disponible", "Consultada", "Huella de la copia", "Cotejo"],
    L(inv.fuentes).map((f) => fila(f.id, `${f.titulo} · ${f.editor} · ${f.tipo}${f.enlace ? ` · ${f.enlace}` : f.referencia ? ` · ${f.referencia}` : ""}`, f.clase ?? "—", f.estado === "pendiente" ? `PENDIENTE: ${f.pendiente_motivo ?? ""}` : f.estado ?? "0.1",
      dia(f.publicada_en), f.disponible_en ? `${dia(f.disponible_en)} (${f.disponible_segun ?? "?"})` : "= publicada", f.consultada_en ?? "—", f.huella_contenido ? `${f.huella_contenido}` : "sin huella", L(f.cotejos).length ? L(f.cotejos).map((c) => `${c.resultado} ${dia(c.fecha)}`).join("; ") : "—"))), "");
  const conLimites = L(inv.fuentes).filter((f) => L(f.limitaciones).length);
  if (conLimites.length) { s.push("**Limitaciones anotadas por fuente:**", "", ...conLimites.flatMap((f) => L(f.limitaciones).map((t) => `- ${md(f.id)}: ${md(t)}`)), ""); }

  s.push(`## 4. Enunciados (${vigentes.length} vigentes · ${L(inv.enunciados).length - vigentes.length} retirados)`, "");
  for (const t of Object.keys(TIPO_TXT)) {
    const xs = L(inv.enunciados).filter((x) => x.tipo === t);
    if (!xs.length) continue;
    s.push(`### ${TIPO_TXT[t]} (${xs.filter((x) => !x.retirado).length})`, "");
    s.push(...xs.map((x) => `- **${md(x.id)}** ${md(x.texto)}${x.sobre ? ` · sobre: ${md(x.sobre)}` : ""}${x.actor_id ? ` · actor: ${md(x.actor_id)}` : ""} · ${ref(x.fuentes)}${x.inferido_de ? ` · inferido de ${L(x.inferido_de).map(md).join(", ")}` : ""}${x.contrafactual ? " · CONTRAFACTUAL" : ""}${x.retirado ? ` · **RETIRADO** (${md(x.retirado.motivo)})` : ""}`), "");
  }
  if (L(inv.incentivos).length) s.push("### Incentivos inferidos (no son hechos)", "", ...lista(inv.incentivos.map((x) => `${x.actor_id}: ${x.texto} (basado en ${L(x.basado_en).join(", ")})`)), "");
  if (L(inv.supuestos).length) s.push("### Supuestos", "", ...lista(inv.supuestos), "");

  s.push("## 5. Hipótesis", "");
  s.push("«Sin contradicción registrada» no es confirmación. Los conteos son de enunciados registrados, no probabilidades.", "");
  s.push(...tabla(["Hipótesis", "Categoría", "Estado", "A favor", "En contra", "Objeciones abiertas", "Datos faltantes", "Por qué"],
    an.hipotesis.map((h) => fila(`${h.id} ${h.enunciado}`, h.categoria, ESTADO_HIP[h.estado] ?? h.estado, h.a_favor, h.en_contra, h.objeciones_abiertas, h.datos_faltantes, [...h.motivos, ...(h.apoyos_disputados.length ? [`apoyo disputado: ${h.apoyos_disputados.join(", ")}`] : [])].join("; ")))), "");
  for (const h of L(inv.hipotesis)) {
    s.push(`### ${md(h.id)} · ${md(h.enunciado)}`, "");
    s.push("- **A favor:** " + (L(h.a_favor).length ? L(h.a_favor).map((id) => md(txt(id))).join("; ") : "sin evidencia a favor"));
    s.push("- **En contra:** " + (L(h.en_contra).length ? L(h.en_contra).map((id) => md(txt(id))).join("; ") : "nada en contra registrado"));
    s.push("- **Se refuta si:** " + (L(h.condiciones_refutacion).map(md).join("; ") || "sin condiciones: queda incompleta"));
    s.push("- **Datos que faltan:** " + (L(h.datos_faltantes).map(md).join("; ") || "no declarados"));
    if (L(h.observaciones_distintivas).length) s.push("- **Observaciones que la distinguen:** " + h.observaciones_distintivas.map((o) => `${md(o.texto)} (frente a ${L(o.distingue_de).join(", ")})`).join("; "));
    s.push("");
  }
  if (an.alertas.length) s.push("**Alertas del análisis:**", "", ...lista(an.alertas), "");
  if (an.conflictos.length) s.push("**Enunciados que se contradicen:**", "", ...lista(an.conflictos.map((c) => `${c.a} (${c.tipos[0]}) contradice ${c.b} (${c.tipos[1]})`)), "");

  const obj = L(inv.objeciones);
  s.push(`## 6. Objeciones (${obj.filter((o) => o.estado === "abierta").length} abiertas de ${obj.length})`, "");
  s.push(...lista(obj.map((o) => `[${o.estado}] ${o.hipotesis_id ?? "general"} · ${o.tipo}: ${o.texto}${o.respuesta ? ` → respuesta: ${o.respuesta}` : ""} (${o.autor?.identificador ?? "?"}, ${o.autor?.tipo ?? "?"})`)), "");

  s.push(`## 7. Flujo de razonamiento (${flujo.completos} de ${flujo.total} pasos registrados)`, "");
  s.push("«Completo» quiere decir registrado con las reglas, no verdadero.", "");
  s.push(...flujo.pasos.map((p) => `${p.estado === "completo" ? "- [x]" : "- [ ]"} ${p.n}. ${md(p.titulo)} · ${md(p.detalle)}${p.faltan.length ? ` · **falta:** ${p.faltan.map(md).join("; ")}` : ""}`), "");

  s.push(`## 8. Abogado del Diablo (${abogado.version}, código) · ${abogado.alertas_total} alerta(s)`, "");
  s.push(`${md(abogado.aviso)} Firma: ${md(abogado.autor.identificador)} (${md(abogado.autor.tipo)}). No es una revisión humana independiente ni la sustituye.`, "");
  if (abogado.hipotesis.length) {
    s.push(...tabla(["Pregunta", ...abogado.hipotesis.map((h) => h.id)], abogado.hipotesis[0].comprobaciones.map((c, i) => fila(c.pregunta, ...abogado.hipotesis.map((h) => RES_TXT[h.comprobaciones[i]?.resultado] ?? "?")))), "");
    const detalles = abogado.hipotesis.flatMap((h) => h.comprobaciones.filter((k) => k.resultado === "alerta").map((k) => `${h.id} · ${k.pregunta} ${k.detalle}`));
    if (detalles.length) s.push("**Detalle de las alertas:**", "", ...lista(detalles), "");
  }

  if (exp.pendientes.length || exp.sin_huella.length) {
    s.push("## 9. Qué falta", "");
    s.push(...lista([...exp.pendientes.map((p) => `Fuente PENDIENTE ${p.id} (${p.titulo}): ${p.motivo ?? "sin motivo"}${p.referencia ? ` · ${p.referencia}` : ""}`), ...exp.sin_huella.map((id) => `Fuente ${id} consultada sin copia verificable (sin huella).`)]), "");
  }
  const h = L(inv.historial);
  s.push(`## ${exp.pendientes.length || exp.sin_huella.length ? 10 : 9}. Historial (${h.length} cambios, cadena de huellas)`, "");
  s.push(...tabla(["#", "Fecha", "Autor", "Acción", "Detalle", "Huella"], h.map((x, i) => fila(i + 1, x.fecha, `${x.autor?.identificador ?? "?"} (${x.autor?.tipo ?? "?"})`, x.accion, x.detalle ?? "", x.huella ? `${String(x.huella).slice(0, 16)}…` : "—"))), "");
  s.push(`_${VERSION_INFORME}. Qué se podía conocer y cuándo: la fecha que cuenta es la de disponibilidad (${L(inv.fuentes).filter((f) => fechaConocimiento(f)).length} fuentes con fecha)._`, "");
  return s.join("\n");
}
