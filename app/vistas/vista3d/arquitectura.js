// Arquitectura del edificio: losa, pasillos, muros exteriores con ventanas, columnas, recepción,
// señalización en el pasillo y reloj. Todo es decoración, salvo el letrero de la recepción, que
// repite datos del modelo (proyecto, REAL/DEMO y conexión). Aquí no hay personas: la recepción
// no tiene recepcionista para que nada parezca trabajo sin evidencia.

import * as THREE from "three";
import { OFICINA, COLOR_ESTADO } from "./paleta.js";
import { puerta } from "./disposicion.js";
import { dibujarIcono, hex } from "./iconos.js";
import { fusionarEstaticos } from "./oficina.js";
import { crearMobiliario } from "./mobiliario.js";
import { estiloDe } from "./identidad.js";

const ALTO_EXTERIOR = 2.1;
const VENTANA = { abajo: 0.75, arriba: 1.75, ancho: 1.6, pilar: 0.45 };

/**
 * @param plano     resultado de distribuirEdificio
 * @param cuartos   [{ id, nombre, tema, acento, x, z, ancho, fondo }]
 */
export function crearArquitectura(plano, cuartos, recursos, { mob = null, proyecto = null } = {}) {
  mob ??= crearMobiliario(recursos);
  const estilo = estiloDe(proyecto);
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
    remate: M(COLOR_IDENTIDAD), // color de identidad del proyecto (se cambia en actualizar)
    columna: M(0x283252),
    madera: M(OFICINA.madera),
    maderaOscura: M(OFICINA.maderaOscura),
    sofa: M(0x5a6fa8),
    maceta: M(OFICINA.maceta),
    hojas: M(OFICINA.planta),
    tapete: M(0x2a3150),
    metal: M(OFICINA.metal),
    silla: M(OFICINA.silla),
    claro: M(0xdfe4ee),
    vidrio: recursos.agregar(new THREE.MeshLambertMaterial({ color: OFICINA.vidrio, transparent: true, opacity: 0.18, depthWrite: false })),
  };
  m.remate.userData.vivo = true; // cambia al color de identidad del proyecto: no se fusiona por color de vértice
  m.planta = m.hojas;
  m.marco = m.columna;
  m.acento = m.remate; // color de identidad del proyecto (cambia en actualizar)
  m.pantallaLampara = M(0xffe6b8);
  // Las ventanas muestran el color del cielo según la hora (iluminacion.js): no se fusionan con lo demás.
  const matVentana = recursos.agregar(new THREE.MeshBasicMaterial({ color: OFICINA.vidrio }));
  const luzPasillo = recursos.agregar(new THREE.MeshBasicMaterial({ color: OFICINA.brillo }));

  // Losa, piso general y piso de la recepción.
  poner(caja(W + E * 2, 0.4, F + E * 2), m.losa, 0, -0.25, 0);
  poner(caja(W + 0.6, 0.04, F + 0.6), m.pasillo, 0, -0.06, 0);
  const r = plano.recepcion;
  if (r) {
    // Fase L: piso de baldosa con los tonos del estilo del proyecto (una textura chica que se repite).
    const geoR = caja(r.ancho, 0.04, r.fondo);
    const uvR = geoR.attributes.uv;
    for (let i = 0; i < uvR.count; i++) uvR.setXY(i, uvR.getX(i) * r.ancho / 1.6, uvR.getY(i) * r.fondo / 1.6);
    const matBaldosa = recursos.agregar(new THREE.MeshLambertMaterial({ map: recursos.agregar(texturaBaldosa(estilo)) }));
    poner(geoR, matBaldosa, r.x, -0.035, r.z);
  }

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
  // Fase L: entrada principal: puertas de cristal abiertas, marquesina baja con el nombre del proyecto y una luz
  // con el estado de conexión (el mismo dato del modelo; no indica actividad).
  const ex = (entrada.desde + entrada.hasta) / 2, ez = F / 2 + 0.5;
  for (const lado of [-1, 1]) mob.divisionCristal(grupo, m, { x: ex + lado * 1.15, z: ez, largo: 0.5, alto: 1.1 });
  for (const lado of [-1, 1]) poner(caja(0.12, 1.25, 0.12), m.columna, ex + lado * 1.45, 0.625, ez + 0.9);
  poner(caja(3.3, 0.08, 1.15), m.muro, ex, 1.29, ez + 0.45);
  poner(caja(3.36, 0.06, 0.06), m.remate, ex, 1.24, ez + 1.03);
  let marquesina = null;
  {
    marquesina = crearLetreroMarquesina(recursos);
    marquesina.malla.position.set(ex, 1.5, ez + 0.95);
    marquesina.malla.userData.dinamico = true;
    grupo.add(marquesina.malla);
  }

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
  let directorio = null;
  let emblema = null;
  if (r) {
    const fondoZ = r.z - r.fondo / 2 + 0.35;
    poner(caja(Math.min(r.ancho - 1, 6), 1.6, 0.25), m.muro, r.x, 0.8, fondoZ);
    poner(caja(Math.min(r.ancho - 1, 6) + 0.1, 0.08, 0.3), m.remate, r.x, 1.64, fondoZ);
    // Mostrador en L (catálogo, fase L) con franja del color de identidad. Sin recepcionista.
    mob.mostrador(grupo, m, { x: r.x, z: r.z - 0.1 });
    mob.laptop(grupo, m, { x: r.x + 0.5, y: 0.81, z: r.z - 0.2, abierta: false });
    // Sala de espera a la derecha
    const sx = r.x + Math.min(r.ancho / 2 - 1.6, 4.2);
    mob.sofa(grupo, m, { x: sx, z: r.z + 0.9 });
    poner(caja(0.9, 0.3, 0.5), m.maderaOscura, sx, 0.15, r.z + 0.1);
    mob.planta(grupo, m, { x: r.x - r.ancho / 2 + 0.6, z: r.z - r.fondo / 2 + 0.6, tam: "alta" });
    mob.planta(grupo, m, { x: r.x + r.ancho / 2 - 0.6, z: r.z - r.fondo / 2 + 0.6, tam: "alta" });
    mob.lampara(grupo, m, { x: sx + 1.2, z: r.z + 1.1 });
    // Fase L: espacios con función reconocible si la recepción es ancha: sala de juntas (izquierda, cristal y
    // sillas vacías), cocineta (derecha) y un mueble del estilo del proyecto. Nadie los ocupa.
    agregarEspaciosRecepcion(grupo, mob, m, r, estilo, poner, caja);

    letrero = crearLetreroRecepcion(recursos);
    letrero.malla.position.set(r.x, 1.0, fondoZ + 0.13);
    letrero.malla.userData.dinamico = true;
    grupo.add(letrero.malla);
    // Fase K: directorio del piso (totem con pantalla) y emblema del proyecto en el piso de la recepción.
    const tx = r.x - r.ancho / 2 + 1.3, tz = r.z + r.fondo / 2 - 1.2;
    poner(caja(0.7, 0.06, 0.4), m.metal, tx, 0.03, tz);
    poner(caja(0.1, 0.5, 0.1), m.metal, tx, 0.3, tz);
    directorio = crearDirectorio(recursos);
    directorio.malla.position.set(tx, 1.4, tz);
    directorio.malla.rotation.y = Math.PI / 4; // de frente a la cámara isométrica
    directorio.malla.userData.dinamico = true;
    grupo.add(directorio.malla);
    emblema = crearEmblema(recursos);
    emblema.malla.position.set(r.x + 0.6, 0.008, r.z + 1.4);
    emblema.malla.userData.dinamico = true;
    grupo.add(emblema.malla);
    reloj = crearReloj(recursos, m.metal);
    reloj.grupo.position.set(r.x + Math.min(r.ancho - 1, 6) / 2 - 0.6, 1.25, fondoZ + 0.14);
    grupo.add(reloj.grupo);
  }

  // Señalización: placa en el piso frente a la puerta de cada departamento (una textura para todas).
  if (cuartos.length) grupo.add(crearPlacas(cuartos, recursos));
  // Fase L: charcos de luz cálida en pasillos y recepción (un plano con degradado, sin luces reales: una sola
  // llamada de dibujo para todos). Ambientación: no cambia con la actividad.
  const charcos = [];
  for (const p of plano.pasillos) for (let x = -p.ancho / 2 + 3; x < p.ancho / 2 - 1; x += 6) charcos.push([x, p.z, 2.6]);
  if (r) for (const dx of [-1, 0, 1]) if (Math.abs(dx) * 5 < r.ancho / 2 - 1) charcos.push([r.x + dx * 5, r.z + 0.6, 3.4]);
  if (charcos.length) grupo.add(crearCharcosLuz(charcos, recursos));

  fusionarEstaticos(grupo, recursos);

  return {
    grupo,
    actualizar(modelo) {
      const color = modelo.proyecto.color ?? null;
      m.remate.color.set(color ?? COLOR_IDENTIDAD);
      letrero?.dibujar(modelo);
      directorio?.dibujar(modelo);
      emblema?.dibujar(modelo);
      marquesina?.dibujar(modelo);
    },
    paso() { reloj?.mover(new Date()); },
    // Fase L: la marquesina repite nombre y conexión del modelo (y se redibuja solo si cambian).
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
    // Fase L: número del departamento (la misma tecla 1–9 que lo enfoca).
    const numero = i < 9 ? `${i + 1} · ` : "";
    let nombre = c.nombre;
    while (nombre.length > 1 && ctx.measureText(numero + nombre).width > 370) nombre = nombre.slice(0, -2) + "…";
    ctx.fillText(numero + nombre, 124, y0 + filaAlto / 2);

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

const COLOR_IDENTIDAD = 0xe0a458; // ámbar: el color de siempre si el registro no da uno

/**
 * Directorio del piso (fase K): pantalla en la recepción con cada departamento, su estado (los mismos colores
 * que el resto) y sus alertas. Solo repite el modelo de vista; con datos no vigentes todo se ve «sin información».
 */
function crearDirectorio(recursos) {
  const lienzo = document.createElement("canvas");
  lienzo.width = 512;
  lienzo.height = 640;
  const ctx = lienzo.getContext("2d");
  const textura = recursos.agregar(new THREE.CanvasTexture(lienzo));
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.anisotropy = 4;
  const malla = new THREE.Mesh(recursos.agregar(new THREE.PlaneGeometry(1.6, 2.0)),
    recursos.agregar(new THREE.MeshBasicMaterial({ map: textura, toneMapped: false })));
  malla.name = "directorio";
  let clave = "";
  return {
    malla,
    dibujar(modelo) {
      const filas = modelo.departamentos.map((d) => [d.nombre, d.estado_resumen, d.alertas.length]);
      const origen = modelo.es_demo ? "DEMO" : modelo.generado_en ? "REAL" : "SIN DATOS";
      const nueva = JSON.stringify([origen, modelo.conexion, filas]);
      if (nueva === clave) return;
      clave = nueva;
      ctx.fillStyle = "#0b1020";
      ctx.fillRect(0, 0, 512, 640);
      ctx.strokeStyle = "#3a4568";
      ctx.lineWidth = 6;
      ctx.strokeRect(3, 3, 506, 634);
      ctx.fillStyle = "#e8ecf5";
      ctx.font = "bold 34px system-ui, sans-serif";
      ctx.textBaseline = "middle";
      ctx.fillText("DIRECTORIO", 28, 44);
      ctx.fillStyle = origen === "REAL" ? "#43c47a" : origen === "DEMO" ? "#ffb547" : "#8a94ad";
      ctx.font = "bold 26px system-ui, sans-serif";
      const ancho = ctx.measureText(origen).width;
      ctx.fillRect(484 - ancho - 16, 26, ancho + 16, 36);
      ctx.fillStyle = "#0b0f19";
      ctx.fillText(origen, 484 - ancho - 8, 45);
      ctx.fillStyle = "#a3adc4";
      ctx.font = "24px system-ui, sans-serif";
      ctx.fillText(modelo.conexion_etiqueta, 28, 88);
      const max = 9;
      filas.slice(0, max).forEach(([nombre, estado, alertas], i) => {
        const y = 140 + i * 54;
        ctx.fillStyle = hex(COLOR_ESTADO[estado] ?? COLOR_ESTADO.sin_datos);
        ctx.beginPath(); ctx.arc(42, y, 11, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#e8ecf5";
        ctx.font = "26px system-ui, sans-serif";
        let n = nombre;
        const limite = alertas ? 330 : 400;
        while (n.length > 1 && ctx.measureText(n).width > limite) n = n.slice(0, -2) + "…";
        ctx.fillText(n, 66, y);
        if (alertas) { ctx.fillStyle = "#ffb547"; ctx.font = "bold 24px system-ui, sans-serif"; ctx.fillText(`⚠ ${alertas}`, 420, y); }
      });
      if (filas.length > max) { ctx.fillStyle = "#a3adc4"; ctx.font = "22px system-ui, sans-serif"; ctx.fillText(`y ${filas.length - max} más…`, 66, 140 + max * 54); }
      if (filas.length === 0) { ctx.fillStyle = "#a3adc4"; ctx.font = "24px system-ui, sans-serif"; ctx.fillText("Sin departamentos conocidos", 28, 150); }
      textura.needsUpdate = true;
    },
  };
}

/** Emblema del proyecto en el piso de la recepción: iniciales en un círculo con su color de identidad. */
function crearEmblema(recursos) {
  const lienzo = document.createElement("canvas");
  lienzo.width = lienzo.height = 256;
  const ctx = lienzo.getContext("2d");
  const textura = recursos.agregar(new THREE.CanvasTexture(lienzo));
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.anisotropy = 4;
  const malla = new THREE.Mesh(recursos.agregar(new THREE.PlaneGeometry(2.2, 2.2).rotateX(-Math.PI / 2).rotateY(Math.PI / 4)),
    recursos.agregar(new THREE.MeshBasicMaterial({ map: textura, transparent: true, depthWrite: false, toneMapped: false })));
  malla.name = "emblema";
  let clave = "";
  return {
    malla,
    dibujar(modelo) {
      const color = modelo.proyecto.color ?? hex(COLOR_IDENTIDAD);
      const iniciales = modelo.proyecto.nombre.split(/[\s/-]+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("");
      const nueva = `${color}|${iniciales}`;
      if (nueva === clave) return;
      clave = nueva;
      ctx.clearRect(0, 0, 256, 256);
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = color;
      ctx.lineWidth = 12;
      ctx.beginPath(); ctx.arc(128, 128, 110, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(128, 128, 104, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.9;
      ctx.font = "bold 92px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(iniciales, 128, 134);
      ctx.globalAlpha = 1;
      textura.needsUpdate = true;
    },
  };
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
      const nueva = [modelo.proyecto.nombre, origen, modelo.conexion, modelo.proyecto.color ?? "", modelo.proyecto.estilo ?? ""].join("|");
      if (nueva === clave) return;
      clave = nueva;
      ctx.fillStyle = "#0f1526";
      ctx.fillRect(0, 0, 1024, 256);
      ctx.strokeStyle = modelo.proyecto.color ?? "#e0a458";
      ctx.lineWidth = 8;
      ctx.strokeRect(4, 4, 1016, 248);
      ctx.fillStyle = "#ffd89a";
      ctx.font = "bold 92px system-ui, sans-serif";
      ctx.textBaseline = "middle";
      ctx.fillText(recortarTexto(ctx, modelo.proyecto.nombre.toUpperCase(), 760), 48, 100);
      // Fase L: símbolo y etiqueta del estilo del proyecto (identidad del registro; no son datos).
      const est = estiloDe(modelo.proyecto);
      dibujarIcono(ctx, est.icono, 940, 96, 48, modelo.proyecto.color ?? "#e0a458");
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

function recortarTexto(ctx, texto, max) {
  let t = texto;
  while (t.length > 1 && ctx.measureText(t).width > max) t = t.slice(0, -2) + "…";
  return t;
}

/** Fase L: baldosa de la recepción (dos tonos del estilo y junta fina), 128 px que se repiten. */
function texturaBaldosa(estilo) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  const [a, b] = estilo.baldosa;
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { ctx.fillStyle = (i + j) % 2 ? b : a; ctx.fillRect(i * 64, j * 64, 64, 64); }
  ctx.strokeStyle = estilo.linea;
  ctx.lineWidth = 2;
  for (const k of [0, 64, 128]) { ctx.beginPath(); ctx.moveTo(k, 0); ctx.lineTo(k, 128); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, k); ctx.lineTo(128, k); ctx.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Fase L: charcos de luz (planos con degradado radial, suma de color). Todos en una sola malla. */
function crearCharcosLuz(lista, recursos) {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(32, 32, 1, 32, 32, 32);
  g.addColorStop(0, "rgba(255,214,150,0.55)");
  g.addColorStop(1, "rgba(255,214,150,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const textura = recursos.agregar(new THREE.CanvasTexture(c));
  const geos = lista.map(([x, z, d]) => new THREE.PlaneGeometry(d, d).rotateX(-Math.PI / 2).translate(x, 0.003, z));
  const malla = new THREE.Mesh(recursos.agregar(mergeSimple(geos)), recursos.agregar(new THREE.MeshBasicMaterial({
    map: textura, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.32, toneMapped: false,
  })));
  malla.userData.dinamico = true;
  malla.renderOrder = 1;
  malla.name = "charcos-luz";
  return malla;
}

/**
 * Fase L: espacios de la recepción con función reconocible (solo si caben). Todos vacíos: sin personas.
 *   sala de juntas  mesa con sillas detrás de una división de cristal, a la izquierda
 *   cocineta        barra con garrafón y plantas, a la derecha
 *   mueble del estilo  exhibidor (comercial), archiveros y caja fuerte (financiero) o barra con frutero (alimentos)
 */
function agregarEspaciosRecepcion(grupo, mob, m, r, estilo, poner, caja) {
  const izq = r.x - r.ancho / 2, der = r.x + r.ancho / 2;
  if (r.ancho >= 14) {
    const jx = izq + 4.2, jz = r.z - 0.2;
    mob.mesaReuniones(grupo, m, { x: jx, z: jz, largo: 2.2, sillas: 3 });
    mob.divisionCristal(grupo, m, { x: jx + 2.1, z: jz, rot: Math.PI / 2, largo: 3.2, alto: 0.9 });
    mob.divisionCristal(grupo, m, { x: jx, z: jz - 1.7, largo: 4.0, alto: 0.9 });
    mob.planta(grupo, m, { x: jx - 1.6, z: jz - 1.2, tam: "media" });
  }
  if (r.ancho >= 20) {
    const cx = der - 3.2, cz = r.z - r.fondo / 2 + 0.75;
    poner(caja(2.2, 0.85, 0.6), m.maderaOscura, cx, 0.425, cz);
    poner(caja(2.3, 0.05, 0.66), m.claro, cx, 0.875, cz);
    mob.garrafon(grupo, m, { x: cx + 1.5, z: cz });
    mob.planta(grupo, m, { x: cx - 0.7, y: 0.9, z: cz, tam: "baja" });
  }
  // Mueble del estilo, frente a la sala de espera (no tapa el directorio ni la entrada).
  const ex = r.x + Math.min(r.ancho / 2 - 1.2, 6.4), ez = r.z - r.fondo / 2 + 0.6;
  if (estilo.icono === "comercial") mob.estanteria(grupo, m, { x: ex, z: ez, ancho: 1.4, colores: [m.acento, m.claro, m.sofa ?? m.claro] });
  else if (estilo.icono === "financiero") { mob.archivero(grupo, m, { x: ex - 0.5, z: ez, cajones: 3 }); poner(caja(0.6, 0.7, 0.55), m.columna, ex + 0.25, 0.35, ez); poner(caja(0.12, 0.12, 0.02), m.acento, ex + 0.25, 0.42, ez + 0.285); }
  else if (estilo.icono === "alimentos") { poner(caja(1.4, 0.85, 0.5), m.maderaOscura, ex, 0.425, ez); poner(caja(0.34, 0.06, 0.34), m.claro, ex - 0.3, 0.88, ez); poner(caja(0.22, 0.12, 0.22), m.acento, ex + 0.3, 0.91, ez); }
}

/** Fase L: letrero de la marquesina de la entrada: nombre del proyecto y una luz con el estado de conexión. */
function crearLetreroMarquesina(recursos) {
  const lienzo = document.createElement("canvas");
  lienzo.width = 512;
  lienzo.height = 96;
  const ctx = lienzo.getContext("2d");
  const textura = recursos.agregar(new THREE.CanvasTexture(lienzo));
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.anisotropy = 4;
  const malla = new THREE.Mesh(recursos.agregar(new THREE.PlaneGeometry(3.0, 0.56)),
    recursos.agregar(new THREE.MeshBasicMaterial({ map: textura, toneMapped: false })));
  malla.name = "marquesina";
  let clave = "";
  return {
    malla,
    dibujar(modelo) {
      const nueva = [modelo.proyecto.nombre, modelo.proyecto.color ?? "", modelo.conexion, modelo.es_demo].join("|");
      if (nueva === clave) return;
      clave = nueva;
      ctx.fillStyle = "#0f1526";
      ctx.fillRect(0, 0, 512, 96);
      ctx.fillStyle = modelo.proyecto.color ?? "#e0a458";
      ctx.fillRect(0, 88, 512, 8);
      // Luz de conexión: verde en línea, ámbar desactualizado, gris sin conexión (dato del modelo).
      ctx.fillStyle = modelo.conexion === "en_linea" ? "#43c47a" : modelo.conexion === "desactualizado" ? "#ffb547" : "#8a94ad";
      ctx.beginPath(); ctx.arc(40, 46, 16, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ffd89a";
      ctx.font = "bold 50px system-ui, sans-serif";
      ctx.textBaseline = "middle";
      ctx.fillText(recortarTexto(ctx, modelo.proyecto.nombre.toUpperCase(), modelo.es_demo ? 300 : 420), 72, 48);
      if (modelo.es_demo) {
        ctx.fillStyle = "#ffb547"; ctx.fillRect(392, 22, 108, 50);
        ctx.fillStyle = "#1a1200"; ctx.font = "bold 34px system-ui, sans-serif"; ctx.fillText("DEMO", 402, 48);
      }
      textura.needsUpdate = true;
    },
  };
}
