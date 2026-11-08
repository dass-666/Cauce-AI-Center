// Laboratorio de IA · fase 1 · contratos `cauce.lab.encargo` 0.1, `cauce.lab.ejecucion` 0.1 y
// `cauce.lab.verificacion` 0.1. Validación ESTRICTA: claves desconocidas, versiones, ids, estados, roles,
// referencias y fechas. Ningún contrato existente (v1, CSI, Nexus) cambia; estos son nuevos y aditivos.
//
// Reglas de autoría (no se pueden saltar con datos):
//   · un ENCARGO lo crea una persona (creado_por.tipo = "humano"): la IA no se encarga trabajo a sí misma;
//   · una EJECUCIÓN es la salida de un rol. En 0.1 su autor era siempre «ia» (también para el guion DEMO: defecto
//     documentado). En 0.2 declara su autoría real: guion_demo (no es IA, solo DEMO), ia_manual (procedencia
//     declarada por una persona) o ia_automatica (informada por un adaptador). Nunca «codigo» ni «humano»;
//   · una VERIFICACIÓN solo la firma el código `lab-V` y nunca declara respaldo semántico ni aprobación: eso queda
//     «pendiente_revision_humana» en la fase 1.

import {
  VERSION_LAB, AUTOR_VERIFICADOR, CONTRATO_ENCARGO, CONTRATO_EJECUCION, CONTRATO_VERIFICACION, ROLES, ESTADOS_EJECUCION,
  ESTADOS_CON_SALIDA, ESTADOS_CON_ERROR, CLASES_AFIRMACION, TIPOS_INSUMO, ADAPTADORES, TIPOS_OBJECION, ID_FUENTE,
  esIdLab, esIdDeLaboratorio, esObj, L, esEnteroEntre, clavesExactas, esFechaConZona, esFechaODia, texto, esHuella, buscarDatosPrivados,
  LIMITES, tamanoDocumento, tieneInvisibles, VERSIONES_EJECUCION, AUTORIAS_EJECUCION, PROCEDENCIAS, TIPOS_OBJECION_02,
} from "./base.js";

const nuloO = (v, f) => v === null || f(v);
const unicos = (lista, e, ruta) => {
  const vistos = new Set();
  for (const x of lista) { if (vistos.has(x)) e(`${ruta}: «${x}» está repetido.`); vistos.add(x); }
};
function cabecera(doc, contrato, tipo, e, versiones = [VERSION_LAB]) {
  if (doc.contrato !== contrato) e(`contrato debe ser «${contrato}» (es «${doc.contrato}»).`);
  if (!versiones.includes(doc.version_contrato)) e(`version_contrato debe ser ${versiones.map((v) => `«${v}»`).join(" o ")} (es «${doc.version_contrato}»): no se aceptan otras versiones.`);
  if (typeof doc.es_demo !== "boolean") e("es_demo debe ser true o false.");
  else if (!esIdLab(doc.id, tipo, doc.es_demo)) e(`id «${doc.id}» inválido: ${doc.es_demo ? "un documento DEMO usa «demo-" : "un documento REAL usa «"}${{ encargo: "lab-enc-", ejecucion: "lab-run-", verificacion: "lab-ver-" }[tipo]}…» (minúsculas, cifras, . _ -).`);
}
function privacidad(doc, e, errores = []) {
  // La búsqueda de datos privados (patrones de correo, tokens…) es cuadrática en textos largos: con un texto que ya
  // supera su límite no se ejecuta (el documento ya está rechazado) para que una respuesta enorme no bloquee nada.
  if (errores.some((t) => /superan el límite/.test(t))) { e("datos privados: no se revisaron porque hay textos que superan su límite (corrige el tamaño primero)."); return; }
  for (const p of buscarDatosPrivados(doc)) e(`Dato privado no permitido en ${p.ruta}: ${p.motivo}.`);
}
/** Tamaño total: se comprueba ANTES de todo lo demás (un documento enorme se rechaza con un solo error y no se recorre). */
function tamano(doc, e) {
  const t = tamanoDocumento(doc);
  if (t > LIMITES.bytes_documento) { e(`documento de ${t} caracteres: supera el límite de ${LIMITES.bytes_documento} (no se revisa).`); return false; }
  return true;
}
const cuenta = (lista, max, ruta, e) => { if (Array.isArray(lista) && lista.length > max) e(`${ruta}: ${lista.length} elementos superan el límite de ${max}.`); };
/** Texto humano: obligatorio o no, con tope de longitud y sin caracteres invisibles o de control bidireccional. */
function textoLimpio(v, ruta, e, { max = LIMITES.texto, obligatorio = true } = {}) {
  if (v === null || v === undefined) { if (obligatorio) e(`${ruta} es obligatorio.`); return; }
  if (typeof v !== "string") { e(`${ruta} debe ser texto.`); return; }
  if (obligatorio && v.trim() === "") e(`${ruta} es obligatorio.`);
  if (v.length > max) e(`${ruta}: ${v.length} caracteres superan el límite de ${max}.`);
  if (tieneInvisibles(v)) e(`${ruta}: contiene caracteres invisibles o de control bidireccional (anchura cero, U+202E…): no se admiten.`);
}
const resultado = (errores) => ({ ok: errores.length === 0, errores });

// ======================================================================================== encargo
const C_ENC = ["contrato", "version_contrato", "id", "es_demo", "rol", "pregunta", "insumos", "fuentes_permitidas", "corte_temporal", "herramientas", "limites", "modelo_solicitado", "creado_por", "creado_en"];
const C_INSUMO = ["tipo", "ref", "sha256"];
const C_FUENTE = ["fuente_id", "estado", "origen", "sha256", "texto_sha256", "publicada_en", "conocida_en"];
const C_HERR = ["red", "dominios_permitidos", "ejecutar_comandos"];
const C_LIM = ["max_minutos", "max_tokens_salida", "max_consultas_web"];

export function validarEncargo(doc) {
  const errores = []; const e = (t) => errores.push(t);
  if (!clavesExactas(doc, [...C_ENC, "nota"], "", e, C_ENC)) return resultado(errores);
  if (!tamano(doc, e)) return resultado(errores);
  cabecera(doc, CONTRATO_ENCARGO, "encargo", e);
  if (!ROLES.includes(doc.rol)) e(`rol «${doc.rol}» inválido: ${ROLES.join(" | ")} (cada rol es una ejecución separada).`);
  textoLimpio(doc.pregunta, "pregunta", e);
  if ("nota" in doc) textoLimpio(doc.nota, "nota", e, { obligatorio: false });
  cuenta(doc.insumos, LIMITES.insumos, "insumos", e);
  cuenta(doc.fuentes_permitidas, LIMITES.fuentes, "fuentes_permitidas", e);

  if (!Array.isArray(doc.insumos)) e("insumos debe ser una lista.");
  L(doc.insumos).forEach((x, i) => {
    const r = `insumos[${i}].`;
    if (!clavesExactas(x, C_INSUMO, r, e)) return;
    if (!TIPOS_INSUMO.includes(x.tipo)) e(`${r}tipo «${x.tipo}» inválido: ${TIPOS_INSUMO.join(" | ")} (no existe «memoria»: el Laboratorio no recuerda entre encargos).`);
    if (typeof x.ref !== "string" || !ID_FUENTE.test(x.ref)) e(`${r}ref inválida.`);
    if (!esHuella(x.sha256)) e(`${r}sha256 debe ser una huella SHA-256 (64 hex): cada insumo se fija con su huella.`);
    if (x.tipo === "lab_ejecucion_verificada") {
      if (!esIdDeLaboratorio(x.ref) || !/lab-run-/.test(x.ref)) e(`${r}ref debe ser una ejecución del Laboratorio (lab-run-…).`);
      else if (typeof doc.es_demo === "boolean" && !esIdLab(x.ref, "ejecucion", doc.es_demo)) e(`${r}ref ${x.ref} es de otro mundo: un encargo ${doc.es_demo ? "DEMO" : "REAL"} no usa ejecuciones ${doc.es_demo ? "REALES" : "DEMO"}.`);
      if (doc.rol === "investigador") e(`${r}el investigador trabaja solo con fuentes primarias: no recibe salidas de otros roles.`);
    } else if (esIdDeLaboratorio(x.ref)) e(`${r}una salida del Laboratorio (${x.ref}) no puede entrar como «${x.tipo}»: una respuesta de IA no es una fuente ni una investigación.`);
    if (x.tipo === "banco_evaluacion" && doc.rol !== "critico") e(`${r}el banco de evaluación es solo para el crítico.`);
  });
  unicos(L(doc.insumos).map((x) => `${x?.tipo}:${x?.ref}`), e, "insumos");

  if (!Array.isArray(doc.fuentes_permitidas)) e("fuentes_permitidas debe ser una lista (el catálogo de lo que se puede citar).");
  L(doc.fuentes_permitidas).forEach((f, i) => {
    const r = `fuentes_permitidas[${i}].`;
    if (!clavesExactas(f, C_FUENTE, r, e)) return;
    if (typeof f.fuente_id !== "string" || !ID_FUENTE.test(f.fuente_id)) e(`${r}fuente_id inválido.`);
    if (esIdDeLaboratorio(f.fuente_id)) e(`${r}${f.fuente_id} es una salida del Laboratorio: una respuesta de IA no es una fuente independiente.`);
    if (!["consultada", "pendiente"].includes(f.estado)) e(`${r}estado debe ser consultada | pendiente.`);
    if (!["primaria", "secundaria"].includes(f.origen)) e(`${r}origen debe ser primaria | secundaria (una IA no es origen de fuentes).`);
    if (!nuloO(f.sha256, esHuella)) e(`${r}sha256 debe ser huella o null.`);
    if (!nuloO(f.texto_sha256, esHuella)) e(`${r}texto_sha256 debe ser huella o null.`);
    if (f.estado === "consultada" && !esHuella(f.sha256)) e(`${r}una fuente consultada necesita la huella de su copia (sha256).`);
    if (!nuloO(f.publicada_en, esFechaODia)) e(`${r}publicada_en debe ser fecha (AAAA-MM-DD o instante con zona) o null.`);
    if (!nuloO(f.conocida_en, esFechaODia)) e(`${r}conocida_en debe ser fecha o null.`);
  });
  unicos(L(doc.fuentes_permitidas).map((f) => f?.fuente_id), e, "fuentes_permitidas");

  if (clavesExactas(doc.corte_temporal, ["conocido_antes_de"], "corte_temporal.", e)) {
    if (!nuloO(doc.corte_temporal.conocido_antes_de, esFechaConZona)) e("corte_temporal.conocido_antes_de debe ser instante con zona o null.");
  }
  if (clavesExactas(doc.herramientas, C_HERR, "herramientas.", e)) {
    const h = doc.herramientas;
    if (!["ninguna", "lectura_publica"].includes(h.red)) e("herramientas.red debe ser ninguna | lectura_publica.");
    if (!Array.isArray(h.dominios_permitidos) || h.dominios_permitidos.some((d) => typeof d !== "string" || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(d))) e("herramientas.dominios_permitidos debe ser una lista de dominios.");
    if (h.ejecutar_comandos !== false) e("herramientas.ejecutar_comandos debe ser false: el Laboratorio nunca ejecuta comandos propuestos por una IA.");
    if (h.red === "lectura_publica" && doc.rol !== "investigador") e("herramientas.red: solo el investigador puede consultar información pública.");
    if (h.red === "lectura_publica" && !L(h.dominios_permitidos).length) e("herramientas.dominios_permitidos: con red se exige una lista de dominios.");
    if (h.red === "ninguna" && L(h.dominios_permitidos).length) e("herramientas.dominios_permitidos debe estar vacía si red = ninguna.");
  }
  if (clavesExactas(doc.limites, C_LIM, "limites.", e)) {
    const l = doc.limites;
    if (!esEnteroEntre(l.max_minutos, 1, 120)) e("limites.max_minutos debe ser entero entre 1 y 120.");
    if (!esEnteroEntre(l.max_tokens_salida, 1, 200000)) e("limites.max_tokens_salida debe ser entero entre 1 y 200000.");
    if (!esEnteroEntre(l.max_consultas_web, 0, 50)) e("limites.max_consultas_web debe ser entero entre 0 y 50.");
    if (doc.herramientas?.red === "ninguna" && l.max_consultas_web !== 0) e("limites.max_consultas_web debe ser 0 si red = ninguna.");
  }
  if (clavesExactas(doc.modelo_solicitado, ["adaptador", "nombre"], "modelo_solicitado.", e)) {
    if (!ADAPTADORES.includes(doc.modelo_solicitado.adaptador)) e(`modelo_solicitado.adaptador debe ser ${ADAPTADORES.join(" | ")}.`);
    if (!texto(doc.modelo_solicitado.nombre)) e("modelo_solicitado.nombre es obligatorio (lo que se pide; lo que respondió lo declara la ejecución).");
  }
  if (clavesExactas(doc.creado_por, ["tipo", "identificador"], "creado_por.", e)) {
    if (doc.creado_por.tipo !== "humano") e("creado_por.tipo debe ser «humano»: una IA no se encarga trabajo a sí misma.");
    if (!texto(doc.creado_por.identificador)) e("creado_por.identificador es obligatorio.");
  }
  if (!esFechaConZona(doc.creado_en)) e("creado_en debe ser instante con zona.");
  privacidad(doc, e, errores);
  return resultado(errores);
}

// ======================================================================================== ejecución
const C_EJ = ["contrato", "version_contrato", "id", "es_demo", "encargo_id", "encargo_sha256", "rol", "estado", "inicio", "fin", "latido", "autor", "afirmaciones", "hipotesis", "objeciones", "dudas", "contradicciones", "consultas_web", "uso", "error"];
/** 0.2 = 0.1 + intercambio (procedencia del intercambio manual) + preguntas, limitaciones y recomendaciones del rol. */
const C_EJ_02 = [...C_EJ, "intercambio", "preguntas", "limitaciones", "recomendaciones"];
const C_AUTOR_02 = ["tipo", "identificador", "adaptador", "proveedor", "modelo", "procedencia", "verificada"];
const C_INTERCAMBIO = ["formato", "declarado_por", "metodo", "importado_en", "respuesta_sha256", "solicitud_sha256", "modelo_en_respuesta", "avisos"];
const C_REC = ["id", "texto", "se_basa_en"];
const C_AF = ["id", "texto", "clase", "citas"];
const C_AF_02 = [...C_AF, "se_basa_en"];
/** Referencia a algo de esta salida (id local) o a una entidad de un insumo del encargo («<insumo>#<id>»). */
const REF_INSUMO = /^[a-z0-9][a-z0-9._-]{1,80}#[a-z0-9._-]{1,41}$/i;
const C_CITA = ["fuente_id", "extracto", "ubicacion"];
const C_HIP = ["id", "enunciado", "se_refuta_si", "experimento", "alternativa_a"];
const C_OBJ = ["id", "a", "tipo", "texto"];
const C_WEB = ["url", "consultado_en", "sha256_respuesta", "publicado_en"];
const ID_LOCAL = /^[a-z0-9][a-z0-9._-]{0,40}$/i;

export function validarEjecucion(doc) {
  const errores = []; const e = (t) => errores.push(t);
  const v02 = esObj(doc) && doc.version_contrato === "0.2";
  if (!clavesExactas(doc, v02 ? C_EJ_02 : C_EJ, "", e)) return resultado(errores);
  if (!tamano(doc, e)) return resultado(errores);
  cabecera(doc, CONTRATO_EJECUCION, "ejecucion", e, VERSIONES_EJECUCION);
  if (!esIdLab(doc.encargo_id, "encargo", doc.es_demo === true)) e(`encargo_id «${doc.encargo_id}» inválido (y debe ser del mismo mundo DEMO/REAL que la ejecución).`);
  if (!esHuella(doc.encargo_sha256)) e("encargo_sha256 debe ser la huella del encargo exacto que se ejecutó.");
  if (!ROLES.includes(doc.rol)) e(`rol «${doc.rol}» inválido.`);
  if (!ESTADOS_EJECUCION.includes(doc.estado)) e(`estado «${doc.estado}» inválido: ${ESTADOS_EJECUCION.join(" | ")}.`);
  for (const k of ["inicio", "fin", "latido"]) if (!nuloO(doc[k], esFechaConZona)) e(`${k} debe ser instante con zona o null.`);
  if (doc.estado !== "en_cola" && doc.inicio === null) e("inicio es obligatorio salvo en_cola.");
  if (["terminado", "fallo", "cancelado", "sin_conexion", "excedio_limite"].includes(doc.estado) && doc.fin === null) e(`fin es obligatorio en estado ${doc.estado}.`);
  if (esFechaConZona(doc.inicio) && esFechaConZona(doc.fin) && Date.parse(doc.fin) < Date.parse(doc.inicio)) e("fin es anterior a inicio.");
  if (esFechaConZona(doc.inicio) && esFechaConZona(doc.latido) && Date.parse(doc.latido) < Date.parse(doc.inicio)) e("latido es anterior a inicio.");
  if (esFechaConZona(doc.fin) && esFechaConZona(doc.latido) && Date.parse(doc.latido) > Date.parse(doc.fin)) e("latido es posterior a fin.");

  if (v02) autoria02(doc, e);
  else if (clavesExactas(doc.autor, ["tipo", "identificador", "adaptador"], "autor.", e)) {
    if (doc.autor.tipo !== "ia") e("autor.tipo debe ser «ia»: una salida de modelo no puede presentarse como humana ni como código.");
    if (!texto(doc.autor.identificador)) e("autor.identificador es obligatorio (el modelo que declaró responder).");
    if (!ADAPTADORES.includes(doc.autor.adaptador)) e(`autor.adaptador debe ser ${ADAPTADORES.join(" | ")}.`);
  }
  for (const k of ["afirmaciones", "hipotesis", "objeciones", "dudas", "contradicciones", "consultas_web"]) {
    if (!Array.isArray(doc[k])) e(`${k} debe ser una lista (vacía si no hay): una respuesta incompleta no se rellena.`);
    else cuenta(doc[k], LIMITES[k], k, e);
  }
  const idsAf = new Set(L(doc.afirmaciones).map((a) => a?.id)), idsHip = new Set(L(doc.hipotesis).map((h) => h?.id));
  /** Una objeción apunta a algo de esta misma salida (afirmación o hipótesis) o a «<insumo>#<id>»: una entidad de un
   *  insumo del encargo (p. ej. `banco-bns-2015-v1#e01`, `lab-run-x#a3`). lab-V comprueba que el insumo exista en el encargo. */
  const referenciaObjecion = (a) => typeof a === "string" && (idsAf.has(a) || idsHip.has(a) || (REF_INSUMO.test(a) && !a.includes("..")));

  L(doc.afirmaciones).forEach((a, i) => {
    const r = `afirmaciones[${i}].`;
    if (!clavesExactas(a, v02 ? C_AF_02 : C_AF, r, e)) return;
    if (v02) referencias(a.se_basa_en, `${r}se_basa_en`, e, referenciaObjecion, a.id);
    if (typeof a.id !== "string" || !ID_LOCAL.test(a.id)) e(`${r}id inválido.`);
    textoLimpio(a.texto, `${r}texto`, e);
    if (!CLASES_AFIRMACION.includes(a.clase)) e(`${r}clase «${a.clase}» inválida: ${CLASES_AFIRMACION.join(" | ")}.`);
    if (!Array.isArray(a.citas)) { e(`${r}citas debe ser una lista.`); return; }
    cuenta(a.citas, LIMITES.citas_por_afirmacion, `${r}citas`, e);
    a.citas.forEach((c, j) => {
      const rc = `${r}citas[${j}].`;
      if (!clavesExactas(c, C_CITA, rc, e)) return;
      if (typeof c.fuente_id !== "string" || !ID_FUENTE.test(c.fuente_id)) e(`${rc}fuente_id inválido.`);
      if (typeof c.extracto !== "string") e(`${rc}extracto debe ser texto.`);
      else textoLimpio(c.extracto, `${rc}extracto`, e, { max: LIMITES.extracto, obligatorio: false });
      if (!nuloO(c.ubicacion, (v) => typeof v === "string")) e(`${rc}ubicacion debe ser texto o null.`);
      else textoLimpio(c.ubicacion, `${rc}ubicacion`, e, { obligatorio: false });
    });
  });
  unicos(L(doc.afirmaciones).map((a) => a?.id), e, "afirmaciones");
  L(doc.hipotesis).forEach((h, i) => {
    const r = `hipotesis[${i}].`;
    if (!clavesExactas(h, C_HIP, r, e)) return;
    if (typeof h.id !== "string" || !ID_LOCAL.test(h.id)) e(`${r}id inválido.`);
    for (const k of ["enunciado", "se_refuta_si", "experimento"]) { if (!texto(h[k])) e(`${r}${k} es obligatorio (una hipótesis sin condición de refutación ni experimento no es falsable).`); else textoLimpio(h[k], `${r}${k}`, e); }
    if (!nuloO(h.alternativa_a, (v) => typeof v === "string")) e(`${r}alternativa_a debe ser texto o null.`);
    else if (h.alternativa_a !== null && (!idsHip.has(h.alternativa_a) || h.alternativa_a === h.id)) e(`${r}alternativa_a «${h.alternativa_a}» no es otra hipótesis de esta salida (referencia rota).`);
  });
  unicos(L(doc.hipotesis).map((h) => h?.id), e, "hipotesis");
  L(doc.objeciones).forEach((o, i) => {
    const r = `objeciones[${i}].`;
    if (!clavesExactas(o, C_OBJ, r, e)) return;
    if (!texto(o.id) || !texto(o.a) || !texto(o.texto)) e(`${r}id, a y texto son obligatorios.`);
    else { if (typeof o.id !== "string" || !ID_LOCAL.test(o.id)) e(`${r}id inválido.`); textoLimpio(o.texto, `${r}texto`, e); if (!referenciaObjecion(o.a)) e(`${r}a «${o.a}» no apunta a una afirmación o hipótesis de esta salida ni a «<insumo>#<id>» (referencia rota).`); }
    const tipos = v02 ? TIPOS_OBJECION_02 : TIPOS_OBJECION;
    if (!tipos.includes(o.tipo)) e(`${r}tipo debe ser ${tipos.join(" | ")}.`);
  });
  unicos(L(doc.objeciones).map((o) => o?.id), e, "objeciones");
  L(doc.dudas).forEach((d, i) => { if (!texto(d)) e(`dudas[${i}] debe ser texto.`); else textoLimpio(d, `dudas[${i}]`, e); });
  L(doc.contradicciones).forEach((c, i) => {
    const r = `contradicciones[${i}].`;
    if (!clavesExactas(c, ["fuentes", "texto"], r, e)) return;
    if (!Array.isArray(c.fuentes) || c.fuentes.length < 2) e(`${r}fuentes: una contradicción necesita al menos dos fuentes.`);
    else {
      c.fuentes.forEach((f, j) => { if (typeof f !== "string" || !ID_FUENTE.test(f)) e(`${r}fuentes[${j}] debe ser un id de fuente.`); });
      unicos(c.fuentes, e, `${r}fuentes`);
    }
    if (!texto(c.texto)) e(`${r}texto es obligatorio.`); else textoLimpio(c.texto, `${r}texto`, e);
  });
  L(doc.consultas_web).forEach((w, i) => {
    const r = `consultas_web[${i}].`;
    if (!clavesExactas(w, C_WEB, r, e)) return;
    if (typeof w.url !== "string" || !/^https:\/\/[^\s]+$/.test(w.url)) e(`${r}url debe ser https.`);
    if (!esFechaConZona(w.consultado_en)) e(`${r}consultado_en debe ser instante con zona.`);
    if (!esHuella(w.sha256_respuesta)) e(`${r}sha256_respuesta debe ser huella de lo recibido.`);
    if (!nuloO(w.publicado_en, esFechaODia)) e(`${r}publicado_en debe ser fecha o null («desconocida» = null).`);
  });
  if (clavesExactas(doc.uso, ["tokens_entrada", "tokens_salida", "costo_mxn"], "uso.", e)) {
    for (const k of ["tokens_entrada", "tokens_salida"]) if (!nuloO(doc.uso[k], (v) => Number.isInteger(v) && v >= 0)) e(`uso.${k} debe ser entero ≥ 0 o null (desconocido).`);
    if (typeof doc.uso.costo_mxn !== "number" || !(doc.uso.costo_mxn >= 0)) e("uso.costo_mxn debe ser número ≥ 0.");
  }
  if (v02) {
    for (const k of ["preguntas", "limitaciones"]) {
      if (!Array.isArray(doc[k])) e(`${k} debe ser una lista (vacía si no hay).`);
      else { cuenta(doc[k], LIMITES.dudas, k, e); doc[k].forEach((t, i) => { if (!texto(t)) e(`${k}[${i}] debe ser texto.`); else textoLimpio(t, `${k}[${i}]`, e); }); }
    }
    if (!Array.isArray(doc.recomendaciones)) e("recomendaciones debe ser una lista (vacía si no hay).");
    else {
      cuenta(doc.recomendaciones, LIMITES.hipotesis, "recomendaciones", e);
      doc.recomendaciones.forEach((x, i) => {
        const r = `recomendaciones[${i}].`;
        if (!clavesExactas(x, C_REC, r, e)) return;
        if (typeof x.id !== "string" || !ID_LOCAL.test(x.id)) e(`${r}id inválido.`);
        textoLimpio(x.texto, `${r}texto`, e);
        // Una recomendación sin base es una opinión suelta: debe decir en qué hallazgo o hipótesis se apoya.
        if (Array.isArray(x.se_basa_en) && !x.se_basa_en.length) e(`${r}se_basa_en: una recomendación debe apoyarse en al menos un hallazgo o hipótesis (no hay recomendaciones sin justificación).`);
        referencias(x.se_basa_en, `${r}se_basa_en`, e, referenciaObjecion, null);
      });
      unicos(doc.recomendaciones.map((x) => x?.id), e, "recomendaciones");
    }
    if (ESTADOS_CON_SALIDA.includes(doc.estado) && doc.autor?.tipo === "ia_manual" && !esObj(doc.intercambio)) e("una respuesta manual terminada debe traer su intercambio (quién la trajo, cuándo y su huella).");
  }
  if (!nuloO(doc.error, (v) => typeof v === "string")) e("error debe ser texto o null.");
  else textoLimpio(doc.error, "error", e, { obligatorio: false });
  if (ESTADOS_CON_ERROR.includes(doc.estado) && !texto(doc.error)) e(`estado ${doc.estado}: error es obligatorio (se conserva literal para auditoría).`);
  if (ESTADOS_CON_ERROR.includes(doc.estado) && L(doc.afirmaciones).length) e(`estado ${doc.estado}: no puede traer afirmaciones (una salida fallida no se usa).`);
  if (ESTADOS_CON_SALIDA.includes(doc.estado) && doc.error !== null) e("estado terminado: error debe ser null (si hubo error, el estado es fallo).");
  if (ESTADOS_CON_SALIDA.includes(doc.estado) && !L(doc.afirmaciones).length && !L(doc.hipotesis).length && !L(doc.objeciones).length) e("estado terminado sin afirmaciones, hipótesis ni objeciones: respuesta vacía.");
  privacidad(doc, e, errores);
  return resultado(errores);
}

/** Lista de referencias (`se_basa_en`): ids locales o «<insumo>#<id>»; nunca a sí misma. */
function referencias(lista, ruta, e, valida, propio) {
  if (!Array.isArray(lista)) { e(`${ruta} debe ser una lista (vacía si no hay).`); return; }
  if (lista.length > LIMITES.citas_por_afirmacion) e(`${ruta}: ${lista.length} referencias superan el límite de ${LIMITES.citas_por_afirmacion}.`);
  lista.forEach((x, j) => {
    if (!valida(x)) e(`${ruta}[${j}] «${x}» no apunta a una afirmación o hipótesis de esta salida ni a «<insumo>#<id>» (referencia rota).`);
    else if (propio !== null && x === propio) e(`${ruta}[${j}]: una afirmación no puede apoyarse en sí misma (circular).`);
  });
}

/**
 * Autoría 0.2. Lo que se exige no depende de lo que diga el texto, sino de cómo se produjo la salida:
 *   guion_demo     solo DEMO; adaptador «ninguno» (guion) o «automatico» con proveedor «prueba» (transporte de prueba);
 *   ia_manual      adaptador «manual-claude», procedencia «declarada» y el intercambio que lo respalda;
 *   ia_automatica  adaptador «ollama» o «automatico», proveedor real (no «prueba»), procedencia «informada_por_adaptador».
 * `verificada` es siempre false: no hay forma criptográfica de comprobar qué modelo respondió.
 */
function autoria02(doc, e) {
  const a = doc.autor;
  if (!clavesExactas(a, C_AUTOR_02, "autor.", e)) return;
  if (!AUTORIAS_EJECUCION.includes(a.tipo)) { e(`autor.tipo debe ser ${AUTORIAS_EJECUCION.join(" | ")} (una ejecución es la salida de un rol: ni código ni persona; en 0.1 era «ia»).`); return; }
  if (!texto(a.identificador) || a.identificador.length > 120) e("autor.identificador es obligatorio (hasta 120 caracteres).");
  else textoLimpio(a.identificador, "autor.identificador", e);
  if (!ADAPTADORES.includes(a.adaptador)) e(`autor.adaptador debe ser ${ADAPTADORES.join(" | ")}.`);
  for (const k of ["proveedor", "modelo"]) { if (!nuloO(a[k], (v) => typeof v === "string" && v.trim() !== "" && v.length <= 120)) e(`autor.${k} debe ser texto (hasta 120) o null (desconocido).`); else textoLimpio(a[k], `autor.${k}`, e, { obligatorio: false }); }
  if (!PROCEDENCIAS.includes(a.procedencia)) e(`autor.procedencia debe ser ${PROCEDENCIAS.join(" | ")}.`);
  if (a.verificada !== false) e("autor.verificada debe ser false: este proyecto no puede comprobar criptográficamente qué modelo respondió (la procedencia es declarada).");
  const guion = /guion|sin-modelo/i.test(String(a.identificador));
  if (a.tipo === "guion_demo") {
    if (doc.es_demo !== true) e("autor guion_demo solo en DEMO: un guion escrito a mano nunca se presenta como análisis de datos reales.");
    if (!(a.adaptador === "ninguno" || (a.adaptador === "automatico" && a.proveedor === "prueba"))) e("autor guion_demo: adaptador «ninguno» (guion) o «automatico» con proveedor «prueba» (transporte de prueba).");
    if (a.procedencia !== "no_aplica") e("autor guion_demo: procedencia «no_aplica» (no hubo modelo).");
    if (a.modelo !== null) e("autor guion_demo: modelo debe ser null (no hubo modelo).");
    if (doc.intercambio !== null) e("autor guion_demo: intercambio debe ser null (nadie trajo una respuesta).");
  } else {
    if (guion) e(`autor.identificador «${a.identificador}» es el de un guion: un guion no puede declararse IA.`);
    if (a.adaptador === "ninguno") e("adaptador «ninguno» = no hubo modelo: no puede ser autoría de IA.");
  }
  if (a.tipo === "ia_manual") {
    if (a.adaptador !== "manual-claude") e("autor ia_manual: adaptador «manual-claude».");
    if (a.procedencia !== "declarada") e("autor ia_manual: procedencia «declarada» (la persona que pegó la respuesta dice de qué modelo vino; nadie lo verificó).");
    if (doc.intercambio !== null) intercambio(doc.intercambio, doc, e);
  }
  if (a.tipo === "ia_automatica") {
    if (!["ollama", "automatico"].includes(a.adaptador)) e("autor ia_automatica: adaptador «ollama» o «automatico».");
    if (a.proveedor === null || a.proveedor === "prueba") e("autor ia_automatica: proveedor real obligatorio (un transporte de prueba es guion_demo, no IA).");
    if (a.procedencia !== "informada_por_adaptador") e("autor ia_automatica: procedencia «informada_por_adaptador».");
    if (doc.intercambio !== null) e("autor ia_automatica: intercambio debe ser null (es para respuestas traídas a mano).");
  }
}
function intercambio(x, doc, e) {
  if (!clavesExactas(x, [...C_INTERCAMBIO, "correcciones"], "intercambio.", e, C_INTERCAMBIO)) return;
  // fase 3.1 (opcional): correcciones de FORMA aplicadas al importar, por código; nunca cambian el significado.
  if ("correcciones" in x && !(Array.isArray(x.correcciones) && x.correcciones.length <= 20 && x.correcciones.every((c) => typeof c === "string" && /^[a-z_]{1,60}$/.test(c)))) e("intercambio.correcciones debe ser una lista de códigos (a-z y _, hasta 20).");
  if (x.formato !== "cauce.lab.respuesta-manual 0.1") e("intercambio.formato debe ser «cauce.lab.respuesta-manual 0.1».");
  if (!esObj(x.declarado_por) || x.declarado_por.tipo !== "humano" || !texto(x.declarado_por.identificador) || Object.keys(x.declarado_por).length !== 3 || x.declarado_por.autenticacion !== "declarada")
    e("intercambio.declarado_por debe ser {tipo: humano, identificador, autenticacion: declarada}: una persona trajo la respuesta.");
  if (!["pegado", "archivo"].includes(x.metodo)) e("intercambio.metodo debe ser pegado | archivo.");
  if (!esFechaConZona(x.importado_en)) e("intercambio.importado_en debe ser instante con zona.");
  if (!esHuella(x.respuesta_sha256)) e("intercambio.respuesta_sha256 debe ser la huella del texto pegado tal cual.");
  if (!esHuella(x.solicitud_sha256)) e("intercambio.solicitud_sha256 debe ser la huella de la solicitud que se copió.");
  if (!nuloO(x.modelo_en_respuesta, (v) => typeof v === "string" && v.length <= 120)) e("intercambio.modelo_en_respuesta debe ser texto (hasta 120) o null.");
  else textoLimpio(x.modelo_en_respuesta, "intercambio.modelo_en_respuesta", e, { obligatorio: false });
  if (!Array.isArray(x.avisos) || x.avisos.length > 20) e("intercambio.avisos debe ser una lista (hasta 20).");
  else x.avisos.forEach((t, i) => textoLimpio(t, `intercambio.avisos[${i}]`, e));
}

/**
 * Autoría de una ejecución, en cualquier versión (para mostrar e informar). Una 0.1 no se reescribe (su huella está
 * citada): se INTERPRETA por su adaptador y se marca `legado: true`. «ninguno» → guion DEMO; «manual-claude» → IA
 * manual sin intercambio registrado; «ollama» → IA automática.
 */
export function autoriaDeEjecucion(ej) {
  const a = esObj(ej?.autor) ? ej.autor : {};
  if (ej?.version_contrato === "0.2") return { tipo: a.tipo, identificador: a.identificador, proveedor: a.proveedor ?? null, modelo: a.modelo ?? null, procedencia: a.procedencia, verificada: false, declarado_por: ej.intercambio?.declarado_por?.identificador ?? null, legado: false };
  const tipo = a.adaptador === "ninguno" ? "guion_demo" : a.adaptador === "manual-claude" ? "ia_manual" : "ia_automatica";
  return { tipo, identificador: a.identificador ?? null, proveedor: null, modelo: tipo === "guion_demo" ? null : a.identificador ?? null, procedencia: tipo === "guion_demo" ? "no_aplica" : tipo === "ia_manual" ? "declarada" : "informada_por_adaptador", verificada: false, declarado_por: null, legado: true };
}

// ======================================================================================== verificación
const C_VER = ["contrato", "version_contrato", "id", "es_demo", "ejecucion_id", "ejecucion_sha256", "encargo_id", "encargo_sha256", "autor", "verificado_en", "resultado", "incompleta", "errores", "fuentes", "citas", "afirmaciones", "alertas", "resumen", "revision_humana"];
export const RESULTADOS_VERIFICACION = ["apta_para_revision_humana", "con_fallas", "rechazada", "sin_salida"];
export const INTEGRIDAD = ["integra", "alterada", "copia_ausente", "sin_huella_registrada", "pendiente", "no_aplica"];
export const TEXTO_FUENTE = ["integro", "alterado", "ausente", "sin_huella_registrada", "no_aplica"];
export const EXISTENCIA = ["registrada", "inexistente", "respuesta_ia"];
export const COINCIDENCIA = ["literal", "normalizada", "no_encontrada", "no_evaluable"];
export const TEMPORAL = ["dentro_de_corte", "posterior_al_corte", "fecha_desconocida", "indeterminada", "sin_corte"];
export const ESTADO_CITA_AFIRMACION = ["con_cita_utilizable", "sin_respaldo_citado", "citas_con_fallas", "no_requiere_cita"];
const C_VF = ["fuente_id", "integridad", "texto", "sha256_esperado", "sha256_calculado"];
const C_VC = ["afirmacion_id", "indice", "fuente_id", "existencia", "integridad", "coincidencia", "apariciones", "temporal", "alertas", "cita_utilizable"];
const C_VA = ["afirmacion_id", "clase", "estado_cita", "respaldo_semantico", "alertas"];
const C_RES = ["n_afirmaciones", "n_citas", "n_citas_utilizables", "n_citas_inexistentes", "n_extractos_no_encontrados", "n_fuentes_alteradas", "n_fuera_de_corte", "n_fecha_desconocida", "n_circulares", "n_sin_respaldo", "n_alertas"];

export function validarVerificacion(doc) {
  const errores = []; const e = (t) => errores.push(t);
  if (!clavesExactas(doc, C_VER, "", e)) return resultado(errores);
  if (!tamano(doc, e)) return resultado(errores);
  cabecera(doc, CONTRATO_VERIFICACION, "verificacion", e);
  // Una verificación RECHAZADA conserva los ids tal como llegaron (pueden ser justamente el error: mezcla DEMO/REAL).
  if (doc.resultado === "rechazada") { if (typeof doc.ejecucion_id !== "string" || typeof doc.encargo_id !== "string") e("ejecucion_id y encargo_id deben ser texto."); }
  else {
    if (!esIdLab(doc.ejecucion_id, "ejecucion", doc.es_demo === true)) e("ejecucion_id inválido (o de otro mundo DEMO/REAL).");
    if (!esIdLab(doc.encargo_id, "encargo", doc.es_demo === true)) e("encargo_id inválido (o de otro mundo DEMO/REAL).");
  }
  if (!nuloO(doc.ejecucion_sha256, esHuella) || !nuloO(doc.encargo_sha256, esHuella)) e("ejecucion_sha256 / encargo_sha256 deben ser huellas o null.");
  if (!esObj(doc.autor) || doc.autor.tipo !== AUTOR_VERIFICADOR.tipo || doc.autor.identificador !== AUTOR_VERIFICADOR.identificador || doc.autor.version !== AUTOR_VERIFICADOR.version || Object.keys(doc.autor).length !== 3)
    e(`autor debe ser exactamente ${JSON.stringify(AUTOR_VERIFICADOR)}: solo el código verificador firma verificaciones (una IA no se verifica a sí misma).`);
  if (!esFechaConZona(doc.verificado_en)) e("verificado_en debe ser instante con zona.");
  if (!RESULTADOS_VERIFICACION.includes(doc.resultado)) e(`resultado debe ser ${RESULTADOS_VERIFICACION.join(" | ")} (no existe «verdadera» ni «aprobada»).`);
  if (typeof doc.incompleta !== "boolean") e("incompleta debe ser true o false.");
  if (!Array.isArray(doc.errores) || doc.errores.some((t) => typeof t !== "string")) e("errores debe ser una lista de textos.");
  else cuenta(doc.errores, LIMITES.errores, "errores", e);
  if (doc.resultado === "rechazada" && !L(doc.errores).length) e("una verificación rechazada debe conservar sus errores.");
  if (doc.resultado !== "rechazada" && L(doc.errores).length) e(`resultado «${doc.resultado}» con ${L(doc.errores).length} error(es): con errores el resultado es «rechazada» (estado imposible).`);
  for (const k of ["fuentes", "citas", "afirmaciones", "alertas"]) if (!Array.isArray(doc[k])) e(`${k} debe ser una lista.`);
  L(doc.alertas).forEach((a, i) => {
    if (!clavesExactas(a, ["codigo", "ruta", "detalle"], `alertas[${i}].`, e)) return;
    for (const k of ["codigo", "ruta", "detalle"]) if (typeof a[k] !== "string") e(`alertas[${i}].${k} debe ser texto.`);
  });
  L(doc.fuentes).forEach((f, i) => {
    if (!clavesExactas(f, C_VF, `fuentes[${i}].`, e)) return;
    if (!INTEGRIDAD.includes(f.integridad)) e(`fuentes[${i}].integridad inválida.`);
    if (!TEXTO_FUENTE.includes(f.texto)) e(`fuentes[${i}].texto inválido.`);
  });
  L(doc.citas).forEach((c, i) => {
    const r = `citas[${i}].`;
    if (!clavesExactas(c, C_VC, r, e)) return;
    if (!EXISTENCIA.includes(c.existencia)) e(`${r}existencia inválida.`);
    if (!nuloO(c.integridad, (v) => INTEGRIDAD.includes(v))) e(`${r}integridad inválida.`);
    if (!COINCIDENCIA.includes(c.coincidencia)) e(`${r}coincidencia inválida.`);
    if (!TEMPORAL.includes(c.temporal)) e(`${r}temporal inválido.`);
    if (!Number.isInteger(c.apariciones) || c.apariciones < 0) e(`${r}apariciones debe ser entero ≥ 0.`);
    if (!Array.isArray(c.alertas) || c.alertas.some((t) => typeof t !== "string")) e(`${r}alertas debe ser una lista de códigos.`);
    if (typeof c.cita_utilizable !== "boolean") e(`${r}cita_utilizable debe ser booleano.`);
    if (c.cita_utilizable && (c.existencia !== "registrada" || c.integridad !== "integra" || !["literal", "normalizada"].includes(c.coincidencia) || !["dentro_de_corte", "sin_corte"].includes(c.temporal)))
      e(`${r}cita_utilizable = true exige fuente registrada e íntegra, extracto encontrado y fecha dentro del corte.`);
  });
  L(doc.afirmaciones).forEach((a, i) => {
    const r = `afirmaciones[${i}].`;
    if (!clavesExactas(a, C_VA, r, e)) return;
    if (!CLASES_AFIRMACION.includes(a.clase)) e(`${r}clase inválida.`);
    if (!ESTADO_CITA_AFIRMACION.includes(a.estado_cita)) e(`${r}estado_cita inválido.`);
    if (a.respaldo_semantico !== "pendiente_revision_humana") e(`${r}respaldo_semantico debe ser «pendiente_revision_humana»: encontrar un extracto no demuestra que la afirmación sea verdadera.`);
  });
  if (clavesExactas(doc.resumen, C_RES, "resumen.", e)) {
    for (const k of C_RES) if (!Number.isInteger(doc.resumen[k]) || doc.resumen[k] < 0) e(`resumen.${k} debe ser entero ≥ 0.`);
    // El resumen se recalcula de las listas: un resumen que no cuadra es una verificación manipulada o un defecto de lab-V.
    const citas = L(doc.citas), n = (f) => citas.filter(f).length;
    const esperado = {
      n_afirmaciones: L(doc.afirmaciones).length, n_citas: citas.length, n_citas_utilizables: n((c) => c?.cita_utilizable === true),
      n_citas_inexistentes: n((c) => c?.existencia === "inexistente"), n_extractos_no_encontrados: n((c) => c?.coincidencia === "no_encontrada"),
      n_fuera_de_corte: n((c) => c?.temporal === "posterior_al_corte"), n_fecha_desconocida: n((c) => c?.temporal === "fecha_desconocida"),
      n_alertas: L(doc.alertas).length,
    };
    for (const [k, v] of Object.entries(esperado)) if (doc.resumen[k] !== v) e(`resumen.${k} = ${doc.resumen[k]} no cuadra con las listas (${v}).`);
  }
  // Estados imposibles: «apta» solo si nada mecánico la descalifica; «sin_salida» no tiene citas ni afirmaciones.
  if (doc.resultado === "apta_para_revision_humana") {
    if (L(doc.alertas).length) e("resultado «apta_para_revision_humana» con alertas: con alertas el resultado es «con_fallas».");
    if (doc.incompleta === true) e("resultado «apta_para_revision_humana» con incompleta = true: una salida parcial nunca es apta.");
    if (L(doc.citas).some((c) => c?.cita_utilizable !== true)) e("resultado «apta_para_revision_humana» con citas no utilizables.");
  }
  if (doc.resultado === "sin_salida" && (L(doc.citas).length || L(doc.afirmaciones).length)) e("resultado «sin_salida» con citas o afirmaciones verificadas (estado imposible).");
  if (!esObj(doc.revision_humana) || doc.revision_humana.estado !== "pendiente" || Object.keys(doc.revision_humana).length !== 1)
    e("revision_humana debe ser {estado: «pendiente»}: en la fase 1 nada se aprueba; la revisión la hará una persona.");
  return resultado(errores);
}
