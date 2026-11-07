// Laboratorio de IA · fase 1 · contratos `cauce.lab.encargo` 0.1, `cauce.lab.ejecucion` 0.1 y
// `cauce.lab.verificacion` 0.1. Validación ESTRICTA: claves desconocidas, versiones, ids, estados, roles,
// referencias y fechas. Ningún contrato existente (v1, CSI, Nexus) cambia; estos son nuevos y aditivos.
//
// Reglas de autoría (no se pueden saltar con datos):
//   · un ENCARGO lo crea una persona (creado_por.tipo = "humano"): la IA no se encarga trabajo a sí misma;
//   · una EJECUCIÓN siempre es de una IA (autor.tipo = "ia"): una salida de modelo no puede presentarse como humana o código;
//   · una VERIFICACIÓN solo la firma el código `lab-V` y nunca declara respaldo semántico ni aprobación: eso queda
//     «pendiente_revision_humana» en la fase 1.

import {
  VERSION_LAB, AUTOR_VERIFICADOR, CONTRATO_ENCARGO, CONTRATO_EJECUCION, CONTRATO_VERIFICACION, ROLES, ESTADOS_EJECUCION,
  ESTADOS_CON_SALIDA, ESTADOS_CON_ERROR, CLASES_AFIRMACION, TIPOS_INSUMO, ADAPTADORES, TIPOS_OBJECION, ID_FUENTE,
  esIdLab, esIdDeLaboratorio, esObj, L, esEnteroEntre, clavesExactas, esFechaConZona, esFechaODia, texto, esHuella, buscarDatosPrivados,
} from "./base.js";

const nuloO = (v, f) => v === null || f(v);
const unicos = (lista, e, ruta) => {
  const vistos = new Set();
  for (const x of lista) { if (vistos.has(x)) e(`${ruta}: «${x}» está repetido.`); vistos.add(x); }
};
function cabecera(doc, contrato, tipo, e) {
  if (doc.contrato !== contrato) e(`contrato debe ser «${contrato}» (es «${doc.contrato}»).`);
  if (doc.version_contrato !== VERSION_LAB) e(`version_contrato debe ser «${VERSION_LAB}» (es «${doc.version_contrato}»): no se aceptan otras versiones.`);
  if (typeof doc.es_demo !== "boolean") e("es_demo debe ser true o false.");
  else if (!esIdLab(doc.id, tipo, doc.es_demo)) e(`id «${doc.id}» inválido: ${doc.es_demo ? "un documento DEMO usa «demo-" : "un documento REAL usa «"}${{ encargo: "lab-enc-", ejecucion: "lab-run-", verificacion: "lab-ver-" }[tipo]}…» (minúsculas, cifras, . _ -).`);
}
function privacidad(doc, e) {
  for (const p of buscarDatosPrivados(doc)) e(`Dato privado no permitido en ${p.ruta}: ${p.motivo}.`);
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
  cabecera(doc, CONTRATO_ENCARGO, "encargo", e);
  if (!ROLES.includes(doc.rol)) e(`rol «${doc.rol}» inválido: ${ROLES.join(" | ")} (cada rol es una ejecución separada).`);
  if (!texto(doc.pregunta)) e("pregunta es obligatoria.");
  if ("nota" in doc && typeof doc.nota !== "string") e("nota debe ser texto.");

  if (!Array.isArray(doc.insumos)) e("insumos debe ser una lista.");
  L(doc.insumos).forEach((x, i) => {
    const r = `insumos[${i}].`;
    if (!clavesExactas(x, C_INSUMO, r, e)) return;
    if (!TIPOS_INSUMO.includes(x.tipo)) e(`${r}tipo «${x.tipo}» inválido: ${TIPOS_INSUMO.join(" | ")} (no existe «memoria»: el Laboratorio no recuerda entre encargos).`);
    if (typeof x.ref !== "string" || !ID_FUENTE.test(x.ref)) e(`${r}ref inválida.`);
    if (!esHuella(x.sha256)) e(`${r}sha256 debe ser una huella SHA-256 (64 hex): cada insumo se fija con su huella.`);
    if (x.tipo === "lab_ejecucion_verificada") {
      if (!esIdDeLaboratorio(x.ref) || !/lab-run-/.test(x.ref)) e(`${r}ref debe ser una ejecución del Laboratorio (lab-run-…).`);
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
  privacidad(doc, e);
  return resultado(errores);
}

// ======================================================================================== ejecución
const C_EJ = ["contrato", "version_contrato", "id", "es_demo", "encargo_id", "encargo_sha256", "rol", "estado", "inicio", "fin", "latido", "autor", "afirmaciones", "hipotesis", "objeciones", "dudas", "contradicciones", "consultas_web", "uso", "error"];
const C_AF = ["id", "texto", "clase", "citas"];
const C_CITA = ["fuente_id", "extracto", "ubicacion"];
const C_HIP = ["id", "enunciado", "se_refuta_si", "experimento", "alternativa_a"];
const C_OBJ = ["id", "a", "tipo", "texto"];
const C_WEB = ["url", "consultado_en", "sha256_respuesta", "publicado_en"];
const ID_LOCAL = /^[a-z0-9][a-z0-9._-]{0,40}$/i;

export function validarEjecucion(doc) {
  const errores = []; const e = (t) => errores.push(t);
  if (!clavesExactas(doc, C_EJ, "", e)) return resultado(errores);
  cabecera(doc, CONTRATO_EJECUCION, "ejecucion", e);
  if (!esIdLab(doc.encargo_id, "encargo", doc.es_demo === true)) e(`encargo_id «${doc.encargo_id}» inválido (y debe ser del mismo mundo DEMO/REAL que la ejecución).`);
  if (!esHuella(doc.encargo_sha256)) e("encargo_sha256 debe ser la huella del encargo exacto que se ejecutó.");
  if (!ROLES.includes(doc.rol)) e(`rol «${doc.rol}» inválido.`);
  if (!ESTADOS_EJECUCION.includes(doc.estado)) e(`estado «${doc.estado}» inválido: ${ESTADOS_EJECUCION.join(" | ")}.`);
  for (const k of ["inicio", "fin", "latido"]) if (!nuloO(doc[k], esFechaConZona)) e(`${k} debe ser instante con zona o null.`);
  if (doc.estado !== "en_cola" && doc.inicio === null) e("inicio es obligatorio salvo en_cola.");
  if (["terminado", "fallo", "cancelado", "sin_conexion", "excedio_limite"].includes(doc.estado) && doc.fin === null) e(`fin es obligatorio en estado ${doc.estado}.`);
  if (esFechaConZona(doc.inicio) && esFechaConZona(doc.fin) && Date.parse(doc.fin) < Date.parse(doc.inicio)) e("fin es anterior a inicio.");

  if (clavesExactas(doc.autor, ["tipo", "identificador", "adaptador"], "autor.", e)) {
    if (doc.autor.tipo !== "ia") e("autor.tipo debe ser «ia»: una salida de modelo no puede presentarse como humana ni como código.");
    if (!texto(doc.autor.identificador)) e("autor.identificador es obligatorio (el modelo que declaró responder).");
    if (!ADAPTADORES.includes(doc.autor.adaptador)) e(`autor.adaptador debe ser ${ADAPTADORES.join(" | ")}.`);
  }
  for (const k of ["afirmaciones", "hipotesis", "objeciones", "dudas", "contradicciones", "consultas_web"]) if (!Array.isArray(doc[k])) e(`${k} debe ser una lista (vacía si no hay): una respuesta incompleta no se rellena.`);

  L(doc.afirmaciones).forEach((a, i) => {
    const r = `afirmaciones[${i}].`;
    if (!clavesExactas(a, C_AF, r, e)) return;
    if (typeof a.id !== "string" || !ID_LOCAL.test(a.id)) e(`${r}id inválido.`);
    if (!texto(a.texto)) e(`${r}texto es obligatorio.`);
    if (!CLASES_AFIRMACION.includes(a.clase)) e(`${r}clase «${a.clase}» inválida: ${CLASES_AFIRMACION.join(" | ")}.`);
    if (!Array.isArray(a.citas)) { e(`${r}citas debe ser una lista.`); return; }
    a.citas.forEach((c, j) => {
      const rc = `${r}citas[${j}].`;
      if (!clavesExactas(c, C_CITA, rc, e)) return;
      if (typeof c.fuente_id !== "string" || !ID_FUENTE.test(c.fuente_id)) e(`${rc}fuente_id inválido.`);
      if (typeof c.extracto !== "string") e(`${rc}extracto debe ser texto.`);
      if (!nuloO(c.ubicacion, (v) => typeof v === "string")) e(`${rc}ubicacion debe ser texto o null.`);
    });
  });
  unicos(L(doc.afirmaciones).map((a) => a?.id), e, "afirmaciones");
  L(doc.hipotesis).forEach((h, i) => {
    const r = `hipotesis[${i}].`;
    if (!clavesExactas(h, C_HIP, r, e)) return;
    if (typeof h.id !== "string" || !ID_LOCAL.test(h.id)) e(`${r}id inválido.`);
    for (const k of ["enunciado", "se_refuta_si", "experimento"]) if (!texto(h[k])) e(`${r}${k} es obligatorio (una hipótesis sin condición de refutación ni experimento no es falsable).`);
    if (!nuloO(h.alternativa_a, (v) => typeof v === "string")) e(`${r}alternativa_a debe ser texto o null.`);
  });
  unicos(L(doc.hipotesis).map((h) => h?.id), e, "hipotesis");
  L(doc.objeciones).forEach((o, i) => {
    const r = `objeciones[${i}].`;
    if (!clavesExactas(o, C_OBJ, r, e)) return;
    if (!texto(o.id) || !texto(o.a) || !texto(o.texto)) e(`${r}id, a y texto son obligatorios.`);
    if (!TIPOS_OBJECION.includes(o.tipo)) e(`${r}tipo debe ser ${TIPOS_OBJECION.join(" | ")}.`);
  });
  L(doc.dudas).forEach((d, i) => { if (!texto(d)) e(`dudas[${i}] debe ser texto.`); });
  L(doc.contradicciones).forEach((c, i) => {
    const r = `contradicciones[${i}].`;
    if (!clavesExactas(c, ["fuentes", "texto"], r, e)) return;
    if (!Array.isArray(c.fuentes) || c.fuentes.length < 2) e(`${r}fuentes: una contradicción necesita al menos dos fuentes.`);
    if (!texto(c.texto)) e(`${r}texto es obligatorio.`);
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
  if (!nuloO(doc.error, (v) => typeof v === "string")) e("error debe ser texto o null.");
  if (ESTADOS_CON_ERROR.includes(doc.estado) && !texto(doc.error)) e(`estado ${doc.estado}: error es obligatorio (se conserva literal para auditoría).`);
  if (ESTADOS_CON_ERROR.includes(doc.estado) && L(doc.afirmaciones).length) e(`estado ${doc.estado}: no puede traer afirmaciones (una salida fallida no se usa).`);
  if (ESTADOS_CON_SALIDA.includes(doc.estado) && doc.error !== null) e("estado terminado: error debe ser null (si hubo error, el estado es fallo).");
  if (ESTADOS_CON_SALIDA.includes(doc.estado) && !L(doc.afirmaciones).length && !L(doc.hipotesis).length && !L(doc.objeciones).length) e("estado terminado sin afirmaciones, hipótesis ni objeciones: respuesta vacía.");
  privacidad(doc, e);
  return resultado(errores);
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
  if (doc.resultado === "rechazada" && !L(doc.errores).length) e("una verificación rechazada debe conservar sus errores.");
  for (const k of ["fuentes", "citas", "afirmaciones", "alertas"]) if (!Array.isArray(doc[k])) e(`${k} debe ser una lista.`);
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
  if (clavesExactas(doc.resumen, C_RES, "resumen.", e)) for (const k of C_RES) if (!Number.isInteger(doc.resumen[k]) || doc.resumen[k] < 0) e(`resumen.${k} debe ser entero ≥ 0.`);
  if (!esObj(doc.revision_humana) || doc.revision_humana.estado !== "pendiente" || Object.keys(doc.revision_humana).length !== 1)
    e("revision_humana debe ser {estado: «pendiente»}: en la fase 1 nada se aprueba; la revisión la hará una persona.");
  return resultado(errores);
}
