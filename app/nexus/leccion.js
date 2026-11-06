// Contrato `cauce.leccion` 0.2 (PROVISIONAL: reconstruido sin el documento maestro v0.2; ver docs/NEXUS-FASE-1.md).
// Una lección es una VERSIÓN inmutable: corregir = agregar la revisión siguiente, nunca editar ni borrar.
// Este archivo solo valida la forma. Lo que la evidencia sostiene lo decide el gerente escéptico (gerente.js).

import { esFechaConZona, esActor, texto, buscarDatosPrivados } from "./comun.js";

export const CONTRATO_LECCION = "cauce.leccion";
export const VERSION_LECCION = "0.2.0";

export const TIPOS_CAMBIO = ["alta", "correccion", "revision", "retiro"];
export const NATURALEZAS = ["exito", "fracaso", "neutro", "mixto", "inconcluso"];
/** De menor a mayor: hipótesis < validada en su proyecto de origen < validada de forma independiente en el destino. */
export const NIVELES = ["hipotesis", "validada_en_origen", "validada_independiente_en_destino"];
export const TIPOS_EVIDENCIA = ["experimento", "registro", "metrica", "documento", "afirmacion"];
export const USOS_EVIDENCIA = ["conclusion", "validacion"];
export const RELACIONES = ["apoya", "deriva_de", "contradice", "reemplaza"];
export const RESULTADOS_VALIDACION = ["confirma", "refuta", "inconcluso"];
export const EVALUACIONES = ["en_muestra", "fuera_de_muestra", "validacion_cruzada", "desconocida"];

const CAMPOS = new Set(["contrato", "version_contrato", "id", "revision", "tipo_cambio", "motivo_cambio", "es_demo", "registrado_en", "registrado_por",
  "autor_conclusion", "fecha_conclusion", "titulo", "enunciado", "proyecto_origen", "proyectos_destino", "naturaleza_resultado", "nivel_validacion",
  "declara_reproducible", "evidencias", "antecedentes", "validaciones", "vigencia", "huella_anterior"]);
const ID_LECCION = /^lec-[a-z0-9][a-z0-9-]{2,62}$/;
const ID_PROYECTO = /^[a-z0-9][a-z0-9_-]{0,40}$/;

/**
 * Valida una versión de lección. Devuelve { errores, avisos }. Con errores la versión NO se registra.
 * Fechas sin zona horaria, credenciales o datos personales son errores (no se «corrigen» solos).
 */
export function validarLeccion(v) {
  const errores = [];
  const avisos = [];
  const e = (t) => errores.push(t);
  if (!v || typeof v !== "object" || Array.isArray(v)) return { errores: ["La lección debe ser un objeto JSON."], avisos };

  if (v.contrato !== CONTRATO_LECCION) e(`contrato debe ser "${CONTRATO_LECCION}".`);
  if (typeof v.version_contrato !== "string" || !/^0\.2\.\d+$/.test(v.version_contrato)) e("version_contrato debe ser 0.2.x.");
  if (typeof v.id !== "string" || !ID_LECCION.test(v.id)) e("id debe empezar con «lec-» y usar minúsculas, números o guiones.");
  if (!Number.isInteger(v.revision) || v.revision < 1) e("revision debe ser un entero desde 1.");
  if (!TIPOS_CAMBIO.includes(v.tipo_cambio)) e(`tipo_cambio debe ser uno de: ${TIPOS_CAMBIO.join(", ")}.`);
  if (v.revision === 1 && v.tipo_cambio !== "alta") e("La revisión 1 debe ser tipo_cambio «alta».");
  if (v.revision > 1 && v.tipo_cambio === "alta") e("Solo la revisión 1 puede ser «alta».");
  if (v.revision > 1 && !texto(v.motivo_cambio)) e("Una revisión posterior a la 1 necesita motivo_cambio.");
  if (typeof v.es_demo !== "boolean") e("es_demo es obligatorio (true para datos de prueba).");

  fecha(v, "registrado_en", e, true);
  fecha(v, "fecha_conclusion", e, true);
  if (!esActor(v.registrado_por)) e("registrado_por necesita {tipo: humano|ia|proceso, id}.");
  if (!esActor(v.autor_conclusion)) e("autor_conclusion necesita {tipo: humano|ia|proceso, id}.");
  for (const k of ["titulo", "enunciado"]) if (!texto(v[k])) e(`${k} es obligatorio.`);
  if (typeof v.titulo === "string" && v.titulo.length > 160) e("titulo: máximo 160 caracteres.");
  if (typeof v.proyecto_origen !== "string" || !ID_PROYECTO.test(v.proyecto_origen)) e("proyecto_origen debe ser un id de proyecto (ej. compago).");
  if (!Array.isArray(v.proyectos_destino) || v.proyectos_destino.some((p) => typeof p !== "string" || !ID_PROYECTO.test(p))) e("proyectos_destino debe ser una lista de ids de proyecto.");
  if (!NATURALEZAS.includes(v.naturaleza_resultado)) e(`naturaleza_resultado debe ser una de: ${NATURALEZAS.join(", ")}.`);
  if (!NIVELES.includes(v.nivel_validacion)) e(`nivel_validacion debe ser uno de: ${NIVELES.join(", ")}.`);
  if (v.declara_reproducible !== undefined && typeof v.declara_reproducible !== "boolean") e("declara_reproducible debe ser true o false.");

  // Evidencias
  const ids = new Set();
  if (!Array.isArray(v.evidencias)) e("evidencias debe ser una lista (puede estar vacía en una hipótesis).");
  else v.evidencias.forEach((ev, i) => {
    const r = `evidencias[${i}]`;
    if (!ev || typeof ev !== "object") return e(`${r} debe ser un objeto.`);
    if (!texto(ev.id)) e(`${r}.id es obligatorio.`);
    else if (ids.has(ev.id)) e(`${r}.id «${ev.id}» repetido.`);
    else ids.add(ev.id);
    if (!TIPOS_EVIDENCIA.includes(ev.tipo)) e(`${r}.tipo debe ser uno de: ${TIPOS_EVIDENCIA.join(", ")}.`);
    if (ev.uso !== undefined && !USOS_EVIDENCIA.includes(ev.uso)) e(`${r}.uso debe ser conclusion o validacion.`);
    if (!texto(ev.descripcion)) e(`${r}.descripcion es obligatoria.`);
    if (ev.producida_por !== undefined && !esActor(ev.producida_por)) e(`${r}.producida_por debe ser un actor.`);
    fecha(ev, "obtenida_en", e, false, r);
    fecha(ev, "usa_datos_hasta", e, false, r);
    if (ev.periodo !== undefined) { fecha(ev.periodo, "desde", e, false, `${r}.periodo`); fecha(ev.periodo, "hasta", e, false, `${r}.periodo`); }
    if (ev.muestra !== undefined) {
      if (!ev.muestra || !texto(ev.muestra.id)) e(`${r}.muestra.id es obligatorio si hay muestra.`);
      for (const k of ["solapa_con", "derivada_de"]) if (ev.muestra?.[k] !== undefined && !Array.isArray(ev.muestra[k])) e(`${r}.muestra.${k} debe ser una lista.`);
      if (ev.muestra?.tamano !== undefined && !(Number.isInteger(ev.muestra.tamano) && ev.muestra.tamano > 0)) e(`${r}.muestra.tamano debe ser un entero positivo.`);
    }
    if (ev.metodo !== undefined) {
      const m = ev.metodo;
      if (m.configuraciones_probadas !== undefined && !(Number.isInteger(m.configuraciones_probadas) && m.configuraciones_probadas >= 1)) e(`${r}.metodo.configuraciones_probadas debe ser un entero desde 1.`);
      if (m.evaluacion !== undefined && !EVALUACIONES.includes(m.evaluacion)) e(`${r}.metodo.evaluacion debe ser una de: ${EVALUACIONES.join(", ")}.`);
      fecha(m, "datos_entrenamiento_hasta", e, false, `${r}.metodo`);
      fecha(m, "datos_prueba_desde", e, false, `${r}.metodo`);
    }
    if (ev.huella !== undefined && !/^[0-9a-f]{64}$/.test(ev.huella)) e(`${r}.huella debe ser SHA-256 en hexadecimal (64 caracteres).`);
  });

  if (!Array.isArray(v.antecedentes ?? [])) e("antecedentes debe ser una lista.");
  else (v.antecedentes ?? []).forEach((a, i) => {
    if (!a || typeof a.leccion_id !== "string" || !ID_LECCION.test(a.leccion_id)) e(`antecedentes[${i}].leccion_id inválido.`);
    if (!RELACIONES.includes(a?.relacion)) e(`antecedentes[${i}].relacion debe ser una de: ${RELACIONES.join(", ")}.`);
  });

  if (!Array.isArray(v.validaciones ?? [])) e("validaciones debe ser una lista.");
  else (v.validaciones ?? []).forEach((val, i) => {
    const r = `validaciones[${i}]`;
    if (!val || typeof val !== "object") return e(`${r} debe ser un objeto.`);
    if (!esActor(val.por)) e(`${r}.por debe ser un actor.`);
    fecha(val, "en", e, true, r);
    if (!["origen", "destino"].includes(val.ambito)) e(`${r}.ambito debe ser origen o destino.`);
    if (typeof val.proyecto !== "string" || !ID_PROYECTO.test(val.proyecto)) e(`${r}.proyecto debe ser un id de proyecto.`);
    if (!RESULTADOS_VALIDACION.includes(val.resultado)) e(`${r}.resultado debe ser confirma, refuta o inconcluso.`);
    if (!Array.isArray(val.evidencias)) e(`${r}.evidencias debe ser una lista de ids de evidencias.`);
    else for (const id of val.evidencias) if (!ids.has(id)) e(`${r} cita la evidencia «${id}», que no está en evidencias.`);
  });

  if (v.vigencia !== undefined) {
    if (!v.vigencia || typeof v.vigencia !== "object") e("vigencia debe ser un objeto.");
    else fecha(v.vigencia, "caduca_en", e, false, "vigencia");
  } else avisos.push("Sin vigencia.caduca_en: el gerente no podrá saber si la lección sigue vigente.");

  const extra = Object.keys(v).filter((k) => !CAMPOS.has(k));
  if (extra.length) avisos.push(`Campos que el contrato no conoce (se guardan, pero nadie los revisa): ${extra.join(", ")}.`);

  const privados = buscarDatosPrivados(v);
  for (const p of privados) e(`Dato privado no permitido en ${p.ruta}: ${p.motivo}. Nexus no guarda credenciales ni datos personales.`);
  return { errores, avisos };
}

function fecha(obj, campo, e, obligatoria, prefijo = "") {
  const r = prefijo ? `${prefijo}.${campo}` : campo;
  const v = obj?.[campo];
  if (v === undefined || v === null) { if (obligatoria) e(`${r} es obligatoria.`); return; }
  if (!esFechaConZona(v)) e(`${r} «${v}» debe ser fecha y hora con zona horaria (ej. 2026-11-06T10:00:00-06:00 o …Z).`);
}
