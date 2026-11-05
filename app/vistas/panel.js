// Panel de detalle: lo que se sabe (y lo que no) del departamento o personaje elegido.
// Se comparte entre la vista 2D y la futura vista 3D.

import { NATURALEZAS } from "../nucleo/naturaleza.js";
import { el, fecha } from "./dom.js";
import { describirDuracion } from "../nucleo/modelo.js";
import { ESTADOS } from "../nucleo/estados.js";
import { clasificarEvento } from "../nucleo/sala.js";
import { textoCambio } from "./tablero.js";

/**
 * @param extra.historial  cambios observados en esta sesión (bitácora de la sala), del más nuevo al más viejo
 * @param extra.ahoraMs    hora de la computadora (para "reciente")
 */
export function dibujarPanel(contenedor, modelo, seleccion, alCerrar, { historial = [], ahoraMs = Date.now() } = {}) {
  contenedor.replaceChildren();
  if (!seleccion) {
    contenedor.hidden = true;
    return;
  }
  const dep = seleccion.tipo === "departamento" ? modelo.departamentos.find((d) => d.id === seleccion.id) : null;
  let agente = null;
  let depDelAgente = null;
  if (seleccion.tipo === "agente") {
    for (const d of modelo.departamentos) {
      const a = d.agentes.find((x) => x.id === seleccion.id);
      if (a) { agente = a; depDelAgente = d; }
    }
  }
  if (!dep && !agente) {
    contenedor.hidden = true;
    return;
  }
  contenedor.hidden = false;
  const cerrar = el("button", { clase: "panel-cerrar", type: "button", onclick: alCerrar, "aria-label": "Cerrar detalle" }, "×");
  const contexto = { historial, ahoraMs };
  contenedor.append(cerrar, agente ? detalleAgente(agente, depDelAgente, modelo, contexto) : detalleDepartamento(dep, modelo, contexto));
}

/** Proyecto y origen de los datos, arriba del detalle: siempre se sabe si es DEMO o REAL. */
function encabezado(tipo, modelo) {
  const origen = modelo.es_demo ? "demo" : modelo.generado_en ? "real" : "sin";
  return el("p", { clase: "detalle-tipo" }, `${modelo.proyecto.nombre} · ${tipo} `,
    el("span", { clase: `tablero-insignia ${origen === "demo" ? "es-demo" : origen === "real" ? "es-real" : ""}` }, { demo: "DEMO", real: "REAL", sin: "SIN DATOS" }[origen]));
}

/** Fuente y vigencia del archivo del que sale todo el detalle. */
function filaFuente(modelo) {
  if (!modelo.generado_en) return fila("Fuente", "Sin archivo de estado");
  const edad = modelo.edad_segundos !== null ? `generado hace ${describirDuracion(modelo.edad_segundos)}${modelo.hora_simulada ? " (hora simulada)" : ""}` : "";
  const vig = modelo.vigencia_segundos ? `, vigencia ${describirDuracion(modelo.vigencia_segundos)}` : "";
  return fila("Fuente", `${modelo.fuente?.nombre ?? "Archivo de estado"} · ${edad}${vig} · ${modelo.conexion_etiqueta}`);
}

/** Cambios observados en esta sesión para un departamento o un personaje. */
function seccionHistorial(eventos, ahoraMs) {
  const lista = eventos.slice(0, 8);
  return [
    el("h3", {}, "Cambios observados en esta sesión"),
    lista.length === 0
      ? el("p", { clase: "detalle-nota" }, "Ninguno desde que abriste la página. Solo se guardan mientras la página está abierta: no es un historial permanente.")
      : el("ul", { clase: "lista historial" }, lista.map((c) => {
          const k = clasificarEvento(c, ahoraMs);
          return el("li", { clase: `historial-${k.categoria}` },
            el("span", { clase: `sala-cat cat-${k.categoria}` }, k.etiqueta), " ",
            el("small", {}, `${k.reciente ? "Reciente" : "Anterior"} · ${c.entre?.[1] ? fecha(c.entre[1]) : "al leer"}`), " ",
            textoCambio(c));
        })),
  ];
}

function fila(etiqueta, valor) {
  return el("div", { clase: "dato" }, el("dt", {}, etiqueta), el("dd", {}, valor));
}

function detalleAgente(a, dep, modelo, { historial, ahoraMs }) {
  const act = a.actividad;
  const ap = a.apariencia;
  const filas = [
    fila("Departamento", dep.nombre),
    fila("Función", a.rol),
    fila("Estado", ap.etiqueta),
  ];
  // Fase K: la naturaleza siempre visible; sin clasificar no se presenta como agente autónomo.
  filas.push(fila("Qué es", a.naturaleza
    ? `${NATURALEZAS[a.naturaleza].etiqueta}. ${a.presentacion.texto}`
    : "Sin clasificar: el archivo no dice si es un proceso automático, una persona o un módulo."));
  if (a.ultimo_estado_conocido) {
    filas.push(fila("Último estado reportado", `${ESTADOS[a.ultimo_estado_conocido].etiqueta} (no confiable: ${modelo.conexion_etiqueta.toLowerCase()})`));
  }
  filas.push(fila("Tarea", act?.descripcion ?? "No disponible"));
  filas.push(fila("Inicio", fecha(act?.inicio)));
  filas.push(fila("Fin", act?.fin ? fecha(act.fin) : a.estado === "trabajando" ? "En curso" : "No disponible"));
  if (act?.inicio && act?.fin) {
    filas.push(fila("Duración", describirDuracion(Math.round((Date.parse(act.fin) - Date.parse(act.inicio)) / 1000))));
  }
  filas.push(fila("Avance", act?.progreso
    ? `${act.progreso.hecho} de ${act.progreso.total}${act.progreso.unidad ? " " + act.progreso.unidad : ""}`
    : "El sistema no informa avance parcial"));
  filas.push(fila("Evidencia", a.evidencia
    ? `${a.evidencia.origen} · ${a.evidencia.referencia}${a.evidencia.observado_en ? " · " + fecha(a.evidencia.observado_en) : ""}`
    : "Sin registro que lo respalde"));
  const desdeEvidencia = a.evidencia?.observado_en ? Math.round((Date.parse(modelo.ahora_referencia) - Date.parse(a.evidencia.observado_en)) / 1000) : null;
  if (desdeEvidencia !== null && Number.isFinite(desdeEvidencia)) {
    filas.push(fila("Desde la última evidencia", `${desdeEvidencia < 0 ? "fecha posterior al archivo" : describirDuracion(desdeEvidencia)}${modelo.hora_simulada ? " (hora simulada)" : ""}`));
  }
  filas.push(filaFuente(modelo));
  const eventos = historial.filter((c) => c.agente_id === a.id);

  return el("article", { clase: "detalle" },
    encabezado("Personaje", modelo),
    el("h2", {}, a.nombre),
    el("p", { clase: `etiqueta-estado ${ap.clase2d}` }, `${ap.icono} ${ap.etiqueta}`),
    el("p", { clase: "detalle-nota" }, ap.descripcion),
    el("dl", { clase: "datos" }, filas),
    a.error ? el("div", { clase: "caja-error", role: "note" },
      el("strong", {}, "Error"), el("p", {}, a.error.mensaje), a.error.codigo ? el("p", { clase: "detalle-nota" }, `Código: ${a.error.codigo}`) : null) : null,
    a.notas.length ? el("div", { clase: "caja-aviso" },
      el("strong", {}, "Correcciones del visualizador"), el("ul", {}, a.notas.map((n) => el("li", {}, n)))) : null,
    ...seccionHistorial(eventos, ahoraMs),
  );
}

function detalleDepartamento(dep, modelo, { historial, ahoraMs }) {
  // Qué hay en el departamento, por naturaleza (si el proyecto la tiene clasificada).
  const porNaturaleza = new Map();
  for (const a of dep.agentes) if (a.naturaleza) porNaturaleza.set(a.naturaleza, (porNaturaleza.get(a.naturaleza) ?? 0) + 1);
  const composicion = [...porNaturaleza].map(([n, k]) => `${k} ${NATURALEZAS[n].corta.toLowerCase()}`).join(", ");
  const eventos = historial.filter((c) => c.departamento_id === dep.id);
  return el("article", { clase: "detalle" },
    encabezado("Departamento", modelo),
    el("h2", {}, dep.nombre),
    el("p", { clase: `etiqueta-estado ${dep.apariencia_resumen.clase2d}` }, `${dep.apariencia_resumen.icono} ${dep.apariencia_resumen.etiqueta}`),
    dep.descripcion ? el("p", { clase: "detalle-nota" }, dep.descripcion) : null,
    dep.indicadores.length
      ? el("dl", { clase: "datos" }, dep.indicadores.map((i) =>
          fila(i.etiqueta, `${i.valor === null ? "—" : i.valor}${i.unidad ? " " + i.unidad : ""}${i.nota ? " · " + i.nota : ""}`)))
      : null,
    el("dl", { clase: "datos" }, filaFuente(modelo), composicion ? fila("Puestos", composicion) : null),
    el("h3", {}, "Personajes"),
    dep.agentes.length
      ? el("ul", { clase: "lista" }, dep.agentes.map((a) => el("li", {}, `${a.nombre}${a.naturaleza ? ` (${NATURALEZAS[a.naturaleza].corta.toLowerCase()})` : ""}: ${a.apariencia.etiqueta}`)))
      : el("p", { clase: "detalle-nota" }, "Ninguno."),
    el("h3", {}, "Alertas"),
    dep.alertas.length
      ? el("ul", { clase: "lista" }, dep.alertas.map((al) =>
          el("li", { clase: `alerta alerta-${al.nivel}` },
            el("strong", {}, al.titulo), al.detalle ? el("span", {}, ` · ${al.detalle}`) : null, el("small", {}, ` · ${fecha(al.creada_en)}`))))
      : el("p", { clase: "detalle-nota" }, "Sin alertas."),
    el("h3", {}, "Resultados"),
    dep.resultados.length
      ? el("ul", { clase: "lista" }, dep.resultados.map((r) =>
          el("li", {},
            r.enlace ? el("a", { href: r.enlace, target: "_blank", rel: "noopener noreferrer" }, r.titulo) : el("strong", {}, r.titulo),
            r.descripcion ? el("span", {}, ` · ${r.descripcion}`) : null,
            r.creado_en ? el("small", {}, ` · ${fecha(r.creado_en)}`) : null)))
      : el("p", { clase: "detalle-nota" }, "Sin resultados publicados."),
    ...seccionHistorial(eventos, ahoraMs),
  );
}
