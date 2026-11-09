// Oficina Nexus: área de supervisión dentro de Cauce AI Center. Muestra lecciones, candidatas fuera del almacén,
// recomendaciones, decisiones pendientes de una persona, alertas de evidencia e integridad del historial. Funciona en 3D,
// en el plano y sin WebGL (solo HTML); mientras está abierta, la 3D no dibuja. Todo sale de resumirNexus(): aquí no se decide.
// Ningún botón aprueba, ejecuta ni cambia un proyecto. Lo único que «escribe» son DESCARGAS que la persona guarda.
// Sin animaciones: la oficina debe ir bien en equipos modestos (Intel UHD).

import { el, fecha } from "./dom.js";
import { validarLeccion, versionDe } from "../nexus/leccion.js";
import { evaluarLeccion } from "../nexus/gerente.js";
import { agregarLeccion, registroVacio, admisionReal } from "../nexus/registro.js";
import { sellar, anclaDe } from "../nexus/integridad.js";
import { etiquetaIdentidad } from "../nexus/identidad.js";

const DICTAMEN = {
  sin_objeciones: { texto: "Sin objeciones", titulo: "Todas las reglas pertinentes se cumplen. El gerente no aprueba: decide una persona." },
  incompleto: { texto: "Incompleto", titulo: "Falta información para evaluar alguna regla. Nunca cuenta como aprobado." },
  con_objeciones: { texto: "Con objeciones", titulo: "Al menos una regla no se cumple." },
};
const VALIDACION = { propuesta: "Propuesta", en_prueba: "En prueba", validada_en_origen: "Validada en origen", validada_en_destino: "Validada en destino", refutada: "Refutada", caducada: "Caducada" };
const ICONO = { cumple: "✓", no_cumple: "✗", no_evaluado: "?", no_aplica: "–" };
const RESULTADO = { cumple: "Cumple", no_cumple: "No cumple", no_evaluado: "No evaluado" };
const TIPO_AUTOR = { humano: "persona", codigo: "código", ia: "IA" };
const INTEGRIDAD = {
  integro: ["Íntegro", "El almacén coincide con el último sello del manifiesto."],
  sin_sellar: ["Sin sellar", "Hay entradas posteriores al último sello: falta sellar (no es una alteración)."],
  sin_manifiesto: ["Sin manifiesto", "No se puede detectar si faltan entradas al final."],
  truncado: ["TRUNCADO", "Faltan entradas que el manifiesto había sellado."],
  reescrito: ["REESCRITO", "Una entrada sellada cambió."],
  manifiesto_alterado: ["MANIFIESTO ALTERADO", "El propio manifiesto no es una cadena válida."],
  registro_alterado: ["REGISTRO ALTERADO", "La cadena de huellas del registro está rota."],
};
const actor = (tipo, id) => `${TIPO_AUTOR[tipo] ?? tipo ?? "?"} ${id ?? "?"}`;
/** Filtros de la persona: se conservan entre redibujos (no se guardan en ningún lado). */
const filtros = { proyecto: "", dictamen: "", confianza: "" };

/**
 * @param nodo     contenedor (#nexus)
 * @param resumen  resultado de resumirNexus(), o null mientras carga
 * @param opciones { alCerrar(), fuente: "real"|"demo", docLecciones, docsRegistro, manifiesto, integridad, candidatas[], ahoraMs }
 */
export function dibujarNexus(nodo, resumen, { alCerrar, fuente = "demo", docLecciones = null, docsRegistro = null, manifiesto = null, integridad = null, candidatas = [], ahoraMs = Date.now() }) {
  // (Las tarjetas muestran el registro tal cual; los textos entran como texto, nunca como HTML.)
  const abiertos = new Set([...nodo.querySelectorAll("details[open][data-k]")].map((d) => d.dataset.k));
  const borrador = nodo.querySelector("#nexus-borrador")?.value ?? "";
  const cabeza = el("div", { clase: "sala-cabeza" },
    el("div", {},
      el("h2", { id: "nexus-titulo", tabindex: "-1" }, "Oficina Nexus · supervisión"),
      el("p", { clase: "sala-sub" }, "Observa, conserva evidencia, detecta errores y propone. No controla motores ni toma decisiones: aprueba una persona.")),
    el("button", { type: "button", clase: "boton", onclick: alCerrar, title: "Cerrar Nexus y volver al edificio (N o Esc)" }, "‹ Volver a oficinas"));
  if (!resumen) { nodo.replaceChildren(cabeza, el("p", { clase: "sala-vacio" }, "Leyendo el registro de Nexus…")); return; }

  const c = resumen.cifras;
  const redibujar = () => dibujarNexus(nodo, resumen, { alCerrar, fuente, docLecciones, docsRegistro, manifiesto, integridad, candidatas, ahoraMs });
  const cifra = (v, t, clase = "", filtro = null) => el(filtro ? "button" : "div", { type: filtro ? "button" : null, clase: `sala-cifra ${clase}${filtro && filtros.dictamen === filtro ? " nexus-activo" : ""}`, role: filtro ? null : "listitem", "data-filtro-cifra": filtro,
    title: filtro ? "Mostrar solo estas lecciones (otra vez para quitar el filtro)" : null, "aria-pressed": filtro ? String(filtros.dictamen === filtro) : null,
    onclick: filtro ? () => { filtros.dictamen = filtros.dictamen === filtro ? "" : filtro; redibujar(); } : null }, el("strong", {}, String(v)), el("span", {}, t));
  const partes = [cabeza];

  // Fuente: DEMO o REAL, imposible de confundir.
  partes.push(fuente === "real"
    ? el("p", { clase: "nexus-fuente nexus-fuente-real", role: "note", "data-fuente": "real" }, el("strong", {}, "REAL"), " · Almacén local de Nexus (datos/nexus/registro/). Identidades declaradas, sin autenticar.")
    : el("p", { clase: "nexus-fuente nexus-fuente-demo nexus-demo", role: "note", "data-fuente": "demo" }, el("strong", {}, "DEMO · DATOS DE PRUEBA"), " · Lecciones y recomendaciones ficticias para revisar Nexus. No son conclusiones reales de ningún proyecto. El almacén real está vacío."));
  if (integridad) {
    const [t, d] = INTEGRIDAD[integridad.estado] ?? [integridad.estado, ""];
    partes.push(el("p", { clase: `nexus-integridad ${integridad.ok ? "" : "nexus-mal"}`, "data-integridad": integridad.estado },
      el("strong", {}, `Integridad del historial: ${t}`), ` · ${d}`, integridad.ancla ? ` Ancla: ${integridad.ancla}.` : "",
      integridad.detalles.length ? el("ul", {}, ...integridad.detalles.slice(0, 6).map((x) => el("li", {}, x))) : null));
  }
  if (resumen.errores.length) partes.push(el("div", { clase: "nexus-errores", role: "alert" },
    el("strong", {}, `El registro tiene ${resumen.errores.length} problema(s); lo afectado no se muestra:`),
    el("ul", {}, ...resumen.errores.slice(0, 8).map((t) => el("li", {}, t)))));
  const sinRevision = resumen.lecciones.filter((x) => x.evaluacion.reglas.find((r) => r.id === "R01")?.estado !== "cumple").length;
  partes.push(el("div", { clase: "sala-cifras", role: "list", "aria-label": "Resumen de Nexus" },
    cifra(c.lecciones, "lecciones registradas"),
    cifra(c.sin_objeciones, "sin objeciones", "c-real", "sin_objeciones"),
    cifra(c.incompletas, "incompletas (falta información)", c.incompletas ? "c-aviso" : "", "incompleto"),
    cifra(c.con_objeciones, "con objeciones", c.con_objeciones ? "c-error" : "", "con_objeciones"),
    cifra(sinRevision, "sin revisión humana independiente", sinRevision ? "c-aviso" : ""),
    cifra(candidatas.length, "candidatas fuera del almacén", candidatas.length ? "c-demo" : ""),
    cifra(c.pendientes, "recomendaciones esperan decisión humana", c.pendientes ? "c-demo" : ""),
    cifra(c.aprobadas_sin_ejecutar, "aprobadas, sin ejecutar"),
    cifra(c.adoptadas, "adoptadas")));

  // Pendientes de decisión humana
  partes.push(el("section", { clase: "sala-seccion", "aria-labelledby": "nexus-pendientes" },
    el("h3", { id: "nexus-pendientes" }, `Esperan decisión humana (${resumen.pendientes.length})`),
    el("p", { clase: "sala-nota" }, "Desde aquí no se aprueba nada. Sin autenticación, una aprobación es una versión nueva registrada por un aprobador declarado (datos/nexus/politica.json), con fecha, decisión y motivo, por la línea de comandos. Aprobar no ejecuta nada."),
    resumen.pendientes.length === 0 ? el("p", { clase: "sala-vacio" }, "Ninguna recomendación espera decisión.")
      : el("ul", { clase: "sala-lista" }, ...resumen.pendientes.map((x) => { const r = x.registro, b = x.evaluacion.bloqueos;
          return el("li", { clase: `sala-item ${b.length ? "nivel-advertencia" : "nivel-info"}`, "data-rec": r.id },
            el("span", { clase: "sala-nivel" }, b.length ? "Bloqueada" : "Lista para decidir"),
            el("span", { clase: "sala-item-texto" }, el("strong", {}, r.hipotesis), ` · destino ${r.destino.proyecto}/${r.destino.componente} · propone ${actor(r.historial[0]?.autor_tipo, r.historial[0]?.autor)}`,
              b.length ? el("ul", { clase: "nexus-bloqueos" }, ...b.map((t) => el("li", {}, t))) : el("p", { clase: "sala-nota" }, "Falta: la decisión de una persona aprobadora (identidad declarada)."))); }))));

  // Alertas de evidencia
  partes.push(el("section", { clase: "sala-seccion", "aria-labelledby": "nexus-alertas" },
    el("h3", { id: "nexus-alertas" }, `Alertas de evidencia (${resumen.alertas.length})`),
    resumen.alertas.length === 0 ? el("p", { clase: "sala-vacio" }, "Ninguna regla incumplida.")
      : el("ul", { clase: "sala-lista" }, ...resumen.alertas.slice(0, 20).map((a) => el("li", { clase: "sala-item nivel-error" },
          el("span", { clase: "sala-nivel" }, `${a.regla.id} ${a.regla.nombre}`),
          el("span", { clase: "sala-item-texto" }, el("strong", {}, a.leccion_id), ` · ${a.regla.motivo}`)))),
    resumen.alertas.length > 20 ? el("p", { clase: "sala-nota" }, `Y ${resumen.alertas.length - 20} más.`) : null));

  // Lecciones, con filtros
  const visibles = resumen.lecciones.filter((x) => (!filtros.proyecto || x.leccion.origen.proyecto === filtros.proyecto)
    && (!filtros.dictamen || x.evaluacion.dictamen.estado === filtros.dictamen) && (!filtros.confianza || x.leccion.confianza.nivel === filtros.confianza));
  partes.push(el("section", { clase: "sala-seccion", "aria-labelledby": "nexus-lecciones" },
    el("h3", { id: "nexus-lecciones" }, `Lecciones (${visibles.length}${visibles.length !== resumen.lecciones.length ? ` de ${resumen.lecciones.length}` : ""})`),
    barraFiltros(resumen, redibujar),
    visibles.length ? el("div", { clase: "nexus-tarjetas" }, ...visibles.map((x) => tarjetaLeccion(x, abiertos))) : el("p", { clase: "sala-vacio" }, "Ninguna lección con estos filtros.")));

  // Candidatas fuera del almacén
  if (candidatas.length) partes.push(el("section", { clase: "sala-seccion", "aria-labelledby": "nexus-candidatas" },
    el("h3", { id: "nexus-candidatas" }, `Candidatas fuera del almacén (${candidatas.length})`),
    el("p", { clase: "sala-nota" }, "Borradores de lecciones reales que todavía NO entran al almacén: les falta evidencia primaria verificable y una revisión humana independiente. No cuentan en ninguna cifra."),
    el("div", { clase: "nexus-tarjetas" }, ...candidatas.map((x) => tarjetaCandidata(x, abiertos)))));

  // Recomendaciones
  partes.push(el("section", { clase: "sala-seccion", "aria-labelledby": "nexus-recomendaciones" },
    el("h3", { id: "nexus-recomendaciones" }, `Recomendaciones (${resumen.recomendaciones.length})`),
    el("p", { clase: "sala-nota" }, "Aprobada no es ejecutada, ni adoptada, ni desplegada: cada cosa se registra aparte. Con dinero o apuestas, Nexus nunca ejecuta ni adopta."),
    el("div", { clase: "nexus-tarjetas" }, ...resumen.recomendaciones.map((r) => tarjetaRecomendacion(r, abiertos)))));

  partes.push(seccionImportar({ abiertos, borrador, resumen, fuente, docLecciones, docsRegistro, manifiesto, ahoraMs }));
  nodo.replaceChildren(...partes);
}

function barraFiltros(resumen, redibujar) {
  const opciones = (clave, lista, rotulo) => el("label", {}, `${rotulo} `,
    el("select", { "data-filtro": clave, onchange: (e) => { filtros[clave] = e.target.value; redibujar(); } },
      el("option", { value: "" }, "todos"), ...lista.map(([v, t]) => el("option", { value: v, selected: filtros[clave] === v }, t))));
  const proyectos = [...new Set(resumen.lecciones.map((x) => x.leccion.origen.proyecto))].sort().map((p) => [p, p]);
  return el("div", { clase: "nexus-filtros", role: "group", "aria-label": "Filtrar lecciones" },
    opciones("proyecto", proyectos, "Proyecto"),
    opciones("dictamen", Object.entries(DICTAMEN).map(([k, v]) => [k, v.texto]), "Estado"),
    opciones("confianza", [["baja", "baja"], ["media", "media"], ["alta", "alta"]], "Confianza"),
    filtros.proyecto || filtros.dictamen || filtros.confianza ? el("button", { type: "button", clase: "boton boton-chico", "data-quitar-filtros": "", onclick: () => { Object.assign(filtros, { proyecto: "", dictamen: "", confianza: "" }); redibujar(); } }, "Quitar filtros") : null);
}

const nodoAlias = () => document.querySelector("#nexus-alias")?.value ?? "";

function chip(estado) {
  const d = DICTAMEN[estado] ?? DICTAMEN.incompleto;
  return el("span", { clase: `nexus-chip nexus-${estado}`, title: d.titulo }, d.texto);
}

function tablaReglas(reglas) {
  return el("ul", { clase: "nexus-reglas" }, ...reglas.map((r) => {
    const na = r.aplica === false && r.estado === "cumple";
    return el("li", { clase: `nexus-regla r-${na ? "no_aplica" : r.estado}` },
      el("span", { clase: "nexus-icono", "aria-hidden": "true" }, ICONO[na ? "no_aplica" : r.estado]),
      el("span", {}, el("strong", {}, `${r.id} ${r.nombre}: `), el("em", {}, na ? "No aplica (justificado)" : RESULTADO[r.estado]), ` · ${r.motivo}`));
  }));
}

/** «Qué falta»: lo que impide el dictamen sin objeciones, en lenguaje directo. */
function queFalta(e) {
  const malas = e.reglas.filter((r) => r.estado !== "cumple");
  if (!malas.length) return null;
  return el("div", { clase: "nexus-falta" }, el("strong", {}, "Qué falta o qué se objeta:"),
    el("ul", {}, ...malas.map((r) => el("li", {}, `${r.estado === "no_cumple" ? "✗" : "?"} ${r.id}: ${r.motivo}`))));
}

function resumenReglas(e) {
  const d = e.dictamen;
  return `Reglas nexus-R 0.2 (${d.cumplen} cumplen${d.no_aplica.length ? ` · ${d.no_aplica.length} no aplican` : ""}${d.no_evaluado.length ? ` · ${d.no_evaluado.length} sin evaluar` : ""}${d.no_cumple.length ? ` · ${d.no_cumple.length} no cumplen` : ""})`;
}

function listaEvidencia(l) {
  return el("ol", { clase: "nexus-historial nexus-evidencia" }, ...l.evidencia.map((x) => el("li", {},
    el("strong", {}, x.tipo), ` · ${x.referencia}`,
    el("span", { clase: "sala-suave" }, ` · ${x.ubicacion}${x.commit ? ` · commit ${String(x.commit).slice(0, 10)}` : ""}${x.sha256 ? ` · sha256 ${x.sha256.slice(0, 12)}…` : ""} · observado ${x.observado_en ? fecha(x.observado_en) : "sin dato"} · conocido ${x.conocido_en ? fecha(x.conocido_en) : "sin dato"} (${x.base_conocimiento}) · ejecutó ${x.proyecto_ejecutor} · ${x.reproduccion_independiente ? `reproducida por ${x.reproduccion_independiente.quien}` : x.reproducible_declarado ? "reproducible solo declarado, no reproducido" : "no reproducible declarado"}`))));
}

function cuerpoLeccion(l, e, abiertos, k) {
  return [
    el("p", { clase: "nexus-nivel" }, `Estado: ${VALIDACION[l.validacion.estado] ?? l.validacion.estado} · confianza ${l.confianza.nivel} sobre ${l.confianza.objeto.replace("_", " ")} · ${l.sensibilidad}`),
    el("p", { clase: "sala-nota" }, `Muestra: ${l.muestra.n ?? l.muestra.n_rango ?? "?"} ${l.muestra.unidad}${Number.isInteger(l.muestra.n_independiente) && l.muestra.n_independiente !== l.muestra.n ? ` → ${l.muestra.n_independiente} ${l.muestra.unidad_independencia ?? ""} independientes` : ""} · ${l.muestra.naturaleza} · ${l.muestra.naturaleza_resultado} · evidencias: ${l.evidencia.length} · vigente hasta ${l.vigente_hasta}`),
    queFalta(e),
    el("details", { "data-k": `reglas-${k}`, open: abiertos.has(`reglas-${k}`) }, el("summary", {}, resumenReglas(e)), tablaReglas(e.reglas)),
    el("details", { "data-k": `ev-${k}`, open: abiertos.has(`ev-${k}`) }, el("summary", {}, `Evidencia (${l.evidencia.length})`), listaEvidencia(l),
      l.limitaciones.length ? el("ul", { clase: "nexus-bloqueos" }, ...l.limitaciones.map((t) => el("li", {}, t))) : null),
    el("details", { "data-k": `rev-${k}`, open: abiertos.has(`rev-${k}`) }, el("summary", {}, `Revisiones (${l.revisiones.length})`),
      el("ol", { clase: "nexus-historial" }, ...l.revisiones.map((r) => el("li", {}, el("strong", {}, r.version), ` · ${fecha(r.fecha)} · ${actor(r.autor_tipo, r.autor)} · ${r.decision}`, el("span", { clase: "sala-suave" }, ` · ${r.justificacion}`))))),
  ];
}

function tarjetaLeccion(x, abiertos) {
  const l = x.leccion, e = x.evaluacion;
  return el("article", { clase: "nexus-tarjeta", "data-leccion": l.id },
    el("div", { clase: "sala-tarjeta-cabeza" }, el("h4", {}, l.hallazgo), chip(e.dictamen.estado)),
    el("p", { clase: "sala-nota" }, `${l.id} · ${l.tipo} · ${l.origen.proyecto}/${l.origen.componente} · ${actor(l.autor.tipo, l.autor.identificador)} · revisión ${versionDe(l)}${x.versiones > 1 ? ` (${x.versiones} versiones)` : ""}`),
    ...cuerpoLeccion(l, e, abiertos, l.id));
}

function tarjetaCandidata(x, abiertos) {
  const l = x.leccion, e = x.evaluacion;
  return el("article", { clase: "nexus-tarjeta nexus-candidata", "data-candidata": l.id },
    el("div", { clase: "sala-tarjeta-cabeza" }, el("h4", {}, l.hallazgo), el("span", { clase: "nexus-chip nexus-chip-candidata" }, "Candidata · no registrada")),
    el("p", { clase: "sala-nota" }, `${l.id} · ${l.origen.proyecto} · ${actor(l.autor.tipo, l.autor.identificador)} · ${x.archivo} · dictamen: `, chip(e.dictamen.estado)),
    el("div", { clase: "nexus-falta" }, el("strong", {}, "Por qué no entra al almacén real:"), el("ul", {}, ...x.admision.motivos.map((t) => el("li", {}, t)))),
    ...cuerpoLeccion(l, e, abiertos, `cand-${l.id}`));
}

function tarjetaRecomendacion(x, abiertos) {
  const r = x.registro, k = `rec-${r.id}`;
  return el("article", { clase: "nexus-tarjeta", "data-recomendacion": r.id },
    el("div", { clase: "sala-tarjeta-cabeza" }, el("h4", {}, r.hipotesis), el("span", { clase: `nexus-chip nexus-etapa-${r.estado}` }, x.situacion)),
    el("p", { clase: "sala-nota" }, `${r.id} · destino ${r.destino.proyecto}/${r.destino.componente} · lecciones: ${r.lecciones.map((c) => `${c.id} (${c.revision})`).join(", ")}`),
    r.toca_parametros_financieros || r.toca_apuestas ? el("p", { clase: "nexus-mal" }, "Toca dinero o apuestas: bloqueo absoluto de ejecución y adopción por Nexus.") : null,
    r.estado === "aprobada" ? el("p", { clase: "sala-nota" }, `Aprobada por ${etiquetaIdentidad({ identificador: r.decision_humana.responsable })} el ${fecha(r.decision_humana.fecha)} · alcance: ${r.decision_humana.alcance} · vigencia: ${r.decision_humana.vigencia}${r.historial.at(-1)?.motivo ? ` · motivo: ${r.historial.at(-1).motivo}` : ""}`) : null,
    r.estado === "aprobada" && r.ejecucion.estado === "no_iniciada" ? el("p", { clase: "sala-nota" }, "Aprobada no significa ejecutada: Nexus no ejecuta. Si alguien la ejecuta fuera, se registra aparte con su evidencia.") : null,
    el("p", { clase: "sala-nota" }, `Experimento: ${r.experimento.metrica_primaria ?? "—"} · éxito: ${r.experimento.criterio_exito ?? "pendiente"} · preregistro: ${r.experimento.preregistro_ref ?? "pendiente"}`),
    el("details", { "data-k": k, open: abiertos.has(k) }, el("summary", {}, `Historial (${r.historial.length} evento${r.historial.length === 1 ? "" : "s"})`),
      el("ol", { clase: "nexus-historial" }, ...r.historial.map((h) => el("li", {}, el("strong", {}, h.evento), ` · ${fecha(h.fecha)} · ${actor(h.autor_tipo, h.autor)}${h.motivo ? ` · ${h.motivo}` : ""}`)))));
}

const descarga = (doc, nombre, texto) => el("a", { clase: "boton boton-chico", href: URL.createObjectURL(new Blob([`${JSON.stringify(doc, null, 2)}\n`], { type: "application/json" })), download: nombre }, texto);

/** Importación manual: vista previa (contrato, gerente y admisión al almacén real) y, si se admite, descargas. */
function seccionImportar({ abiertos, borrador, resumen, fuente, docLecciones, docsRegistro, manifiesto, ahoraMs }) {
  const salida = el("div", { clase: "nexus-salida", role: "status", "aria-live": "polite" });
  const area = el("textarea", { id: "nexus-borrador", rows: "8", spellcheck: "false", "aria-label": "Lección en JSON", placeholder: '{ "id": "…", "esquema": "cauce.leccion", "version_esquema": "0.2", … }' });
  area.value = borrador;
  const archivo = el("input", { type: "file", accept: ".json,application/json", id: "nexus-archivo", "aria-label": "Elegir archivo JSON de lección",
    onchange: async (e) => { const f = e.target.files?.[0]; if (f) { area.value = await f.text(); revisar(); } } });
  const alias = el("input", { id: "nexus-alias", type: "text", placeholder: "tu alias (no un correo)", "aria-label": "Quién registra", value: nodoAlias() });
  const revisar = async () => {
    salida.replaceChildren();
    let v;
    try { v = JSON.parse(area.value); } catch { salida.append(el("p", { clase: "nexus-mal" }, "No es JSON válido.")); return; }
    if (!v || typeof v !== "object") return;
    const demo = String(v.id).startsWith("demo-");
    salida.append(el("p", { clase: "sala-nota" }, `Vista previa · destino: almacén ${demo ? "de PRUEBA (id «demo-»)" : "REAL"}. Nada se envía ni se guarda solo.`));
    const { errores, avisos } = validarLeccion(v);
    if (errores.length) salida.append(el("p", { clase: "nexus-mal" }, `El contrato rechaza el borrador (${errores.length}):`), el("ul", {}, ...errores.map((t) => el("li", {}, t))));
    for (const t of avisos) salida.append(el("p", { clase: "sala-nota" }, t));
    const lecciones = new Map(resumen.lecciones.map((x) => [x.leccion.id, x.leccion]));
    lecciones.set(v?.id, v);
    const ev = evaluarLeccion(v, { ahora: ahoraMs, lecciones });
    salida.append(el("p", {}, "Dictamen del gerente: ", chip(ev.dictamen.estado), " (registrar no es validar)"), tablaReglas(ev.reglas));
    if (errores.length) return;
    const quien = alias.value.trim();
    if (!quien) { salida.append(el("p", { clase: "nexus-mal" }, "Falta tu alias en «Registra» (identidad declarada): sin él no se prepara la descarga.")); return; }
    const mismoAlmacen = demo === (fuente === "demo");
    const base = mismoAlmacen && docLecciones ? docLecciones : registroVacio("lecciones", { es_demo: demo });
    if (!demo && !(mismoAlmacen && base.entradas.some((e) => e.registro?.id === v.id))) {
      const a = admisionReal(v, { ahora: ahoraMs, lecciones: new Map(base.entradas.map((e) => [e.registro?.id, e.registro])), registrado_por: { tipo: "humano", identificador: quien } });
      salida.append(el("div", { clase: a.admisible ? "nexus-admision nexus-admite" : "nexus-admision nexus-falta", "data-admision": a.admisible ? "si" : "no" },
        el("strong", {}, a.admisible ? "Admisión al almacén real: SÍ" : "Admisión al almacén real: NO · se queda como candidata fuera del almacén"),
        el("ul", {}, ...(a.admisible ? a.cumple : a.motivos).map((t) => el("li", {}, t)))));
      if (!a.admisible) return;
    }
    const sobre = { registro: v, registrado_en: new Date(ahoraMs).toISOString(), registrado_por: { tipo: "humano", identificador: quien } };
    const r = await agregarLeccion(base, sobre);
    if (!r.ok) { salida.append(el("p", { clase: "nexus-mal" }, `No se puede agregar al registro: ${r.errores.join(" ")}`)); return; }
    const docsNuevos = { lecciones: r.doc, recomendaciones: (mismoAlmacen && docsRegistro?.recomendaciones) || registroVacio("recomendaciones", { es_demo: demo }) };
    const s = await sellar(mismoAlmacen ? manifiesto : null, docsNuevos, { sellado_en: sobre.registrado_en, sellado_por: sobre.registrado_por });
    const carpeta = demo ? "datos/nexus/demo/" : "datos/nexus/registro/";
    salida.append(el("p", {}, descarga(r.doc, "lecciones.json", "Descargar registro con esta lección"), " ",
      s.ok ? descarga(s.doc, "manifiesto.json", "Descargar manifiesto sellado") : el("span", { clase: "nexus-mal" }, ` No se pudo sellar: ${s.errores.join(" ")}`)),
      el("p", { clase: "sala-nota" }, `Antes de reemplazar, copia ${carpeta} completo a un respaldo. Guarda ambos archivos en ${carpeta}. El historial anterior va sin cambios.${s.ok ? ` Nueva ancla (anótala fuera del equipo): ` : ""}`, s.ok ? el("strong", { "data-ancla": "" }, await anclaDe(s.doc)) : null));
  };
  return el("details", { clase: "sala-seccion", "data-k": "borrador", open: abiertos.has("borrador") },
    el("summary", {}, el("h3", { clase: "sala-h3-linea", id: "nexus-borrador-titulo" }, "Importar una lección (vista previa)")),
    el("p", { clase: "sala-nota" }, "Pega o elige una lección (contrato cauce.leccion 0.2). Se revisa aquí mismo, sin enviarla a ningún lado. Al almacén real solo entra si cumple el contrato, trae evidencia primaria con commit o huella y una revisión humana de alguien distinto del autor. Con Node, lo mismo hace «node herramientas/nexus.mjs importar <archivo> --por=alias» (y --confirmar respalda y sella)."),
    el("p", {}, archivo), area, el("p", {}, el("label", {}, "Registra: ", alias)), el("p", {}, el("button", { type: "button", clase: "boton boton-chico", id: "nexus-revisar", onclick: revisar }, "Revisar con el gerente")), salida);
}
