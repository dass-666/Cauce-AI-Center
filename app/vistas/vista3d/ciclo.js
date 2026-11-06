// Rendimiento UHD: ¿hay que volver a dibujar este cuadro? Sin Three.js (se prueba en Node).
// Si nada se mueve, la imagen sería idéntica a la anterior y dibujarla solo gasta tarjeta gráfica y batería.
// Siempre se dibuja si: el ahorro está apagado (?quieta=0), la cámara cambió o se anima, algo pidió redibujar
// (datos, tamaño, luz, brillo, selección), hay movimiento en algún cuarto, o pasó el máximo sin dibujar.

export const MAXIMO_SIN_DIBUJAR_MS = 1000;

export function hayQueDibujar({ ahorro = true, camaraCambio = false, redibujar = false, hayEscenario = false, enMovimiento = true, msDesdeUltimo = 0 }) {
  if (!ahorro || !hayEscenario) return true;
  if (camaraCambio || redibujar || enMovimiento) return true;
  return msDesdeUltimo >= MAXIMO_SIN_DIBUJAR_MS;
}
