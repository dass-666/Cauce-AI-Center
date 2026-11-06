// Reglas del brillo que no necesitan Three.js (se prueban en Node).
//
//   ligero    (por defecto al encender) solo brillan letreros, pantallas, placas, anillos y luces: la escena se
//             dibuja como siempre (con suavizado de bordes) y el resplandor se calcula a 1/4 de resolución
//             con 3 pasadas extra. Pensado para gráficos integrados (Intel UHD).
//   completo  el resplandor anterior (UnrealBloomPass de three.js): 14 pasadas extra sobre una copia de la
//             escena en coma flotante y sin suavizado de bordes. Se conserva para comparar.
// Se elige con ?brillo=completo|ligero (para medir) o queda guardado en el navegador (cauce.brillo3d.tipo).

export const TIPOS_BRILLO = Object.freeze(["ligero", "completo"]);
export const DIVISOR_LIGERO = 4; // el resplandor ligero se calcula a 1/4 del ancho y 1/4 del alto

/** Tipo de brillo según la dirección (?brillo=…) y lo guardado. Cualquier otro valor: ligero. */
export function tipoBrillo(busqueda, guardado) {
  const pedido = new URLSearchParams(busqueda).get("brillo");
  if (TIPOS_BRILLO.includes(pedido)) return pedido;
  return TIPOS_BRILLO.includes(guardado) ? guardado : "ligero";
}

/** Tamaño (en píxeles reales) de la imagen reducida del resplandor ligero. Nunca menor que 1×1. */
export function tamanoReducido(anchoPx, altoPx, divisor = DIVISOR_LIGERO) {
  return { w: Math.max(1, Math.round(anchoPx / divisor)), h: Math.max(1, Math.round(altoPx / divisor)) };
}

/**
 * ¿Este material brilla en el modo ligero? Solo los que no reciben luz (MeshBasicMaterial) y se ven:
 * pantallas, letreros, placas, anillos de estado, torreta y luces. Se excluyen las sombras falsas (oscuras,
 * transparentes) y las zonas invisibles para tocar.
 */
export function materialBrilla(m) {
  if (!m || !m.isMeshBasicMaterial || m.visible === false) return false;
  if (m.userData?.sinBrillo) return false;
  return true;
}
