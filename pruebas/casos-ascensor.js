// Bloque D: ascensor virtual entre pisos. Sentido según el orden del registro, duración, curva sin saltos de
// velocidad, velo que tapa el cambio de escena, redirección, regreso, cancelación y movimiento reducido.
// Corre en Node y en pruebas.html (sin Three.js ni DOM).

import { prueba, igual, verdadero } from "./mini.js";
import { crearAscensor, duracionAscensor, sentidoEntre, opacidadVelo } from "../app/vistas/vista3d/ascensor.js";

/** Avanza la máquina en pasos de 1/60 s hasta `segundos`; devuelve los eventos y las posiciones. */
function avanzar(a, segundos, dt = 1 / 60) {
  const eventos = [], us = [];
  for (let t = 0; t < segundos - 1e-9; t += dt) {
    const e = a.paso(dt);
    if (e) eventos.push(e);
    us.push(a.desplazamiento);
  }
  return { eventos, us };
}

export function registrarCasosAscensor(leerTexto) {
  prueba("ascensor: el orden del registro define los pisos (subir, bajar, saltar varios, mismo piso, desconocido)", async () => {
    const orden = JSON.parse(await leerTexto("datos/proyectos.json")).proyectos.map((p) => p.id);
    igual(sentidoEntre(orden, "compago", "ek-chuah"), { sentido: 1, pisos: 1, numeroDestino: 2 });
    igual(sentidoEntre(orden, "ek-chuah", "compago"), { sentido: -1, pisos: 1, numeroDestino: 1 });
    igual(sentidoEntre(orden, "compago", "csi"), { sentido: 1, pisos: 4, numeroDestino: 5 });
    igual(sentidoEntre(orden, "csi", "compago").sentido, -1);
    igual(sentidoEntre(orden, "compago", "compago").sentido, 0, "mismo piso: sin viaje");
    igual(sentidoEntre(orden, "compago", "no-existe").sentido, 0, "piso desconocido: cambio directo");
  });

  prueba("ascensor: dura 0.6 s un piso, +0.1 s por piso extra, nunca más de 0.9 s", () => {
    igual(duracionAscensor(1), 0.6);
    igual(Number(duracionAscensor(2).toFixed(3)), 0.7);
    igual(duracionAscensor(4), 0.9);
    igual(duracionAscensor(6), 0.9);
    igual(duracionAscensor(0), 0.6, "dato raro: un piso");
  });

  prueba("ascensor: subir = la cámara se eleva al salir (u → +1), cambia la escena y llega desde abajo (u: -1 → 0)", () => {
    const a = crearAscensor();
    verdadero(a.iniciar({ sentido: 1, pisos: 1, destino: "ek-chuah", numero: 2 }));
    igual(a.fase, "salida");
    const s = avanzar(a, 0.31);
    verdadero(s.eventos.includes("salida_terminada"), "la salida dura la mitad del viaje (0.3 s)");
    igual(a.fase, "espera");
    igual(a.desplazamiento, 1);
    verdadero(s.us.every((u, i) => i === 0 || u >= s.us[i - 1]), "la salida siempre sube (sin retrocesos)");
    a.llegar();
    igual(a.desplazamiento, -1, "llega desde abajo del piso nuevo");
    const l = avanzar(a, 0.31);
    verdadero(l.eventos.includes("llegada_terminada"));
    igual(a.activo, false);
    igual(a.desplazamiento, 0, "termina exactamente en el piso");
    verdadero(l.us.every((u, i) => i === 0 || u >= l.us[i - 1]), "la llegada también sube");
  });

  prueba("ascensor: bajar es el espejo de subir", () => {
    const a = crearAscensor();
    a.iniciar({ sentido: -1, pisos: 1, destino: "compago" });
    avanzar(a, 0.31);
    igual(a.desplazamiento, -1);
    a.llegar();
    igual(a.desplazamiento, 1, "llega desde arriba");
  });

  prueba("ascensor: sin salto de velocidad al cambiar de escena (salida acelera, llegada frena, misma rapidez)", () => {
    const a = crearAscensor();
    const dt = 1 / 600;
    a.iniciar({ sentido: 1, pisos: 1, destino: "x" });
    let previo = 0, vSalida = 0;
    while (a.fase === "salida") { a.paso(dt); vSalida = Math.max(vSalida, (a.desplazamiento - previo) / dt); previo = a.desplazamiento; } // la mayor: al final de la salida
    a.llegar();
    const u0 = a.desplazamiento;
    a.paso(dt);
    const vLlegada = (a.desplazamiento - u0) / dt;
    verdadero(Math.abs(vSalida - vLlegada) / vLlegada < 0.02, `velocidades ${vSalida.toFixed(2)} y ${vLlegada.toFixed(2)}`);
    // Al llegar la velocidad es casi cero (frena), sin rebote.
    let ultimo = a.desplazamiento, vFinal = 0;
    while (a.activo) { a.paso(dt); vFinal = (a.desplazamiento - ultimo) / dt; ultimo = a.desplazamiento; }
    verdadero(Math.abs(vFinal) < 0.1, `velocidad final ${vFinal}`);
  });

  prueba("ascensor: varios pisos duran más pero respetan 0.9 s en total", () => {
    const a = crearAscensor();
    a.iniciar({ sentido: 1, pisos: 4, destino: "csi" });
    const s = avanzar(a, 0.44);
    igual(s.eventos, [], "a 0.44 s todavía sale (la mitad de 0.9 s es 0.45 s)");
    avanzar(a, 0.02);
    igual(a.fase, "espera");
    a.llegar();
    avanzar(a, 0.46);
    igual(a.activo, false);
  });

  prueba("ascensor: el velo es transparente cerca del piso y tapa por completo al cambiar de escena", () => {
    igual(opacidadVelo(0), 0);
    igual(opacidadVelo(0.3), 0);
    igual(opacidadVelo(1), 1);
    igual(opacidadVelo(-1), 1);
    verdadero(opacidadVelo(0.6) > 0 && opacidadVelo(0.6) < 1);
    const a = crearAscensor();
    igual(a.velo, 0, "sin viaje no hay velo");
  });

  prueba("ascensor: otro piso en el mismo sentido a media salida solo cambia el destino (no acumula viajes)", () => {
    const a = crearAscensor();
    a.iniciar({ sentido: 1, pisos: 1, destino: "ek-chuah" });
    avanzar(a, 0.15);
    const u = a.desplazamiento;
    verdadero(a.iniciar({ sentido: 1, pisos: 3, destino: "montambre", numero: 4 }));
    igual(a.destino, "montambre");
    igual(a.desplazamiento, u, "sigue desde donde iba, sin saltos");
    avanzar(a, 0.16);
    igual(a.fase, "espera", "termina la salida a tiempo: el viaje no se alarga por redirigir");
  });

  prueba("ascensor: cambiar de sentido a media salida parte del punto actual (sin saltar)", () => {
    const a = crearAscensor();
    a.iniciar({ sentido: 1, pisos: 1, destino: "ek-chuah" });
    avanzar(a, 0.2);
    const u = a.desplazamiento;
    a.iniciar({ sentido: -1, pisos: 1, destino: "otro" });
    igual(a.fase, "salida");
    a.paso(1 / 600);
    verdadero(Math.abs(a.desplazamiento - u) < 0.01, "continuidad de posición");
    avanzar(a, 0.31);
    igual(a.desplazamiento, -1, "termina saliendo hacia abajo");
  });

  prueba("ascensor: elegir otro piso mientras llega sale desde la posición actual", () => {
    const a = crearAscensor();
    a.iniciar({ sentido: 1, pisos: 1, destino: "ek-chuah" });
    avanzar(a, 0.31);
    a.llegar();
    avanzar(a, 0.1);
    const u = a.desplazamiento;
    verdadero(u < 0 && u > -1);
    a.iniciar({ sentido: 1, pisos: 1, destino: "tezcatlipoca" });
    igual(a.fase, "salida");
    a.paso(1 / 600);
    verdadero(Math.abs(a.desplazamiento - u) < 0.01, "continuidad de posición");
  });

  prueba("ascensor: volver a elegir el piso actual a media salida regresa a él (sin cambiar de escena)", () => {
    const a = crearAscensor();
    a.iniciar({ sentido: 1, pisos: 1, destino: "ek-chuah" });
    avanzar(a, 0.2);
    a.regresar();
    igual(a.fase, "llegada");
    igual(a.destino, null);
    const r = avanzar(a, 0.31);
    verdadero(r.eventos.includes("llegada_terminada"));
    igual(a.desplazamiento, 0);
  });

  prueba("ascensor: cancelar deja la cámara en el piso; con movimiento reducido no hay viaje", () => {
    const a = crearAscensor();
    a.iniciar({ sentido: 1, pisos: 1, destino: "x" });
    avanzar(a, 0.2);
    a.cancelar();
    igual([a.activo, a.desplazamiento, a.velo], [false, 0, 0]);
    igual(a.iniciar({ sentido: 1, pisos: 1, destino: "x", reducido: true }), false);
    igual(a.activo, false);
    igual(a.iniciar({ sentido: 0, pisos: 0, destino: "x" }), false, "mismo piso: sin viaje");
  });

  prueba("ascensor: si la escena nueva no llega, se rinde (quita el velo) en vez de quedarse tapando", () => {
    const a = crearAscensor({ maxEspera: 1 });
    a.iniciar({ sentido: 1, pisos: 1, destino: "x" });
    const r = avanzar(a, 1.4);
    verdadero(r.eventos.includes("espera_agotada"));
    igual([a.activo, a.velo], [false, 0]);
  });

  prueba("ascensor: escena3d.js corre la proyección (no mueve geometría) y app.js solo lo pide al cambiar de piso", async () => {
    const vista = await leerTexto("app/vistas/vista3d/escena3d.js");
    const app = await leerTexto("app/app.js");
    const asc = await leerTexto("app/vistas/vista3d/ascensor.js");
    verdadero(/camara\.top = mitadAlto \+ desplazaVista/.test(vista), "el viaje es un corrimiento de la cámara");
    verdadero(!/grupo\.position\.y\s*[+-]?=/.test(vista), "ningún grupo de la escena se mueve en vertical");
    verdadero(!/requestAnimationFrame/.test(asc), "el ascensor no tiene bucle propio: avanza con el ciclo de dibujo existente");
    verdadero(/moverAscensor\(dt\)/.test(vista), "avanza dentro del cuadro de siempre");
    igual((app.match(/viajarAPiso/g) ?? []).length, 1, "solo elegirProyecto (cambio de piso) lo pide");
    verdadero(/menosMovimiento\.matches \|\| instantanea\.checked/.test(vista), "respeta reducir movimiento y la opción propia");
  });
}
