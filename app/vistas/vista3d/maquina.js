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
]);

// Postura final (en bucle) y gesto de transición (solo si se observó el cambio).
const FINAL = Object.freeze({
  sentado_tecleando: { postura: "sentado", bucle: "teclear" },
  sentado_en_reposo: { postura: "sentado", bucle: "reposo" },
  estirarse: { postura: "sentado", bucle: "relajado", reaccion: "celebrar" },
  de_pie_alerta: { postura: "de_pie", bucle: "alerta", reaccion: "reaccion_error" },
  levantar_mano: { postura: "sentado", bucle: "atencion", reaccion: "llamar_atencion" },
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
