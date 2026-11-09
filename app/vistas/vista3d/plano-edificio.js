// Distribución del edificio: dónde va cada departamento y por dónde pasan los pasillos.
// Sin Three.js (se prueba en Node). Parte de las celdas de escena/<proyecto>.json (x, y, ancho, alto)
// y las convierte a metros con el tamaño de cuarto que necesita cada departamento.

import { MEDIDAS, puestosPorFila } from "./disposicion.js";

export const EDIFICIO = Object.freeze({
  anchoCelda: 6.4,     // un cuarto de una celda mide al menos esto de ancho (m)
  fondoMinimo: 5.4,    // y al menos esto de fondo
  pasilloColumnas: 1.4, // pasillo entre cuartos de la misma fila
  pasilloFilas: 2.6,    // pasillo principal entre filas (más ancho: es el "corredor")
  margen: 1.2,          // banqueta alrededor del edificio
});

/** Fondo que necesita un cuarto para sus escritorios. */
export function fondoNecesario(ancho, numPuestos, filasExtra = 0) {
  // filasExtra: una fila por estación de trabajo del departamento (disposicion.js › lugaresEstaciones).
  const filas = Math.max(1, Math.ceil(Math.max(1, numPuestos) / puestosPorFila(ancho))) + filasExtra;
  return MEDIDAS.margen * 2 + MEDIDAS.pasillo + filas * MEDIDAS.profundidadFila;
}

/**
 * @param {{id: string, posicion: {x:number,y:number,ancho:number,alto:number}, puestos: number, filasExtra?: number}[]} deps
 * @returns {{cuartos: {id:string,x:number,z:number,ancho:number,fondo:number}[], recepcion: {x:number,z:number,ancho:number,fondo:number}|null, ancho:number, fondo:number, pasillos:{x:number,z:number,ancho:number,fondo:number}[]}}
 *   x, z = centro de cada cuarto; el edificio queda centrado en el origen.
 */
export function distribuirEdificio(deps) {
  const E = EDIFICIO;
  if (deps.length === 0) return { cuartos: [], recepcion: null, ancho: 0, fondo: 0, pasillos: [] };
  const columnas = Math.max(...deps.map((d) => d.posicion.x + d.posicion.ancho));
  const filas = Math.max(...deps.map((d) => d.posicion.y + d.posicion.alto));
  const anchoDe = (celdas) => celdas * E.anchoCelda + (celdas - 1) * E.pasilloColumnas;

  // Fondo de cada fila: el mayor que pida alguno de sus cuartos (repartido si ocupa varias filas).
  // Recepción: el tramo libre más largo de la última fila; si no hay, una fila extra al frente.
  const ocupada = (cx, cy) => deps.some((d) => cx >= d.posicion.x && cx < d.posicion.x + d.posicion.ancho && cy >= d.posicion.y && cy < d.posicion.y + d.posicion.alto);
  let libre = null;
  for (let cx = 0, inicio = -1; cx <= columnas; cx++) {
    if (cx < columnas && !ocupada(cx, filas - 1)) { if (inicio < 0) inicio = cx; continue; }
    if (inicio >= 0 && (!libre || cx - inicio > libre.ancho)) libre = { x: inicio, ancho: cx - inicio };
    inicio = -1;
  }
  const filaRecepcion = libre ? filas - 1 : filas;
  if (!libre) libre = { x: 0, ancho: columnas };
  const totalFilas = filaRecepcion + 1;

  const fondoFila = Array(totalFilas).fill(E.fondoMinimo);
  for (const d of deps) {
    const p = d.posicion;
    const porFila = (fondoNecesario(anchoDe(p.ancho), d.puestos, d.filasExtra ?? 0) - (p.alto - 1) * E.pasilloFilas) / p.alto;
    for (let f = p.y; f < p.y + p.alto; f++) fondoFila[f] = Math.max(fondoFila[f], porFila);
  }
  const inicioFila = [];
  let z = 0;
  for (let f = 0; f < totalFilas; f++) {
    inicioFila.push(z);
    z += fondoFila[f] + (f < totalFilas - 1 ? E.pasilloFilas : 0);
  }
  const fondoTotal = z;
  const anchoTotal = anchoDe(columnas);

  const cuartos = deps.map((d) => {
    const p = d.posicion;
    const x0 = p.x * (E.anchoCelda + E.pasilloColumnas);
    const ancho = anchoDe(p.ancho);
    const z0 = inicioFila[p.y];
    const ultima = p.y + p.alto - 1;
    const fondo = inicioFila[ultima] + fondoFila[ultima] - z0;
    return { id: d.id, x: redondear(x0 + ancho / 2 - anchoTotal / 2), z: redondear(z0 + fondo / 2 - fondoTotal / 2), ancho: redondear(ancho), fondo: redondear(fondo) };
  });

  // Pasillos principales entre filas (para el piso y la decoración).
  const pasillos = [];
  for (let f = 0; f < totalFilas - 1; f++) {
    const zc = inicioFila[f] + fondoFila[f] + E.pasilloFilas / 2 - fondoTotal / 2;
    pasillos.push({ x: 0, z: redondear(zc), ancho: redondear(anchoTotal), fondo: E.pasilloFilas });
  }
  const anchoRecepcion = anchoDe(libre.ancho);
  const recepcion = {
    x: redondear(libre.x * (E.anchoCelda + E.pasilloColumnas) + anchoRecepcion / 2 - anchoTotal / 2),
    z: redondear(inicioFila[filaRecepcion] + fondoFila[filaRecepcion] / 2 - fondoTotal / 2),
    ancho: redondear(anchoRecepcion),
    fondo: redondear(fondoFila[filaRecepcion]),
  };
  return { cuartos, recepcion, ancho: redondear(anchoTotal), fondo: redondear(fondoTotal), pasillos };
}

/** ¿Se enciman dos cuartos? (lo usan las pruebas y sirve para detectar escenas mal escritas). */
export function seEnciman(a, b) {
  return Math.abs(a.x - b.x) * 2 < a.ancho + b.ancho - 1e-6 && Math.abs(a.z - b.z) * 2 < a.fondo + b.fondo - 1e-6;
}

const redondear = (n) => Math.round(n * 1000) / 1000;
