// Convierte "lo que se cargó" (archivo del adaptador + distribución de la escena) en un
// modelo de vista neutral. La vista 2D lo dibuja hoy; la vista 3D lo dibujará después,
// sin repetir reglas: aquí se decide qué es confiable y qué estado se muestra.

import { validarDocumento } from "./contrato.js";
import { ESTADOS, CONEXION, estadoResumen } from "./estados.js";

/**
 * Elige qué archivo mostrar. Regla: los datos reales mandan siempre que el archivo exista,
 * aunque sea inválido o viejo (así se ve el problema). La demostración solo se usa cuando
 * el adaptador todavía no ha generado ningún archivo real.
 */
export function elegirCarga(real, demo) {
  if (real.tipo === "no_encontrado" && demo && demo.tipo !== "no_encontrado") {
    // Separación estricta: lo que se lee del lugar de la demostración tiene que decir que es demostración.
    if (demo.tipo === "ok" && demo.datos?.es_demo !== true) {
      return { carga: { tipo: "json_invalido", mensaje: "El archivo de demostración no está marcado como demostración (es_demo: true); no se muestra." }, origen: "demo", nota: null };
    }
    return { carga: demo, origen: "demo", nota: "Todavía no hay datos reales de este proyecto: se muestra la demostración." };
  }
  return { carga: real, origen: "real", nota: null };
}

// Tolerancia para relojes desfasados entre la PC y el adaptador.
export const TOLERANCIA_FUTURO_SEGUNDOS = 300;

/**
 * @param {object} p
 * @param {{id:string,nombre:string}} p.proyecto   Entrada del registro de proyectos.
 * @param {{tipo:"ok",datos:any}|{tipo:"no_encontrado"|"error_red"|"json_invalido",mensaje?:string}} p.carga
 * @param {object|null} p.distribucion            Distribución de la escena (opcional).
 * @param {Date} p.ahora                           Hora real de la computadora.
 */
export function construirModeloVista({ proyecto, carga, distribucion = null, ahora, nota_origen = null, origen = "demo" }) {
  const base = {
    nota_origen,
    proyecto: { id: proyecto.id, nombre: proyecto.nombre, ...(proyecto.color ? { color: proyecto.color } : {}), ...(proyecto.estilo ? { estilo: proyecto.estilo } : {}), ...(proyecto.pendiente ? { pendiente: proyecto.pendiente } : {}) },
    es_demo: false,
    ahora_referencia: ahora.toISOString(),
    hora_simulada: false,
    generado_en: null,
    edad_segundos: null,
    fuente: null,
    conexion: "desconectado",
    conexion_etiqueta: CONEXION.desconectado.etiqueta,
    motivo: null,
    errores: [],
    avisos: [],
    departamentos: [],
    alertas: [],
    resultados: [],
    cuadricula: cuadricula(distribucion),
  };

  if (carga.tipo !== "ok") {
    const motivos = {
      no_encontrado: "No existe el archivo de estado de este proyecto. Su adaptador todavía no lo ha generado.",
      error_red: "No se pudo leer el archivo de estado.",
      json_invalido: "El archivo de estado no es JSON válido.",
    };
    const conexion = carga.tipo === "json_invalido" ? "invalido" : "desconectado";
    // Que el archivo todavía no exista no es un error del archivo: el motivo ya lo explica.
    const errores = carga.mensaje && carga.tipo !== "no_encontrado" ? [carga.mensaje] : [];
    const sinDatos = conMotivo(base, conexion, motivos[carga.tipo] ?? "Sin datos.", errores);
    return conexion === "desconectado" ? conEstructura(sinDatos, distribucion) : sinDatos;
  }

  const r = validarDocumento(carga.datos);
  if (!r.valido) return conMotivo(base, "invalido", "El archivo no cumple el contrato de datos.", r.errores);

  const doc = r.documento;
  if (doc.proyecto.id !== proyecto.id)
    return conMotivo(base, "invalido", `El archivo pertenece a "${doc.proyecto.id}", no a "${proyecto.id}".`, []);

  // En demostración, el reloj es el simulado del archivo (para que el ejemplo no "caduque").
  const referencia = doc.es_demo ? new Date(doc.demo.ahora_simulado) : ahora;
  // Una DEMO que un adaptador escribe en datos/reales/ (por ejemplo, un piloto local con datos sintéticos) se
  // juzga con el reloj real: si el adaptador se detiene, se ve «Datos desactualizados» en vez de quedar
  // «En línea» para siempre. Las demos fijas de datos/demo/ siguen usando su hora simulada.
  const reloj = doc.es_demo && origen === "real" ? ahora : referencia;
  const edad = Math.round((reloj - new Date(doc.generado_en)) / 1000);

  let conexion = "en_linea";
  let motivo = null;
  if (edad < -TOLERANCIA_FUTURO_SEGUNDOS) {
    conexion = "invalido";
    motivo = "La hora del archivo está en el futuro: revisa el reloj de la computadora o del adaptador.";
  } else if (edad > doc.vigencia_segundos) {
    conexion = "desactualizado";
    motivo = `El último dato tiene ${describirDuracion(edad)} y su vigencia es de ${describirDuracion(doc.vigencia_segundos)}.`;
  }
  const confiable = conexion === "en_linea";

  const departamentos = doc.departamentos.map((dep) => {
    const agentes = dep.agentes.map((a) => {
      const estado = confiable ? a.estado : "sin_datos";
      return {
        ...a,
        estado_mostrado: estado,
        // Si los datos no son confiables, se conserva el último estado conocido solo como referencia.
        ultimo_estado_conocido: confiable ? null : a.estado,
        apariencia: ESTADOS[estado],
      };
    });
    const resumen = estadoResumen(agentes.map((a) => a.estado_mostrado));
    return {
      ...dep,
      agentes,
      posicion: posicionDe(distribucion, dep.id),
      estado_resumen: resumen,
      apariencia_resumen: ESTADOS[resumen],
      alertas: doc.alertas.filter((al) => al.departamento_id === dep.id),
      resultados: doc.resultados.filter((re) => re.departamento_id === dep.id),
    };
  });

  acomodarSinPosicion(departamentos, base.cuadricula.columnas);

  return {
    ...base,
    es_demo: doc.es_demo,
    ahora_referencia: referencia.toISOString(),
    hora_simulada: doc.es_demo,
    generado_en: doc.generado_en,
    edad_segundos: edad,
    vigencia_segundos: doc.vigencia_segundos,
    fuente: doc.fuente,
    version_contrato: doc.version,
    conexion,
    conexion_etiqueta: CONEXION[conexion].etiqueta,
    motivo,
    avisos: r.avisos,
    departamentos,
    alertas: doc.alertas,
    resultados: doc.resultados,
  };
}

/**
 * Proyecto preparado pero sin adaptador: si su distribución (escena/<id>.json) trae el "nombre" de cada
 * departamento (sacado de un inventario de su repositorio), se dibujan los cuartos vacíos. No hay
 * personajes, estados, alertas ni cifras: solo la estructura conocida, marcada como tal.
 */
export function conEstructura(m, dist) {
  const deps = dist?.departamentos && typeof dist.departamentos === "object" ? dist.departamentos : null;
  const conNombre = deps ? Object.entries(deps).filter(([id, d]) => typeof d?.nombre === "string" && d.nombre.trim() && /^[a-z0-9][a-z0-9_-]{0,39}$/.test(id)) : [];
  if (conNombre.length === 0) return m;
  const departamentos = conNombre.slice(0, 50).map(([id, d]) => ({
    id,
    nombre: d.nombre.trim().slice(0, 60),
    descripcion: typeof d.descripcion === "string" ? d.descripcion.trim().slice(0, 240) : null,
    indicadores: [],
    agentes: [],
    posicion: posicionDe(dist, id),
    estado_resumen: "sin_datos",
    apariencia_resumen: ESTADOS.sin_datos,
    alertas: [],
    resultados: [],
    solo_estructura: true,
  }));
  acomodarSinPosicion(departamentos, m.cuadricula.columnas);
  const fuente = typeof dist.inventario === "string" ? ` (${dist.inventario.trim().slice(0, 120)})` : "";
  return {
    ...m,
    solo_estructura: true,
    departamentos,
    nota_origen: `Se muestran solo los departamentos conocidos por inventario${fuente}. No hay datos ni actividad: ningún personaje representa trabajo.`,
  };
}

/** Resumen de un piso para el selector: "real", "demo", "desactualizado", "invalido" o "desconectado". */
export function resumenDe(m) {
  // Una DEMO vencida (adaptador de piloto detenido) se marca como vencida, no como DEMO vigente.
  if (m.es_demo) return m.conexion === "invalido" || m.conexion === "desactualizado" ? m.conexion : "demo";
  if (m.conexion === "en_linea") return "real";
  return ["desactualizado", "invalido"].includes(m.conexion) ? m.conexion : "desconectado";
}

function conMotivo(base, conexion, motivo, errores) {
  return { ...base, conexion, conexion_etiqueta: CONEXION[conexion].etiqueta, motivo, errores };
}

function cuadricula(dist) {
  const c = dist && dist.cuadricula;
  return {
    columnas: Number.isInteger(c?.columnas) && c.columnas > 0 ? c.columnas : 3,
    filas: Number.isInteger(c?.filas) && c.filas > 0 ? c.filas : null,
    // Escala sugerida para 3D: 1 celda = N metros.
    metros_por_celda: Number.isFinite(c?.metros_por_celda) ? c.metros_por_celda : 4,
  };
}

/** Posición del departamento en celdas según la distribución; null si no la tiene. */
export function posicionDe(dist, id) {
  const p = dist?.departamentos?.[id];
  const ok = p && [p.x, p.y, p.ancho, p.alto].every((n) => Number.isInteger(n)) && p.x >= 0 && p.y >= 0 && p.ancho > 0 && p.alto > 0;
  if (!ok) return null;
  return { x: p.x, y: p.y, ancho: p.ancho, alto: p.alto, piso: Number.isInteger(p.piso) ? p.piso : 0, automatica: false,
    // Fase L (opcional): tema visual del departamento declarado en la escena; si falta, identidad.js lo adivina.
    ...(typeof p.tema === "string" && /^[a-z-]{2,30}$/.test(p.tema) ? { tema: p.tema } : {}) };
}

/** Los departamentos que la distribución no menciona se acomodan en filas nuevas, debajo de los demás. */
export function acomodarSinPosicion(departamentos, columnas) {
  let filaLibre = 0;
  for (const d of departamentos) if (d.posicion) filaLibre = Math.max(filaLibre, d.posicion.y + d.posicion.alto);
  let k = 0;
  for (const d of departamentos) {
    if (d.posicion) continue;
    d.posicion = { x: k % columnas, y: filaLibre + Math.floor(k / columnas), ancho: 1, alto: 1, piso: 0, automatica: true };
    k++;
  }
}

export function describirDuracion(segundos) {
  const s = Math.abs(segundos);
  if (s < 90) return `${s} s`;
  if (s < 5400) return `${Math.round(s / 60)} min`;
  if (s < 172800) return `${Math.round(s / 3600)} h`;
  return `${Math.round(s / 86400)} días`;
}
