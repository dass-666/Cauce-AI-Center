// Laboratorio de IA · fase 2 · GUION DETERMINISTA para el modo sin modelo (solo DEMO).
//
// ESTO NO ES IA. Son reglas fijas, escritas a mano, que leen la ficha de un motor y producen una salida con la
// FORMA de `cauce.lab.ejecucion` para poder probar el flujo completo (encargo → salida → lab-V → crítica → informe →
// revisión humana) sin gastar ni instalar nada. Cada texto empieza con «[GUION DEMO]» y el autor es
// `guion-demo-sin-modelo` con adaptador «ninguno». El contrato 0.1 obliga a autor.tipo = "ia" en una ejecución: aquí
// ese campo significa «salida del rol», y el adaptador «ninguno» dice que no hubo modelo. La interfaz lo muestra así.
//
// Lo que el guion SÍ hace de verdad (y lab-V comprueba): citar literalmente líneas de la ficha, señalar estados sin
// evidencia, fallos contados, lecturas viejas y formular hipótesis falsables con su alternativa. Lo que NO hace:
// entender, investigar fuera de la ficha ni juzgar si algo es cierto.

import { L } from "./base.js";

export const MARCA_GUION = "[GUION DEMO]";
export const AUTOR_GUION = Object.freeze({ tipo: "ia", identificador: "guion-demo-sin-modelo", adaptador: "ninguno" });
const g = (t) => `${MARCA_GUION} ${t}`;
const MALOS = ["error", "bloqueado", "requiere_revision"];
const RE_FALLO = /fall|error|rechaz|inconsist|atrasad|sin analizar|sin fuente|problema|incomplet/i;
const MIN = 60_000;

/** Afirmaciones del Investigador: qué dice la ficha (hechos citados) y qué no dice (dudas). */
function investigador({ hechos, fuente_id, ahora }) {
  const af = [], dudas = [];
  const cita = (h) => [{ fuente_id, extracto: h.linea, ubicacion: `línea ${hechos.indexOf(h) + 1}` }];
  const lectura = hechos.find((h) => h.tipo === "lectura");
  if (lectura) af.push({ id: "i1", texto: g(`La lectura del motor se generó el ${lectura.generado_en} y declara una vigencia de ${lectura.vigencia_segundos} segundos.`), clase: "hecho_citado", citas: cita(lectura) });
  const malos = hechos.filter((h) => h.tipo === "agente" && MALOS.includes(h.estado));
  malos.slice(0, 6).forEach((h, i) => af.push({ id: `i${2 + i}`, texto: g(`«${h.agente}» (${h.departamento}) figura en estado «${h.estado}».`), clase: "hecho_citado", citas: cita(h) }));
  hechos.filter((h) => h.tipo === "alerta").slice(0, 5).forEach((h, i) => af.push({ id: `ia${i + 1}`, texto: g(`El motor publica una alerta de nivel «${h.nivel}»: ${h.titulo}`), clase: "hecho_citado", citas: cita(h) }));
  for (const h of hechos.filter((x) => x.tipo === "agente" && !x.evidencia).slice(0, 6)) dudas.push(g(`¿Qué registro respalda que «${h.agente}» (${h.departamento}) esté en «${h.estado}»? La ficha no trae evidencia.`));
  for (const h of hechos.filter((x) => x.tipo === "agente" && x.evidencia && !x.evidencia.observado_en).slice(0, 4)) dudas.push(g(`La evidencia de «${h.agente}» (${h.evidencia.origen}) no tiene fecha de observación: no se sabe si es actual.`));
  for (const h of hechos.filter((x) => x.tipo === "indicador" && x.valor === null).slice(0, 4)) dudas.push(g(`«${h.etiqueta}» (${h.departamento}) no tiene valor: ¿no se midió o es cero?`));
  if (lectura && ahora) {
    const edad = (Date.parse(ahora) - Date.parse(lectura.generado_en)) / 1000;
    if (edad > lectura.vigencia_segundos) dudas.push(g(`La lectura tiene ${Math.round(edad / 60)} min y su vigencia es de ${Math.round(lectura.vigencia_segundos / 60)} min: puede no reflejar el estado actual.`));
  }
  dudas.push(g("Solo hay una fuente: la ficha que publica el propio motor. Falta una fuente independiente para contrastar."));
  return { afirmaciones: af, hipotesis: [], objeciones: [], dudas, contradicciones: [] };
}

/** Analista: interpreta indicadores y estados. Todo lo que no es lectura directa se declara «inferencia». */
function analista({ hechos, fuente_id }) {
  const af = [], hip = [];
  const cita = (h) => [{ fuente_id, extracto: h.linea, ubicacion: `línea ${hechos.indexOf(h) + 1}` }];
  const fallos = hechos.filter((h) => h.tipo === "indicador" && typeof h.valor === "number" && h.valor > 0 && RE_FALLO.test(h.etiqueta));
  fallos.slice(0, 5).forEach((h, i) => af.push({ id: `n${i + 1}`, texto: g(`«${h.etiqueta}» = ${h.valor} en «${h.departamento}» indica trabajo con problemas pendiente; sin la serie histórica no se sabe si es excepcional.`), clase: "inferencia", citas: cita(h) }));
  const sinEvTrabajando = hechos.filter((h) => h.tipo === "agente" && h.estado === "trabajando" && !h.evidencia);
  sinEvTrabajando.slice(0, 3).forEach((h, i) => af.push({ id: `s${i + 1}`, texto: g(`«${h.agente}» aparece «trabajando» sin evidencia: es una anomalía; la oficina no debería mostrar actividad que ningún registro respalda.`), clase: "inferencia", citas: cita(h) }));
  const errores = hechos.filter((h) => h.tipo === "agente" && h.estado === "error");
  errores.slice(0, 3).forEach((h, i) => {
    af.push({ id: `e${i + 1}`, texto: g(`El proceso «${h.agente}» de «${h.departamento}» está detenido por un error; lo que dependa de él puede acumularse.`), clase: "inferencia", citas: cita(h) });
    hip.push({ id: `h${2 * i + 1}`, enunciado: g(`El error de «${h.agente}» se debe al contenido del archivo o dato de entrada que estaba procesando.`), se_refuta_si: g("Otra entrada válida y conocida falla igual en el mismo proceso."), experimento: g(`Una persona repite en un entorno de prueba de ${h.departamento} el mismo proceso con una entrada que ya funcionó antes y compara.`), alternativa_a: null });
    hip.push({ id: `h${2 * i + 2}`, enunciado: g(`El error de «${h.agente}» se debe al propio proceso o a su entorno (configuración, permisos, recursos), no a la entrada.`), se_refuta_si: g("La entrada que ya funcionó antes se procesa sin error."), experimento: g("El mismo experimento de la hipótesis anterior: un solo resultado distingue ambas."), alternativa_a: `h${2 * i + 1}` });
  });
  const total = hechos.filter((h) => h.tipo === "agente").length, sinEv = hechos.filter((h) => h.tipo === "agente" && !h.evidencia).length;
  if (total) af.push({ id: "c1", texto: g(`${sinEv} de ${total} agentes no aportan evidencia en la ficha: para ellos el estado mostrado no es verificable desde el Laboratorio.`), clase: "inferencia", citas: [] });
  if (!af.length) af.push({ id: "c0", texto: g("La ficha no muestra fallos contados ni procesos en error."), clase: "inferencia", citas: [] });
  return { afirmaciones: af, hipotesis: hip, objeciones: [], dudas: [], contradicciones: [] };
}

/** Abogado del Diablo: objeta las conclusiones del Analista. No afirma hechos nuevos. */
function critico({ hechos, previas, es_demo }) {
  const an = previas.analista, inv = previas.investigador, obj = [];
  if (!an) return { afirmaciones: [], hipotesis: [], objeciones: [], dudas: [g("No recibí la salida del Analista: no hay nada que objetar.")], contradicciones: [] };
  let n = 0; const o = (a, tipo, t) => obj.push({ id: `o${++n}`, a, tipo, texto: g(t) });
  for (const a of L(an.afirmaciones)) {
    if (/^n\d/.test(a.id)) o(`${an.id}#${a.id}`, "sobreajuste", "Un solo valor acumulado no muestra tendencia: puede ser normal para este motor. Hace falta la serie de varios periodos antes de llamarlo problema.");
    if (/^s\d/.test(a.id)) o(`${an.id}#${a.id}`, "supuesto", "Supone que «trabajando» sin evidencia es un fallo del motor; también puede ser que el exportador no envíe la evidencia de ese departamento. Hay que mirar el exportador antes de culpar al proceso.");
    if (/^e\d/.test(a.id)) o(`${an.id}#${a.id}`, "temporalidad", "El estado de error puede ser viejo: la ficha muestra cuándo se observó, no si sigue así. Antes de actuar hay que confirmar que el error persiste.");
  }
  for (const h of L(an.hipotesis).filter((x) => x.alternativa_a === null)) o(`${an.id}#${h.id}`, "evidencia", "Ninguna de las dos hipótesis tiene evidencia todavía: la ficha solo dice que hubo error, no por qué. Falta el registro detallado del motor.");
  if (L(inv?.dudas).length) o(`${an.id}#${L(an.afirmaciones).at(-1)?.id ?? "c0"}`, "alcance", "Todo sale de una sola fuente, la ficha del propio motor. Las conclusiones valen solo para esa lectura y no para el motor en general.");
  if (es_demo) o(`${an.id}#${L(an.afirmaciones)[0]?.id ?? "c0"}`, "alcance", "Los datos son DEMO: no describen el estado real de ningún motor. Este análisis solo prueba el flujo del Laboratorio.");
  const vieja = hechos.filter((h) => h.tipo === "agente" && h.evidencia?.observado_en).filter((h) => { const l = hechos.find((x) => x.tipo === "lectura"); return l && Date.parse(l.generado_en) - Date.parse(h.evidencia.observado_en) > 60 * MIN; });
  if (vieja.length) o(`${an.id}#${L(an.afirmaciones)[0]?.id ?? "c0"}`, "temporalidad", `La evidencia de ${vieja.map((h) => `«${h.agente}»`).slice(0, 3).join(", ")} tiene más de una hora respecto a la lectura: su estado pudo cambiar.`);
  return { afirmaciones: [], hipotesis: [], objeciones: obj, dudas: [], contradicciones: [] };
}

const ROL = { investigador, analista, critico };

/**
 * Produce la salida del rol del encargo. `contexto`: { hechos, fuente_id, previas: {investigador, analista}, ahora }.
 * Devuelve solo el CONTENIDO (afirmaciones, hipótesis, objeciones, dudas, contradicciones); el adaptador arma el documento.
 */
export function salidaGuion(encargo, contexto) {
  const f = ROL[encargo?.rol];
  if (!f) throw new Error(`El guion DEMO no tiene rol «${encargo?.rol}».`);
  return f({ hechos: L(contexto?.hechos), fuente_id: contexto?.fuente_id, previas: contexto?.previas ?? {}, ahora: contexto?.ahora, es_demo: encargo.es_demo === true });
}
