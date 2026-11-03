// Escenario 3D: uno o varios cuartos de oficina colocados en un edificio con pasillos.
// Modo "edificio": todos los departamentos a la vez (distribución de plano-edificio.js).
// Modo "individual": un solo cuarto, como la primera versión.
// También decide cuántas veces por segundo se anima cada cuarto (el enfocado, siempre).

import * as THREE from "three";
import { crearOficina } from "./oficina.js";
import { distribuirEdificio } from "./plano-edificio.js";
import { huella } from "./disposicion.js";
import { ACENTOS, OFICINA } from "./paleta.js";
import { Recursos } from "./recursos.js";

const ALTO_MURO_EDIFICIO = 1.0;

export function crearEscenario(deps, modelo, compartido, { modo }) {
  const recursos = new Recursos();
  const grupo = new THREE.Group();
  const cuartos = new Map(); // id → { oficina, x, z, ancho, fondo, acumulado }

  if (modo === "individual") {
    const dep = deps[0];
    const oficina = crearOficina(dep, modelo, compartido, { acento: acentoDe(dep.id), detalle: detalleDe(dep.id) });
    grupo.add(oficina.grupo);
    cuartos.set(dep.id, { oficina, x: 0, z: 0, ancho: oficina.cuarto.ancho, fondo: oficina.cuarto.fondo, acumulado: 0 });
  } else {
    const plano = distribuirEdificio(deps.map((d) => ({ id: d.id, posicion: d.posicion, puestos: Math.max(1, d.agentes.length) })));
    construirEdificio(grupo, plano, recursos);
    plano.cuartos.forEach((c, i) => {
      const dep = deps[i];
      const oficina = crearOficina(dep, modelo, compartido, {
        cuarto: { ancho: c.ancho, fondo: c.fondo },
        altoMuro: ALTO_MURO_EDIFICIO,
        base: false,
        acento: acentoDe(dep.id),
        detalle: detalleDe(dep.id),
      });
      oficina.grupo.position.set(c.x, 0, c.z);
      grupo.add(oficina.grupo);
      cuartos.set(dep.id, { oficina, ...c, acumulado: Math.random() * 0.05 });
    });
  }

  const limites = calcularLimites([...cuartos.values()]);

  return {
    grupo,
    modo,
    limites,
    cuartos,
    personajes: () => [...cuartos.values()].flatMap((c) => c.oficina.personajes),
    actualizar(depsNuevos, modeloNuevo) {
      for (const d of depsNuevos) cuartos.get(d.id)?.oficina.actualizar(d, modeloNuevo);
    },
    seleccionar(sel) {
      for (const c of cuartos.values()) c.oficina.seleccionar(sel);
    },
    /**
     * Anima cada cuarto. hzDe(id) dice cuántas veces por segundo: 0 = cada cuadro (el enfocado);
     * los demás acumulan el tiempo para no perder pasos. Devuelve cuántos personajes se animaron.
     */
    paso(dt, reloj, hzDe) {
      let animados = 0;
      for (const [id, c] of cuartos) {
        c.acumulado += dt;
        const hz = modo === "individual" ? 0 : hzDe(id);
        if (hz > 0 && c.acumulado < 1 / hz) continue;
        c.oficina.paso(Math.min(c.acumulado, 0.5), reloj);
        animados += c.oficina.personajes.length;
        c.acumulado = 0;
      }
      return animados;
    },
    /** Rectángulo de un departamento en coordenadas de la escena (para acercar la cámara). */
    rectangulo(id) {
      const c = cuartos.get(id);
      return c ? { x: c.x, z: c.z, ancho: c.ancho, fondo: c.fondo } : null;
    },
    liberar() {
      for (const c of cuartos.values()) c.oficina.liberar();
      grupo.removeFromParent();
      recursos.liberar();
    },
  };
}

export const acentoDe = (id) => ACENTOS[huella(id) % ACENTOS.length];
const detalleDe = (id) => (huella(id) >>> 3) % 3;

function calcularLimites(lista) {
  const minX = Math.min(...lista.map((c) => c.x - c.ancho / 2));
  const maxX = Math.max(...lista.map((c) => c.x + c.ancho / 2));
  const minZ = Math.min(...lista.map((c) => c.z - c.fondo / 2));
  const maxZ = Math.max(...lista.map((c) => c.z + c.fondo / 2));
  return { minX, maxX, minZ, maxZ, ancho: maxX - minX, fondo: maxZ - minZ };
}

/** Losa del edificio, pasillos con tiras de luz y macetas en los cruces. */
function construirEdificio(grupo, plano, recursos) {
  const M = (color, extra = {}) => recursos.agregar(new THREE.MeshLambertMaterial({ color, ...extra }));
  const E = 1.2; // banqueta
  const losa = new THREE.Mesh(recursos.agregar(new THREE.BoxGeometry(plano.ancho + E * 2, 0.4, plano.fondo + E * 2)), M(OFICINA.base));
  losa.position.y = -0.25;
  grupo.add(losa);
  const piso = new THREE.Mesh(recursos.agregar(new THREE.BoxGeometry(plano.ancho + 0.6, 0.04, plano.fondo + 0.6)), M(0x3a4258));
  piso.position.y = -0.06;
  grupo.add(piso);

  const luz = recursos.agregar(new THREE.MeshBasicMaterial({ color: OFICINA.brillo }));
  const maceta = M(OFICINA.maceta);
  const hojas = M(OFICINA.planta);
  const geoMaceta = recursos.agregar(new THREE.CylinderGeometry(0.22, 0.17, 0.4, 10));
  const geoHojas = recursos.agregar(new THREE.IcosahedronGeometry(0.38, 0));
  for (const p of plano.pasillos) {
    // Tira de luz al centro del pasillo principal: es lo que más brilla con el "Brillo" encendido.
    const tira = new THREE.Mesh(recursos.agregar(new THREE.BoxGeometry(p.ancho - 1, 0.02, 0.12)), luz);
    tira.position.set(p.x, -0.03, p.z);
    grupo.add(tira);
    for (const x of [-p.ancho / 2 - 0.5, p.ancho / 2 + 0.5]) {
      const m = new THREE.Mesh(geoMaceta, maceta);
      m.position.set(x, 0.2, p.z);
      const h = new THREE.Mesh(geoHojas, hojas);
      h.position.set(x, 0.66, p.z);
      grupo.add(m, h);
    }
  }
}
