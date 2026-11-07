// Resplandor opcional: solo escritorio, se descarga bajo demanda y se puede apagar.
// Sin brillo la oficina funciona igual; si algo falla, se queda apagado.
// Dos tipos (brillo-tipo.js): «ligero» (por defecto, barato) y «completo» (el anterior, para comparar).

import * as THREE from "three";
import { tamanoReducido, materialBrilla } from "./brillo-tipo.js";

export const CAPA_BRILLO = 1; // capa de three.js de los objetos que brillan (además de la capa 0 de siempre)

export function crearBrillo({ renderer, escena, camara, alCambiar = () => {} }) {
  let efecto = null;   // { tipo, render(dt), setSize(w,h), dispose() }
  let cargando = false;
  let desde = 0;
  let querido = false;
  let destruido = false;
  let tamano = { w: 1, h: 1 };

  function quitar() {
    efecto?.dispose();
    efecto = null;
  }

  /**
   * Enciende (tipo "ligero" o "completo") o apaga. Resuelve true (encendido), false (apagado o cancelado)
   * o "fallo" (no se pudo cargar).
   */
  async function activar(encender, tipo = "ligero") {
    querido = encender;
    if (!encender) { quitar(); return false; }
    if (efecto?.tipo === tipo) return true;
    if (cargando) return false;
    cargando = true;
    try {
      const nuevo = tipo === "completo"
        ? await crearCompleto(renderer, escena, camara)
        : await crearLigero(renderer, escena, camara);
      if (destruido || !querido) { nuevo.dispose(); return false; }
      quitar();
      efecto = nuevo;
      efecto.setSize(tamano.w, tamano.h);
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
    /** Compatibilidad: algo verdadero mientras el brillo está encendido. */
    get composer() { return efecto; },
    get activo() { return Boolean(efecto); },
    get tipo() { return efecto?.tipo ?? null; },
    get desde() { return desde; },
    /** Dibuja el cuadro con brillo. Devuelve false si el brillo está apagado (dibujar como siempre). */
    render(dt) { if (!efecto) return false; efecto.render(dt); return true; },
    /** Marca qué objetos brillan en el modo ligero. Llamar cuando cambia la escena. */
    marcar(raiz) { marcarBrillo(raiz); },
    setSize(w, h) { tamano = { w, h }; efecto?.setSize(w, h); },
    destruir() { destruido = true; quitar(); },
  };
}

/** Pone en la capa de brillo los objetos con material sin luz (pantallas, letreros…). Barato: solo al cambiar la escena. */
export function marcarBrillo(raiz) {
  raiz?.traverse((o) => {
    if (!o.isMesh) return;
    const brilla = [o.material].flat().some(materialBrilla);
    if (brilla) o.layers.enable(CAPA_BRILLO);
    else o.layers.disable(CAPA_BRILLO);
  });
}

// ---------------------------------------------------------------- Completo (el de antes)
async function crearCompleto(renderer, escena, camara) {
  const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }] = await Promise.all([
    import("three/addons/postprocessing/EffectComposer.js"),
    import("three/addons/postprocessing/RenderPass.js"),
    import("three/addons/postprocessing/UnrealBloomPass.js"),
    import("three/addons/postprocessing/OutputPass.js"),
  ]);
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(escena, camara));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.35, 0.62);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  return {
    tipo: "completo",
    render: (dt) => composer.render(dt),
    setSize: (w, h) => composer.setSize(w, h),
    dispose: () => { composer.dispose(); bloom.dispose(); },
  };
}

// ---------------------------------------------------------------- Ligero
// 1) La escena se dibuja directo en pantalla, igual que sin brillo (con suavizado de bordes).
// 2) Solo los objetos de la capa de brillo se dibujan otra vez en una imagen de 1/4 × 1/4 (1/16 de píxeles).
// 3) Se desenfoca esa imagen chica (horizontal y vertical) y se suma encima de la pantalla en una pasada.
// Límite conocido: el resplandor no lo tapan muros ni personajes (en la vista isométrica casi no se nota).
const VERTICE = /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const DESENFOQUE = /* glsl */`
  uniform sampler2D tFuente; uniform vec2 paso; uniform float umbral; varying vec2 vUv;
  vec3 tomar(vec2 uv) { vec3 c = texture2D(tFuente, uv).rgb; return max(c - umbral, 0.0); }
  void main() {
    // Gauss de 9 muestras con 5 lecturas (aprovecha el filtrado lineal de la tarjeta).
    vec3 c = tomar(vUv) * 0.2270270270;
    vec2 o1 = paso * 1.3846153846, o2 = paso * 3.2307692308;
    c += (tomar(vUv + o1) + tomar(vUv - o1)) * 0.3162162162;
    c += (tomar(vUv + o2) + tomar(vUv - o2)) * 0.0702702703;
    gl_FragColor = vec4(c, 1.0);
  }`;
const MEZCLA = /* glsl */`
  uniform sampler2D tBrillo; uniform float fuerza; varying vec2 vUv;
  void main() { gl_FragColor = linearToOutputTexel(vec4(texture2D(tBrillo, vUv).rgb * fuerza, 1.0)); }`;

async function crearLigero(renderer, escena, camara) {
  const { FullScreenQuad } = await import("three/addons/postprocessing/Pass.js");
  const opciones = { type: THREE.HalfFloatType, depthBuffer: true };
  const rtA = new THREE.WebGLRenderTarget(1, 1, opciones);
  const rtB = new THREE.WebGLRenderTarget(1, 1, { ...opciones, depthBuffer: false });
  const desenfoque = (umbral) => new THREE.ShaderMaterial({
    uniforms: { tFuente: { value: null }, paso: { value: new THREE.Vector2() }, umbral: { value: umbral } },
    vertexShader: VERTICE, fragmentShader: DESENFOQUE, depthTest: false, depthWrite: false,
  });
  const matH = desenfoque(0.35); // el umbral se aplica una vez, al leer la imagen original
  const matV = desenfoque(0.0);
  const matMezcla = new THREE.ShaderMaterial({
    uniforms: { tBrillo: { value: rtA.texture }, fuerza: { value: 0.75 } },
    vertexShader: VERTICE, fragmentShader: MEZCLA,
    blending: THREE.AdditiveBlending, transparent: true, depthTest: false, depthWrite: false,
  });
  const quad = new FullScreenQuad(null);
  const colorAntes = new THREE.Color();
  const tam = new THREE.Vector2();
  let ancho = 1, alto = 1;

  return {
    tipo: "ligero",
    render() {
      renderer.setRenderTarget(null);
      renderer.render(escena, camara); // 1) la escena de siempre

      // 2) solo lo que brilla, a 1/16 de píxeles, sin fondo
      const fondo = escena.background;
      const autoClear = renderer.autoClear;
      const alfa = renderer.getClearAlpha();
      renderer.getClearColor(colorAntes);
      escena.background = null;
      camara.layers.set(CAPA_BRILLO);
      renderer.setRenderTarget(rtA);
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      renderer.render(escena, camara);
      camara.layers.set(0);
      escena.background = fondo;

      // 3) desenfoque horizontal (A→B) y vertical (B→A) y suma en pantalla
      renderer.autoClear = false;
      matH.uniforms.tFuente.value = rtA.texture; matH.uniforms.paso.value.set(1.5 / ancho, 0);
      quad.material = matH; renderer.setRenderTarget(rtB); quad.render(renderer);
      matV.uniforms.tFuente.value = rtB.texture; matV.uniforms.paso.value.set(0, 1.5 / alto);
      quad.material = matV; renderer.setRenderTarget(rtA); quad.render(renderer);
      quad.material = matMezcla; renderer.setRenderTarget(null); quad.render(renderer);

      renderer.setClearColor(colorAntes, alfa);
      renderer.autoClear = autoClear;
    },
    setSize() {
      renderer.getDrawingBufferSize(tam);
      ({ w: ancho, h: alto } = tamanoReducido(tam.x, tam.y));
      rtA.setSize(ancho, alto);
      rtB.setSize(ancho, alto);
    },
    dispose() {
      rtA.dispose(); rtB.dispose(); matH.dispose(); matV.dispose(); matMezcla.dispose(); quad.dispose();
    },
  };
}
