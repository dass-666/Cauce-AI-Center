// Resplandor (bloom) opcional: solo escritorio, se descarga bajo demanda y se puede apagar.
// Sin brillo la oficina funciona igual; si algo falla, se queda apagado.

import * as THREE from "three";

export function crearBrillo({ renderer, escena, camara, alCambiar = () => {} }) {
  let composer = null;
  let bloom = null;
  let cargando = false;
  let desde = 0;
  let querido = false;
  let destruido = false;

  function quitar() {
    composer?.dispose();
    bloom?.dispose();
    composer = bloom = null;
  }

  /** Enciende o apaga. Resuelve true (encendido), false (apagado o cancelado) o "fallo" (no se pudo cargar). */
  async function activar(encender) {
    querido = encender;
    if (!encender) { quitar(); return false; }
    if (composer) return true;
    if (cargando) return false;
    cargando = true;
    try {
      const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }] = await Promise.all([
        import("three/addons/postprocessing/EffectComposer.js"),
        import("three/addons/postprocessing/RenderPass.js"),
        import("three/addons/postprocessing/UnrealBloomPass.js"),
        import("three/addons/postprocessing/OutputPass.js"),
      ]);
      if (destruido || !querido) return false;
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(escena, camara));
      bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.35, 0.62);
      composer.addPass(bloom);
      composer.addPass(new OutputPass());
      desde = performance.now();
      alCambiar();
      return true;
    } catch (e) {
      console.warn("Brillo no disponible:", e);
      querido = false;
      return "fallo";
    } finally {
      cargando = false;
    }
  }

  return {
    activar,
    get composer() { return composer; },
    get desde() { return desde; },
    setSize(w, h) { composer?.setSize(w, h); },
    destruir() { destruido = true; quitar(); },
  };
}
