// Fase M: espacio libre dentro de un cuarto para poner muebles de ambientación sin estorbar.
// Un mueble nuevo nunca puede quedar encima de un escritorio, una silla, el pasillo de la puerta ni el camino
// que recorre un personaje (camino() de disposicion.js). Sin Three.js: se prueba en Node.
// Unidades: metros, cuarto centrado en el origen; rectángulos {x0, x1, z0, z1}.

import { camino, puerta } from "./disposicion.js";

const ANCHO_CAMINO = 0.36; // medio ancho de paso de un personaje (hombros + holgura)

/** Rectángulos ocupados: escritorios con su silla, el pasillo del frente y los caminos de los personajes. */
export function obstaculosCuarto(cuarto, lugares) {
  const { ancho: W, fondo: F } = cuarto;
  const lista = [];
  for (const l of lugares) lista.push({ x0: l.x - 0.78, x1: l.x + 0.78, z0: l.z - 0.48, z1: l.z + 1.2, tipo: "puesto" });
  // Pasillo del frente (por ahí entran todos) y la hoja de la puerta.
  lista.push({ x0: -W / 2, x1: W / 2, z0: F / 2 - 1.38, z1: F / 2, tipo: "pasillo" });
  const p = puerta(cuarto);
  lista.push({ x0: p.x - 1.1, x1: p.x + 0.7, z0: F / 2 - 1.6, z1: F / 2, tipo: "puerta" });
  for (const l of lugares) {
    const ruta = camino(cuarto, l, lugares);
    for (let i = 1; i < ruta.length; i++) {
      const a = ruta[i - 1], b = ruta[i];
      lista.push({
        x0: Math.min(a.x, b.x) - ANCHO_CAMINO, x1: Math.max(a.x, b.x) + ANCHO_CAMINO,
        z0: Math.min(a.z, b.z) - ANCHO_CAMINO, z1: Math.max(a.z, b.z) + ANCHO_CAMINO, tipo: "camino",
      });
    }
  }
  return lista;
}

export const seTocan = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0;

/** ¿Cabe el rectángulo dentro del cuarto (con 5 cm de muro) sin tocar ningún obstáculo? */
export function rectLibre(rect, cuarto, obstaculos) {
  const { ancho: W, fondo: F } = cuarto;
  if (rect.x0 < -W / 2 + 0.05 || rect.x1 > W / 2 - 0.05 || rect.z0 < -F / 2 + 0.05 || rect.z1 > F / 2 - 0.05) return false;
  return !obstaculos.some((o) => seTocan(rect, o));
}

/** Rectángulo centrado en (x, z) de medidas w × d, girado 0 o 90° (rot ≈ ±π/2 intercambia las medidas). */
export function rectDe(x, z, w, d, rot = 0) {
  const girado = Math.abs(Math.sin(rot)) > 0.5;
  const [a, b] = girado ? [d, w] : [w, d];
  return { x0: x - a / 2, x1: x + a / 2, z0: z - b / 2, z1: z + b / 2 };
}

/**
 * Coloca muebles uno por uno: cada uno solo si su rectángulo está libre (y no toca los ya puestos).
 * Devuelve { intentar(x, z, w, d, rot, alturas) → boolean, puestos: [rect], obstaculos }.
 */
export function crearColocador(cuarto, lugares) {
  const obstaculos = obstaculosCuarto(cuarto, lugares);
  const puestos = [];
  return {
    puestos,
    obstaculos,
    /** alturas {y0, y1}: dos piezas solo chocan si además se enciman en altura (p. ej. una pantalla en el muro
     *  sobre un mueble bajo). Escritorios, pasillo y caminos ocupan toda la altura. */
    intentar(x, z, w, d, rot = 0, { y0 = 0, y1 = 2 } = {}) {
      const r = { ...rectDe(x, z, w, d, rot), y0, y1 };
      if (!rectLibre(r, cuarto, obstaculos) || puestos.some((q) => seTocan(r, q) && q.y0 < y1 && q.y1 > y0)) return false;
      puestos.push(r);
      return true;
    },
  };
}
