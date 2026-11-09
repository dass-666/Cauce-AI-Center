// Personajes de Kenney "Mini Characters" 1.0 (CC0, vendor/kenney-mini-characters/License.txt).
// Usa las animaciones que traen los modelos (walk, idle, sit, emote-yes, emote-no) y encima mueve
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
const CLIPS = ["idle", "walk", "sit", "emote-yes", "emote-no"];
// Gestos de transición que usan un clip de Kenney (se reinician al empezar).
const CLIP_GESTO = { celebrar: "emote-yes", reaccion_error: "emote-no" };

/** Modelo que le toca a un agente: siempre el mismo para el mismo id. */
export function modeloDe(id) {
  if (id.startsWith("modelo:") && MODELOS_KENNEY.includes(id.slice(7))) return id.slice(7); // cuerpo elegido a propósito
  return MODELOS_KENNEY[huella(id) % MODELOS_KENNEY.length];
}

/**
 * Cuerpos de los personajes de estación: un conjunto FIJO de tres modelos, uno por puesto (el mismo en todas las
 * estaciones). Así cada función se distingue de sus compañeras, y recorrer los pisos no sube a la GPU modelos
 * nuevos después del primero que tenga estación (texturas y geometrías estables). character-male-c ya lo usan los
 * agentes que trabajan en las demos de Compago y Ek Chuah; los otros dos son +2 texturas de 512×512 como máximo.
 */
export const MODELOS_ESTACION = Object.freeze(["character-female-d", "character-male-a", "character-male-c"]);
export const cuerpoEstacion = (indice) => `modelo:${MODELOS_ESTACION[indice % MODELOS_ESTACION.length]}`;

/** 0..1: cuánto teclea en el instante r. Ráfagas de 3–6 s con pausas cortas; distinto para cada personaje (r ya trae su fase). */
export function rafagaDe(r) {
  const onda = Math.sin(r * 0.9 + Math.sin(r * 0.37) * 2);
  const x = Math.min(1, Math.max(0, (onda + 0.55) / 0.5));
  return x * x * (3 - 2 * x);
}

// Rendimiento UHD: los modelos traen material PBR (MeshStandardMaterial, metalness 0). Con la luz de la oficina
// (hemisférica + una direccional, sin reflejos de entorno) se ve casi igual con MeshLambertMaterial, que hace
// menos cálculo por píxel y compila más rápido la primera vez. ?pbr=1 deja el material original (para comparar).
const conPBR = typeof location !== "undefined" && new URLSearchParams(location.search).get("pbr") === "1";
export function aLambert(m) {
  if (!m?.isMeshStandardMaterial) return m;
  const l = new THREE.MeshLambertMaterial({
    name: m.name, color: m.color, map: m.map, side: m.side, transparent: m.transparent, opacity: m.opacity,
    alphaTest: m.alphaTest, vertexColors: m.vertexColors,
  });
  m.dispose();
  return l;
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
          if (!conPBR) o.material = aLambert(o.material); // rendimiento UHD: mismo color y textura, sombreado más barato
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

/** ¿Dos esqueletos mueven los mismos huesos con las mismas matrices inversas? (entonces pueden ser uno) */
export function mismoEsqueleto(a, b) {
  return a.bones.length === b.bones.length && a.bones.every((h, i) => h === b.bones[i]) &&
    a.boneInverses.every((m, i) => m.equals(b.boneInverses[i]));
}

function crearCuerpoKenney(gltf, recursos) {
  let primeraUnion = null;
  const raiz = new THREE.Group();
  const modelo = clone(gltf.scene);
  modelo.scale.setScalar(gltf.userData.escala);
  raiz.add(modelo);
  // Rendimiento UHD: cuerpo y cabeza traen cada uno su esqueleto (mismos 7 huesos, mismas matrices). Si coinciden,
  // comparten uno solo: una textura de huesos y una actualización por personaje y cuadro en vez de dos.
  let esqueleto = null;
  modelo.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    o.frustumCulled = false; // con animación, la caja original no sirve para recortar
    if (esqueleto && mismoEsqueleto(esqueleto, o.skeleton) && o.bindMatrix.equals(primeraUnion)) { o.skeleton.dispose(); o.skeleton = esqueleto; return; }
    if (!esqueleto) { esqueleto = o.skeleton; primeraUnion = o.bindMatrix; }
    recursos.agregar(o.skeleton); // cada clon tiene su propio esqueleto (textura de huesos)
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
  // Fase K: los pesos de los clips se acercan a su objetivo en ~0.3 s (antes cambiaban de golpe, p. ej. al
  // terminar de celebrar). La primera vez se ponen directo: el personaje aparece ya en su postura.
  const actuales = new Map();
  let suavizar = true;
  const pesos = (objetivo, dt = 0) => {
    const k = suavizar && actuales.size ? 1 - Math.exp(-dt * 10) : 1;
    for (const [n, a] of Object.entries(acciones)) {
      const meta = objetivo[n] ?? 0;
      const valor = (actuales.get(n) ?? meta) + (meta - (actuales.get(n) ?? meta)) * k;
      const final = Math.abs(valor - meta) < 0.002 ? meta : valor;
      actuales.set(n, final);
      a.setEffectiveWeight(final);
    }
  };
  // Fase K: al cambiar de gesto, brazos, cabeza y torso pasan de la postura anterior a la nueva en 0.35 s.
  const huesos = Object.values(h);
  const previos = huesos.map(() => new THREE.Quaternion());
  const desde = huesos.map(() => new THREE.Quaternion());
  const MEZCLA = 0.35;
  let mezcla = 1;
  let primera = true;

  let gestoAnterior = null;
  let baseAnterior = null;
  function aplicar({ base, s, gesto, t, r, o = 0, fase = "teclear", k = 1, quieto = false, vida = null }, dt) {
    modelo.position.y = 0;
    // Vida en reposo: giro corto sobre el asiento (el modelo gira dentro de su raíz; la silla no se mueve).
    modelo.rotation.y = vida?.fase === "girar_silla" ? 0.32 * vida.k * vida.lado : 0;
    if (gesto !== gestoAnterior || base !== baseAnterior) {
      if (gesto !== gestoAnterior && CLIP_GESTO[gesto] && acciones[CLIP_GESTO[gesto]]) acciones[CLIP_GESTO[gesto]].time = 0; // empieza desde el inicio
      gestoAnterior = gesto;
      baseAnterior = base;
      if (!primera) { huesos.forEach((b, i) => desde[i].copy(previos[i])); mezcla = 0; }
    }
    for (const [b, q, p] of inicial) { b.quaternion.copy(q); b.position.copy(p); }
    // Al sentarse, la propia transición ya es suave (s va de 0 a 1): se aplica tal cual, sin retraso.
    suavizar = base !== "sentandose";
    if (base === "caminar") pesos({ walk: 1 }, dt);
    else if (base === "sentandose") {
      const k = s * s * (3 - 2 * s);
      pesos({ idle: 1 - k, sit: k }, dt);
      modelo.position.y = ALTO_ASIENTO * k;
    } else if (base === "sentado") {
      pesos({ sit: 1 }, dt);
      modelo.position.y = ALTO_ASIENTO;
    } else {
      pesos(CLIP_GESTO[gesto] ? { [CLIP_GESTO[gesto]]: 1 } : { idle: 1 }, dt);
    }
    mezclador.update(quieto && base !== "caminar" && !CLIP_GESTO[gesto] ? 0 : dt); // reducir movimiento: sin respiración del clip

    // Gestos que el modelo no trae: se suman a la animación base moviendo huesos.
    if (gesto === "teclear") {
      // brazos al frente, sobre el teclado, con un golpeteo alterno; a veces levanta la vista a la pantalla.
      // Fase K: teclea en ráfagas (no al mismo ritmo todo el tiempo): entre ráfagas deja las manos quietas y lee.
      const rafaga = quieto ? 0 : rafagaDe(r);
      const pausa = fase === "teclear" ? 0 : k; // fase L: leer, mirar a un lado o acomodarse (maquina.js → faseTrabajo)
      const golpe = 0.1 * (1 - o) * rafaga * (1 - pausa);
      h.brazoD.rotation.set(-1.25 + Math.sin(r * 14) * golpe, 0, 0.12);
      h.brazoI.rotation.set(-1.25 + Math.sin(r * 14 + 1.7) * golpe, 0, -0.12);
      h.cabeza.rotation.x += 0.12 - 0.22 * o - 0.08 * (1 - rafaga);
      h.cabeza.rotation.y += quieto ? 0 : Math.sin(r * 0.23) * 0.07; // la vista recorre la pantalla
      if (fase === "leer") { // se recarga un poco, manos sobre el escritorio, lee la pantalla línea por línea
        h.torso.rotation.x -= 0.14 * pausa;
        h.brazoD.rotation.x += 0.45 * pausa; h.brazoI.rotation.x += 0.45 * pausa;
        h.cabeza.rotation.x -= 0.14 * pausa - Math.sin(r * 1.3) * 0.03 * pausa;
      } else if (fase === "mirar") { // voltea a un lado (papeles o segundo monitor) y regresa
        h.cabeza.rotation.y += 0.55 * pausa;
        h.torso.rotation.y += 0.12 * pausa;
      } else if (fase === "acomodarse") { // se endereza, estira la espalda y suelta los brazos
        h.torso.rotation.x -= 0.22 * pausa;
        h.brazoD.rotation.x += 0.7 * pausa; h.brazoI.rotation.x += 0.7 * pausa;
        h.cabeza.rotation.z += Math.sin(r * 2) * 0.1 * pausa;
      }
    } else if (gesto === "reposo") {
      // Fase L: esperando, recargado y con la vista casi siempre en la pantalla; de vez en cuando mira a un lado.
      h.cabeza.rotation.y += 0.45 * o + Math.sin(r * 0.35) * 0.06;
      h.cabeza.rotation.x -= 0.05;
      h.torso.rotation.x -= 0.08 + Math.sin(r * 1.6) * 0.012; // respira
      h.brazoD.rotation.set(-0.5, 0, 0.18); h.brazoI.rotation.set(-0.5, 0, -0.18); // manos en el regazo
    } else if (gesto === "relajado") {
      // recargado en el respaldo, brazos sueltos, cabeza un poco atrás
      h.torso.rotation.x -= 0.18;
      h.cabeza.rotation.x -= 0.12 + Math.sin(r * 0.5) * 0.04;
      h.brazoD.rotation.set(0, 0, 0.35);
      h.brazoI.rotation.set(0, 0, -0.35);
    } else if (gesto === "alerta") {
      // Fase L: de pie, inclinado hacia la pantalla con las manos al frente (atiende el error); de vez en cuando
      // se lleva la mano a la cabeza y niega despacio. Visible pero moderado.
      h.torso.rotation.x += 0.16;
      h.brazoD.rotation.set(-1.0 - 1.5 * o, 0, 0.12 + 0.48 * o);
      h.brazoI.rotation.set(-1.0, 0, -0.12);
      h.cabeza.rotation.x += 0.2;
      h.cabeza.rotation.y += Math.sin(r * 5) * 0.22 * o;
    } else if (gesto === "reaccion_error") {
      h.brazoD.rotation.set(-2.5 * Math.min(1, t / 0.4), 0, 0.6);
    } else if (gesto === "consultar") {
      // Estaciones: inclinado sobre el escritorio, la vista baja a un documento y vuelve a la pantalla; de vez en
      // cuando pasa una hoja. Sin golpeteo de teclado: representa consultar un registro guardado, no un proceso.
      const leer = quieto ? 0.5 : 0.5 + 0.5 * Math.sin(r * 0.45);
      h.torso.rotation.x += 0.1;
      h.cabeza.rotation.x += 0.08 + 0.2 * leer;
      h.cabeza.rotation.y += quieto ? 0 : Math.sin(r * 0.2) * 0.08;
      h.brazoI.rotation.set(-0.95, 0, -0.2);
      h.brazoD.rotation.set(-0.95 - 0.35 * o, 0, 0.2 + 0.15 * o); // pasa la hoja (gesto ocasional)
    } else if (gesto === "atencion") {
      // Fase L: sentado con la mano levantada mientras pida revisión (no la baja hasta que cambie la evidencia);
      // de vez en cuando la sube del todo.
      h.brazoD.rotation.set(-1.7 - 1.0 * o, 0, 0.15 + 0.1 * o);
    } else if (gesto === "llamar_atencion") {
      h.brazoD.rotation.set(-2.9, 0, 0.15 + Math.sin(t * 6) * 0.2); // levanta la mano y saluda un momento
    } else if (gesto === "celebrar") {
      // Fase L: gesto breve de satisfacción (puño arriba una vez), sin saltar; termina en postura neutral.
      const kk = Math.sin(Math.min(1, t / 1.4) * Math.PI);
      h.brazoD.rotation.set(-2.4 * kk, 0, 0.25 * kk);
    }

    // Vida en reposo (maquina.js → faseVida): mirar la pantalla de cerca, voltear, acomodarse; nunca teclear.
    if (vida && vida.k > 0) {
      const { fase: fv, k: kv, lado } = vida;
      if (fv === "mirar_pantalla") { h.torso.rotation.x += 0.16 * kv; h.cabeza.rotation.x += 0.14 * kv; }
      else if (fv === "mirar_lado") { h.cabeza.rotation.y += 0.65 * kv * lado; h.torso.rotation.y += 0.16 * kv * lado; }
      else if (fv === "acomodarse") {
        h.torso.rotation.x -= 0.18 * kv;
        h.cabeza.rotation.z += 0.09 * kv * lado;
        if (gesto !== "atencion") { h.brazoI.rotation.x += 0.3 * kv; h.brazoD.rotation.x += 0.3 * kv; }
      } else if (fv === "girar_silla") h.cabeza.rotation.y += 0.2 * kv * lado;
    }
    if (vida) { // respiración y vista un poco más visibles sentado en reposo (antes casi imperceptibles a distancia)
      h.torso.rotation.x += Math.sin(r * 1.6) * 0.012;
      h.cabeza.rotation.y += Math.sin(r * 0.5 + 1) * 0.05;
    }

    // Mezcla entre la postura del gesto anterior y la del actual.
    if (mezcla < 1) {
      mezcla = Math.min(1, mezcla + dt / MEZCLA);
      const k = mezcla * mezcla * (3 - 2 * mezcla);
      huesos.forEach((b, i) => b.quaternion.slerpQuaternions(desde[i], b.quaternion.clone(), k));
    }
    huesos.forEach((b, i) => previos[i].copy(b.quaternion));
    primera = false;
  }

  return { raiz, aplicar };
}
