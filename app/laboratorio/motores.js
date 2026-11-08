// Laboratorio de IA · fase 2 · lectura de SOLO LECTURA de lo que ya entregan los motores.
//
// El Laboratorio no llama a Compago, Ek Chuah ni a ningún otro motor: recibe el MISMO documento que ya lee la oficina
// (contrato `cauce.estado-proyecto` 1.x, ver contrato/CONTRATO.md), lo valida con el validador existente de Cauce y lo
// convierte, de forma determinista, en una «ficha»: un texto plano, una línea por hecho, que se puede citar literalmente.
// lab-V comprueba después cada cita contra esa ficha. Quien quiera auditar la ficha la recalcula con
// fichaDesdeEstado(documento) y compara la huella: el documento original queda fijado por su propia huella.
//
// Aquí no hay red, ni escritura, ni ejecución. Los textos del motor son DATOS: se recortan y se limpian de caracteres
// invisibles; nunca se interpretan como instrucciones.

import { validarDocumento } from "../nucleo/contrato.js";
import { jsonCanonico, sha256, L, esObj } from "./base.js";

export const VERSION_FICHA = "lab-ficha 0.1";
/** Motores que el Laboratorio sabe leer, y por qué contrato. Lo que no está aquí NO tiene integración. */
export const MOTORES = Object.freeze({
  compago: { nombre: "Compago", contrato: "cauce.estado-proyecto", integracion: "solo_lectura" },
  "ek-chuah": { nombre: "Ek Chuah", contrato: "cauce.estado-proyecto", integracion: "solo_lectura" },
  csi: { nombre: "CSI", contrato: "cauce.estado-proyecto", integracion: "solo_lectura" },
});
/** Sin contrato ni datos que leer: se documenta, no se simula. */
export const MOTORES_SIN_INTEGRACION = Object.freeze({
  tezcatlipoca: "Sin repositorio accesible ni exportador al contrato cauce.estado-proyecto: no hay nada que leer.",
});

const INVISIBLES = /[\u0000-\u0008\u000b-\u001f\u007f\u00ad\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u2069\ufeff]/g;
/** Texto del motor → texto citable de una sola línea: sin invisibles, sin saltos, recortado. */
const limpio = (v, max = 90) => {
  const t = String(v ?? "").replace(INVISIBLES, "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};
const valorTexto = (v) => (v === null || v === undefined ? "sin valor informado" : typeof v === "number" ? String(v) : `«${limpio(v, 60)}»`);
const cuerpoId = (t) => String(t).toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "motor";

/**
 * Convierte un documento `cauce.estado-proyecto` en una ficha citable.
 * @param documento  el JSON tal cual lo entregó el motor (no se modifica)
 * @param opciones   { leido_en: instante con zona en que se leyó (lo pone quien lee, no el motor) }
 * @returns {Promise<{ok, errores, fuente?, copia?, hechos?, origen?}>}
 *   fuente: entrada de `fuentes_permitidas` (cauce.lab.encargo 0.1) · copia: { bytes, texto } para lab-V ·
 *   hechos: [{ tipo, linea, ... }] estructura de cada línea · origen: procedencia para el trabajo.
 */
export async function fichaDesdeEstado(documento, { leido_en } = {}) {
  const v = validarDocumento(documento);
  if (!v.valido) return { ok: false, errores: v.errores.map((t) => `El documento del motor no cumple el contrato v1: ${t}`) };
  const d = documento;
  const motor = d.proyecto.id;
  if (!MOTORES[motor]) return { ok: false, errores: [`El motor «${motor}» no tiene integración con el Laboratorio (solo ${Object.keys(MOTORES).join(", ")}).`] };
  const marca = d.es_demo ? "[DEMO]" : "[REAL]";
  const hechos = [];
  const pon = (tipo, linea, extra = {}) => hechos.push({ tipo, linea, ...extra });
  pon("lectura", `${marca} Ficha de solo lectura del motor «${limpio(d.proyecto.nombre, 60)}» (contrato ${d.contrato} ${d.version}), generada el ${d.generado_en} con vigencia de ${d.vigencia_segundos} segundos.`,
    { generado_en: d.generado_en, vigencia_segundos: d.vigencia_segundos });
  for (const dep of L(d.departamentos)) {
    const nd = limpio(dep.nombre, 60);
    for (const ind of L(dep.indicadores)) pon("indicador", `Departamento «${nd}» · indicador «${limpio(ind.etiqueta, 50)}» = ${valorTexto(ind.valor)}.`,
      { departamento: nd, departamento_id: dep.id, etiqueta: limpio(ind.etiqueta, 50), valor: ind.valor ?? null });
    for (const a of L(dep.agentes)) {
      const ev = esObj(a.evidencia) ? a.evidencia : null;
      const evTxt = ev ? `evidencia ${limpio(ev.origen, 40)} observada el ${ev.observado_en ?? "(sin fecha)"}` : "sin evidencia registrada";
      pon("agente", `Agente «${limpio(a.nombre, 50)}» del departamento «${nd}» en estado «${a.estado}»; ${evTxt}.`,
        { departamento: nd, departamento_id: dep.id, agente: limpio(a.nombre, 50), agente_id: a.id, estado: a.estado, evidencia: ev ? { origen: limpio(ev.origen, 40), observado_en: ev.observado_en ?? null } : null });
    }
  }
  for (const al of L(d.alertas)) pon("alerta", `Alerta de nivel «${limpio(al.nivel, 20)}» en «${limpio(al.departamento_id ?? "general", 40)}»: «${limpio(al.titulo, 120)}», creada el ${al.creada_en ?? "(sin fecha)"}.`,
    { nivel: al.nivel, departamento_id: al.departamento_id ?? null, titulo: limpio(al.titulo, 120), creada_en: al.creada_en ?? null });
  // Líneas repetidas harían ambigua una cita: se numeran (un motor sano no las produce).
  const vistas = new Map();
  for (const h of hechos) { const n = (vistas.get(h.linea) ?? 0) + 1; vistas.set(h.linea, n); if (n > 1) h.linea = `${h.linea.slice(0, -1)} (repetición ${n}).`; }
  const texto = `${hechos.map((h) => h.linea).join("\n")}\n`;
  const bytes = new TextEncoder().encode(texto);
  const huella = await sha256(texto);
  const sello = d.generado_en.replace(/[-:]/g, "").replace(/\.\d+/, "").toLowerCase();
  const fuente_id = `${d.es_demo ? "demo-" : ""}ficha-${cuerpoId(motor)}-${sello}`;
  return {
    ok: true, errores: [], avisos: v.avisos,
    fuente: { fuente_id, estado: "consultada", origen: "primaria", sha256: huella, texto_sha256: huella, publicada_en: d.generado_en, conocida_en: leido_en ?? null },
    copia: { bytes, texto },
    hechos,
    // Fase 3: ¿la ficha es una foto vieja? Para DEMO se mide contra el «ahora» simulado del documento (los DEMO
    // están escritos a mano con una fecha fija); para REAL, contra el instante en que se leyó.
    vigencia: vigenciaDe(d, leido_en),
    origen: {
      motor, nombre: MOTORES[motor].nombre, contrato: d.contrato, version: d.version, modo: "solo_lectura", es_demo: d.es_demo === true,
      generado_en: d.generado_en, leido_en: leido_en ?? null, sha256_documento: await sha256(jsonCanonico(d)), ficha: VERSION_FICHA, fuente_id,
    },
  };
}

function vigenciaDe(d, leido_en) {
  const referencia = d.es_demo && typeof d.demo?.ahora_simulado === "string" ? d.demo.ahora_simulado : leido_en ?? null;
  const edad = referencia ? (Date.parse(referencia) - Date.parse(d.generado_en)) / 1000 : NaN;
  if (!Number.isFinite(edad)) return { vencida: null, referencia, edad_segundos: null, vigencia_segundos: d.vigencia_segundos };
  return { vencida: edad > d.vigencia_segundos, referencia, referencia_es: referencia === leido_en ? "leido_en" : "ahora_simulado", edad_segundos: Math.round(edad), vigencia_segundos: d.vigencia_segundos };
}

/** Lectura vencida: la ficha se generó hace más de su vigencia respecto a `ahora` (instante con zona). */
export function lecturaVencida(hechos, ahora) {
  const h = L(hechos).find((x) => x.tipo === "lectura");
  if (!h) return null;
  const edad = (Date.parse(ahora) - Date.parse(h.generado_en)) / 1000;
  return Number.isFinite(edad) ? { vencida: edad > h.vigencia_segundos, edad_segundos: Math.round(edad), vigencia_segundos: h.vigencia_segundos } : null;
}

// ------------------------------------------------------------------ fase 3.1 · qué puede consumir el Laboratorio de una exportación
/**
 * Campos del contrato `cauce.estado-proyecto` 1.x que el Laboratorio USA en la ficha, los que el contrato trae y la
 * ficha aún NO usa, y los que NO existen en el contrato pero harían falta para análisis mejores. Solo lectura e
 * inventario: no inventa exportadores ni supone que un motor exporte algo que no exporta.
 */
export const CAMPOS_LABORATORIO = Object.freeze({
  usados: [
    { campo: "proyecto.id / proyecto.nombre", para: "identificar el motor y la ficha" },
    { campo: "generado_en / vigencia_segundos", para: "fecha de la lectura y lectura vencida (lab-V)" },
    { campo: "es_demo / demo.ahora_simulado", para: "separar DEMO de REAL; «ahora» de la demostración" },
    { campo: "departamentos[].indicadores[].{etiqueta,valor}", para: "una línea citable por indicador" },
    { campo: "departamentos[].agentes[].{nombre,estado}", para: "una línea citable por agente" },
    { campo: "departamentos[].agentes[].evidencia.observado_en", para: "cuándo se observó el estado (origen + fecha)" },
    { campo: "alertas[].{nivel,departamento_id,titulo,creada_en}", para: "una línea citable por alerta" },
  ],
  no_usados: [
    { campo: "departamentos[].agentes[].error.mensaje", para: "el detalle del error que el Investigador hoy no puede citar", ruta: (d) => L(d.departamentos).some((x) => L(x.agentes).some((a) => typeof a.error?.mensaje === "string")) },
    { campo: "departamentos[].agentes[].actividad.{descripcion,inicio,fin}", para: "qué hacía y desde cuándo (duraciones, atascos)", ruta: (d) => L(d.departamentos).some((x) => L(x.agentes).some((a) => esObj(a.actividad))) },
    { campo: "departamentos[].agentes[].actividad.progreso", para: "avance medido por el motor (nunca estimado)", ruta: (d) => L(d.departamentos).some((x) => L(x.agentes).some((a) => esObj(a.actividad?.progreso))) },
    { campo: "departamentos[].agentes[].evidencia.referencia", para: "el registro concreto (id, archivo) que respalda el estado", ruta: (d) => L(d.departamentos).some((x) => L(x.agentes).some((a) => typeof a.evidencia?.referencia === "string")) },
    { campo: "departamentos[].indicadores[].{unidad,nota}", para: "leer bien un valor", ruta: (d) => L(d.departamentos).some((x) => L(x.indicadores).some((i) => "unidad" in i || "nota" in i)) },
    { campo: "departamentos[].descripcion", para: "de dónde salen los datos del departamento", ruta: (d) => L(d.departamentos).some((x) => typeof x.descripcion === "string") },
    { campo: "resultados[]", para: "resultados del motor (lo único que podría medir un acierto)", ruta: (d) => L(d.resultados).length > 0 },
    { campo: "fuente.{tipo,nombre,version}", para: "procedencia del exportador", ruta: (d) => esObj(d.fuente) },
  ],
  faltantes: [
    { campo: "departamentos[].indicadores[].observado_en", para: "saber de cuándo es cada valor (hoy solo hay generado_en global)" },
    { campo: "departamentos[].indicadores[].fuente", para: "qué consulta o archivo produjo el valor (citable)" },
    { campo: "alertas[].evidencia", para: "qué registro respalda la alerta" },
    { campo: "lecturas_anteriores[] o historial", para: "comparar dos lecturas sin que la IA lo haga de memoria" },
    { campo: "proyecto.version (del motor)", para: "saber con qué versión del motor se generó la lectura" },
  ],
});

/**
 * Inventario de un documento concreto: qué usa la ficha, qué trae y no se usa, qué falta.
 * @returns {{ok, errores, motor?, campos_usados?, campos_no_usados?: [{campo, para, presente}], campos_faltantes?}}
 */
export function comprobarExportacion(documento) {
  const v = validarDocumento(documento);
  if (!v.valido) return { ok: false, errores: v.errores.map((t) => `No cumple el contrato v1: ${t}`) };
  const motor = documento.proyecto.id;
  if (!MOTORES[motor]) return { ok: false, errores: [`El motor «${motor}» no tiene integración con el Laboratorio: ${MOTORES_SIN_INTEGRACION[motor] ?? `solo ${Object.keys(MOTORES).join(", ")}`}`] };
  return {
    ok: true, errores: [], motor, es_demo: documento.es_demo === true,
    campos_usados: CAMPOS_LABORATORIO.usados.map((c) => ({ ...c })),
    campos_no_usados: CAMPOS_LABORATORIO.no_usados.map(({ ruta, ...c }) => ({ ...c, presente: ruta(documento) })),
    campos_faltantes: CAMPOS_LABORATORIO.faltantes.map((c) => ({ ...c })),
  };
}
