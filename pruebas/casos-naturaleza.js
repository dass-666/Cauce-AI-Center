// Fase E (prototipo): correspondencia Compago–Cauce y compatibilidad con exportar_cauce.
// Corre en Node (pruebas/ejecutar.mjs) y en el navegador (pruebas.html).

import { prueba, igual, verdadero } from "./mini.js";
import { validarDocumento } from "../app/nucleo/contrato.js";
import { construirModeloVista } from "../app/nucleo/modelo.js";
import { validarNaturalezas, presentar, huellaEvidencia, cambioDeEvidencia, NATURALEZAS } from "../app/nucleo/naturaleza.js";

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
    const r = validarNaturalezas(await leerJSON("prototipos/naturaleza/compago.json"));
    igual(r.errores, []);
    const ids = agentes(modelo(await exportador())).map((a) => a.id);
    igual(ids.length, 8);
    for (const id of ids) verdadero(r.mapa.has(id), `Falta clasificar "${id}"`);
  });

  prueba("E · Compago tiene un solo proceso automático (el consumidor de importaciones)", async () => {
    const { mapa } = validarNaturalezas(await leerJSON("prototipos/naturaleza/compago.json"));
    igual([...mapa].filter(([, n]) => n === "automatico").map(([id]) => id), ["importador"]);
  });

  prueba("E · una naturaleza desconocida se rechaza", () => {
    const r = validarNaturalezas({ agentes: { a: { naturaleza: "bot" } } });
    verdadero(!r.valido && r.errores[0].includes("desconocida"));
  });

  // ---------- presentación

  prueba("E · automático: con evidencia está presente; 'esperando' sin evidencia deja la silla vacía", () => {
    igual(presentar(ag("trabajando", { evidencia: EV }), "automatico").animacion, "sentado_tecleando");
    const sin = presentar(ag("esperando"), "automatico");
    igual([sin.personaje, sin.animacion, sin.pantalla], ["ausente", null, "apagada"]);
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
      igual([p.personaje, p.animacion, p.puesto], ["ausente", null, "humano"], e);
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
  });

  prueba("E · riesgo medido: con el ejemplo del exportador, hoy hay 6 personajes visibles; con la clasificación, 1", async () => {
    const m = modelo(await exportador());
    const { mapa } = validarNaturalezas(await leerJSON("prototipos/naturaleza/compago.json"));
    const hoy = agentes(m).filter((a) => a.apariencia.animacion3d !== "ausente").length;
    const propuesta = agentes(m).filter((a) => presentar(a, mapa.get(a.id)).personaje !== "ausente").length;
    igual([hoy, propuesta], [6, 1]);
  });

  prueba("E · prototipo: segunda lectura DEMO muestra breve solo a la Buscadora (registro nuevo)", async () => {
    const { mapa } = validarNaturalezas(await leerJSON("prototipos/naturaleza/compago.json"));
    const m1 = modelo(await leerJSON("prototipos/naturaleza/lectura-1.json"));
    const m2 = modelo(await leerJSON("prototipos/naturaleza/lectura-2.json"));
    igual([m1.conexion, m1.es_demo, m2.conexion, m2.es_demo], ["en_linea", true, "en_linea", true]);
    const h1 = huellaEvidencia(m1), h2 = huellaEvidencia(m2);
    const breves = agentes(m2).filter((a) => presentar(a, mapa.get(a.id), { cambioObservado: cambioDeEvidencia(h1, h2, a.id) }).personaje === "breve");
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
}
