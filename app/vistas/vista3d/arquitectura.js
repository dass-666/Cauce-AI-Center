// Arquitectura del edificio: losa, pasillos, muros exteriores con ventanas, columnas, recepción,
// señalización en el pasillo y reloj. Todo es decoración, salvo el letrero de la recepción, que
// repite datos del modelo (proyecto, REAL/DEMO y conexión). Aquí no hay personas: la recepción
// no tiene recepcionista para que nada parezca trabajo sin evidencia.

import * as THREE from "three";
import { OFICINA } from "./paleta.js";
import { puerta } from "./disposicion.js";
import { dibujarIcono, hex } from "./iconos.js";
import { fusionarEstaticos } from "./oficina.js";

const ALTO_EXTERIOR = 2.1;
const VENTANA = { abajo: 0.75, arriba: 1.75, ancho: 1.6, pilar: 0.45 };

/**
 * @param plano     resultado de distribuirEdificio
 * @param cuartos   [{ id, nombre, tema, acento, x, z, ancho, fondo }]
 */
export function crearArquitectura(plano, cuartos, recursos) {
  const grupo = new THREE.Group();
  const M = (color, extra = {}) => recursos.agregar(new THREE.MeshLambertMaterial({ color, ...extra }));
  const caja = (w, h, d) => recursos.agregar(new THREE.BoxGeometry(w, h, d));
  const poner = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); grupo.add(m); return m; };
  const W = plano.ancho, F = plano.fondo, E = 1.2;

  const m = {
    losa: M(OFICINA.base),
    pasillo: M(0x3a4258),
    recepcion: M(0x4a5474),
    muro: M(0x323d60),
    remate: M(0xe0a458),
    columna: M(0x283252),
    madera: M(OFICINA.madera),
    maderaOscura: M(OFICINA.maderaOscura),
    sofa: M(0x5a6fa8),
    maceta: M(OFICINA.maceta),
    hojas: M(OFICINA.planta),
    tapete: M(0x2a3150),
    metal: M(OFICINA.metal),
  };
  // Las ventanas muestran el color del cielo según la hora (iluminacion.js): no se fusionan con lo demás.
  const matVentana = recursos.agregar(new THREE.MeshBasicMaterial({ color: OFICINA.vidrio }));
  const luzPasillo = recursos.agregar(new THREE.MeshBasicMaterial({ color: OFICINA.brillo }));

  // Losa, piso general y piso de la recepción.
  poner(caja(W + E * 2, 0.4, F + E * 2), m.losa, 0, -0.25, 0);
  poner(caja(W + 0.6, 0.04, F + 0.6), m.pasillo, 0, -0.06, 0);
  const r = plano.recepcion;
  if (r) poner(caja(r.ancho, 0.04, r.fondo), m.recepcion, r.x, -0.035, r.z);

  // Muros exteriores al fondo (-Z) y a la izquierda (-X), con una banda de ventanas.
  const xFondo = -F / 2 - 0.5, xIzq = -W / 2 - 0.5;
  muroConVentanas({ largo: W + 1.2, centro: [0, xFondo], eje: "x" });
  muroConVentanas({ largo: F + 1.2, centro: [xIzq, 0], eje: "z" });
  function muroConVentanas({ largo, centro: [cx, cz], eje }) {
    const t = 0.22;
    const geo = (l, h) => (eje === "x" ? caja(l, h, t) : caja(t, h, l));
    const en = (a, y, b = 0) => (eje === "x" ? [cx + a, y, cz + b] : [cx + b, y, cz + a]);
    poner(geo(largo, VENTANA.abajo), m.muro, ...en(0, VENTANA.abajo / 2));
    poner(geo(largo, ALTO_EXTERIOR - VENTANA.arriba), m.muro, ...en(0, (ALTO_EXTERIOR + VENTANA.arriba) / 2));
    poner(geo(largo + 0.1, 0.08), m.remate, ...en(0, ALTO_EXTERIOR + 0.04));
    const altoV = VENTANA.arriba - VENTANA.abajo;
    poner(eje === "x" ? caja(largo, altoV, 0.04) : caja(0.04, altoV, largo), matVentana, ...en(0, VENTANA.abajo + altoV / 2));
    const paso = VENTANA.ancho + VENTANA.pilar;
    const n = Math.floor(largo / paso);
    for (let i = 0; i <= n; i++) {
      const a = -largo / 2 + (largo - n * paso) / 2 + i * paso;
      poner(geo(VENTANA.pilar, altoV), m.muro, ...en(a, VENTANA.abajo + altoV / 2));
    }
  }
  // Columnas en las esquinas (altas al fondo, bajas al frente para no tapar la vista).
  for (const [x, z, alto] of [[xIzq, xFondo, ALTO_EXTERIOR + 0.2], [W / 2 + 0.5, xFondo, ALTO_EXTERIOR + 0.2], [xIzq, F / 2 + 0.5, ALTO_EXTERIOR + 0.2], [W / 2 + 0.5, F / 2 + 0.5, 0.5]]) {
    poner(caja(0.45, alto, 0.45), m.columna, x, alto / 2, z);
  }
  // Pretil bajo al frente y a la derecha, con la entrada frente a la recepción.
  const entrada = r ? { desde: r.x - 1.4, hasta: r.x + 1.4 } : { desde: -1.4, hasta: 1.4 };
  for (const [a, b] of [[-W / 2 - 0.5, entrada.desde], [entrada.hasta, W / 2 + 0.5]]) {
    if (b - a > 0.1) poner(caja(b - a, 0.25, 0.18), m.muro, (a + b) / 2, 0.125, F / 2 + 0.5);
  }
  poner(caja(0.18, 0.25, F + 1.0), m.muro, W / 2 + 0.5, 0.125, 0);
  poner(caja(2.4, 0.02, 1.0), m.tapete, (entrada.desde + entrada.hasta) / 2, 0.0, F / 2 + 0.3);

  // Pasillos: tira de luz y plantas en los extremos.
  const geoMaceta = caja(0.38, 0.4, 0.38);
  const geoHojas = recursos.agregar(new THREE.IcosahedronGeometry(0.38, 0));
  const planta = (x, z) => { poner(geoMaceta, m.maceta, x, 0.2, z); poner(geoHojas, m.hojas, x, 0.66, z); };
  for (const p of plano.pasillos) {
    poner(caja(p.ancho - 1, 0.02, 0.12), luzPasillo, p.x, -0.03, p.z);
    planta(-p.ancho / 2 - 0.1, p.z);
    planta(p.ancho / 2 + 0.1, p.z);
  }

  // Recepción: mostrador, muro con el letrero del proyecto, sala de espera y plantas. Sin personas.
  let letrero = null;
  let reloj = null;
  if (r) {
    const fondoZ = r.z - r.fondo / 2 + 0.35;
    poner(caja(Math.min(r.ancho - 1, 6), 1.6, 0.25), m.muro, r.x, 0.8, fondoZ);
    poner(caja(Math.min(r.ancho - 1, 6) + 0.1, 0.08, 0.3), m.remate, r.x, 1.64, fondoZ);
    // Mostrador en L
    poner(caja(2.6, 0.75, 0.6), m.maderaOscura, r.x, 0.375, r.z - 0.1);
    poner(caja(2.7, 0.06, 0.7), m.madera, r.x, 0.78, r.z - 0.1);
    poner(caja(0.6, 0.75, 1.2), m.maderaOscura, r.x - 1.6, 0.375, r.z - 0.4);
    // Sala de espera a la derecha
    const sx = r.x + Math.min(r.ancho / 2 - 1.6, 4.2);
    poner(caja(1.8, 0.35, 0.7), m.sofa, sx, 0.2, r.z + 0.9);
    poner(caja(1.8, 0.45, 0.18), m.sofa, sx, 0.45, r.z + 1.2);
    poner(caja(0.9, 0.3, 0.5), m.maderaOscura, sx, 0.15, r.z + 0.1);
    planta(r.x - r.ancho / 2 + 0.6, r.z - r.fondo / 2 + 0.6);
    planta(r.x + r.ancho / 2 - 0.6, r.z - r.fondo / 2 + 0.6);

    letrero = crearLetreroRecepcion(recursos);
    letrero.malla.position.set(r.x, 1.0, fondoZ + 0.13);
    letrero.malla.userData.dinamico = true;
    grupo.add(letrero.malla);
    reloj = crearReloj(recursos, m.metal);
    reloj.grupo.position.set(r.x + Math.min(r.ancho - 1, 6) / 2 - 0.6, 1.25, fondoZ + 0.14);
    grupo.add(reloj.grupo);
  }

  // Señalización: placa en el piso frente a la puerta de cada departamento (una textura para todas).
  if (cuartos.length) grupo.add(crearPlacas(cuartos, recursos));

  fusionarEstaticos(grupo, recursos);

  return {
    grupo,
    actualizar(modelo) { letrero?.dibujar(modelo); },
    paso() { reloj?.mover(new Date()); },
    aplicarLuz(luz) { matVentana.color.setHex(luz.ventana); },
  };
}

/** Todas las placas comparten una textura (una fila por departamento) y se dibujan en una sola llamada. */
function crearPlacas(cuartos, recursos) {
  const filaAlto = 128;
  const lienzo = document.createElement("canvas");
  lienzo.width = 512;
  lienzo.height = filaAlto * cuartos.length;
  const ctx = lienzo.getContext("2d");
  const geos = [];
  cuartos.forEach((c, i) => {
    const y0 = i * filaAlto;
    ctx.fillStyle = "#151c30";
    ctx.fillRect(0, y0, 512, filaAlto);
    ctx.fillStyle = hex(c.acento);
    ctx.fillRect(0, y0, 14, filaAlto);
    dibujarIcono(ctx, c.tema, 74, y0 + filaAlto / 2, 38, hex(c.acento));
    ctx.fillStyle = "#e8ecf5";
    ctx.font = "bold 40px system-ui, sans-serif";
    ctx.textBaseline = "middle";
    let nombre = c.nombre;
    while (nombre.length > 1 && ctx.measureText(nombre).width > 380) nombre = nombre.slice(0, -2) + "…";
    ctx.fillText(nombre, 124, y0 + filaAlto / 2);

    const g = new THREE.PlaneGeometry(2.0, 0.5).rotateX(-Math.PI / 2);
    const uv = g.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setY(k, 1 - (i + 1 - uv.getY(k)) / cuartos.length);
    const p = puerta(c);
    g.translate(c.x + p.x + 0.5, 0.012, c.z + c.fondo / 2 + 0.55);
    geos.push(g);
  });
  const textura = recursos.agregar(new THREE.CanvasTexture(lienzo));
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.anisotropy = 4;
  const geo = recursos.agregar(mergeSimple(geos));
  const malla = new THREE.Mesh(geo, recursos.agregar(new THREE.MeshBasicMaterial({ map: textura, toneMapped: false })));
  malla.userData.dinamico = true; // ya está unida; no hace falta volver a fusionarla
  return malla;
}

function mergeSimple(geos) {
  const pos = [], uv = [], idx = [];
  let base = 0;
  for (const g of geos) {
    pos.push(...g.attributes.position.array);
    uv.push(...g.attributes.uv.array);
    idx.push(...Array.from(g.index.array, (n) => n + base));
    base += g.attributes.position.count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  out.setIndex(idx);
  return out;
}

/** Letrero de la recepción: proyecto, REAL o DEMO, y conexión (datos del modelo). */
function crearLetreroRecepcion(recursos) {
  const lienzo = document.createElement("canvas");
  lienzo.width = 1024;
  lienzo.height = 256;
  const ctx = lienzo.getContext("2d");
  const textura = recursos.agregar(new THREE.CanvasTexture(lienzo));
  textura.colorSpace = THREE.SRGBColorSpace;
  const malla = new THREE.Mesh(recursos.agregar(new THREE.PlaneGeometry(4.0, 1.0)),
    recursos.agregar(new THREE.MeshBasicMaterial({ map: textura, toneMapped: false })));
  let clave = "";
  return {
    malla,
    dibujar(modelo) {
      const origen = modelo.es_demo ? "demo" : modelo.generado_en ? "real" : "sin";
      const nueva = [modelo.proyecto.nombre, origen, modelo.conexion].join("|");
      if (nueva === clave) return;
      clave = nueva;
      ctx.fillStyle = "#0f1526";
      ctx.fillRect(0, 0, 1024, 256);
      ctx.strokeStyle = "#e0a458";
      ctx.lineWidth = 8;
      ctx.strokeRect(4, 4, 1016, 248);
      ctx.fillStyle = "#ffd89a";
      ctx.font = "bold 92px system-ui, sans-serif";
      ctx.textBaseline = "middle";
      ctx.fillText(modelo.proyecto.nombre.toUpperCase(), 48, 100);
      // "REAL" solo si llegó un archivo real; sin archivo, "SIN DATOS".
      const caja = { real: ["#43c47a", "REAL", 150], demo: ["#ffb547", "DEMO", 150], sin: ["#8a94ad", "SIN DATOS", 250] }[origen];
      ctx.fillStyle = caja[0];
      ctx.fillRect(48, 168, caja[2], 56);
      ctx.fillStyle = "#0b0f19";
      ctx.font = "bold 40px system-ui, sans-serif";
      ctx.fillText(caja[1], 62, 197);
      ctx.fillStyle = modelo.conexion === "en_linea" ? "#a3adc4" : "#ffb547";
      ctx.font = "36px system-ui, sans-serif";
      ctx.fillText(modelo.conexion_etiqueta, caja[2] + 72, 197);
      textura.needsUpdate = true;
    },
  };
}

/** Reloj de pared con la hora local de la computadora (decoración). */
function crearReloj(recursos, matMetal) {
  const grupo = new THREE.Group();
  grupo.userData.dinamico = true;
  const cara = new THREE.Mesh(recursos.agregar(new THREE.CircleGeometry(0.28, 24)), recursos.agregar(new THREE.MeshBasicMaterial({ color: 0xe8ecf5 })));
  const aro = new THREE.Mesh(recursos.agregar(new THREE.RingGeometry(0.28, 0.32, 24)), matMetal);
  const manecilla = (largo, ancho) => {
    const g = recursos.agregar(new THREE.PlaneGeometry(ancho, largo).translate(0, largo / 2, 0.005));
    return new THREE.Mesh(g, recursos.agregar(new THREE.MeshBasicMaterial({ color: 0x0f1526 })));
  };
  const horas = manecilla(0.15, 0.04), minutos = manecilla(0.23, 0.025);
  grupo.add(cara, aro, horas, minutos);
  let ultimo = -1;
  return {
    grupo,
    mover(fecha) {
      const min = fecha.getHours() * 60 + fecha.getMinutes();
      if (min === ultimo) return;
      ultimo = min;
      minutos.rotation.z = -(min % 60) / 60 * Math.PI * 2;
      horas.rotation.z = -(min % 720) / 720 * Math.PI * 2;
    },
  };
}
