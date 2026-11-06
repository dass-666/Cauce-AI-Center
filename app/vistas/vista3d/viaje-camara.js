// Fase M: viaje de la cámara al enfocar (departamento, recepción, personaje o vista anterior).
// Sin Three.js: se prueba en Node.

/** Duración del viaje (s): corta para pasos chicos, más larga para cruzar el edificio. Entre 0.45 y 0.9 s. */
export function duracionViaje(distancia, zoomDesde = 1, zoomHacia = 1) {
  const cambioZoom = Math.abs(Math.log(Math.max(0.1, zoomHacia) / Math.max(0.1, zoomDesde)));
  return Math.min(0.9, Math.max(0.45, 0.4 + distancia * 0.025 + cambioZoom * 0.25));
}

/** Curva de arranque y frenado suaves (cúbica): 0 → 0, 1 → 1, sin saltos de velocidad. */
export function suavizarViaje(t) {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/**
 * Fase M: giro del encuadre inicial. En pantallas angostas (más altas que anchas: celular vertical) el edificio a
 * 45° queda chico porque su diagonal ocupa todo el ancho; girando un poco la vista (hasta 0.5 rad) el lado largo se
 * va hacia el fondo y el edificio se ve más grande. Solo si la zona es vertical y se gana al menos 10 % de tamaño:
 * en escritorio y celular horizontal queda a 45°, como siempre (la vista isométrica de referencia).
 * @param zona   {w, h} píxeles libres  @param ancho, fondo  medidas del edificio (m)  @param base  ángulo de siempre
 * @param inclinacion ángulo de la cámara sobre el horizonte (rad) @param alto alto de los muros (m)
 */
export function anguloEncuadre(zona, ancho, fondo, base, inclinacion = 0.955, alto = 2.3) {
  const escala = (a) => {
    const w = ancho * Math.abs(Math.cos(a)) + fondo * Math.abs(Math.sin(a));
    const h = (ancho * Math.abs(Math.sin(a)) + fondo * Math.abs(Math.cos(a))) * Math.cos(inclinacion) + alto * Math.sin(inclinacion);
    return Math.min(zona.w / w, zona.h / h);
  };
  if (zona.w >= zona.h) return base;
  let mejor = base;
  for (const d of [0.25, 0.5, -0.25, -0.5]) if (escala(base + d) > escala(mejor) * 1.0001) mejor = base + d;
  return escala(mejor) >= escala(base) * 1.1 ? mejor : base;
}
