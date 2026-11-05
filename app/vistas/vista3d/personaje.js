// Personaje provisional hecho con código (cabeza, cuerpo, brazos y piernas) y sus animaciones.
// Cuando lleguen los modelos de Kenney/KayKit, solo cambia crearCuerpo(): el controlador
// (cola de acciones, caminos, posturas) queda igual.

import * as THREE from "three";
import { planDeTransicion, variacion, gestoOcasional, faseTrabajo, girarHacia } from "./maquina.js";

/** Gira hacia `objetivo` sin pasar de GIRO_MAXIMO rad/s. */
function girar(actual, objetivo, dt) {
  const meta = girarHacia(actual, objetivo, 1);
  const paso = Math.max(-GIRO_MAXIMO * dt, Math.min(GIRO_MAXIMO * dt, (meta - actual) * Math.min(1, dt * GIRO)));
  return actual + paso;
}
import { camino, longitudCamino, puntoEnCamino, huella } from "./disposicion.js";
import { aspecto, COLOR_ESTADO } from "./paleta.js";

const VELOCIDAD = 1.3; // m/s al caminar
// Fase L: la celebración es un gesto breve de satisfacción (1.4 s, sin saltos), no una fiesta.
const DURACION = { sentarse: 0.6, levantarse: 0.6, celebrar: 1.4, reaccion_error: 1.4, llamar_atencion: 1.8 };
const GIRO = 8; // qué tan rápido gira hacia donde camina o hacia el escritorio (1/s)
const GIRO_MAXIMO = 4.5; // rad/s: un cuarto de vuelta toma ~0.35 s (no se voltea de golpe aunque haya pocos cuadros)
const GESTOS = new Set(["celebrar", "reaccion_error", "llamar_atencion"]);
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
function aplicarProvisional(c, { base, s, gesto, t, r, o = 0, fase = "teclear", k = 1, quieto = false }) {
  reposo(c);
  if (base === "caminar") return caminar(c, quieto ? 0 : t);
  if (base === "sentandose") return sentar(c, suave(s));
  if (base === "sentado") sentar(c, 1);
  if (gesto === "celebrar") celebrar(c, t);
  else if (gesto === "teclear") { teclear(c, r, quieto); c.cabeza.rotation.x -= 0.2 * o; pausaTrabajo(c, fase, k, r); } // a veces levanta la vista a la pantalla
  else if (gesto === "reposo") respirar(c, r, base === "sentado");
  else if (gesto === "relajado") { respirar(c, r * 0.7, true); c.torso.rotation.x = -0.2; c.cabeza.rotation.x = -0.1; }
  else if (gesto === "alerta") alerta(c, r, o);
  else if (gesto === "reaccion_error") { alerta(c, r, 1); c.cabeza.rotation.y = Math.sin(t * 12) * 0.4 * Math.max(0, 1 - t / 1.4); }
  else if (gesto === "llamar_atencion") levantarMano(c, t);
  else if (gesto === "atencion") { c.brazoD.rotation.x = -1.6 - 1.2 * o; c.brazoD.rotation.z = 0.15 + 0.1 * o; c.cabeza.rotation.x = -0.1; } // fase L: la mano queda arriba mientras pida revisión
}

/**
 * Un personaje en su puesto. Recibe la animación 3D que ya decidió el núcleo
 * (estados.js → animacion3d) y la convierte en una cola de acciones.
 */
export class Personaje {
  constructor({ agente, puesto, cuarto, geo, recursos, texturaSombra, burbujas, anillosEstado = null, retraso = 0, fabricarCuerpo = null, todos = [], quieto = () => false }) {
    this.id = agente.id;
    // Cuerpo: el modelo de Kenney si se cargó; si no, el provisional hecho con código.
    this.cuerpo = fabricarCuerpo?.(agente.id) ?? crearCuerpo(geo, recursos, agente.id, texturaSombra);
    this.raiz = this.cuerpo.raiz;
    this.raiz.visible = false;
    this.raiz.userData.seleccion = { tipo: "agente", id: agente.id };
    this.camino = camino(cuarto, puesto, todos); // fase L: rodea los escritorios de enfrente
    this.quieto = quieto; // «reducir movimiento» del sistema: posturas fijas, sin balanceos
    this.longitud = longitudCamino(this.camino);
    this.silla = this.camino[this.camino.length - 1];
    this.burbujas = burbujas;
    this.variacion = variacion(huella(agente.id)); // ritmo, fase y periodo propios: nadie se mueve al unísono

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
    this.recorrido = 0;
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
    // Fase L: error y revisión se ven un poco más grandes (piden atención), sin parpadear.
    const s = agente.estado === "error" || agente.estado === "requiere_revision" ? 0.44 : 0.34;
    this.burbuja.scale.set(s, s, 1);
    if (this.anilloEstado) this.anilloEstado.material = this.anillosEstado.get(agente.estado) ?? this.anillosEstado.get("sin_datos");
    // Con clasificación (naturaleza.js) manda animacion_mostrada: un módulo, un puesto humano o un
    // reactivo sin registro nuevo observado quedan "ausente" aunque su estado tenga postura.
    const nueva = agente.animacion_mostrada ?? agente.apariencia.animacion3d;
    if (this.accion || this.cola.length) {
      this.pendiente = nueva;
      return;
    }
    this.planear(nueva);
  }

  planear(nueva) {
    if (nueva === this.animacion) return;
    const primera = this.animacion === null;
    const plan = planDeTransicion(this.animacion, nueva);
    if (primera) {
      // Primera lectura (o escena recién construida): ya está en su lugar, sin caminar ni gestos.
      this.postura = plan.postura;
      this.raiz.visible = plan.presente;
      this.retraso = 0;
      if (plan.presente) this.colocarEnSilla();
    }
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
    if (this.accion === "entrar" || this.accion === "salir") this.recorrido = 0;
  }

  seleccionar(activo) {
    this.anillo.visible = activo;
  }

  /** Avanza la animación dt segundos; reloj = tiempo total (para bucles). */
  paso(dt, reloj) {
    if (this.retraso > 0 && this.accion === "entrar") { // varias llegadas observadas a la vez: no entran amontonados
      this.retraso -= dt;
      this.raiz.visible = false;
      return;
    }
    if (this.accion === "entrar") this.raiz.visible = true;
    if (!this.raiz.visible) return;
    const a = this.accion;
    this.t += dt;
    let terminada = false;
    const v = this.variacion;
    const quieto = this.quieto();
    // Con «reducir movimiento» el reloj de los bucles se congela: posturas fijas, sin balanceo ni tecleo visible.
    const r = quieto ? v.fase : reloj * v.ritmo + v.fase;
    const pose = { base: "de_pie", s: 0, gesto: null, t: this.t, r, o: 0, fase: "teclear", k: 1, quieto };

    if (a === "entrar" || a === "salir") {
      // Fase L: arranca y llega despacio (sin saltar de 0 a la velocidad completa) y gira hacia donde camina.
      const restante = this.longitud - this.recorrido;
      const factor = Math.min(1, 0.35 + this.t / 0.4, 0.35 + restante / 0.5);
      this.recorrido = Math.min(this.longitud, this.recorrido + VELOCIDAD * factor * dt);
      const d = a === "entrar" ? this.recorrido : this.longitud - this.recorrido;
      const p = puntoEnCamino(this.camino, d);
      const angulo = a === "salir" ? p.angulo + Math.PI : p.angulo; // al salir camina en sentido contrario
      this.raiz.position.set(p.x, 0, p.z);
      this.raiz.rotation.y = quieto ? angulo : girar(this.raiz.rotation.y, angulo, dt);
      pose.base = "caminar";
      this.postura = "de_pie";
      terminada = this.recorrido >= this.longitud - 1e-6;
      if (terminada && a === "salir") this.postura = "fuera";
    } else if (a === "sentarse" || a === "levantarse") {
      const k = Math.min(1, this.t / DURACION[a]);
      this.colocarEnSilla(dt, quieto);
      pose.base = "sentandose";
      pose.s = a === "sentarse" ? k : 1 - k;
      terminada = k >= 1;
      if (terminada) this.postura = a === "sentarse" ? "sentado" : "de_pie";
    } else if (GESTOS.has(a)) {
      // Gesto de transición: solo llega aquí si se observó el cambio entre dos lecturas (maquina.js).
      this.colocarEnSilla(dt, quieto);
      pose.base = this.postura === "sentado" ? "sentado" : "de_pie";
      pose.gesto = a;
      terminada = this.t >= DURACION[a];
    } else {
      // En bucle según la postura final, con un pequeño gesto ocasional propio de cada personaje.
      this.colocarEnSilla(dt, quieto);
      pose.base = this.postura === "sentado" ? "sentado" : "de_pie";
      pose.gesto = this.bucle;
      pose.o = quieto ? 0 : gestoOcasional(reloj, v);
      if (this.bucle === "teclear" && !quieto) Object.assign(pose, faseTrabajo(reloj, v)); // fase L: pausas para leer, mirar, acomodarse
    }
    this.fase = pose.gesto === "teclear" ? pose.fase : null;
    // De pie en su lugar (error, celebración) se hace a un lado de la silla, deslizándose.
    const objetivo = pose.base === "de_pie" && a !== "entrar" && a !== "salir" ? 1 : 0;
    this.lado += (objetivo - this.lado) * (quieto ? 1 : Math.min(1, dt * 5));
    if (a !== "entrar" && a !== "salir") this.raiz.position.x += this.lado * 0.55;
    this.cuerpo.aplicar(pose, dt);
    if (terminada) this.siguiente();
  }

  /** En su lugar, mirando al escritorio. Fase L: si venía caminando, termina de girar suave (sin saltar). */
  colocarEnSilla(dt = 0, quieto = true) {
    this.raiz.position.set(this.silla.x, 0, this.silla.z);
    this.raiz.rotation.y = dt > 0 && !quieto ? girar(this.raiz.rotation.y, Math.PI, dt) : Math.PI; // mira al escritorio (-Z)
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

function teclear(c, r, quieto = false) {
  const g = quieto ? 0 : 0.08;
  c.torso.rotation.x = 0.12;
  c.brazoI.rotation.x = -1.15 + Math.sin(r * 14) * g;
  c.brazoD.rotation.x = -1.15 + Math.sin(r * 14 + 1.7) * g;
  c.cabeza.rotation.x = 0.1 + Math.sin(r * 0.7) * 0.03;
}

/** Fase L: pausas dentro del trabajo (leer, mirar a un lado, acomodarse); k = cuánto de la pausa. */
function pausaTrabajo(c, fase, k, r) {
  if (fase === "teclear" || k <= 0) return;
  if (fase === "leer") { c.torso.rotation.x -= 0.18 * k; c.brazoI.rotation.x += 0.45 * k; c.brazoD.rotation.x += 0.45 * k; c.cabeza.rotation.x -= 0.12 * k + Math.sin(r * 1.3) * 0.03 * k; }
  else if (fase === "mirar") { c.cabeza.rotation.y += 0.55 * k; c.torso.rotation.y += 0.12 * k; }
  else if (fase === "acomodarse") { c.torso.rotation.x -= 0.25 * k; c.brazoD.rotation.x += 0.6 * k; c.brazoI.rotation.x += 0.6 * k; c.cabeza.rotation.z = Math.sin(r * 2) * 0.12 * k; }
}

function respirar(c, r, sentado) {
  const b = Math.sin(r * 1.6);
  c.torso.position.y = b * 0.008;
  c.torso.rotation.x = sentado ? -0.12 : 0; // recargado en el respaldo
  c.brazoI.rotation.z = -0.15;
  c.brazoD.rotation.z = 0.15;
  c.cabeza.rotation.y = Math.sin(r * 0.35) * 0.35; // mira alrededor, despacio
}

/** Fase L: gesto breve de satisfacción (puño arriba una vez y asiente), sin saltar; vuelve a neutral al final. */
function celebrar(c, t) {
  const k = Math.sin(Math.min(1, t / 1.4) * Math.PI); // sube y baja una sola vez
  c.brazoD.rotation.x = -2.4 * k;
  c.brazoD.rotation.z = 0.25 * k;
  c.cabeza.rotation.x = -0.15 * k + Math.sin(t * 8) * 0.06 * k;
}

function alerta(c, r, o = 0) {
  // Fase L: de pie junto al escritorio, inclinado hacia la pantalla con las manos al frente (atiende el error);
  // de vez en cuando se lleva la mano a la cabeza y niega despacio. Visible, pero sin dramatismo.
  c.torso.rotation.x = 0.16;
  c.torso.rotation.y = Math.sin(r * 0.6) * 0.05;
  c.brazoD.rotation.x = -1.0 - 1.5 * o;
  c.brazoD.rotation.z = 0.1 + 0.4 * o;
  c.brazoI.rotation.x = -1.0;
  c.cabeza.rotation.x = 0.2;
  c.cabeza.rotation.y = Math.sin(r * 5) * 0.22 * o;
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
