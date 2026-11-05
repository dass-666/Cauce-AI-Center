// Sala de control (fase K): toda la empresa en una pantalla. Funciona en 3D, en el plano 2D y sin WebGL
// (solo HTML). Todo sale de resumirEmpresa() (núcleo); aquí no se calcula ni se inventa nada.
// Cauce es de solo lectura: ningún botón de esta sala actúa sobre un sistema; solo lleva a su piso.

import { ESTADO_PISO, clasificarEvento } from "../nucleo/sala.js";
import { describirDuracion } from "../nucleo/modelo.js";
import { textoCambio } from "./tablero.js";
import { el, hora } from "./dom.js";
import { ESTILOS } from "./vista3d/identidad.js";

const NIVEL = {
  critica: "Crítica", error: "Error", invalido: "Archivo con errores", advertencia: "Advertencia",
  requiere_revision: "Requiere revisión", desactualizado: "Vencida", info: "Información",
};

/**
 * @param nodo        contenedor (#sala-control)
 * @param empresa     resultado de resumirEmpresa()
 * @param acciones    { alIrProyecto(id), alIrDepartamento(proyectoId, depId), alCerrar(), actualId }
 */
export function dibujarSala(nodo, empresa, { alIrProyecto, alIrDepartamento, alCerrar, actualId = null, ahoraMs = Date.now(), registro = [] }) {
  const entrada = new Map(registro.map((p) => [p.id, p]));
  const abiertos = new Set([...nodo.querySelectorAll("details[open][data-k]")].map((d) => d.dataset.k));
  const cifra = (valor, texto, clase = "", titulo = "") =>
    el("div", { clase: `sala-cifra ${clase}`, title: titulo || null }, el("strong", {}, String(valor)), el("span", {}, texto));

  const cabeza = el("div", { clase: "sala-cabeza" },
    el("div", {},
      el("h2", { id: "sala-titulo", tabindex: "-1" }, "Sala de control"),
      el("p", { clase: "sala-sub" }, `Estado de los ${empresa.proyectos} proyectos registrados · solo lectura · revisado a las ${hora(new Date(ahoraMs).toISOString())}`)),
    el("button", { type: "button", clase: "boton", "data-cerrar-sala": "", onclick: alCerrar, title: "Cerrar la sala y volver al piso (S o Esc)" }, "Ir al edificio ›"));

  const cifras = el("div", { clase: "sala-cifras", role: "list", "aria-label": "Resumen" },
    cifra(empresa.real, "con datos reales vigentes", "c-real"),
    cifra(empresa.demo, "solo con demostración", "c-demo"),
    cifra(empresa.vencidos, "con información vencida", empresa.vencidos ? "c-aviso" : ""),
    cifra(empresa.con_error, "con archivo inválido", empresa.con_error ? "c-error" : ""),
    cifra(empresa.sin_conexion, "sin conexión", ""),
    cifra(empresa.trabajando_real, "procesos trabajando (REAL)", "c-real", "Con evidencia vigente en datos reales"),
    empresa.trabajando_demo ? cifra(empresa.trabajando_demo, "trabajando en DEMO (simulado)", "c-demo", "Datos de demostración: no es actividad real") : null);
  for (const c of cifras.children) c.setAttribute("role", "listitem");

  // Fase L: primero los pisos con datos, luego los sin conexión y al final los pendientes (en tarjeta compacta).
  const orden = (r) => (r.clave === "pendiente" ? 2 : r.clave === "desconectado" ? 1 : 0);
  const lista = empresa.proyectos_lista.map((r, i) => [r, i]).sort((a, b) => orden(a[0]) - orden(b[0]) || a[1] - b[1]).map(([r]) => r);
  const tarjetas = el("div", { clase: "sala-proyectos" }, ...lista.map((r) => tarjetaProyecto(r, { alIrProyecto, actual: r.id === actualId, registro: entrada.get(r.id) })));
  // Fase L: accesos rápidos a cada sección (útiles en celular, donde la sala es una columna larga). Solo desplazan.
  const ir = (id) => () => nodo.querySelector(`#${id}`)?.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  const accesos = el("nav", { clase: "sala-accesos", "aria-label": "Secciones de la sala" },
    el("button", { type: "button", clase: `boton boton-chico${empresa.atencion.length ? " sala-acceso-alerta" : ""}`, onclick: ir("sala-atencion") }, `⚠ Atención (${empresa.atencion.length})`),
    el("button", { type: "button", clase: "boton boton-chico", onclick: ir("sala-proyectos-titulo") }, `Proyectos (${empresa.proyectos})`),
    el("button", { type: "button", clase: "boton boton-chico", onclick: ir("sala-eventos-titulo") }, `Cambios (${empresa.eventos.length})`));

  const atencion = empresa.atencion;
  const seccionAtencion = el("section", { clase: "sala-seccion", "aria-labelledby": "sala-atencion" },
    el("h3", { id: "sala-atencion" }, `Requiere atención (${atencion.length})`),
    el("p", { clase: "sala-nota" }, "Cauce solo muestra el problema; se atiende en el sistema de origen."),
    atencion.length === 0
      ? el("p", { clase: "sala-vacio" }, "Ningún archivo reporta errores, revisiones ni alertas.")
      : el("ul", { clase: "sala-lista" }, ...atencion.slice(0, 12).map((a) => el("li", { clase: `sala-item nivel-${a.nivel}` },
          el("span", { clase: "sala-nivel" }, NIVEL[a.nivel] ?? a.nivel),
          a.es_demo ? el("span", { clase: "tablero-insignia es-demo" }, "DEMO") : null,
          el("span", { clase: "sala-item-texto" }, el("strong", {}, a.proyecto), ` · ${a.titulo}`, a.departamento ? ` · ${a.departamento}` : "",
            !a.vigente && a.tipo === "alerta" ? el("em", { clase: "sala-suave" }, " (del último archivo; puede estar resuelta)") : null),
          el("button", { type: "button", clase: "boton boton-chico",
            onclick: () => (a.departamento_id ? alIrDepartamento(a.proyecto_id, a.departamento_id) : alIrProyecto(a.proyecto_id)) },
            a.departamento_id ? "Ver departamento" : "Ver piso")))),
    atencion.length > 12 ? el("p", { clase: "sala-nota" }, `Y ${atencion.length - 12} más en sus pisos.`) : null);

  const eventos = empresa.eventos.slice(0, 15);
  const seccionEventos = el("details", { clase: "sala-seccion sala-eventos", "data-k": "eventos", open: abiertos.has("eventos") || eventos.length > 0 },
    el("summary", {}, el("h3", { clase: "sala-h3-linea", id: "sala-eventos-titulo" }, `Últimos cambios observados (${empresa.eventos.length})`)),
    el("p", { clase: "sala-nota" }, "Diferencias entre lecturas que hizo esta página desde que la abriste (todos los pisos). Se pierden al recargar: no es un historial permanente."),
    eventos.length === 0
      ? el("p", { clase: "sala-vacio" }, "Sin cambios observados todavía. Los datos de demostración no cambian solos.")
      : el("ul", { clase: "sala-lista" }, ...eventos.map((c) => {
          const k = clasificarEvento(c, ahoraMs);
          return el("li", { clase: `sala-item evento-${k.categoria}` },
            el("span", { clase: `sala-cat cat-${k.categoria}` }, k.etiqueta),
            el("span", { clase: "sala-suave" }, k.reciente ? "Reciente" : "Anterior", ` · ${c.entre?.[1] ? hora(c.entre[1]) : "al leer"}`),
            c.es_demo ? el("span", { clase: "tablero-insignia es-demo" }, "DEMO") : null,
            el("span", { clase: "sala-item-texto" }, el("strong", {}, c.proyecto), ` · ${textoCambio(c)}`),
            c.departamento_id ? el("button", { type: "button", clase: "boton boton-chico", onclick: () => alIrDepartamento(c.proyecto_id, c.departamento_id) }, "Ver") : null);
        })));

  nodo.replaceChildren(cabeza, cifras, accesos, el("div", { clase: "sala-cuerpo" },
    el("section", { clase: "sala-seccion", "aria-label": "Proyectos" }, el("h3", { id: "sala-proyectos-titulo" }, "Proyectos"), tarjetas),
    el("div", { clase: "sala-columna" }, seccionAtencion, seccionEventos)));
}

function tarjetaProyecto(r, { alIrProyecto, actual, registro = null }) {
  const est = ESTADO_PISO[r.clave] ?? ESTADO_PISO.desconectado;
  const datos = [];
  if (r.leido && r.edad_segundos !== null && r.edad_segundos !== undefined) datos.push(`Dato de hace ${describirDuracion(r.edad_segundos)}${r.hora_simulada ? " (hora simulada)" : ""}`);
  if (r.departamentos) datos.push(`${r.departamentos} departamento${r.departamentos === 1 ? "" : "s"}${r.solo_estructura ? " (solo estructura)" : ""}`);
  if (r.agentes) datos.push(`${r.trabajando} de ${r.agentes} trabajando${r.es_demo ? " (DEMO)" : ""}`);
  const urgentes = r.atencion.length;
  // Fase L: franja con el color de identidad del registro y su estilo (identidad, no estado). Los pendientes,
  // en tarjeta compacta: no tienen oficinas ni datos que mostrar.
  const estilo = ESTILOS[registro?.estilo]?.etiqueta ?? "";
  return el("article", {
    clase: `sala-tarjeta sala-k-${r.clave}${actual ? " es-actual" : ""}${r.clave === "pendiente" ? " sala-tarjeta-compacta" : ""}`,
    "data-proyecto": r.id, style: registro?.color ? `--identidad: ${registro.color}` : null,
  },
    estilo ? el("p", { clase: "sala-estilo" }, estilo) : null,
    el("div", { clase: "sala-tarjeta-cabeza" },
      el("h4", {}, r.nombre),
      el("span", { clase: `piso-estado piso-${r.clave}`, title: est.titulo }, el("span", { clase: "piso-luz", "aria-hidden": "true" }), el("span", { clase: "piso-estado-texto" }, est.texto))),
    el("p", { clase: "sala-tarjeta-conexion" }, r.leido ? r.conexion_etiqueta ?? est.titulo : "Leyendo…"),
    datos.length ? el("ul", { clase: "sala-datos" }, ...datos.map((t) => el("li", {}, t))) : null,
    urgentes ? el("p", { clase: "sala-tarjeta-atencion" }, `⚠ ${urgentes} asunto${urgentes === 1 ? "" : "s"} por revisar`) : null,
    r.pendiente ? el("p", { clase: "sala-nota" }, r.pendiente) : r.motivo && r.clave !== "real" && r.clave !== "demo" ? el("p", { clase: "sala-nota" }, r.motivo) : null,
    r.fuente ? el("p", { clase: "sala-nota" }, `Fuente: ${r.fuente}`) : null,
    el("button", { type: "button", clase: "boton boton-chico sala-ir", onclick: () => alIrProyecto(r.id), "aria-label": `Ir al piso de ${r.nombre}` }, actual ? "Volver a este piso ›" : "Ir al piso ›"));
}
