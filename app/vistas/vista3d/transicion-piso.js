// Transición al cambiar de piso (proyecto) o de cuarto, sin Three.js (se prueba en Node).
//
// Antes (fase L) solo había un «fundido» del lienzo que nunca se veía: la opacidad pasaba a 0 y volvía a 1 en el
// mismo cuadro, así que el navegador no tenía de dónde a dónde animar, y el piso nuevo aparecía de golpe.
//
//   «ascensor»  otro proyecto (otro piso del edificio): el piso actual se va hacia abajo (si se sube) o hacia arriba
//               (si se baja) mientras se oscurece, y el nuevo llega desde el lado contrario y se asienta. ~1.1 s.
//   «cuarto»    en «Un cuarto», otro departamento o pasar de un modo al otro: el cuarto nuevo sube un poco y aparece
//               (0.45 s). No es un ascensor: es el mismo piso.
//   null        mismo piso y mismo modo (datos nuevos, DEMO → REAL, cambiar de departamento en el edificio, que ya
//               mueve la cámara): sin animación. También con «reducir movimiento» o «cámara instantánea».

export const DURACION_SALIDA = 0.38;   // s: el piso actual se va
export const DURACION_LLEGADA = 0.72;  // s: el piso nuevo llega
export const DURACION_CUARTO = 0.45;   // s: «Un cuarto» o cambio de modo
export const SUBIDA_CUARTO = 0.35;     // unidades de mundo que sube el cuarto al aparecer

/**
 * @param antes  { proyecto, modo, dep } de lo que se ve ahora (null si aún no hay nada)
 * @param ahora  { proyecto, modo, dep } de lo que se va a construir
 * @param orden  ids de los proyectos en el orden de las pestañas (el primero es el piso de abajo)
 * @param sinMovimiento  «reducir movimiento» del sistema o «cámara instantánea»
 * @returns {null | {tipo:"ascensor", direccion:1|-1} | {tipo:"cuarto"}}  direccion 1 = sube, −1 = baja
 */
export function planTransicion({ antes, ahora, orden = [], sinMovimiento = false }) {
  if (!antes || !ahora || sinMovimiento) return null;
  if (antes.proyecto !== ahora.proyecto) {
    const i = orden.indexOf(antes.proyecto), j = orden.indexOf(ahora.proyecto);
    return { tipo: "ascensor", direccion: i >= 0 && j >= 0 && j < i ? -1 : 1 };
  }
  if (antes.modo !== ahora.modo) return { tipo: "cuarto" };
  if (ahora.modo === "individual" && antes.dep !== ahora.dep) return { tipo: "cuarto" };
  return null;
}

const entrada = (x) => 1 - Math.pow(1 - x, 3);   // frena al llegar
const salida = (x) => x * x;                      // arranca despacio
const limitar = (x) => Math.min(1, Math.max(0, x));

/**
 * Cómo se ve el escenario en el instante t (s) de una fase de la transición.
 * @param fase   "salida" | "llegada"
 * @param plan   resultado de planTransicion
 * @param alto   recorrido vertical del ascensor en unidades de mundo (escena3d: según lo que abarca la cámara)
 * @returns {{y:number, opacidad:number, terminada:boolean}}  y = desplazamiento vertical del escenario
 */
export function poseTransicion(fase, plan, t, alto) {
  if (!plan) return { y: 0, opacidad: 1, terminada: true };
  if (plan.tipo === "cuarto") {
    const k = limitar(t / DURACION_CUARTO);
    return { y: -SUBIDA_CUARTO * (1 - entrada(k)), opacidad: entrada(k), terminada: k >= 1 };
  }
  const d = plan.direccion;
  if (fase === "salida") {
    const k = limitar(t / DURACION_SALIDA);
    // Al subir, el piso de abajo se va hacia abajo (la cabina sube); al bajar, hacia arriba.
    return { y: -d * alto * 0.55 * salida(k), opacidad: 1 - salida(k), terminada: k >= 1 };
  }
  const k = limitar(t / DURACION_LLEGADA);
  // El piso nuevo llega desde arriba al subir (desde abajo al bajar) y frena al asentarse.
  return { y: d * alto * (1 - entrada(k)), opacidad: limitar(k / 0.45), terminada: k >= 1 };
}
