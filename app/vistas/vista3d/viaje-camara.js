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
