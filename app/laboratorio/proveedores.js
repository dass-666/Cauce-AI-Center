// Laboratorio de IA · fase 3 · adaptador para PROVEEDORES AUTOMÁTICOS de IA (preparado, APAGADO).
//
// Hoy no hay ningún proveedor automático conectado, y así debe seguir hasta que Diego lo autorice:
//   · no hay credenciales en este proyecto y este módulo no las lee ni las guarda (solo recibe si «hay» una);
//   · los proveedores de pago (API de Anthropic, OpenAI…) quedan bloqueados con presupuesto $0. Una suscripción de
//     chat (Claude, ChatGPT) NO da créditos de API;
//   · Ollama (local, sin costo) no está instalado ni autorizado;
//   · no existe ningún transporte HTTP: sin transporte, el adaptador no hace ninguna llamada.
// Lo que sí está hecho y probado (con un transporte FALSO, marcado [PRUEBA], solo en DEMO): selección explícita de
// proveedor, límites de tiempo y de tamaño, cancelación, errores de conexión, costo estimado, desactivación segura y
// el mismo análisis de respuesta que el intercambio manual. El resultado pasa por el contrato y por lab-V como
// cualquier otro: ningún adaptador puede aprobar nada.
//
// Interfaz de un transporte (lo implementaría quien conecte un proveedor real, con autorización):
//   { id, es_prueba, async enviar({ texto, modelo, senal }) → { texto, tokens_entrada?, tokens_salida?, modelo_informado? }
//                                                            | { error: "sin_conexion", detalle } }

import { L, esObj } from "./base.js";
import { componerSolicitud, analizarRespuesta } from "./manual.js";
import { autorIA } from "./adaptadores.js";

export const PROVEEDORES = Object.freeze({
  ninguno: { nombre: "Ninguno", de_pago: false, local: false },
  anthropic: { nombre: "API de Anthropic (Claude)", de_pago: true, local: false },
  openai: { nombre: "API de OpenAI", de_pago: true, local: false },
  ollama: { nombre: "Ollama (modelo local)", de_pago: false, local: true },
  prueba: { nombre: "[PRUEBA] transporte falso (no es IA)", de_pago: false, local: true, prueba: true },
});

/** Configuración por defecto: TODO apagado. Encenderlo exige escribirlo explícitamente (y la autorización de Diego). */
export const CONFIG_APAGADA = Object.freeze({
  proveedor: "ninguno", habilitado: false, modelo: null, limite_ms: 60_000, max_caracteres_solicitud: 120_000, max_caracteres_respuesta: 300_000,
  presupuesto_mxn: 0, costo_mxn_por_1k_tokens: null,
});
const C_CONFIG = Object.keys(CONFIG_APAGADA);

export function validarConfig(c) {
  if (!esObj(c)) return { ok: false, errores: ["La configuración debe ser un objeto."] };
  const errores = [];
  for (const k of Object.keys(c)) if (!C_CONFIG.includes(k)) errores.push(`clave desconocida «${k}» (una credencial nunca va en la configuración).`);
  if (!PROVEEDORES[c.proveedor]) errores.push(`proveedor «${c.proveedor}» desconocido (${Object.keys(PROVEEDORES).join(" | ")}).`);
  if (typeof c.habilitado !== "boolean") errores.push("habilitado debe ser true o false (explícito).");
  if (!(c.modelo === null || (typeof c.modelo === "string" && c.modelo.trim() && c.modelo.length <= 120))) errores.push("modelo debe ser texto o null.");
  if (!Number.isInteger(c.limite_ms) || c.limite_ms < 1000 || c.limite_ms > 600_000) errores.push("limite_ms entre 1000 y 600000.");
  for (const k of ["max_caracteres_solicitud", "max_caracteres_respuesta"]) if (!Number.isInteger(c[k]) || c[k] < 1000 || c[k] > 1_000_000) errores.push(`${k} entre 1000 y 1000000.`);
  if (typeof c.presupuesto_mxn !== "number" || c.presupuesto_mxn < 0) errores.push("presupuesto_mxn debe ser número ≥ 0.");
  if (!(c.costo_mxn_por_1k_tokens === null || (typeof c.costo_mxn_por_1k_tokens === "number" && c.costo_mxn_por_1k_tokens >= 0))) errores.push("costo_mxn_por_1k_tokens debe ser número ≥ 0 o null (desconocido).");
  if (PROVEEDORES[c.proveedor]?.de_pago && c.costo_mxn_por_1k_tokens === null) errores.push("un proveedor de pago necesita costo_mxn_por_1k_tokens para estimar el gasto antes de llamar.");
  return { ok: errores.length === 0, errores };
}

const tokensAprox = (t) => Math.ceil(String(t ?? "").length / 4);
/** Costo estimado (MXN) de una llamada: con tokens reales si el proveedor los informa; si no, ~4 caracteres por token. */
export function costoEstimado(config, { texto_solicitud = "", texto_respuesta = "", tokens_entrada = null, tokens_salida = null } = {}) {
  if (!PROVEEDORES[config?.proveedor]?.de_pago) return 0;
  const tin = Number.isInteger(tokens_entrada) ? tokens_entrada : tokensAprox(texto_solicitud);
  const tout = Number.isInteger(tokens_salida) ? tokens_salida : tokensAprox(texto_respuesta);
  return Math.round(((tin + tout) / 1000) * (config.costo_mxn_por_1k_tokens ?? 0) * 100) / 100;
}

/**
 * Adaptador automático. `credencial_presente` dice solo SI quien llama tiene una credencial (nunca cuál): este módulo
 * no la recibe ni la guarda.
 */
export function crearAdaptadorAutomatico(config = CONFIG_APAGADA, { transporte = null, credencial_presente = false } = {}) {
  const vc = validarConfig(config);
  const prov = PROVEEDORES[config?.proveedor] ?? PROVEEDORES.ninguno;
  let desactivado = false, enCurso = null;
  const esPrueba = transporte?.es_prueba === true || config?.proveedor === "prueba";
  const autor = esPrueba
    ? { tipo: "guion_demo", identificador: "transporte-de-prueba", adaptador: "automatico", proveedor: "prueba", modelo: null, procedencia: "no_aplica", verificada: false }
    : autorIA("ia_automatica", { identificador: config?.modelo ?? config?.proveedor ?? "automatico", adaptador: config?.proveedor === "ollama" ? "ollama" : "automatico", proveedor: config?.proveedor ?? null, modelo: config?.modelo ?? null });
  const motivoNo = (encargo) => {
    if (!vc.ok) return `configuración inválida: ${vc.errores.slice(0, 2).join(" ")}`;
    if (desactivado) return "desactivado por una persona (interruptor de seguridad).";
    if (!config.habilitado) return "apagado: hace falta configurarlo explícitamente y la autorización de Diego.";
    if (config.proveedor === "ninguno") return "no hay proveedor elegido.";
    if (prov.de_pago && config.presupuesto_mxn <= 0) return `bloqueado por presupuesto $0: ${prov.nombre} cobra por uso, y una suscripción de chat no da créditos de API.`;
    if (prov.de_pago && !credencial_presente) return "sin credencial: no hay ninguna configurada (y este proyecto no las guarda).";
    if (config.proveedor === "ollama" && !transporte) return "Ollama no está instalado ni autorizado en este equipo.";
    if (!transporte) return `no hay transporte implementado para ${prov.nombre}: no se hace ninguna llamada.`;
    if (esPrueba && encargo?.es_demo !== true) return "el transporte de prueba solo trabaja con datos DEMO (no es IA).";
    return null;
  };
  return {
    id: "automatico", adaptador: autor.adaptador, nombre: esPrueba ? "[PRUEBA] proveedor automático falso (no es IA)" : `Proveedor automático · ${prov.nombre}`,
    es_ia: !esPrueba, autoria: autor.tipo, autor, costo_mxn: 0, usa_red: !prov.local && !esPrueba, configuracion: { ...config },
    disponible(encargo) { const m = motivoNo(encargo); return m ? { ok: false, motivo: m } : { ok: true, motivo: null }; },
    /** Corta la llamada en curso (si la hay). */
    cancelar() { enCurso?.abort(); },
    /** Interruptor: desde aquí no hay más llamadas; la que esté en curso se corta. */
    desactivar() { desactivado = true; enCurso?.abort(); },
    get desactivado() { return desactivado; },
    async ejecutar({ encargo, encargo_sha256, contexto }) {
      const m = motivoNo(encargo);
      if (m) return { estado: "fallo", error: `Proveedor no disponible: ${m}` };
      const previas = ["investigador", "analista"].filter((r) => contexto?.previas?.[r]).map((r) => {
        const ej = contexto.previas[r];
        return { rol: r, ejecucion_id: ej.id, autoria: ej.autor?.tipo, resultado_lab_v: "verificada", afirmaciones: L(ej.afirmaciones).map((a) => ({ id: a.id, clase: a.clase, texto: a.texto })), hipotesis: L(ej.hipotesis).map((h) => ({ id: h.id, enunciado: h.enunciado })), objeciones: L(ej.objeciones) };
      });
      const texto = componerSolicitud({ es_demo: encargo.es_demo, trabajo_id: "(automático)", pregunta: encargo.pregunta, encargo, encargo_sha256, fuente_id: contexto?.fuente_id, texto_ficha: L(contexto?.hechos).map((h) => h.linea).join("\n"), previas });
      if (texto.length > config.max_caracteres_solicitud) return { estado: "fallo", error: `La solicitud (${texto.length} caracteres) supera el límite ${config.max_caracteres_solicitud}: no se envía.` };
      const previo = costoEstimado(config, { texto_solicitud: texto, tokens_salida: 8000 });
      if (previo > config.presupuesto_mxn) return { estado: "fallo", error: `El costo estimado (${previo} MXN) supera el presupuesto (${config.presupuesto_mxn} MXN): no se envía.` };
      const ctl = new AbortController();
      enCurso = ctl;
      let t;
      let r;
      try {
        r = await Promise.race([
          transporte.enviar({ texto, modelo: config.modelo, senal: ctl.signal }),
          new Promise((_, rechazar) => { t = setTimeout(() => { ctl.abort(); rechazar(new Error(`tiempo agotado (${config.limite_ms} ms)`)); }, config.limite_ms); }),
          new Promise((_, rechazar) => ctl.signal.addEventListener("abort", () => rechazar(new Error(desactivado ? "desactivado durante la llamada" : "cancelado por una persona")), { once: true })),
        ]);
      } catch (err) { return { estado: "sin_conexion", error: `La llamada no terminó: ${String(err?.message ?? err).slice(0, 200)}` }; }
      finally { clearTimeout(t); enCurso = null; }
      if (r?.error) return { estado: "sin_conexion", error: `El proveedor no respondió: ${String(r.detalle ?? r.error).slice(0, 200)}` };
      const respuesta = String(r?.texto ?? "");
      if (respuesta.length > config.max_caracteres_respuesta) return { estado: "fallo", error: `La respuesta (${respuesta.length} caracteres) supera el límite ${config.max_caracteres_respuesta}: no se usa.` };
      const an = analizarRespuesta(respuesta, { encargo, encargo_sha256 });
      if (!an.ok) return { estado: "fallo", error: `Respuesta no utilizable: ${an.errores.slice(0, 2).join(" ")}` };
      const tin = Number.isInteger(r.tokens_entrada) ? r.tokens_entrada : null, tout = Number.isInteger(r.tokens_salida) ? r.tokens_salida : null;
      const aut = esPrueba ? { ...autor } : { ...autor, modelo: typeof r.modelo_informado === "string" ? r.modelo_informado.slice(0, 120) : autor.modelo };
      return { contenido: an.contenido, autor: aut, uso: { tokens_entrada: tin, tokens_salida: tout, costo_mxn: costoEstimado(config, { texto_solicitud: texto, texto_respuesta: respuesta, tokens_entrada: tin, tokens_salida: tout }) } };
    },
  };
}

/**
 * Transporte FALSO, solo para pruebas y DEMO. Arma una respuesta fija desde la propia solicitud (no es IA),
 * o simula fallos: "sin_conexion", "lento" (nunca responde), "enorme", "invalido", "truncado".
 */
export function crearTransporteDePrueba(modo = "guion") {
  let llamadas = 0;
  return {
    id: "transporte-de-prueba", es_prueba: true, get llamadas() { return llamadas; },
    async enviar({ texto, senal }) {
      llamadas++;
      if (modo === "sin_conexion") return { error: "sin_conexion", detalle: "[PRUEBA] conexión rechazada (simulada)." };
      if (modo === "lento") return new Promise((_, rechazar) => senal?.addEventListener("abort", () => rechazar(new Error("abortado")), { once: true }));
      if (modo === "enorme") return { texto: "x".repeat(400_000) };
      if (modo === "invalido") return { texto: "No puedo responder en JSON, lo siento." };
      const enc = /encargo: (\S+)/.exec(texto)?.[1], sha = /Huella del encargo[^:]*: ([0-9a-f]{64})/.exec(texto)?.[1], rol = [...texto.matchAll(/"rol": "([a-z]+)"/g)].at(-1)?.[1]; // la plantilla va al final
      const fuente_id = /fuente_id «([^»]+)»/.exec(texto)?.[1];
      const lineas = [...texto.matchAll(/^\[L\d+\] (.*)$/gm)].map((m) => ({ linea: m[1], tipo: "linea" }));
      const cont = rol === "investigador"
        ? { afirmaciones: lineas.slice(0, 2).map((h, i) => ({ id: `p${i + 1}`, texto: `[PRUEBA · no es IA] Línea ${i + 1} de la ficha.`, clase: "hecho_citado", citas: [{ fuente_id, extracto: h.linea, ubicacion: `línea ${i + 1}` }] })), dudas: ["[PRUEBA] Solo hay una fuente."] }
        : rol === "analista" ? { afirmaciones: [{ id: "q1", texto: "[PRUEBA · no es IA] Interpretación de prueba.", clase: "inferencia", citas: lineas.slice(0, 1).map((h) => ({ fuente_id, extracto: h.linea, ubicacion: "línea 1" })) }] }
        : { afirmaciones: [], objeciones: [{ id: "o1", a: `${[...texto.matchAll(/"ejecucion_id": "([^"]+)"/g)].at(-1)?.[1]}#q1`, tipo: "supuesto", texto: "[PRUEBA · no es IA] Objeción de prueba." }] };
      const json = JSON.stringify({ formato: "cauce.lab.respuesta-manual", version: "0.1", encargo_id: enc, encargo_sha256: sha, rol, modelo_declarado: null, ...cont });
      return { texto: modo === "truncado" ? json.slice(0, Math.floor(json.length / 2)) : json, tokens_entrada: Math.ceil(texto.length / 4), tokens_salida: Math.ceil(json.length / 4) };
    },
  };
}

/** Lo que la oficina muestra de los proveedores automáticos (sin inventar disponibilidad). */
export function describirProveedores() {
  const enc = { es_demo: false, rol: "investigador", id: "real" };
  return ["anthropic", "openai", "ollama"].map((p) => {
    const conf = { ...CONFIG_APAGADA, proveedor: p, costo_mxn_por_1k_tokens: PROVEEDORES[p].de_pago ? 1 : null };
    const d = crearAdaptadorAutomatico(conf).disponible(enc);
    // Además de «apagado», lo que lo bloquearía aunque se encendiera (para no dar a entender que basta un interruptor).
    const fondo = crearAdaptadorAutomatico({ ...conf, habilitado: true }).disponible(enc);
    return { id: `auto-${p}`, nombre: `Automático · ${PROVEEDORES[p].nombre}`, disponible: d.ok, motivo: d.ok ? null : `${d.motivo}${fondo.motivo && fondo.motivo !== d.motivo ? ` Además: ${fondo.motivo}` : ""}` };
  });
}
