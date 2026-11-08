// Laboratorio de IA · fase 2 · adaptadores de modelo INTERCAMBIABLES.
//
// Todos cumplen la misma interfaz, así que cambiar de proveedor no cambia el Coordinador ni lab-V:
//   { id, adaptador, nombre, es_ia, autoria, costo_mxn, usa_red, disponible(encargo) → {ok, motivo}, ejecutar(p) → contenido }
// Fase 3: la ejecución se arma en el contrato 0.2, con la autoría REAL (guion_demo | ia_manual | ia_automatica).
// `ejecutar` devuelve solo el CONTENIDO de la salida (o una ejecución completa, en el adaptador manual); el documento
// `cauce.lab.ejecucion` lo arma armarEjecucion(), que fija encargo, huella, tiempos y autor. Lo que responda un modelo
// es contenido NO CONFIABLE: se valida con el contrato y se verifica con lab-V; nada de lo que diga se ejecuta.
//
// Disponibles en este repositorio (verificado, $0, sin instalar nada):
//   · sin-modelo     guion determinista, SOLO DEMO (no es IA; ver guion-demo.js);
//   · manual-claude  una persona copia la SOLICITUD (manual.js) a una conversación que ya tiene (p. ej. la app de
//                    Claude) y pega la respuesta; manual.js la valida ANTES de que llegue aquí. Este código no llama a
//                    ninguna API, no automatiza el navegador y no usa cookies, sesiones ni credenciales;
//   · ollama         declarado pero NO disponible: no está instalado ni autorizado. No hace ninguna llamada;
//   · automático     interfaz para un proveedor futuro (proveedores.js), apagado y sin credenciales.
// Un proveedor de pago (API) NO existe aquí a propósito: el presupuesto es $0 y no hay credenciales.

import { esObj, ESTADOS_CON_ERROR, LIMITES } from "./base.js";
import { salidaGuion, AUTOR_GUION } from "./guion-demo.js";

const vacio = () => ({ afirmaciones: [], hipotesis: [], objeciones: [], dudas: [], contradicciones: [], preguntas: [], limitaciones: [], recomendaciones: [] });
/** Autoría 0.2 de un adaptador de IA (cuando no trae una propia). */
export const autorIA = (tipo, { identificador, adaptador, proveedor = null, modelo = null }) => ({
  tipo, identificador, adaptador, proveedor, modelo, procedencia: tipo === "ia_manual" ? "declarada" : tipo === "ia_automatica" ? "informada_por_adaptador" : "no_aplica", verificada: false,
});
const recorte = (t, n = 500) => String(t ?? "").replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/g, " ").slice(0, n);

export const ADAPTADOR_SIN_MODELO = Object.freeze({
  id: "sin-modelo", adaptador: "ninguno", nombre: "Guion determinista (sin modelo, DEMO)", es_ia: false, autoria: "guion_demo", autor: AUTOR_GUION, costo_mxn: 0, usa_red: false,
  disponible(encargo) {
    return encargo?.es_demo === true ? { ok: true, motivo: null }
      : { ok: false, motivo: "El guion sin modelo solo trabaja con datos DEMO: con datos REALES haría pasar reglas fijas por análisis de IA." };
  },
  async ejecutar({ encargo, contexto }) { return { contenido: salidaGuion(encargo, contexto), autor: { ...AUTOR_GUION } }; },
});

export const ADAPTADOR_OLLAMA = Object.freeze({
  id: "ollama", adaptador: "ollama", nombre: "Modelo local (Ollama) · no instalado", es_ia: true, autoria: "ia_automatica", costo_mxn: 0, usa_red: false,
  autor: Object.freeze(autorIA("ia_automatica", { identificador: "ollama-no-instalado", adaptador: "ollama", proveedor: "ollama" })),
  disponible() { return { ok: false, motivo: "Ollama no está instalado ni autorizado en este equipo (decisión pendiente de Diego). Este adaptador no hace ninguna llamada." }; },
  async ejecutar() { throw new Error("Ollama no disponible."); },
});

/**
 * Adaptador manual: `respuestas` es un Map rol → respuesta YA IMPORTADA por manual.importarRespuesta()
 * ({ contenido, autor, intercambio }) o, por compatibilidad con la fase 2, una ejecución completa (JSON 0.1).
 * Sin respuesta para el rol, el trabajo queda en pendiente esperando (no se inventa nada). Con respuesta, se entrega
 * tal cual: si no corresponde al encargo (otro id, otra huella, otro mundo), lab-V la rechaza.
 */
export function crearAdaptadorManual(respuestas = new Map(), { modelo = "declarado por la persona" } = {}) {
  return Object.freeze({
    id: "manual-claude", adaptador: "manual-claude", nombre: `Respuesta pegada a mano (${modelo})`, es_ia: true, autoria: "ia_manual", costo_mxn: 0, usa_red: false,
    autor: Object.freeze(autorIA("ia_manual", { identificador: "respuesta-manual", adaptador: "manual-claude" })),
    disponible(encargo) {
      return respuestas.has(encargo?.rol) ? { ok: true, motivo: null }
        : { ok: false, motivo: `Esperando que una persona pegue la respuesta del rol «${encargo?.rol}» al encargo ${encargo?.id}.`, espera: true };
    },
    async ejecutar({ encargo }) {
      const r = respuestas.get(encargo.rol);
      if (r?.contrato === "cauce.lab.ejecucion") return { ejecucion: structuredClone(r) }; // fase 2: ejecución completa (se verifica, no se corrige)
      return { contenido: structuredClone(r.contenido), autor: structuredClone(r.autor), intercambio: structuredClone(r.intercambio) };
    },
  });
}

/** Doble de prueba (DEMO): envuelve otro adaptador y falla las primeras `n` veces con el estado indicado. */
export function crearAdaptadorConFallos(base, fallos = ["sin_conexion"]) {
  let i = 0;
  return Object.freeze({
    ...base, id: base.id, nombre: `${base.nombre} · con fallos simulados`,
    async ejecutar(p) {
      const f = fallos[i++];
      if (f === "sin_conexion") return { estado: "sin_conexion", error: "[PRUEBA] Conexión perdida con el proveedor (simulada)." };
      if (f === "excepcion") throw new Error("[PRUEBA] El proveedor lanzó una excepción (simulada).");
      if (f === "basura") return { contenido: { afirmaciones: [{ id: "x", texto: "", clase: "inventada", citas: "no" }] } };
      if (f === "lento") return new Promise(() => {}); // nunca responde: lo corta el límite de tiempo
      return base.ejecutar(p);
    },
  });
}

export const ADAPTADORES_DISPONIBLES = Object.freeze({ "sin-modelo": ADAPTADOR_SIN_MODELO, ollama: ADAPTADOR_OLLAMA });

/** Autoría por defecto de un adaptador (para fallos de transporte, cuando no llegó nada que traiga la suya). */
const autorDe = (adaptador) => structuredClone(adaptador.autor ?? autorIA(adaptador.autoria ?? "ia_automatica", { identificador: adaptador.id, adaptador: adaptador.adaptador }));

/**
 * Arma la ejecución `cauce.lab.ejecucion` 0.2 alrededor del contenido del adaptador.
 * Las afirmaciones sin `se_basa_en` lo reciben vacío (no se inventa ninguna base: vacío = «no declaró en qué se apoya»).
 */
export function armarEjecucion({ id, encargo, encargo_sha256, inicio, fin, autor, contenido = null, estado = "terminado", error = null, intercambio = null, uso = null }) {
  const c = esObj(contenido) ? contenido : vacio();
  const conSalida = !ESTADOS_CON_ERROR.includes(estado);
  const lista = (k) => (conSalida && Array.isArray(c[k]) ? c[k] : []);
  return {
    contrato: "cauce.lab.ejecucion", version_contrato: "0.2", id, es_demo: encargo.es_demo, encargo_id: encargo.id, encargo_sha256, rol: encargo.rol,
    estado, inicio, fin, latido: fin, autor,
    afirmaciones: lista("afirmaciones").map((a) => (esObj(a) && !("se_basa_en" in a) ? { ...a, se_basa_en: [] } : a)),
    hipotesis: lista("hipotesis"), objeciones: lista("objeciones"), dudas: lista("dudas"), contradicciones: lista("contradicciones"), consultas_web: [],
    uso: uso ?? { tokens_entrada: null, tokens_salida: null, costo_mxn: 0 }, error: error === null ? null : recorte(error, LIMITES.texto),
    intercambio: conSalida ? intercambio : null, preguntas: lista("preguntas"), limitaciones: lista("limitaciones"), recomendaciones: lista("recomendaciones"),
  };
}

/** Promesa con límite de tiempo: si el adaptador no responde, se corta (no se espera para siempre). */
function conLimite(promesa, ms) {
  let t;
  return Promise.race([promesa, new Promise((_, rechazar) => { t = setTimeout(() => rechazar(new Error(`tiempo agotado: el adaptador no respondió en ${ms} ms`)), ms); })]).finally(() => clearTimeout(t));
}

/**
 * Ejecuta un rol con reintentos SEGUROS: solo se reintentan fallos de transporte (sin_conexion, excepción, tiempo
 * agotado). Una salida que llegó (aunque sea mala) no se reintenta: se verifica y se conserva. Cada intento produce su
 * propia ejecución, con id distinto, para que la auditoría vea todos.
 * @returns {Promise<{ejecuciones: object[], final: object}>}
 */
export async function ejecutarConReintentos(adaptador, { encargo, encargo_sha256, contexto, reloj, idBase, max_intentos = 2, limite_ms = 30_000 }) {
  const ejecuciones = [];
  for (let intento = 1; intento <= max_intentos; intento++) {
    const id = `${idBase}-i${intento}`, inicio = reloj();
    let r;
    try { r = await conLimite(Promise.resolve(adaptador.ejecutar({ encargo, encargo_sha256, contexto, intento })), limite_ms); }
    catch (e) { r = { estado: "fallo", error: `El adaptador ${adaptador.id} falló: ${recorte(e?.message ?? e, 300)}` }; }
    const fin = reloj();
    let ej;
    if (r?.ejecucion) ej = r.ejecucion; // manual: la ejecución viene completa (se verifica, no se corrige)
    else if (r?.estado && ESTADOS_CON_ERROR.includes(r.estado)) ej = armarEjecucion({ id, encargo, encargo_sha256, inicio, fin, autor: r.autor ?? autorDe(adaptador), estado: r.estado, error: r.error ?? "sin detalle" });
    else ej = armarEjecucion({ id, encargo, encargo_sha256, inicio, fin, autor: r?.autor ?? autorDe(adaptador), contenido: r?.contenido, intercambio: r?.intercambio ?? null, uso: r?.uso ?? null });
    ejecuciones.push(ej);
    if (!ESTADOS_CON_ERROR.includes(ej?.estado)) break;
  }
  return { ejecuciones, final: ejecuciones.at(-1) };
}

/** Lo que se le muestra a una persona sobre cada adaptador (sin inventar disponibilidad). */
export function describirAdaptadores(encargoDemo, encargoReal) {
  return [ADAPTADOR_SIN_MODELO, crearAdaptadorManual(new Map([[encargoDemo.rol, {}], [encargoReal.rol, {}]])), ADAPTADOR_OLLAMA].map((a) => ({
    id: a.id, nombre: a.nombre, es_ia: a.es_ia, costo_mxn: a.costo_mxn, usa_red: a.usa_red,
    demo: a.disponible(encargoDemo), real: a.disponible(encargoReal),
  }));
}
