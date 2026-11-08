// Laboratorio de IA · fase 2 · COORDINADOR (código determinista, no IA).
//
// Flujo vertical:  motor (solo lectura) → solicitud de una persona → Investigador → Analista → Abogado del Diablo
//                  (cada salida pasa por lab-V, el Verificador) → informe consolidado → REVISIÓN HUMANA.
//
// El Coordinador organiza y registra; no opina. Decide el estado SOLO con reglas mecánicas:
//   · un fallo de transporte del adaptador se reintenta (pocas veces) y, si persiste, el trabajo queda en «error»;
//   · una salida que no cumple el contrato (lab-V la rechaza) deja el trabajo en «error» (no se usa);
//   · si lab-V no pudo comprobar alguna cita, el trabajo queda en «requiere_evidencia»;
//   · si todo se pudo comprobar mecánicamente, queda en «requiere_revision» (nunca «aprobado»).
// Interrupciones: si la persona detiene el flujo, el trabajo vuelve a «pendiente» y, al reanudar, los pasos ya
// verificados no se repiten (son idempotentes por id). Cada documento producido se devuelve en orden para el registro.
// No escribe, no usa red, no ejecuta nada de lo que digan los roles y no toca ningún motor.

import { ROLES, L } from "./base.js";
import { validarEncargo } from "./contratos.js";
import { verificar, huellaDoc } from "./verificador.js";
import { transitar, rondaDe, COORDINADOR, ESTADOS_FINALES } from "./trabajo.js";
import { construirInforme, validarInforme } from "./informe.js";
import { ejecutarConReintentos } from "./adaptadores.js";

export const ETIQUETA_ROL = Object.freeze({ investigador: "Investigador", analista: "Analista", critico: "Abogado del Diablo", verificador: "Verificador (lab-V)", coordinador: "Coordinador" });
export const PREGUNTA_ROL = Object.freeze({
  investigador: "Lee la ficha del motor. Separa lo que dice literalmente (hechos citados) de lo que no dice (dudas). Cita líneas exactas.",
  analista: "Interpreta lo que encontró el Investigador: anomalías, fallos y riesgos. Declara como inferencia todo lo que no sea lectura directa y formula hipótesis falsables con su alternativa.",
  critico: "Actúa como Abogado del Diablo: objeta las conclusiones del Analista, busca supuestos, sobreajuste, problemas de alcance y de tiempo, y pide la evidencia que falta. No afirmes hechos nuevos.",
});
const CORTO = { investigador: "inv", analista: "ana", critico: "cri" };

/** Reloj determinista: cada llamada avanza un segundo desde `base` (instante con zona). Así el registro es reproducible. */
export function relojDesde(base, pasoMs = 1000) {
  let t = Date.parse(base);
  if (!Number.isFinite(t)) throw new Error("relojDesde: base debe ser un instante con zona.");
  return () => { t += pasoMs; return new Date(t).toISOString().replace(/\.\d{3}Z$/, "Z"); };
}

/** Encargo `cauce.lab.encargo` 0.1 de un rol. Lo crea la persona que pidió el trabajo (el Coordinador solo lo arma). */
export async function encargoDeRol(trabajo, rol, { fuente, previas, creado_en, ronda }) {
  const pre = trabajo.es_demo ? "demo-" : "";
  const cuerpo = trabajo.id.slice(`${pre}lab-trb-`.length).slice(0, 44);
  const insumos = [{ tipo: "copia_fuente", ref: fuente.fuente_id, sha256: fuente.sha256 }];
  if (rol !== "investigador") for (const r of ROLES.slice(0, ROLES.indexOf(rol))) if (previas[r]) insumos.push({ tipo: "lab_ejecucion_verificada", ref: previas[r].id, sha256: await huellaDoc(previas[r]) });
  return {
    contrato: "cauce.lab.encargo", version_contrato: "0.1", id: `${pre}lab-enc-${cuerpo}-r${ronda}-${CORTO[rol]}`, es_demo: trabajo.es_demo, rol,
    pregunta: `${trabajo.pregunta}\n\nRol ${ETIQUETA_ROL[rol]}: ${PREGUNTA_ROL[rol]}`.slice(0, 8000),
    insumos, fuentes_permitidas: [{ ...fuente }],
    corte_temporal: { conocido_antes_de: creado_en },
    herramientas: { red: "ninguna", dominios_permitidos: [], ejecutar_comandos: false },
    limites: { max_minutos: 10, max_tokens_salida: 8000, max_consultas_web: 0 },
    modelo_solicitado: { adaptador: trabajo.adaptador.id === "sin-modelo" ? "ninguno" : trabajo.adaptador.id, nombre: trabajo.adaptador.modelo ?? (trabajo.adaptador.id === "sin-modelo" ? "guion determinista (no es IA)" : "a declarar") },
    creado_por: { tipo: "humano", identificador: trabajo.solicitado_por.identificador }, creado_en,
    ...(trabajo.es_demo ? { nota: "[DEMO] Encargo de prueba del flujo del Laboratorio." } : {}),
  };
}

/**
 * Expediente de trabajo en memoria: el trabajo y todos los documentos que produjo (en orden).
 * fuente: { fuente (catálogo), copia: {bytes, texto}, hechos } de motores.fichaDesdeEstado().
 */
export function nuevoExpediente(trabajo, ficha) {
  return { trabajo, ficha, documentos: [{ tipo: "trabajo", documento: trabajo }], encargos: new Map(), ejecuciones: new Map(), verificaciones: new Map(), informe: null };
}
const indices = (x) => ({ encargos: x.encargos, ejecuciones: x.ejecuciones, verificaciones: x.verificaciones });
function anotar(x, tipo, documento) {
  x.documentos.push({ tipo, documento });
  if (tipo === "encargo") x.encargos.set(documento.id, documento);
  if (tipo === "ejecucion") x.ejecuciones.set(documento.id, documento);
  if (tipo === "verificacion") x.verificaciones.set(documento.ejecucion_id, documento);
  if (tipo === "informe") x.informe = documento;
}
function mover(x, a, motivo, en, cambios = {}) {
  x.trabajo = { ...transitar(x.trabajo, a, { por: COORDINADOR, motivo, en }), ...cambios };
  anotar(x, "trabajo", x.trabajo);
}

/**
 * Hace avanzar un trabajo hasta donde se pueda sin una persona. Devuelve el expediente (nuevo estado incluido).
 * @param x         expediente (nuevoExpediente)
 * @param opciones  { adaptador, reloj, senal: {aborted}, max_intentos_transporte, limite_ms, alPaso(rol, fase) }
 */
export async function avanzar(x, { adaptador, reloj, senal = null, max_intentos_transporte = 2, limite_ms = 30_000, alPaso = null }) {
  const t0 = x.trabajo;
  if (ESTADOS_FINALES.includes(t0.estado)) return x;
  if (!["pendiente"].includes(t0.estado)) return x; // requiere_* o error: lo siguiente lo decide una persona (o un reintento explícito)
  if (adaptador.id !== t0.adaptador.id) throw new Error(`El trabajo pide el adaptador «${t0.adaptador.id}» y se pasó «${adaptador.id}».`);
  const ronda = rondaDe(t0);
  mover(x, "en_analisis", `Coordinador inicia la ronda ${ronda} con ${adaptador.nombre}.`, reloj());
  const pasos = [...L(x.trabajo.pasos)];
  const previas = {};
  const consolidados = [];
  for (const rol of ROLES) {
    const hecho = pasos.find((p) => p.rol === rol);
    if (hecho && hecho.verificacion_id && !["rechazada", "sin_salida"].includes(hecho.resultado_verificacion)) {
      // Paso ya verificado en un avance anterior (reanudación): se reutiliza tal cual, no se repite.
      const ej = x.ejecuciones.get(hecho.ejecuciones.at(-1)), v = x.verificaciones.get(ej?.id);
      if (ej && v) { previas[rol] = ej; consolidados.push({ rol, ejecucion: ej, verificacion: v }); continue; }
    }
    if (senal?.aborted) { mover(x, "pendiente", `Interrumpido por la persona antes del rol ${ETIQUETA_ROL[rol]}; al reanudar sigue desde aquí.`, reloj(), { pasos }); return x; }
    alPaso?.(rol, "inicio");
    const encargo = hecho ? x.encargos.get(hecho.encargo_id) : await encargoDeRol(x.trabajo, rol, { fuente: x.ficha.fuente, previas, creado_en: reloj(), ronda });
    const ve = validarEncargo(encargo);
    if (!ve.ok) { mover(x, "error", `El encargo del rol ${ETIQUETA_ROL[rol]} no cumple su contrato: ${ve.errores.slice(0, 3).join(" ")}`, reloj(), { pasos }); return x; }
    if (!hecho) anotar(x, "encargo", encargo);
    const disp = adaptador.disponible(encargo);
    if (!disp.ok) {
      const paso = hecho ?? { rol, encargo_id: encargo.id, ejecuciones: [], verificacion_id: null, resultado_verificacion: null };
      if (!hecho) pasos.push(paso);
      if (disp.espera) { mover(x, "pendiente", disp.motivo, reloj(), { pasos, espera: { rol, motivo: disp.motivo, encargo_id: encargo.id } }); return x; }
      mover(x, "error", `Adaptador no disponible: ${disp.motivo}`, reloj(), { pasos }); return x;
    }
    const sha = await huellaDoc(encargo);
    const idBase = encargo.id.replace("lab-enc-", "lab-run-");
    const previosIntentos = hecho ? hecho.ejecuciones.length : 0;
    const { ejecuciones } = await ejecutarConReintentos(adaptador, {
      encargo, encargo_sha256: sha, reloj, max_intentos: max_intentos_transporte, limite_ms,
      idBase: previosIntentos ? `${idBase}-n${previosIntentos + 1}` : idBase,
      contexto: { hechos: x.ficha.hechos, fuente_id: x.ficha.fuente.fuente_id, previas: { ...previas }, ahora: encargo.creado_en },
    });
    for (const ej of ejecuciones) anotar(x, "ejecucion", ej);
    const final = ejecuciones.at(-1);
    const paso = hecho ?? { rol, encargo_id: encargo.id, ejecuciones: [], verificacion_id: null, resultado_verificacion: null };
    if (!hecho) pasos.push(paso);
    paso.ejecuciones = [...paso.ejecuciones, ...ejecuciones.map((e) => e?.id).filter((id) => typeof id === "string")];
    const { verificacion } = await verificar({ encargo, ejecucion: final, copias: new Map([[x.ficha.fuente.fuente_id, x.ficha.copia]]), registro: indices(x), ahora: reloj() });
    anotar(x, "verificacion", verificacion);
    paso.verificacion_id = verificacion.id; paso.resultado_verificacion = verificacion.resultado;
    alPaso?.(rol, "fin");
    if (["fallo", "sin_conexion"].includes(final?.estado)) { mover(x, "error", `El rol ${ETIQUETA_ROL[rol]} no respondió tras ${ejecuciones.length} intento(s): ${String(final.error).slice(0, 300)}`, reloj(), { pasos }); return x; }
    if (verificacion.resultado === "rechazada") { mover(x, "error", `lab-V rechazó la salida del rol ${ETIQUETA_ROL[rol]} (${verificacion.errores.length} error(es)): no se usa. ${verificacion.errores.slice(0, 2).join(" ")}`.slice(0, 1000), reloj(), { pasos }); return x; }
    if (verificacion.resultado === "sin_salida") { mover(x, "error", `El rol ${ETIQUETA_ROL[rol]} terminó sin salida utilizable.`, reloj(), { pasos }); return x; }
    previas[rol] = final;
    consolidados.push({ rol, ejecucion: final, verificacion });
  }
  const informe = construirInforme({ trabajo: x.trabajo, ronda, generado_en: reloj(), adaptador, pasos: consolidados });
  const vi = validarInforme(informe);
  if (!vi.ok) { mover(x, "error", `El informe consolidado no cumple su contrato (defecto del Coordinador): ${vi.errores.slice(0, 3).join(" ")}`, reloj(), { pasos }); return x; }
  anotar(x, "informe", informe);
  const ref = { id: informe.id, sha256: await huellaDoc(informe) };
  const motivo = informe.estado_propuesto === "requiere_evidencia"
    ? `lab-V no pudo comprobar parte de la evidencia (${informe.alertas.length} alerta(s)): falta o falla evidencia antes de revisar.`
    : `Las ${informe.verificaciones.reduce((s, v) => s + v.n_citas, 0)} citas se comprobaron mecánicamente. Queda la revisión humana (respaldo semántico, objeciones y recomendaciones).`;
  mover(x, informe.estado_propuesto, motivo, reloj(), { pasos, informe: ref });
  return x;
}

/** Reintento explícito tras un error (cuenta contra intentos.maximo). Lo puede pedir el código o una persona. */
export function reintentar(x, { por = COORDINADOR, motivo = "Reintento tras error.", en }) {
  x.trabajo = transitar(x.trabajo, "pendiente", { por, motivo, en });
  anotar(x, "trabajo", x.trabajo);
  return x;
}

/** Decisión de una PERSONA (aprobar, rechazar, pedir evidencia o mandar a revisión). El código nunca llama esto solo. */
export function decidir(x, a, { por, motivo, en }) {
  if (por?.tipo !== "humano") throw new Error("Solo una persona decide sobre un trabajo.");
  x.trabajo = transitar(x.trabajo, a, { por, motivo, en });
  anotar(x, "trabajo", x.trabajo);
  return x;
}

/** Resumen por estación para la oficina: qué hizo de verdad cada rol en este expediente (o nada). */
export function estaciones(x) {
  const t = x?.trabajo;
  const porRol = (rol) => L(t?.pasos).find((p) => p.rol === rol) ?? null;
  const r = {};
  for (const rol of ROLES) {
    const p = porRol(rol), ej = p ? x.ejecuciones.get(p.ejecuciones.at(-1)) : null;
    r[rol] = !p ? { estado: "sin_tarea" } : !ej ? { estado: t.espera?.rol === rol ? "esperando_respuesta" : "sin_tarea", encargo_id: p.encargo_id }
      : { estado: ["fallo", "sin_conexion"].includes(ej.estado) ? "fallo" : "trabajo_registrado", ejecucion_id: ej.id, intentos: p.ejecuciones.length, n_afirmaciones: L(ej.afirmaciones).length, n_hipotesis: L(ej.hipotesis).length, n_objeciones: L(ej.objeciones).length, n_dudas: L(ej.dudas).length, autor: ej.autor };
  }
  const vers = L(t?.pasos).filter((p) => p.verificacion_id);
  r.verificador = vers.length ? { estado: "trabajo_registrado", n_verificaciones: vers.length, resultados: vers.map((p) => p.resultado_verificacion) } : { estado: "sin_tarea" };
  r.coordinador = { estado: t ? "trabajo_registrado" : "sin_tarea", n_cambios: L(t?.historial).length, estado_trabajo: t?.estado ?? null };
  return r;
}
