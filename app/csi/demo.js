// CSI · caso de demostración FICTICIO (bloque 9): «Caída abrupta de un mercado y posibles respuestas de instituciones
// y participantes». País, mercado, actores, fuentes y cifras son inventados; todo lleva [DEMO] y ficticio: true.
// Se construye con el mismo motor que usa una persona (crearInvestigacion / aplicarCambio / agregarEntrada), así el
// historial y las huellas son reales. herramientas/csi.mjs demo escribe los archivos de datos/csi/demo/.

import { VERSION_CSI } from "./base.js";
import { crearInvestigacion, aplicarCambio } from "./investigacion.js";
import { plantillaCaidaMercado } from "./simulador.js";
import { registroVacioPredicciones, agregarEntrada } from "./predicciones.js";
import { CONTRATO_ACTORES } from "./actores.js";

export const AHORA_DEMO = "2026-11-06T12:00:00-06:00";
const ANALISTA = { tipo: "humano", identificador: "analista-demo" };
const REVISORA = { tipo: "humano", identificador: "revisora-demo" };
const t = (d, h) => `2026-${d}T${h}:00-06:00`;
const F = (id, titulo, editor, tipo, publicada_en, extra = {}) => ({ id, titulo: `[DEMO] ${titulo}`, editor: `${editor} (ficticio)`, tipo, publicada_en, ficticia: true, ...extra });

export function actoresDemo() {
  const d = (id, texto) => ({ id, texto });
  return {
    contrato: CONTRATO_ACTORES, version_contrato: VERSION_CSI, es_demo: true, actualizado_en: t("10-12", "20:00"), demo: { ahora_simulado: AHORA_DEMO },
    fuentes: [
      F("ley-bc", "Ley orgánica del Banco Central de Lumen", "Diario Oficial de Lumen", "documento_oficial", "2019-03-01"),
      F("ine-inflacion", "Inflación anual septiembre: 5.1 % (meta 3 %)", "Instituto de Estadística de Lumen", "dato_estadistico", "2026-10-09"),
      F("cnv-registro", "Registro de fondos supervisados", "Comisión de Valores de Lumen", "documento_regulatorio", "2026-01-15"),
      F("torre-informe", "Informe anual: líneas de crédito a fondos", "Banco Torre", "documento_oficial", "2026-03-30"),
      F("comite-estabilidad", "Acta de creación del Comité de Estabilidad", "Ministerio de Hacienda de Lumen", "documento_oficial", "2021-06-10"),
      F("omr-miembros", "Lista de miembros", "Organismo Monetario Regional", "documento_oficial", "2025-01-01"),
      F("arce-prospecto", "Prospecto del fondo: rescates diarios", "Arce Capital", "documento_oficial", "2025-08-01", { autor_actor_id: "fondo-arce" }),
    ],
    actores: [
      { id: "bc-lumen", nombre: "Banco Central de Lumen", tipo: "banco_central", ficticio: true, objetivos_documentados: [{ texto: "Estabilidad de precios y del sistema de pagos", fuentes: ["ley-bc"] }], incentivos_hipoteticos: [{ texto: "Evitar contagio al sistema de pagos sin comprometer la meta de inflación", basado_en: ["mandato", "inflación sobre meta"] }], recursos_conocidos: [{ texto: "Facilidades de liquidez para bancos", fuentes: ["ley-bc"] }], restricciones: [{ texto: "Inflación 5.1 % sobre meta 3 %: un recorte de tasa contradice el mandato", fuentes: ["ine-inflacion"], impide: ["recorte_tasa"] }], decisiones_posibles: [d("facilidad_liquidez", "Abrir una facilidad de liquidez temporal"), d("recorte_tasa", "Recortar la tasa de referencia"), d("comunicado", "Emitir solo un comunicado")], incertidumbres: ["No se conoce su evaluación interna del riesgo sistémico."] },
      { id: "hacienda-lumen", nombre: "Ministerio de Hacienda de Lumen", tipo: "gobierno", ficticio: true, objetivos_documentados: [{ texto: "Coordinar el Comité de Estabilidad Financiera", fuentes: ["comite-estabilidad"] }], incentivos_hipoteticos: [{ texto: "Evitar costo fiscal de un rescate" }], recursos_conocidos: [], restricciones: [{ texto: "Un rescate requiere aprobación legislativa (supuesto no verificado)" }], decisiones_posibles: [d("garantia", "Anunciar garantías"), d("nada", "No intervenir")], incertidumbres: ["Margen fiscal real desconocido."] },
      { id: "cnv-lumen", nombre: "Comisión de Valores de Lumen", tipo: "gobierno", ficticio: true, objetivos_documentados: [{ texto: "Supervisar a los fondos registrados", fuentes: ["cnv-registro"] }], incentivos_hipoteticos: [{ texto: "Mostrar vigilancia tras una caída pública" }], recursos_conocidos: [{ texto: "Acceso a registros de órdenes", fuentes: ["cnv-registro"] }], restricciones: [], decisiones_posibles: [d("abrir_investigacion", "Abrir una investigación"), d("revisar", "Revisión rutinaria sin anuncio")], incertidumbres: [] },
      { id: "fondo-arce", nombre: "Arce Capital (fondo)", tipo: "fondo_inversion", ficticio: true, objetivos_documentados: [{ texto: "Ofrecer rescates diarios a sus clientes", fuentes: ["arce-prospecto"] }], incentivos_hipoteticos: [{ texto: "Cubrir rescates vendiendo lo más líquido" }, { texto: "Comprar barato si tiene liquidez (oportunismo)" }], recursos_conocidos: [{ texto: "Línea de crédito con Banco Torre", fuentes: ["torre-informe"] }], restricciones: [{ texto: "Rescates diarios obligan a tener liquidez", fuentes: ["arce-prospecto"] }], decisiones_posibles: [d("vender", "Vender posiciones líquidas"), d("comprar_en_bloque", "Comprar en bloque tras la caída"), d("mantener", "Mantener posiciones")], incertidumbres: ["Tamaño real de los rescates."] },
      { id: "banco-torre", nombre: "Banco Torre", tipo: "institucion_financiera", ficticio: true, objetivos_documentados: [], incentivos_hipoteticos: [{ texto: "Reducir exposición a fondos apalancados" }], recursos_conocidos: [{ texto: "Líneas de crédito a fondos", fuentes: ["torre-informe"] }], restricciones: [], decisiones_posibles: [d("ampliar_margen", "Pedir más garantía"), d("mantener", "Mantener condiciones")], incertidumbres: [] },
      { id: "minoristas", nombre: "Inversionistas minoristas de Lumen", tipo: "participante_colectivo", ficticio: true, objetivos_documentados: [], incentivos_hipoteticos: [{ texto: "Evitar más pérdidas (aversión a la pérdida)" }], recursos_conocidos: [], restricciones: [], decisiones_posibles: [d("vender_panico", "Vender por miedo"), d("mantener", "Esperar"), d("comprar", "Comprar en la baja")], incertidumbres: ["No hay datos por tipo de inversionista del día."] },
      { id: "omr", nombre: "Organismo Monetario Regional", tipo: "organismo_internacional", ficticio: true, objetivos_documentados: [], incentivos_hipoteticos: [{ texto: "Evitar contagio regional" }], recursos_conocidos: [], restricciones: [], decisiones_posibles: [d("linea_swap", "Ofrecer línea de intercambio"), d("declaracion", "Declaración de apoyo")], incertidumbres: [] },
    ],
    relaciones: [
      { id: "r1", de: "cnv-lumen", a: "fondo-arce", tipo: "regula", descripcion: "Arce está registrado ante la Comisión", fuentes: ["cnv-registro"] },
      { id: "r2", de: "banco-torre", a: "fondo-arce", tipo: "financia", descripcion: "Línea de crédito", fuentes: ["torre-informe"] },
      { id: "r3", de: "hacienda-lumen", a: "bc-lumen", tipo: "coopera", descripcion: "Comité de Estabilidad Financiera", fuentes: ["comite-estabilidad"] },
      { id: "r4", de: "bc-lumen", a: "omr", tipo: "miembro_de", descripcion: "Miembro del organismo regional", fuentes: ["omr-miembros"] },
      { id: "r5", de: "fondo-arce", a: "banco-torre", tipo: "compite", descripcion: "[DEMO] Se dice que compiten en gestión de activos (rumor sin fuente)", fuentes: [] },
    ],
  };
}

/** Construye todo el caso: actores, investigación (con historial real), escenario y memoria de predicciones. */
export async function construirDemoCSI() {
  const actores = actoresDemo();
  const paso = async (inv, accion, datos, fecha, autor = ANALISTA) => {
    const r = await aplicarCambio(inv, { accion, datos }, { autor, fecha });
    if (!r.ok) throw new Error(`demo CSI (${accion}): ${r.errores.join(" | ")}`);
    return r.inv;
  };
  const c = await crearInvestigacion({
    id: "demo-caida-lumen", titulo: "[DEMO] Caída abrupta del Índice Lumen 40", pregunta: "[DEMO] ¿Qué opciones estratégicas tenían instituciones y participantes tras la caída, y qué explica mejor la caída?",
    acontecimiento: { descripcion: "[DEMO] El Índice Lumen 40 cae 9 % en una sesión", fecha: "2026-10-12", mercado: "Bolsa de Lumen (ficticia)" },
    autor: ANALISTA, fecha: t("10-12", "20:00"), es_demo: true, actores: ["bc-lumen", "fondo-arce", "banco-torre", "cnv-lumen", "minoristas"],
  });
  if (!c.ok) throw new Error(c.errores.join(" | "));
  let inv = c.inv;
  const fuentes = [
    F("bolsa-cierre", "Boletín de cierre del 12 de octubre", "Bolsa de Lumen", "dato_estadistico", t("10-12", "15:30")),
    F("bc-comunicado", "Comunicado: «usaremos todos los instrumentos a nuestro alcance»", "Banco Central de Lumen", "declaracion_publica", t("10-12", "19:00"), { autor_actor_id: "bc-lumen" }),
    F("arce-carta", "Carta a clientes: rescates por encima de lo usual", "Arce Capital", "declaracion_publica", t("10-12", "18:00"), { autor_actor_id: "fondo-arce" }),
    F("ine-inflacion", "Inflación anual septiembre: 5.1 % (meta 3 %)", "Instituto de Estadística de Lumen", "dato_estadistico", "2026-10-09"),
    F("calendario", "Calendario oficial de publicaciones", "Instituto de Estadística de Lumen", "documento_oficial", "2026-10-01"),
    F("diario-volumen", "Nota: «volumen del doble del promedio»", "Diario Lumen", "prensa", t("10-12", "17:00")),
    F("cnv-tenencias", "Reporte de tenencias de fondos al 14 de octubre", "Comisión de Valores de Lumen", "documento_regulatorio", t("10-16", "10:00")),
  ];
  for (const [i, f] of fuentes.entries()) inv = await paso(inv, "agregar_fuente", { fuente: f }, t("10-12", `20:${String(5 + i).padStart(2, "0")}`));
  const E = (id, tipo, texto, fs, extra = {}) => ({ enunciado: { id, tipo, texto: `[DEMO] ${texto}`, fuentes: fs, ...extra } });
  inv = await paso(inv, "agregar_enunciado", E("h1", "hecho", "El índice cayó 9 % en la sesión del 12 de octubre.", ["bolsa-cierre"], { sobre: "dato" }), t("10-12", "21:00"));
  inv = await paso(inv, "agregar_enunciado", E("h2", "hecho", "El volumen fue cuatro veces el promedio de 20 sesiones.", ["bolsa-cierre"], { sobre: "dato" }), t("10-12", "21:05"));
  inv = await paso(inv, "agregar_enunciado", E("h5", "hecho", "El diferencial de compra-venta se triplicó al cierre.", ["bolsa-cierre"], { sobre: "conducta" }), t("10-12", "21:10"));
  inv = await paso(inv, "agregar_enunciado", E("h4", "hecho", "La inflación anual (5.1 %) está sobre la meta (3 %).", ["ine-inflacion"], { sobre: "dato" }), t("10-12", "21:15"));
  inv = await paso(inv, "agregar_enunciado", E("h6", "hecho", "No hubo publicaciones macroeconómicas oficiales del 9 al 12 de octubre.", ["calendario"], { sobre: "contexto" }), t("10-12", "21:20"));
  inv = await paso(inv, "agregar_enunciado", E("d1", "declaracion", "El Banco Central declaró que usará «todos los instrumentos a su alcance» (es lo que dijo, no prueba lo que hará).", ["bc-comunicado"], { sobre: "intencion", actor_id: "bc-lumen" }), t("10-12", "21:25"));
  inv = await paso(inv, "agregar_enunciado", E("d2", "declaracion", "Arce Capital dice haber recibido rescates por encima de lo usual.", ["arce-carta"], { sobre: "conducta", actor_id: "fondo-arce" }), t("10-12", "21:30"));
  inv = await paso(inv, "agregar_enunciado", E("p8", "hecho", "Un diario reporta volumen del doble del promedio (contradice el boletín).", ["diario-volumen"], { sobre: "dato", contradice: ["h2"] }), t("10-12", "21:35"));
  inv = await paso(inv, "agregar_enunciado", E("i1", "inferencia", "El Banco Central tendría incentivo a dar liquidez sin recortar la tasa, por la inflación.", [], { actor_id: "bc-lumen", sobre: "intencion", inferido_de: ["d1", "h4"] }), t("10-12", "21:40"));
  inv = await paso(inv, "agregar_enunciado", E("i2", "inferencia", "Arce podría querer comprar barato después (intención NO documentada: solo inferencia).", [], { actor_id: "fondo-arce", sobre: "intencion", inferido_de: ["d2"] }), t("10-12", "21:45"));
  inv = await paso(inv, "agregar_incentivo", { incentivo: { id: "inc-bc", actor_id: "bc-lumen", texto: "[DEMO] Contener el contagio sin comprometer la meta de inflación.", basado_en: ["d1", "h4"] } }, t("10-12", "21:50"));
  inv = await paso(inv, "agregar_incentivo", { incentivo: { id: "inc-arce", actor_id: "fondo-arce", texto: "[DEMO] Conseguir liquidez para pagar rescates.", basado_en: ["d2"] } }, t("10-12", "21:55"));
  const H = (id, categoria, enunciado, a_favor, en_contra, condiciones_refutacion, datos_faltantes, supuestos = []) => ({ hipotesis: { id, categoria, enunciado: `[DEMO] ${enunciado}`, a_favor, en_contra, condiciones_refutacion, datos_faltantes, supuestos } });
  inv = await paso(inv, "agregar_hipotesis", H("H-A", "fundamentales", "La caída refleja un cambio de fundamentales.", [], ["h6"], ["Aparece una noticia fundamental en la ventana"], ["Revisión de utilidades del sector"]), t("10-13", "08:00"));
  inv = await paso(inv, "agregar_hipotesis", H("H-B", "liquidez", "La caída se explica por ventas forzadas para pagar rescates.", ["h2", "h5", "d2"], [], ["Los datos oficiales de flujos muestran entradas netas el 12 de octubre"], ["Flujos de fondos del día"], ["Los rescates de Arce son representativos de otros fondos"]), t("10-13", "08:05"));
  inv = await paso(inv, "agregar_hipotesis", H("H-C", "oportunista", "Grandes participantes compraron en la baja de forma oportunista.", [], [], ["Los reportes de tenencias no muestran compras en bloque"], ["Reportes de tenencias"]), t("10-13", "08:10"));
  inv = await paso(inv, "agregar_hipotesis", H("H-D", "manipulacion", "Posible manipulación del precio (solo hipótesis).", [], [], ["El regulador revisa y no encuentra irregularidades"], ["Registros de órdenes (solo los tiene el regulador)", "Comunicados del regulador"]), t("10-13", "08:15"));
  inv = await paso(inv, "editar", { campo: "supuestos", valor: ["[DEMO] El boletín de la bolsa es más confiable que la prensa para el volumen."] }, t("10-13", "08:20"));
  inv = await paso(inv, "editar", { campo: "incertidumbre", valor: { nivel: "alta", descripcion: "[DEMO] Faltan flujos por día y registros de órdenes; hay dos cifras de volumen." } }, t("10-13", "08:25"));
  inv = await paso(inv, "agregar_escenario", { escenario_id: "esc-caida-lumen" }, t("10-13", "08:30"));
  inv = await paso(inv, "agregar_enunciado", E("s1", "simulacion", "En la simulación, si el BC abre liquidez, Arce vende menos (no es un resultado real).", [], { escenario_id: "esc-caida-lumen" }), t("10-13", "08:35"));
  inv = await paso(inv, "agregar_enunciado", E("pr1", "prediccion", "El BC anunciará una facilidad de liquidez antes del 20 de octubre.", [], { prediccion_id: "pred-bc-facilidad", actor_id: "bc-lumen" }), t("10-13", "08:40"));
  inv = await paso(inv, "agregar_objecion", { objecion: { id: "o1", hipotesis_id: "H-B", tipo: "sesgo", texto: "[DEMO] La carta de Arce es autointeresada: puede exagerar rescates para justificar pérdidas." } }, t("10-13", "09:30"), REVISORA);
  inv = await paso(inv, "agregar_objecion", { objecion: { id: "o2", hipotesis_id: "H-B", tipo: "explicacion_alternativa", texto: "[DEMO] Las ventas pudieron ser coberturas voluntarias, no forzadas." } }, t("10-13", "09:35"), REVISORA);
  inv = await paso(inv, "agregar_objecion", { objecion: { id: "o3", hipotesis_id: "H-D", tipo: "dato_faltante", texto: "[DEMO] Sin registros de órdenes no se puede evaluar manipulación: no debe presentarse como explicación." } }, t("10-13", "09:40"), REVISORA);
  inv = await paso(inv, "agregar_enunciado", E("h7", "hecho", "El reporte de tenencias muestra que Arce REDUJO su posición y no hubo compras en bloque reportadas.", ["cnv-tenencias"], { sobre: "conducta", actor_id: "fondo-arce" }), t("10-16", "12:00"));
  inv = await paso(inv, "vincular_evidencia", { hipotesis_id: "H-B", enunciado_id: "h7", sentido: "a_favor" }, t("10-16", "12:05"));
  inv = await paso(inv, "vincular_evidencia", { hipotesis_id: "H-C", enunciado_id: "h7", sentido: "en_contra" }, t("10-16", "12:10"));
  inv = await paso(inv, "responder_objecion", { objecion_id: "o2", respuesta: "[DEMO] El reporte de tenencias (h7) muestra reducción de posición coincidente con los rescates declarados." }, t("10-16", "12:15"));
  inv = await paso(inv, "revision", { estado: "revisada", nota: "[DEMO] Separación de hechos e inferencias correcta." }, t("10-18", "10:00"), REVISORA);
  // Un cambio posterior a la revisión la devuelve a «en_revision» (la revisión era de otro texto).
  inv = await paso(inv, "agregar_objecion", { objecion: { id: "o4", hipotesis_id: null, tipo: "sesgo", texto: "[DEMO] Riesgo de narrativa: una sola caída no permite generalizar sobre cómo actúa el Banco Central." } }, t("10-22", "09:00"), REVISORA);

  // Escenario (simulación) a partir de la plantilla A–D, con señales enlazadas a lo registrado.
  const esc = plantillaCaidaMercado({ id: "esc-caida-lumen", investigacion_id: inv.id, mercado: "Índice Lumen 40 (ficticio)", autor: ANALISTA, fecha: t("10-13", "08:30"), es_demo: true });
  esc.titulo = `[DEMO] ${esc.titulo}`;
  const ex = Object.fromEntries(esc.explicaciones.map((x) => [x.clave, x]));
  ex.A.senales_en_contra[0].enunciado_id = "h6";
  ex.B.senales_a_favor[0].enunciado_id = "d2"; ex.B.senales_a_favor[1].enunciado_id = "h5";
  ex.C.senales_en_contra[0].enunciado_id = "h7";
  ex.A.hipotesis_id = "H-A"; ex.B.hipotesis_id = "H-B"; ex.C.hipotesis_id = "H-C"; ex.D.hipotesis_id = "H-D";
  const N = (id, padre, actor_id, decision_id, beneficios, costos, consecuencias, extra = {}) => ({ id, padre, actor_id, decision_id, beneficios, costos, restricciones: [], consecuencias, ...extra });
  esc.arbol.nodos = [
    N("n1", null, "bc-lumen", "facilidad_liquidez", ["Reduce ventas forzadas (hipotético)"], ["Riesgo moral"], ["Diferenciales podrían estrecharse (simulado)"], { explicacion_id: "B" }),
    N("n1a", "n1", "fondo-arce", "mantener", ["Evita vender en la baja"], ["Usa la línea de crédito"], ["Menos presión de venta (simulado)"]),
    N("n1b", "n1", "minoristas", "mantener", ["Evitan realizar pérdidas"], ["Siguen expuestos"], ["Rebote posible, no asegurado"]),
    N("n2", null, "bc-lumen", "recorte_tasa", ["Señal fuerte"], ["Contradice el mandato con inflación sobre meta"], ["—"]),
    N("n2a", "n2", "banco-torre", "mantener", ["Sin cambio"], ["—"], ["—"]),
    N("n3", null, "bc-lumen", "comunicado", ["Sin costo"], ["Puede no bastar"], ["Las ventas forzadas siguen (simulado)"]),
    N("n3a", "n3", "fondo-arce", "vender", ["Paga rescates"], ["Vende con descuento"], ["Más caída (simulado)"], { explicacion_id: "B" }),
    N("n3a1", "n3a", "banco-torre", "ampliar_margen", ["Reduce su exposición"], ["Acelera ventas del fondo"], ["Espiral de liquidez (simulado)"]),
    N("n3b", "n3", "fondo-arce", "comprar_en_bloque", ["Compra barato"], ["Necesita liquidez que quizá no tiene"], ["Contradicho por h7 en esta investigación"], { explicacion_id: "C" }),
    N("n3c", "n3", "cnv-lumen", "abrir_investigacion", ["Muestra vigilancia"], ["Costo reputacional si no halla nada"], ["Solo así se obtendrían datos para D"], { explicacion_id: "D" }),
  ];

  // Memoria de predicciones: registradas ANTES del horizonte; evaluadas después con evidencia posterior.
  let pred = registroVacioPredicciones(true);
  pred.demo = { ahora_simulado: AHORA_DEMO };
  const reg = async (tipo, contenido, registrado_en, por = ANALISTA) => { const r = await agregarEntrada(pred, { tipo, contenido, registrado_en, registrado_por: por }); if (!r.ok) throw new Error(`demo CSI predicción: ${r.errores.join(" | ")}`); pred = r.doc; };
  const fuentesHoy = [{ titulo: "[DEMO] Comunicado del Banco Central", publicada_en: t("10-12", "19:00"), ficticia: true }, { titulo: "[DEMO] Boletín de cierre", publicada_en: t("10-12", "15:30"), ficticia: true }];
  const P = (id, hipotesis_id, texto, observable, desde, hasta, criterios, referencia, supuestos = []) => ({ id, investigacion_id: inv.id, hipotesis_id, hipotesis_original: `[DEMO] ${texto}`, resultado_observable: observable, horizonte: { desde, hasta }, criterios, fuentes_conocidas: fuentesHoy, supuestos, version_reglas: "csi-reglas 0.1 (manual, sin IA)", referencia });
  await reg("registro", P("pred-bc-facilidad", "H-B", "El Banco Central anunciará una facilidad de liquidez antes del 20 de octubre.", "Comunicado oficial que anuncie una facilidad nueva", t("10-13", "10:00"), t("10-20", "23:59"),
    { acertada: "Se anuncia una facilidad nueva en el horizonte", fallida: "No se anuncia ninguna facilidad nueva en el horizonte", indeterminada: "Se anuncia algo ambiguo que no es claramente una facilidad" },
    { descripcion: "Sin cambio: el Banco Central no anuncia medidas nuevas", resultado_esperado: "No hay facilidad nueva" }, ["El comunicado del 12 de octubre anticipa acción"]), t("10-13", "09:00"));
  await reg("registro", P("pred-rebote", "H-B", "El índice cerrará el 27 de octubre por encima del mínimo del 12 de octubre.", "Cierre oficial del 27 de octubre vs mínimo del 12", t("10-13", "10:00"), t("10-27", "15:00"),
    { acertada: "Cierre del 27 > mínimo del 12", fallida: "Cierre del 27 ≤ mínimo del 12", indeterminada: "No hay cierre oficial publicado" },
    { descripcion: "Referencia simple: tras una caída grande, el índice suele quedar por encima del mínimo", resultado_esperado: "Cierre del 27 > mínimo del 12" }), t("10-13", "09:05"));
  await reg("registro", P("pred-flujos", "H-B", "Los datos oficiales de flujos mostrarán salidas netas de fondos el 12 de octubre.", "Estadística oficial de flujos por día", t("10-13", "10:00"), t("10-31", "23:59"),
    { acertada: "Salidas netas el 12", fallida: "Entradas netas el 12", indeterminada: "Los datos no permiten aislar el día" },
    { descripcion: "Sin cambio: flujos cercanos a cero", resultado_esperado: "Flujos sin salida neta relevante" }), t("10-13", "09:10"));
  await reg("registro", P("pred-regulador", "H-D", "La Comisión NO publicará una investigación por manipulación antes del 5 de noviembre.", "Comunicado de la Comisión de Valores", t("10-14", "00:00"), t("11-05", "23:59"),
    { acertada: "Ningún comunicado de investigación en el horizonte", fallida: "Se publica una investigación", indeterminada: "Comunicado ambiguo" },
    { descripcion: "Sin cambio: la Comisión no anuncia investigaciones", resultado_esperado: "Ningún comunicado" }), t("10-13", "09:15"));
  await reg("evaluacion", { prediccion_id: "pred-bc-facilidad", resultado: "fallida", resultado_referencia: "acertada", evidencia: [{ titulo: "[DEMO] Comunicados del BC del 13 al 20 de octubre: solo declaraciones, sin facilidad nueva", publicada_en: t("10-21", "08:00"), ficticia: true }], nota: "[DEMO] Predicción equivocada: se conserva y cuenta como fallo." }, t("10-21", "09:00"), REVISORA);
  // Intento de corregir DESPUÉS del resultado: se guarda como versión 2, marcada posterior, y no cuenta.
  await reg("correccion", { prediccion_id: "pred-bc-facilidad", motivo: "[DEMO] «Quise decir 30 días» (corrección posterior al resultado: no cuenta)", prediccion: { ...P("pred-bc-facilidad", "H-B", "El Banco Central anunciará una facilidad de liquidez antes del 12 de noviembre.", "Comunicado oficial que anuncie una facilidad nueva", t("10-13", "10:00"), t("11-12", "23:59"),
    { acertada: "Se anuncia una facilidad nueva", fallida: "No se anuncia", indeterminada: "Ambiguo" }, { descripcion: "Sin cambio", resultado_esperado: "No hay facilidad nueva" }), fuentes_conocidas: fuentesHoy } }, t("10-21", "12:00"));
  await reg("evaluacion", { prediccion_id: "pred-rebote", resultado: "acertada", resultado_referencia: "acertada", evidencia: [{ titulo: "[DEMO] Boletín de cierre del 27 de octubre", publicada_en: t("10-27", "15:30"), ficticia: true }], nota: "[DEMO] Acertó, igual que la referencia simple: no muestra ventaja ni prueba que la causa fuera la liquidez." }, t("10-28", "09:00"), REVISORA);
  await reg("evaluacion", { prediccion_id: "pred-flujos", resultado: "indeterminada", resultado_referencia: "indeterminada", evidencia: [{ titulo: "[DEMO] Estadística de flujos de octubre (solo mensual)", publicada_en: t("11-01", "10:00"), ficticia: true }], nota: "[DEMO] Solo hay datos mensuales: no permiten aislar el 12 de octubre." }, t("11-02", "09:00"), REVISORA);
  await reg("registro", P("pred-tasa-nov", "H-A", "El Banco Central mantendrá la tasa en la reunión del 20 de noviembre.", "Decisión publicada el 20 de noviembre", t("11-10", "00:00"), t("11-20", "23:59"),
    { acertada: "Tasa sin cambio", fallida: "Tasa cambia", indeterminada: "Reunión pospuesta" },
    { descripcion: "Sin cambio: la tasa sigue igual", resultado_esperado: "Tasa sin cambio" }), t("11-03", "10:00"));
  // pred-regulador venció el 5 de noviembre y nadie la evaluó: queda «sin evaluar» (no desaparece).

  const investigaciones = { contrato: "cauce.csi.investigaciones", version_contrato: VERSION_CSI, es_demo: true, demo: { ahora_simulado: AHORA_DEMO }, investigaciones: [inv] };
  const escenarios = { contrato: "cauce.csi.escenarios", version_contrato: VERSION_CSI, es_demo: true, escenarios: [esc] };
  return { actores, investigaciones, escenarios, predicciones: pred };
}
