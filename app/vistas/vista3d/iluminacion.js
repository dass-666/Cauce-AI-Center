// Luz ambiental según la hora local de la computadora, o fija. Solo decoración: no indica actividad.
// Sin Three.js (se prueba en Node). Siempre deja la escena visible (intensidad mínima).

export const LUZ_FIJA = Object.freeze({ cielo: 0xdfe8ff, suelo: 0x4a3a2a, hemi: 1.9, sol: 0xffe2b8, intensidadSol: 1.4, ventana: 0x9fc4ff, fondo: 0x0d1220, noche: 0 });
// De noche la oficina tiene "las luces encendidas": el ambiente no baja de aquí (antes 1.35).
export const HEMI_MINIMA = 1.7;

// Puntos de la jornada (hora local). Entre dos puntos se mezcla.
const PUNTOS = [
  [0, { cielo: 0x9fb4e8, suelo: 0x2a2a3a, hemi: 1.75, sol: 0xc8d2f0, intensidadSol: 0.7, ventana: 0x1d2b4f, fondo: 0x080c18, noche: 1 }],
  [5, { cielo: 0x9fb4e8, suelo: 0x2a2a3a, hemi: 1.75, sol: 0xc8d2f0, intensidadSol: 0.7, ventana: 0x1d2b4f, fondo: 0x080c18, noche: 1 }],
  [6.5, { cielo: 0xc8c8f0, suelo: 0x3a3030, hemi: 1.75, sol: 0xffc8a0, intensidadSol: 0.9, ventana: 0xf0b890, fondo: 0x0b1020, noche: 0.4 }],
  [9, LUZ_FIJA],
  [16, LUZ_FIJA],
  [18.5, { cielo: 0xf0d0b8, suelo: 0x4a3020, hemi: 1.8, sol: 0xffa86a, intensidadSol: 1.1, ventana: 0xf09a60, fondo: 0x0d1020, noche: 0.3 }],
  [20.5, { cielo: 0xa8b8e8, suelo: 0x2a2a3a, hemi: 1.75, sol: 0xc8d2f0, intensidadSol: 0.7, ventana: 0x22335a, fondo: 0x080c18, noche: 1 }],
  [24, { cielo: 0x9fb4e8, suelo: 0x2a2a3a, hemi: 1.75, sol: 0xc8d2f0, intensidadSol: 0.7, ventana: 0x1d2b4f, fondo: 0x080c18, noche: 1 }],
];

/** @param {number} hora 0..24 (con decimales) @param {boolean} fija */
export function luzSegunHora(hora, fija = false) {
  if (fija) return { ...LUZ_FIJA, nombre: "fija" };
  const h = ((hora % 24) + 24) % 24;
  let i = 0;
  while (i < PUNTOS.length - 2 && h >= PUNTOS[i + 1][0]) i++;
  const [h0, a] = PUNTOS[i];
  const [h1, b] = PUNTOS[i + 1];
  const k = h1 > h0 ? (h - h0) / (h1 - h0) : 0;
  const luz = {};
  for (const clave of Object.keys(LUZ_FIJA)) {
    luz[clave] = !["hemi", "intensidadSol", "noche"].includes(clave)
      ? mezclarColor(a[clave], b[clave], k)
      : a[clave] + (b[clave] - a[clave]) * k;
  }
  luz.hemi = Math.max(HEMI_MINIMA, luz.hemi);
  luz.nombre = h < 6 || h >= 20 ? "noche" : h < 9 ? "mañana" : h < 16 ? "día" : "tarde";
  return luz;
}

export function mezclarColor(a, b, k) {
  const c = (x, s) => (x >> s) & 255;
  const m = (s) => Math.round(c(a, s) + (c(b, s) - c(a, s)) * k);
  return (m(16) << 16) | (m(8) << 8) | m(0);
}
