// CSI (Cauce Strategic Intelligence) · utilidades comunes. Sin dependencias, corre en Node y en el navegador.
// Reutiliza fechas, privacidad y huellas de Nexus (app/nexus/comun.js) SIN depender de su lógica: CSI investiga,
// Nexus cuestiona y Diego decide; esta importación solo comparte funciones puras.

export { esFechaConZona, esFechaODia, intervalo, ms, texto, buscarDatosPrivados, jsonCanonico, sha256, huellaDe, esHuella, mismoId } from "../nexus/comun.js";
import { buscarDatosPrivados } from "../nexus/comun.js";

export const VERSION_CSI = "0.1";
export const ID = /^[a-z0-9][a-z0-9._-]{1,80}$/i;
export const esObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
export const L = (v) => (Array.isArray(v) ? v : []);
export const TIPOS_AUTOR = ["humano", "codigo", "ia"];

/** Autor declarado (sin autenticar): {tipo, identificador}. */
export const esAutor = (a) => esObj(a) && TIPOS_AUTOR.includes(a.tipo) && typeof a.identificador === "string" && a.identificador.trim() !== "";

/**
 * CSI no inventa probabilidades (bloque 5): cualquier clave que hable de probabilidad, porcentaje de certeza o
 * «chance» es un error. Los grados se dicen con palabras y con conteos de evidencia, nunca con números inventados.
 */
const CLAVE_PROBABILIDAD = /^(probabilidad|probability|prob|chance|certeza_pct|porcentaje_certeza|odds|verosimilitud)$/i;
export function buscarProbabilidades(v, ruta = "") {
  const r = [];
  if (Array.isArray(v)) v.forEach((x, i) => r.push(...buscarProbabilidades(x, `${ruta}[${i}]`)));
  else if (esObj(v)) for (const [k, x] of Object.entries(v)) {
    const rr = ruta ? `${ruta}.${k}` : k;
    if (CLAVE_PROBABILIDAD.test(k)) r.push(rr);
    r.push(...buscarProbabilidades(x, rr));
  }
  return r;
}

/** Controles que comparten todos los documentos CSI: privacidad y probabilidades inventadas. */
export function controlesComunes(doc, e) {
  for (const p of buscarDatosPrivados(doc)) e(`Dato privado no permitido en ${p.ruta}: ${p.motivo}.`);
  for (const r of buscarProbabilidades(doc)) e(`${r}: CSI no registra probabilidades numéricas (no se inventan; usa evidencia a favor/en contra y la incertidumbre en palabras).`);
}

/** Claves desconocidas = error (como Nexus): un campo que el contrato no conoce no se cuela en silencio. */
export function claves(obj, lista, ruta, e) {
  if (esObj(obj)) for (const k of Object.keys(obj)) if (!lista.includes(k)) e(`${ruta}${k}: clave desconocida (contrato CSI ${VERSION_CSI}).`);
}

export const clon = (x) => JSON.parse(JSON.stringify(x));

// ---------- Fuentes (compartidas por investigaciones y actores) ----------
import { esFechaConZona as _conZona, esFechaODia as _dia, texto as _texto, intervalo as _intervalo } from "../nexus/comun.js";
export const TIPOS_FUENTE = ["documento_oficial", "documento_regulatorio", "dato_estadistico", "prensa", "declaracion_publica", "analisis_tercero", "nexus"];
/** Fuentes que pueden documentar la intención de un actor (si las publica el propio actor). */
export const FUENTES_DOCUMENTALES = ["documento_oficial", "documento_regulatorio"];
const CLAVES_FUENTE = ["id", "titulo", "editor", "tipo", "publicada_en", "consultada_en", "enlace", "autor_actor_id", "ficticia"];
/** Una recomendación o dictamen de Nexus nunca es evidencia primaria de lo que CSI investiga (bloque 7). */
export const esFuenteNexus = (f) => f?.tipo === "nexus" || /^recomendaci[oó]n:|^nexus:/i.test(String(f?.enlace ?? f?.titulo ?? ""));

export function validarFuentes(fuentes, { es_demo, ruta = "fuentes", e }) {
  if (!Array.isArray(fuentes)) return e(`${ruta} debe ser una lista.`);
  const vistos = new Set();
  fuentes.forEach((f, i) => {
    const r = `${ruta}[${i}].`;
    if (!esObj(f)) return e(`${r} debe ser un objeto.`);
    claves(f, CLAVES_FUENTE, r, e);
    if (typeof f.id !== "string" || !ID.test(f.id)) e(`${r}id inválido.`);
    else if (vistos.has(f.id)) e(`${r}id «${f.id}» repetido.`); else vistos.add(f.id);
    if (!_texto(f.titulo) || !_texto(f.editor)) e(`${r}titulo y editor son obligatorios.`);
    if (!TIPOS_FUENTE.includes(f.tipo)) e(`${r}tipo debe ser uno de: ${TIPOS_FUENTE.join(", ")}.`);
    if (!_dia(f.publicada_en)) e(`${r}publicada_en «${f.publicada_en}» debe ser fecha (AAAA-MM-DD o instante con zona): sin fecha de publicación no se sabe qué se conocía y cuándo.`);
    if (f.consultada_en !== undefined && !_conZona(f.consultada_en)) e(`${r}consultada_en debe ser instante con zona.`);
    if (f.enlace !== undefined && !(typeof f.enlace === "string" && /^(https?:\/\/|recomendacion:|nexus:)/i.test(f.enlace))) e(`${r}enlace: solo http(s):// (u otra referencia de Nexus).`);
    if (es_demo && f.ficticia !== true) e(`${r}en DEMO toda fuente es ficticia (ficticia: true).`);
    if (!es_demo && f.ficticia === true) e(`${r}una fuente ficticia no puede estar en un documento REAL.`);
  });
}

/**
 * Protección contra información futura. Conservador: una fecha de día (sin hora) abarca de UTC+14 a UTC−12, así que
 * «seguro antes» exige que hasta el final posible de ese día sea anterior, y «seguro después» que su inicio posible sea posterior.
 */
export function seguroAntes(fuente, instante) {
  const iv = _intervalo(fuente?.publicada_en); const t = Date.parse(instante);
  return !!iv && Number.isFinite(t) && iv[1] <= t;
}
export function seguroDespues(fuente, instante) {
  const iv = _intervalo(fuente?.publicada_en); const t = Date.parse(instante);
  return !!iv && Number.isFinite(t) && iv[0] > t;
}
