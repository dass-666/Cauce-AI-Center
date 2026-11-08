// Laboratorio de IA · fase 1 · utilidades comunes. Infraestructura DETERMINISTA: aquí no hay ningún modelo, ninguna
// red y ninguna escritura. Corre igual en Node y en el navegador (pruebas.html).
//
// Reutiliza funciones PURAS de Nexus (fechas, privacidad, huellas) sin depender de su lógica ni modificarla.

export { esFechaConZona, esFechaODia, intervalo, texto, buscarDatosPrivados, jsonCanonico, sha256, esHuella } from "../nexus/comun.js";

export const VERSION_LAB = "0.1";
/** lab-V 0.2 (auditoría 2026-11-08) = 0.1 + alerta `base_sin_respaldo`. Las verificaciones 0.1 guardadas siguen valiendo. */
export const VERSION_VERIFICADOR = "lab-V 0.2";
export const VERSIONES_VERIFICADOR = Object.freeze(["lab-V 0.1", "lab-V 0.2"]);
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
export const ADAPTADORES = ["manual-claude", "ollama", "ninguno", "automatico"];
export const TIPOS_OBJECION = ["supuesto", "circularidad", "sobreajuste", "sesgo", "alcance", "temporalidad", "evidencia", "otra"];

// ---------------------------------------------------------------------------------------------- fase 3 · autoría
/**
 * Versiones de `cauce.lab.ejecucion` que se aceptan. La 0.1 queda SOLO para leer lo ya registrado (sus documentos no
 * se reescriben: sus huellas están citadas en verificaciones e informes); todo lo nuevo se produce en 0.2.
 */
export const VERSION_EJECUCION = "0.2";
export const VERSIONES_EJECUCION = ["0.1", "0.2"];
/**
 * Quién produjo algo, en todo el Laboratorio (contrato 0.2). Antes una ejecución solo podía decir «ia», incluso cuando
 * la escribía el guion DEMO. Ahora hay cinco autorías que no se confunden:
 *   guion_demo     reglas escritas a mano (o un transporte de prueba): NO es IA; solo en DEMO;
 *   ia_manual      un modelo de IA cuya respuesta una persona copió y pegó; procedencia DECLARADA, no verificada;
 *   ia_automatica  un modelo de IA llamado por un adaptador automático; procedencia informada por el adaptador;
 *   codigo         resultado determinista del sistema (lab-V, Coordinador);
 *   humano         intervención de una persona (encargos, decisiones), con identidad declarada.
 * Una EJECUCIÓN (salida de un rol) solo admite las tres primeras.
 */
export const TIPOS_AUTORIA = Object.freeze(["guion_demo", "ia_manual", "ia_automatica", "codigo", "humano"]);
export const AUTORIAS_EJECUCION = Object.freeze(["guion_demo", "ia_manual", "ia_automatica"]);
export const ETIQUETA_AUTORIA = Object.freeze({
  guion_demo: "Guion DEMO · no es IA", ia_manual: "IA · intercambio manual (procedencia declarada)", ia_automatica: "IA · proveedor automático",
  codigo: "Código determinista", humano: "Persona (identidad declarada)",
});
/** Procedencia del autor: nada en este proyecto puede comprobarla criptográficamente, así que `verificada` es siempre false. */
export const PROCEDENCIAS = Object.freeze(["no_aplica", "declarada", "informada_por_adaptador"]);
/** Tipos de objeción añadidos en 0.2 para el Abogado del Diablo (los de 0.1 siguen valiendo). */
export const TIPOS_OBJECION_02 = Object.freeze([...TIPOS_OBJECION, "error_razonamiento", "riesgo", "explicacion_rival"]);

/** Identificadores: prefijo por tipo de documento; los de prueba empiezan por «demo-». */
export const PREFIJOS = { encargo: "lab-enc-", ejecucion: "lab-run-", verificacion: "lab-ver-" };
const CUERPO_ID = /^(?!.*\.\.)[a-z0-9][a-z0-9._-]{0,63}$/;
export function esIdLab(id, tipo, esDemo) {
  if (typeof id !== "string") return false;
  const pre = (esDemo ? "demo-" : "") + PREFIJOS[tipo];
  return id.startsWith(pre) && CUERPO_ID.test(id.slice(pre.length)) && (esDemo || !id.startsWith("demo-"));
}
/** Cualquier id producido por el Laboratorio (encargo, ejecución o verificación), demo o real. */
export const esIdDeLaboratorio = (v) => typeof v === "string" && /^(demo-)?lab-(enc|run|ver)-/.test(v);
/** Id de fuente o insumo. Nunca «..»: los ids se usan como nombres de archivo de copias y no deben salir de su carpeta. */
export const ID_FUENTE = /^(?!.*\.\.)[a-z0-9][a-z0-9._-]{1,80}$/i;

/**
 * Límites de tamaño (fase 1.1). Antes no había ninguno: una respuesta enorme hacía que la validación tardara
 * minutos (la búsqueda de datos privados es cuadrática en textos largos) y bloqueaba el verificador.
 * Son límites de ENTRADA: un documento que los supera se rechaza entero, con un solo error, antes de revisarlo.
 */
export const LIMITES = Object.freeze({
  bytes_documento: 2_000_000, // JSON serializado (caracteres); un expediente CSI real pesa ~80 KB
  texto: 8000,                // pregunta, afirmación, hipótesis, objeción, duda, contradicción, error
  extracto: 2000,             // extracto de una cita
  afirmaciones: 500, hipotesis: 100, objeciones: 500, dudas: 200, contradicciones: 200, citas_por_afirmacion: 20,
  consultas_web: 50, insumos: 200, fuentes: 500, errores: 500,
});
/** Tamaño de un documento como JSON (caracteres). Un documento no serializable cuenta como infinito. */
export function tamanoDocumento(doc) {
  try { return JSON.stringify(doc)?.length ?? Infinity; } catch { return Infinity; }
}

/**
 * Caracteres que no se ven pero cambian lo que una persona lee: anchura cero, control bidireccional (pueden
 * invertir visualmente un número o esconder texto), marca de orden de bytes y guion suave.
 * Un texto así se rechaza: una respuesta legítima no los necesita y un revisor humano no los vería.
 */
const INVISIBLES = /[­​-‏‪-‮⁠-⁤⁦-⁩﻿]/;
export const tieneInvisibles = (t) => typeof t === "string" && INVISIBLES.test(t);

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
