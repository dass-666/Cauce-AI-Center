// Panel de detalle: lo que se sabe (y lo que no) del departamento o personaje elegido.
// Se comparte entre la vista 2D y la futura vista 3D.

import { NATURALEZAS } from "../nucleo/naturaleza.js";
import { el, fecha } from "./dom.js";
import { describirDuracion } from "../nucleo/modelo.js";
import { ESTADOS } from "../nucleo/estados.js";
import { clasificarEvento } from "../nucleo/sala.js";
import { textoCambio } from "./tablero.js";
import { ESTADOS_ESTACION } from "../nucleo/estaciones.js";

/**
 * @param extra.historial  cambios observados en esta sesión (bitácora de la sala), del más nuevo al más viejo
 * @param extra.ahoraMs    hora de la computadora (para "reciente")
 */
export function dibujarPanel(contenedor, modelo, seleccion, alCerrar, { historial = [], ahoraMs = Date.now(), alSeleccionar = null } = {}) {
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
  const estacion = seleccion.tipo === "estacion" ? (modelo.estaciones ?? []).find((e) => e.id === seleccion.id) ?? null : null;
  if (!dep && !agente && !estacion) {
    contenedor.hidden = true;
    return;
  }
  contenedor.hidden = false;
  const cerrar = el("button", { clase: "panel-cerrar", type: "button", onclick: alCerrar, "aria-label": "Cerrar detalle" }, "×");
  const contexto = { historial, ahoraMs, alSeleccionar };
  if (estacion) { contenedor.append(cerrar, detalleEstacion(estacion, seleccion.puesto ?? null, modelo, contexto)); return; }
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

function detalleDepartamento(dep, modelo, { historial, ahoraMs, alSeleccionar }) {
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
    ...(dep.estaciones?.length ? [
      el("h3", {}, "Estaciones de trabajo"),
      el("ul", { clase: "lista" }, dep.estaciones.map((e) => el("li", {},
        alSeleccionar ? el("button", { type: "button", clase: "enlace-estacion", onclick: () => alSeleccionar({ tipo: "estacion", id: e.id }) }, e.nombre) : el("strong", {}, e.nombre),
        `: ${e.apariencia.etiqueta}${e.es_demo ? " (DEMO)" : ""}`))),
    ] : []),
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

/**
 * Detalle de una estación de trabajo (estaciones.js): qué función tiene, en qué estado está cada puesto, qué datos
 * hay y cuáles faltan, de dónde salen y el enlace con la otra oficina. Siempre dice qué es demostración y que los
 * personajes son funciones del sistema, no agentes de IA.
 */
function detalleEstacion(e, puestoId, modelo, { alSeleccionar }) {
  const dep = modelo.departamentos.find((d) => d.id === e.departamento);
  const origen = e.es_demo ? "demo" : e.vigente ? "real" : "sin";
  const insignia = el("span", { clase: `tablero-insignia ${origen === "demo" ? "es-demo" : origen === "real" ? "es-real" : ""}` }, { demo: "DEMO", real: "REAL", sin: "SIN DATOS" }[origen]);
  const filas = [
    fila("Oficina", `${modelo.proyecto.nombre} · ${dep?.nombre ?? e.departamento}`),
    fila("Función", e.funcion ?? "No descrita"),
    fila("Estado", e.apariencia.etiqueta),
  ];
  if (e.origen_funcion) filas.push(fila("De dónde sale la función", e.origen_funcion));
  if (e.contrato_origen) filas.push(fila("Contrato de origen", e.contrato_origen));
  filas.push(fila("Fuente", e.generado_en
    ? `${e.fuente?.nombre ?? "Archivo de estaciones"} · generado ${e.edad_segundos !== null ? `hace ${describirDuracion(e.edad_segundos)}` : ""}${e.hora_simulada ? " (hora simulada)" : ""}${e.vigencia_segundos ? `, vigencia ${describirDuracion(e.vigencia_segundos)}` : ""}`
    : "Sin archivo de estado de la estación"));
  if (e.motivo) filas.push(fila("Por qué no hay datos", e.motivo));
  const enlace = e.enlace ? textoEnlace(e.enlace) : null;
  return el("article", { clase: "detalle detalle-estacion" },
    el("p", { clase: "detalle-tipo" }, `${modelo.proyecto.nombre} · Estación de trabajo `, insignia),
    el("h2", {}, e.nombre),
    el("p", { clase: "etiqueta-estado estado-estacion", style: `--color-estado:#${e.apariencia.color.toString(16).padStart(6, "0")}` }, `${e.apariencia.icono} ${e.apariencia.etiqueta}`),
    el("p", { clase: "detalle-nota" }, e.apariencia.descripcion),
    el("div", { clase: "caja-aviso", role: "note" },
      el("strong", {}, "Qué representan los personajes"),
      el("p", {}, "Cada personaje es una FUNCIÓN del sistema, no un agente de IA ni un proceso encendido. Teclean solo si un proceso registrado está en curso (con evidencia); con una señal o investigación guardada consultan; sin datos vigentes la silla queda vacía.")),
    e.nota ? el("p", { clase: "detalle-nota" }, e.nota) : null,
    el("dl", { clase: "datos" }, filas),
    el("h3", {}, "Puestos"),
    el("ul", { clase: "lista lista-puestos-estacion" }, e.puestos.map((p) => el("li", { clase: p.id === puestoId ? "puesto-elegido" : "" },
      alSeleccionar ? el("button", { type: "button", clase: "enlace-estacion", onclick: () => alSeleccionar({ tipo: "estacion", id: e.id, puesto: p.id }) }, p.funcion) : el("strong", {}, p.funcion),
      p.detalle ? el("small", {}, ` (${p.detalle})`) : null,
      ` · ${p.apariencia.etiqueta}`,
      p.ultimo_estado_conocido ? el("small", {}, ` · último reportado: ${ESTADOS_ESTACION[p.ultimo_estado_conocido].etiqueta} (no confiable)`) : null,
      p.nota ? el("p", { clase: "detalle-nota" }, p.nota) : null,
      p.evidencia ? el("p", { clase: "detalle-nota" }, `Evidencia: ${p.evidencia.origen} · ${p.evidencia.referencia}${p.evidencia.observado_en ? " · " + fecha(p.evidencia.observado_en) : ""}`) : null,
      p.notas.length ? el("p", { clase: "detalle-nota" }, `Correcciones del visualizador: ${p.notas.join(" ")}`) : null))),
    el("h3", {}, "Datos disponibles"),
    e.conteos.length
      ? el("dl", { clase: "datos" }, e.conteos.map((c) => fila(c.etiqueta, `${c.valor === null ? "— (no disponible)" : c.valor}${c.nota ? " · " + c.nota : ""}`)))
      : el("p", { clase: "detalle-nota" }, "Ninguno."),
    el("h3", {}, "Datos que faltan"),
    e.datos_faltantes.length ? el("ul", { clase: "lista" }, e.datos_faltantes.map((t) => el("li", {}, t))) : el("p", { clase: "detalle-nota" }, e.vigente ? "El archivo no declara faltantes." : "Sin datos vigentes."),
    enlace ? el("h3", {}, "Relación con la otra oficina") : null,
    enlace ? el("p", { clase: `detalle-nota enlace-${e.enlace.estado}` }, enlace) : null,
    el("p", { clase: "detalle-nota" }, "Cauce solo muestra lo que el archivo registra: no evalúa oportunidades, no calcula rentabilidad y no inventa noticias, proveedores ni transferencias."),
  );
}

function textoEnlace(x) {
  const otro = x.nombre ?? x.proyecto;
  const dir = x.sentido === "salida" ? `Envía señales a ${otro}` : `Recibe señales de ${otro}`;
  if (x.estado === "confirmado") return `${dir}. Transferencia confirmada por las dos partes: ${x.confirmadas.join(", ")}.`;
  if (x.estado === "sin_confirmar") return `${dir}. Registrada solo de este lado (${x.solo_aqui.join(", ")}): sin confirmar. ${x.motivo ?? "La otra estación no registra la misma señal."}`;
  if (x.estado === "ninguno") return `${dir}. Sin transferencias registradas.`;
  return `${dir}. ${x.motivo ?? "Sin datos vigentes para comprobar el enlace."}`;
}
