// Cálculos de distribución de la oficina 3D. Sin Three.js: se prueban en Node y en el navegador.
// Unidades: metros. Eje X a lo ancho, eje Z a lo profundo, Y hacia arriba. El cuarto queda centrado en el origen.

export const MEDIDAS = Object.freeze({
  separacionPuestos: 1.9, // distancia entre escritorios en una fila
  profundidadFila: 2.4,   // distancia entre filas
  margen: 1.0,            // espacio entre los escritorios y las mamparas
  pasillo: 1.2,           // pasillo frente a la puerta
  minimoAncho: 6,
  minimoFondo: 5,
});

/** Tamaño del cuarto a partir de la posición en celdas (escena/*.json) y de cuántos personajes caben. */
export function tamanoCuarto(posicion, metrosPorCelda, numPuestos) {
  const anchoCeldas = (posicion?.ancho ?? 1) * metrosPorCelda;
  const fondoCeldas = (posicion?.alto ?? 1) * metrosPorCelda;
  const porFila = puestosPorFila(anchoCeldas);
  const filas = Math.max(1, Math.ceil(numPuestos / porFila));
  const fondoNecesario = MEDIDAS.margen * 2 + MEDIDAS.pasillo + filas * MEDIDAS.profundidadFila;
  return {
    ancho: Math.max(MEDIDAS.minimoAncho, anchoCeldas),
    fondo: Math.max(MEDIDAS.minimoFondo, fondoCeldas, fondoNecesario),
  };
}

export function puestosPorFila(ancho) {
  return Math.max(1, Math.floor((Math.max(ancho, MEDIDAS.minimoAncho) - MEDIDAS.margen * 2) / MEDIDAS.separacionPuestos));
}

/**
 * Lugar de cada escritorio. Las filas miran hacia la pared del letrero (-Z).
 * Devuelve [{x, z, rotacion}] con la silla detrás del escritorio (+Z).
 */
export function puestos(n, cuarto) {
  const porFila = puestosPorFila(cuarto.ancho);
  const salida = [];
  for (let i = 0; i < n; i++) {
    const fila = Math.floor(i / porFila);
    const enFila = Math.min(porFila, n - fila * porFila);
    const col = i % porFila;
    const x = (col - (enFila - 1) / 2) * MEDIDAS.separacionPuestos;
    const z = -cuarto.fondo / 2 + MEDIDAS.margen + 1.0 + fila * MEDIDAS.profundidadFila;
    salida.push({ x: redondear(x), z: redondear(z), rotacion: 0 });
  }
  return salida;
}

/** Puerta: esquina frontal izquierda del cuarto (lado +Z). */
export function puerta(cuarto) {
  return { x: redondear(-cuarto.ancho / 2 + 0.9), z: redondear(cuarto.fondo / 2 - 0.3) };
}

/** Camino de la puerta a la silla: por el pasillo del frente y luego por detrás de la fila. */
export function camino(cuarto, puesto) {
  const p = puerta(cuarto);
  const silla = { x: puesto.x, z: redondear(puesto.z + 0.75) };
  const pasilloZ = redondear(cuarto.fondo / 2 - MEDIDAS.margen);
  return [p, { x: p.x, z: pasilloZ }, { x: silla.x, z: pasilloZ }, { x: silla.x, z: redondear(silla.z + 0.6) }, silla];
}

export function longitudCamino(puntos) {
  let total = 0;
  for (let i = 1; i < puntos.length; i++) total += Math.hypot(puntos[i].x - puntos[i - 1].x, puntos[i].z - puntos[i - 1].z);
  return total;
}

/** Punto del camino a una distancia d desde el inicio, y hacia dónde mira. */
export function puntoEnCamino(puntos, d) {
  let resto = Math.max(0, d);
  for (let i = 1; i < puntos.length; i++) {
    const a = puntos[i - 1];
    const b = puntos[i];
    const tramo = Math.hypot(b.x - a.x, b.z - a.z);
    if (resto <= tramo || i === puntos.length - 1) {
      const t = tramo ? Math.min(1, resto / tramo) : 1;
      return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, angulo: Math.atan2(b.x - a.x, b.z - a.z) };
    }
    resto -= tramo;
  }
  const u = puntos[puntos.length - 1];
  return { x: u.x, z: u.z, angulo: 0 };
}

/** Número estable a partir de un texto: el mismo personaje siempre se ve igual. */
export function huella(texto) {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const redondear = (n) => Math.round(n * 1000) / 1000;
