// PROTOTIPO (fase E): qué ES cada personaje del contrato y cómo se puede mostrar sin fingir actividad.
// No lo usa todavía la aplicación principal; solo prototipos/naturaleza/ y las pruebas.
//
// El contrato v1 no dice si un "agente" es un proceso automático, una persona o un cálculo.
// Esa clasificación vive FUERA del contrato (como escena/<proyecto>.json): un archivo local
// prototipos/naturaleza/<proyecto>.json que se revisa a mano contra el código del sistema.
//
// Naturalezas:
//   automatico  proceso continuo (hoy, en Compago, solo el consumidor de importaciones).
//   reactivo    se ejecuta cuando alguien lo pide o cuando llega un archivo; no trabaja de forma continua.
//   humano      las decisiones las toma una persona; Cauce no sabe si está presente.
//   modulo      cálculo o consulta que corre al abrir una pantalla o un comando; no es un agente.
//   futuro      función prevista que aún no existe.

import { ESTADOS } from "./estados.js";

export const NATURALEZAS = Object.freeze({
  automatico: { etiqueta: "Proceso automático", puesto: "personaje" },
  reactivo: { etiqueta: "Proceso reactivo", puesto: "terminal" },
  humano: { etiqueta: "Puesto humano", puesto: "humano" },
  modulo: { etiqueta: "Módulo de software", puesto: "terminal" },
  futuro: { etiqueta: "Función futura (inactiva)", puesto: "inactivo" },
});

// Cuánto dura la aparición breve de un proceso reactivo tras observar un registro nuevo.
export const DURACION_BREVE_SEGUNDOS = 8;

/** Valida el archivo de clasificación. Devuelve { valido, errores, mapa: Map(agente_id → naturaleza) }. */
export function validarNaturalezas(datos) {
  const errores = [];
  const mapa = new Map();
  if (!datos || typeof datos !== "object" || !datos.agentes || typeof datos.agentes !== "object") {
    return { valido: false, errores: ['Falta el objeto "agentes".'], mapa };
  }
  for (const [id, v] of Object.entries(datos.agentes)) {
    const n = v && v.naturaleza;
    if (!NATURALEZAS[n]) errores.push(`"${id}": naturaleza desconocida (${JSON.stringify(n)}).`);
    else mapa.set(id, n);
  }
  return { valido: errores.length === 0, errores, mapa };
}

/**
 * Cómo se presenta un agente según su naturaleza.
 * @param agente  agente del modelo de vista (con estado_mostrado ya corregido por las reglas de oro).
 * @param naturaleza  una de NATURALEZAS, o undefined si no está clasificado.
 * @param cambioObservado  true solo si ESTA página vio cambiar la evidencia entre dos lecturas.
 * @returns {{naturaleza, puesto, personaje: "presente"|"breve"|"ausente", animacion: string|null,
 *            pantalla: string, texto: string, avisos: string[]}}
 *   animacion = animacion3d del catálogo de estados, o null si no hay personaje.
 */
export function presentar(agente, naturaleza, { cambioObservado = false } = {}) {
  const avisos = [];
  const estado = agente.estado_mostrado ?? agente.estado;
  const conEvidencia = Boolean(agente.evidencia);
  if (!NATURALEZAS[naturaleza]) {
    // Sin clasificar: lo prudente es no poner un personaje (no sabemos qué es).
    avisos.push(`"${agente.id}" no está clasificado; se muestra como terminal sin personaje.`);
    naturaleza = "modulo";
  }
  const base = { naturaleza, puesto: NATURALEZAS[naturaleza].puesto, avisos };
  const pantalla = estado === "sin_datos" ? "apagada" : estado;

  switch (naturaleza) {
    case "automatico": {
      // Presente solo con evidencia. "esperando" sin registro = silla vacía (no sabemos si está en marcha).
      if (estado === "sin_datos" || !conEvidencia) {
        return { ...base, personaje: "ausente", animacion: null, pantalla: "apagada",
          texto: estado === "sin_datos" ? "Sin información." : "Sin registro que muestre que el proceso está en marcha." };
      }
      return { ...base, personaje: "presente", animacion: animacionDe(estado), pantalla, texto: "Respaldado por un registro." };
    }
    case "reactivo": {
      // Nunca aparenta trabajo continuo. Aparece un momento solo si se observó un registro nuevo.
      const breve = cambioObservado && conEvidencia && estado !== "sin_datos";
      return { ...base, personaje: breve ? "breve" : "ausente", animacion: breve ? animacionDe(estado) : null,
        pantalla: conEvidencia ? pantalla : "apagada",
        texto: conEvidencia ? "Último registro mostrado en la pantalla; se ejecuta cuando se le pide." : "Sin registros: se ejecuta solo cuando se le pide." };
    }
    case "humano":
      // Nunca se dibuja a la persona: no sabemos si está. Se muestra lo último que registró.
      return { ...base, personaje: "ausente", animacion: null,
        pantalla: estado === "requiere_revision" ? "requiere_revision" : conEvidencia ? "registro" : "apagada",
        texto: estado === "requiere_revision" ? "Espera la decisión de una persona." :
          conEvidencia ? "Último cambio registrado por una persona." : "Puesto de una persona; sin cambios registrados." };
    case "modulo":
      return { ...base, personaje: "ausente", animacion: null, pantalla,
        texto: estado === "sin_datos" ? "Calcula al abrirse; no registra ejecuciones." : "Resultado del último cálculo exportado." };
    case "futuro":
    default:
      return { ...base, personaje: "ausente", animacion: null, pantalla: "apagada", texto: "Función futura: todavía no existe." };
  }
}

function animacionDe(estado) {
  return ESTADOS[estado]?.animacion3d ?? "ausente";
}

/** Referencia de evidencia por agente, para comparar dos lecturas. */
export function huellaEvidencia(modelo) {
  const h = new Map();
  for (const d of modelo.departamentos ?? [])
    for (const a of d.agentes) h.set(a.id, a.evidencia ? `${a.evidencia.origen}|${a.evidencia.referencia}` : null);
  return h;
}

/** true si la evidencia de `id` cambió entre dos lecturas observadas (la primera lectura nunca cuenta). */
export function cambioDeEvidencia(antes, ahora, id) {
  if (!antes) return false;
  const a = antes.get(id) ?? null;
  const b = ahora.get(id) ?? null;
  return b !== null && a !== b;
}
