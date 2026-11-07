// Tablero de operaciones (arriba de la oficina, en 3D y en el plano): REAL o DEMO, conexión,
// antigüedad del dato, agentes por estado, alertas del archivo y cambios observados entre lecturas.
// Todo sale del modelo de vista (contrato v1); aquí no se calcula ni se inventa nada.

import { ESTADOS } from "../nucleo/estados.js";
import { describirDuracion } from "../nucleo/modelo.js";
import { el, fecha, hora } from "./dom.js";

const NIVELES = { critica: "Crítica", advertencia: "Advertencia", info: "Información" };
const ORDEN = ["critica", "advertencia", "info"];

export function dibujarTablero(nodo, m, cambios, { alElegirDepartamento }) {
  const abierto = (k) => nodo.querySelector(`details[data-k="${k}"]`)?.open ?? false;
  const abiertos = { alertas: abierto("alertas"), cambios: abierto("cambios") };
  nodo.className = `conexion tablero conexion-${m.conexion}`;

  const insignia = m.generado_en || m.es_demo
    ? el("span", { clase: `tablero-insignia ${m.es_demo ? "es-demo" : "es-real"}`, title: m.es_demo ? "Datos de demostración: no es actividad real" : "Datos reales del adaptador (solo lectura)" }, m.es_demo ? "DEMO" : "REAL")
    : null;
  const edad = m.generado_en
    ? el("span", { clase: "tablero-dato" }, el("span", { clase: "ocultar-movil" }, "Dato de "), `hace ${describirDuracion(m.edad_segundos)}`, el("span", { clase: "tablero-suave tablero-fecha" }, ` (${fecha(m.generado_en)}${m.hora_simulada ? ", hora simulada" : ""})`))
    : null;

  // Agentes por estado mostrado (si los datos no son vigentes, todos cuentan como "Sin información").
  const conteo = new Map();
  for (const d of m.departamentos) for (const a of d.agentes) conteo.set(a.estado_mostrado, (conteo.get(a.estado_mostrado) ?? 0) + 1);
  const agentes = [...conteo].filter(([, n]) => n > 0).map(([estado, n]) =>
    el("span", { clase: `tablero-estado ${ESTADOS[estado].clase2d}`, title: `${n} ${ESTADOS[estado].etiqueta.toLowerCase()}` },
      el("span", { clase: "etiqueta-luz", "aria-hidden": "true" }),
      // En celular se ve el icono y el número (caben todos); el texto completo queda para lectores y en el título.
      el("span", { clase: "tablero-estado-icono", "aria-hidden": "true" }, ESTADOS[estado].icono), `${n}`,
      el("span", { clase: "tablero-estado-texto" }, ` ${ESTADOS[estado].etiqueta.toLowerCase()}`)));

  const nombreDep = new Map(m.departamentos.map((d) => [d.id, d.nombre]));
  const alertas = [...m.alertas].sort((a, b) => ORDEN.indexOf(a.nivel) - ORDEN.indexOf(b.nivel));
  const vigentes = m.conexion === "en_linea";
  const listaAlertas = el("details", { "data-k": "alertas", clase: "tablero-desplegable", open: abiertos.alertas },
    el("summary", {}, `Alertas (${alertas.length})`),
    el("div", { clase: "tablero-lista" },
      vigentes || alertas.length === 0 ? null : el("p", { clase: "tablero-suave" }, "Los datos no están vigentes: estas alertas son del último archivo y pueden estar resueltas."),
      alertas.length === 0 ? el("p", { clase: "tablero-suave" }, "El archivo no trae alertas.") : null,
      ...alertas.map((a) => el("div", { clase: `tablero-alerta nivel-${a.nivel}` },
        el("span", { clase: "tablero-nivel" }, NIVELES[a.nivel] ?? a.nivel),
        el("span", {}, a.titulo),
        a.departamento_id && nombreDep.has(a.departamento_id)
          ? el("button", { type: "button", clase: "enlace", onclick: () => { listaAlertas.open = false; alElegirDepartamento(a.departamento_id); } }, nombreDep.get(a.departamento_id))
          : null))));

  const listaCambios = el("details", { "data-k": "cambios", clase: "tablero-desplegable", open: abiertos.cambios },
    el("summary", {}, "Cambios", el("span", { clase: "ocultar-movil" }, " observados"), ` (${cambios.length})`),
    el("div", { clase: "tablero-lista" },
      el("p", { clase: "tablero-suave" }, "Solo diferencias entre las lecturas que hizo esta página desde que la abriste. No es un historial: lo que cambió y regresó entre dos lecturas no aparece, y la hora exacta no se conoce."),
      cambios.length === 0 ? el("p", {}, "Sin cambios observados todavía.") : null,
      ...cambios.map((c) => el("div", { clase: "tablero-cambio" },
        el("span", { clase: "tablero-suave" }, c.entre[0] && c.entre[1] ? `Entre ${hora(c.entre[0])} y ${hora(c.entre[1])}` : "Al leer"),
        c.es_demo ? el("span", { clase: "tablero-insignia es-demo" }, "DEMO") : null,
        el("span", {}, textoCambio(c))))));

  nodo.replaceChildren(...[
    el("div", { clase: "tablero-fila" },
      insignia,
      el("strong", {}, m.conexion_etiqueta),
      edad,
      m.fuente ? el("span", { clase: "tablero-suave tablero-fuente" }, m.fuente.nombre) : null,
      el("span", { clase: "tablero-estados" }, ...agentes),
      listaAlertas,
      listaCambios),
    m.motivo ? el("span", { clase: "conexion-motivo" }, m.motivo) : null,
    m.nota_origen ? el("span", { clase: "conexion-motivo" }, m.nota_origen) : null,
  ].filter(Boolean));
}

const nombreEstado = (e) => ESTADOS[e]?.etiqueta ?? e;

export function textoCambio(c) {
  switch (c.tipo) {
    case "estado": return `${c.agente} (${c.departamento}) pasó de ${nombreEstado(c.de)} a ${nombreEstado(c.a)}.`;
    case "agente_nuevo": return `Apareció ${c.agente} en ${c.departamento} (${nombreEstado(c.a)}).`;
    case "agente_quitado": return `${c.agente} ya no aparece en ${c.departamento}.`;
    case "alerta_nueva": return `Nueva alerta: ${c.titulo}${c.departamento ? ` (${c.departamento})` : ""}.`;
    case "alerta_quitada": return `La alerta "${c.titulo}" ya no aparece en el archivo.`;
    case "fuente": return `Los datos pasaron de ${c.de} a ${c.a}: no se comparan estados entre fuentes distintas.`;
    case "conexion": return `La conexión pasó de "${c.de}" a "${c.a}".`;
    default: return "Cambio observado.";
  }
}
