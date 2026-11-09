// Vida mínima en «Un cuarto» y transición entre pisos (ascensor). Corre en Node y en pruebas.html.

import { prueba, igual, verdadero } from "./mini.js";
import { vidaEnReposo, aplicarVida, microDe, variacion, MICRO_GESTOS, BUCLES_CON_VIDA } from "../app/vistas/vista3d/maquina.js";
import { planTransicion, poseTransicion, DURACION_SALIDA, DURACION_LLEGADA, DURACION_CUARTO } from "../app/vistas/vista3d/transicion-piso.js";
import { huella } from "../app/vistas/vista3d/disposicion.js";

const V = (id) => variacion(huella(id));
const pieza = () => ({ rotation: { x: 0, y: 0, z: 0 } });
const cuerpo = () => ({ torso: pieza(), cabeza: pieza(), brazoD: pieza(), brazoI: pieza() });
const firma = (c) => Object.values(c).reduce((s, p) => s + p.rotation.x * 1.3 + p.rotation.y * 1.7 + p.rotation.z * 1.1, 0);
/** Suma de |diferencias| pieza por pieza y eje por eje (no se cancelan entre sí). */
const diferencia = (a, b) => Object.keys(a).reduce((s, k) => s + ["x", "y", "z"].reduce((t, e) => t + Math.abs(a[k].rotation[e] - b[k].rotation[e]), 0), 0);
const ORDEN = ["compago", "ek-chuah", "tezcatlipoca"];

export function registrarCasosVidaTransicion(leerTexto) {
  // ---------- Vida mínima ----------
  prueba("Vida · sentado sin teclear: respira y la mirada se mueve (la pose cambia en 1 s)", () => {
    for (const id of ["evaluador", "investigador", "importacion", "agente-x"]) {
      for (const bucle of ["reposo", "consultar", "atencion", "relajado"]) {
        const a = cuerpo(), b = cuerpo();
        aplicarVida(a, vidaEnReposo(10, V(id)), bucle);
        aplicarVida(b, vidaEnReposo(11, V(id)), bucle);
        const d = diferencia(a, b);
        verdadero(d > 0.02, `${id}/${bucle}: la pose cambia entre t=10 y t=11 (${d.toFixed(3)} rad en total)`);
      }
    }
  });

  prueba("Vida · cada 6–10 s un gesto corto distinto (mirar la pantalla, a un lado, acomodarse, girar la silla, estirarse)", () => {
    const v = V("evaluador");
    const vistos = new Set();
    let conGesto = 0;
    for (let t = 0; t < 120; t += 0.1) { const x = vidaEnReposo(t, v); if (x.micro) { vistos.add(x.micro); conGesto++; } }
    verdadero(vistos.size >= 3, `al menos 3 gestos distintos en 2 min (${[...vistos].join(",")})`);
    const frac = conGesto / 1200;
    verdadero(frac > 0.15 && frac < 0.5, `el gesto ocupa una parte del tiempo, no todo (${Math.round(frac * 100)} %)`);
    for (const m of vistos) verdadero(MICRO_GESTOS.includes(m), m);
  });

  prueba("Vida · nadie al unísono: dos personajes no hacen lo mismo al mismo tiempo", () => {
    let iguales = 0;
    for (let t = 0; t < 60; t += 0.5) {
      const a = vidaEnReposo(t, V("evaluador")), b = vidaEnReposo(t, V("investigador"));
      if (a.micro === b.micro && Math.abs(a.cabezaY - b.cabezaY) < 0.01) iguales++;
    }
    verdadero(iguales < 30, `coinciden ${iguales} de 120 muestras`);
  });

  prueba("Vida · movimientos pequeños y creíbles (sin giros exagerados ni silla que da vueltas)", () => {
    for (const id of ["a", "b", "c", "evaluador"]) for (let t = 0; t < 90; t += 0.25) {
      const x = vidaEnReposo(t, V(id));
      verdadero(Math.abs(x.cabezaY) <= 0.22 && Math.abs(x.cabezaX) <= 0.06, "mirada ≤ 0.22 rad");
      verdadero(Math.abs(x.giro) <= 0.241, "giro de silla ≤ 0.24 rad");
      verdadero(x.k >= 0 && x.k <= 1 && Math.abs(x.respira) <= 1, "intensidades 0..1");
      verdadero(x.giro === 0 || x.micro === "girar_silla", "solo gira la silla en «girar_silla»");
    }
  });

  prueba("Vida · reducir movimiento: postura fija (todo en 0, no cambia con el tiempo)", () => {
    const a = cuerpo(), b = cuerpo();
    aplicarVida(a, vidaEnReposo(3, V("x"), true), "reposo");
    aplicarVida(b, vidaEnReposo(47, V("x"), true), "reposo");
    igual(firma(a), 0); igual(firma(b), 0);
    igual(vidaEnReposo(5, V("x"), true).micro, null);
  });

  prueba("Vida · sin tecleo: en reposo, consultar, atención o relajado los brazos no golpetean; teclear/alerta solo respiran", () => {
    igual([...BUCLES_CON_VIDA].sort().join(","), "atencion,consultar,relajado,reposo");
    // Fuera de «estirarse» los brazos no se tocan (no hay golpeteo de teclado inventado).
    for (let t = 0; t < 60; t += 0.2) {
      const x = vidaEnReposo(t, V("evaluador"));
      const c = cuerpo(); aplicarVida(c, x, "reposo");
      if (microDe(x, "reposo") !== "estirarse") verdadero(c.brazoD.rotation.x === 0 && c.brazoI.rotation.x === 0, `t=${t}: brazos quietos (${x.micro})`);
      const tc = cuerpo(); aplicarVida(tc, x, "teclear");
      verdadero(tc.cabeza.rotation.y === 0 && tc.brazoD.rotation.x === 0, "en teclear la vida no agrega mirada ni brazos");
    }
    igual(microDe({ micro: "estirarse" }, "atencion"), "acomodarse", "con la mano levantada no se estira");
    igual(microDe({ micro: "estirarse" }, "reposo"), "estirarse");
  });

  // ---------- Transición entre pisos ----------
  prueba("Transición · otro proyecto = ascensor; sube si el piso nuevo va después en las pestañas, baja si va antes", () => {
    const a = { proyecto: "compago", modo: "edificio", dep: "importacion" };
    igual(JSON.stringify(planTransicion({ antes: a, ahora: { ...a, proyecto: "ek-chuah" }, orden: ORDEN })), JSON.stringify({ tipo: "ascensor", direccion: 1 }));
    igual(planTransicion({ antes: { ...a, proyecto: "tezcatlipoca" }, ahora: a, orden: ORDEN }).direccion, -1);
    igual(planTransicion({ antes: a, ahora: { ...a, proyecto: "otro" }, orden: ORDEN }).direccion, 1, "proyecto fuera de la lista: sube");
    igual(planTransicion({ antes: a, ahora: { ...a, proyecto: "ek-chuah", modo: "individual" }, orden: ORDEN }).tipo, "ascensor", "también en «Un cuarto»");
  });

  prueba("Transición · mismo piso: cambiar de departamento en el edificio o datos nuevos no animan; en «Un cuarto» sí (breve)", () => {
    const a = { proyecto: "compago", modo: "edificio", dep: "importacion" };
    igual(planTransicion({ antes: a, ahora: { ...a, dep: "margenes" }, orden: ORDEN }), null, "edificio: la cámara ya viaja al departamento");
    igual(planTransicion({ antes: a, ahora: { ...a }, orden: ORDEN }), null, "datos nuevos o DEMO → REAL");
    const c = { ...a, modo: "individual" };
    igual(planTransicion({ antes: c, ahora: { ...c, dep: "oportunidades" }, orden: ORDEN }).tipo, "cuarto");
    igual(planTransicion({ antes: a, ahora: c, orden: ORDEN }).tipo, "cuarto", "cambio de modo");
    igual(planTransicion({ antes: null, ahora: a, orden: ORDEN }), null, "primera carga: sin animación");
  });

  prueba("Transición · reducir movimiento o cámara instantánea: nunca se anima", () => {
    const a = { proyecto: "compago", modo: "individual", dep: "x" };
    igual(planTransicion({ antes: a, ahora: { ...a, proyecto: "ek-chuah" }, orden: ORDEN, sinMovimiento: true }), null);
    igual(planTransicion({ antes: a, ahora: { ...a, dep: "y" }, orden: ORDEN, sinMovimiento: true }), null);
    igual(JSON.stringify(poseTransicion("llegada", null, 0, 10)), JSON.stringify({ y: 0, opacidad: 1, terminada: true }));
  });

  prueba("Transición · ascensor: el piso se va en sentido contrario y el nuevo llega del otro lado, suave, hasta y = 0", () => {
    const sube = { tipo: "ascensor", direccion: 1 }, baja = { tipo: "ascensor", direccion: -1 };
    const fin = poseTransicion("salida", sube, DURACION_SALIDA, 10);
    verdadero(fin.y < -4 && fin.opacidad === 0 && fin.terminada, `al subir, el piso actual baja y se apaga (${fin.y})`);
    verdadero(poseTransicion("salida", baja, DURACION_SALIDA, 10).y > 4, "al bajar, sube");
    const ini = poseTransicion("llegada", sube, 0, 10);
    verdadero(ini.y === 10 && ini.opacidad === 0 && !ini.terminada, "al subir, el nuevo llega desde arriba");
    verdadero(poseTransicion("llegada", baja, 0, 10).y === -10, "al bajar, desde abajo");
    let previa = Infinity;
    for (let t = 0; t <= DURACION_LLEGADA + 1e-9; t += DURACION_LLEGADA / 20) {
      const p = poseTransicion("llegada", sube, t, 10);
      verdadero(p.y <= previa + 1e-9 && p.y >= 0, `baja sin rebotar (t=${t.toFixed(2)}, y=${p.y})`);
      previa = p.y;
    }
    const llegada = poseTransicion("llegada", sube, DURACION_LLEGADA, 10);
    verdadero(llegada.y === 0 && llegada.opacidad === 1 && llegada.terminada, "termina en su lugar y opaco");
    verdadero(DURACION_SALIDA + DURACION_LLEGADA <= 1.3, "el viaje completo dura ≤ 1.3 s");
  });

  prueba("Transición · «Un cuarto»: sube un poco y aparece en ≤ 0.5 s (no es un salto)", () => {
    const c = { tipo: "cuarto" };
    const a = poseTransicion("llegada", c, 0, 99), m = poseTransicion("llegada", c, DURACION_CUARTO / 2, 99), f = poseTransicion("llegada", c, DURACION_CUARTO, 99);
    verdadero(a.y < 0 && a.y > -0.5 && a.opacidad === 0, "empieza un poco abajo y transparente (no usa el alto del ascensor)");
    verdadero(m.opacidad > 0.5 && m.opacidad < 1 && m.y > a.y, "a la mitad ya casi se ve");
    verdadero(f.y === 0 && f.opacidad === 1 && f.terminada, "termina en su lugar");
    verdadero(DURACION_CUARTO <= 0.5, "breve");
  });

  prueba("Transición · el fundido roto de la fase L ya no está (CSS) y escena3d usa transicion-piso.js", async () => {
    const css = await leerTexto("app/estilos.css");
    verdadero(!/\.vista3d canvas \{ transition: opacity/.test(css), "sin la transición CSS que nunca se veía");
    const js = await leerTexto("app/vistas/vista3d/escena3d.js");
    verdadero(!js.includes('requestAnimationFrame(() => { lienzo.style.opacity = ""; })'), "sin el 0 → 1 en el mismo cuadro");
    verdadero(js.includes("planTransicion(") && js.includes("poseTransicion("), "usa el plan y la pose");
    verdadero(js.includes("data-camara-instantanea") && js.includes("cauce.camara3d"), "interruptor «Cámara instantánea» recordado");
  });
}
