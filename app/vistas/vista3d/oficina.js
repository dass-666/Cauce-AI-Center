// Un departamento como cuarto de oficina: piso, mamparas, escritorios, computadoras, sillas,
// letrero y personajes. Todo el mobiliario se hace con código (sin modelos descargados).

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { tamanoCuarto, puestos, puerta } from "./disposicion.js";
import { COLOR_ESTADO, OFICINA } from "./paleta.js";
import { Personaje } from "./personaje.js";
import { Recursos } from "./recursos.js";
import { dibujarIcono, hex } from "./iconos.js";

const ALTO_ESCRITORIO = 0.6;

/**
 * @param opciones.cuarto   tamaño fijo {ancho, fondo} (en el edificio lo decide plano-edificio.js)
 * @param opciones.altoMuro alto de los muros: 1.5 en la vista individual, más bajo en el edificio
 * @param opciones.base     dibujar la base del diorama (solo en la vista individual)
 * @param opciones.acento   color propio del departamento (alfombra, franja y letrero)
 * @param opciones.tema     tema del departamento (identidad.js): muebles y símbolo propios
 */
export function crearOficina(dep, modelo, compartido, opciones = {}) {
  const ALTO_MURO = opciones.altoMuro ?? 1.5;
  const recursos = new Recursos();
  const grupo = new THREE.Group();
  grupo.userData.seleccion = { tipo: "departamento", id: dep.id };
  const cuarto = opciones.cuarto ?? tamanoCuarto(dep.posicion, modelo.cuadricula.metros_por_celda, Math.max(1, dep.agentes.length));
  const lugares = puestos(Math.max(1, dep.agentes.length), cuarto);
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
  if (opciones.base !== false) {
    const base = new THREE.Mesh(caja(W + 0.6, 0.3, F + 0.6), m.base);
    base.position.y = -0.19; // su cara superior queda bajo el piso (evita parpadeo entre superficies)
    grupo.add(base);
  }
  // Piso de duela: una textura compartida que se repite según el tamaño del cuarto.
  const geoPiso = caja(W, 0.04, F);
  const uv = geoPiso.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * W / 2, uv.getY(i) * F / 2);
  const piso = new THREE.Mesh(geoPiso, compartido.matPiso);
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
  const muroFondo = new THREE.Mesh(caja(W, ALTO_MURO, 0.12), m.pared);
  muroFondo.position.set(0, ALTO_MURO / 2, -F / 2 - 0.06);
  const muroIzq = new THREE.Mesh(caja(0.12, ALTO_MURO, F), m.pared);
  muroIzq.position.set(-W / 2 - 0.06, ALTO_MURO / 2, 0);
  grupo.add(muroFondo, muroIzq);
  if (acento !== null) {
    const franja = mat(acento);
    const f1 = new THREE.Mesh(caja(W + 0.12, 0.06, 0.14), franja);
    f1.position.set(0, ALTO_MURO + 0.03, -F / 2 - 0.06);
    const f2 = new THREE.Mesh(caja(0.14, 0.06, F + 0.12), franja);
    f2.position.set(-W / 2 - 0.06, ALTO_MURO + 0.03, 0);
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
    respaldo: caja(0.42, 0.26, 0.06), // bajo, para no tapar al personaje sentado
    poste: recursos.agregar(new THREE.CylinderGeometry(0.03, 0.03, 0.26, 8)),
    ruedas: recursos.agregar(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 10)),
    taza: recursos.agregar(new THREE.CylinderGeometry(0.04, 0.035, 0.09, 10)),
  };
  const pantallas = [];
  lugares.forEach((l, i) => {
    const puesto = new THREE.Group();
    puesto.position.set(l.x, 0, l.z);
    const agente = dep.agentes[i] ?? null;

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
    pantalla.userData.dinamico = true; // cambia de color: no se fusiona
    if (agente) pantalla.userData.seleccion = { tipo: "agente", id: agente.id };
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
    respaldo.position.set(0, 0.46, 0.2);
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
  agregarTema(grupo, opciones.tema ?? "", W, F, caja, mat, m, acento ?? OFICINA.brillo, (g) => recursos.agregar(g));

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

  // Personajes.
  const personajes = dep.agentes.map((agente, i) => new Personaje({
    agente, puesto: lugares[i], cuarto, retraso: i * 0.9,
    fabricarCuerpo: compartido.catalogo ? (id) => compartido.catalogo.fabricar(id, recursos) : null,
    geo: compartido.geoPersonaje, recursos, texturaSombra: compartido.texturaSombra, burbujas: compartido.burbujas,
    anillosEstado: compartido.anillosEstado ?? null,
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
    torreta.mostrar(depNuevo.alertas, modeloNuevo.conexion === "en_linea");
  }
  actualizar(dep, modelo);

  return {
    grupo,
    cuarto,
    personajes,
    actualizar,
    paso(dt, reloj) {
      for (const per of personajes) per.paso(dt, reloj);
      torreta.paso(reloj);
    },
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
    paso(reloj) {
      if (parpadea) material.color.setHex(Math.floor(reloj * 2) % 2 ? color : 0x3a1010);
    },
  };
}

/** Muebles propios de cada tema (solo decoración; se fusionan con lo demás del cuarto). */
function agregarTema(grupo, tema, W, F, caja, mat, m, acento, reg) {
  const poner = (geo, material, x, y, z) => { const o = new THREE.Mesh(geo, material); o.position.set(x, y, z); grupo.add(o); return o; };
  const xi = -W / 2, zf = -F / 2;
  const a = mat(acento);
  switch (tema) {
    case "importacion": { // cajas sobre una tarima
      poner(caja(1.1, 0.12, 0.9), m.maderaOscura, xi + 0.75, 0.06, zf + 0.6);
      const carton = mat(0xc49a6c);
      for (const [x, y, z, s] of [[-0.2, 0.32, -0.15, 0.4], [0.22, 0.32, -0.15, 0.4], [0.0, 0.32, 0.2, 0.4], [0.0, 0.72, -0.05, 0.36]]) poner(caja(s, s, s), carton, xi + 0.75 + x, y, zf + 0.6 + z);
      poner(caja(0.42, 0.04, 0.02), a, xi + 0.75, 0.52, zf + 0.81);
      break;
    }
    case "busqueda": { // mapa con marcadores en el muro izquierdo
      poner(caja(0.04, 0.6, 1.3), mat(0x9fc4d8), xi + 0.03, 0.62, -0.2);
      poner(caja(0.05, 0.05, 1.35), a, xi + 0.04, 0.3, -0.2);
      for (const [y, z] of [[0.75, -0.6], [0.55, -0.1], [0.7, 0.25]]) poner(caja(0.06, 0.07, 0.07), a, xi + 0.07, y, z);
      break;
    }
    case "fuentes": { // dos archiveros
      for (const dz of [0, 0.5]) {
        poner(caja(0.5, 0.9, 0.45), m.metal, xi + 0.35, 0.45, zf + 0.5 + dz);
        poner(caja(0.02, 0.02, 0.3), a, xi + 0.61, 0.7, zf + 0.5 + dz);
        poner(caja(0.02, 0.02, 0.3), a, xi + 0.61, 0.4, zf + 0.5 + dz);
      }
      break;
    }
    case "oportunidades": { // diana en el muro izquierdo (símbolo, no datos)
      for (const [rad, color, dx] of [[0.42, acento, 0.03], [0.28, 0xe8ecf5, 0.045], [0.12, acento, 0.06]]) {
        poner(reg(new THREE.CylinderGeometry(rad, rad, 0.02, 20).rotateZ(Math.PI / 2)), mat(color), xi + dx, 0.75, -0.2);
      }
      break;
    }
    case "margenes": { // pilas de monedas sobre un mueble bajo
      poner(caja(1.0, 0.55, 0.4), m.maderaOscura, xi + 0.75, 0.275, zf + 0.3);
      const oro = mat(0xe7c25a);
      [[0, 4], [0.22, 2], [-0.22, 3]].forEach(([dx, n]) => poner(reg(new THREE.CylinderGeometry(0.08, 0.08, 0.035 * n, 14)), oro, xi + 0.75 + dx, 0.55 + 0.0175 * n, zf + 0.3));
      break;
    }
    case "auditoria": { // librero con carpetas
      poner(caja(1.0, 0.7, 0.32), m.maderaOscura, xi + 0.75, 0.35, zf + 0.25);
      [acento, 0x4fb3ff, 0xe8ecf5, acento, 0x8ea0c4].forEach((color, i) => poner(caja(0.11, 0.26, 0.22), mat(color), xi + 0.37 + i * 0.15, 0.83, zf + 0.25));
      break;
    }
    case "supervision": { // consola con tres monitores APAGADOS (no muestran datos)
      poner(caja(1.6, 0.08, 0.5), m.madera, xi + 1.1, 0.75, zf + 0.35);
      poner(caja(1.5, 0.7, 0.4), m.maderaOscura, xi + 1.1, 0.36, zf + 0.35);
      const negro = mat(OFICINA.pantallaApagada);
      for (const dx of [-0.5, 0, 0.5]) poner(caja(0.42, 0.28, 0.03), negro, xi + 1.1 + dx, 1.0, zf + 0.2);
      poner(caja(1.5, 0.03, 0.03), a, xi + 1.1, 1.17, zf + 0.2);
      break;
    }
    case "integracion": { // gabinete de servidores (luces fijas: no indican tráfico)
      poner(caja(0.6, 1.2, 0.55), m.metal, xi + 0.4, 0.6, zf + 0.45);
      for (const y of [0.35, 0.6, 0.85, 1.1]) poner(caja(0.45, 0.03, 0.02), a, xi + 0.4, y, zf + 0.73);
      break;
    }
    default: { // pizarrón genérico
      poner(caja(0.04, 0.6, 1.2), mat(0xe8ecf5), xi + 0.03, 0.85, -0.2);
      poner(caja(0.05, 0.05, 1.25), a, xi + 0.04, 0.53, -0.2);
    }
  }
}

/** Junta en una sola malla por material todo lo estático del cuarto (no personajes, pantallas ni letrero). */
export function fusionarEstaticos(grupo, recursos) {
  grupo.updateMatrixWorld(true);
  const inversa = grupo.matrixWorld.clone().invert();
  const porMaterial = new Map();
  const quitar = [];
  grupo.traverse((o) => {
    if (!o.isMesh || o.userData.dinamico || o.isSkinnedMesh) return;
    for (let p = o.parent; p && p !== grupo; p = p.parent) if (p.userData.dinamico) return;
    const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone());
    for (const nombre of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(nombre)) g.deleteAttribute(nombre);
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inversa, o.matrixWorld));
    const lista = porMaterial.get(o.material) ?? [];
    lista.push({ g, orden: o.renderOrder });
    porMaterial.set(o.material, lista);
    quitar.push(o);
  });
  for (const o of quitar) o.removeFromParent();
  for (const [material, lista] of porMaterial) {
    const fusion = mergeGeometries(lista.map((x) => x.g));
    for (const x of lista) x.g.dispose();
    if (!fusion) continue;
    const malla = new THREE.Mesh(recursos.agregar(fusion), material);
    malla.renderOrder = Math.max(...lista.map((x) => x.orden));
    grupo.add(malla);
  }
}
