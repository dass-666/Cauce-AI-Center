// Vida en reposo (2026-11-09): micro movimientos de los personajes sentados sin trabajo con evidencia.
// Corre en Node y en pruebas.html (sin Three.js ni DOM).

import { prueba, igual, verdadero } from "./mini.js";
import { faseVida, FASES_VIDA, BUCLES_CON_VIDA, variacion } from "../app/vistas/vista3d/maquina.js";
import { huella } from "../app/vistas/vista3d/disposicion.js";
import { resumirCuadros, resumirViaje } from "../app/vistas/vista3d/medicion-recorrido.js";

export function registrarCasosVida() {
  const ids = ["investigador", "importacion", "evaluador", "macro", "geopolitico", "riesgos", "importador"];

  prueba("Vida · reproducible: mismo personaje y mismo reloj = misma fase", () => {
    for (const id of ids) for (const t of [0, 4.2, 19.7, 301.5]) igual(faseVida(t, variacion(huella(id))), faseVida(t, variacion(huella(id))));
  });

  prueba("Vida · en cada ciclo aparecen todas las fases y ninguna es teclear (no simula trabajo)", () => {
    for (const id of ids) {
      const v = variacion(huella(id));
      const vistas = new Set();
      for (let t = 0; t < v.periodo * 2; t += 0.05) { const f = faseVida(t, v); vistas.add(f.fase); verdadero(f.fase !== "teclear", "nunca teclea"); }
      igual([...vistas].sort(), [...FASES_VIDA].sort(), id);
    }
  });

  prueba("Vida · k entre 0 y 1, sin saltos (cambia suave cuadro a cuadro) y lado ±1", () => {
    const v = variacion(huella("evaluador"));
    let antes = faseVida(0, v);
    for (let t = 1 / 60; t < 60; t += 1 / 60) {
      const f = faseVida(t, v);
      verdadero(f.k >= 0 && f.k <= 1, `k=${f.k}`);
      verdadero(f.lado === 1 || f.lado === -1, `lado=${f.lado}`);
      if (f.fase === antes.fase) verdadero(Math.abs(f.k - antes.k) < 0.05, `salto en ${t.toFixed(2)} s: ${antes.k} → ${f.k}`);
      else verdadero(f.k < 0.05 && antes.k < 0.05, `cambio de fase sin pasar por reposo en ${t.toFixed(2)} s`);
      antes = f;
    }
  });

  prueba("Vida · se mueve de verdad: al menos 45 % del ciclo hay un micro movimiento en curso", () => {
    for (const id of ids) {
      const v = variacion(huella(id));
      let activo = 0, n = 0;
      for (let t = 0; t < v.periodo * 2; t += 0.1, n++) if (faseVida(t, v).k > 0.2) activo++;
      verdadero(activo / n >= 0.45, `${id}: ${Math.round((activo / n) * 100)} %`);
    }
  });

  prueba("Vida · compañeros de mesa no se mueven al unísono", () => {
    const [a, b, c] = ["investigador", "importacion", "evaluador"].map((id) => variacion(huella(id)));
    let iguales = 0, n = 0;
    for (let t = 0; t < 120; t += 0.5, n++) { const fa = faseVida(t, a).fase, fb = faseVida(t, b).fase, fc = faseVida(t, c).fase; if (fa !== "quieto" && fa === fb && fb === fc) iguales++; }
    verdadero(iguales / n < 0.1, `${iguales} de ${n}`);
  });

  prueba("Vida · solo en bucles sin trabajo con evidencia (reposo, consultar, atención)", () => {
    igual([...BUCLES_CON_VIDA].sort(), ["atencion", "consultar", "reposo"]);
    verdadero(!BUCLES_CON_VIDA.has("teclear"));
  });

  prueba("Recorrido medido · resumen de cuadros: cps, peor cuadro y cuadros lentos", () => {
    const r = resumirCuadros([...Array(58).fill(1000 / 60), 40, 60]);
    igual(r.cuadros, 60); igual(r.peor_cuadro_ms, 60); igual(r.sobre_33_ms, 2); igual(r.sobre_50_ms, 1);
    verdadero(r.cps_promedio > 55 && r.cps_promedio < 60, String(r.cps_promedio));
    igual(resumirCuadros([]).cps_promedio, null);
  });

  prueba("Recorrido medido · un viaje gradual se distingue de un cambio de golpe", () => {
    // Gradual: el corrimiento pasa por 20 valores y el edificio se mueve en pantalla antes de que el velo tape.
    const gradual = Array.from({ length: 20 }, (_, k) => ({ dt: 16.7, desplaza: k * 0.3, velo: Math.min(1, k / 10), cy: 400 - k * 12 }));
    const g = resumirViaje(gradual, 400);
    verdadero(g.gradual, JSON.stringify(g)); verdadero(g.movimiento_visible_px >= 20 && g.valores_intermedios >= 8);
    // De golpe: la escena cambia sin corrimiento ni movimiento visible.
    const golpe = Array.from({ length: 20 }, () => ({ dt: 16.7, desplaza: 0, velo: 0, cy: 400 }));
    const d = resumirViaje(golpe, 400);
    verdadero(!d.gradual); igual(d.movimiento_visible_px, 0); igual(d.valores_intermedios, 1);
  });
}
