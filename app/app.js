// Arranque del centro de operaciones: elige proyecto (piso), carga sus datos cada cierto
// tiempo y se los pasa a la vista. La vista 3D se conectará aquí con la misma interfaz.

import { cargarJSON, cargarRegistro } from "./cargador.js";
import { construirModeloVista, describirDuracion, elegirCarga } from "./nucleo/modelo.js";
import { crearVista2D } from "./vistas/vista2d.js";
import { dibujarPanel } from "./vistas/panel.js";
import { el, fecha } from "./vistas/dom.js";

const INTERVALO_MS = 30_000;
const $ = (s) => document.querySelector(s);

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

const vista = crearVista2D($("#oficina"), {
  alSeleccionar(sel) {
    estado.seleccion = sel;
    dibujar();
  },
});

async function iniciar() {
  aplicarBajoConsumo(leerPreferencia("cauce.bajo-consumo") === "1");
  $("#bajo-consumo").addEventListener("change", (e) => {
    aplicarBajoConsumo(e.target.checked);
    guardarPreferencia("cauce.bajo-consumo", e.target.checked ? "1" : "0");
  });
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
  dibujar();
}

function dibujar() {
  const m = estado.modelo;
  if (!m) return;
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
  const c = $("#conexion");
  c.className = `conexion conexion-${m.conexion}`;
  c.replaceChildren(...[
    el("strong", {}, m.conexion_etiqueta),
    m.generado_en ? el("span", {}, ` · dato de ${fecha(m.generado_en)} (hace ${describirDuracion(m.edad_segundos)})`) : null,
    m.fuente ? el("span", {}, ` · ${m.es_demo ? "DEMO" : "REAL"}: ${m.fuente.nombre}`) : null,
    m.motivo ? el("span", { clase: "conexion-motivo" }, m.motivo) : null,
    m.nota_origen ? el("span", { clase: "conexion-motivo" }, m.nota_origen) : null,
  ].filter(Boolean));
  const det = $("#diagnostico");
  const lineas = [...m.errores, ...m.avisos];
  det.hidden = lineas.length === 0;
  $("#diagnostico-titulo").textContent = m.errores.length
    ? `El archivo tiene ${m.errores.length} error(es)`
    : `${m.avisos.length} dato(s) corregidos por el visualizador`;
  $("#diagnostico-lista").replaceChildren(...lineas.map((t) => el("li", {}, t)));
}

iniciar();
