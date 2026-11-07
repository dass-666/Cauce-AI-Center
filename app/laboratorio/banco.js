// Laboratorio de IA · fase 1 · generador DETERMINISTA del banco de errores sembrados (`lab-banco 0.1`).
//
// Toma un expediente CSI (p. ej. el caso publicado del franco suizo), aplica una lista de defectos controlados sobre
// una COPIA y produce tres documentos separados:
//   · evaluacion  → el expediente con defectos (lo único que verá el futuro Laboratorio);
//   · clave       → qué se cambió, dónde, y si las reglas actuales (motor CSI + Abogado del Diablo) ya lo detectan;
//   · manifiesto  → huellas SHA-256 de original, especificación, evaluación y clave, invariantes y aprobación pendiente.
// Nunca modifica el original, nunca toca fuentes ni cotejos (las 12 copias cotejadas y el registro pendiente de 2011
// quedan idénticos) y no ejecuta ninguna IA. Mide lo que las reglas NO ven; no sirve para medir predicción.

import { esObj, L, jsonCanonico, sha256, texto } from "./base.js";
import { construirDesdeExpediente } from "../csi/expediente.js";
import { revisarAbogado } from "../csi/abogado.js";

export const VERSION_BANCO = "lab-banco 0.1";
export const CONTRATO_ESPEC = "cauce.lab.banco-defectos";
export const CONTRATO_MANIFIESTO = "cauce.lab.banco";
/** Acciones que el banco NO puede tocar: fuentes y cotejos (huellas de las copias) quedan idénticos. */
const ACCIONES_PROTEGIDAS = ["agregar_fuente", "cotejar_fuente"];
const ENTIDAD = { agregar_enunciado: "enunciado", agregar_hipotesis: "hipotesis", agregar_incentivo: "incentivo", agregar_observacion: "observacion" };
export const CATEGORIAS = ["dato_alterado", "inferencia_como_hecho", "anacronismo", "intencion_sin_prueba", "conclusion_excede_evidencia",
  "sin_condicion_refutacion", "falsa_independencia", "contradiccion_interna", "calculo_erroneo", "cita_distorsionada", "otra"];

const clon = (v) => JSON.parse(JSON.stringify(v));
export const textoJSON = (v) => `${JSON.stringify(v, null, 2)}\n`;

function validarEspec(espec) {
  const e = [];
  if (!esObj(espec) || espec.contrato !== CONTRATO_ESPEC || espec.version_contrato !== "0.1") e.push(`especificación: contrato ${CONTRATO_ESPEC} 0.1.`);
  if (!texto(espec?.id)) e.push("especificación: id es obligatorio.");
  const ids = new Set();
  for (const [i, d] of L(espec?.defectos).entries()) {
    const r = `defectos[${i}]`;
    if (!/^D\d{2}$/.test(d?.id ?? "")) e.push(`${r}.id debe ser D01…D99.`);
    if (ids.has(d?.id)) e.push(`${r}.id repetido.`); ids.add(d?.id);
    if (!CATEGORIAS.includes(d?.categoria)) e.push(`${r}.categoria inválida.`);
    if (!texto(d?.descripcion)) e.push(`${r}.descripcion es obligatoria.`);
    if (ACCIONES_PROTEGIDAS.includes(d?.objetivo?.accion)) e.push(`${r}: no se pueden alterar fuentes ni cotejos.`);
    else if (!esObj(d?.objetivo) || !ENTIDAD[d.objetivo.accion] || !texto(d.objetivo.entidad_id)) e.push(`${r}.objetivo {accion (agregar_enunciado | agregar_hipotesis | agregar_incentivo | agregar_observacion), entidad_id}.`);
    if (!L(d?.cambios).length) e.push(`${r}.cambios: al menos uno.`);
    for (const [j, c] of L(d?.cambios).entries()) {
      if (!texto(c?.campo) || c.campo === "id") e.push(`${r}.cambios[${j}].campo inválido (el id no se cambia).`);
      if (!["reemplazar_texto", "fijar_valor"].includes(c?.operacion)) e.push(`${r}.cambios[${j}].operacion: reemplazar_texto | fijar_valor.`);
      if (c?.operacion === "reemplazar_texto" && (!texto(c.buscar) || typeof c.reemplazo !== "string")) e.push(`${r}.cambios[${j}]: reemplazar_texto necesita buscar y reemplazo.`);
      if (c?.operacion === "fijar_valor" && !("valor" in c)) e.push(`${r}.cambios[${j}]: fijar_valor necesita valor (null = quitar el campo).`);
    }
  }
  if (!L(espec?.defectos).length) e.push("especificación sin defectos.");
  return e;
}

function localizar(exp, objetivo) {
  const encontrados = [];
  for (const col of ["pasos", "pasos_finales"]) L(exp[col]).forEach((p, i) => {
    if (p.accion !== objetivo.accion) return;
    const ent = p.datos?.[ENTIDAD[p.accion]];
    const id = p.accion === "agregar_observacion" ? `${p.datos?.hipotesis_id}#${L(exp[col]).slice(0, i).filter((q) => q.accion === "agregar_observacion" && q.datos?.hipotesis_id === p.datos?.hipotesis_id).length + 1}` : ent?.id;
    if (id === objetivo.entidad_id) encontrados.push({ col, i, ent });
  });
  return encontrados;
}

/** Aplica UN defecto sobre `exp` (ya clonado). Devuelve {antes, despues, ubicacion} o lanza un error claro. */
function aplicarDefecto(exp, d) {
  const hall = localizar(exp, d.objetivo);
  if (hall.length !== 1) throw new Error(`${d.id}: el objetivo ${d.objetivo.accion}/${d.objetivo.entidad_id} aparece ${hall.length} veces (debe ser 1).`);
  const { col, i, ent } = hall[0];
  if (!esObj(ent)) throw new Error(`${d.id}: objetivo sin datos.`);
  const antes = {}, despues = {};
  for (const c of d.cambios) {
    antes[c.campo] = clon(ent[c.campo] ?? null);
    if (c.operacion === "reemplazar_texto") {
      const v = ent[c.campo];
      if (typeof v !== "string") throw new Error(`${d.id}: ${c.campo} no es texto.`);
      const n = v.split(c.buscar).length - 1;
      if (n !== 1) throw new Error(`${d.id}: «${c.buscar}» aparece ${n} veces en ${d.objetivo.entidad_id}.${c.campo} (debe ser exactamente 1).`);
      ent[c.campo] = v.replace(c.buscar, c.reemplazo);
    } else if (c.valor === null) delete ent[c.campo];
    else ent[c.campo] = clon(c.valor);
    despues[c.campo] = clon(ent[c.campo] ?? null);
  }
  return { antes, despues, ubicacion: `${col}[${i}] ${d.objetivo.accion} ${d.objetivo.entidad_id} (${d.cambios.map((c) => c.campo).join(", ")})` };
}

const comprobaciones = (inv) => {
  const m = new Map();
  for (const h of revisarAbogado(inv).hipotesis) for (const k of h.comprobaciones) m.set(`${h.id}·${k.id}`, k);
  return m;
};
const alertasAbogado = (inv) => revisarAbogado(inv).alertas_total;

/** Lo que las reglas actuales dicen del defecto: el motor lo rechaza al registrar, o el Abogado cambia una comprobación. */
async function lineaBase(original, invOriginal, d) {
  const exp = clon(original);
  aplicarDefecto(exp, d);
  const r = await construirDesdeExpediente(exp);
  if (!r.ok) return { motor_rechaza: true, errores_motor: r.errores.slice(0, 5), abogado_nuevas_alertas: [], detectado_por_reglas: true };
  const inv = r.docs.investigaciones.investigaciones[0];
  const a0 = comprobaciones(invOriginal), a1 = comprobaciones(inv);
  const nuevas = [...a1].filter(([k, c]) => c.resultado === "alerta" && a0.get(k)?.resultado !== "alerta").map(([k, c]) => `${k}: ${c.detalle}`);
  const cambiadas = [...a1].filter(([k, c]) => c.resultado === "alerta" && a0.get(k)?.resultado === "alerta" && a0.get(k)?.detalle !== c.detalle).map(([k]) => k);
  return { motor_rechaza: false, errores_motor: [], abogado_nuevas_alertas: nuevas, abogado_alertas_con_otro_detalle: cambiadas, detectado_por_reglas: nuevas.length > 0 };
}

function invariantes(original, evaluacion) {
  const prot = (exp) => [...L(exp.pasos), ...L(exp.pasos_finales)].filter((p) => ACCIONES_PROTEGIDAS.includes(p.accion)).map(jsonCanonico);
  const p0 = prot(original), p1 = prot(evaluacion);
  const fuentes = [...L(original.pasos), ...L(original.pasos_finales)].filter((p) => p.accion === "agregar_fuente").map((p) => p.datos.fuente);
  const huellas = new Set([...L(original.pasos), ...L(original.pasos_finales)].map((p) => p.datos?.huella_contenido ?? p.datos?.fuente?.huella_contenido).filter((h) => typeof h === "string"));
  const f2011 = fuentes.find((f) => f.id === "f-bns-2011") ?? null;
  return {
    pasos_protegidos_identicos: p0.length === p1.length && p0.every((x, i) => x === p1[i]),
    n_pasos_protegidos: p0.length,
    n_fuentes: fuentes.length,
    n_huellas_de_copias: huellas.size,
    f_bns_2011: f2011 ? { presente: true, estado: f2011.estado } : { presente: false, estado: null },
  };
}

/**
 * @param original  expediente `cauce.csi.expediente` (no se modifica)
 * @param espec     especificación `cauce.lab.banco-defectos` 0.1
 * @param textoOriginal  el archivo original tal cual (para su huella)
 */
export async function construirBanco(original, espec, { textoOriginal = null, nombreOriginal = null } = {}) {
  const errores = validarEspec(espec);
  if (errores.length) return { ok: false, errores };
  const huellaOriginalAntes = await sha256(jsonCanonico(original));
  const r0 = await construirDesdeExpediente(clon(original));
  if (!r0.ok) return { ok: false, errores: ["el expediente original no se reconstruye con el motor CSI:", ...r0.errores] };
  const inv0 = r0.docs.investigaciones.investigaciones[0];

  const evaluacion = clon(original);
  const defectos = [];
  try {
    for (const d of espec.defectos) {
      const cambio = aplicarDefecto(evaluacion, d);
      defectos.push({ id: d.id, categoria: d.categoria, descripcion: d.descripcion, ubicacion: cambio.ubicacion, antes: cambio.antes, despues: cambio.despues, como_se_detectaria: d.como_se_detectaria ?? null });
    }
  } catch (err) { return { ok: false, errores: [err.message] }; }
  evaluacion.nota = "Copia de EVALUACIÓN del Laboratorio de IA (banco de errores). Contiene alteraciones deliberadas: NO es el expediente publicado ni una fuente.";
  evaluacion.investigacion = { ...evaluacion.investigacion, titulo: `[BANCO DE EVALUACIÓN] ${evaluacion.investigacion.titulo}` };

  for (const [i, d] of espec.defectos.entries()) defectos[i].linea_base = await lineaBase(original, inv0, d);
  const rE = await construirDesdeExpediente(clon(evaluacion));
  const inv = invariantes(original, evaluacion);
  if (!inv.pasos_protegidos_identicos) return { ok: false, errores: ["los defectos alteraron fuentes o cotejos (prohibido)."] };
  if ((await sha256(jsonCanonico(original))) !== huellaOriginalAntes) return { ok: false, errores: ["el original cambió durante la generación (defecto del generador)."] };

  const clave = {
    contrato: "cauce.lab.banco-clave", version_contrato: "0.1", generador: VERSION_BANCO, banco_id: espec.id,
    aviso: "CLAVE DE RESPUESTAS. No debe estar al alcance de la sesión de IA que se evalúe (ni en su repositorio, ni en su carpeta de proyecto).",
    defectos,
    resumen: {
      n_defectos: defectos.length,
      detectados_por_reglas_actuales: defectos.filter((d) => d.linea_base.detectado_por_reglas).map((d) => d.id),
      no_detectados_por_reglas_actuales: defectos.filter((d) => !d.linea_base.detectado_por_reglas).map((d) => d.id),
      abogado_alertas_original: alertasAbogado(inv0),
      abogado_alertas_evaluacion: rE.ok ? alertasAbogado(rE.docs.investigaciones.investigaciones[0]) : null,
      evaluacion_reconstruible: rE.ok,
      errores_motor_evaluacion: rE.ok ? [] : rE.errores.slice(0, 10),
    },
  };
  const tEval = textoJSON(evaluacion), tClave = textoJSON(clave);
  const manifiesto = {
    contrato: CONTRATO_MANIFIESTO, version_contrato: "0.1", generador: VERSION_BANCO, banco_id: espec.id,
    original: { archivo: nombreOriginal, sha256_archivo: textoOriginal === null ? null : await sha256(textoOriginal), sha256_canonico: huellaOriginalAntes },
    especificacion: { sha256_canonico: await sha256(jsonCanonico(espec)) },
    evaluacion: { archivo: "evaluacion/expediente-evaluacion.json", sha256: await sha256(tEval) },
    clave: { archivo: "clave/clave-respuestas.json", sha256: await sha256(tClave) },
    n_defectos: defectos.length,
    invariantes: inv,
    aprobacion: { estado: "pendiente_revision_diego", aprobado_por: null, aprobado_en: null },
    reglas_de_uso: [
      "Diego revisa la clave y aprueba el banco ANTES de cualquier corrida; la huella de la clave queda registrada aquí.",
      "La sesión de IA evaluada recibe solo evaluacion/; clave/ y la especificación se guardan fuera de su alcance.",
      "El banco mide errores que las reglas actuales no ven; no mide si la IA conoce el desenlace del caso.",
    ],
  };
  return { ok: true, evaluacion, clave, manifiesto, textos: { evaluacion: tEval, clave: tClave, manifiesto: textoJSON(manifiesto) } };
}

/** Vuelve a comprobar un banco ya escrito: huellas de evaluación y clave contra el manifiesto. */
export async function comprobarBanco({ manifiesto, textoEvaluacion, textoClave }) {
  const p = [];
  if (manifiesto?.contrato !== CONTRATO_MANIFIESTO) p.push("manifiesto: contrato inválido.");
  if ((await sha256(textoEvaluacion ?? "")) !== manifiesto?.evaluacion?.sha256) p.push("la evaluación no coincide con su huella del manifiesto (cambió después de generarse).");
  if ((await sha256(textoClave ?? "")) !== manifiesto?.clave?.sha256) p.push("la clave no coincide con su huella del manifiesto (cambió después de generarse).");
  if (!manifiesto?.invariantes?.pasos_protegidos_identicos) p.push("el manifiesto no certifica fuentes y cotejos intactos.");
  return { ok: p.length === 0, problemas: p };
}
