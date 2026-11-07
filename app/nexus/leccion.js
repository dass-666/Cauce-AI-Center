// Contrato `cauce.leccion` 0.2 según CAUCE_NEXUS_ARQUITECTURA_MAESTRA_v0.2 §3 (docs/). Valida SOLO la forma.
// Lo que la evidencia sostiene lo decide el gerente escéptico (gerente.js, reglas nexus-R 0.2).
// Claves desconocidas = error (§3: «el validador rechazará claves desconocidas»), salvo las extensiones
// documentadas en contrato/NEXUS-CONTRATOS.md (§ Extensiones Cauce 0.2), que son opcionales.

import { esFechaConZona, esFechaODia, texto, buscarDatosPrivados } from "./comun.js";

export const ESQUEMA_LECCION = "cauce.leccion";
export const VERSION_LECCION = "0.2";
/** Versiones aceptadas. 0.3 = 0.2 + muestra.naturaleza «desconocida» (cambio mínimo; ver contrato/NEXUS-CONTRATOS.md § 0.3). */
export const VERSIONES_LECCION = ["0.2", "0.3"];
export const TIPOS = ["metodo", "hallazgo", "estrategia"];
export const TIPOS_ORIGEN = ["medicion", "revision_humana", "texto_ia"];
export const TIPOS_AUTOR = ["humano", "codigo", "ia"];
export const UBICACIONES = ["main", "pr_abierto", "desplegado", "fuera_de_repo"];
export const BASES = ["vintage", "observed", "estimated", "desconocida"];
export const NATURALEZAS = ["sintetica", "demo", "real_historica", "real_comercial"];
/** Solo en 0.3: «desconocida» = no se sabe de qué datos sale el resultado. Nunca respalda un efecto (R08). */
export const NATURALEZAS_03 = [...NATURALEZAS, "desconocida"];
export const NATURALEZAS_RESULTADO = ["prueba_tecnica", "backtest", "simulacion", "resultado_operativo_real", "sin_resultado"];
export const NIVELES_CONFIANZA = ["baja", "media", "alta"];
export const OBJETOS_CONFIANZA = ["metodo", "efecto_operativo", "beneficio_economico"];
export const ESTADOS_VALIDACION = ["propuesta", "en_prueba", "validada_en_origen", "validada_en_destino", "refutada", "caducada"];
export const SENSIBILIDADES = ["sin-datos-comerciales", "interno", "restringida"];

const CLAVES = {
  raiz: ["id", "esquema", "version_esquema", "tipo", "origen", "autor", "hallazgo", "antecedentes", "evidencia", "procedencia", "fecha_hallazgo", "vigente_hasta", "muestra", "confianza", "limitaciones", "aplicaciones_posibles", "validacion", "revisiones", "sensibilidad"],
  origen: ["proyecto", "componente", "version_sistema", "commit", "tipo"],
  autor: ["tipo", "identificador"],
  // exportado_en y fraccion_estimada: extensiones Cauce 0.2 (T07 y T21 las necesitan y §3 no les da campo).
  evidencia: ["tipo", "referencia", "ubicacion", "commit", "observado_en", "conocido_en", "base_conocimiento", "proyecto_ejecutor", "dataset_id", "sha256", "reproducible_declarado", "reproduccion_independiente", "exportado_en", "fraccion_estimada"],
  reproduccion: ["quien", "fecha", "referencia", "sha256"],
  procedencia: ["metodo", "periodo_inicio", "periodo_fin", "comando", "alcance", "limitaciones_fuente"],
  muestra: ["n", "n_rango", "unidad", "n_independiente", "unidad_independencia", "n_efectivo", "independencia", "naturaleza", "naturaleza_resultado", "seleccion_en_muestra", "n_comparaciones", "cobertura", "supuestos"],
  confianza: ["nivel", "objeto", "justificacion"],
  aplicacion: ["proyecto", "hipotesis"],
  validacion: ["estado", "validado_en"],
  validado_en: ["proyecto", "prueba_ref", "commit", "fecha", "resultado", "dataset_id", "sha256"],
  revision: ["fecha", "autor_tipo", "autor", "decision", "justificacion", "version", "tipo"],
};
const ID = /^[a-z0-9][a-z0-9._-]{2,80}$/i;
const PROYECTO = /^[a-z0-9][a-z0-9_-]{0,40}$/;
const esObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);

/** @returns { errores, avisos } — con errores la lección no es «registrable» (§3). */
export function validarLeccion(l) {
  const errores = [];
  const avisos = [];
  const e = (t) => errores.push(t);
  if (!esObj(l)) return { errores: ["La lección debe ser un objeto JSON."], avisos };
  const claves = (obj, lista, ruta) => { for (const k of Object.keys(obj)) if (!lista.includes(k)) e(`${ruta}${k}: clave desconocida (el contrato la rechaza).`); };
  const obligatorio = (obj, k, ruta) => { if (!(k in obj)) e(`${ruta}${k} es obligatorio.`); };
  const enumera = (v, lista, r) => { if (!lista.includes(v)) e(`${r} debe ser uno de: ${lista.join(", ")}.`); };
  const instante = (v, r) => { if (v !== null && v !== undefined && !esFechaConZona(v)) e(`${r} «${v}» debe ser instante ISO 8601 con zona horaria o null.`); };
  const dia = (v, r, oblig = true) => { if ((v === null || v === undefined) && !oblig) return; if (!esFechaODia(v)) e(`${r} «${v}» debe ser fecha ISO (AAAA-MM-DD o instante con zona).`); };

  claves(l, CLAVES.raiz, "");
  for (const k of CLAVES.raiz) obligatorio(l, k, "");
  if (typeof l.id !== "string" || !ID.test(l.id)) e("id: identificador estable (letras, números, . _ -).");
  if (l.esquema !== ESQUEMA_LECCION) e(`esquema debe ser "${ESQUEMA_LECCION}".`);
  if (!VERSIONES_LECCION.includes(l.version_esquema)) e(`version_esquema debe ser uno de: ${VERSIONES_LECCION.join(", ")}.`);
  enumera(l.tipo, TIPOS, "tipo");
  if (!esObj(l.origen)) e("origen debe ser un objeto.");
  else {
    claves(l.origen, CLAVES.origen, "origen.");
    if (typeof l.origen.proyecto !== "string" || !PROYECTO.test(l.origen.proyecto)) e("origen.proyecto: id de proyecto (ej. compago).");
    for (const k of ["componente", "version_sistema"]) if (!texto(l.origen[k])) e(`origen.${k} es obligatorio.`);
    enumera(l.origen.tipo, TIPOS_ORIGEN, "origen.tipo");
  }
  if (!esObj(l.autor)) e("autor debe ser un objeto.");
  else { claves(l.autor, CLAVES.autor, "autor."); enumera(l.autor.tipo, TIPOS_AUTOR, "autor.tipo"); if (!texto(l.autor.identificador)) e("autor.identificador es obligatorio."); }
  if (!texto(l.hallazgo)) e("hallazgo es obligatorio.");
  if (!Array.isArray(l.antecedentes) || l.antecedentes.some((a) => typeof a !== "string" || !ID.test(a))) e("antecedentes: lista de ids de lecciones (puede estar vacía).");

  if (!Array.isArray(l.evidencia)) e("evidencia debe ser una lista.");
  else l.evidencia.forEach((ev, i) => {
    const r = `evidencia[${i}].`;
    if (!esObj(ev)) return e(`${r} debe ser un objeto.`);
    claves(ev, CLAVES.evidencia, r);
    for (const k of ["tipo", "referencia", "ubicacion", "base_conocimiento", "proyecto_ejecutor", "reproducible_declarado"]) obligatorio(ev, k, r);
    if (!texto(ev.tipo) || !texto(ev.referencia)) e(`${r}tipo y referencia son textos obligatorios.`);
    enumera(ev.ubicacion, UBICACIONES, `${r}ubicacion`);
    enumera(ev.base_conocimiento, BASES, `${r}base_conocimiento`);
    if (typeof ev.proyecto_ejecutor !== "string" || !PROYECTO.test(ev.proyecto_ejecutor)) e(`${r}proyecto_ejecutor: id de proyecto.`);
    if (typeof ev.reproducible_declarado !== "boolean") e(`${r}reproducible_declarado debe ser true o false.`);
    instante(ev.observado_en, `${r}observado_en`); instante(ev.conocido_en, `${r}conocido_en`); instante(ev.exportado_en, `${r}exportado_en`);
    if (ev.sha256 !== undefined && ev.sha256 !== null && !/^[0-9a-f]{64}$/.test(ev.sha256)) e(`${r}sha256: 64 caracteres hexadecimales.`);
    if (ev.fraccion_estimada !== undefined && !(typeof ev.fraccion_estimada === "number" && ev.fraccion_estimada >= 0 && ev.fraccion_estimada <= 1)) e(`${r}fraccion_estimada: número de 0 a 1.`);
    if (ev.reproduccion_independiente !== undefined && ev.reproduccion_independiente !== null) {
      const ri = ev.reproduccion_independiente;
      if (!esObj(ri)) e(`${r}reproduccion_independiente debe ser objeto o null.`);
      else { claves(ri, CLAVES.reproduccion, `${r}reproduccion_independiente.`); if (!texto(ri.quien) || !texto(ri.referencia)) e(`${r}reproduccion_independiente necesita quien y referencia.`); dia(ri.fecha, `${r}reproduccion_independiente.fecha`); }
    }
  });

  if (!esObj(l.procedencia)) e("procedencia debe ser un objeto.");
  else {
    claves(l.procedencia, CLAVES.procedencia, "procedencia.");
    for (const k of ["metodo", "alcance"]) if (!texto(l.procedencia[k])) e(`procedencia.${k} es obligatorio.`);
    if (!Array.isArray(l.procedencia.limitaciones_fuente)) e("procedencia.limitaciones_fuente debe ser una lista.");
    dia(l.procedencia.periodo_inicio, "procedencia.periodo_inicio", false); dia(l.procedencia.periodo_fin, "procedencia.periodo_fin", false);
  }
  dia(l.fecha_hallazgo, "fecha_hallazgo"); dia(l.vigente_hasta, "vigente_hasta");

  if (!esObj(l.muestra)) e("muestra debe ser un objeto.");
  else {
    const m = l.muestra;
    claves(m, CLAVES.muestra, "muestra.");
    for (const k of ["unidad", "independencia", "naturaleza", "naturaleza_resultado", "seleccion_en_muestra", "supuestos"]) obligatorio(m, k, "muestra.");
    if (!("n" in m) && !("n_rango" in m)) e("muestra necesita n o n_rango.");
    for (const k of ["n", "n_independiente", "n_efectivo", "n_comparaciones"]) if (m[k] !== undefined && m[k] !== null && !(Number.isInteger(m[k]) && m[k] >= 0)) e(`muestra.${k}: entero ≥ 0 o null.`);
    if (m.naturaleza === "desconocida" && l.version_esquema === "0.2") e('muestra.naturaleza «desconocida» no existe en 0.2: usa version_esquema "0.3" (el registro 0.2 no se reinterpreta).');
    else enumera(m.naturaleza, l.version_esquema === "0.3" ? NATURALEZAS_03 : NATURALEZAS, "muestra.naturaleza");
    enumera(m.naturaleza_resultado, NATURALEZAS_RESULTADO, "muestra.naturaleza_resultado");
    if (typeof m.seleccion_en_muestra !== "boolean") e("muestra.seleccion_en_muestra debe ser true o false.");
    if (!Array.isArray(m.supuestos)) e("muestra.supuestos debe ser una lista.");
  }
  if (!esObj(l.confianza)) e("confianza debe ser un objeto.");
  else { claves(l.confianza, CLAVES.confianza, "confianza."); enumera(l.confianza.nivel, NIVELES_CONFIANZA, "confianza.nivel"); enumera(l.confianza.objeto, OBJETOS_CONFIANZA, "confianza.objeto"); if (!texto(l.confianza.justificacion)) e("confianza.justificacion es obligatoria."); }
  if (!Array.isArray(l.limitaciones)) e("limitaciones debe ser una lista.");
  if (!Array.isArray(l.aplicaciones_posibles)) e("aplicaciones_posibles debe ser una lista.");
  else l.aplicaciones_posibles.forEach((a, i) => { if (!esObj(a) || !texto(a.proyecto) || !texto(a.hipotesis)) e(`aplicaciones_posibles[${i}] necesita proyecto e hipotesis.`); else claves(a, CLAVES.aplicacion, `aplicaciones_posibles[${i}].`); });
  if (!esObj(l.validacion)) e("validacion debe ser un objeto.");
  else {
    claves(l.validacion, CLAVES.validacion, "validacion.");
    enumera(l.validacion.estado, ESTADOS_VALIDACION, "validacion.estado");
    if (!Array.isArray(l.validacion.validado_en)) e("validacion.validado_en debe ser una lista.");
    else l.validacion.validado_en.forEach((v, i) => {
      const r = `validacion.validado_en[${i}].`;
      if (!esObj(v)) return e(`${r} debe ser un objeto.`);
      claves(v, CLAVES.validado_en, r);
      if (!texto(v.proyecto)) e(`${r}proyecto es obligatorio.`);
      dia(v.fecha, `${r}fecha`);
      if (!texto(v.resultado)) e(`${r}resultado es obligatorio.`);
      // prueba_ref vacío NO es error de forma: lo juzga R06 (T05).
    });
  }
  if (!Array.isArray(l.revisiones) || l.revisiones.length === 0) e("revisiones: lista con al menos un evento (historial de solo anexado).");
  else l.revisiones.forEach((rv, i) => {
    const r = `revisiones[${i}].`;
    if (!esObj(rv)) return e(`${r} debe ser un objeto.`);
    claves(rv, CLAVES.revision, r);
    // Una revisión es un instante: SIEMPRE con zona (§3). Sin zona, la lección no es registrable (T17).
    if (!esFechaConZona(rv.fecha)) e(`${r}fecha «${rv.fecha}» debe ser instante ISO con zona horaria.`);
    enumera(rv.autor_tipo, TIPOS_AUTOR, `${r}autor_tipo`);
    for (const k of ["autor", "decision", "justificacion", "version"]) if (!texto(rv[k])) e(`${r}${k} es obligatorio.`);
  });
  enumera(l.sensibilidad, SENSIBILIDADES, "sensibilidad");

  for (const p of buscarDatosPrivados(l)) e(`Dato privado no permitido en ${p.ruta}: ${p.motivo}.`);
  return { errores, avisos };
}

/** Versión vigente de una lección = la `version` de su última revisión (así la citan las recomendaciones §4). */
export const versionDe = (l) => (Array.isArray(l?.revisiones) && l.revisiones.length ? l.revisiones.at(-1).version ?? null : null);
export const esDia = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
