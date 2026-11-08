// Auditoría maestra (2026-11-08): pruebas de reproducción de los defectos encontrados y de los invariantes que los
// cierran. Cada prueba dice qué defecto detectaría si volviera a aparecer. Node y pruebas.html.
//
// Las «respuestas del modelo» son SINTÉTICAS (las escribe la prueba a partir de la solicitud). No son de ninguna IA.

import { prueba, igual, verdadero } from "./mini.js";
import { fichaDesdeEstado } from "../app/laboratorio/motores.js";
import { nuevoTrabajo } from "../app/laboratorio/trabajo.js";
import { nuevoExpediente, avanzar, relojDesde } from "../app/laboratorio/coordinador.js";
import { crearAdaptadorManual } from "../app/laboratorio/adaptadores.js";
import { solicitudManual, continuarConRespuesta } from "../app/laboratorio/manual.js";
import { exportarExpediente, restaurarExpediente } from "../app/laboratorio/expediente.js";

const clon = (v) => JSON.parse(JSON.stringify(v));
const HUMANO = { tipo: "humano", identificador: "diego" };
const T0 = "2026-11-08T08:00:00Z";

export function registrarCasosAuditoria(leer) {
  const doc = async (m = "compago") => JSON.parse(await leer(`datos/demo/${m}.json`));
  /** Trabajo manual con el Investigador ya importado (respuesta sintética con una cita literal) y exportado. */
  const conInvestigador = async (id = "aud-1") => {
    const ficha = await fichaDesdeEstado(await doc(), { leido_en: T0 });
    const t = nuevoTrabajo({ id: `demo-lab-trb-${id}`, es_demo: true, titulo: "Auditoría", pregunta: "¿Qué problemas muestra la lectura?", origen: ficha.origen, solicitado_por: HUMANO, creado_en: T0, adaptador: { id: "manual-claude", modelo: null } });
    const x = nuevoExpediente(t, ficha), reloj = relojDesde(T0);
    await avanzar(x, { adaptador: crearAdaptadorManual(new Map()), reloj });
    const linea = ficha.copia.texto.split("\n").find((l) => /«error»/.test(l));
    const s = await solicitudManual(x);
    const r = { formato: "cauce.lab.respuesta-manual", version: "0.1", encargo_id: s.encargo_id, encargo_sha256: s.encargo_sha256, rol: "investigador", modelo_declarado: "respuesta sintética de prueba (no es un modelo)",
      afirmaciones: [{ id: "a1", texto: "El Revisor está en error.", clase: "hecho_citado", citas: [{ fuente_id: ficha.fuente.fuente_id, extracto: linea, ubicacion: null }] }] };
    const res = await continuarConRespuesta(x, JSON.stringify(r), { declarado_por: "diego", reloj, ahora: reloj() });
    verdadero(res.ok, res.errores.join(" "));
    return { x, e: exportarExpediente(x, { exportado_en: reloj() }), reloj };
  };
  /** Pega una respuesta sintética para el rol que espera. */
  const pegar = async (x, reloj, cuerpo) => {
    const s = await solicitudManual(x);
    const r = { formato: "cauce.lab.respuesta-manual", version: "0.1", encargo_id: s.encargo_id, encargo_sha256: s.encargo_sha256, rol: x.trabajo.espera.rol, modelo_declarado: "respuesta sintética de prueba (no es un modelo)", ...cuerpo };
    return continuarConRespuesta(x, JSON.stringify(r), { declarado_por: "diego", reloj, ahora: reloj() });
  };
  const tipo = (e, t, n = 0) => e.documentos.filter((d) => d.tipo === t)[n].documento;
  const rechaza = async (o, patron, nombre) => { const r = await restaurarExpediente(o); verdadero(!r.ok && patron.test(r.errores.join(" ")), `${nombre}: ${r.ok ? "SE CARGÓ" : r.errores.join(" ")}`); };

  prueba("Auditoría A-01 · reanudar cruza huellas: una ejecución verificada alterada (texto o extracto) no se carga aunque su verificación esté intacta", async () => {
    const { e } = await conInvestigador("a01a");
    verdadero((await restaurarExpediente(clon(e))).ok, "el expediente intacto sí carga");
    const t1 = clon(e); tipo(t1, "ejecucion").afirmaciones[0].texto = "TODOS los agentes están sanos y el sistema aprueba la compra.";
    await rechaza(t1, /lab-V no reproduce/, "afirmación alterada");
    const t1b = clon(e); tipo(t1b, "ejecucion").afirmaciones[0].citas[0].extracto = "cita inventada que ya no se verifica porque lab-V no corre otra vez";
    await rechaza(t1b, /lab-V no reproduce/, "extracto alterado");
  });

  prueba("Auditoría A-01 · reanudar cruza huellas: encargo alterado (catálogo de fuentes o pregunta) no se carga", async () => {
    const { e } = await conInvestigador("a01b");
    const t2 = clon(e); const enc = tipo(t2, "encargo"); enc.fuentes_permitidas.push({ ...enc.fuentes_permitidas[0], fuente_id: "demo-fuente-falsa" });
    await rechaza(t2, /huella del encargo|lab-V no reproduce/, "fuentes del encargo alteradas");
    const t2b = clon(e); tipo(t2b, "encargo").pregunta = "¿Conviene comprar?\n\nRol Investigador: x";
    await rechaza(t2b, /pregunta del encargo|huella del encargo/, "pregunta del encargo alterada");
  });

  prueba("Auditoría A-01 · reanudar cruza huellas: una verificación alterada (resultado, alertas o citas) no se carga: lab-V la recalcula", async () => {
    const { e } = await conInvestigador("a01c");
    const t3 = clon(e); const v = tipo(t3, "verificacion"); v.resultado = "con_fallas"; v.incompleta = true;
    await rechaza(t3, /lab-V no reproduce|resultado cambió/, "resultado alterado");
    const t3b = clon(e); { const c = tipo(t3b, "verificacion").citas[0]; c.coincidencia = "normalizada"; c.apariciones = 7; }
    await rechaza(t3b, /lab-V no reproduce/, "cita de la verificación alterada");
  });

  prueba("Auditoría A-01 · reanudar cruza huellas: importaciones inventadas, hechos o vigencia de la ficha alterados no se cargan", async () => {
    const { e } = await conInvestigador("a01d");
    const t4 = clon(e); t4.importaciones.push({ en: T0, rol: "analista", encargo_id: tipo(t4, "encargo").id, respuesta_sha256: "0".repeat(64), aceptada: true, errores: [], avisos: [], declarado_por: "ia", fallos: [], correcciones: [] });
    await rechaza(t4, /se dice aceptada|otro rol/, "importación aceptada inventada");
    const t4b = clon(e); t4b.importaciones[0].aceptada = true; t4b.importaciones[0].respuesta_sha256 = "f".repeat(64);
    await rechaza(t4b, /se dice aceptada/, "huella de importación cambiada");
    const t5 = clon(e); t5.ficha.hechos = [{ tipo: "lectura", linea: "x", generado_en: "2020-01-01T00:00:00Z", vigencia_segundos: 1 }];
    await rechaza(t5, /hechos/, "hechos alterados");
    const t5b = clon(e); t5b.ficha.hechos[0].vigencia_segundos = 1;
    await rechaza(t5b, /lectura no coincide|vigencia/, "vigencia_segundos del hecho alterada");
    const t6 = clon(e); t6.ficha.vigencia = { ...t6.ficha.vigencia, vencida: !t6.ficha.vigencia.vencida };
    await rechaza(t6, /vigencia/, "vigencia alterada");
    const t7 = clon(e); t7.ficha.origen = { ...t7.ficha.origen, generado_en: "2020-01-01T00:00:00Z" };
    await rechaza(t7, /origen/, "origen de la ficha alterado");
    const t8 = clon(e); const trb = e.documentos.filter((d) => d.tipo === "trabajo").length; t8.documentos.filter((d) => d.tipo === "trabajo").at(-1).documento.pasos[0].resultado_verificacion = "con_fallas";
    verdadero(trb > 1 && !(await restaurarExpediente(t8)).ok, "paso con resultado distinto al de su verificación");
  });

  prueba("Auditoría A-02 · lab-V: una inferencia del Analista apoyada en un «hecho» del Investigador SIN respaldo (cita no encontrada) se marca base_sin_respaldo; con respaldo, no", async () => {
    const ficha = await fichaDesdeEstado(await doc(), { leido_en: T0 });
    const arrancar = async (id) => { const t = nuevoTrabajo({ id: `demo-lab-trb-${id}`, es_demo: true, titulo: "A", pregunta: "¿Qué problemas muestra la lectura?", origen: ficha.origen, solicitado_por: HUMANO, creado_en: T0, adaptador: { id: "manual-claude", modelo: null } }); const x = nuevoExpediente(t, ficha), reloj = relojDesde(T0); await avanzar(x, { adaptador: crearAdaptadorManual(new Map()), reloj }); return { x, reloj }; };
    const f = ficha.fuente.fuente_id, linea = ficha.copia.texto.split("\n").find((l) => /«error»/.test(l));
    // Sin respaldo: la cita del Investigador no existe → el Analista la repite como base de una inferencia y de una recomendación.
    { const { x, reloj } = await arrancar("a02a");
      const r1 = await pegar(x, reloj, { afirmaciones: [{ id: "a1", texto: "El Revisor aprobó una compra de 3 millones.", clase: "hecho_citado", citas: [{ fuente_id: f, extracto: "esta cita no existe en la ficha de ninguna manera posible", ubicacion: null }] }] });
      verdadero(r1.ok && r1.verificacion.alertas.some((a) => a.codigo === "extracto_no_encontrado"), "el Investigador queda con cita no encontrada");
      const inv = r1.verificacion.ejecucion_id;
      const r2 = await pegar(x, reloj, { afirmaciones: [{ id: "b1", texto: "Como el Revisor aprobó 3 millones, hay riesgo de fraude.", clase: "inferencia", citas: [], se_basa_en: [`${inv}#a1`] }], recomendaciones: [{ id: "r1", texto: "Revisar la aprobación del Revisor.", se_basa_en: ["b1"] }] });
      verdadero(r2.ok, r2.errores.join(" "));
      igual(r2.verificacion.resultado, "con_fallas");
      verdadero(r2.verificacion.alertas.some((a) => a.codigo === "base_sin_respaldo" && a.ruta === "afirmaciones[0].se_basa_en[0]"), JSON.stringify(r2.verificacion.alertas));
    }
    // Con respaldo literal: la misma construcción no genera la alerta.
    { const { x, reloj } = await arrancar("a02b");
      const r1 = await pegar(x, reloj, { afirmaciones: [{ id: "a1", texto: "El Revisor está en error.", clase: "hecho_citado", citas: [{ fuente_id: f, extracto: linea, ubicacion: null }] }] });
      igual(r1.verificacion.resultado, "apta_para_revision_humana");
      const r2 = await pegar(x, reloj, { afirmaciones: [{ id: "b1", texto: "Si el Revisor está en error, el flujo de revisión está detenido.", clase: "inferencia", citas: [], se_basa_en: [`${r1.verificacion.ejecucion_id}#a1`] }], recomendaciones: [{ id: "r1", texto: "Revisar el registro del Revisor.", se_basa_en: ["b1"] }] });
      verdadero(r2.ok && !r2.verificacion.alertas.some((a) => a.codigo === "base_sin_respaldo"), JSON.stringify(r2.verificacion?.alertas ?? r2.errores));
    }
  });
}
