// Datos de PRUEBA de Nexus (fase 1). Todo es ficticio y lleva es_demo: true. Ningún actor es una persona real.
// Cada lección muestra un caso que el gerente escéptico debe detectar (o aceptar). Se construye con las mismas
// funciones del registro, así el historial y las huellas son válidos. Corre en Node y en el navegador.

import { sha256 } from "./comun.js";
import { agregarLeccion, agregarEvento, registroVacio, leerNexus, revisionDelGerente } from "./registro.js";

const H = (t) => ({ tipo: "humano", id: t });
const IA = (t) => ({ tipo: "ia", id: t });
const P = (t) => ({ tipo: "proceso", id: t });

const base = (id, revision, extra) => ({
  contrato: "cauce.leccion", version_contrato: "0.2.0", id, revision, tipo_cambio: revision === 1 ? "alta" : "correccion", es_demo: true,
  registrado_por: H("analista-demo"), autor_conclusion: H("analista-demo"), proyectos_destino: [], antecedentes: [], validaciones: [],
  vigencia: { caduca_en: "2027-12-31T23:59:00-06:00" }, ...extra,
});

export async function leccionesDemo() {
  const h = async (t) => sha256(`[DEMO] ${t}`);
  return [
    // 1. Bien sustentada en su origen: debe salir «sin objeciones».
    base("lec-demo-compago-fotos", 1, {
      registrado_en: "2026-10-20T10:00:00-06:00", fecha_conclusion: "2026-10-19T18:00:00-06:00",
      titulo: "[DEMO] Fichas con tres o más fotos propias se aprueban más",
      enunciado: "En la muestra de octubre, las oportunidades con 3+ fotos propias pasaron la evaluación con más frecuencia que las de 1 foto.",
      proyecto_origen: "compago", proyectos_destino: ["montambre"], naturaleza_resultado: "exito", nivel_validacion: "validada_en_origen", declara_reproducible: true,
      evidencias: [
        { id: "e1", tipo: "experimento", descripcion: "[DEMO] Comparación de aprobaciones por número de fotos (120 fichas).", referencia: "demo:compago/informes/fotos-2026-10.csv",
          huella: await h("fotos-oct"), procedimiento: "Contar aprobadas/total por grupo con la consulta guardada del informe.", producida_por: P("informe-demo"),
          obtenida_en: "2026-10-19T12:00:00-06:00", usa_datos_hasta: "2026-10-15T23:59:00-06:00",
          muestra: { id: "m-compago-oct", fuente: "compago-demo", tamano: 120, periodo: { desde: "2026-10-01T00:00:00-06:00", hasta: "2026-10-15T23:59:00-06:00" } },
          metodo: { configuraciones_probadas: 1, evaluacion: "fuera_de_muestra" } },
        { id: "e2", tipo: "registro", uso: "validacion", descripcion: "[DEMO] Repetición con fichas nuevas de noviembre (80 fichas).", referencia: "demo:compago/informes/fotos-2026-11.csv",
          huella: await h("fotos-nov"), procedimiento: "La misma consulta sobre el periodo nuevo.",
          muestra: { id: "m-compago-nov", fuente: "compago-demo", tamano: 80, periodo: { desde: "2026-10-16T00:00:00-06:00", hasta: "2026-11-01T23:59:00-06:00" } } },
      ],
      validaciones: [{ por: H("revisor-demo"), en: "2026-11-02T09:00:00-06:00", ambito: "origen", proyecto: "compago", resultado: "confirma", evidencias: ["e2"] }],
    }),
    // 2. Sobreajuste, fuga de información, autovalidación de una IA y reproducibilidad solo declarada.
    base("lec-demo-ek-chuah-backtest", 1, {
      registrado_en: "2026-10-25T11:00:00-06:00", fecha_conclusion: "2026-10-25T10:00:00-06:00",
      registrado_por: IA("asistente-demo"), autor_conclusion: IA("asistente-demo"),
      titulo: "[DEMO] El cruce de medias 12/26 supera al índice en la simulación",
      enunciado: "Tras probar 40 combinaciones, la 12/26 dio el mejor rendimiento simulado del semestre.",
      proyecto_origen: "ek-chuah", naturaleza_resultado: "exito", nivel_validacion: "validada_en_origen", declara_reproducible: true,
      evidencias: [
        { id: "e1", tipo: "experimento", descripcion: "[DEMO] Simulación histórica de 40 combinaciones; se eligió la mejor.", referencia: "demo:ek-chuah/simulaciones/medias-40.json",
          usa_datos_hasta: "2026-06-30T23:59:00-06:00", muestra: { id: "m-ek-sem1", fuente: "ek-chuah-demo" },
          metodo: { configuraciones_probadas: 40, evaluacion: "en_muestra", datos_entrenamiento_hasta: "2026-06-30T23:59:00-06:00", datos_prueba_desde: "2026-03-01T00:00:00-06:00" } },
        { id: "e2", tipo: "afirmacion", uso: "validacion", descripcion: "[DEMO] «Revisé la simulación y es correcta.»" },
      ],
      validaciones: [{ por: IA("asistente-demo"), en: "2026-10-25T10:30:00-06:00", ambito: "origen", proyecto: "ek-chuah", resultado: "confirma", evidencias: ["e2"] }],
    }),
    // 3 y 4. Razonamiento circular entre dos lecciones; la 4 además concluye sin pruebas.
    base("lec-demo-tezca-local", 1, {
      registrado_en: "2026-10-26T09:00:00-06:00", fecha_conclusion: "2026-10-26T08:00:00-06:00",
      titulo: "[DEMO] Jugar de local pesa más que la forma reciente",
      enunciado: "Se deduce de la lección sobre la forma reciente.", proyecto_origen: "tezcatlipoca", naturaleza_resultado: "mixto", nivel_validacion: "hipotesis", declara_reproducible: false,
      evidencias: [], antecedentes: [{ leccion_id: "lec-demo-tezca-forma", relacion: "deriva_de" }],
    }),
    base("lec-demo-tezca-forma", 1, {
      registrado_en: "2026-10-26T09:30:00-06:00", fecha_conclusion: "2026-10-26T09:10:00-06:00",
      titulo: "[DEMO] La forma reciente explica los resultados",
      enunciado: "Confirmado porque coincide con la lección de jugar de local.", proyecto_origen: "tezcatlipoca", naturaleza_resultado: "exito", nivel_validacion: "validada_en_origen", declara_reproducible: false,
      evidencias: [{ id: "e1", tipo: "afirmacion", descripcion: "[DEMO] «Se ve claramente en los partidos.»" }],
      antecedentes: [{ leccion_id: "lec-demo-tezca-local", relacion: "apoya" }],
    }),
    // 5. Hipótesis que se corrige (la revisión 1 queda en el historial).
    base("lec-demo-cauce-una-pantalla", 1, {
      registrado_en: "2026-10-28T12:00:00-06:00", fecha_conclusion: "2026-10-28T11:00:00-06:00",
      titulo: "[DEMO] Ver todos los pisos en una pantalla reduce revisiones olvidadas",
      enunciado: "Hipótesis: la sala de control ayuda a no olvidar asuntos pendientes.", proyecto_origen: "cauce", naturaleza_resultado: "inconcluso", nivel_validacion: "hipotesis",
      evidencias: [], vigencia: undefined,
    }),
    base("lec-demo-cauce-una-pantalla", 2, {
      registrado_en: "2026-10-29T12:00:00-06:00", fecha_conclusion: "2026-10-28T11:00:00-06:00", motivo_cambio: "Se aclara que todavía no es reproducible y se fija su caducidad.",
      titulo: "[DEMO] Ver todos los pisos en una pantalla reduce revisiones olvidadas",
      enunciado: "Hipótesis: la sala de control ayuda a no olvidar asuntos pendientes.", proyecto_origen: "cauce", proyectos_destino: ["compago"], naturaleza_resultado: "inconcluso", nivel_validacion: "hipotesis",
      declara_reproducible: false, evidencias: [],
    }),
    // 6. Le falta información: el gerente no puede decidir (incompleto, nunca aprobado).
    base("lec-demo-compago-resenas", 1, {
      registrado_en: "2026-10-30T16:00:00-06:00", fecha_conclusion: "2026-10-30T15:00:00-06:00",
      titulo: "[DEMO] Responder reseñas en menos de 24 h mejora la recompra",
      enunciado: "Dos registros sugieren más recompra cuando se responde rápido.", proyecto_origen: "compago", naturaleza_resultado: "exito", nivel_validacion: "hipotesis", declara_reproducible: false,
      evidencias: [
        { id: "e1", tipo: "registro", descripcion: "[DEMO] Recompras con respuesta rápida." },
        { id: "e2", tipo: "registro", descripcion: "[DEMO] Recompras con respuesta lenta." },
      ],
    }),
  ].map((v) => { const c = { ...v }; for (const k of Object.keys(c)) if (c[k] === undefined) delete c[k]; return c; });
}

const evento = (id, secuencia, tipo, en, por, extra = {}) => ({ contrato: "cauce.recomendacion", version_contrato: "0.2.0", id, secuencia, tipo, en, por, es_demo: true, ...extra });

export async function construirDemo() {
  let lecciones = { ...registroVacio("lecciones", { es_demo: true }), descripcion: "[DEMO] Lecciones ficticias para probar Nexus fase 1. No son conclusiones reales de ningún proyecto." };
  for (const v of await leccionesDemo()) {
    const r = await agregarLeccion(lecciones, v);
    if (!r.ok) throw new Error(`${v.id} rev. ${v.revision}: ${r.errores.join(" ")}`);
    lecciones = r.doc;
  }
  let recomendaciones = { ...registroVacio("recomendaciones", { es_demo: true }), descripcion: "[DEMO] Recomendaciones ficticias. Nexus solo las registra: no ejecuta nada en ningún proyecto." };
  const nx = await leerNexus({ lecciones });
  const agregar = async (ev) => {
    const r = await agregarEvento(recomendaciones, ev, lecciones);
    if (!r.ok) throw new Error(`${ev.id} #${ev.secuencia}: ${r.errores.join(" ")}`);
    recomendaciones = r.doc;
  };
  const revisar = async (id, secuencia, en) => {
    const contenido = recomendaciones.eventos.find((e) => e.id === id && e.tipo === "propuesta").contenido;
    await agregar(revisionDelGerente(nx, { id, contenido }, { en, secuencia, es_demo: true }));
  };
  const contenido = (titulo, descripcion, proyecto_destino, lecciones_, extra = {}) => ({ titulo, descripcion, proyecto_destino, lecciones: lecciones_, reversible: true,
    criterio_exito: "[DEMO] Medir la misma métrica antes y después, con una muestra nueva.", ...extra });

  // R1: lista para que una persona decida (sin bloqueos).
  await agregar(evento("rec-demo-fotos-montambre", 1, "propuesta", "2026-11-03T10:00:00-06:00", H("analista-demo"), {
    contenido: contenido("[DEMO] Probar fichas con 3+ fotos en Montambre", "Llevar la lección de Compago a un piloto pequeño en Montambre.", "montambre", [{ id: "lec-demo-compago-fotos", revision: 1 }]) }));
  await revisar("rec-demo-fotos-montambre", 2, "2026-11-03T10:05:00-06:00");
  // R2: propuesta por una IA (preparado para el futuro); el gerente encuentra objeciones y bloquea la aprobación.
  await agregar(evento("rec-demo-medias-ek-chuah", 1, "propuesta", "2026-11-03T11:00:00-06:00", IA("asistente-demo"), {
    contenido: contenido("[DEMO] Usar el cruce 12/26 en las simulaciones", "Adoptar la mejor combinación del backtest.", "ek-chuah", [{ id: "lec-demo-ek-chuah-backtest", revision: 1 }]) }));
  await revisar("rec-demo-medias-ek-chuah", 2, "2026-11-03T11:05:00-06:00");
  // R3: aprobada por una persona para EXPERIMENTAR. Aprobada no es implementada.
  await agregar(evento("rec-demo-sala-compago", 1, "propuesta", "2026-11-04T09:00:00-06:00", H("analista-demo"), {
    contenido: contenido("[DEMO] Medir si la sala de control reduce asuntos olvidados", "Contar durante dos semanas los asuntos atendidos tarde.", "compago", [{ id: "lec-demo-cauce-una-pantalla", revision: 2 }]) }));
  await revisar("rec-demo-sala-compago", 2, "2026-11-04T09:05:00-06:00");
  await agregar(evento("rec-demo-sala-compago", 3, "aprobacion", "2026-11-04T12:00:00-06:00", H("director-demo"), { alcance: "experimento", nota: "[DEMO] Se aprueba solo el experimento de dos semanas." }));
  return { lecciones, recomendaciones };
}
