// Personajes de Kenney "Mini Characters" 1.0 (CC0, vendor/kenney-mini-characters/License.txt).
// Usa las animaciones que traen los modelos (walk, idle, sit, emote-no) y encima mueve
// los huesos de los brazos con código para lo que no traen: teclear, levantar la mano y celebrar.
// Solo se descargan los modelos que se van a ver; si alguno falla, el personaje usa el cuerpo provisional.

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { huella } from "./disposicion.js";

const CARPETA = "vendor/kenney-mini-characters/";
export const MODELOS_KENNEY = Object.freeze([
  "character-female-a", "character-female-b", "character-female-c", "character-female-d", "character-female-e", "character-female-f",
  "character-male-a", "character-male-b", "character-male-c", "character-male-d", "character-male-e", "character-male-f",
]);
const ALTO = 1.15;              // alto de pie en la escena (m), como el personaje provisional
const ALTO_ASIENTO = 0.26;      // cuánto se eleva el cuerpo al sentarse (el clip "sit" lo baja al piso)
const CLIPS = ["idle", "walk", "sit", "emote-no"];

/** Modelo que le toca a un agente: siempre el mismo para el mismo id. */
export function modeloDe(id) {
  return MODELOS_KENNEY[huella(id) % MODELOS_KENNEY.length];
}

/** Descarga y guarda en memoria los modelos (uno por archivo, compartido por todos sus clones). */
export function crearCatalogoKenney(recursos) {
  const cargador = new GLTFLoader();
  const promesas = new Map(); // nombre → Promise<gltf|null>
  const listos = new Map();   // nombre → gltf|null (ya resuelto)

  function cargar(n) {
    if (!promesas.has(n)) {
      promesas.set(n, cargador.loadAsync(`${CARPETA}${n}.glb`).then((gltf) => {
        gltf.scene.traverse((o) => {
          if (!o.isMesh) return;
          recursos.agregar(o.geometry);
          for (const m of [o.material].flat()) {
            recursos.agregar(m);
            if (m.map) recursos.agregar(m.map);
          }
        });
        const caja = new THREE.Box3().setFromObject(gltf.scene);
        gltf.userData.escala = ALTO / Math.max(0.01, caja.max.y - caja.min.y);
        return gltf;
      }).catch((e) => {
        console.warn(`No se pudo cargar ${n}.glb; se usa el personaje provisional.`, e);
        return null;
      }).then((g) => {
        listos.set(n, g);
        return g;
      }));
    }
    return promesas.get(n);
  }

  return {
    /** ¿Ya se resolvió (bien o mal) el modelo de cada agente? */
    listos: (ids) => ids.every((id) => listos.has(modeloDe(id))),
    /** Descarga lo que falte. Nunca falla: un modelo que no carga queda como null. */
    preparar: (ids) => Promise.all(ids.map((id) => cargar(modeloDe(id)))),
    /** Cuerpo de Kenney, o null para que el personaje use el provisional. */
    fabricar(id, recursosOficina) {
      const gltf = listos.get(modeloDe(id));
      return gltf ? crearCuerpoKenney(gltf, recursosOficina) : null;
    },
  };
}

function crearCuerpoKenney(gltf, recursos) {
  const raiz = new THREE.Group();
  const modelo = clone(gltf.scene);
  modelo.scale.setScalar(gltf.userData.escala);
  raiz.add(modelo);
  modelo.traverse((o) => {
    if (o.isSkinnedMesh) {
      o.frustumCulled = false; // con animación, la caja original no sirve para recortar
      recursos.agregar(o.skeleton); // cada clon tiene su propio esqueleto (textura de huesos)
    }
  });
  const hueso = (n) => modelo.getObjectByName(n);
  const h = { brazoD: hueso("arm-right"), brazoI: hueso("arm-left"), cabeza: hueso("head"), torso: hueso("torso") };
  // Postura de reposo de cada hueso. Algunos clips (como "sit") no mueven brazos ni cabeza: sin
  // reiniciarlos cada cuadro, los gestos con código se acumularían.
  const inicial = Object.values(h).map((b) => [b, b.quaternion.clone(), b.position.clone()]);

  const mezclador = new THREE.AnimationMixer(modelo);
  const acciones = {};
  for (const n of CLIPS) {
    const clip = THREE.AnimationClip.findByName(gltf.animations, n);
    if (!clip) continue;
    const a = mezclador.clipAction(clip);
    a.play();
    a.setEffectiveWeight(0);
    acciones[n] = a;
  }
  const pesos = (objetivo) => {
    for (const [n, a] of Object.entries(acciones)) a.setEffectiveWeight(objetivo[n] ?? 0);
  };

  function aplicar({ base, s, gesto, t, r }, dt) {
    modelo.position.y = 0;
    for (const [b, q, p] of inicial) { b.quaternion.copy(q); b.position.copy(p); }
    if (base === "caminar") pesos({ walk: 1 });
    else if (base === "sentandose") {
      const k = s * s * (3 - 2 * s);
      pesos({ idle: 1 - k, sit: k });
      modelo.position.y = ALTO_ASIENTO * k;
    } else if (base === "sentado") {
      pesos({ sit: 1 });
      modelo.position.y = ALTO_ASIENTO;
    } else {
      pesos(gesto === "alerta" ? { "emote-no": 1 } : { idle: 1 });
    }
    mezclador.update(dt);

    // Gestos que el modelo no trae: se suman a la animación base moviendo huesos.
    if (gesto === "teclear") {
      // brazos al frente, sobre el teclado, con un golpeteo alterno
      h.brazoD.rotation.set(-1.25 + Math.sin(r * 14) * 0.1, 0, 0.12);
      h.brazoI.rotation.set(-1.25 + Math.sin(r * 14 + 1.7) * 0.1, 0, -0.12);
      h.cabeza.rotation.x += 0.12;
    } else if (gesto === "reposo") {
      h.cabeza.rotation.y += Math.sin(r * 0.35) * 0.4; // mira alrededor, despacio
    } else if (gesto === "levantar_mano") {
      h.brazoD.rotation.set(-2.9, 0, 0.15 + Math.sin(r * 6) * 0.2); // saluda
    } else if (gesto === "celebrar") {
      const salto = Math.max(0, Math.sin(t * 7));
      modelo.position.y += salto * 0.08;
      h.brazoD.rotation.set(-2.8, 0, 0.3 + salto * 0.25);
      h.brazoI.rotation.set(-2.8, 0, -0.3 - salto * 0.25);
    }
  }

  return { raiz, aplicar };
}
