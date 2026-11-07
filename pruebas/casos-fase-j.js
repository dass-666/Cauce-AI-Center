// Fase J: una DEMO que escribe un adaptador vivo (en datos/reales/) caduca con el reloj real.
// Corre en Node (pruebas/ejecutar.mjs) y en el navegador (pruebas.html).

import { prueba, igual, verdadero } from "./mini.js";
import { construirModeloVista, elegirCarga, resumenDe } from "../app/nucleo/modelo.js";

export function registrarCasosFaseJ(leerTexto) {
  const leerJSON = async (ruta) => JSON.parse(await leerTexto(ruta));
  const proyecto = { id: "compago", nombre: "Compago" };
  // DEMO como la escribe exportar_cauce --entorno demo: ahora_simulado = hora de exportación = generado_en.
  const demoVivo = (generado) => ({
    contrato: "cauce.estado-proyecto", version: "1.0.0", proyecto: { id: "compago", nombre: "Compago" },
    generado_en: generado, vigencia_segundos: 900, es_demo: true, demo: { ahora_simulado: generado },
    fuente: { tipo: "demo", nombre: "piloto local" }, departamentos: [{ id: "d", nombre: "[DEMO] D", agentes: [] }],
  });
  const modelo = (doc, ahora, lugar, pr = proyecto) => {
    const e = lugar === "real" ? elegirCarga({ tipo: "ok", datos: doc }, null) : elegirCarga({ tipo: "no_encontrado" }, { tipo: "ok", datos: doc });
    return construirModeloVista({ proyecto: pr, carga: e.carga, origen: e.origen, ahora });
  };

  prueba("J · DEMO de un adaptador vivo, recién escrita: DEMO «En línea»", () => {
    const m = modelo(demoVivo("2026-11-04T12:00:00Z"), new Date("2026-11-04T12:05:00Z"), "real");
    igual([m.es_demo, m.conexion, m.edad_segundos, resumenDe(m)], [true, "en_linea", 300, "demo"]);
  });

  prueba("J · el adaptador se detuvo hace 2 h: la DEMO de datos/reales/ se ve «Datos desactualizados»", () => {
    const m = modelo(demoVivo("2026-11-04T10:00:00Z"), new Date("2026-11-04T12:00:00Z"), "real");
    igual([m.es_demo, m.conexion], [true, "desactualizado"]);
    verdadero(m.departamentos.every((d) => d.agentes.every((a) => a.estado_mostrado === "sin_datos")));
  });

  prueba("J · las demos fijas de datos/demo/ no caducan (siguen con su hora simulada)", async () => {
    for (const [ruta, id] of [["datos/demo/compago.json", "compago"], ["datos/demo/ek-chuah.json", "ek-chuah"]]) {
      const doc = await leerJSON(ruta);
      const m = modelo(doc, new Date("2030-01-01T00:00:00Z"), "demo", { id, nombre: id });
      igual([ruta, m.conexion, m.hora_simulada], [ruta, "en_linea", true]);
    }
  });

  prueba("J · la hora mostrada de una DEMO viva sigue siendo la simulada del archivo", () => {
    const m = modelo(demoVivo("2026-11-04T12:00:00Z"), new Date("2026-11-04T12:01:00Z"), "real");
    igual([m.ahora_referencia, m.hora_simulada], ["2026-11-04T12:00:00.000Z", true]);
  });
}
