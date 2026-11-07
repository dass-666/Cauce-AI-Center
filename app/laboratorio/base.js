// Laboratorio de IA · fase 1 · utilidades comunes. Infraestructura DETERMINISTA: aquí no hay ningún modelo, ninguna
// red y ninguna escritura. Corre igual en Node y en el navegador (pruebas.html).
//
// Reutiliza funciones PURAS de Nexus (fechas, privacidad, huellas) sin depender de su lógica ni modificarla.

export { esFechaConZona, esFechaODia, intervalo, texto, buscarDatosPrivados, jsonCanonico, sha256, esHuella } from "../nexus/comun.js";

export const VERSION_LAB = "0.1";
export const VERSION_VERIFICADOR = "lab-V 0.1";
export const AUTOR_VERIFICADOR = Object.freeze({ tipo: "codigo", identificador: "lab-V", version: VERSION_VERIFICADOR });

export const CONTRATO_ENCARGO = "cauce.lab.encargo";
export const CONTRATO_EJECUCION = "cauce.lab.ejecucion";
export const CONTRATO_VERIFICACION = "cauce.lab.verificacion";

export const ROLES = ["investigador", "analista", "critico"];
export const ESTADOS_EJECUCION = ["en_cola", "ejecutando", "terminado", "fallo", "cancelado", "sin_conexion", "excedio_limite"];
/** Estados en los que la ejecución DEBE traer su salida completa. */
export const ESTADOS_CON_SALIDA = ["terminado"];
/** Estados que admiten una salida parcial (se verifica y se marca como incompleta). */
export const ESTADOS_PARCIALES = ["excedio_limite", "cancelado"];
/** Estados sin salida: deben explicar el error. */
export const ESTADOS_CON_ERROR = ["fallo", "sin_conexion"];
export const CLASES_AFIRMACION = ["hecho_citado", "inferencia", "especulacion", "desconocido"];
export const TIPOS_INSUMO = ["csi_investigacion", "copia_fuente", "lab_ejecucion_verificada", "banco_evaluacion"];
export const ADAPTADORES = ["manual-claude", "ollama", "ninguno"];
export const TIPOS_OBJECION = ["supuesto", "circularidad", "sobreajuste", "sesgo", "alcance", "temporalidad", "evidencia", "otra"];

/** Identificadores: prefijo por tipo de documento; los de prueba empiezan por «demo-». */
export const PREFIJOS = { encargo: "lab-enc-", ejecucion: "lab-run-", verificacion: "lab-ver-" };
const CUERPO_ID = /^[a-z0-9][a-z0-9._-]{0,63}$/;
export function esIdLab(id, tipo, esDemo) {
  if (typeof id !== "string") return false;
  const pre = (esDemo ? "demo-" : "") + PREFIJOS[tipo];
  return id.startsWith(pre) && CUERPO_ID.test(id.slice(pre.length)) && (esDemo || !id.startsWith("demo-"));
}
/** Cualquier id producido por el Laboratorio (encargo, ejecución o verificación), demo o real. */
export const esIdDeLaboratorio = (v) => typeof v === "string" && /^(demo-)?lab-(enc|run|ver)-/.test(v);
export const ID_FUENTE = /^[a-z0-9][a-z0-9._-]{1,80}$/i;

export const esObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
export const L = (v) => (Array.isArray(v) ? v : []);
export const esEnteroEntre = (v, a, b) => Number.isInteger(v) && v >= a && v <= b;

/** Claves desconocidas = error: un campo que el contrato no conoce no se cuela en silencio. */
export function clavesExactas(obj, permitidas, ruta, e, obligatorias = permitidas) {
  if (!esObj(obj)) { e(`${ruta || "documento"}: debe ser un objeto.`); return false; }
  for (const k of Object.keys(obj)) if (!permitidas.includes(k)) e(`${ruta}${k}: clave desconocida (contrato ${VERSION_LAB} del Laboratorio).`);
  for (const k of obligatorias) if (!(k in obj)) e(`${ruta}${k}: falta (obligatorio).`);
  return true;
}

/**
 * Normalización CONTROLADA para comparar extractos (y nada más):
 *   1. Unicode NFC (la misma letra acentuada escrita de dos formas cuenta igual);
 *   2. cualquier secuencia de espacios en blanco (espacio, tabulador, salto de línea, espacio duro U+00A0,
 *      espacios finos U+2000–U+200A, U+202F, U+3000) se convierte en un solo espacio;
 *   3. sin espacios al inicio ni al final.
 * NO cambia mayúsculas, comillas, guiones, puntuación ni números: «1.2010» y «1,2010» son distintos.
 */
export function normalizarEspacios(t) {
  return String(t ?? "").normalize("NFC").replace(/[\s  -  　]+/g, " ").trim();
}

/** SHA-256 de BYTES (copias de fuentes: pueden ser PDF o HTML), en hexadecimal. */
export async function sha256Bytes(bytes) {
  const datos = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const h = await globalThis.crypto.subtle.digest("SHA-256", datos);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Cuenta apariciones (sin solaparse) de `aguja` en `pajar`. */
export function apariciones(pajar, aguja) {
  if (!aguja) return [];
  const r = [];
  for (let i = pajar.indexOf(aguja); i !== -1; i = pajar.indexOf(aguja, i + aguja.length)) r.push(i);
  return r;
}
