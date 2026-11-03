// Personaje provisional hecho con código (cabeza, cuerpo, brazos y piernas) y sus animaciones.
// Cuando lleguen los modelos de Kenney/KayKit, solo cambia crearCuerpo(): el controlador
// (cola de acciones, caminos, posturas) queda igual.

import * as THREE from "three";
import { planDeTransicion } from "./maquina.js";
import { camino, longitudCamino, puntoEnCamino, huella } from "./disposicion.js";
import { aspecto, COLOR_ESTADO } from "./paleta.js";

const VELOCIDAD = 1.3; // m/s al caminar
const DURACION = { sentarse: 0.55, levantarse: 0.55, celebrar: 1.8 };
const ALTURA_CADERA = 0.36;
const ALTURA_SENTADO = 0.36; // el asiento está a 0.32 m

/** Geometrías compartidas por todos los personajes (se liberan una sola vez). */
export function crearGeometriasPersonaje(recursos) {
  const g = (geo) => recursos.agregar(geo);
  return {
    pierna: g(new THREE.BoxGeometry(0.11, 0.34, 0.12).translate(0, -0.17, 0)),
    cuerpo: g(new THREE.BoxGeometry(0.34, 0.36, 0.22).translate(0, 0.18, 0)),
    brazo: g(new THREE.BoxGeometry(0.09, 0.3, 0.09).translate(0, -0.15, 0)),
    mano: g(new THREE.SphereGeometry(0.055, 8, 6)),
    cabeza: g(new THREE.SphereGeometry(0.21, 16, 12)),
    pelo: g(new THREE.SphereGeometry(0.225, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.55)),
    ojo: g(new THREE.SphereGeometry(0.025, 6, 4)),
    sombra: g(new THREE.CircleGeometry(0.28, 20).rotateX(-Math.PI / 2)),
    anillo: g(new THREE.RingGeometry(0.32, 0.4, 28).rotateX(-Math.PI / 2)),
    anilloEstado: g(new THREE.RingGeometry(0.2, 0.3, 28).rotateX(-Math.PI / 2)),
  };
}

function crearCuerpo(geo, recursos, id, texturaSombra) {
  const a = aspecto(huella(id));
  const m = (color) => recursos.agregar(new THREE.MeshLambertMaterial({ color }));
  const ropa = m(a.ropa);
  const piel = m(a.piel);
  const pelo = m(a.pelo);
  const pantalon = m(0x2a2f3d);
  const ojos = m(0x111111);

  const raiz = new THREE.Group();
  const cadera = new THREE.Group();
  cadera.position.y = ALTURA_CADERA;
  raiz.add(cadera);

  const piernaI = new THREE.Group();
  const piernaD = new THREE.Group();
  piernaI.position.set(-0.08, 0, 0);
  piernaD.position.set(0.08, 0, 0);
  piernaI.add(new THREE.Mesh(geo.pierna, pantalon));
  piernaD.add(new THREE.Mesh(geo.pierna, pantalon));
  cadera.add(piernaI, piernaD);

  const torso = new THREE.Group();
  cadera.add(torso);
  torso.add(new THREE.Mesh(geo.cuerpo, ropa));

  const brazo = (lado) => {
    const p = new THREE.Group();
    p.position.set(lado * 0.22, 0.33, 0);
    p.add(new THREE.Mesh(geo.brazo, ropa));
    const mano = new THREE.Mesh(geo.mano, piel);
    mano.position.y = -0.31;
    p.add(mano);
    torso.add(p);
    return p;
  };
  const brazoI = brazo(-1);
  const brazoD = brazo(1);

  const cabeza = new THREE.Group();
  cabeza.position.y = 0.58;
  cabeza.add(new THREE.Mesh(geo.cabeza, piel));
  const capa = new THREE.Mesh(geo.pelo, pelo);
  capa.rotation.x = -0.25;
  capa.position.y = 0.02;
  cabeza.add(capa);
  for (const lado of [-1, 1]) {
    const ojo = new THREE.Mesh(geo.ojo, ojos);
    ojo.position.set(lado * 0.07, 0.0, 0.195);
    cabeza.add(ojo);
  }
  torso.add(cabeza);

  const sombra = new THREE.Mesh(geo.sombra, recursos.agregar(new THREE.MeshBasicMaterial({
    map: texturaSombra, transparent: true, depthWrite: false, opacity: 0.55,
  })));
  sombra.position.y = 0.012;
  raiz.add(sombra);

  const c = { raiz, cadera, torso, cabeza, piernaI, piernaD, brazoI, brazoD };
  return { raiz, aplicar: (pose) => aplicarProvisional(c, pose) };
}

/** Traduce la pose pedida por el controlador a las piezas del personaje provisional. */
function aplicarProvisional(c, { base, s, gesto, t, r }) {
  reposo(c);
  if (base === "caminar") return caminar(c, t);
  if (base === "sentandose") return sentar(c, suave(s));
  if (base === "sentado") sentar(c, 1);
  if (gesto === "celebrar") celebrar(c, t);
  else if (gesto === "teclear") teclear(c, r);
  else if (gesto === "reposo") respirar(c, r, base === "sentado");
  else if (gesto === "alerta") alerta(c, r);
  else if (gesto === "levantar_mano") levantarMano(c, r);
}

/**
 * Un personaje en su puesto. Recibe la animación 3D que ya decidió el núcleo
 * (estados.js → animacion3d) y la convierte en una cola de acciones.
 */
export class Personaje {
  constructor({ agente, puesto, cuarto, geo, recursos, texturaSombra, burbujas, anillosEstado = null, retraso = 0, fabricarCuerpo = null }) {
    this.id = agente.id;
    // Cuerpo: el modelo de Kenney si se cargó; si no, el provisional hecho con código.
    this.cuerpo = fabricarCuerpo?.(agente.id) ?? crearCuerpo(geo, recursos, agente.id, texturaSombra);
    this.raiz = this.cuerpo.raiz;
    this.raiz.visible = false;
    this.raiz.userData.seleccion = { tipo: "agente", id: agente.id };
    this.camino = camino(cuarto, puesto);
    this.longitud = longitudCamino(this.camino);
    this.silla = this.camino[this.camino.length - 1];
    this.burbujas = burbujas;
    this.fase = (huella(agente.id) % 1000) / 1000 * Math.PI * 2; // para que no se muevan al unísono

    this.anillo = new THREE.Mesh(geo.anillo, recursos.agregar(new THREE.MeshBasicMaterial({ color: 0xffd89a, transparent: true, opacity: 0.9 })));
    this.anillo.position.y = 0.02;
    this.anillo.visible = false;
    this.raiz.add(this.anillo);

    // Anillo de estado en el piso (color del estado real; más visible de noche). Comparte material por estado.
    this.anillosEstado = anillosEstado;
    if (anillosEstado) {
      this.anilloEstado = new THREE.Mesh(geo.anilloEstado, anillosEstado.get("sin_datos"));
      this.anilloEstado.position.y = 0.012;
      this.anilloEstado.renderOrder = 1;
      this.raiz.add(this.anilloEstado);
    }

    this.burbuja = new THREE.Sprite(burbujas.material("sin_datos"));
    this.burbuja.scale.set(0.34, 0.34, 1);
    this.burbuja.position.y = 1.32;
    this.raiz.add(this.burbuja);

    this.animacion = null; // animación de destino ya planeada
    this.pendiente = null;  // animación que llegó mientras ejecutaba otra
    this.cola = [];
    this.accion = null;
    this.t = 0;
    this.bucle = null;
    this.postura = "fuera";
    this.lado = 0;
    this.retraso = retraso; // segundos antes de la primera acción: no entran todos amontonados
    this.actualizar(agente);
  }

  /** Nuevo dato del modelo. Si está a media acción, la nueva animación espera su turno. */
  actualizar(agente) {
    this.estado = agente.estado;
    this.burbuja.material = this.burbujas.material(agente.estado);
    if (this.anilloEstado) this.anilloEstado.material = this.anillosEstado.get(agente.estado) ?? this.anillosEstado.get("sin_datos");
    const nueva = agente.apariencia.animacion3d;
    if (this.accion || this.cola.length) {
      this.pendiente = nueva;
      return;
    }
    this.planear(nueva);
  }

  planear(nueva) {
    if (nueva === this.animacion) return;
    const plan = planDeTransicion(this.animacion, nueva);
    this.animacion = nueva;
    this.cola = plan.pasos.slice();
    this.bucleSiguiente = plan.bucle;
    this.presenteAlFinal = plan.presente;
    if (this.cola.length === 0) this.bucle = plan.bucle;
    this.siguiente();
  }

  siguiente() {
    this.accion = this.cola.shift() ?? null;
    this.t = 0;
    if (!this.accion) {
      this.bucle = this.bucleSiguiente ?? this.bucle;
      if (this.presenteAlFinal === false) this.raiz.visible = false;
      if (this.pendiente) {
        const p = this.pendiente;
        this.pendiente = null;
        this.planear(p);
      }
      return;
    }
    if (this.accion === "entrar") this.raiz.visible = true;
  }

  seleccionar(activo) {
    this.anillo.visible = activo;
  }

  /** Avanza la animación dt segundos; reloj = tiempo total (para bucles). */
  paso(dt, reloj) {
    if (this.retraso > 0) {
      this.retraso -= dt;
      if (this.accion === "entrar") this.raiz.visible = false;
      return;
    }
    if (this.accion === "entrar") this.raiz.visible = true;
    if (!this.raiz.visible) return;
    const a = this.accion;
    this.t += dt;
    let terminada = false;
    const pose = { base: "de_pie", s: 0, gesto: null, t: this.t, r: reloj + this.fase };

    if (a === "entrar" || a === "salir") {
      const d = a === "entrar" ? this.t * VELOCIDAD : this.longitud - this.t * VELOCIDAD;
      const p = puntoEnCamino(this.camino, d);
      // al salir camina en sentido contrario
      const angulo = a === "salir" ? p.angulo + Math.PI : p.angulo;
      this.raiz.position.set(p.x, 0, p.z);
      this.raiz.rotation.y = angulo;
      pose.base = "caminar";
      this.postura = "de_pie";
      terminada = this.t * VELOCIDAD >= this.longitud;
      if (terminada && a === "entrar") this.raiz.rotation.y = Math.PI;
      if (terminada && a === "salir") this.postura = "fuera";
    } else if (a === "sentarse" || a === "levantarse") {
      const k = Math.min(1, this.t / DURACION[a]);
      this.colocarEnSilla();
      pose.base = "sentandose";
      pose.s = a === "sentarse" ? k : 1 - k;
      terminada = k >= 1;
      if (terminada) this.postura = a === "sentarse" ? "sentado" : "de_pie";
    } else if (a === "celebrar") {
      this.colocarEnSilla();
      pose.gesto = "celebrar";
      terminada = this.t >= DURACION.celebrar;
    } else {
      // En bucle según la postura final.
      this.colocarEnSilla();
      pose.base = this.postura === "sentado" ? "sentado" : "de_pie";
      pose.gesto = this.bucle;
    }
    // De pie en su lugar (error, celebración) se hace a un lado de la silla, deslizándose.
    const objetivo = pose.base === "de_pie" && a !== "entrar" && a !== "salir" ? 1 : 0;
    this.lado += (objetivo - this.lado) * Math.min(1, dt * 5);
    if (a !== "entrar" && a !== "salir") this.raiz.position.x += this.lado * 0.55;
    this.cuerpo.aplicar(pose, dt);
    if (terminada) this.siguiente();
  }

  colocarEnSilla() {
    this.raiz.position.set(this.silla.x, 0, this.silla.z);
    this.raiz.rotation.y = Math.PI; // mira al escritorio (-Z)
  }
}

// --- Posturas (todas en código, sin archivos de animación) ---

const suave = (x) => x * x * (3 - 2 * x);

function reposo(c) {
  c.cadera.position.y = ALTURA_CADERA;
  c.cadera.position.z = 0;
  c.torso.rotation.set(0, 0, 0);
  c.torso.position.y = 0;
  c.cabeza.rotation.set(0, 0, 0);
  for (const p of [c.piernaI, c.piernaD, c.brazoI, c.brazoD]) p.rotation.set(0, 0, 0);
}

function caminar(c, t) {
  const s = Math.sin(t * 9);
  c.piernaI.rotation.x = s * 0.6;
  c.piernaD.rotation.x = -s * 0.6;
  c.brazoI.rotation.x = -s * 0.5;
  c.brazoD.rotation.x = s * 0.5;
  c.cadera.position.y = ALTURA_CADERA + Math.abs(Math.cos(t * 9)) * 0.03;
}

/** s = 0 de pie, s = 1 sentado. */
function sentar(c, s) {
  c.cadera.position.y = ALTURA_CADERA + (ALTURA_SENTADO - ALTURA_CADERA) * s;
  c.cadera.position.z = -0.08 * s; // se recorre hacia el respaldo
  c.piernaI.rotation.x = -Math.PI / 2 * s;
  c.piernaD.rotation.x = -Math.PI / 2 * s;
}

function teclear(c, r) {
  c.torso.rotation.x = 0.12;
  c.brazoI.rotation.x = -1.15 + Math.sin(r * 14) * 0.08;
  c.brazoD.rotation.x = -1.15 + Math.sin(r * 14 + 1.7) * 0.08;
  c.cabeza.rotation.x = 0.1 + Math.sin(r * 0.7) * 0.03;
}

function respirar(c, r, sentado) {
  const b = Math.sin(r * 1.6);
  c.torso.position.y = b * 0.008;
  c.torso.rotation.x = sentado ? -0.12 : 0; // recargado en el respaldo
  c.brazoI.rotation.z = -0.15;
  c.brazoD.rotation.z = 0.15;
  c.cabeza.rotation.y = Math.sin(r * 0.35) * 0.35; // mira alrededor, despacio
}

function celebrar(c, t) {
  const salto = Math.max(0, Math.sin(t * 7));
  c.cadera.position.y = ALTURA_CADERA + salto * 0.08;
  c.brazoI.rotation.x = -Math.PI + 0.2;
  c.brazoD.rotation.x = -Math.PI + 0.2;
  c.brazoI.rotation.z = -0.35 - salto * 0.2;
  c.brazoD.rotation.z = 0.35 + salto * 0.2;
  c.cabeza.rotation.x = -0.2;
}

function alerta(c, r) {
  c.torso.rotation.y = Math.sin(r * 2.2) * 0.25; // voltea inquieto
  c.brazoD.rotation.x = -0.9;
  c.brazoD.rotation.z = 0.3;
  c.brazoI.rotation.z = -0.2;
  c.cabeza.rotation.y = Math.sin(r * 2.2) * 0.3;
  c.cadera.position.y = ALTURA_CADERA + Math.abs(Math.sin(r * 4.4)) * 0.015;
}

function levantarMano(c, r) {
  c.brazoD.rotation.x = -Math.PI + 0.15;
  c.brazoD.rotation.z = 0.25 + Math.sin(r * 6) * 0.25; // saluda
  c.brazoI.rotation.x = -0.9;
  c.cabeza.rotation.x = -0.15;
}

/** Iconos sobre la cabeza (uno por estado, compartidos por todos los personajes). */
export function crearBurbujas(recursos, ESTADOS) {
  const cache = new Map();
  return {
    material(estado) {
      if (cache.has(estado)) return cache.get(estado);
      const lienzo = document.createElement("canvas");
      lienzo.width = lienzo.height = 64;
      const ctx = lienzo.getContext("2d");
      const color = `#${COLOR_ESTADO[estado].toString(16).padStart(6, "0")}`;
      ctx.fillStyle = "#0f1526";
      ctx.beginPath();
      ctx.arc(32, 32, 29, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = color;
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.font = "bold 32px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(ESTADOS[estado].icono, 32, 34);
      const tex = recursos.agregar(new THREE.CanvasTexture(lienzo));
      tex.colorSpace = THREE.SRGBColorSpace;
      const mat = recursos.agregar(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
      cache.set(estado, mat);
      return mat;
    },
  };
}
