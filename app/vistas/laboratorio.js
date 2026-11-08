// Laboratorio de IA: departamento dentro de Cauce AI Center (tecla L o ?laboratorio=1). Como Nexus y CSI, es HTML y un
// plano SVG estático: mientras está abierto la vista 3D no dibuja (cero costo de tarjeta gráfica, Intel UHD).
//
// Reglas de la vista:
//   · cada estación muestra SOLO lo que su rol dejó registrado en el trabajo elegido; sin registro, silla vacía;
//   · la marca «SIN MODELO · no es IA» acompaña a todo lo que produjo el guion DEMO;
//   · ningún botón aprueba solo: aprobar o rechazar exige el nombre y el motivo de una persona, y vive en esta pestaña
//     (para el registro auditable: herramientas/laboratorio.mjs revisar). Nada se escribe en motores ni en Nexus;
//   · los textos de los roles entran como texto, nunca como HTML.
// Sin animaciones permanentes: un resaltado breve en la estación que trabaja mientras corre el flujo, y nada más.
//
// Fase 3 · consulta con IA REAL por intercambio manual: la persona crea una consulta, copia la solicitud del rol que
// espera a su conversación de Claude, pega la respuesta y el sistema la valida (formato, encargo, huella, repetición),
// la verifica con lab-V y sigue al siguiente rol. Nada se envía solo: no hay API, ni navegador automatizado, ni
// credenciales. Los trabajos manuales se guardan en este navegador (y se pueden exportar) para reanudarlos.

import { el, fecha } from "./dom.js";
import { escenariosDemo, crearAdaptadorManipulado } from "../laboratorio/escenarios-demo.js";
import { nuevoExpediente, avanzar, reintentar, decidir, estaciones, relojDesde, ETIQUETA_ROL } from "../laboratorio/coordinador.js";
import { nuevoTrabajo, ETIQUETA_ESTADO, ESTADOS_FINALES, TRANSICIONES, validarTrabajo } from "../laboratorio/trabajo.js";
import { ADAPTADOR_SIN_MODELO, crearAdaptadorManual, describirAdaptadores } from "../laboratorio/adaptadores.js";
import { fichaDesdeEstado, MOTORES_SIN_INTEGRACION } from "../laboratorio/motores.js";
import { informeMarkdown } from "../laboratorio/informe.js";
import { prepararPropuestaNexus } from "../laboratorio/propuesta-nexus.js";
import { entradasDeDocumentos, serializar } from "../laboratorio/registro.js";
import { PREGUNTA_DEMO } from "../laboratorio/escenarios-demo.js";
import { solicitudManual, continuarConRespuesta, huellasImportadas, encargoEnEspera, LIMITE_RESPUESTA } from "../laboratorio/manual.js";
import { exportarExpediente, restaurarExpediente } from "../laboratorio/expediente.js";
import { naturalezaDe, faseDe, rolesDe, NATURALEZA } from "../laboratorio/presentacion.js";
import { estadoDecision, proveedorIdentidad, ADVERTENCIA_DECLARADA } from "../laboratorio/identidad.js";
import { describirProveedores } from "../laboratorio/proveedores.js";
import { ETIQUETA_AUTORIA, L } from "../laboratorio/base.js";

const ESTACIONES = [
  ["investigador", "Investigador", "Lee la ficha del motor, cita hechos y anota lo que falta.", 70, 210],
  ["analista", "Analista", "Interpreta: anomalías, riesgos e hipótesis con su alternativa.", 230, 210],
  ["critico", "Abogado del Diablo", "Objeta conclusiones, supuestos, alcance y tiempos.", 390, 210],
  ["verificador", "Verificador (lab-V)", "Código: comprueba cada cita contra la fuente y su huella.", 550, 210],
  ["coordinador", "Coordinador", "Código: organiza, registra estados y arma el informe.", 310, 70],
];
const PESTANAS = [["hallazgos", "Hallazgos y evidencia"], ["hipotesis", "Hipótesis"], ["objeciones", "Objeciones"], ["faltante", "Falta y limitaciones"], ["recomendaciones", "Recomendaciones"], ["verificacion", "Verificación"], ["auditoria", "Auditoría"]];
const ESTADO_CLASE = { pendiente: "c-demo", en_analisis: "c-real", requiere_evidencia: "c-aviso", requiere_revision: "c-aviso", aprobado_por_humano: "c-real", rechazado: "c-error", error: "c-error" };
const INCERT = { baja: "baja", media: "media", alta: "alta", desconocida: "desconocida" };

/** Estado de la vista (en memoria: se pierde al recargar; los trabajos DEMO se recalculan igual). */
const inicial = () => ({ expedientes: [], cargando: false, cargado: false, errores: [], elegido: null, pestana: "hallazgos", corriendo: null, activa: null, senal: null, reales: [], docs: {}, mensaje: null, n: 1, propuesta: null, solicitud: null, importacion: null, copiado: null });
const ui = inicial();
let alCambiarContador = null;
/** Clave del navegador donde se guardan los trabajos con respuestas manuales (solo en este equipo). */
export const CLAVE_GUARDADO = "cauce.lab.expedientes-manuales";
const MOTORES_DEMO = [["compago", "Compago"], ["ek-chuah", "Ek Chuah"], ["csi", "CSI"]];
const PREGUNTA_MANUAL = "¿Qué problemas muestra la última lectura del motor, qué explicaciones caben y qué información falta para decidir?";
const ahoraISO = () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

/** Trabajos que esperan a una persona: revisar, aportar evidencia, reintentar o pegar la respuesta del modelo. */
export const esperanPersona = () => ui.expedientes.filter((x) => ["requiere_revision", "requiere_evidencia", "error"].includes(x.trabajo.estado) || (x.trabajo.estado === "pendiente" && x.trabajo.espera)).length;

/** Para pruebas: vuelve al estado inicial. */
export function reiniciarLaboratorio() { Object.assign(ui, inicial()); }

// ------------------------------------------------------------------ guardado local (para reanudar sin perder trabajo)
function guardar() {
  try {
    const manuales = ui.expedientes.filter((x) => x.trabajo.adaptador.id === "manual-claude").map((x) => exportarExpediente(x, { exportado_en: ahoraISO() }));
    localStorage.setItem(CLAVE_GUARDADO, JSON.stringify(manuales));
  } catch (err) { ui.mensaje = `No se pudo guardar en este navegador (${err.message}). Exporta el expediente para no perderlo.`; }
}
async function recuperarGuardados() {
  let lista = [];
  try { lista = JSON.parse(localStorage.getItem(CLAVE_GUARDADO) ?? "[]"); } catch { ui.errores.push("Los trabajos guardados en este navegador no se pudieron leer (se conservan sin tocar)."); return; }
  for (const o of Array.isArray(lista) ? lista : []) {
    const r = await restaurarExpediente(o);
    if (r.ok) { if (!ui.expedientes.some((x) => x.trabajo.id === r.expediente.trabajo.id)) ui.expedientes.unshift(r.expediente); }
    else ui.errores.push(`Un trabajo guardado (${String(o?.trabajo_id ?? "?").slice(0, 60)}) no se pudo reanudar: ${r.errores.slice(0, 2).join(" ")}`);
  }
}

/**
 * @param nodo     contenedor (#laboratorio)
 * @param opciones { alCerrar(), cargarJSON(url), alContador(n) }
 */
export function dibujarLaboratorio(nodo, { alCerrar, cargarJSON, alContador = null }) {
  alCambiarContador = alContador;
  const redibujar = () => dibujarLaboratorio(nodo, { alCerrar, cargarJSON, alContador });
  if (!ui.cargado && !ui.cargando) { ui.cargando = true; cargar(cargarJSON).then(redibujar); }
  const cabeza = el("div", { clase: "sala-cabeza" },
    el("div", {},
      el("h2", { id: "laboratorio-titulo", tabindex: "-1" }, "Laboratorio de IA · departamento de análisis"),
      el("p", { clase: "sala-sub" }, "Analiza lo que entregan los motores (solo lectura), comprueba cada cita y prepara propuestas. No controla motores ni aprueba nada: decide una persona.")),
    el("button", { type: "button", clase: "boton", onclick: alCerrar, title: "Cerrar el Laboratorio y volver al edificio (L o Esc)" }, "Ir al edificio ›"));
  const x = ui.expedientes.find((e) => e.trabajo.id === ui.elegido) ?? ui.expedientes[0] ?? null;
  const partes = [cabeza, bandaModo(x)];
  if (ui.errores.length) partes.push(el("div", { clase: "nexus-errores", role: "alert" }, el("strong", {}, "No se pudo preparar todo:"), el("ul", {}, ...ui.errores.slice(0, 6).map((t) => el("li", {}, t)))));
  if (ui.mensaje) partes.push(el("p", { clase: "lab-mensaje", role: "status" }, ui.mensaje));
  partes.push(area(x));
  partes.push(flujo(x));
  if (!ui.cargado) partes.push(el("p", { clase: "sala-vacio" }, "Preparando los trabajos DEMO del Laboratorio…"));
  else {
    partes.push(controles(cargarJSON, redibujar));
    partes.push(listaTrabajos(redibujar));
    if (x && encargoEnEspera(x)) partes.push(panelManual(x, redibujar));
    if (x) partes.push(detalle(x, redibujar));
    partes.push(adaptadoresPanel());
  }
  // Redibujar no debe robar ni perder el foco: si estaba en el título (o en ningún lado), vuelve al título.
  const enTitulo = document.activeElement?.id === "laboratorio-titulo" || document.activeElement === document.body;
  nodo.replaceChildren(...partes);
  if (enTitulo && !nodo.hidden) nodo.querySelector("#laboratorio-titulo")?.focus({ preventScroll: true });
}

async function cargar(cargarJSON) {
  const [c, e, k] = await Promise.all([cargarJSON("datos/demo/compago.json"), cargarJSON("datos/demo/ek-chuah.json"), cargarJSON("datos/demo/csi.json")]);
  const docs = {};
  if (c.tipo === "ok") docs.compago = c.datos; else ui.errores.push(`datos/demo/compago.json: ${c.mensaje}`);
  if (e.tipo === "ok") docs["ek-chuah"] = e.datos; else ui.errores.push(`datos/demo/ek-chuah.json: ${e.mensaje}`);
  if (k.tipo === "ok") ui.docs.csi = k.datos;
  Object.assign(ui.docs, docs);
  try {
    const r = await escenariosDemo(docs);
    ui.expedientes = r.expedientes; ui.errores.push(...r.errores);
  } catch (err) { ui.errores.push(`Flujo DEMO: ${err.message}`); }
  // REAL: el Laboratorio lee los mismos archivos que la oficina (solo lectura). Si no existen, lo dice.
  ui.reales = [];
  for (const m of ["compago", "ek-chuah"]) {
    const r = await cargarJSON(`datos/reales/${m}.json`);
    if (r.tipo === "ok" && r.datos?.es_demo === false) ui.reales.push({ motor: m, documento: r.datos });
  }
  await recuperarGuardados();
  ui.cargando = false; ui.cargado = true;
  ui.elegido = ui.elegido ?? ui.expedientes[0]?.trabajo.id ?? null;
  alCambiarContador?.(esperanPersona());
}

function bandaModo(x) {
  const nat = x ? naturalezaDe(x) : null;
  if (x && !x.trabajo.es_demo) return el("p", { clase: "nexus-fuente nexus-fuente-real", role: "note", "data-modo": "real" }, el("strong", {}, `REAL · ${nat.etiqueta}`), ` · Trabajo sobre una lectura real de ${x.trabajo.origen.nombre} (solo lectura). Las respuestas del modelo son contenido no confiable: lab-V las verifica y decide una persona.`);
  if (nat?.tipo === "ia_manual") return el("p", { clase: "nexus-fuente lab-banda-ia", role: "note", "data-modo": "ia-manual" },
    el("strong", {}, "DATOS DEMO · ANÁLISIS DE IA REAL POR INTERCAMBIO MANUAL"),
    " · Las respuestas las escribe un modelo de IA en tu conversación y las traes tú: su procedencia es DECLARADA (nadie puede comprobar qué modelo respondió). Los datos del motor son DEMO. lab-V verifica cada cita; decide una persona.");
  return el("p", { clase: "nexus-fuente nexus-fuente-demo nexus-demo", role: "note", "data-modo": "demo" },
    el("strong", {}, "DEMO · SIN MODELO · NO ES IA"),
    " · Las salidas de los roles las produce un guion determinista escrito a mano sobre los datos DEMO de la oficina. Sirve para probar el flujo, la verificación y la revisión humana. No hay ningún modelo conectado (presupuesto $0).");
}

/** Plano del departamento: cinco estaciones. Persona sentada solo si su rol dejó registro en el trabajo elegido. */
function area(x) {
  const est = x ? estaciones(x) : {};
  const NS = "http://www.w3.org/2000/svg";
  const s = (t, a = {}, ...h) => { const n = document.createElementNS(NS, t); for (const [k, v] of Object.entries(a)) if (v !== null && v !== undefined) n.setAttribute(k, String(v)); for (const c of h) if (c !== null && c !== undefined) n.append(c instanceof Node ? c : document.createTextNode(String(c))); return n; };
  const svg = s("svg", { viewBox: "0 0 640 300", class: "lab-area", role: "img", "aria-label": "Plano del Laboratorio de IA: cinco estaciones de trabajo" });
  svg.append(s("rect", { x: 6, y: 6, width: 628, height: 288, rx: 14, class: "lab-sala" }));
  svg.append(s("text", { x: 20, y: 30, class: "lab-sala-nombre" }, "LABORATORIO DE IA"));
  svg.append(s("text", { x: 620, y: 30, class: "lab-sala-nombre", "text-anchor": "end" }, x ? `${x.trabajo.es_demo ? "DATOS DEMO" : "DATOS REALES"} · ${naturalezaDe(x).corta}` : "sin trabajo"));
  for (const [rol, nombre, , cx, cy] of ESTACIONES) {
    const e = est[rol] ?? { estado: "sin_tarea" };
    const ocupada = e.estado === "trabajo_registrado" || e.estado === "fallo";
    const aut = e.autor ? autoriaCorta(e) : null;
    const g = s("g", { class: `lab-estacion lab-${e.estado}${ui.activa === rol ? " lab-activa" : ""}${aut ? ` lab-aut-${aut.tipo}` : ""}`, "data-rol": rol, "data-estado": e.estado, "data-autoria": aut?.tipo ?? null });
    g.append(s("rect", { x: cx - 58, y: cy - 34, width: 116, height: 26, rx: 4, class: "lab-mesa" }));
    g.append(s("rect", { x: cx - 16, y: cy - 52, width: 32, height: 20, rx: 2, class: "lab-monitor" }));
    // Silla siempre; persona solo con registro (regla de Cauce: sin evidencia, silla vacía).
    g.append(s("rect", { x: cx - 13, y: cy + 2, width: 26, height: 18, rx: 6, class: "lab-silla" }));
    if (ocupada) { g.append(s("circle", { cx, cy: cy - 2, r: 9, class: "lab-cabeza" })); g.append(s("rect", { x: cx - 12, y: cy + 6, width: 24, height: 18, rx: 8, class: "lab-torso" })); }
    g.append(s("text", { x: cx, y: cy + 44, class: "lab-nombre", "text-anchor": "middle" }, nombre));
    g.append(s("text", { x: cx, y: cy + 60, class: "lab-dato", "text-anchor": "middle" }, textoEstacion(rol, e)));
    svg.append(g);
  }
  return el("figure", { clase: "lab-figura" }, svg,
    el("figcaption", { clase: "lab-leyenda" }, "Una persona aparece sentada solo si su rol dejó registro en el trabajo elegido; si no, la silla está vacía. ",
      el("span", { clase: "lab-nota" }, "Investigador, Analista y Abogado del Diablo son roles de IA; en DEMO los cubre el guion sin modelo. Verificador y Coordinador son código.")));
}

/** Autoría de lo que dejó una estación (0.1 se interpreta: adaptador «ninguno» = guion). */
function autoriaCorta(e) {
  const a = e.autor ?? {};
  const tipo = a.tipo === "ia" ? (a.adaptador === "ninguno" ? "guion_demo" : a.adaptador === "manual-claude" ? "ia_manual" : "ia_automatica") : a.tipo;
  return { tipo, texto: NATURALEZA[tipo]?.corta ?? tipo };
}

function textoEstacion(rol, e) {
  if (e.estado === "sin_tarea") return "En espera · sin tarea";
  if (e.estado === "esperando_respuesta") return "Espera respuesta";
  if (e.estado === "fallo") return `Falló · ${e.intentos} intento(s)`;
  if (rol === "verificador") return `${e.n_verificaciones} verificación(es)`;
  if (rol === "coordinador") return `${ETIQUETA_ESTADO[e.estado_trabajo] ?? "—"} · ${e.n_cambios} cambio(s)`;
  const p = [e.n_afirmaciones && `${e.n_afirmaciones} afirm.`, e.n_hipotesis && `${e.n_hipotesis} hip.`, e.n_objeciones && `${e.n_objeciones} obj.`, e.n_dudas && `${e.n_dudas} dudas`].filter(Boolean);
  return `${autoriaCorta(e).texto} · ${p.join(" · ") || "sin contenido"}`;
}

function flujo(x) {
  const pasos = [["motor", `Motor${x ? ` · ${x.trabajo.origen.nombre}` : ""} (solo lectura)`], ["investigador", "Investigador"], ["analista", "Analista"], ["critico", "Abogado del Diablo"], ["verificador", "lab-V verifica"], ["coordinador", "Informe"], ["persona", "Revisión humana"]];
  const t = x?.trabajo;
  return el("ol", { clase: "lab-flujo", "aria-label": "Flujo del trabajo" }, ...pasos.map(([k, txt]) => {
    const hecho = k === "motor" ? !!t : k === "persona" ? ESTADOS_FINALES.includes(t?.estado) : k === "coordinador" ? !!t?.informe : k === "verificador" ? (t?.pasos ?? []).some((p) => p.verificacion_id) : (t?.pasos ?? []).some((p) => p.rol === k && p.ejecuciones.length);
    const espera = k === "persona" && ["requiere_revision", "requiere_evidencia", "error"].includes(t?.estado);
    return el("li", { clase: `lab-flujo-paso${hecho ? " lab-hecho" : ""}${espera ? " lab-espera" : ""}${ui.activa === k ? " lab-activa" : ""}`, "data-paso": k }, txt, espera ? " · te espera" : "");
  }));
}

function controles(cargarJSON, redibujar) {
  const corriendo = !!ui.corriendo;
  const partes = [
    el("button", { type: "button", clase: "boton", "data-accion": "correr-demo", disabled: corriendo, onclick: () => correrDemo("compago", cargarJSON, redibujar), title: "Crea un trabajo DEMO nuevo sobre Compago y lo hace pasar por los cinco roles, paso a paso" }, "▶ Correr un trabajo DEMO paso a paso"),
    el("button", { type: "button", clase: "boton", "data-accion": "correr-ek", disabled: corriendo, onclick: () => correrDemo("ek-chuah", cargarJSON, redibujar) }, "▶ … sobre Ek Chuah"),
    corriendo ? el("button", { type: "button", clase: "boton", "data-accion": "detener", onclick: () => { if (ui.senal) ui.senal.aborted = true; } }, "■ Detener") : null,
  ];
  const reales = ui.reales.length
    ? el("p", { clase: "lab-nota" }, `Lecturas REALES disponibles: ${ui.reales.map((r) => r.motor).join(", ")}. `,
      ...ui.reales.map((r) => el("button", { type: "button", clase: "boton boton-chico", "data-accion": `real-${r.motor}`, onclick: () => prepararReal(r, redibujar) }, `Preparar trabajo REAL de ${r.motor} (respuesta manual)`)))
    : el("p", { clase: "lab-nota", "data-reales": "0" }, "Lecturas REALES: ninguna (datos/reales/ no tiene exportaciones de los motores). Sin ellas no se crean trabajos REALES. ",
      el("span", {}, `Tezcatlipoca: ${MOTORES_SIN_INTEGRACION.tezcatlipoca}`));
  return el("div", { clase: "lab-controles" }, nuevaConsulta(redibujar), el("div", { clase: "lab-botones" }, ...partes), reales);
}

/** Formulario: consulta nueva con IA real por intercambio manual (sobre los datos DEMO o una lectura REAL). */
function nuevaConsulta(redibujar) {
  const opciones = [...MOTORES_DEMO.filter(([m]) => ui.docs[m]).map(([m, n]) => el("option", { value: `demo:${m}` }, `${n} · datos DEMO`)),
    ...ui.reales.map((r) => el("option", { value: `real:${r.motor}` }, `${r.motor} · lectura REAL`))];
  return el("details", { clase: "lab-nueva", open: ui.expedientes.some((x) => x.trabajo.adaptador.id === "manual-claude") ? null : "" },
    el("summary", {}, el("strong", {}, "Consulta nueva con Claude (respuesta manual, $0)")),
    el("p", { clase: "lab-nota" }, "El sistema prepara la solicitud de cada rol; tú la copias a tu conversación de Claude y pegas la respuesta. No se usa ninguna API ni se envía nada solo."),
    el("div", { clase: "lab-form" },
      el("label", {}, "Motor ", el("select", { id: "lab-nueva-motor" }, ...opciones)),
      el("label", {}, "Quién pide ", el("input", { id: "lab-nueva-por", type: "text", value: "diego", maxlength: "80", autocomplete: "off" })),
      el("label", { clase: "lab-ancho" }, "Pregunta ", el("textarea", { id: "lab-nueva-pregunta", rows: "2", maxlength: "2000", clase: "lab-texto" }, PREGUNTA_MANUAL))),
    el("div", { clase: "lab-botones" }, el("button", { type: "button", clase: "boton", "data-accion": "nueva-manual", disabled: !!ui.corriendo || !opciones.length, onclick: () => crearConsulta(redibujar) }, "Crear consulta y preparar la solicitud del Investigador"),
      el("label", { clase: "boton boton-chico lab-archivo" }, "Reanudar un expediente exportado…", el("input", { id: "lab-importar-expediente", type: "file", accept: ".json,application/json", onchange: (ev) => importarExpediente(ev.target.files?.[0], redibujar) }))));
}

async function crearConsulta(redibujar) {
  const [mundo, motor] = String(document.getElementById("lab-nueva-motor")?.value ?? "").split(":");
  const por = document.getElementById("lab-nueva-por")?.value?.trim(), pregunta = document.getElementById("lab-nueva-pregunta")?.value?.trim();
  if (!por || !pregunta || pregunta.length < 10) { ui.mensaje = "Escribe quién pide y una pregunta de al menos 10 caracteres."; redibujar(); return; }
  const documento = mundo === "real" ? ui.reales.find((r) => r.motor === motor)?.documento : ui.docs[motor];
  if (!documento) { ui.mensaje = "No hay datos para ese motor."; redibujar(); return; }
  const ahora = ahoraISO();
  const ficha = await fichaDesdeEstado(documento, { leido_en: ahora });
  if (!ficha.ok) { ui.mensaje = `La lectura no se puede usar: ${ficha.errores.slice(0, 2).join(" ")}`; redibujar(); return; }
  const real = mundo === "real";
  const id = `${real ? "" : "demo-"}lab-trb-${motor}-manual-${ahora.replace(/[-:]/g, "").toLowerCase()}`;
  let t;
  try { t = nuevoTrabajo({ id, es_demo: !real, titulo: `${ficha.origen.nombre} · consulta con IA (respuesta manual)`, pregunta: real ? pregunta : `[DATOS DEMO] ${pregunta}`, origen: ficha.origen, solicitado_por: { tipo: "humano", identificador: por }, creado_en: ahora, adaptador: { id: "manual-claude", modelo: null } }); }
  catch (err) { ui.mensaje = err.message; redibujar(); return; }
  const v = validarTrabajo(t);
  if (!v.ok) { ui.mensaje = `No se pudo crear: ${v.errores.slice(0, 2).join(" ")}`; redibujar(); return; }
  const x = nuevoExpediente(t, ficha);
  await avanzar(x, { adaptador: crearAdaptadorManual(new Map()), reloj: relojDesde(ahora) });
  ui.expedientes.unshift(x); ui.elegido = t.id; ui.importacion = null; ui.solicitud = null;
  ui.mensaje = `Consulta creada. Paso 1: copia la solicitud del Investigador a tu conversación de Claude.${ficha.vigencia?.vencida ? " Atención: la lectura del motor está vencida (foto vieja)." : ""}`;
  guardar(); alCambiarContador?.(esperanPersona());
  redibujar();
}

async function importarExpediente(archivo, redibujar) {
  if (!archivo) return;
  let o;
  try { o = JSON.parse(await archivo.text()); } catch { ui.mensaje = "Ese archivo no es un expediente JSON válido."; redibujar(); return; }
  const r = await restaurarExpediente(o);
  if (!r.ok) { ui.mensaje = `No se reanudó: ${r.errores.slice(0, 3).join(" ")}`; redibujar(); return; }
  ui.expedientes = [r.expediente, ...ui.expedientes.filter((x) => x.trabajo.id !== r.expediente.trabajo.id)];
  ui.elegido = r.expediente.trabajo.id; ui.mensaje = "Expediente reanudado: se comprobaron la ficha, el historial y cada documento.";
  guardar(); alCambiarContador?.(esperanPersona()); redibujar();
}

/** Panel del intercambio manual: lo que la persona tiene que hacer ahora, en tres pasos. */
function panelManual(x, redibujar) {
  const enc = encargoEnEspera(x);
  const rol = enc.rol;
  if (!ui.solicitud || ui.solicitud.encargo_id !== enc.id) {
    ui.solicitud = { encargo_id: enc.id, texto: null };
    solicitudManual(x).then((s) => { if (ui.solicitud?.encargo_id === enc.id) { ui.solicitud = { encargo_id: enc.id, ...s }; redibujar(); } });
  }
  const sol = ui.solicitud;
  const imp = ui.importacion?.encargo_id === enc.id ? ui.importacion : null;
  const n = ["investigador", "analista", "critico"].indexOf(rol) + 1;
  return el("section", { clase: "lab-manual", "aria-labelledby": "lab-manual-titulo", "data-espera": rol },
    el("h3", { id: "lab-manual-titulo" }, `Te toca: respuesta del ${ETIQUETA_ROL[rol]} (rol ${n} de 3)`),
    el("p", { clase: "lab-nota" }, `El trabajo está en «Pendiente de modelo». Nada avanza solo: el sistema espera a que traigas la respuesta. Encargo ${enc.id}.`),
    el("ol", { clase: "lab-pasos" },
      el("li", {}, el("strong", {}, "Copia la solicitud "), "y pégala en una conversación NUEVA de Claude (sin archivos del proyecto ni otras conversaciones).", " ",
        el("button", { type: "button", clase: "boton boton-chico", "data-accion": "copiar-solicitud", disabled: !sol?.texto, onclick: () => copiar(sol.texto, redibujar) }, "Copiar solicitud"), " ",
        sol?.texto ? descarga(sol.nombre_archivo, () => sol.texto, "Descargar (.txt)") : null,
        ui.copiado === enc.id ? el("span", { clase: "lab-ok", role: "status" }, " ✓ Copiada") : null,
        sol?.texto ? el("details", {}, el("summary", {}, `Ver la solicitud (${sol.texto.length} caracteres)`), el("textarea", { id: "lab-solicitud", rows: "8", readonly: "", clase: "lab-texto" }, sol.texto)) : el("span", { clase: "lab-nota" }, " Preparando…")),
      el("li", {}, el("strong", {}, "Copia la respuesta completa de Claude "), "(el bloque JSON) y pégala aquí, o importa un archivo."),
      el("li", {}, el("strong", {}, "Verifica y continúa: "), "el sistema comprueba formato, encargo y huella; lab-V comprueba cada cita.")),
    el("div", { clase: "lab-form" },
      el("label", {}, "Quién trae la respuesta ", el("input", { id: "lab-quien", type: "text", value: "diego", maxlength: "80", autocomplete: "off" })),
      el("label", {}, "Modelo (declarado) ", el("input", { id: "lab-modelo", type: "text", maxlength: "120", placeholder: "p. ej. el que muestre la app de Claude", autocomplete: "off" })),
      el("label", {}, "Proveedor ", el("input", { id: "lab-proveedor", type: "text", maxlength: "120", placeholder: "p. ej. Anthropic (app de Claude)", autocomplete: "off" })),
      el("label", { clase: "lab-ancho" }, `Respuesta (máx. ${LIMITE_RESPUESTA.toLocaleString("es-MX")} caracteres; se trata como texto no confiable) `, el("textarea", { id: "lab-pegar", rows: "6", clase: "lab-texto", spellcheck: "false" }))),
    el("div", { clase: "lab-botones" },
      el("button", { type: "button", clase: "boton", "data-accion": "importar-respuesta", disabled: !!ui.corriendo, onclick: () => importar(x, document.getElementById("lab-pegar")?.value ?? "", "pegado", redibujar) }, "Verificar y continuar"),
      el("label", { clase: "boton boton-chico lab-archivo" }, "Importar archivo…", el("input", { id: "lab-archivo", type: "file", accept: ".json,.txt,.md,text/plain,application/json", onchange: async (ev) => { const f = ev.target.files?.[0]; if (f) importar(x, await f.text(), "archivo", redibujar); } }))),
    imp ? el("div", { clase: imp.ok ? "lab-nota" : "nexus-errores", role: imp.ok ? "status" : "alert", "data-importacion": imp.ok ? "aceptada" : "rechazada" },
      el("strong", {}, imp.ok ? "Respuesta aceptada." : "La respuesta NO se aceptó (el trabajo no cambió):"),
      imp.errores.length ? el("ul", {}, ...imp.errores.slice(0, 8).map((t) => el("li", {}, t))) : null,
      imp.avisos.length ? el("ul", { clase: "lab-avisos" }, ...imp.avisos.slice(0, 6).map((t) => el("li", {}, `⚠ ${t}`))) : null) : null);
}

async function copiar(texto, redibujar) {
  let ok = false;
  try { await navigator.clipboard.writeText(texto); ok = true; } catch { /* sin permiso de portapapeles: selección manual */ }
  if (!ok) { const t = document.getElementById("lab-solicitud"); if (t) { t.closest("details")?.setAttribute("open", ""); t.focus(); t.select(); try { ok = document.execCommand("copy"); } catch { ok = false; } } }
  ui.copiado = ok ? ui.solicitud?.encargo_id : null;
  ui.mensaje = ok ? null : "El navegador no dejó copiar: la solicitud quedó seleccionada; usa Ctrl+C.";
  redibujar();
}

async function importar(x, texto, metodo, redibujar) {
  const enc = encargoEnEspera(x);
  if (!enc || ui.corriendo) return;
  const quien = document.getElementById("lab-quien")?.value, modelo = document.getElementById("lab-modelo")?.value, proveedor = document.getElementById("lab-proveedor")?.value;
  ui.corriendo = x.trabajo.id; ui.activa = "verificador"; redibujar();
  try {
    const ahora = new Date(Math.max(Date.now(), Date.parse(x.trabajo.historial.at(-1).en) + 1000)).toISOString().replace(/\.\d{3}Z$/, "Z");
    const r = await continuarConRespuesta(x, texto, { declarado_por: quien, modelo, proveedor, metodo, ahora, reloj: relojDesde(ahora), ya_importadas: huellasImportadas(ui.expedientes) });
    ui.importacion = { encargo_id: enc.id, ok: r.ok, errores: r.errores, avisos: r.avisos };
    if (r.ok) ui.mensaje = x.trabajo.espera ? `Respuesta del ${ETIQUETA_ROL[enc.rol]} verificada (lab-V: ${String(r.verificacion?.resultado ?? "—").replace(/_/g, " ")}). Siguiente: ${ETIQUETA_ROL[x.trabajo.espera.rol]}.`
      : `Respuesta del ${ETIQUETA_ROL[enc.rol]} verificada. Estado: ${ETIQUETA_ESTADO[x.trabajo.estado]}.`;
    if (r.ok) ui.solicitud = null;
  } catch (err) { ui.importacion = { encargo_id: enc.id, ok: false, errores: [`El Coordinador se detuvo: ${err.message}`], avisos: [] }; }
  ui.corriendo = null; ui.activa = null;
  guardar(); alCambiarContador?.(esperanPersona());
  redibujar();
}

async function correrDemo(motor, cargarJSON, redibujar) {
  const r = await cargarJSON(`datos/demo/${motor}.json`);
  if (r.tipo !== "ok") { ui.mensaje = `No se pudo leer datos/demo/${motor}.json: ${r.mensaje}`; redibujar(); return; }
  const ahora = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const ficha = await fichaDesdeEstado(r.datos, { leido_en: ahora });
  if (!ficha.ok) { ui.mensaje = ficha.errores.join(" "); redibujar(); return; }
  const n = ++ui.n;
  const t = nuevoTrabajo({ id: `demo-lab-trb-${motor}-sesion-${n}`, es_demo: true, titulo: `${ficha.origen.nombre} · trabajo de esta sesión (${n})`, pregunta: PREGUNTA_DEMO, origen: ficha.origen, solicitado_por: { tipo: "humano", identificador: "diego" }, creado_en: ahora, adaptador: { id: "sin-modelo", modelo: null } });
  const x = nuevoExpediente(t, ficha);
  ui.expedientes.unshift(x); ui.elegido = t.id; ui.mensaje = null;
  await ejecutarVisible(x, ADAPTADOR_SIN_MODELO, redibujar);
}

/** Corre el Coordinador con una pausa breve entre roles para que se vea qué estación trabaja (no simula: espera). */
async function ejecutarVisible(x, adaptador, redibujar) {
  const reloj = relojDesde(new Date(Math.max(Date.now(), Date.parse(x.trabajo.historial.at(-1).en))).toISOString().replace(/\.\d{3}Z$/, "Z"));
  ui.corriendo = x.trabajo.id; ui.senal = { aborted: false };
  const pausa = () => new Promise((r) => setTimeout(r, matchMedia?.("(prefers-reduced-motion: reduce)").matches ? 0 : 450));
  const adaptadorVisible = { ...adaptador, async ejecutar(p) { ui.activa = p.encargo.rol; redibujar(); await pausa(); return adaptador.ejecutar(p); } };
  try {
    const nuevo = await avanzar(x, { adaptador: adaptadorVisible, reloj, senal: ui.senal, alPaso: (rol, fase) => { if (fase === "fin") { ui.activa = "verificador"; redibujar(); } } });
    Object.assign(x, nuevo);
  } catch (err) { ui.mensaje = `El Coordinador se detuvo: ${err.message}`; }
  ui.activa = null; ui.corriendo = null; ui.senal = null;
  alCambiarContador?.(esperanPersona());
  redibujar();
}

async function prepararReal({ motor, documento }, redibujar) {
  const ahora = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const ficha = await fichaDesdeEstado(documento, { leido_en: ahora });
  if (!ficha.ok) { ui.mensaje = `La lectura REAL de ${motor} no se puede usar: ${ficha.errores.slice(0, 2).join(" ")}`; redibujar(); return; }
  const id = `lab-trb-${motor}-${ahora.replace(/[-:]/g, "").toLowerCase()}`;
  const t = nuevoTrabajo({ id, es_demo: false, titulo: `${ficha.origen.nombre} · lectura REAL`, pregunta: "¿Qué problemas muestra la última lectura del motor, qué explicaciones caben y qué información falta para decidir?", origen: ficha.origen, solicitado_por: { tipo: "humano", identificador: "diego" }, creado_en: ahora, adaptador: { id: "manual-claude", modelo: null } });
  const x = nuevoExpediente(t, ficha);
  await avanzar(x, { adaptador: crearAdaptadorManual(new Map()), reloj: relojDesde(ahora) });
  ui.expedientes.unshift(x); ui.elegido = t.id;
  ui.mensaje = "Trabajo REAL preparado. Espera la respuesta del Investigador: descarga su encargo, llévalo a tu sesión de IA y pega aquí la respuesta (pestaña Auditoría). Nada se envía solo.";
  alCambiarContador?.(esperanPersona());
  redibujar();
}

function listaTrabajos(redibujar) {
  const grupo = (titulo, lista) => el("div", { clase: "lab-grupo" }, el("h3", {}, `${titulo} (${lista.length})`),
    lista.length ? el("ul", { clase: "lab-trabajos" }, ...lista.map((x) => el("li", {},
      el("button", { type: "button", clase: `lab-trabajo${x.trabajo.id === ui.elegido ? " nexus-activo" : ""}`, "aria-pressed": String(x.trabajo.id === ui.elegido), "data-trabajo": x.trabajo.id,
        onclick: () => { ui.elegido = x.trabajo.id; ui.propuesta = null; redibujar(); } },
        (() => { const f = faseDe(x, { corriendo: ui.corriendo === x.trabajo.id }); return el("span", { clase: `lab-chip ${f.clase}`, "data-estado": x.trabajo.estado, "data-fase": f.fase }, f.etiqueta); })(), " ",
        (() => { const n = naturalezaDe(x); return el("span", { clase: `lab-chip lab-nat ${n.clase}`, "data-naturaleza": n.tipo }, n.corta); })(), " ",
        el("span", { clase: "lab-trabajo-titulo" }, x.trabajo.titulo), " ",
        el("small", {}, `${x.trabajo.es_demo ? "datos DEMO" : "datos REALES"} · ${x.trabajo.origen.nombre}`)))))
      : el("p", { clase: "tablero-suave" }, "Ninguno."));
  const activos = ui.expedientes.filter((x) => !ESTADOS_FINALES.includes(x.trabajo.estado));
  const terminados = ui.expedientes.filter((x) => ESTADOS_FINALES.includes(x.trabajo.estado));
  return el("div", { clase: "lab-columnas" }, grupo("Trabajos activos o que esperan a una persona", activos), grupo("Terminados (decididos por una persona)", terminados));
}

function detalle(x, redibujar) {
  const t = x.trabajo, inf = x.informe;
  const partes = [
    el("h3", { id: "lab-detalle-titulo" }, t.titulo),
    el("p", { clase: "lab-meta" }, el("span", { clase: `lab-chip ${ESTADO_CLASE[t.estado]}`, "data-estado-detalle": t.estado }, ETIQUETA_ESTADO[t.estado]),
      ` · ${t.id} · origen ${t.origen.nombre} (lectura ${fecha(t.origen.generado_en)}, huella ${t.origen.sha256_documento.slice(0, 12)}…, solo lectura) · pidió ${t.solicitado_por.identificador}`),
    el("p", { clase: "lab-pregunta" }, el("strong", {}, "Pregunta: "), t.pregunta),
  ];
  if (t.espera) partes.push(el("p", { clase: "lab-mensaje" }, `En espera: ${t.espera.motivo}`));
  const roles = rolesDe(x).filter((r) => r.autoria);
  if (roles.length) partes.push(el("p", { clase: "lab-nota", "data-autorias": "" }, "Quién produjo cada rol: ", ...roles.map((r, i) => el("span", { "data-autoria-rol": r.rol }, `${i ? " · " : ""}${ETIQUETA_ROL[r.rol]}: ${ETIQUETA_AUTORIA[r.autoria] ?? r.autoria}${r.modelo ? ` («${r.modelo}»)` : ""}`))));
  const ult = t.historial.at(-1);
  partes.push(el("p", { clase: "lab-nota" }, `Último cambio: ${ETIQUETA_ESTADO[ult.a]} por ${ult.por.tipo === "humano" ? "una persona" : "el Coordinador"} (${ult.por.identificador}) — ${ult.motivo}`));
  partes.push(revision(x, redibujar));
  partes.push(el("div", { clase: "nexus-pestanas lab-pestanas", role: "tablist" }, ...PESTANAS.map(([k, txt]) => el("button", { type: "button", role: "tab", clase: `boton boton-chico${ui.pestana === k ? " nexus-activo" : ""}`, "aria-selected": String(ui.pestana === k), "data-pestana-lab": k, onclick: () => { ui.pestana = k; redibujar(); } }, txt))));
  const cuerpo = !inf && ui.pestana !== "auditoria" ? el("p", { clase: "sala-vacio" }, "Este trabajo aún no tiene informe: el Coordinador no terminó la ronda (ver Auditoría).")
    : { hallazgos, hipotesis: hipotesisP, objeciones: objecionesP, faltante, recomendaciones: recomendacionesP, verificacion: verificacionP, auditoria }[ui.pestana](x, redibujar);
  partes.push(el("div", { clase: "lab-cuerpo", "data-cuerpo": ui.pestana }, cuerpo));
  return el("section", { clase: "lab-detalle", "aria-labelledby": "lab-detalle-titulo" }, ...partes);
}

function hallazgos(x) {
  return el("ul", { clase: "lab-lista" }, ...x.informe.hallazgos.map((h) => el("li", { clase: `lab-hallazgo incert-${INCERT[h.incertidumbre]}`, "data-hallazgo": h.id },
    el("div", {}, el("strong", {}, `${ETIQUETA_ROL[h.rol]} · ${h.clase.replace("_", " ")}`), ` · incertidumbre ${h.incertidumbre} · ${h.respaldo.replace(/_/g, " ")}`),
    el("p", {}, h.texto),
    ...h.citas.map((c) => el("blockquote", { clase: c.utilizable ? "lab-cita lab-cita-ok" : "lab-cita lab-cita-mal", "data-cita": c.utilizable ? "verificada" : "no-verificada" },
      el("small", {}, `${c.utilizable ? "✓ Cita comprobada por lab-V" : "✗ lab-V NO pudo comprobar esta cita"} · ${c.fuente_id}${c.alertas.length ? ` · ${c.alertas.join(", ")}` : ""}`), el("div", {}, `«${c.extracto}»`))),
    h.objeciones.length ? el("small", { clase: "lab-nota" }, `Objeciones: ${h.objeciones.join(", ")}`) : null,
    el("small", { clase: "lab-nota" }, "Que la cita exista no prueba que apoye la afirmación: eso lo revisa una persona."))));
}
const hipotesisP = (x) => x.informe.hipotesis.length ? el("ul", { clase: "lab-lista" }, ...x.informe.hipotesis.map((h) => el("li", {}, el("strong", {}, h.id), h.alternativa_a ? ` (alternativa a ${h.alternativa_a})` : "", el("p", {}, h.enunciado), el("small", {}, `Se refuta si: ${h.se_refuta_si}`), el("br"), el("small", {}, `Experimento: ${h.experimento}`), h.objeciones.length ? el("small", { clase: "lab-nota" }, ` · objeciones: ${h.objeciones.join(", ")}`) : null)))
  : el("p", { clase: "tablero-suave" }, "Sin hipótesis: el Analista no encontró procesos en error que explicar.");
const objecionesP = (x) => x.informe.objeciones.length ? el("ul", { clase: "lab-lista" }, ...x.informe.objeciones.map((o) => el("li", { "data-objecion": o.tipo }, el("strong", {}, `${o.id} · ${o.tipo}`), ` sobre ${o.objeta}`, el("p", {}, o.texto))))
  : el("p", { clase: "tablero-suave" }, "Sin objeciones.");
const faltante = (x) => el("div", {}, el("h4", {}, "Información que falta"), el("ul", { clase: "lab-lista" }, ...x.informe.informacion_faltante.map((f) => el("li", {}, `${ETIQUETA_ROL[f.rol]}: ${f.texto}`))),
  el("h4", {}, "Limitaciones"), el("ul", { clase: "lab-lista" }, ...x.informe.limitaciones.map((l) => el("li", {}, l))));
const recomendacionesP = (x) => el("div", {}, x.informe.recomendaciones.length ? el("ul", { clase: "lab-lista" }, ...x.informe.recomendaciones.map((r) => el("li", { "data-recomendacion": r.tipo }, el("strong", {}, `[${r.tipo.replace("_", " ")}] `), r.texto, el("br"), el("small", { clase: "lab-nota" }, "Propuesta: requiere decisión humana · no se ejecuta sola."))))
  : el("p", { clase: "tablero-suave" }, "Sin recomendaciones."), x.informe.recomendaciones_excluidas.length ? el("p", { clase: "lab-nota" }, `${x.informe.recomendaciones_excluidas.length} recomendación(es) excluida(s) por parecer operaciones con dinero.`) : null);
const verificacionP = (x) => el("ul", { clase: "lab-lista" }, ...x.informe.verificaciones.map((v) => el("li", { "data-verificacion": v.resultado }, el("strong", {}, ETIQUETA_ROL[v.rol]), `: ${v.resultado.replace(/_/g, " ")}${v.incompleta ? " (incompleta)" : ""} · ${v.n_citas_utilizables}/${v.n_citas} citas comprobadas · ${v.n_alertas} alerta(s)`)),
  ...x.informe.alertas.slice(0, 20).map((a) => el("li", { clase: "lab-alerta" }, `⚠ ${ETIQUETA_ROL[a.rol]} · ${a.codigo}: ${a.detalle}`)));

function auditoria(x, redibujar) {
  const t = x.trabajo;
  const v = validarTrabajo(t);
  const partes = [
    el("p", { clase: v.ok ? "lab-nota" : "nexus-errores" }, v.ok ? `El trabajo cumple cauce.lab.trabajo ${t.version_contrato} y su historial se reproduce sin saltos (${t.historial.length} cambio(s)).` : `El trabajo NO cumple su contrato: ${v.errores.join(" ")}`),
    el("ol", { clase: "lab-historial" }, ...t.historial.map((h) => el("li", {}, `${fecha(h.en)} · ${h.de ? ETIQUETA_ESTADO[h.de] : "—"} → ${ETIQUETA_ESTADO[h.a]} · ${h.por.tipo === "humano" ? "persona" : "código"} ${h.por.identificador}: ${h.motivo}`))),
    el("p", { clase: "lab-nota" }, `${x.documentos.length} documento(s) en este expediente: ${["trabajo", "encargo", "ejecucion", "verificacion", "informe"].map((k) => `${x.documentos.filter((d) => d.tipo === k).length} ${k}`).join(" · ")}.`),
    el("div", { clase: "lab-botones" },
      descarga(`${t.id}.json`, () => `${JSON.stringify(t, null, 2)}\n`, "Descargar trabajo (JSON)"),
      x.informe ? descarga(`${x.informe.id}.md`, () => informeMarkdown(x.informe, t), "Descargar informe (Markdown)") : null,
      descargaRegistro(x)),
  ];
  partes.push(el("div", { clase: "lab-botones" }, descarga(`${t.id}-expediente.json`, () => `${JSON.stringify(exportarExpediente(x, { exportado_en: ahoraISO() }), null, 1)}\n`, "Exportar expediente completo (para reanudar o archivar)")));
  if (L(x.importaciones).length) partes.push(el("h4", {}, "Importaciones de respuestas manuales"), el("ol", { clase: "lab-historial" }, ...x.importaciones.map((i) => el("li", { "data-import": i.aceptada ? "aceptada" : "rechazada" }, `${fecha(i.en)} · ${ETIQUETA_ROL[i.rol]} · ${i.aceptada ? "aceptada" : "rechazada"} · trajo ${i.declarado_por || "?"} (declarado)${i.respuesta_sha256 ? ` · huella ${i.respuesta_sha256.slice(0, 12)}…` : ""}${i.errores.length ? ` · ${i.errores[0]}` : ""}`))));
  return el("div", {}, ...partes);
}

function revision(x, redibujar) {
  const t = x.trabajo;
  const posibles = Object.entries(TRANSICIONES[t.estado] ?? {}).filter(([, quien]) => quien.includes("humano")).map(([a]) => a);
  if (ESTADOS_FINALES.includes(t.estado)) {
    const d = t.decision_humana;
    const ed = estadoDecision(t);
    return el("div", { clase: "lab-revision", "data-decision-final": ed.decision }, el("p", {}, el("strong", {}, `Decisión: ${ed.decision} por ${d.por.identificador}`), ` el ${fecha(d.en)}: ${d.motivo}`),
      el("p", { clase: "lab-aviso-identidad", role: "note", "data-identidad": ed.identidad }, `⚠ ${ed.advertencia}`),
      t.estado === "aprobado_por_humano" && x.informe ? propuestaNexus(x, redibujar) : null);
  }
  if (!posibles.length) return el("p", { clase: "lab-nota" }, "Ahora mismo este trabajo no necesita a una persona.");
  const ETQ = { aprobado_por_humano: "Aprobar informe", rechazado: "Rechazar", requiere_evidencia: "Pedir más evidencia", requiere_revision: "Revisar igualmente", pendiente: t.estado === "error" ? "Reintentar" : "Volver a analizar con evidencia nueva" };
  const accion = async (a) => {
    const por = document.getElementById("lab-por")?.value?.trim(), motivo = document.getElementById("lab-motivo")?.value?.trim();
    try {
      const en = new Date(Math.max(Date.now(), Date.parse(t.historial.at(-1).en) + 1000)).toISOString().replace(/\.\d{3}Z$/, "Z");
      if (t.estado === "error" && a === "pendiente") reintentar(x, { por: { tipo: "humano", identificador: por || "?" }, motivo: motivo || "", en });
      else decidir(x, a, { por: { tipo: "humano", identificador: por || "" }, motivo: motivo || "", en });
      ui.mensaje = `Decisión registrada en esta pestaña: ${ETIQUETA_ESTADO[x.trabajo.estado]}. Para el registro auditable, usa «herramientas/laboratorio.mjs revisar».`;
      // Volver a analizar con el MISMO adaptador del trabajo: un trabajo manual vuelve a esperar la respuesta del
      // modelo (fase 2 corría el guion aquí, lo que fallaba con «pide el adaptador manual-claude»).
      if (x.trabajo.estado === "pendiente") {
        const ad = x.trabajo.adaptador.id === "manual-claude" ? crearAdaptadorManual(new Map()) : x.trabajo.id === "demo-lab-trb-prueba-lab-v" ? crearAdaptadorManipulado() : ADAPTADOR_SIN_MODELO;
        await ejecutarVisible(x, ad, redibujar);
        if (x.trabajo.espera) ui.mensaje = `El trabajo vuelve a esperar la respuesta del ${ETIQUETA_ROL[x.trabajo.espera.rol]}: copia su nueva solicitud.`;
      }
      if (x.trabajo.adaptador.id === "manual-claude") guardar();
    } catch (err) { ui.mensaje = `No se registró: ${err.message.replace(/^Trabajo [^:]+: /, "")}`; }
    alCambiarContador?.(esperanPersona());
    redibujar();
  };
  return el("div", { clase: "lab-revision", "data-revision": t.estado },
    el("h4", {}, "Revisión humana"),
    el("p", { clase: "lab-nota" }, t.estado === "requiere_evidencia" ? "lab-V no pudo comprobar parte de la evidencia. No se puede aprobar así: pide más evidencia, rechaza o, si decides revisarlo igualmente, déjalo dicho." : t.estado === "error" ? `El análisis falló. Reintentos usados: ${t.intentos.usados} de ${t.intentos.maximo}.` : "Lee hallazgos, citas y objeciones. Tu decisión queda en el historial con tu nombre y tu motivo."),
    el("p", { clase: "lab-aviso-identidad", role: "note", "data-identidad": "declarada" }, `⚠ ${ADVERTENCIA_DECLARADA} ${proveedorIdentidad().motivo}`),
    el("div", { clase: "lab-form" },
      el("label", {}, "Quién decide ", el("input", { id: "lab-por", type: "text", value: "diego", maxlength: "80", autocomplete: "off" })),
      el("label", {}, "Motivo (obligatorio, mín. 10 caracteres) ", el("textarea", { id: "lab-motivo", rows: "2", maxlength: "2000", clase: "lab-texto" }))),
    el("div", { clase: "lab-botones" }, ...posibles.map((a) => el("button", { type: "button", clase: `boton boton-chico${a === "aprobado_por_humano" ? " lab-aprobar" : ""}`, "data-decision": a, disabled: !!ui.corriendo, onclick: () => accion(a) }, ETQ[a] ?? a))));
}

function propuestaNexus(x, redibujar) {
  const candidatos = x.informe.hallazgos.filter((h) => h.citas.some((c) => c.utilizable));
  const sel = el("select", { id: "lab-hallazgo-nexus" }, ...candidatos.map((h) => el("option", { value: h.id }, `${h.id} · ${h.texto.slice(0, 70)}`)));
  const p = ui.propuesta;
  return el("div", { clase: "lab-nexus" }, el("h4", {}, "Propuesta para Nexus (opcional)"),
    el("p", { clase: "lab-nota" }, "Solo se PREPARA: no se escribe en el almacén de Nexus. Llega como «propuesta», confianza baja, y Nexus la juzga con sus reglas."),
    candidatos.length ? el("div", { clase: "lab-botones" }, sel, el("button", { type: "button", clase: "boton boton-chico", "data-accion": "propuesta", onclick: () => {
      ui.propuesta = prepararPropuestaNexus(x.trabajo, x.informe, { hallazgo_id: document.getElementById("lab-hallazgo-nexus").value, fecha: new Date().toISOString().replace(/\.\d{3}Z$/, "Z") });
      redibujar();
    } }, "Preparar propuesta")) : el("p", { clase: "tablero-suave" }, "Ningún hallazgo tiene cita comprobada: no hay nada que proponer."),
    p ? (p.ok ? el("p", { "data-dictamen": p.propuesta.revision_esceptica.dictamen }, `Dictamen previo de Nexus (${p.propuesta.revision_esceptica.version_reglas}): ${p.propuesta.revision_esceptica.dictamen.replace("_", " ")}${p.propuesta.revision_esceptica.no_cumple.length ? ` · no cumple ${p.propuesta.revision_esceptica.no_cumple.join(", ")}` : ""}. `, descarga(`${p.propuesta.id}.json`, () => `${JSON.stringify(p.propuesta, null, 2)}\n`, "Descargar propuesta"))
      : el("p", { clase: "nexus-errores" }, p.errores.join(" "))) : null);
}

function descarga(nombre, contenido, texto) {
  return el("button", { type: "button", clase: "boton boton-chico", "data-descarga": nombre, onclick: () => {
    const url = URL.createObjectURL(new Blob([contenido()], { type: nombre.endsWith(".md") ? "text/markdown" : "application/json" }));
    const a = el("a", { href: url, download: nombre }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  } }, texto);
}
function descargaRegistro(x) {
  return el("button", { type: "button", clase: "boton boton-chico", "data-descarga": "registro", onclick: async () => {
    const r = await entradasDeDocumentos(x.documentos, { registro_es_demo: x.trabajo.es_demo });
    const texto = r.entradas.map(serializar).join("");
    const url = URL.createObjectURL(new Blob([texto], { type: "application/x-ndjson" }));
    const a = el("a", { href: url, download: `${x.trabajo.es_demo ? "demo-" : ""}registro-${x.trabajo.id}.jsonl` }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  } }, "Descargar registro encadenado (JSONL)");
}

function adaptadoresPanel() {
  const encDemo = { es_demo: true, rol: "investigador", id: "demo" }, encReal = { es_demo: false, rol: "investigador", id: "real" };
  const filas = describirAdaptadores(encDemo, encReal);
  return el("details", { clase: "lab-adaptadores" }, el("summary", {}, "Modelos disponibles (verificado en este equipo)"),
    el("ul", { clase: "lab-lista" },
      ...filas.map((f) => el("li", { "data-adaptador": f.id }, el("strong", {}, f.nombre), ` · ${f.es_ia ? "IA" : "no es IA"} · costo ${f.costo_mxn} MXN · ${f.usa_red ? "usa red" : "sin red"} · DEMO: ${f.demo.ok ? "sí" : "no"} · REAL: ${f.real.ok ? "sí" : `no (${f.real.motivo})`}`)),
      ...describirProveedores().map((f) => el("li", { "data-proveedor": f.id }, el("strong", {}, f.nombre), ` · ${f.disponible ? "disponible" : `no disponible: ${f.motivo}`}`)),
      el("li", { "data-adaptador": "api" }, el("strong", {}, "API de pago (Claude, OpenAI…)"), " · no se usa: presupuesto $0 y sin credenciales. Una suscripción de chat (Claude o ChatGPT) no incluye créditos de API.")));
}
