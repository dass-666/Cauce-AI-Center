// Laboratorio de IA · fase 2 · Laboratorio → Nexus: SOLO prepara una propuesta. Nunca escribe en el almacén de Nexus.
//
// Reglas:
//   · solo un trabajo APROBADO POR UNA PERSONA puede generar propuesta (el Laboratorio no se aprueba a sí mismo);
//   · el borrador de `cauce.leccion` 0.3 llega SIEMPRE como «propuesta», confianza baja, sin resultado medido;
//   · origen.tipo = «texto_ia» también para el guion sin modelo: es el tipo que Nexus trata con más escepticismo
//     (no existe un tipo «guion»; usar otro haría parecer más sólida la propuesta);
//   · la aprobación del informe NO es una validación de la lección: Nexus la juzga con sus reglas y una persona decide;
//   · la evidencia son las citas que lab-V comprobó, con la huella de la lectura del motor; nunca la salida de un rol.

import { L, texto, buscarDatosPrivados } from "./base.js";
import { validarLeccion } from "../nexus/leccion.js";
import { evaluarLeccion } from "../nexus/gerente.js";

export const CONTRATO_PROPUESTA_LAB = "cauce.lab.propuesta-nexus";
const dia = (iso) => new Date(Date.parse(iso)).toISOString().slice(0, 10);
const masDias = (iso, d) => new Date(Date.parse(iso) + d * 864e5).toISOString().slice(0, 10);

/**
 * @param trabajo  cauce.lab.trabajo en estado aprobado_por_humano
 * @param informe  cauce.lab.informe del trabajo (misma referencia)
 * @param opciones { hallazgo_id: hallazgo del informe a proponer, fecha, ahoraMs }
 */
export function prepararPropuestaNexus(trabajo, informe, { hallazgo_id, fecha, ahoraMs = Date.parse(fecha) }) {
  const errores = [];
  if (trabajo?.estado !== "aprobado_por_humano" || trabajo?.decision_humana?.por?.tipo !== "humano") errores.push("Solo un trabajo aprobado por una persona genera propuestas para Nexus.");
  if (!informe || trabajo?.informe?.id !== informe.id) errores.push("El informe no es el que aprobó la persona.");
  const h = L(informe?.hallazgos).find((x) => x.id === hallazgo_id);
  if (!h) errores.push(`El hallazgo «${hallazgo_id}» no está en el informe.`);
  if (errores.length) return { ok: false, errores };
  const citas = L(h.citas).filter((c) => c.utilizable);
  const objs = L(informe.objeciones).filter((o) => h.objeciones.includes(o.id));
  const borrador = {
    id: `lab.${trabajo.id}.${h.id}`.toLowerCase().replace(/[^a-z0-9._-]/g, "-").slice(0, 80),
    esquema: "cauce.leccion", version_esquema: "0.3", tipo: "hallazgo",
    origen: { proyecto: "laboratorio-ia", componente: "lab-coordinador", version_sistema: informe.autor.version, tipo: "texto_ia" },
    autor: { tipo: informe.modo.es_ia ? "ia" : "codigo", identificador: informe.modo.es_ia ? `laboratorio-ia:${informe.modo.adaptador}` : "guion-demo-sin-modelo" },
    hallazgo: `[LABORATORIO${trabajo.es_demo ? " · DEMO" : ""}${informe.modo.es_ia ? "" : " · SIN MODELO"}] ${h.texto}`,
    antecedentes: [],
    evidencia: citas.map((c) => ({ tipo: "fuente_documental", referencia: `${trabajo.origen.nombre}: ficha ${c.fuente_id} (lectura ${trabajo.origen.generado_en}, huella ${trabajo.origen.sha256_documento.slice(0, 16)}…) · «${c.extracto.slice(0, 200)}»`, ubicacion: "fuera_de_repo", base_conocimiento: "observed", conocido_en: trabajo.origen.leido_en, proyecto_ejecutor: trabajo.origen.motor, reproducible_declarado: true })),
    procedencia: { metodo: "Laboratorio de IA: ficha de solo lectura del motor; roles Investigador, Analista y Abogado del Diablo; citas comprobadas por lab-V; informe aprobado por una persona.", alcance: informe.pregunta, limitaciones_fuente: ["Una sola fuente: la ficha que publica el propio motor.", ...L(informe.limitaciones).slice(0, 3)] },
    fecha_hallazgo: dia(fecha), vigente_hasta: masDias(fecha, 30),
    muestra: { n: 1, unidad: "lectura del motor", n_efectivo: null, independencia: "no evaluada", naturaleza: trabajo.es_demo ? "demo" : "desconocida", naturaleza_resultado: "sin_resultado", seleccion_en_muestra: false, cobertura: `Una lectura de ${trabajo.origen.nombre} (${trabajo.origen.generado_en}).`, supuestos: objs.filter((o) => o.tipo === "supuesto").map((o) => o.texto.slice(0, 300)) },
    confianza: { nivel: "baja", objeto: "efecto_operativo", justificacion: `Clase «${h.clase}», incertidumbre ${h.incertidumbre}; respaldo semántico revisado solo por quien aprobó el informe.` },
    limitaciones: ["Es una observación de una sola lectura, no una regla general.", ...objs.map((o) => `Objeción (${o.tipo}): ${o.texto.slice(0, 300)}`)],
    aplicaciones_posibles: [],
    validacion: { estado: "propuesta", validado_en: [] },
    revisiones: [{ fecha, autor_tipo: "humano", autor: trabajo.decision_humana.por.identificador, decision: "propuesta", justificacion: `Aprobó el informe ${informe.id} del Laboratorio (no la lección): ${trabajo.decision_humana.motivo}`.slice(0, 500), version: "r1" }],
    sensibilidad: "interno",
  };
  const forma = validarLeccion(borrador);
  const dictamen = evaluarLeccion(borrador, { ahora: ahoraMs });
  const propuesta = {
    contrato: CONTRATO_PROPUESTA_LAB, version_contrato: "0.1", id: `prop-${trabajo.id}-${h.id}`.replace(/[^a-z0-9._-]/gi, "-"), es_demo: trabajo.es_demo, creada_en: fecha,
    trabajo: { id: trabajo.id, estado: trabajo.estado, aprobado_por: trabajo.decision_humana.por.identificador, informe: trabajo.informe },
    hallazgo: { id: h.id, clase: h.clase, incertidumbre: h.incertidumbre, citas_verificadas: citas.length, objeciones: objs.map((o) => o.id) },
    revision_esceptica: { version_reglas: dictamen.version_reglas, dictamen: dictamen.dictamen.estado, no_cumple: dictamen.dictamen.no_cumple, no_evaluado: dictamen.dictamen.no_evaluado, errores_forma: forma.errores },
    decision_nexus: { estado: "pendiente", nota: "Esta propuesta no se escribe en el almacén de Nexus. Una persona decide si la importa, con sus reglas y su aprobador." },
    borrador_leccion: borrador,
  };
  const privados = buscarDatosPrivados(propuesta);
  if (privados.length) return { ok: false, errores: privados.map((p) => `No se envía: dato privado en ${p.ruta} (${p.motivo}).`) };
  if (!texto(propuesta.borrador_leccion.hallazgo)) return { ok: false, errores: ["Hallazgo vacío."] };
  return { ok: true, propuesta, errores: [] };
}
