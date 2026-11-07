// Nexus fase 1.5: brechas del gerente (bloque E), integridad del historial (C), aprobación con identidad declarada (D),
// importación al almacén real y candidatas Ek Chuah (B). Corre en Node y en pruebas.html. Cada prueba de brecha falló
// con el código de la fase 1 y pasa con el de la 1.5 (se indica «brecha»); las demás confirman lo que ya existía.

import { prueba, igual, verdadero } from "./mini.js";
import { leccion } from "./casos-nexus.js";
import { huellaDe, sha256 } from "../app/nexus/comun.js";
import { validarLeccion } from "../app/nexus/leccion.js";
import { evaluarLeccion, buscarEstrategia } from "../app/nexus/gerente.js";
import { evaluarRecomendacion, validarPaso } from "../app/nexus/recomendacion.js";
import { leerNexus, agregarLeccion, registroVacio, resumirNexus, admisionReal, contextoGerente } from "../app/nexus/registro.js";
import { sellar, verificarContinuidad, verificarManifiesto, anclaDe, verificarAncla, relacionRegistros, indiceRespaldo } from "../app/nexus/integridad.js";
import { revisarDecision, validarPolitica } from "../app/nexus/identidad.js";
import { construirDemo } from "../app/nexus/demo.js";

const AHORA = Date.parse("2026-11-06T12:00:00-06:00");
const clon = (x) => JSON.parse(JSON.stringify(x));
const regla = (l, id, ctx = {}) => evaluarLeccion(l, { ahora: AHORA, ...ctx }).reglas.find((r) => r.id === id);
const H = (id) => ({ tipo: "humano", identificador: id });
const POLITICA = { contrato: "cauce.nexus.politica", version_contrato: "0.2", aprobadores_declarados: ["diego"], autenticacion: "ninguna" };
/** Almacén real con una lección admisible (la de casos-nexus.js: revisión ajena de «revisor» y commit). */
async function almacen(n = 1) {
  let doc = registroVacio("lecciones");
  for (let i = 0; i < n; i++) {
    const r = await agregarLeccion(doc, { registro: leccion({ id: `real-${i + 1}` }), registrado_en: `2026-10-28T12:0${i}:00-06:00`, registrado_por: H("diego") });
    if (!r.ok) throw new Error(r.errores.join(" "));
    doc = r.doc;
  }
  return { lecciones: doc, recomendaciones: registroVacio("recomendaciones") };
}
const sellarYa = (man, docs, en = "2026-10-29T10:00:00-06:00") => sellar(man, docs, { sellado_en: en, sellado_por: H("diego") });

export function registrarCasosNexus15(leerTexto) {
  // ------------------------------------------------------------ E. gerente escéptico
  prueba("Nexus 1.5 E: 9/10 con un «no_evaluado» → incompleto; la recomendación no es aprobable y el paso a aprobada se rechaza", async () => {
    const l = leccion({ id: "nueve" });
    l.evidencia[0].conocido_en = null; // solo R04 queda sin evaluar
    const ev = evaluarLeccion(l, { ahora: AHORA });
    igual([ev.reglas.filter((r) => r.estado === "cumple").length, ev.dictamen.estado, ev.dictamen.no_evaluado], [9, "incompleto", ["R04"]]);
    const { recomendaciones } = await construirDemo();
    const ap = recomendaciones.entradas.filter((e) => e.registro.id === "demo-rec-duplicados-compago");
    const pend = ap.at(-2).registro, aprobada = ap.at(-1).registro;
    const lecciones = new Map([[l.id, l]]);
    const nueva = { ...clon(aprobada), lecciones: [{ id: l.id, revision: "r2" }] };
    const base = { ...clon(pend), lecciones: nueva.lecciones };
    verdadero(!evaluarRecomendacion(nueva, { lecciones, ahora: AHORA }).aprobable);
    verdadero(validarPaso(base, nueva, { lecciones, ahora: AHORA }).some((t) => /Lo no evaluado nunca se aprueba/.test(t)));
  });
  prueba("Nexus 1.5 E: las reglas que no aplican se listan aparte con su motivo (no se esconden como «cumple»)", () => {
    const ev = evaluarLeccion(leccion(), { ahora: AHORA });
    igual(ev.dictamen.no_aplica, ["R06", "R10"]);
    igual(ev.dictamen.cumplen, 8);
    verdadero(ev.reglas.filter((r) => !r.aplica).every((r) => r.motivo.length > 20));
  });
  prueba("Nexus 1.5 E (brecha): una revisión humana ajena que OBJETA no cuenta como respaldo (R01)", () => {
    const l = leccion();
    l.revisiones[1].decision = "rechazada";
    igual(regla(l, "R01").estado, "no_cumple");
    l.revisiones[1].decision = "objeciones: falta la prueba";
    igual(regla(l, "R01").estado, "no_cumple");
  });
  prueba("Nexus 1.5 E (brecha): si la evidencia cambia después de la revisión ajena, hace falta revisión nueva", async () => {
    const v1 = leccion();
    let doc = (await agregarLeccion(registroVacio("lecciones"), { registro: v1, registrado_en: "2026-10-28T12:00:00-06:00", registrado_por: H("autora") })).doc;
    const v2 = clon(v1);
    v2.evidencia[0].referencia = "pruebas/caso-2"; // cambia lo que se revisó
    v2.revisiones.push({ fecha: "2026-10-29T10:00:00-06:00", autor_tipo: "humano", autor: "autora", decision: "propuesta", justificacion: "Cambio la evidencia.", version: "r3" });
    doc = (await agregarLeccion(doc, { registro: v2, registrado_en: "2026-10-29T10:05:00-06:00", registrado_por: H("autora") })).doc;
    let nx = await leerNexus({ lecciones: doc, recomendaciones: null });
    let s = resumirNexus(nx, { ahora: AHORA });
    const r01 = s.lecciones[0].evaluacion.reglas.find((r) => r.id === "R01");
    igual(r01.estado, "no_evaluado");
    verdadero(/cambió después/.test(r01.motivo));
    // Sin el historial del registro (la misma lección suelta) seguiría «cumple»: por eso el registro calcula desde dónde.
    igual(regla(v2, "R01").estado, "cumple");
    const v3 = clon(v2);
    v3.revisiones.push({ fecha: "2026-10-30T10:00:00-06:00", autor_tipo: "humano", autor: "revisor", decision: "revisada", justificacion: "Revisé la nueva evidencia.", version: "r4" });
    doc = (await agregarLeccion(doc, { registro: v3, registrado_en: "2026-10-30T10:05:00-06:00", registrado_por: H("revisor") })).doc;
    nx = await leerNexus({ lecciones: doc, recomendaciones: null });
    s = resumirNexus(nx, { ahora: AHORA });
    igual(s.lecciones[0].evaluacion.reglas.find((r) => r.id === "R01").estado, "cumple");
  });
  prueba("Nexus 1.5 E (brecha): una recomendación no vuelve como evidencia de su propia lección (R03) ni es fuente primaria (R02)", () => {
    const origen = leccion({ id: "origen-a" });
    const rec = { id: "rec-x", lecciones: [{ id: "origen-a", revision: "r2" }] };
    const l = clon(origen);
    l.evidencia.push({ ...clon(l.evidencia[0]), tipo: "resultado_experimento", referencia: "recomendacion:rec-x", sha256: "b".repeat(64) });
    const ctx = { lecciones: new Map([[l.id, l]]), recomendaciones: new Map([["rec-x", rec]]) };
    igual(regla(l, "R03", ctx).estado, "no_cumple");
    verdadero(/nació de esta lección/.test(regla(l, "R03", ctx).motivo));
    const solo = clon(origen);
    solo.evidencia = [{ ...clon(origen.evidencia[0]), referencia: "recomendacion:rec-x" }];
    igual(regla(solo, "R02", ctx).estado, "no_cumple");
    igual(regla(l, "R03", { lecciones: ctx.lecciones }).estado, "no_evaluado"); // recomendación desconocida: no se descarta
  });
  prueba("Nexus 1.5 E (brecha): una lección refutada no respalda nada (R05)", () => {
    igual(regla(leccion({ validacion: { estado: "refutada", validado_en: [] } }), "R05").estado, "no_cumple");
  });
  prueba("Nexus 1.5 E (brecha): confianza media en un efecto sin n_efectivo → no evaluado (muestras dependientes)", () => {
    const l = leccion();
    Object.assign(l.muestra, { n: 88, n_independiente: 62, unidad_independencia: "partido", n_efectivo: null, naturaleza: "real_historica" });
    l.confianza = { nivel: "media", objeto: "efecto_operativo", justificacion: "x" };
    igual(regla(l, "R08").estado, "no_evaluado");
  });
  prueba("Nexus 1.5 E: IA que se revisa a sí misma o IA ajena no cuentan como revisión humana independiente", () => {
    const l = leccion({ autor: { tipo: "ia", identificador: "asistente" } });
    l.revisiones = [{ ...l.revisiones[0], autor_tipo: "ia", autor: "asistente" }, { ...l.revisiones[1], autor_tipo: "ia", autor: "otra-ia" }];
    igual(regla(l, "R01").estado, "no_evaluado");
  });

  // ------------------------------------------------------------ C. integridad
  prueba("Nexus 1.5 C: sello íntegro; entradas nuevas sin sellar son aviso, no alteración", async () => {
    const docs = await almacen(2);
    const s = await sellarYa(null, docs);
    verdadero(s.ok);
    igual((await verificarContinuidad(docs, s.doc)).estado, "integro");
    const mas = await agregarLeccion(docs.lecciones, { registro: leccion({ id: "real-3" }), registrado_en: "2026-10-30T12:00:00-06:00", registrado_por: H("diego") });
    const v = await verificarContinuidad({ ...docs, lecciones: mas.doc }, s.doc);
    igual([v.estado, v.ok], ["sin_sellar", true]);
  });
  prueba("Nexus 1.5 C: truncar el final se detecta (la cadena sola no lo veía) y no se puede sellar encima", async () => {
    const docs = await almacen(3);
    const s = await sellarYa(null, docs);
    const truncado = { ...docs, lecciones: { ...docs.lecciones, entradas: docs.lecciones.entradas.slice(0, 2) } };
    const { ok: cadenaOk } = await (await import("../app/nexus/registro.js")).verificarCadena(truncado.lecciones.entradas);
    verdadero(cadenaOk, "la cadena truncada sigue siendo válida: por eso hace falta el manifiesto");
    const v = await verificarContinuidad(truncado, s.doc);
    igual([v.estado, v.ok], ["truncado", false]);
    verdadero(!(await sellarYa(s.doc, truncado, "2026-10-30T10:00:00-06:00")).ok);
  });
  prueba("Nexus 1.5 C: reescribir la última entrada (recalculando la cadena) se detecta como «reescrito»", async () => {
    const docs = await almacen(2);
    const s = await sellarYa(null, docs);
    const otra = clon(docs.lecciones);
    otra.entradas[1].registro.hallazgo = "Otra cosa.";
    const v = await verificarContinuidad({ ...docs, lecciones: otra }, s.doc);
    igual(v.estado, "reescrito");
  });
  prueba("Nexus 1.5 C: duplicar una entrada rompe la cadena o el paso de versiones", async () => {
    const docs = await almacen(2);
    const dup = clon(docs.lecciones);
    dup.entradas.push(clon(dup.entradas[1]));
    igual((await verificarContinuidad({ ...docs, lecciones: dup }, null)).estado, "registro_alterado");
    dup.entradas[2].huella_anterior = await huellaDe(dup.entradas[1]); // aun con la huella «correcta»
    dup.entradas[2].registrado_en = "2026-10-29T12:00:00-06:00";
    verdadero((await leerNexus({ lecciones: dup, recomendaciones: null })).errores.some((t) => /solo se puede anexar/.test(t)));
  });
  prueba("Nexus 1.5 C: el manifiesto es una cadena; quitarle el último sello lo delata el ancla guardada fuera", async () => {
    const docs = await almacen(1);
    let m = (await sellarYa(null, docs)).doc;
    const mas = await agregarLeccion(docs.lecciones, { registro: leccion({ id: "real-2" }), registrado_en: "2026-10-30T12:00:00-06:00", registrado_por: H("diego") });
    const docs2 = { ...docs, lecciones: mas.doc };
    m = (await sellarYa(m, docs2, "2026-10-30T13:00:00-06:00")).doc;
    const ancla = await anclaDe(m);
    verdadero(/^2:[0-9a-f]{16}$/.test(ancla));
    igual((await verificarAncla(m, ancla)).ok, true);
    // Atacante torpe: quita la última lección Y el último sello. La continuidad no lo ve; el ancla sí.
    const m1 = { ...m, sellos: m.sellos.slice(0, 1) };
    igual((await verificarContinuidad(docs, m1)).estado, "integro");
    verdadero(/le quitaron sellos/.test((await verificarAncla(m1, ancla)).motivo));
    const editado = clon(m); editado.sellos[0].registros.lecciones.n = 5;
    verdadero(!(await verificarManifiesto(editado)).ok);
    igual((await verificarContinuidad(docs2, editado)).estado, "manifiesto_alterado");
  });
  prueba("Nexus 1.5 C: relación entre registros para restaurar (igual, más nuevo, truncado, divergen)", async () => {
    const a = (await almacen(2)).lecciones, b = (await almacen(1)).lecciones;
    igual(await relacionRegistros(a, a), "igual");
    igual(await relacionRegistros(a, b), "a_amplia_b");
    igual(await relacionRegistros(b, a), "a_truncado");
    const c = clon(a); c.entradas[0].registro.hallazgo = "Distinto.";
    igual(await relacionRegistros(c, a), "divergen");
  });
  prueba("Nexus 1.5 C: índice de respaldo con huellas por archivo; un archivo cambiado se nota", async () => {
    const ind = await indiceRespaldo({ "lecciones.json": "{\"a\":1}\n" }, { creado_en: "2026-11-06T12:00:00-06:00", creado_por: H("diego"), motivo: "prueba" }, sha256);
    igual(ind.creado_por.autenticacion, "declarada");
    igual(ind.archivos["lecciones.json"], await sha256("{\"a\":1}\n"));
    verdadero(ind.archivos["lecciones.json"] !== (await sha256("{\"a\":2}\n")));
  });

  // ------------------------------------------------------------ D. aprobación humana con identidad declarada
  prueba("Nexus 1.5 D: política de aprobadores (alias, sin correos, autenticación «ninguna»)", async () => {
    igual(validarPolitica(POLITICA), []);
    igual(validarPolitica(JSON.parse(await leerTexto("datos/nexus/politica.json"))), []);
    verdadero(validarPolitica({ ...POLITICA, aprobadores_declarados: ["diego@correo.mx"] }).length > 0);
    verdadero(validarPolitica({ ...POLITICA, autenticacion: "cauceservice" }).length > 0);
  });
  prueba("Nexus 1.5 D: en el almacén real solo decide un aprobador declarado, registrándolo él mismo, con motivo", () => {
    const ant = { estado: "pendiente_aprobacion" };
    const nueva = (autor, motivo = "Revisé las 10 reglas.") => ({ estado: "aprobada", decision_humana: { responsable: autor, fecha: "2026-11-06T12:00:00-06:00" }, historial: [{ evento: "aprobada", autor_tipo: "humano", autor, motivo }] });
    const sobre = (id) => ({ registrado_por: H(id) });
    igual(revisarDecision(ant, nueva("diego"), sobre("diego"), { politica: POLITICA }), []);
    verdadero(revisarDecision(ant, nueva("diego"), sobre("diego"), { politica: null }).some((t) => /política/.test(t)));
    verdadero(revisarDecision(ant, nueva("ronny"), sobre("ronny"), { politica: POLITICA }).some((t) => /no está entre los aprobadores/.test(t)));
    verdadero(revisarDecision(ant, nueva("diego"), sobre("otra-persona"), { politica: POLITICA }).some((t) => /debe ser la persona que decide/.test(t)));
    verdadero(revisarDecision(ant, nueva("diego", ""), sobre("diego"), { politica: POLITICA }).some((t) => /motivo/.test(t)));
    verdadero(revisarDecision(ant, { ...nueva("diego"), historial: [{ evento: "rechazada", autor_tipo: "ia", autor: "diego", motivo: "x" }], estado: "rechazada" }, sobre("diego"), { politica: POLITICA }).some((t) => /persona/.test(t)));
    igual(revisarDecision(ant, nueva("director-demo"), sobre("director-demo"), { es_demo: true }), []); // los datos de prueba no usan la política real
  });
  prueba("Nexus 1.5 D: una entrada no puede decir «autenticada» (no hay verificador)", async () => {
    const r = await agregarLeccion(registroVacio("lecciones"), { registro: leccion(), registrado_en: "2026-10-28T12:00:00-06:00", registrado_por: { tipo: "humano", identificador: "diego", autenticacion: "autenticada" } });
    verdadero(!r.ok && r.errores.some((t) => /autenticacion «autenticada» no se admite/.test(t)));
    verdadero((await agregarLeccion(registroVacio("lecciones"), { registro: leccion(), registrado_en: "2026-10-28T12:00:00-06:00", registrado_por: { tipo: "humano", identificador: "diego", autenticacion: "declarada" } })).ok);
  });
  prueba("Nexus 1.5 D (brecha): aprobada ≠ ejecutada; registrar una ejecución exige persona y referencia externa", async () => {
    const { recomendaciones, lecciones } = await construirDemo();
    const nx = await leerNexus({ lecciones, recomendaciones });
    const ap = nx.recomendaciones.find((x) => x.registro.id === "demo-rec-duplicados-compago").registro;
    const ejec = (autor_tipo, resultados) => ({ ...clon(ap), ejecucion: { estado: "ejecutada", resultados }, historial: [...ap.historial, { evento: "ejecucion_registrada", fecha: "2026-11-06T13:00:00-06:00", autor_tipo, autor: "x" }] });
    const ctx = contextoGerente(nx, AHORA);
    verdadero(validarPaso(ap, ejec("ia", [{ referencia: "informe-1" }]), ctx).some((t) => /solo lo registra una persona/.test(t)));
    verdadero(validarPaso(ap, ejec("humano", []), ctx).some((t) => /resultados con referencia/.test(t)));
    igual(validarPaso(ap, ejec("humano", [{ referencia: "informe-1" }]), ctx).filter((t) => /ejecuci/.test(t)), []);
  });

  // ------------------------------------------------------------ B. importación y candidatas Ek Chuah
  prueba("Nexus 1.5 B: admisión al almacén real — contrato, procedencia verificable y revisión humana ajena", () => {
    igual(admisionReal(leccion(), { ahora: AHORA }).admisible, true);
    const sinRevisor = leccion(); sinRevisor.revisiones = sinRevisor.revisiones.slice(0, 1);
    verdadero(admisionReal(sinRevisor, { ahora: AHORA }).motivos.some((t) => /R01/.test(t)));
    const sinCommit = leccion(); delete sinCommit.evidencia[0].commit; delete sinCommit.evidencia[0].sha256;
    verdadero(admisionReal(sinCommit, { ahora: AHORA }).motivos.some((t) => /no verificable/.test(t)));
    verdadero(admisionReal(leccion({ id: "demo-x" }), { ahora: AHORA }).motivos.some((t) => /demo/.test(t)));
    verdadero(admisionReal(leccion(), { ahora: AHORA, registrado_por: { tipo: "ia", identificador: "x" } }).motivos.some((t) => /solo una persona/.test(t)));
  });
  prueba("Nexus 1.5 B: el almacén real rechaza la primera versión no admisible pero acepta versiones siguientes que la objetan", async () => {
    const sinRevisor = leccion(); sinRevisor.revisiones = sinRevisor.revisiones.slice(0, 1);
    const r = await agregarLeccion(registroVacio("lecciones"), { registro: sinRevisor, registrado_en: "2026-10-28T12:00:00-06:00", registrado_por: H("autora") });
    verdadero(!r.ok && /candidata/.test(r.errores[0]));
    const docs = await almacen(1);
    const objeta = clon(docs.lecciones.entradas[0].registro);
    objeta.revisiones.push({ fecha: "2026-10-30T10:00:00-06:00", autor_tipo: "humano", autor: "diego", decision: "objeciones", justificacion: "No reproduje la prueba.", version: "r3" });
    verdadero((await agregarLeccion(docs.lecciones, { registro: objeta, registrado_en: "2026-10-30T10:05:00-06:00", registrado_por: H("diego") })).ok);
  });
  prueba("Nexus 1.5 B: candidatas EK-L001/L003/L007 — cumplen el contrato, confianza baja, sin validar, sin finanzas, y NO son admisibles", async () => {
    const ind = JSON.parse(await leerTexto("datos/nexus/candidatas/indice.json"));
    igual(ind.archivos, ["ek-chuah/EK-L001.json", "ek-chuah/EK-L003.json", "ek-chuah/EK-L007.json"]);
    for (const a of ind.archivos) {
      const l = JSON.parse(await leerTexto(`datos/nexus/candidatas/${a}`));
      igual(validarLeccion(l).errores, [], a);
      igual([l.origen.proyecto, l.origen.tipo, l.confianza.nivel, l.confianza.objeto, l.validacion.estado, l.validacion.validado_en.length], ["ek-chuah", "texto_ia", "baja", "metodo", "propuesta", 0], a);
      verdadero(l.evidencia.every((e) => e.tipo === "inventario_ia" && e.reproduccion_independiente === null), `${a}: solo inventario, sin reproducción`);
      verdadero(!["backtest", "simulacion", "resultado_operativo_real"].includes(l.muestra.naturaleza_resultado) && buscarEstrategia(l).length === 0, `${a}: sin resultados financieros ni estrategia`);
      verdadero(/PENDIENTE/.test(l.origen.componente) && /PENDIENTE/.test(l.origen.version_sistema), `${a}: lo desconocido es explícito`);
      const adm = admisionReal(l, { ahora: AHORA });
      verdadero(!adm.admisible && adm.motivos.some((t) => /R01/.test(t)) && adm.motivos.some((t) => /R02/.test(t)), `${a}: fuera del almacén real`);
    }
    verdadero(/Qué NO enviar/.test(await leerTexto("datos/nexus/candidatas/ek-chuah/EVIDENCIAS-PENDIENTES.md")));
  });
  prueba("Nexus 1.5 regresión: módulos nuevos sin red, almacenamiento ni azar; contrato v1 intacto", async () => {
    for (const ruta of ["app/nexus/integridad.js", "app/nexus/identidad.js"]) {
      const t = await leerTexto(ruta);
      verdadero(!/from "\.\.\/nucleo\//.test(t) && !/\bfetch\(|XMLHttpRequest|WebSocket|localStorage|Math\.random/.test(t), ruta);
    }
  });
}
