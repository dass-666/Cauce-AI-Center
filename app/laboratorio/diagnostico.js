// Laboratorio de IA · fase 3.1 · DIAGNÓSTICO de un expediente sin revelar su contenido.
//
// Cuando una prueba con un modelo real falla, la persona necesita saber QUÉ falló sin tener que leer todo el expediente
// ni mandarme respuestas privadas. Este módulo resume, por rol: cuántos intentos de importación hubo, qué validación
// falló y de qué categoría (formato · contrato · evidencia · seguridad), si el fallo se recupera sin cambiar el
// significado de la respuesta, qué necesita revisión humana y qué pruebas convendría hacer después.
//
// Privacidad: el diagnóstico NO incluye el texto de las respuestas, de la ficha, de la pregunta ni de la solicitud.
// Solo códigos, conteos, identificadores del Laboratorio, el modelo DECLARADO y huellas recortadas (12 caracteres).
// No se envía a ningún sitio: se descarga como archivo o se muestra en pantalla.

import { L, esObj, ROLES } from "./base.js";
import { ETIQUETA_ROL } from "./coordinador.js";
import { faseDe, naturalezaDe } from "./presentacion.js";
import { estadoDecision } from "./identidad.js";
import { CATEGORIAS_FALLO } from "./manual.js";

export const CONTRATO_DIAGNOSTICO = "cauce.lab.diagnostico";
export const VERSION_DIAGNOSTICO = "0.1";

/** Alertas de lab-V que hablan de evidencia (la cita o el respaldo) y no de forma. */
const ALERTAS_EVIDENCIA = new Set(["fuente_inexistente", "extracto_no_encontrado", "copia_alterada", "copia_ausente", "fuente_pendiente", "sin_huella", "extracto_demasiado_corto", "extracto_ambiguo", "posible_fuera_de_contexto", "posterior_al_corte", "fecha_desconocida", "fecha_indeterminada", "texto_no_verificable", "hecho_sin_cita", "hecho_sin_cita_utilizable", "menciona_fecha_posterior_al_corte", "inferencia_sin_base", "referencia_inexistente", "respuesta_ia_como_fuente", "lectura_vencida", "rol_afirma_hechos_nuevos", "base_sin_respaldo"]);
const ALERTAS_SEGURIDAD = new Set(["posible_inyeccion_de_instrucciones", "contiene_instrucciones_no_ejecutadas", "recomendacion_financiera", "autoaprobacion"]);
/** Alertas que una persona DEBE mirar (no las decide el código). */
const ALERTAS_HUMANAS = new Set(["posible_contradiccion_declarada", "posible_fuera_de_contexto", "posible_inyeccion_de_instrucciones"]);

/** Qué prueba conviene después de cada síntoma. Son sugerencias de método, no conclusiones. */
const PRUEBAS_SUGERIDAS = Object.freeze({
  json_truncado: "La respuesta se cortó: pide al modelo la respuesta en dos partes (afirmaciones primero) o con menos afirmaciones; si se repite, el formato es demasiado largo para ese modelo.",
  json_invalido: "El JSON llegó roto: pide «solo el JSON, sin explicación» y compara si el error se repite en una conversación nueva.",
  campos_desconocidos: "El modelo agregó campos propios: repite la solicitud subrayando «solo las claves de la plantilla» y anota qué campos inventa (sirve para ajustar la plantilla).",
  formato_desconocido: "El modelo cambió formato o versión: comprueba que se pegó la solicitud completa, incluida la plantilla final.",
  rol_distinto: "Se pegó la respuesta de otro rol: usa una conversación por rol o etiqueta cada una antes de copiar.",
  encargo_distinto: "La respuesta es de otro encargo: borra la conversación anterior o abre una nueva por consulta.",
  huella_encargo_distinta: "El modelo respondió a una solicitud vieja: copia la solicitud actual otra vez (la huella cambia con cada ronda).",
  plantilla_sin_rellenar: "Quedaron «…» de la plantilla: pide al modelo dejar las listas vacías cuando no tenga nada que decir.",
  respuesta_repetida: "Se pegó dos veces la misma respuesta: no hace falta repetir nada.",
  respuesta_reutilizada: "Se intentó reutilizar una respuesta de otro trabajo: cada encargo necesita la suya.",
  demasiado_larga: "La respuesta superó el límite: pide menos afirmaciones por rol o divide la pregunta.",
  extracto_no_encontrado: "Las citas no son literales: pide al modelo «copia la línea entera de la ficha, sin cambiar una letra ni el punto final» y prueba con una sola afirmación para ver si es capaz.",
  fuente_inexistente: "El modelo citó algo fuera del catálogo: comprueba si usa conocimiento externo; repite recordando que solo existe la fuente de la ficha.",
  hecho_sin_cita: "Hechos sin cita: pide que cada «hecho_citado» traiga su línea o que lo baje a «inferencia».",
  inferencia_sin_base: "Inferencias sin base: pide que cada inferencia diga en qué afirmación previa se apoya («se_basa_en»).",
  referencia_inexistente: "El rol se refirió a algo que el rol anterior no dijo: comprueba que la solicitud incluyó las salidas previas completas.",
  posible_inyeccion_de_instrucciones: "Hay texto parecido a una orden: léelo tú; si es un falso positivo, anótalo para afinar el detector; si es real, repite en una conversación nueva.",
  lectura_vencida: "La ficha es vieja: pide una lectura nueva del motor antes de repetir el análisis.",
  posible_contradiccion_declarada: "El modelo declaró contradicciones: decide tú si son reales (el código no puede).",
  sin_fallos: "No hubo fallos: repite la misma consulta con otra conversación (o con otro modelo) y compara con el banco de comparación (herramientas/comparar-modelos.mjs).",
});

const corta = (h) => (typeof h === "string" && h.length >= 12 ? `${h.slice(0, 12)}…` : null);
const cuenta = (lista) => { const m = new Map(); for (const k of lista) m.set(k, (m.get(k) ?? 0) + 1); return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([codigo, veces]) => ({ codigo, veces })); };

/**
 * Diagnóstico de un expediente del Laboratorio.
 * @param x expediente vivo ({trabajo, ficha, encargos, ejecuciones, verificaciones, informe, importaciones})
 * @param opciones { generado_en: instante con zona }
 */
export function diagnosticarExpediente(x, { generado_en }) {
  const t = x.trabajo;
  const fase = faseDe(x), nat = naturalezaDe(x);
  const roles = ROLES.map((rol) => diagnosticarRol(x, rol));
  const conFallo = roles.filter((r) => r.estado !== "aceptado" && r.estado !== "sin_empezar");
  const rolQueFallo = conFallo.find((r) => r.estado === "en_error")?.rol ?? conFallo.find((r) => r.estado === "rechazos_sin_aceptar" || r.estado === "evidencia_con_fallas")?.rol ?? null;
  const validaciones = [...new Set(roles.flatMap((r) => [...r.fallos_importacion.map((f) => f.codigo), ...r.lab_v.alertas.filter((a) => ALERTAS_EVIDENCIA.has(a.codigo) || ALERTAS_SEGURIDAD.has(a.codigo)).map((a) => a.codigo)]))];
  const categorias = [...new Set(roles.flatMap((r) => r.categorias))];
  const categoria = CATEGORIAS_FALLO.find((c) => categorias.includes(c)) ?? null;
  // Recuperable sin cambiar el significado: todos los fallos de importación son de forma y lab-V no marcó la evidencia.
  const soloForma = roles.every((r) => r.fallos_importacion.every((f) => f.recuperable) && !r.lab_v.alertas.some((a) => ALERTAS_EVIDENCIA.has(a.codigo) || ALERTAS_SEGURIDAD.has(a.codigo)));
  const recuperable = validaciones.length ? soloForma : null;
  const humano = [];
  const pendientes = roles.reduce((n, r) => n + r.lab_v.respaldo_semantico_pendiente, 0);
  if (pendientes) humano.push(`${pendientes} afirmación(es) con cita existente cuyo APOYO a lo afirmado solo puede juzgar una persona.`);
  const contradicciones = roles.reduce((n, r) => n + (r.lab_v.alertas.find((a) => a.codigo === "posible_contradiccion_declarada")?.veces ?? 0), 0);
  if (contradicciones) humano.push(`${contradicciones} contradicción(es) declarada(s) por el modelo: decidir si son reales.`);
  const objeciones = [...x.ejecuciones.values()].filter((e) => e.rol === "critico").reduce((n, e) => n + L(e.objeciones).length, 0);
  if (objeciones) humano.push(`${objeciones} objeción(es) del Abogado del Diablo: decidir si tienen razón.`);
  for (const r of roles) for (const a of r.lab_v.alertas) if (ALERTAS_HUMANAS.has(a.codigo) && a.codigo !== "posible_contradiccion_declarada") humano.push(`${ETIQUETA_ROL[r.rol]}: ${a.veces} alerta(s) «${a.codigo}» que requieren lectura humana.`);
  const decision = estadoDecision(t);
  if (decision.decision === "pendiente" && ["requiere_revision", "requiere_evidencia"].includes(t.estado)) humano.push("La decisión final (aprobar, rechazar o pedir evidencia) está pendiente: solo una persona puede tomarla.");
  const pruebas = [...new Set([...validaciones.filter((c) => PRUEBAS_SUGERIDAS[c]).map((c) => PRUEBAS_SUGERIDAS[c]), ...(validaciones.length ? [] : [PRUEBAS_SUGERIDAS.sin_fallos])])];
  return {
    contrato: CONTRATO_DIAGNOSTICO, version_contrato: VERSION_DIAGNOSTICO, generado_en, trabajo_id: t.id, es_demo: t.es_demo, estado: t.estado, fase: fase.fase, naturaleza: nat.tipo,
    adaptador: t.adaptador?.id ?? null, modelo_declarado: [...x.ejecuciones.values()].map((e) => e.autor?.modelo).find(Boolean) ?? null,
    roles, rol_que_fallo: rolQueFallo, validaciones_fallidas: validaciones, categorias, categoria_principal: categoria, recuperable_sin_cambiar_significado: recuperable,
    requiere_revision_humana: humano, pruebas_sugeridas: pruebas,
    privacidad: "Sin texto de respuestas, ficha, pregunta ni solicitud: solo códigos, conteos, ids del Laboratorio, modelo declarado y huellas recortadas.",
  };
}

function diagnosticarRol(x, rol) {
  const paso = L(x.trabajo.pasos).find((p) => p.rol === rol);
  const imps = L(x.importaciones).filter((i) => i.rol === rol);
  const aceptadas = imps.filter((i) => i.aceptada), rechazadas = imps.filter((i) => !i.aceptada);
  const fallos = rechazadas.flatMap((i) => L(i.fallos));
  const ej = paso ? x.ejecuciones.get(paso.ejecuciones.at(-1)) : null;
  const v = ej ? x.verificaciones.get(ej.id) : null;
  const alertas = cuenta(L(v?.alertas).map((a) => a.codigo));
  const evidenciaConFallas = alertas.some((a) => ALERTAS_EVIDENCIA.has(a.codigo));
  const categorias = [...new Set([...fallos.map((f) => f.categoria), ...(evidenciaConFallas ? ["evidencia"] : []), ...(alertas.some((a) => ALERTAS_SEGURIDAD.has(a.codigo)) ? ["seguridad"] : [])])];
  let estado = "sin_empezar";
  if (ej && ej.estado !== "terminado") estado = "en_error";
  else if (ej && v) estado = evidenciaConFallas || v.resultado === "con_fallas" ? "evidencia_con_fallas" : "aceptado";
  else if (ej && !v) estado = "sin_verificar";
  else if (rechazadas.length) estado = "rechazos_sin_aceptar";
  else if (x.trabajo.espera?.rol === rol) estado = "esperando_respuesta";
  return {
    rol, estado, intentos: imps.length, aceptadas: aceptadas.length, rechazadas: rechazadas.length,
    fallos_importacion: cuenta(fallos.map((f) => f.codigo)).map((c) => ({ ...c, categoria: fallos.find((f) => f.codigo === c.codigo).categoria, recuperable: fallos.filter((f) => f.codigo === c.codigo).every((f) => f.recuperable) })),
    correcciones_de_forma: cuenta(imps.flatMap((i) => L(i.correcciones))), categorias,
    autoria: ej?.autor?.tipo ?? null, ejecucion_id: ej?.id ?? null, respuesta_sha256: corta(ej?.intercambio?.respuesta_sha256 ?? aceptadas.at(-1)?.respuesta_sha256),
    lab_v: { resultado: v?.resultado ?? null, alertas, afirmaciones: L(v?.afirmaciones).length, citas_utilizables: L(v?.citas).filter((c) => c.cita_utilizable).length, citas: L(v?.citas).length,
      respaldo_semantico_pendiente: L(v?.afirmaciones).filter((a) => a.estado_cita === "con_cita_utilizable" && a.respaldo_semantico === "pendiente_revision_humana").length },
  };
}

/** El diagnóstico en Markdown, para pegarlo en un mensaje sin exponer contenido. */
export function diagnosticoMarkdown(d) {
  const p = [`# Diagnóstico del Laboratorio · ${d.trabajo_id}`, "", `Generado ${d.generado_en} · ${d.es_demo ? "datos DEMO" : "datos REALES"} · estado «${d.estado}» · fase «${d.fase}» · naturaleza «${d.naturaleza}» · modelo declarado: ${d.modelo_declarado ?? "ninguno"}`, "", `> ${d.privacidad}`, ""];
  p.push("## Resumen", "", `- Rol que falló: **${d.rol_que_fallo ? ETIQUETA_ROL[d.rol_que_fallo] : "ninguno"}**`, `- Validaciones fallidas: ${d.validaciones_fallidas.length ? d.validaciones_fallidas.join(", ") : "ninguna"}`, `- Categoría principal: ${d.categoria_principal ?? "—"} (${d.categorias.join(", ") || "sin fallos"})`, `- ¿Recuperable sin cambiar el significado? ${d.recuperable_sin_cambiar_significado === null ? "no aplica (sin fallos)" : d.recuperable_sin_cambiar_significado ? "sí: solo forma" : "no: hay fallos de evidencia o seguridad que requieren otra respuesta"}`, "");
  p.push("## Por rol", "", "| Rol | Estado | Intentos (acept./rech.) | Fallos de importación | Correcciones de forma | lab-V | Citas útiles | Pendiente humano |", "|---|---|---|---|---|---|---|---|");
  for (const r of d.roles) p.push(`| ${ETIQUETA_ROL[r.rol]} | ${r.estado} | ${r.intentos} (${r.aceptadas}/${r.rechazadas}) | ${r.fallos_importacion.map((f) => `${f.codigo}×${f.veces} [${f.categoria}${f.recuperable ? ", recuperable" : ""}]`).join("; ") || "—"} | ${r.correcciones_de_forma.map((c) => `${c.codigo}×${c.veces}`).join("; ") || "—"} | ${r.lab_v.resultado ?? "—"}${r.lab_v.alertas.length ? `: ${r.lab_v.alertas.map((a) => `${a.codigo}×${a.veces}`).join(", ")}` : ""} | ${r.lab_v.citas ? `${r.lab_v.citas_utilizables}/${r.lab_v.citas}` : "—"} | ${r.lab_v.respaldo_semantico_pendiente} |`);
  p.push("", "## Requiere revisión humana", "", ...(d.requiere_revision_humana.length ? d.requiere_revision_humana.map((t) => `- ${t}`) : ["- Nada pendiente de una persona por ahora."]));
  p.push("", "## Pruebas que convendría ejecutar", "", ...d.pruebas_sugeridas.map((t) => `- ${t}`), "");
  return `${p.join("\n")}\n`;
}

/** Validación mínima del documento (para quien lo reciba). */
export function validarDiagnostico(d) {
  const errores = [];
  if (!esObj(d) || d.contrato !== CONTRATO_DIAGNOSTICO || d.version_contrato !== VERSION_DIAGNOSTICO) errores.push(`No es ${CONTRATO_DIAGNOSTICO} ${VERSION_DIAGNOSTICO}.`);
  else {
    if (!Array.isArray(d.roles) || d.roles.length !== ROLES.length) errores.push("roles debe tener una entrada por rol.");
    if (d.categoria_principal !== null && !CATEGORIAS_FALLO.includes(d.categoria_principal)) errores.push("categoria_principal desconocida.");
    const texto = JSON.stringify(d);
    for (const k of ["pregunta", "extracto", "texto_ficha", "solicitud"]) if (new RegExp(`"${k}"\\s*:`).test(texto)) errores.push(`El diagnóstico no debe traer «${k}».`);
  }
  return { ok: !errores.length, errores };
}
