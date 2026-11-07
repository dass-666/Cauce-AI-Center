// CSI fase 2 · motor de fuentes públicas (bloque 2). Contrato de fuente 0.2, dentro de `cauce.csi.investigacion` 0.2
// y `cauce.csi.actores` 0.2. Los documentos 0.1 siguen validándose con las reglas 0.1 (base.js) sin cambios.
//
// Tres fechas que NO se confunden:
//   - publicada_en   cuándo se publicó la copia que citamos (la página, el PDF, el boletín).
//   - disponible_en  cuándo la información fue pública por primera vez (p. ej. la conferencia del día anterior que
//                    la copia transcribe). Es la que cuenta para «¿qué se podía saber en ese momento?».
//   - consultada_en  cuándo la consultamos nosotros. NUNCA cuenta como fecha de conocimiento.
//
// Nada aquí consulta la red: el motor registra lo que una persona (o la herramienta de lectura de una sesión) obtuvo,
// con su procedencia y sus límites. Si no hubo acceso verificable, la fuente queda «pendiente» y no puede ser evidencia.

import { ID, esObj, L, claves, esFechaConZona, esFechaODia, intervalo, texto } from "./base.js";
import { TIPOS_FUENTE } from "./base.js";

export const VERSION_FUENTE = "0.2";
/** Tipos 0.1 + los que pidió el bloque 2 (comunicados oficiales y de bancos centrales siguen siendo documento_oficial). */
export const TIPOS_FUENTE_02 = [...TIPOS_FUENTE, "informe_economico", "informe_corporativo", "dato_mercado", "documento_institucional"];
/** primaria: la institución o el dato de origen · secundaria: alguien reproduce o informa lo primario · interpretacion: análisis u opinión. */
export const CLASES_FUENTE = ["primaria", "secundaria", "interpretacion"];
export const ESTADOS_FUENTE = ["consultada", "pendiente"];
export const TIPOS_EXTRACTO = ["cita_textual", "parafrasis", "dato"];
export const METODOS_CONSULTA = ["manual", "herramienta_sesion", "copia_local"];
const CLAVES_02 = ["id", "titulo", "editor", "tipo", "publicada_en", "consultada_en", "disponible_en", "disponible_segun", "enlace", "referencia", "autor_actor_id", "ficticia",
  "clase", "estado", "pendiente_motivo", "extracto", "extracto_tipo", "metodo_consulta", "huella_contenido", "copia_local", "limitaciones", "origen"];

/** Fecha en que la información se pudo conocer: disponible_en si se declaró; si no, la publicación de la copia. */
export const fechaConocimiento = (f) => f?.disponible_en ?? f?.publicada_en ?? null;
/** «Se podía conocer con seguridad antes de t» (conservador: una fecha de día abarca de UTC+14 a UTC−12). */
export function conocibleAntes(f, instante) {
  const iv = intervalo(fechaConocimiento(f)); const t = Date.parse(instante);
  return !!iv && Number.isFinite(t) && iv[1] <= t;
}
/** «Con seguridad se conoció después de t». */
export function conocidaDespues(f, instante) {
  const iv = intervalo(fechaConocimiento(f)); const t = Date.parse(instante);
  return !!iv && Number.isFinite(t) && iv[0] > t;
}
export const esPendiente = (f) => f?.estado === "pendiente";
/** Origen para medir independencia: dos copias del mismo comunicado NO son dos fuentes independientes. */
export const origenDe = (f) => String(f?.origen ?? f?.autor_actor_id ?? f?.editor ?? "?").trim().toLowerCase();

const normaliza = (s) => String(s ?? "").normalize("NFKC").replace(/[“”«»"]/g, '"').replace(/[‘’]/g, "'").replace(/[–—]/g, "-").replace(/\s+/g, " ").trim().toLowerCase();
/** Una cita textual tiene procedencia solo si aparece, tal cual, en el extracto textual de una de sus fuentes. */
export function citaConProcedencia(cita, fuentes) {
  const c = normaliza(cita);
  return !!c && L(fuentes).some((f) => !esPendiente(f) && f.extracto_tipo === "cita_textual" && normaliza(f.extracto).includes(c));
}

/**
 * Reglas 0.2 de una lista de fuentes. `e` recibe errores; `aviso` recibe avisos (no bloquean).
 * Fechas incorrectas, duplicados, pendientes sin motivo y huellas sin copia son errores.
 */
export function validarFuentes02(fuentes, { es_demo, ruta = "fuentes", e, aviso = () => {} }) {
  if (!Array.isArray(fuentes)) return e(`${ruta} debe ser una lista.`);
  const ids = new Set(), enlaces = new Map(), huellas = new Map();
  fuentes.forEach((f, i) => {
    const r = `${ruta}[${i}].`;
    if (!esObj(f)) return e(`${r} debe ser un objeto.`);
    claves(f, CLAVES_02, r, e);
    if (typeof f.id !== "string" || !ID.test(f.id)) e(`${r}id inválido.`);
    else if (ids.has(f.id)) e(`${r}id «${f.id}» repetido.`); else ids.add(f.id);
    if (!texto(f.titulo) || !texto(f.editor)) e(`${r}titulo y editor (institución o medio) son obligatorios.`);
    if (!TIPOS_FUENTE_02.includes(f.tipo)) e(`${r}tipo debe ser uno de: ${TIPOS_FUENTE_02.join(", ")}.`);
    if (!CLASES_FUENTE.includes(f.clase)) e(`${r}clase: ${CLASES_FUENTE.join(" | ")} (¿la fuente es el origen, reproduce a otro o interpreta?).`);
    if (!ESTADOS_FUENTE.includes(f.estado)) e(`${r}estado: consultada | pendiente.`);
    if (!esFechaODia(f.publicada_en)) e(`${r}publicada_en «${f.publicada_en}» debe ser fecha (AAAA-MM-DD o instante con zona): sin fecha no se sabe qué se conocía y cuándo.`);
    if (f.enlace !== undefined && !(typeof f.enlace === "string" && /^https?:\/\/[^\s]+\.[^\s]+/i.test(f.enlace))) e(`${r}enlace: solo http(s):// con dominio.`);
    if (f.referencia !== undefined && !texto(f.referencia)) e(`${r}referencia vacía.`);
    if (!es_demo && f.enlace === undefined && f.referencia === undefined) e(`${r}una fuente real necesita enlace (URL) o referencia (dónde encontrarla).`);
    if (es_demo && f.ficticia !== true) e(`${r}en DEMO toda fuente es ficticia (ficticia: true).`);
    if (!es_demo && f.ficticia === true) e(`${r}una fuente ficticia no puede estar en un documento REAL.`);
    if (f.limitaciones !== undefined && (!Array.isArray(f.limitaciones) || f.limitaciones.some((x) => !texto(x)))) e(`${r}limitaciones: lista de textos.`);
    if (!es_demo && !L(f.limitaciones).length) e(`${r}limitaciones: di al menos una (qué no cubre, cómo se obtuvo, si es copia).`);
    if (f.origen !== undefined && !texto(f.origen)) e(`${r}origen vacío.`);
    // Fechas: consulta, disponibilidad y publicación no se confunden ni se contradicen.
    const pub = intervalo(f.publicada_en);
    if (f.consultada_en !== undefined) {
      if (!esFechaConZona(f.consultada_en)) e(`${r}consultada_en debe ser instante con zona.`);
      else if (pub && Date.parse(f.consultada_en) < pub[0]) e(`${r}consultada_en (${f.consultada_en}) es anterior a la publicación (${f.publicada_en}): fecha incorrecta.`);
    }
    if (f.disponible_en !== undefined) {
      const disp = esFechaODia(f.disponible_en) ? intervalo(f.disponible_en) : null;
      if (!disp) e(`${r}disponible_en debe ser fecha (AAAA-MM-DD o instante con zona).`);
      else {
        if (pub && disp[0] > pub[1]) e(`${r}disponible_en (${f.disponible_en}) es posterior a la publicación de esta copia (${f.publicada_en}): la información no pudo estar disponible después de publicarse.`);
        if (esFechaConZona(f.consultada_en) && disp[0] > Date.parse(f.consultada_en)) e(`${r}disponible_en es posterior a la consulta: imposible.`);
      }
      if (!texto(f.disponible_segun)) e(`${r}disponible_en necesita disponible_segun (de dónde sale esa fecha; la fecha de consulta no sirve).`);
    }
    if (f.estado === "consultada") {
      if (!es_demo && !esFechaConZona(f.consultada_en)) e(`${r}una fuente consultada dice cuándo (consultada_en).`);
      // En DEMO (fuentes inventadas para practicar) el extracto es opcional; en REAL es obligatorio.
      if (!es_demo && !texto(f.extracto)) e(`${r}una fuente consultada lleva extracto (lo relevante que dice).`);
      if ((!es_demo || f.extracto !== undefined) && !TIPOS_EXTRACTO.includes(f.extracto_tipo)) e(`${r}extracto_tipo: ${TIPOS_EXTRACTO.join(" | ")}.`);
      if (!es_demo && !METODOS_CONSULTA.includes(f.metodo_consulta)) e(`${r}metodo_consulta: ${METODOS_CONSULTA.join(" | ")}.`);
    }
    if (f.estado === "pendiente") {
      if (!texto(f.pendiente_motivo)) e(`${r}una fuente pendiente explica por qué (sin acceso, sin conexión, solo se verificó el título…).`);
      if (f.extracto_tipo === "cita_textual") e(`${r}una fuente pendiente no puede aportar citas textuales (no se verificaron).`);
    }
    if (f.huella_contenido !== undefined) {
      if (!/^[0-9a-f]{64}$/.test(String(f.huella_contenido))) e(`${r}huella_contenido: SHA-256 en hexadecimal (64 caracteres).`);
      if (!texto(f.copia_local)) e(`${r}huella_contenido sin copia_local: una huella solo sirve si existe la copia que la produce.`);
    } else if (f.estado === "consultada" && !es_demo) aviso(`${r.slice(0, -1)} «${f.id}»: sin huella de contenido (no hay copia verificable guardada).`);
    // Duplicados: la misma URL o la misma copia registrada dos veces infla la evidencia.
    if (typeof f.enlace === "string") {
      const k = f.enlace.replace(/[#?].*$/, "").replace(/\/$/, "").toLowerCase();
      if (enlaces.has(k)) e(`${r}fuente duplicada: el enlace ya está registrado como «${enlaces.get(k)}».`); else enlaces.set(k, f.id);
    }
    if (typeof f.huella_contenido === "string") { if (huellas.has(f.huella_contenido)) e(`${r}fuente duplicada: misma huella de contenido que «${huellas.get(f.huella_contenido)}».`); else huellas.set(f.huella_contenido, f.id); }
  });
}

/**
 * Expediente pendiente de fuentes: lo que se entrega cuando no se puede consultar de forma verificable. Lista lo que
 * habría que conseguir, sin inventar contenido. @returns objeto de solo lectura para informes.
 */
export function expedientePendiente(inv) {
  const fs = L(inv?.fuentes);
  return {
    investigacion_id: inv?.id ?? null,
    consultadas: fs.filter((f) => f.estado === "consultada").map((f) => f.id),
    pendientes: fs.filter(esPendiente).map((f) => ({ id: f.id, titulo: f.titulo, editor: f.editor, referencia: f.enlace ?? f.referencia ?? null, motivo: f.pendiente_motivo })),
    sin_huella: fs.filter((f) => f.estado === "consultada" && !f.huella_contenido).map((f) => f.id),
    completo: fs.length > 0 && !fs.some(esPendiente),
  };
}

/**
 * «¿Qué se podía conocer en cada momento?» (bloque 6, pregunta 6). Para cada corte, las fuentes cuya información ya
 * era pública y los enunciados cuyas fuentes lo eran todas. Usa disponible_en, nunca consultada_en.
 */
export function lineaConocimiento(inv, cortes) {
  const fs = L(inv?.fuentes).filter((f) => !esPendiente(f));
  const porId = new Map(fs.map((f) => [f.id, f]));
  return L(cortes).map((c) => {
    const conocidas = fs.filter((f) => conocibleAntes(f, c.instante));
    const ids = new Set(conocidas.map((f) => f.id));
    const enunciados = L(inv?.enunciados).filter((x) => !x.retirado && ["hecho", "declaracion"].includes(x.tipo) && L(x.fuentes).length && L(x.fuentes).every((id) => ids.has(id) && porId.has(id)));
    return { etiqueta: c.etiqueta, instante: c.instante, fuentes: conocidas.map((f) => f.id), enunciados: enunciados.map((x) => x.id), aun_no: fs.filter((f) => !ids.has(f.id)).map((f) => f.id) };
  });
}
