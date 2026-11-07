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

/**
 * Camino de la puerta a la silla: por el pasillo del frente y luego por detrás de la fila.
 * Fase L: si hay otra fila de escritorios entre el pasillo y su silla, sube por un pasillo entre columnas
 * (a media separación) que no choque con ningún escritorio ni silla de enfrente, en vez de atravesarlos.
 * @param todos  todos los puestos del cuarto (para saber qué hay delante); sin ellos, se supone una cuadrícula alineada.
 */
export function camino(cuarto, puesto, todos = []) {
  const p = puerta(cuarto);
  const silla = { x: puesto.x, z: redondear(puesto.z + 0.75) };
  const pasilloZ = redondear(cuarto.fondo / 2 - MEDIDAS.margen);
  const detras = redondear(silla.z + 0.6);
  const filaDelante = pasilloZ - detras > MEDIDAS.profundidadFila - 0.6;
  if (!filaDelante) return [p, { x: p.x, z: pasilloZ }, { x: silla.x, z: pasilloZ }, { x: silla.x, z: detras }, silla];
  const delante = todos.filter((q) => q.z > puesto.z + 0.1);
  const mitad = MEDIDAS.separacionPuestos / 2;
  const dentro = (x) => x > -cuarto.ancho / 2 + 0.45 && x < cuarto.ancho / 2 - 0.45;
  // Libre: a más de medio escritorio (0.65) + medio cuerpo (0.2) de cada escritorio de enfrente.
  const libre = (x) => dentro(x) && delante.every((q) => Math.abs(q.x - x) >= 0.85);
  // Si de frente no hay escritorio (filas desfasadas), sube derecho, como antes.
  if (todos.length && libre(silla.x)) return [p, { x: p.x, z: pasilloZ }, { x: silla.x, z: pasilloZ }, { x: silla.x, z: detras }, silla];
  const candidatos = [silla.x - mitad, silla.x + mitad, silla.x - mitad * 3, silla.x + mitad * 3, silla.x - mitad * 5, silla.x + mitad * 5];
  const xPasillo = redondear(candidatos.find(libre) ?? (silla.x - mitad));
  return [p, { x: p.x, z: pasilloZ }, { x: xPasillo, z: pasilloZ }, { x: xPasillo, z: detras }, { x: silla.x, z: detras }, silla];
}

/** ¿Algún tramo del camino pasa por encima de un escritorio (con su silla) que no es el suyo? (pruebas) */
export function caminoChoca(ruta, puesto, todos) {
  const cajas = todos.filter((q) => q !== puesto && (q.x !== puesto.x || q.z !== puesto.z))
    .map((q) => ({ x0: q.x - 0.65 - 0.15, x1: q.x + 0.65 + 0.15, z0: q.z - 0.35 - 0.15, z1: q.z + 0.75 + 0.25 + 0.15 }));
  for (let i = 1; i < ruta.length; i++) {
    const a = ruta[i - 1], b = ruta[i];
    for (let k = 0; k <= 40; k++) {
      const x = a.x + (b.x - a.x) * k / 40, z = a.z + (b.z - a.z) * k / 40;
      if (cajas.some((c) => x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1)) return true;
    }
  }
  return false;
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
