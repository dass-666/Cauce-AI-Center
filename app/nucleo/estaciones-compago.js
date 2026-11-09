// Lector de la salida de SOLO LECTURA de la estación «Oportunidades Internacionales» de Compago
// (apps/internacional/estacion.py, `estado_internacional` 0.1.x, PR #26/#28 de Compago, sin fusionar al escribir esto).
//
// Compago todavía NO escribe esa salida en ningún archivo (su docstring lo dice: «No está conectado a exportar_cauce»).
// Este lector deja a Cauce preparado para cuando lo haga, con el sobre que pide contrato/ESTACIONES-CONTRATO.md:
//
//   { "contrato": "compago.estado-internacional", "version": "0.1.1", "proyecto": { "id": "compago" },
//     "generado_en": "…Z", "vigencia_segundos": 1800, "es_demo": false,
//     "departamento": <lo que devuelve estacion.estado(demo)> }
//
// y lo traduce a `cauce.estaciones` 0.1.0, que es lo único que dibuja la oficina. La traducción es conservadora:
// - Compago da CONTEOS por estado de la estación, no el estado de cada función: el reparto por puesto de abajo es una
//   lectura de Cauce (documentada), no algo que Compago afirme.
// - Ningún puesto queda «en_proceso»: Compago no registra ejecuciones con inicio y evidencia.
// - Sin enlaces: la salida de Compago no trae el id de la señal de Ek Chuah, así que no hay transferencia que cruzar.
// - Solo conteos enteros; cualquier otra clave se ignora.

import { CONTRATO_ESTACIONES, VERSION_ESTACIONES } from "./estaciones.js";

export const CONTRATO_COMPAGO_INTERNACIONAL = "compago.estado-internacional";

const ETIQUETAS = {
  acontecimiento_recibido: "Acontecimientos por revisar",
  investigacion_pendiente: "Investigaciones pendientes",
  evidencia_insuficiente: "Con evidencia insuficiente",
  evaluacion_disponible: "Evaluadas (no confirma rentabilidad)",
  riesgo_detectado: "Riesgos detectados",
};
const entero = (v) => (Number.isInteger(v) && v >= 0 ? v : null);

/**
 * @returns {{ ok: true, datos: object } | { ok: false, error: string }}  datos = documento cauce.estaciones 0.1.0
 */
export function estacionesDesdeCompago(doc, { estacionId = "internacional" } = {}) {
  if (!doc || typeof doc !== "object") return { ok: false, error: "No es un objeto JSON." };
  if (doc.contrato !== CONTRATO_COMPAGO_INTERNACIONAL) return { ok: false, error: `Contrato inesperado: ${doc.contrato}.` };
  if (!/^0\.1\.\d+$/.test(String(doc.version ?? ""))) return { ok: false, error: `Versión no soportada: ${doc.version} (se lee 0.1.x).` };
  const est = doc.departamento?.estacion;
  if (!est || typeof est !== "object") return { ok: false, error: "Falta departamento.estacion." };
  if (!/^0\.1\.\d+$/.test(String(est.version ?? ""))) return { ok: false, error: `estacion.version no soportada: ${est.version}.` };
  if (typeof doc.es_demo !== "boolean" || est.es_demo !== doc.es_demo) return { ok: false, error: "es_demo falta o no coincide entre el sobre y la estación." };
  const c = est.conteos ?? {};
  const n = (k) => entero(c[k]) ?? 0;

  const investigador = n("investigacion_pendiente") ? "investigacion_pendiente" : n("acontecimiento_recibido") ? "senal_recibida" : "sin_actividad";
  const importacion = n("riesgo_detectado") ? "riesgo_detectado" : n("evidencia_insuficiente") ? "datos_insuficientes" : "sin_actividad";
  const evaluador = n("evaluacion_disponible") ? "evaluacion_disponible" : "sin_actividad";
  const ref = { origen: "compago", referencia: `estado_internacional ${est.version}: conteos de la estación` };
  const puesto = (id, estado) => ({ id, estado, ...(estado === "sin_actividad" ? {} : { evidencia: ref }) });

  const conteos = Object.keys(ETIQUETAS).map((k) => ({ etiqueta: ETIQUETAS[k], valor: entero(c[k]) }));
  const pc = entero(est.detalle?.productos_candidatos);
  if (pc !== null) conteos.push({ etiqueta: "Productos candidatos", valor: pc });

  return {
    ok: true,
    datos: {
      contrato: CONTRATO_ESTACIONES,
      version: VERSION_ESTACIONES,
      proyecto: { id: doc.proyecto?.id ?? "compago" },
      generado_en: doc.generado_en,
      vigencia_segundos: doc.vigencia_segundos ?? 1800,
      es_demo: doc.es_demo,
      ...(doc.es_demo ? { demo: { ahora_simulado: doc.demo?.ahora_simulado ?? doc.generado_en } } : {}),
      fuente: doc.es_demo
        ? { tipo: "demo", nombre: "Salida DEMO de la estación de Compago (estado_internacional)" }
        : { tipo: "adaptador", nombre: "Compago · estado_internacional (solo lectura)" },
      estaciones: [{
        id: estacionId,
        contrato_origen: `${CONTRATO_COMPAGO_INTERNACIONAL} ${doc.version} (estacion ${est.version})`,
        nota: "Reparto por función hecho por Cauce a partir de los conteos de Compago; Compago no registra procesos en curso.",
        puestos: [puesto("investigador", investigador), puesto("importacion", importacion), puesto("evaluador", evaluador)],
        conteos: conteos.slice(0, 8),
      }],
    },
  };
}

/** Si la carga es la salida de Compago, la traduce; si no, la deja igual. Un error de traducción = archivo inválido. */
export function normalizarCargaEstaciones(carga) {
  if (carga?.tipo !== "ok" || carga.datos?.contrato !== CONTRATO_COMPAGO_INTERNACIONAL) return carga;
  const r = estacionesDesdeCompago(carga.datos);
  return r.ok ? { ...carga, datos: r.datos } : { tipo: "json_invalido", mensaje: `Salida de Compago: ${r.error}` };
}
