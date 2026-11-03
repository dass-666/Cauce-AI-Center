// Panel de detalle: lo que se sabe (y lo que no) del departamento o personaje elegido.
// Se comparte entre la vista 2D y la futura vista 3D.

import { NATURALEZAS } from "../nucleo/naturaleza.js";
import { el, fecha } from "./dom.js";
import { describirDuracion } from "../nucleo/modelo.js";
import { ESTADOS } from "../nucleo/estados.js";

export function dibujarPanel(contenedor, modelo, seleccion, alCerrar) {
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
  contenedor.append(cerrar, agente ? detalleAgente(agente, depDelAgente, modelo) : detalleDepartamento(dep));
}

function fila(etiqueta, valor) {
  return el("div", { clase: "dato" }, el("dt", {}, etiqueta), el("dd", {}, valor));
}

function detalleAgente(a, dep, modelo) {
  const act = a.actividad;
  const ap = a.apariencia;
  const filas = [
    fila("Departamento", dep.nombre),
    fila("Función", a.rol),
    fila("Estado", ap.etiqueta),
  ];
  if (a.naturaleza) filas.push(fila("Qué es", `${NATURALEZAS[a.naturaleza].etiqueta}. ${a.presentacion.texto}`));
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

  return el("article", { clase: "detalle" },
    el("p", { clase: "detalle-tipo" }, "Personaje"),
    el("h2", {}, a.nombre),
    el("p", { clase: `etiqueta-estado ${ap.clase2d}` }, `${ap.icono} ${ap.etiqueta}`),
    el("p", { clase: "detalle-nota" }, ap.descripcion),
    el("dl", { clase: "datos" }, filas),
    a.error ? el("div", { clase: "caja-error", role: "note" },
      el("strong", {}, "Error"), el("p", {}, a.error.mensaje), a.error.codigo ? el("p", { clase: "detalle-nota" }, `Código: ${a.error.codigo}`) : null) : null,
    a.notas.length ? el("div", { clase: "caja-aviso" },
      el("strong", {}, "Correcciones del visualizador"), el("ul", {}, a.notas.map((n) => el("li", {}, n)))) : null,
  );
}

function detalleDepartamento(dep) {
  return el("article", { clase: "detalle" },
    el("p", { clase: "detalle-tipo" }, "Departamento"),
    el("h2", {}, dep.nombre),
    el("p", { clase: `etiqueta-estado ${dep.apariencia_resumen.clase2d}` }, `${dep.apariencia_resumen.icono} ${dep.apariencia_resumen.etiqueta}`),
    dep.descripcion ? el("p", { clase: "detalle-nota" }, dep.descripcion) : null,
    dep.indicadores.length
      ? el("dl", { clase: "datos" }, dep.indicadores.map((i) =>
          fila(i.etiqueta, `${i.valor === null ? "—" : i.valor}${i.unidad ? " " + i.unidad : ""}${i.nota ? " · " + i.nota : ""}`)))
      : null,
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
  );
}
