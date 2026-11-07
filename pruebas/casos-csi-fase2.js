// CSI fase 2: motor de fuentes, mapa de poder 0.2, flujo de 10 pasos, Abogado del Diablo, anclas de predicciones y
// adaptador a Nexus 0.2. Corre en Node (pruebas/ejecutar.mjs) y en pruebas.html.
// Los documentos REAL de estas pruebas son FIXTURES de prueba (dominio example.org, instituciones inventadas):
// no son una investigación ni afirman nada sobre instituciones reales.

import { prueba, igual, verdadero } from "./mini.js";
import { validarInvestigacion, crearInvestigacion, aplicarCambio, verificarHistorial, analizarInvestigacion } from "../app/csi/investigacion.js";
import { validarActores } from "../app/csi/actores.js";
import { validarEscenario, simular } from "../app/csi/simulador.js";
import { agregarEntrada, registroVacioPredicciones, resumirPredicciones } from "../app/csi/predicciones.js";
import { prepararPropuesta, revisarPropuesta, FLUJO } from "../app/csi/adaptador-nexus.js";
import { construirDemoCSI } from "../app/csi/demo.js";
import { leerCSI } from "../app/csi/registro.js";
import { validarFuentes02, conocibleAntes, fechaConocimiento, lineaConocimiento, expedientePendiente, citaConProcedencia } from "../app/csi/fuentes.js";
import { evaluarFlujo, PASOS } from "../app/csi/flujo.js";
import { revisarAbogado, objecionesSugeridas, PREGUNTAS } from "../app/csi/abogado.js";
import { crearAncla, validarAncla, verificarContraAncla, registrarAcreditacion, textoPublicable } from "../app/csi/ancla.js";
import { construirDesdeExpediente } from "../app/csi/expediente.js";
import { buscarPsicologia, buscarEstrategiaFinanciera, buscarCoordinacion } from "../app/csi/lenguaje.js";
import { validarLeccion } from "../app/nexus/leccion.js";

const clon = (x) => JSON.parse(JSON.stringify(x));
const A = { tipo: "humano", identificador: "ana" };
const B = { tipo: "humano", identificador: "beto" };
const tiene = (errores, re) => errores.some((t) => re.test(t));
const T = (m) => `2026-11-07T10:${String(m).padStart(2, "0")}:00Z`;
/** Fuente REAL 0.2 de prueba (dominio de ejemplo). */
const FU = (id, extra = {}) => ({ id, titulo: `Comunicado ${id}`, editor: "Instituto de Prueba", tipo: "documento_oficial", clase: "primaria", estado: "consultada", publicada_en: "2020-03-10",
  consultada_en: "2026-11-07T09:00:00Z", enlace: `https://example.org/${id}`, extracto: `"La junta decidió subir la tasa de referencia." Texto de ${id}.`, extracto_tipo: "cita_textual", metodo_consulta: "manual", limitaciones: ["Fixture de prueba."], autor_actor_id: "inst", origen: "inst", ...extra });
const ALCANCE = { descripcion: "Decisión de prueba", periodo: { desde: "2020-01-01", hasta: "2020-12-31" }, incluye: ["comunicados"], excluye: ["rumores"], criterios_fuentes: ["Primero documentos de la institución"] };

async function historica({ alcance = true } = {}) {
  let r = await crearInvestigacion({ id: "hist-prueba", titulo: "Prueba histórica", pregunta: "¿Por qué decidió?", acontecimiento: { descripcion: "Sube la tasa", fecha: "2020-03-10" }, autor: A, fecha: T(0), actores: ["inst", "banco"], version: "0.2", naturaleza_estudio: "historico" });
  if (!r.ok) throw new Error(r.errores.join(" | "));
  if (alcance) { r = await aplicarCambio(r.inv, { accion: "definir_alcance", datos: ALCANCE }, { autor: A, fecha: T(1) }); if (!r.ok) throw new Error(r.errores.join(" | ")); }
  return r.inv;
}
const paso = async (inv, accion, datos, m, autor = A) => { const r = await aplicarCambio(inv, { accion, datos }, { autor, fecha: T(m) }); if (!r.ok) throw new Error(`${accion}: ${r.errores.join(" | ")}`); return r.inv; };
const intento = (inv, accion, datos, m, autor = A) => aplicarCambio(inv, { accion, datos }, { autor, fecha: T(m) });
/** Investigación histórica completa (fixture) para flujo, Abogado y Nexus. */
async function completa() {
  let inv = await historica();
  inv = await paso(inv, "agregar_fuente", { fuente: FU("f1") }, 2);
  inv = await paso(inv, "agregar_fuente", { fuente: FU("f2", { editor: "Diario de Prueba", tipo: "prensa", clase: "secundaria", autor_actor_id: undefined, origen: "diario", extracto: "El diario informa la subida.", extracto_tipo: "parafrasis", publicada_en: "2020-03-11" }) }, 2);
  inv = await paso(inv, "agregar_fuente", { fuente: FU("f3", { publicada_en: "2020-06-01", extracto: "Explicación posterior de la junta.", extracto_tipo: "parafrasis" }) }, 2);
  inv = await paso(inv, "agregar_enunciado", { enunciado: { id: "e1", tipo: "hecho", texto: "La institución subió la tasa.", fuentes: ["f1", "f2"], sobre: "conducta", actor_id: "inst", cita: "La junta decidió subir la tasa de referencia." } }, 3);
  inv = await paso(inv, "agregar_enunciado", { enunciado: { id: "e2", tipo: "declaracion", texto: "La junta explicó después sus razones.", fuentes: ["f3"], sobre: "intencion", actor_id: "inst" } }, 3);
  inv = await paso(inv, "agregar_enunciado", { enunciado: { id: "e3", tipo: "hecho", texto: "El banco no cambió su tasa.", fuentes: ["f2"], sobre: "conducta", actor_id: "banco" } }, 3);
  inv = await paso(inv, "agregar_incentivo", { incentivo: { id: "i1", actor_id: "inst", texto: "Contener precios", basado_en: ["e1"] } }, 4);
  inv = await paso(inv, "agregar_incentivo", { incentivo: { id: "i2", actor_id: "banco", texto: "Mantener márgenes", basado_en: ["e3"] } }, 4);
  inv = await paso(inv, "agregar_hipotesis", { hipotesis: { id: "H-A", categoria: "fundamentales", enunciado: "Subió por inflación.", sobre_actor: "inst", momento_decision: "2020-03-10", a_favor: ["e1", "e2"], en_contra: ["e3"], condiciones_refutacion: ["Inflación a la baja documentada"], datos_faltantes: ["Actas"] } }, 5);
  inv = await paso(inv, "agregar_hipotesis", { hipotesis: { id: "H-B", categoria: "otra", enunciado: "Subió por presión externa.", a_favor: ["e1"], condiciones_refutacion: ["Sin contacto documentado"], datos_faltantes: ["Correspondencia"] } }, 5);
  inv = await paso(inv, "agregar_hipotesis", { hipotesis: { id: "H-C", categoria: "manipulacion", enunciado: "Alguien operó con información previa.", a_favor: [], condiciones_refutacion: ["Supervisor no encuentra nada"], datos_faltantes: ["Órdenes"] } }, 5);
  for (const [h, de] of [["H-A", ["H-B", "H-C"]], ["H-B", ["H-A", "H-C"]], ["H-C", ["H-A", "H-B"]]]) inv = await paso(inv, "agregar_observacion", { hipotesis_id: h, observacion: { texto: `Dato que separa ${h}`, distingue_de: de } }, 6);
  return inv;
}
const ACTORES = () => ({ contrato: "cauce.csi.actores", version_contrato: "0.2", es_demo: false, actualizado_en: T(0), fuentes: [FU("fa")],
  actores: [
    { id: "inst", nombre: "Instituto de Prueba", tipo: "banco_central", ficticio: false, objetivos_documentados: [{ texto: "Estabilidad", fuentes: ["fa"] }], incentivos_hipoteticos: [{ texto: "Contener precios" }], recursos_conocidos: [], restricciones: [{ texto: "Ley", fuentes: ["fa"], clase: "legal" }],
      decisiones_posibles: [{ id: "subir", texto: "Subir" }, { id: "esperar", texto: "Esperar" }], incertidumbres: [], intereses_economicos: [], decisiones_historicas: [{ id: "d1", fecha: "2020-03-10", texto: "Sube la tasa", fuentes: ["fa"] }], conflictos_interes: [] },
    { id: "banco", nombre: "Banco de Prueba", tipo: "institucion_financiera", ficticio: false, objetivos_documentados: [], incentivos_hipoteticos: [{ texto: "Márgenes" }], recursos_conocidos: [], restricciones: [], decisiones_posibles: [{ id: "seguir", texto: "Seguir" }], incertidumbres: [], intereses_economicos: [], decisiones_historicas: [], conflictos_interes: [] },
  ], relaciones: [] });
const ESC = (extra = {}) => ({ contrato: "cauce.csi.escenario", version_contrato: "0.2", id: "esc-1", investigacion_id: "hist-prueba", titulo: "Contrafactual", es_demo: false, naturaleza: "simulacion", contrafactual: true, supuestos: ["No sube"], creado_en: T(7), creado_por: A, detonante: "Inflación",
  explicaciones: [{ id: "A", clave: "A", categoria: "fundamentales", descripcion: "Inflación", senales_a_favor: [{ texto: "Sube", enunciado_id: "e1" }], senales_en_contra: [], datos_faltantes: [] }],
  arbol: { nodos: [{ id: "n1", padre: null, actor_id: "inst", decision_id: "esperar", beneficios: [], costos: [], restricciones: [], consecuencias: [] }, { id: "n2", padre: "n1", actor_id: "banco", decision_id: "seguir", beneficios: [], costos: [], restricciones: [], consecuencias: [] }] }, ...extra });
const PRED = (id, desde, extra = {}) => ({ id, investigacion_id: "inv-x", hipotesis_original: "Sube", resultado_observable: "Cierre", horizonte: { desde, hasta: "2031-01-01T00:00:00Z" }, criterios: { acertada: "sube", fallida: "baja", indeterminada: "sin dato" }, fuentes_conocidas: [], supuestos: [], version_reglas: "r1", referencia: { descripcion: "sin cambio", resultado_esperado: "igual" }, ...extra });
async function registroCon(n = 2) {
  let doc = registroVacioPredicciones(false);
  for (let i = 1; i <= n; i++) { const r = await agregarEntrada(doc, { tipo: "registro", contenido: PRED(`p${i}`, `2030-0${i}-01T00:00:00Z`), registrado_en: T(i), registrado_por: A }); if (!r.ok) throw new Error(r.errores.join(" ")); doc = r.doc; }
  return doc;
}

export function registrarCasosCSIFase2() {
  // ---------------- Motor de fuentes (bloque 2) ----------------
  prueba("CSI 2 · fuentes: una fuente REAL 0.2 completa es válida; clase, estado, enlace y limitaciones son obligatorios", () => {
    const e = []; validarFuentes02([FU("f1")], { es_demo: false, e: (t) => e.push(t) }); igual(e, []);
    const m = []; const f = FU("f2"); delete f.clase; delete f.estado; delete f.enlace; f.limitaciones = [];
    validarFuentes02([f], { es_demo: false, e: (t) => m.push(t) });
    verdadero(tiene(m, /clase:/) && tiene(m, /estado:/) && tiene(m, /enlace \(URL\) o referencia/) && tiene(m, /limitaciones: di al menos una/), m.join(" | "));
  });
  prueba("CSI 2 · fechas incorrectas: consulta antes de la publicación, disponibilidad posterior y disponibilidad sin «según»", () => {
    const e = [];
    validarFuentes02([FU("a", { consultada_en: "2019-01-01T00:00:00Z" }), FU("b", { disponible_en: "2020-04-01", disponible_segun: "x" }), FU("c", { disponible_en: "2020-03-09" }), FU("d", { publicada_en: "2020-13-45" })], { es_demo: false, e: (t) => e.push(t) });
    verdadero(tiene(e, /\[0\].*anterior a la publicación/), "consulta antes de publicar");
    verdadero(tiene(e, /\[1\].*posterior a la publicación de esta copia/), "disponible después de publicada");
    verdadero(tiene(e, /\[2\].*disponible_segun/), "disponible sin justificar");
    verdadero(tiene(e, /\[3\].*publicada_en/), "fecha imposible");
  });
  prueba("CSI 2 · fecha de consulta ≠ fecha de conocimiento: «qué se podía saber» usa disponible_en, nunca consultada_en", async () => {
    const f = FU("t", { publicada_en: "2020-03-11", disponible_en: "2020-03-10", disponible_segun: "La copia transcribe la conferencia del día 10" });
    igual(fechaConocimiento(f), "2020-03-10");
    verdadero(conocibleAntes(f, "2020-03-12T00:00:00Z") && !conocibleAntes(f, "2020-03-10T10:00:00Z"));
    const inv = await completa();
    const linea = lineaConocimiento(inv, [{ etiqueta: "antes", instante: "2020-03-09T00:00:00Z" }, { etiqueta: "después", instante: "2020-12-31T00:00:00Z" }]);
    igual(linea[0].fuentes, []); verdadero(linea[1].fuentes.includes("f3"));
    verdadero(!linea[0].enunciados.length && linea[1].enunciados.includes("e1"));
  });
  prueba("CSI 2 · fuentes duplicadas: mismo enlace o misma huella de copia se rechazan", () => {
    const e = [];
    const h = "a".repeat(64);
    validarFuentes02([FU("a"), FU("b", { enlace: "https://example.org/a/" }), FU("c", { huella_contenido: h, copia_local: "c.pdf" }), FU("d", { huella_contenido: h, copia_local: "d.pdf" })], { es_demo: false, e: (t) => e.push(t) });
    verdadero(tiene(e, /\[1\].*duplicada: el enlace/) && tiene(e, /\[3\].*duplicada: misma huella/), e.join(" | "));
    const e2 = []; validarFuentes02([FU("x", { huella_contenido: h })], { es_demo: false, e: (t) => e2.push(t) });
    verdadero(tiene(e2, /sin copia_local/), "huella sin copia");
  });
  prueba("CSI 2 · fuente pendiente: se registra con motivo, pero no respalda hechos ni relaciones", async () => {
    let inv = await historica();
    verdadero(tiene((await intento(inv, "agregar_fuente", { fuente: FU("pp", { estado: "pendiente", extracto_tipo: "parafrasis" }) }, 2)).errores, /pendiente explica por qué/));
    inv = await paso(inv, "agregar_fuente", { fuente: FU("pp", { estado: "pendiente", pendiente_motivo: "Sin acceso al PDF", extracto: undefined, extracto_tipo: undefined }) }, 2);
    verdadero(tiene((await intento(inv, "agregar_enunciado", { enunciado: { id: "e1", tipo: "hecho", texto: "x", fuentes: ["pp"] } }, 3)).errores, /pendientes|fuente primaria/));
    igual(expedientePendiente(inv).pendientes[0].motivo, "Sin acceso al PDF");
    igual(expedientePendiente(inv).completo, false);
  });
  prueba("CSI 2 · fuentes inexistentes y citas sin procedencia", async () => {
    let inv = await historica();
    inv = await paso(inv, "agregar_fuente", { fuente: FU("f1") }, 2);
    verdadero(tiene((await intento(inv, "agregar_enunciado", { enunciado: { id: "e1", tipo: "hecho", texto: "x", fuentes: ["no-existe"] } }, 3)).errores, /no existe/));
    verdadero(tiene((await intento(inv, "agregar_enunciado", { enunciado: { id: "e1", tipo: "hecho", texto: "x", fuentes: ["f1"], cita: "La junta decidió bajar la tasa" } }, 3)).errores, /cita sin procedencia/));
    verdadero((await intento(inv, "agregar_enunciado", { enunciado: { id: "e1", tipo: "hecho", texto: "x", fuentes: ["f1"], cita: "la junta  decidió subir la tasa" } }, 3)).ok, "la cita normaliza espacios y mayúsculas");
    verdadero(!citaConProcedencia("subir la tasa", [FU("q", { extracto_tipo: "parafrasis" })]), "una paráfrasis no da procedencia a una cita textual");
  });
  prueba("CSI 2 · información futura: un enunciado no cita fuentes publicadas después de anotarlo", async () => {
    let r = await crearInvestigacion({ id: "pros", titulo: "P", pregunta: "¿?", acontecimiento: { descripcion: "x", fecha: "2026-11-01" }, autor: A, fecha: "2026-11-02T00:00:00Z", actores: ["inst"], version: "0.2", naturaleza_estudio: "prospectivo" });
    let inv = r.inv;
    inv = await paso(inv, "agregar_fuente", { fuente: FU("fut", { publicada_en: "2026-11-08", consultada_en: undefined, estado: "pendiente", pendiente_motivo: "aún no publicada", extracto: undefined, extracto_tipo: undefined }) }, 2);
    r = await intento(inv, "agregar_enunciado", { enunciado: { id: "e1", tipo: "inferencia", texto: "x", fuentes: ["fut"], inferido_de: ["e1"] } }, 3);
    verdadero(tiene(r.errores, /información futura/), r.errores.join(" | "));
  });

  // ---------------- Separación HECHO / DECLARACIÓN / INFERENCIA / HIPÓTESIS / ESCENARIO (bloque 3) ----------------
  prueba("CSI 2 · inferencias como hechos: una interpretación no sostiene un hecho; una inferencia no es evidencia", async () => {
    let inv = await historica();
    inv = await paso(inv, "agregar_fuente", { fuente: FU("op", { clase: "interpretacion", tipo: "analisis_tercero", origen: "analista", autor_actor_id: undefined }) }, 2);
    verdadero(tiene((await intento(inv, "agregar_enunciado", { enunciado: { id: "e1", tipo: "hecho", texto: "La institución se equivocó", fuentes: ["op"] } }, 3)).errores, /no descansa solo en interpretaciones/));
    inv = await paso(inv, "agregar_enunciado", { enunciado: { id: "i1", tipo: "inferencia", texto: "Quizá se equivocó", fuentes: ["op"], inferido_de: ["i1"] } }, 3);
    verdadero(tiene((await intento(inv, "agregar_hipotesis", { hipotesis: { id: "H1", categoria: "otra", enunciado: "x", a_favor: ["i1"] } }, 4)).errores, /solo hechos y declaraciones son evidencia/));
  });
  prueba("CSI 2 · lenguaje: estados psicológicos y «coordinación secreta» no entran como hecho de un actor REAL", async () => {
    let inv = await historica();
    inv = await paso(inv, "agregar_fuente", { fuente: FU("f1") }, 2);
    verdadero(tiene((await intento(inv, "agregar_enunciado", { enunciado: { id: "e1", tipo: "hecho", texto: "La junta actuó por pánico", fuentes: ["f1"] } }, 3)).errores, /estado psicológico/));
    verdadero(tiene((await intento(inv, "agregar_enunciado", { enunciado: { id: "e1", tipo: "hecho", texto: "Hubo coordinación secreta con el banco", fuentes: ["f1"] } }, 3)).errores, /coordinación secreta/));
    verdadero((await intento(inv, "agregar_enunciado", { enunciado: { id: "e1", tipo: "declaracion", texto: "Un diario dijo que hubo pánico", fuentes: ["f1"], actor_id: "inst" } }, 3)).ok, "como declaración atribuida sí");
    igual(buscarPsicologia("El banco central compró divisas"), []);
    igual(buscarEstrategiaFinanciera("El banco central estaba dispuesto a comprar divisas en cantidades ilimitadas"), [], "describir a un banco central no es estrategia privada");
    verdadero(buscarEstrategiaFinanciera("Deberíamos vender francos mañana").length > 0 && buscarCoordinacion("una conspiración global").length > 0);
  });
  prueba("CSI 2 · actores 0.2: intereses, decisiones históricas y conflictos documentados exigen fuente; sin psicología en REAL", () => {
    igual(validarActores(ACTORES()).errores, []);
    const a = ACTORES(); a.actores[0].decisiones_historicas.push({ id: "d2", fecha: "2020-05-01", texto: "Otra", fuentes: [] });
    a.actores[0].conflictos_interes.push({ texto: "Conflicto", fuentes: [], clase: "documentado" });
    a.actores[0].intereses_economicos.push({ texto: "Interés", fuentes: [] });
    a.actores[1].incentivos_hipoteticos.push({ texto: "Su presidente teme perder el cargo" });
    const e = validarActores(a).errores;
    verdadero(tiene(e, /decisión histórica es verificable solo con fuente/) && tiene(e, /«documentado» necesita fuente/) && tiene(e, /lo documentado necesita fuente/) && tiene(e, /estado psicológico/), e.join(" | "));
    const v1 = ACTORES(); v1.version_contrato = "0.1";
    verdadero(tiene(validarActores(v1).errores, /intereses_economicos: clave desconocida/), "0.1 no acepta claves 0.2");
  });

  // ---------------- Alcance antes de fuentes; histórico retrospectivo (bloque 6) ----------------
  prueba("CSI 2 · histórico: el alcance se registra ANTES de la primera fuente y no se reescribe", async () => {
    let inv = await historica({ alcance: false });
    verdadero(tiene((await intento(inv, "agregar_fuente", { fuente: FU("f1") }, 2)).errores, /alcance/), "sin alcance no entran fuentes");
    inv = await paso(inv, "definir_alcance", ALCANCE, 2);
    inv = await paso(inv, "agregar_fuente", { fuente: FU("f1") }, 3);
    verdadero(tiene((await intento(inv, "definir_alcance", ALCANCE, 4)).errores, /ya se registró/));
    verdadero(tiene((await intento(inv, "editar", { campo: "alcance", valor: {} }, 4)).errores, /Solo se editan/));
    // Alguien que reordena el historial a mano queda detectado.
    const x = clon(inv); [x.historial[1], x.historial[2]] = [x.historial[2], x.historial[1]];
    verdadero(tiene(validarInvestigacion(x).errores, /antes de registrar el alcance/) || !(await verificarHistorial(x)).ok);
    const sinCrit = await historica({ alcance: false });
    verdadero(tiene((await intento(sinCrit, "definir_alcance", { ...ALCANCE, criterios_fuentes: [] }, 2)).errores, /criterios_fuentes/));
  });
  prueba("CSI 2 · histórico: no admite predicciones y toda simulación es contrafactual", async () => {
    let inv = await historica();
    verdadero(tiene((await intento(inv, "agregar_enunciado", { enunciado: { id: "p1", tipo: "prediccion", texto: "Subirá", prediccion_id: "p1" } }, 2)).errores, /retrospectivo: no contiene predicciones/));
    verdadero(tiene((await intento(inv, "agregar_enunciado", { enunciado: { id: "s1", tipo: "simulacion", texto: "Si no hubiera subido…", escenario_id: "esc-1" } }, 2)).errores, /contrafactual: true/));
    verdadero((await intento(inv, "agregar_enunciado", { enunciado: { id: "s1", tipo: "simulacion", texto: "Si no hubiera subido…", escenario_id: "esc-1", contrafactual: true } }, 2)).ok);
    igual(validarEscenario(ESC()).errores, []);
    verdadero(tiene(validarEscenario(ESC({ contrafactual: undefined })).errores, /contrafactual debe ser/));
    verdadero(simular(ESC(), {}).aviso.startsWith("CONTRAFACTUAL"));
  });
  prueba("CSI 2 · DEMO/REAL: naturaleza «demo» solo con es_demo; fuente ficticia no entra a REAL; HISTÓRICO sin memoria de predicciones", async () => {
    const r = await crearInvestigacion({ id: "mal", titulo: "x", pregunta: "x", acontecimiento: { descripcion: "x", fecha: "2020-01-01" }, autor: A, fecha: T(0), version: "0.2", naturaleza_estudio: "demo", es_demo: false });
    verdadero(!r.ok && tiene(r.errores, /naturaleza_estudio «demo»/));
    const e = []; validarFuentes02([FU("x", { ficticia: true })], { es_demo: false, e: (t) => e.push(t) }); verdadero(tiene(e, /ficticia no puede estar/));
    const inv = await completa();
    const c = await leerCSI({ investigaciones: { contrato: "cauce.csi.investigaciones", version_contrato: "0.1", es_demo: false, investigaciones: [inv] }, predicciones: registroVacioPredicciones(false) });
    verdadero(tiene(c.errores, /HISTÓRICO no lleva memoria de predicciones/));
    const d = await construirDemoCSI();
    const mezcla = await leerCSI({ investigaciones: { ...d.investigaciones }, actores: ACTORES() });
    verdadero(tiene(mezcla.errores, /mezclan documentos DEMO y REAL/));
  });

  // ---------------- Flujo de 10 pasos (bloque 4) ----------------
  prueba("CSI 2 · flujo: diez pasos deterministas; lo que falta se dice", async () => {
    igual(PASOS.length, 10);
    const inv = await completa();
    const f = evaluarFlujo(inv, { actores: ACTORES(), escenarios: [ESC()] });
    igual(f.pasos.map((p) => p.n), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    igual(f.pasos.find((p) => p.id === "evidencia").estado, "incompleto", "H-C no tiene evidencia");
    igual(f.completos, 9);
    const sin = evaluarFlujo(inv, { actores: ACTORES(), escenarios: [] });
    verdadero(sin.pasos.find((p) => p.id === "simulacion").faltan.length > 0);
    const d = await construirDemoCSI();
    const fd = evaluarFlujo(d.investigaciones.investigaciones[0], { actores: d.actores, escenarios: d.escenarios.escenarios });
    verdadero(fd.pasos.find((p) => p.id === "observaciones").estado === "incompleto", "el DEMO 0.1 no tiene observaciones distintivas: se dice");
  });

  // ---------------- Abogado del Diablo (bloque 5) ----------------
  prueba("CSI 2 · Abogado: ocho preguntas por hipótesis, firmado por código, sin «aprobar» nada", async () => {
    igual(PREGUNTAS.length, 8);
    const inv = await completa();
    const r = revisarAbogado(inv);
    igual(r.autor.tipo, "codigo");
    verdadero(r.hipotesis.every((h) => h.comprobaciones.length === 8));
    const ha = r.hipotesis.find((h) => h.id === "H-A").comprobaciones;
    const k = (id) => ha.find((c) => c.id === id);
    igual(k("informacion_posterior").resultado, "alerta", "e2 se conoció después de la decisión");
    igual(k("referencia_simple").resultado, "alerta", "retrospectivo no demuestra capacidad predictiva");
    igual(k("refutacion").resultado, "ok");
    const hb = r.hipotesis.find((h) => h.id === "H-B").comprobaciones;
    igual(hb.find((c) => c.id === "mas_sencilla").resultado, "alerta", "H-A ordinaria con más evidencia");
    const hc = r.hipotesis.find((h) => h.id === "H-C").comprobaciones;
    igual(hc.find((c) => c.id === "intenciones").resultado, "alerta", "manipulación sin documento regulatorio");
  });
  prueba("CSI 2 · Abogado: manipulación apoyada solo en precios; fuentes del mismo origen; el propio actor; selección favorable", async () => {
    let inv = await historica();
    inv = await paso(inv, "agregar_fuente", { fuente: FU("p1", { tipo: "dato_mercado", origen: "bolsa", autor_actor_id: undefined, extracto: "Cierre 10", extracto_tipo: "dato" }) }, 2);
    inv = await paso(inv, "agregar_fuente", { fuente: FU("c1", { enlace: "https://example.org/copia", clase: "secundaria", origen: "inst" }) }, 2);
    inv = await paso(inv, "agregar_enunciado", { enunciado: { id: "d1", tipo: "hecho", texto: "El precio cayó 9 %", fuentes: ["p1"], sobre: "dato" } }, 3);
    inv = await paso(inv, "agregar_enunciado", { enunciado: { id: "d2", tipo: "declaracion", texto: "La junta lo explicó", fuentes: ["c1"], actor_id: "inst" } }, 3);
    inv = await paso(inv, "agregar_enunciado", { enunciado: { id: "d3", tipo: "hecho", texto: "El banco siguió igual", fuentes: ["p1"], sobre: "conducta" } }, 3);
    inv = await paso(inv, "agregar_hipotesis", { hipotesis: { id: "H-M", categoria: "manipulacion", enunciado: "Manipularon el precio", a_favor: ["d1"], condiciones_refutacion: ["x"] } }, 4);
    inv = await paso(inv, "agregar_hipotesis", { hipotesis: { id: "H-P", categoria: "fundamentales", enunciado: "Lo explica la junta", sobre_actor: "inst", a_favor: ["d2"], condiciones_refutacion: ["x"] } }, 4);
    const r = revisarAbogado(inv);
    const c = (h, id) => r.hipotesis.find((x) => x.id === h).comprobaciones.find((k) => k.id === id);
    verdadero(/movimiento de precios por sí solo no demuestra manipulación/.test(c("H-M", "intenciones").detalle));
    verdadero(/propio actor/.test(c("H-P", "independencia").detalle), c("H-P", "independencia").detalle);
    verdadero(/no se usaron en ninguna hipótesis/.test(c("H-M", "seleccion").detalle));
    const sug = objecionesSugeridas(inv, r);
    verdadero(sug.length > 0 && sug.every((o) => o.autor.tipo === "codigo"));
    const inv2 = await paso(inv, "agregar_objecion", { objecion: sug[0] }, 5, sug[0].autor);
    igual(inv2.objeciones[0].autor.identificador, "abogado-csi");
    verdadero(tiene((await intento(inv2, "revision", { estado: "revisada" }, 6, { tipo: "codigo", identificador: "abogado-csi" })).errores, /firma una persona/), "el Abogado (código) no puede firmar la revisión");
  });
  prueba("CSI 2 · referencia simple: con menos de 10 decididas no hay ventaja; con 10+ se compara contra la referencia", async () => {
    let inv = await completa();
    inv = clon(inv); inv.naturaleza_estudio = "prospectivo";
    const filas = (n, modelo, ref) => ({ filas: Array.from({ length: n }, (_, i) => ({ id: `p${i}`, investigacion_id: inv.id, hipotesis_id: "H-A", estado: i < modelo ? "acertada" : "fallida", resultado_referencia: i < ref ? "acertada" : "fallida" })) });
    const k = (pr) => revisarAbogado(inv, { predicciones: pr }).hipotesis.find((h) => h.id === "H-A").comprobaciones.find((c) => c.id === "referencia_simple");
    igual(k(filas(4, 4, 0)).resultado, "alerta");
    igual(k(filas(12, 9, 6)).resultado, "ok");
    igual(k(filas(12, 6, 9)).resultado, "alerta");
  });

  // ---------------- Anclas (bloque 7) ----------------
  prueba("CSI 2 · ancla: solo huellas (sin textos ni ids por defecto); el texto publicable no contiene predicciones", async () => {
    const doc = await registroCon(2);
    const r = await crearAncla(doc, { creada_en: T(30), creada_por: A });
    verdadero(r.ok);
    verdadero(!JSON.stringify(r.ancla).includes("Sube") && !JSON.stringify(r.ancla).includes("p1"), "no filtra el contenido");
    igual(r.ancla.publicacion.estado, "no_publicada");
    verdadero(textoPublicable(r.ancla).includes(r.ancla.huella_ancla));
    verdadero((await validarAncla(r.ancla)).ok);
    verdadero(!(await crearAncla(registroVacioPredicciones(false), { creada_en: T(30), creada_por: A })).ok, "no ancla un registro vacío");
  });
  prueba("CSI 2 · anclas modificadas y registros cambiados después de anclar se detectan", async () => {
    const doc = await registroCon(2);
    const { ancla } = await crearAncla(doc, { creada_en: T(30), creada_por: A });
    const a2 = clon(ancla); a2.entradas[0].huella = "0".repeat(64);
    verdadero(tiene((await validarAncla(a2)).errores, /se modificó/));
    const d2 = clon(doc); d2.entradas[0].contenido.hipotesis_original = "Baja";
    const v = await verificarContraAncla(d2, ancla, resumirPredicciones(d2));
    verdadero(!v.ok && tiene(v.problemas, /se modificó después de registrarse|cambió después de anclarse/));
    const d3 = clon(doc); d3.entradas.pop();
    verdadero(tiene((await verificarContraAncla(d3, ancla, null)).problemas, /se borró/));
    // Crecer después del ancla está bien: lo nuevo queda con hora solo declarada.
    const r = await agregarEntrada(doc, { tipo: "registro", contenido: PRED("p9", "2030-09-01T00:00:00Z"), registrado_en: T(40), registrado_por: A });
    const v2 = await verificarContraAncla(r.doc, ancla, resumirPredicciones(r.doc));
    verdadero(v2.ok); igual(v2.entradas_posteriores, 1);
    igual(v2.filas.find((f) => f.id === "p9").temporal, "declarada");
    igual(v2.filas.find((f) => f.id === "p1").temporal, "anclada_sin_acreditar");
  });
  prueba("CSI 2 · hora declarada vs acreditada: acreditar exige texto publicado con la huella; tarde no prueba nada", async () => {
    const doc = await registroCon(2);
    const { ancla } = await crearAncla(doc, { creada_en: T(30), creada_por: A });
    verdadero(tiene((await registrarAcreditacion(ancla, { tipo: "testigo", acreditado_en: "2027-01-01T00:00:00Z", prueba: "correo", autorizada_por: "diego", texto_publicado: "otra cosa" })).errores, /no contiene la huella/));
    const ok = await registrarAcreditacion(ancla, { tipo: "sello_rfc3161", acreditado_en: "2030-01-15T00:00:00Z", prueba: "ancla.tsr", autorizada_por: "diego", texto_publicado: textoPublicable(ancla) });
    verdadero(ok.ok);
    const v = await verificarContraAncla(doc, ok.ancla, resumirPredicciones(doc));
    igual(v.filas.find((f) => f.id === "p1").temporal, "acreditada_tarde", "p1 empieza 2030-01-01: acreditar el 15 es tarde");
    igual(v.filas.find((f) => f.id === "p2").temporal, "acreditada_antes_del_horizonte");
    verdadero(tiene((await registrarAcreditacion(ancla, { tipo: "commit_git", acreditado_en: "2027-01-01T00:00:00Z", prueba: "x", autorizada_por: "diego", texto_publicado: textoPublicable(ancla) })).errores, /publicacion.tipo/), "un commit no es un tipo de acreditación");
  });
  prueba("CSI 2 · predicción registrada después del resultado: el registro la rechaza aunque la hora sea declarada", async () => {
    const doc = registroVacioPredicciones(false);
    const r = await agregarEntrada(doc, { tipo: "registro", contenido: PRED("tarde", "2026-01-01T00:00:00Z"), registrado_en: "2026-02-01T00:00:00Z", registrado_por: A });
    verdadero(!r.ok && tiene(r.errores, /ANTES del acontecimiento/));
  });

  // ---------------- Nexus (bloque 8) ----------------
  prueba("CSI 2 · Nexus: la propuesta 0.2 envía fuentes con procedencia, objeciones, limitaciones, estado y refutación; decisión pendiente", async () => {
    const inv = await completa();
    const antes = JSON.stringify(inv);
    const r = prepararPropuesta(inv, "H-A", { autor: A, fecha: T(50) });
    verdadero(r.ok, r.errores?.join(" "));
    const p = r.propuesta;
    igual(p.version_contrato, "0.2");
    igual(FLUJO.slice(0, 5), ["investigacion", "hipotesis", "objecion_abogado", "revision_esceptica", "decision_humana"]);
    verdadero(p.fuentes.every((f) => f.enlace && f.clase && f.limitaciones.length));
    verdadero(p.objeciones.some((o) => o.autor.identificador === "abogado-csi"), "el Abogado objeta antes de Nexus");
    verdadero(p.limitaciones.some((l) => /retrospectivo/.test(l)));
    igual(p.condiciones_refutacion, ["Inflación a la baja documentada"]);
    igual(p.estado_validacion.decision, "pendiente");
    igual(p.borrador_leccion.validacion.estado, "propuesta");
    igual(validarLeccion(p.borrador_leccion).errores, []);
    verdadero(revisarPropuesta(p).ok);
    igual(JSON.stringify(inv), antes, "no modifica la investigación (ni escribe en ningún almacén)");
  });
  prueba("CSI 2 · Nexus: no envía datos personales, estrategias financieras privadas, inferencias como evidencia ni aprobaciones", async () => {
    let inv = await completa();
    const x = clon(inv); x.supuestos = ["Deberíamos vender francos si se confirma"];
    verdadero(tiene(prepararPropuesta(x, "H-A", { autor: A, fecha: T(50) }).errores, /estrategia financiera privada/));
    const y = clon(inv); y.hipotesis[0].enunciado = "Escribir a ana@example.org";
    verdadero(!prepararPropuesta(y, "H-A", { autor: A, fecha: T(50) }).ok);
    const p = prepararPropuesta(inv, "H-A", { autor: A, fecha: T(50) }).propuesta;
    const p1 = clon(p); p1.evidencia_primaria.push({ enunciado_id: "z", tipo: "inferencia", fuentes: [{ titulo: "x" }] });
    verdadero(tiene(revisarPropuesta(p1).problemas, /inferencia, simulación o predicción/));
    const p2 = clon(p); p2.decision_humana = { estado: "aprobada", aprobador: "nexus" }; p2.estado_validacion.decision = "aprobada";
    verdadero(tiene(revisarPropuesta(p2).problemas, /pendiente/));
    const p3 = clon(p); p3.evidencia_primaria[0].fuentes = [];
    verdadero(tiene(revisarPropuesta(p3).problemas, /sin fuente/));
  });

  // ---------------- Expediente y compatibilidad ----------------
  prueba("CSI 2 · expediente: construye con el motor (alcance antes de fuentes) y el Abogado registra objeciones firmadas por código", async () => {
    const inv = await completa();
    const pasos = inv.historial.slice(2).map(() => null); // solo para contar
    const exp = { contrato: "cauce.csi.expediente", version_contrato: "0.1",
      investigacion: { id: "hist-exp", titulo: "Exp", pregunta: "¿?", acontecimiento: { descripcion: "x", fecha: "2020-03-10" }, autor: A, fecha: T(0), actores: ["inst", "banco"], naturaleza_estudio: "historico" },
      alcance: { fecha: T(1), datos: ALCANCE },
      pasos: [{ accion: "agregar_fuente", datos: { fuente: FU("f1") }, fecha: T(2) }, { accion: "agregar_enunciado", datos: { enunciado: { id: "e1", tipo: "hecho", texto: "Subió", fuentes: ["f1"], sobre: "conducta" } }, fecha: T(3) },
        { accion: "agregar_hipotesis", datos: { hipotesis: { id: "H1", categoria: "fundamentales", enunciado: "Inflación", a_favor: ["e1"] } }, fecha: T(4) }],
      abogado: { fecha: T(5) }, pasos_finales: [{ accion: "revision", datos: { estado: "en_revision" }, fecha: T(6) }], actores: ACTORES(), escenarios: [] };
    const r = await construirDesdeExpediente(exp);
    verdadero(r.ok, r.errores.join(" | "));
    const h = r.docs.investigaciones.investigaciones[0];
    igual(h.historial[1].accion, "definir_alcance");
    verdadero(h.objeciones.length > 0 && h.objeciones.every((o) => o.autor.tipo === "codigo"));
    igual(h.revision.estado, "en_revision");
    verdadero(pasos.length > 0);
    const malo = clon(exp); malo.alcance = null;
    verdadero(!(await construirDesdeExpediente(malo)).ok, "sin alcance, el expediente histórico no se construye");
  });
  prueba("CSI 2 · cotejo: corregir un extracto conserva el anterior, queda en el historial y no rompe la cadena", async () => {
    let inv = await completa();
    const n = inv.historial.length;
    inv = await paso(inv, "cotejar_fuente", { fuente_id: "f2", resultado: "coincide", metodo: "manual", detalle: "Releído: coincide." }, 20);
    inv = await paso(inv, "cotejar_fuente", { fuente_id: "f3", resultado: "corregido", metodo: "manual", detalle: "Faltaba el final de la frase.", extracto_corregido: "Explicación posterior de la junta, con su final." }, 21);
    const f3 = inv.fuentes.find((f) => f.id === "f3");
    igual(f3.extracto, "Explicación posterior de la junta, con su final.");
    igual(f3.cotejos[0].extracto_anterior, "Explicación posterior de la junta.");
    igual(inv.historial.length, n + 2);
    igual(inv.historial.at(-1).accion, "cotejar_fuente");
    verdadero((await verificarHistorial(inv)).ok);
    igual(validarInvestigacion(inv).errores, []);
    verdadero(!(await intento(inv, "cotejar_fuente", { fuente_id: "f3", resultado: "corregido", metodo: "manual", detalle: "x", extracto_corregido: f3.extracto }, 22)).ok, "corrección idéntica");
    verdadero(!(await intento(inv, "cotejar_fuente", { fuente_id: "f2", resultado: "coincide", metodo: "manual", detalle: "x", extracto_corregido: "otro" }, 22)).ok, "extracto sin «corregido»");
    verdadero(!(await intento(inv, "cotejar_fuente", { fuente_id: "nada", resultado: "coincide", metodo: "manual", detalle: "x" }, 22)).ok, "fuente inexistente");
    verdadero(!(await intento(inv, "cotejar_fuente", { fuente_id: "f2", resultado: "seguro", metodo: "manual", detalle: "x" }, 22)).ok, "resultado inválido");
  });
  prueba("CSI 2 · cotejo: una corrección que deja sin procedencia la cita de un enunciado se rechaza; huella exige copia", async () => {
    const inv = await completa();
    const r = await intento(inv, "cotejar_fuente", { fuente_id: "f1", resultado: "corregido", metodo: "manual", detalle: "El original dice otra cosa.", extracto_corregido: "\"La junta mantuvo la tasa.\"" }, 20);
    verdadero(!r.ok && tiene(r.errores, /cita|procedencia/i), r.errores?.join(" | "));
    const retirado = await paso(inv, "retirar_enunciado", { enunciado_id: "e1", motivo: "Su cita no coincide con el original." }, 20);
    const tras = await intento(retirado, "cotejar_fuente", { fuente_id: "f1", resultado: "corregido", metodo: "manual", detalle: "El original dice otra cosa.", extracto_corregido: "\"La junta mantuvo la tasa.\"" }, 21);
    verdadero(tras.ok, "retirado el enunciado, la corrección se admite: " + tras.errores?.join(" | "));
    const sinCopia = await intento(inv, "cotejar_fuente", { fuente_id: "f2", resultado: "coincide", metodo: "copia_local", detalle: "Descargado.", huella_contenido: "a".repeat(64) }, 20);
    verdadero(!sinCopia.ok && tiene(sinCopia.errores, /copia_local/), sinCopia.errores?.join(" | "));
    const ok = await intento(inv, "cotejar_fuente", { fuente_id: "f2", resultado: "coincide", metodo: "copia_local", detalle: "Descargado.", huella_contenido: "a".repeat(64), copia_local: "copias/f2.html" }, 20);
    verdadero(ok.ok, ok.errores?.join(" | "));
    igual(ok.inv.fuentes.find((f) => f.id === "f2").metodo_consulta, "copia_local");
    const malo = clon(ok.inv); malo.fuentes[1].cotejos[0].fecha = "2020-01-01T00:00:00Z";
    verdadero(tiene(validarInvestigacion(malo).errores, /anterior a la consulta/));
  });
  prueba("CSI 2 · compatibilidad: el DEMO 0.1 sigue válido; una investigación 0.1 no acepta claves 0.2; leerCSI añade flujo y Abogado", async () => {
    const d = await construirDemoCSI();
    const inv = d.investigaciones.investigaciones[0];
    igual(inv.version_contrato, "0.1"); igual(validarInvestigacion(inv).errores, []);
    verdadero(tiene(validarInvestigacion({ ...clon(inv), naturaleza_estudio: "demo" }).errores, /naturaleza_estudio: clave desconocida/));
    const c = await leerCSI(d);
    igual(c.naturaleza, "demo");
    verdadero(c.investigaciones[0].flujo.total === 10 && c.investigaciones[0].abogado.hipotesis.length === inv.hipotesis.length);
    igual(analizarInvestigacion(inv).hipotesis.map((h) => h.estado), analizarInvestigacion(clon(inv)).hipotesis.map((h) => h.estado));
  });
}
