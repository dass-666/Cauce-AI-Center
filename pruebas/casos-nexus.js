// Nexus fase 1: contratos cauce.leccion y cauce.recomendacion (0.2 provisional), gerente escéptico, registro que
// solo crece y resumen para la oficina. Corre en Node (pruebas/ejecutar.mjs) y en el navegador (pruebas.html).

import { prueba, igual, verdadero } from "./mini.js";
import { esFechaConZona, buscarDatosPrivados, huellaDe, sha256, jsonCanonico } from "../app/nexus/comun.js";
import { validarLeccion } from "../app/nexus/leccion.js";
import { evaluarLeccion, REGLAS, RESULTADOS, dictaminar, nivelSustentado } from "../app/nexus/gerente.js";
import { validarEventoForma, plegarRecomendacion, ETIQUETA_ETAPA } from "../app/nexus/recomendacion.js";
import { leerNexus, agregarLeccion, agregarEvento, verificarCadena, registroVacio, resumirNexus, revisionDelGerente, consultarLecciones } from "../app/nexus/registro.js";
import { construirDemo } from "../app/nexus/demo.js";

const AHORA = Date.parse("2026-11-06T12:00:00-06:00");
const H = (id) => ({ tipo: "humano", id });
const HUELLA_A = "a".repeat(64);
const HUELLA_B = "b".repeat(64);
const clon = (x) => JSON.parse(JSON.stringify(x));

/** Lección válida y sin objeciones; cada prueba cambia lo que necesita. */
function leccion(cambios = {}) {
  return {
    contrato: "cauce.leccion", version_contrato: "0.2.0", id: "lec-prueba-uno", revision: 1, tipo_cambio: "alta", es_demo: true,
    registrado_en: "2026-11-01T10:00:00-06:00", fecha_conclusion: "2026-11-01T09:00:00-06:00",
    registrado_por: H("autora"), autor_conclusion: H("autora"),
    titulo: "Prueba", enunciado: "Algo que se observó.", proyecto_origen: "compago", proyectos_destino: ["ek-chuah"],
    naturaleza_resultado: "exito", nivel_validacion: "validada_en_origen", declara_reproducible: true,
    evidencias: [
      { id: "e1", tipo: "experimento", descripcion: "Experimento", referencia: "ruta/e1.csv", huella: HUELLA_A, procedimiento: "Correr la consulta.",
        usa_datos_hasta: "2026-10-31T23:00:00-06:00", obtenida_en: "2026-11-01T08:00:00-06:00",
        muestra: { id: "m1", fuente: "f", periodo: { desde: "2026-10-01T00:00:00-06:00", hasta: "2026-10-31T23:00:00-06:00" } },
        metodo: { configuraciones_probadas: 1, evaluacion: "fuera_de_muestra" } },
      { id: "v1", tipo: "registro", uso: "validacion", descripcion: "Repetición", referencia: "ruta/v1.csv", huella: HUELLA_B,
        muestra: { id: "m2", fuente: "f", periodo: { desde: "2026-11-01T00:00:00-06:00", hasta: "2026-11-02T00:00:00-06:00" } } },
    ],
    antecedentes: [],
    validaciones: [{ por: H("revisor"), en: "2026-11-03T10:00:00-06:00", ambito: "origen", proyecto: "compago", resultado: "confirma", evidencias: ["v1"] }],
    vigencia: { caduca_en: "2027-06-01T00:00:00-06:00" },
    ...cambios,
  };
}
const regla = (l, id, ctx = {}) => evaluarLeccion(l, { ahora: AHORA, ...ctx }).reglas.find((r) => r.id === id);
const mapa = (...ls) => new Map(ls.map((l) => [l.id, l]));

export function registrarCasosNexus(leerTexto) {
  // ------------------------------------------------------------ contrato de lección
  prueba("Nexus: la lección de referencia es válida y el gerente no tiene objeciones", () => {
    igual(validarLeccion(leccion()).errores, []);
    const ev = evaluarLeccion(leccion(), { ahora: AHORA });
    igual(ev.dictamen.estado, "sin_objeciones", JSON.stringify(ev.reglas.filter((r) => r.resultado !== "cumple")));
  });
  prueba("Nexus: fechas SIN zona horaria se rechazan (contrato) y el gerente las marca no_cumple", () => {
    for (const malo of ["2026-11-01T10:00:00", "2026-11-01", "2026-11-01 10:00:00-06:00", "ayer", "2026-13-01T10:00:00Z"]) {
      verdadero(!esFechaConZona(malo), malo);
      const l = leccion({ registrado_en: malo });
      verdadero(validarLeccion(l).errores.some((e) => e.includes("registrado_en")), `contrato aceptó ${malo}`);
      igual(regla(l, "G01").resultado, "no_cumple", malo);
    }
    verdadero(esFechaConZona("2026-11-01T10:00:00Z") && esFechaConZona("2026-11-01T10:00:00.123-06:00") && esFechaConZona("2026-11-01T10:00+05:30"));
    const ev = leccion(); ev.evidencias[0].usa_datos_hasta = "2026-10-31T23:00:00";
    verdadero(validarLeccion(ev).errores.some((e) => e.includes("usa_datos_hasta")), "fecha de evidencia sin zona");
  });
  prueba("Nexus: privacidad — credenciales, llaves, tokens, correos, teléfonos y tarjetas se rechazan", () => {
    const casos = ["password=Secreta123", "api_key: abcd1234efgh", "Authorization: Bearer xyz", "-----BEGIN RSA PRIVATE KEY-----", "sk-abcdefghijklmnopqrstu",
      "ghp_abcdefghijklmnopqrstuvwxyz", "postgres://usuario:clave@servidor/db", "escribir a alguien@ejemplo.com", "llamar al 55 1234 5678", "tarjeta 4111 1111 1111 1111"];
    for (const t of casos) {
      const l = leccion({ enunciado: t });
      verdadero(validarLeccion(l).errores.some((e) => e.startsWith("Dato privado")), `no detectó: ${t}`);
      igual(regla(l, "G02").resultado, "no_cumple", t);
    }
    // Sin falsos positivos con lo que sí llevan las lecciones.
    igual(buscarDatosPrivados(leccion()), []);
    igual(buscarDatosPrivados({ t: "120 fichas del 2026-10-01 al 2026-10-15; 40 combinaciones; token de sesión no incluido" }), []);
  });
  prueba("Nexus: es_demo, id, nivel y naturaleza son obligatorios; revisión >1 exige motivo", () => {
    const sin = leccion(); delete sin.es_demo;
    verdadero(validarLeccion(sin).errores.some((e) => e.includes("es_demo")));
    verdadero(validarLeccion(leccion({ id: "Mala ID" })).errores.length > 0);
    verdadero(validarLeccion(leccion({ nivel_validacion: "aprobada" })).errores.length > 0);
    verdadero(validarLeccion(leccion({ naturaleza_resultado: "bueno" })).errores.length > 0);
    verdadero(validarLeccion(leccion({ revision: 2, tipo_cambio: "correccion" })).errores.some((e) => e.includes("motivo_cambio")));
    verdadero(validarLeccion(leccion({ revision: 2, tipo_cambio: "alta", motivo_cambio: "x" })).errores.length > 0);
    verdadero(validarLeccion(null).errores.length === 1 && validarLeccion([]).errores.length === 1);
    const v = leccion(); v.validaciones[0].evidencias = ["no-existe"];
    verdadero(validarLeccion(v).errores.some((e) => e.includes("no-existe")), "validación que cita evidencia inexistente");
  });

  // ------------------------------------------------------------ gerente: forma de las respuestas
  prueba("Nexus: cada regla responde solo cumple, no_cumple o no_evaluado, con explicación (12 reglas)", () => {
    igual(REGLAS.length, 12);
    for (const entrada of [leccion(), {}, null, "texto", 42, { evidencias: "no lista", validaciones: [null, 3], antecedentes: [{}] }, leccion({ evidencias: [null, { id: 1 }] })]) {
      const ev = evaluarLeccion(entrada, { ahora: AHORA });
      igual(ev.reglas.length, 12);
      for (const r of ev.reglas) verdadero(RESULTADOS.includes(r.resultado) && r.explicacion.length > 5, `${r.id}: ${r.resultado}`);
    }
  });
  prueba("Nexus: una lección vacía o basura NUNCA queda «sin objeciones»", () => {
    for (const entrada of [{}, null, { titulo: "solo título" }, { nivel_validacion: "hipotesis" }]) {
      const d = evaluarLeccion(entrada, { ahora: AHORA }).dictamen;
      verdadero(d.estado !== "sin_objeciones" && !d.apto_para_revision_humana, JSON.stringify(entrada));
    }
  });
  prueba("Nexus: un no_evaluado jamás se convierte en aprobado (dictamen incompleto, no apto)", () => {
    const reglas = REGLAS.map((r) => ({ ...r, resultado: "cumple" }));
    igual(dictaminar(reglas).estado, "sin_objeciones");
    reglas[4].resultado = "no_evaluado";
    const d = dictaminar(reglas);
    igual([d.estado, d.apto_para_revision_humana, d.no_evaluado], ["incompleto", false, ["G05"]]);
    reglas[4].resultado = "algo_raro";
    igual(dictaminar(reglas).estado, "incompleto", "un valor desconocido tampoco aprueba");
    const l = leccion(); delete l.vigencia;
    igual(evaluarLeccion(l, { ahora: AHORA }).dictamen.estado, "incompleto");
  });

  // ------------------------------------------------------------ gerente: reglas
  prueba("Nexus G03: conclusión sin pruebas (solo afirmaciones) no puede pasar de hipótesis", () => {
    const l = leccion({ evidencias: [{ id: "e1", tipo: "afirmacion", descripcion: "Confíen en mí." }], validaciones: [] });
    igual(regla(l, "G03").resultado, "no_cumple");
    igual(regla(leccion({ evidencias: [], validaciones: [] }), "G03").resultado, "no_cumple");
    igual(regla(leccion({ nivel_validacion: "hipotesis", evidencias: [], validaciones: [] }), "G03").resultado, "cumple");
  });
  prueba("Nexus G04: evidencia duplicada (misma huella o referencia) y evidencia prestada de un antecedente", () => {
    const l = leccion(); l.evidencias.push({ ...l.evidencias[0], id: "e1-copia" });
    igual(regla(l, "G04").resultado, "no_cumple");
    const r = leccion(); r.evidencias[1].huella = undefined; r.evidencias[1].referencia = " RUTA/E1.CSV ";
    delete r.evidencias[1].huella; r.evidencias[0].huella = undefined; delete r.evidencias[0].huella;
    igual(regla(r, "G04").resultado, "no_cumple", "misma referencia con otra escritura");
    const ant = leccion({ id: "lec-prueba-ant", evidencias: [clon(leccion().evidencias[0])] });
    const hija = leccion({ antecedentes: [{ leccion_id: "lec-prueba-ant", relacion: "apoya" }] });
    igual(regla(hija, "G04", { lecciones: mapa(ant, hija) }).resultado, "no_cumple");
    const sin = leccion(); for (const ev of sin.evidencias) { delete ev.huella; delete ev.referencia; }
    igual(regla(sin, "G04").resultado, "no_evaluado");
  });
  prueba("Nexus G05: muestras dependientes (mismo id, solapadas, derivadas o mismo periodo y fuente)", () => {
    const dos = (m2) => { const l = leccion(); l.evidencias[1] = { ...l.evidencias[1], uso: "conclusion", muestra: m2 }; return l; };
    igual(regla(dos({ id: "m1" }), "G05").resultado, "no_cumple", "mismo id");
    igual(regla(dos({ id: "m9", solapa_con: ["m1"] }), "G05").resultado, "no_cumple", "solapa_con");
    igual(regla(dos({ id: "m9", derivada_de: ["m1"] }), "G05").resultado, "no_cumple", "derivada_de");
    igual(regla(dos({ id: "m9", fuente: "f", periodo: { desde: "2026-10-15T00:00:00-06:00", hasta: "2026-11-15T00:00:00-06:00" } }), "G05").resultado, "no_cumple", "periodo encimado");
    igual(regla(dos({ id: "m9", fuente: "f", periodo: { desde: "2026-11-01T00:00:00-06:00", hasta: "2026-11-15T00:00:00-06:00" } }), "G05").resultado, "cumple", "periodos separados");
    const sin = dos(undefined); delete sin.evidencias[1].muestra;
    igual(regla(sin, "G05").resultado, "no_evaluado");
  });
  prueba("Nexus G05/G09: validar «en destino» con la misma muestra del origen no es independiente", () => {
    const l = leccion({ nivel_validacion: "validada_independiente_en_destino" });
    l.evidencias.push({ id: "d1", tipo: "registro", uso: "validacion", descripcion: "En destino", referencia: "ruta/d1.csv", huella: "c".repeat(64), muestra: { id: "m-dest", solapa_con: ["m1"] } });
    l.validaciones.push({ por: H("otra"), en: "2026-11-04T10:00:00-06:00", ambito: "destino", proyecto: "ek-chuah", resultado: "confirma", evidencias: ["d1"] });
    igual(regla(l, "G05").resultado, "no_cumple");
    igual(regla(l, "G09").resultado, "no_cumple");
    igual(nivelSustentado(l).nivel, "validada_en_origen");
    l.evidencias.at(-1).muestra = { id: "m-dest" };
    igual(nivelSustentado(l).nivel, "validada_independiente_en_destino");
    igual(evaluarLeccion(l, { ahora: AHORA }).dictamen.estado, "sin_objeciones");
    const otro = clon(l); otro.validaciones[1].proyecto = "compago";
    igual(nivelSustentado(otro).nivel, "validada_en_origen", "el origen no cuenta como destino");
  });
  prueba("Nexus G06: uso de información futura (datos posteriores, evidencia posterior, fuga entrenamiento/prueba)", () => {
    const l1 = leccion(); l1.evidencias[0].usa_datos_hasta = "2026-11-02T00:00:00-06:00";
    igual(regla(l1, "G06").resultado, "no_cumple", "datos posteriores a la conclusión");
    const l2 = leccion(); l2.evidencias[0].obtenida_en = "2026-11-05T00:00:00-06:00";
    igual(regla(l2, "G06").resultado, "no_cumple", "evidencia obtenida después");
    const l3 = leccion(); l3.evidencias[0].metodo = { evaluacion: "fuera_de_muestra", datos_entrenamiento_hasta: "2026-10-20T00:00:00-06:00", datos_prueba_desde: "2026-10-10T00:00:00-06:00" };
    igual(regla(l3, "G06").resultado, "no_cumple", "fuga de información");
    igual(regla(leccion({ fecha_conclusion: "2026-11-02T00:00:00-06:00" }), "G06").resultado, "no_cumple", "concluida después de registrarse");
    const l4 = leccion(); delete l4.evidencias[0].usa_datos_hasta; delete l4.evidencias[0].muestra.periodo;
    igual(regla(l4, "G06").resultado, "no_evaluado");
    // Las zonas horarias se respetan: 23:00-06:00 es 05:00Z del día siguiente.
    const l5 = leccion({ fecha_conclusion: "2026-11-01T04:00:00Z" }); l5.evidencias[0].usa_datos_hasta = "2026-10-31T23:00:00-06:00";
    igual(regla(l5, "G06").resultado, "no_cumple", "comparar con zona");
  });
  prueba("Nexus G07: circularidad (a sí misma, A↔B, cadena larga y evidencia que cita la lección)", () => {
    igual(regla(leccion({ antecedentes: [{ leccion_id: "lec-prueba-uno", relacion: "apoya" }] }), "G07").resultado, "no_cumple");
    const a = leccion({ id: "lec-prueba-a", antecedentes: [{ leccion_id: "lec-prueba-b", relacion: "deriva_de" }] });
    const b = leccion({ id: "lec-prueba-b", antecedentes: [{ leccion_id: "lec-prueba-c", relacion: "apoya" }] });
    const c = leccion({ id: "lec-prueba-c", antecedentes: [{ leccion_id: "lec-prueba-a", relacion: "deriva_de" }] });
    const r = regla(a, "G07", { lecciones: mapa(a, b, c) });
    igual(r.resultado, "no_cumple"); verdadero(r.explicacion.includes("lec-prueba-a → lec-prueba-b → lec-prueba-c → lec-prueba-a"), r.explicacion);
    const e = leccion({ id: "lec-prueba-e" }); e.evidencias.push({ id: "x", tipo: "documento", descripcion: "otra", referencia: "leccion:lec-prueba-f" });
    const f = leccion({ id: "lec-prueba-f", antecedentes: [{ leccion_id: "lec-prueba-e", relacion: "apoya" }] });
    igual(regla(e, "G07", { lecciones: mapa(e, f) }).resultado, "no_cumple", "evidencia leccion:...");
    igual(regla(leccion({ antecedentes: [{ leccion_id: "lec-prueba-zz", relacion: "apoya" }] }), "G07").resultado, "no_evaluado", "antecedente desconocido");
    igual(regla(leccion({ antecedentes: [{ leccion_id: "lec-prueba-uno", relacion: "contradice" }] }), "G07").resultado, "cumple", "contradecir no es apoyo");
  });
  prueba("Nexus G08/G09: ninguna IA (ni persona) valida su propia conclusión; lección de IA exige validación humana", () => {
    const ia = { tipo: "ia", id: "asistente" };
    const l = leccion({ autor_conclusion: ia, registrado_por: ia });
    l.validaciones = [{ ...l.validaciones[0], por: { tipo: "ia", id: " Asistente " } }];
    igual(regla(l, "G08").resultado, "no_cumple");
    igual(nivelSustentado(l).nivel, "hipotesis");
    igual(regla(l, "G09").resultado, "no_cumple");
    const otraIa = clon(l); otraIa.validaciones[0].por = { tipo: "ia", id: "otra-ia" };
    igual(regla(otraIa, "G08").resultado, "cumple");
    igual(nivelSustentado(otraIa).nivel, "hipotesis", "otra IA tampoco basta: se necesita una persona");
    const humano = clon(l); humano.validaciones[0].por = H("revisor");
    igual(nivelSustentado(humano).nivel, "validada_en_origen");
    const persona = leccion(); persona.validaciones[0].por = H("autora");
    igual(regla(persona, "G08").resultado, "no_cumple");
  });
  prueba("Nexus G09: validación con solo texto, refutada después o inconclusa no sostiene el nivel", () => {
    const t = leccion(); t.evidencias[1] = { id: "v1", tipo: "afirmacion", uso: "validacion", descripcion: "Está bien." };
    igual(nivelSustentado(t).nivel, "hipotesis");
    const r = leccion(); r.validaciones.push({ ...r.validaciones[0], en: "2026-11-04T10:00:00-06:00", resultado: "refuta" });
    igual(regla(r, "G09").resultado, "no_cumple", "la última validación refuta");
    const i = leccion(); i.validaciones[0].resultado = "inconcluso";
    igual(nivelSustentado(i).nivel, "hipotesis");
  });
  prueba("Nexus G10: no se declara reproducible con solo una afirmación de texto", () => {
    const l = leccion({ evidencias: [{ id: "e1", tipo: "afirmacion", descripcion: "Lo corrí y salió." }], validaciones: [], nivel_validacion: "hipotesis" });
    igual(regla(l, "G10").resultado, "no_cumple");
    const sinHuella = leccion(); delete sinHuella.evidencias[0].huella;
    igual(regla(sinHuella, "G10").resultado, "no_cumple", "referencia sin huella no basta");
    const sinProc = leccion(); delete sinProc.evidencias[0].procedimiento;
    igual(regla(sinProc, "G10").resultado, "no_cumple", "huella sin procedimiento no basta");
    igual(regla(leccion({ declara_reproducible: false }), "G10").resultado, "cumple");
    const nada = leccion(); delete nada.declara_reproducible;
    igual(regla(nada, "G10").resultado, "no_evaluado");
    verdadero(regla(leccion(), "G10").explicacion.includes("no las volvió a ejecutar"), "no presume haber reproducido");
  });
  prueba("Nexus G11: sobreajuste (mejor de N configuraciones medido en la misma muestra)", () => {
    const l = leccion(); l.evidencias[0].metodo = { configuraciones_probadas: 40, evaluacion: "en_muestra" };
    const r = regla(l, "G11");
    igual(r.resultado, "no_cumple"); verdadero(r.explicacion.includes("40"));
    const una = leccion(); una.evidencias[0].metodo = { configuraciones_probadas: 1, evaluacion: "en_muestra" };
    igual(regla(una, "G11").resultado, "no_cumple", "éxito medido solo en muestra");
    const cv = leccion(); cv.evidencias[0].metodo = { configuraciones_probadas: 40, evaluacion: "validacion_cruzada" };
    igual(regla(cv, "G11").resultado, "cumple");
    const fr = leccion({ naturaleza_resultado: "fracaso" }); fr.evidencias[0].metodo = { configuraciones_probadas: 3, evaluacion: "en_muestra" };
    igual(regla(fr, "G11").resultado, "cumple", "un fracaso no presume mejora");
    const sin = leccion(); delete sin.evidencias[0].metodo;
    igual(regla(sin, "G11").resultado, "no_evaluado");
  });
  prueba("Nexus G12: caducidad (vencida = no_cumple; sin fecha = no_evaluado)", () => {
    igual(regla(leccion({ vigencia: { caduca_en: "2026-11-06T11:59:00-06:00" } }), "G12").resultado, "no_cumple");
    igual(regla(leccion({ vigencia: {} }), "G12").resultado, "no_evaluado");
    igual(regla(leccion(), "G12").resultado, "cumple");
  });
  prueba("Nexus: el gerente es determinista (misma entrada y fecha → mismo resultado) y no modifica la lección", () => {
    const l = leccion(); const antes = jsonCanonico(l);
    igual(evaluarLeccion(l, { ahora: AHORA }), evaluarLeccion(clon(l), { ahora: AHORA }));
    igual(jsonCanonico(l), antes);
  });

  // ------------------------------------------------------------ registro que solo crece
  prueba("Nexus registro: alta, corrección y revisión conservan TODAS las versiones", async () => {
    let doc = registroVacio("lecciones", { es_demo: true });
    let r = await agregarLeccion(doc, leccion()); verdadero(r.ok, r.errores.join()); doc = r.doc;
    r = await agregarLeccion(doc, leccion({ revision: 2, tipo_cambio: "correccion", motivo_cambio: "Se corrige el enunciado.", enunciado: "Corregido.", registrado_en: "2026-11-02T10:00:00-06:00" }));
    verdadero(r.ok, r.errores.join()); doc = r.doc;
    const nx = await leerNexus({ lecciones: doc });
    igual(nx.errores, []);
    igual(nx.historial.get("lec-prueba-uno").map((v) => [v.revision, v.enunciado]), [[1, "Algo que se observó."], [2, "Corregido."]]);
    igual(nx.ultimas.get("lec-prueba-uno").revision, 2);
    igual(consultarLecciones(nx, { proyecto: "ek-chuah" }).length, 1, "consulta por proyecto destino");
    igual(consultarLecciones(nx, { texto: "corregido" }).length, 1);
    igual(consultarLecciones(nx, { nivel: "hipotesis" }).length, 0);
  });
  prueba("Nexus registro: rechaza saltar revisiones, repetir alta, fechas hacia atrás, mezclar DEMO/real y datos privados", async () => {
    const d0 = registroVacio("lecciones", { es_demo: true });
    const d1 = (await agregarLeccion(d0, leccion())).doc;
    for (const [nombre, v, doc] of [
      ["salto", leccion({ revision: 3, tipo_cambio: "correccion", motivo_cambio: "x" }), d1],
      ["alta repetida", leccion(), d1],
      ["revisión 2 sin existir 1", leccion({ revision: 2, tipo_cambio: "correccion", motivo_cambio: "x" }), d0],
      ["fecha hacia atrás", leccion({ revision: 2, tipo_cambio: "correccion", motivo_cambio: "x", registrado_en: "2026-10-01T00:00:00-06:00", fecha_conclusion: "2026-09-30T00:00:00-06:00" }), d1],
      ["real en registro DEMO", leccion({ es_demo: false }), d0],
      ["privado", leccion({ enunciado: "token=abcdef123456" }), d0],
      ["sin zona", leccion({ fecha_conclusion: "2026-11-01T09:00:00" }), d0],
    ]) {
      const r = await agregarLeccion(doc, v);
      verdadero(!r.ok && r.errores.length && r.doc === doc, `debió rechazar: ${nombre}`);
    }
    const retirada = (await agregarLeccion(d1, leccion({ revision: 2, tipo_cambio: "retiro", motivo_cambio: "Ya no aplica.", registrado_en: "2026-11-02T10:00:00-06:00" }))).doc;
    const tras = await agregarLeccion(retirada, leccion({ revision: 3, tipo_cambio: "correccion", motivo_cambio: "x", registrado_en: "2026-11-03T10:00:00-06:00" }));
    verdadero(!tras.ok, "no se revive una lección retirada");
    const nx = await leerNexus({ lecciones: retirada });
    igual([consultarLecciones(nx).length, nx.historial.get("lec-prueba-uno").length], [0, 2], "retirada: fuera de la consulta, en el historial");
  });
  prueba("Nexus registro: borrar, editar o reordenar el historial rompe la cadena de huellas y se detecta", async () => {
    let doc = registroVacio("lecciones", { es_demo: true });
    for (const v of [leccion(), leccion({ id: "lec-prueba-dos" }), leccion({ id: "lec-prueba-tres" })]) doc = (await agregarLeccion(doc, v)).doc;
    igual((await verificarCadena(doc.versiones)).ok, true);
    const borrado = { ...doc, versiones: [doc.versiones[0], doc.versiones[2]] };
    verdadero((await leerNexus({ lecciones: borrado })).errores.some((e) => e.includes("borró")), "borrado");
    const editado = clon(doc); editado.versiones[0].enunciado = "otro";
    verdadero(!(await verificarCadena(editado.versiones)).ok, "edición");
    const reorden = { ...doc, versiones: [doc.versiones[1], doc.versiones[0], doc.versiones[2]] };
    verdadero(!(await verificarCadena(reorden.versiones)).ok, "reorden");
    const r = await agregarLeccion(editado, leccion({ id: "lec-prueba-cuatro" }));
    verdadero(!r.ok && r.errores[0].includes("alterado"), "no se agrega sobre un historial alterado");
    // Quitar la última entrada no se detecta con la cadena: se documenta como limitación (copia de respaldo / git).
    igual((await verificarCadena(doc.versiones.slice(0, 2))).ok, true);
  });
  prueba("Nexus: la huella usa JSON canónico (el orden de las llaves no cambia la huella) y SHA-256 real", async () => {
    igual(await huellaDe({ a: 1, b: [1, { d: 2, c: 3 }] }), await huellaDe({ b: [1, { c: 3, d: 2 }], a: 1 }));
    igual(await sha256("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  // ------------------------------------------------------------ recomendaciones
  const ev = (secuencia, tipo, en, por, extra = {}) => ({ contrato: "cauce.recomendacion", version_contrato: "0.2.0", id: "rec-prueba-uno", secuencia, tipo, en, por, es_demo: true, ...extra });
  const propuesta = (por = H("proponente"), lecciones = [{ id: "lec-prueba-uno", revision: 1 }]) => ev(1, "propuesta", "2026-11-04T10:00:00-06:00", por, {
    contenido: { titulo: "Probar algo", descripcion: "Detalle", proyecto_destino: "ek-chuah", lecciones, reversible: true, criterio_exito: "Medir X antes y después." } });
  const revision = (secuencia = 2, dictamen = "sin_objeciones") => ev(secuencia, "revision", "2026-11-04T10:05:00-06:00", { tipo: "proceso", id: "gerente-esceptico" }, { dictamen });
  const aprobacion = (por = H("director"), secuencia = 3) => ev(secuencia, "aprobacion", "2026-11-04T11:00:00-06:00", por, { alcance: "experimento" });
  const bien = () => ({ estado: "sin_objeciones", motivo: "" });

  prueba("Nexus recomendación: ciclo completo propuesta → revisión → aprobación humana → experimento → resultado → adopción → despliegue", () => {
    const eventos = [propuesta(), revision(), aprobacion(),
      ev(4, "experimento", "2026-11-05T09:00:00-06:00", H("operador"), { plan: "Dos semanas en un piso." }),
      ev(5, "resultado", "2026-11-19T09:00:00-06:00", H("operador"), { conclusion: "mejora", evidencias: [{ tipo: "metrica", referencia: "ruta/resultado.csv", descripcion: "x" }] }),
      ev(6, "adopcion", "2026-11-20T09:00:00-06:00", H("director")),
      ev(7, "despliegue", "2026-11-21T09:00:00-06:00", H("director"), { referencia: "ek-chuah PR #123" })];
    const etapas = [];
    for (let i = 1; i <= eventos.length; i++) { const r = plegarRecomendacion(eventos.slice(0, i), { evaluarLeccionCitada: bien }); igual(r.errores, []); etapas.push(r.etapa); }
    igual(etapas, ["propuesta", "en_revision", "aprobada", "en_experimento", "con_resultado", "adoptada", "desplegada"]);
    const aprobada = plegarRecomendacion(eventos.slice(0, 3), { evaluarLeccionCitada: bien });
    igual([aprobada.implementada, aprobada.etiqueta], [false, "Aprobada por una persona · sin implementar"], "aprobada NO es implementada");
    igual(plegarRecomendacion(eventos.slice(0, 6), { evaluarLeccionCitada: bien }).implementada, false, "adoptada tampoco es desplegada");
    igual(plegarRecomendacion(eventos, { evaluarLeccionCitada: bien }).implementada, true);
  });
  prueba("Nexus recomendación: aprobar solo puede una PERSONA distinta de quien propone, tras revisión sin objeciones", () => {
    const fallo = (eventos, ctx = { evaluarLeccionCitada: bien }) => plegarRecomendacion(eventos, ctx).errores;
    verdadero(fallo([propuesta(), revision(), aprobacion({ tipo: "ia", id: "asistente" })]).some((e) => e.includes("solo una persona")), "IA aprueba");
    verdadero(fallo([propuesta(), revision(), aprobacion({ tipo: "proceso", id: "gerente-esceptico" })]).some((e) => e.includes("solo una persona")), "el gerente aprueba");
    verdadero(fallo([propuesta(), revision(), aprobacion(H("proponente"))]).some((e) => e.includes("propia")), "autoaprobación");
    verdadero(fallo([propuesta(), aprobacion(H("director"), 2)]).some((e) => e.includes("no se puede pasar")), "sin revisión");
    verdadero(fallo([propuesta(), revision(2, "incompleto"), aprobacion()]).some((e) => e.includes("incompleto")), "revisión incompleta");
    verdadero(fallo([propuesta(), revision(2, "con_objeciones"), aprobacion()]).some((e) => e.includes("con_objeciones")), "revisión con objeciones");
    const noEval = { evaluarLeccionCitada: () => ({ estado: "incompleto", motivo: "reglas G05" }) };
    verdadero(fallo([propuesta(), revision(), aprobacion()], noEval).some((e) => e.includes("Lo no evaluado nunca se aprueba")), "lección incompleta");
    const corregida = [propuesta(), revision(), ev(3, "correccion", "2026-11-04T10:30:00-06:00", H("proponente"), { nota: "cambio", contenido: propuesta().contenido }), aprobacion(H("director"), 4)];
    verdadero(fallo(corregida).some((e) => e.includes("no se puede pasar")), "una corrección exige revisar de nuevo");
    verdadero(fallo([propuesta(), ev(2, "revision", "2026-11-04T10:05:00-06:00", H("proponente"), { dictamen: "sin_objeciones" })]).some((e) => e.includes("propia")), "autorrevisión");
  });
  prueba("Nexus recomendación: sin saltos (experimento sin aprobar, adopción sin mejora, despliegue sin adopción, resultado sin pruebas)", () => {
    const base3 = [propuesta(), revision(), aprobacion()];
    const r = (extra) => plegarRecomendacion([...base3, ...extra], { evaluarLeccionCitada: bien }).errores;
    verdadero(plegarRecomendacion([propuesta(), revision(), ev(3, "experimento", "2026-11-05T09:00:00-06:00", H("o"), { plan: "x" })], { evaluarLeccionCitada: bien }).errores.length > 0, "experimento sin aprobar");
    verdadero(r([ev(4, "adopcion", "2026-11-05T09:00:00-06:00", H("director"))]).length > 0, "adopción sin experimento");
    verdadero(r([ev(4, "despliegue", "2026-11-05T09:00:00-06:00", H("director"), { referencia: "x" })]).length > 0, "despliegue sin adopción");
    const exp = ev(4, "experimento", "2026-11-05T09:00:00-06:00", H("o"), { plan: "x" });
    verdadero(r([exp, ev(5, "resultado", "2026-11-06T09:00:00-06:00", H("o"), { conclusion: "mejora", evidencias: [{ tipo: "afirmacion", descripcion: "funcionó" }] })]).length > 0, "resultado solo con afirmación");
    const sinEfecto = ev(5, "resultado", "2026-11-06T09:00:00-06:00", H("o"), { conclusion: "sin_efecto", evidencias: [{ tipo: "metrica", referencia: "r" }] });
    verdadero(r([exp, sinEfecto, ev(6, "adopcion", "2026-11-07T09:00:00-06:00", H("director"))]).some((e) => e.includes("mejora")), "adopción sin mejora");
    verdadero(r([ev(4, "experimento", "2026-11-03T09:00:00-06:00", H("o"), { plan: "x" })]).some((e) => e.includes("anterior")), "fecha hacia atrás");
    verdadero(validarEventoForma(ev(1, "propuesta", "2026-11-04T10:00:00", H("p"), { contenido: propuesta().contenido })).errores.some((e) => e.includes("zona")), "evento sin zona");
    verdadero(validarEventoForma(ev(3, "aprobacion", "2026-11-04T11:00:00-06:00", H("d"), { alcance: "adopcion" })).errores.length > 0, "fase 1: se aprueba experimentar, no adoptar");
    verdadero(Object.values(ETIQUETA_ETAPA).filter((t) => /sin implementar|sin desplegar/.test(t)).length === 2);
  });
  prueba("Nexus registro de recomendaciones: aprobación contra el registro real (lección vigente, sin objeciones; revisión desactualizada)", async () => {
    let L = registroVacio("lecciones", { es_demo: true });
    L = (await agregarLeccion(L, leccion())).doc;
    const mala = leccion({ id: "lec-prueba-mala", vigencia: {} });
    L = (await agregarLeccion(L, mala)).doc;
    let R = registroVacio("recomendaciones", { es_demo: true });
    const agregar = async (e) => { const r = await agregarEvento(R, e, L); if (r.ok) R = r.doc; return r; };
    verdadero((await agregar(propuesta())).ok);
    const nx = await leerNexus({ lecciones: L, recomendaciones: R });
    const rev = revisionDelGerente(nx, nx.recomendaciones[0], { en: "2026-11-04T10:05:00-06:00", secuencia: 2, es_demo: true });
    igual(rev.dictamen, "sin_objeciones");
    verdadero((await agregar(rev)).ok);
    verdadero(!(await agregar(aprobacion({ tipo: "ia", id: "x" }))).ok, "IA rechazada en el registro");
    verdadero((await agregar(aprobacion())).ok, "aprobación humana válida");
    // Otra recomendación sobre una lección incompleta: el gerente dice «incompleto» y la aprobación se bloquea.
    const p2 = { ...propuesta(H("proponente"), [{ id: "lec-prueba-mala", revision: 1 }]), id: "rec-prueba-dos" };
    verdadero((await agregar(p2)).ok);
    const nx2 = await leerNexus({ lecciones: L, recomendaciones: R });
    const rev2 = { ...revisionDelGerente(nx2, nx2.recomendaciones[1], { en: "2026-11-04T10:05:00-06:00", secuencia: 2, es_demo: true }) };
    igual(rev2.dictamen, "incompleto");
    verdadero((await agregar(rev2)).ok);
    const ap2 = await agregar({ ...aprobacion(), id: "rec-prueba-dos" });
    verdadero(!ap2.ok, "no se aprueba con una revisión incompleta");
    // Una revisión forjada a mano «sin objeciones» tampoco basta: se vuelve a evaluar la lección.
    const forjada = await agregar({ ...revision(3, "sin_objeciones"), id: "rec-prueba-dos" });
    verdadero(forjada.ok);
    const ap3 = await agregar({ ...aprobacion(H("director"), 4), id: "rec-prueba-dos" });
    verdadero(!ap3.ok && ap3.errores[0].includes("incompleto"), ap3.errores.join());
    // Si la lección citada cambia, la recomendación pendiente queda bloqueada por desactualizada.
    L = (await agregarLeccion(L, leccion({ revision: 2, tipo_cambio: "correccion", motivo_cambio: "x", registrado_en: "2026-11-05T10:00:00-06:00" }))).doc;
    const s = resumirNexus(await leerNexus({ lecciones: L, recomendaciones: R }), { ahora: AHORA });
    igual(s.errores, [], "la aprobación pasada sigue siendo válida en su fecha");
    igual(s.recomendaciones.find((r) => r.id === "rec-prueba-uno").etapa, "aprobada");
    verdadero(s.recomendaciones.find((r) => r.id === "rec-prueba-dos").bloqueos.length > 0);
  });

  // ------------------------------------------------------------ datos de prueba y regresión
  prueba("Nexus: los registros de prueba guardados coinciden con los que genera herramientas/nexus-demo.mjs", async () => {
    const { lecciones, recomendaciones } = await construirDemo();
    igual(JSON.parse(await leerTexto("datos/nexus/demo/lecciones.json")), lecciones);
    igual(JSON.parse(await leerTexto("datos/nexus/demo/recomendaciones.json")), recomendaciones);
  });
  prueba("Nexus: datos de prueba — dictámenes esperados, todo marcado DEMO y sin errores de historial", async () => {
    const L = JSON.parse(await leerTexto("datos/nexus/demo/lecciones.json"));
    const R = JSON.parse(await leerTexto("datos/nexus/demo/recomendaciones.json"));
    const s = resumirNexus(await leerNexus({ lecciones: L, recomendaciones: R }), { ahora: AHORA });
    igual(s.errores, []);
    verdadero(s.es_demo && L.versiones.every((v) => v.es_demo === true && v.titulo.startsWith("[DEMO]")) && R.eventos.every((e) => e.es_demo === true));
    const d = Object.fromEntries(s.lecciones.map((x) => [x.leccion.id, x.evaluacion.dictamen.estado]));
    igual(d, { "lec-demo-compago-fotos": "sin_objeciones", "lec-demo-ek-chuah-backtest": "con_objeciones", "lec-demo-tezca-local": "con_objeciones",
      "lec-demo-tezca-forma": "con_objeciones", "lec-demo-cauce-una-pantalla": "sin_objeciones", "lec-demo-compago-resenas": "incompleto" });
    igual(s.cifras, { lecciones: 6, sin_objeciones: 2, incompletas: 1, con_objeciones: 3, pendientes: 2, aprobadas_sin_implementar: 1, desplegadas: 0 });
    igual(s.recomendaciones.map((r) => [r.id, r.etapa, r.bloqueos.length > 0]), [["rec-demo-fotos-montambre", "en_revision", false], ["rec-demo-medias-ek-chuah", "en_revision", true], ["rec-demo-sala-compago", "aprobada", false]]);
    verdadero(s.alertas.some((a) => a.regla.id === "G07") && s.alertas.some((a) => a.regla.id === "G11") && s.alertas.some((a) => a.regla.id === "G08"));
  });
  prueba("Nexus regresión: no toca cauce.estado-proyecto 1.0.0 ni el registro de pisos", async () => {
    const contrato = await leerTexto("contrato/CONTRATO.md");
    verdadero(contrato.includes("`cauce.estado-proyecto` · versión 1.0.0"));
    const pisos = JSON.parse(await leerTexto("datos/proyectos.json"));
    verdadero(!pisos.proyectos.some((p) => /nexus/i.test(`${p.id} ${p.nombre}`)), "Nexus no es un piso del contrato v1");
    for (const ruta of ["app/nexus/comun.js", "app/nexus/leccion.js", "app/nexus/gerente.js", "app/nexus/recomendacion.js", "app/nexus/registro.js"]) {
      const t = await leerTexto(ruta);
      verdadero(!/from "\.\.\/nucleo\//.test(t), `${ruta} no debe depender del núcleo del contrato v1`);
      verdadero(!/\bfetch\(|XMLHttpRequest|WebSocket|localStorage|Math\.random/.test(t), `${ruta}: sin red, sin almacenamiento del navegador y sin azar`);
    }
  });
}
