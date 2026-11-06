// Escenario 3D: uno o varios cuartos de oficina colocados en un edificio con pasillos.
// Modo "edificio": todos los departamentos a la vez (distribución de plano-edificio.js) con su
// arquitectura (arquitectura.js). Modo "individual": un solo cuarto, como la primera versión.
// También decide cuántas veces por segundo se anima cada cuarto (el enfocado, siempre).

import * as THREE from "three";
import { crearOficina } from "./oficina.js";
import { distribuirEdificio } from "./plano-edificio.js";
import { crearArquitectura } from "./arquitectura.js";
import { temaDe, acentoDe } from "./identidad.js";
import { Recursos } from "./recursos.js";

const ALTO_MURO_EDIFICIO = 1.0;

export function crearEscenario(deps, modelo, compartido, { modo }) {
  const recursos = new Recursos();
  const grupo = new THREE.Group();
  const cuartos = new Map(); // id → { oficina, x, z, ancho, fondo, acumulado }
  let arquitectura = null;
  let limites;
  let recepcion = null;

  if (modo === "individual") {
    const dep = deps[0];
    const oficina = crearOficina(dep, modelo, compartido, { acento: acentoDe(dep), tema: temaDe(dep), estilo: modelo.proyecto.estilo });
    grupo.add(oficina.grupo);
    cuartos.set(dep.id, { oficina, x: 0, z: 0, ancho: oficina.cuarto.ancho, fondo: oficina.cuarto.fondo, acumulado: 0 });
    limites = calcularLimites([...cuartos.values()]);
  } else {
    const plano = distribuirEdificio(deps.map((d) => ({ id: d.id, posicion: d.posicion, puestos: Math.max(1, d.agentes.length) })));
    const info = plano.cuartos.map((c, i) => ({ ...c, nombre: deps[i].nombre, tema: temaDe(deps[i]), acento: acentoDe(deps[i]) }));
    arquitectura = crearArquitectura(plano, info, recursos, { mob: compartido.mobiliario, proyecto: modelo.proyecto });
    grupo.add(arquitectura.grupo);
    info.forEach((c, i) => {
      const dep = deps[i];
      const oficina = crearOficina(dep, modelo, compartido, {
        cuarto: { ancho: c.ancho, fondo: c.fondo },
        altoMuro: ALTO_MURO_EDIFICIO,
        base: false,
        acento: c.acento,
        tema: c.tema,
        estilo: modelo.proyecto.estilo, // fase M: paleta y pisos del proyecto
      });
      oficina.grupo.position.set(c.x, 0, c.z);
      grupo.add(oficina.grupo);
      cuartos.set(dep.id, { oficina, x: c.x, z: c.z, ancho: c.ancho, fondo: c.fondo, acumulado: Math.random() * 0.05 });
    });
    // La cámara puede recorrer todo el edificio (cuartos y recepción).
    limites = { minX: -plano.ancho / 2, maxX: plano.ancho / 2, minZ: -plano.fondo / 2, maxZ: plano.fondo / 2, ancho: plano.ancho, fondo: plano.fondo };
    recepcion = plano.recepcion;
  }
  arquitectura?.actualizar(modelo);

  return {
    grupo,
    modo,
    limites,
    cuartos,
    recepcion,
    personajes: () => [...cuartos.values()].flatMap((c) => c.oficina.personajes),
    actualizar(depsNuevos, modeloNuevo) {
      for (const d of depsNuevos) cuartos.get(d.id)?.oficina.actualizar(d, modeloNuevo);
      arquitectura?.actualizar(modeloNuevo);
    },
    seleccionar(sel) {
      for (const c of cuartos.values()) c.oficina.seleccionar(sel);
    },
    aplicarLuz(luz) { arquitectura?.aplicarLuz(luz); },
    /** Dónde está ahora un agente (para acercar la cámara). */
    posicionAgente(id) {
      for (const c of cuartos.values()) {
        const per = c.oficina.personajes.find((p) => p.id === id);
        if (per) return per.raiz.getWorldPosition(new THREE.Vector3());
      }
      return null;
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
      arquitectura?.paso();
      return animados;
    },
    /** Rendimiento UHD: ¿hay algo que se mueva en algún cuarto? Si no, la imagen no cambia entre cuadros. */
    enMovimiento() {
      for (const c of cuartos.values()) if (c.oficina.enMovimiento()) return true;
      return false;
    },
    /** Fase L: dónde está el escritorio de un agente (aunque no tenga personaje), en coordenadas de la escena. */
    posicionPuesto(id) {
      for (const c of cuartos.values()) {
        const l = c.oficina.lugarDe?.(id);
        if (l) return { x: c.x + l.x, z: c.z + l.z };
      }
      return null;
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

function calcularLimites(lista) {
  const minX = Math.min(...lista.map((c) => c.x - c.ancho / 2));
  const maxX = Math.max(...lista.map((c) => c.x + c.ancho / 2));
  const minZ = Math.min(...lista.map((c) => c.z - c.fondo / 2));
  const maxZ = Math.max(...lista.map((c) => c.z + c.fondo / 2));
  return { minX, maxX, minZ, maxZ, ancho: maxX - minX, fondo: maxZ - minZ };
}
