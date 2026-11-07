// CSI fase 2 · ancla verificable de la memoria de predicciones `cauce.csi.ancla` 0.1 (bloque 7).
//
// Problema: las horas del registro las declara quien registra. La cadena de huellas prueba el ORDEN y detecta
// reescrituras, pero no prueba CUÁNDO existió una predicción. Solución: exportar un ancla (solo huellas, sin el texto
// de las predicciones), publicarla FUERA del equipo antes del horizonte y, después, verificar el registro contra ella.
//
// Este módulo NO publica nada ni se conecta a ningún servicio. Publicar es una decisión de Diego.
// Hora declarada ≠ hora acreditada: la acreditada la pone un tercero (un sello de tiempo, la hora de recepción de un
// servicio público, un testigo). La fecha de un commit de git la escribe quien hace el commit: NO acredita nada por sí sola.

import { L, esObj, texto, esFechaConZona, ms, huellaDe, sha256, jsonCanonico } from "./base.js";
import { CONTRATO_PREDICCIONES, verificarPredicciones } from "./predicciones.js";

export const CONTRATO_ANCLA = "cauce.csi.ancla";
export const VERSION_ANCLA = "0.1";
/** Qué tan fuerte es cada forma de acreditar la hora (de más a menos). */
export const ACREDITACIONES = {
  sello_rfc3161: "Sello de tiempo RFC 3161 de una autoridad de sellado (verificable con openssl ts -verify).",
  opentimestamps: "OpenTimestamps (anclado en una cadena pública; verificable con el cliente ots).",
  recepcion_servicio: "Hora en que un servicio público recibió la huella (p. ej. hora de push que muestra GitHub, no la fecha del commit).",
  testigo: "Un tercero recibió la huella (correo, mensaje) y puede atestiguar la hora de recepción.",
};
const RAIZ = ["contrato", "version_contrato", "es_demo", "registro", "entradas", "huella_ancla", "creada_en", "creada_por", "incluye_ids", "publicacion"];

/**
 * Crea el ancla del estado actual del registro. Por defecto NO incluye ids ni textos: solo número de entrada, tipo y
 * huella, para poder publicarla sin revelar predicciones privadas.
 */
export async function crearAncla(doc, { creada_en, creada_por, incluir_ids = false }) {
  const v = await verificarPredicciones(doc);
  if (!v.ok) return { ok: false, errores: ["El registro está alterado: no se ancla un registro roto.", ...v.problemas] };
  if (!L(doc?.entradas).length) return { ok: false, errores: ["El registro está vacío: no hay nada que anclar."] };
  if (!esFechaConZona(creada_en) || !esObj(creada_por) || !texto(creada_por.identificador)) return { ok: false, errores: ["creada_en (instante con zona) y creada_por declarados."] };
  const entradas = L(doc.entradas).map((x) => ({ n: x.n, tipo: x.tipo, huella: x.huella, ...(incluir_ids ? { id: x.contenido?.id ?? x.contenido?.prediccion_id ?? null } : {}) }));
  const nucleo = { contrato: CONTRATO_ANCLA, version_contrato: VERSION_ANCLA, es_demo: doc.es_demo === true, registro: { contrato: CONTRATO_PREDICCIONES, entradas: entradas.length, ultima_huella: v.ultima_huella }, entradas, incluye_ids: incluir_ids };
  const huella_ancla = await huellaDe(nucleo);
  return { ok: true, ancla: { ...nucleo, huella_ancla, creada_en, creada_por: { tipo: creada_por.tipo ?? "humano", identificador: creada_por.identificador, autenticacion: "declarada" }, publicacion: { estado: "no_publicada", nota: "Sin publicar. Publicarla es decisión de Diego; este programa nunca la publica." } } };
}

/** Texto corto para publicar (solo la huella). No contiene predicciones. */
export const textoPublicable = (ancla) => `cauce-csi-ancla ${ancla.version_contrato} · ${ancla.registro.entradas} entradas · ${ancla.huella_ancla}`;

export function instruccionesPublicacion(ancla, horizonteMasProximo = null) {
  return [
    `1. Antes de publicar, confirma con Diego (la publicación externa requiere su autorización).`,
    `2. Publica SOLO este texto (no contiene las predicciones): ${textoPublicable(ancla)}`,
    `3. Hazlo antes del primer horizonte${horizonteMasProximo ? ` (${horizonteMasProximo})` : ""}; si se publica después, no acredita nada para esa predicción.`,
    "4. Opciones gratuitas, de más a menos fuertes: sello RFC 3161 (p. ej. una autoridad de sellado gratuita), OpenTimestamps, un servicio público que muestre la hora de recepción, o un testigo que reciba la huella.",
    "5. Guarda la prueba (el archivo .tsr/.ots, el enlace o el mensaje) junto al ancla y registra la acreditación con la hora que dice el tercero, no la tuya.",
    "6. Una fecha de commit de git NO acredita: la escribe quien hace el commit. Sirve la hora de recepción que registra el servidor, o un sello.",
  ];
}

/** Valida la forma de un ancla y que su huella corresponda a su contenido (detecta anclas modificadas). */
export async function validarAncla(a) {
  const errores = [];
  if (!esObj(a)) return { ok: false, errores: ["El ancla debe ser un objeto."] };
  for (const k of Object.keys(a)) if (!RAIZ.includes(k)) errores.push(`${k}: clave desconocida (ancla).`);
  if (a.contrato !== CONTRATO_ANCLA || a.version_contrato !== VERSION_ANCLA) errores.push(`contrato ${CONTRATO_ANCLA} ${VERSION_ANCLA}.`);
  if (!Array.isArray(a.entradas) || !esObj(a.registro)) errores.push("entradas y registro son obligatorios.");
  if (errores.length) return { ok: false, errores };
  const nucleo = { contrato: a.contrato, version_contrato: a.version_contrato, es_demo: a.es_demo, registro: a.registro, entradas: a.entradas, incluye_ids: a.incluye_ids };
  if (await huellaDe(nucleo) !== a.huella_ancla) errores.push("La huella del ancla no corresponde a su contenido: el ancla se modificó.");
  if (a.registro.entradas !== a.entradas.length || a.entradas.at(-1)?.huella !== a.registro.ultima_huella) errores.push("El resumen del registro no coincide con sus entradas.");
  const p = a.publicacion;
  if (p?.estado === "acreditada") {
    if (!(p.tipo in ACREDITACIONES)) errores.push(`publicacion.tipo: ${Object.keys(ACREDITACIONES).join(" | ")}.`);
    if (!esFechaConZona(p.acreditado_en) || !texto(p.prueba) || !texto(p.autorizada_por)) errores.push("Una acreditación registra acreditado_en (la hora que da el tercero), prueba (enlace o archivo) y autorizada_por.");
  }
  return { ok: !errores.length, errores };
}

/**
 * Registra (localmente) que el ancla se publicó y cómo se acreditó. No publica: anota lo que la persona hizo.
 * @param datos {tipo, acreditado_en, prueba, autorizada_por, texto_publicado}
 */
export async function registrarAcreditacion(ancla, { tipo, acreditado_en, prueba, autorizada_por, texto_publicado }) {
  const v = await validarAncla(ancla);
  if (!v.ok) return v;
  if (!String(texto_publicado ?? "").includes(ancla.huella_ancla)) return { ok: false, errores: ["El texto publicado no contiene la huella del ancla: no corresponde."] };
  const a = { ...ancla, publicacion: { estado: "acreditada", tipo, acreditado_en, prueba, autorizada_por, nota: "Hora acreditada por un tercero según la prueba indicada; verifícala con la herramienta del tercero." } };
  const v2 = await validarAncla(a);
  return v2.ok ? { ok: true, ancla: a } : v2;
}

/**
 * Verifica el registro contra un ancla: las entradas ancladas siguen idénticas (si no, se modificó después), el registro
 * solo creció, y para cada predicción dice si su registro está ACREDITADO antes del horizonte o solo DECLARADO.
 */
export async function verificarContraAncla(doc, ancla, resumen = null) {
  const va = await validarAncla(ancla);
  const cadena = await verificarPredicciones(doc);
  const problemas = [...va.errores, ...(cadena.ok ? [] : cadena.problemas)];
  const actuales = L(doc?.entradas);
  for (const x of L(ancla?.entradas)) {
    const y = actuales[x.n - 1];
    if (!y) problemas.push(`Entrada ${x.n}: está en el ancla y falta en el registro (se borró).`);
    else if (y.huella !== x.huella) problemas.push(`Entrada ${x.n}: cambió después de anclarse.`);
  }
  if ((doc?.es_demo === true) !== (ancla?.es_demo === true)) problemas.push("DEMO/REAL: el ancla y el registro no son del mismo tipo.");
  const n = L(ancla?.entradas).length;
  const acreditada = ancla?.publicacion?.estado === "acreditada" && va.ok;
  const t = acreditada ? ms(ancla.publicacion.acreditado_en) : null;
  const filas = L(resumen?.filas).map((f) => {
    const reg = actuales.find((x) => x.tipo === "registro" && x.contenido?.id === f.id);
    const dentro = reg && reg.n <= n && !problemas.length;
    let temporal = "declarada";
    if (dentro && acreditada) temporal = t < ms(f.horizonte.desde) ? "acreditada_antes_del_horizonte" : "acreditada_tarde";
    else if (dentro) temporal = "anclada_sin_acreditar";
    return { id: f.id, entrada: reg?.n ?? null, temporal };
  });
  return { ok: !problemas.length, problemas, entradas_ancladas: n, entradas_posteriores: Math.max(0, actuales.length - n), acreditada, acreditado_en: acreditada ? ancla.publicacion.acreditado_en : null, filas };
}

export const TEMPORAL_TXT = {
  declarada: "Hora DECLARADA (sin ancla): prueba orden, no hora.",
  anclada_sin_acreditar: "Anclada, ancla sin acreditar: la huella existe pero nadie externo fija su hora.",
  acreditada_antes_del_horizonte: "ACREDITADA antes del horizonte por un tercero.",
  acreditada_tarde: "Acreditada DESPUÉS de empezar el horizonte: no prueba que se predijo antes.",
};
export const huellaTexto = (t) => sha256(String(t));
export { jsonCanonico };
