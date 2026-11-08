// Arranque del centro de operaciones: elige proyecto (piso), carga sus datos cada cierto
// tiempo y se los pasa a la vista (3D o plano 2D; las dos usan el mismo modelo de vista).
// La vista 3D y three.js solo se descargan si se usan; "Bajo consumo" fuerza el plano 2D.

import { normalizarCargaEstaciones } from "./nucleo/estaciones-compago.js";
import { inicioDeSerie } from "./vistas/vista3d/medicion-serie.js";
import { cargarJSON, cargarEstado, cargarRegistro } from "./cargador.js";
import { construirModeloVista, elegirCarga, resumenDe } from "./nucleo/modelo.js";
import { crearVista2D } from "./vistas/vista2d.js";
import { dibujarPanel } from "./vistas/panel.js";
import { el, fecha } from "./vistas/dom.js";
import { dibujarTablero } from "./vistas/tablero.js";
import { crearRegistroCambios } from "./nucleo/cambios.js";
import { crearSeguidorNaturalezas, validarNaturalezas } from "./nucleo/naturaleza.js";
import { ESTADO_PISO, crearBitacora, resumirEmpresa, resumirProyecto } from "./nucleo/sala.js";
import { dibujarSala } from "./vistas/sala.js";
import { agruparPisos } from "./nucleo/pisos.js";
import { leerConfiguracion } from "./configuracion.js";
import { leerNexus, resumirNexus, admisionReal, contextoGerente } from "./nexus/registro.js";
import { verificarContinuidad, anclaDe } from "./nexus/integridad.js";
import { evaluarLeccion } from "./nexus/gerente.js";
import { dibujarNexus } from "./vistas/nexus.js";
import { dibujarCSI, olvidarCalculosCSI } from "./vistas/csi.js";
import { leerCSI } from "./csi/registro.js";
import { leerDisposicionEstaciones, construirEstaciones, cruzarEnlace, aplicarEstaciones } from "./nucleo/estaciones.js";

const INTERVALO_MS = 30_000;
const $ = (s) => document.querySelector(s);
const registroCambios = crearRegistroCambios({ maximo: 30 });
// Qué es cada puesto (escena/<id>-naturaleza.json). Sin ese archivo, el proyecto se ve como antes.
const seguidor = crearSeguidorNaturalezas();
const clasificaciones = new Map(); // proyecto → resultado de validarNaturalezas o null
let temporizadorBreve = null;

// Estado resumido de cada piso para el selector (REAL, DEMO, sin conexión...). Se lee de sus archivos, nada más.
const resumenPisos = new Map();
const RESUMEN = ESTADO_PISO;
// Sala de control (fase K): último modelo de vista de cada piso y cambios observados en esta sesión (todos los pisos).
const modelosPisos = new Map();
const bitacora = crearBitacora({ maximo: 80 });

const estado = {
  proyectos: [],
  actual: null,
  modelo: null,
  seleccion: null,
  temporizador: null,
};

function guardarPreferencia(clave, valor) {
  try { localStorage.setItem(clave, valor); } catch { /* sin almacenamiento: no pasa nada */ }
}
function leerPreferencia(clave) {
  try { return localStorage.getItem(clave); } catch { return null; }
}

let vista = null;
let tipoVista = null;
const opcionesVista = {
  alSeleccionar(sel) {
    estado.seleccion = sel;
    dibujar();
  },
  /** Lo que tapa la vista desde fuera (el panel de detalle en celular): la cámara lo evita. */
  tapan: () => [$("#panel"), ...(enInmersivo() ? [$("#conexion"), $("#salir-inmersivo"), $("#diagnostico")] : [])],
  /** Desde la vista 3D (menú del celular): abrir la sala de control. */
  alSala: () => ponerSala(true),
  /** Nexus fase 1: oficina de supervisión. */
  alNexus: () => ponerNexus(true),
  alFallar(motivo) {
    // La 3D dejó de funcionar: seguimos en el plano 2D sin perder datos, y se puede volver a intentar.
    avisarVista(`${motivo} Se muestra el plano 2D.`, { reintentar: true });
    cambiarVista("2d", { forzada: true });
  },
};

function avisarVista(texto, { reintentar = false } = {}) {
  const a = $("#aviso-vista");
  a.hidden = !texto;
  a.replaceChildren(texto ?? "");
  // Tras una falla de la tarjeta gráfica (driver reiniciado, poca memoria) la 3D suele volver a funcionar.
  if (texto && reintentar) a.append(" ", el("button", { type: "button", clase: "enlace reintentar-3d", onclick: () => { avisarVista(null); cambiarVista("3d", { forzada: true }); } }, "Reintentar 3D"));
}

function vistaDeseada() {
  if ($("#bajo-consumo").checked) return "2d";
  if (new URLSearchParams(location.search).has("auto")) return "3d"; // la medición automática siempre es en 3D
  return leerPreferencia("cauce.vista") === "2d" ? "2d" : "3d";
}

/**
 * Modo inmersivo (solo 3D): el edificio ocupa toda la ventana. Quedan siempre a la vista la insignia
 * REAL/DEMO, la conexión, la edad del dato, las alertas y cualquier error. No usa la pantalla completa
 * del navegador. Se sale con el botón «Salir», con Esc o al pasar al plano.
 */
function ponerInmersivo(activo) {
  activo = activo && tipoVista === "3d";
  if (activo && salaAbierta()) ponerSala(false);
  if (activo && nexusAbierto()) ponerNexus(false);
  if (activo && csiAbierto()) ponerCSI(false);
  document.documentElement.classList.toggle("inmersivo", activo);
  $("#salir-inmersivo").hidden = !activo;
  $(".boton-inmersivo").setAttribute("aria-pressed", activo ? "true" : "false");
  if (!activo && document.activeElement === $("#salir-inmersivo")) $(".boton-inmersivo").focus();
  if (activo) $("#salir-inmersivo").focus({ preventScroll: true });
}
const enInmersivo = () => document.documentElement.classList.contains("inmersivo");

async function cambiarVista(tipo, { forzada = false } = {}) {
  if (tipo === tipoVista && !forzada) return;
  if (tipo !== "3d") ponerInmersivo(false);
  vista?.destruir();
  vista = null;
  tipoVista = tipo;
  $("#oficina").classList.toggle("modo-3d", tipo === "3d");
  $(".boton-inmersivo").hidden = tipo !== "3d";
  for (const b of document.querySelectorAll("[data-vista]")) b.setAttribute("aria-pressed", b.dataset.vista === tipo ? "true" : "false");
  if (tipo === "3d") {
    try {
      const { crearVista3D } = await import("./vistas/vista3d/escena3d.js");
      if (tipoVista !== "3d") return; // el usuario cambió mientras cargaba
      vista = crearVista3D($("#oficina"), opcionesVista);
      if (salaAbierta() || nexusAbierto() || csiAbierto()) vista.pausar?.(true);
      avisarVista(null);
    } catch (e) {
      console.error(e);
      avisarVista("Este navegador no pudo abrir la oficina 3D (WebGL no disponible). Se muestra el plano 2D.", { reintentar: true });
      tipoVista = "2d";
      ponerInmersivo(false);
      $(".boton-inmersivo").hidden = true;
      $("#oficina").classList.remove("modo-3d");
      for (const b of document.querySelectorAll("[data-vista]")) b.setAttribute("aria-pressed", b.dataset.vista === "2d" ? "true" : "false");
      vista = crearVista2D($("#oficina"), opcionesVista);
    }
  } else {
    vista = crearVista2D($("#oficina"), opcionesVista);
  }
  dibujar();
}

async function iniciar() {
  // Fase L: modo incrustado (también lo activa index.html antes de pintar; aquí por si se carga app.js en otra página).
  document.documentElement.classList.toggle("incrustado", leerConfiguracion(location.href).incrustado);
  aplicarBajoConsumo(leerPreferencia("cauce.bajo-consumo") === "1");
  // Fase L: la lista «+N pendientes» se cierra al tocar fuera o con Escape (no debe quedar tapando los controles).
  const cerrarPendientes = () => { const d = $("#pisos .pisos-mas"); if (d?.open) d.open = false; };
  document.addEventListener("pointerdown", (e) => { if (!e.target.closest?.(".pisos-mas")) cerrarPendientes(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") cerrarPendientes(); });
  $("#bajo-consumo").addEventListener("change", (e) => {
    aplicarBajoConsumo(e.target.checked);
    guardarPreferencia("cauce.bajo-consumo", e.target.checked ? "1" : "0");
    cambiarVista(vistaDeseada());
  });
  for (const b of document.querySelectorAll("[data-vista]")) {
    b.addEventListener("click", () => {
      guardarPreferencia("cauce.vista", b.dataset.vista);
      if (b.dataset.vista === "3d" && $("#bajo-consumo").checked) aplicarBajoConsumo(false);
      if (b.dataset.vista === "2d") avisarVista(null);
      cambiarVista(b.dataset.vista);
    });
  }
  for (const b of document.querySelectorAll("[data-inmersivo]")) b.addEventListener("click", () => ponerInmersivo(!enInmersivo()));
  await cambiarVista(vistaDeseada());
  $("#recargar").addEventListener("click", () => actualizar());
  $("#boton-sala").addEventListener("click", () => ponerSala(!salaAbierta()));
  $("#boton-nexus").addEventListener("click", () => ponerNexus(!nexusAbierto()));
  $("#boton-csi").addEventListener("click", () => ponerCSI(!csiAbierto()));
  // S abre o cierra la sala de control (fuera de campos de texto y sin teclas modificadoras).
  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
    if (e.target instanceof HTMLElement && e.target.closest("input, select, textarea")) return;
    if (e.key === "s" || e.key === "S") { e.preventDefault(); ponerSala(!salaAbierta()); }
    if (e.key === "n" || e.key === "N") { e.preventDefault(); ponerNexus(!nexusAbierto()); }
    if (e.key === "i" || e.key === "I") { e.preventDefault(); ponerCSI(!csiAbierto()); }
  });

  // ?medir=1&auto=30&serie=1: la serie A/B empieza por su primer caso (medicion-serie.js).
  const inicioSerie = inicioDeSerie(location.href);
  if (inicioSerie) { location.replace(inicioSerie); return; }
  const registro = await cargarRegistro();
  estado.proyectos = registro.proyectos;
  if (estado.proyectos.length === 0) {
    $("#oficina").replaceChildren(el("p", { clase: "plano-vacio" }, "No se encontró datos/proyectos.json."));
    return;
  }
  // ?proyecto=<id> (enlaces de medición y de revisión) manda sobre el último piso visitado.
  const pedido = new URLSearchParams(location.search).get("proyecto");
  const guardado = leerPreferencia("cauce.proyecto");
  estado.actual = estado.proyectos.find((p) => p.id === pedido) ?? estado.proyectos.find((p) => p.id === guardado) ?? estado.proyectos[0];
  dibujarPestanas();
  await actualizar();
  const medicionAuto = new URLSearchParams(location.search).has("auto"); // medición automática: sin sala encima
  if (medicionAuto) { /* nada encima del edificio */ }
  else if (new URLSearchParams(location.search).get("sala") === "1" || leerPreferencia("cauce.sala") === "1") ponerSala(true);
  else if (new URLSearchParams(location.search).get("nexus") === "1") ponerNexus(true);
  else if (["1", "historico", "demo", "registro"].includes(new URLSearchParams(location.search).get("csi") ?? "")) ponerCSI(true);
  estado.temporizador = setInterval(() => { if (!document.hidden) actualizar(); }, INTERVALO_MS);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) actualizar(); });
  // En window (no en document): así corre después de la vista 3D, que usa Esc para volver al piso.
  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || e.defaultPrevented) return;
    // Esc primero cierra la sala, luego el detalle; con el detalle cerrado, sale del modo inmersivo.
    if (salaAbierta()) ponerSala(false);
    else if (nexusAbierto()) ponerNexus(false);
    else if (csiAbierto()) ponerCSI(false);
    else if (estado.seleccion) { estado.seleccion = null; dibujar(); }
    else if (enInmersivo()) ponerInmersivo(false);
  });
}

// ---------- Sala de control (fase K) ----------
const salaAbierta = () => !$("#sala-control").hidden;

/** Abre o cierra la sala. Mientras está abierta, la vista 3D se pausa (no gasta tarjeta gráfica). */
function ponerSala(abrir) {
  if (abrir === salaAbierta()) return;
  if (abrir) { ponerInmersivo(false); ponerNexus(false); ponerCSI(false); }
  $("#sala-control").hidden = !abrir;
  document.documentElement.classList.toggle("sala-abierta", abrir);
  $("#boton-sala").setAttribute("aria-pressed", abrir ? "true" : "false");
  guardarPreferencia("cauce.sala", abrir ? "1" : "0");
  vista?.pausar?.(abrir || nexusAbierto() || csiAbierto());
  if (abrir) { dibujarSalaSiAbierta(); $("#sala-titulo")?.focus({ preventScroll: true }); }
  else if (document.activeElement === document.body || $("#sala-control").contains(document.activeElement)) $("#boton-sala").focus({ preventScroll: true });
}

// ---------- Oficina Nexus (fase 1) ----------
// Solo lee datos/nexus/: primero el registro real (local, fuera de git); si no existe, el de prueba.
const nexusAbierto = () => !$("#nexus").hidden;
let nexusDocs = null;

function ponerNexus(abrir) {
  if (abrir === nexusAbierto()) return;
  if (abrir) { ponerInmersivo(false); ponerSala(false); ponerCSI(false); }
  $("#nexus").hidden = !abrir;
  document.documentElement.classList.toggle("nexus-abierto", abrir);
  $("#boton-nexus").setAttribute("aria-pressed", abrir ? "true" : "false");
  vista?.pausar?.(abrir || salaAbierta() || csiAbierto());
  if (abrir) {
    if (!nexusDocs) dibujarNexus($("#nexus"), null, { alCerrar: () => ponerNexus(false) });
    leerYDibujarNexus().then(() => $("#nexus-titulo")?.focus({ preventScroll: true }));
    $("#nexus-titulo")?.focus({ preventScroll: true });
  } else if (document.activeElement === document.body || $("#nexus").contains(document.activeElement)) $("#boton-nexus").focus({ preventScroll: true });
}

async function cargarRegistroNexus() {
  const [lr, rr, mr] = await Promise.all([cargarJSON("datos/nexus/registro/lecciones.json"), cargarJSON("datos/nexus/registro/recomendaciones.json"), cargarJSON("datos/nexus/registro/manifiesto.json")]);
  if (lr.tipo === "ok") return { fuente: "real", lecciones: lr.datos, recomendaciones: rr.tipo === "ok" ? rr.datos : { contrato: "cauce.nexus.registro-recomendaciones", version_contrato: "0.2", es_demo: false, entradas: [] }, manifiesto: mr.tipo === "ok" ? mr.datos : null, aviso: rr.tipo !== "ok" && rr.tipo !== "no_encontrado" ? rr.mensaje : null };
  if (lr.tipo !== "no_encontrado") return { fuente: "real", lecciones: null, recomendaciones: null, aviso: lr.mensaje };
  const [ld, rd] = await Promise.all([cargarJSON("datos/nexus/demo/lecciones.json"), cargarJSON("datos/nexus/demo/recomendaciones.json")]);
  return { fuente: "demo", lecciones: ld.tipo === "ok" ? ld.datos : null, recomendaciones: rd.tipo === "ok" ? rd.datos : null, aviso: ld.tipo === "ok" ? null : ld.mensaje };
}

/** Candidatas: borradores de lecciones reales que NO están en el almacén (datos/nexus/candidatas/indice.json). */
async function cargarCandidatas() {
  const ind = await cargarJSON("datos/nexus/candidatas/indice.json");
  if (ind.tipo !== "ok" || !Array.isArray(ind.datos?.archivos)) return [];
  const leidas = await Promise.all(ind.datos.archivos.filter((a) => typeof a === "string" && /^[\w./-]+\.json$/.test(a) && !a.includes("..")).map(async (a) => ({ archivo: a, r: await cargarJSON(`datos/nexus/candidatas/${a}`) })));
  return leidas.filter((x) => x.r.tipo === "ok").map((x) => ({ archivo: x.archivo, leccion: x.r.datos }));
}

async function leerYDibujarNexus() {
  const [docs, politica, crudas] = await Promise.all([cargarRegistroNexus(), cargarJSON("datos/nexus/politica.json"), cargarCandidatas()]);
  nexusDocs = docs;
  const nx = await leerNexus({ lecciones: docs.lecciones, recomendaciones: docs.recomendaciones, politica: politica.tipo === "ok" ? politica.datos : null });
  if (docs.aviso) nx.errores.unshift(docs.aviso);
  const ahora = Date.now();
  // Integridad: solo el almacén real tiene manifiesto (los datos de prueba se regeneran con herramientas/nexus-demo.mjs).
  const integridad = docs.fuente === "real" && docs.lecciones ? await verificarContinuidad({ lecciones: docs.lecciones, recomendaciones: docs.recomendaciones }, docs.manifiesto) : null;
  if (integridad && docs.manifiesto) integridad.ancla = await anclaDe(docs.manifiesto);
  const ctx = contextoGerente(nx, ahora);
  const real = docs.fuente === "real" ? nx.ultimas : new Map();
  const candidatas = crudas.filter((x) => !real.has(x.leccion?.id)).map((x) => ({ ...x, evaluacion: evaluarLeccion(x.leccion, { ...ctx, lecciones: new Map([...real, [x.leccion?.id, x.leccion]]) }), admision: admisionReal(x.leccion, { ahora, lecciones: real }) }))
    .filter((x) => x.evaluacion && x.leccion?.hallazgo);
  if (!nexusAbierto()) return;
  dibujarNexus($("#nexus"), resumirNexus(nx, { ahora }), { alCerrar: () => ponerNexus(false), fuente: docs.fuente, docLecciones: docs.lecciones, docsRegistro: docs, manifiesto: docs.manifiesto ?? null, integridad, candidatas, ahoraMs: ahora });
}

// ---------- Laboratorio CSI (Inteligencia Estratégica) ----------
// Solo lee datos/csi/: primero el almacén REAL (local, fuera de git); si no hay nada, el caso DEMO ficticio.
const csiAbierto = () => !$("#csi").hidden;

function ponerCSI(abrir) {
  if (abrir === csiAbierto()) return;
  if (abrir) { ponerInmersivo(false); ponerSala(false); ponerNexus(false); }
  $("#csi").hidden = !abrir;
  document.documentElement.classList.toggle("csi-abierto", abrir);
  $("#boton-csi").setAttribute("aria-pressed", abrir ? "true" : "false");
  vista?.pausar?.(abrir || salaAbierta() || nexusAbierto());
  if (abrir) {
    dibujarCSI($("#csi"), null, { alCerrar: () => ponerCSI(false) });
    $("#csi-titulo")?.focus({ preventScroll: true });
    leerYDibujarCSI().then(() => $("#csi-titulo")?.focus({ preventScroll: true }));
  } else if (document.activeElement === document.body || $("#csi").contains(document.activeElement)) $("#boton-csi").focus({ preventScroll: true });
}

// Tres conjuntos que NUNCA se mezclan: REAL (almacén local), HISTÓRICO (caso real retrospectivo, local) y DEMO (ficticio).
const CONJUNTOS_CSI = [["registro", "REAL", "datos/csi/registro"], ["historico", "HISTÓRICO", "datos/csi/historico"], ["demo", "DEMO", "datos/csi/demo"]];
const csiUI = { conjunto: null };
async function leerYDibujarCSI(conjunto = null) {
  const leerDe = async (base) => {
    const nombres = ["actores", "investigaciones", "escenarios", "predicciones", "anclas"];
    const rs = await Promise.all(nombres.map((n) => cargarJSON(`${base}/${n}.json`)));
    const docs = Object.fromEntries(nombres.map((n, i) => [n, rs[i].tipo === "ok" ? rs[i].datos : null]));
    return { docs, avisos: rs.filter((r) => r.tipo !== "ok" && r.tipo !== "no_encontrado").map((r) => r.mensaje), hay: rs.slice(0, 4).some((r) => r.tipo === "ok") };
  };
  const leidos = Object.fromEntries(await Promise.all(CONJUNTOS_CSI.map(async ([id, , base]) => [id, await leerDe(base)])));
  // Cierre: si la carpeta local del HISTÓRICO está vacía, el caso publicado se construye aquí mismo desde su expediente
  // (mismo motor que una investigación hecha a mano), así se consulta sin Node. Con archivos locales, estos mandan.
  if (!leidos.historico.hay && !leidos.historico.avisos.length) leidos.historico = await historicoPublicado();
  const pedido = conjunto ?? csiUI.conjunto ?? new URLSearchParams(location.search).get("csi");
  // Por defecto, como en la fase 1: el almacén REAL si tiene algo; si no, el DEMO. El HISTÓRICO se elige a mano (o ?csi=historico).
  // Un conjunto con archivos dañados (avisos) también se puede elegir: así la persona ve el problema donde está.
  const disponible = (id) => !!leidos[id] && (leidos[id].hay || leidos[id].avisos.length > 0);
  const elegido = disponible(pedido) ? pedido : disponible("registro") ? "registro" : "demo";
  csiUI.conjunto = elegido;
  const r = leidos[elegido];
  const csi = await leerCSI(r.docs, { ahoraMs: elegido === "demo" ? null : Date.now() });
  csi.errores.unshift(...r.avisos);
  // Cierre: si el almacén REAL solo tiene archivos dañados, leerCSI no ve ningún documento y supondría DEMO; el conjunto
  // elegido manda, para que el error se muestre bajo la banda REAL y no bajo «caso ficticio».
  if (elegido === "registro" && !r.hay) { csi.es_demo = false; csi.naturaleza = "real"; }
  if (!csiAbierto()) return;
  dibujarCSI($("#csi"), csi, { alCerrar: () => ponerCSI(false), conjunto: elegido, conjuntos: CONJUNTOS_CSI.map(([id, etiqueta]) => ({ id, etiqueta, hay: disponible(id) })),
    origenHistorico: elegido === "historico" ? (r.origen ?? "local") : null,
    alConjunto: (id) => { olvidarCalculosCSI(); leerYDibujarCSI(id).then(() => $(`[data-conjunto="${id}"]`)?.focus({ preventScroll: true })); } });
}

/**
 * Casos históricos publicados (datos/csi/casos-publicados/indice.json): cada expediente se reconstruye con
 * construirDesdeExpediente, igual que con «node herramientas/csi.mjs expediente». Si un expediente falla, se avisa y no se
 * muestra nada de él. Devuelve la misma forma que leerDe(): { docs, avisos, hay, origen }.
 */
async function historicoPublicado() {
  const vacio = { docs: { actores: null, investigaciones: null, escenarios: null, predicciones: null, anclas: null }, avisos: [], hay: false, origen: "publicado" };
  const ind = await cargarJSON("datos/csi/casos-publicados/indice.json");
  if (ind.tipo === "no_encontrado") return vacio;
  if (ind.tipo !== "ok") return { ...vacio, avisos: [ind.mensaje] };
  const casos = Array.isArray(ind.datos?.casos) ? ind.datos.casos.filter((c) => typeof c?.expediente === "string" && /^[\w.-]+\.json$/.test(c.expediente)) : [];
  if (!casos.length) return vacio;
  const { construirDesdeExpediente } = await import("./csi/expediente.js");
  const avisos = [];
  const docs = { actores: null, investigaciones: { contrato: "cauce.csi.investigaciones", version_contrato: "0.1", es_demo: false, investigaciones: [] }, escenarios: { contrato: "cauce.csi.escenarios", version_contrato: "0.1", es_demo: false, escenarios: [] }, predicciones: null, anclas: null };
  for (const c of casos) {
    const r = await cargarJSON(`datos/csi/casos-publicados/${c.expediente}`);
    if (r.tipo !== "ok") { avisos.push(`Caso publicado ${c.id ?? c.expediente}: ${r.mensaje}`); continue; }
    let b;
    try { b = await construirDesdeExpediente(r.datos); } catch (e) { b = { ok: false, errores: [e.message] }; }
    if (!b.ok) { avisos.push(`Caso publicado ${c.id ?? c.expediente} no se pudo reconstruir: ${b.errores.slice(0, 3).join(" | ")}`); continue; }
    docs.investigaciones.investigaciones.push(...b.docs.investigaciones.investigaciones);
    docs.escenarios.escenarios.push(...b.docs.escenarios.escenarios);
    if (b.docs.actores) {
      if (!docs.actores) docs.actores = b.docs.actores;
      else for (const k of ["fuentes", "actores", "relaciones"]) { const ids = new Set(docs.actores[k].map((x) => x.id)); docs.actores[k].push(...b.docs.actores[k].filter((x) => !ids.has(x.id))); }
    }
  }
  const hay = docs.investigaciones.investigaciones.length > 0;
  return { docs: hay ? docs : vacio.docs, avisos, hay, origen: "publicado" };
}

function empresaActual() {
  const resumenes = estado.proyectos.map((p) => resumirProyecto(p, modelosPisos.get(p.id) ?? null));
  return resumirEmpresa(resumenes, bitacora.eventos());
}

function dibujarSalaSiAbierta() {
  const empresa = estado.proyectos.length ? empresaActual() : null;
  // La insignia del botón cuenta solo asuntos de datos REAL (los de DEMO están en la sala, marcados).
  const reales = empresa ? empresa.atencion.filter((a) => !a.es_demo).length : 0;
  const insignia = $("#boton-sala .sala-contador");
  insignia.hidden = reales === 0;
  insignia.textContent = String(reales);
  $("#boton-sala").title = reales ? `Sala de control: ${reales} asunto(s) con datos reales por revisar (S)` : "Sala de control: estado de todos los proyectos (S)";
  if (!salaAbierta() || !empresa) return;
  dibujarSala($("#sala-control"), empresa, {
    actualId: estado.actual?.id ?? null,
    registro: estado.proyectos,
    alCerrar: () => ponerSala(false),
    alIrProyecto: (id) => irA(id, null),
    alIrDepartamento: (id, dep) => irA(id, dep),
  });
}

/** Desde la sala: lleva al piso (y al departamento, si lo hay) y lo resalta un momento. */
async function irA(proyectoId, depId) {
  const p = estado.proyectos.find((x) => x.id === proyectoId);
  if (!p) return;
  ponerSala(false);
  await elegirProyecto(p);
  if (depId && estado.modelo?.departamentos.some((d) => d.id === depId)) {
    estado.seleccion = { tipo: "departamento", id: depId };
    dibujar();
  }
  anunciarLlegada(p, depId);
}

let temporizadorLlegada = null;
function anunciarLlegada(p, depId) {
  const m = estado.modelo;
  const dep = depId ? m?.departamentos.find((d) => d.id === depId) : null;
  const k = resumenPisos.get(p.id);
  const aviso = $("#llegada");
  aviso.replaceChildren(el("strong", {}, `Piso ${p.nombre}`), k ? ` · ${RESUMEN[k].texto}` : "", dep ? ` · ${dep.nombre}` : "");
  aviso.hidden = false;
  const pestana = [...document.querySelectorAll("#pisos .piso")].find((b) => b.getAttribute("aria-selected") === "true");
  pestana?.classList.add("recien-elegido");
  clearTimeout(temporizadorLlegada);
  temporizadorLlegada = setTimeout(() => { aviso.hidden = true; pestana?.classList.remove("recien-elegido"); }, 3500);
}

function aplicarBajoConsumo(activo) {
  document.documentElement.classList.toggle("bajo-consumo", activo);
  $("#bajo-consumo").checked = activo;
}

function dibujarPestanas() {
  // Fase L: con muchos proyectos, los pendientes (sin datos ni oficinas) se juntan en «+N pendientes».
  const { pestanas, agrupados } = agruparPisos(estado.proyectos, resumenPisos, estado.actual.id);
  const pestana = (p) => el("button", {
    type: "button",
    role: "tab",
    clase: "piso",
    "aria-selected": p.id === estado.actual.id ? "true" : "false",
    onclick: () => elegirProyecto(p),
  }, p.nombre, insigniaPiso(p.id));
  const abierto = $("#pisos .pisos-mas")?.open ?? false;
  const mas = agrupados.length ? el("details", { clase: "pisos-mas", open: abierto },
    el("summary", { clase: "piso", title: "Proyectos pendientes: sin repositorio localizado ni datos" }, `+${agrupados.length} pendientes`),
    el("div", { clase: "pisos-mas-lista" }, ...agrupados.map((p) => el("button", {
      type: "button", clase: "piso", title: p.pendiente, onclick: (e) => { e.currentTarget.closest("details").open = false; elegirProyecto(p); },
    }, p.nombre, insigniaPiso(p.id))))) : null;
  $("#pisos").replaceChildren(...pestanas.map(pestana), ...(mas ? [mas] : []));
  // En celular la fila se desliza: la pestaña elegida queda a la vista sin mover la página.
  const elegida = $('#pisos [aria-selected="true"]');
  if (elegida) elegida.parentElement.scrollLeft = Math.max(0, elegida.offsetLeft - elegida.parentElement.offsetLeft - 8);
}

async function elegirProyecto(p) {
  if (p === estado.actual) return;
  estado.actual = p;
  estado.seleccion = null;
  seguidor.reiniciar(); // la primera lectura del otro piso no cuenta como cambio observado
  guardarPreferencia("cauce.proyecto", p.id);
  dibujarPestanas();
  await actualizar();
}

function insigniaPiso(id) {
  const k = resumenPisos.get(id);
  if (!k) return null;
  const pendiente = estado.proyectos.find((p) => p.id === id)?.pendiente;
  return el("span", { clase: `piso-estado piso-${k}`, title: k === "desconectado" && pendiente ? `${RESUMEN[k].titulo}. ${pendiente}` : RESUMEN[k].titulo },
    el("span", { clase: "piso-luz", "aria-hidden": "true" }), el("span", { clase: "piso-estado-texto" }, RESUMEN[k].texto));
}

/** Lee el archivo de cada piso que no se está viendo (solo para su insignia; no anima ni registra cambios). */
async function revisarOtrosPisos() {
  const otros = estado.proyectos.filter((p) => p !== estado.actual);
  const resultados = await Promise.all(otros.map(async (p) => {
    const real = await cargarEstado(p.estado);
    const demo = real.tipo === "no_encontrado" && p.demo ? await cargarJSON(p.demo) : null;
    const e = elegirCarga(real, demo);
    const modelo = construirModeloVista({ proyecto: p, carga: e.carga, origen: e.origen, ahora: new Date() });
    return [p.id, resumenDe(modelo), modelo];
  }));
  let cambio = false;
  for (const [id, k, modelo] of resultados) {
    if (estado.actual?.id === id) continue; // mientras tanto el usuario eligió este piso: manda su lectura propia
    modelosPisos.set(id, modelo);
    bitacora.leer(modelo);
    if (resumenPisos.get(id) !== k) { resumenPisos.set(id, k); cambio = true; }
  }
  if (cambio) dibujarPestanas();
  dibujarSalaSiAbierta();
}

let lecturaNumero = 0;
async function actualizar() {
  const p = estado.actual;
  // Varias lecturas pueden cruzarse (cada 30 s, al volver a la pestaña, el botón Actualizar):
  // solo cuenta la más reciente, así nunca se compara una lectura vieja como si fuera nueva.
  const numero = ++lecturaNumero;
  const [real, dist] = await Promise.all([
    cargarEstado(p.estado),
    p.distribucion ? cargarJSON(p.distribucion) : Promise.resolve({ tipo: "no_encontrado" }),
  ]);
  // La demostración solo se pide si no existe el archivo real.
  const demo = real.tipo === "no_encontrado" && p.demo ? await cargarJSON(p.demo) : null;
  const clasificacion = await clasificacionDe(p);
  const eleccion = elegirCarga(real, demo);
  const esDemoPiso = eleccion.carga.tipo === "ok" && eleccion.carga.datos?.es_demo === true;
  const estaciones = await estacionesDe(p, dist.tipo === "ok" ? dist.datos : null, eleccion.origen, esDemoPiso);
  if (p !== estado.actual || numero !== lecturaNumero) return; // cambió de piso o llegó una lectura más nueva
  estado.modelo = construirModeloVista({
    proyecto: p,
    carga: eleccion.carga,
    nota_origen: eleccion.nota,
    origen: eleccion.origen,
    distribucion: dist.tipo === "ok" ? dist.datos : null,
    ahora: new Date(),
  });
  // Estaciones de trabajo dentro de las oficinas existentes (contrato aparte cauce.estaciones; el v1 no cambia).
  if (estaciones) {
    aplicarEstaciones(estado.modelo, estaciones.estaciones.map((e) => ({ ...e })));
    for (const t of [...estaciones.errores, ...estaciones.avisos]) console.warn(`estaciones de ${p.id}: ${t}`);
  }
  registroCambios.leer(estado.modelo); // solo compara con la lectura anterior de esta página
  modelosPisos.set(p.id, estado.modelo);
  bitacora.leer(estado.modelo);
  estado.clasificacion = clasificacion;
  aplicarNaturalezas();
  const k = resumenDe(estado.modelo);
  if (resumenPisos.get(p.id) !== k) { resumenPisos.set(p.id, k); dibujarPestanas(); }
  dibujarSalaSiAbierta();
  if (nexusAbierto()) leerYDibujarNexus();
  revisarOtrosPisos();
}

// Escenas de otros pisos (solo para saber qué estación está al otro lado de un enlace). Son estructura: se leen una vez.
const escenasOtros = new Map();
async function escenaDe(p) {
  if (!p?.distribucion) return null;
  if (!escenasOtros.has(p.id)) { const r = await cargarJSON(p.distribucion); escenasOtros.set(p.id, r.tipo === "ok" ? r.datos : null); }
  return escenasOtros.get(p.id);
}

/**
 * Estado de las estaciones del piso (y del otro lado de su enlace, para confirmar transferencias). Lee de la
 * misma carpeta que el piso: si el piso muestra la demostración, datos/demo/; si no, datos/reales/. Nunca cae
 * a la demostración en silencio cuando el piso es REAL. Sin "estaciones" en la escena no se pide nada.
 */
async function estacionesDe(p, dist, origen, esDemo) {
  if (!leerConfiguracion(location.href).estaciones) return null; // ?estaciones=0: medición A/B sin estaciones
  const disposicion = leerDisposicionEstaciones(dist);
  if (disposicion.length === 0) return null;
  const ruta = (q) => (origen === "demo" ? q.estaciones?.demo : q.estaciones?.estado);
  const ahora = new Date();
  // normalizarCargaEstaciones: si el archivo es la salida de Compago (estado_internacional), se traduce aquí.
  const carga = normalizarCargaEstaciones(ruta(p) ? await cargarJSON(ruta(p)) : { tipo: "no_encontrado" });
  const r = construirEstaciones({ disposicion, carga, origen, esDemo, ahora, proyectoId: p.id });
  // Enlaces con estaciones de otros pisos: se lee la estación del otro lado con la misma regla (DEMO con DEMO).
  for (const est of r.estaciones) {
    if (!est.enlace) continue;
    const otro = estado.proyectos.find((q) => q.id === est.enlace.proyecto);
    const dispOtro = otro ? leerDisposicionEstaciones(await escenaDe(otro)).filter((e) => e.id === est.enlace.estacion) : [];
    let otra = null;
    if (otro && dispOtro.length && ruta(otro)) {
      const c = normalizarCargaEstaciones(await cargarJSON(ruta(otro)));
      otra = construirEstaciones({ disposicion: dispOtro, carga: c, origen, esDemo, ahora, proyectoId: otro.id }).estaciones[0] ?? null;
    }
    cruzarEnlace(est, p.id, otra, otro?.id ?? null);
  }
  return r;
}

async function clasificacionDe(p) {
  if (!clasificaciones.has(p.id)) {
    const r = p.naturalezas ? await cargarJSON(p.naturalezas) : { tipo: "no_encontrado" };
    let c = null;
    if (r.tipo === "ok") {
      c = validarNaturalezas(r.datos);
      for (const t of [...c.errores, ...c.avisos]) console.warn(`${p.naturalezas}: ${t}`);
    }
    clasificaciones.set(p.id, c);
  }
  return clasificaciones.get(p.id);
}

/** Decora el modelo (naturaleza de cada puesto) y, si alguien apareció brevemente, vuelve a dibujar cuando se vaya. */
function aplicarNaturalezas() {
  clearTimeout(temporizadorBreve);
  const m = estado.modelo;
  if (!m) return;
  const proximo = seguidor.aplicar(m, estado.clasificacion, Date.now());
  if (proximo !== null) temporizadorBreve = setTimeout(aplicarNaturalezas, proximo + 50);
  dibujar();
}

function dibujar() {
  const m = estado.modelo;
  if (!m || !vista) return;
  // Primero el panel: así la vista 3D ya sabe cuánto tapa (en celular se abre encima del edificio).
  dibujarPanel($("#panel"), m, estado.seleccion, () => { estado.seleccion = null; dibujar(); },
    { historial: bitacora.eventos({ proyecto_id: m.proyecto.id }), ahoraMs: Date.now(), alSeleccionar: (sel) => { estado.seleccion = sel; dibujar(); } });
  vista.dibujar(m, estado.seleccion);
  dibujarEstado(m);
}

/** Alto disponible para la vista: lo que queda de la ventana debajo de cabecera y franjas (sin desplazar la página). */
function medirArriba() {
  const o = $("#oficina");
  if (!o) return;
  const arriba = Math.round(o.getBoundingClientRect().top + window.scrollY);
  document.documentElement.style.setProperty("--arriba-oficina", `${arriba}px`);
}
window.addEventListener("resize", medirArriba);

function dibujarEstado(m) {
  requestAnimationFrame(medirArriba); // las franjas (DEMO, avisos) cambian lo que queda arriba
  $("#banda-demo").hidden = !m.es_demo;
  if (m.es_demo) {
    // En celular se ocultan "DATOS DE" y la hora (sigue en el tablero) para que la franja no quede cortada.
    $("#banda-demo-texto").replaceChildren(
      el("span", { clase: "ocultar-movil" }, "DATOS DE "), "DEMOSTRACIÓN",
      ` · No reflejan actividad real de ${m.proyecto.nombre}.`,
      el("span", { clase: "ocultar-movil" }, ` Hora simulada: ${fecha(m.ahora_referencia)}`));
  }
  dibujarTablero($("#conexion"), m, registroCambios.cambios, {
    alElegirDepartamento(id) { estado.seleccion = { tipo: "departamento", id }; dibujar(); },
  });
  const det = $("#diagnostico");
  const lineas = [...m.errores, ...m.avisos];
  det.hidden = lineas.length === 0;
  $("#diagnostico-titulo").textContent = m.errores.length
    ? `El archivo tiene ${m.errores.length} error(es)`
    : `${m.avisos.length} dato(s) corregidos por el visualizador`;
  $("#diagnostico-lista").replaceChildren(...lineas.map((t) => el("li", {}, t)));
}

iniciar();
