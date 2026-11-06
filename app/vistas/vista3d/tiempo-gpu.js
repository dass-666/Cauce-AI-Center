// Rendimiento UHD (solo con ?medir=1): cuánto tarda la TARJETA GRÁFICA en dibujar cada cuadro, en milisegundos.
// Usa la extensión EXT_disjoint_timer_query_webgl2 si el navegador la ofrece (Chrome/Edge en Windows suele
// tenerla; SwiftShader y algunos navegadores no). Si no existe, dice «no disponible» y no hace nada.
// Sirve para saber si el límite es la tarjeta gráfica (ms GPU cerca de 16.7 a 60 cps) o el procesador.

export function crearTiempoGpu(gl) {
  const ext = gl?.getExtension?.("EXT_disjoint_timer_query_webgl2") ?? null;
  const pendientes = [];
  const muestras = [];
  let abierta = null;

  function revisar() {
    while (pendientes.length) {
      const q = pendientes[0];
      if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break;
      pendientes.shift();
      const descartar = gl.getParameter(ext.GPU_DISJOINT_EXT); // el reloj saltó (ahorro de energía): no vale
      const ns = gl.getQueryParameter(q, gl.QUERY_RESULT);
      gl.deleteQuery(q);
      if (!descartar) { muestras.push(ns / 1e6); if (muestras.length > 120) muestras.shift(); }
    }
  }

  return {
    disponible: Boolean(ext),
    /** Llamar justo antes de dibujar. */
    empezar() {
      if (!ext || abierta || pendientes.length > 4) return;
      abierta = gl.createQuery();
      gl.beginQuery(ext.TIME_ELAPSED_EXT, abierta);
    },
    /** Llamar justo después de dibujar (incluye el brillo, si está encendido). */
    terminar() {
      if (!ext || !abierta) return;
      gl.endQuery(ext.TIME_ELAPSED_EXT);
      pendientes.push(abierta);
      abierta = null;
      revisar();
    },
    /** Promedio y peor de los últimos ~2 s de cuadros medidos, o null si no hay extensión o datos. */
    resumen() {
      if (!ext || !muestras.length) return null;
      const prom = muestras.reduce((a, x) => a + x, 0) / muestras.length;
      return { promedio_ms: Math.round(prom * 100) / 100, peor_ms: Math.round(Math.max(...muestras) * 100) / 100, muestras: muestras.length };
    },
    /** Al cambiar lo que se mide (brillo, modo…), se empieza de cero. */
    reiniciar() { muestras.length = 0; },
    destruir() { for (const q of pendientes) gl.deleteQuery(q); pendientes.length = 0; },
  };
}
