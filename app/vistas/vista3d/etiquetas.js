// Etiquetas de los departamentos sin encimarse, y nombres cortos para pantallas pequeñas.
// Sin DOM ni Three.js (se prueba en Node).

const VACIAS = new Set(["de", "del", "la", "las", "el", "los", "y", "e", "en", "a", "para", "por"]);

/** Nombre corto: la primera palabra con significado; si dos coinciden, se agrega la siguiente. */
export function nombresCortos(nombres) {
  const palabras = nombres.map((n) => n.split(/\s+/).filter((p) => p && !VACIAS.has(p.toLowerCase())));
  const cortos = palabras.map((p, i) => p[0] ?? nombres[i]);
  for (let i = 0; i < cortos.length; i++) {
    const repetidos = cortos.map((c, j) => (c === cortos[i] ? j : -1)).filter((j) => j >= 0);
    if (repetidos.length > 1) for (const j of repetidos) cortos[j] = palabras[j].slice(0, 2).join(" ") || nombres[j];
  }
  return cortos;
}

/** Prioridad para quedarse visible cuando dos etiquetas chocan (mayor gana). */
export function prioridadEtiqueta({ enfocado, estado, alertas }) {
  if (enfocado) return 100;
  const porEstado = { error: 60, requiere_revision: 50, trabajando: 30, finalizado: 20, esperando: 15, sin_datos: 5 };
  return (porEstado[estado] ?? 10) + (alertas > 0 ? 25 : 0);
}

/**
 * @param items  [{id, w, h, prioridad, opciones: [{x, y}, …]}]  cada opción es un punto de anclaje
 *               (centro abajo) en píxeles; se prueba en orden y se usa la primera que no choque
 * @param zona   {w, h, arriba}  la etiqueta no puede quedar fuera del lienzo ni bajo la barra
 * @returns {Map<string, number>} id → opción elegida (las que no caben no aparecen)
 */
export function acomodarEtiquetas(items, zona, separacion = 4) {
  const puestas = [];
  const elegidas = new Map();
  const orden = [...items].sort((a, b) => b.prioridad - a.prioridad || b.opciones[0].y - a.opciones[0].y);
  for (const it of orden) {
    for (let k = 0; k < it.opciones.length; k++) {
      const { x, y } = it.opciones[k];
      const r = { izq: x - it.w / 2, der: x + it.w / 2, arriba: y - it.h, abajo: y };
      if (r.izq < 0 || r.der > zona.w || r.arriba < zona.arriba || r.abajo > zona.h) continue;
      if (puestas.some((p) => r.izq < p.der + separacion && r.der + separacion > p.izq && r.arriba < p.abajo + separacion && r.abajo + separacion > p.arriba)) continue;
      puestas.push(r);
      elegidas.set(it.id, k);
      break;
    }
  }
  return elegidas;
}
