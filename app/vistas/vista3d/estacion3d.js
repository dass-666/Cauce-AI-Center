// Estación de trabajo 3D dentro de un cuarto que ya existe (estaciones.js decide los estados; aquí solo se dibuja).
//
// Una mesa larga con un asiento por función, monitores, un panel trasero con dos pantallas ambientales (pictogramas
// sin cifras, nunca cambian con los datos), un tablero grande con el estado de cada función y el indicador del
// enlace con la otra oficina. Todo lo que no cambia se fusiona con el cuarto (fusionarEstaticos de oficina.js):
// las llamadas de dibujo nuevas son el tablero, UNA malla para las pantallas y la luz del enlace, y los personajes
// (cuerpo e icono; sin anillo de estado).
//
// Los personajes representan FUNCIONES, no agentes de IA: su postura sale de ESTADOS_ESTACION (consulta, espera,
// pide atención; solo teclean con un proceso en curso con evidencia). Sin datos vigentes, sillas vacías.

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { Personaje } from "./personaje.js";
import { ESTADOS_ESTACION } from "../../nucleo/estaciones.js";

const ALTO = 0.6; // alto del escritorio (mobiliario.js)
const ANCHO_TABLERO = 2.8; // m; con el lienzo 4:1 queda de 0.7 m de alto: cabe en la cara del panel (0.75 m)
const PANTALLA_APAGADA = 0x1a2233;
// demo: «confirmada» solo entre dos archivos de demostración: color de DEMO, nunca el azul de una transferencia real.
const COLOR_ENLACE = { confirmado: 0x5fd0e0, demo: 0xc98f2e, sin_confirmar: 0x8a7440, ninguno: 0x3a4152, sin_dato: 0x3a4152 };
// Pictogramas ambientales por equipo (estilo-visual.js): decoración que dice «qué tipo de trabajo», no «qué pasa».
const PICTOS = { observatorio: ["curva", "mapa"], comercio: ["mapa", "comparar"] };

/** Puesto visual a apariencia de personaje (el «agente» que entiende Personaje). */
function comoAgente(p) {
  return { id: p.clave, estado: p.estado, apariencia: { animacion3d: p.apariencia.animacion3d } };
}

/**
 * @param destino   grupo del cuarto
 * @param est       estación del modelo de vista (estaciones.js › construirEstaciones)
 * @param lugar     disposicion.js › lugaresEstaciones (z de la mesa y asientos)
 * @param ctx       { mob, m, recursos, compartido, cuarto, todos }
 */
export function crearEstacion3D(destino, est, lugar, ctx) {
  const { mob, m, recursos, compartido, cuarto, todos } = ctx;
  const grupo = new THREE.Group();
  grupo.name = `estacion-${est.id}`;
  grupo.position.set(lugar.x, 0, lugar.z);
  destino.add(grupo);
  const ancho = lugar.ancho;
  const equipo = est.equipo ?? "observatorio";

  // --- Mueble (estático: se fusiona con el cuarto) ---
  mob.escritorio(grupo, m, { ancho, fondo: 0.78, z: -0.02 });
  // Panel trasero bajo (no tapa los escritorios de atrás) con remate del color del departamento.
  const panel = new THREE.Mesh(mob.caja(ancho, 0.75, 0.06), m.maderaOscura);
  panel.position.set(0, ALTO + 0.375, -0.44);
  const remate = new THREE.Mesh(mob.caja(ancho + 0.04, 0.04, 0.09), m.acento);
  remate.position.set(0, ALTO + 0.77, -0.44);
  grupo.add(panel, remate);
  // Dos pantallas ambientales en el panel (entre asientos): siempre las mismas, sin cifras.
  const pics = PICTOS[equipo] ?? PICTOS.observatorio;
  // A los lados del tablero (que ocupa el centro del panel).
  const lado = Math.min(ANCHO_TABLERO, ancho - 1.2) / 2 + (ancho / 2 - Math.min(ANCHO_TABLERO, ancho - 1.2) / 2) / 2;
  const xs = [-lado, lado];
  xs.forEach((x, i) => mob.pantallaAmbiente(grupo, m, { x, y: ALTO + 0.42, z: -0.405, ancho: 0.42, alto: 0.24, pictograma: pics[i % pics.length] }));
  // Un objeto propio en el extremo izquierdo: globo (comercio internacional) o mapa de pie (observatorio).
  const ext = lugar.extremo.x - lugar.x;
  if (equipo === "comercio") mob.globo(grupo, m, { x: ext + 0.1, z: -0.1 });
  else mob.estacionPie(grupo, m, { x: ext, z: -0.1, rot: 0.3, pictograma: "mapa" });

  // --- Por asiento: monitor y teclado, documentos y silla (estáticos) ---
  lugar.asientos.forEach((a, i) => {
    const g = new THREE.Group();
    g.position.set(a.x - lugar.x, 0, 0);
    grupo.add(g);
    mob.monitorYTeclado(g, m);
    mob.papeles(g, m, { x: i % 2 ? 0.42 : -0.42, y: ALTO + 0.025, z: 0.12, rot: i % 2 ? -0.25 : 0.2 });
    mob.silla(g, m, { z: 0.75 });
  });
  // Pantallas de los monitores: UNA malla con un color por pantalla (color de vértice). Cambiar de estado solo
  // reescribe 4 colores por pantalla: una llamada de dibujo por estación en vez de una por asiento.
  // La luz del enlace con la otra oficina va en la misma malla (un cubo chico en el extremo derecho de la mesa):
  // encendida solo con una transferencia confirmada por las dos partes.
  const piezas = lugar.asientos.map((a) => new THREE.PlaneGeometry(0.56, 0.32).translate(a.x - lugar.x, ALTO + 0.33, -0.157));
  const verticesPantallas = piezas.length * 4;
  if (est.enlace) piezas.push(new THREE.BoxGeometry(0.1, 0.12, 0.1).translate(ancho / 2 - 0.15, ALTO + 0.09, 0.2));
  const geoPantallas = recursos.agregar(mergeGeometries(piezas));
  for (const p of piezas) p.dispose();
  const colores = new Float32Array(geoPantallas.attributes.position.count * 3);
  geoPantallas.setAttribute("color", new THREE.BufferAttribute(colores, 3));
  const matPantallas = compartido.matPantallasEstacion ?? recursos.agregar(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
  const pantallas = new THREE.Mesh(geoPantallas, matPantallas);
  pantallas.userData.dinamico = true;
  pantallas.userData.seleccion = { tipo: "estacion", id: est.id };
  pantallas.name = "pantallas-estacion";
  grupo.add(pantallas);
  const colorTmp = new THREE.Color();
  function colorPantalla(i, hexColor) {
    colorTmp.setHex(hexColor);
    for (let v = i * 4; v < i * 4 + 4; v++) colores.set([colorTmp.r, colorTmp.g, colorTmp.b], v * 3);
  }

  // Tablero EN la cara del panel (no encima): nombre, DEMO, estado de cada función y enlace. Se redibuja solo si
  // cambia. Bajo a propósito (arriba a ~1.35 m, como una persona sentada): encima del panel tapaba, desde la cámara
  // del edificio, el escritorio del departamento que queda detrás (y se lo robaba al tocarlo).
  const tablero = crearTablero(recursos, Math.min(ANCHO_TABLERO, ancho - 1.2, cuarto.ancho - 1.2));
  tablero.malla.position.set(0, ALTO + 0.375, -0.405);
  tablero.malla.userData.dinamico = true;
  tablero.malla.userData.seleccion = { tipo: "estacion", id: est.id };
  grupo.add(tablero.malla);

  // Zonas invisibles para tocar cada puesto (también con la silla vacía): eligen la estación con ese puesto marcado.
  if (compartido.matToque) {
    const geoToque = recursos.agregar(new THREE.BoxGeometry(1.25, 1.4, 1.9));
    lugar.asientos.forEach((a, i) => {
      const toque = new THREE.Mesh(geoToque, compartido.matToque);
      toque.position.set(a.x - lugar.x, 0.7, 0.35);
      toque.userData.dinamico = true;
      toque.userData.seleccion = { tipo: "estacion", id: est.id, puesto: est.puestos[i]?.id ?? null };
      toque.name = "toque-estacion";
      grupo.add(toque);
    });
  }

  // --- Personajes (uno por función). Se agregan al cuarto DESPUÉS de fusionar lo estático. ---
  const personajes = est.puestos.map((p, i) => {
    const a = lugar.asientos[i];
    const per = new Personaje({
      agente: comoAgente(p), puesto: { x: a.x, z: a.z }, cuarto, retraso: i * 0.6, todos, quieto: compartido.quieto,
      // Cuerpo: uno fijo por puesto (p.cuerpo, ver cuerpoEstacion en kenney.js).
      fabricarCuerpo: compartido.catalogo ? (id) => compartido.catalogo.fabricar(p.cuerpo ?? id, recursos) : null,
      geo: compartido.geoPersonaje, recursos, texturaSombra: compartido.texturaSombra,
      // Sin anillo de estado en el piso: el estado ya lo dicen el icono, la pantalla y el tablero (3 llamadas menos).
      burbujas: compartido.burbujasEstacion ?? compartido.burbujas, anillosEstado: null,
    });
    per.raiz.userData.seleccion = { tipo: "estacion", id: est.id, puesto: p.id };
    per.puestoEstacion = p.id;
    return per;
  });

  let ultimo = est;
  function actualizar(nueva) {
    ultimo = nueva;
    nueva.puestos.forEach((p, i) => {
      personajes[i]?.actualizar(comoAgente(p));
      const encendida = p.estado !== "sin_informacion" && p.apariencia.actividad !== "ninguna";
      colorPantalla(i, encendida ? p.apariencia.color : PANTALLA_APAGADA);
    });
    geoPantallas.attributes.color.needsUpdate = true;
    if (nueva.enlace) {
      colorTmp.setHex(nueva.es_demo && nueva.enlace.estado === "confirmado" ? COLOR_ENLACE.demo : COLOR_ENLACE[nueva.enlace.estado] ?? COLOR_ENLACE.sin_dato);
      for (let v = verticesPantallas; v < geoPantallas.attributes.position.count; v++) colores.set([colorTmp.r, colorTmp.g, colorTmp.b], v * 3);
    }
    tablero.dibujar(nueva);
  }
  actualizar(est);

  return {
    id: est.id,
    grupo,
    tablero: tablero.malla,
    personajes,
    agregarPersonajes(cuartoGrupo) { for (const p of personajes) cuartoGrupo.add(p.raiz); },
    actualizar,
    seleccionar(sel) {
      const activa = sel?.tipo === "estacion" && sel.id === est.id;
      for (const p of personajes) p.seleccionar(activa && (!sel.puesto || sel.puesto === p.puestoEstacion));
      tablero.resaltar(activa);
    },
    /** Para pruebas y para acercar la cámara: centro de la estación en el cuarto. */
    lugar: { x: lugar.x, z: lugar.z + 0.4, ancho, fondo: 2.2 },
    resumen: () => ({ id: est.id, estado: ultimo.estado, enlace: ultimo.enlace?.estado ?? null, es_demo: ultimo.es_demo,
      puestos: personajes.map((p, i) => ({ id: ultimo.puestos[i].id, estado: ultimo.puestos[i].estado, visible: p.raiz.visible, bucle: p.bucle, accion: p.accion, cuerpo: est.puestos[i].cuerpo ?? null })) }),
  };
}

const hex = (c) => `#${c.toString(16).padStart(6, "0")}`;

/** Tablero de la estación: lienzo 1024×256, una textura. Clave de dibujo = lo que se muestra (no se redibuja igual). */
function crearTablero(recursos, ancho) {
  const lienzo = document.createElement("canvas");
  lienzo.width = 1024;
  lienzo.height = 256;
  const ctx = lienzo.getContext("2d");
  const textura = recursos.agregar(new THREE.CanvasTexture(lienzo));
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.anisotropy = 4;
  const material = recursos.agregar(new THREE.MeshBasicMaterial({ map: textura, toneMapped: false }));
  const alto = ancho * lienzo.height / lienzo.width;
  const malla = new THREE.Mesh(recursos.agregar(new THREE.PlaneGeometry(ancho, alto)), material);
  malla.name = "tablero-estacion";
  let clave = "", resaltado = false, ultimo = null;

  function dibujar(e) {
    ultimo = e;
    const nueva = JSON.stringify([e.nombre, e.estado, e.es_demo, e.vigente, e.puestos.map((p) => p.estado), e.enlace?.estado, resaltado]);
    if (nueva === clave) return;
    clave = nueva;
    ctx.fillStyle = "#0f1526";
    ctx.fillRect(0, 0, 1024, 256);
    ctx.lineWidth = 8;
    ctx.strokeStyle = resaltado ? "#ffffff" : "#3b4a6b";
    ctx.strokeRect(4, 4, 1016, 248);
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffd89a";
    ctx.font = "bold 40px system-ui, sans-serif";
    ctx.fillText(recortar(ctx, e.nombre, e.es_demo ? 760 : 940), 28, 42);
    if (e.es_demo) {
      ctx.fillStyle = "#ffb547";
      ctx.fillRect(1024 - 150, 16, 126, 52);
      ctx.fillStyle = "#1a1200";
      ctx.font = "bold 36px system-ui, sans-serif";
      ctx.fillText("DEMO", 1024 - 136, 43);
    }
    // Una columna por función: luz del estado, función y estado (sin cifras, sin importes).
    const n = e.puestos.length, w = (1024 - 40) / n;
    e.puestos.forEach((p, i) => {
      const x = 20 + i * w;
      const color = e.vigente ? hex(p.apariencia.color) : "#5b6375";
      ctx.fillStyle = "#18213a";
      ctx.fillRect(x + 6, 86, w - 12, 112);
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(x + 32, 116, 13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#c9d2e6";
      ctx.font = "26px system-ui, sans-serif";
      ctx.fillText(recortar(ctx, p.funcion, w - 70), x + 54, 116);
      ctx.fillStyle = color;
      ctx.font = "bold 28px system-ui, sans-serif";
      ctx.fillText(recortar(ctx, p.apariencia.etiqueta, w - 30), x + 20, 168);
    });
    // Pie: enlace con la otra oficina y aviso permanente de qué representan los personajes.
    ctx.font = "24px system-ui, sans-serif";
    ctx.fillStyle = "#8a94a8";
    const flecha = e.enlace ? (e.enlace.sentido === "salida" ? "→" : "←") : "";
    const enlace = !e.enlace ? "" : e.enlace.estado === "confirmado" && e.es_demo ? `${flecha} ${e.enlace.nombre ?? e.enlace.proyecto}: transferencia de DEMOSTRACIÓN (no es real)`
      : e.enlace.estado === "confirmado" ? `${flecha} ${e.enlace.nombre ?? e.enlace.proyecto}: transferencia confirmada por ambas partes`
      : e.enlace.estado === "sin_confirmar" ? `${flecha} ${e.enlace.nombre ?? e.enlace.proyecto}: registrada solo de este lado (sin confirmar)`
      : `${flecha} ${e.enlace.nombre ?? e.enlace.proyecto}: sin transferencias registradas`;
    if (e.enlace) { ctx.fillStyle = e.enlace.estado === "confirmado" ? (e.es_demo ? "#ffb547" : "#5fd0e0") : "#8a94a8"; ctx.fillText(recortar(ctx, enlace, 980), 28, 228); }
    else ctx.fillText(e.vigente ? "Personajes = funciones del sistema, no agentes de IA" : `Sin información: ${e.motivo ?? "sin datos vigentes"}`, 28, 228);
    textura.needsUpdate = true;
  }
  return {
    malla, alto, dibujar,
    resaltar(activo) { if (activo === resaltado) return; resaltado = activo; if (ultimo) dibujar(ultimo); },
  };
}

function recortar(ctx, texto, max) {
  if (ctx.measureText(texto).width <= max) return texto;
  let t = texto;
  while (t.length > 1 && ctx.measureText(t + "…").width > max) t = t.slice(0, -1);
  return t + "…";
}

/** Iconos de los estados de estación, para el atlas común de crearBurbujas (prefijo «estacion:»). */
export const ICONOS_ESTACION = Object.entries(ESTADOS_ESTACION).map(([clave, e]) => ({ clave: `estacion:${clave}`, color: e.color, icono: e.icono, tam: 30 }));

/** Burbujas de los personajes de estación, sobre el atlas común (una sola textura para todos los iconos). */
export function burbujasEstacion(burbujas) {
  return { material: (estado) => burbujas.extra(`estacion:${estado}`) ?? burbujas.extra("estacion:sin_informacion") };
}
