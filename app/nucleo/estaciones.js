// Estaciones de trabajo dentro de una oficina (piso) existente. Sin DOM ni Three.js: se prueba en Node.
//
// Regla de arquitectura (Diego, 2026-11-08): una función nueva de un proyecto es una ESTACIÓN (mesa, equipo o zona
// de trabajo) dentro de un departamento que ya existe, no un piso ni un departamento nuevo.
//
// Tres piezas, separadas a propósito:
//   1. Dónde está y qué funciones tiene: escena/<proyecto>.json › "estaciones" (estructura; no cambia con los datos).
//   2. En qué estado está: archivo aparte con el contrato «cauce.estaciones» 0.1.0 (este módulo lo valida).
//      El contrato «cauce.estado-proyecto» 1.0.0 NO se toca: una estación no es un departamento ni un agente.
//   3. Lo que se dibuja: construirEstaciones() decide, con reglas prudentes, qué estado ve cada puesto.
//
// Los tres personajes de una estación representan FUNCIONES del sistema, no agentes de IA ni procesos en marcha.
// Solo «en_proceso» con evidencia (origen, referencia y hora de inicio) los pone a teclear; una investigación
// guardada se ve como «consulta» (leer), nunca como trabajo en curso. Sin archivo, o con datos vencidos, la
// estación se ve con las sillas vacías («sin información»).

export const CONTRATO_ESTACIONES = "cauce.estaciones";
export const VERSION_ESTACIONES = "0.1.0";
const VIGENCIA_MIN = 30;
const VIGENCIA_MAX = 7 * 24 * 3600;
const TOLERANCIA_FUTURO = 300;
const MAX_ESTACIONES = 8;
const MAX_PUESTOS = 6;
const MAX_TEXTO = 240;
const RE_ID = /^[a-z0-9][a-z0-9_-]{0,39}$/;
const RE_VERSION = /^(\d+)\.(\d+)\.(\d+)$/;
const RE_FECHA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$/;
// Palabras que convertirían el visualizador en un motor de análisis o venderían una conclusión que nadie confirmó.
// Si aparecen en una nota o un conteo, el texto se reemplaza por un aviso (el dato no llega a la pantalla).
const RE_PROHIBIDO = /\b(rentable|rentabilidad confirmada|ganancia segura|compra(r)? ya|vende(r)? ya|recomendaci[oó]n de (compra|venta|inversi[oó]n)|garantizad[oa])\b/i;
// Un importe: símbolo o código de moneda junto a una cifra («$1,200», «350 USD», «MXN 90»). Nombrar una divisa
// («USD/MXN», «peso mexicano») sí se permite: el Observatorio trabaja con divisas, no con montos.
const RE_MONEDA = /(\$\s?\d|\d[\d.,]*\s?(mxn|usd|eur|pesos?|d[oó]lares?)\b|\b(mxn|usd|eur)\s?\d)/i;

/**
 * Catálogo de estados de un puesto de estación. `actividad` dice qué representa la postura:
 *   ninguna  → no hay nada que mostrar (espera o silla vacía)
 *   registro → hay un registro guardado (señal, investigación, evaluación): el personaje CONSULTA, no trabaja
 *   proceso  → hay un proceso en curso con evidencia: único caso en que teclea
 * `animacion3d` usa las posturas de maquina.js; `color` es el de la pantalla y el anillo (0xRRGGBB).
 */
export const ESTADOS_ESTACION = Object.freeze({
  sin_informacion: { etiqueta: "Sin información", descripcion: "No hay archivo de la estación, o sus datos vencieron: no se muestra actividad.", icono: "–", color: 0x6b7385, animacion3d: "ausente", actividad: "ninguna", prioridad: 0, solo_cauce: true },
  sin_actividad: { etiqueta: "Sin actividad", descripcion: "La función existe y no tiene nada pendiente.", icono: "…", color: 0x8a94a8, animacion3d: "sentado_en_reposo", actividad: "ninguna", prioridad: 1 },
  evaluacion_disponible: { etiqueta: "Evaluación disponible", descripcion: "Hay una evaluación guardada. No confirma rentabilidad ni una oportunidad real.", icono: "✓", color: 0x58c48b, animacion3d: "sentado_consultando", actividad: "registro", prioridad: 2 },
  senal_recibida: { etiqueta: "Señal recibida", descripcion: "Llegó una señal registrada. Una señal es una alerta, no una conclusión.", icono: "↘", color: 0x4fb3ff, animacion3d: "sentado_consultando", actividad: "registro", prioridad: 3 },
  investigacion_pendiente: { etiqueta: "Investigación pendiente", descripcion: "Hay una investigación abierta que espera trabajo de una persona.", icono: "⌕", color: 0x9f8cff, animacion3d: "sentado_consultando", actividad: "registro", prioridad: 4 },
  en_proceso: { etiqueta: "En proceso", descripcion: "Un proceso registrado está en curso (con evidencia).", icono: "⚙", color: 0x3ddc84, animacion3d: "sentado_tecleando", actividad: "proceso", prioridad: 5 },
  datos_insuficientes: { etiqueta: "Datos insuficientes", descripcion: "Faltan datos para concluir; no se calcula nada con huecos.", icono: "?", color: 0xffb547, animacion3d: "levantar_mano", actividad: "registro", prioridad: 6 },
  riesgo_detectado: { etiqueta: "Riesgo detectado", descripcion: "El sistema registró un riesgo o una verificación débil que alguien debe revisar.", icono: "!", color: 0xff7a59, animacion3d: "levantar_mano", actividad: "registro", prioridad: 7 },
});
export const NOMBRES_ESTADOS_ESTACION = Object.freeze(Object.keys(ESTADOS_ESTACION));

const esObjeto = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const esTexto = (v, max = MAX_TEXTO) => typeof v === "string" && v.trim().length > 0 && v.length <= max;
const esFecha = (v) => typeof v === "string" && RE_FECHA.test(v) && !Number.isNaN(Date.parse(v));
const limpio = (v, max = MAX_TEXTO) => (esTexto(v, max) ? v.trim() : null);

/** Texto seguro para la pantalla: sin conclusiones comerciales ni importes. */
function textoPermitido(v, lugar, avisos, max = MAX_TEXTO) {
  const t = limpio(v, max);
  if (t === null) return null;
  if (RE_PROHIBIDO.test(t) || RE_MONEDA.test(t)) {
    avisos.push(`${lugar}: el texto parece una conclusión comercial o un importe; no se muestra (Cauce no presenta rentabilidad ni montos).`);
    return null;
  }
  return t;
}

// ------------------------------------------------------------------ 1. Disposición (escena/<proyecto>.json)

/**
 * Lee el bloque "estaciones" de la escena. Devuelve [{ id, nombre, departamento, funcion, origen, puestos[], enlace }].
 * Una estación mal escrita se omite con un aviso; nunca crea un departamento.
 */
export function leerDisposicionEstaciones(dist, avisos = []) {
  const bloque = dist?.estaciones;
  if (bloque === undefined || bloque === null) return [];
  if (!esObjeto(bloque)) { avisos.push('escena: "estaciones" debe ser un objeto; se ignora.'); return []; }
  const salida = [];
  for (const [id, e] of Object.entries(bloque).slice(0, MAX_ESTACIONES)) {
    const lugar = `escena.estaciones.${id}`;
    if (!RE_ID.test(id) || !esObjeto(e) || !esTexto(e.nombre, 80) || !RE_ID.test(e.departamento ?? "")) {
      avisos.push(`${lugar}: necesita id, "nombre" y "departamento" (id de un departamento que ya existe); se omite.`);
      continue;
    }
    const puestos = (Array.isArray(e.puestos) ? e.puestos : []).slice(0, MAX_PUESTOS)
      .filter((p) => esObjeto(p) && RE_ID.test(p.id ?? "") && esTexto(p.funcion, 60))
      .map((p) => ({ id: p.id, funcion: p.funcion.trim(), detalle: limpio(p.detalle, 120) }));
    if (puestos.length === 0) { avisos.push(`${lugar}: sin puestos válidos (id, funcion); se omite.`); continue; }
    if (new Set(puestos.map((p) => p.id)).size !== puestos.length) { avisos.push(`${lugar}: puestos repetidos; se omite.`); continue; }
    let enlace = null;
    if (esObjeto(e.enlace) && RE_ID.test(e.enlace.proyecto ?? "") && RE_ID.test(e.enlace.estacion ?? "") && ["salida", "entrada"].includes(e.enlace.sentido)) {
      enlace = { proyecto: e.enlace.proyecto, estacion: e.enlace.estacion, sentido: e.enlace.sentido, nombre: limpio(e.enlace.nombre, 60) };
    } else if (e.enlace !== undefined) avisos.push(`${lugar}: "enlace" necesita proyecto, estacion y sentido (salida | entrada); se ignora.`);
    salida.push({
      id, nombre: e.nombre.trim(), departamento: e.departamento, funcion: limpio(e.funcion), origen: limpio(e.origen, 300),
      equipo: ["observatorio", "comercio"].includes(e.equipo) ? e.equipo : "observatorio",
      puestos, enlace,
    });
  }
  return salida;
}

// ------------------------------------------------------------------ 2. Contrato «cauce.estaciones» 0.1.0

/**
 * Valida un archivo de estado de estaciones. Errores → todo el archivo se descarta (las estaciones se ven
 * «sin información»). Avisos → un dato puntual se corrige hacia lo prudente o se quita.
 * Los campos que el contrato no conoce se ignoran: nunca llegan a la pantalla.
 */
export function validarEstaciones(entrada) {
  const errores = [], avisos = [];
  const err = (m) => errores.push(m);
  if (!esObjeto(entrada)) return { valido: false, errores: ["El archivo no contiene un objeto JSON."], avisos, documento: null };
  const d = entrada;
  if (d.contrato !== CONTRATO_ESTACIONES) err(`"contrato" debe ser "${CONTRATO_ESTACIONES}".`);
  const v = typeof d.version === "string" ? d.version.match(RE_VERSION) : null;
  if (!v) err('"version" debe tener la forma 0.1.0.');
  else if (v[1] !== "0" || v[2] !== "1") err(`Versión ${d.version} no compatible: este visualizador entiende ${CONTRATO_ESTACIONES} 0.1.x.`);
  if (!esObjeto(d.proyecto) || !RE_ID.test(d.proyecto.id ?? "")) err('"proyecto.id" es obligatorio.');
  if (!esFecha(d.generado_en)) err('"generado_en" debe ser fecha y hora UTC terminada en Z.');
  if (!Number.isInteger(d.vigencia_segundos) || d.vigencia_segundos < VIGENCIA_MIN || d.vigencia_segundos > VIGENCIA_MAX)
    err(`"vigencia_segundos" debe ser un entero entre ${VIGENCIA_MIN} y ${VIGENCIA_MAX}.`);
  if (typeof d.es_demo !== "boolean") err('"es_demo" es obligatorio (true o false).');
  if (d.es_demo === true && !(esObjeto(d.demo) && esFecha(d.demo.ahora_simulado))) err('Una demostración necesita "demo.ahora_simulado".');
  if (d.es_demo === false && d.demo !== undefined) err('"demo" solo se permite con "es_demo": true.');
  if (!esObjeto(d.fuente) || !["demo", "adaptador"].includes(d.fuente.tipo) || !esTexto(d.fuente.nombre, 160)) err('"fuente" necesita "tipo" (demo | adaptador) y "nombre".');
  else if ((d.fuente.tipo === "demo") !== (d.es_demo === true)) err('"fuente.tipo" = "demo" debe coincidir con "es_demo": true (y "adaptador" con false).');
  if (!Array.isArray(d.estaciones) || d.estaciones.length === 0 || d.estaciones.length > MAX_ESTACIONES) err(`"estaciones" debe ser una lista de 1 a ${MAX_ESTACIONES}.`);
  if (errores.length) return { valido: false, errores, avisos, documento: null };

  const vistos = new Set();
  const estaciones = d.estaciones.map((e, i) => {
    const lugar = `estaciones[${i}]`;
    if (!esObjeto(e) || !RE_ID.test(e.id ?? "")) { err(`${lugar}: necesita "id".`); return null; }
    if (vistos.has(e.id)) { err(`${lugar}: id "${e.id}" repetido.`); return null; }
    vistos.add(e.id);
    const puestos = (Array.isArray(e.puestos) ? e.puestos : []).slice(0, MAX_PUESTOS).map((p, j) => normalizarPuesto(p, `${lugar}.puestos[${j}]`, avisos)).filter(Boolean);
    const conteos = (Array.isArray(e.conteos) ? e.conteos : []).slice(0, 8).map((c, j) => {
      const l = `${lugar}.conteos[${j}]`;
      const etiqueta = textoPermitido(c?.etiqueta, l, avisos, 60);
      if (!esObjeto(c) || etiqueta === null) { avisos.push(`${l}: incompleto (etiqueta); se omite.`); return null; }
      // Solo conteos: enteros ≥ 0 o null (= no disponible). Nada de importes ni porcentajes calculados aquí.
      if (!(c.valor === null || (Number.isInteger(c.valor) && c.valor >= 0 && c.valor < 1e7))) { avisos.push(`${l}: "valor" debe ser un entero ≥ 0 o null; se muestra «—».`); return { etiqueta, valor: null, nota: textoPermitido(c.nota, l, avisos, 120) }; }
      return { etiqueta, valor: c.valor, nota: textoPermitido(c.nota, l, avisos, 120) };
    }).filter(Boolean);
    const faltantes = (Array.isArray(e.datos_faltantes) ? e.datos_faltantes : []).slice(0, 12).map((t, j) => textoPermitido(t, `${lugar}.datos_faltantes[${j}]`, avisos, 80)).filter(Boolean);
    const enlaces = (Array.isArray(e.enlaces) ? e.enlaces : []).slice(0, 20).map((x, j) => {
      const l = `${lugar}.enlaces[${j}]`;
      if (!esObjeto(x) || !esTexto(x.senal_id, 80) || !["emitida", "recibida"].includes(x.sentido) || !RE_ID.test(x.contraparte ?? "") || !esFecha(x.registrado_en)) {
        avisos.push(`${l}: necesita senal_id, sentido (emitida | recibida), contraparte y registrado_en; se omite.`); return null;
      }
      if (!evidenciaValida(x.evidencia)) { avisos.push(`${l}: sin evidencia (origen y referencia) no cuenta como transferencia; se omite.`); return null; }
      return { senal_id: x.senal_id.trim(), sentido: x.sentido, contraparte: x.contraparte, registrado_en: x.registrado_en, evidencia: evidencia(x.evidencia) };
    }).filter(Boolean);
    return { id: e.id, nota: textoPermitido(e.nota, `${lugar}.nota`, avisos), contrato_origen: limpio(e.contrato_origen, 120), puestos, conteos, datos_faltantes: faltantes, enlaces };
  }).filter(Boolean);
  if (errores.length) return { valido: false, errores, avisos, documento: null };
  return {
    valido: true, errores, avisos,
    documento: { contrato: d.contrato, version: d.version, proyecto: { id: d.proyecto.id }, generado_en: d.generado_en, vigencia_segundos: d.vigencia_segundos,
      es_demo: d.es_demo, demo: d.es_demo ? { ahora_simulado: d.demo.ahora_simulado } : null, fuente: { tipo: d.fuente.tipo, nombre: d.fuente.nombre.trim() }, estaciones },
  };
}

const evidenciaValida = (e) => esObjeto(e) && esTexto(e.origen, 80) && esTexto(e.referencia, 160) && (e.observado_en === undefined || esFecha(e.observado_en));
const evidencia = (e) => ({ origen: e.origen.trim(), referencia: e.referencia.trim(), observado_en: e.observado_en ?? null });

function normalizarPuesto(p, lugar, avisos) {
  if (!esObjeto(p) || !RE_ID.test(p.id ?? "")) { avisos.push(`${lugar}: necesita "id"; se omite.`); return null; }
  let estado = p.estado;
  const notas = [];
  if (!ESTADOS_ESTACION[estado] || ESTADOS_ESTACION[estado].solo_cauce) {
    avisos.push(`${lugar}: estado "${estado}" desconocido; se muestra «Sin información».`);
    notas.push("Estado desconocido en el archivo.");
    estado = "sin_informacion";
  }
  const ev = evidenciaValida(p.evidencia) ? evidencia(p.evidencia) : null;
  const inicio = esFecha(p.inicio) ? p.inicio : null;
  // Regla de oro (como en el contrato v1): nadie teclea sin evidencia de un proceso en curso.
  if (estado === "en_proceso" && (!ev || !inicio)) {
    avisos.push(`${lugar}: "en_proceso" sin evidencia (origen, referencia) o sin "inicio"; se muestra «Sin información».`);
    notas.push("Decía «en proceso» sin evidencia: no se muestra trabajo.");
    estado = "sin_informacion";
  }
  return { id: p.id, estado, nota: textoPermitido(p.nota, `${lugar}.nota`, avisos), evidencia: ev, inicio, notas };
}

// ------------------------------------------------------------------ 3. Lo que se dibuja

/**
 * @param disposicion  leerDisposicionEstaciones(escena)
 * @param carga        resultado de cargarJSON del archivo de estaciones que corresponde (real o demo)
 * @param origen       "demo" | "real": de qué carpeta se leyó el archivo (datos/demo o datos/reales); decide el reloj
 * @param esDemo       ¿el piso muestra una demostración? (modelo.es_demo). DEMO y REAL nunca se mezclan.
 * @param ahora        Date de la computadora
 * @param proyectoId   id del piso
 * @param depsIds      ids de los departamentos que existen en el piso (una estación sin anfitrión no se dibuja)
 * @returns {{ estaciones: object[], errores: string[], avisos: string[], doc: object|null }}
 */
export function construirEstaciones({ disposicion, carga, origen, esDemo = origen === "demo", ahora, proyectoId, depsIds = null }) {
  const errores = [], avisos = [];
  let doc = null, motivo = null, confiable = false, referencia = ahora, edad = null;
  if (!carga || carga.tipo === "no_encontrado") motivo = origen === "demo" ? "No hay demostración de esta estación." : "La estación todavía no tiene archivo de estado: falta su exportador (ver contrato cauce.estaciones).";
  else if (carga.tipo !== "ok") { motivo = "No se pudo leer el archivo de la estación."; if (carga.mensaje) errores.push(carga.mensaje); }
  else {
    const r = validarEstaciones(carga.datos);
    avisos.push(...r.avisos);
    if (!r.valido) { motivo = "El archivo de la estación no cumple el contrato cauce.estaciones 0.1."; errores.push(...r.errores); }
    else if (r.documento.proyecto.id !== proyectoId) motivo = `El archivo de estaciones es de "${r.documento.proyecto.id}", no de "${proyectoId}".`;
    else if (r.documento.es_demo !== esDemo) motivo = esDemo
      ? "El archivo de demostración de la estación no está marcado como demostración: no se muestra."
      : "El piso muestra datos REALES y el archivo de la estación es una demostración: no se mezclan.";
    else {
      doc = r.documento;
      // Las demos fijas usan su hora simulada (no caducan); los archivos reales, el reloj de la computadora.
      referencia = doc.es_demo && origen === "demo" ? new Date(doc.demo.ahora_simulado) : ahora;
      edad = Math.round((referencia - new Date(doc.generado_en)) / 1000);
      if (edad < -TOLERANCIA_FUTURO) motivo = "La hora del archivo de la estación está en el futuro: revisa el reloj.";
      else if (edad > doc.vigencia_segundos) motivo = `Los datos de la estación vencieron (vigencia ${Math.round(doc.vigencia_segundos / 60)} min).`;
      else confiable = true;
    }
  }

  const estaciones = disposicion.map((disp) => {
    const datos = doc?.estaciones.find((e) => e.id === disp.id) ?? null;
    const sinAnfitrion = depsIds && !depsIds.includes(disp.departamento);
    if (sinAnfitrion) avisos.push(`Estación «${disp.nombre}»: el departamento "${disp.departamento}" no existe en este piso; no se dibuja.`);
    const motivoEst = motivo ?? (datos ? null : "El archivo no trae datos de esta estación.");
    const vigente = confiable && datos !== null;
    const puestos = disp.puestos.map((pd) => {
      const p = datos?.puestos.find((x) => x.id === pd.id) ?? null;
      const estado = vigente && p ? p.estado : "sin_informacion";
      return {
        id: pd.id, clave: idPersonaje(proyectoId, disp.id, pd.id), funcion: pd.funcion, detalle: pd.detalle,
        estado, apariencia: ESTADOS_ESTACION[estado],
        // Con datos vencidos se conserva el último estado conocido solo como referencia (como en el contrato v1).
        ultimo_estado_conocido: !vigente && p && p.estado !== "sin_informacion" ? p.estado : null,
        nota: vigente ? p?.nota ?? null : null, evidencia: vigente ? p?.evidencia ?? null : null, inicio: vigente ? p?.inicio ?? null : null,
        notas: p?.notas ?? [],
      };
    });
    const estado = estadoDeEstacion(puestos.map((p) => p.estado));
    return {
      id: disp.id, nombre: disp.nombre, departamento: disp.departamento, funcion: disp.funcion, origen_funcion: disp.origen, equipo: disp.equipo,
      dibujable: !sinAnfitrion,
      estado, apariencia: ESTADOS_ESTACION[estado],
      es_demo: esDemo, vigente, motivo: motivoEst,
      generado_en: doc?.generado_en ?? null, edad_segundos: edad, vigencia_segundos: doc?.vigencia_segundos ?? null, fuente: doc?.fuente ?? null,
      hora_simulada: Boolean(doc?.es_demo && origen === "demo"),
      contrato_origen: datos?.contrato_origen ?? null, nota: vigente ? datos?.nota ?? null : null,
      conteos: vigente ? datos?.conteos ?? [] : [], datos_faltantes: vigente ? datos?.datos_faltantes ?? [] : [],
      enlaces: vigente ? datos?.enlaces ?? [] : [],
      enlace: disp.enlace ? { ...disp.enlace, estado: "sin_dato", confirmadas: [], solo_aqui: [] } : null,
      puestos,
    };
  });
  return { estaciones, errores, avisos, doc };
}

/** Id estable del personaje de un puesto de estación (no choca con ids de agentes del contrato v1). */
export const idPersonaje = (proyectoId, estacionId, puestoId) => `estacion:${proyectoId}:${estacionId}:${puestoId}`;

/** Estado que resume la estación: el de mayor prioridad entre sus puestos. */
export function estadoDeEstacion(estados) {
  let mejor = "sin_informacion";
  for (const e of estados) if (ESTADOS_ESTACION[e] && ESTADOS_ESTACION[e].prioridad > ESTADOS_ESTACION[mejor].prioridad) mejor = e;
  return mejor;
}

/**
 * Relación entre dos estaciones de proyectos distintos (p. ej. Ek Chuah → Compago). Una transferencia está
 * CONFIRMADA solo si las dos partes la registran: el origen dice que EMITIÓ la señal X hacia el destino y el
 * destino dice que RECIBIÓ la misma señal X desde el origen; las dos estaciones vigentes y de la misma naturaleza
 * (DEMO con DEMO, REAL con REAL). Un solo lado = «sin confirmar». Cauce nunca supone una transferencia.
 * Modifica `est.enlace` (estado: confirmado | sin_confirmar | ninguno | sin_dato) y devuelve el mismo objeto.
 */
export function cruzarEnlace(est, proyectoId, otra, otroProyectoId) {
  if (!est?.enlace) return est;
  const e = est.enlace;
  if (!est.vigente) { Object.assign(e, { estado: "sin_dato", confirmadas: [], solo_aqui: [], motivo: "Esta estación no tiene datos vigentes." }); return est; }
  const mio = est.enlaces.filter((x) => x.contraparte === e.proyecto && x.sentido === (e.sentido === "salida" ? "emitida" : "recibida"));
  if (!otra || !otra.vigente || otra.es_demo !== est.es_demo || otroProyectoId !== e.proyecto) {
    Object.assign(e, { estado: mio.length ? "sin_confirmar" : "ninguno", confirmadas: [], solo_aqui: mio.map((x) => x.senal_id),
      motivo: !otra || !otra.vigente ? `No hay datos vigentes de la otra estación (${e.nombre ?? e.proyecto}).` : "La otra estación es de otra naturaleza (DEMO / REAL): no se cruzan." });
    return est;
  }
  const suyo = new Set(otra.enlaces.filter((x) => x.contraparte === proyectoId && x.sentido === (e.sentido === "salida" ? "recibida" : "emitida")).map((x) => x.senal_id));
  const confirmadas = mio.filter((x) => suyo.has(x.senal_id)).map((x) => x.senal_id);
  const solo = mio.filter((x) => !suyo.has(x.senal_id)).map((x) => x.senal_id);
  Object.assign(e, { estado: confirmadas.length ? "confirmado" : mio.length ? "sin_confirmar" : "ninguno", confirmadas, solo_aqui: solo, motivo: null });
  return est;
}

/** Pega las estaciones al modelo de vista: modelo.estaciones y dep.estaciones (las que hospeda cada departamento). */
export function aplicarEstaciones(modelo, estaciones) {
  const ids = new Set((modelo.departamentos ?? []).map((d) => d.id));
  for (const e of estaciones) if (!ids.has(e.departamento)) e.dibujable = false; // sin anfitrión no se inventa un cuarto
  modelo.estaciones = estaciones;
  for (const d of modelo.departamentos ?? []) d.estaciones = estaciones.filter((e) => e.dibujable && e.departamento === d.id);
  return modelo;
}

/** Firma estructural (para decidir si hay que reconstruir la escena): ids, no estados. */
export const firmaEstaciones = (lista = []) => lista.map((e) => `${e.id}[${e.puestos.map((p) => p.id).join(",")}]`).join(";");
