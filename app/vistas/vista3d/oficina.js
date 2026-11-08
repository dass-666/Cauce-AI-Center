// Un departamento como cuarto de oficina: piso, mamparas, escritorios, computadoras, sillas,
// letrero y personajes. Todo el mobiliario se hace con código (sin modelos descargados).

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { tamanoCuarto, puestos, puerta, lugaresEstaciones } from "./disposicion.js";
import { crearEstacion3D } from "./estacion3d.js";
import { COLOR_ESTADO, OFICINA } from "./paleta.js";
import { Personaje } from "./personaje.js";
import { Recursos } from "./recursos.js";
import { dibujarIcono, hex } from "./iconos.js";
import { NATURALEZAS } from "../../nucleo/naturaleza.js";
import { crearMobiliario } from "./mobiliario.js";
import { huella } from "./disposicion.js";
import { paletaDe, pisoDeTema } from "./estilo-visual.js";
import { amueblarCuarto } from "./interiores.js";

const ALTO_ESCRITORIO = 0.6;

/**
 * @param opciones.cuarto   tamaño fijo {ancho, fondo} (en el edificio lo decide plano-edificio.js)
 * @param opciones.altoMuro alto de los muros: 1.5 en la vista individual, más bajo en el edificio
 * @param opciones.base     dibujar la base del diorama (solo en la vista individual)
 * @param opciones.acento   color propio del departamento (alfombra, franja y letrero)
 * @param opciones.tema     tema del departamento (identidad.js): muebles y símbolo propios
 * @param opciones.estilo   fase M: estilo del proyecto (comercial, financiero…): paleta y tipo de piso
 */
export function crearOficina(dep, modelo, compartido, opciones = {}) {
  const ALTO_MURO = opciones.altoMuro ?? 1.5;
  const recursos = new Recursos();
  const grupo = new THREE.Group();
  grupo.userData.seleccion = { tipo: "departamento", id: dep.id };
  // Estaciones de trabajo que hospeda este departamento (estaciones.js): una fila más, delante de sus escritorios.
  const estacionesDep = dep.estaciones ?? [];
  const cuarto = opciones.cuarto ?? tamanoCuarto(dep.posicion, modelo.cuadricula.metros_por_celda, Math.max(1, dep.agentes.length), estacionesDep.length);
  const lugares = puestos(Math.max(1, dep.agentes.length), cuarto);
  const lugaresEst = lugaresEstaciones(cuarto, Math.max(1, dep.agentes.length), estacionesDep);
  // Escritorios + asientos de las estaciones: los caminos y la decoración rodean a todos.
  const todos = [...lugares, ...lugaresEst.flatMap((l) => [...l.asientos, l.extremo])];
  // Un material por color (los opacos se reutilizan): menos materiales = menos llamadas al fusionar.
  const cacheMat = new Map();
  const mat = (color, extra = {}) => {
    const clave = Object.keys(extra).length ? null : color;
    if (clave !== null && cacheMat.has(clave)) return cacheMat.get(clave);
    const nuevo = recursos.agregar(new THREE.MeshLambertMaterial({ color, ...extra }));
    if (clave !== null) cacheMat.set(clave, nuevo);
    return nuevo;
  };
  const caja = (w, h, d) => recursos.agregar(new THREE.BoxGeometry(w, h, d));

  // Fase M: la paleta del proyecto (estilo-visual.js) da muros, maderas, sillas y marcos. Son colores lisos: se
  // fusionan por color de vértice, así que cambiar de paleta no agrega llamadas de dibujo.
  const tema = opciones.tema ?? "";
  const estilo = opciones.estilo ?? "general";
  const pal = paletaDe(estilo);
  const m = {
    base: mat(OFICINA.base),
    piso: mat(OFICINA.piso),
    pared: mat(pal.muro),
    remate: mat(pal.muroRemate),
    zocalo: mat(pal.muroZocalo),
    madera: mat(pal.madera),
    maderaOscura: mat(pal.maderaOscura),
    metal: mat(pal.metal),
    silla: mat(pal.silla),
    sofa: mat(pal.tela),
    planta: mat(OFICINA.planta),
    maceta: mat(OFICINA.maceta),
    vidrio: recursos.agregar(new THREE.MeshLambertMaterial({ color: OFICINA.vidrio, transparent: true, opacity: 0.16, depthWrite: false })),
    marco: mat(pal.marco),
    claro: mat(0xdfe4ee),
    tapete: mat(pal.tapete),
    tapeteCentro: mat(mezclar(pal.tapete, 0xffffff, 0.25)),
    corcho: mat(0xb08a5a),
    carton: mat(0xc49a6c),
    oro: mat(0xe7c25a),
    agua: mat(0x7fb0d8),
    pantallaLampara: mat(0xffe6b8),
    // Pantallas ambientales (pictogramas sin cifras): un material para todo el edificio (escena3d.js).
    pantallaAmbiente: compartido.matPantallaAmbiente ?? null,
  };
  // Fase L: muebles del catálogo compartido (mobiliario.js). Sin escena (pruebas), uno propio de este cuarto.
  const mob = compartido.mobiliario ?? crearMobiliario(recursos);
  m.acento = acentoMat();
  function acentoMat() { return opciones.acento != null ? mat(opciones.acento) : m.claro; }

  // Base del diorama y piso con duelas.
  const { ancho: W, fondo: F } = cuarto;
  if (opciones.base !== false) {
    const base = new THREE.Mesh(caja(W + 0.6, 0.3, F + 0.6), m.base);
    base.position.y = -0.19; // su cara superior queda bajo el piso (evita parpadeo entre superficies)
    grupo.add(base);
  }
  // Piso de duela: una textura compartida que se repite según el tamaño del cuarto.
  const geoPiso = caja(W, 0.04, F);
  const uv = geoPiso.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * W / 2, uv.getY(i) * F / 2);
  // Fase M: tipo de piso según el trabajo del cuarto y el estilo del proyecto (duela, alfombra, concreto o vinil).
  const piso = new THREE.Mesh(geoPiso, compartido.pisos?.[pisoDeTema(tema, estilo)] ?? compartido.matPiso);
  piso.position.y = -0.02;
  grupo.add(piso);
  const acento = opciones.acento ?? null;
  if (acento !== null) {
    // Alfombra del color del departamento bajo los escritorios.
    const alfombra = new THREE.Mesh(recursos.agregar(new THREE.PlaneGeometry(W - 1.2, F - 1.6).rotateX(-Math.PI / 2)),
      mat(acento, { transparent: true, opacity: 0.22, depthWrite: false }));
    alfombra.position.set(0, 0.004, -0.3);
    grupo.add(alfombra);
  }

  // Muros sólidos al fondo (-Z) y a la izquierda (-X); mamparas de vidrio al frente y a la derecha
  // para que la cámara vea el interior. La puerta queda en el frente izquierdo.
  // Fase M: muros más gruesos (16 cm) con remate claro arriba y una franja del acento en la cara interior.
  const GM = 0.16;
  const muroFondo = new THREE.Mesh(caja(W + GM, ALTO_MURO, GM), m.pared);
  muroFondo.position.set(-GM / 2, ALTO_MURO / 2, -F / 2 - GM / 2);
  const muroIzq = new THREE.Mesh(caja(GM, ALTO_MURO, F), m.pared);
  muroIzq.position.set(-W / 2 - GM / 2, ALTO_MURO / 2, 0);
  const remateF = new THREE.Mesh(caja(W + GM + 0.04, 0.05, GM + 0.04), m.remate);
  remateF.position.set(-GM / 2, ALTO_MURO + 0.025, -F / 2 - GM / 2);
  const remateI = new THREE.Mesh(caja(GM + 0.04, 0.05, F + 0.04), m.remate);
  remateI.position.set(-W / 2 - GM / 2, ALTO_MURO + 0.025, 0);
  grupo.add(muroFondo, muroIzq, remateF, remateI);
  if (acento !== null) {
    const franja = mat(acento);
    const yF = ALTO_MURO - 0.09;
    const f1 = new THREE.Mesh(caja(W, 0.05, 0.015), franja);
    f1.position.set(0, yF, -F / 2 + 0.008);
    const f2 = new THREE.Mesh(caja(0.015, 0.05, F), franja);
    f2.position.set(-W / 2 + 0.008, yF, 0);
    grupo.add(f1, f2);
  }

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
    // Fase M: riel inferior y parteluces cada ~1.2 m: la mampara se lee como cancel de cristal, no como un plano.
    const riel = new THREE.Mesh(caja(v.w + 0.02, 0.06, v.d + 0.04), m.marco);
    riel.position.set(v.x, 0.03, v.z);
    grupo.add(panel, marco, riel);
    const largo = Math.max(v.w, v.d), n = Math.floor(largo / 1.2);
    for (let i = 1; i < n; i++) {
      const t = -largo / 2 + (largo * i) / n;
      const poste = new THREE.Mesh(caja(0.035, altoVidrio, 0.035), m.marco);
      poste.position.set(v.w > v.d ? v.x + t : v.x, altoVidrio / 2, v.w > v.d ? v.z : v.z + t);
      grupo.add(poste);
    }
  }
  // Marco de la puerta.
  for (const lado of [-1, 1]) {
    const poste = new THREE.Mesh(caja(0.06, altoVidrio, 0.06), m.marco);
    poste.position.set(p.x + lado * huecoPuerta / 2, altoVidrio / 2, F / 2);
    grupo.add(poste);
  }

  // Escritorios, computadoras y sillas (uno por agente; sin agentes, uno vacío). Fase L: del catálogo (mobiliario.js).
  const g = {
    pantalla: recursos.agregar(new THREE.PlaneGeometry(0.56, 0.32)),
    taza: mob.cil(0.04, 0.035, 0.09, 10),
    // Equipo (terminal de proceso o módulo), gabinete bajo el escritorio y placa de puesto humano.
    torre: mob.caja(0.2, 0.32, 0.36),
    luzTorre: mob.caja(0.02, 0.03, 0.2),
    gabinete: mob.caja(0.5, 0.48, 0.5),
    ranura: mob.caja(0.4, 0.025, 0.02),
    placa: recursos.agregar(new THREE.PlaneGeometry(0.72, 0.18)),
    pieplaca: mob.caja(0.72, 0.03, 0.08),
    cinta: mob.caja(0.22, 0.012, 0.74),
  };
  const matCinta = mat(0xd9b23a);
  const pantallas = [];
  const lugarDe = new Map(); // agente → posición del puesto (para consultar un puesto vacío)
  lugares.forEach((l, i) => {
    const puesto = new THREE.Group();
    puesto.position.set(l.x, 0, l.z);
    const agente = dep.agentes[i] ?? null;
    // Tipo de puesto según lo que el agente ES (naturaleza.js). Sin clasificación: puesto de siempre.
    const tipo = agente?.presentacion?.puesto ?? "personaje";

    mob.escritorio(puesto, m);
    mob.monitorYTeclado(puesto, m);
    const matPantalla = recursos.agregar(new THREE.MeshBasicMaterial({ color: OFICINA.pantallaApagada }));
    const pantalla = new THREE.Mesh(g.pantalla, matPantalla);
    pantalla.position.set(0, ALTO_ESCRITORIO + 0.33, -0.157);
    pantalla.userData.dinamico = true; // cambia de color: no se fusiona
    if (agente) pantalla.userData.seleccion = { tipo: "agente", id: agente.id };
    puesto.add(pantalla);
    if (tipo !== "equipo") { // un equipo no tiene a nadie tomando café
      const taza = new THREE.Mesh(g.taza, m.marco);
      taza.position.set(0.48, ALTO_ESCRITORIO + 0.07, 0.05);
      puesto.add(taza);
    }
    // Fase L: cada escritorio con algo propio (papeles o una planta chica), fijo por puesto: no todos iguales.
    const detalle = huella(`${dep.id}#${i}`) % 3;
    if (detalle === 0 && tipo !== "equipo") mob.papeles(puesto, m, { x: -0.42, y: ALTO_ESCRITORIO + 0.025, z: 0.12, rot: 0.2 });
    if (detalle === 1 && tipo !== "terminal" && tipo !== "equipo") mob.planta(puesto, m, { x: -0.5, y: ALTO_ESCRITORIO + 0.025, z: -0.22, tam: "baja" });
    // Fase M: resplandor de la pantalla sobre el escritorio (solo con la pantalla encendida por evidencia).
    let resplandor = null;
    if (compartido.geoResplandor) {
      resplandor = new THREE.Mesh(compartido.geoResplandor, compartido.resplandor(COLOR_ESTADO.trabajando));
      resplandor.position.set(0, ALTO_ESCRITORIO + 0.03, -0.02);
      resplandor.userData.dinamico = true;
      resplandor.visible = false;
      resplandor.renderOrder = 1;
      resplandor.name = "resplandor-pantalla";
      puesto.add(resplandor);
    }
    pantallas.push({ material: matPantalla, agenteId: agente?.id ?? null, resplandor, desde: null, hacia: null, t: 1 });
    agregarMueblesDePuesto(puesto, tipo, g, m, mat(acento ?? OFICINA.brillo), matCinta, compartido.matPlacaHumano);
    // Fase L: zona invisible para tocar el puesto completo (también vacío, sin personaje). No se dibuja.
    if (agente && compartido.matToque) {
      const toque = new THREE.Mesh(compartido.geoToque, compartido.matToque);
      toque.position.set(0, 0.55, 0.3);
      toque.userData.dinamico = true;
      toque.userData.seleccion = { tipo: "agente", id: agente.id };
      toque.name = "toque-puesto";
      puesto.add(toque);
      lugarDe.set(agente.id, { x: l.x, z: l.z });
    } else if (agente) lugarDe.set(agente.id, { x: l.x, z: l.z });
    if (tipo === "equipo" || tipo === "inactivo") { // sin silla: nadie se sienta ahí
      const sombraE = new THREE.Mesh(compartido.geoSombraEscritorio, compartido.matSombra);
      sombraE.position.y = 0.006;
      puesto.add(sombraE);
      grupo.add(puesto);
      return;
    }

    // Silla detrás del escritorio (+Z), mirando al monitor.
    mob.silla(puesto, m, { z: 0.75 });

    const sombra = new THREE.Mesh(compartido.geoSombraEscritorio, compartido.matSombra);
    sombra.position.y = 0.006;
    puesto.add(sombra);
    grupo.add(puesto);
  });

  // Decoración: planta en la esquina del fondo derecho y, fase L, un mueble propio del cuarto junto al muro del
  // fondo (estantería, credenza o cocineta), elegido por el id: los cuartos ya no son todos iguales.
  // Fase M: interiores con identidad por tipo de trabajo (interiores.js): una familia de muebles y pantallas
  // ambientales que se acomodan donde no estorban (ni escritorios, ni pasillo, ni caminos de los personajes).
  const estaciones3d = estacionesDep.map((est, k) => crearEstacion3D(grupo, est, lugaresEst[k], { mob, m, recursos, compartido, cuarto, todos }));
  amueblarCuarto(grupo, mob, m, tema, cuarto, todos, { estilo, altoMuro: ALTO_MURO });
  agregarPuertaYZocalo(grupo, mob, m, W, F, ALTO_MURO, puerta(cuarto), huella(dep.id) % 2 === 0);

  // Letrero en el muro del fondo (en el edificio, con muros bajos, se apoya encima del muro).
  const letrero = crearLetrero(recursos, dep, cuarto, acento, opciones.tema ?? "");
  letrero.malla.userData.dinamico = true;
  const altoLetrero = letrero.malla.geometry.parameters.height;
  letrero.malla.position.set(0, ALTO_MURO >= 1.4 ? ALTO_MURO - 0.5 : ALTO_MURO + altoLetrero / 2 + 0.06, -F / 2 + 0.01);
  grupo.add(letrero.malla);

  // Torreta de alertas en la esquina del fondo derecho: solo se ve si el archivo trae alertas
  // de este departamento; parpadea solo si alguna es crítica y los datos están vigentes.
  const torreta = crearTorreta(recursos, caja);
  torreta.grupo.position.set(W / 2 - 0.25, ALTO_MURO, -F / 2 + 0.05);
  grupo.add(torreta.grupo);

  // Todo lo que no se mueve se junta en una malla por material: menos llamadas de dibujo.
  fusionarEstaticos(grupo, recursos);

  // Personajes: solo donde alguna vez puede haber alguien (no en módulos, puestos humanos ni futuros).
  const puedeTenerPersonaje = (a) => !a.naturaleza || NATURALEZAS[a.naturaleza]?.personaje;
  const personajes = dep.agentes.map((agente, i) => puedeTenerPersonaje(agente) && new Personaje({
    agente, puesto: lugares[i], cuarto, retraso: i * 0.9, todos, quieto: compartido.quieto,
    fabricarCuerpo: compartido.catalogo ? (id) => compartido.catalogo.fabricar(id, recursos) : null,
    geo: compartido.geoPersonaje, recursos, texturaSombra: compartido.texturaSombra, burbujas: compartido.burbujas,
    anillosEstado: compartido.anillosEstado ?? null,
  })).filter(Boolean);
  for (const per of personajes) grupo.add(per.raiz);
  for (const e of estaciones3d) e.agregarPersonajes(grupo);
  const personajesEstacion = estaciones3d.flatMap((e) => e.personajes);

  let primeraLectura = true;
  const quieto = compartido.quieto ?? (() => false);
  const colorA = new THREE.Color(), colorB = new THREE.Color();
  function pasoPantallas(dt) {
    for (const pan of pantallas) {
      if (pan.t >= 1) continue;
      pan.t = Math.min(1, pan.t + dt / 0.4);
      colorA.setHex(pan.desde); colorB.setHex(pan.hacia);
      pan.material.color.copy(colorA.lerp(colorB, pan.t));
      if (pan.t >= 1) pan.hacia = null;
    }
  }
  function actualizar(depNuevo, modeloNuevo) {
    const porId = new Map(depNuevo.agentes.map((a) => [a.id, a]));
    for (const per of personajes) {
      const a = porId.get(per.id);
      if (a) per.actualizar(a);
    }
    for (const pan of pantallas) {
      const a = pan.agenteId ? porId.get(pan.agenteId) : null;
      // Pantalla apagada si no hay evidencia; si la hay, del color del estado (o lo que diga su naturaleza).
      const color = colorPantalla(a);
      // Fase M: si el color cambió entre dos lecturas (cambio observado), pasa en 0.4 s; la primera vez, directo.
      if (primeraLectura || quieto()) { pan.material.color.setHex(color); pan.t = 1; }
      else if (color !== pan.material.color.getHex() && color !== pan.hacia) { pan.desde = pan.material.color.getHex(); pan.hacia = color; pan.t = 0; }
      if (pan.resplandor) {
        pan.resplandor.visible = color !== OFICINA.pantallaApagada;
        if (pan.resplandor.visible) pan.resplandor.material = compartido.resplandor(color);
      }
    }
    primeraLectura = false;
    for (const e of estaciones3d) { const n = depNuevo.estaciones?.find((x) => x.id === e.id); if (n) e.actualizar(n); }
    letrero.dibujar(depNuevo, modeloNuevo);
    torreta.mostrar(depNuevo.alertas, modeloNuevo.conexion === "en_linea");
  }
  actualizar(dep, modelo);

  return {
    grupo,
    cuarto,
    personajes,
    /** Estaciones de trabajo del cuarto (estacion3d.js) y sus personajes (funciones, no agentes del contrato v1). */
    estaciones: estaciones3d,
    personajesEstacion,
    /** Posición (en el cuarto) del escritorio de un agente, aunque no tenga personaje. */
    lugarDe: (id) => lugarDe.get(id) ?? null,
    actualizar,
    paso(dt, reloj) {
      for (const per of personajes) per.paso(dt, reloj);
      for (const per of personajesEstacion) per.paso(dt, reloj);
      torreta.paso(reloj);
      pasoPantallas(dt);
    },
    /** Rendimiento UHD: ¿algo del cuarto se mueve? (personaje a la vista, entrando o saliendo, torreta que parpadea
     *  o, fase M, una pantalla que cambia de color tras un cambio observado) */
    enMovimiento() {
      const mueve = (p) => p.raiz.visible || p.accion === "entrar" || p.accion === "salir";
      return torreta.parpadea || pantallas.some((p) => p.t < 1) || personajes.some(mueve) || personajesEstacion.some(mueve);
    },
    seleccionar(sel) {
      for (const per of personajes) per.seleccionar(sel?.tipo === "agente" && sel.id === per.id);
      letrero.resaltar(sel?.tipo === "departamento" && sel.id === dep.id);
      for (const e of estaciones3d) e.seleccionar(sel);
    },
    liberar() {
      grupo.removeFromParent();
      recursos.liberar();
    },
  };
}

/** Mezcla dos colores 0xRRGGBB (k = 0 → a, 1 → b). */
function mezclar(a, b, k) {
  const c = (x, s) => (x >> s) & 255;
  const v = (s) => Math.round(c(a, s) + (c(b, s) - c(a, s)) * k);
  return (v(16) << 16) | (v(8) << 8) | v(0);
}

const COLOR_REGISTRO_HUMANO = 0xb78cff;
function colorPantalla(a) {
  if (!a) return OFICINA.pantallaApagada;
  const p = a.presentacion?.pantalla;
  if (p === undefined) return a.estado !== "sin_datos" ? COLOR_ESTADO[a.estado] : OFICINA.pantallaApagada;
  if (p === "apagada") return OFICINA.pantallaApagada;
  if (p === "registro") return COLOR_REGISTRO_HUMANO;
  return COLOR_ESTADO[p] ?? OFICINA.pantallaApagada;
}

/**
 * Muebles propios del tipo de puesto. Todo es estático (se fusiona con el cuarto): no agrega llamadas de dibujo
 * salvo la placa HUMANO (una por cuarto que la tenga, compartida en todo el edificio).
 *   terminal  equipo sobre el escritorio (proceso reactivo o programado: alguien puede venir un momento)
 *   equipo    equipo sobre el escritorio y gabinete debajo; sin silla (módulo de software)
 *   humano    placa «HUMANO» al frente del escritorio; la silla queda vacía
 *   inactivo  cinta amarilla sobre el escritorio; sin silla (función futura)
 */
function agregarMueblesDePuesto(puesto, tipo, g, m, matAcento, matCinta, matPlaca) {
  const poner = (geo, material, x, y, z) => { const o = new THREE.Mesh(geo, material); o.position.set(x, y, z); puesto.add(o); return o; };
  if (tipo === "terminal" || tipo === "equipo") {
    poner(g.torre, m.metal, -0.48, ALTO_ESCRITORIO + 0.185, -0.12);
    poner(g.luzTorre, matAcento, -0.37, ALTO_ESCRITORIO + 0.27, -0.12);
  }
  if (tipo === "equipo") {
    poner(g.gabinete, m.metal, 0.25, 0.26, -0.05);
    for (const y of [0.18, 0.3, 0.42]) poner(g.ranura, matAcento, 0.25, y, 0.205);
  }
  if (tipo === "humano" && matPlaca) {
    poner(g.pieplaca, m.maderaOscura, 0, ALTO_ESCRITORIO + 0.04, 0.3);
    const placa = poner(g.placa, matPlaca, 0, ALTO_ESCRITORIO + 0.11, 0.33);
    placa.rotation.x = -0.85; // inclinada hacia la cámara isométrica
  }
  if (tipo === "inactivo") {
    for (const x of [-0.35, 0.35]) poner(g.cinta, matCinta, x, ALTO_ESCRITORIO + 0.03, 0).rotation.y = 0.5;
  }
}

/** Letrero con nombre, estado, tres indicadores y la marca DEMO. Se redibuja solo si cambia. */
function crearLetrero(recursos, dep, cuarto, acento, tema) {
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
    ctx.strokeStyle = resaltado ? "#ffffff" : acento != null ? `#${acento.toString(16).padStart(6, "0")}` : "#ffd89a";
    ctx.strokeRect(5, 5, lienzo.width - 10, lienzo.height - 10);
    // Luz de estado
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(70, 72, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffd89a";
    ctx.font = "bold 58px system-ui, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText(recortar(ctx, d.nombre, modelo.es_demo ? 600 : 760), 115, 74);
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
    // Símbolo del departamento (identidad, no estado)
    dibujarIcono(ctx, tema, lienzo.width - (modelo.es_demo ? 260 : 90), 72, 44, acento != null ? hex(acento) : "#ffd89a");
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

const NIVEL_COLOR = { critica: 0xff5d5d, advertencia: 0xffb547, info: 0x4fb3ff };
const ORDEN_NIVEL = ["info", "advertencia", "critica"];

function crearTorreta(recursos, caja) {
  const grupo = new THREE.Group();
  grupo.userData.dinamico = true;
  grupo.visible = false;
  const base = new THREE.Mesh(caja(0.16, 0.08, 0.16), recursos.agregar(new THREE.MeshLambertMaterial({ color: OFICINA.metal })));
  base.position.y = 0.04;
  const material = recursos.agregar(new THREE.MeshBasicMaterial({ color: NIVEL_COLOR.advertencia, toneMapped: false }));
  const luz = new THREE.Mesh(recursos.agregar(new THREE.CylinderGeometry(0.07, 0.08, 0.16, 12)), material);
  luz.position.y = 0.16;
  grupo.add(base, luz);
  let parpadea = false;
  let color = NIVEL_COLOR.advertencia;
  return {
    grupo,
    mostrar(alertas, vigentes) {
      grupo.visible = alertas.length > 0;
      if (!grupo.visible) return;
      const nivel = alertas.reduce((a, al) => (ORDEN_NIVEL.indexOf(al.nivel) > ORDEN_NIVEL.indexOf(a) ? al.nivel : a), "info");
      color = NIVEL_COLOR[nivel];
      parpadea = nivel === "critica" && vigentes;
      material.color.setHex(vigentes ? color : 0x6b6f7a); // datos viejos: torreta gris, sin parpadeo
      if (!vigentes) material.color.lerp(new THREE.Color(color), 0.35);
    },
    get parpadea() { return parpadea && grupo.visible; },
    paso(reloj) {
      if (parpadea) material.color.setHex(Math.floor(reloj * 2) % 2 ? color : 0x3a1010);
    },
  };
}

/** Fase L: hoja de la puerta abierta hacia adentro (junto al muro izquierdo) y zócalo de madera o de acento. */
function agregarPuertaYZocalo(grupo, mob, m, W, F, ALTO_MURO, p, zocaloAcento) {
  // Hoja de cristal con marco, girada 90° sobre su bisagra: no estorba el paso (va pegada al muro izquierdo).
  mob.divisionCristal(grupo, m, { x: p.x - 0.53, z: F / 2 - 0.5, rot: Math.PI / 2, largo: 0.95, alto: 0.88 });
  // Zócalo en el lado interior del muro del fondo: da profundidad sin luz extra.
  // Fase M: zócalo en los dos muros (fondo e izquierdo) y umbral de la puerta en el piso.
  const altoZ = Math.min(0.12, ALTO_MURO * 0.12);
  const matZ = zocaloAcento ? m.acento : m.zocalo ?? m.maderaOscura;
  const zocalo = new THREE.Mesh(mob.caja(W - 0.02, altoZ, 0.02), matZ);
  zocalo.position.set(0, altoZ / 2, -F / 2 + 0.01);
  const zocaloI = new THREE.Mesh(mob.caja(0.02, altoZ, F - 0.02), matZ);
  zocaloI.position.set(-W / 2 + 0.01, altoZ / 2, 0);
  const umbral = new THREE.Mesh(mob.caja(1.1, 0.012, 0.16), m.marco);
  umbral.position.set(p.x, 0.006, F / 2);
  grupo.add(zocalo, zocaloI, umbral);
}

/**
 * Junta en una sola malla todo lo estático del cuarto (no personajes, pantallas ni letrero).
 * Fase L: los materiales Lambert de color liso (sin textura, opacos y que no cambian de color) se juntan además en
 * UNA sola malla con el color en cada vértice: el mismo aspecto con muchas menos llamadas de dibujo. Los que tienen
 * textura, transparencia o cambian en vivo (material.userData.vivo) siguen juntándose por material, como antes.
 */
export function fusionarEstaticos(grupo, recursos) {
  grupo.updateMatrixWorld(true);
  const inversa = grupo.matrixWorld.clone().invert();
  const porMaterial = new Map();
  const quitar = [];
  const LISO = "liso";
  const esLiso = (m) => m.isMeshLambertMaterial && !m.map && !m.transparent && !m.userData.vivo && m.visible && m.emissive.getHex() === 0 && !m.vertexColors;
  grupo.traverse((o) => {
    if (!o.isMesh || o.userData.dinamico || o.isSkinnedMesh) return;
    for (let p = o.parent; p && p !== grupo; p = p.parent) if (p.userData.dinamico) return;
    const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone());
    for (const nombre of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(nombre)) g.deleteAttribute(nombre);
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inversa, o.matrixWorld));
    const liso = esLiso(o.material);
    if (liso) {
      const n = g.attributes.position.count, c = o.material.color, colores = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { colores[i * 3] = c.r; colores[i * 3 + 1] = c.g; colores[i * 3 + 2] = c.b; }
      g.setAttribute("color", new THREE.BufferAttribute(colores, 3));
    }
    const clave = liso ? LISO : o.material;
    const lista = porMaterial.get(clave) ?? [];
    lista.push({ g, orden: o.renderOrder });
    porMaterial.set(clave, lista);
    quitar.push(o);
  });
  for (const o of quitar) o.removeFromParent();
  for (const [clave, lista] of porMaterial) {
    const fusion = mergeGeometries(lista.map((x) => x.g));
    for (const x of lista) x.g.dispose();
    if (!fusion) continue;
    const material = clave === LISO ? recursos.agregar(new THREE.MeshLambertMaterial({ vertexColors: true })) : clave;
    const malla = new THREE.Mesh(recursos.agregar(fusion), material);
    malla.renderOrder = Math.max(...lista.map((x) => x.orden));
    if (clave === LISO) malla.name = "estaticos-color";
    grupo.add(malla);
  }
}
