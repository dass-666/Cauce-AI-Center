// Vista 2D: plano de la oficina. Implementa la misma interfaz que tendrá la vista 3D:
//   const vista = crearVista2D(contenedor, { alSeleccionar });
//   vista.dibujar(modelo, seleccion);  vista.destruir();
// Solo dibuja: todas las reglas (qué estado mostrar) vienen ya resueltas en el modelo.

import { NATURALEZAS } from "../nucleo/naturaleza.js";
import { el } from "./dom.js";

export function crearVista2D(contenedor, { alSeleccionar }) {
  const raiz = el("div", { clase: "plano", role: "group", "aria-label": "Plano de la oficina" });
  contenedor.append(raiz);

  function dibujar(modelo, seleccion) {
    raiz.replaceChildren();
    raiz.style.setProperty("--columnas", modelo.cuadricula.columnas);
    raiz.dataset.conexion = modelo.conexion;

    if (modelo.departamentos.length === 0) {
      raiz.append(
        el("div", { clase: "plano-vacio" },
          el("p", { clase: "plano-vacio-titulo" }, "Piso sin información"),
          el("p", {}, modelo.motivo ?? "No hay datos de este proyecto."))
      );
      return;
    }

    for (const dep of modelo.departamentos) {
      const p = dep.posicion;
      const elegido = seleccion?.tipo === "departamento" && seleccion.id === dep.id;
      const cuarto = el("section", {
        clase: `cuarto ${dep.apariencia_resumen.clase2d}${elegido ? " elegido" : ""}`,
        style: `grid-column:${p.x + 1} / span ${p.ancho};grid-row:${p.y + 1} / span ${p.alto}`,
        "aria-label": `Departamento ${dep.nombre}`,
      });

      const letrero = el("button", {
        clase: "letrero",
        type: "button",
        "aria-pressed": elegido ? "true" : "false",
        onclick: () => alSeleccionar({ tipo: "departamento", id: dep.id }),
      },
        el("span", { clase: "letrero-luz", title: dep.apariencia_resumen.etiqueta, "aria-hidden": "true" }),
        el("span", { clase: "letrero-nombre" }, dep.nombre),
        el("span", { clase: "solo-lector" }, `, ${dep.apariencia_resumen.etiqueta}`),
        dep.alertas.length ? el("span", { clase: "letrero-alertas", title: "Alertas" }, `⚠ ${dep.alertas.length}`) : null,
      );

      const indicadores = el("dl", { clase: "indicadores" },
        dep.indicadores.slice(0, 3).map((ind) =>
          el("div", { clase: "indicador" },
            el("dt", {}, ind.etiqueta),
            el("dd", {}, ind.valor === null ? "—" : `${ind.valor}${ind.unidad ? " " + ind.unidad : ""}`)))
      );

      const puestos = el("div", { clase: "puestos" },
        dep.agentes.length === 0 ? el("p", { clase: "puestos-vacio" }, "Sin personajes") : null,
        dep.agentes.map((a) => personaje(a, seleccion, alSeleccionar)));

      cuarto.append(letrero, indicadores, puestos);
      raiz.append(cuarto);
    }
  }

  return {
    dibujar,
    destruir: () => raiz.remove(),
  };
}

function personaje(a, seleccion, alSeleccionar) {
  const elegido = seleccion?.tipo === "agente" && seleccion.id === a.id;
  const ap = a.apariencia;
  // Con clasificación (naturaleza.js): módulos, humanos y reactivos sin registro nuevo no muestran figura.
  const nat = a.naturaleza ? NATURALEZAS[a.naturaleza] : null;
  const sinFigura = nat && a.animacion_mostrada === "ausente";
  const sinConfirmar = a.presentacion?.programacion === "sin_confirmar"; // programado sin ejecución reciente
  return el("button", {
    clase: `personaje ${ap.clase2d}${elegido ? " elegido" : ""}${nat ? ` puesto-${nat.puesto}` : ""}${sinFigura ? " sin-figura" : ""}`,
    type: "button",
    "aria-pressed": elegido ? "true" : "false",
    title: `${a.nombre}: ${ap.etiqueta}${nat ? ` · ${nat.etiqueta}` : ""}`,
    onclick: (ev) => {
      ev.stopPropagation();
      alSeleccionar({ tipo: "agente", id: a.id });
    },
  },
    el("span", { clase: "escena-puesto", "aria-hidden": "true" },
      el("span", { clase: "burbuja" }, ap.icono),
      el("span", { clase: "monitor" }),
      el("span", { clase: "cabeza" }),
      el("span", { clase: "cuerpo" }),
      el("span", { clase: "escritorio" })),
    el("span", { clase: "gafete" }, a.nombre),
    el("span", { clase: "estado-texto" }, ap.etiqueta),
    nat ? el("span", { clase: "naturaleza-texto" }, `${nat.corta}${sinConfirmar ? " · sin confirmar" : ""}`) : null,
  );
}
