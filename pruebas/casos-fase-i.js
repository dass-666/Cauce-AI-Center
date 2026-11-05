// Fase I: pisos preparados sin conexión (solo estructura) y estado de cada piso en el selector.
// Corre en Node (pruebas/ejecutar.mjs) y en el navegador (pruebas.html).

import { prueba, igual, verdadero } from "./mini.js";
import { construirModeloVista, elegirCarga, resumenDe, conEstructura } from "../app/nucleo/modelo.js";
import { validarRegistro } from "../app/nucleo/registro.js";

export function registrarCasosFaseI(leerTexto) {
  const leerJSON = async (ruta) => JSON.parse(await leerTexto(ruta));
  const ahora = new Date("2026-11-04T12:00:00Z");
  const mont = { id: "montambre", nombre: "Montambre" };
  const modelo = (carga, distribucion, proyecto = mont) => construirModeloVista({ proyecto, carga, distribucion, ahora });

  prueba("I · Montambre sin archivo: 4 cuartos conocidos, cero personajes, sin alertas ni cifras", async () => {
    const m = modelo({ tipo: "no_encontrado" }, await leerJSON("escena/montambre.json"));
    igual([m.conexion, m.es_demo, m.solo_estructura, m.departamentos.length], ["desconectado", false, true, 4]);
    igual(m.departamentos.map((d) => d.id), ["busqueda", "registro", "moderacion", "cobertura"]);
    verdadero(m.departamentos.every((d) => d.agentes.length === 0 && d.indicadores.length === 0 && d.alertas.length === 0 && d.estado_resumen === "sin_datos"));
    igual([m.alertas, m.resultados, m.generado_en], [[], [], null]);
    verdadero(/inventario/.test(m.nota_origen) && /ningún personaje representa trabajo/.test(m.nota_origen));
  });

  prueba("I · que el archivo no exista no se cuenta como error del archivo (antes salía «1 error»)", () => {
    const m = modelo({ tipo: "no_encontrado", mensaje: "No existe datos/reales/montambre.json" }, null);
    igual([m.conexion, m.errores], ["desconectado", []]);
    verdadero(/No existe el archivo/.test(m.motivo));
    igual(modelo({ tipo: "error_red", mensaje: "Respuesta 500" }, null).errores, ["Respuesta 500"]);
  });

  prueba("I · la estructura se dibuja en su lugar de la cuadrícula", async () => {
    const m = modelo({ tipo: "no_encontrado" }, await leerJSON("escena/montambre.json"));
    igual(m.departamentos.map((d) => [d.posicion.x, d.posicion.y, d.posicion.automatica]), [[0, 0, false], [1, 0, false], [0, 1, false], [1, 1, false]]);
  });

  prueba("I · un archivo inválido NO se tapa con la estructura (se ve el error)", async () => {
    const m = modelo({ tipo: "json_invalido", mensaje: "x" }, await leerJSON("escena/montambre.json"));
    igual([m.conexion, m.departamentos.length, m.solo_estructura], ["invalido", 0, undefined]);
  });

  prueba("I · en cuanto llega un archivo válido, manda el archivo y no la estructura", async () => {
    const datos = {
      contrato: "cauce.estado-proyecto", version: "1.0.0", proyecto: { id: "montambre", nombre: "Montambre" },
      generado_en: "2026-11-04T11:59:00Z", vigencia_segundos: 600, es_demo: false, fuente: { tipo: "adaptador", nombre: "prueba" },
      departamentos: [{ id: "busqueda", nombre: "Búsqueda", agentes: [] }],
    };
    const m = modelo({ tipo: "ok", datos }, await leerJSON("escena/montambre.json"));
    igual([m.conexion, m.solo_estructura, m.departamentos.length], ["en_linea", undefined, 1]);
  });

  prueba("I · distribución sin nombres (Compago, Ek Chuah) o sin distribución: sigue sin cuartos", async () => {
    igual(modelo({ tipo: "no_encontrado" }, await leerJSON("escena/compago.json"), { id: "compago", nombre: "Compago" }).departamentos.length, 0);
    igual(modelo({ tipo: "no_encontrado" }, null, { id: "tezcatlipoca", nombre: "Tezcatlipoca" }).departamentos.length, 0);
  });

  prueba("I · estructura: ids raros se ignoran, textos se recortan y hay máximo 50", () => {
    const deps = { "Mal ID": { nombre: "x" }, ok: { nombre: "  Uno  ", descripcion: "d".repeat(500) }, sin: { x: 0 } };
    for (let i = 0; i < 60; i++) deps[`d${i}`] = { nombre: `D${i}` };
    const m = conEstructura({ cuadricula: { columnas: 3 }, departamentos: [] }, { departamentos: deps });
    igual([m.departamentos.length, m.departamentos[0].nombre, m.departamentos[0].descripcion.length], [50, "Uno", 240]);
  });

  prueba("I · insignia de cada piso: REAL, DEMO, Vencido, Error y Sin conexión", () => {
    const base = { es_demo: false };
    igual(["en_linea", "desactualizado", "invalido", "desconectado"].map((c) => resumenDe({ ...base, conexion: c })), ["real", "desactualizado", "invalido", "desconectado"]);
    igual([resumenDe({ es_demo: true, conexion: "en_linea" }), resumenDe({ es_demo: true, conexion: "desactualizado" }), resumenDe({ es_demo: true, conexion: "invalido" })], ["demo", "desactualizado", "invalido"]);
  });

  prueba("I · insignia de los pisos del repositorio sin datos reales: Compago y Ek Chuah DEMO, Tezcatlipoca y Montambre sin conexión", async () => {
    const { proyectos } = validarRegistro(await leerJSON("datos/proyectos.json"));
    const r = {};
    for (const p of proyectos) {
      const demo = p.demo ? { tipo: "ok", datos: await leerJSON(p.demo) } : null;
      const e = elegirCarga({ tipo: "no_encontrado" }, demo);
      r[p.id] = resumenDe(construirModeloVista({ proyecto: p, carga: e.carga, ahora }));
    }
    igual(r, { compago: "demo", "ek-chuah": "demo", tezcatlipoca: "desconectado", montambre: "desconectado", cauceservice: "desconectado", repacar: "desconectado" }); // K: + 2 pendientes
  });
}
