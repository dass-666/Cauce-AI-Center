// Laboratorio de IA · fase 2 · adaptadores de modelo INTERCAMBIABLES.
//
// Todos cumplen la misma interfaz, así que cambiar de proveedor no cambia el Coordinador ni lab-V:
//   { id, adaptador, nombre, es_ia, costo_mxn, usa_red, disponible(encargo) → {ok, motivo}, ejecutar(p) → contenido }
// `ejecutar` devuelve solo el CONTENIDO de la salida (o una ejecución completa, en el adaptador manual); el documento
// `cauce.lab.ejecucion` lo arma armarEjecucion(), que fija encargo, huella, tiempos y autor. Lo que responda un modelo
// es contenido NO CONFIABLE: se valida con el contrato y se verifica con lab-V; nada de lo que diga se ejecuta.
//
// Disponibles en este repositorio (verificado, $0, sin instalar nada):
//   · sin-modelo     guion determinista, SOLO DEMO (no es IA; ver guion-demo.js);
//   · manual-claude  una persona copia el encargo a una sesión que ya tiene (p. ej. la app de Claude) y pega la
//                    respuesta; este código no llama a ninguna API ni guarda credenciales;
//   · ollama         declarado pero NO disponible: no está instalado ni autorizado. No hace ninguna llamada.
// Un proveedor de pago (API) NO existe aquí a propósito: el presupuesto es $0 y no hay credenciales.

import { L, esObj, ESTADOS_CON_ERROR, LIMITES } from "./base.js";
import { salidaGuion, AUTOR_GUION } from "./guion-demo.js";

const vacio = () => ({ afirmaciones: [], hipotesis: [], objeciones: [], dudas: [], contradicciones: [] });
const recorte = (t, n = 500) => String(t ?? "").replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/g, " ").slice(0, n);

export const ADAPTADOR_SIN_MODELO = Object.freeze({
  id: "sin-modelo", adaptador: "ninguno", nombre: "Guion determinista (sin modelo, DEMO)", es_ia: false, costo_mxn: 0, usa_red: false,
  disponible(encargo) {
    return encargo?.es_demo === true ? { ok: true, motivo: null }
      : { ok: false, motivo: "El guion sin modelo solo trabaja con datos DEMO: con datos REALES haría pasar reglas fijas por análisis de IA." };
  },
  async ejecutar({ encargo, contexto }) { return { contenido: salidaGuion(encargo, contexto), autor: { ...AUTOR_GUION } }; },
});

export const ADAPTADOR_OLLAMA = Object.freeze({
  id: "ollama", adaptador: "ollama", nombre: "Modelo local (Ollama) · no instalado", es_ia: true, costo_mxn: 0, usa_red: false,
  disponible() { return { ok: false, motivo: "Ollama no está instalado ni autorizado en este equipo (decisión pendiente de Diego). Este adaptador no hace ninguna llamada." }; },
  async ejecutar() { throw new Error("Ollama no disponible."); },
});

/**
 * Adaptador manual: `respuestas` es un Map rol → ejecución (JSON que una persona pegó desde su sesión de IA).
 * Sin respuesta para el rol, el trabajo queda en pendiente esperando (no se inventa nada). Con respuesta, se entrega
 * tal cual: si no corresponde al encargo (otro id, otra huella, otro mundo), lab-V la rechaza.
 */
export function crearAdaptadorManual(respuestas = new Map(), { modelo = "declarado por la persona" } = {}) {
  return Object.freeze({
    id: "manual-claude", adaptador: "manual-claude", nombre: `Respuesta pegada a mano (${modelo})`, es_ia: true, costo_mxn: 0, usa_red: false,
    disponible(encargo) {
      return respuestas.has(encargo?.rol) ? { ok: true, motivo: null }
        : { ok: false, motivo: `Esperando que una persona pegue la respuesta del rol «${encargo?.rol}» al encargo ${encargo?.id}.`, espera: true };
    },
    async ejecutar({ encargo }) { return { ejecucion: structuredClone(respuestas.get(encargo.rol)) }; },
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

/** Arma la ejecución `cauce.lab.ejecucion` 0.1 alrededor del contenido del adaptador. */
export function armarEjecucion({ id, encargo, encargo_sha256, inicio, fin, autor, contenido = null, estado = "terminado", error = null }) {
  const c = esObj(contenido) ? contenido : vacio();
  const conSalida = !ESTADOS_CON_ERROR.includes(estado);
  return {
    contrato: "cauce.lab.ejecucion", version_contrato: "0.1", id, es_demo: encargo.es_demo, encargo_id: encargo.id, encargo_sha256, rol: encargo.rol,
    estado, inicio, fin, latido: fin, autor,
    afirmaciones: conSalida ? c.afirmaciones ?? [] : [], hipotesis: conSalida ? c.hipotesis ?? [] : [], objeciones: conSalida ? c.objeciones ?? [] : [],
    dudas: conSalida ? c.dudas ?? [] : [], contradicciones: conSalida ? c.contradicciones ?? [] : [], consultas_web: [],
    uso: { tokens_entrada: null, tokens_salida: null, costo_mxn: 0 }, error: error === null ? null : recorte(error, LIMITES.texto),
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
    else if (r?.estado && ESTADOS_CON_ERROR.includes(r.estado)) ej = armarEjecucion({ id, encargo, encargo_sha256, inicio, fin, autor: r.autor ?? { tipo: "ia", identificador: adaptador.id, adaptador: adaptador.adaptador }, estado: r.estado, error: r.error ?? "sin detalle" });
    else ej = armarEjecucion({ id, encargo, encargo_sha256, inicio, fin, autor: r?.autor ?? { tipo: "ia", identificador: adaptador.id, adaptador: adaptador.adaptador }, contenido: r?.contenido });
    ejecuciones.push(ej);
    if (!ESTADOS_CON_ERROR.includes(ej?.estado)) break;
  }
  return { ejecuciones, final: ejecuciones.at(-1) };
}

/** Lo que se le muestra a una persona sobre cada adaptador (sin inventar disponibilidad). */
export function describirAdaptadores(encargoDemo, encargoReal) {
  return [ADAPTADOR_SIN_MODELO, crearAdaptadorManual(), ADAPTADOR_OLLAMA].map((a) => ({
    id: a.id, nombre: a.nombre, es_ia: a.es_ia, costo_mxn: a.costo_mxn, usa_red: a.usa_red,
    demo: a.disponible(encargoDemo), real: a.disponible(encargoReal),
  }));
}
