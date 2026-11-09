// Máquina de estados de los personajes 3D. Sin Three.js (se prueba en Node).
// Entrada: la animación 3D que el núcleo ya decidió para el estado (estados.js → animacion3d).
// Salida: la secuencia de acciones que el personaje ejecuta. Nada aquí decide si hay trabajo:
// eso ya viene resuelto en el modelo de vista (un "trabajando" sin evidencia llega como "ausente").
//
// Regla principal: un gesto de transición (entrar, celebrar, reaccionar a un error, llamar la atención)
// solo se ve cuando ESTA página observó el cambio entre dos lecturas. La primera lectura, o una escena
// recién construida (cambiar de modo, de proyecto o volver de 2D), muestra a cada personaje ya en su
// postura final, sin gestos: no se representa nada que no se haya observado.

export const ACCIONES = Object.freeze([
  "entrar",          // camina de la puerta a su silla (solo si se observó que llegó)
  "salir",           // camina de su silla a la puerta y desaparece (se observó que se fue)
  "sentarse",
  "levantarse",
  "celebrar",        // de pie, un momento (se observó que terminó)
  "reaccion_error",  // de pie, niega con la cabeza un momento (se observó el error)
  "llamar_atencion", // sentado, levanta la mano un momento (se observó que pide revisión)
]);

// Posturas en bucle: discretas y sin simular tareas ni resultados.
export const BUCLES = Object.freeze([
  "teclear",   // trabajando: manos en el teclado, a veces mira la pantalla
  "reposo",    // esperando: recargado, respira y mira alrededor despacio
  "relajado",  // finalizado: recargado, brazos sueltos
  "alerta",    // error: de pie junto al escritorio, mano en la cabeza, mira la pantalla
  "atencion",  // requiere revisión: sentado, de vez en cuando levanta un poco la mano
  "consultar", // estaciones: sentado, inclinado sobre un documento o la pantalla; sin teclear (un registro guardado, no un proceso)
]);

// Postura final (en bucle) y gesto de transición (solo si se observó el cambio).
const FINAL = Object.freeze({
  sentado_tecleando: { postura: "sentado", bucle: "teclear" },
  sentado_en_reposo: { postura: "sentado", bucle: "reposo" },
  estirarse: { postura: "sentado", bucle: "relajado", reaccion: "celebrar" },
  de_pie_alerta: { postura: "de_pie", bucle: "alerta", reaccion: "reaccion_error" },
  levantar_mano: { postura: "sentado", bucle: "atencion", reaccion: "llamar_atencion" },
  sentado_consultando: { postura: "sentado", bucle: "consultar" }, // estaciones (estaciones.js): consulta, no trabajo en curso
  ausente: { postura: "fuera", bucle: null },
});

// En qué postura se hace cada gesto.
const POSTURA_GESTO = Object.freeze({ celebrar: "de_pie", reaccion_error: "de_pie", llamar_atencion: "sentado" });

export const ANIMACIONES_SOPORTADAS = Object.freeze(Object.keys(FINAL));

/** Pasos para ir de una postura a otra estando en su lugar. */
function cambiarPostura(desde, hacia) {
  if (desde === hacia) return [];
  if (desde === "sentado" && hacia === "de_pie") return ["levantarse"];
  if (desde === "de_pie" && hacia === "sentado") return ["sentarse"];
  return [];
}

/**
 * Secuencia para pasar de una animación a otra.
 * @param {string|null} anterior  animacion3d previa; null = primera vez que se dibuja (nada observado).
 * @param {string} nueva          animacion3d nueva.
 * @returns {{pasos: string[], bucle: string|null, presente: boolean, postura: string}}
 *   postura = postura final; con anterior null el personaje aparece directamente en ella.
 */
export function planDeTransicion(anterior, nueva) {
  const destino = FINAL[nueva];
  if (!destino) throw new Error(`Animación 3D desconocida: ${nueva}`);
  const fin = { bucle: destino.bucle, presente: destino.postura !== "fuera", postura: destino.postura };
  // Primera lectura: ya está (o no está) en su lugar. Sin caminar, sin gestos.
  if (anterior === null || anterior === undefined) return { pasos: [], ...fin };
  const origen = FINAL[anterior];
  if (!origen) throw new Error(`Animación 3D desconocida: ${anterior}`);
  if (anterior === nueva) return { pasos: [], ...fin };

  const pasos = [];
  if (destino.postura === "fuera") {
    // Se observó que ya no hay evidencia: se levanta y sale.
    pasos.push(...cambiarPostura(origen.postura, "de_pie"));
    if (origen.postura !== "fuera") pasos.push("salir");
    return { pasos, ...fin };
  }
  if (origen.postura === "fuera") {
    // Se observó que llegó con evidencia: entra caminando. No celebra ni reacciona a algo
    // que pasó mientras no estaba (no lo vimos cambiar de estado aquí).
    pasos.push("entrar", ...cambiarPostura("de_pie", destino.postura));
    return { pasos, ...fin };
  }
  // Estaba presente y se observó el cambio de estado: gesto de transición (si lo hay) y postura final.
  let postura = origen.postura;
  if (destino.reaccion) {
    const p = POSTURA_GESTO[destino.reaccion];
    pasos.push(...cambiarPostura(postura, p), destino.reaccion);
    postura = p;
  }
  pasos.push(...cambiarPostura(postura, destino.postura));
  return { pasos, ...fin };
}

/**
 * Variación determinista por personaje (mismo id → mismo resultado, ids distintos → distintos),
 * para que nadie se mueva al unísono. `h` es la huella numérica del id (disposicion.js → huella).
 * ritmo: multiplica la velocidad de los bucles (0.85–1.15). fase: desfase (rad). periodo: cada cuántos
 * segundos hace su pequeño gesto de bucle (mirar la pantalla, levantar un poco la mano), 7–13 s.
 */
export function variacion(h) {
  const n = h >>> 0;
  return {
    ritmo: 0.85 + ((n % 301) / 300) * 0.3,
    fase: ((n >>> 9) % 1000) / 1000 * Math.PI * 2,
    periodo: 7 + ((n >>> 3) % 61) / 10,
  };
}

/** 0..1: intensidad del gesto ocasional de un bucle en el instante r (s), con forma suave; 0 casi siempre. */
export function gestoOcasional(r, v, duracion = 1.6) {
  const t = ((r + v.fase) % v.periodo + v.periodo) % v.periodo;
  if (t > duracion) return 0;
  return Math.sin((t / duracion) * Math.PI);
}

// ---------- Fase L: variaciones naturales dentro de «teclear» ----------
// Mientras trabaja (solo con evidencia vigente: la postura «teclear» ya lo garantiza), el personaje no teclea
// sin parar: a ratos se detiene a leer la pantalla, mira a un lado (papeles, segundo monitor) o se acomoda en la
// silla, y vuelve a teclear. Es una secuencia fija y reproducible (mismo id + mismo reloj = misma fase): no
// representa ninguna tarea concreta ni dice nada del avance del proceso.
export const FASES_TRABAJO = Object.freeze(["teclear", "leer", "mirar", "acomodarse"]);

// Tramos del ciclo (fracciones). La mayor parte es teclear; las pausas son cortas.
const TRAMOS = Object.freeze([
  ["teclear", 0.42], ["leer", 0.14], ["teclear", 0.22], ["mirar", 0.08], ["teclear", 0.08], ["acomodarse", 0.06],
]);

/**
 * Fase de trabajo en el instante `reloj` (s) para un personaje con variación `v` (variacion()).
 * @returns {{fase: string, k: number}} k = 0..1, cuánto de la fase (entra y sale suave, ~0.7 s).
 *   En «teclear» k es 1. El ciclo dura 3 × v.periodo (21–39 s) y empieza en un punto distinto para cada uno.
 */
export function faseTrabajo(reloj, v) {
  const ciclo = v.periodo * 3;
  const t = (((reloj + v.fase * 5) % ciclo) + ciclo) % ciclo;
  let inicio = 0;
  for (let i = 0; i < TRAMOS.length; i++) {
    const [fase, frac] = TRAMOS[i];
    const dur = frac * ciclo;
    if (t < inicio + dur || i === TRAMOS.length - 1) {
      if (fase === "teclear") return { fase, k: 1 };
      const dentro = Math.min(dur, t - inicio), rampa = Math.min(0.7, dur / 3);
      const x = Math.max(0, Math.min(1, dentro / rampa, (dur - dentro) / rampa));
      return { fase, k: x * x * (3 - 2 * x) };
    }
    inicio += dur;
  }
  return { fase: "teclear", k: 1 };
}

// ---------- Vida en reposo (2026-11-09) ----------
// Sentado sin trabajo con evidencia (reposo, consultar, atención) el personaje ya no se queda casi inmóvil: de vez
// en cuando mira la pantalla de cerca, voltea a un lado, se acomoda en la silla o la gira un poco. Ninguna de estas
// fases pone las manos en el teclado: no representan un proceso ni dicen nada del estado (eso lo dicen la postura,
// la pantalla, el tablero y el panel). Secuencia fija y reproducible, distinta para cada personaje.
export const FASES_VIDA = Object.freeze(["quieto", "mirar_pantalla", "mirar_lado", "acomodarse", "girar_silla"]);
export const BUCLES_CON_VIDA = Object.freeze(new Set(["reposo", "consultar", "atencion"]));

const TRAMOS_VIDA = Object.freeze([
  ["quieto", 0.16], ["mirar_pantalla", 0.2], ["quieto", 0.1], ["mirar_lado", 0.14], ["quieto", 0.08],
  ["girar_silla", 0.12], ["quieto", 0.06], ["acomodarse", 0.14],
]);

/**
 * Fase de vida en reposo en el instante `reloj` (s) para la variación `v`.
 * @returns {{fase: string, k: number, lado: number}} k = 0..1 (entra y sale suave, ≤ 0.9 s); lado = ±1 hacia
 *   dónde voltea o gira (propio de cada personaje y de cada vuelta del ciclo). El ciclo dura 2 × v.periodo (14–26 s).
 */
export function faseVida(reloj, v) {
  const ciclo = v.periodo * 2;
  const bruto = reloj + v.fase * 7;
  const vuelta = Math.floor(bruto / ciclo);
  const t = ((bruto % ciclo) + ciclo) % ciclo;
  const lado = ((vuelta + Math.round(v.fase * 10)) & 1) ? 1 : -1;
  let inicio = 0;
  for (let i = 0; i < TRAMOS_VIDA.length; i++) {
    const [fase, frac] = TRAMOS_VIDA[i];
    const dur = frac * ciclo;
    if (t < inicio + dur || i === TRAMOS_VIDA.length - 1) {
      if (fase === "quieto") return { fase, k: 0, lado };
      const dentro = Math.min(dur, t - inicio), rampa = Math.min(0.9, dur / 3);
      const x = Math.max(0, Math.min(1, dentro / rampa, (dur - dentro) / rampa));
      return { fase, k: x * x * (3 - 2 * x), lado };
    }
    inicio += dur;
  }
  return { fase: "quieto", k: 0, lado };
}

/** Ángulo intermedio por el camino corto (para girar sin dar la vuelta completa). */
export function girarHacia(actual, objetivo, k) {
  let d = objetivo - actual;
  d = ((d + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return actual + d * Math.min(1, Math.max(0, k));
}
