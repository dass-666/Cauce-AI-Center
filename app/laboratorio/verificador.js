// Laboratorio de IA · fase 1 · verificador determinista `lab-V 0.1`. Código, no IA.
//
// Para cada salida de IA (`cauce.lab.ejecucion`) comprueba, POR SEPARADO:
//   1. existencia de la fuente citada en el catálogo del encargo (o si es una respuesta de IA disfrazada de fuente);
//   2. integridad de la copia (SHA-256 de los bytes = huella registrada) y del texto que se usa para buscar;
//   3. coincidencia textual del extracto (literal, o tras normalizar SOLO espacios y Unicode NFC);
//   4. validez temporal frente al corte del encargo (conocida antes / después / fecha desconocida);
//   5. circularidad (directa o indirecta) y reutilización de salidas de IA como insumo;
//   6. clasificación declarada de cada afirmación (hecho citado, inferencia, especulación, desconocido).
// El RESPALDO SEMÁNTICO (si el extracto realmente apoya lo que se afirma) NO lo decide este código: siempre queda
// «pendiente_revision_humana». Encontrar una cita nunca convierte una afirmación en verdadera.
//
// No escribe nada, no usa red y no ejecuta nada de lo que diga la IA. Todos los fallos se conservan en el resultado.

import { AUTOR_VERIFICADOR, VERSION_LAB, CONTRATO_VERIFICACION, ESTADOS_CON_ERROR, ESTADOS_PARCIALES, esIdDeLaboratorio, L, esObj,
  normalizarEspacios, sha256Bytes, apariciones, jsonCanonico, sha256, intervalo, esFechaConZona } from "./base.js";
import { validarEncargo, validarEjecucion, validarVerificacion } from "./contratos.js";

/** Huella de un documento del Laboratorio (JSON canónico: llaves ordenadas). */
export const huellaDoc = (doc) => sha256(jsonCanonico(doc));

/** Un extracto más corto que esto no se puede atribuir con seguridad a un lugar del documento. */
export const MIN_CARACTERES_EXTRACTO = 20;
export const MIN_PALABRAS_EXTRACTO = 4;
/** Ventana (en caracteres normalizados) que se mira ANTES del extracto para avisar de un posible fuera de contexto. */
const VENTANA_CONTEXTO = 80;
const NEGACIONES = /\b(no|nunca|jam[aá]s|falso|falsa|niega|neg[oó]|desminti[oó]|desmiente|rumor(?:es)?|supuestamente|contrario|not|never|false|denied|denies|deny|rumou?red|untrue|contrary|it is not true)\b[^.]*$/i;
const INSTRUCCIONES = /(\brm\s+-rf\b|\bgit\s+(push|reset|commit|merge)\b|\bcurl\s+|\bwget\s+|\bpowershell\b|\bInvoke-WebRequest\b|\buv\s+run\b|\bnpm\s+(i|install)\b|\bpip\s+install\b|\bsudo\b|\bdel\s+\/|\bformat\s+[a-z]:)/i;
const MESES = { ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5, jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11 };

/** Fechas que el TEXTO de una afirmación menciona (AAAA-MM-DD y «15-ene-2015»), como días UTC. */
export function fechasMencionadas(t) {
  const r = [];
  for (const m of String(t).matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) r.push(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  for (const m of String(t).matchAll(/\b(\d{1,2})-(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)-(\d{4})\b/gi)) r.push(Date.UTC(+m[3], MESES[m[2].toLowerCase()], +m[1]));
  return r.filter(Number.isFinite);
}

/**
 * Catálogo de fuentes citables a partir de una investigación CSI (solo lectura; no la modifica).
 * La huella es la de la copia local registrada en el cotejo; texto_sha256 queda null hasta que una persona apruebe
 * la extracción de texto de cada copia (los PDF y HTML no se pueden comparar byte a byte con un extracto).
 */
export function catalogoDesdeInvestigacion(inv) {
  return L(inv?.fuentes).map((f) => ({
    fuente_id: f.id,
    estado: f.estado === "pendiente" ? "pendiente" : "consultada",
    origen: f.clase === "primaria" ? "primaria" : "secundaria",
    sha256: typeof f.huella_contenido === "string" ? f.huella_contenido : null,
    texto_sha256: null,
    publicada_en: f.publicada_en ?? null,
    conocida_en: f.disponible_en ?? null,
  }));
}

function temporalDe(fuente, corte) {
  if (corte === null) return "sin_corte";
  const fecha = fuente?.conocida_en ?? fuente?.publicada_en ?? null;
  if (fecha === null) return "fecha_desconocida";
  const iv = intervalo(fecha), t = Date.parse(corte);
  if (!iv) return "fecha_desconocida";
  if (iv[1] < t) return "dentro_de_corte";
  if (iv[0] >= t) return "posterior_al_corte";
  return "indeterminada"; // un día sin hora que cae alrededor del corte: no se puede decidir sin la hora
}

async function integridadFuentes(catalogo, copias) {
  const r = new Map();
  for (const f of catalogo) {
    const c = copias?.get?.(f.fuente_id) ?? null;
    let integridad, textoEstado = "no_aplica", calculado = null;
    if (f.estado === "pendiente") integridad = "pendiente";
    else if (!f.sha256) integridad = "sin_huella_registrada";
    else if (!c || !(c.bytes instanceof Uint8Array)) integridad = "copia_ausente";
    else { calculado = await sha256Bytes(c.bytes); integridad = calculado === f.sha256 ? "integra" : "alterada"; }
    if (f.estado !== "pendiente") {
      if (!c || typeof c.texto !== "string") textoEstado = "ausente";
      else if (!f.texto_sha256) textoEstado = "sin_huella_registrada";
      else textoEstado = (await sha256(c.texto)) === f.texto_sha256 ? "integro" : "alterado";
    }
    r.set(f.fuente_id, { fuente_id: f.fuente_id, integridad, texto: textoEstado, sha256_esperado: f.sha256 ?? null, sha256_calculado: calculado, _texto: c?.texto ?? null, _meta: f });
  }
  return r;
}

/** Recorre insumos de ejecuciones anteriores; devuelve el camino si vuelve a `objetivo` (circularidad indirecta). */
function buscarCiclo(desdeRef, objetivos, registro, camino = [], vistos = new Set()) {
  if (objetivos.has(desdeRef)) return [...camino, desdeRef];
  if (vistos.has(desdeRef)) return null;
  vistos.add(desdeRef);
  const ej = registro?.ejecuciones?.get?.(desdeRef);
  if (!ej) return null;
  if (objetivos.has(ej.encargo_id)) return [...camino, desdeRef, ej.encargo_id];
  const enc = registro?.encargos?.get?.(ej.encargo_id);
  for (const x of L(enc?.insumos)) {
    if (x?.tipo !== "lab_ejecucion_verificada") continue;
    const c = buscarCiclo(x.ref, objetivos, registro, [...camino, desdeRef, ej.encargo_id], vistos);
    if (c) return c;
  }
  return null;
}

/**
 * @param {object} p
 * @param p.encargo    documento cauce.lab.encargo
 * @param p.ejecucion  documento cauce.lab.ejecucion (la salida de la IA)
 * @param p.copias     Map fuente_id → { bytes: Uint8Array|null, texto: string|null } (copias locales; nunca de red)
 * @param p.registro   { encargos: Map, ejecuciones: Map, verificaciones: Map(ejecucion_id → verificación) } para circularidad
 * @param p.ahora      instante con zona de la verificación (se pasa para que el resultado sea reproducible)
 * @returns {Promise<{verificacion: object}>}
 */
export async function verificar({ encargo, ejecucion, copias = new Map(), registro = {}, ahora }) {
  if (!esFechaConZona(ahora)) throw new Error("verificar: «ahora» debe ser instante con zona (resultado reproducible).");
  const errores = [], alertas = [];
  const err = (codigo, detalle) => errores.push(`${codigo}: ${detalle}`);
  const alerta = (codigo, ruta, detalle) => alertas.push({ codigo, ruta, detalle });

  const ve = validarEncargo(encargo), vx = validarEjecucion(ejecucion);
  for (const t of ve.errores) err("encargo_invalido", t);
  for (const t of vx.errores) err("ejecucion_invalida", t);
  const esDemo = esObj(ejecucion) && typeof ejecucion.es_demo === "boolean" ? ejecucion.es_demo : !!encargo?.es_demo;
  const encSha = esObj(encargo) ? await huellaDoc(encargo) : null;
  const ejSha = esObj(ejecucion) ? await huellaDoc(ejecucion) : null;

  if (esObj(encargo) && esObj(ejecucion)) {
    if (encargo.es_demo !== ejecucion.es_demo) err("mezcla_demo_real", `el encargo es ${encargo.es_demo ? "DEMO" : "REAL"} y la ejecución ${ejecucion.es_demo ? "DEMO" : "REAL"}: no se verifican juntos.`);
    if (ejecucion.encargo_id !== encargo.id) err("encargo_distinto", `la ejecución dice responder a ${ejecucion.encargo_id}, no a ${encargo.id}.`);
    if (ejecucion.encargo_sha256 !== encSha) err("encargo_modificado", "la huella del encargo no coincide: el encargo cambió después de ejecutarse o no es el mismo.");
    if (ejecucion.rol !== encargo.rol) err("rol_distinto", `la ejecución es de «${ejecucion.rol}» y el encargo de «${encargo.rol}».`);
    const red = encargo.herramientas?.red;
    const nWeb = L(ejecucion.consultas_web).length;
    if (red === "ninguna" && nWeb) err("red_sin_permiso", `${nWeb} consulta(s) web declaradas con red = ninguna.`);
    if (red === "lectura_publica" && nWeb > (encargo.limites?.max_consultas_web ?? 0)) err("limite_consultas", `${nWeb} consultas superan el límite ${encargo.limites.max_consultas_web}.`);
    if (red === "lectura_publica") for (const [i, w] of L(ejecucion.consultas_web).entries()) {
      let host = ""; try { host = new URL(w.url).hostname; } catch { /* la URL ya la rechaza el contrato */ }
      if (!L(encargo.herramientas.dominios_permitidos).some((d) => host === d || host.endsWith(`.${d}`))) err("dominio_no_permitido", `consultas_web[${i}]: ${host || w?.url} no está en dominios_permitidos.`);
    }
    if (ejecucion.uso?.costo_mxn > 0) alerta("costo_no_cero", "uso.costo_mxn", `La ejecución declara un costo de ${ejecucion.uso.costo_mxn} MXN: el presupuesto de la fase es $0.`);
    // Orden de los hechos: nada se ejecuta antes de encargarse ni se verifica antes de terminar.
    if (esFechaConZona(ejecucion.inicio) && esFechaConZona(encargo.creado_en) && Date.parse(ejecucion.inicio) < Date.parse(encargo.creado_en)) err("ejecucion_antes_del_encargo", `la ejecución empezó (${ejecucion.inicio}) antes de que existiera el encargo (${encargo.creado_en}).`);
    const ultimo = ejecucion.fin ?? ejecucion.latido ?? ejecucion.inicio;
    if (esFechaConZona(ultimo) && Date.parse(ahora) < Date.parse(ultimo)) err("verificacion_antes_de_la_ejecucion", `la verificación está fechada (${ahora}) antes del último instante de la ejecución (${ultimo}).`);
    // Límites del encargo: se avisan, no se corrigen (la salida se verifica tal cual).
    if (esFechaConZona(ejecucion.inicio) && esFechaConZona(ejecucion.fin) && Number.isInteger(encargo.limites?.max_minutos)) {
      const min = (Date.parse(ejecucion.fin) - Date.parse(ejecucion.inicio)) / 60000;
      if (min > encargo.limites.max_minutos) alerta("excede_max_minutos", "fin", `La ejecución duró ${Math.round(min)} min y el encargo permitía ${encargo.limites.max_minutos}.`);
    }
    if (Number.isInteger(ejecucion.uso?.tokens_salida) && Number.isInteger(encargo.limites?.max_tokens_salida) && ejecucion.uso.tokens_salida > encargo.limites.max_tokens_salida)
      alerta("excede_max_tokens", "uso.tokens_salida", `${ejecucion.uso.tokens_salida} tokens de salida superan el límite ${encargo.limites.max_tokens_salida} del encargo.`);
  }

  // ---------- circularidad y reutilización de salidas de IA ----------
  let nCirculares = 0;
  if (esObj(encargo) && esObj(ejecucion)) {
    const objetivos = new Set([ejecucion.id, encargo.id]);
    for (const [i, x] of L(encargo.insumos).entries()) {
      if (x?.tipo !== "lab_ejecucion_verificada") continue;
      const r = `encargo.insumos[${i}]`;
      if (x.ref === ejecucion.id) { nCirculares++; err("circular_directa", `${r}: la ejecución se usa a sí misma como insumo.`); continue; }
      const previa = registro?.ejecuciones?.get?.(x.ref);
      if (!previa) { err("insumo_no_registrado", `${r}: ${x.ref} no está en el registro del Laboratorio.`); continue; }
      if (previa.es_demo !== ejecucion.es_demo) err("mezcla_demo_real", `${r}: ${x.ref} es de otro mundo (DEMO/REAL).`);
      if (previa.encargo_id === encargo.id) { nCirculares++; err("circular_directa", `${r}: ${x.ref} responde a este mismo encargo.`); continue; }
      if ((await huellaDoc(previa)) !== x.sha256) err("insumo_modificado", `${r}: la huella de ${x.ref} no coincide con la registrada.`);
      const vprev = registro?.verificaciones?.get?.(x.ref);
      if (!vprev || !validarVerificacion(vprev).ok || ["rechazada", "sin_salida"].includes(vprev.resultado)) err("insumo_no_verificado", `${r}: ${x.ref} no tiene una verificación válida de lab-V (solo una salida verificada puede ser objeto de crítica).`);
      const ciclo = buscarCiclo(x.ref, objetivos, registro);
      if (ciclo) { nCirculares++; err("circular_indirecta", `${r}: ${[...ciclo].join(" → ")} vuelve a este encargo o ejecución.`); }
    }
  }

  // ---------- salida ----------
  const estado = ejecucion?.estado;
  const sinSalida = ESTADOS_CON_ERROR.includes(estado) || estado === "en_cola" || estado === "ejecutando";
  const incompleta = ESTADOS_PARCIALES.includes(estado) || sinSalida;
  if (ESTADOS_CON_ERROR.includes(estado)) alerta("ejecucion_sin_salida", "error", `Estado ${estado}: ${ejecucion.error}`);
  if (ESTADOS_PARCIALES.includes(estado)) alerta("salida_parcial", "estado", `Estado ${estado}: la salida está incompleta y se verifica tal cual.`);

  const catalogo = vx.ok || ve.ok ? L(encargo?.fuentes_permitidas) : [];
  const fuentes = ve.ok ? await integridadFuentes(catalogo, copias) : new Map();
  const corte = encargo?.corte_temporal?.conocido_antes_de ?? null;
  const citas = [], afirmaciones = [];
  const contratosOk = ve.ok && vx.ok;

  if (contratosOk && !sinSalida) {
    for (const a of L(ejecucion.afirmaciones)) {
      const ruta = `afirmaciones[${a.id}]`;
      const alertasAf = [];
      const avisa = (codigo, detalle) => { alertasAf.push(codigo); alerta(codigo, ruta, detalle); };
      const utilizables = [];
      a.citas.forEach((c, indice) => {
        const al = [];
        const rc = `${ruta}.citas[${indice}]`;
        let existencia = "registrada", integridad = null, coincidencia = "no_evaluable", n = 0, temporal = "sin_corte";
        const f = fuentes.get(c.fuente_id);
        if (esIdDeLaboratorio(c.fuente_id) || registro?.ejecuciones?.has?.(c.fuente_id)) {
          existencia = "respuesta_ia"; nCirculares++;
          al.push("respuesta_ia_como_fuente"); alerta("respuesta_ia_como_fuente", rc, `${c.fuente_id} es una salida del Laboratorio: una respuesta de IA no es una fuente independiente.`);
        } else if (!f) {
          existencia = "inexistente";
          al.push("fuente_inexistente"); alerta("fuente_inexistente", rc, `${c.fuente_id} no está en el catálogo del encargo: cita a una fuente que no existe (posible invención).`);
        } else {
          integridad = f.integridad;
          temporal = temporalDe(f._meta, corte);
          if (integridad === "alterada") { al.push("copia_alterada"); alerta("copia_alterada", rc, `La copia de ${c.fuente_id} no tiene la huella registrada (${f.sha256_esperado.slice(0, 12)}… ≠ ${f.sha256_calculado.slice(0, 12)}…).`); }
          if (integridad === "copia_ausente") { al.push("copia_ausente"); alerta("copia_ausente", rc, `No se entregó la copia local de ${c.fuente_id}.`); }
          if (integridad === "pendiente") { al.push("fuente_pendiente"); alerta("fuente_pendiente", rc, `${c.fuente_id} está PENDIENTE en CSI (no localizada o enlace erróneo): no se puede citar como respaldo.`); }
          if (integridad === "sin_huella_registrada") { al.push("sin_huella"); alerta("sin_huella", rc, `${c.fuente_id} no tiene huella registrada.`); }
          if (f.texto === "integro") {
            const doc = f._texto, ext = c.extracto;
            const literal = apariciones(doc, ext);
            const docN = normalizarEspacios(doc), extN = normalizarEspacios(ext);
            const normal = apariciones(docN, extN);
            n = normal.length;
            coincidencia = literal.length ? "literal" : normal.length ? "normalizada" : "no_encontrada";
            if (coincidencia === "no_encontrada") { al.push("extracto_no_encontrado"); alerta("extracto_no_encontrado", rc, `El extracto no aparece en ${c.fuente_id} (ni normalizando espacios): cita inventada o alterada.`); }
            if (extN.length < MIN_CARACTERES_EXTRACTO || extN.split(" ").filter(Boolean).length < MIN_PALABRAS_EXTRACTO) { al.push("extracto_demasiado_corto"); alerta("extracto_demasiado_corto", rc, `Extracto de ${extN.length} caracteres: demasiado corto para atribuirlo a un lugar del documento.`); }
            if (n > 1) { al.push("extracto_ambiguo"); alerta("extracto_ambiguo", rc, `El extracto aparece ${n} veces en ${c.fuente_id}: indique la ubicación.`); }
            if (n >= 1) {
              const previo = docN.slice(Math.max(0, normal[0] - VENTANA_CONTEXTO), normal[0]);
              if (NEGACIONES.test(previo)) { al.push("posible_fuera_de_contexto"); alerta("posible_fuera_de_contexto", rc, `Justo antes del extracto, la fuente dice «…${previo.trim().slice(-60)}»: puede estar negado o matizado. Lo decide una persona.`); }
            }
          } else {
            al.push(`texto_${f.texto}`);
            alerta("texto_no_verificable", rc, `El texto de ${c.fuente_id} está «${f.texto}»: no se puede comprobar el extracto.`);
          }
          if (temporal === "posterior_al_corte") { al.push("posterior_al_corte"); alerta("posterior_al_corte", rc, `${c.fuente_id} se conoció después del corte (${corte}).`); }
          if (temporal === "fecha_desconocida") { al.push("fecha_desconocida"); alerta("fecha_desconocida", rc, `${c.fuente_id} no tiene fecha de publicación o conocimiento: no se puede saber si era conocible antes del corte.`); }
          if (temporal === "indeterminada") { al.push("fecha_indeterminada"); alerta("fecha_indeterminada", rc, `La fecha de ${c.fuente_id} es un día sin hora alrededor del corte.`); }
        }
        const util = existencia === "registrada" && integridad === "integra" && ["literal", "normalizada"].includes(coincidencia)
          && ["dentro_de_corte", "sin_corte"].includes(temporal) && !al.includes("extracto_demasiado_corto");
        if (util) utilizables.push(indice);
        citas.push({ afirmacion_id: a.id, indice, fuente_id: c.fuente_id, existencia, integridad, coincidencia, apariciones: n, temporal, alertas: al, cita_utilizable: util });
      });

      let estadoCita;
      if (!a.citas.length) estadoCita = a.clase === "hecho_citado" ? "sin_respaldo_citado" : "no_requiere_cita";
      else estadoCita = utilizables.length ? "con_cita_utilizable" : "citas_con_fallas";
      if (estadoCita === "sin_respaldo_citado") avisa("hecho_sin_cita", `«${a.texto.slice(0, 80)}» se declara hecho citado y no trae ninguna cita.`);
      if (a.clase === "hecho_citado" && estadoCita === "citas_con_fallas") avisa("hecho_sin_cita_utilizable", "Se declara hecho citado y ninguna de sus citas es utilizable.");
      if (corte) {
        // Día calendario del corte en SU propia zona (los 10 primeros caracteres del instante): una fecha mencionada
        // estrictamente posterior a ese día es información que no se conocía; el mismo día no se decide.
        const diaCorte = Date.parse(`${corte.slice(0, 10)}T00:00:00Z`);
        const tarde = fechasMencionadas(a.texto).filter((t) => t > diaCorte);
        if (tarde.length) avisa("menciona_fecha_posterior_al_corte", `El texto menciona una fecha en o después del corte (${new Date(Math.max(...tarde)).toISOString().slice(0, 10)}): puede usar información que no se conocía.`);
      }
      if (INSTRUCCIONES.test(a.texto)) avisa("contiene_instrucciones_no_ejecutadas", "El texto contiene algo parecido a un comando. El Laboratorio nunca ejecuta lo que propone una IA.");
      afirmaciones.push({ afirmacion_id: a.id, clase: a.clase, estado_cita: estadoCita, respaldo_semantico: "pendiente_revision_humana", alertas: alertasAf });
    }
    for (const [i, h] of L(ejecucion.hipotesis).entries()) if (INSTRUCCIONES.test(`${h.enunciado} ${h.experimento}`)) alerta("contiene_instrucciones_no_ejecutadas", `hipotesis[${i}]`, "La hipótesis o su experimento contiene algo parecido a un comando: no se ejecuta.");
    for (const [i, c] of L(ejecucion.contradicciones).entries()) {
      for (const id of c.fuentes) if (!fuentes.has(id)) alerta("fuente_inexistente", `contradicciones[${i}]`, `${id} no está en el catálogo del encargo.`);
      // Una contradicción la DECLARA la IA; lab-V solo deja constancia de que existe y de en qué estado están sus fuentes.
      // Ni la confirma ni la descarta: eso es revisión humana.
      const estado = c.fuentes.map((id) => `${id}: ${fuentes.get(id)?.integridad ?? "inexistente"}`).join(", ");
      alerta("posible_contradiccion_declarada", `contradicciones[${i}]`, `La IA declara una contradicción entre ${c.fuentes.length} fuentes (${estado}). No está verificada: la decide una persona.`);
    }
  }

  const vf = [...fuentes.values()].map(({ _texto, _meta, ...x }) => x);
  const n = (pred) => citas.filter(pred).length;
  const resumen = {
    n_afirmaciones: afirmaciones.length,
    n_citas: citas.length,
    n_citas_utilizables: n((c) => c.cita_utilizable),
    n_citas_inexistentes: n((c) => c.existencia === "inexistente"),
    n_extractos_no_encontrados: n((c) => c.coincidencia === "no_encontrada"),
    n_fuentes_alteradas: vf.filter((f) => f.integridad === "alterada" || f.texto === "alterado").length,
    n_fuera_de_corte: n((c) => c.temporal === "posterior_al_corte"),
    n_fecha_desconocida: n((c) => c.temporal === "fecha_desconocida"),
    n_circulares: nCirculares,
    n_sin_respaldo: afirmaciones.filter((a) => a.estado_cita === "sin_respaldo_citado" || (a.clase === "hecho_citado" && a.estado_cita === "citas_con_fallas")).length,
    n_alertas: alertas.length,
  };
  let resultado;
  if (errores.length) resultado = "rechazada";
  else if (sinSalida) resultado = "sin_salida";
  else if (resumen.n_citas_utilizables < resumen.n_citas || resumen.n_sin_respaldo || resumen.n_fuentes_alteradas || alertas.length) resultado = "con_fallas";
  else resultado = "apta_para_revision_humana";

  // El id lleva el instante de verificación: una misma ejecución puede verificarse más de una vez (p. ej. cuando
  // llegan las copias) y cada verificación debe poder distinguirse en el registro.
  const cuerpo = String(ejecucion?.id ?? "desconocida").replace(/^(demo-)?lab-run-/, "").replace(/[^a-z0-9._-]/gi, "-").replace(/\.\.+/g, ".").slice(0, 44).toLowerCase() || "desconocida";
  const sello = ahora.replace(/[-:]/g, "").replace(/\.\d+/, "").toLowerCase();
  const verificacion = {
    contrato: CONTRATO_VERIFICACION, version_contrato: VERSION_LAB,
    id: `${esDemo ? "demo-" : ""}lab-ver-${cuerpo}-${sello}`, es_demo: esDemo,
    ejecucion_id: typeof ejecucion?.id === "string" ? ejecucion.id : `${esDemo ? "demo-" : ""}lab-run-desconocida`,
    ejecucion_sha256: ejSha,
    encargo_id: typeof encargo?.id === "string" ? encargo.id : `${esDemo ? "demo-" : ""}lab-enc-desconocido`,
    encargo_sha256: encSha,
    autor: { ...AUTOR_VERIFICADOR }, verificado_en: ahora, resultado, incompleta,
    errores, fuentes: vf, citas, afirmaciones, alertas, resumen,
    revision_humana: { estado: "pendiente" },
  };
  return { verificacion };
}

/** Comprobación de cordura del propio verificador: su salida cumple el contrato (si no, es un defecto de lab-V). */
export async function verificarYValidar(p) {
  const r = await verificar(p);
  const v = validarVerificacion(r.verificacion);
  return { ...r, salida_valida: v.ok, errores_salida: v.errores };
}
