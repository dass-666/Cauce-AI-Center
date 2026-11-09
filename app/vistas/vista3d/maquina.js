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

// ---------- Vida mínima en su puesto (reposo, consultar, atención, relajado) ----------
// Antes, sentado y sin teclear, el personaje solo movía la cabeza 0.06 rad cada ~18 s y el torso 0.012 rad: a la
// distancia de la cámara se veía inmóvil (visto por Diego en «Un cuarto» el 2026-11-09). Esto es lo que hace
// cualquier persona sentada esperando: respira, mira alrededor y, cada tantos segundos, un gesto corto (revisar la
// pantalla, voltear a un lado, acomodarse, girar un poco la silla, estirarse). No teclea: no sugiere un proceso
// que trabaja; solo dice que el puesto está ocupado. Determinista por personaje (mismo id + reloj = misma pose).
export const MICRO_GESTOS = Object.freeze(["mirar_pantalla", "mirar_lado", "acomodarse", "girar_silla", "estirarse"]);
export const BUCLES_CON_VIDA = Object.freeze(new Set(["reposo", "relajado", "consultar", "atencion"]));
const DURACION_MICRO = 2.4; // s que dura cada gesto corto (entra y sale suave)
const QUIETA = Object.freeze({ respira: 0, cabezaX: 0, cabezaY: 0, micro: null, k: 0, lado: 1, giro: 0 });

/**
 * Pose de vida en el instante `reloj` (s) para la variación `v` (variacion()).
 * @returns {{respira:number, cabezaX:number, cabezaY:number, micro:string|null, k:number, lado:number, giro:number}}
 *   respira −1..1 (ciclo de ~4.5 s); cabezaX/cabezaY en rad (mirada que deambula, ≤ 0.22); micro: gesto corto
 *   actual (o null) con intensidad k 0..1 y lado ±1; giro: rad que gira la silla (solo en «girar_silla», ≤ 0.24).
 *   Con «reducir movimiento» (quieto) todo es 0: postura fija.
 */
export function vidaEnReposo(reloj, v, quieto = false) {
  if (quieto) return QUIETA;
  const r = reloj * v.ritmo + v.fase;
  const respira = Math.sin(r * 1.4);
  const cabezaY = Math.sin(r * 0.31) * 0.15 + Math.sin(r * 0.83 + 1.3) * 0.06;
  const cabezaX = Math.sin(r * 0.57 + 0.4) * 0.05;
  // Un gesto corto cada 0.8 × periodo (5.6–10.4 s), elegido por el número de ciclo: no se repite siempre el mismo.
  const cada = v.periodo * 0.8;
  const tt = reloj + v.fase * 3;
  const n = Math.floor(tt / cada);
  const dentro = tt - n * cada;
  const semilla = Math.floor(v.fase * 1000);
  const micro = MICRO_GESTOS[((n * 3 + semilla) % MICRO_GESTOS.length + MICRO_GESTOS.length) % MICRO_GESTOS.length];
  const lado = ((n + semilla) & 1) ? 1 : -1;
  let k = 0;
  if (dentro < DURACION_MICRO) { const x = Math.sin((dentro / DURACION_MICRO) * Math.PI); k = x * x * (3 - 2 * x); }
  return { respira, cabezaX, cabezaY, micro: k > 0 ? micro : null, k, lado, giro: micro === "girar_silla" ? 0.24 * k * lado : 0 };
}

/** Gesto corto que de verdad se hace con ese bucle: con la mano levantada («atención») no se estira (se leería
 *  como otra señal); se acomoda en la silla. */
export function microDe(vida, gesto) {
  return vida?.micro === "estirarse" && gesto === "atencion" ? "acomodarse" : vida?.micro ?? null;
}

/**
 * Suma la vida (vidaEnReposo) a la postura del bucle. `c` tiene torso, cabeza, brazoD y brazoI con .rotation (las
 * piezas del cuerpo provisional o los huesos del modelo de Kenney). Sin tecleo: en «reposo», «consultar»,
 * «atención» o «relajado» no se sugiere un proceso que trabaja. «teclear» y «alerta» ya tienen su movimiento:
 * solo respiran.
 */
export function aplicarVida(c, vida, gesto) {
  if (!vida || vida === QUIETA) return;
  const { respira, cabezaX, cabezaY, k, lado } = vida;
  c.torso.rotation.x -= 0.035 * respira; // el pecho sube y baja (visible a la distancia de la cámara)
  if (!BUCLES_CON_VIDA.has(gesto)) return;
  const micro = microDe(vida, gesto);
  c.cabeza.rotation.y += cabezaY;
  c.cabeza.rotation.x += cabezaX;
  if (!micro) return;
  if (micro === "mirar_pantalla") { c.torso.rotation.x += 0.14 * k; c.cabeza.rotation.x += 0.16 * k; } // se inclina a revisar
  else if (micro === "mirar_lado") { c.cabeza.rotation.y += 0.55 * k * lado; c.torso.rotation.y += 0.14 * k * lado; }
  else if (micro === "acomodarse") { c.torso.rotation.x -= 0.2 * k; c.torso.rotation.z += 0.06 * k * lado; }
  else if (micro === "girar_silla") { c.cabeza.rotation.y += 0.15 * k * lado; } // el cuerpo lo gira Personaje (vida.giro)
  else if (micro === "estirarse") {
    c.brazoD.rotation.x -= 1.5 * k; c.brazoI.rotation.x -= 1.5 * k;
    c.brazoD.rotation.z += 0.25 * k; c.brazoI.rotation.z -= 0.25 * k;
    c.torso.rotation.x -= 0.12 * k; c.cabeza.rotation.x -= 0.15 * k;
  }
}

/** Ángulo intermedio por el camino corto (para girar sin dar la vuelta completa). */
export function girarHacia(actual, objetivo, k) {
  let d = objetivo - actual;
  d = ((d + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return actual + d * Math.min(1, Math.max(0, k));
}
