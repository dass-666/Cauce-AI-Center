// Oficina Nexus (fase 1): área de supervisión dentro de Cauce AI Center. Muestra lecciones, recomendaciones,
// decisiones pendientes de una persona y alertas de evidencia. Funciona en 3D, en el plano y sin WebGL (solo HTML);
// mientras está abierta, la 3D no dibuja. Todo sale de resumirNexus(): aquí no se decide nada.
// Ningún botón aprueba, ejecuta ni cambia un proyecto. Lo único que «escribe» es una DESCARGA que la persona guarda.

import { el, fecha } from "./dom.js";
import { validarLeccion, versionDe } from "../nexus/leccion.js";
import { evaluarLeccion } from "../nexus/gerente.js";
import { agregarLeccion, registroVacio } from "../nexus/registro.js";

const DICTAMEN = {
  sin_objeciones: { texto: "Sin objeciones", titulo: "Todas las reglas se cumplen. El gerente no aprueba: decide una persona." },
  incompleto: { texto: "Incompleto", titulo: "Falta información para evaluar alguna regla. Nunca cuenta como aprobado." },
  con_objeciones: { texto: "Con objeciones", titulo: "Al menos una regla no se cumple." },
};
const VALIDACION = { propuesta: "Propuesta", en_prueba: "En prueba", validada_en_origen: "Validada en origen", validada_en_destino: "Validada en destino", refutada: "Refutada", caducada: "Caducada" };
const ICONO = { cumple: "✓", no_cumple: "✗", no_evaluado: "?" };
const RESULTADO = { cumple: "Cumple", no_cumple: "No cumple", no_evaluado: "No evaluado" };
const TIPO_AUTOR = { humano: "persona", codigo: "código", ia: "IA" };
const actor = (tipo, id) => `${TIPO_AUTOR[tipo] ?? tipo ?? "?"} ${id ?? "?"}`;

/**
 * @param nodo     contenedor (#nexus)
 * @param resumen  resultado de resumirNexus(), o null mientras carga
 * @param opciones { alCerrar(), fuente: "real"|"demo", docLecciones, ahoraMs }
 */
export function dibujarNexus(nodo, resumen, { alCerrar, fuente = "demo", docLecciones = null, ahoraMs = Date.now() }) {
  // (Las tarjetas muestran el registro tal cual; los textos entran como texto, nunca como HTML.)
  const abiertos = new Set([...nodo.querySelectorAll("details[open][data-k]")].map((d) => d.dataset.k));
  const borrador = nodo.querySelector("#nexus-borrador")?.value ?? "";
  const cabeza = el("div", { clase: "sala-cabeza" },
    el("div", {},
      el("h2", { id: "nexus-titulo", tabindex: "-1" }, "Oficina Nexus · supervisión"),
      el("p", { clase: "sala-sub" }, "Observa, conserva evidencia, detecta errores y propone. No controla motores ni toma decisiones: aprueba una persona.")),
    el("button", { type: "button", clase: "boton", onclick: alCerrar, title: "Cerrar Nexus y volver al edificio (N o Esc)" }, "Ir al edificio ›"));
  if (!resumen) { nodo.replaceChildren(cabeza, el("p", { clase: "sala-vacio" }, "Leyendo el registro de Nexus…")); return; }

  const c = resumen.cifras;
  const cifra = (v, t, clase = "") => el("div", { clase: `sala-cifra ${clase}`, role: "listitem" }, el("strong", {}, String(v)), el("span", {}, t));
  const partes = [cabeza];
  if (resumen.es_demo) partes.push(el("p", { clase: "nexus-demo", role: "note" }, el("strong", {}, "DATOS DE PRUEBA"), " · Lecciones y recomendaciones ficticias para revisar Nexus. No son conclusiones reales de ningún proyecto."));
  if (resumen.errores.length) partes.push(el("div", { clase: "nexus-errores", role: "alert" },
    el("strong", {}, `El registro tiene ${resumen.errores.length} problema(s); lo afectado no se muestra:`),
    el("ul", {}, ...resumen.errores.slice(0, 8).map((t) => el("li", {}, t)))));
  partes.push(el("div", { clase: "sala-cifras", role: "list", "aria-label": "Resumen de Nexus" },
    cifra(c.lecciones, "lecciones vigentes"),
    cifra(c.sin_objeciones, "sin objeciones", "c-real"),
    cifra(c.incompletas, "incompletas (falta información)", c.incompletas ? "c-aviso" : ""),
    cifra(c.con_objeciones, "con objeciones", c.con_objeciones ? "c-error" : ""),
    cifra(c.pendientes, "esperan decisión humana", c.pendientes ? "c-demo" : ""),
    cifra(c.aprobadas_sin_ejecutar, "aprobadas, sin ejecutar"),
    cifra(c.adoptadas, "adoptadas")));

  // Pendientes de decisión humana
  partes.push(el("section", { clase: "sala-seccion", "aria-labelledby": "nexus-pendientes" },
    el("h3", { id: "nexus-pendientes" }, `Esperan decisión humana (${resumen.pendientes.length})`),
    el("p", { clase: "sala-nota" }, "Desde aquí no se aprueba nada: la aprobación es una nueva versión firmada por una persona (ver docs/NEXUS-FASE-1.md)."),
    resumen.pendientes.length === 0 ? el("p", { clase: "sala-vacio" }, "Ninguna recomendación espera decisión.")
      : el("ul", { clase: "sala-lista" }, ...resumen.pendientes.map((x) => { const r = x.registro, b = x.evaluacion.bloqueos;
          return el("li", { clase: `sala-item ${b.length ? "nivel-advertencia" : "nivel-info"}`, "data-rec": r.id },
            el("span", { clase: "sala-nivel" }, b.length ? "Bloqueada" : "Lista para decidir"),
            el("span", { clase: "sala-item-texto" }, el("strong", {}, r.hipotesis), ` · destino ${r.destino.proyecto}/${r.destino.componente} · propone ${actor(r.historial[0]?.autor_tipo, r.historial[0]?.autor)}`,
              b.length ? el("ul", { clase: "nexus-bloqueos" }, ...b.map((t) => el("li", {}, t))) : null)); }))));

  // Alertas de evidencia
  partes.push(el("section", { clase: "sala-seccion", "aria-labelledby": "nexus-alertas" },
    el("h3", { id: "nexus-alertas" }, `Alertas de evidencia (${resumen.alertas.length})`),
    resumen.alertas.length === 0 ? el("p", { clase: "sala-vacio" }, "Ninguna regla incumplida.")
      : el("ul", { clase: "sala-lista" }, ...resumen.alertas.slice(0, 20).map((a) => el("li", { clase: "sala-item nivel-error" },
          el("span", { clase: "sala-nivel" }, `${a.regla.id} ${a.regla.nombre}`),
          el("span", { clase: "sala-item-texto" }, el("strong", {}, a.leccion_id), ` · ${a.regla.motivo}`)))),
    resumen.alertas.length > 20 ? el("p", { clase: "sala-nota" }, `Y ${resumen.alertas.length - 20} más.`) : null));

  // Lecciones
  partes.push(el("section", { clase: "sala-seccion", "aria-labelledby": "nexus-lecciones" },
    el("h3", { id: "nexus-lecciones" }, `Lecciones (${resumen.lecciones.length})`),
    el("div", { clase: "nexus-tarjetas" }, ...resumen.lecciones.map((x) => tarjetaLeccion(x, abiertos)))));

  // Recomendaciones
  partes.push(el("section", { clase: "sala-seccion", "aria-labelledby": "nexus-recomendaciones" },
    el("h3", { id: "nexus-recomendaciones" }, `Recomendaciones (${resumen.recomendaciones.length})`),
    el("p", { clase: "sala-nota" }, "Aprobada no es ejecutada, ni adoptada, ni desplegada: cada cosa se registra aparte. Con dinero o apuestas, Nexus nunca ejecuta ni adopta."),
    el("div", { clase: "nexus-tarjetas" }, ...resumen.recomendaciones.map((r) => tarjetaRecomendacion(r, abiertos)))));

  partes.push(seccionBorrador({ abiertos, borrador, resumen, fuente, docLecciones, ahoraMs }));
  nodo.replaceChildren(...partes);
}

const nodoAlias = () => document.querySelector("#nexus-alias")?.value ?? "";

function chip(estado) {
  const d = DICTAMEN[estado] ?? DICTAMEN.incompleto;
  return el("span", { clase: `nexus-chip nexus-${estado}`, title: d.titulo }, d.texto);
}

function tablaReglas(reglas) {
  return el("ul", { clase: "nexus-reglas" }, ...reglas.map((r) => el("li", { clase: `nexus-regla r-${r.estado}` },
    el("span", { clase: "nexus-icono", "aria-hidden": "true" }, ICONO[r.estado]),
    el("span", {}, el("strong", {}, `${r.id} ${r.nombre}: `), el("em", {}, r.aplica === false ? `${RESULTADO[r.estado]} (no aplica)` : RESULTADO[r.estado]), ` · ${r.motivo}`))));
}

function tarjetaLeccion(x, abiertos) {
  const l = x.leccion, e = x.evaluacion;
  return el("article", { clase: "nexus-tarjeta", "data-leccion": l.id },
    el("div", { clase: "sala-tarjeta-cabeza" }, el("h4", {}, l.hallazgo), chip(e.dictamen.estado)),
    el("p", { clase: "sala-nota" }, `${l.id} · ${l.tipo} · ${l.origen.proyecto}/${l.origen.componente} · ${actor(l.autor.tipo, l.autor.identificador)} · revisión ${versionDe(l)}${x.versiones > 1 ? ` (${x.versiones} versiones)` : ""}`),
    el("p", { clase: "nexus-nivel" }, `Estado: ${VALIDACION[l.validacion.estado] ?? l.validacion.estado} · confianza ${l.confianza.nivel} sobre ${l.confianza.objeto.replace("_", " ")} · ${l.sensibilidad}`),
    el("p", { clase: "sala-nota" }, `Muestra: ${l.muestra.n ?? l.muestra.n_rango ?? "?"} ${l.muestra.unidad}${Number.isInteger(l.muestra.n_independiente) && l.muestra.n_independiente !== l.muestra.n ? ` → ${l.muestra.n_independiente} ${l.muestra.unidad_independencia ?? ""} independientes` : ""} · ${l.muestra.naturaleza} · ${l.muestra.naturaleza_resultado} · evidencias: ${l.evidencia.length} · vigente hasta ${l.vigente_hasta}`),
    el("details", { "data-k": `reglas-${l.id}`, open: abiertos.has(`reglas-${l.id}`) }, el("summary", {}, `Reglas nexus-R 0.2 (${e.reglas.filter((r) => r.estado === "cumple").length}/10 cumplen)`), tablaReglas(e.reglas)),
    el("details", { "data-k": `rev-${l.id}`, open: abiertos.has(`rev-${l.id}`) }, el("summary", {}, `Revisiones (${l.revisiones.length})`),
      el("ol", { clase: "nexus-historial" }, ...l.revisiones.map((r) => el("li", {}, el("strong", {}, r.version), ` · ${fecha(r.fecha)} · ${actor(r.autor_tipo, r.autor)} · ${r.decision}`, el("span", { clase: "sala-suave" }, ` · ${r.justificacion}`))))));
}

function tarjetaRecomendacion(x, abiertos) {
  const r = x.registro, k = `rec-${r.id}`;
  return el("article", { clase: "nexus-tarjeta", "data-recomendacion": r.id },
    el("div", { clase: "sala-tarjeta-cabeza" }, el("h4", {}, r.hipotesis), el("span", { clase: `nexus-chip nexus-etapa-${r.estado}` }, x.situacion)),
    el("p", { clase: "sala-nota" }, `${r.id} · destino ${r.destino.proyecto}/${r.destino.componente} · lecciones: ${r.lecciones.map((c) => `${c.id} (${c.revision})`).join(", ")}`),
    r.toca_parametros_financieros || r.toca_apuestas ? el("p", { clase: "nexus-mal" }, "Toca dinero o apuestas: bloqueo absoluto de ejecución y adopción por Nexus.") : null,
    r.estado === "aprobada" ? el("p", { clase: "sala-nota" }, `Aprobada por ${r.decision_humana.responsable} el ${fecha(r.decision_humana.fecha)} · alcance: ${r.decision_humana.alcance} · vigencia: ${r.decision_humana.vigencia}`) : null,
    el("p", { clase: "sala-nota" }, `Experimento: ${r.experimento.metrica_primaria ?? "—"} · éxito: ${r.experimento.criterio_exito ?? "pendiente"} · preregistro: ${r.experimento.preregistro_ref ?? "pendiente"}`),
    el("details", { "data-k": k, open: abiertos.has(k) }, el("summary", {}, `Historial (${r.historial.length} evento${r.historial.length === 1 ? "" : "s"})`),
      el("ol", { clase: "nexus-historial" }, ...r.historial.map((h) => el("li", {}, el("strong", {}, h.evento), ` · ${fecha(h.fecha)} · ${actor(h.autor_tipo, h.autor)}`)))));
}

/** Revisar un borrador de lección pegado como JSON. Opcional: descargar el registro con la lección agregada. */
function seccionBorrador({ abiertos, borrador, resumen, fuente, docLecciones, ahoraMs }) {
  const salida = el("div", { clase: "nexus-salida", role: "status", "aria-live": "polite" });
  const area = el("textarea", { id: "nexus-borrador", rows: "8", spellcheck: "false", "aria-label": "Borrador de lección en JSON", placeholder: '{ "contrato": "cauce.leccion", "version_contrato": "0.2.0", … }' });
  area.value = borrador;
  const alias = el("input", { id: "nexus-alias", type: "text", placeholder: "tu alias (no un correo)", "aria-label": "Quién registra", value: nodoAlias() });
  const revisar = async () => {
    salida.replaceChildren();
    let v;
    try { v = JSON.parse(area.value); } catch { salida.append(el("p", { clase: "nexus-mal" }, "No es JSON válido.")); return; }
    const { errores, avisos } = validarLeccion(v);
    if (errores.length) salida.append(el("p", { clase: "nexus-mal" }, `El contrato rechaza el borrador (${errores.length}):`), el("ul", {}, ...errores.map((t) => el("li", {}, t))));
    for (const t of avisos) salida.append(el("p", { clase: "sala-nota" }, t));
    const lecciones = new Map(resumen.lecciones.map((x) => [x.leccion.id, x.leccion]));
    if (!v || typeof v !== "object") return;
    lecciones.set(v?.id, v);
    const ev = evaluarLeccion(v, { ahora: ahoraMs, lecciones });
    salida.append(el("p", {}, "Dictamen del gerente: ", chip(ev.dictamen.estado)), tablaReglas(ev.reglas));
    if (errores.length) return;
    // El registro real empieza vacío si todavía no existe; uno de prueba solo admite lecciones de prueba.
    const demo = String(v.id).startsWith("demo-");
    const base = demo === (fuente === "demo") && docLecciones ? docLecciones : registroVacio("lecciones", { es_demo: demo });
    const r = await agregarLeccion(base, { registro: v, registrado_en: new Date(ahoraMs).toISOString(), registrado_por: { tipo: "humano", identificador: alias.value.trim() } });
    if (!r.ok) { salida.append(el("p", { clase: "nexus-mal" }, `No se puede agregar al registro: ${r.errores.join(" ")}`)); return; }
    const url = URL.createObjectURL(new Blob([`${JSON.stringify(r.doc, null, 2)}\n`], { type: "application/json" }));
    salida.append(el("p", {}, el("a", { clase: "boton boton-chico", href: url, download: "lecciones.json" }, "Descargar registro con esta lección"),
      el("span", { clase: "sala-nota" }, ` Guárdalo en ${demo ? "datos/nexus/demo/" : "datos/nexus/registro/"} como lecciones.json. Incluye todo el historial anterior sin cambios.`)));
  };
  return el("details", { clase: "sala-seccion", "data-k": "borrador", open: abiertos.has("borrador") },
    el("summary", {}, el("h3", { clase: "sala-h3-linea", id: "nexus-borrador-titulo" }, "Revisar un borrador de lección")),
    el("p", { clase: "sala-nota" }, "Pega una lección (contrato cauce.leccion 0.2 del documento maestro). Se revisa aquí mismo, sin enviarla a ningún lado. Plantilla: contrato/ejemplos/nexus/leccion-plantilla.json."),
    area, el("p", {}, el("label", {}, "Registra: ", alias)), el("p", {}, el("button", { type: "button", clase: "boton boton-chico", id: "nexus-revisar", onclick: revisar }, "Revisar con el gerente")), salida);
}
