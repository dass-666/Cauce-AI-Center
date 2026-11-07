// Deslizar a los lados con un dedo (celular) = departamento vecino.
// Se escucha en toda la vista (fase de captura), así funciona aunque el dedo empiece sobre una etiqueta;
// no cuenta si empieza en un control (barra, minimapa, medidas, botones de personajes, barra móvil).

/** Regla del gesto (se prueba en Node): +1 = siguiente (dedo a la izquierda), -1 = anterior, 0 = no es deslizar. */
export function sentidoDeslizar(dx, dy, ms) {
  if (ms >= 700 || Math.abs(dx) <= 50 || Math.abs(dx) <= 1.5 * Math.abs(dy)) return 0;
  return dx < 0 ? 1 : -1;
}

const CONTROLES = ".vista3d-barra, .vista3d-minimapa, .vista3d-medidas, .vista3d-personajes, .vista3d-movil";

/** Escucha el gesto en `raiz`. alDeslizar(sentido) solo se llama con un dedo y fuera de los controles. */
export function escucharDeslizar(raiz, alDeslizar) {
  let dedos = 0;
  let inicio = null;
  raiz.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "touch") return;
    dedos++;
    const enControl = e.target instanceof Element && e.target.closest(CONTROLES);
    inicio = dedos > 1 || enControl ? null : { x: e.clientX, y: e.clientY, t: performance.now() };
  }, true);
  raiz.addEventListener("pointerup", (e) => {
    if (e.pointerType !== "touch") return;
    dedos = Math.max(0, dedos - 1);
    const d = inicio;
    inicio = null;
    if (!d) return;
    const sentido = sentidoDeslizar(e.clientX - d.x, e.clientY - d.y, performance.now() - d.t);
    if (sentido) alDeslizar(sentido);
  }, true);
  raiz.addEventListener("pointercancel", (e) => {
    if (e.pointerType === "touch") { dedos = Math.max(0, dedos - 1); inicio = null; }
  }, true);
}
