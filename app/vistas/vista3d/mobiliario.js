// Catálogo de muebles hechos con código (fase L). Sin modelos descargados: cajas, cilindros e icosaedros.
// - Las geometrías se crean una vez por medida y se reutilizan en todo el edificio (crearMobiliario va en los
//   recursos compartidos de la escena).
// - Los materiales los pone quien llama (cada cuarto reutiliza los suyos por color), así que un mueble nuevo
//   no agrega llamadas de dibujo: fusionarEstaticos() junta todo lo estático por material.
// - Escala: metros. Alto de escritorio 0.6, asiento 0.32, como el resto de la oficina.
// - Ningún mueble representa trabajo ni datos: los monitores de decoración van apagados.

import * as THREE from "three";
import { ATLAS, celdaPictograma } from "./estilo-visual.js";

export const ALTO_ESCRITORIO = 0.6;

/**
 * @param recursos  Recursos de la escena (se liberan con ella)
 * @returns funciones que agregan muebles a un grupo: cada una recibe (destino, m, opciones), donde m son los
 *          materiales del cuarto: { madera, maderaOscura, metal, silla, maceta, planta, vidrio, marco, claro, acento }.
 */
export function crearMobiliario(recursos) {
  const cache = new Map();
  const geo = (clave, fabricar) => {
    if (!cache.has(clave)) cache.set(clave, recursos.agregar(fabricar()));
    return cache.get(clave);
  };
  const r3 = (n) => Math.round(n * 1000) / 1000;
  const caja = (w, h, d) => geo(`c${r3(w)}|${r3(h)}|${r3(d)}`, () => new THREE.BoxGeometry(w, h, d));
  const cil = (rt, rb, h, seg = 10) => geo(`y${r3(rt)}|${r3(rb)}|${r3(h)}|${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
  const ico = (r, det = 0) => geo(`i${r3(r)}|${det}`, () => new THREE.IcosahedronGeometry(r, det));
  // Fase M: plano con la celda de un pictograma del atlas de pantallas ambientales (mira hacia +Z).
  const planoPictograma = (w, h, nombre) => geo(`p${r3(w)}|${r3(h)}|${nombre}`, () => {
    const g = new THREE.PlaneGeometry(w, h);
    const { col, fila } = celdaPictograma(nombre);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, (col + 0.04 + uv.getX(i) * 0.92) / ATLAS.columnas, 1 - (fila + 0.04 + (1 - uv.getY(i)) * 0.92) / ATLAS.filas);
    }
    return g;
  });

  /** Grupo colocado y girado (rot en radianes alrededor de Y); los muebles se arman en coordenadas locales. */
  function lugar(destino, { x = 0, y = 0, z = 0, rot = 0 } = {}) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rot;
    destino.add(g);
    return g;
  }
  function poner(g, geometria, material, x, y, z) {
    const o = new THREE.Mesh(geometria, material);
    o.position.set(x, y, z);
    g.add(o);
    return o;
  }

  return {
    caja, cil, ico, poner,

    /** Escritorio de 1.3 × 0.7 con cuatro patas. */
    escritorio(destino, m, opciones = {}) {
      const { ancho = 1.3, fondo = 0.7 } = opciones;
      const g = lugar(destino, opciones);
      poner(g, caja(ancho, 0.05, fondo), m.madera, 0, ALTO_ESCRITORIO, 0);
      const px = ancho / 2 - 0.05, pz = fondo / 2 - 0.05;
      for (const [x, z] of [[-px, -pz], [px, -pz], [-px, pz], [px, pz]]) poner(g, caja(0.05, ALTO_ESCRITORIO, 0.05), m.maderaOscura, x, ALTO_ESCRITORIO / 2, z);
      return g;
    },

    /** Monitor (marco y pie) y teclado. La pantalla la pone quien llama: cambia de color con el estado. */
    monitorYTeclado(destino, m, opciones = {}) {
      const g = lugar(destino, opciones);
      poner(g, caja(0.62, 0.38, 0.04), m.metal, 0, ALTO_ESCRITORIO + 0.33, -0.18);
      poner(g, caja(0.06, 0.14, 0.06), m.metal, 0, ALTO_ESCRITORIO + 0.08, -0.18);
      poner(g, caja(0.42, 0.02, 0.14), m.metal, 0, ALTO_ESCRITORIO + 0.035, 0.1);
      return g;
    },

    /** Silla de oficina con respaldo bajo (no tapa al personaje sentado). Mira hacia -Z. */
    silla(destino, m, opciones = {}) {
      const g = lugar(destino, opciones);
      poner(g, caja(0.42, 0.06, 0.4), m.silla, 0, 0.3, 0);
      poner(g, caja(0.42, 0.26, 0.06), m.silla, 0, 0.46, 0.2);
      poner(g, cil(0.03, 0.03, 0.26, 8), m.metal, 0, 0.15, 0);
      poner(g, cil(0.2, 0.2, 0.03, 10), m.metal, 0, 0.02, 0);
      return g;
    },

    /** Laptop cerrada o abierta (decoración de mesa; siempre apagada). */
    laptop(destino, m, opciones = {}) {
      const { abierta = true } = opciones;
      const g = lugar(destino, opciones);
      poner(g, caja(0.34, 0.02, 0.24), m.metal, 0, 0.01, 0);
      if (abierta) { const t = poner(g, caja(0.34, 0.22, 0.015), m.metal, 0, 0.11, -0.12); t.rotation.x = -0.25; }
      return g;
    },

    /** Archivero metálico de cajones (alto 0.7–1.0). */
    archivero(destino, m, opciones = {}) {
      const { cajones = 3, alto = 0.3 * cajones } = opciones;
      const g = lugar(destino, opciones);
      poner(g, caja(0.48, alto, 0.45), m.metal, 0, alto / 2, 0);
      for (let i = 0; i < cajones; i++) poner(g, caja(0.2, 0.025, 0.02), m.acento ?? m.claro, 0, (i + 0.65) * alto / cajones, 0.235);
      return g;
    },

    /** Estantería baja con libros/carpetas de colores (alto 0.85; no tapa la vista isométrica). */
    estanteria(destino, m, opciones = {}) {
      const { ancho = 1.2, colores = [m.acento ?? m.claro, m.claro, m.maderaOscura] } = opciones;
      const g = lugar(destino, opciones);
      poner(g, caja(ancho, 0.04, 0.32), m.maderaOscura, 0, 0.02, 0);
      for (const y of [0.42, 0.84]) poner(g, caja(ancho, 0.03, 0.32), m.maderaOscura, 0, y, 0);
      for (const x of [-ancho / 2 + 0.02, ancho / 2 - 0.02]) poner(g, caja(0.03, 0.85, 0.32), m.maderaOscura, x, 0.425, 0);
      const n = Math.max(3, Math.floor(ancho / 0.13));
      for (let fila = 0; fila < 2; fila++) for (let i = 0; i < n - 1; i++) {
        if ((i + fila * 2) % 5 === 4) continue; // huecos: no parece una pared de colores
        const alto = 0.26 + ((i * 7 + fila * 3) % 4) * 0.025;
        poner(g, caja(0.09, alto, 0.24), colores[(i + fila) % colores.length], -ancho / 2 + 0.11 + i * 0.12, 0.04 + fila * 0.42 + alto / 2, 0);
      }
      return g;
    },

    /** Mesa de reuniones con sillas vacías alrededor (sala de juntas o espera; nunca con personas). */
    mesaReuniones(destino, m, opciones = {}) {
      const { largo = 2.0, fondo = 0.9, sillas = 2 } = opciones;
      const g = lugar(destino, opciones);
      poner(g, caja(largo, 0.06, fondo), m.madera, 0, 0.62, 0);
      poner(g, caja(0.18, 0.6, 0.18), m.metal, -largo / 2 + 0.35, 0.3, 0);
      poner(g, caja(0.18, 0.6, 0.18), m.metal, largo / 2 - 0.35, 0.3, 0);
      const paso = largo / sillas;
      for (let i = 0; i < sillas; i++) for (const lado of [-1, 1]) {
        const s = lugar(g, { x: -largo / 2 + paso * (i + 0.5), z: lado * (fondo / 2 + 0.32), rot: lado > 0 ? 0 : Math.PI });
        poner(s, caja(0.4, 0.06, 0.38), m.silla, 0, 0.3, 0);
        poner(s, caja(0.4, 0.3, 0.05), m.silla, 0, 0.48, 0.19);
        poner(s, cil(0.03, 0.03, 0.28, 6), m.metal, 0, 0.14, 0);
      }
      return g;
    },

    /** Planta en maceta: «baja» (escritorio o pasillo), «media» (rincón) o «alta» (recepción). */
    planta(destino, m, opciones = {}) {
      const { tam = "media" } = opciones;
      const g = lugar(destino, opciones);
      if (tam === "baja") {
        poner(g, cil(0.08, 0.06, 0.12, 8), m.maceta, 0, 0.06, 0);
        poner(g, ico(0.12), m.planta, 0, 0.2, 0);
      } else if (tam === "alta") {
        poner(g, cil(0.22, 0.17, 0.42, 10), m.maceta, 0, 0.21, 0);
        poner(g, cil(0.025, 0.03, 0.5, 6), m.maderaOscura, 0, 0.62, 0);
        poner(g, ico(0.36), m.planta, 0, 1.0, 0);
        poner(g, ico(0.26), m.planta, 0.12, 1.3, -0.05);
      } else {
        poner(g, cil(0.2, 0.16, 0.34, 10), m.maceta, 0, 0.17, 0);
        poner(g, ico(0.34), m.planta, 0, 0.6, 0);
        poner(g, ico(0.2), m.planta, -0.1, 0.84, 0.06);
      }
      return g;
    },

    /** Lámpara de pie (decoración: no ilumina nada; la iluminación es global y barata). */
    lampara(destino, m, opciones = {}) {
      const g = lugar(destino, opciones);
      poner(g, cil(0.14, 0.16, 0.03, 10), m.metal, 0, 0.015, 0);
      poner(g, cil(0.015, 0.015, 1.1, 6), m.metal, 0, 0.56, 0);
      poner(g, cil(0.1, 0.17, 0.2, 10), m.pantallaLampara ?? m.claro, 0, 1.18, 0);
      return g;
    },

    /** División de cristal con marco (largo en X; gira con rot). */
    divisionCristal(destino, m, opciones = {}) {
      const { largo = 1.6, alto = 0.9 } = opciones;
      const g = lugar(destino, opciones);
      const v = poner(g, caja(largo, alto, 0.04), m.vidrio, 0, alto / 2, 0);
      v.renderOrder = 2;
      poner(g, caja(largo + 0.02, 0.04, 0.06), m.marco, 0, alto, 0);
      poner(g, caja(largo + 0.02, 0.04, 0.06), m.marco, 0, 0.02, 0);
      for (const x of [-largo / 2, largo / 2]) poner(g, caja(0.05, alto, 0.06), m.marco, x, alto / 2, 0);
      return g;
    },

    /** Mostrador de recepción en L con frente del color de identidad. */
    mostrador(destino, m, opciones = {}) {
      const { ancho = 2.6 } = opciones;
      const g = lugar(destino, opciones);
      poner(g, caja(ancho, 0.75, 0.6), m.maderaOscura, 0, 0.375, 0);
      poner(g, caja(ancho + 0.1, 0.06, 0.7), m.madera, 0, 0.78, 0);
      poner(g, caja(ancho - 0.2, 0.12, 0.02), m.acento ?? m.claro, 0, 0.55, 0.31); // franja de identidad al frente
      poner(g, caja(0.6, 0.75, 1.2), m.maderaOscura, -ancho / 2 - 0.3, 0.375, -0.3);
      poner(g, caja(0.7, 0.06, 1.3), m.madera, -ancho / 2 - 0.3, 0.78, -0.3);
      return g;
    },

    /** Sillón de espera (asiento, respaldo y brazos). */
    sofa(destino, m, opciones = {}) {
      const { ancho = 1.8 } = opciones;
      const g = lugar(destino, opciones);
      const tela = m.sofa ?? m.silla;
      poner(g, caja(ancho, 0.35, 0.7), tela, 0, 0.2, 0);
      poner(g, caja(ancho, 0.45, 0.18), tela, 0, 0.45, 0.3);
      for (const x of [-ancho / 2 + 0.08, ancho / 2 - 0.08]) poner(g, caja(0.16, 0.5, 0.7), tela, x, 0.25, 0);
      return g;
    },

    /** Dispensador de agua (decoración de cocineta). */
    garrafon(destino, m, opciones = {}) {
      const g = lugar(destino, opciones);
      poner(g, caja(0.32, 0.8, 0.32), m.claro, 0, 0.4, 0);
      poner(g, cil(0.13, 0.13, 0.34, 10), m.agua ?? m.vidrio, 0, 0.97, 0);
      return g;
    },

    /** Credenza baja con impresora encima. */
    credenza(destino, m, opciones = {}) {
      const { ancho = 1.2 } = opciones;
      const g = lugar(destino, opciones);
      poner(g, caja(ancho, 0.55, 0.42), m.maderaOscura, 0, 0.275, 0);
      poner(g, caja(ancho + 0.04, 0.03, 0.46), m.madera, 0, 0.565, 0);
      poner(g, caja(0.46, 0.22, 0.36), m.claro, -ancho / 4, 0.69, 0);
      poner(g, caja(0.3, 0.02, 0.1), m.metal, -ancho / 4, 0.8, 0.08);
      return g;
    },


    // ---------- Fase M: piezas para los interiores por tipo de trabajo (interiores.js) ----------

    /**
     * Pantalla ambiental con marco: un pictograma abstracto del atlas (sin cifras). Mira hacia +Z (gira con rot).
     * No cambia con los datos; se atenúa con todo el piso cuando no hay datos vigentes (estilo-visual.js).
     */
    pantallaAmbiente(destino, m, opciones = {}) {
      const { ancho = 0.9, alto = 0.5, pictograma = "mosaico", pie = 0 } = opciones;
      const g = lugar(destino, opciones);
      poner(g, caja(ancho + 0.06, alto + 0.06, 0.04), m.metal, 0, 0, -0.025);
      if (pie > 0) {
        poner(g, caja(0.05, pie, 0.05), m.metal, 0, -alto / 2 - pie / 2, -0.03);
        poner(g, caja(0.36, 0.03, 0.24), m.metal, 0, -alto / 2 - pie + 0.015, -0.03);
      }
      if (m.pantallaAmbiente) poner(g, planoPictograma(ancho, alto, pictograma), m.pantallaAmbiente, 0, 0, 0.001);
      return g;
    },

    /** Gabinete de servidores (alto 1.15): rejillas y una franja del acento (luces fijas: no indican tráfico). */
    rack(destino, m, opciones = {}) {
      const { alto = 1.15 } = opciones;
      const g = lugar(destino, opciones);
      poner(g, caja(0.58, alto, 0.6), m.metal, 0, alto / 2, 0);
      poner(g, caja(0.5, alto - 0.12, 0.02), m.maderaOscura ?? m.metal, 0, alto / 2, 0.305);
      for (let y = 0.16; y < alto - 0.1; y += 0.16) poner(g, caja(0.44, 0.02, 0.02), y % 0.32 < 0.16 ? (m.acento ?? m.claro) : m.claro, 0, y, 0.315);
      return g;
    },

    /** Mesa de análisis amplia con papeles y dos bancos (nadie sentado). */
    mesaAnalisis(destino, m, opciones = {}) {
      const { largo = 1.6, fondo = 0.8, bancos = true } = opciones;
      const g = lugar(destino, opciones);
      poner(g, caja(largo, 0.05, fondo), m.madera, 0, 0.72, 0);
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) poner(g, caja(0.05, 0.72, 0.05), m.metal, x * (largo / 2 - 0.06), 0.36, z * (fondo / 2 - 0.06));
      poner(g, caja(0.3, 0.012, 0.22), m.claro, -largo * 0.22, 0.75, -0.08).rotation.y = 0.25;
      poner(g, caja(0.3, 0.012, 0.22), m.claro, largo * 0.05, 0.75, 0.1).rotation.y = -0.15;
      poner(g, caja(0.24, 0.02, 0.16), m.acento ?? m.claro, largo * 0.28, 0.755, -0.05);
      if (bancos) for (const x of [-largo / 4, largo / 4]) {
        poner(g, cil(0.16, 0.16, 0.05, 10), m.silla, x, 0.55, fondo / 2 + 0.3);
        poner(g, cil(0.025, 0.025, 0.53, 6), m.metal, x, 0.27, fondo / 2 + 0.3);
      }
      return g;
    },

    /** Estación de pie (consulta rápida): mesa alta con una pantalla ambiental. Mira hacia +Z. */
    estacionPie(destino, m, opciones = {}) {
      const { pictograma = "lista" } = opciones;
      const g = lugar(destino, opciones);
      poner(g, caja(0.7, 0.04, 0.45), m.madera, 0, 1.0, 0);
      poner(g, caja(0.08, 1.0, 0.08), m.metal, 0, 0.5, -0.1);
      poner(g, caja(0.5, 0.03, 0.4), m.metal, 0, 0.015, -0.1);
      this.pantallaAmbiente(g, m, { x: 0, y: 1.26, z: -0.12, ancho: 0.5, alto: 0.3, pictograma });
      return g;
    },

    /** Pizarrón o tablero en un muro (mira hacia +Z): fondo claro con trazos del acento o corcho con tachuelas. */
    tablero(destino, m, opciones = {}) {
      const { ancho = 1.2, alto = 0.6, tipo = "pizarron" } = opciones;
      const g = lugar(destino, opciones);
      poner(g, caja(ancho + 0.06, alto + 0.06, 0.03), m.marco ?? m.metal, 0, 0, -0.02);
      poner(g, caja(ancho, alto, 0.02), tipo === "corcho" ? (m.corcho ?? m.madera) : m.claro, 0, 0, 0);
      if (tipo === "corcho") {
        for (const [x, y] of [[-0.35, 0.12], [0.1, 0.18], [0.32, -0.1], [-0.12, -0.15], [0.42, 0.2]]) {
          poner(g, caja(0.16, 0.12, 0.01), m.claro, x * ancho, y * alto * 1.6, 0.015);
          poner(g, caja(0.03, 0.03, 0.02), m.acento ?? m.claro, x * ancho, y * alto * 1.6 + 0.05, 0.025);
        }
      } else {
        for (let i = 0; i < 3; i++) poner(g, caja(ancho * (0.6 - i * 0.12), 0.025, 0.01), m.acento ?? m.metal, -ancho * 0.12 + i * 0.04, alto * (0.25 - i * 0.22), 0.012);
        poner(g, caja(ancho * 0.9, 0.03, 0.06), m.marco ?? m.metal, 0, -alto / 2 - 0.03, 0.03);
      }
      return g;
    },

    /** Banda de rodillos con cajas (estación de procesamiento de importación). Largo en X. */
    banda(destino, m, opciones = {}) {
      const { largo = 1.6 } = opciones;
      const g = lugar(destino, opciones);
      poner(g, caja(largo, 0.06, 0.5), m.metal, 0, 0.62, 0);
      for (let x = -largo / 2 + 0.12; x < largo / 2; x += 0.16) poner(g, caja(0.04, 0.02, 0.46), m.claro, x, 0.66, 0);
      for (const x of [-largo / 2 + 0.08, largo / 2 - 0.08]) for (const z of [-0.2, 0.2]) poner(g, caja(0.05, 0.6, 0.05), m.metal, x, 0.3, z);
      const carton = m.carton ?? m.madera;
      for (const [x, s] of [[-largo * 0.28, 0.3], [largo * 0.12, 0.26], [largo * 0.36, 0.22]]) poner(g, caja(s, s * 0.8, s), carton, x, 0.67 + s * 0.4, 0);
      return g;
    },

    /** Tarima con cajas apiladas. */
    tarima(destino, m, opciones = {}) {
      const g = lugar(destino, opciones);
      poner(g, caja(1.0, 0.12, 0.8), m.maderaOscura, 0, 0.06, 0);
      const carton = m.carton ?? m.madera;
      for (const [x, y, z, s] of [[-0.22, 0.31, -0.15, 0.38], [0.2, 0.31, -0.15, 0.38], [0.0, 0.31, 0.2, 0.38], [0.0, 0.68, -0.05, 0.34]]) poner(g, caja(s, s, s), carton, x, y, z);
      return g;
    },

    /** Lámpara de inspección (brazo articulado) sobre una mesa: pie, dos tramos y pantalla. */
    lamparaInspeccion(destino, m, opciones = {}) {
      const g = lugar(destino, opciones);
      poner(g, cil(0.07, 0.08, 0.03, 10), m.metal, 0, 0.015, 0);
      poner(g, caja(0.03, 0.34, 0.03), m.metal, 0, 0.18, 0).rotation.z = 0.35;
      poner(g, caja(0.03, 0.3, 0.03), m.metal, 0.14, 0.38, 0).rotation.z = -0.9;
      poner(g, cil(0.04, 0.09, 0.08, 10), m.pantallaLampara ?? m.claro, 0.28, 0.42, 0);
      return g;
    },

    /** Estante de archivo (alto 1.2) con cajas de archivo; va junto a un muro. Largo en X. */
    archivoAlto(destino, m, opciones = {}) {
      const { ancho = 1.2 } = opciones;
      const g = lugar(destino, opciones);
      for (const x of [-ancho / 2 + 0.02, ancho / 2 - 0.02]) poner(g, caja(0.04, 1.2, 0.36), m.metal, x, 0.6, 0);
      for (const y of [0.02, 0.42, 0.82, 1.18]) poner(g, caja(ancho, 0.03, 0.36), m.metal, 0, y, 0);
      for (let fila = 0; fila < 3; fila++) for (let i = 0; i < Math.floor(ancho / 0.26); i++) {
        if ((i + fila) % 4 === 3) continue;
        poner(g, caja(0.22, 0.26, 0.3), (i + fila) % 3 === 0 ? (m.acento ?? m.claro) : (m.carton ?? m.claro), -ancho / 2 + 0.16 + i * 0.26, 0.17 + fila * 0.4, 0);
      }
      return g;
    },

    /** Globo terráqueo en su pie (búsqueda). */
    globo(destino, m, opciones = {}) {
      const g = lugar(destino, opciones);
      poner(g, cil(0.14, 0.16, 0.04, 10), m.maderaOscura, 0, 0.02, 0);
      poner(g, cil(0.02, 0.02, 0.62, 6), m.metal, 0, 0.33, 0);
      poner(g, ico(0.2, 1), m.agua ?? m.vidrio, 0, 0.78, 0);
      poner(g, ico(0.12, 0), m.planta, 0.06, 0.82, 0.1);
      return g;
    },

    /** Bandejas de documentos apiladas (revisión). */
    bandejas(destino, m, opciones = {}) {
      const g = lugar(destino, opciones);
      for (let i = 0; i < 3; i++) {
        poner(g, caja(0.3, 0.015, 0.24), m.metal, 0, i * 0.08, 0);
        poner(g, caja(0.26, 0.03 + (i % 2) * 0.02, 0.2), m.claro, 0, i * 0.08 + 0.025, 0);
      }
      return g;
    },

    /** Tapete de área (decoración del piso). */
    tapete(destino, m, opciones = {}) {
      const { ancho = 2, fondo = 1.4 } = opciones;
      const g = lugar(destino, opciones);
      poner(g, caja(ancho, 0.01, fondo), m.tapete ?? m.acento ?? m.claro, 0, 0.006, 0);
      poner(g, caja(ancho - 0.2, 0.012, fondo - 0.2), m.tapeteCentro ?? m.claro, 0, 0.007, 0);
      return g;
    },

    /** Charola de cables en el piso entre gabinetes. Largo en X. */
    charolaCables(destino, m, opciones = {}) {
      const { largo = 1.2 } = opciones;
      const g = lugar(destino, opciones);
      poner(g, caja(largo, 0.04, 0.18), m.metal, 0, 0.02, 0);
      poner(g, caja(largo, 0.03, 0.06), m.acento ?? m.claro, 0, 0.045, -0.03);
      return g;
    },

    /** Consola de supervisión: mueble largo con tres pantallas ambientales (no muestran datos). Largo en X. */
    consola(destino, m, opciones = {}) {
      const { largo = 1.8 } = opciones;
      const g = lugar(destino, opciones);
      poner(g, caja(largo, 0.06, 0.55), m.madera, 0, 0.72, 0);
      poner(g, caja(largo - 0.1, 0.68, 0.45), m.maderaOscura, 0, 0.35, -0.03);
      poner(g, caja(largo - 0.2, 0.04, 0.02), m.acento ?? m.claro, 0, 0.5, 0.2);
      const pics = ["mosaico", "historial", "red"];
      [-1, 0, 1].forEach((i, k) => {
        const p = this.pantallaAmbiente(g, m, { x: i * (largo / 3.1), y: 1.0, z: -0.12, ancho: 0.5, alto: 0.3, pictograma: pics[k] });
        p.rotation.y = -i * 0.25;
      });
      return g;
    },

    /** Pila de papeles en un escritorio. */
    papeles(destino, m, opciones = {}) {
      const g = lugar(destino, opciones);
      poner(g, caja(0.22, 0.04, 0.3), m.claro, 0, 0.02, 0);
      return g;
    },
  };
}
