// Datos de PRUEBA de Nexus (fase 1) con la forma del documento v0.2. Todo es ficticio: ids «demo-…», textos «[DEMO]»,
// actores «…-demo». Cada lección ilustra un caso que el gerente debe aceptar o detectar. Se construye con las mismas
// funciones del registro (historial y huellas válidos). Corre en Node y en el navegador.

import { sha256 } from "./comun.js";
import { agregarLeccion, agregarRecomendacion, registroVacio, leerNexus } from "./registro.js";
import { revisionEsceptica } from "./recomendacion.js";

const H = (identificador) => ({ tipo: "humano", identificador });
const rev = (fecha, autor, decision, justificacion, version, autor_tipo = "humano") => ({ fecha, autor_tipo, autor, decision, justificacion, version });
const base = (x) => ({
  esquema: "cauce.leccion", version_esquema: "0.2", tipo: "metodo", antecedentes: [], limitaciones: [], aplicaciones_posibles: [],
  validacion: { estado: "propuesta", validado_en: [] }, sensibilidad: "sin-datos-comerciales", vigente_hasta: "2027-05-06", ...x,
});
const ev = (x) => ({ ubicacion: "main", base_conocimiento: "observed", reproducible_declarado: false, ...x });

export async function leccionesDemo() {
  const h = (t) => sha256(`[DEMO] ${t}`);
  const filas = { n: 88, unidad: "fila", n_independiente: 62, unidad_independencia: "partido", n_efectivo: null, independencia: "por partido", naturaleza: "real_historica", naturaleza_resultado: "prueba_tecnica", seleccion_en_muestra: false, n_comparaciones: 1, cobertura: "[DEMO] copia ficticia de una semana", supuestos: [] };
  return [
    // 1. Bien documentada y modesta: sin objeciones (el gerente no aprueba: solo no objeta).
    { fecha: "2026-11-01T10:00:00-06:00", registro: base({
      id: "demo-compago-duplicados", origen: { proyecto: "compago", componente: "revisor-esceptico", version_sistema: "reglas demo 1.0", commit: "demo000", tipo: "medicion" },
      autor: H("analista-demo"), hallazgo: "[DEMO] Dos registros duplicados no son dos observaciones independientes.",
      evidencia: [ev({ tipo: "prueba_unitaria", referencia: "demo:compago/evaluacion/caso-duplicados", commit: "demo000", observado_en: "2026-10-26T12:00:00-06:00", conocido_en: "2026-10-26T12:00:00-06:00", proyecto_ejecutor: "compago", sha256: await h("duplicados"), reproducible_declarado: true, reproduccion_independiente: null })],
      procedencia: { metodo: "evaluacion_sintetica", periodo_inicio: "2026-10-26", periodo_fin: "2026-10-26", alcance: "[DEMO] un caso; sin frecuencia real", limitaciones_fuente: [] },
      fecha_hallazgo: "2026-10-28",
      muestra: { n: 1, unidad: "caso sintético", n_independiente: 1, unidad_independencia: "caso", n_efectivo: 1, independencia: "no_aplica", naturaleza: "sintetica", naturaleza_resultado: "prueba_tecnica", seleccion_en_muestra: false, n_comparaciones: 1, cobertura: "[DEMO] un caso sintético; no mide prevalencia", supuestos: [] },
      confianza: { nivel: "baja", objeto: "metodo", justificacion: "[DEMO] Demuestra el defecto en un caso; no su frecuencia." },
      limitaciones: ["Solo duplicados exactos"], aplicaciones_posibles: [{ proyecto: "tezcatlipoca", hipotesis: "[DEMO] Contar partidos y no filas cambia alguna conclusión." }],
      revisiones: [rev("2026-11-01T09:00:00-06:00", "analista-demo", "propuesta", "[DEMO] Alta.", "r1"), rev("2026-11-01T09:30:00-06:00", "revisor-demo", "propuesta", "[DEMO] Referencias revisadas por otra persona.", "r2")],
    }) },
    // 2. Backtest presentado como beneficio real: IA que se revisa sola, 218 alternativas, costos 0, known_at 82 % estimado.
    { fecha: "2026-11-01T11:00:00-06:00", registro: base({
      id: "demo-ek-chuah-backtest", tipo: "hallazgo", origen: { proyecto: "ek-chuah", componente: "simulador", version_sistema: "demo 0.1", tipo: "texto_ia" },
      autor: { tipo: "ia", identificador: "asistente-demo" }, hallazgo: "[DEMO] La mejor de 218 combinaciones supera al índice.",
      evidencia: [ev({ tipo: "texto_ia", referencia: "demo:ek-chuah/resumen-ia", ubicacion: "fuera_de_repo", observado_en: null, conocido_en: null, base_conocimiento: "desconocida", proyecto_ejecutor: "ek-chuah" }),
        ev({ tipo: "backtest", referencia: "demo:ek-chuah/simulacion-218", ubicacion: "fuera_de_repo", observado_en: "2026-10-20T10:00:00-06:00", conocido_en: "2026-10-20T10:00:00-06:00", base_conocimiento: "estimated", fraccion_estimada: 0.82, proyecto_ejecutor: "ek-chuah", reproducible_declarado: true })],
      procedencia: { metodo: "backtest", alcance: "[DEMO] serie histórica ficticia", limitaciones_fuente: ["fechas de disponibilidad estimadas"] },
      fecha_hallazgo: "2026-10-25",
      muestra: { n: 1200, unidad: "día", n_independiente: 1200, unidad_independencia: "día", n_efectivo: null, independencia: "serie temporal", naturaleza: "real_historica", naturaleza_resultado: "backtest", seleccion_en_muestra: true, n_comparaciones: 218, cobertura: "[DEMO] un semestre", supuestos: [{ variable: "costos_transaccion", valor: 0, conocido: false }] },
      confianza: { nivel: "alta", objeto: "beneficio_economico", justificacion: "[DEMO] «Supera claramente al índice.»" },
      validacion: { estado: "validada_en_origen", validado_en: [{ proyecto: "ek-chuah", prueba_ref: "demo:simulacion-218", fecha: "2026-10-25", resultado: "[DEMO] supera" }] },
      revisiones: [rev("2026-11-01T10:30:00-06:00", "asistente-demo", "validada_en_origen", "[DEMO] Revisé mi simulación.", "r1", "ia")],
    }) },
    // 3 y 4. Circularidad: B deriva de A y se usa para «validar» A. A cuenta 62 partidos, no 88 filas.
    { fecha: "2026-11-02T09:00:00-06:00", registro: base({
      id: "demo-tezca-filas", origen: { proyecto: "tezcatlipoca", componente: "evaluacion", version_sistema: "demo", tipo: "revision_humana" },
      autor: H("analista-demo"), hallazgo: "[DEMO] Contar filas en vez de partidos infla los conteos.", antecedentes: ["demo-tezca-partidos"],
      evidencia: [ev({ tipo: "conteo", referencia: "demo:tezcatlipoca/conteos", ubicacion: "fuera_de_repo", observado_en: "2026-10-30T10:00:00-06:00", conocido_en: "2026-10-30T10:00:00-06:00", proyecto_ejecutor: "tezcatlipoca", sha256: await h("conteos") })],
      procedencia: { metodo: "conteo", alcance: "[DEMO] copia ficticia", limitaciones_fuente: [] }, fecha_hallazgo: "2026-11-01", muestra: filas,
      confianza: { nivel: "baja", objeto: "metodo", justificacion: "[DEMO] Un conteo." },
      revisiones: [rev("2026-11-02T08:00:00-06:00", "analista-demo", "propuesta", "[DEMO] Alta.", "r1"), rev("2026-11-02T08:30:00-06:00", "revisor-demo", "propuesta", "[DEMO] Revisada.", "r2")],
    }) },
    { fecha: "2026-11-02T09:30:00-06:00", registro: base({
      id: "demo-tezca-partidos", origen: { proyecto: "tezcatlipoca", componente: "evaluacion", version_sistema: "demo", tipo: "revision_humana" },
      autor: H("analista-demo"), hallazgo: "[DEMO] La unidad independiente es el partido.", antecedentes: ["demo-tezca-filas"],
      evidencia: [ev({ tipo: "conteo", referencia: "demo:tezcatlipoca/conteos-b", ubicacion: "fuera_de_repo", observado_en: "2026-10-30T10:00:00-06:00", conocido_en: "2026-10-30T10:00:00-06:00", proyecto_ejecutor: "tezcatlipoca", sha256: await h("conteos-b") })],
      procedencia: { metodo: "conteo", alcance: "[DEMO] copia ficticia", limitaciones_fuente: [] }, fecha_hallazgo: "2026-11-01", muestra: filas,
      confianza: { nivel: "baja", objeto: "metodo", justificacion: "[DEMO] Coincide con la otra lección." },
      validacion: { estado: "validada_en_origen", validado_en: [{ proyecto: "tezcatlipoca", prueba_ref: "leccion:demo-tezca-filas", fecha: "2026-11-02", resultado: "[DEMO] coincide" }] },
      revisiones: [rev("2026-11-02T09:10:00-06:00", "analista-demo", "propuesta", "[DEMO] Alta.", "r1"), rev("2026-11-02T09:20:00-06:00", "revisor-demo", "validada_en_origen", "[DEMO] Confirmada por la otra lección.", "r2")],
    }) },
    // 5. «succeeded» sin informe y un CI verde presentado como despliegue.
    { fecha: "2026-11-03T10:00:00-06:00", registro: base({
      id: "demo-compago-entregable", tipo: "hallazgo", origen: { proyecto: "compago", componente: "importador", version_sistema: "demo", tipo: "medicion" },
      autor: H("analista-demo"), hallazgo: "[DEMO] El importador nocturno ya funciona en producción.",
      evidencia: [ev({ tipo: "estado_tarea", referencia: "demo:tarea succeeded", observado_en: "2026-11-02T03:00:00-06:00", conocido_en: "2026-11-02T03:00:00-06:00", proyecto_ejecutor: "compago", commit: "demo111" }),
        ev({ tipo: "ci", referencia: "demo:CI verde del PR", ubicacion: "desplegado", observado_en: "2026-11-02T04:00:00-06:00", conocido_en: "2026-11-02T04:00:00-06:00", proyecto_ejecutor: "compago", commit: "demo111" })],
      procedencia: { metodo: "observacion", alcance: "[DEMO] una noche", limitaciones_fuente: [] }, fecha_hallazgo: "2026-11-02",
      muestra: { n: 1, unidad: "corrida", n_independiente: 1, unidad_independencia: "corrida", n_efectivo: 1, independencia: "no_aplica", naturaleza: "demo", naturaleza_resultado: "prueba_tecnica", seleccion_en_muestra: false, n_comparaciones: 1, cobertura: "[DEMO] una corrida", supuestos: [] },
      confianza: { nivel: "baja", objeto: "metodo", justificacion: "[DEMO] Una corrida." },
      revisiones: [rev("2026-11-03T09:00:00-06:00", "analista-demo", "propuesta", "[DEMO] Alta.", "r1"), rev("2026-11-03T09:30:00-06:00", "revisor-demo", "propuesta", "[DEMO] Revisada.", "r2")],
    }) },
    // 6. Le falta información (incompleta) y se corrige: la revisión r1 queda en el historial.
    ...await (async () => {
      const r1 = base({
        id: "demo-cauce-zona-horaria", origen: { proyecto: "cauce", componente: "sala-de-control", version_sistema: "fase M", tipo: "revision_humana" },
        autor: H("analista-demo"), hallazgo: "[DEMO] Varias marcas de tiempo no traen zona horaria.",
        evidencia: [ev({ tipo: "inventario", referencia: "demo:cauce/marcas-de-tiempo", ubicacion: "fuera_de_repo", observado_en: null, conocido_en: null, base_conocimiento: "desconocida", proyecto_ejecutor: "cauce", sha256: await h("marcas") })],
        procedencia: { metodo: "inventario", alcance: "[DEMO] tres archivos", limitaciones_fuente: [] }, fecha_hallazgo: "2026-11-03",
        muestra: { n: 3, unidad: "archivo", n_efectivo: null, independencia: "sin revisar", naturaleza: "demo", naturaleza_resultado: "prueba_tecnica", seleccion_en_muestra: false, cobertura: "[DEMO] tres de muchos archivos", supuestos: [] },
        confianza: { nivel: "baja", objeto: "metodo", justificacion: "[DEMO] Inventario parcial." },
        revisiones: [rev("2026-11-03T11:00:00-06:00", "analista-demo", "propuesta", "[DEMO] Alta.", "r1"), rev("2026-11-03T11:30:00-06:00", "revisor-demo", "propuesta", "[DEMO] Revisada.", "r2")],
      });
      const r2 = { ...r1, muestra: { ...r1.muestra, n_independiente: 3, unidad_independencia: "archivo" },
        revisiones: [...r1.revisiones, rev("2026-11-04T10:00:00-06:00", "analista-demo", "propuesta", "[DEMO] Se declara n_independiente; falta saber cuándo se conoció el dato.", "r3")] };
      return [{ fecha: "2026-11-03T12:00:00-06:00", registro: r1 }, { fecha: "2026-11-04T10:30:00-06:00", registro: r2 }];
    })(),
  ];
}

const experimentoCompleto = { metrica_primaria: "[DEMO] conclusiones de conteo que cambian", linea_base: "conteo por fila", muestra: "[DEMO] copia ficticia desensibilizada", unidad_independencia: "partido", n_minimo: 30,
  ventana: "2 semanas", criterio_exito: "[DEMO] al menos una conclusión cambia", criterio_fracaso: "[DEMO] ninguna cambia con n ≥ 30", parada: "datos restringidos o sin respaldo", aislamiento: "copia autorizada, sin escritura", reversion: "borrar la copia y conservar el informe", preregistro_ref: "demo:preregistro-001" };
const rec = (x) => ({ esquema: "cauce.recomendacion", version_esquema: "0.2", riesgos: [], permisos_requeridos: ["solo lectura de copia autorizada"], toca_parametros_financieros: false, toca_apuestas: false,
  revision_esceptica: { version_reglas: "nexus-R 0.2", reglas: [], revisor: { tipo: "humano", identificador: "pendiente" } },
  decision_humana: { estado: "pendiente_aprobacion", responsable: null, fecha: null, alcance: null, vigencia: null, condiciones: [], referencia: null },
  ejecucion: { estado: "no_iniciada", resultados: [] }, adopcion: { estado: "no_adoptada", referencia: null }, ...x });

export async function construirDemo() {
  let lecciones = { ...registroVacio("lecciones", { es_demo: true }), descripcion: "[DEMO] Lecciones ficticias para probar Nexus fase 1. No son conclusiones reales de ningún proyecto." };
  for (const v of await leccionesDemo()) {
    const r = await agregarLeccion(lecciones, { registro: v.registro, registrado_en: v.fecha, registrado_por: H("analista-demo") });
    if (!r.ok) throw new Error(`${v.registro.id}: ${r.errores.join(" ")}`);
    lecciones = r.doc;
  }
  let recomendaciones = { ...registroVacio("recomendaciones", { es_demo: true }), descripcion: "[DEMO] Recomendaciones ficticias. Nexus solo las registra: no ejecuta nada." };
  const nx = await leerNexus({ lecciones, recomendaciones: null });
  const ctx = (fecha) => ({ lecciones: nx.ultimas, ahora: Date.parse(fecha) });
  const agregar = async (registro, fecha, por = H("analista-demo")) => {
    const r = await agregarRecomendacion(recomendaciones, { registro, registrado_en: fecha, registrado_por: por }, lecciones);
    if (!r.ok) throw new Error(`${registro.id} (${registro.estado}): ${r.errores.join(" ")}`);
    recomendaciones = r.doc;
    return registro;
  };
  /** propuesta → revisada (gerente) → pendiente_aprobacion: tres versiones con historial anexado. */
  const hastaPendiente = async (doc, f1, f2, f3) => {
    let d = await agregar({ ...doc, estado: "propuesta", historial: [{ evento: "borrador", fecha: f1, autor_tipo: "humano", autor: "analista-demo" }] }, f1);
    d = await agregar({ ...d, estado: "revisada", revision_esceptica: revisionEsceptica(d, ctx(f2)), historial: [...d.historial, { evento: "revisada", fecha: f2, autor_tipo: "codigo", autor: "gerente-esceptico" }] }, f2, { tipo: "codigo", identificador: "gerente-esceptico" });
    return agregar({ ...d, estado: "pendiente_aprobacion", historial: [...d.historial, { evento: "pendiente_aprobacion", fecha: f3, autor_tipo: "humano", autor: "analista-demo" }] }, f3);
  };
  // A. Lista para que una persona decida.
  await hastaPendiente(rec({ id: "demo-rec-conteos-tezcatlipoca", destino: { proyecto: "tezcatlipoca", componente: "evaluacion-conteos-aislada" }, lecciones: [{ id: "demo-compago-duplicados", revision: "r2" }],
    problema: "[DEMO] No se sabe si contar filas altera conclusiones.", hipotesis: "[DEMO] Contar partidos únicos cambia al menos una conclusión.", accion_propuesta: "[DEMO] Comparar conteos en una copia aislada.", experimento: experimentoCompleto, riesgos: ["[DEMO] copia incompleta"] }),
    "2026-11-05T09:00:00-06:00", "2026-11-05T09:05:00-06:00", "2026-11-05T09:10:00-06:00");
  // B. Toca parámetros financieros y se apoya en una lección con objeciones: bloqueada.
  await hastaPendiente(rec({ id: "demo-rec-backtest-ek-chuah", destino: { proyecto: "ek-chuah", componente: "simulador" }, lecciones: [{ id: "demo-ek-chuah-backtest", revision: "r1" }],
    problema: "[DEMO] Mejorar el rendimiento simulado.", hipotesis: "[DEMO] La combinación elegida funciona fuera de muestra.", accion_propuesta: "[DEMO] Cambiar la combinación del simulador.", experimento: experimentoCompleto, toca_parametros_financieros: true, riesgos: ["[DEMO] sobreajuste"] }),
    "2026-11-05T10:00:00-06:00", "2026-11-05T10:05:00-06:00", "2026-11-05T10:10:00-06:00");
  // C. Aprobada por una persona para un experimento aislado: aprobada ≠ ejecutada ≠ adoptada.
  const c = await hastaPendiente(rec({ id: "demo-rec-duplicados-compago", destino: { proyecto: "compago", componente: "revisor-esceptico" }, lecciones: [{ id: "demo-compago-duplicados", revision: "r2" }],
    problema: "[DEMO] Duplicados contados dos veces.", hipotesis: "[DEMO] Marcar duplicados reduce falsos positivos.", accion_propuesta: "[DEMO] Medir en una copia aislada.", experimento: experimentoCompleto }),
    "2026-11-05T11:00:00-06:00", "2026-11-05T11:05:00-06:00", "2026-11-05T11:10:00-06:00");
  await agregar({ ...c, estado: "aprobada",
    decision_humana: { estado: "aprobada", responsable: "director-demo", fecha: "2026-11-05T12:00:00-06:00", alcance: "[DEMO] solo el experimento aislado de 2 semanas", vigencia: "2026-12-31", condiciones: ["sin escritura en Compago"], referencia: "demo:acta-001" },
    historial: [...c.historial, { evento: "aprobada", fecha: "2026-11-05T12:00:00-06:00", autor_tipo: "humano", autor: "director-demo" }] }, "2026-11-05T12:00:00-06:00", H("director-demo"));
  // D. Borrador con valores pendientes (forma del ejemplo §4.1): no aprobable.
  await agregar(rec({ id: "demo-rec-borrador", estado: "propuesta", destino: { proyecto: "tezcatlipoca", componente: "evaluacion-conteos-aislada" }, lecciones: [{ id: "demo-tezca-filas", revision: "r2" }],
    problema: "[DEMO] Borrador.", hipotesis: "[DEMO] Por definir.", accion_propuesta: "[DEMO] Diseñar comparación solo si hay respaldo reproducible.",
    experimento: { ...experimentoCompleto, muestra: null, n_minimo: null, ventana: null, criterio_exito: null, criterio_fracaso: null, preregistro_ref: null },
    historial: [{ evento: "borrador", fecha: "2026-11-05T13:00:00-06:00", autor_tipo: "humano", autor: "analista-demo" }] }), "2026-11-05T13:00:00-06:00");
  return { lecciones, recomendaciones };
}
