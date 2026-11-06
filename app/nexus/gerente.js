// Gerente escéptico (Nexus fase 1): reglas DETERMINISTAS sobre una lección. Sin IA, sin red, sin azar.
// Cada regla responde cumple, no_cumple o no_evaluado, con explicación. «no_evaluado» significa «falta
// información para decidir»: nunca se trata como aprobado. El gerente NO aprueba nada: como mucho dice
// «sin objeciones» y la aprobación es siempre humana (recomendacion.js).

import { esFechaConZona, ms, mismoActor, esHuella, buscarDatosPrivados, texto } from "./comun.js";
import { NIVELES } from "./leccion.js";

export const RESULTADOS = ["cumple", "no_cumple", "no_evaluado"];

export const REGLAS = [
  { id: "G01", clave: "fechas_con_zona", nombre: "Fechas con zona horaria" },
  { id: "G02", clave: "privacidad", nombre: "Sin credenciales ni datos personales" },
  { id: "G03", clave: "evidencia_suficiente", nombre: "Conclusión respaldada por pruebas" },
  { id: "G04", clave: "evidencia_no_duplicada", nombre: "Evidencia no duplicada ni contada dos veces" },
  { id: "G05", clave: "muestras_independientes", nombre: "Muestras independientes" },
  { id: "G06", clave: "sin_informacion_futura", nombre: "Sin información del futuro" },
  { id: "G07", clave: "sin_circularidad", nombre: "Sin razonamiento circular" },
  { id: "G08", clave: "sin_autovalidacion", nombre: "Nadie valida su propia conclusión" },
  { id: "G09", clave: "nivel_sustentado", nombre: "Nivel de validación sustentado" },
  { id: "G10", clave: "reproducibilidad", nombre: "Reproducibilidad declarada con artefacto" },
  { id: "G11", clave: "sin_sobreajuste", nombre: "Sin sobreajuste" },
  { id: "G12", clave: "vigencia", nombre: "Vigente (no caducada)" },
];

const lista = (v) => (Array.isArray(v) ? v : []);
const deConclusion = (l) => lista(l?.evidencias).filter((ev) => ev && (ev.uso ?? "conclusion") === "conclusion");
const respaldo = (evs) => evs.filter((ev) => ev.tipo && ev.tipo !== "afirmacion");
const ids = (evs) => evs.map((ev) => ev.id ?? "?").join(", ");

/**
 * Evalúa una lección (la versión que se le pase).
 * @param leccion  versión de cauce.leccion (puede venir incompleta o mal formada: nunca lanza error)
 * @param ctx      { ahora: Date|ms, lecciones: Map(id → última versión) } para antecedentes y vigencia
 * @returns { leccion_id, revision, reglas: [{id, clave, nombre, resultado, explicacion}], dictamen, nivel_declarado, nivel_sustentado }
 */
export function evaluarLeccion(leccion, { ahora = Date.now(), lecciones = new Map() } = {}) {
  const ahoraMs = ahora instanceof Date ? ahora.getTime() : Number(ahora);
  const l = leccion && typeof leccion === "object" ? leccion : {};
  const sustento = nivelSustentado(l);
  const evaluadores = {
    G01: () => reglaFechas(l),
    G02: () => reglaPrivacidad(l),
    G03: () => reglaEvidencia(l),
    G04: () => reglaDuplicada(l, lecciones),
    G05: () => reglaMuestras(l),
    G06: () => reglaFuturo(l),
    G07: () => reglaCircular(l, lecciones),
    G08: () => reglaAutovalidacion(l),
    G09: () => reglaNivel(l, sustento),
    G10: () => reglaReproducible(l),
    G11: () => reglaSobreajuste(l),
    G12: () => reglaVigencia(l, ahoraMs),
  };
  const reglas = REGLAS.map((r) => {
    let res;
    try { res = evaluadores[r.id](); } catch (err) { res = ["no_evaluado", `No se pudo evaluar (${err.message}).`]; }
    const [resultado, explicacion] = res;
    return { ...r, resultado: RESULTADOS.includes(resultado) ? resultado : "no_evaluado", explicacion: texto(explicacion) ? explicacion : "Sin explicación." };
  });
  return { leccion_id: l.id ?? null, revision: l.revision ?? null, reglas, dictamen: dictaminar(reglas), nivel_declarado: NIVELES.includes(l.nivel_validacion) ? l.nivel_validacion : null, nivel_sustentado: sustento.nivel };
}

/** Objeciones mandan; luego lo no evaluado. Solo con TODAS las reglas en «cumple» hay «sin objeciones». */
export function dictaminar(reglas) {
  const no = reglas.filter((r) => r.resultado === "no_cumple").map((r) => r.id);
  const pendientes = reglas.filter((r) => r.resultado !== "cumple" && r.resultado !== "no_cumple").map((r) => r.id);
  const estado = no.length ? "con_objeciones" : pendientes.length ? "incompleto" : "sin_objeciones";
  return { estado, no_cumple: no, no_evaluado: pendientes, apto_para_revision_humana: estado === "sin_objeciones" };
}

// ---------------------------------------------------------------- reglas
function reglaFechas(l) {
  const malas = [];
  const ver = (v, r) => { if (v !== undefined && v !== null && !esFechaConZona(v)) malas.push(r); };
  ver(l.registrado_en ?? "", "registrado_en"); ver(l.fecha_conclusion ?? "", "fecha_conclusion");
  lista(l.evidencias).forEach((ev, i) => {
    ver(ev?.obtenida_en, `evidencias[${i}].obtenida_en`); ver(ev?.usa_datos_hasta, `evidencias[${i}].usa_datos_hasta`);
    ver(ev?.periodo?.desde, `evidencias[${i}].periodo.desde`); ver(ev?.periodo?.hasta, `evidencias[${i}].periodo.hasta`);
    ver(ev?.metodo?.datos_entrenamiento_hasta, `evidencias[${i}].metodo.datos_entrenamiento_hasta`); ver(ev?.metodo?.datos_prueba_desde, `evidencias[${i}].metodo.datos_prueba_desde`);
  });
  lista(l.validaciones).forEach((v, i) => ver(v?.en ?? "", `validaciones[${i}].en`));
  ver(l.vigencia?.caduca_en, "vigencia.caduca_en");
  return malas.length
    ? ["no_cumple", `Fechas ausentes o sin zona horaria: ${malas.join(", ")}. Sin zona no se puede ordenar en el tiempo.`]
    : ["cumple", "Todas las fechas traen zona horaria."];
}

function reglaPrivacidad(l) {
  const h = buscarDatosPrivados(l);
  return h.length
    ? ["no_cumple", `Contiene posibles datos privados: ${h.slice(0, 4).map((x) => `${x.motivo} en ${x.ruta}`).join("; ")}.`]
    : ["cumple", "No se detectaron credenciales ni datos personales con los patrones conocidos."];
}

function reglaEvidencia(l) {
  const evs = deConclusion(l);
  const r = respaldo(evs);
  if (l.nivel_validacion === "hipotesis") return ["cumple", r.length ? `Hipótesis con ${r.length} prueba(s) de apoyo.` : "Es una hipótesis: no afirma nada probado y no puede usarse como conclusión."];
  if (!NIVELES.includes(l.nivel_validacion)) return ["no_evaluado", "No se declaró nivel de validación."];
  if (r.length === 0) return ["no_cumple", evs.length ? `Declara «${l.nivel_validacion}» pero solo tiene afirmaciones de texto (${ids(evs)}).` : `Declara «${l.nivel_validacion}» sin ninguna evidencia.`];
  return ["cumple", `${r.length} evidencia(s) que no son solo texto: ${ids(r)}.`];
}

const claveEvidencia = (ev) => (esHuella(ev?.huella) ? `h:${ev.huella}` : texto(ev?.referencia) ? `r:${ev.referencia.trim().toLowerCase()}` : null);

function reglaDuplicada(l, lecciones) {
  const evs = lista(l.evidencias);
  if (!evs.length) return ["cumple", "No hay evidencias que puedan repetirse."];
  const sinClave = respaldo(evs).filter((ev) => !claveEvidencia(ev)); // una afirmación de texto no tiene huella
  const vistas = new Map();
  const dup = [];
  for (const ev of evs) {
    const k = claveEvidencia(ev);
    if (!k) continue;
    if (vistas.has(k)) dup.push(`${vistas.get(k)} = ${ev.id}`); else vistas.set(k, ev.id);
  }
  if (dup.length) return ["no_cumple", `La misma evidencia aparece más de una vez (${dup.join("; ")}): se contaría doble.`];
  // Una lección que «apoya» o de la que se «deriva» no puede aportar la MISMA evidencia como apoyo nuevo.
  const prestadas = [];
  for (const a of lista(l.antecedentes)) {
    if (!["apoya", "deriva_de"].includes(a?.relacion)) continue;
    const otra = lecciones.get(a.leccion_id);
    for (const ev of lista(otra?.evidencias)) { const k = claveEvidencia(ev); if (k && vistas.has(k)) prestadas.push(`${vistas.get(k)} (también en ${a.leccion_id})`); }
  }
  if (prestadas.length) return ["no_cumple", `Evidencia ya usada por un antecedente, contada otra vez: ${prestadas.join(", ")}.`];
  if (sinClave.length) return ["no_evaluado", `Sin huella ni referencia no se puede saber si se repiten: ${ids(sinClave)}.`];
  return ["cumple", "Cada evidencia es distinta (por huella o referencia)."];
}

function dependientes(a, b) {
  if (!a?.id || !b?.id) return false;
  if (a.id === b.id) return true;
  const rel = (x, y) => lista(x.solapa_con).includes(y.id) || lista(x.derivada_de).includes(y.id);
  if (rel(a, b) || rel(b, a)) return true;
  // Misma fuente de datos y periodos que se enciman = mismas observaciones.
  if (texto(a.fuente) && a.fuente === b.fuente && a.periodo && b.periodo) {
    const [a0, a1, b0, b1] = [ms(a.periodo.desde), ms(a.periodo.hasta), ms(b.periodo.desde), ms(b.periodo.hasta)];
    if ([a0, a1, b0, b1].every((x) => x !== null) && a0 <= b1 && b0 <= a1) return true;
  }
  return false;
}

function reglaMuestras(l) {
  const r = respaldo(deConclusion(l));
  const problemas = [];
  const faltan = r.filter((ev) => !ev.muestra?.id);
  if (r.length >= 2) {
    for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++)
      if (dependientes(r[i].muestra, r[j].muestra)) problemas.push(`${r[i].id} y ${r[j].id} usan muestras dependientes`);
  }
  // Una validación en destino debe usar una muestra independiente de la del origen.
  const porId = new Map(lista(l.evidencias).map((ev) => [ev?.id, ev]));
  for (const v of lista(l.validaciones)) {
    if (v?.ambito !== "destino") continue;
    for (const id of lista(v.evidencias)) {
      const ev = porId.get(id);
      const base = r.find((o) => dependientes(o.muestra, ev?.muestra));
      if (base) problemas.push(`la validación en ${v.proyecto} usa la evidencia ${id}, dependiente de ${base.id} (origen)`);
    }
  }
  if (problemas.length) return ["no_cumple", `${problemas.join("; ")}. No cuentan como pruebas independientes.`];
  if (r.length >= 2 && faltan.length) return ["no_evaluado", `Falta describir la muestra de ${ids(faltan)}; no se puede saber si son independientes.`];
  return ["cumple", r.length >= 2 ? "Las muestras declaradas son independientes entre sí." : "Una sola prueba de conclusión: no hay conteo múltiple que revisar."];
}

function reglaFuturo(l) {
  const fc = ms(l.fecha_conclusion);
  if (fc === null) return ["no_evaluado", "Sin fecha_conclusion válida no se puede saber qué información existía."];
  const malas = [];
  const sinFecha = [];
  if (ms(l.registrado_en) !== null && ms(l.registrado_en) < fc) malas.push("la conclusión tiene fecha posterior a su registro");
  for (const ev of respaldo(deConclusion(l))) {
    const hasta = ms(ev.usa_datos_hasta) ?? ms(ev.periodo?.hasta);
    if (hasta === null) sinFecha.push(ev.id);
    else if (hasta > fc) malas.push(`${ev.id} usa datos posteriores a la conclusión`);
    if (ms(ev.obtenida_en) !== null && ms(ev.obtenida_en) > fc) malas.push(`${ev.id} se obtuvo después de concluir`);
    const ent = ms(ev.metodo?.datos_entrenamiento_hasta), pru = ms(ev.metodo?.datos_prueba_desde);
    if (ent !== null && pru !== null && pru < ent) malas.push(`${ev.id}: los datos de prueba empiezan antes de terminar los de entrenamiento (fuga de información)`);
  }
  if (malas.length) return ["no_cumple", `${malas.join("; ")}.`];
  if (sinFecha.length) return ["no_evaluado", `No se sabe hasta qué fecha usan datos: ${sinFecha.join(", ")}.`];
  return ["cumple", "Ninguna prueba usa información posterior a la conclusión."];
}

function reglaCircular(l, lecciones) {
  if (!l.id) return ["no_evaluado", "Sin id no se puede revisar la cadena de antecedentes."];
  const aristas = (x) => [
    ...lista(x?.antecedentes).filter((a) => ["apoya", "deriva_de"].includes(a?.relacion)).map((a) => a.leccion_id),
    ...lista(x?.evidencias).map((ev) => (typeof ev?.referencia === "string" && ev.referencia.startsWith("leccion:") ? ev.referencia.slice(8).trim() : null)).filter(Boolean),
  ];
  const directas = aristas(l);
  if (directas.includes(l.id)) return ["no_cumple", "La lección se cita a sí misma como apoyo."];
  const faltan = [];
  const visitadas = new Set();
  const pila = directas.map((id) => [id, [l.id, id]]);
  while (pila.length) {
    const [id, camino] = pila.pop();
    if (id === l.id) return ["no_cumple", `Razonamiento circular: ${camino.join(" → ")}.`];
    if (visitadas.has(id)) continue;
    visitadas.add(id);
    const otra = lecciones.get(id);
    if (!otra) { faltan.push(id); continue; }
    for (const s of aristas(otra)) pila.push([s, [...camino, s]]);
  }
  if (faltan.length) return ["no_evaluado", `Antecedentes que no están en el registro: ${[...new Set(faltan)].join(", ")}.`];
  return ["cumple", directas.length ? "La cadena de antecedentes no vuelve a esta lección." : "Sin antecedentes de apoyo."];
}

function reglaAutovalidacion(l) {
  const vals = lista(l.validaciones);
  if (!vals.length) return ["cumple", "Sin validaciones registradas: nadie se ha validado a sí mismo."];
  const propias = vals.filter((v) => mismoActor(v.por, l.autor_conclusion));
  if (propias.length) {
    const quien = l.autor_conclusion?.tipo === "ia" ? "una IA" : "el autor";
    return ["no_cumple", `${quien} (${l.autor_conclusion.id}) validó su propia conclusión${propias.length > 1 ? ` ${propias.length} veces` : ""}. Esas validaciones no cuentan.`];
  }
  return ["cumple", "Todas las validaciones son de alguien distinto del autor."];
}

/** Hasta qué nivel llega lo registrado. Solo cuentan validaciones de otro actor, con evidencia que no sea solo texto. */
export function nivelSustentado(l) {
  const evs = new Map(lista(l?.evidencias).map((ev) => [ev?.id, ev]));
  const base = respaldo(deConclusion(l));
  const motivos = [];
  const valida = (v) => {
    if (!v || mismoActor(v.por, l.autor_conclusion)) return false;
    // Lección de una IA: hace falta al menos una validación HUMANA (supervisión).
    if (l.autor_conclusion?.tipo === "ia" && v.por?.tipo !== "humano") return false;
    return respaldo(lista(v.evidencias).map((id) => evs.get(id)).filter(Boolean)).length > 0;
  };
  const vals = lista(l?.validaciones).filter(valida);
  const confirma = (ambito, cond) => {
    const del = vals.filter((v) => v.ambito === ambito && cond(v));
    const ultima = del.filter((v) => v.resultado !== "inconcluso").sort((a, b) => (ms(a.en) ?? 0) - (ms(b.en) ?? 0)).at(-1);
    return ultima?.resultado === "confirma";
  };
  const origen = base.length > 0 && confirma("origen", (v) => v.proyecto === l.proyecto_origen);
  if (!origen) motivos.push("no hay una validación en origen, de otro actor y con pruebas, cuyo último resultado confirme");
  const destino = base.length > 0 && confirma("destino", (v) => v.proyecto !== l.proyecto_origen && lista(l.proyectos_destino).includes(v.proyecto)
    && lista(v.evidencias).every((id) => evs.get(id)?.muestra?.id && !base.some((o) => dependientes(o.muestra, evs.get(id).muestra))));
  if (!destino) motivos.push("no hay una validación en un proyecto destino con muestra independiente del origen");
  return { nivel: destino ? NIVELES[2] : origen ? NIVELES[1] : NIVELES[0], motivos };
}

function reglaNivel(l, sustento) {
  const d = NIVELES.indexOf(l.nivel_validacion);
  if (d < 0) return ["no_evaluado", "No se declaró un nivel de validación conocido."];
  const s = NIVELES.indexOf(sustento.nivel);
  if (d > s) return ["no_cumple", `Declara «${l.nivel_validacion}» pero lo registrado solo sostiene «${sustento.nivel}»: ${sustento.motivos.join("; ")}.`];
  return ["cumple", d < s ? `Declara «${l.nivel_validacion}»; lo registrado sostiene incluso «${sustento.nivel}».` : `Lo registrado sostiene «${sustento.nivel}».`];
}

/** Artefacto verificable: no es solo texto, tiene referencia, huella SHA-256 y procedimiento para repetirlo. */
export const esVerificable = (ev) => ev && ev.tipo !== "afirmacion" && texto(ev.referencia) && esHuella(ev.huella) && texto(ev.procedimiento);

function reglaReproducible(l) {
  const verif = deConclusion(l).filter(esVerificable);
  if (l.declara_reproducible === true) {
    return verif.length
      ? ["cumple", `Declara reproducible y ${verif.length} evidencia(s) traen referencia, huella y procedimiento (${ids(verif)}). Nexus no las volvió a ejecutar.`]
      : ["no_cumple", "Declara reproducible, pero ninguna evidencia trae artefacto con huella y procedimiento: es solo una afirmación."];
  }
  if (l.declara_reproducible === false) return ["cumple", "Declara que no es reproducible; se tratará como tal."];
  return ["no_evaluado", "No declara si es reproducible (declara_reproducible: true o false)."];
}

function reglaSobreajuste(l) {
  const exps = deConclusion(l).filter((ev) => ev.tipo === "experimento");
  if (!exps.length) return ["cumple", "No aplica: no hay experimentos en la conclusión."];
  const sinMetodo = exps.filter((ev) => !ev.metodo?.evaluacion || ev.metodo.evaluacion === "desconocida");
  if (sinMetodo.length === exps.length) return ["no_evaluado", `No se sabe cómo se evaluaron ${ids(sinMetodo)} (en la misma muestra o fuera de ella).`];
  const fuera = exps.filter((ev) => ["fuera_de_muestra", "validacion_cruzada"].includes(ev.metodo?.evaluacion));
  const probadas = Math.max(...exps.map((ev) => ev.metodo?.configuraciones_probadas ?? 1));
  if (!fuera.length && ["exito", "mixto"].includes(l.naturaleza_resultado))
    return ["no_cumple", `El resultado favorable se midió solo con los mismos datos con los que se eligió${probadas > 1 ? ` (se probaron ${probadas} configuraciones)` : ""}. Falta una prueba fuera de muestra.`];
  if (sinMetodo.length) return ["no_evaluado", `Falta el método de evaluación de ${ids(sinMetodo)}.`];
  return ["cumple", fuera.length ? `Evaluado fuera de muestra en ${ids(fuera)}${probadas > 1 ? ` (tras probar ${probadas} configuraciones)` : ""}.` : "El resultado no es favorable: no hay riesgo de presumir una mejora sobreajustada."];
}

function reglaVigencia(l, ahoraMs) {
  const c = ms(l.vigencia?.caduca_en);
  if (c === null) return ["no_evaluado", "Sin vigencia.caduca_en: no se sabe si sigue vigente."];
  if (c <= ahoraMs) return ["no_cumple", `Caducó el ${l.vigencia.caduca_en}: hay que revisarla de nuevo antes de usarla.`];
  return ["cumple", `Vigente hasta ${l.vigencia.caduca_en}.`];
}
