// Validación del contrato "cauce.estado-proyecto" (ver contrato/CONTRATO.md).
// Sin dependencias: funciona igual en el navegador y en Node.
//
// Dos niveles:
//  - errores: el archivo no cumple el contrato -> el proyecto se muestra como "archivo inválido".
//  - avisos: un dato puntual no es confiable -> se corrige hacia lo más prudente
//    (por ejemplo, "trabajando" sin evidencia se muestra como "sin información").

import { NOMBRES_ESTADOS } from "./estados.js";

export const CONTRATO_ID = "cauce.estado-proyecto";
export const VERSION_MAYOR_SOPORTADA = 1;
export const VIGENCIA_MIN = 30;
export const VIGENCIA_MAX = 7 * 24 * 3600;
const MAX_DEPARTAMENTOS = 50;
const MAX_AGENTES = 30;
const MAX_TEXTO = 500;

const RE_ID = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const RE_VERSION = /^(\d+)\.(\d+)\.(\d+)$/;
// Fecha y hora en UTC con "Z" (como 2026-11-03T02:10:00Z). Se exige la zona para no adivinarla.
const RE_FECHA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$/;
const NIVELES_ALERTA = ["info", "advertencia", "critica"];

const esObjeto = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const esTexto = (v, max = MAX_TEXTO) => typeof v === "string" && v.trim().length > 0 && v.length <= max;

export function esFecha(v) {
  return typeof v === "string" && RE_FECHA.test(v) && !Number.isNaN(Date.parse(v));
}

/** Enlace seguro: relativo al visualizador o http(s). Nunca javascript:, data:, file:, etc. */
export function esEnlaceSeguro(v) {
  if (typeof v !== "string" || v.length === 0 || v.length > 2000) return false;
  if (/^https?:\/\//i.test(v)) return true;
  // Relativo: sin esquema ("algo:") y sin "//" inicial (que apuntaría a otro sitio).
  return !/^[a-z][a-z0-9+.-]*:/i.test(v) && !v.startsWith("//") && !v.startsWith("\\");
}

/**
 * Valida y normaliza un documento.
 * @returns {{valido: boolean, errores: string[], avisos: string[], documento: object|null}}
 */
export function validarDocumento(entrada) {
  const errores = [];
  const avisos = [];
  const err = (m) => errores.push(m);

  if (!esObjeto(entrada)) {
    return { valido: false, errores: ["El archivo no contiene un objeto JSON."], avisos, documento: null };
  }
  const d = entrada;

  if (d.contrato !== CONTRATO_ID) err(`"contrato" debe ser "${CONTRATO_ID}".`);
  const v = typeof d.version === "string" ? d.version.match(RE_VERSION) : null;
  if (!v) err('"version" debe tener la forma 1.0.0.');
  else if (Number(v[1]) !== VERSION_MAYOR_SOPORTADA)
    err(`Versión ${d.version} no compatible: este visualizador entiende la versión ${VERSION_MAYOR_SOPORTADA}.x.`);

  if (!esObjeto(d.proyecto) || !RE_ID.test(d.proyecto.id ?? "") || !esTexto(d.proyecto.nombre, 80))
    err('"proyecto" necesita "id" (minúsculas, números, - o _) y "nombre".');

  if (!esFecha(d.generado_en)) err('"generado_en" debe ser fecha y hora UTC terminada en Z.');
  if (!Number.isInteger(d.vigencia_segundos) || d.vigencia_segundos < VIGENCIA_MIN || d.vigencia_segundos > VIGENCIA_MAX)
    err(`"vigencia_segundos" debe ser un entero entre ${VIGENCIA_MIN} y ${VIGENCIA_MAX}.`);

  if (typeof d.es_demo !== "boolean") err('"es_demo" es obligatorio y debe ser true o false.');
  if (d.es_demo === true) {
    if (!esObjeto(d.demo) || !esFecha(d.demo.ahora_simulado))
      err('Un archivo de demostración necesita "demo.ahora_simulado" (fecha UTC).');
  } else if (d.demo !== undefined) {
    err('"demo" solo se permite cuando "es_demo" es true.');
  }

  if (!esObjeto(d.fuente) || !["demo", "adaptador"].includes(d.fuente.tipo) || !esTexto(d.fuente.nombre, 120))
    err('"fuente" necesita "tipo" ("demo" o "adaptador") y "nombre".');
  else if ((d.fuente.tipo === "demo") !== (d.es_demo === true))
    err('"fuente.tipo" = "demo" debe coincidir con "es_demo" = true (y "adaptador" con false).');

  if (!Array.isArray(d.departamentos) || d.departamentos.length === 0 || d.departamentos.length > MAX_DEPARTAMENTOS)
    err(`"departamentos" debe ser una lista de 1 a ${MAX_DEPARTAMENTOS} elementos.`);

  if (errores.length) return { valido: false, errores, avisos, documento: null };

  const idsDep = new Set();
  const idsAg = new Set();
  const departamentos = d.departamentos.map((dep, i) => {
    const lugar = `departamentos[${i}]`;
    if (!esObjeto(dep) || !RE_ID.test(dep.id ?? "") || !esTexto(dep.nombre, 80)) {
      err(`${lugar}: necesita "id" y "nombre".`);
      return null;
    }
    if (idsDep.has(dep.id)) err(`${lugar}: id "${dep.id}" repetido.`);
    idsDep.add(dep.id);
    const agentes = Array.isArray(dep.agentes) ? dep.agentes : (err(`${lugar}: "agentes" debe ser una lista.`), []);
    if (agentes.length > MAX_AGENTES) err(`${lugar}: máximo ${MAX_AGENTES} personajes.`);
    return {
      id: dep.id,
      nombre: dep.nombre,
      descripcion: esTexto(dep.descripcion) ? dep.descripcion : null,
      indicadores: normalizarIndicadores(dep.indicadores, lugar, avisos),
      agentes: agentes.map((a, j) => normalizarAgente(a, `${lugar}.agentes[${j}]`, idsAg, err, avisos)).filter(Boolean),
    };
  });

  if (errores.length) return { valido: false, errores, avisos, documento: null };

  const alertas = lista(d.alertas, "alertas", err)
    .map((a, i) => {
      const lugar = `alertas[${i}]`;
      if (!esObjeto(a) || !esTexto(a.id, 64) || !NIVELES_ALERTA.includes(a.nivel) || !esTexto(a.titulo, 160) || !esFecha(a.creada_en)) {
        avisos.push(`${lugar}: incompleta (id, nivel, titulo, creada_en); se omite.`);
        return null;
      }
      return {
        id: a.id,
        nivel: a.nivel,
        titulo: a.titulo,
        detalle: esTexto(a.detalle) ? a.detalle : null,
        departamento_id: idsDep.has(a.departamento_id) ? a.departamento_id : null,
        agente_id: idsAg.has(a.agente_id) ? a.agente_id : null,
        creada_en: a.creada_en,
      };
    })
    .filter(Boolean);

  const resultados = lista(d.resultados, "resultados", err)
    .map((r, i) => {
      const lugar = `resultados[${i}]`;
      if (!esObjeto(r) || !esTexto(r.id, 64) || !esTexto(r.titulo, 160)) {
        avisos.push(`${lugar}: incompleto (id, titulo); se omite.`);
        return null;
      }
      let enlace = null;
      if (r.enlace !== undefined && r.enlace !== null) {
        if (esEnlaceSeguro(r.enlace)) enlace = r.enlace;
        else avisos.push(`${lugar}: enlace no permitido; se quita.`);
      }
      return {
        id: r.id,
        titulo: r.titulo,
        descripcion: esTexto(r.descripcion) ? r.descripcion : null,
        departamento_id: idsDep.has(r.departamento_id) ? r.departamento_id : null,
        creado_en: esFecha(r.creado_en) ? r.creado_en : null,
        enlace,
      };
    })
    .filter(Boolean);

  if (errores.length) return { valido: false, errores, avisos, documento: null };

  return {
    valido: true,
    errores,
    avisos,
    documento: {
      contrato: d.contrato,
      version: d.version,
      proyecto: { id: d.proyecto.id, nombre: d.proyecto.nombre },
      generado_en: d.generado_en,
      vigencia_segundos: d.vigencia_segundos,
      es_demo: d.es_demo,
      demo: d.es_demo ? { ahora_simulado: d.demo.ahora_simulado } : null,
      fuente: { tipo: d.fuente.tipo, nombre: d.fuente.nombre, version: esTexto(d.fuente.version, 40) ? d.fuente.version : null },
      departamentos,
      alertas,
      resultados,
    },
  };
}

function lista(v, nombre, err) {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) {
    err(`"${nombre}" debe ser una lista.`);
    return [];
  }
  return v;
}

function normalizarIndicadores(v, lugar, avisos) {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) {
    avisos.push(`${lugar}: "indicadores" no es una lista; se ignora.`);
    return [];
  }
  return v
    .map((ind, k) => {
      const okValor = ind && (ind.valor === null || typeof ind.valor === "string" || Number.isFinite(ind.valor));
      if (!esObjeto(ind) || !esTexto(ind.etiqueta, 60) || !okValor) {
        avisos.push(`${lugar}.indicadores[${k}]: incompleto; se omite.`);
        return null;
      }
      return {
        etiqueta: ind.etiqueta,
        valor: ind.valor,
        unidad: esTexto(ind.unidad, 20) ? ind.unidad : null,
        nota: esTexto(ind.nota) ? ind.nota : null,
      };
    })
    .filter(Boolean);
}

function normalizarAgente(a, lugar, idsAg, err, avisos) {
  if (!esObjeto(a) || !RE_ID.test(a.id ?? "") || !esTexto(a.nombre, 60) || !esTexto(a.rol, 160)) {
    err(`${lugar}: necesita "id", "nombre" y "rol".`);
    return null;
  }
  if (idsAg.has(a.id)) err(`${lugar}: id "${a.id}" repetido en el proyecto.`);
  idsAg.add(a.id);
  if (!NOMBRES_ESTADOS.includes(a.estado)) {
    err(`${lugar}: estado "${a.estado}" no existe (${NOMBRES_ESTADOS.join(", ")}).`);
    return null;
  }

  let estado = a.estado;
  const notas = [];
  const aviso = (m) => {
    avisos.push(`${lugar} (${a.id}): ${m}`);
    notas.push(m);
  };

  let actividad = null;
  if (esObjeto(a.actividad)) {
    const act = a.actividad;
    actividad = {
      descripcion: esTexto(act.descripcion) ? act.descripcion : null,
      inicio: esFecha(act.inicio) ? act.inicio : null,
      fin: esFecha(act.fin) ? act.fin : null,
      progreso: null,
    };
    if (act.inicio !== undefined && act.inicio !== null && !actividad.inicio) aviso("fecha de inicio inválida; se omite.");
    if (act.fin !== undefined && act.fin !== null && !actividad.fin) aviso("fecha de fin inválida; se omite.");
    if (actividad.inicio && actividad.fin && Date.parse(actividad.fin) < Date.parse(actividad.inicio)) {
      aviso("la fecha de fin es anterior al inicio; se omite el fin.");
      actividad.fin = null;
    }
    if (act.progreso !== undefined && act.progreso !== null) {
      const p = act.progreso;
      const ok = esObjeto(p) && Number.isInteger(p.hecho) && Number.isInteger(p.total) && p.total > 0 && p.hecho >= 0 && p.hecho <= p.total;
      if (ok) actividad.progreso = { hecho: p.hecho, total: p.total, unidad: esTexto(p.unidad, 30) ? p.unidad : null };
      else aviso("progreso incoherente (se requiere 0 ≤ hecho ≤ total y total > 0); no se muestra.");
    }
  }

  let evidencia = null;
  if (esObjeto(a.evidencia) && esTexto(a.evidencia.origen, 120) && esTexto(a.evidencia.referencia, 200)) {
    evidencia = {
      origen: a.evidencia.origen,
      referencia: a.evidencia.referencia,
      observado_en: esFecha(a.evidencia.observado_en) ? a.evidencia.observado_en : null,
    };
  } else if (a.evidencia !== undefined && a.evidencia !== null) {
    aviso("evidencia incompleta (origen y referencia); se ignora.");
  }

  // Regla central: nadie aparece trabajando sin un registro que lo respalde.
  if (estado === "trabajando" && (!evidencia || !actividad || !actividad.inicio)) {
    aviso('"trabajando" sin evidencia o sin hora de inicio: se muestra como "sin información".');
    estado = "sin_datos";
  }
  if (estado === "trabajando" && actividad && actividad.fin) {
    aviso('"trabajando" con fecha de fin: se ignora el fin.');
    actividad.fin = null;
  }

  let error = null;
  if (esObjeto(a.error) && esTexto(a.error.mensaje, 1000)) {
    error = { mensaje: a.error.mensaje, codigo: esTexto(a.error.codigo, 60) ? a.error.codigo : null };
  }
  if (estado === "error" && !error) {
    aviso("estado de error sin mensaje.");
    error = { mensaje: "El adaptador no informó el detalle del error.", codigo: null };
  }

  return {
    id: a.id,
    nombre: a.nombre,
    rol: a.rol,
    estado,
    estado_reportado: a.estado,
    actividad,
    evidencia,
    error,
    notas,
  };
}
