// Ascensor virtual entre pisos (bloque D). Sin Three.js ni DOM: se prueba en Node.
//
// Cada proyecto es un piso del edificio, en el orden del registro (datos/proyectos.json): el primero es el piso 1,
// el de abajo. Al cambiar de piso la cámara sube o baja: primero se aleja del piso actual (salida, acelerando),
// se cambia la escena mientras un velo la tapa, y llega al piso nuevo desde abajo o desde arriba (llegada,
// frenando). Las dos mitades duran lo mismo, así la velocidad no salta al cambiar de escena.
//
// No mueve la geometría del edificio: escena3d.js aplica `desplazamiento` como un corrimiento vertical de la
// proyección ortográfica, que en una proyección paralela equivale exactamente a subir o bajar la cámara.
// Cambiar de departamento o de personaje dentro del mismo piso no pasa por aquí (sigue el viaje lateral de fase M).

/** Duración total del viaje (s): 0.6 s para un piso, +0.1 s por piso extra, máximo 0.9 s. */
export function duracionAscensor(pisos) {
  const n = Math.max(1, Math.round(Number(pisos) || 1));
  return Math.min(0.9, 0.6 + 0.1 * (n - 1));
}

/**
 * Sentido del viaje entre dos pisos según su orden. +1 = sube, -1 = baja, 0 = mismo piso o piso desconocido
 * (sin viaje: el cambio es directo, como antes).
 * @param orden  ids de los proyectos en el orden del registro (índice 0 = piso 1)
 */
export function sentidoEntre(orden, desdeId, haciaId) {
  const a = orden.indexOf(desdeId), b = orden.indexOf(haciaId);
  if (a < 0 || b < 0 || a === b) return { sentido: 0, pisos: 0, numeroDestino: b < 0 ? null : b + 1 };
  return { sentido: b > a ? 1 : -1, pisos: Math.abs(b - a), numeroDestino: b + 1 };
}

/** Opacidad del velo según qué tan lejos está la cámara del piso (|u| de 0 a 1): tapa el cambio de escena. */
export function opacidadVelo(u) {
  const x = Math.min(1, Math.max(0, (Math.abs(u) - 0.3) / 0.7));
  return x * x * (3 - 2 * x);
}

/**
 * Máquina del ascensor. Estados: null (quieto), "salida", "espera" (salida terminada, la escena nueva todavía no
 * está lista) y "llegada". `u` es el desplazamiento normalizado: 0 = en el piso; +1 = un tramo arriba; -1 = abajo.
 *
 * @param maxEspera  segundos que espera la escena nueva antes de rendirse (quita el velo y termina el viaje)
 */
export function crearAscensor({ maxEspera = 4 } = {}) {
  let v = null;      // viaje en curso
  let u = 0;         // desplazamiento actual (se conserva al redirigir)

  return {
    get activo() { return v !== null; },
    get fase() { return v?.fase ?? null; },
    get destino() { return v?.destino ?? null; },
    get sentido() { return v?.sentido ?? 0; },
    get desplazamiento() { return u; },
    get velo() { return v ? opacidadVelo(u) : 0; },
    /** Lo que hace falta para el letrero del ascensor (o null si no hay viaje). */
    get letrero() { return v ? { sentido: v.sentido, destino: v.destino, numero: v.numero, nombre: v.nombre } : null; },

    /**
     * Empieza (o redirige) un viaje desde el piso que se está mostrando.
     * @returns true si hay viaje; false si no hace falta (mismo piso, sentido desconocido o sin movimiento)
     */
    iniciar({ sentido, pisos = 1, destino, numero = null, nombre = null, reducido = false }) {
      if (reducido || !sentido) { this.cancelar(); return false; }
      const dur = duracionAscensor(pisos);
      // Redirección en la misma dirección mientras aún se sale del piso: el mismo movimiento sigue, con otro destino.
      if (v && (v.fase === "salida" || v.fase === "espera") && v.sentido === sentido) {
        Object.assign(v, { destino, numero, nombre });
        return true;
      }
      // Viaje nuevo (o en sentido contrario, o desde un piso al que se estaba llegando): parte del punto actual.
      v = { fase: "salida", sentido, destino, numero, nombre, t: 0, mitad: dur / 2, desde: u, espera: 0 };
      return true;
    },

    /** La escena del piso de destino ya está dibujada: empieza la llegada desde el otro lado. */
    llegar() {
      if (!v) return;
      const s = v.sentido;
      v = { ...v, fase: "llegada", t: 0, desde: -s };
      u = -s;
    },

    /**
     * El usuario volvió a elegir el piso que se está mostrando antes de dejarlo: la cámara regresa a él (frenando)
     * sin cambiar de escena.
     */
    regresar() {
      if (!v || v.fase === "llegada") return;
      v = { ...v, fase: "llegada", t: 0, desde: u, destino: null };
    },

    /** Termina el viaje en seco (reducir movimiento, vista destruida, espera agotada). */
    cancelar() { v = null; u = 0; },

    /**
     * Avanza el tiempo. Devuelve el evento de este paso: "salida_terminada" (ya se puede cambiar la escena),
     * "llegada_terminada", "espera_agotada" o null.
     */
    paso(dt) {
      if (!v) return null;
      const d = Math.max(0, Number(dt) || 0);
      if (v.fase === "salida") {
        v.t = Math.min(1, v.t + d / v.mitad);
        // Acelera: u = desde + (s - desde)·t². Con desde = 0 su velocidad final es 2s/mitad, la misma con la que arranca la llegada.
        u = v.desde + (v.sentido - v.desde) * v.t * v.t;
        if (v.t >= 1) { v.fase = "espera"; v.espera = 0; u = v.sentido; return "salida_terminada"; }
        return null;
      }
      if (v.fase === "espera") {
        v.espera += d;
        if (v.espera >= maxEspera) { this.cancelar(); return "espera_agotada"; }
        return null;
      }
      // Llegada: frena; u = desde·(1 - t)².
      v.t = Math.min(1, v.t + d / v.mitad);
      u = v.desde * (1 - v.t) * (1 - v.t);
      if (v.t >= 1) { this.cancelar(); return "llegada_terminada"; }
      return null;
    },
  };
}
