// Laboratorio de IA · fase 1 · registro auditable (solo anexado, encadenado por huellas). Funciones puras:
// la escritura a disco la hace herramientas/laboratorio.mjs con reemplazo atómico. El navegador no escribe.
//
// Cada línea (JSONL) guarda el documento completo, si cumplía su contrato y los errores, aunque sea inválido:
// los fallos también se auditan. Un registro REAL no admite documentos DEMO, ni al revés.

import { jsonCanonico, sha256, esHuella, esFechaConZona, esObj, L } from "./base.js";
import { validarEncargo, validarEjecucion, validarVerificacion } from "./contratos.js";

export const CONTRATO_REGISTRO = "cauce.lab.registro";
export const TIPOS_ENTRADA = ["encargo", "ejecucion", "verificacion"];
const VALIDADORES = { encargo: validarEncargo, ejecucion: validarEjecucion, verificacion: validarVerificacion };

const huellaEntrada = (e) => { const { sha256_entrada, ...resto } = e; return sha256(jsonCanonico(resto)); };

/**
 * Prepara la siguiente entrada. No escribe. Rechaza (ok:false) mezclar DEMO/REAL o un tipo desconocido;
 * un documento que no cumple su contrato SÍ se registra, marcado valido:false con sus errores.
 */
export async function nuevaEntrada(anterior, { tipo, documento, registrado_en, registro_es_demo }) {
  const errores = [];
  if (!TIPOS_ENTRADA.includes(tipo)) errores.push(`tipo «${tipo}» inválido: ${TIPOS_ENTRADA.join(" | ")}.`);
  if (!esFechaConZona(registrado_en)) errores.push("registrado_en debe ser instante con zona.");
  if (typeof registro_es_demo !== "boolean") errores.push("registro_es_demo debe ser true o false.");
  if (!esObj(documento)) errores.push("documento debe ser un objeto.");
  else if (documento.es_demo !== registro_es_demo) errores.push(`mezcla DEMO/REAL: el documento es ${documento.es_demo === true ? "DEMO" : documento.es_demo === false ? "REAL" : "sin marca es_demo"} y el registro ${registro_es_demo ? "DEMO" : "REAL"}.`);
  if (errores.length) return { ok: false, errores };
  const v = VALIDADORES[tipo](documento);
  const e = {
    contrato: CONTRATO_REGISTRO, version_contrato: "0.1",
    n: anterior ? anterior.n + 1 : 1, tipo, id: typeof documento.id === "string" ? documento.id : null, es_demo: registro_es_demo,
    registrado_en, valido: v.ok, errores_contrato: v.errores,
    sha256_documento: await sha256(jsonCanonico(documento)), sha256_anterior: anterior ? anterior.sha256_entrada : null,
    documento,
  };
  e.sha256_entrada = await huellaEntrada(e);
  return { ok: true, entrada: e };
}

export const serializar = (entrada) => `${JSON.stringify(entrada)}\n`;

/**
 * Lee y comprueba un registro completo. Nunca descarta nada: cada problema se informa con su línea.
 * Detecta líneas corruptas, última línea truncada (escritura incompleta), cadena rota, numeración saltada,
 * documento modificado y mezcla DEMO/REAL.
 */
export async function verificarRegistro(textoRegistro, { es_demo }) {
  const problemas = [], entradas = [];
  const lineas = String(textoRegistro ?? "").split("\n");
  const terminaBien = String(textoRegistro ?? "").endsWith("\n") || textoRegistro === "";
  if (lineas.at(-1) === "") lineas.pop();
  let anterior = null;
  for (const [i, linea] of lineas.entries()) {
    const nl = i + 1, ultima = i === lineas.length - 1;
    let e;
    try { e = JSON.parse(linea); } catch {
      problemas.push({ linea: nl, codigo: ultima && !terminaBien ? "registro_incompleto" : "linea_corrupta", detalle: ultima && !terminaBien ? "La última línea está cortada: una escritura no terminó." : "La línea no es JSON válido." });
      anterior = null; continue;
    }
    if (!esObj(e) || e.contrato !== CONTRATO_REGISTRO) { problemas.push({ linea: nl, codigo: "linea_corrupta", detalle: "No es una entrada del registro del Laboratorio." }); anterior = null; continue; }
    if (ultima && !terminaBien) problemas.push({ linea: nl, codigo: "registro_incompleto", detalle: "Falta el salto de línea final: la escritura pudo quedar a medias." });
    if (e.es_demo !== es_demo) problemas.push({ linea: nl, codigo: "mezcla_demo_real", detalle: `Entrada ${e.es_demo ? "DEMO" : "REAL"} en un registro ${es_demo ? "DEMO" : "REAL"}.` });
    if (!esHuella(e.sha256_entrada) || (await huellaEntrada(e)) !== e.sha256_entrada) problemas.push({ linea: nl, codigo: "entrada_modificada", detalle: "La huella de la entrada no coincide con su contenido." });
    if ((await sha256(jsonCanonico(e.documento))) !== e.sha256_documento) problemas.push({ linea: nl, codigo: "documento_modificado", detalle: "El documento guardado no coincide con su huella." });
    const nEsperado = anterior ? anterior.n + 1 : (entradas.length ? null : 1);
    if (nEsperado !== null && e.n !== nEsperado) problemas.push({ linea: nl, codigo: "numeracion_rota", detalle: `n = ${e.n}, se esperaba ${nEsperado}.` });
    const prevHuella = anterior ? anterior.sha256_entrada : (entradas.length ? undefined : null);
    if (prevHuella !== undefined && e.sha256_anterior !== prevHuella) problemas.push({ linea: nl, codigo: "cadena_rota", detalle: "sha256_anterior no es la huella de la entrada anterior (se borró, insertó o reordenó algo)." });
    if (!TIPOS_ENTRADA.includes(e.tipo)) problemas.push({ linea: nl, codigo: "tipo_desconocido", detalle: `tipo «${e.tipo}».` });
    entradas.push(e); anterior = e;
  }
  return { ok: problemas.length === 0, entradas, problemas, ultima: entradas.at(-1) ?? null };
}

/** Índices de lectura (para circularidad): solo entradas válidas; el resto queda para auditoría. */
export function indicesDesdeEntradas(entradas) {
  const encargos = new Map(), ejecuciones = new Map(), verificaciones = new Map();
  for (const e of L(entradas)) {
    if (!e?.valido) continue;
    if (e.tipo === "encargo") encargos.set(e.documento.id, e.documento);
    if (e.tipo === "ejecucion") ejecuciones.set(e.documento.id, e.documento);
    if (e.tipo === "verificacion") verificaciones.set(e.documento.ejecucion_id, e.documento);
  }
  return { encargos, ejecuciones, verificaciones };
}
