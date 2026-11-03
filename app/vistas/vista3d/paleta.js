// Colores de la oficina 3D. Sin Three.js (se prueba en Node).
// Los colores de estado son los mismos que usa la vista 2D (app/estilos.css, --c-*).

export const COLOR_ESTADO = Object.freeze({
  trabajando: 0x4fb3ff,
  esperando: 0x8ea0c4,
  finalizado: 0x43c47a,
  error: 0xff5d5d,
  requiere_revision: 0xffb547,
  sin_datos: 0x5d667c,
});

export const OFICINA = Object.freeze({
  fondo: 0x0d1220,
  base: 0x1a2236,
  piso: 0x9c7650,
  pisoLinea: 0x8a6644,
  pared: 0x2a3350,
  vidrio: 0x9fc4ff,
  madera: 0xb98a5a,
  maderaOscura: 0x7a5636,
  metal: 0x3a4157,
  pantallaApagada: 0x0b0f19,
  silla: 0x2f3a58,
  planta: 0x3f8f5a,
  maceta: 0x6b4a33,
  lampara: 0xffd89a,
  letrero: 0x0f1526,
  brillo: 0xffd89a,
});

// Ropa y pelo de los personajes provisionales: se eligen con la huella del id del agente,
// así el mismo agente siempre se ve igual y dos agentes rara vez se confunden.
export const ROPA = Object.freeze([0x3b5b9a, 0x9a3b5b, 0x3b9a7a, 0x8a6a2a, 0x6a4a9a, 0x2a7a9a, 0x9a5a3b, 0x4a4a5a]);
export const PELO = Object.freeze([0x2b1d14, 0x5a3a22, 0x111111, 0xc9a26b, 0x7a2e1e, 0x444444]);
export const PIEL = Object.freeze([0xf1c9a5, 0xe0ac7e, 0xc68a5a, 0x8d5a3b]);

export function aspecto(numero) {
  return {
    ropa: ROPA[numero % ROPA.length],
    pelo: PELO[(numero >>> 4) % PELO.length],
    piel: PIEL[(numero >>> 8) % PIEL.length],
  };
}
