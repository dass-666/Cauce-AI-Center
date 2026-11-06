// Nexus fase 1 según CAUCE_NEXUS_ARQUITECTURA_MAESTRA_v0.2 (docs/): contratos cauce.leccion 0.2 y cauce.recomendacion 0.2,
// gerente nexus-R 0.2, pruebas de aceptación T01–T24 (§8), negativas y de regresión. Corre en Node y en pruebas.html.

import { prueba, igual, verdadero } from "./mini.js";
import { esFechaConZona, esFechaODia, buscarDatosPrivados, huellaDe, sha256, jsonCanonico } from "../app/nexus/comun.js";
import { validarLeccion } from "../app/nexus/leccion.js";
import { evaluarLeccion, REGLAS, ESTADOS, dictaminar } from "../app/nexus/gerente.js";
import { validarRecomendacion, evaluarRecomendacion, revisionEsceptica, validarPaso, situacion } from "../app/nexus/recomendacion.js";
import { leerNexus, agregarLeccion, agregarRecomendacion, verificarCadena, registroVacio, resumirNexus, consultarLecciones } from "../app/nexus/registro.js";
import { construirDemo } from "../app/nexus/demo.js";
import { validarDocumento } from "../app/nucleo/contrato.js";

const AHORA = Date.parse("2026-11-06T12:00:00-06:00");
const clon = (x) => JSON.parse(JSON.stringify(x));
const H64 = (c) => c.repeat(64);

/** Lección registrable y sin objeciones; cada prueba cambia lo que necesita. */
export function leccion(cambios = {}) {
  return {
    id: "prueba-uno", esquema: "cauce.leccion", version_esquema: "0.2", tipo: "metodo",
    origen: { proyecto: "compago", componente: "revisor", version_sistema: "1.0", commit: "abc1234", tipo: "medicion" },
    autor: { tipo: "humano", identificador: "autora" }, hallazgo: "Algo verificable.", antecedentes: [],
    evidencia: [{ tipo: "prueba_unitaria", referencia: "pruebas/caso-1", ubicacion: "main", commit: "abc1234", observado_en: "2026-10-20T10:00:00-06:00", conocido_en: "2026-10-20T10:00:00-06:00",
      base_conocimiento: "observed", proyecto_ejecutor: "compago", sha256: H64("a"), reproducible_declarado: true, reproduccion_independiente: null }],
    procedencia: { metodo: "prueba", periodo_inicio: "2026-10-20", periodo_fin: "2026-10-20", alcance: "un caso", limitaciones_fuente: [] },
    fecha_hallazgo: "2026-10-28", vigente_hasta: "2027-05-06",
    muestra: { n: 1, unidad: "caso", n_independiente: 1, unidad_independencia: "caso", n_efectivo: 1, independencia: "no_aplica", naturaleza: "sintetica", naturaleza_resultado: "prueba_tecnica", seleccion_en_muestra: false, n_comparaciones: 1, cobertura: "un caso", supuestos: [] },
    confianza: { nivel: "baja", objeto: "metodo", justificacion: "Un caso." }, limitaciones: [], aplicaciones_posibles: [],
    validacion: { estado: "propuesta", validado_en: [] },
    revisiones: [{ fecha: "2026-10-28T10:00:00-06:00", autor_tipo: "humano", autor: "autora", decision: "propuesta", justificacion: "Alta.", version: "r1" },
      { fecha: "2026-10-28T11:00:00-06:00", autor_tipo: "humano", autor: "revisor", decision: "propuesta", justificacion: "Revisada.", version: "r2" }],
    sensibilidad: "sin-datos-comerciales", ...cambios,
  };
}
const con = (f) => { const l = leccion(); f(l); return l; };
const regla = (l, id, ctx = {}) => evaluarLeccion(l, { ahora: AHORA, ...ctx }).reglas.find((r) => r.id === id);
const estado = (l, id, ctx) => regla(l, id, ctx).estado;
const mapa = (...ls) => new Map(ls.map((l) => [l.id, l]));
const sobre = (registro, registrado_en = "2026-10-28T12:00:00-06:00") => ({ registro, registrado_en, registrado_por: { tipo: "humano", identificador: "autora" } });

export function registrarCasosNexus(leerTexto) {
  // ------------------------------------------------------------ contrato cauce.leccion 0.2
  prueba("Nexus: la lección de referencia es registrable y el gerente no tiene objeciones (10/10)", () => {
    igual(validarLeccion(leccion()).errores, []);
    const ev = evaluarLeccion(leccion(), { ahora: AHORA });
    igual(ev.dictamen.estado, "sin_objeciones", JSON.stringify(ev.reglas.filter((r) => r.estado !== "cumple")));
    igual(ev.reglas.length, 10);
    verdadero(ev.reglas.every((r) => r.version === "nexus-R 0.2" && Array.isArray(r.referencia)));
  });
  prueba("Nexus contrato: claves desconocidas se rechazan (§3), también dentro de evidencia y muestra", () => {
    verdadero(validarLeccion(leccion({ es_demo: true })).errores.some((e) => e.includes("es_demo: clave desconocida")));
    verdadero(validarLeccion(con((l) => { l.evidencia[0].nota = "x"; })).errores.some((e) => e.includes("evidencia[0].nota")));
    verdadero(validarLeccion(con((l) => { l.muestra.extra = 1; })).errores.some((e) => e.includes("muestra.extra")));
  });
  prueba("Nexus contrato: obligatorios, enumeraciones y fechas (día ISO o instante con zona)", () => {
    for (const k of ["hallazgo", "procedencia", "muestra", "confianza", "validacion", "revisiones", "sensibilidad", "vigente_hasta"]) {
      const l = leccion(); delete l[k];
      verdadero(validarLeccion(l).errores.some((e) => e.startsWith(k)), k);
    }
    verdadero(validarLeccion(leccion({ tipo: "opinion" })).errores.length > 0);
    verdadero(validarLeccion(con((l) => { l.validacion.estado = "aprobada"; })).errores.length > 0, "aprobada no es estado de validación");
    verdadero(validarLeccion(con((l) => { l.evidencia[0].observado_en = "2026-10-20T10:00:00"; })).errores.some((e) => e.includes("zona")), "instante sin zona");
    verdadero(esFechaODia("2026-10-28") && !esFechaODia("2026-13-01") && !esFechaODia("2026-02-30") && esFechaConZona("2026-10-28T10:00:00Z") && !esFechaConZona("2026-10-28"));
    verdadero(validarLeccion(null).errores.length === 1 && validarLeccion([]).errores.length === 1);
  });

  // ------------------------------------------------------------ gerente: forma
  prueba("Nexus: cada regla responde cumple, no_cumple o no_evaluado con motivo, referencia y versión (basura incluida)", () => {
    for (const entrada of [leccion(), {}, null, "texto", 7, { evidencia: "x", revisiones: [null, 3] }, con((l) => { l.evidencia = [null, 5]; })]) {
      const ev = evaluarLeccion(entrada, { ahora: AHORA });
      igual(ev.reglas.length, 10);
      for (const r of ev.reglas) verdadero(ESTADOS.includes(r.estado) && r.motivo.length > 5 && r.version === "nexus-R 0.2", `${r.id}: ${r.estado}`);
    }
  });
  prueba("Nexus: lección vacía o basura NUNCA queda «sin objeciones»; un control que no aplica lo dice (aplica: false)", () => {
    for (const x of [{}, null, { hallazgo: "solo texto" }]) verdadero(evaluarLeccion(x, { ahora: AHORA }).dictamen.estado !== "sin_objeciones");
    verdadero(regla(leccion(), "R10").aplica === false && /No aplica/.test(regla(leccion(), "R10").motivo));
  });
  prueba("Nexus: el gerente es determinista y no modifica la lección", () => {
    const l = leccion(); const antes = jsonCanonico(l);
    igual(evaluarLeccion(l, { ahora: AHORA }), evaluarLeccion(clon(l), { ahora: AHORA }));
    igual(jsonCanonico(l), antes);
  });

  // ------------------------------------------------------------ T01–T24 (§8)
  prueba("T01 sin fuente primaria → R01/R02 no cumple", () => {
    igual(estado(leccion({ evidencia: [] }), "R02"), "no_cumple");
    const ia = con((l) => { l.evidencia[0].tipo = "texto_ia"; l.origen.tipo = "texto_ia"; l.validacion = { estado: "validada_en_origen", validado_en: [{ proyecto: "compago", prueba_ref: "x", fecha: "2026-11-01", resultado: "ok" }] }; });
    igual([estado(ia, "R01"), estado(ia, "R02")], ["no_cumple", "no_cumple"]);
  });
  prueba("T02 tarea «succeeded» sin informe → R09 no cumple", () => {
    igual(estado(con((l) => { l.evidencia[0].tipo = "estado_tarea"; }), "R09"), "no_cumple");
    igual(estado(con((l) => { l.evidencia[0].tipo = "estado_tarea"; l.evidencia.push({ ...l.evidencia[0], tipo: "informe", referencia: "informe.md", sha256: H64("b") }); }), "R09"), "cumple", "con informe sí");
  });
  prueba("T03 duplicados exactos → R03 detecta dependencia", () => {
    igual(estado(con((l) => { l.evidencia.push(clon(l.evidencia[0])); }), "R03"), "no_cumple");
    igual(estado(con((l) => { const d = clon(l.evidencia[0]); delete d.sha256; l.evidencia[0].sha256 = undefined; delete l.evidencia[0].sha256; l.evidencia.push(d); }), "R03"), "no_cumple", "misma referencia y commit");
  });
  prueba("T04 known_at posterior al hallazgo → R04 no cumple (y dentro del mismo día sin zona → no evaluado)", () => {
    igual(estado(con((l) => { l.evidencia[0].conocido_en = "2026-10-30T10:00:00-06:00"; }), "R04"), "no_cumple");
    igual(estado(con((l) => { l.evidencia[0].conocido_en = "2026-10-28T09:00:00-06:00"; }), "R04"), "no_evaluado", "el día del hallazgo no tiene hora");
    igual(estado(con((l) => { l.evidencia[0].conocido_en = "2026-10-20T09:00:00-06:00"; }), "R04"), "no_cumple", "conocido antes de observado");
  });
  prueba("T05 validado_en sin prueba_ref → R06 no cumple", () => {
    igual(estado(con((l) => { l.validacion.validado_en = [{ proyecto: "compago", prueba_ref: "", fecha: "2026-11-01", resultado: "ok" }]; }), "R06"), "no_cumple");
  });
  prueba("T06 backtest histórico etiquetado como beneficio real → R08 no cumple", () => {
    igual(estado(con((l) => { Object.assign(l.muestra, { naturaleza: "real_historica", naturaleza_resultado: "backtest" }); l.confianza.objeto = "beneficio_economico"; }), "R08"), "no_cumple");
  });
  prueba("T07 fecha de exportación presentada como observación → R04 no cumple", () => {
    igual(estado(con((l) => { l.evidencia[0].exportado_en = l.evidencia[0].observado_en; }), "R04"), "no_cumple");
  });
  prueba("T08 PR con CI verde presentado como desplegado → R09 no cumple", () => {
    igual(estado(con((l) => { l.evidencia[0].tipo = "ci"; l.evidencia[0].ubicacion = "desplegado"; }), "R09"), "no_cumple");
    igual(estado(con((l) => { l.evidencia[0].tipo = "verificacion_despliegue"; l.evidencia[0].ubicacion = "desplegado"; }), "R09"), "cumple");
  });
  const recBase = (x = {}) => ({ id: "rec-prueba", esquema: "cauce.recomendacion", version_esquema: "0.2", estado: "propuesta", destino: { proyecto: "ek-chuah", componente: "c" }, lecciones: [{ id: "prueba-uno", revision: "r2" }],
    problema: "p", hipotesis: "h", accion_propuesta: "a",
    experimento: { metrica_primaria: "m", linea_base: "b", muestra: "copia", unidad_independencia: "u", n_minimo: 30, ventana: "2 semanas", criterio_exito: "e", criterio_fracaso: "f", parada: "p", aislamiento: "copia", reversion: "borrar", preregistro_ref: "pre-1" },
    riesgos: [], permisos_requeridos: [], toca_parametros_financieros: false, toca_apuestas: false,
    revision_esceptica: { version_reglas: "nexus-R 0.2", reglas: [], revisor: { tipo: "codigo", identificador: "gerente-esceptico" } },
    decision_humana: { estado: "pendiente_aprobacion", responsable: null, fecha: null, alcance: null, vigencia: null, condiciones: [], referencia: null },
    ejecucion: { estado: "no_iniciada", resultados: [] }, adopcion: { estado: "no_adoptada", referencia: null },
    historial: [{ evento: "borrador", fecha: "2026-11-01T10:00:00-06:00", autor_tipo: "humano", autor: "proponente" }], ...x });
  const ctx = { lecciones: mapa(leccion()), ahora: AHORA };
  prueba("T09 aprobación sin ejecución y cambio de riesgo: no se ejecuta; R10 bloquea", () => {
    const r = recBase({ toca_parametros_financieros: true, estado: "aprobada", ejecucion: { estado: "ejecutada", resultados: [{ referencia: "x" }] } });
    const ev = evaluarRecomendacion(r, ctx);
    igual(ev.reglas.find((x) => x.id === "R10").estado, "no_cumple");
    verdadero(ev.bloqueos.some((b) => b.startsWith("Bloqueo absoluto")));
    verdadero(validarPaso(recBase({ estado: "aprobada" }), r, ctx).some((e) => e.includes("Bloqueo absoluto")));
    igual(situacion(recBase({ estado: "aprobada" })), "Aprobada por una persona · sin ejecutar · no adoptada", "aprobada ≠ ejecutada ≠ adoptada");
  });
  prueba("T10 lección A→B→A como prueba independiente → R03/R06 no cumple", () => {
    const a = leccion({ id: "prueba-a", antecedentes: ["prueba-b"] });
    const b = leccion({ id: "prueba-b", antecedentes: ["prueba-a"], validacion: { estado: "validada_en_origen", validado_en: [{ proyecto: "compago", prueba_ref: "leccion:prueba-a", fecha: "2026-11-01", resultado: "coincide" }] } });
    igual(estado(a, "R03", { lecciones: mapa(a, b) }), "no_cumple");
    igual(estado(b, "R06", { lecciones: mapa(a, b) }), "no_cumple");
    const c = leccion({ id: "prueba-c", antecedentes: ["prueba-d"] }); const d = leccion({ id: "prueba-d", antecedentes: ["prueba-e"] }); const e = leccion({ id: "prueba-e", antecedentes: ["prueba-c"] });
    verdadero(regla(c, "R03", { lecciones: mapa(c, d, e) }).motivo.includes("prueba-c → prueba-d → prueba-e → prueba-c"), "ciclo largo");
    igual(estado(leccion({ antecedentes: ["prueba-zz"] }), "R03"), "no_evaluado", "antecedente desconocido");
  });
  prueba("T11 lección caducada → R05 no cumple", () => {
    igual(estado(leccion({ vigente_hasta: "2026-11-01" }), "R05"), "no_cumple");
    igual(estado(leccion(), "R05"), "cumple");
  });
  prueba("T12 regla no evaluada presentada como cumple → se rechaza", () => {
    const l = con((x) => { x.muestra.cobertura = null; }); // R02 no_evaluado
    const c2 = { lecciones: mapa(l), ahora: AHORA };
    const forjada = recBase({ revision_esceptica: { version_reglas: "nexus-R 0.2", reglas: [{ id: "R02", estado: "cumple", motivo: "x", evidencia_consultada: [] }], revisor: { tipo: "humano", identificador: "x" } } });
    verdadero(evaluarRecomendacion(forjada, c2).inconsistencias.some((t) => t.includes("R02") && t.includes("T12")));
    verdadero(validarPaso(null, forjada, c2).some((t) => t.includes("T12")), "el registro la rechaza");
    verdadero(validarRecomendacion(recBase({ revision_esceptica: { version_reglas: "nexus-R 0.2", reglas: [{ id: "R01", estado: "no_evaluada" }], revisor: { tipo: "codigo", identificador: "g" } } })).errores.some((e) => e.includes("no_evaluada")), "«no_evaluada» no existe");
    const reglas = REGLAS.map((r) => ({ id: r.id, estado: "cumple" })); reglas[3].estado = "no_evaluado";
    igual(dictaminar(reglas).estado, "incompleto"); igual(dictaminar(reglas).apto_para_decision_humana, false);
  });
  prueba("T13 token o estrategia en texto libre → R07 bloquea exportación", () => {
    for (const t of ["token=abcd1234efgh", "sk-abcdefghijklmnopqrstu", "umbral de 0.62 para entrar", "stake: 2% de la banca", "abrir en bet365", "cuenta número 12345678"]) {
      igual(estado(leccion({ hallazgo: t }), "R07"), "no_cumple", t);
    }
    igual(estado(leccion({ hallazgo: "No elegir umbrales con la misma muestra." }), "R07"), "cumple", "hablar de umbrales como método sí se permite");
    igual(estado(leccion({ hallazgo: "umbral de 0.62", sensibilidad: "restringida" }), "R07"), "cumple", "restringida: se guarda, no se exporta");
    verdadero(regla(leccion({ sensibilidad: "restringida" }), "R07").motivo.includes("no es exportable"));
    igual(estado(leccion({ tipo: "estrategia" }), "R07"), "no_cumple", "estrategia exige restringida");
    igual(estado(leccion({ tipo: "estrategia", sensibilidad: "restringida", aplicaciones_posibles: [{ proyecto: "ek-chuah", hipotesis: "h" }] }), "R10"), "no_cumple", "estrategia no se exporta");
  });
  prueba("T14 caso sintético n=1 presentado como éxito comercial → R08 no cumple", () => {
    igual(estado(con((l) => { l.confianza.objeto = "beneficio_economico"; l.muestra.naturaleza_resultado = "resultado_operativo_real"; }), "R08"), "no_cumple");
    igual(estado(con((l) => { l.confianza.objeto = "efecto_operativo"; }), "R08"), "no_cumple");
  });
  prueba("T15 88 filas / 72 selecciones / 62 partidos → usa la unidad independiente", () => {
    const r = regla(con((l) => { Object.assign(l.muestra, { n: 88, unidad: "fila", n_independiente: 62, unidad_independencia: "partido", n_efectivo: null }); }), "R03");
    igual(r.estado, "cumple"); verdadero(r.motivo.includes("62 partido") && r.motivo.includes("no 88"));
    igual(estado(con((l) => { Object.assign(l.muestra, { n: 88, n_independiente: 62, unidad_independencia: undefined }); delete l.muestra.unidad_independencia; }), "R03"), "no_evaluado");
    igual(estado(con((l) => { Object.assign(l.muestra, { n: 88 }); delete l.muestra.n_independiente; }), "R03"), "no_evaluado", "sin n_independiente");
    igual(estado(con((l) => { Object.assign(l.muestra, { n: 62, n_independiente: 88 }); }), "R03"), "no_cumple", "imposible");
  });
  prueba("T16 mejor umbral elegido y probado en la misma muestra → R08 no cumple para generalizar", () => {
    igual(estado(con((l) => { l.muestra.seleccion_en_muestra = true; l.confianza.nivel = "media"; }), "R08"), "no_cumple");
    igual(estado(con((l) => { l.muestra.seleccion_en_muestra = true; }), "R08"), "cumple", "propuesta de confianza baja: solo limitación");
  });
  prueba("T17 fecha de registro o de revisión sin zona → R04 / registro la rechaza", async () => {
    const l = con((x) => { x.revisiones[1].fecha = "2026-10-28T11:00:00"; });
    igual(estado(l, "R04"), "no_cumple");
    verdadero(validarLeccion(l).errores.some((e) => e.includes("zona")));
    const r = await agregarLeccion(registroVacio("lecciones"), sobre(leccion(), "2026-10-28T12:00:00"));
    verdadero(!r.ok && r.errores.some((e) => e.includes("registrado_en") && e.includes("zona")));
  });
  prueba("T18 218 alternativas sin ajuste por selección → R08 impide afirmar ventaja robusta", () => {
    igual(estado(con((l) => { l.muestra.n_comparaciones = 218; l.confianza.nivel = "media"; }), "R08"), "no_cumple");
    igual(estado(con((l) => { l.muestra.n_comparaciones = 218; l.confianza.nivel = "media"; l.muestra.supuestos = [{ variable: "ajuste_comparaciones", valor: "holm", conocido: true }]; }), "R08"), "cumple");
  });
  prueba("T19 costos desconocidos codificados como cero → R08 no cumple", () => {
    igual(estado(con((l) => { l.muestra.supuestos = [{ variable: "costos_transaccion", valor: 0, conocido: false }]; }), "R08"), "no_cumple");
    igual(estado(con((l) => { l.muestra.supuestos = ["costos = 0 porque se desconocen"]; }), "R08"), "no_cumple");
    igual(estado(con((l) => { l.muestra.supuestos = [{ variable: "costos_transaccion", valor: 0, conocido: true }]; }), "R08"), "cumple", "cero conocido es un dato");
  });
  prueba("T20 autor IA igual a revisor IA → R01 no cumple para validación independiente", () => {
    const l = con((x) => { x.autor = { tipo: "ia", identificador: "asistente" }; x.revisiones = [{ fecha: "2026-10-28T10:00:00-06:00", autor_tipo: "ia", autor: "Asistente", decision: "validada_en_origen", justificacion: "ok", version: "r1" }]; x.validacion = { estado: "validada_en_origen", validado_en: [{ proyecto: "compago", prueba_ref: "p", fecha: "2026-11-01", resultado: "ok" }] }; });
    igual(estado(l, "R01"), "no_cumple");
    const otraIa = con((x) => { x.autor = { tipo: "ia", identificador: "asistente" }; x.revisiones[0].autor_tipo = "ia"; x.revisiones[0].autor = "asistente"; x.revisiones[1].autor_tipo = "ia"; x.revisiones[1].autor = "otra-ia"; x.validacion = l.validacion; });
    igual(estado(otraIa, "R01"), "no_cumple", "otra IA tampoco basta: se necesita revisión humana");
  });
  prueba("T21 known_at 82 % estimado y conclusión temporal fuerte → R04/R08 limitan la confianza", () => {
    const l = con((x) => { x.evidencia[0].base_conocimiento = "estimated"; x.evidencia[0].fraccion_estimada = 0.82; x.confianza.nivel = "alta"; });
    igual([estado(l, "R04"), estado(l, "R08")], ["no_cumple", "no_cumple"]);
    igual(estado(con((x) => { x.evidencia[0].base_conocimiento = "estimated"; x.evidencia[0].fraccion_estimada = 0.82; }), "R04"), "cumple", "con confianza baja se admite y se anota");
  });
  prueba("T22 fuente de IA repetida en dos proyectos → no cuenta como dos validaciones", () => {
    const l = con((x) => {
      x.evidencia = [{ ...x.evidencia[0] }, { ...x.evidencia[0], tipo: "texto_ia", referencia: "auditoria IA en ek-chuah", proyecto_ejecutor: "ek-chuah", sha256: H64("c") }];
      x.validacion = { estado: "validada_en_destino", validado_en: [{ proyecto: "ek-chuah", prueba_ref: "auditoria IA", fecha: "2026-11-02", resultado: "coincide" }] };
    });
    igual(estado(l, "R06"), "no_cumple");
  });
  prueba("T23 resumen Nexus como campo extraño de estado-proyecto 1.0.0 → nunca entra al modelo (contrato v1 sin cambios)", async () => {
    const doc = JSON.parse(await leerTexto("contrato/ejemplos/minimo.json"));
    doc.nexus = { lecciones: 6 };
    const r = validarDocumento(doc);
    // Hallazgo: el validador v1 NO rechaza claves extra; las DESCARTA (no aparecen en el documento normalizado).
    verdadero(r.documento === null || !("nexus" in r.documento), "el campo extraño no pasa al modelo");
    verdadero((await leerTexto("contrato/CONTRATO.md")).includes("`cauce.estado-proyecto` · versión 1.0.0"));
  });
  prueba("T24 evidencia declarada reproducible sin prueba externa → no se eleva a validada en destino", () => {
    const l = con((x) => {
      x.validacion = { estado: "validada_en_destino", validado_en: [{ proyecto: "ek-chuah", prueba_ref: "misma prueba", fecha: "2026-11-02", resultado: "ok" }] };
      x.revisiones[1].decision = "validada_en_destino";
    });
    igual(estado(l, "R06"), "no_cumple");
    const bien = con((x) => {
      x.evidencia.push({ ...x.evidencia[0], tipo: "prueba_destino", referencia: "ek-chuah/pruebas/nueva", proyecto_ejecutor: "ek-chuah", sha256: H64("d"), observado_en: "2026-10-21T10:00:00-06:00", conocido_en: "2026-10-21T10:00:00-06:00" });
      x.validacion = { estado: "validada_en_destino", validado_en: [{ proyecto: "ek-chuah", prueba_ref: "ek-chuah/pruebas/nueva", fecha: "2026-11-02", resultado: "confirma" }] };
    });
    igual(estado(bien, "R06"), "cumple", "prueba propia, posterior y con revisión ajena");
    igual(estado(con((x) => { Object.assign(x, clon(bien)); x.validacion.validado_en[0].fecha = "2026-10-28"; }), "R06"), "no_cumple", "no posterior al planteamiento");
  });

  // ------------------------------------------------------------ privacidad (negativas y falsos positivos)
  prueba("Nexus privacidad: credenciales, llaves, URL con clave, correos, teléfonos, CURP y tarjetas", () => {
    for (const t of ["password=Secreta123", "Authorization: Bearer xyz", "-----BEGIN RSA PRIVATE KEY-----", "ghp_abcdefghijklmnopqrstuvwxyz", "postgres://u:clave@servidor/db", "alguien@ejemplo.com", "55 1234 5678", "4111 1111 1111 1111", "GODE561231HDFRRN09"])
      verdadero(validarLeccion(leccion({ hallazgo: t })).errores.some((e) => e.startsWith("Dato privado")), t);
    igual(buscarDatosPrivados(leccion()), []);
    igual(buscarDatosPrivados({ t: "88 filas del 2026-10-01 al 2026-10-15; 218 alternativas; sin token" }), []);
  });

  // ------------------------------------------------------------ registro que solo crece
  prueba("Nexus registro: versiones nuevas anexan revisiones; las anteriores no cambian", async () => {
    let doc = (await agregarLeccion(registroVacio("lecciones"), sobre(leccion()))).doc;
    const v2 = con((l) => { l.revisiones.push({ fecha: "2026-10-29T10:00:00-06:00", autor_tipo: "humano", autor: "revisor", decision: "propuesta", justificacion: "Corrección del alcance.", version: "r3" }); l.procedencia.alcance = "un caso, corregido"; });
    let r = await agregarLeccion(doc, sobre(v2, "2026-10-29T10:30:00-06:00")); verdadero(r.ok, r.errores.join()); doc = r.doc;
    const nx = await leerNexus({ lecciones: doc, recomendaciones: registroVacio("recomendaciones") });
    igual(nx.errores, []);
    igual(nx.historial.get("prueba-uno").map((e) => e.registro.procedencia.alcance), ["un caso", "un caso, corregido"]);
    igual(consultarLecciones(nx, { texto: "verificable" }).length, 1);
    for (const [nombre, mala] of [
      ["borra una revisión", con((l) => { l.revisiones = [l.revisiones[0], { ...l.revisiones[1], version: "r9" }]; })],
      ["edita una revisión anterior", con((l) => { l.revisiones[0].justificacion = "otra"; l.revisiones.push({ ...v2.revisiones[2], version: "r4" }); })],
      ["sin revisión nueva", leccion()],
    ]) { const x = await agregarLeccion(doc, sobre(mala, "2026-10-30T10:00:00-06:00")); verdadero(!x.ok, nombre); }
    verdadero(!(await agregarLeccion(doc, sobre(leccion({ id: "demo-x" }), "2026-10-30T10:00:00-06:00"))).ok, "id demo en registro real");
    verdadero(!(await agregarLeccion(registroVacio("lecciones", { es_demo: true }), sobre(leccion()))).ok, "id real en registro demo");
    verdadero(!(await agregarLeccion(doc, sobre(leccion({ id: "prueba-dos" }), "2026-10-01T10:00:00-06:00"))).ok, "fecha hacia atrás");
  });
  prueba("Nexus registro: borrar, editar o reordenar rompe la cadena de huellas y se detecta", async () => {
    let doc = registroVacio("lecciones");
    for (const [i, id] of ["prueba-uno", "prueba-dos", "prueba-tres"].entries()) doc = (await agregarLeccion(doc, sobre(leccion({ id }), `2026-10-28T1${i}:00:00-06:00`))).doc;
    igual((await verificarCadena(doc.entradas)).ok, true);
    verdadero((await leerNexus({ lecciones: { ...doc, entradas: [doc.entradas[0], doc.entradas[2]] }, recomendaciones: null })).errores.some((e) => e.includes("borró")));
    const ed = clon(doc); ed.entradas[0].registro.hallazgo = "otro";
    verdadero(!(await verificarCadena(ed.entradas)).ok, "edición");
    verdadero(!(await verificarCadena([doc.entradas[1], doc.entradas[0], doc.entradas[2]])).ok, "reorden");
    const r = await agregarLeccion(ed, sobre(leccion({ id: "prueba-cuatro" }), "2026-10-29T10:00:00-06:00"));
    verdadero(!r.ok && r.errores[0].includes("alterado"));
    igual((await verificarCadena(doc.entradas.slice(0, 2))).ok, true, "limitación documentada: quitar la ÚLTIMA entrada no se detecta");
    igual(await huellaDe({ a: 1, b: [1, { d: 2, c: 3 }] }), await huellaDe({ b: [1, { c: 3, d: 2 }], a: 1 }));
    igual(await sha256("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  // ------------------------------------------------------------ recomendaciones
  prueba("Nexus recomendación: forma §4 (claves desconocidas, estados, toca_*, decisión, ejecución y adopción)", () => {
    igual(validarRecomendacion(recBase()).errores, []);
    verdadero(validarRecomendacion(recBase({ extra: 1 })).errores.some((e) => e.includes("extra")));
    verdadero(validarRecomendacion(recBase({ estado: "implementada" })).errores.length > 0);
    verdadero(validarRecomendacion(recBase({ toca_apuestas: "no" })).errores.length > 0);
    verdadero(validarRecomendacion(recBase({ adopcion: { estado: "lista" } })).errores.length > 0);
    verdadero(validarRecomendacion(recBase({ historial: [{ evento: "borrador", fecha: "2026-11-01T10:00:00", autor_tipo: "humano" }] })).errores.some((e) => e.includes("zona")));
  });
  prueba("Nexus recomendación: borrador con valores pendientes no es aprobable (§4.1)", () => {
    const r = recBase({ experimento: { ...recBase().experimento, n_minimo: null, preregistro_ref: null } });
    const ev = evaluarRecomendacion(r, ctx);
    verdadero(!ev.aprobable && ev.reglas.find((x) => x.id === "R10").estado === "no_cumple");
  });
  prueba("Nexus recomendación: aprobar solo una persona distinta de quien propone, desde «pendiente», con 10/10", () => {
    const pend = recBase({ estado: "pendiente_aprobacion", revision_esceptica: revisionEsceptica(recBase(), ctx), historial: [...recBase().historial, { evento: "pendiente_aprobacion", fecha: "2026-11-01T11:00:00-06:00", autor_tipo: "humano", autor: "proponente" }] });
    const aprobar = (autor_tipo, responsable) => ({ ...pend, estado: "aprobada", decision_humana: { estado: "aprobada", responsable, fecha: "2026-11-02T10:00:00-06:00", alcance: "experimento", vigencia: "2026-12-31", condiciones: [], referencia: "acta" },
      historial: [...pend.historial, { evento: "aprobada", fecha: "2026-11-02T10:00:00-06:00", autor_tipo, autor: responsable }] });
    igual(validarPaso(pend, aprobar("humano", "director"), ctx), []);
    verdadero(validarPaso(pend, aprobar("ia", "asistente"), ctx).length > 0, "IA");
    verdadero(validarPaso(pend, aprobar("codigo", "gerente-esceptico"), ctx).length > 0, "el gerente");
    verdadero(validarPaso(pend, aprobar("humano", "proponente"), ctx).some((e) => e.includes("propia")), "autoaprobación");
    verdadero(validarPaso(recBase(), aprobar("humano", "director"), ctx).some((e) => e.includes("No se puede pasar")), "desde propuesta");
    const incompleta = { lecciones: mapa(con((l) => { l.muestra.cobertura = null; })), ahora: AHORA };
    verdadero(validarPaso(pend, aprobar("humano", "director"), incompleta).some((e) => e.includes("nunca se aprueba")), "lección incompleta");
    const vieja = { ...aprobar("humano", "director"), lecciones: [{ id: "prueba-uno", revision: "r1" }] };
    verdadero(validarPaso({ ...pend, lecciones: vieja.lecciones }, vieja, ctx).length > 0, "revisión citada desactualizada");
    verdadero(validarPaso(pend, { ...pend, estado: "pendiente_aprobacion", historial: pend.historial }, ctx).some((e) => e.includes("anexar")), "historial sin evento nuevo");
    verdadero(validarPaso(null, recBase({ ejecucion: { estado: "ejecutada", resultados: [] } }), ctx).some((e) => e.includes("Sin aprobación")), "ejecución sin aprobar");
  });
  prueba("Nexus recomendación: la adopción no se deduce de la ejecución (necesita referencia)", () => {
    const r = recBase({ estado: "aprobada", ejecucion: { estado: "ejecutada", resultados: [{ referencia: "informe" }] }, adopcion: { estado: "fusionada", referencia: null } });
    igual(evaluarRecomendacion(r, ctx).reglas.find((x) => x.id === "R09").estado, "no_cumple");
  });

  // ------------------------------------------------------------ datos de prueba y regresión
  prueba("Nexus: los datos de prueba guardados coinciden con herramientas/nexus-demo.mjs", async () => {
    const { lecciones, recomendaciones } = await construirDemo();
    igual(JSON.parse(await leerTexto("datos/nexus/demo/lecciones.json")), lecciones);
    igual(JSON.parse(await leerTexto("datos/nexus/demo/recomendaciones.json")), recomendaciones);
  });
  prueba("Nexus: datos de prueba — dictámenes esperados, todo «demo-» y «[DEMO]», historial íntegro", async () => {
    const L = JSON.parse(await leerTexto("datos/nexus/demo/lecciones.json")), R = JSON.parse(await leerTexto("datos/nexus/demo/recomendaciones.json"));
    const s = resumirNexus(await leerNexus({ lecciones: L, recomendaciones: R }), { ahora: AHORA });
    igual(s.errores, []);
    verdadero(s.es_demo && L.entradas.every((e) => e.registro.id.startsWith("demo-") && e.registro.hallazgo.startsWith("[DEMO]")) && R.entradas.every((e) => e.registro.id.startsWith("demo-")));
    igual(Object.fromEntries(s.lecciones.map((x) => [x.leccion.id, x.evaluacion.dictamen.estado])), { "demo-compago-duplicados": "sin_objeciones", "demo-ek-chuah-backtest": "con_objeciones",
      "demo-tezca-filas": "con_objeciones", "demo-tezca-partidos": "con_objeciones", "demo-compago-entregable": "con_objeciones", "demo-cauce-zona-horaria": "incompleto" });
    igual(s.cifras, { lecciones: 6, sin_objeciones: 1, incompletas: 1, con_objeciones: 4, pendientes: 2, aprobadas_sin_ejecutar: 1, adoptadas: 0 });
    igual(s.recomendaciones.map((r) => [r.registro.id, r.registro.estado, r.evaluacion.aprobable]), [["demo-rec-conteos-tezcatlipoca", "pendiente_aprobacion", true], ["demo-rec-backtest-ek-chuah", "pendiente_aprobacion", false], ["demo-rec-duplicados-compago", "aprobada", true], ["demo-rec-borrador", "propuesta", false]]);
  });
  prueba("Nexus regresión: no toca cauce.estado-proyecto 1.0.0 ni el registro de pisos; sin red, sin almacenamiento, sin azar", async () => {
    const pisos = JSON.parse(await leerTexto("datos/proyectos.json"));
    verdadero(!pisos.proyectos.some((p) => /nexus/i.test(`${p.id} ${p.nombre}`)));
    for (const ruta of ["app/nexus/comun.js", "app/nexus/leccion.js", "app/nexus/gerente.js", "app/nexus/recomendacion.js", "app/nexus/registro.js"]) {
      const t = await leerTexto(ruta);
      verdadero(!/from "\.\.\/nucleo\//.test(t), `${ruta} no depende del núcleo v1`);
      verdadero(!/\bfetch\(|XMLHttpRequest|WebSocket|localStorage|Math\.random/.test(t), `${ruta}: sin red, almacenamiento ni azar`);
    }
  });
}
