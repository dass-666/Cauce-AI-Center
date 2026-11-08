// Laboratorio de IA · fase 2 · trabajos DEMO de punta a punta (deterministas). Los usan la oficina, la herramienta
// de línea de comandos y las pruebas. Todos salen de los archivos DEMO que la oficina ya muestra (datos/demo/*.json).
//
//   1. Compago DEMO  · guion sin modelo                         → requiere revisión humana
//   2. Ek Chuah DEMO · guion sin modelo                         → requiere revisión humana
//   3. Prueba de lab-V · guion con una cita inventada A PROPÓSITO → requiere evidencia (lab-V la detecta)
//   4. Prueba de fallo · el adaptador pierde la conexión dos veces → error → reintento → requiere revisión
// Ninguno es IA. Ninguno queda aprobado: eso lo decide una persona.

import { fichaDesdeEstado } from "./motores.js";
import { nuevoTrabajo } from "./trabajo.js";
import { nuevoExpediente, avanzar, reintentar, relojDesde } from "./coordinador.js";
import { ADAPTADOR_SIN_MODELO, crearAdaptadorConFallos } from "./adaptadores.js";
import { MARCA_GUION } from "./guion-demo.js";

const mas = (iso, s) => new Date(Date.parse(iso) + s * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
export const PREGUNTA_DEMO = "[DEMO] ¿Qué problemas muestra la última lectura del motor, qué explicaciones caben y qué información falta para decidir?";

/** Doble de prueba: el guion, con una cita inventada y un extracto alterado en la salida del Investigador. */
export function crearAdaptadorManipulado(base = ADAPTADOR_SIN_MODELO) {
  return Object.freeze({
    ...base, nombre: `${base.nombre} · con una cita inventada a propósito (prueba de lab-V)`,
    async ejecutar(p) {
      const r = await base.ejecutar(p);
      if (p.encargo.rol !== "investigador") return r;
      const c = structuredClone(r.contenido);
      c.afirmaciones.push({ id: "px1", texto: `${MARCA_GUION} [PRUEBA] El motor confirmó que todas las importaciones de la semana se aplicaron sin errores.`, clase: "hecho_citado",
        citas: [{ fuente_id: "demo-informe-interno-inexistente", extracto: "Todas las importaciones de la semana se aplicaron sin errores.", ubicacion: null }] });
      const h = c.afirmaciones.find((a) => a.citas.length);
      if (h) c.afirmaciones.push({ id: "px2", texto: `${MARCA_GUION} [PRUEBA] Copia de «${h.id}» con el extracto alterado.`, clase: "hecho_citado", citas: [{ ...h.citas[0], extracto: h.citas[0].extracto.replace(/\d+/, (n) => String(Number(n) + 7)) }] });
      return { ...r, contenido: c };
    },
  });
}

async function uno({ documento, id, titulo, adaptador, fallos = null, reintentarTras = false, solicitante = "diego" }) {
  const ahora = documento.demo?.ahora_simulado ?? documento.generado_en;
  const ficha = await fichaDesdeEstado(documento, { leido_en: ahora });
  if (!ficha.ok) return { ok: false, errores: ficha.errores };
  const creado_en = mas(ahora, 60);
  const trabajo = nuevoTrabajo({ id, es_demo: true, titulo, pregunta: PREGUNTA_DEMO, origen: ficha.origen, solicitado_por: { tipo: "humano", identificador: solicitante }, creado_en, adaptador: { id: "sin-modelo", modelo: null } });
  const reloj = relojDesde(creado_en);
  let x = nuevoExpediente(trabajo, ficha);
  x = await avanzar(x, { adaptador: fallos ? crearAdaptadorConFallos(adaptador, fallos) : adaptador, reloj });
  if (reintentarTras && x.trabajo.estado === "error") {
    x = reintentar(x, { motivo: "Reintento tras perder la conexión con el adaptador (prueba).", en: reloj() });
    x = await avanzar(x, { adaptador, reloj });
  }
  return { ok: true, expediente: x };
}

/**
 * @param docs { compago, "ek-chuah" } documentos DEMO del contrato cauce.estado-proyecto (los de datos/demo/)
 * @returns {Promise<{expedientes: object[], errores: string[]}>}
 */
export async function escenariosDemo(docs) {
  const errores = [], expedientes = [];
  const pon = (r) => { if (r.ok) expedientes.push(r.expediente); else errores.push(...r.errores); };
  const c = docs?.compago, e = docs?.["ek-chuah"];
  for (const [d, nombre] of [[c, "compago"], [e, "ek-chuah"]]) if (d && d.es_demo !== true) errores.push(`${nombre}: el escenario DEMO solo usa documentos DEMO (es_demo = true).`);
  if (errores.length) return { expedientes, errores };
  if (c) pon(await uno({ documento: c, id: "demo-lab-trb-compago-001", titulo: "Compago · ¿qué problemas muestra la última lectura?", adaptador: ADAPTADOR_SIN_MODELO }));
  if (e) pon(await uno({ documento: e, id: "demo-lab-trb-ek-chuah-001", titulo: "Ek Chuah · ¿qué problemas muestra la última lectura?", adaptador: ADAPTADOR_SIN_MODELO }));
  if (c) pon(await uno({ documento: c, id: "demo-lab-trb-prueba-lab-v", titulo: "Prueba de lab-V · respuesta con una cita inventada a propósito", adaptador: crearAdaptadorManipulado() }));
  if (e) pon(await uno({ documento: e, id: "demo-lab-trb-prueba-fallo", titulo: "Prueba de fallo · el adaptador pierde la conexión y se reintenta", adaptador: ADAPTADOR_SIN_MODELO, fallos: ["sin_conexion", "sin_conexion"], reintentarTras: true }));
  return { expedientes, errores };
}
