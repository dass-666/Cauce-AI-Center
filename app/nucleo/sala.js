// Sala de control (fase K): resumen de toda la empresa a partir de los modelos de vista de cada piso.
// Sin DOM (se prueba en Node). No calcula métricas nuevas: solo cuenta lo que ya dice cada archivo
// (contrato v1) después de las reglas de modelo.js. Nunca suma DEMO con REAL.

import { fotografia, compararLecturas } from "./cambios.js";
import { resumenDe } from "./modelo.js";

/** Estado de cada piso, con el mismo texto que usa el selector de proyectos. */
export const ESTADO_PISO = Object.freeze({
  real: { texto: "REAL", titulo: "Datos reales vigentes", orden: 3 },
  demo: { texto: "DEMO", titulo: "Solo datos de demostración", orden: 4 },
  desactualizado: { texto: "Vencido", titulo: "Datos fuera de su vigencia", orden: 1 },
  invalido: { texto: "Error", titulo: "El archivo de estado tiene errores", orden: 0 },
  desconectado: { texto: "Sin conexión", titulo: "Todavía no hay archivo de estado", orden: 5 },
  pendiente: { texto: "Pendiente", titulo: "Proyecto sin localizar: sin conexión", orden: 6 },
});

// Un cambio observado es "reciente" si esta página lo vio hace menos de 15 min.
export const VENTANA_RECIENTE_MS = 15 * 60 * 1000;

const PESO = { critica: 0, error: 0, invalido: 1, advertencia: 2, requiere_revision: 2, desactualizado: 3, info: 4 };

/**
 * Resumen de un piso. `entrada` es la del registro (puede traer `pendiente`); `m`, su modelo de vista
 * (o null si todavía no se leyó).
 */
export function resumirProyecto(entrada, m) {
  const base = { id: entrada.id, nombre: entrada.nombre, pendiente: entrada.pendiente ?? null, leido: Boolean(m) };
  if (!m) return { ...base, clave: entrada.pendiente ? "pendiente" : "desconectado", es_demo: false, vigente: false, departamentos: 0, agentes: 0, trabajando: 0, atencion: [], alertas: 0, errores_archivo: 0, edad_segundos: null, motivo: "Todavía no se ha leído." };
  let clave = resumenDe(m);
  if (clave === "desconectado" && entrada.pendiente) clave = "pendiente";
  const vigente = m.conexion === "en_linea";
  const agentes = m.departamentos.flatMap((d) => d.agentes.map((a) => ({ ...a, dep: d })));
  const atencion = [];
  for (const a of agentes) {
    if (a.estado_mostrado === "error" || a.estado_mostrado === "requiere_revision") {
      atencion.push({ tipo: "agente", nivel: a.estado_mostrado, titulo: `${a.nombre}: ${a.apariencia?.etiqueta ?? a.estado_mostrado}`,
        detalle: a.error?.mensaje ?? null, departamento_id: a.dep.id, departamento: a.dep.nombre, agente_id: a.id });
    }
  }
  const deps = new Map(m.departamentos.map((d) => [d.id, d.nombre]));
  for (const al of m.alertas) {
    atencion.push({ tipo: "alerta", nivel: al.nivel, titulo: al.titulo, detalle: al.detalle ?? null,
      departamento_id: deps.has(al.departamento_id) ? al.departamento_id : null, departamento: deps.get(al.departamento_id) ?? null });
  }
  if (m.conexion === "invalido") atencion.push({ tipo: "archivo", nivel: "invalido", titulo: "Archivo de estado con errores", detalle: m.motivo, departamento_id: null, departamento: null });
  if (m.conexion === "desactualizado") atencion.push({ tipo: "vencido", nivel: "desactualizado", titulo: "Información vencida", detalle: m.motivo, departamento_id: null, departamento: null });
  return {
    ...base,
    clave,
    es_demo: m.es_demo,
    vigente,
    solo_estructura: Boolean(m.solo_estructura),
    departamentos: m.departamentos.length,
    agentes: agentes.length,
    // estado_mostrado ya es "sin_datos" si el archivo no está vigente, y el contrato no deja "trabajando" sin evidencia.
    trabajando: agentes.filter((a) => a.estado_mostrado === "trabajando").length,
    atencion: atencion.map((x) => ({ ...x, es_demo: m.es_demo, vigente })),
    alertas: m.alertas.length,
    errores_archivo: m.errores.length,
    edad_segundos: m.edad_segundos,
    generado_en: m.generado_en,
    hora_simulada: m.hora_simulada,
    fuente: m.fuente?.nombre ?? null,
    conexion_etiqueta: m.conexion_etiqueta,
    motivo: m.motivo,
  };
}

/** Resumen de toda la empresa. DEMO y REAL se cuentan por separado. */
export function resumirEmpresa(resumenes, eventos = []) {
  const cuenta = (f) => resumenes.filter(f).length;
  const atencion = resumenes.flatMap((r) => r.atencion.map((a) => ({ ...a, proyecto_id: r.id, proyecto: r.nombre })))
    .sort((a, b) => (PESO[a.nivel] ?? 5) - (PESO[b.nivel] ?? 5) || Number(a.es_demo) - Number(b.es_demo) || Number(b.vigente) - Number(a.vigente));
  return {
    proyectos: resumenes.length,
    real: cuenta((r) => r.clave === "real"),
    demo: cuenta((r) => r.clave === "demo"),
    vencidos: cuenta((r) => r.clave === "desactualizado"),
    con_error: cuenta((r) => r.clave === "invalido"),
    sin_conexion: cuenta((r) => r.clave === "desconectado" || r.clave === "pendiente"),
    trabajando_real: resumenes.filter((r) => r.clave === "real").reduce((s, r) => s + r.trabajando, 0),
    trabajando_demo: resumenes.filter((r) => r.clave === "demo").reduce((s, r) => s + r.trabajando, 0),
    atencion,
    eventos,
    proyectos_lista: [...resumenes],
  };
}

/**
 * Bitácora de la sesión: cambios observados entre dos lecturas del MISMO proyecto, de todos los pisos.
 * Vive solo en memoria (se pierde al recargar) y no inventa pasos intermedios ni horas exactas.
 */
export function crearBitacora({ maximo = 80 } = {}) {
  const ultimas = new Map(); // proyecto → fotografía
  let lista = [];
  return {
    leer(modelo, ahoraMs = Date.now()) {
      const foto = fotografia(modelo);
      const nuevos = compararLecturas(ultimas.get(foto.proyecto) ?? null, foto)
        .map((c) => ({ ...c, proyecto_id: modelo.proyecto.id, proyecto: modelo.proyecto.nombre, observado_ms: ahoraMs }));
      ultimas.set(foto.proyecto, foto);
      if (nuevos.length) lista = [...nuevos.reverse(), ...lista].slice(0, maximo);
      return nuevos;
    },
    /** Eventos, del más nuevo al más viejo; filtro opcional por proyecto, departamento o agente. */
    eventos({ proyecto_id = null, departamento_id = null, agente_id = null } = {}) {
      return lista.filter((c) => (!proyecto_id || c.proyecto_id === proyecto_id)
        && (!departamento_id || c.departamento_id === departamento_id)
        && (!agente_id || c.agente_id === agente_id));
    },
  };
}

/**
 * Categoría de un cambio observado para el historial visual: error, finalizacion, vencida, alerta, estado,
 * fuente o conexion; y si es reciente (visto hace menos de VENTANA_RECIENTE_MS) o anterior en esta sesión.
 */
export function clasificarEvento(c, ahoraMs = Date.now()) {
  let categoria = "estado";
  if ((c.tipo === "estado" || c.tipo === "agente_nuevo") && c.a === "error") categoria = "error";
  else if (c.tipo === "alerta_nueva" && c.nivel === "critica") categoria = "error";
  else if ((c.tipo === "estado" || c.tipo === "agente_nuevo") && c.a === "finalizado") categoria = "finalizacion";
  else if (c.tipo === "conexion" && /desactualizad|vencid/i.test(c.a ?? "")) categoria = "vencida";
  else if (c.tipo === "conexion") categoria = "conexion";
  else if (c.tipo === "alerta_nueva" || c.tipo === "alerta_quitada") categoria = "alerta";
  else if (c.tipo === "fuente") categoria = "fuente";
  const reciente = Number.isFinite(c.observado_ms) && ahoraMs - c.observado_ms < VENTANA_RECIENTE_MS;
  return { categoria, etiqueta: ETIQUETA_CATEGORIA[categoria], reciente };
}

export const ETIQUETA_CATEGORIA = Object.freeze({
  error: "Error",
  finalizacion: "Finalización",
  vencida: "Información vencida",
  conexion: "Conexión",
  alerta: "Alerta",
  fuente: "Cambio de fuente",
  estado: "Cambio de estado",
});

/** Primer departamento (en el orden del archivo) que requiere atención después de `actual` (rotativo). */
export function siguienteConAtencion(departamentos, actual) {
  const conAtencion = departamentos.filter((d) => d.alertas.length > 0
    || d.agentes.some((a) => a.estado_mostrado === "error" || a.estado_mostrado === "requiere_revision"));
  if (conAtencion.length === 0) return null;
  const i = conAtencion.findIndex((d) => d.id === actual);
  return conAtencion[(i + 1) % conAtencion.length];
}
