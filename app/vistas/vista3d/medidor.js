// Medidor de cuadros por segundo para ?medir=1. Sin Three.js (se prueba en Node).
// Guarda los últimos N segundos completos y se reinicia cuando cambia lo que se está midiendo
// (brillo, modo, departamento enfocado o tamaño), para que cada medición sea de una sola configuración.

export const UMBRAL_CPS = 50;

export function crearMedidor({ ventana = 20 } = {}) {
  let segundos = [];    // [{ cps, peorMs }] de los últimos `ventana` segundos completos
  let cuadros = 0;
  let desde = null;     // inicio del segundo en curso
  let anterior = null;  // tiempo del cuadro anterior (para el tiempo de cuadro)
  let peorMs = 0;       // peor tiempo de cuadro del segundo en curso
  let firma = null;
  let motivo = "inicio";
  let valor = 0;
  let total = 0;
  // Tiempos de cuadro de la ventana (para percentiles: el «1 % más lento» dice si hay tirones aunque el promedio sea bueno).
  const tiempos = new Float32Array(ventana * 240);
  let nTiempos = 0, iTiempo = 0;

  function reiniciar(t, porque) {
    segundos = [];
    cuadros = 0;
    desde = t;
    anterior = null; // el hueco del cambio no cuenta como cuadro lento
    peorMs = 0;
    motivo = porque;
    nTiempos = 0; iTiempo = 0;
  }

  return {
    /** Llamar en cada cuadro dibujado. Devuelve true cuando se completó un segundo. */
    cuadro(t) {
      total++;
      if (desde === null) desde = t;
      if (anterior !== null) {
        peorMs = Math.max(peorMs, t - anterior);
        tiempos[iTiempo] = t - anterior;
        iTiempo = (iTiempo + 1) % tiempos.length;
        nTiempos = Math.min(nTiempos + 1, tiempos.length);
      }
      anterior = t;
      cuadros++;
      if (t - desde < 1000) return false;
      valor = Math.round((cuadros * 1000) / (t - desde));
      segundos.push({ cps: valor, peorMs });
      if (segundos.length > ventana) segundos.shift();
      cuadros = 0;
      desde = t;
      peorMs = 0;
      return true;
    },
    /** Si cambió la configuración (firma), reinicia la ventana y recuerda qué cambió. */
    vigilar(nueva, t) {
      if (firma === null) { firma = nueva; return false; }
      if (nueva.clave === firma.clave) return false;
      const cambios = Object.keys(nueva.partes).filter((k) => nueva.partes[k] !== firma.partes[k]);
      firma = nueva;
      reiniciar(t, cambios.join(" y ") || "cambio");
      return true;
    },
    /** Tras pausar (pestaña oculta) el hueco no es un cuadro lento. */
    pausa() { anterior = null; desde = null; cuadros = 0; },
    reiniciar,
    get valor() { return valor; },
    resumen() {
      const n = segundos.length;
      return {
        cps: valor,
        promedio: n ? Math.round(segundos.reduce((a, s) => a + s.cps, 0) / n) : 0,
        minimo: n ? Math.min(...segundos.map((s) => s.cps)) : 0,
        peor_cuadro_ms: n ? Math.round(Math.max(...segundos.map((s) => s.peorMs)) * 10) / 10 : 0,
        segundos_bajo_50: segundos.filter((s) => s.cps < UMBRAL_CPS).length,
        ...percentiles(tiempos.subarray(0, nTiempos)),
        segundos: n,
        ventana,
        reiniciado_por: motivo,
        cuadros_totales: total,
      };
    },
  };
}

/** Percentiles del tiempo de cuadro (ms) y los cps equivalentes al 1 % de cuadros más lentos. */
export function percentiles(lista) {
  if (!lista.length) return { cuadro_p50_ms: 0, cuadro_p95_ms: 0, cuadro_p99_ms: 0, cps_1pct_bajo: 0 };
  const o = Float32Array.from(lista).sort();
  const p = (q) => o[Math.min(o.length - 1, Math.floor(q * o.length))];
  const r = (x) => Math.round(x * 10) / 10;
  return { cuadro_p50_ms: r(p(0.5)), cuadro_p95_ms: r(p(0.95)), cuadro_p99_ms: r(p(0.99)), cps_1pct_bajo: Math.round(1000 / p(0.99)) };
}

/** Firma de la configuración que se mide: si alguna parte cambia, el medidor se reinicia. */
export function firmaMedicion(partes) {
  return { partes, clave: Object.values(partes).join("|") };
}
