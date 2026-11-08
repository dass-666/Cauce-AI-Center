// Laboratorio de IA · fase 3 · cómo se presenta un trabajo en la oficina (lógica pura, sin DOM, probada aparte).
//
// Dos ejes que no se mezclan:
//   · NATURALEZA: quién produce el análisis (guion DEMO, IA por intercambio manual, IA automática). Sale del adaptador
//     del trabajo y de la autoría registrada en sus ejecuciones; nunca del texto de una respuesta.
//   · FASE: en qué punto está (esperando al modelo, verificando, con evidencia insuficiente, esperando a una persona,
//     terminado o rechazado). Sale del estado del trabajo.
// Regla de Cauce: no se representa actividad falsa. «Verificando» solo aparece mientras el Coordinador está corriendo
// de verdad (lo indica quien llama); un trabajo que espera a una persona o a un modelo se muestra quieto.

import { L } from "./base.js";
import { autoriaDeEjecucion } from "./contratos.js";

export const NATURALEZA = Object.freeze({
  guion_demo: { etiqueta: "DEMO · guion sin modelo", corta: "Guion DEMO", clase: "nat-guion" },
  ia_manual: { etiqueta: "IA · respuesta manual (procedencia declarada)", corta: "IA manual", clase: "nat-manual" },
  ia_automatica: { etiqueta: "IA · proveedor automático", corta: "IA automática", clase: "nat-auto" },
});
export const FASE = Object.freeze({
  pendiente: { etiqueta: "Pendiente", clase: "c-demo" },
  pendiente_de_modelo: { etiqueta: "Pendiente de modelo", clase: "c-espera" },
  en_verificacion: { etiqueta: "En verificación", clase: "c-real" },
  evidencia_insuficiente: { etiqueta: "Evidencia insuficiente", clase: "c-aviso" },
  pendiente_aprobacion: { etiqueta: "Pendiente de aprobación humana", clase: "c-aviso" },
  error: { etiqueta: "Error", clase: "c-error" },
  terminado: { etiqueta: "Terminado · aprobado por una persona", clase: "c-real" },
  rechazado: { etiqueta: "Rechazado", clase: "c-error" },
});

const NAT_ADAPTADOR = { "sin-modelo": "guion_demo", "manual-claude": "ia_manual", ollama: "ia_automatica", automatico: "ia_automatica" };

/** Naturaleza del trabajo. Si alguna ejecución registrada contradice al adaptador, gana lo registrado (y se avisa). */
export function naturalezaDe(x) {
  const declarada = NAT_ADAPTADOR[x?.trabajo?.adaptador?.id] ?? "guion_demo";
  const registradas = new Set([...(x?.ejecuciones?.values?.() ?? [])].map((ej) => autoriaDeEjecucion(ej).tipo));
  const otra = [...registradas].find((t) => t !== declarada);
  return { tipo: otra ?? declarada, ...NATURALEZA[otra ?? declarada], incoherente: !!otra };
}

/** Fase visible. `corriendo` = el Coordinador está trabajando AHORA sobre este trabajo (lo sabe la vista, no los datos). */
export function faseDe(x, { corriendo = false } = {}) {
  const t = x?.trabajo;
  const k = !t ? "pendiente"
    : t.estado === "en_analisis" || (corriendo && t.estado === "pendiente") ? "en_verificacion"
    : t.estado === "pendiente" ? (t.espera ? "pendiente_de_modelo" : "pendiente")
    : t.estado === "requiere_evidencia" ? "evidencia_insuficiente"
    : t.estado === "requiere_revision" ? "pendiente_aprobacion"
    : t.estado === "aprobado_por_humano" ? "terminado"
    : t.estado === "rechazado" ? "rechazado" : "error";
  return { fase: k, ...FASE[k] };
}

/** Rol que espera respuesta (o null) y resumen de lo que produjo cada rol, para la oficina. */
export function rolesDe(x) {
  const t = x?.trabajo;
  return ["investigador", "analista", "critico"].map((rol) => {
    const p = L(t?.pasos).find((q) => q.rol === rol);
    const ej = p ? x.ejecuciones.get(p.ejecuciones.at(-1)) : null;
    const au = ej ? autoriaDeEjecucion(ej) : null;
    return {
      rol, espera: t?.espera?.rol === rol, autoria: au?.tipo ?? null, modelo: au?.modelo ?? null, resultado_lab_v: p?.resultado_verificacion ?? null,
      n: ej ? { afirmaciones: L(ej.afirmaciones).length, hipotesis: L(ej.hipotesis).length, objeciones: L(ej.objeciones).length, dudas: L(ej.dudas).length, recomendaciones: L(ej.recomendaciones).length } : null,
    };
  });
}
