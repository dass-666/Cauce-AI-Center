// Un departamento como cuarto de oficina: piso, mamparas, escritorios, computadoras, sillas,
// letrero y personajes. Todo el mobiliario se hace con código (sin modelos descargados).

import * as THREE from "three";
import { tamanoCuarto, puestos, puerta } from "./disposicion.js";
import { COLOR_ESTADO, OFICINA } from "./paleta.js";
import { Personaje } from "./personaje.js";
import { Recursos } from "./recursos.js";

const ALTO_ESCRITORIO = 0.6;
const ALTO_MURO = 1.5;

export function crearOficina(dep, modelo, compartido) {
  const recursos = new Recursos();
  const grupo = new THREE.Group();
  const cuarto = tamanoCuarto(dep.posicion, modelo.cuadricula.metros_por_celda, Math.max(1, dep.agentes.length));
  const lugares = puestos(Math.max(1, dep.agentes.length), cuarto);
  const mat = (color, extra = {}) => recursos.agregar(new THREE.MeshLambertMaterial({ color, ...extra }));
  const caja = (w, h, d) => recursos.agregar(new THREE.BoxGeometry(w, h, d));

  const m = {
    base: mat(OFICINA.base),
    piso: mat(OFICINA.piso),
    pared: mat(OFICINA.pared),
    madera: mat(OFICINA.madera),
    maderaOscura: mat(OFICINA.maderaOscura),
    metal: mat(OFICINA.metal),
    silla: mat(OFICINA.silla),
    planta: mat(OFICINA.planta),
    maceta: mat(OFICINA.maceta),
    vidrio: recursos.agregar(new THREE.MeshLambertMaterial({ color: OFICINA.vidrio, transparent: true, opacity: 0.16, depthWrite: false })),
    marco: mat(0x5a6480),
  };

  // Base del diorama y piso con duelas.
  const { ancho: W, fondo: F } = cuarto;
  const base = new THREE.Mesh(caja(W + 0.6, 0.3, F + 0.6), m.base);
  base.position.y = -0.19; // su cara superior queda bajo el piso (evita parpadeo entre superficies)
  grupo.add(base);
  const piso = new THREE.Mesh(caja(W, 0.04, F), m.piso);
  piso.position.y = -0.02;
  piso.userData.seleccion = { tipo: "departamento", id: dep.id };
  grupo.add(piso);
  const duela = caja(W, 0.005, 0.02);
  const matDuela = mat(OFICINA.pisoLinea);
  for (let z = -F / 2 + 0.5; z < F / 2; z += 0.5) {
    const l = new THREE.Mesh(duela, matDuela);
    l.position.set(0, 0.001, z);
    grupo.add(l);
  }

  // Muros sólidos al fondo (-Z) y a la izquierda (-X); mamparas de vidrio al frente y a la derecha
  // para que la cámara vea el interior. La puerta queda en el frente izquierdo.
  const muroFondo = new THREE.Mesh(caja(W, ALTO_MURO, 0.12), m.pared);
  muroFondo.position.set(0, ALTO_MURO / 2, -F / 2 - 0.06);
  const muroIzq = new THREE.Mesh(caja(0.12, ALTO_MURO, F), m.pared);
  muroIzq.position.set(-W / 2 - 0.06, ALTO_MURO / 2, 0);
  grupo.add(muroFondo, muroIzq);

  const p = puerta(cuarto);
  const huecoPuerta = 1.1;
  const inicioVidrio = p.x + huecoPuerta / 2;
  const vidrios = [
    { x: (inicioVidrio + W / 2) / 2, z: F / 2, w: W / 2 - inicioVidrio, d: 0.04 },
    { x: W / 2, z: 0, w: 0.04, d: F },
  ];
  const altoVidrio = 0.9;
  for (const v of vidrios) {
    const panel = new THREE.Mesh(caja(v.w, altoVidrio, v.d), m.vidrio);
    panel.position.set(v.x, altoVidrio / 2, v.z);
    panel.renderOrder = 2;
    const marco = new THREE.Mesh(caja(v.w + 0.02, 0.04, v.d + 0.02), m.marco);
    marco.position.set(v.x, altoVidrio, v.z);
    grupo.add(panel, marco);
  }
  // Marco de la puerta.
  for (const lado of [-1, 1]) {
    const poste = new THREE.Mesh(caja(0.06, altoVidrio, 0.06), m.marco);
    poste.position.set(p.x + lado * huecoPuerta / 2, altoVidrio / 2, F / 2);
    grupo.add(poste);
  }

  // Escritorios, computadoras y sillas (uno por agente; sin agentes, uno vacío).
  const g = {
    cubierta: caja(1.3, 0.05, 0.7),
    pata: caja(0.05, ALTO_ESCRITORIO, 0.05),
    monitor: caja(0.62, 0.38, 0.04),
    pantalla: recursos.agregar(new THREE.PlaneGeometry(0.56, 0.32)),
    pie: caja(0.06, 0.14, 0.06),
    teclado: caja(0.42, 0.02, 0.14),
    asiento: caja(0.42, 0.06, 0.4),
    respaldo: caja(0.42, 0.42, 0.06),
    poste: recursos.agregar(new THREE.CylinderGeometry(0.03, 0.03, 0.26, 8)),
    ruedas: recursos.agregar(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 10)),
    taza: recursos.agregar(new THREE.CylinderGeometry(0.04, 0.035, 0.09, 10)),
  };
  const pantallas = [];
  lugares.forEach((l, i) => {
    const puesto = new THREE.Group();
    puesto.position.set(l.x, 0, l.z);
    const agente = dep.agentes[i] ?? null;
    if (agente) puesto.userData.seleccion = { tipo: "agente", id: agente.id };
    else puesto.userData.seleccion = { tipo: "departamento", id: dep.id };

    const cubierta = new THREE.Mesh(g.cubierta, m.madera);
    cubierta.position.y = ALTO_ESCRITORIO;
    puesto.add(cubierta);
    for (const [px, pz] of [[-0.6, -0.3], [0.6, -0.3], [-0.6, 0.3], [0.6, 0.3]]) {
      const pata = new THREE.Mesh(g.pata, m.maderaOscura);
      pata.position.set(px, ALTO_ESCRITORIO / 2, pz);
      puesto.add(pata);
    }
    const monitor = new THREE.Mesh(g.monitor, m.metal);
    monitor.position.set(0, ALTO_ESCRITORIO + 0.33, -0.18);
    const pie = new THREE.Mesh(g.pie, m.metal);
    pie.position.set(0, ALTO_ESCRITORIO + 0.08, -0.18);
    const matPantalla = recursos.agregar(new THREE.MeshBasicMaterial({ color: OFICINA.pantallaApagada }));
    const pantalla = new THREE.Mesh(g.pantalla, matPantalla);
    pantalla.position.set(0, ALTO_ESCRITORIO + 0.33, -0.157);
    const teclado = new THREE.Mesh(g.teclado, m.metal);
    teclado.position.set(0, ALTO_ESCRITORIO + 0.035, 0.1);
    const taza = new THREE.Mesh(g.taza, m.marco);
    taza.position.set(0.48, ALTO_ESCRITORIO + 0.07, 0.05);
    puesto.add(monitor, pie, pantalla, teclado, taza);
    pantallas.push({ material: matPantalla, agenteId: agente?.id ?? null });

    // Silla detrás del escritorio (+Z), mirando al monitor.
    const silla = new THREE.Group();
    silla.position.set(0, 0, 0.75);
    const asiento = new THREE.Mesh(g.asiento, m.silla);
    asiento.position.y = 0.3;
    const respaldo = new THREE.Mesh(g.respaldo, m.silla);
    respaldo.position.set(0, 0.54, 0.2);
    const poste = new THREE.Mesh(g.poste, m.metal);
    poste.position.y = 0.15;
    const ruedas = new THREE.Mesh(g.ruedas, m.metal);
    ruedas.position.y = 0.02;
    silla.add(asiento, respaldo, poste, ruedas);
    puesto.add(silla);

    const sombra = new THREE.Mesh(compartido.geoSombraEscritorio, compartido.matSombra);
    sombra.position.y = 0.006;
    puesto.add(sombra);
    grupo.add(puesto);
  });

  // Decoración sencilla: planta en la esquina del fondo derecho y lámparas colgantes.
  const maceta = new THREE.Mesh(recursos.agregar(new THREE.CylinderGeometry(0.2, 0.16, 0.34, 12)), m.maceta);
  maceta.position.set(W / 2 - 0.45, 0.17, -F / 2 + 0.45);
  const follaje = new THREE.Mesh(recursos.agregar(new THREE.IcosahedronGeometry(0.34, 0)), m.planta);
  follaje.position.set(W / 2 - 0.45, 0.6, -F / 2 + 0.45);
  grupo.add(maceta, follaje);

  // Letrero en el muro del fondo.
  const letrero = crearLetrero(recursos, dep, cuarto);
  letrero.malla.position.set(0, ALTO_MURO - 0.5, -F / 2 + 0.01);
  grupo.add(letrero.malla);

  // Personajes.
  const personajes = dep.agentes.map((agente, i) => new Personaje({
    agente, puesto: lugares[i], cuarto, retraso: i * 0.9,
    geo: compartido.geoPersonaje, recursos, texturaSombra: compartido.texturaSombra, burbujas: compartido.burbujas,
  }));
  for (const per of personajes) grupo.add(per.raiz);

  function actualizar(depNuevo, modeloNuevo) {
    const porId = new Map(depNuevo.agentes.map((a) => [a.id, a]));
    for (const per of personajes) {
      const a = porId.get(per.id);
      if (a) per.actualizar(a);
    }
    for (const pan of pantallas) {
      const a = pan.agenteId ? porId.get(pan.agenteId) : null;
      // Pantalla apagada si no hay evidencia; si la hay, del color del estado.
      pan.material.color.setHex(a && a.estado !== "sin_datos" ? COLOR_ESTADO[a.estado] : OFICINA.pantallaApagada);
    }
    letrero.dibujar(depNuevo, modeloNuevo);
  }
  actualizar(dep, modelo);

  return {
    grupo,
    cuarto,
    personajes,
    actualizar,
    paso(dt, reloj) { for (const per of personajes) per.paso(dt, reloj); },
    seleccionar(sel) {
      for (const per of personajes) per.seleccionar(sel?.tipo === "agente" && sel.id === per.id);
      letrero.resaltar(sel?.tipo === "departamento" && sel.id === dep.id);
    },
    liberar() {
      grupo.removeFromParent();
      recursos.liberar();
    },
  };
}

/** Letrero con nombre, estado, tres indicadores y la marca DEMO. Se redibuja solo si cambia. */
function crearLetrero(recursos, dep, cuarto) {
  const lienzo = document.createElement("canvas");
  lienzo.width = 1024;
  lienzo.height = 300;
  const ctx = lienzo.getContext("2d");
  const textura = recursos.agregar(new THREE.CanvasTexture(lienzo));
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.anisotropy = 4;
  const material = recursos.agregar(new THREE.MeshBasicMaterial({ map: textura, toneMapped: false }));
  const ancho = Math.min(3.4, cuarto.ancho - 1.6);
  const malla = new THREE.Mesh(recursos.agregar(new THREE.PlaneGeometry(ancho, ancho * lienzo.height / lienzo.width)), material);
  malla.userData.seleccion = { tipo: "departamento", id: dep.id };
  let clave = "";
  let resaltado = false;
  let ultimo = null;

  function dibujar(d, modelo) {
    ultimo = [d, modelo];
    const nueva = JSON.stringify([d.nombre, d.estado_resumen, d.indicadores, d.alertas.length, modelo.es_demo, modelo.conexion, resaltado]);
    if (nueva === clave) return;
    clave = nueva;
    const color = `#${COLOR_ESTADO[d.estado_resumen].toString(16).padStart(6, "0")}`;
    ctx.fillStyle = "#0f1526";
    ctx.fillRect(0, 0, lienzo.width, lienzo.height);
    ctx.lineWidth = 10;
    ctx.strokeStyle = resaltado ? "#ffffff" : "#ffd89a";
    ctx.strokeRect(5, 5, lienzo.width - 10, lienzo.height - 10);
    // Luz de estado
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(70, 72, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffd89a";
    ctx.font = "bold 58px system-ui, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText(recortar(ctx, d.nombre, modelo.es_demo ? 680 : 860), 115, 74);
    ctx.font = "32px system-ui, sans-serif";
    ctx.fillStyle = color;
    const conexion = modelo.conexion === "en_linea" ? "" : ` · ${modelo.conexion_etiqueta}`;
    ctx.fillText(`${d.apariencia_resumen.etiqueta}${conexion}${d.alertas.length ? ` · ⚠ ${d.alertas.length}` : ""}`, 115, 132);
    // Indicadores (máximo 3)
    const inds = d.indicadores.slice(0, 3);
    inds.forEach((ind, i) => {
      const x = 40 + i * 320;
      ctx.fillStyle = "#a3adc4";
      ctx.font = "28px system-ui, sans-serif";
      ctx.fillText(recortar(ctx, ind.etiqueta, 290), x, 200);
      ctx.fillStyle = "#e8ecf5";
      ctx.font = "bold 46px system-ui, sans-serif";
      ctx.fillText(ind.valor === null ? "—" : `${ind.valor}${ind.unidad ? " " + ind.unidad : ""}`, x, 252);
    });
    if (modelo.es_demo) {
      ctx.fillStyle = "#ffb547";
      ctx.fillRect(lienzo.width - 190, 30, 160, 64);
      ctx.fillStyle = "#1a1200";
      ctx.font = "bold 44px system-ui, sans-serif";
      ctx.fillText("DEMO", lienzo.width - 170, 64);
    }
    textura.needsUpdate = true;
  }

  return {
    malla,
    dibujar,
    resaltar(activo) {
      if (activo === resaltado) return;
      resaltado = activo;
      if (ultimo) dibujar(...ultimo);
    },
  };
}

function recortar(ctx, texto, max) {
  if (ctx.measureText(texto).width <= max) return texto;
  let t = texto;
  while (t.length > 1 && ctx.measureText(t + "…").width > max) t = t.slice(0, -1);
  return t + "…";
}
