// Máquina de estados de los personajes 3D. Sin Three.js (se prueba en Node).
// Entrada: la animación 3D que el núcleo ya decidió para el estado (estados.js → animacion3d).
// Salida: la secuencia de acciones que el personaje ejecuta. Nada aquí decide si hay trabajo:
// eso ya viene resuelto en el modelo de vista (un "trabajando" sin evidencia llega como "ausente").

export const ACCIONES = Object.freeze([
  "entrar",          // camina de la puerta a su silla
  "salir",           // camina de su silla a la puerta y desaparece
  "sentarse",
  "levantarse",
  "teclear",         // sentado, manos sobre el teclado
  "reposo",          // sentado, recargado, respiración lenta
  "celebrar",        // de pie, brazos arriba
  "alerta",          // de pie junto al escritorio, inquieto
  "levantar_mano",   // sentado, saludando con un brazo
]);

// Postura final (en bucle) para cada animación del catálogo de estados.
const FINAL = Object.freeze({
  sentado_tecleando: { postura: "sentado", bucle: "teclear" },
  sentado_en_reposo: { postura: "sentado", bucle: "reposo" },
  estirarse: { postura: "sentado", bucle: "reposo", reaccion: "celebrar" },
  de_pie_alerta: { postura: "de_pie", bucle: "alerta" },
  levantar_mano: { postura: "sentado", bucle: "levantar_mano" },
  ausente: { postura: "fuera", bucle: null },
});

export const ANIMACIONES_SOPORTADAS = Object.freeze(Object.keys(FINAL));

/**
 * Secuencia para pasar de una animación a otra.
 * @param {string|null} anterior  animacion3d previa (null = primera vez que se dibuja).
 * @param {string} nueva          animacion3d nueva.
 * @returns {{pasos: string[], bucle: string|null, presente: boolean}}
 */
export function planDeTransicion(anterior, nueva) {
  const destino = FINAL[nueva];
  if (!destino) throw new Error(`Animación 3D desconocida: ${nueva}`);
  const origen = anterior ? FINAL[anterior] : { postura: "fuera" };
  if (!origen) throw new Error(`Animación 3D desconocida: ${anterior}`);

  const pasos = [];
  if (destino.postura === "fuera") {
    if (origen.postura === "sentado") pasos.push("levantarse");
    if (origen.postura !== "fuera") pasos.push("salir");
    return { pasos, bucle: null, presente: false };
  }
  if (origen.postura === "fuera") {
    // La primera vez entra caminando; así se ve llegar a quien tiene actividad registrada.
    pasos.push("entrar");
    if (destino.reaccion) pasos.push(destino.reaccion);
    if (destino.postura === "sentado") pasos.push("sentarse");
  } else if (origen.postura === "sentado") {
    if (destino.reaccion || destino.postura === "de_pie") pasos.push("levantarse");
    if (destino.reaccion) pasos.push(destino.reaccion);
    if (destino.reaccion && destino.postura === "sentado") pasos.push("sentarse");
  } else {
    // de pie
    if (destino.reaccion) pasos.push(destino.reaccion);
    if (destino.postura === "sentado") pasos.push("sentarse");
  }
  return { pasos, bucle: destino.bucle, presente: true };
}
