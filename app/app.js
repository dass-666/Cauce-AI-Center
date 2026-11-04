// Arranque del centro de operaciones: elige proyecto (piso), carga sus datos cada cierto
// tiempo y se los pasa a la vista (3D o plano 2D; las dos usan el mismo modelo de vista).
// La vista 3D y three.js solo se descargan si se usan; "Bajo consumo" fuerza el plano 2D.

import { cargarJSON, cargarRegistro } from "./cargador.js";
import { construirModeloVista, elegirCarga } from "./nucleo/modelo.js";
import { crearVista2D } from "./vistas/vista2d.js";
import { dibujarPanel } from "./vistas/panel.js";
import { el, fecha } from "./vistas/dom.js";
import { dibujarTablero } from "./vistas/tablero.js";
import { crearRegistroCambios } from "./nucleo/cambios.js";
import { crearSeguidorNaturalezas, validarNaturalezas } from "./nucleo/naturaleza.js";

const INTERVALO_MS = 30_000;
const $ = (s) => document.querySelector(s);
const registroCambios = crearRegistroCambios({ maximo: 30 });
// Qué es cada puesto (escena/<id>-naturaleza.json). Sin ese archivo, el proyecto se ve como antes.
const seguidor = crearSeguidorNaturalezas();
const clasificaciones = new Map(); // proyecto → resultado de validarNaturalezas o null
let temporizadorBreve = null;

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
  alFallar(motivo) {
    // La 3D dejó de funcionar: seguimos en el plano 2D sin perder datos.
    avisarVista(`${motivo} Se muestra el plano 2D.`);
    cambiarVista("2d", { forzada: true });
  },
};

function avisarVista(texto) {
  const a = $("#aviso-vista");
  a.hidden = !texto;
  a.textContent = texto ?? "";
}

function vistaDeseada() {
  if ($("#bajo-consumo").checked) return "2d";
  return leerPreferencia("cauce.vista") === "2d" ? "2d" : "3d";
}

/**
 * Modo inmersivo (solo 3D): el edificio ocupa toda la ventana. Quedan siempre a la vista la insignia
 * REAL/DEMO, la conexión, la edad del dato, las alertas y cualquier error. No usa la pantalla completa
 * del navegador. Se sale con el botón «Salir», con Esc o al pasar al plano.
 */
function ponerInmersivo(activo) {
  activo = activo && tipoVista === "3d";
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
      avisarVista(null);
    } catch (e) {
      console.error(e);
      avisarVista("Este navegador no pudo abrir la oficina 3D (WebGL no disponible). Se muestra el plano 2D.");
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
  aplicarBajoConsumo(leerPreferencia("cauce.bajo-consumo") === "1");
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

  const registro = await cargarRegistro();
  estado.proyectos = registro.proyectos;
  if (estado.proyectos.length === 0) {
    $("#oficina").replaceChildren(el("p", { clase: "plano-vacio" }, "No se encontró datos/proyectos.json."));
    return;
  }
  const guardado = leerPreferencia("cauce.proyecto");
  estado.actual = estado.proyectos.find((p) => p.id === guardado) ?? estado.proyectos[0];
  dibujarPestanas();
  await actualizar();
  estado.temporizador = setInterval(() => { if (!document.hidden) actualizar(); }, INTERVALO_MS);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) actualizar(); });
  // En window (no en document): así corre después de la vista 3D, que usa Esc para volver al piso.
  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || e.defaultPrevented) return;
    // Esc primero cierra el detalle; con el detalle cerrado, sale del modo inmersivo.
    if (estado.seleccion) { estado.seleccion = null; dibujar(); }
    else if (enInmersivo()) ponerInmersivo(false);
  });
}

function aplicarBajoConsumo(activo) {
  document.documentElement.classList.toggle("bajo-consumo", activo);
  $("#bajo-consumo").checked = activo;
}

function dibujarPestanas() {
  $("#pisos").replaceChildren(...estado.proyectos.map((p) =>
    el("button", {
      type: "button",
      role: "tab",
      clase: "piso",
      "aria-selected": p.id === estado.actual.id ? "true" : "false",
      onclick: async () => {
        estado.actual = p;
        estado.seleccion = null;
        seguidor.reiniciar(); // la primera lectura del otro piso no cuenta como cambio observado
        guardarPreferencia("cauce.proyecto", p.id);
        dibujarPestanas();
        await actualizar();
      },
    }, p.nombre)));
  // En celular la fila se desliza: la pestaña elegida queda a la vista sin mover la página.
  const elegida = $('#pisos [aria-selected="true"]');
  if (elegida) elegida.parentElement.scrollLeft = Math.max(0, elegida.offsetLeft - elegida.parentElement.offsetLeft - 8);
}

let lecturaNumero = 0;
async function actualizar() {
  const p = estado.actual;
  // Varias lecturas pueden cruzarse (cada 30 s, al volver a la pestaña, el botón Actualizar):
  // solo cuenta la más reciente, así nunca se compara una lectura vieja como si fuera nueva.
  const numero = ++lecturaNumero;
  const [real, dist] = await Promise.all([
    cargarJSON(p.estado),
    p.distribucion ? cargarJSON(p.distribucion) : Promise.resolve({ tipo: "no_encontrado" }),
  ]);
  // La demostración solo se pide si no existe el archivo real.
  const demo = real.tipo === "no_encontrado" && p.demo ? await cargarJSON(p.demo) : null;
  const clasificacion = await clasificacionDe(p);
  if (p !== estado.actual || numero !== lecturaNumero) return; // cambió de piso o llegó una lectura más nueva
  const eleccion = elegirCarga(real, demo);
  estado.modelo = construirModeloVista({
    proyecto: p,
    carga: eleccion.carga,
    nota_origen: eleccion.nota,
    distribucion: dist.tipo === "ok" ? dist.datos : null,
    ahora: new Date(),
  });
  registroCambios.leer(estado.modelo); // solo compara con la lectura anterior de esta página
  estado.clasificacion = clasificacion;
  aplicarNaturalezas();
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
  dibujarPanel($("#panel"), m, estado.seleccion, () => { estado.seleccion = null; dibujar(); });
  vista.dibujar(m, estado.seleccion);
  dibujarEstado(m);
}

function dibujarEstado(m) {
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
