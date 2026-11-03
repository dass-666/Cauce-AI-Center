// Encuadre exacto: con los puntos del escenario ya pasados a coordenadas de la cámara (x a la derecha,
// y hacia arriba) y la zona libre de la pantalla (sin barra ni avisos), calcula cuánto mide la vista y
// dónde centrarla para que todo quepa lo más grande posible. Sin Three.js (se prueba en Node).

/**
 * @param puntos [{x, y}] en unidades de la escena, relativos al punto que mira la cámara
 * @param zona   {w, h, arriba, abajo, izq, der} en píxeles del lienzo
 * @param llenado fracción de la zona libre que puede ocupar (0..1)
 * @returns {{mitadAlto:number, centroX:number, centroY:number}} centro relativo al punto actual
 */
export function calcularEncuadre(puntos, zona, llenado = 0.96) {
  const xs = puntos.map((p) => p.x), ys = puntos.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const uW = Math.max(40, (zona.der - zona.izq) * llenado);
  const uH = Math.max(40, (zona.abajo - zona.arriba) * llenado);
  const mitadAlto = Math.max((maxY - minY) * zona.h / (2 * uH), (maxX - minX) * zona.h / (2 * uW), 0.5);
  const porPx = (2 * mitadAlto) / zona.h;
  const desX = (zona.izq + zona.der) / 2 - zona.w / 2;
  const desY = (zona.arriba + zona.abajo) / 2 - zona.h / 2;
  return { mitadAlto, centroX: (minX + maxX) / 2 - desX * porPx, centroY: (minY + maxY) / 2 + desY * porPx };
}

/** Dónde cae un punto (coordenadas de cámara) en el lienzo con ese encuadre. */
export function aPixeles(p, e, zona) {
  const porPx = (2 * e.mitadAlto) / zona.h;
  return { x: zona.w / 2 + (p.x - e.centroX) / porPx, y: zona.h / 2 - (p.y - e.centroY) / porPx };
}

export const dentro = (p, r) => p.x >= r.izq && p.x <= r.der && p.y >= r.arriba && p.y <= r.abajo;
