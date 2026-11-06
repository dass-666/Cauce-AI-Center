// Identidad y aprobación humana en Nexus (fase 1.5). HOY NO HAY AUTENTICACIÓN: toda identidad es DECLARADA, es decir,
// un alias que alguien escribió. Sirve para saber quién dice haber decidido, no para probarlo. Por eso:
//  - el almacén real solo admite decisiones (aprobar, rechazar, aplazar) de los aprobadores que lista datos/nexus/politica.json,
//    registradas por esa misma persona, con fecha con zona y motivo; y la oficina las muestra como «identidad declarada»;
//  - una entrada no puede decir que su identidad está «autenticada» mientras no exista un verificador real;
//  - aprobar nunca ejecuta: Nexus solo registra lo que una persona hizo fuera (ver recomendacion.js, validarPaso).
// Integración futura con CauceService: un verificador con la misma forma que SIN_AUTENTICACION (ver docs/NEXUS-FASE-1-5.md).
// Aquí no se implementa, no se inventan usuarios ni se guardan contraseñas o tokens.

import { texto, mismoId, esFechaConZona } from "./comun.js";

export const POLITICA = "cauce.nexus.politica";
export const DECISIONES = ["aprobada", "rechazada", "aplazada"];

/** Verificador por omisión: no hay autenticación. Uno real (CauceService) devolvería {autenticada: true, sujeto, proveedor}. */
export const SIN_AUTENTICACION = Object.freeze({
  nombre: "ninguna",
  verificar: () => ({ autenticada: false, motivo: "Sin autenticación: Cauce todavía no está conectado a CauceService. La identidad es declarada." }),
});

/** Forma de datos/nexus/politica.json. */
export function validarPolitica(p) {
  const e = [];
  if (!p || typeof p !== "object") return ["La política debe ser un objeto JSON."];
  if (p.contrato !== POLITICA) e.push(`contrato debe ser "${POLITICA}".`);
  for (const k of Object.keys(p)) if (!["contrato", "version_contrato", "aprobadores_declarados", "autenticacion", "nota"].includes(k)) e.push(`${k}: clave desconocida.`);
  if (!Array.isArray(p.aprobadores_declarados) || !p.aprobadores_declarados.length || p.aprobadores_declarados.some((a) => !texto(a) || a.includes("@"))) e.push("aprobadores_declarados: lista de alias (no correos), al menos uno.");
  if (p.autenticacion !== "ninguna") e.push("autenticacion: en la fase 1.5 solo «ninguna» (no hay verificador real).");
  return e;
}

/**
 * Revisa una decisión humana sobre una recomendación (paso de «pendiente_aprobacion» a aprobada/rechazada/aplazada).
 * @param sobre    {registrado_por} de la entrada que la registra
 * @param opciones { es_demo, politica }  — en el almacén real la política es obligatoria
 * @returns errores[]
 */
export function revisarDecision(anterior, nueva, sobre, { es_demo = false, politica = null } = {}) {
  if (!nueva || !DECISIONES.includes(nueva.estado) || anterior?.estado === nueva.estado) return [];
  const errores = [];
  const ultimo = Array.isArray(nueva.historial) ? nueva.historial.at(-1) : null;
  const d = nueva.decision_humana ?? {};
  if (!texto(ultimo?.motivo)) errores.push(`La decisión «${nueva.estado}» necesita un motivo escrito en el último evento del historial.`);
  if (ultimo?.evento !== nueva.estado) errores.push(`El último evento del historial debe ser «${nueva.estado}».`);
  if (nueva.estado !== "aprobada" && ultimo?.autor_tipo !== "humano") errores.push("Rechazar o aplazar también lo decide una persona.");
  if (nueva.estado === "aprobada" && !esFechaConZona(d.fecha)) errores.push("La fecha de la decisión necesita zona horaria.");
  const quien = nueva.estado === "aprobada" ? d.responsable : ultimo?.autor;
  if (sobre?.registrado_por?.tipo !== "humano" || !mismoId(sobre?.registrado_por?.identificador, quien)) errores.push(`Quien registra la entrada (${sobre?.registrado_por?.identificador ?? "?"}) debe ser la persona que decide (${quien ?? "?"}).`);
  if (!es_demo) {
    const ep = politica ? validarPolitica(politica) : ["no existe datos/nexus/politica.json"];
    if (ep.length) errores.push(`Sin una política de aprobadores válida no se registran decisiones en el almacén real (${ep.join(" ")}).`);
    else if (!politica.aprobadores_declarados.some((a) => mismoId(a, quien))) errores.push(`«${quien}» no está entre los aprobadores declarados (${politica.aprobadores_declarados.join(", ")}).`);
  }
  return errores;
}

/** Texto honesto para la oficina. */
export const etiquetaIdentidad = (actor) => `${actor?.identificador ?? "?"} (identidad declarada, sin autenticar)`;
