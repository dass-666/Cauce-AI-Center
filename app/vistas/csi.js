// Laboratorio CSI (Inteligencia Estratégica): paneles del departamento. Solo HTML, sin animaciones (Intel UHD);
// mientras está abierto la 3D no dibuja. Lee lo que entrega leerCSI(); no decide nada. Lo único que «escribe» son
// DESCARGAS que la persona guarda. Los textos entran como texto, nunca como HTML.
// CSI investiga · Nexus cuestiona · Diego decide.

import { el, fecha } from "./dom.js";
import { L, intervalo } from "../csi/base.js";
import { TIPOS_ENUNCIADO, CATEGORIAS, TIPOS_OBJECION, ESTADOS_REVISION, TEMAS, analizarInvestigacion, crearInvestigacion, aplicarCambio } from "../csi/investigacion.js";
import { TIPOS_ACTOR, TIPOS_RELACION } from "../csi/actores.js";
import { TIPOS_FUENTE } from "../csi/base.js";
import { registroVacioPredicciones, agregarEntrada, resumirPredicciones, RESULTADOS } from "../csi/predicciones.js";
import { prepararPropuesta, ENVIA, NO_ENVIA } from "../csi/adaptador-nexus.js";
import { TIPOS_FUENTE_02, CLASES_FUENTE, ESTADOS_FUENTE, lineaConocimiento, fechaConocimiento } from "../csi/fuentes.js";
import { NATURALEZAS_ESTUDIO } from "../csi/investigacion.js";
import { revisarAbogado, objecionesSugeridas, AUTOR_ABOGADO } from "../csi/abogado.js";
import { crearAncla, verificarContraAncla, instruccionesPublicacion, textoPublicable, TEMPORAL_TXT } from "../csi/ancla.js";

const PESTANAS = [["resumen", "Resumen"], ["investigaciones", "Investigaciones"], ["fuentes", "Fuentes"], ["actores", "Actores"], ["relaciones", "Mapa y relaciones"], ["hipotesis", "Hipótesis"], ["flujo", "Flujo de 10 pasos"], ["arbol", "Árbol de decisiones"], ["evidencias", "Evidencias y objeciones"], ["abogado", "Abogado del Diablo"], ["predicciones", "Predicciones"], ["nexus", "Propuesta a Nexus"], ["laboratorio", "Nueva investigación"]];
const CLASE_TXT = { primaria: "Primaria", secundaria: "Secundaria", interpretacion: "Interpretación" };
const RES_TXT = { alerta: "Alerta", ok: "Sin alerta", no_evaluable: "No evaluable" };
const TIPO_TXT = { hecho: "Hechos", declaracion: "Declaraciones", inferencia: "Inferencias", simulacion: "Simulaciones", prediccion: "Predicciones" };
const ESTADO_HIP = { incompleta: "Incompleta", contradicha: "Contradicha", en_disputa: "En disputa", sin_contradiccion_registrada: "Sin contradicción registrada (no es confirmación)" };
const ESTADO_PRED = { pendiente: "Pendiente", en_curso: "En curso", sin_evaluar: "Vencida sin evaluar", acertada: "Acertada", fallida: "Fallida", indeterminada: "Indeterminada" };
const ESTADO_EXP = { sin_evidencia: "Sin evidencia", con_senales_a_favor: "Con señales a favor", con_senales_en_contra: "Con señales en contra", mixta: "Mixta" };
const estadoUI = { pestana: "resumen", tipoActor: "", propuesta: null, ancla: null, verificacion: null };
/** Laboratorio de la sesión (no se guarda solo: se descarga). */
const lab = { inv: null, pred: null, mensajes: [] };

const chip = (t, clase = "") => el("span", { clase: `nexus-chip csi-chip ${clase}` }, t);
const lista = (xs, vacio = "—") => (xs.length ? el("ul", { clase: "csi-lista" }, ...xs.map((x) => el("li", {}, x))) : el("p", { clase: "sala-nota" }, vacio));
const cifra = (v, t, clase = "") => el("div", { clase: `sala-cifra ${clase}`, role: "listitem" }, el("strong", {}, String(v)), el("span", {}, t));
const seccion = (titulo, ...hijos) => el("section", { clase: "sala-seccion csi-seccion" }, el("h3", {}, titulo), ...hijos);
const descarga = (doc, nombre, texto) => el("a", { clase: "boton boton-chico", href: URL.createObjectURL(new Blob([`${JSON.stringify(doc, null, 2)}\n`], { type: "application/json" })), download: nombre }, texto);

/**
 * @param nodo   contenedor (#csi)
 * @param csi    resultado de leerCSI() o null mientras carga
 * @param op     { alCerrar(), fuente: "demo"|"real" }
 */
export function dibujarCSI(nodo, csi, op) {
  const redibujar = () => dibujarCSI(nodo, csi, op);
  const cabeza = el("div", { clase: "sala-cabeza" },
    el("div", {}, el("h2", { id: "csi-titulo", tabindex: "-1" }, "Inteligencia Estratégica (CSI) · laboratorio"),
      el("p", { clase: "sala-sub" }, "CSI investiga · Nexus cuestiona · Diego decide. Estudia incentivos y decisiones posibles; no afirma intenciones ocultas ni conoce el futuro.")),
    el("button", { type: "button", clase: "boton", onclick: op.alCerrar, title: "Cerrar CSI y volver al edificio (I o Esc)" }, "Ir al edificio ›"));
  if (!csi) { nodo.replaceChildren(cabeza, el("p", { clase: "sala-vacio" }, "Leyendo CSI…")); return; }
  const fuente = csi.es_demo
    ? el("p", { clase: "nexus-fuente nexus-demo csi-fuente", "data-fuente": "demo", role: "note" }, el("strong", {}, "DEMO · CASO FICTICIO"), " · País, mercado, actores, fuentes y cifras inventados. Nada de esto describe a una institución real.")
    : csi.naturaleza === "historico"
      ? el("p", { clase: "nexus-fuente csi-fuente csi-historico", "data-fuente": "historico", role: "note" }, el("strong", {}, "HISTÓRICO · REAL RETROSPECTIVO"), " · Acontecimiento real ya ocurrido, analizado después con fuentes públicas fechadas. No es una predicción: nada aquí se registró antes del resultado. Copia local (datos/csi/historico/), no publicada.")
      : el("p", { clase: "nexus-fuente nexus-fuente-real csi-fuente", "data-fuente": "real", role: "note" }, el("strong", {}, "REAL"), " · Almacén local de CSI (datos/csi/registro/). Identidades declaradas, sin autenticar.");
  const conjuntos = L(op.conjuntos).length > 1 ? el("p", { clase: "csi-botones csi-conjuntos", role: "group", "aria-label": "Qué datos ver" }, "Ver: ",
    ...op.conjuntos.map((c) => el("button", { type: "button", clase: `boton boton-chico${c.id === op.conjunto ? " nexus-activo" : ""}`, "data-conjunto": c.id, "aria-pressed": String(c.id === op.conjunto), disabled: !c.hay, title: c.hay ? null : "Sin datos en esta carpeta", onclick: () => op.alConjunto?.(c.id) }, c.etiqueta))) : null;
  const barra = el("div", { clase: "csi-pestanas", role: "tablist", "aria-label": "Paneles de CSI" }, ...PESTANAS.map(([k, t]) =>
    el("button", { type: "button", role: "tab", clase: `boton boton-chico${estadoUI.pestana === k ? " nexus-activo" : ""}`, "aria-selected": String(estadoUI.pestana === k), "data-pestana": k, onclick: () => { estadoUI.pestana = k; redibujar(); nodo.querySelector(`[data-pestana="${k}"]`)?.focus(); } }, t)));
  const errores = csi.errores.length ? el("div", { clase: "nexus-errores", role: "alert" }, el("strong", {}, `${csi.errores.length} problema(s); lo afectado no se muestra:`), lista(csi.errores.slice(0, 8))) : null;
  // El laboratorio conserva, entre redibujos, qué formularios están abiertos y lo escrito en ellos.
  estadoUI.abiertos = new Set([...nodo.querySelectorAll("details[open][data-form]")].map((d) => d.dataset.form));
  const valores = [...nodo.querySelectorAll("[id^='csi-lab-']")].map((n) => [n.id, n.value]);
  const cuerpo = { resumen, investigaciones, fuentes: fuentesPanel, actores, relaciones, hipotesis, flujo: flujoPanel, arbol, evidencias, abogado: abogadoPanel, predicciones, nexus, laboratorio }[estadoUI.pestana](csi, redibujar);
  nodo.replaceChildren(...[cabeza, conjuntos, fuente, errores, barra, el("div", { clase: "csi-cuerpo", role: "tabpanel", "data-panel": estadoUI.pestana }, cuerpo)].filter(Boolean));
  for (const [id, v] of valores) { const n = nodo.querySelector(`#${id}`); if (n) n.value = v; }
}

function resumen(csi) {
  const hip = csi.investigaciones.flatMap((x) => x.analisis.hipotesis);
  const cuenta = (k) => hip.filter((h) => h.estado === k).length;
  const pr = csi.predicciones?.resumen;
  const obj = csi.investigaciones.flatMap((x) => L(x.inv.objeciones)).filter((o) => o.estado === "abierta").length;
  const integras = csi.investigaciones.filter((x) => x.integridad.ok).length;
  return [
    el("div", { clase: "sala-cifras", role: "list", "aria-label": "Resumen de CSI" },
      cifra(csi.investigaciones.length, "investigaciones"), cifra(L(csi.actores?.doc.actores).length, "actores"),
      cifra(csi.actores?.relaciones.verificables.length ?? 0, "relaciones verificables"), cifra(csi.actores?.relaciones.sin_verificar.length ?? 0, "relaciones sin fuente", "c-aviso"),
      cifra(cuenta("incompleta"), "hipótesis incompletas", "c-aviso"), cifra(cuenta("contradicha"), "hipótesis contradichas"), cifra(cuenta("sin_contradiccion_registrada"), "sin contradicción registrada"),
      cifra(obj, "objeciones abiertas", obj ? "c-aviso" : ""), cifra(pr?.total ?? 0, "predicciones registradas"), cifra(pr?.fallidas ?? 0, "fallidas (se conservan)"), cifra(pr?.sin_evaluar ?? 0, "vencidas sin evaluar", "c-aviso")),
    el("p", { clase: "csi-flujo", "aria-label": "Flujo" }, ["CSI investiga", "CSI formula hipótesis", "Abogado del Diablo objeta", "Revisión escéptica (Nexus)", "Decisión humana (Diego)", "Seguimiento"].join("  →  ")),
    el("p", { clase: "sala-nota", "data-niveles": "" }, "HECHO: con evidencia · DECLARACIÓN: atribuida a una fuente · INFERENCIA: interpretación razonada · HIPÓTESIS: explicación pendiente de prueba · ESCENARIO: resultado posible bajo supuestos (simulación)."),
    csi.investigaciones.length ? el("p", { clase: "sala-nota" }, csi.investigaciones.map((x) => `${x.inv.id}: flujo ${x.flujo?.completos ?? "?"}/${x.flujo?.total ?? 10} · Abogado ${x.abogado?.alertas_total ?? 0} alerta(s) · fuentes ${x.expediente?.consultadas.length ?? L(x.inv.fuentes).length} consultadas, ${x.expediente?.pendientes.length ?? 0} pendientes`).join(" | ")) : null,
    el("p", { clase: `sala-nota ${integras === csi.investigaciones.length ? "" : "nexus-mal"}`, "data-integridad-csi": integras === csi.investigaciones.length ? "ok" : "mal" },
      `Historial de investigaciones: ${integras}/${csi.investigaciones.length} íntegros. Memoria de predicciones: ${csi.predicciones ? (csi.predicciones.integridad.ok ? `cadena íntegra (${csi.predicciones.integridad.entradas} entradas)` : `ALTERADA: ${csi.predicciones.integridad.problemas.join(" ")}`) : "sin registro"}.`),
    seccion("Cinco estaciones", lista([
      "Estratega: objetivos, incentivos, recursos y decisiones (pestañas Actores e Investigaciones).",
      "Psicólogo de Masas: reacciones colectivas (enunciados «conducta» y actores colectivos).",
      "Analista de Poder: relaciones verificables (pestaña Relaciones).",
      "Simulador: árboles y escenarios alternativos (pestaña Árbol).",
      "Abogado del Diablo: objeciones, alternativas y sesgos (pestaña Evidencias y objeciones)."])),
  ];
}

const fuentesDe = (inv, ids) => L(ids).map((id) => L(inv.fuentes).find((f) => f.id === id)).filter(Boolean).map((f) => `${f.titulo} · ${f.editor} · ${f.tipo} · publicada ${fecha(f.publicada_en.length === 10 ? `${f.publicada_en}T12:00:00Z` : f.publicada_en)}`);

function investigaciones(csi) {
  if (!csi.investigaciones.length) return el("p", { clase: "sala-vacio" }, "Sin investigaciones. Crea una en «Nueva investigación».");
  return csi.investigaciones.map(({ inv, integridad }) => el("article", { clase: "nexus-tarjeta csi-inv", "data-investigacion": inv.id },
    el("div", { clase: "sala-tarjeta-cabeza" }, el("h4", {}, inv.titulo), chip(`Revisión: ${inv.revision.estado}`)),
    el("p", { clase: "nexus-enunciado" }, inv.pregunta),
    el("p", { clase: "sala-nota" }, `${inv.id} · acontecimiento: ${inv.acontecimiento.descripcion} (${inv.acontecimiento.fecha}) · creada ${fecha(inv.creada_en)} por ${inv.creada_por.identificador} (declarado) · incertidumbre ${inv.incertidumbre.nivel}: ${inv.incertidumbre.descripcion}`),
    inv.revision.nota ? el("p", { clase: "sala-nota" }, inv.revision.nota) : null,
    el("div", { clase: "csi-columnas" }, ...TIPOS_ENUNCIADO.map((t) => {
      const xs = inv.enunciados.filter((x) => x.tipo === t);
      return el("div", { clase: `csi-col csi-col-${t}`, "data-tipo": t }, el("h5", {}, `${TIPO_TXT[t]} (${xs.filter((x) => !x.retirado).length})`),
        lista(xs.map((x) => el("span", { clase: x.retirado ? "nexus-retirada" : "" }, el("strong", {}, x.id), ` ${x.texto}`, x.sobre ? ` · ${x.sobre}` : "", x.retirado ? ` · RETIRADO: ${x.retirado.motivo}` : "",
          x.fuentes.length ? el("small", { clase: "csi-fuentes" }, fuentesDe(inv, x.fuentes).join(" | ")) : null, x.inferido_de ? el("small", {}, ` (de ${x.inferido_de.join(", ")})`) : null))));
    })),
    el("h5", {}, "Incentivos inferidos (no son hechos)"), lista(inv.incentivos.map((x) => `${x.actor_id}: ${x.texto} (basado en ${x.basado_en.join(", ")})`)),
    el("h5", {}, "Supuestos"), lista(inv.supuestos),
    el("details", {}, el("summary", {}, `Historial (${inv.historial.length} cambios) · ${integridad.ok ? "íntegro" : "ALTERADO"}`),
      el("ol", { clase: "nexus-historial" }, ...inv.historial.map((h) => el("li", {}, `${fecha(h.fecha)} · ${h.autor.identificador} · ${h.accion}${h.detalle ? ` · ${h.detalle}` : ""}`))),
      integridad.ok ? null : lista(integridad.problemas))));
}

function actores(csi, redibujar) {
  const doc = csi.actores?.doc;
  if (!doc) return el("p", { clase: "sala-vacio" }, "Sin registro de actores.");
  const filtro = el("select", { "aria-label": "Tipo de actor", onchange: (e) => { estadoUI.tipoActor = e.target.value; redibujar(); } }, el("option", { value: "" }, "Todos los tipos"), ...TIPOS_ACTOR.map((t) => el("option", { value: t, selected: estadoUI.tipoActor === t }, t)));
  const fu = (ids) => L(ids).map((id) => L(doc.fuentes).find((f) => f.id === id)?.titulo ?? id).join("; ");
  return [el("p", {}, el("label", {}, "Filtrar: ", filtro)),
    ...doc.actores.filter((a) => !estadoUI.tipoActor || a.tipo === estadoUI.tipoActor).map((a) => el("article", { clase: "nexus-tarjeta", "data-actor": a.id },
      el("div", { clase: "sala-tarjeta-cabeza" }, el("h4", {}, a.nombre), chip(a.tipo), a.ficticio ? chip("ficticio", "nexus-incompleto") : null),
      el("h5", {}, "Objetivos documentados"), lista(a.objetivos_documentados.map((x) => `${x.texto} — fuente: ${fu(x.fuentes)}`), "Ninguno documentado."),
      el("h5", {}, "Incentivos hipotéticos (no documentados)"), lista(a.incentivos_hipoteticos.map((x) => x.texto)),
      el("h5", {}, "Recursos conocidos"), lista(a.recursos_conocidos.map((x) => `${x.texto} — fuente: ${fu(x.fuentes)}`)),
      el("h5", {}, "Restricciones"), lista(a.restricciones.map((x) => `${x.texto}${x.fuentes?.length ? ` — fuente: ${fu(x.fuentes)}` : " — sin fuente"}${x.impide?.length ? ` · impide: ${x.impide.join(", ")}` : ""}`)),
      el("h5", {}, "Decisiones posibles"), lista(a.decisiones_posibles.map((d) => `${d.id}: ${d.texto}`)),
      a.intereses_economicos ? [el("h5", {}, "Intereses económicos documentados"), lista(a.intereses_economicos.map((x) => `${x.texto} — fuente: ${fu(x.fuentes)}`), "Ninguno documentado.")] : null,
      a.decisiones_historicas ? [el("h5", {}, "Decisiones históricas verificables"), lista(a.decisiones_historicas.map((x) => `${x.fecha} · ${x.texto} — fuente: ${fu(x.fuentes)}`), "Ninguna registrada.")] : null,
      a.conflictos_interes ? [el("h5", {}, "Posibles conflictos de interés"), lista(a.conflictos_interes.map((x) => `[${x.clase}] ${x.texto}${L(x.fuentes).length ? ` — fuente: ${fu(x.fuentes)}` : " — sin fuente"}`), "Ninguno registrado.")] : null,
      el("h5", {}, "Incertidumbres"), lista(a.incertidumbres)))];
}

function relaciones(csi) {
  const r = csi.actores;
  if (!r) return el("p", { clase: "sala-vacio" }, "Sin registro de actores.");
  const nombre = (id) => r.doc.actores.find((a) => a.id === id)?.nombre ?? id;
  const fila = (x) => `${nombre(x.de)} — ${x.tipo} (${TIPOS_RELACION[x.tipo]}) → ${nombre(x.a)}: ${x.descripcion}`;
  return [
    seccion("Mapa de actores", mapaActores(r), el("p", { clase: "sala-nota" }, "Línea continua: relación con fuente. Línea punteada: sin fuente (no entra al análisis). Sin línea: no hay relación documentada; eso no significa coordinación ni conflicto.")),
    seccion(`Verificables (${r.relaciones.verificables.length})`, lista(r.relaciones.verificables.map(fila))),
    seccion(`Sin fuente: no entran al análisis (${r.relaciones.sin_verificar.length})`, lista(r.relaciones.sin_verificar.map(fila))),
    seccion("Alianzas y tensiones documentadas", el("p", { clase: "sala-nota" }, r.intereses.nota),
      lista(r.intereses.bloques.map((b) => `Bloque de cooperación documentada: ${b.map(nombre).join(", ")}`), "Sin bloques."),
      el("details", {}, el("summary", {}, `Pares de actores (${r.intereses.pares.length})`), lista(r.intereses.pares.map((p) => `${nombre(p.a)} · ${nombre(p.b)}: ${p.lectura}`)))),
  ];
}

function hipotesis(csi) {
  return csi.investigaciones.map(({ inv, analisis }) => seccion(`Comparar hipótesis · ${inv.titulo}`,
    el("div", { clase: "csi-tabla-envoltura" }, el("table", { clase: "csi-tabla", "data-comparar": inv.id },
      el("thead", {}, el("tr", {}, ...["Hipótesis", "Categoría", "Estado", "A favor", "En contra", "Objeciones abiertas", "Datos faltantes", "Por qué"].map((t) => el("th", { scope: "col" }, t)))),
      el("tbody", {}, ...analisis.hipotesis.map((h) => el("tr", { "data-hipotesis": h.id, "data-estado": h.estado },
        el("td", {}, el("strong", {}, h.id), ` ${h.enunciado}`), el("td", {}, h.categoria), el("td", {}, ESTADO_HIP[h.estado] ?? h.estado),
        el("td", {}, String(h.a_favor)), el("td", {}, String(h.en_contra)), el("td", {}, String(h.objeciones_abiertas)), el("td", {}, String(h.datos_faltantes)),
        el("td", {}, [...h.motivos, ...(h.apoyos_disputados.length ? [`apoyo disputado: ${h.apoyos_disputados.join(", ")}`] : [])].join("; ") || "—")))))),
    lista(analisis.alertas, "Sin alertas.")));
}

function arbol(csi) {
  if (!csi.escenarios.length) return el("p", { clase: "sala-vacio" }, "Sin escenarios.");
  return csi.escenarios.map(({ esc, sim }) => {
    const hijos = (padre) => esc.arbol.nodos.filter((n) => n.padre === padre).sort((a, b) => a.id.localeCompare(b.id));
    const actor = (id) => csi.actores?.doc.actores.find((a) => a.id === id);
    const rama = (n) => {
      const paso = sim.rutas.flatMap((r) => r.pasos).find((p) => p.nodo === n.id);
      const hs = hijos(n.id);
      return el("li", { "data-nodo": n.id, clase: paso?.bloqueada ? "csi-bloqueada" : "" },
        el("details", { open: true }, el("summary", {}, `${actor(n.actor_id)?.nombre ?? n.actor_id}: ${paso?.decision ?? n.decision_id}${paso?.bloqueada ? " · BLOQUEADA por restricción documentada" : ""}${n.explicacion_id ? ` · explicación ${n.explicacion_id}` : ""}`),
          el("p", { clase: "sala-nota" }, `Beneficios (hipotéticos): ${n.beneficios.join("; ") || "—"} · Costos: ${n.costos.join("; ") || "—"} · Consecuencias previstas: ${n.consecuencias.join("; ") || "—"}`),
          paso?.bloqueada ? el("p", { clase: "sala-nota nexus-mal" }, `Restricción: ${paso.por.join("; ")}`) : null,
          hs.length ? el("ul", { clase: "csi-arbol" }, ...hs.map(rama)) : null));
    };
    return seccion(esc.titulo,
      sim.contrafactual ? el("p", {}, chip("CONTRAFACTUAL", "nexus-incompleto"), " ", L(esc.supuestos).length ? `Supone: ${esc.supuestos.join(" · ")}` : "") : null,
      el("p", { clase: "nexus-demo csi-aviso-sim", "data-simulacion": "", "data-contrafactual": sim.contrafactual ? "si" : "no" }, sim.aviso),
      el("p", { clase: "sala-nota" }, `Detonante: ${esc.detonante}`),
      el("div", { clase: "nexus-tarjetas" }, ...sim.explicaciones.map((x) => el("article", { clase: "nexus-tarjeta", "data-explicacion": x.clave },
        el("div", { clase: "sala-tarjeta-cabeza" }, el("h4", {}, `${x.clave}. ${x.descripcion}`), chip(ESTADO_EXP[x.estado])), x.solo_hipotesis ? el("p", { clase: "sala-nota nexus-mal" }, "Solo hipótesis: requiere evidencia.") : null,
        el("h5", {}, `Lo apoyaría (${x.a_favor.observadas}/${x.a_favor.de} observadas)`), lista(x.a_favor.senales.map((s) => `${s.observada ? "✓" : "○"} ${s.texto}${s.enunciado_id ? ` (${s.enunciado_id})` : ""}`)),
        el("h5", {}, `Lo refutaría (${x.en_contra.observadas}/${x.en_contra.de} observadas)`), lista(x.en_contra.senales.map((s) => `${s.observada ? "✓" : "○"} ${s.texto}${s.enunciado_id ? ` (${s.enunciado_id})` : ""}`)),
        el("h5", {}, "Datos que faltan"), lista(x.datos_faltantes)))),
      el("h4", {}, "Árbol de decisiones (simulación)"), el("ul", { clase: "csi-arbol" }, ...hijos(null).map(rama)),
      el("details", {}, el("summary", {}, `Rutas simuladas (${sim.rutas.length}; ${sim.rutas.filter((r) => !r.viable).length} bloqueadas)`), lista(sim.rutas.map((r) => `${r.viable ? "" : "[bloqueada] "}${r.pasos.map((p) => `${p.actor}: ${p.decision}`).join(" → ")}`))),
      sim.problemas.length ? lista(sim.problemas) : null);
  });
}

function evidencias(csi) {
  return csi.investigaciones.map(({ inv, analisis }) => seccion(`Evidencias y objeciones · ${inv.titulo}`,
    ...inv.hipotesis.map((h) => {
      const txt = (id) => { const x = inv.enunciados.find((y) => y.id === id); return x ? `${x.id} [${x.tipo}] ${x.texto}${x.retirado ? " (RETIRADO)" : ""}` : id; };
      return el("article", { clase: "nexus-tarjeta", "data-evidencia": h.id },
        el("h4", {}, `${h.id} · ${h.enunciado}`),
        el("h5", {}, "A favor"), lista(h.a_favor.map(txt), "Sin evidencia a favor."), el("h5", {}, "En contra"), lista(h.en_contra.map(txt), "Nada en contra registrado."),
        el("h5", {}, "Se refuta si"), lista(h.condiciones_refutacion, "Sin condiciones de refutación: queda incompleta."),
        h.observaciones_distintivas ? [el("h5", {}, "Observaciones que la distinguen de sus rivales"), lista(h.observaciones_distintivas.map((o) => `${o.texto} (frente a ${o.distingue_de.join(", ")}${o.disponible ? ` · ${o.disponible.replace(/_/g, " ")}` : ""})`), "Ninguna.")] : null,
        el("h5", {}, "Datos que faltan"), lista(h.datos_faltantes, "No declarados."),
        el("h5", {}, "Abogado del Diablo"), lista(inv.objeciones.filter((o) => o.hipotesis_id === h.id).map((o) => `[${o.estado}] ${o.tipo}: ${o.texto}${o.respuesta ? ` → ${o.respuesta}` : ""} (${o.autor.identificador})`), "Sin objeciones."));
    }),
    el("h4", {}, "Objeciones generales"), lista(inv.objeciones.filter((o) => o.hipotesis_id === null).map((o) => `[${o.estado}] ${o.tipo}: ${o.texto}`)),
    el("h4", {}, "Enunciados que se contradicen"), lista(analisis.conflictos.map((c) => `${c.a} (${c.tipos[0]}) contradice ${c.b} (${c.tipos[1]})`), "Ninguno.")));
}

function tablaPredicciones(r, verif = null) {
  const temporal = (id) => verif?.filas.find((x) => x.id === id)?.temporal ?? "declarada";
  return el("div", { clase: "csi-tabla-envoltura" }, el("table", { clase: "csi-tabla" },
    el("thead", {}, el("tr", {}, ...["Predicción", "Registrada", "Horizonte", "Verificación temporal", "Versiones", "Estado", "Referencia simple", "Evidencia del resultado"].map((t) => el("th", { scope: "col" }, t)))),
    el("tbody", {}, ...r.filas.map((f) => el("tr", { "data-prediccion": f.id, "data-estado": f.estado, "data-temporal": temporal(f.id) },
      el("td", {}, el("strong", {}, f.id), ` ${f.texto}`, el("small", { clase: "csi-fuentes" }, `Observable: ${f.observable} · reglas: ${f.version_reglas}`), f.advertencia ? el("small", { clase: "csi-fuentes nexus-mal" }, f.advertencia) : null),
      el("td", {}, `${fecha(f.registrado_en)} · ${f.registrado_por.identificador} (declarado)`), el("td", {}, `${fecha(f.horizonte.desde)} → ${fecha(f.horizonte.hasta)}`),
      el("td", { clase: temporal(f.id) === "acreditada_antes_del_horizonte" ? "" : "nexus-mal" }, TEMPORAL_TXT[temporal(f.id)]),
      el("td", {}, `${f.versiones} (cuenta la v${f.version_evaluada})`, ...f.correcciones_posteriores.map((c) => el("small", { clase: "csi-fuentes nexus-mal" }, `v${c.version} posterior al horizonte/resultado: no cuenta (${c.motivo})`))),
      el("td", {}, ESTADO_PRED[f.estado]), el("td", {}, `${f.referencia.resultado_esperado} → ${f.resultado_referencia ? ESTADO_PRED[f.resultado_referencia] : "—"}`),
      el("td", {}, f.evidencia.map((x) => x.titulo).join("; ") || "—", f.nota ? el("small", { clase: "csi-fuentes" }, f.nota) : null))))));
}

function predicciones(csi, redibujar) {
  const p = csi.predicciones;
  if (!p) return el("p", { clase: "sala-vacio", "data-sin-predicciones": "" }, csi.naturaleza === "historico" ? "Caso HISTÓRICO: es retrospectivo y no contiene predicciones (se habrían registrado después del resultado). Las predicciones van en el almacén real, registradas antes de su horizonte." : "Sin memoria de predicciones.");
  const r = p.resumen, c = r.comparacion;
  const verif = estadoUI.verificacion ?? p.verificacion ?? null;
  const ahora = new Date(csi.ahoraMs).toISOString();
  const generar = async () => { const x = await crearAncla(p.doc, { creada_en: ahora, creada_por: { tipo: "humano", identificador: "diego" } }); estadoUI.ancla = x; redibujar(); };
  const verificarArchivo = async (ev) => {
    const f = ev.target.files?.[0]; if (!f) return;
    try { estadoUI.verificacion = await verificarContraAncla(p.doc, JSON.parse(await f.text()), r); } catch (err) { estadoUI.verificacion = { ok: false, problemas: [`No se pudo leer el ancla: ${err.message}`], filas: [], entradas_ancladas: 0, entradas_posteriores: 0 }; }
    redibujar();
  };
  const prox = r.filas.filter((f) => f.estado === "pendiente").map((f) => f.horizonte.desde).sort()[0] ?? null;
  const a = estadoUI.ancla;
  return [
    el("p", { clase: "nexus-fuente csi-fuente csi-prediccion", "data-fuente": "prediccion", role: "note" }, el("strong", {}, `PREDICCIÓN${csi.es_demo ? " · DEMO" : ""}`), " · Hipótesis registradas ANTES de su horizonte. La hora del registro es declarada; solo un ancla publicada fuera y acreditada por un tercero fija cuándo existió."),
    el("div", { clase: "sala-cifras", role: "list" }, cifra(r.total, "registradas"), cifra(r.acertadas, "acertadas"), cifra(r.fallidas, "fallidas"), cifra(r.indeterminadas, "indeterminadas"), cifra(r.sin_evaluar, "vencidas sin evaluar", "c-aviso"), cifra(r.pendientes + r.en_curso, "pendientes o en curso"), cifra(r.correcciones_posteriores, "correcciones posteriores (no cuentan)", "c-aviso")),
    el("p", { clase: "sala-nota", "data-comparacion": "" }, `Modelo: ${c.modelo.acertadas} aciertos de ${c.modelo.decididas} decididas · Referencia simple: ${c.referencia.acertadas} de ${c.referencia.decididas}. ${c.lectura}`),
    el("p", { clase: `sala-nota ${p.integridad.ok ? "" : "nexus-mal"}` }, p.integridad.ok ? `Cadena de huellas íntegra (${p.integridad.entradas} entradas, última ${p.integridad.ultima_huella?.slice(0, 16)}…).` : `Cadena ALTERADA: ${p.integridad.problemas.join(" ")}`),
    tablaPredicciones(r, verif),
    seccion("Ancla verificable",
      el("p", { clase: "sala-nota", "data-anclas": String(p.anclas ?? 0) }, verif ? (verif.ok ? `Registro coherente con el ancla: ${verif.entradas_ancladas} entradas ancladas, ${verif.entradas_posteriores} posteriores (solo hora declarada). ${verif.acreditada ? `Acreditada por un tercero: ${fecha(verif.acreditado_en)}.` : "El ancla no está acreditada por un tercero."}` : `El registro NO coincide con el ancla: ${verif.problemas.join(" ")}`) : "Sin ancla cargada: todas las horas son declaradas."),
      el("p", { clase: "csi-botones" },
        el("button", { type: "button", clase: "boton boton-chico", "data-generar-ancla": "", onclick: generar }, "Generar ancla (solo huellas)"), " ",
        el("label", { clase: "boton boton-chico" }, "Verificar con un ancla… ", el("input", { type: "file", accept: "application/json,.json", "data-cargar-ancla": "", clase: "csi-archivo", onchange: verificarArchivo }))),
      a?.ok ? el("div", { "data-ancla": a.ancla.huella_ancla },
        el("p", {}, el("strong", {}, "Texto para publicar (no contiene predicciones): "), el("code", { clase: "csi-codigo" }, textoPublicable(a.ancla))),
        lista(instruccionesPublicacion(a.ancla, prox)),
        el("p", {}, descarga(a.ancla, `ancla-${a.ancla.registro.entradas}.json`, "Descargar ancla"), " Este programa no publica nada."))
        : a ? lista(a.errores) : null),
  ];
}

function nexus(csi, redibujar) {
  const ahora = new Date(csi.ahoraMs).toISOString();
  const botones = csi.investigaciones.flatMap(({ inv }) => inv.hipotesis.map((h) => el("button", { type: "button", clase: "boton boton-chico", "data-preparar": h.id,
    onclick: () => { const r = prepararPropuesta(inv, h.id, { autor: { tipo: "humano", identificador: inv.creada_por.identificador }, fecha: ahora, predicciones: csi.predicciones?.resumen, ahoraMs: csi.ahoraMs }); estadoUI.propuesta = r.ok ? r : { error: r.errores }; redibujar(); } }, `Preparar ${h.id}`)));
  const r = estadoUI.propuesta;
  return [
    el("p", { clase: "sala-nota" }, "CSI investiga → CSI formula hipótesis → Abogado del Diablo objeta → Nexus revisa → Diego decide. Nexus no aprueba: su dictamen solo señala objeciones. Nada se escribe en el almacén de Nexus; la propuesta se descarga y la decide una persona."),
    el("p", { clase: "csi-botones" }, ...botones),
    r?.error ? lista(r.error) : null,
    r?.propuesta ? el("article", { clase: "nexus-tarjeta", "data-propuesta": r.propuesta.id },
      el("div", { clase: "sala-tarjeta-cabeza" }, el("h4", {}, `${r.propuesta.hipotesis.id} · ${r.propuesta.hipotesis.enunciado}`), chip(`Nexus: ${r.propuesta.revision_esceptica.dictamen}`, `nexus-${r.propuesta.revision_esceptica.dictamen}`)),
      el("p", { clase: "sala-nota", "data-decision": r.propuesta.decision_humana.estado }, `Decisión humana: ${r.propuesta.decision_humana.estado}. ${r.propuesta.decision_humana.nota}`),
      el("h5", {}, "Reglas de Nexus"), lista(r.dictamen.reglas.filter((x) => x.estado !== "cumple").map((x) => `${x.id} ${x.nombre}: ${x.estado} — ${x.motivo}`)),
      el("h5", {}, "Bloqueos"), lista(r.propuesta.bloqueos, "Ninguno."),
      el("h5", {}, `Evidencia primaria (${r.propuesta.evidencia_primaria.length})`), lista(r.propuesta.evidencia_primaria.map((x) => `${x.enunciado_id} (${x.sentido}) ${x.texto}`)),
      el("h5", {}, "Excluida"), lista(r.propuesta.excluida.map((x) => `${x.id}: ${x.motivo}`), "Nada excluido."),
      el("h5", {}, "Seguimiento (predicciones, nunca evidencia)"), lista(r.propuesta.predicciones.map((x) => `${x.id}: ${ESTADO_PRED[x.estado]}${x.nota ? ` — ${x.nota}` : ""}`)),
      el("h5", {}, "Estado de validación"), el("p", { clase: "sala-nota", "data-validacion": "" }, `CSI: ${r.propuesta.estado_validacion.csi} · revisión humana: ${r.propuesta.estado_validacion.revision_humana} · Abogado: ${r.propuesta.estado_validacion.abogado_alertas} alerta(s) · Nexus: ${r.propuesta.estado_validacion.nexus} · decisión: ${r.propuesta.estado_validacion.decision}`),
      el("h5", {}, `Fuentes con procedencia (${r.propuesta.fuentes.length})`), lista(r.propuesta.fuentes.map((f) => `${f.id} · ${f.titulo} · ${f.editor} · ${CLASE_TXT[f.clase] ?? f.clase} · ${f.enlace ?? f.referencia ?? "sin enlace"}`)),
      r.propuesta.fuentes_pendientes.length ? [el("h5", {}, "Fuentes pendientes (no se usan)"), lista(r.propuesta.fuentes_pendientes.map((f) => `${f.id}: ${f.motivo}`))] : null,
      el("h5", {}, `Objeciones (${r.propuesta.objeciones.length})`), lista(r.propuesta.objeciones.map((o) => `[${o.estado}] ${o.texto} (${o.autor.identificador})`), "Ninguna."),
      el("h5", {}, "Condiciones de refutación"), lista(r.propuesta.condiciones_refutacion, "Ninguna: la propuesta queda incompleta."),
      el("h5", {}, "Limitaciones"), lista(r.propuesta.limitaciones),
      el("details", {}, el("summary", {}, "Qué envía y qué nunca envía"), el("p", { clase: "sala-nota" }, `Envía: ${ENVIA.join(", ")}.`), el("p", { clase: "sala-nota" }, `Nunca envía: ${NO_ENVIA.join(", ")}.`)),
      el("p", {}, descarga(r.propuesta, `${r.propuesta.id}.json`, "Descargar propuesta"))) : null,
  ];
}

// ---------- Fase 2: fuentes, flujo, Abogado del Diablo y mapa ----------
const COTEJO_TXT = { coincide: "Coincide con el original", parcial: "Coincide en parte", corregido: "CORREGIDO tras cotejar", no_localizado: "No se pudo cotejar" };
const dia = (f) => (f && f.length === 10 ? f : f ? fecha(f) : "—");
function fuentesPanel(csi) {
  if (!csi.investigaciones.length) return el("p", { clase: "sala-vacio" }, "Sin investigaciones.");
  return csi.investigaciones.map(({ inv, expediente }) => {
    const a = inv.alcance;
    const fin = inv.acontecimiento?.fecha;
    // Cortes conservadores: el día del acontecimiento empieza en UTC+14 y termina en UTC−12 (como las fechas de día).
    const iv = fin ? intervalo(fin) : null;
    const cortes = iv ? [{ etiqueta: "Antes del día del acontecimiento", instante: new Date(iv[0]).toISOString() }, { etiqueta: "Al terminar el día del acontecimiento", instante: new Date(iv[1]).toISOString() }, { etiqueta: "Hoy", instante: new Date(csi.ahoraMs).toISOString() }] : [];
    const linea = cortes.length ? lineaConocimiento(inv, cortes) : [];
    return seccion(`Fuentes · ${inv.titulo}`,
      a ? el("article", { clase: "nexus-tarjeta", "data-alcance": "" }, el("h4", {}, `Alcance y criterios (registrados ${fecha(a.registrado_en)}, antes de la primera fuente)`), el("p", {}, a.descripcion), el("p", { clase: "sala-nota" }, `Periodo: ${a.periodo.desde} → ${a.periodo.hasta}`),
        el("h5", {}, "Criterios de selección de fuentes"), lista(a.criterios_fuentes), el("h5", {}, "Incluye"), lista(a.incluye), el("h5", {}, "Excluye"), lista(a.excluye)) : null,
      expediente ? el("p", { clase: "sala-nota", "data-expediente": expediente.completo ? "completo" : "pendiente" }, `${expediente.consultadas.length} consultada(s) · ${expediente.pendientes.length} pendiente(s) · ${expediente.sin_huella.length} sin copia verificable (sin huella).`) : null,
      el("p", { clase: "sala-nota" }, "Tres fechas distintas: publicada (la copia que citamos), disponible (cuándo fue pública la información; es la que cuenta para «qué se podía saber») y consultada (cuándo la leímos; nunca cuenta como conocimiento)."),
      el("div", { clase: "nexus-tarjetas" }, ...L(inv.fuentes).map((f) => el("article", { clase: `nexus-tarjeta${f.estado === "pendiente" ? " csi-pendiente" : ""}`, "data-fuente-id": f.id, "data-estado-fuente": f.estado ?? "0.1" },
        el("div", { clase: "sala-tarjeta-cabeza" }, el("h4", {}, f.titulo), f.clase ? chip(CLASE_TXT[f.clase]) : null, f.estado ? chip(f.estado === "pendiente" ? "PENDIENTE" : "Consultada", f.estado === "pendiente" ? "nexus-incompleto" : "") : null, f.ficticia ? chip("ficticia", "nexus-incompleto") : null),
        el("p", { clase: "sala-nota" }, `${f.editor} · ${f.tipo}${f.origen ? ` · origen: ${f.origen}` : ""}`),
        f.enlace ? el("p", {}, el("a", { href: f.enlace, target: "_blank", rel: "noopener noreferrer", "data-original": "" }, "Abrir el original ↗")) : f.referencia ? el("p", { clase: "sala-nota" }, `Referencia: ${f.referencia}`) : null,
        el("p", { clase: "sala-nota" }, `Publicada: ${dia(f.publicada_en)} · Disponible: ${f.disponible_en ? `${dia(f.disponible_en)} (${f.disponible_segun})` : "igual a la publicación"} · Consultada: ${f.consultada_en ? fecha(f.consultada_en) : "—"}${f.metodo_consulta ? ` (${f.metodo_consulta.replace(/_/g, " ")})` : ""}`),
        f.estado === "pendiente" ? el("p", { clase: "sala-nota nexus-mal" }, `Pendiente: ${f.pendiente_motivo}`) : null,
        f.extracto ? el("blockquote", { clase: "csi-extracto", "data-extracto": f.extracto_tipo ?? "" }, f.extracto) : null,
        el("p", { clase: "sala-nota" }, f.huella_contenido ? `Huella de la copia: ${f.huella_contenido.slice(0, 16)}… (${f.copia_local})` : "Sin huella: no hay copia verificable guardada."),
        L(f.limitaciones).length ? [el("h5", {}, "Limitaciones"), lista(f.limitaciones)] : null,
        L(f.cotejos).length ? [el("h5", {}, "Cotejo con el original"), el("ul", { "data-cotejos": f.id }, L(f.cotejos).map((c) => el("li", { "data-cotejo": c.resultado },
          `${COTEJO_TXT[c.resultado] ?? c.resultado} · ${fecha(c.fecha)} · ${c.detalle}`)))] : null))),
      linea.length ? [el("h4", {}, "¿Qué se podía conocer en cada momento?"), el("div", { clase: "csi-tabla-envoltura" }, el("table", { clase: "csi-tabla", "data-linea": "" },
        el("thead", {}, el("tr", {}, ...["Momento", "Fuentes ya públicas", "Hechos y declaraciones ya sustentables", "Todavía no"].map((t) => el("th", { scope: "col" }, t)))),
        el("tbody", {}, ...linea.map((c) => el("tr", {}, el("td", {}, c.etiqueta), el("td", {}, c.fuentes.join(", ") || "—"), el("td", {}, c.enunciados.join(", ") || "—"), el("td", {}, c.aun_no.join(", ") || "—"))))))] : null);
  });
}

function flujoPanel(csi) {
  if (!csi.investigaciones.length) return el("p", { clase: "sala-vacio" }, "Sin investigaciones.");
  return csi.investigaciones.map(({ inv, flujo }) => seccion(`Flujo de razonamiento · ${inv.titulo}`,
    el("p", { clase: "sala-nota", "data-flujo": `${flujo.completos}/${flujo.total}` }, `${flujo.completos} de ${flujo.total} pasos registrados. «Completo» quiere decir registrado con las reglas, no verdadero.`),
    el("ol", { clase: "csi-pasos" }, ...flujo.pasos.map((p) => el("li", { "data-paso": p.id, "data-estado": p.estado, clase: p.estado === "completo" ? "" : "nexus-mal" },
      el("strong", {}, `${p.estado === "completo" ? "✓" : "○"} ${p.titulo}`), el("span", { clase: "sala-nota" }, ` · ${p.detalle}`),
      p.faltan.length ? el("small", { clase: "csi-fuentes" }, `Falta: ${p.faltan.join("; ")}`) : null)))));
}

function abogadoPanel(csi) {
  if (!csi.investigaciones.length) return el("p", { clase: "sala-vacio" }, "Sin investigaciones.");
  return csi.investigaciones.map(({ inv, abogado }) => seccion(`Abogado del Diablo · ${inv.titulo}`,
    el("p", { clase: "nexus-demo csi-aviso-sim", "data-abogado": abogado.version }, `${abogado.aviso} Firma: ${abogado.autor.identificador} (${abogado.autor.tipo}).`),
    el("div", { clase: "csi-tabla-envoltura" }, el("table", { clase: "csi-tabla", "data-abogado-tabla": inv.id },
      el("thead", {}, el("tr", {}, el("th", { scope: "col" }, "Pregunta"), ...abogado.hipotesis.map((h) => el("th", { scope: "col" }, h.id)))),
      el("tbody", {}, ...abogado.hipotesis[0]?.comprobaciones.map((c, i) => el("tr", { "data-pregunta": c.id }, el("th", { scope: "row" }, c.pregunta),
        ...abogado.hipotesis.map((h) => { const k = h.comprobaciones[i]; return el("td", { "data-resultado": k.resultado, clase: k.resultado === "alerta" ? "nexus-mal" : "", title: k.detalle }, el("strong", {}, RES_TXT[k.resultado]), el("small", { clase: "csi-fuentes" }, k.detalle)); }))) ?? []))),
    el("p", { clase: "sala-nota" }, `${abogado.alertas_total} alerta(s). Las objeciones registradas (incluidas las del Abogado) están en «Evidencias y objeciones»; responderlas es trabajo de una persona.`)));
}

const SVG = "http://www.w3.org/2000/svg";
const sv = (t, at = {}, ...h) => { const n = document.createElementNS(SVG, t); for (const [k, v] of Object.entries(at)) if (v !== null && v !== undefined) n.setAttribute(k, String(v)); for (const x of h) n.append(x instanceof Node ? x : document.createTextNode(String(x))); return n; };
/** Mapa simple en círculo, sin animación (Intel UHD): actores y relaciones; lo sin fuente va punteado. */
function mapaActores(r) {
  const act = L(r.doc.actores), n = act.length;
  if (!n) return el("p", { clase: "sala-vacio" }, "Sin actores.");
  const W = 640, Hh = 360, cx = W / 2, cy = Hh / 2, R = Math.min(W, Hh) / 2 - 50;
  const pos = new Map(act.map((a, i) => [a.id, [cx + R * Math.cos((2 * Math.PI * i) / n - Math.PI / 2), cy + R * Math.sin((2 * Math.PI * i) / n - Math.PI / 2)]]));
  const ver = new Set(r.relaciones.verificables.map((x) => x.id));
  const lineas = L(r.doc.relaciones).filter((x) => pos.has(x.de) && pos.has(x.a)).map((x) => { const [x1, y1] = pos.get(x.de), [x2, y2] = pos.get(x.a);
    return sv("g", { "data-relacion": x.id, "data-verificable": ver.has(x.id) ? "si" : "no" }, sv("line", { x1, y1, x2, y2, class: `csi-mapa-linea${ver.has(x.id) ? "" : " csi-mapa-sin"}` }), sv("text", { x: (x1 + x2) / 2, y: (y1 + y2) / 2 - 6, class: "csi-mapa-rel", "text-anchor": "middle" }, x.tipo)); });
  const nodos = act.map((a) => { const [x, y] = pos.get(a.id); return sv("g", { "data-nodo-actor": a.id }, sv("circle", { cx: x, cy: y, r: 9, class: `csi-mapa-nodo csi-mapa-${a.tipo}` }), sv("text", { x, y: y + 24, class: "csi-mapa-nombre", "text-anchor": "middle" }, a.nombre.length > 34 ? `${a.nombre.slice(0, 33)}…` : a.nombre)); });
  return el("div", { clase: "csi-mapa" }, sv("svg", { viewBox: `0 0 ${W} ${Hh}`, role: "img", "aria-label": `Mapa de ${n} actores y ${L(r.doc.relaciones).length} relaciones`, class: "csi-mapa-svg" }, ...lineas, ...nodos));
}

// ---------- Nueva investigación (laboratorio de la sesión) ----------
const campo = (id, etiqueta, extra = {}) => el("label", { clase: "csi-campo" }, `${etiqueta} `, el(extra.area ? "textarea" : "input", { id: `csi-lab-${id}`, type: extra.area ? null : "text", rows: extra.area ? "2" : null, placeholder: extra.ph ?? null, value: extra.valor ?? null }));
const selector = (id, etiqueta, opciones) => el("label", { clase: "csi-campo" }, `${etiqueta} `, el("select", { id: `csi-lab-${id}` }, ...opciones.map((o) => el("option", { value: o }, o))));
const val = (id) => document.getElementById(`csi-lab-${id}`)?.value.trim() ?? "";
const ids = (id) => val(id).split(",").map((x) => x.trim()).filter(Boolean);
const puntos = (id) => val(id).split(";").map((x) => x.trim()).filter(Boolean);
const instante = (v) => (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) ? `${v}:00${zonaLocal()}` : v);
function zonaLocal() { const m = -new Date().getTimezoneOffset(); const s = m >= 0 ? "+" : "-"; const a = Math.abs(m); return `${s}${String(Math.floor(a / 60)).padStart(2, "0")}:${String(a % 60).padStart(2, "0")}`; }
const ahoraConZona = () => { const d = new Date(); const local = new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 19); return `${local}${zonaLocal()}`; };

function laboratorio(csi, redibujar) {
  const autor = () => ({ tipo: "humano", identificador: val("alias") || "sin-alias" });
  const decir = (ok, t) => { lab.mensajes = [{ ok, t }, ...lab.mensajes].slice(0, 6); redibujar(); };
  const cambio = async (accion, datos) => {
    if (!lab.inv) return decir(false, "Primero crea la investigación.");
    const r = await aplicarCambio(lab.inv, { accion, datos }, { autor: autor(), fecha: ahoraConZona() });
    if (!r.ok) return decir(false, r.errores.join(" · "));
    lab.inv = r.inv; decir(true, `${accion}: listo (historial ${r.inv.historial.length}).`);
  };
  const practica = () => document.getElementById("csi-practica")?.checked !== false;
  const form = (titulo, k, hijos, accion) => el("details", { clase: "sala-seccion", "data-form": k, open: estadoUI.abiertos?.has(k) || (k === "crear" && !lab.inv) }, el("summary", {}, titulo), el("div", { clase: "csi-form" }, ...hijos, el("button", { type: "button", clase: "boton boton-chico", "data-enviar": k, onclick: accion }, "Aplicar")));
  const an = lab.inv ? analizarInvestigacion(lab.inv) : null;
  const res = lab.pred ? resumirPredicciones(lab.pred, Date.now()) : null;
  return [
    el("p", { clase: "sala-nota" }, "Construye una investigación paso a paso. Todo pasa por las mismas reglas que el caso DEMO; nada se guarda solo: descarga los archivos y guárdalos en datos/csi/registro/ (local, fuera de git). Sin IA de pago."),
    el("p", {}, campo("alias", "Tu alias (identidad declarada):", { valor: "diego" }), " ", el("label", {}, el("input", { type: "checkbox", id: "csi-practica", checked: !lab.inv || lab.inv.es_demo }), " Práctica (DEMO: fuentes ficticias)"), " ", selector("naturaleza", "Si es REAL:", NATURALEZAS_ESTUDIO.filter((n) => n !== "demo"))),
    el("div", { clase: "csi-mensajes", role: "status", "aria-live": "polite" }, ...lab.mensajes.map((m) => el("p", { clase: m.ok ? "sala-nota" : "nexus-mal" }, m.t))),
    form("1. Crear investigación", "crear", [campo("id", "Id"), campo("titulo", "Título"), campo("pregunta", "Pregunta principal", { area: true }), campo("acont", "Acontecimiento"), campo("fecha", "Fecha del acontecimiento", { ph: "AAAA-MM-DD" })], async () => {
      const r = await crearInvestigacion({ id: val("id"), titulo: val("titulo"), pregunta: val("pregunta"), acontecimiento: { descripcion: val("acont"), fecha: val("fecha") }, autor: autor(), fecha: ahoraConZona(), es_demo: practica(), version: "0.2", naturaleza_estudio: practica() ? "demo" : val("naturaleza") || "prospectivo" });
      if (!r.ok) return decir(false, r.errores.join(" · "));
      lab.inv = r.inv; lab.pred = registroVacioPredicciones(r.inv.es_demo); decir(true, `Investigación ${r.inv.id} creada (${r.inv.es_demo ? "DEMO" : `REAL · ${r.inv.naturaleza_estudio}`}).`);
    }),
    form("1b. Alcance y criterios de fuentes (antes de la primera fuente; no se reescribe)", "alcance", [campo("a-desc", "Alcance", { area: true }), campo("a-desde", "Periodo desde", { ph: "AAAA-MM-DD" }), campo("a-hasta", "Periodo hasta", { ph: "AAAA-MM-DD" }), campo("a-criterios", "Criterios de selección (separa con ;)", { area: true }), campo("a-incluye", "Incluye (;)"), campo("a-excluye", "Excluye (;)")],
      () => cambio("definir_alcance", { descripcion: val("a-desc"), periodo: { desde: val("a-desde"), hasta: val("a-hasta") }, criterios_fuentes: puntos("a-criterios"), incluye: puntos("a-incluye"), excluye: puntos("a-excluye") })),
    form("2. Agregar fuente", "fuente", [campo("f-id", "Id"), campo("f-titulo", "Título"), campo("f-editor", "Institución o medio"), selector("f-tipo", "Tipo", TIPOS_FUENTE_02), selector("f-clase", "Clase", CLASES_FUENTE), selector("f-estado", "Estado", ESTADOS_FUENTE),
      campo("f-fecha", "Publicada", { ph: "AAAA-MM-DD o AAAA-MM-DDThh:mm" }), campo("f-disp", "Disponible desde (si fue pública antes de esta copia)", { ph: "AAAA-MM-DD" }), campo("f-disp-segun", "¿Según qué? (para «disponible»)"),
      campo("f-enlace", "URL o referencia"), campo("f-extracto", "Extracto (lo relevante que dice)", { area: true }), selector("f-ext-tipo", "Tipo de extracto", ["parafrasis", "cita_textual", "dato"]), campo("f-limit", "Limitaciones (;)"), campo("f-motivo", "Si está pendiente: por qué")],
      () => {
        const demo = lab.inv?.es_demo === true, estado = val("f-estado"), ref = val("f-enlace");
        const f = { id: val("f-id"), titulo: val("f-titulo"), editor: val("f-editor"), tipo: val("f-tipo"), clase: val("f-clase"), estado, publicada_en: instante(val("f-fecha")), ...(demo ? { ficticia: true } : {}) };
        if (ref) f[/^https?:\/\//i.test(ref) ? "enlace" : "referencia"] = ref;
        if (val("f-disp")) { f.disponible_en = instante(val("f-disp")); f.disponible_segun = val("f-disp-segun"); }
        if (val("f-extracto")) { f.extracto = val("f-extracto"); f.extracto_tipo = val("f-ext-tipo"); }
        if (puntos("f-limit").length) f.limitaciones = puntos("f-limit");
        if (estado === "pendiente") f.pendiente_motivo = val("f-motivo");
        if (!demo && estado === "consultada") { f.consultada_en = ahoraConZona(); f.metodo_consulta = "manual"; }
        return cambio("agregar_fuente", { fuente: f });
      }),
    form("3. Agregar enunciado", "enunciado", [campo("e-id", "Id"), selector("e-tipo", "Tipo", TIPOS_ENUNCIADO), campo("e-texto", "Texto", { area: true }), campo("e-fuentes", "Fuentes (ids, con comas)"), selector("e-sobre", "Sobre", TEMAS), campo("e-actor", "Actor (id, opcional)"), campo("e-de", "Inferido de / escenario / predicción (ids)"), campo("e-cita", "Cita textual (opcional; debe estar en el extracto)")], () => {
      const t = val("e-tipo"), extra = ids("e-de");
      const x = { id: val("e-id"), tipo: t, texto: val("e-texto"), fuentes: ids("e-fuentes"), sobre: val("e-sobre") };
      if (val("e-cita")) x.cita = val("e-cita");
      if (val("e-actor")) x.actor_id = val("e-actor");
      if (t === "inferencia") x.inferido_de = extra; if (t === "simulacion") x.escenario_id = extra[0]; if (t === "prediccion") x.prediccion_id = extra[0];
      if (x.actor_id && lab.inv && !lab.inv.actores.includes(x.actor_id)) return cambio("agregar_actor", { actor_id: x.actor_id }).then(() => cambio("agregar_enunciado", { enunciado: x }));
      return cambio("agregar_enunciado", { enunciado: x });
    }),
    form("4. Agregar hipótesis", "hipotesis", [campo("h-id", "Id"), selector("h-cat", "Categoría", CATEGORIAS), campo("h-texto", "Enunciado", { area: true }), campo("h-favor", "A favor (ids)"), campo("h-contra", "En contra (ids)"), campo("h-refuta", "Se refuta si…"), campo("h-faltan", "Datos que faltan"), campo("h-obs", "Observación que la distinguiría de una rival (opcional)"), campo("h-obs-de", "…frente a (ids de hipótesis)")],
      async () => {
        await cambio("agregar_hipotesis", { hipotesis: { id: val("h-id"), categoria: val("h-cat"), enunciado: val("h-texto"), a_favor: ids("h-favor"), en_contra: ids("h-contra"), condiciones_refutacion: val("h-refuta") ? [val("h-refuta")] : [], datos_faltantes: val("h-faltan") ? [val("h-faltan")] : [] } });
        if (val("h-obs") && ids("h-obs-de").length && lab.inv?.hipotesis.some((h) => h.id === val("h-id"))) await cambio("agregar_observacion", { hipotesis_id: val("h-id"), observacion: { texto: val("h-obs"), distingue_de: ids("h-obs-de") } });
      }),
    form("5. Objeción (Abogado del Diablo)", "objecion", [campo("o-id", "Id"), campo("o-hip", "Hipótesis (id o vacío)"), selector("o-tipo", "Tipo", TIPOS_OBJECION), campo("o-texto", "Objeción", { area: true })],
      () => cambio("agregar_objecion", { objecion: { id: val("o-id"), hipotesis_id: val("o-hip") || null, tipo: val("o-tipo"), texto: val("o-texto") } })),
    form("6. Revisión humana", "revision", [selector("r-estado", "Estado", ESTADOS_REVISION), campo("r-nota", "Nota")], () => cambio("revision", { estado: val("r-estado"), nota: val("r-nota") })),
    form("7. Registrar predicción (antes del acontecimiento)", "prediccion", [campo("p-id", "Id"), campo("p-hip", "Hipótesis (id)"), campo("p-texto", "Predicción", { area: true }), campo("p-obs", "Resultado observable"), campo("p-desde", "Horizonte desde", { ph: "AAAA-MM-DDThh:mm" }), campo("p-hasta", "Horizonte hasta", { ph: "AAAA-MM-DDThh:mm" }), campo("p-ok", "Acertada si…"), campo("p-mal", "Fallida si…"), campo("p-ind", "Indeterminada si…"), campo("p-ref", "Referencia simple (p. ej. «sin cambio»)")], async () => {
      if (!lab.inv) return decir(false, "Primero crea la investigación.");
      const contenido = { id: val("p-id"), investigacion_id: lab.inv.id, hipotesis_id: val("p-hip") || undefined, hipotesis_original: val("p-texto"), resultado_observable: val("p-obs"), horizonte: { desde: instante(val("p-desde")), hasta: instante(val("p-hasta")) }, criterios: { acertada: val("p-ok"), fallida: val("p-mal"), indeterminada: val("p-ind") }, fuentes_conocidas: [], supuestos: [], version_reglas: "csi-reglas 0.1 (manual)", referencia: { descripcion: val("p-ref"), resultado_esperado: val("p-ref") } };
      if (!contenido.hipotesis_id) delete contenido.hipotesis_id;
      const r = await agregarEntrada(lab.pred, { tipo: "registro", contenido, registrado_en: ahoraConZona(), registrado_por: autor() });
      if (!r.ok) return decir(false, r.errores.join(" · "));
      lab.pred = r.doc; decir(true, `Predicción ${contenido.id} registrada (entrada ${r.doc.entradas.length}).`);
    }),
    form("8. Evaluar predicción", "evaluar", [campo("v-id", "Predicción (id)"), selector("v-res", "Resultado", RESULTADOS), selector("v-ref", "Resultado de la referencia", RESULTADOS), campo("v-ev", "Evidencia del resultado (título)"), campo("v-fecha", "Publicada", { ph: "AAAA-MM-DDThh:mm" }), campo("v-nota", "Nota")], async () => {
      if (!lab.pred) return decir(false, "No hay predicciones en esta sesión.");
      const evidencia = val("v-ev") ? [{ titulo: val("v-ev"), publicada_en: instante(val("v-fecha")), ...(lab.pred.es_demo ? { ficticia: true } : {}) }] : [];
      const r = await agregarEntrada(lab.pred, { tipo: "evaluacion", contenido: { prediccion_id: val("v-id"), resultado: val("v-res"), resultado_referencia: val("v-ref"), evidencia, nota: val("v-nota") }, registrado_en: ahoraConZona(), registrado_por: autor() });
      if (!r.ok) return decir(false, r.errores.join(" · "));
      lab.pred = r.doc; decir(true, "Evaluación registrada (la predicción original no cambia).");
    }),
    lab.inv ? seccion(`Tu investigación: ${lab.inv.titulo} (${lab.inv.es_demo ? "DEMO" : "REAL"})`,
      el("p", { clase: "sala-nota" }, `Enunciados: ${Object.entries(an.conteo).map(([k, v]) => `${TIPO_TXT[k]} ${v}`).join(" · ")} · revisión ${an.revision}`),
      lista(an.hipotesis.map((h) => `${h.id}: ${ESTADO_HIP[h.estado]}${h.motivos.length ? ` — ${h.motivos.join("; ")}` : ""}`), "Sin hipótesis."),
      res ? el("p", { clase: "sala-nota" }, `Predicciones: ${res.total} · ${res.filas.map((f) => `${f.id}: ${ESTADO_PRED[f.estado]}`).join(" · ")}`) : null,
      el("p", {}, descarga(lab.inv, "investigacion.json", "Descargar investigación"), " ", lab.pred ? descarga(lab.pred, "predicciones.json", "Descargar predicciones") : null, " ",
        el("button", { type: "button", clase: "boton boton-chico", "data-lab-abogado": "", onclick: async () => {
          const rv = revisarAbogado(lab.inv, { predicciones: res });
          const sug = objecionesSugeridas(lab.inv, rv);
          for (const o of sug) { const r = await aplicarCambio(lab.inv, { accion: "agregar_objecion", datos: { objecion: o } }, { autor: AUTOR_ABOGADO, fecha: ahoraConZona() }); if (r.ok) lab.inv = r.inv; }
          decir(true, `Abogado del Diablo (código): ${rv.alertas_total} alerta(s); ${sug.length} objeción(es) nuevas registradas como abiertas. Responderlas es trabajo tuyo.`);
        } }, "Abogado del Diablo"), " ",
        ...lab.inv.hipotesis.map((h) => el("button", { type: "button", clase: "boton boton-chico", "data-lab-propuesta": h.id, onclick: () => {
          const r = prepararPropuesta(lab.inv, h.id, { autor: autor(), fecha: ahoraConZona(), predicciones: res });
          decir(r.ok, r.ok ? `Propuesta ${h.id}: Nexus dice «${r.propuesta.revision_esceptica.dictamen}»; decisión humana pendiente. Bloqueos: ${r.propuesta.bloqueos.join(" ") || "ninguno"}` : r.errores.join(" · "));
        } }, `Propuesta ${h.id} → Nexus`)))) : null,
  ];
}

/** Para pruebas: limpia el laboratorio de la sesión. */
export function reiniciarLaboratorioCSI() { lab.inv = null; lab.pred = null; lab.mensajes = []; estadoUI.pestana = "resumen"; estadoUI.propuesta = null; estadoUI.ancla = null; estadoUI.verificacion = null; }
/** Al cambiar de conjunto (DEMO / HISTÓRICO / REAL) se olvida lo calculado sobre el anterior. */
export function olvidarCalculosCSI() { estadoUI.propuesta = null; estadoUI.ancla = null; estadoUI.verificacion = null; }
