// Historial de la cámara (fase L): permite «volver a la vista anterior» después de enfocar un departamento,
// acercarse a un personaje, ir a la recepción o mover la cámara a mano. Sin Three.js (se prueba en Node).
// Solo guarda posiciones de cámara y lo que estaba elegido; no guarda datos ni se conserva al recargar.

/** Clave estable de una selección ({tipo, id} o null). */
export const claveSeleccion = (s) => (s ? `${s.tipo}:${s.id}` : "");

/**
 * @param maximo  cuántas vistas recuerda (las más viejas se olvidan)
 */
export function crearHistorialCamara({ maximo = 12 } = {}) {
  const pila = [];
  return {
    /**
     * Guarda una vista: { x, y, z (objetivo de la cámara), zoom, sel, enfocado }.
     * No guarda dos veces seguidas la misma vista. Devuelve true si la guardó.
     */
    recordar(v) {
      const u = pila[pila.length - 1];
      if (u && Math.hypot(u.x - v.x, u.y - v.y, u.z - v.z) < 0.05 && Math.abs(u.zoom - v.zoom) < 0.01
        && claveSeleccion(u.sel) === claveSeleccion(v.sel) && (u.enfocado ?? null) === (v.enfocado ?? null)) return false;
      pila.push({ x: v.x, y: v.y, z: v.z, zoom: v.zoom, sel: v.sel ? { tipo: v.sel.tipo, id: v.sel.id } : null, enfocado: v.enfocado ?? null });
      if (pila.length > maximo) pila.shift();
      return true;
    },
    /** Saca la vista más reciente (o null si no hay). */
    sacar: () => pila.pop() ?? null,
    vaciar() { pila.length = 0; },
    get tamano() { return pila.length; },
  };
}
