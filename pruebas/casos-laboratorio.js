// Laboratorio de IA · fase 1: contratos cauce.lab.* 0.1, verificador determinista lab-V 0.1, registro auditable y
// banco de errores sembrados. Respuestas de IA SINTÉTICAS y fuentes controladas (marcadas [DEMO]); ningún modelo.
// Corre en Node y en pruebas.html.

import { prueba, igual, verdadero } from "./mini.js";
import { validarEncargo, validarEjecucion, validarVerificacion } from "../app/laboratorio/contratos.js";
import { verificar, verificarYValidar, huellaDoc, catalogoDesdeInvestigacion, fechasMencionadas } from "../app/laboratorio/verificador.js";
import { nuevaEntrada, serializar, verificarRegistro, indicesDesdeEntradas } from "../app/laboratorio/registro.js";
import { construirBanco, comprobarBanco } from "../app/laboratorio/banco.js";
import { sha256Bytes, normalizarEspacios, jsonCanonico, sha256 } from "../app/laboratorio/base.js";
import { construirDesdeExpediente } from "../app/csi/expediente.js";

const AHORA = "2030-04-01T12:00:00Z";
const clon = (v) => JSON.parse(JSON.stringify(v));
const tiene = (lista, re) => lista.some((t) => re.test(typeof t === "string" ? t : `${t.codigo} ${t.detalle ?? ""}`));
const bytes = (t) => new TextEncoder().encode(t);

// ---------------- fuentes controladas (ficticias) ----------------
const TEXTOS = {
  "demo-f-a": "[DEMO] Comunicado del Instituto Ficticio, 10 de marzo de 2030.\nEl Instituto mantendrá la tasa de referencia en 4.00 % durante el trimestre.\nEs falso que el Instituto vaya a abandonar su meta de inflación del 3 %.",
  "demo-f-b": "[DEMO] Nota ficticia del 20 de marzo de 2030. El Instituto sorprendió al mercado y subió la tasa de referencia a 4.50 % sin aviso previo.",
  "demo-f-c": "[DEMO] Boletín ficticio sin fecha. Los analistas consultados esperaban que la tasa se mantuviera estable durante varios meses.",
  "demo-f-p": "",
};
const FECHAS = { "demo-f-a": "2030-03-10", "demo-f-b": "2030-03-20", "demo-f-c": null, "demo-f-p": "2030-03-01" };

async function mundo() {
  const fuentes = [], copias = new Map();
  for (const [id, t] of Object.entries(TEXTOS)) {
    const pend = id === "demo-f-p";
    fuentes.push({ fuente_id: id, estado: pend ? "pendiente" : "consultada", origen: "primaria", sha256: pend ? null : await sha256Bytes(bytes(t)), texto_sha256: pend ? null : await sha256(t), publicada_en: FECHAS[id], conocida_en: null });
    if (!pend) copias.set(id, { bytes: bytes(t), texto: t });
  }
  const encargo = {
    contrato: "cauce.lab.encargo", version_contrato: "0.1", id: "demo-lab-enc-001", es_demo: true, rol: "critico",
    pregunta: "[DEMO] ¿Qué afirmaciones del informe ficticio están respaldadas por las fuentes disponibles antes del 15-mar-2030?",
    insumos: [{ tipo: "csi_investigacion", ref: "demo-inv-instituto", sha256: "a".repeat(64) }],
    fuentes_permitidas: fuentes,
    corte_temporal: { conocido_antes_de: "2030-03-15T00:00:00Z" },
    herramientas: { red: "ninguna", dominios_permitidos: [], ejecutar_comandos: false },
    limites: { max_minutos: 10, max_tokens_salida: 8000, max_consultas_web: 0 },
    modelo_solicitado: { adaptador: "ninguno", nombre: "respuesta sintética de prueba" },
    creado_por: { tipo: "humano", identificador: "diego" }, creado_en: "2030-03-31T10:00:00Z",
  };
  const ejecucion = {
    contrato: "cauce.lab.ejecucion", version_contrato: "0.1", id: "demo-lab-run-001", es_demo: true,
    encargo_id: "demo-lab-enc-001", encargo_sha256: await huellaDoc(encargo), rol: "critico", estado: "terminado",
    inicio: "2030-03-31T10:05:00Z", fin: "2030-03-31T10:09:00Z", latido: "2030-03-31T10:09:00Z",
    autor: { tipo: "ia", identificador: "sintetico-v0", adaptador: "ninguno" },
    afirmaciones: [{ id: "a1", texto: "El Instituto anunció que mantendría la tasa en 4.00 % durante el trimestre.", clase: "hecho_citado",
      citas: [{ fuente_id: "demo-f-a", extracto: "El Instituto mantendrá la tasa de referencia en 4.00 % durante el trimestre.", ubicacion: "párrafo 2" }] }],
    hipotesis: [], objeciones: [], dudas: [], contradicciones: [], consultas_web: [],
    uso: { tokens_entrada: null, tokens_salida: null, costo_mxn: 0 }, error: null,
  };
  return { encargo, ejecucion, copias };
}
/** Re-firma la ejecución tras cambiar el encargo (para probar una sola cosa a la vez). */
const firmar = async (m) => { m.ejecucion.encargo_sha256 = await huellaDoc(m.encargo); return m; };
const conAfirmaciones = async (afs) => { const m = await mundo(); m.ejecucion.afirmaciones = afs; return m; };
const cita = (fuente_id, extracto) => ({ fuente_id, extracto, ubicacion: null });
const af = (id, texto, clase, citas = []) => ({ id, texto, clase, citas });
async function ver(m, extra = {}) {
  const r = await verificarYValidar({ ...m, ahora: AHORA, ...extra });
  verdadero(r.salida_valida, `la salida de lab-V debe cumplir su contrato: ${r.errores_salida.join(" | ")}`);
  return r.verificacion;
}

export function registrarCasosLaboratorio(leerTexto) {
  // ================================================================ contratos
  prueba("Laboratorio · contratos: encargo y ejecución sintéticos válidos; versión, contrato o clave desconocida se rechazan", async () => {
    const m = await mundo();
    igual(validarEncargo(m.encargo).errores, [], "encargo");
    igual(validarEjecucion(m.ejecucion).errores, [], "ejecución");
    const e1 = clon(m.encargo); e1.version_contrato = "0.2";
    verdadero(tiene(validarEncargo(e1).errores, /version_contrato debe ser «0.1»/), "versión");
    const e2 = clon(m.encargo); e2.contrato = "cauce.lab.otro";
    verdadero(tiene(validarEncargo(e2).errores, /contrato debe ser/), "contrato");
    const e3 = clon(m.encargo); e3.memoria = ["lo que dije la semana pasada"];
    verdadero(tiene(validarEncargo(e3).errores, /memoria: clave desconocida/), "clave desconocida");
  });

  prueba("Laboratorio · contratos: identificadores con prefijo por tipo y mundo (demo- solo en DEMO)", async () => {
    const m = await mundo();
    for (const [id, demo] of [["lab-enc-001", true], ["demo-lab-enc-001", false], ["demo-lab-run-001", true], ["demo-lab-enc-ÑÑ", true]]) {
      const e = clon(m.encargo); e.id = id; e.es_demo = demo;
      verdadero(!validarEncargo(e).ok, `${id} con es_demo=${demo} debe rechazarse`);
    }
    const ok = clon(m.encargo); ok.id = "lab-enc-2030-001"; ok.es_demo = false;
    verdadero(!tiene(validarEncargo(ok).errores, /id «/), "un id REAL bien formado no falla por el id");
  });

  prueba("Laboratorio · contratos: roles separados; el investigador no recibe salidas de otros roles y el banco es solo del crítico", async () => {
    const m = await mundo();
    const e = clon(m.encargo); e.rol = "juez";
    verdadero(tiene(validarEncargo(e).errores, /rol «juez» inválido/), "rol inválido");
    const i = clon(m.encargo); i.rol = "investigador"; i.insumos.push({ tipo: "lab_ejecucion_verificada", ref: "demo-lab-run-000", sha256: "b".repeat(64) });
    verdadero(tiene(validarEncargo(i).errores, /investigador trabaja solo con fuentes primarias/), "investigador con salida de IA");
    const b = clon(m.encargo); b.rol = "analista"; b.insumos.push({ tipo: "banco_evaluacion", ref: "banco-x", sha256: "c".repeat(64) });
    verdadero(tiene(validarEncargo(b).errores, /banco de evaluación es solo para el crítico/), "banco solo crítico");
  });

  prueba("Laboratorio · contratos: autoencargo de IA, comandos y red indebida se rechazan", async () => {
    const m = await mundo();
    const a = clon(m.encargo); a.creado_por = { tipo: "ia", identificador: "sintetico-v0" };
    verdadero(tiene(validarEncargo(a).errores, /una IA no se encarga trabajo a sí misma/), "autoencargo");
    const c = clon(m.encargo); c.herramientas.ejecutar_comandos = true;
    verdadero(tiene(validarEncargo(c).errores, /nunca ejecuta comandos/), "comandos");
    const r = clon(m.encargo); r.herramientas = { red: "lectura_publica", dominios_permitidos: ["snb.ch"], ejecutar_comandos: false }; r.limites.max_consultas_web = 5;
    verdadero(tiene(validarEncargo(r).errores, /solo el investigador puede consultar/), "red para el crítico");
  });

  prueba("Laboratorio · contratos: una salida de IA no entra como fuente, investigación ni copia; no hay origen «ia»", async () => {
    const m = await mundo();
    const f = clon(m.encargo); f.fuentes_permitidas.push({ fuente_id: "demo-lab-run-000", estado: "consultada", origen: "primaria", sha256: "d".repeat(64), texto_sha256: null, publicada_en: null, conocida_en: null });
    verdadero(tiene(validarEncargo(f).errores, /no es una fuente independiente/), "lab-run como fuente permitida");
    const o = clon(m.encargo); o.fuentes_permitidas[0].origen = "ia";
    verdadero(tiene(validarEncargo(o).errores, /una IA no es origen de fuentes/), "origen ia");
    const i = clon(m.encargo); i.insumos.push({ tipo: "copia_fuente", ref: "demo-lab-run-000", sha256: "e".repeat(64) });
    verdadero(tiene(validarEncargo(i).errores, /no puede entrar como «copia_fuente»/), "lab-run como copia");
  });

  prueba("Laboratorio · contratos: datos privados en el encargo o en la salida se rechazan", async () => {
    const m = await mundo();
    const e = clon(m.encargo); e.pregunta = "Escribe a alguien@ejemplo.com con el resultado";
    verdadero(tiene(validarEncargo(e).errores, /correo electrónico/), "correo en el encargo");
    const x = clon(m.ejecucion); x.dudas = ["token=abcd1234efgh"];
    verdadero(tiene(validarEjecucion(x).errores, /credencial/), "credencial en la salida");
  });

  prueba("Laboratorio · contratos: la salida de una IA no puede presentarse como humana ni traer su propia aprobación", async () => {
    const m = await mundo();
    const h = clon(m.ejecucion); h.autor.tipo = "humano";
    verdadero(tiene(validarEjecucion(h).errores, /no puede presentarse como humana/), "autor humano");
    const a = clon(m.ejecucion); a.aprobada = true;
    verdadero(tiene(validarEjecucion(a).errores, /aprobada: clave desconocida/), "autoaprobación por clave");
    const v = clon(m.ejecucion); v.afirmaciones[0].verificada = true;
    verdadero(tiene(validarEjecucion(v).errores, /verificada: clave desconocida/), "afirmación autoverificada");
  });

  prueba("Laboratorio · contratos: respuestas incompletas o malformadas dan errores claros, nunca una excepción", async () => {
    const m = await mundo();
    const f = clon(m.ejecucion); delete f.afirmaciones;
    verdadero(tiene(validarEjecucion(f).errores, /afirmaciones: falta/), "falta afirmaciones");
    const v = clon(m.ejecucion); v.afirmaciones = [];
    verdadero(tiene(validarEjecucion(v).errores, /respuesta vacía/), "terminado vacío");
    const c = clon(m.ejecucion); c.afirmaciones[0].citas = "demo-f-a"; c.afirmaciones[0].clase = "verdad";
    const rc = validarEjecucion(c).errores;
    verdadero(tiene(rc, /citas debe ser una lista/) && tiene(rc, /clase «verdad» inválida/), "citas y clase");
    for (const basura of [null, 42, "texto", [], { contrato: "cauce.lab.ejecucion" }]) verdadero(!validarEjecucion(basura).ok && !validarEncargo(basura).ok && !validarVerificacion(basura).ok, `basura ${JSON.stringify(basura)}`);
    const h = clon(m.ejecucion); h.rol = "analista"; h.hipotesis = [{ id: "h1", enunciado: "La tasa sube por presión salarial.", se_refuta_si: "", experimento: "Comparar salarios.", alternativa_a: null }];
    verdadero(tiene(validarEjecucion(h).errores, /no es falsable/), "hipótesis sin refutación");
  });

  prueba("Laboratorio · contratos: fallo y sin_conexion exigen el error literal y no pueden traer afirmaciones", async () => {
    const m = await mundo();
    const f = clon(m.ejecucion); f.estado = "fallo"; f.error = null;
    verdadero(tiene(validarEjecucion(f).errores, /error es obligatorio/), "fallo sin error");
    const g = clon(m.ejecucion); g.estado = "sin_conexion"; g.error = "ECONNREFUSED 127.0.0.1:11434";
    verdadero(tiene(validarEjecucion(g).errores, /no puede traer afirmaciones/), "sin_conexion con afirmaciones");
    g.afirmaciones = [];
    igual(validarEjecucion(g).errores, [], "sin_conexion bien formado");
  });

  // ================================================================ verificador
  prueba("Laboratorio · lab-V: cita correcta → literal, íntegra, dentro del corte; respaldo semántico PENDIENTE (nunca «verdadera»)", async () => {
    const v = await ver(await mundo());
    igual(v.resultado, "apta_para_revision_humana");
    igual(v.citas[0].existencia, "registrada"); igual(v.citas[0].integridad, "integra"); igual(v.citas[0].coincidencia, "literal"); igual(v.citas[0].temporal, "dentro_de_corte");
    igual(v.citas[0].cita_utilizable, true);
    igual(v.afirmaciones[0].respaldo_semantico, "pendiente_revision_humana");
    igual(v.revision_humana, { estado: "pendiente" });
    verdadero(!/verdader|aprobad/i.test(JSON.stringify(v.afirmaciones)), "ninguna etiqueta de verdad o aprobación");
  });

  prueba("Laboratorio · lab-V: normalización controlada — espacios y saltos de línea sí; comas, comillas o mayúsculas no", async () => {
    const m = await conAfirmaciones([
      af("a1", "Mantendrá la tasa.", "hecho_citado", [cita("demo-f-a", "El Instituto  mantendrá la tasa\nde referencia en 4.00 % durante el trimestre.")]),
      af("a2", "Mantendrá la tasa.", "hecho_citado", [cita("demo-f-a", "El Instituto mantendrá la tasa de referencia en 4,00 % durante el trimestre.")]),
      af("a3", "Mantendrá la tasa.", "hecho_citado", [cita("demo-f-a", "el instituto mantendrá la tasa de referencia en 4.00 % durante el trimestre.")]),
    ]);
    const v = await ver(m);
    igual(v.citas.map((c) => c.coincidencia), ["normalizada", "no_encontrada", "no_encontrada"]);
    igual(normalizarEspacios("a  b\n\tc"), "a b c");
  });

  prueba("Laboratorio · lab-V: cita inventada y fuente inexistente se identifican y la afirmación queda sin respaldo", async () => {
    const m = await conAfirmaciones([
      af("a1", "El Instituto prometió bajar la tasa.", "hecho_citado", [cita("demo-f-a", "El Instituto bajará la tasa de referencia en el próximo trimestre.")]),
      af("a2", "Un informe del FMI lo confirma.", "hecho_citado", [cita("demo-f-fmi-2030", "El FMI confirma que el Instituto bajará la tasa de referencia.")]),
    ]);
    const v = await ver(m);
    igual(v.citas[0].coincidencia, "no_encontrada"); igual(v.citas[1].existencia, "inexistente");
    igual(v.resumen.n_extractos_no_encontrados, 1); igual(v.resumen.n_citas_inexistentes, 1); igual(v.resumen.n_sin_respaldo, 2);
    igual(v.afirmaciones.map((a) => a.estado_cita), ["citas_con_fallas", "citas_con_fallas"]);
    igual(v.resultado, "con_fallas");
    verdadero(tiene(v.alertas, /fuente_inexistente.*posible invención/) && tiene(v.alertas, /extracto_no_encontrado/), "alertas conservadas");
  });

  prueba("Laboratorio · lab-V: copia alterada (SHA-256 distinto) invalida la cita aunque el extracto aparezca", async () => {
    const m = await mundo();
    const t = TEXTOS["demo-f-a"] + " Nota añadida después.";
    m.copias.set("demo-f-a", { bytes: bytes(t), texto: TEXTOS["demo-f-a"] });
    const v = await ver(m);
    igual(v.fuentes.find((f) => f.fuente_id === "demo-f-a").integridad, "alterada");
    igual(v.citas[0].coincidencia, "literal", "el texto sí coincide…");
    igual(v.citas[0].cita_utilizable, false, "…pero la copia no es la registrada");
    igual(v.resumen.n_fuentes_alteradas, 1); igual(v.resultado, "con_fallas");
  });

  prueba("Laboratorio · lab-V: huella registrada incorrecta, texto alterado y copia ausente se distinguen", async () => {
    const m = await mundo();
    m.encargo.fuentes_permitidas[0].sha256 = "0".repeat(64);
    m.encargo.fuentes_permitidas[1].texto_sha256 = "1".repeat(64);
    m.copias.delete("demo-f-c");
    m.ejecucion.afirmaciones = [
      af("a1", "x tasa", "hecho_citado", [cita("demo-f-a", "El Instituto mantendrá la tasa de referencia en 4.00 % durante el trimestre.")]),
      af("a2", "x subió", "hecho_citado", [cita("demo-f-b", "El Instituto sorprendió al mercado y subió la tasa de referencia a 4.50 %")]),
      af("a3", "x estable", "hecho_citado", [cita("demo-f-c", "Los analistas consultados esperaban que la tasa se mantuviera estable")]),
    ];
    await firmar(m);
    const v = await ver(m);
    const f = Object.fromEntries(v.fuentes.map((x) => [x.fuente_id, x]));
    igual([f["demo-f-a"].integridad, f["demo-f-b"].texto, f["demo-f-c"].integridad], ["alterada", "alterado", "copia_ausente"]);
    igual(v.citas[1].coincidencia, "no_evaluable", "con texto alterado no se busca el extracto");
    igual(v.citas.map((c) => c.cita_utilizable), [false, false, false]);
  });

  prueba("Laboratorio · lab-V: extracto fuera de contexto (precedido de «Es falso que») se avisa y sigue pendiente de una persona", async () => {
    const m = await conAfirmaciones([af("a1", "El Instituto abandonará su meta de inflación.", "hecho_citado", [cita("demo-f-a", "el Instituto vaya a abandonar su meta de inflación del 3 %")])]);
    const v = await ver(m);
    igual(v.citas[0].coincidencia, "literal");
    verdadero(v.citas[0].alertas.includes("posible_fuera_de_contexto"), "alerta de contexto");
    igual(v.afirmaciones[0].respaldo_semantico, "pendiente_revision_humana");
    igual(v.resultado, "con_fallas");
  });

  prueba("Laboratorio · lab-V: extracto demasiado corto o ambiguo no sirve como respaldo", async () => {
    const m = await conAfirmaciones([af("a1", "La tasa es 4.00 %.", "hecho_citado", [cita("demo-f-a", "4.00 %")]), af("a2", "Dice Instituto.", "inferencia", [cita("demo-f-a", "Instituto")])]);
    const v = await ver(m);
    igual(v.citas[0].cita_utilizable, false);
    verdadero(v.citas[0].alertas.includes("extracto_demasiado_corto"), "corto");
    verdadero(v.citas[1].alertas.includes("extracto_ambiguo"), "aparece varias veces");
  });

  prueba("Laboratorio · lab-V: fuente posterior al corte y fecha mencionada posterior se marcan; fecha desconocida no pasa", async () => {
    const m = await conAfirmaciones([
      af("a1", "El 2030-03-20 el Instituto subió la tasa a 4.50 %.", "hecho_citado", [cita("demo-f-b", "El Instituto sorprendió al mercado y subió la tasa de referencia a 4.50 % sin aviso previo.")]),
      af("a2", "Los analistas esperaban estabilidad.", "hecho_citado", [cita("demo-f-c", "Los analistas consultados esperaban que la tasa se mantuviera estable durante varios meses.")]),
    ]);
    const v = await ver(m);
    igual(v.citas.map((c) => c.temporal), ["posterior_al_corte", "fecha_desconocida"]);
    igual(v.citas.map((c) => c.cita_utilizable), [false, false]);
    verdadero(v.afirmaciones[0].alertas.includes("menciona_fecha_posterior_al_corte"), "fecha en el texto");
    igual(v.resumen.n_fuera_de_corte, 1); igual(v.resumen.n_fecha_desconocida, 1);
    igual(fechasMencionadas("el 15-ene-2015 y el 2016-01-08").length, 2);
  });

  prueba("Laboratorio · lab-V: sin corte temporal la fecha no se juzga (sin_corte) pero todo lo demás sí", async () => {
    const m = await mundo(); m.encargo.corte_temporal.conocido_antes_de = null;
    m.ejecucion.afirmaciones = [af("a1", "Subió la tasa.", "hecho_citado", [cita("demo-f-b", "El Instituto sorprendió al mercado y subió la tasa de referencia a 4.50 % sin aviso previo.")])];
    await firmar(m);
    const v = await ver(m);
    igual(v.citas[0].temporal, "sin_corte"); igual(v.citas[0].cita_utilizable, true);
  });

  prueba("Laboratorio · lab-V: clasificación declarada se conserva; hecho sin cita = sin respaldo; inferencia sin cita no la exige", async () => {
    const m = await conAfirmaciones([
      af("a1", "La tasa subirá en abril.", "hecho_citado"), af("a2", "Es probable que el mercado ya lo esperara.", "inferencia"),
      af("a3", "Quizá hubo presión política.", "especulacion"), af("a4", "No se sabe qué votó cada miembro.", "desconocido"),
    ]);
    const v = await ver(m);
    igual(v.afirmaciones.map((a) => [a.clase, a.estado_cita]), [["hecho_citado", "sin_respaldo_citado"], ["inferencia", "no_requiere_cita"], ["especulacion", "no_requiere_cita"], ["desconocido", "no_requiere_cita"]]);
    igual(v.resumen.n_sin_respaldo, 1);
  });

  prueba("Laboratorio · lab-V: una fuente PENDIENTE (como el enlace de 2011) no puede respaldar nada", async () => {
    const v = await ver(await conAfirmaciones([af("a1", "Lo dice el comunicado.", "hecho_citado", [cita("demo-f-p", "El Instituto fijó el mínimo con efecto inmediato.")])]));
    igual(v.citas[0].integridad, "pendiente"); igual(v.citas[0].cita_utilizable, false);
    verdadero(v.citas[0].alertas.includes("fuente_pendiente"), "alerta pendiente");
  });

  prueba("Laboratorio · lab-V: una respuesta de IA citada como fuente se marca circular, no como evidencia", async () => {
    const v = await ver(await conAfirmaciones([af("a1", "El analista ya lo demostró.", "hecho_citado", [cita("demo-lab-run-000", "El Instituto subirá la tasa.")])]));
    igual(v.citas[0].existencia, "respuesta_ia"); igual(v.resumen.n_circulares, 1); igual(v.citas[0].cita_utilizable, false);
  });

  // ---------- circularidad y registro ----------
  async function cadena() {
    // B (analista) critica la salida A; luego se intenta que A cite a B.
    const a = await mundo();
    a.encargo.id = "demo-lab-enc-a"; a.ejecucion.id = "demo-lab-run-a"; a.ejecucion.encargo_id = "demo-lab-enc-a"; await firmar(a);
    const va = (await ver(a)).resultado;
    const b = await mundo();
    b.encargo.id = "demo-lab-enc-b"; b.encargo.rol = "analista"; b.ejecucion.rol = "analista";
    b.ejecucion.id = "demo-lab-run-b"; b.ejecucion.encargo_id = "demo-lab-enc-b";
    b.encargo.insumos.push({ tipo: "lab_ejecucion_verificada", ref: "demo-lab-run-a", sha256: await huellaDoc(a.ejecucion) });
    await firmar(b);
    return { a, b, va };
  }
  prueba("Laboratorio · lab-V: una salida verificada puede ser objeto de crítica; sin verificación o modificada, se rechaza", async () => {
    const { a, b, va } = await cadena();
    igual(va, "apta_para_revision_humana");
    const vA = await ver(a);
    const registro = { encargos: new Map([[a.encargo.id, a.encargo]]), ejecuciones: new Map([[a.ejecucion.id, a.ejecucion]]), verificaciones: new Map([[a.ejecucion.id, vA]]) };
    igual((await ver(b, { registro })).resultado, "apta_para_revision_humana", "con verificación válida");
    const sinV = { ...registro, verificaciones: new Map() };
    verdadero(tiene((await ver(b, { registro: sinV })).errores, /insumo_no_verificado/), "sin verificación");
    const falsa = { ...registro, verificaciones: new Map([[a.ejecucion.id, { ...vA, autor: { tipo: "ia", identificador: "sintetico-v0", version: "x" } }]]) };
    verdadero(tiene((await ver(b, { registro: falsa })).errores, /insumo_no_verificado/), "verificación firmada por una IA no cuenta");
    const mod = { ...registro, ejecuciones: new Map([[a.ejecucion.id, { ...a.ejecucion, dudas: ["cambiada después"] }]]) };
    verdadero(tiene((await ver(b, { registro: mod })).errores, /insumo_modificado/), "insumo modificado");
  });

  prueba("Laboratorio · lab-V: circularidad directa (se usa a sí misma) e indirecta (A → B → A) se rechazan", async () => {
    const m = await mundo();
    m.encargo.rol = "analista"; m.ejecucion.rol = "analista";
    m.encargo.insumos.push({ tipo: "lab_ejecucion_verificada", ref: "demo-lab-run-001", sha256: "f".repeat(64) });
    await firmar(m);
    const v1 = await ver(m);
    igual(v1.resultado, "rechazada"); verdadero(tiene(v1.errores, /circular_directa/), "directa");

    const { a, b } = await cadena();
    // A' = nueva versión del encargo A que toma como insumo la salida B (que a su vez se apoyó en A).
    a.encargo.rol = "analista"; a.ejecucion.rol = "analista";
    a.encargo.insumos.push({ tipo: "lab_ejecucion_verificada", ref: "demo-lab-run-b", sha256: await huellaDoc(b.ejecucion) });
    await firmar(a);
    const vB = await ver(b, { registro: { encargos: new Map(), ejecuciones: new Map([["demo-lab-run-a", a.ejecucion]]), verificaciones: new Map([["demo-lab-run-a", await ver({ ...a, encargo: (await mundo()).encargo })]]) } });
    void vB;
    const registro = {
      encargos: new Map([[b.encargo.id, b.encargo], [a.encargo.id, a.encargo]]),
      ejecuciones: new Map([[b.ejecucion.id, b.ejecucion], [a.ejecucion.id, a.ejecucion]]),
      verificaciones: new Map([[b.ejecucion.id, { ...(await ver(await mundo())), resultado: "apta_para_revision_humana" }]]),
    };
    const v2 = await ver(a, { registro });
    igual(v2.resultado, "rechazada");
    verdadero(tiene(v2.errores, /circular_indirecta: .*demo-lab-run-b → demo-lab-enc-b → demo-lab-run-a/), `indirecta: ${v2.errores.join(" | ")}`);
  });

  prueba("Laboratorio · lab-V: mezcla DEMO/REAL, encargo cambiado después y red sin permiso se rechazan conservando los errores", async () => {
    const m = await mundo();
    const real = clon(m.encargo); real.es_demo = false; real.id = "lab-enc-001";
    const v1 = await ver({ ...m, encargo: real });
    igual(v1.resultado, "rechazada"); verdadero(tiene(v1.errores, /mezcla_demo_real/), "mezcla");
    const m2 = await mundo(); m2.encargo.pregunta += " (editada)";
    verdadero(tiene((await ver(m2)).errores, /encargo_modificado/), "encargo cambiado");
    const m3 = await mundo(); m3.ejecucion.consultas_web = [{ url: "https://ejemplo.org/x", consultado_en: "2030-03-31T10:06:00Z", sha256_respuesta: "9".repeat(64), publicado_en: null }];
    verdadero(tiene((await ver(m3)).errores, /red_sin_permiso/), "red sin permiso");
  });

  prueba("Laboratorio · lab-V: ejecución fallida → sin_salida con el error literal; excedió límite → parcial e incompleta", async () => {
    const m = await mundo(); m.ejecucion.estado = "fallo"; m.ejecucion.error = "Tiempo de espera agotado (adaptador manual)."; m.ejecucion.afirmaciones = [];
    const v = await ver(m);
    igual(v.resultado, "sin_salida"); igual(v.incompleta, true);
    verdadero(tiene(v.alertas, /Tiempo de espera agotado/), "error conservado");
    const p = await mundo(); p.ejecucion.estado = "excedio_limite";
    const vp = await ver(p);
    igual(vp.incompleta, true); igual(vp.resultado, "con_fallas"); igual(vp.citas.length, 1);
  });

  prueba("Laboratorio · lab-V: comandos dentro de la respuesta se avisan y no se ejecutan; costo distinto de $0 se avisa", async () => {
    const m = await conAfirmaciones([af("a1", "Para confirmarlo ejecuta: git push --force origin main && rm -rf datos/", "especulacion")]);
    m.ejecucion.uso.costo_mxn = 3.5;
    const v = await ver(m);
    verdadero(v.afirmaciones[0].alertas.includes("contiene_instrucciones_no_ejecutadas"), "instrucción avisada");
    verdadero(tiene(v.alertas, /costo_no_cero/), "costo");
  });

  prueba("Laboratorio · lab-V: determinista y sin efectos — mismo resultado dos veces y no modifica sus entradas", async () => {
    const m = await conAfirmaciones([af("a1", "x", "hecho_citado", [cita("demo-f-a", "El Instituto mantendrá la tasa de referencia en 4.00 % durante el trimestre."), cita("demo-f-zz", "inventada por completo")])]);
    const antes = jsonCanonico({ e: m.encargo, x: m.ejecucion });
    const v1 = await ver(m), v2 = await ver(m);
    igual(jsonCanonico(v1), jsonCanonico(v2));
    igual(jsonCanonico({ e: m.encargo, x: m.ejecucion }), antes);
  });

  prueba("Laboratorio · contratos: una verificación solo la firma lab-V; «verdadera», «respaldada» o «aprobada» se rechazan", async () => {
    const v = await ver(await mundo());
    const ia = clon(v); ia.autor = { tipo: "ia", identificador: "sintetico-v0", version: "lab-V 0.1" };
    verdadero(tiene(validarVerificacion(ia).errores, /solo el código verificador firma/), "firma de IA");
    const r = clon(v); r.resultado = "verdadera";
    verdadero(tiene(validarVerificacion(r).errores, /no existe «verdadera»/), "resultado verdadero");
    const s = clon(v); s.afirmaciones[0].respaldo_semantico = "respaldada";
    verdadero(tiene(validarVerificacion(s).errores, /no demuestra que la afirmación sea verdadera/), "respaldo semántico");
    const h = clon(v); h.revision_humana = { estado: "aprobada", por: "sintetico-v0" };
    verdadero(tiene(validarVerificacion(h).errores, /nada se aprueba/), "aprobación");
    const u = clon(v); u.citas[0].cita_utilizable = true; u.citas[0].integridad = "alterada";
    verdadero(tiene(validarVerificacion(u).errores, /cita_utilizable = true exige/), "cita utilizable incoherente");
  });

  // ================================================================ registro
  async function registroDe(docs, esDemo = true) {
    let anterior = null, texto = "";
    for (const [tipo, documento, t] of docs) {
      const r = await nuevaEntrada(anterior, { tipo, documento, registrado_en: t, registro_es_demo: esDemo });
      verdadero(r.ok, r.errores?.join(" | "));
      anterior = r.entrada; texto += serializar(r.entrada);
    }
    return texto;
  }
  prueba("Laboratorio · registro: cadena de encargo → ejecución → verificación se comprueba; los índices solo usan entradas válidas", async () => {
    const m = await mundo(); const v = await ver(m);
    const t = await registroDe([["encargo", m.encargo, "2030-03-31T10:00:01Z"], ["ejecucion", m.ejecucion, "2030-03-31T10:09:01Z"], ["verificacion", v, "2030-04-01T12:00:01Z"]]);
    const r = await verificarRegistro(t, { es_demo: true });
    igual(r.problemas, []); igual(r.entradas.length, 3);
    const ix = indicesDesdeEntradas(r.entradas);
    verdadero(ix.encargos.has("demo-lab-enc-001") && ix.ejecuciones.has("demo-lab-run-001") && ix.verificaciones.has("demo-lab-run-001"), "índices");
  });

  prueba("Laboratorio · registro: una ejecución inválida se registra marcada inválida (auditable) y no entra en los índices", async () => {
    const m = await mundo(); const mala = clon(m.ejecucion); mala.autor.tipo = "humano";
    const r = await nuevaEntrada(null, { tipo: "ejecucion", documento: mala, registrado_en: "2030-03-31T10:09:01Z", registro_es_demo: true });
    igual(r.ok, true); igual(r.entrada.valido, false);
    verdadero(tiene(r.entrada.errores_contrato, /no puede presentarse como humana/), "errores guardados");
    igual(indicesDesdeEntradas([r.entrada]).ejecuciones.size, 0);
  });

  prueba("Laboratorio · registro: DEMO en registro REAL se niega; línea truncada, corrupta, borrada o documento alterado se detectan", async () => {
    const m = await mundo();
    const r0 = await nuevaEntrada(null, { tipo: "encargo", documento: m.encargo, registrado_en: "2030-03-31T10:00:01Z", registro_es_demo: false });
    igual(r0.ok, false); verdadero(tiene(r0.errores, /mezcla DEMO\/REAL/), "separación");
    const t = await registroDe([["encargo", m.encargo, "2030-03-31T10:00:01Z"], ["ejecucion", m.ejecucion, "2030-03-31T10:09:01Z"], ["encargo", { ...m.encargo, id: "demo-lab-enc-002" }, "2030-03-31T11:00:01Z"]]);
    const lineas = t.trimEnd().split("\n");
    const truncado = await verificarRegistro(t.slice(0, -40), { es_demo: true });
    verdadero(truncado.problemas.some((p) => p.codigo === "registro_incompleto" && p.linea === 3), "truncado");
    igual(truncado.entradas.length, 2, "lo anterior se conserva");
    const corrupto = await verificarRegistro([lineas[0], "{no es json", lineas[2]].join("\n") + "\n", { es_demo: true });
    verdadero(corrupto.problemas.some((p) => p.codigo === "linea_corrupta" && p.linea === 2), "corrupta");
    const borrado = await verificarRegistro([lineas[0], lineas[2]].join("\n") + "\n", { es_demo: true });
    verdadero(borrado.problemas.some((p) => p.codigo === "cadena_rota") && borrado.problemas.some((p) => p.codigo === "numeracion_rota"), "borrado");
    const e1 = JSON.parse(lineas[1]); e1.documento.dudas = ["añadida a mano"];
    const alterado = await verificarRegistro([lineas[0], JSON.stringify(e1), lineas[2]].join("\n") + "\n", { es_demo: true });
    verdadero(alterado.problemas.some((p) => p.codigo === "documento_modificado"), "documento alterado");
    const enReal = await verificarRegistro(t, { es_demo: false });
    verdadero(enReal.problemas.filter((p) => p.codigo === "mezcla_demo_real").length === 3, "registro DEMO leído como REAL");
  });

  // ================================================================ banco
  const ORIGINAL = "datos/csi/casos-publicados/expediente-bns-2015.json";
  prueba("Laboratorio · banco: genera evaluación, clave y manifiesto separados; original, fuentes, cotejos y pendiente de 2011 intactos", async () => {
    const tOrig = await leerTexto(ORIGINAL);
    const original = JSON.parse(tOrig);
    const huellaAntes = await sha256(jsonCanonico(original));
    const espec = JSON.parse(await leerTexto("datos/laboratorio/banco-prueba/especificacion-prueba.json"));
    const r = await construirBanco(original, espec, { textoOriginal: tOrig, nombreOriginal: ORIGINAL });
    verdadero(r.ok, (r.errores ?? []).join(" | "));
    igual(await sha256(jsonCanonico(original)), huellaAntes, "el original no cambia");
    igual(r.manifiesto.invariantes.pasos_protegidos_identicos, true);
    igual(r.manifiesto.invariantes.n_fuentes, 13); igual(r.manifiesto.invariantes.n_huellas_de_copias, 12);
    igual(r.manifiesto.invariantes.f_bns_2011, { presente: true, estado: "pendiente" });
    igual(r.manifiesto.aprobacion.estado, "pendiente_revision_diego");
    verdadero(!r.textos.evaluacion.includes("D01") && !r.textos.evaluacion.includes("como_se_detectaria"), "la evaluación no contiene la clave");
    igual(r.manifiesto.clave.sha256, await sha256(r.textos.clave)); igual(r.manifiesto.evaluacion.sha256, await sha256(r.textos.evaluacion));
    igual(r.clave.defectos.map((d) => d.id), ["D01", "D02"]);
    igual(r.clave.defectos[1].linea_base.detectado_por_reglas, true, "quitar la refutación lo ve el Abogado");
    igual(r.clave.defectos[0].linea_base.detectado_por_reglas, false, "cambiar una cifra no lo ve ninguna regla actual");
    const r2 = await construirBanco(JSON.parse(tOrig), espec, { textoOriginal: tOrig, nombreOriginal: ORIGINAL });
    igual(r2.textos, r.textos, "determinista");
    const rec = await construirDesdeExpediente(r.evaluacion);
    verdadero(rec.ok, "la evaluación se puede reconstruir con el motor CSI");
    igual(rec.docs.investigaciones.investigaciones[0].fuentes.filter((f) => f.estado === "pendiente").map((f) => f.id), ["f-bns-2011"]);
  });

  prueba("Laboratorio · banco: no permite tocar fuentes o cotejos y exige reemplazos inequívocos; detecta banco modificado", async () => {
    const tOrig = await leerTexto(ORIGINAL), original = JSON.parse(tOrig);
    const base = { contrato: "cauce.lab.banco-defectos", version_contrato: "0.1", id: "banco-t", descripcion: "t" };
    const r1 = await construirBanco(original, { ...base, defectos: [{ id: "D01", categoria: "otra", descripcion: "x", objetivo: { accion: "agregar_fuente", entidad_id: "f-bns-2011" }, cambios: [{ campo: "estado", operacion: "fijar_valor", valor: "consultada" }] }] });
    verdadero(!r1.ok && tiene(r1.errores, /no se pueden alterar fuentes ni cotejos/), "fuente protegida");
    const r2 = await construirBanco(original, { ...base, defectos: [{ id: "D01", categoria: "otra", descripcion: "x", objetivo: { accion: "agregar_enunciado", entidad_id: "e01" }, cambios: [{ campo: "texto", operacion: "reemplazar_texto", buscar: "no existe en el texto", reemplazo: "y" }] }] });
    verdadero(!r2.ok && tiene(r2.errores, /aparece 0 veces/), "reemplazo inexistente");
    const espec = JSON.parse(await leerTexto("datos/laboratorio/banco-prueba/especificacion-prueba.json"));
    const r = await construirBanco(original, espec);
    igual((await comprobarBanco({ manifiesto: r.manifiesto, textoEvaluacion: r.textos.evaluacion, textoClave: r.textos.clave })).ok, true);
    const c = await comprobarBanco({ manifiesto: r.manifiesto, textoEvaluacion: r.textos.evaluacion.replace("1.0820", "1.0280"), textoClave: r.textos.clave });
    verdadero(!c.ok && tiene(c.problemas, /evaluación no coincide/), "evaluación modificada");
  });

  // ================================================================ integración con CSI (solo lectura)
  prueba("Laboratorio · CSI: el catálogo del caso suizo sale de la investigación sin modificarla; sin copias nada se da por bueno", async () => {
    const rec = await construirDesdeExpediente(JSON.parse(await leerTexto(ORIGINAL)));
    const inv = rec.docs.investigaciones.investigaciones[0];
    const antes = jsonCanonico(inv);
    const cat = catalogoDesdeInvestigacion(inv);
    igual(jsonCanonico(inv), antes, "la investigación no cambia");
    igual(cat.length, 13); igual(cat.filter((f) => f.sha256).length, 12);
    igual(cat.filter((f) => f.estado === "pendiente").map((f) => f.fuente_id), ["f-bns-2011"]);
    const m = await mundo();
    m.encargo.es_demo = false; m.encargo.id = "lab-enc-bns-prueba"; m.encargo.fuentes_permitidas = cat;
    m.encargo.corte_temporal.conocido_antes_de = "2015-01-15T09:30:00+01:00";
    m.encargo.insumos = [{ tipo: "csi_investigacion", ref: inv.id, sha256: await sha256(antes) }];
    m.encargo.pregunta = "¿Qué se podía saber antes del anuncio?";
    m.ejecucion.es_demo = false; m.ejecucion.id = "lab-run-bns-prueba"; m.ejecucion.encargo_id = m.encargo.id;
    m.ejecucion.afirmaciones = [af("a1", "El BNS reafirmó el mínimo en diciembre.", "hecho_citado", [cita("f-bns-2014-12", "The SNB reaffirms its commitment to the minimum exchange rate of CHF 1.20 per euro")]),
      af("a2", "El comunicado de 2011 lo fija.", "hecho_citado", [cita("f-bns-2011", "no longer tolerate a EUR/CHF exchange rate below the minimum rate of CHF 1.20")])];
    await firmar(m);
    const v = await ver({ ...m, copias: new Map() });
    igual(v.citas.map((c) => c.integridad), ["copia_ausente", "pendiente"]);
    igual(v.citas.map((c) => c.cita_utilizable), [false, false]);
  });

  prueba("Laboratorio · aislamiento: el código del Laboratorio no escribe, no usa red, no ejecuta y no llama a los motores para escribir", async () => {
    for (const f of ["base.js", "contratos.js", "verificador.js", "registro.js", "banco.js"]) {
      const t = await leerTexto(`app/laboratorio/${f}`);
      for (const re of [/\bfetch\s*\(/, /XMLHttpRequest/, /WebSocket/, /localStorage/, /child_process/, /writeFile/, /\beval\s*\(/, /new Function/, /aplicarCambio/, /registrarLeccion|guardarAlmacen|escribirAlmacen/, /from ["']node:/])
        verdadero(!re.test(t), `${f} contiene ${re}`);
    }
  });
}
