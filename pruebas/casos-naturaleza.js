// Fase E (prototipo): correspondencia Compago–Cauce y compatibilidad con exportar_cauce.
// Corre en Node (pruebas/ejecutar.mjs) y en el navegador (pruebas.html).

import { prueba, igual, verdadero } from "./mini.js";
import { validarDocumento } from "../app/nucleo/contrato.js";
import { construirModeloVista } from "../app/nucleo/modelo.js";
import { validarNaturalezas, presentar, huellaEvidencia, cambioDeEvidencia, NATURALEZAS, latidoDe, crearSeguidorNaturalezas } from "../app/nucleo/naturaleza.js";

export function registrarCasosNaturaleza(leerTexto) {
  const leerJSON = async (ruta) => JSON.parse(await leerTexto(ruta));
  const copia = (o) => JSON.parse(JSON.stringify(o));
  const proyecto = { id: "compago", nombre: "Compago" };
  const exportador = () => leerJSON("contrato/ejemplos/compago-exportador.json");
  const enVigencia = new Date("2026-11-03T02:40:00Z"); // 4 min después de generado_en del ejemplo
  const modelo = (datos, ahora = enVigencia) => construirModeloVista({ proyecto, carga: { tipo: "ok", datos }, ahora });
  const agentes = (m) => m.departamentos.flatMap((d) => d.agentes);
  const ag = (estado, extra = {}) => ({ id: "x", estado, estado_mostrado: estado, ...extra });
  const EV = { origen: "ImportJob", referencia: "id=1" };

  // ---------- clasificación

  prueba("E · la clasificación de Compago es válida y cubre a los 8 personajes del exportador", async () => {
    const r = validarNaturalezas(await leerJSON("escena/compago-naturaleza.json"));
    igual(r.errores, []);
    const ids = agentes(modelo(await exportador())).map((a) => a.id);
    igual(ids.length, 8);
    for (const id of ids) verdadero(r.mapa.has(id), `Falta clasificar "${id}"`);
  });

  prueba("E · Compago tiene un solo proceso automático (el consumidor de importaciones)", async () => {
    const { mapa } = validarNaturalezas(await leerJSON("escena/compago-naturaleza.json"));
    igual([...mapa].filter(([, c]) => c.naturaleza === "automatico").map(([id]) => id), ["importador"]);
  });

  prueba("E · una naturaleza desconocida se rechaza", () => {
    const r = validarNaturalezas({ agentes: { a: { naturaleza: "bot" } } });
    verdadero(!r.valido && r.errores[0].includes("desconocida"));
  });

  // ---------- presentación

  prueba("E · automático: con evidencia está presente; 'esperando' sin evidencia deja la silla vacía", () => {
    igual(presentar(ag("trabajando", { evidencia: EV }), "automatico").animacion, "sentado_tecleando");
    const sin = presentar(ag("esperando"), "automatico");
    igual([sin.personaje, sin.animacion, sin.pantalla], ["ausente", "ausente", "apagada"]);
  });

  prueba("E · automático: con datos desactualizados nadie aparece", () => {
    igual(presentar(ag("trabajando", { estado_mostrado: "sin_datos", evidencia: EV }), "automatico").personaje, "ausente");
  });

  prueba("E · reactivo: la primera lectura nunca muestra personaje, aunque haya registro", () => {
    const p = presentar(ag("finalizado", { evidencia: EV }), "reactivo");
    igual([p.personaje, p.pantalla], ["ausente", "finalizado"]);
  });

  prueba("E · reactivo: aparece brevemente solo si se observó un registro nuevo", () => {
    igual(presentar(ag("finalizado", { evidencia: EV }), "reactivo", { cambioObservado: true }).personaje, "breve");
    igual(presentar(ag("esperando"), "reactivo", { cambioObservado: true }).personaje, "ausente");
  });

  prueba("E · humano: nunca se dibuja a la persona, ni siquiera con 'trabajando' y evidencia", () => {
    for (const e of ["trabajando", "esperando", "finalizado", "requiere_revision", "error"]) {
      const p = presentar(ag(e, { evidencia: EV }), "humano", { cambioObservado: true });
      igual([p.personaje, p.animacion, p.puesto], ["ausente", "ausente", "humano"], e);
    }
  });

  prueba("E · módulo y futuro: nunca tienen personaje", () => {
    for (const n of ["modulo", "futuro"])
      for (const e of ["trabajando", "finalizado", "sin_datos"])
        igual(presentar(ag(e, { evidencia: EV }), n, { cambioObservado: true }).personaje, "ausente", `${n}/${e}`);
  });

  prueba("E · sin clasificar: sin personaje y con aviso", () => {
    const p = presentar(ag("trabajando", { evidencia: EV }), undefined);
    igual(p.personaje, "ausente");
    verdadero(p.avisos.length === 1);
  });

  prueba("E · toda naturaleza tiene etiqueta y tipo de puesto", () => {
    for (const [n, v] of Object.entries(NATURALEZAS)) verdadero(v.etiqueta && v.puesto, n);
  });

  prueba("E · cambio de evidencia: la primera lectura no cuenta; una referencia nueva sí", () => {
    const h1 = new Map([["a", "SearchRun|id=1"]]);
    const h2 = new Map([["a", "SearchRun|id=2"]]);
    verdadero(!cambioDeEvidencia(null, h1, "a"));
    verdadero(!cambioDeEvidencia(h1, h1, "a"));
    verdadero(cambioDeEvidencia(h1, h2, "a"));
    verdadero(!cambioDeEvidencia(h1, new Map([["a", null]]), "a"), "perder evidencia no es actividad nueva");
    verdadero(!cambioDeEvidencia(new Map(), h2, "a"), "un agente que antes no estaba no es un evento nuevo");
  });

  prueba("E · riesgo medido: con el ejemplo del exportador, hoy hay 6 personajes visibles; con la clasificación, 1", async () => {
    const m = modelo(await exportador());
    const { mapa } = validarNaturalezas(await leerJSON("escena/compago-naturaleza.json"));
    const hoy = agentes(m).filter((a) => a.apariencia.animacion3d !== "ausente").length;
    const visibles = (mod) => mod.departamentos.flatMap((d) => d.agentes.filter((a) => {
      const c = mapa.get(a.id);
      return presentar(a, c.naturaleza, { vivo: latidoDe(d, c.latido) }).personaje !== "ausente";
    })).length;
    // El ejemplo trae "Consumidor: sin latido reciente": ni el importador se dibuja (estado conservador).
    igual([hoy, visibles(m)], [6, 0]);
    const vivo = await exportador();
    vivo.departamentos[0].indicadores.find((i) => i.etiqueta === "Consumidor").valor = "activo";
    igual(visibles(modelo(vivo)), 1);
  });

  prueba("E · prototipo: segunda lectura DEMO muestra breve solo a la Buscadora (registro nuevo)", async () => {
    const { mapa } = validarNaturalezas(await leerJSON("escena/compago-naturaleza.json"));
    const m1 = modelo(await leerJSON("prototipos/naturaleza/lectura-1.json"));
    const m2 = modelo(await leerJSON("prototipos/naturaleza/lectura-2.json"));
    igual([m1.conexion, m1.es_demo, m2.conexion, m2.es_demo], ["en_linea", true, "en_linea", true]);
    const h1 = huellaEvidencia(m1), h2 = huellaEvidencia(m2);
    const breves = agentes(m2).filter((a) => presentar(a, mapa.get(a.id).naturaleza, { cambioObservado: cambioDeEvidencia(h1, h2, a.id) }).personaje === "breve");
    igual(breves.map((a) => a.id), ["buscador"]);
  });

  // ---------- compatibilidad con exportar_cauce (PR #9 de Compago)

  prueba("E · exportador: su forma actual (es_demo false, fuente adaptador) cumple el contrato", async () => {
    const r = validarDocumento(await exportador());
    igual([r.valido, r.errores], [true, []]);
  });

  prueba("E · defecto verificado: con --entorno demo el exportador escribe es_demo false y Cauce lo muestra como REAL", async () => {
    const d = await exportador(); // así sale hoy con --entorno demo: solo cambian textos
    d.fuente.nombre += " (registros DEMO de Compago)";
    for (const dep of d.departamentos) dep.descripcion = "[Registros DEMO de Compago] " + dep.descripcion;
    const m = modelo(d);
    igual([m.conexion, m.es_demo], ["en_linea", false]); // sin franja DEMO
  });

  prueba("E · el arreglo ingenuo (solo es_demo true) lo rechaza el contrato", async () => {
    const d = await exportador();
    d.es_demo = true;
    const r = validarDocumento(d);
    verdadero(!r.valido);
    verdadero(r.errores.some((e) => e.includes("ahora_simulado")));
    verdadero(r.errores.some((e) => e.includes("fuente.tipo")));
  });

  prueba("E · el arreglo mínimo (es_demo, fuente.tipo demo y demo.ahora_simulado = generado_en) es válido y muestra la franja", async () => {
    const d = await exportador();
    Object.assign(d, { es_demo: true, demo: { ahora_simulado: d.generado_en } });
    d.fuente.tipo = "demo";
    const m = modelo(d, new Date("2030-01-01T00:00:00Z"));
    igual([m.conexion, m.es_demo], ["en_linea", true]);
  });

  prueba("E · límite del contrato v1: un DEMO con ahora_simulado nunca caduca (por eso no se vigila su frescura)", async () => {
    const d = await exportador();
    Object.assign(d, { es_demo: true, demo: { ahora_simulado: d.generado_en } });
    d.fuente.tipo = "demo";
    igual(modelo(d, new Date("2030-01-01T00:00:00Z")).conexion, "en_linea");
  });

  prueba("E · campos que el contrato no conoce (p. ej. naturaleza) no llegan a la pantalla", async () => {
    const d = await exportador();
    d.departamentos[0].agentes[0].naturaleza = "automatico";
    verdadero(!("naturaleza" in validarDocumento(copia(d)).documento.departamentos[0].agentes[0]));
  });

  // ---------- E2: integración (seguidor entre lecturas, latido, programado)

  const clasificacion = async () => validarNaturalezas(await leerJSON("escena/compago-naturaleza.json"));
  const conLatido = async (valor = "activo") => {
    const d = await exportador();
    d.departamentos[0].indicadores.find((i) => i.etiqueta === "Consumidor").valor = valor;
    return d;
  };
  const de = (m, id) => agentes(m).find((a) => a.id === id);

  prueba("E2 · ocho departamentos clasificados: 1 automático, 3 reactivos, 1 humano, 3 módulos", async () => {
    const m = modelo(await conLatido());
    igual(m.departamentos.length, 8);
    crearSeguidorNaturalezas().aplicar(m, await clasificacion(), 0);
    const cuenta = {};
    for (const a of agentes(m)) cuenta[a.naturaleza] = (cuenta[a.naturaleza] ?? 0) + 1;
    igual(cuenta, { automatico: 1, reactivo: 3, humano: 1, modulo: 3 });
  });

  prueba("E2 · revisar_fuentes es reactivo (no hay cron confirmado)", async () => {
    igual((await clasificacion()).mapa.get("revisor-fuentes").naturaleza, "reactivo");
  });

  prueba("E2 · 'programado' sin evidencia de cron se degrada a reactivo con aviso; con evidencia, se acepta", () => {
    const sin = validarNaturalezas({ agentes: { a: { naturaleza: "programado" } } });
    igual([sin.valido, sin.mapa.get("a").naturaleza, sin.avisos.length], [true, "reactivo", 1]);
    const con = validarNaturalezas({ agentes: { a: { naturaleza: "programado", programacion: { evidencia: "cron 0 * * * * en servidor X" } } } });
    igual([con.mapa.get("a").naturaleza, con.avisos.length], ["programado", 0]);
  });

  prueba("E2 · programado se comporta como reactivo: breve solo por registro nuevo", () => {
    igual(presentar(ag("finalizado", { evidencia: EV }), "programado").personaje, "ausente");
    igual(presentar(ag("finalizado", { evidencia: EV }), "programado", { breve: true }).personaje, "breve");
  });

  prueba("E2 · latido: 'activo' vivo, otro valor no, sin indicador = no se sabe", () => {
    const l = { indicador: "Consumidor", vivo: ["activo"] };
    igual([latidoDe({ indicadores: [{ etiqueta: "Consumidor", valor: "activo" }] }, l),
      latidoDe({ indicadores: [{ etiqueta: "Consumidor", valor: "sin latido reciente" }] }, l),
      latidoDe({ indicadores: [] }, l), latidoDe({}, null)], [true, false, null, true]);
  });

  prueba("E2 · automático sin latido: silla vacía aunque el lote diga 'trabajando' (no se confunde histórico con vivo)", async () => {
    for (const [valor, esperado] of [["sin latido reciente", "ausente"], ["activo", "presente"]]) {
      const m = modelo(await conLatido(valor));
      crearSeguidorNaturalezas().aplicar(m, await clasificacion(), 0);
      igual(de(m, "importador").presentacion.personaje, esperado, valor);
    }
    const m = modelo(await conLatido());
    m.departamentos[0].indicadores = m.departamentos[0].indicadores.filter((i) => i.etiqueta !== "Consumidor");
    crearSeguidorNaturalezas().aplicar(m, await clasificacion(), 0);
    igual(de(m, "importador").animacion_mostrada, "ausente", "sin indicador de latido");
  });

  prueba("E2 · seguidor: primera lectura sin apariciones; registro nuevo → breve 8 s; luego se va", async () => {
    const c = await clasificacion();
    const s = crearSeguidorNaturalezas();
    const m1 = modelo(await conLatido());
    igual(s.aplicar(m1, c, 0), null);
    verdadero(agentes(m1).filter((a) => a.naturaleza !== "automatico").every((a) => a.animacion_mostrada === "ausente"), "primera lectura");
    const d2 = await conLatido();
    de({ departamentos: d2.departamentos }, "buscador").evidencia.referencia = "id=5001 · resultado=ok";
    const m2 = modelo(d2);
    igual(s.aplicar(m2, c, 1000), 8000);
    igual([de(m2, "buscador").presentacion.personaje, de(m2, "buscador").animacion_mostrada], ["breve", "estirarse"]);
    igual(s.aplicar(m2, c, 5000), 4000, "volver a dibujar el mismo modelo no renueva la aparición");
    igual([s.aplicar(m2, c, 9001), de(m2, "buscador").presentacion.personaje], [null, "ausente"]);
  });

  prueba("E2 · seguidor: una lectura fallida en medio no provoca apariciones al recuperarse", async () => {
    const c = await clasificacion();
    const s = crearSeguidorNaturalezas();
    s.aplicar(modelo(await conLatido()), c, 0);
    s.aplicar(construirModeloVista({ proyecto, carga: { tipo: "no_encontrado" }, ahora: enVigencia }), c, 1000);
    const m = modelo(await conLatido());
    s.aplicar(m, c, 2000);
    verdadero(agentes(m).every((a) => a.presentacion.personaje !== "breve"));
  });

  prueba("E2 · seguidor: reiniciar (cambio de proyecto) hace que la siguiente lectura sea primera", async () => {
    const c = await clasificacion();
    const s = crearSeguidorNaturalezas();
    s.aplicar(modelo(await conLatido()), c, 0);
    s.reiniciar();
    const d2 = await conLatido();
    d2.departamentos[1].agentes[0].evidencia.referencia = "id=9999";
    const m = modelo(d2);
    igual(s.aplicar(m, c, 1000), null);
  });

  prueba("E2 · datos desactualizados: nadie aparece, ni el automático ni un registro nuevo", async () => {
    const c = await clasificacion();
    const s = crearSeguidorNaturalezas();
    s.aplicar(modelo(await conLatido()), c, 0);
    const d2 = await conLatido();
    d2.departamentos[1].agentes[0].evidencia.referencia = "id=9999";
    const m = modelo(d2, new Date("2026-11-04T00:00:00Z"));
    igual(m.conexion, "desactualizado");
    s.aplicar(m, c, 1000);
    verdadero(agentes(m).every((a) => a.animacion_mostrada === "ausente"));
  });

  prueba("E2 · proyecto sin clasificación (Ek Chuah): el seguidor no toca el modelo", async () => {
    const m = modelo(await conLatido());
    igual(crearSeguidorNaturalezas().aplicar(m, null, 0), null);
    verdadero(agentes(m).every((a) => a.animacion_mostrada === undefined));
  });

  prueba("E2 · registro: naturalezas por omisión escena/<id>-naturaleza.json; una ruta fuera de escena/ se ignora", async () => {
    const { validarRegistro } = await import("../app/nucleo/registro.js");
    const r = validarRegistro({ proyectos: [
      { id: "compago", nombre: "Compago", estado: "datos/reales/compago.json" },
      { id: "otro", nombre: "Otro", estado: "datos/reales/otro.json", naturalezas: "../secreto.json" }] });
    igual(r.proyectos.map((p) => p.naturalezas), ["escena/compago-naturaleza.json", "escena/otro-naturaleza.json"]);
    igual(r.avisos.length, 1);
  });

  prueba("E2 · DEMO de Compago: mismos 8 personajes que el exportador, sin actividad inventada en Márgenes ni Auditoría", async () => {
    const demo = await leerJSON("datos/demo/compago.json");
    const ids = (d) => d.departamentos.flatMap((x) => x.agentes.map((a) => a.id)).sort();
    igual(ids(demo), ids(await exportador()));
    const por = Object.fromEntries(demo.departamentos.flatMap((x) => x.agentes).map((a) => [a.id, a]));
    igual([por["analista-margenes"].estado, por["auditor-datos"].estado], ["sin_datos", "sin_datos"]);
    verdadero(!por["evaluador"].evidencia || por["evaluador"].estado !== "trabajando", "humano sin trabajo inventado");
    const r = validarDocumento(demo);
    verdadero(r.valido && r.documento.es_demo, JSON.stringify(r.errores));
    for (const a of Object.values(por)) if (a.actividad?.descripcion) verdadero(a.actividad.descripcion.startsWith("[DEMO]"), a.id);
  });

  prueba("E2 · DEMO de Compago con clasificación: solo el importador se dibuja al cargar", async () => {
    const demo = await leerJSON("datos/demo/compago.json");
    const m = construirModeloVista({ proyecto, carga: { tipo: "ok", datos: demo }, ahora: new Date() });
    crearSeguidorNaturalezas().aplicar(m, await clasificacion(), 0);
    igual(agentes(m).filter((a) => a.animacion_mostrada !== "ausente").map((a) => a.id), ["importador"]);
  });

  // ---------- contrato: documentos de ejemplo válidos e inválidos (lo que corrige Compago)

  const demoCorrecto = async () => {
    const d = await exportador();
    Object.assign(d, { es_demo: true, demo: { ahora_simulado: d.generado_en } });
    d.fuente.tipo = "demo";
    return d;
  };
  for (const [nombre, cambiar, texto] of [
    ["demo sin ahora_simulado", (d) => { delete d.demo; }, "ahora_simulado"],
    ["demo con fuente adaptador", (d) => { d.fuente.tipo = "adaptador"; }, "fuente.tipo"],
    ["real con bloque demo", (d) => { d.es_demo = false; d.fuente.tipo = "adaptador"; }, '"demo" solo se permite'],
    ["es_demo como texto", (d) => { d.es_demo = "true"; }, "es_demo"],
    ["vigencia fuera de rango", (d) => { d.vigencia_segundos = 10; }, "vigencia_segundos"],
    ["generado_en sin Z", (d) => { d.generado_en = "2026-11-03T02:35:46"; }, "generado_en"],
    ["versión 2", (d) => { d.version = "2.0.0"; }, "versión"],
  ]) {
    prueba(`E2 · contrato inválido: ${nombre}`, async () => {
      const d = await demoCorrecto();
      cambiar(d);
      const r = validarDocumento(d);
      verdadero(!r.valido && r.errores.some((e) => e.toLowerCase().includes(texto.toLowerCase())), JSON.stringify(r.errores));
    });
  }

  prueba("E2 · contrato válido: real del exportador, demo corregido y un 'trabajando' sin evidencia se degrada", async () => {
    verdadero(validarDocumento(await exportador()).valido);
    verdadero(validarDocumento(await demoCorrecto()).valido);
    const d = await exportador();
    delete d.departamentos[0].agentes[0].evidencia;
    const r = validarDocumento(d);
    igual([r.valido, r.documento.departamentos[0].agentes[0].estado], [true, "sin_datos"]);
  });

  prueba("E2 · seguidor: DEMO → REAL no cuenta como registro nuevo aunque cambien todas las referencias", async () => {
    const c = await clasificacion();
    const s = crearSeguidorNaturalezas();
    const demo = await leerJSON("datos/demo/compago.json");
    s.aplicar(construirModeloVista({ proyecto, carga: { tipo: "ok", datos: demo }, ahora: new Date() }), c, 0);
    const real = await conLatido();
    for (const d of real.departamentos) for (const a of d.agentes) if (a.evidencia) a.evidencia.referencia += " · otra";
    const m = modelo(real);
    igual(s.aplicar(m, c, 1000), null);
    verdadero(agentes(m).every((a) => a.presentacion.personaje !== "breve"));
  });
}
