// Estaciones de trabajo dentro de las oficinas existentes (Observatorio en Ek Chuah, Oportunidades Internacionales
// en Compago). Corre en Node y en pruebas.html (sin Three.js).
//
// Qué se demuestra: que una función nueva NO crea piso ni departamento; que el contrato v1 no cambia (la extensión es
// otro contrato versionado, cauce.estaciones 0.1); que nadie «trabaja» sin evidencia; que DEMO y REAL no se mezclan;
// que una transferencia entre oficinas solo se ve confirmada si las dos partes la registran; que la estación cabe
// delante de los escritorios sin moverlos ni cruzarse con caminos o decoración; y que no se muestran importes ni
// conclusiones comerciales.

import { prueba, igual, verdadero } from "./mini.js";
import {
  ESTADOS_ESTACION, NOMBRES_ESTADOS_ESTACION, leerDisposicionEstaciones, validarEstaciones, construirEstaciones,
  cruzarEnlace, aplicarEstaciones, estadoDeEstacion, idPersonaje, firmaEstaciones,
} from "../app/nucleo/estaciones.js";
import { validarDocumento } from "../app/nucleo/contrato.js";
import { construirModeloVista } from "../app/nucleo/modelo.js";
import { validarRegistro } from "../app/nucleo/registro.js";
import { leerConfiguracion } from "../app/configuracion.js";
import { ANIMACIONES_SOPORTADAS, BUCLES, planDeTransicion } from "../app/vistas/vista3d/maquina.js";
import { tamanoCuarto, puestos, lugaresEstaciones, camino, caminoChoca } from "../app/vistas/vista3d/disposicion.js";
import { distribuirEdificio } from "../app/vistas/vista3d/plano-edificio.js";
import { planInterior } from "../app/vistas/vista3d/interiores.js";
import { obstaculosCuarto, rectDe, seTocan } from "../app/vistas/vista3d/zonas-cuarto.js";

const copia = (x) => JSON.parse(JSON.stringify(x));
const ok = (datos) => ({ tipo: "ok", datos });
const AHORA = new Date("2026-11-08T18:00:00Z");

export function registrarCasosEstaciones(leerTexto) {
  const leerJSON = async (ruta) => JSON.parse(await leerTexto(ruta));
  const datos = async () => ({
    escEk: await leerJSON("escena/ek-chuah.json"), escCo: await leerJSON("escena/compago.json"),
    demoEk: await leerJSON("datos/demo/ek-chuah-estaciones.json"), demoCo: await leerJSON("datos/demo/compago-estaciones.json"),
    v1Ek: await leerJSON("datos/demo/ek-chuah.json"), v1Co: await leerJSON("datos/demo/compago.json"),
  });
  /** Estación de demostración ya construida (como la ve la página). */
  const construir = (esc, demo, proyectoId, extra = {}) =>
    construirEstaciones({ disposicion: leerDisposicionEstaciones(esc), carga: ok(demo), origen: "demo", ahora: AHORA, proyectoId, ...extra });
  /** Documento real (es_demo false) a partir de la demo, con la hora de ahora. */
  const comoReal = (demo, generado = AHORA.toISOString().replace(/\.\d+Z$/, "Z")) => {
    const d = copia(demo);
    d.es_demo = false; delete d.demo; d.fuente = { tipo: "adaptador", nombre: "exportador de prueba" }; d.generado_en = generado;
    return d;
  };

  // ------------------------------------------------------------------ Regla de arquitectura
  prueba("Estaciones · regla de arquitectura: Ek Chuah y Compago tienen una estación cada uno DENTRO de un departamento que ya existe; ningún piso ni departamento nuevo", async () => {
    const { escEk, escCo } = await datos();
    const reg = await leerJSON("datos/proyectos.json");
    igual(reg.proyectos.length, 7, "mismo número de pisos");
    igual(Object.keys(escEk.departamentos).length, 6, "Ek Chuah sigue con 6 departamentos");
    igual(Object.keys(escCo.departamentos).length, 7, "Compago sigue con 7 departamentos");
    const ek = leerDisposicionEstaciones(escEk), co = leerDisposicionEstaciones(escCo);
    igual(ek.map((e) => [e.id, e.departamento, e.puestos.length]), [["observatorio", "riesgo", 3]]);
    igual(co.map((e) => [e.id, e.departamento, e.puestos.length]), [["internacional", "oportunidades", 3]]);
    verdadero(escEk.departamentos.riesgo && escCo.departamentos.oportunidades, "los anfitriones existen");
    igual(ek[0].puestos.map((p) => p.id), ["macro", "geopolitico", "riesgos"]);
    igual(co[0].puestos.map((p) => p.id), ["investigador", "importacion", "evaluador"]);
  });
  prueba("Estaciones · el contrato v1 NO cambia: mismos archivos de estado válidos y un campo «estaciones» dentro de un v1 se ignora (nunca llega a la pantalla)", async () => {
    const { v1Ek, v1Co } = await datos();
    for (const d of [v1Ek, v1Co]) verdadero(validarDocumento(d).valido, "demo v1 válida");
    const con = copia(v1Ek); con.estaciones = [{ id: "x" }];
    const r = validarDocumento(con);
    verdadero(r.valido && !("estaciones" in r.documento), "el v1 no conoce estaciones");
    const contrato = await leerTexto("contrato/CONTRATO.md");
    verdadero(contrato.includes("versión 1.0.0"), "CONTRATO.md sigue en 1.0.0");
  });
  prueba("Estaciones · disposición mal escrita: sin departamento, sin puestos o con puestos repetidos se omite con aviso (no se inventa un cuarto)", () => {
    const avisos = [];
    const r = leerDisposicionEstaciones({ estaciones: {
      a: { nombre: "Sin anfitrión", puestos: [{ id: "p", funcion: "F" }] },
      b: { nombre: "Sin puestos", departamento: "riesgo", puestos: [] },
      c: { nombre: "Repetidos", departamento: "riesgo", puestos: [{ id: "p", funcion: "F" }, { id: "p", funcion: "G" }] },
      d: { nombre: "Buena", departamento: "riesgo", puestos: [{ id: "p", funcion: "F" }], enlace: { proyecto: "x" } },
    } }, avisos);
    igual(r.map((e) => e.id), ["d"]);
    igual(r[0].enlace, null, "enlace incompleto se ignora");
    igual(avisos.length, 4);
    igual(leerDisposicionEstaciones(null), []);
    igual(leerDisposicionEstaciones({ departamentos: {} }), [], "sin bloque, sin estaciones");
  });

  // ------------------------------------------------------------------ Contrato cauce.estaciones 0.1
  prueba("Estaciones · contrato 0.1: las dos demostraciones son válidas, marcadas DEMO y con textos [DEMO]", async () => {
    const { demoEk, demoCo } = await datos();
    for (const d of [demoEk, demoCo]) {
      const r = validarEstaciones(d);
      verdadero(r.valido, r.errores.join(" "));
      igual(r.avisos, []);
      verdadero(r.documento.es_demo && r.documento.fuente.tipo === "demo");
      for (const e of r.documento.estaciones) for (const p of e.puestos) if (p.nota) verdadero(p.nota.startsWith("[DEMO]"), p.nota);
    }
  });
  prueba("Estaciones · contrato 0.1: rechaza otro contrato, otra versión mayor/menor, fechas sin Z, demo sin hora simulada y fuente que no coincide", async () => {
    const { demoEk } = await datos();
    const malo = (f) => { const d = copia(demoEk); f(d); return validarEstaciones(d).valido; };
    verdadero(!malo((d) => { d.contrato = "cauce.estado-proyecto"; }));
    verdadero(!malo((d) => { d.version = "1.0.0"; }));
    verdadero(!malo((d) => { d.version = "0.2.0"; }));
    verdadero(malo((d) => { d.version = "0.1.7"; }), "0.1.x se acepta");
    verdadero(!malo((d) => { d.generado_en = "2026-11-03T16:28:00"; }));
    verdadero(!malo((d) => { delete d.demo; }));
    verdadero(!malo((d) => { d.fuente.tipo = "adaptador"; }));
    verdadero(!malo((d) => { d.vigencia_segundos = 5; }));
    verdadero(!malo((d) => { d.estaciones = []; }));
    verdadero(!malo((d) => { d.estaciones.push(copia(d.estaciones[0])); }), "id repetido");
  });
  prueba("Estaciones · regla de oro: «en_proceso» sin evidencia o sin inicio se muestra «Sin información»; con ambos, en proceso", async () => {
    const { demoEk } = await datos();
    const d = copia(demoEk);
    d.estaciones[0].puestos[0] = { id: "macro", estado: "en_proceso" };
    d.estaciones[0].puestos[1] = { id: "geopolitico", estado: "en_proceso", evidencia: { origen: "ingesta", referencia: "corrida 12" } };
    d.estaciones[0].puestos[2] = { id: "riesgos", estado: "en_proceso", inicio: "2026-11-03T16:00:00Z", evidencia: { origen: "ingesta", referencia: "corrida 12" } };
    const r = validarEstaciones(d);
    igual(r.documento.estaciones[0].puestos.map((p) => p.estado), ["sin_informacion", "sin_informacion", "en_proceso"]);
    igual(r.avisos.length, 2);
    verdadero(r.documento.estaciones[0].puestos[0].notas.length === 1, "la corrección se anota");
  });
  prueba("Estaciones · un estado desconocido o «sin_informacion» escrito por el sistema se muestra «Sin información» con aviso", async () => {
    const { demoEk } = await datos();
    const d = copia(demoEk);
    d.estaciones[0].puestos[0].estado = "trabajando";
    d.estaciones[0].puestos[1].estado = "sin_informacion";
    const r = validarEstaciones(d);
    igual(r.documento.estaciones[0].puestos.slice(0, 2).map((p) => p.estado), ["sin_informacion", "sin_informacion"]);
    igual(r.avisos.length, 2);
  });
  prueba("Estaciones · sin importes ni conclusiones comerciales: «rentable», «$1,200» o «350 USD» no llegan a la pantalla; nombrar una divisa sí", async () => {
    const { demoCo } = await datos();
    const d = copia(demoCo);
    const e = d.estaciones[0];
    e.puestos[2].nota = "Oportunidad rentable confirmada";
    e.puestos[1].nota = "Costo puesto $1,200 por pieza";
    e.puestos[0].nota = "Cotización de 350 USD";
    e.nota = "Tipo de cambio USD/MXN y peso mexicano en observación";
    e.conteos.push({ etiqueta: "Margen", valor: 12.5 }, { etiqueta: "Ganancia segura", valor: 3 });
    e.margen_estimado = "40 %"; // campo desconocido: se ignora
    const r = validarEstaciones(d);
    const s = r.documento.estaciones[0];
    igual(s.puestos.map((p) => p.nota), [null, null, null]);
    igual(s.nota, "Tipo de cambio USD/MXN y peso mexicano en observación");
    igual(s.conteos.find((c) => c.etiqueta === "Margen").valor, null, "solo enteros: 12.5 → no disponible");
    verdadero(!s.conteos.some((c) => c.etiqueta === "Ganancia segura"), "etiqueta con conclusión: se omite");
    verdadero(!("margen_estimado" in s), "campos desconocidos no pasan");
    verdadero(JSON.stringify(r.documento).search(/\$|USD\s?\d|\d\s?USD|rentable/i) < 0);
  });
  prueba("Estaciones · un enlace sin evidencia no cuenta como transferencia", async () => {
    const { demoEk } = await datos();
    const d = copia(demoEk);
    delete d.estaciones[0].enlaces[0].evidencia;
    const r = validarEstaciones(d);
    igual(r.documento.estaciones[0].enlaces, []);
    verdadero(r.avisos.some((a) => a.includes("evidencia")));
  });

  // ------------------------------------------------------------------ Lo que se dibuja
  prueba("Estaciones · DEMO: Ek Chuah ve una señal recibida y un riesgo; Compago una investigación pendiente y datos insuficientes; nadie teclea", async () => {
    const { escEk, escCo, demoEk, demoCo } = await datos();
    const ek = construir(escEk, demoEk, "ek-chuah").estaciones[0];
    const co = construir(escCo, demoCo, "compago").estaciones[0];
    igual(ek.puestos.map((p) => p.estado), ["sin_actividad", "senal_recibida", "riesgo_detectado"]);
    igual(co.puestos.map((p) => p.estado), ["investigacion_pendiente", "datos_insuficientes", "sin_actividad"]);
    igual([ek.estado, co.estado], ["riesgo_detectado", "datos_insuficientes"]);
    verdadero(ek.vigente && co.vigente && ek.es_demo && co.es_demo && ek.hora_simulada, "DEMO vigente con hora simulada");
    for (const p of [...ek.puestos, ...co.puestos]) verdadero(p.apariencia.animacion3d !== "sentado_tecleando", `${p.id} no teclea`);
    igual(co.puestos.find((p) => p.estado === "evaluacion_disponible"), undefined, "ninguna evaluación en la demo");
  });
  prueba("Estaciones · sin archivo (piso REAL sin exportador): sillas vacías y el motivo dice qué falta; nunca cae a la demostración", async () => {
    const { escEk } = await datos();
    const r = construirEstaciones({ disposicion: leerDisposicionEstaciones(escEk), carga: { tipo: "no_encontrado" }, origen: "real", ahora: AHORA, proyectoId: "ek-chuah" });
    const e = r.estaciones[0];
    igual(e.puestos.map((p) => p.estado), ["sin_informacion", "sin_informacion", "sin_informacion"]);
    igual(e.puestos.map((p) => p.apariencia.animacion3d), ["ausente", "ausente", "ausente"]);
    verdadero(!e.es_demo && !e.vigente && /exportador/.test(e.motivo), e.motivo);
  });
  prueba("Estaciones · DEMO y REAL no se mezclan: piso REAL con archivo DEMO (o al revés) no se muestra", async () => {
    const { escEk, demoEk } = await datos();
    const disp = leerDisposicionEstaciones(escEk);
    const a = construirEstaciones({ disposicion: disp, carga: ok(demoEk), origen: "real", esDemo: false, ahora: AHORA, proyectoId: "ek-chuah" }).estaciones[0];
    verdadero(!a.vigente && /no se mezclan/.test(a.motivo), a.motivo);
    const b = construirEstaciones({ disposicion: disp, carga: ok(comoReal(demoEk)), origen: "demo", esDemo: true, ahora: AHORA, proyectoId: "ek-chuah" }).estaciones[0];
    verdadero(!b.vigente && /no está marcado como demostración/.test(b.motivo), b.motivo);
    const c = construirEstaciones({ disposicion: disp, carga: ok(demoEk), origen: "demo", ahora: AHORA, proyectoId: "compago" }).estaciones[0];
    verdadero(!c.vigente && /no de "compago"/.test(c.motivo), "archivo de otro proyecto");
  });
  prueba("Estaciones · REAL vigente se muestra; vencido queda en «Sin información» conservando el último estado solo como referencia", async () => {
    const { escEk, demoEk } = await datos();
    const disp = leerDisposicionEstaciones(escEk);
    const fresco = construirEstaciones({ disposicion: disp, carga: ok(comoReal(demoEk)), origen: "real", esDemo: false, ahora: AHORA, proyectoId: "ek-chuah" }).estaciones[0];
    verdadero(fresco.vigente && !fresco.es_demo && fresco.puestos[1].estado === "senal_recibida");
    const viejo = construirEstaciones({ disposicion: disp, carga: ok(comoReal(demoEk, "2026-11-08T15:00:00Z")), origen: "real", esDemo: false, ahora: AHORA, proyectoId: "ek-chuah" }).estaciones[0];
    igual(viejo.puestos.map((p) => p.estado), ["sin_informacion", "sin_informacion", "sin_informacion"]);
    igual(viejo.puestos.map((p) => p.ultimo_estado_conocido), ["sin_actividad", "senal_recibida", "riesgo_detectado"]);
    igual([viejo.conteos, viejo.datos_faltantes, viejo.enlaces], [[], [], []], "sin datos vigentes no se muestran cifras");
    const futuro = construirEstaciones({ disposicion: disp, carga: ok(comoReal(demoEk, "2026-11-08T19:00:00Z")), origen: "real", esDemo: false, ahora: AHORA, proyectoId: "ek-chuah" }).estaciones[0];
    verdadero(!futuro.vigente && /futuro/.test(futuro.motivo));
  });
  prueba("Estaciones · una DEMO que un piloto escribe en datos/reales/ se juzga con el reloj real (vence si el piloto se detiene)", async () => {
    const { escEk, demoEk } = await datos();
    const r = construirEstaciones({ disposicion: leerDisposicionEstaciones(escEk), carga: ok(demoEk), origen: "real", esDemo: true, ahora: AHORA, proyectoId: "ek-chuah" }).estaciones[0];
    verdadero(!r.vigente && /vencieron/.test(r.motivo), r.motivo);
  });

  // ------------------------------------------------------------------ Relación entre oficinas
  prueba("Estaciones · enlace Ek Chuah → Compago: confirmado SOLO si las dos partes registran la misma señal", async () => {
    const { escEk, escCo, demoEk, demoCo } = await datos();
    const ek = () => construir(escEk, demoEk, "ek-chuah").estaciones[0];
    const co = (f = null) => { const d = copia(demoCo); if (f) f(d); return construir(escCo, d, "compago").estaciones[0]; };
    const a = cruzarEnlace(ek(), "ek-chuah", co(), "compago").enlace;
    igual([a.estado, a.confirmadas], ["confirmado", ["SEN-DEMO-ARANCEL-01"]]);
    const b = cruzarEnlace(co(), "compago", ek(), "ek-chuah").enlace;
    igual([b.estado, b.sentido], ["confirmado", "entrada"]);
    const c = cruzarEnlace(ek(), "ek-chuah", co((d) => { d.estaciones[0].enlaces = []; }), "compago").enlace;
    igual([c.estado, c.solo_aqui], ["sin_confirmar", ["SEN-DEMO-ARANCEL-01"]], "Compago no la registra");
    const dd = cruzarEnlace(ek(), "ek-chuah", co((d) => { d.estaciones[0].enlaces[0].senal_id = "OTRA"; }), "compago").enlace;
    igual(dd.estado, "sin_confirmar", "otra señal no confirma");
    const e = cruzarEnlace(ek(), "ek-chuah", null, "compago").enlace;
    verdadero(e.estado === "sin_confirmar" && /No hay datos vigentes/.test(e.motivo));
  });
  prueba("Estaciones · enlace: DEMO con REAL nunca se confirma; sin datos vigentes de este lado, «sin dato»", async () => {
    const { escEk, escCo, demoEk, demoCo } = await datos();
    const ek = construir(escEk, demoEk, "ek-chuah").estaciones[0];
    const coReal = construirEstaciones({ disposicion: leerDisposicionEstaciones(escCo), carga: ok(comoReal(demoCo)), origen: "real", esDemo: false, ahora: AHORA, proyectoId: "compago" }).estaciones[0];
    igual(cruzarEnlace(ek, "ek-chuah", coReal, "compago").enlace.estado, "sin_confirmar");
    const vacia = construirEstaciones({ disposicion: leerDisposicionEstaciones(escEk), carga: { tipo: "no_encontrado" }, origen: "real", ahora: AHORA, proyectoId: "ek-chuah" }).estaciones[0];
    igual(cruzarEnlace(vacia, "ek-chuah", coReal, "compago").enlace.estado, "sin_dato");
  });

  // ------------------------------------------------------------------ Modelo de vista
  prueba("Estaciones · se pegan al modelo de vista: cada departamento recibe solo las suyas; sin anfitrión no se dibujan", async () => {
    const { escEk, demoEk, v1Ek } = await datos();
    const modelo = construirModeloVista({ proyecto: { id: "ek-chuah", nombre: "Ek Chuah" }, carga: ok(v1Ek), distribucion: escEk, ahora: AHORA, origen: "demo" });
    const est = construir(escEk, demoEk, "ek-chuah").estaciones;
    aplicarEstaciones(modelo, est);
    igual(modelo.departamentos.filter((d) => d.estaciones.length).map((d) => d.id), ["riesgo"]);
    igual(modelo.departamentos.length, 6, "no aparece un departamento nuevo");
    const sin = construirModeloVista({ proyecto: { id: "ek-chuah", nombre: "Ek Chuah" }, carga: ok({ ...copia(v1Ek), departamentos: copia(v1Ek.departamentos).filter((d) => d.id !== "riesgo") }), distribucion: escEk, ahora: AHORA, origen: "demo" });
    aplicarEstaciones(sin, construir(escEk, demoEk, "ek-chuah").estaciones);
    verdadero(sin.estaciones[0].dibujable === false && sin.departamentos.every((d) => d.estaciones.length === 0));
  });
  prueba("Estaciones · ids de personaje propios (no chocan con agentes v1) y firma estructural sin estados", async () => {
    const { escEk, demoEk } = await datos();
    const e = construir(escEk, demoEk, "ek-chuah").estaciones;
    igual(e[0].puestos[0].clave, idPersonaje("ek-chuah", "observatorio", "macro"));
    verdadero(e[0].puestos.every((p) => p.clave.startsWith("estacion:")));
    igual(firmaEstaciones(e), "observatorio[macro,geopolitico,riesgos]");
    const otra = construirEstaciones({ disposicion: leerDisposicionEstaciones(escEk), carga: { tipo: "no_encontrado" }, origen: "real", ahora: AHORA, proyectoId: "ek-chuah" }).estaciones;
    igual(firmaEstaciones(otra), firmaEstaciones(e), "cambiar de estado no reconstruye la escena");
  });

  // ------------------------------------------------------------------ Posturas
  prueba("Estaciones · posturas honestas: solo «en_proceso» teclea; registros guardados consultan; faltantes y riesgos piden atención; sin información = silla vacía", () => {
    for (const n of NOMBRES_ESTADOS_ESTACION) verdadero(ANIMACIONES_SOPORTADAS.includes(ESTADOS_ESTACION[n].animacion3d), n);
    const teclea = NOMBRES_ESTADOS_ESTACION.filter((n) => ESTADOS_ESTACION[n].animacion3d === "sentado_tecleando");
    igual(teclea, ["en_proceso"]);
    for (const n of ["senal_recibida", "investigacion_pendiente", "evaluacion_disponible"]) igual(ESTADOS_ESTACION[n].animacion3d, "sentado_consultando", n);
    for (const n of ["datos_insuficientes", "riesgo_detectado"]) igual(ESTADOS_ESTACION[n].animacion3d, "levantar_mano", n);
    igual(ESTADOS_ESTACION.sin_informacion.animacion3d, "ausente");
    igual(ESTADOS_ESTACION.sin_actividad.animacion3d, "sentado_en_reposo");
    verdadero(BUCLES.includes("consultar"));
    igual(planDeTransicion(null, "sentado_consultando"), { pasos: [], bucle: "consultar", presente: true, postura: "sentado" });
    igual(planDeTransicion("ausente", "sentado_consultando").pasos, ["entrar", "sentarse"], "llegada observada");
    igual(planDeTransicion("sentado_consultando", "levantar_mano").pasos, ["llamar_atencion"], "gesto solo ante un cambio observado");
    verdadero(/no confirma rentabilidad/i.test(ESTADOS_ESTACION.evaluacion_disponible.descripcion));
    igual(estadoDeEstacion([]), "sin_informacion");
    igual(estadoDeEstacion(["sin_actividad", "evaluacion_disponible"]), "evaluacion_disponible");
  });

  // ------------------------------------------------------------------ Dónde va (sin Three.js)
  const cuartoCon = (puestosN, estaciones) => tamanoCuarto({ x: 0, y: 0, ancho: 1, alto: 1 }, 4, puestosN, estaciones.length);
  const unaEstacion = [{ id: "e", puestos: [1, 2, 3] }];
  prueba("Estaciones · la estación va en una fila propia DELANTE de los escritorios; los escritorios no se mueven respecto al muro del fondo", () => {
    for (const n of [1, 2, 4]) {
      const sin = cuartoCon(n, []), con = cuartoCon(n, unaEstacion);
      verdadero(Math.abs(con.fondo - sin.fondo - 2.4) < 1e-9 || con.fondo >= sin.fondo, "el cuarto crece una fila");
      const r3 = (v) => Math.round(v * 1000) / 1000;
      const a = puestos(n, sin).map((p) => r3(p.z + sin.fondo / 2)), b = puestos(n, con).map((p) => r3(p.z + con.fondo / 2));
      igual(b, a, `${n} escritorios: misma distancia al muro del fondo`);
      const [l] = lugaresEstaciones(con, n, unaEstacion);
      const ultimo = Math.max(...puestos(n, con).map((p) => p.z));
      verdadero(l.z >= ultimo + 2.4 - 1e-9, "una fila completa delante");
      verdadero(l.z + 0.75 + 0.6 <= con.fondo / 2 - 1.0 + 1e-9, "las sillas no invaden el pasillo de la puerta");
      verdadero(l.ancho / 2 + 0.8 <= con.ancho / 2, "cabe a lo ancho con el objeto del extremo");
      igual(l.asientos.length, 3);
    }
  });
  prueba("Estaciones · ningún camino de un agente atraviesa la estación (ni su objeto del extremo); los de la estación tampoco cruzan escritorios", () => {
    for (const n of [1, 2, 3]) {
      const c = cuartoCon(n, unaEstacion);
      const lug = puestos(n, c);
      const [l] = lugaresEstaciones(c, n, unaEstacion);
      const todos = [...lug, ...l.asientos, l.extremo];
      for (const p of [...lug, ...l.asientos]) verdadero(!caminoChoca(camino(c, p, todos), p, todos), `${n} escritorios: camino de (${p.x}, ${p.z}) choca`);
    }
  });
  prueba("Estaciones · la decoración del cuarto (interiores) nunca cae sobre la estación, sus sillas ni sus caminos", () => {
    for (const tema of ["margenes", "oportunidades", "fuentes", "integracion"]) {
      const c = cuartoCon(1, unaEstacion);
      const [l] = lugaresEstaciones(c, 1, unaEstacion);
      const todos = [...puestos(1, c), ...l.asientos, l.extremo];
      const plan = planInterior(tema, c, todos, { estilo: "financiero" });
      const mesa = { x0: -l.ancho / 2 - 0.85, x1: l.ancho / 2, z0: l.z - 0.5, z1: l.z + 1.2 };
      for (const p of plan) {
        if (p.muro || p.pieza === "tapete") continue;
        const r = rectDe(p.x, p.z, p.opciones.ancho ?? p.opciones.largo ?? 0.4, 0.4, p.rot);
        verdadero(!seTocan(r, mesa), `${tema}: ${p.pieza} en (${p.x}, ${p.z}) toca la estación`);
      }
      verdadero(obstaculosCuarto(c, todos).length > 0);
    }
  });
  prueba("Estaciones · edificio: solo crece la fila del anfitrión y los cuartos siguen sin encimarse", async () => {
    const { escEk } = await datos();
    const deps = Object.entries(escEk.departamentos).map(([id, p]) => ({ id, posicion: p, puestos: 1, filasExtra: id === "riesgo" ? 1 : 0 }));
    const con = distribuirEdificio(deps), sin = distribuirEdificio(deps.map((d) => ({ ...d, filasExtra: 0 })));
    const f = (pl, id) => pl.cuartos.find((c) => c.id === id).fondo;
    verdadero(f(con, "riesgo") > f(sin, "riesgo"), "Análisis de riesgo crece");
    igual(f(con, "datos"), f(sin, "datos"), "la fila de atrás no cambia");
    for (const a of con.cuartos) for (const b of con.cuartos) if (a !== b) verdadero(!(Math.abs(a.x - b.x) * 2 < a.ancho + b.ancho - 1e-6 && Math.abs(a.z - b.z) * 2 < a.fondo + b.fondo - 1e-6), `${a.id}/${b.id}`);
  });

  // ------------------------------------------------------------------ Registro y configuración
  prueba("Estaciones · registro: rutas por omisión en datos/reales y datos/demo; una ruta fuera de su carpeta se ignora", () => {
    const r = validarRegistro({ proyectos: [
      { id: "ek-chuah", nombre: "Ek Chuah", estado: "datos/reales/ek-chuah.json" },
      { id: "compago", nombre: "Compago", estado: "datos/reales/compago.json", estaciones_estado: "../secreto.json", estaciones_demo: "datos/reales/x.json" },
    ] });
    igual(r.proyectos[0].estaciones, { estado: "datos/reales/ek-chuah-estaciones.json", demo: "datos/demo/ek-chuah-estaciones.json" });
    igual(r.proyectos[1].estaciones, { estado: "datos/reales/compago-estaciones.json", demo: "datos/demo/compago-estaciones.json" });
    igual(r.avisos.length, 2);
  });
  prueba("Estaciones · ?estaciones=0 las apaga para medir A/B; por omisión, encendidas", () => {
    igual(leerConfiguracion("http://127.0.0.1:8765/").estaciones, true);
    igual(leerConfiguracion("http://127.0.0.1:8765/?estaciones=0&medir=1").estaciones, false);
  });
}
