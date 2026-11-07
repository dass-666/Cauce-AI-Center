// CSI (Inteligencia Estratégica) y contrato cauce.leccion 0.3. Corre en Node (pruebas/ejecutar.mjs) y en pruebas.html.
// Bloque 10: contratos, historial, fechas y conocimiento disponible, hechos vs inferencias, escenarios contradictorios,
// predicciones acertadas/fallidas/indeterminadas, cambios posteriores al resultado, circularidad con Nexus,
// privacidad, DEMO/REAL, piso 2D/3D (contrato v1) y compatibilidad con el PR #23.

import { prueba, igual, verdadero } from "./mini.js";
import { leccion } from "./casos-nexus.js";
import { validarLeccion } from "../app/nexus/leccion.js";
import { evaluarLeccion } from "../app/nexus/gerente.js";
import { validarDocumento } from "../app/nucleo/contrato.js";
import { validarInvestigacion, crearInvestigacion, aplicarCambio, verificarHistorial, analizarInvestigacion } from "../app/csi/investigacion.js";
import { validarActores, analizarIntereses, relacionesVerificables } from "../app/csi/actores.js";
import { validarEscenario, simular, plantillaCaidaMercado } from "../app/csi/simulador.js";
import { agregarEntrada, registroVacioPredicciones, verificarPredicciones, resumirPredicciones } from "../app/csi/predicciones.js";
import { prepararPropuesta, revisarPropuesta } from "../app/csi/adaptador-nexus.js";
import { construirDemoCSI, AHORA_DEMO } from "../app/csi/demo.js";
import { estadoPisoCSI } from "../app/csi/piso.js";
import { leerCSI } from "../app/csi/registro.js";

const clon = (x) => JSON.parse(JSON.stringify(x));
const A = { tipo: "humano", identificador: "ana" };
const B = { tipo: "humano", identificador: "beto" };
const IA = { tipo: "ia", identificador: "modelo-x" };
const AHORA = Date.parse(AHORA_DEMO);
let cache = null;
const demo = async () => clon(cache ?? (cache = await construirDemoCSI()));
const invDemo = async () => (await demo()).investigaciones.investigaciones[0];
const tiene = (errores, re) => errores.some((t) => re.test(t));
/** Investigación REAL mínima con una fuente fechada. */
async function base(extra = {}) {
  let r = await crearInvestigacion({ id: "inv-prueba", titulo: "Prueba", pregunta: "¿Qué pasó?", acontecimiento: { descripcion: "Caída", fecha: "2026-10-12" }, autor: A, fecha: "2026-10-12T20:00:00-06:00", actores: ["bc"], ...extra });
  if (!r.ok) throw new Error(r.errores.join(" "));
  r = await aplicarCambio(r.inv, { accion: "agregar_fuente", datos: { fuente: { id: "f1", titulo: "Boletín", editor: "Bolsa", tipo: "dato_estadistico", publicada_en: "2026-10-12T15:00:00-06:00" } } }, { autor: A, fecha: "2026-10-12T20:01:00-06:00" });
  if (!r.ok) throw new Error(r.errores.join(" "));
  return r.inv;
}
const enunciado = (inv, x, fecha = "2026-10-12T21:00:00-06:00", autor = A) => aplicarCambio(inv, { accion: "agregar_enunciado", datos: { enunciado: x } }, { autor, fecha });
const PRED = (cambios = {}) => ({ id: "p1", investigacion_id: "inv-prueba", hipotesis_original: "Sube", resultado_observable: "Cierre", horizonte: { desde: "2026-10-13T10:00:00-06:00", hasta: "2026-10-20T10:00:00-06:00" },
  criterios: { acertada: "sube", fallida: "baja", indeterminada: "sin dato" }, fuentes_conocidas: [{ titulo: "Boletín", publicada_en: "2026-10-12T15:00:00-06:00" }], supuestos: [], version_reglas: "r1", referencia: { descripcion: "sin cambio", resultado_esperado: "igual" }, ...cambios });
async function conPrediccion(registrado_en = "2026-10-13T09:00:00-06:00") {
  const r = await agregarEntrada(registroVacioPredicciones(false), { tipo: "registro", contenido: PRED(), registrado_en, registrado_por: A });
  if (!r.ok) throw new Error(r.errores.join(" "));
  return r.doc;
}

export function registrarCasosCSI(leerTexto) {
  // ---------------- Compatibilidad con el PR #23: contrato de lección 0.3 ----------------
  prueba("CSI · contrato 0.3: «desconocida» se acepta en 0.3 y se rechaza en 0.2 (los registros 0.2 no se reinterpretan)", () => {
    const m = (v) => leccion({ version_esquema: v, muestra: { ...leccion().muestra, naturaleza: "desconocida" } });
    verdadero(tiene(validarLeccion(m("0.2")).errores, /no existe en 0\.2: usa version_esquema "0\.3"/));
    igual(validarLeccion(m("0.3")).errores, []);
    igual(validarLeccion(leccion()).errores, [], "una lección 0.2 válida sigue siendo válida");
    verdadero(tiene(validarLeccion(leccion({ version_esquema: "0.4" })).errores, /version_esquema/));
  });
  prueba("CSI · contrato 0.3: naturaleza desconocida nunca respalda un efecto (R08 no evaluado → nunca «sin objeciones»)", () => {
    const l = leccion({ version_esquema: "0.3", muestra: { ...leccion().muestra, naturaleza: "desconocida" }, confianza: { nivel: "media", objeto: "efecto_operativo", justificacion: "x" } });
    const r = evaluarLeccion(l, { ahora: AHORA }).reglas.find((x) => x.id === "R08");
    igual(r.estado, "no_evaluado");
    verdadero(evaluarLeccion(l, { ahora: AHORA }).dictamen.estado !== "sin_objeciones");
  });
  prueba("CSI · PR #23 intacto: las lecciones DEMO de Nexus siguen siendo 0.2 y válidas", async () => {
    const doc = JSON.parse(await leerTexto("datos/nexus/demo/lecciones.json"));
    for (const e of doc.entradas) { igual(e.registro.version_esquema, "0.2"); igual(validarLeccion(e.registro).errores, [], e.registro.id); }
  });

  // ---------------- Validación de contratos ----------------
  prueba("CSI · el caso DEMO es válido en todos sus contratos y se reproduce idéntico desde el código", async () => {
    const d = await demo();
    igual(validarInvestigacion(d.investigaciones.investigaciones[0]).errores, []);
    igual(validarActores(d.actores).errores, []);
    igual(validarEscenario(d.escenarios.escenarios[0]).errores, []);
    for (const [ruta, doc] of [["datos/csi/demo/actores.json", d.actores], ["datos/csi/demo/investigaciones.json", d.investigaciones], ["datos/csi/demo/escenarios.json", d.escenarios], ["datos/csi/demo/predicciones.json", d.predicciones]])
      igual(JSON.parse(await leerTexto(ruta)), doc, ruta);
  });
  prueba("CSI · claves desconocidas y probabilidades inventadas se rechazan", async () => {
    const inv = await invDemo();
    verdadero(tiene(validarInvestigacion({ ...inv, opinion: "x" }).errores, /opinion: clave desconocida/));
    const h = clon(inv); h.hipotesis[0].probabilidad = 0.7;
    verdadero(tiene(validarInvestigacion(h).errores, /probabilidad/));
    const e = plantillaCaidaMercado({ id: "e", investigacion_id: "i", mercado: "M", autor: A, fecha: "2026-10-12T20:00:00-06:00" });
    e.explicaciones[0].probabilidad = 0.4;
    verdadero(tiene(validarEscenario(e).errores, /probabilidad/));
  });

  // ---------------- Persistencia e historial ----------------
  prueba("CSI · cada cambio se anexa al historial con huellas; el original no se toca y la cadena verifica", async () => {
    const inv = await base();
    const r = await enunciado(inv, { id: "h1", tipo: "hecho", texto: "Cayó 9 %", fuentes: ["f1"] });
    verdadero(r.ok, r.errores?.join(" "));
    igual([inv.historial.length, r.inv.historial.length], [2, 3]);
    igual(r.inv.historial[2].huella_anterior, r.inv.historial[1].huella);
    igual(r.inv.historial[2].autor.autenticacion, "declarada");
    igual((await verificarHistorial(r.inv)).ok, true);
  });
  prueba("CSI · modificación silenciosa, entrada reescrita o borrada: el historial lo detecta", async () => {
    const inv = (await enunciado(await base(), { id: "h1", tipo: "hecho", texto: "Cayó 9 %", fuentes: ["f1"] })).inv;
    const a = clon(inv); a.enunciados[0].texto = "Cayó 20 %";
    verdadero(tiene((await verificarHistorial(a)).problemas, /sin pasar por el historial/));
    const b = clon(inv); b.historial[1].detalle = "otra cosa";
    verdadero(tiene((await verificarHistorial(b)).problemas, /reescribió/));
    const c = clon(inv); c.historial.splice(1, 1);
    verdadero(!(await verificarHistorial(c)).ok);
  });
  prueba("CSI · no se borra ni se reescribe hacia atrás: retirar conserva el enunciado y deja de contar", async () => {
    let inv = (await enunciado(await base(), { id: "h1", tipo: "hecho", texto: "Cayó 9 %", fuentes: ["f1"] })).inv;
    const atras = await aplicarCambio(inv, { accion: "editar", datos: { campo: "titulo", valor: "x" } }, { autor: A, fecha: "2026-10-01T00:00:00-06:00" });
    verdadero(!atras.ok && tiene(atras.errores, /anterior al último cambio/));
    verdadero(!(await aplicarCambio(inv, { accion: "editar", datos: { campo: "enunciados", valor: [] } }, { autor: A, fecha: "2026-10-13T00:00:00-06:00" })).ok, "los enunciados no se editan");
    inv = (await aplicarCambio(inv, { accion: "agregar_hipotesis", datos: { hipotesis: { id: "H1", categoria: "liquidez", enunciado: "x", a_favor: ["h1"], condiciones_refutacion: ["y"] } } }, { autor: A, fecha: "2026-10-13T00:00:00-06:00" })).inv;
    const r = await aplicarCambio(inv, { accion: "retirar_enunciado", datos: { enunciado_id: "h1", motivo: "La fuente corrigió la cifra" } }, { autor: A, fecha: "2026-10-13T01:00:00-06:00" });
    verdadero(r.ok);
    igual(r.inv.enunciados.length, 1);
    igual(analizarInvestigacion(r.inv).hipotesis[0].estado, "incompleta");
  });
  prueba("CSI · revisión: una IA no revisa, quien creó no se revisa a sí mismo, y un cambio posterior la reabre", async () => {
    const inv = await base();
    verdadero(tiene((await aplicarCambio(inv, { accion: "revision", datos: { estado: "revisada" } }, { autor: IA, fecha: "2026-10-13T00:00:00-06:00" })).errores, /una IA no sustituye/));
    verdadero(tiene((await aplicarCambio(inv, { accion: "revision", datos: { estado: "revisada" } }, { autor: A, fecha: "2026-10-13T00:00:00-06:00" })).errores, /no puede revisarla/));
    const rv = await aplicarCambio(inv, { accion: "revision", datos: { estado: "revisada" } }, { autor: B, fecha: "2026-10-13T00:00:00-06:00" });
    verdadero(rv.ok);
    const despues = await aplicarCambio(rv.inv, { accion: "editar", datos: { campo: "supuestos", valor: ["nuevo"] } }, { autor: A, fecha: "2026-10-14T00:00:00-06:00" });
    igual(despues.inv.revision.estado, "en_revision");
    igual((await invDemo()).revision.estado, "en_revision", "DEMO: la objeción o4 llegó después de la revisión");
  });

  // ---------------- Fechas y conocimiento disponible ----------------
  prueba("CSI · información futura: una fuente publicada después de la anotación se rechaza (días sin hora: conservador)", async () => {
    let inv = await base();
    inv = (await aplicarCambio(inv, { accion: "agregar_fuente", datos: { fuente: { id: "f2", titulo: "Reporte", editor: "CNV", tipo: "documento_regulatorio", publicada_en: "2026-10-16" } } }, { autor: A, fecha: "2026-10-12T20:02:00-06:00" })).inv;
    verdadero(tiene((await enunciado(inv, { id: "h9", tipo: "hecho", texto: "x", fuentes: ["f2"] })).errores, /información futura/));
    verdadero(tiene((await enunciado(inv, { id: "h9", tipo: "hecho", texto: "x", fuentes: ["f2"] }, "2026-10-16T08:00:00-06:00")).errores, /información futura/), "el mismo día sin hora todavía no es seguro");
    verdadero((await enunciado(inv, { id: "h9", tipo: "hecho", texto: "x", fuentes: ["f2"] }, "2026-10-17T12:00:00-06:00")).ok);
  });
  prueba("CSI · predicción: se registra antes del horizonte y sin fuentes posteriores al registro", async () => {
    const v = registroVacioPredicciones(false);
    verdadero(tiene((await agregarEntrada(v, { tipo: "registro", contenido: PRED(), registrado_en: "2026-10-13T11:00:00-06:00", registrado_por: A })).errores, /ANTES del acontecimiento/));
    verdadero(tiene((await agregarEntrada(v, { tipo: "registro", contenido: PRED({ fuentes_conocidas: [{ titulo: "Futuro", publicada_en: "2026-10-14" }] }), registrado_en: "2026-10-13T09:00:00-06:00", registrado_por: A })).errores, /información futura/));
    verdadero(tiene((await agregarEntrada(v, { tipo: "registro", contenido: PRED({ horizonte: { desde: "2026-10-13", hasta: "2026-10-20" } }), registrado_en: "2026-10-12T09:00:00-06:00", registrado_por: A })).errores, /horizonte/), "el horizonte lleva zona horaria");
    verdadero((await agregarEntrada(v, { tipo: "registro", contenido: PRED(), registrado_en: "2026-10-13T09:00:00-06:00", registrado_por: A })).ok);
  });
  prueba("CSI · evaluación: no antes del horizonte, con evidencia posterior al registro y anterior a la evaluación", async () => {
    const d = await conPrediccion();
    const ev = (evidencia, en, resultado = "acertada") => agregarEntrada(d, { tipo: "evaluacion", contenido: { prediccion_id: "p1", resultado, resultado_referencia: "fallida", evidencia, nota: "n" }, registrado_en: en, registrado_por: B });
    verdadero(tiene((await ev([{ titulo: "x", publicada_en: "2026-10-13T09:30:00-06:00" }], "2026-10-13T09:40:00-06:00")).errores, /antes de que empiece el horizonte/));
    verdadero(tiene((await ev([{ titulo: "viejo", publicada_en: "2026-10-12T15:00:00-06:00" }], "2026-10-21T09:00:00-06:00")).errores, /antes de registrar la predicción/));
    verdadero(tiene((await ev([{ titulo: "futuro", publicada_en: "2026-10-25T09:00:00-06:00" }], "2026-10-21T09:00:00-06:00")).errores, /posterior a la evaluación/));
    verdadero(tiene((await ev([], "2026-10-21T09:00:00-06:00")).errores, /exige evidencia/));
    verdadero((await ev([{ titulo: "cierre", publicada_en: "2026-10-20T15:00:00-06:00" }], "2026-10-21T09:00:00-06:00")).ok);
  });

  // ---------------- Hechos, declaraciones e inferencias ----------------
  prueba("CSI · una intención privada no es hecho sin documento del propio actor; como declaración o inferencia sí", async () => {
    let inv = await base();
    verdadero(tiene((await enunciado(inv, { id: "x1", tipo: "hecho", texto: "El banco quiere salvar al fondo", fuentes: ["f1"], sobre: "intencion", actor_id: "bc" })).errores, /intención no se registra como hecho/));
    inv = (await aplicarCambio(inv, { accion: "agregar_fuente", datos: { fuente: { id: "acta", titulo: "Acta", editor: "BC", tipo: "documento_oficial", publicada_en: "2026-10-12T10:00:00-06:00", autor_actor_id: "bc" } } }, { autor: A, fecha: "2026-10-12T20:03:00-06:00" })).inv;
    verdadero((await enunciado(inv, { id: "x1", tipo: "hecho", texto: "El acta publica la decisión", fuentes: ["acta"], sobre: "intencion", actor_id: "bc" })).ok);
    verdadero(tiene((await enunciado(inv, { id: "x2", tipo: "declaracion", texto: "Dijo algo", fuentes: ["f1"] })).errores, /QUIÉN declaró/));
    verdadero(tiene((await enunciado(inv, { id: "x3", tipo: "inferencia", texto: "Querría", fuentes: [] })).errores, /inferido_de/));
    verdadero(tiene((await enunciado(inv, { id: "x4", tipo: "hecho", texto: "Sin fuente", fuentes: [] })).errores, /fuente primaria/));
  });
  prueba("CSI · una simulación, inferencia o predicción no puede ser evidencia de una hipótesis", async () => {
    const inv = await invDemo();
    for (const id of ["s1", "i1", "pr1"]) { const x = clon(inv); x.hipotesis[1].a_favor.push(id); verdadero(tiene(validarInvestigacion(x).errores, /solo hechos y declaraciones son evidencia/), id); }
    const x = clon(inv); x.incentivos[0].basado_en = [];
    verdadero(tiene(validarInvestigacion(x).errores, /siempre inferido/));
  });
  prueba("CSI · DEMO: hipótesis sin evidencia queda incompleta; manipulación sin documento regulatorio también", async () => {
    const h = Object.fromEntries(analizarInvestigacion(await invDemo()).hipotesis.map((x) => [x.id, x]));
    igual(h["H-D"].estado, "incompleta");
    verdadero(h["H-D"].motivos.some((m) => /manipulación: exige evidencia/.test(m)));
    igual([h["H-A"].estado, h["H-C"].estado], ["contradicha", "contradicha"]);
    igual(h["H-B"].estado, "sin_contradiccion_registrada");
    verdadero(!Object.values(h).some((x) => /confirm/.test(x.estado)), "nunca «confirmada»");
  });

  // ---------------- Escenarios contradictorios ----------------
  prueba("CSI · contradicciones: a favor y en contra a la vez es error; hechos que se contradicen se señalan", async () => {
    const inv = await invDemo();
    const x = clon(inv); x.hipotesis[1].en_contra.push("h2");
    verdadero(tiene(validarInvestigacion(x).errores, /a favor y en contra a la vez/));
    const a = analizarInvestigacion(inv);
    igual(a.conflictos.map((c) => `${c.a}>${c.b}`), ["p8>h2"]);
    igual(a.hipotesis.find((y) => y.id === "H-B").apoyos_disputados, ["h2"]);
    verdadero(tiene(a.alertas, /se contradicen/));
  });
  prueba("CSI · simulador determinista: mismas entradas, mismo resultado; restricciones bloquean rutas; todo es «simulacion»", async () => {
    const d = await demo();
    const ctx = { investigacion: d.investigaciones.investigaciones[0], actores: d.actores };
    const s1 = simular(d.escenarios.escenarios[0], ctx), s2 = simular(clon(d.escenarios.escenarios[0]), ctx);
    igual(s1, s2);
    igual(s1.rutas.length, 6);
    igual(s1.rutas.filter((r) => !r.viable).map((r) => r.id), ["n2>n2a"]);
    verdadero(s1.rutas.every((r) => r.naturaleza === "simulacion") && /no es un resultado real/i.test(s1.aviso));
    igual(s1.explicaciones.map((x) => `${x.clave}:${x.estado}`), ["A:con_senales_en_contra", "B:con_senales_a_favor", "C:con_senales_en_contra", "D:sin_evidencia"]);
    verdadero(s1.explicaciones.find((x) => x.clave === "D").solo_hipotesis);
    const e = clon(d.escenarios.escenarios[0]); e.naturaleza = "resultado";
    verdadero(tiene(validarEscenario(e).errores, /nunca es un resultado real/));
    const m = clon(d.escenarios.escenarios[0]); delete m.explicaciones[3].solo_hipotesis;
    verdadero(tiene(validarEscenario(m).errores, /solo_hipotesis/));
    const n = clon(d.escenarios.escenarios[0]); n.arbol.nodos[1].decision_id = "inventada";
    verdadero(tiene(simular(n, ctx).problemas, /no es una decisión posible registrada/));
  });

  // ---------------- Actores ----------------
  prueba("CSI · actores: lo documentado lleva fuente; relaciones sin fuente no entran; sin relación no se supone coordinación", async () => {
    const d = await demo();
    const x = clon(d.actores); x.actores[0].objetivos_documentados.push({ texto: "Sin fuente", fuentes: [] });
    verdadero(tiene(validarActores(x).errores, /necesita fuente/));
    const y = clon(d.actores); y.actores[0].tipo = "persona";
    verdadero(tiene(validarActores(y).errores, /no a personas privadas/));
    const rv = relacionesVerificables(d.actores);
    igual([rv.verificables.length, rv.sin_verificar.map((r) => r.id)], [4, ["r5"]]);
    const an = analizarIntereses(d.actores, ["fondo-arce", "banco-torre", "minoristas"]);
    igual(an.pares.find((p) => p.a === "fondo-arce" && p.b === "minoristas").lectura, "sin relación documentada (no se supone coordinación ni conflicto)");
    igual(an.pares.find((p) => p.a === "fondo-arce" && p.b === "banco-torre").clases, ["dependencia"], "la competencia sin fuente (r5) no cuenta");
    verdadero(/No implica coordinación/.test(an.nota));
    igual(analizarIntereses(d.actores).bloques, [["bc-lumen", "hacienda-lumen", "omr"]]);
  });

  // ---------------- Memoria de predicciones ----------------
  prueba("CSI · DEMO: se conservan acierto, fallo, indeterminada, vencida sin evaluar y pendiente; se compara con la referencia", async () => {
    const d = await demo();
    const r = resumirPredicciones(d.predicciones, AHORA);
    igual([r.total, r.acertadas, r.fallidas, r.indeterminadas, r.sin_evaluar, r.pendientes], [5, 1, 1, 1, 1, 1]);
    igual(r.filas.find((f) => f.id === "pred-bc-facilidad").estado, "fallida");
    verdadero(/no demuestra que la explicación causal/.test(r.filas.find((f) => f.id === "pred-rebote").advertencia));
    igual([r.comparacion.modelo.acertadas, r.comparacion.referencia.acertadas], [1, 2]);
    verdadero(/no alcanza/.test(r.comparacion.lectura));
    verdadero((await verificarPredicciones(d.predicciones)).ok);
  });
  prueba("CSI · corregir después del resultado crea versión 2 marcada «posterior» y se evalúa la original", async () => {
    const r = resumirPredicciones((await demo()).predicciones, AHORA);
    const f = r.filas.find((x) => x.id === "pred-bc-facilidad");
    igual([f.versiones, f.version_evaluada, f.correcciones_posteriores.length, f.estado], [2, 1, 1, "fallida"]);
    const d = await conPrediccion();
    const mover = await agregarEntrada(d, { tipo: "correccion", contenido: { prediccion_id: "p1", motivo: "x", prediccion: PRED({ horizonte: { desde: "2026-10-14T10:00:00-06:00", hasta: "2026-10-20T10:00:00-06:00" } }) }, registrado_en: "2026-10-13T09:30:00-06:00", registrado_por: A });
    verdadero(tiene(mover.errores, /no puede mover el inicio/));
    const antes = await agregarEntrada(d, { tipo: "correccion", contenido: { prediccion_id: "p1", motivo: "precisión", prediccion: PRED({ resultado_observable: "Cierre oficial" }) }, registrado_en: "2026-10-13T09:30:00-06:00", registrado_por: A });
    igual(resumirPredicciones(antes.doc, Date.parse("2026-10-14T00:00:00-06:00")).filas[0].version_evaluada, 2, "una corrección antes del horizonte sí cuenta");
    verdadero(tiene((await agregarEntrada(d, { tipo: "registro", contenido: PRED(), registrado_en: "2026-10-13T09:10:00-06:00", registrado_por: A })).errores, /ya existe/));
  });
  prueba("CSI · una predicción registrada no cambia en silencio: reescribir, borrar o reordenar rompe la cadena", async () => {
    const d = (await demo()).predicciones;
    const a = clon(d); a.entradas[0].contenido.hipotesis_original = "Otra cosa";
    verdadero(tiene((await verificarPredicciones(a)).problemas, /se modificó después de registrarse/));
    const b = clon(d); b.entradas.splice(5, 1);
    verdadero(!(await verificarPredicciones(b)).ok);
    const c = clon(d); [c.entradas[1], c.entradas[2]] = [c.entradas[2], c.entradas[1]];
    verdadero(!(await verificarPredicciones(c)).ok);
    verdadero(tiene((await agregarEntrada(d, { tipo: "registro", contenido: PRED({ id: "pz", investigacion_id: "demo-caida-lumen", fuentes_conocidas: [] }), registrado_en: "2026-10-01T00:00:00-06:00", registrado_por: A })).errores, /hacia atrás|DEMO/));
  });
  prueba("CSI · indeterminada exige nota; acertada y fallida exigen evidencia", async () => {
    const d = await conPrediccion();
    const ev = (c) => agregarEntrada(d, { tipo: "evaluacion", contenido: { prediccion_id: "p1", resultado_referencia: "indeterminada", evidencia: [], ...c }, registrado_en: "2026-10-21T09:00:00-06:00", registrado_por: B });
    verdadero(tiene((await ev({ resultado: "indeterminada" })).errores, /exige una nota/));
    verdadero((await ev({ resultado: "indeterminada", nota: "No hay dato oficial" })).ok);
    verdadero(tiene((await ev({ resultado: "fallida", nota: "x" })).errores, /exige evidencia/));
  });

  // ---------------- Integración con Nexus y circularidad ----------------
  prueba("CSI → Nexus: la propuesta llega como «propuesta», con dictamen escéptico y decisión humana pendiente", async () => {
    const d = await demo();
    const r = prepararPropuesta(d.investigaciones.investigaciones[0], "H-B", { autor: { tipo: "humano", identificador: "analista-demo" }, fecha: AHORA_DEMO, predicciones: resumirPredicciones(d.predicciones, AHORA) });
    verdadero(r.ok);
    igual(r.propuesta.borrador_leccion.validacion.estado, "propuesta");
    igual(r.propuesta.borrador_leccion.version_esquema, "0.3");
    igual(r.propuesta.revision_esceptica.errores_forma, []);
    verdadero(r.propuesta.revision_esceptica.dictamen !== "sin_objeciones");
    igual(r.propuesta.decision_humana.estado, "pendiente");
    verdadero(revisarPropuesta(r.propuesta).ok);
    verdadero(r.propuesta.predicciones.find((p) => p.id === "pred-rebote").nota.includes("no demuestra"));
    verdadero(r.propuesta.bloqueos.some((b) => /revisión humana independiente/.test(b)));
  });
  prueba("CSI → Nexus: en REAL la muestra es «desconocida» y Nexus no puede evaluarla como efecto", async () => {
    let inv = (await enunciado(await base(), { id: "h1", tipo: "hecho", texto: "Cayó 9 %", fuentes: ["f1"] })).inv;
    inv = (await aplicarCambio(inv, { accion: "agregar_hipotesis", datos: { hipotesis: { id: "H1", categoria: "liquidez", enunciado: "Ventas forzadas", a_favor: ["h1"], condiciones_refutacion: ["entradas netas"] } } }, { autor: A, fecha: "2026-10-13T00:00:00-06:00" })).inv;
    const r = prepararPropuesta(inv, "H1", { autor: A, fecha: "2026-10-14T00:00:00-06:00" });
    igual(r.propuesta.borrador_leccion.muestra.naturaleza, "desconocida");
    igual(validarLeccion(r.propuesta.borrador_leccion).errores, []);
    verdadero(r.propuesta.revision_esceptica.no_evaluado.includes("R08") || r.propuesta.revision_esceptica.no_cumple.includes("R09"));
    verdadero(r.propuesta.revision_esceptica.dictamen !== "sin_objeciones");
  });
  prueba("CSI ↔ Nexus: lo que dijo Nexus no es evidencia de la hipótesis que originó (circularidad)", async () => {
    let inv = await base();
    inv = (await aplicarCambio(inv, { accion: "agregar_fuente", datos: { fuente: { id: "nx", titulo: "Recomendación de Nexus", editor: "Nexus", tipo: "nexus", publicada_en: "2026-10-12T10:00:00-06:00", enlace: "recomendacion:rec-7" } } }, { autor: A, fecha: "2026-10-12T20:02:00-06:00" })).inv;
    verdadero(tiene((await enunciado(inv, { id: "c1", tipo: "hecho", texto: "Nexus dice que es liquidez", fuentes: ["nx"] })).errores, /Nexus no cuenta|circular/));
    verdadero((await enunciado(inv, { id: "c2", tipo: "inferencia", texto: "Nexus sugirió revisar liquidez", fuentes: ["nx"], inferido_de: [] })).ok === false, "la inferencia aún necesita de qué sale");
    // Aunque alguien se salte el validador, el adaptador excluye la evidencia y bloquea la hipótesis nacida en Nexus.
    const x = clon(inv);
    x.enunciados.push({ id: "c1", tipo: "hecho", texto: "Nexus dice que es liquidez", fuentes: ["nx"], registrado_en: "2026-10-12T21:00:00-06:00" });
    x.hipotesis.push({ id: "H1", categoria: "liquidez", enunciado: "Liquidez", a_favor: ["c1"], en_contra: [], supuestos: [], condiciones_refutacion: ["y"], datos_faltantes: [], origen: "recomendacion:rec-7" });
    const r = prepararPropuesta(x, "H1", { autor: A, fecha: "2026-10-14T00:00:00-06:00" });
    igual(r.propuesta.evidencia_primaria, []);
    verdadero(/circularidad/.test(r.propuesta.excluida[0].motivo));
    verdadero(r.propuesta.bloqueos.some((b) => /nació de Nexus/.test(b)) && r.propuesta.bloqueos.some((b) => /Sin evidencia primaria/.test(b)));
    const auto = clon(r.propuesta); auto.borrador_leccion.validacion.estado = "validada_en_origen";
    verdadero(!revisarPropuesta(auto).ok, "una propuesta «autovalidada» se detecta");
  });

  // ---------------- Privacidad y DEMO/REAL ----------------
  prueba("CSI · privacidad: correos, teléfonos o claves se rechazan en investigaciones y predicciones", async () => {
    verdadero(tiene((await enunciado(await base(), { id: "h1", tipo: "hecho", texto: "Contacto: juan@ejemplo.com", fuentes: ["f1"] })).errores, /correo/));
    verdadero(tiene((await agregarEntrada(registroVacioPredicciones(false), { tipo: "registro", contenido: PRED({ supuestos: ["token = abcdef123456"] }), registrado_en: "2026-10-13T09:00:00-06:00", registrado_por: A })).errores, /credencial/));
  });
  prueba("CSI · DEMO y REAL no se mezclan: fuentes ficticias fuera del DEMO, actores ficticios fuera del REAL, documentos mezclados no se muestran", async () => {
    const d = await demo();
    const r = clon(d.investigaciones.investigaciones[0]); r.es_demo = false;
    verdadero(tiene(validarInvestigacion(r).errores, /ficticia no puede estar en un documento REAL/));
    const a = clon(d.actores); a.es_demo = false; delete a.demo;
    verdadero(tiene(validarActores(a).errores, /ficticio no puede estar en el registro REAL/));
    const mezcla = await leerCSI({ ...d, predicciones: registroVacioPredicciones(false) });
    verdadero(tiene(mezcla.errores, /Se mezclan documentos DEMO y REAL/) && mezcla.investigaciones.length === 0);
    const bien = await leerCSI(d);
    igual([bien.es_demo, bien.errores.length, bien.ahoraMs], [true, 0, AHORA]);
  });

  // ---------------- Piso 2D/3D (contrato v1 sin cambios) ----------------
  prueba("CSI · el piso CSI cumple cauce.estado-proyecto 1.0.0, nadie aparece «trabajando» y coincide con la escena", async () => {
    const piso = JSON.parse(await leerTexto("datos/demo/csi.json"));
    const v = validarDocumento(piso);
    verdadero(v.valido, v.errores.join(" "));
    igual(piso.version, "1.0.0");
    verdadero(piso.departamentos.every((dp) => dp.agentes.every((x) => x.estado !== "trabajando")));
    const escena = JSON.parse(await leerTexto("escena/csi.json"));
    igual(Object.keys(escena.departamentos).sort(), piso.departamentos.map((dp) => dp.id).sort());
    igual(piso.departamentos.length, 5);
    const d = await demo(); const c = await leerCSI(d);
    igual(estadoPisoCSI({ investigaciones: c.investigaciones.map((x) => x.inv), actores: d.actores, escenarios: c.escenarios.map((x) => x.esc), predicciones: c.predicciones.resumen, es_demo: true, ahoraMs: AHORA }), piso);
    const vacio = estadoPisoCSI({ es_demo: false, ahoraMs: AHORA });
    verdadero(validarDocumento(vacio).valido && vacio.departamentos.every((dp) => dp.agentes[0].estado === "sin_datos"), "almacén vacío: sillas sin datos");
  });
}
