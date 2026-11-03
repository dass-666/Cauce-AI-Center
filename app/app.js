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

const INTERVALO_MS = 30_000;
const $ = (s) => document.querySelector(s);
const registroCambios = crearRegistroCambios({ maximo: 30 });

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

async function cambiarVista(tipo, { forzada = false } = {}) {
  if (tipo === tipoVista && !forzada) return;
  vista?.destruir();
  vista = null;
  tipoVista = tipo;
  $("#oficina").classList.toggle("modo-3d", tipo === "3d");
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
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && estado.seleccion) { estado.seleccion = null; dibujar(); }
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
        guardarPreferencia("cauce.proyecto", p.id);
        dibujarPestanas();
        await actualizar();
      },
    }, p.nombre)));
}

async function actualizar() {
  const p = estado.actual;
  const [real, dist] = await Promise.all([
    cargarJSON(p.estado),
    p.distribucion ? cargarJSON(p.distribucion) : Promise.resolve({ tipo: "no_encontrado" }),
  ]);
  // La demostración solo se pide si no existe el archivo real.
  const demo = real.tipo === "no_encontrado" && p.demo ? await cargarJSON(p.demo) : null;
  if (p !== estado.actual) return; // el usuario cambió de piso mientras cargaba
  const eleccion = elegirCarga(real, demo);
  estado.modelo = construirModeloVista({
    proyecto: p,
    carga: eleccion.carga,
    nota_origen: eleccion.nota,
    distribucion: dist.tipo === "ok" ? dist.datos : null,
    ahora: new Date(),
  });
  registroCambios.leer(estado.modelo); // solo compara con la lectura anterior de esta página
  dibujar();
}

function dibujar() {
  const m = estado.modelo;
  if (!m || !vista) return;
  vista.dibujar(m, estado.seleccion);
  dibujarPanel($("#panel"), m, estado.seleccion, () => { estado.seleccion = null; dibujar(); });
  dibujarEstado(m);
}

function dibujarEstado(m) {
  $("#banda-demo").hidden = !m.es_demo;
  if (m.es_demo) {
    $("#banda-demo-texto").textContent =
      `DATOS DE DEMOSTRACIÓN · No reflejan actividad real de ${m.proyecto.nombre}. Hora simulada: ${fecha(m.ahora_referencia)}`;
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
