// Fase M: identidad visual de cada piso (paleta, pisos y familia de muebles por tipo de trabajo).
// Solo decoración: nada de aquí depende de los datos ni dice nada del estado (para eso están COLOR_ESTADO,
// las pantallas de los puestos, la torreta y los letreros). Sin Three.js: se prueba en Node.
//
// Reglas:
// - Los colores de estado (azul trabajando, verde finalizado, rojo error, ámbar revisión) NO se usan en la
//   decoración ni en las pantallas ambientales, para que nadie confunda un mueble con un estado.
// - Las pantallas ambientales muestran pictogramas abstractos sin cifras, siempre iguales (no se animan).

import { COLOR_ESTADO } from "./paleta.js";

/**
 * Paletas por estilo de proyecto (datos/proyectos.json → "estilo").
 *   comercial  (Compago)  casa de comercio: muros arena, madera de roble, acentos ámbar y terracota.
 *   financiero (Ek Chuah) centro de investigación financiera: muros salvia, nogal oscuro, latón y verde.
 *   general               la de siempre (muros azul pizarra), para proyectos sin estilo.
 */
export const PALETAS = Object.freeze({
  comercial: Object.freeze({
    muro: 0xd8ccb6, muroRemate: 0xf2ece0, muroZocalo: 0x8a6a4c,
    exterior: 0x7a5844, exteriorBase: 0x4e3a2e, exteriorRemate: 0xe0a458,
    pasillo: 0x4d4f5c, pasilloFranja: 0x5f6170, banqueta: 0x6a6c78, losa: 0x262b3b,
    madera: 0xc8955e, maderaOscura: 0x7e5634, metal: 0x434a60, silla: 0x37598a, tela: 0xb8683f,
    marco: 0x6b5848, tapete: 0x9a5b3a,
  }),
  financiero: Object.freeze({
    muro: 0xb8c6bf, muroRemate: 0xe6ece6, muroZocalo: 0x4a3626,
    exterior: 0x34474a, exteriorBase: 0x22302f, exteriorRemate: 0xc8a75a,
    pasillo: 0x434c55, pasilloFranja: 0x56616a, banqueta: 0x5c6668, losa: 0x1f2a2d,
    madera: 0x8a5d3b, maderaOscura: 0x4f3423, metal: 0x3b4650, silla: 0x2f5248, tela: 0x3d6b5c,
    marco: 0x7a6a44, tapete: 0x2f5a52,
  }),
  general: Object.freeze({
    muro: 0x56618a, muroRemate: 0xc9d0e2, muroZocalo: 0x7a5636,
    exterior: 0x323d60, exteriorBase: 0x232c48, exteriorRemate: 0xe0a458,
    pasillo: 0x3e475e, pasilloFranja: 0x4c5670, banqueta: 0x4a5370, losa: 0x1a2236,
    madera: 0xb98a5a, maderaOscura: 0x7a5636, metal: 0x3a4157, silla: 0x2f3a58, tela: 0x5a6fa8,
    marco: 0x5a6480, tapete: 0x2a3150,
  }),
});

/** Paleta del estilo del proyecto; un estilo desconocido usa «general» (alimentos y servicios incluidos). */
export function paletaDe(estilo) {
  return PALETAS[estilo] ?? PALETAS.general;
}

// Tipos de piso (cada uno es una textura compartida por todo el edificio: un material por tipo).
export const TIPOS_PISO = Object.freeze(["duela", "alfombra", "concreto", "vinil"]);

// Familia de piso según el tipo de trabajo del cuarto, distinta por estilo de proyecto.
const PISO_POR_TEMA = Object.freeze({
  comercial: { importacion: "concreto", busqueda: "duela", fuentes: "vinil", oportunidades: "alfombra", margenes: "alfombra", auditoria: "vinil", supervision: "concreto", integracion: "concreto" },
  financiero: { importacion: "concreto", busqueda: "duela", fuentes: "duela", oportunidades: "alfombra", margenes: "alfombra", auditoria: "vinil", supervision: "alfombra", integracion: "concreto" },
});

/** Tipo de piso de un cuarto (tema de identidad.js + estilo del proyecto). Sin regla: duela, como antes. */
export function pisoDeTema(tema, estilo) {
  return PISO_POR_TEMA[estilo]?.[tema] ?? "duela";
}

/**
 * Pantallas ambientales: un atlas de 4 × 3 pictogramas abstractos (sin cifras ni ejes con valores).
 * El orden es el de las celdas del atlas (fila por fila).
 */
export const PICTOGRAMAS = Object.freeze([
  "archivos", "busqueda", "lista", "comparar",
  "curva", "historial", "mosaico", "red",
  "documento", "escenarios", "mapa", "barras",
]);
export const ATLAS = Object.freeze({ columnas: 4, filas: 3, celda: 128 });

// Colores de los pictogramas: fríos y neutros. Nunca un color de estado (lo verifica una prueba).
export const COLORES_PICTOGRAMA = Object.freeze({
  fondo: "#0e1a2b", linea: "#6fa8dc", suave: "#9fc4e8", tenue: "#2c4a6e", blanco: "#dbe8f5",
});

/** Celda {col, fila} de un pictograma en el atlas (desconocido → «mosaico»). */
export function celdaPictograma(nombre) {
  const i = Math.max(0, PICTOGRAMAS.indexOf(nombre) >= 0 ? PICTOGRAMAS.indexOf(nombre) : PICTOGRAMAS.indexOf("mosaico"));
  return { col: i % ATLAS.columnas, fila: Math.floor(i / ATLAS.columnas) };
}

/**
 * Intensidad de las pantallas ambientales (0..1). Son ambientación del edificio, no datos, pero para no sugerir
 * que «todo funciona» se atenúan cuando el piso no tiene datos vigentes (desactualizado, sin conexión o sin archivo).
 */
export function intensidadAmbiente(modelo) {
  if (!modelo) return 0.3;
  const vigente = modelo.conexion === "en_linea" && (modelo.es_demo || Boolean(modelo.generado_en));
  return vigente ? 0.85 : 0.3;
}

/** ¿Algún color de esta lista coincide con un color de estado? (pruebas: la decoración no debe parecer estado) */
export function usaColorDeEstado(colores) {
  const estados = new Set(Object.values(COLOR_ESTADO).map((c) => c & 0xffffff));
  return colores.some((c) => estados.has(typeof c === "string" ? parseInt(c.replace("#", ""), 16) : c));
}
