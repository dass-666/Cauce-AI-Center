// Rendimiento UHD: brillo ligero/completo, «no redibujar si nada se mueve», edificio de 8 departamentos
// y que la vista «Un cuarto» y el interruptor de brillo sigan ahí. Corre en Node y en pruebas.html.

import { prueba, igual, verdadero } from "./mini.js";
import { tipoBrillo, tamanoReducido, materialBrilla, TIPOS_BRILLO, DIVISOR_LIGERO } from "../app/vistas/vista3d/brillo-tipo.js";
import { hayQueDibujar, MAXIMO_SIN_DIBUJAR_MS } from "../app/vistas/vista3d/ciclo.js";
import { distribuirEdificio, seEnciman } from "../app/vistas/vista3d/plano-edificio.js";
import { posicionDe, acomodarSinPosicion } from "../app/nucleo/modelo.js";

export function registrarCasosRendimiento(leerTexto) {
  prueba("UHD · brillo: ligero por defecto; ?brillo=completo o lo guardado eligen el anterior; valores raros → ligero", () => {
    igual(tipoBrillo("", null), "ligero");
    igual(tipoBrillo("?brillo=completo", null), "completo");
    igual(tipoBrillo("?medir=1&brillo=ligero", "completo"), "ligero", "la dirección manda sobre lo guardado");
    igual(tipoBrillo("", "completo"), "completo");
    igual(tipoBrillo("?brillo=<script>", "x"), "ligero");
    igual(TIPOS_BRILLO.join(","), "ligero,completo");
  });

  prueba("UHD · brillo ligero: imagen reducida a 1/4 × 1/4 (1/16 de los píxeles), nunca 0", () => {
    igual(DIVISOR_LIGERO, 4);
    igual(JSON.stringify(tamanoReducido(1366, 768)), JSON.stringify({ w: 342, h: 192 }));
    igual(JSON.stringify(tamanoReducido(2, 1)), JSON.stringify({ w: 1, h: 1 }));
    const g = tamanoReducido(1920 * 1.5, 1080 * 1.5);
    verdadero(g.w * g.h <= (1920 * 1.5 * 1080 * 1.5) / 16 + g.w + g.h, "a lo más 1/16 de píxeles");
  });

  prueba("UHD · brillo ligero: solo brillan materiales sin luz y visibles; sombras y vidrio marcados no", () => {
    verdadero(materialBrilla({ isMeshBasicMaterial: true, visible: true, userData: {} }), "pantalla/letrero");
    verdadero(!materialBrilla({ isMeshBasicMaterial: true, visible: false, userData: {} }), "zona invisible para tocar");
    verdadero(!materialBrilla({ isMeshBasicMaterial: true, visible: true, userData: { sinBrillo: true } }), "sombra o vidrio");
    verdadero(!materialBrilla({ isMeshLambertMaterial: true, visible: true, userData: {} }), "muros y muebles");
    verdadero(!materialBrilla({ isMeshStandardMaterial: true, visible: true, userData: {} }), "personajes Kenney");
    verdadero(!materialBrilla(null));
  });

  prueba("UHD · ciclo: no redibuja una escena quieta, pero sí al mover la cámara, al cambiar algo o cada segundo", () => {
    const quieta = { ahorro: true, camaraCambio: false, redibujar: false, hayEscenario: true, enMovimiento: false, msDesdeUltimo: 100 };
    verdadero(!hayQueDibujar(quieta), "quieta: se omite");
    verdadero(hayQueDibujar({ ...quieta, camaraCambio: true }), "cámara");
    verdadero(hayQueDibujar({ ...quieta, redibujar: true }), "datos/tamaño/luz/brillo");
    verdadero(hayQueDibujar({ ...quieta, enMovimiento: true }), "personaje o torreta");
    verdadero(hayQueDibujar({ ...quieta, msDesdeUltimo: MAXIMO_SIN_DIBUJAR_MS }), "seguridad: una vez por segundo");
    verdadero(hayQueDibujar({ ...quieta, ahorro: false }), "?quieta=0 lo desactiva");
    verdadero(hayQueDibujar({ ...quieta, hayEscenario: false }), "sin escenario se dibuja como antes");
    verdadero(hayQueDibujar({}), "por omisión siempre dibuja");
  });

  prueba("UHD · Compago: 8 departamentos (7 con lugar en la escena + UNIQ acomodado solo) sin encimarse", async () => {
    const escena = JSON.parse(await leerTexto("escena/compago.json"));
    const demo = JSON.parse(await leerTexto("datos/demo/compago.json"));
    igual(demo.departamentos.length, 8, "la demostración de Compago trae 8 departamentos");
    const deps = demo.departamentos.map((d) => ({ id: d.id, posicion: posicionDe(escena, d.id), puestos: Math.max(1, d.agentes.length) }));
    igual(deps.filter((d) => !d.posicion).map((d) => d.id).join(","), "uniq", "solo UNIQ no tiene lugar declarado en escena/compago.json");
    acomodarSinPosicion(deps, escena.cuadricula.columnas);
    const plano = distribuirEdificio(deps);
    igual(plano.cuartos.length, 8);
    for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) verdadero(!seEnciman(plano.cuartos[i], plano.cuartos[j]), `${deps[i].id} y ${deps[j].id} se enciman`);
  });

  prueba("UHD · se conservan el interruptor de brillo (apagado por defecto), el modo completo y la vista «Un cuarto»", async () => {
    const vista = await leerTexto("app/vistas/vista3d/escena3d.js");
    const brillo = await leerTexto("app/vistas/vista3d/brillo.js");
    verdadero(/leer\("cauce\.brillo3d"\) === "1"/.test(vista), "brillo apagado salvo que se encienda a mano");
    verdadero(/"Brillo"/.test(vista), "interruptor «Brillo» en la barra");
    verdadero(/botonModo\("individual", "Un cuarto"\)/.test(vista), "botón «Un cuarto»");
    verdadero(/UnrealBloomPass/.test(brillo) && /crearLigero/.test(brillo), "brillo completo y ligero");
  });
}
