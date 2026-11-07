// CSI · piso de la oficina virtual. Traduce el estado de CSI a `cauce.estado-proyecto` 1.0.0 SIN modificar ese contrato,
// para reutilizar edificio 3D, plano 2D, «Un cuarto», personajes y navegación. Cinco estaciones = cinco departamentos.
// Nadie aparece «trabajando»: CSI no corre solo (lo usa una persona). Los estados salen de los datos: hay pendientes
// → requiere_revision; sin datos → sin_datos; si no, esperando. Indicadores = conteos, nunca porcentajes inventados.

import { L } from "./base.js";
import { analizarInvestigacion } from "./investigacion.js";
import { relacionesVerificables } from "./actores.js";
import { simular } from "./simulador.js";

export const ESTACIONES = [
  { id: "estratega", nombre: "Estratega", rol: "Objetivos, incentivos, recursos y decisiones" },
  { id: "psicologo", nombre: "Psicólogo de Masas", rol: "Reacciones colectivas y economía conductual" },
  { id: "poder", nombre: "Analista de Poder", rol: "Relaciones verificables entre actores e instituciones" },
  { id: "simulador", nombre: "Simulador", rol: "Árboles de decisiones y escenarios alternativos" },
  { id: "abogado", nombre: "Abogado del Diablo", rol: "Objeciones, explicaciones alternativas y sesgos" },
];
const iso = (t) => new Date(t).toISOString().replace(/\.\d{3}Z$/, "Z");

export function estadoPisoCSI({ investigaciones = [], actores = null, escenarios = [], predicciones = null, es_demo, ahoraMs, version = "0.1" }) {
  const an = investigaciones.map((i) => ({ inv: i, a: analizarInvestigacion(i) }));
  const hip = an.flatMap((x) => x.a.hipotesis);
  const objAbiertas = investigaciones.flatMap((i) => L(i.objeciones)).filter((o) => o.estado === "abierta").length;
  const { verificables, sin_verificar } = relacionesVerificables(actores);
  const conductuales = investigaciones.flatMap((i) => L(i.enunciados)).filter((x) => x.sobre === "conducta" && !x.retirado).length;
  const sims = escenarios.map((e) => simular(e, { investigacion: investigaciones.find((i) => i.id === e.investigacion_id), actores }));
  const rutas = sims.reduce((s, x) => s + x.rutas.length, 0), probSim = sims.reduce((s, x) => s + x.problemas.length, 0);
  const incompletas = hip.filter((h) => h.estado === "incompleta").length;
  const pr = predicciones ?? { total: 0, sin_evaluar: 0, acertadas: 0, fallidas: 0, indeterminadas: 0 };
  const P = es_demo ? "[DEMO] " : "";
  const agente = (est, estado, descripcion) => ({ id: `csi-${est.id}`, nombre: est.nombre, rol: est.rol, estado, actividad: { descripcion: `${P}${descripcion}` } });
  const hay = investigaciones.length > 0;
  const deps = [
    { est: ESTACIONES[0], ind: [["Investigaciones", investigaciones.length], ["Actores registrados", L(actores?.actores).length], ["Hipótesis incompletas", incompletas]], estado: !hay ? "sin_datos" : incompletas ? "requiere_revision" : "esperando", d: hay ? `${hip.length} hipótesis; ${incompletas} incompletas` : "Sin investigaciones" },
    { est: ESTACIONES[1], ind: [["Enunciados de conducta", conductuales]], estado: !hay ? "sin_datos" : "esperando", d: `${conductuales} enunciados sobre conducta colectiva` },
    { est: ESTACIONES[2], ind: [["Relaciones verificables", verificables.length], ["Sin fuente", sin_verificar.length]], estado: !actores ? "sin_datos" : sin_verificar.length ? "requiere_revision" : "esperando", d: `${verificables.length} relaciones con fuente; ${sin_verificar.length} sin verificar` },
    { est: ESTACIONES[3], ind: [["Escenarios", escenarios.length], ["Rutas simuladas", rutas], ["Problemas", probSim]], estado: !escenarios.length ? "sin_datos" : probSim ? "requiere_revision" : "esperando", d: `${escenarios.length} escenario(s) · ${rutas} rutas (simulación, no resultado real)` },
    { est: ESTACIONES[4], ind: [["Objeciones abiertas", objAbiertas], ["Predicciones", pr.total], ["Sin evaluar", pr.sin_evaluar]], estado: !hay ? "sin_datos" : objAbiertas || pr.sin_evaluar ? "requiere_revision" : "esperando", d: `${objAbiertas} objeciones abiertas · ${pr.acertadas} aciertos, ${pr.fallidas} fallos, ${pr.indeterminadas} indeterminadas` },
  ];
  const doc = {
    contrato: "cauce.estado-proyecto", version: "1.0.0",
    proyecto: { id: "csi", nombre: "Inteligencia Estratégica (CSI)" },
    generado_en: iso(ahoraMs - 60_000), vigencia_segundos: es_demo ? 600 : 3600, es_demo,
    fuente: es_demo ? { tipo: "demo", nombre: "Caso ficticio de CSI (herramientas/csi.mjs demo)", version } : { tipo: "adaptador", nombre: "herramientas/csi.mjs piso (lee datos/csi/registro/)", version },
    departamentos: deps.map(({ est, ind, estado, d }) => ({ id: est.id, nombre: est.nombre, descripcion: `${P}${est.rol}. Lo usa una persona; CSI no corre solo.`, indicadores: ind.map(([etiqueta, valor]) => ({ etiqueta, valor })), agentes: [agente(est, estado, d)] })),
    alertas: objAbiertas ? [{ id: "csi-objeciones", nivel: "advertencia", titulo: `${P}${objAbiertas} objeción(es) del Abogado del Diablo sin responder`, departamento_id: "abogado", creada_en: iso(ahoraMs - 60_000) }] : [],
    resultados: [{ id: "csi-laboratorio", titulo: "Abrir el laboratorio CSI", descripcion: "Investigaciones, actores, hipótesis, árboles, predicciones y propuestas para Nexus.", departamento_id: "estratega", enlace: "?csi=1" }],
  };
  if (es_demo) doc.demo = { ahora_simulado: iso(ahoraMs) };
  return doc;
}
