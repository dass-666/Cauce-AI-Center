// CSI · contrato `cauce.csi.investigacion` 0.1 y motor de investigaciones (bloque 3).
// Una investigación separa SIEMPRE qué es hecho, declaración, inferencia, simulación o predicción. El motor no borra:
// cada cambio se anexa al historial con una cadena de huellas (SHA-256), así un cambio silencioso se detecta.
// Determinista, sin IA y sin red.

import {
  VERSION_CSI, ID, esObj, L, esAutor, texto, esFechaConZona, esFechaODia, ms, huellaDe, sha256, jsonCanonico, mismoId, clon,
  claves, controlesComunes, validarFuentes, esFuenteNexus, seguroAntes, FUENTES_DOCUMENTALES,
} from "./base.js";

export const CONTRATO_INVESTIGACION = "cauce.csi.investigacion";
/** Las cinco clases de enunciado (bloque 3). Solo hechos y declaraciones pueden ser evidencia. */
export const TIPOS_ENUNCIADO = ["hecho", "declaracion", "inferencia", "simulacion", "prediccion"];
export const EVIDENCIABLES = ["hecho", "declaracion"];
export const TEMAS = ["dato", "conducta", "intencion", "contexto"];
export const CATEGORIAS = ["fundamentales", "liquidez", "oportunista", "manipulacion", "otra"];
export const ESTADOS_REVISION = ["borrador", "en_revision", "revisada", "devuelta"];
export const NIVELES_INCERTIDUMBRE = ["baja", "media", "alta", "no_estimada"];
export const TIPOS_OBJECION = ["explicacion_alternativa", "sesgo", "dato_faltante", "circularidad", "fuente_debil"];

const C = {
  raiz: ["contrato", "version_contrato", "id", "titulo", "pregunta", "creada_en", "creada_por", "es_demo", "acontecimiento", "actores", "fuentes", "enunciados", "incentivos", "hipotesis", "supuestos", "incertidumbre", "objeciones", "escenarios", "revision", "historial"],
  acontecimiento: ["descripcion", "fecha", "mercado"],
  enunciado: ["id", "tipo", "texto", "registrado_en", "fuentes", "actor_id", "sobre", "inferido_de", "escenario_id", "prediccion_id", "contradice", "retirado"],
  incentivo: ["id", "actor_id", "texto", "basado_en"],
  hipotesis: ["id", "categoria", "enunciado", "a_favor", "en_contra", "supuestos", "condiciones_refutacion", "datos_faltantes", "origen"],
  objecion: ["id", "hipotesis_id", "tipo", "texto", "autor", "estado", "respuesta"],
  revision: ["estado", "revisor", "fecha", "nota"],
  historial: ["n", "fecha", "autor", "accion", "detalle", "huella_anterior", "huella_contenido", "huella"],
};

/** Validación de FORMA y de las reglas de separación. Con errores la investigación no se registra. */
export function validarInvestigacion(inv) {
  const errores = [], avisos = [];
  const e = (t) => errores.push(t);
  if (!esObj(inv)) return { errores: ["La investigación debe ser un objeto JSON."], avisos };
  claves(inv, C.raiz, "", e);
  for (const k of C.raiz) if (!(k in inv)) e(`${k} es obligatorio.`);
  if (inv.contrato !== CONTRATO_INVESTIGACION) e(`contrato debe ser "${CONTRATO_INVESTIGACION}".`);
  if (inv.version_contrato !== VERSION_CSI) e(`version_contrato debe ser "${VERSION_CSI}".`);
  if (typeof inv.id !== "string" || !ID.test(inv.id)) e("id inválido (letras, números, . _ -).");
  for (const k of ["titulo", "pregunta"]) if (!texto(inv[k])) e(`${k} es obligatorio.`);
  if (!esFechaConZona(inv.creada_en)) e("creada_en: instante ISO con zona horaria.");
  if (!esAutor(inv.creada_por)) e("creada_por: {tipo: humano|codigo|ia, identificador}.");
  if (typeof inv.es_demo !== "boolean") e("es_demo debe ser true o false.");
  const demo = inv.es_demo === true;
  if (!esObj(inv.acontecimiento)) e("acontecimiento debe ser un objeto.");
  else { claves(inv.acontecimiento, C.acontecimiento, "acontecimiento.", e); if (!texto(inv.acontecimiento.descripcion)) e("acontecimiento.descripcion es obligatoria."); if (!esFechaODia(inv.acontecimiento.fecha)) e("acontecimiento.fecha: AAAA-MM-DD o instante con zona."); }
  if (!Array.isArray(inv.actores) || inv.actores.some((a) => typeof a !== "string" || !ID.test(a))) e("actores: lista de ids del registro de actores.");
  validarFuentes(inv.fuentes, { es_demo: demo, e });
  const fuentes = new Map(L(inv.fuentes).map((f) => [f?.id, f]));
  const enun = new Map();

  L(inv.enunciados).forEach((x, i) => {
    const r = `enunciados[${i}].`;
    if (!esObj(x)) return e(`${r} debe ser un objeto.`);
    claves(x, C.enunciado, r, e);
    if (typeof x.id !== "string" || !ID.test(x.id)) return e(`${r}id inválido.`);
    if (enun.has(x.id)) e(`${r}id «${x.id}» repetido.`);
    enun.set(x.id, x);
    if (!TIPOS_ENUNCIADO.includes(x.tipo)) e(`${r}tipo debe ser uno de: ${TIPOS_ENUNCIADO.join(", ")}.`);
    if (!texto(x.texto)) e(`${r}texto es obligatorio.`);
    if (!esFechaConZona(x.registrado_en)) e(`${r}registrado_en: instante con zona (cuándo se anotó).`);
    if (x.sobre !== undefined && !TEMAS.includes(x.sobre)) e(`${r}sobre debe ser uno de: ${TEMAS.join(", ")}.`);
    if (x.actor_id !== undefined && (typeof x.actor_id !== "string" || !L(inv.actores).includes(x.actor_id))) e(`${r}actor_id «${x.actor_id}» no está en actores de la investigación.`);
    const fs = L(x.fuentes);
    if (!Array.isArray(x.fuentes)) e(`${r}fuentes debe ser una lista (puede estar vacía en inferencias y simulaciones).`);
    for (const id of fs) if (!fuentes.has(id)) e(`${r}fuente «${id}» no existe.`);
    const conocidas = fs.map((id) => fuentes.get(id)).filter(Boolean);
    const primarias = conocidas.filter((f) => !esFuenteNexus(f));
    // Protección contra información futura: una fuente no puede respaldar algo anotado antes de publicarse.
    for (const f of conocidas) if (esFechaConZona(x.registrado_en) && !seguroAntes(f, x.registrado_en)) e(`${r}la fuente «${f.id}» (publicada ${f.publicada_en}) es posterior a la anotación (${x.registrado_en}): información futura.`);
    if (x.tipo === "hecho" || x.tipo === "declaracion") {
      if (!primarias.length) e(`${r}un${x.tipo === "hecho" ? " hecho" : "a declaración"} necesita al menos una fuente primaria (Nexus no cuenta: sería circular).`);
      if (conocidas.length !== primarias.length) e(`${r}cita a Nexus como fuente de un ${x.tipo}: las recomendaciones de Nexus no son evidencia primaria.`);
    }
    if (x.tipo === "declaracion" && !x.actor_id) e(`${r}una declaración dice QUIÉN declaró (actor_id): registra lo dicho, no que sea cierto.`);
    // Intenciones privadas: nunca son hecho salvo documento oficial o regulatorio publicado por el propio actor.
    if (x.tipo === "hecho" && x.sobre === "intencion") {
      const doc = primarias.some((f) => FUENTES_DOCUMENTALES.includes(f.tipo) && f.autor_actor_id && f.autor_actor_id === x.actor_id);
      if (!doc) e(`${r}una intención no se registra como hecho sin un documento oficial o regulatorio del propio actor; regístrala como declaración o inferencia.`);
    }
    if (x.tipo === "inferencia" && !L(x.inferido_de).length) e(`${r}una inferencia dice de qué enunciados sale (inferido_de).`);
    if (x.tipo === "simulacion" && !texto(x.escenario_id)) e(`${r}una simulación dice de qué escenario sale (escenario_id).`);
    if (x.tipo === "prediccion" && !texto(x.prediccion_id)) e(`${r}una predicción remite a la memoria de predicciones (prediccion_id).`);
    if (x.retirado !== undefined && !(esObj(x.retirado) && esFechaConZona(x.retirado.fecha) && texto(x.retirado.motivo))) e(`${r}retirado: {fecha con zona, motivo}.`);
  });
  for (const x of enun.values()) {
    for (const id of L(x.inferido_de)) if (!enun.has(id)) e(`enunciado ${x.id}: inferido_de «${id}» no existe.`);
    for (const id of L(x.contradice)) if (!enun.has(id)) e(`enunciado ${x.id}: contradice «${id}» no existe.`);
  }

  L(inv.incentivos).forEach((x, i) => {
    const r = `incentivos[${i}].`;
    if (!esObj(x)) return e(`${r} debe ser un objeto.`);
    claves(x, C.incentivo, r, e);
    if (!texto(x.id) || !texto(x.texto) || !L(inv.actores).includes(x.actor_id)) e(`${r}necesita id, texto y un actor_id de la investigación.`);
    if (!L(x.basado_en).length) e(`${r}un incentivo es siempre inferido: di en qué enunciados se basa (basado_en).`);
    for (const id of L(x.basado_en)) if (!enun.has(id)) e(`${r}basado_en «${id}» no existe.`);
  });

  const hips = new Set();
  L(inv.hipotesis).forEach((h, i) => {
    const r = `hipotesis[${i}].`;
    if (!esObj(h)) return e(`${r} debe ser un objeto.`);
    claves(h, C.hipotesis, r, e);
    if (typeof h.id !== "string" || !ID.test(h.id)) e(`${r}id inválido.`); else if (hips.has(h.id)) e(`${r}id repetido.`); else hips.add(h.id);
    if (!CATEGORIAS.includes(h.categoria)) e(`${r}categoria debe ser una de: ${CATEGORIAS.join(", ")}.`);
    if (!texto(h.enunciado)) e(`${r}enunciado es obligatorio.`);
    for (const k of ["a_favor", "en_contra", "supuestos", "condiciones_refutacion", "datos_faltantes"]) if (!Array.isArray(h[k])) e(`${r}${k} debe ser una lista.`);
    for (const k of ["a_favor", "en_contra"]) for (const id of L(h[k])) {
      const x = enun.get(id);
      if (!x) e(`${r}${k}: «${id}» no existe.`);
      else if (!EVIDENCIABLES.includes(x.tipo)) e(`${r}${k}: «${id}» es ${x.tipo}; solo hechos y declaraciones son evidencia (una ${x.tipo} no se presenta como resultado).`);
    }
    const ambos = L(h.a_favor).filter((id) => L(h.en_contra).includes(id));
    if (ambos.length) e(`${r}«${ambos.join(", ")}» no puede estar a favor y en contra a la vez.`);
  });

  const objs = new Set();
  L(inv.objeciones).forEach((o, i) => {
    const r = `objeciones[${i}].`;
    if (!esObj(o)) return e(`${r} debe ser un objeto.`);
    claves(o, C.objecion, r, e);
    if (!texto(o.id) || objs.has(o.id)) e(`${r}id ausente o repetido.`); else objs.add(o.id);
    if (o.hipotesis_id !== null && !hips.has(o.hipotesis_id)) e(`${r}hipotesis_id «${o.hipotesis_id}» no existe (usa null si es general).`);
    if (!TIPOS_OBJECION.includes(o.tipo)) e(`${r}tipo debe ser uno de: ${TIPOS_OBJECION.join(", ")}.`);
    if (!texto(o.texto) || !esAutor(o.autor)) e(`${r}necesita texto y autor.`);
    if (!["abierta", "respondida"].includes(o.estado)) e(`${r}estado: abierta o respondida.`);
    if (o.estado === "respondida" && !texto(o.respuesta)) e(`${r}una objeción respondida lleva su respuesta.`);
  });
  if (!Array.isArray(inv.supuestos)) e("supuestos debe ser una lista.");
  if (!esObj(inv.incertidumbre) || !NIVELES_INCERTIDUMBRE.includes(inv.incertidumbre.nivel) || !texto(inv.incertidumbre.descripcion)) e(`incertidumbre: {nivel: ${NIVELES_INCERTIDUMBRE.join("|")}, descripcion}.`);
  if (!Array.isArray(inv.escenarios)) e("escenarios debe ser una lista de ids.");
  if (!esObj(inv.revision)) e("revision debe ser un objeto.");
  else {
    claves(inv.revision, C.revision, "revision.", e);
    if (!ESTADOS_REVISION.includes(inv.revision.estado)) e(`revision.estado: ${ESTADOS_REVISION.join(", ")}.`);
    if (["revisada", "devuelta"].includes(inv.revision.estado)) {
      const rv = inv.revision.revisor;
      if (!esAutor(rv) || rv.tipo !== "humano") e("revision.revisor: una revisión la firma una persona (una IA no sustituye la revisión humana).");
      else if (mismoId(rv.identificador, inv.creada_por?.identificador)) e("revision.revisor: quien creó la investigación no puede revisarla (no es independiente).");
    }
  }
  if (!Array.isArray(inv.historial) || !inv.historial.length) e("historial: al menos la creación.");
  else inv.historial.forEach((h, i) => { claves(h, C.historial, `historial[${i}].`, e); if (h?.n !== i + 1) e(`historial[${i}].n debe ser ${i + 1}.`); });
  controlesComunes(inv, e);
  return { errores, avisos };
}

// ---------- Historial con huellas ----------
const contenido = (inv) => { const c = { ...inv }; delete c.historial; return c; };
const huellaEntrada = (h) => { const x = { ...h }; delete x.huella; return huellaDe(x); };

async function anexar(inv, { fecha, autor, accion, detalle }) {
  const prev = inv.historial.at(-1) ?? null;
  const h = { n: inv.historial.length + 1, fecha, autor: { tipo: autor.tipo, identificador: autor.identificador, autenticacion: "declarada" }, accion, detalle: detalle ?? null, huella_anterior: prev?.huella ?? null, huella_contenido: await huellaDe(contenido(inv)) };
  h.huella = await huellaEntrada(h);
  inv.historial.push(h);
  return inv;
}

/** Crea una investigación vacía (borrador) con su primera entrada de historial. */
export async function crearInvestigacion({ id, titulo, pregunta, acontecimiento, autor, fecha, es_demo = false, actores = [] }) {
  const inv = {
    contrato: CONTRATO_INVESTIGACION, version_contrato: VERSION_CSI, id, titulo, pregunta, creada_en: fecha, creada_por: autor ? { tipo: autor.tipo, identificador: autor.identificador } : null, es_demo,
    acontecimiento, actores: [...actores], fuentes: [], enunciados: [], incentivos: [], hipotesis: [], supuestos: [],
    incertidumbre: { nivel: "no_estimada", descripcion: "Todavía no se estima." }, objeciones: [], escenarios: [], revision: { estado: "borrador" }, historial: [],
  };
  const v = validarInvestigacion({ ...inv, historial: [{ n: 1 }] });
  const errores = v.errores.filter((t) => !t.startsWith("historial"));
  if (errores.length) return { ok: false, errores };
  return { ok: true, inv: await anexar(inv, { fecha, autor, accion: "crear", detalle: titulo }) };
}

export const ACCIONES = ["agregar_actor", "agregar_fuente", "agregar_enunciado", "retirar_enunciado", "agregar_incentivo", "agregar_hipotesis", "vincular_evidencia", "agregar_objecion", "responder_objecion", "agregar_escenario", "editar", "revision"];
const EDITABLES = ["titulo", "pregunta", "supuestos", "incertidumbre"];

/**
 * Aplica UN cambio y lo anexa al historial. Nunca borra: retirar un enunciado lo marca (con motivo) y deja de contar.
 * Cualquier cambio de contenido sobre una investigación revisada la devuelve a «en_revision» (la revisión era de otro texto).
 * @returns {ok, inv, errores}  (inv es una copia: el original no se toca)
 */
export async function aplicarCambio(original, cambio, { autor, fecha }) {
  const errores = [];
  if (!esAutor(autor)) errores.push("autor: {tipo, identificador} declarado.");
  if (!esFechaConZona(fecha)) errores.push("fecha: instante con zona.");
  const ultima = original?.historial?.at(-1)?.fecha;
  if (ultima && esFechaConZona(fecha) && ms(fecha) < ms(ultima)) errores.push(`fecha ${fecha} anterior al último cambio (${ultima}): el historial no se reescribe hacia atrás.`);
  if (!ACCIONES.includes(cambio?.accion)) errores.push(`accion debe ser una de: ${ACCIONES.join(", ")}.`);
  if (errores.length) return { ok: false, errores };
  const inv = clon(original);
  const d = cambio.datos ?? {};
  const busca = (lista, id) => L(inv[lista]).find((x) => x.id === id);
  let detalle = null;
  switch (cambio.accion) {
    case "agregar_actor": if (!inv.actores.includes(d.actor_id)) inv.actores.push(d.actor_id); detalle = d.actor_id; break;
    case "agregar_fuente": inv.fuentes.push(d.fuente); detalle = d.fuente?.id; break;
    case "agregar_enunciado": inv.enunciados.push({ registrado_en: fecha, fuentes: [], ...d.enunciado }); detalle = `${d.enunciado?.tipo} ${d.enunciado?.id}`; break;
    case "retirar_enunciado": {
      const x = busca("enunciados", d.enunciado_id);
      if (!x) return { ok: false, errores: [`enunciado «${d.enunciado_id}» no existe.`] };
      if (!texto(d.motivo)) return { ok: false, errores: ["Retirar exige motivo."] };
      x.retirado = { fecha, motivo: d.motivo }; detalle = d.enunciado_id; break;
    }
    case "agregar_incentivo": inv.incentivos.push(d.incentivo); detalle = d.incentivo?.id; break;
    case "agregar_hipotesis": inv.hipotesis.push({ a_favor: [], en_contra: [], supuestos: [], condiciones_refutacion: [], datos_faltantes: [], ...d.hipotesis }); detalle = d.hipotesis?.id; break;
    case "vincular_evidencia": {
      const h = busca("hipotesis", d.hipotesis_id);
      if (!h || !["a_favor", "en_contra"].includes(d.sentido)) return { ok: false, errores: ["vincular_evidencia: hipotesis_id existente y sentido a_favor|en_contra."] };
      if (!h[d.sentido].includes(d.enunciado_id)) h[d.sentido].push(d.enunciado_id);
      detalle = `${d.enunciado_id} ${d.sentido} ${d.hipotesis_id}`; break;
    }
    case "agregar_objecion": inv.objeciones.push({ estado: "abierta", hipotesis_id: null, autor: { tipo: autor.tipo, identificador: autor.identificador }, ...d.objecion }); detalle = d.objecion?.id; break;
    case "responder_objecion": {
      const o = busca("objeciones", d.objecion_id);
      if (!o) return { ok: false, errores: [`objeción «${d.objecion_id}» no existe.`] };
      o.estado = "respondida"; o.respuesta = d.respuesta; detalle = d.objecion_id; break;
    }
    case "agregar_escenario": if (!inv.escenarios.includes(d.escenario_id)) inv.escenarios.push(d.escenario_id); detalle = d.escenario_id; break;
    case "editar":
      if (!EDITABLES.includes(d.campo)) return { ok: false, errores: [`Solo se editan: ${EDITABLES.join(", ")} (los enunciados se retiran, no se reescriben).`] };
      inv[d.campo] = d.valor; detalle = d.campo; break;
    case "revision": {
      if (!ESTADOS_REVISION.includes(d.estado)) return { ok: false, errores: ["revision.estado inválido."] };
      inv.revision = ["revisada", "devuelta"].includes(d.estado) ? { estado: d.estado, revisor: { tipo: autor.tipo, identificador: autor.identificador }, fecha, nota: d.nota ?? "" } : { estado: d.estado };
      detalle = d.estado; break;
    }
  }
  if (cambio.accion !== "revision" && original.revision?.estado === "revisada") inv.revision = { estado: "en_revision", nota: `Cambió después de la revisión de ${original.revision.revisor?.identificador ?? "?"}: necesita revisión nueva.` };
  const v = validarInvestigacion(inv);
  if (v.errores.length) return { ok: false, errores: v.errores };
  return { ok: true, inv: await anexar(inv, { fecha, autor, accion: cambio.accion, detalle }), errores: [] };
}

/** Verifica la cadena del historial y que el contenido actual sea el último sellado (detecta cambios silenciosos). */
export async function verificarHistorial(inv) {
  const problemas = [];
  const hist = L(inv?.historial);
  if (!hist.length) return { ok: false, problemas: ["Sin historial."] };
  let anterior = null;
  for (const [i, h] of hist.entries()) {
    if (h.n !== i + 1) problemas.push(`Entrada ${i + 1}: número ${h.n}.`);
    if ((h.huella_anterior ?? null) !== anterior) problemas.push(`Entrada ${h.n}: no enlaza con la anterior (falta o se reordenó una entrada).`);
    if (await huellaEntrada(h) !== h.huella) problemas.push(`Entrada ${h.n}: la entrada se reescribió.`);
    anterior = h.huella;
  }
  // La última entrada sella el contenido ANTES de anexarla; el contenido de ahora debe coincidir con lo sellado por ella.
  const sellado = await sha256(jsonCanonico(contenido(inv)));
  if (sellado !== hist.at(-1).huella_contenido) problemas.push("El contenido cambió sin pasar por el historial (modificación silenciosa).");
  return { ok: !problemas.length, problemas };
}

// ---------- Análisis (lo que la persona ve; no decide) ----------
/**
 * Estado de cada hipótesis según la evidencia registrada. Nunca «confirmada»: lo más fuerte es «sin contradicción
 * registrada», y eso solo con condiciones de refutación escritas. Manipulación exige evidencia documental/regulatoria.
 */
export function analizarInvestigacion(inv) {
  const enun = new Map(L(inv?.enunciados).map((x) => [x.id, x]));
  const fuentes = new Map(L(inv?.fuentes).map((f) => [f.id, f]));
  const vigente = (id) => { const x = enun.get(id); return x && !x.retirado && EVIDENCIABLES.includes(x.tipo) ? x : null; };
  const conteo = Object.fromEntries(TIPOS_ENUNCIADO.map((t) => [t, L(inv?.enunciados).filter((x) => x.tipo === t && !x.retirado).length]));
  const objeciones = L(inv?.objeciones);
  const hipotesis = L(inv?.hipotesis).map((h) => {
    const favor = L(h.a_favor).map(vigente).filter(Boolean), contra = L(h.en_contra).map(vigente).filter(Boolean);
    const motivos = [];
    if (!favor.length) motivos.push("sin evidencia a favor");
    if (!L(h.condiciones_refutacion).length) motivos.push("sin condiciones de refutación");
    if (h.categoria === "manipulacion") {
      const fuerte = favor.some((x) => x.tipo === "hecho" && L(x.fuentes).some((f) => ["documento_regulatorio", "documento_oficial"].includes(fuentes.get(f)?.tipo)));
      if (!fuerte) motivos.push("manipulación: exige evidencia documental o regulatoria; sin ella es solo una hipótesis");
    }
    let estado;
    if (motivos.length) estado = "incompleta";
    else if (contra.length) estado = "en_disputa";
    else estado = "sin_contradiccion_registrada";
    if (!favor.length && contra.length) estado = "contradicha";
    const abiertas = objeciones.filter((o) => o.hipotesis_id === h.id && o.estado === "abierta").length;
    // Hechos que la apoyan pero otro hecho contradice.
    const disputados = favor.filter((x) => L(inv.enunciados).some((y) => !y.retirado && (L(y.contradice).includes(x.id) || L(x.contradice).includes(y.id))));
    return { id: h.id, categoria: h.categoria, enunciado: h.enunciado, estado, motivos, a_favor: favor.length, en_contra: contra.length, objeciones_abiertas: abiertas, datos_faltantes: L(h.datos_faltantes).length, apoyos_disputados: disputados.map((x) => x.id) };
  });
  const conflictos = [];
  for (const x of L(inv?.enunciados)) for (const id of L(x.contradice)) if (!x.retirado && !enun.get(id)?.retirado) conflictos.push({ a: x.id, b: id, tipos: [x.tipo, enun.get(id)?.tipo] });
  const alertas = [];
  if (conflictos.length) alertas.push(`${conflictos.length} par(es) de enunciados se contradicen: revisar fuentes antes de concluir.`);
  if (hipotesis.length && hipotesis.every((h) => h.estado === "incompleta")) alertas.push("Ninguna hipótesis tiene evidencia suficiente.");
  if (objeciones.some((o) => o.estado === "abierta")) alertas.push(`${objeciones.filter((o) => o.estado === "abierta").length} objeción(es) abiertas.`);
  if (hipotesis.filter((h) => h.estado === "sin_contradiccion_registrada").length > 1) alertas.push("Varias hipótesis compatibles con la evidencia: la evidencia no distingue entre ellas.");
  return { conteo, hipotesis, conflictos, alertas, revision: inv?.revision?.estado ?? null };
}
