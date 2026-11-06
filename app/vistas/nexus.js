// Oficina Nexus (fase 1): área de supervisión dentro de Cauce AI Center. Muestra lecciones, recomendaciones,
// decisiones pendientes de una persona y alertas de evidencia. Funciona en 3D, en el plano y sin WebGL (solo HTML);
// mientras está abierta, la 3D no dibuja. Todo sale de resumirNexus(): aquí no se decide nada.
// Ningún botón aprueba, ejecuta ni cambia un proyecto. Lo único que «escribe» es una DESCARGA que la persona guarda.

import { el, fecha } from "./dom.js";
import { ETIQUETA_ETAPA } from "../nexus/recomendacion.js";
import { validarLeccion } from "../nexus/leccion.js";
import { evaluarLeccion } from "../nexus/gerente.js";
import { agregarLeccion, registroVacio } from "../nexus/registro.js";

const DICTAMEN = {
  sin_objeciones: { texto: "Sin objeciones", titulo: "Todas las reglas se cumplen. El gerente no aprueba: decide una persona." },
  incompleto: { texto: "Incompleto", titulo: "Falta información para evaluar alguna regla. Nunca cuenta como aprobado." },
  con_objeciones: { texto: "Con objeciones", titulo: "Al menos una regla no se cumple." },
};
const NIVEL = { hipotesis: "Hipótesis", validada_en_origen: "Validada en su origen", validada_independiente_en_destino: "Validada en destino (independiente)" };
const ICONO = { cumple: "✓", no_cumple: "✗", no_evaluado: "?" };
const RESULTADO = { cumple: "Cumple", no_cumple: "No cumple", no_evaluado: "No evaluado" };
const EVENTO = { propuesta: "Propuesta", correccion: "Corrección", revision: "Revisión", aprobacion: "Aprobación humana", rechazo: "Rechazo", experimento: "Experimento", resultado: "Resultado", adopcion: "Adopción", despliegue: "Despliegue", retiro: "Retiro" };
const actor = (a) => (a ? `${a.tipo === "ia" ? "IA" : a.tipo === "proceso" ? "proceso" : "persona"} ${a.id}` : "—");

/**
 * @param nodo     contenedor (#nexus)
 * @param resumen  resultado de resumirNexus(), o null mientras carga
 * @param opciones { alCerrar(), fuente: "real"|"demo", docLecciones, ahoraMs }
 */
export function dibujarNexus(nodo, resumen, { alCerrar, fuente = "demo", docLecciones = null, ahoraMs = Date.now() }) {
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
    cifra(c.aprobadas_sin_implementar, "aprobadas, sin implementar"),
    cifra(c.desplegadas, "desplegadas")));

  // Pendientes de decisión humana
  partes.push(el("section", { clase: "sala-seccion", "aria-labelledby": "nexus-pendientes" },
    el("h3", { id: "nexus-pendientes" }, `Esperan decisión humana (${resumen.pendientes.length})`),
    el("p", { clase: "sala-nota" }, "Desde aquí no se aprueba nada: la aprobación es un evento que registra una persona (ver docs/NEXUS-FASE-1.md)."),
    resumen.pendientes.length === 0 ? el("p", { clase: "sala-vacio" }, "Ninguna recomendación espera decisión.")
      : el("ul", { clase: "sala-lista" }, ...resumen.pendientes.map((r) => el("li", { clase: `sala-item ${r.bloqueos.length ? "nivel-advertencia" : "nivel-info"}`, "data-rec": r.id },
          el("span", { clase: "sala-nivel" }, r.bloqueos.length ? "Bloqueada" : "Lista para decidir"),
          el("span", { clase: "sala-item-texto" }, el("strong", {}, r.contenido?.titulo ?? r.id), ` · destino ${r.contenido?.proyecto_destino ?? "?"} · propone ${actor(r.proponente)}`,
            r.bloqueos.length ? el("ul", { clase: "nexus-bloqueos" }, ...r.bloqueos.map((b) => el("li", {}, b))) : null))))));

  // Alertas de evidencia
  partes.push(el("section", { clase: "sala-seccion", "aria-labelledby": "nexus-alertas" },
    el("h3", { id: "nexus-alertas" }, `Alertas de evidencia (${resumen.alertas.length})`),
    resumen.alertas.length === 0 ? el("p", { clase: "sala-vacio" }, "Ninguna regla incumplida.")
      : el("ul", { clase: "sala-lista" }, ...resumen.alertas.slice(0, 20).map((a) => el("li", { clase: "sala-item nivel-error" },
          el("span", { clase: "sala-nivel" }, `${a.regla.id} ${a.regla.nombre}`),
          el("span", { clase: "sala-item-texto" }, el("strong", {}, a.titulo), ` · ${a.regla.explicacion}`)))),
    resumen.alertas.length > 20 ? el("p", { clase: "sala-nota" }, `Y ${resumen.alertas.length - 20} más.`) : null));

  // Lecciones
  partes.push(el("section", { clase: "sala-seccion", "aria-labelledby": "nexus-lecciones" },
    el("h3", { id: "nexus-lecciones" }, `Lecciones (${resumen.lecciones.length})`),
    el("div", { clase: "nexus-tarjetas" }, ...resumen.lecciones.map((x) => tarjetaLeccion(x, abiertos)))));

  // Recomendaciones
  partes.push(el("section", { clase: "sala-seccion", "aria-labelledby": "nexus-recomendaciones" },
    el("h3", { id: "nexus-recomendaciones" }, `Recomendaciones (${resumen.recomendaciones.length})`),
    el("p", { clase: "sala-nota" }, "Aprobada no es implementada: cada paso (experimento, resultado, adopción, despliegue) necesita su propio registro."),
    el("div", { clase: "nexus-tarjetas" }, ...resumen.recomendaciones.map((r) => tarjetaRecomendacion(r, abiertos)))));

  partes.push(seccionBorrador({ abiertos, borrador, resumen, fuente, docLecciones, ahoraMs }));
  nodo.replaceChildren(...partes);
}

function chip(estado) {
  const d = DICTAMEN[estado] ?? DICTAMEN.incompleto;
  return el("span", { clase: `nexus-chip nexus-${estado}`, title: d.titulo }, d.texto);
}

function tablaReglas(reglas) {
  return el("ul", { clase: "nexus-reglas" }, ...reglas.map((r) => el("li", { clase: `nexus-regla r-${r.resultado}` },
    el("span", { clase: "nexus-icono", "aria-hidden": "true" }, ICONO[r.resultado]),
    el("span", {}, el("strong", {}, `${r.id} ${r.nombre}: `), el("em", {}, RESULTADO[r.resultado]), ` · ${r.explicacion}`))));
}

function tarjetaLeccion(x, abiertos) {
  const l = x.leccion, e = x.evaluacion;
  const distinto = e.nivel_declarado && e.nivel_declarado !== e.nivel_sustentado;
  return el("article", { clase: `nexus-tarjeta${x.retirada ? " nexus-retirada" : ""}`, "data-leccion": l.id },
    el("div", { clase: "sala-tarjeta-cabeza" }, el("h4", {}, l.titulo), x.retirada ? el("span", { clase: "nexus-chip" }, "Retirada") : chip(e.dictamen.estado)),
    el("p", { clase: "sala-nota" }, `${l.proyecto_origen}${l.proyectos_destino.length ? ` → ${l.proyectos_destino.join(", ")}` : ""} · ${l.naturaleza_resultado} · rev. ${l.revision}${x.revisiones > 1 ? ` de ${x.revisiones}` : ""} · ${actor(l.autor_conclusion)}`),
    el("p", { clase: "nexus-nivel" }, `Declara: ${NIVEL[l.nivel_validacion]}`, distinto ? el("strong", { clase: "nexus-sostiene" }, ` · lo registrado sostiene: ${NIVEL[e.nivel_sustentado]}`) : " · sustentado"),
    el("p", { clase: "nexus-enunciado" }, l.enunciado),
    el("p", { clase: "sala-nota" }, `Evidencias: ${l.evidencias.length}${l.declara_reproducible === true ? " · declara reproducible" : l.declara_reproducible === false ? " · no reproducible" : ""}${l.vigencia?.caduca_en ? ` · caduca ${fecha(l.vigencia.caduca_en)}` : " · sin caducidad"}`),
    el("details", { "data-k": `reglas-${l.id}`, open: abiertos.has(`reglas-${l.id}`) }, el("summary", {}, `Reglas del gerente (${e.reglas.filter((r) => r.resultado === "cumple").length}/12 cumplen)`), tablaReglas(e.reglas)));
}

function tarjetaRecomendacion(r, abiertos) {
  const k = `rec-${r.id}`;
  return el("article", { clase: "nexus-tarjeta", "data-recomendacion": r.id },
    el("div", { clase: "sala-tarjeta-cabeza" }, el("h4", {}, r.contenido?.titulo ?? r.id), el("span", { clase: `nexus-chip nexus-etapa-${r.etapa}` }, ETIQUETA_ETAPA[r.etapa] ?? "Inválida")),
    el("p", { clase: "sala-nota" }, `Destino ${r.contenido?.proyecto_destino ?? "?"} · ${r.implementada ? "registrada como desplegada" : "no implementada"} · ${r.contenido?.reversible ? "reversible" : "NO reversible"}`),
    r.contenido?.criterio_exito ? el("p", { clase: "sala-nota" }, `Criterio de éxito: ${r.contenido.criterio_exito}`) : null,
    el("details", { "data-k": k, open: abiertos.has(k) }, el("summary", {}, `Historial (${r.historial.length} evento${r.historial.length === 1 ? "" : "s"})`),
      el("ol", { clase: "nexus-historial" }, ...r.historial.map((ev) => el("li", {},
        el("strong", {}, EVENTO[ev.tipo] ?? ev.tipo), ` · ${fecha(ev.en)} · ${actor(ev.por)}`, ev.dictamen ? ` · ${DICTAMEN[ev.dictamen]?.texto ?? ev.dictamen}` : "",
        ev.alcance ? ` · alcance: ${ev.alcance}` : "", ev.nota ? el("span", { clase: "sala-suave" }, ` · ${ev.nota}`) : null)))));
}

/** Revisar un borrador de lección pegado como JSON. Opcional: descargar el registro con la lección agregada. */
function seccionBorrador({ abiertos, borrador, resumen, fuente, docLecciones, ahoraMs }) {
  const salida = el("div", { clase: "nexus-salida", role: "status", "aria-live": "polite" });
  const area = el("textarea", { id: "nexus-borrador", rows: "8", spellcheck: "false", "aria-label": "Borrador de lección en JSON", placeholder: '{ "contrato": "cauce.leccion", "version_contrato": "0.2.0", … }' });
  area.value = borrador;
  const revisar = async () => {
    salida.replaceChildren();
    let v;
    try { v = JSON.parse(area.value); } catch { salida.append(el("p", { clase: "nexus-mal" }, "No es JSON válido.")); return; }
    const { errores, avisos } = validarLeccion(v);
    if (errores.length) salida.append(el("p", { clase: "nexus-mal" }, `El contrato rechaza el borrador (${errores.length}):`), el("ul", {}, ...errores.map((t) => el("li", {}, t))));
    for (const t of avisos) salida.append(el("p", { clase: "sala-nota" }, t));
    const lecciones = new Map(resumen.lecciones.map((x) => [x.leccion.id, x.leccion]));
    lecciones.set(v?.id, v);
    const ev = evaluarLeccion(v, { ahora: ahoraMs, lecciones });
    salida.append(el("p", {}, "Dictamen del gerente: ", chip(ev.dictamen.estado)), tablaReglas(ev.reglas));
    if (errores.length) return;
    // El registro real empieza vacío si todavía no existe; uno de prueba solo admite lecciones de prueba.
    const mismoTipo = (v.es_demo === true) === (fuente === "demo");
    const r = await agregarLeccion(mismoTipo && docLecciones ? docLecciones : registroVacio("lecciones", { es_demo: v.es_demo === true }), v);
    if (!r.ok) { salida.append(el("p", { clase: "nexus-mal" }, `No se puede agregar al registro: ${r.errores.join(" ")}`)); return; }
    const url = URL.createObjectURL(new Blob([`${JSON.stringify(r.doc, null, 2)}\n`], { type: "application/json" }));
    salida.append(el("p", {}, el("a", { clase: "boton boton-chico", href: url, download: "lecciones.json" }, "Descargar registro con esta lección"),
      el("span", { clase: "sala-nota" }, ` Guárdalo en ${v.es_demo ? "datos/nexus/demo/" : "datos/nexus/registro/"} como lecciones.json. Incluye todo el historial anterior sin cambios.`)));
  };
  return el("details", { clase: "sala-seccion", "data-k": "borrador", open: abiertos.has("borrador") },
    el("summary", {}, el("h3", { clase: "sala-h3-linea", id: "nexus-borrador-titulo" }, "Revisar un borrador de lección")),
    el("p", { clase: "sala-nota" }, "Pega una lección (contrato cauce.leccion 0.2). Se revisa aquí mismo, sin enviarla a ningún lado. Plantilla: contrato/ejemplos/nexus/leccion-plantilla.json."),
    area, el("p", {}, el("button", { type: "button", clase: "boton boton-chico", id: "nexus-revisar", onclick: revisar }, "Revisar con el gerente")), salida);
}
