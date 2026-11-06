// Vista 3D: el edificio completo (todos los departamentos) o un solo cuarto. Misma interfaz que la 2D:
//   const vista = crearVista3D(contenedor, { alSeleccionar, alFallar });
//   vista.dibujar(modelo, seleccion);  vista.destruir();
// Solo dibuja: qué estado mostrar ya viene resuelto en el modelo de vista (núcleo compartido).

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { ESTADOS } from "../../nucleo/estados.js";
import { el } from "../dom.js";
import { crearEscenario } from "./edificio.js";
import { crearBurbujas, crearGeometriasPersonaje } from "./personaje.js";
import { NATURALEZAS } from "../../nucleo/naturaleza.js";
import { OFICINA, COLOR_ESTADO } from "./paleta.js";
import { luzSegunHora } from "./iluminacion.js";
import { crearBarraMovil } from "./barra-movil.js";
import { vecinoDe, resumenDepartamento } from "./navegacion.js";
import { siguienteConAtencion } from "../../nucleo/sala.js";
import { crearMinimapa } from "./minimapa.js";
import { crearBrillo } from "./brillo.js";
import { tipoBrillo } from "./brillo-tipo.js";
import { hayQueDibujar } from "./ciclo.js";
import { crearTiempoGpu } from "./tiempo-gpu.js";
import { escucharDeslizar } from "./gestos.js";
import { calcularEncuadre, aPixeles, dentro } from "./encuadre.js";
import { crearCapaEtiquetas } from "./etiquetas-dom.js";
import { crearCatalogoKenney } from "./kenney.js";
import { Recursos } from "./recursos.js";
import { crearMedidor, firmaMedicion } from "./medidor.js";
import { crearMobiliario } from "./mobiliario.js";
import { crearHistorialCamara, claveSeleccion } from "./camara-historial.js";
import { texturaDuela as duelaM, texturaAlfombra, texturaConcreto, texturaVinil, texturaAtlasPantallas, texturaResplandor } from "./texturas.js";
import { intensidadAmbiente } from "./estilo-visual.js";
import { duracionViaje, suavizarViaje } from "./viaje-camara.js";

const ANGULO_BASE = Math.PI / 4;     // vista isométrica: 45° alrededor del cuarto
const INCLINACION = 0.955;          // ≈ 35.3° sobre el horizonte (isométrica clásica)

function leer(clave) { try { return localStorage.getItem(clave); } catch { return null; } }
function guardar(clave, valor) { try { localStorage.setItem(clave, valor); } catch { /* sin almacenamiento */ } }

export function crearVista3D(contenedor, { alSeleccionar, alFallar = () => {}, tapan = () => [], alSala = null }) {
  const movil = matchMedia("(max-width: 760px), (pointer: coarse)").matches;
  const menosMovimiento = matchMedia("(prefers-reduced-motion: reduce)");
  const medir = new URLSearchParams(location.search).has("medir");

  // Si el navegador no tiene WebGL, three.js lanza un error aquí y app.js vuelve al plano 2D.
  const renderer = new THREE.WebGLRenderer({
    antialias: !movil,
    powerPreference: movil ? "low-power" : "high-performance",
  });
  // Rendimiento UHD: ?px=1 (o 1.25, 1.5, 2) fija la densidad de píxeles para diagnosticar si el límite son los
  // píxeles (escala de Windows al 125–150 %). Sin el parámetro, como siempre.
  const pxPedido = Number(new URLSearchParams(location.search).get("px"));
  const pxMaximo = movil ? 1.25 : 2;
  renderer.setPixelRatio(pxPedido >= 0.5 && pxPedido <= 2 ? pxPedido : Math.min(window.devicePixelRatio || 1, pxMaximo));
  renderer.info.autoReset = false;

  const raiz = el("div", { clase: "vista3d", role: "group", "aria-label": "Oficina 3D" });
  const lienzo = renderer.domElement;
  lienzo.setAttribute("aria-hidden", "true");
  const selector = el("select", { clase: "vista3d-selector", "aria-label": "Departamento" });
  const fuente = el("span", { clase: "vista3d-fuente" });
  const brillo = el("input", { type: "checkbox" });
  const centrar = el("button", { type: "button", clase: "boton boton-chico" }, "Centrar");
  const volverPiso = el("button", { type: "button", clase: "boton boton-chico", hidden: true, title: "Volver al piso completo (Esc o 0)" }, "← Piso");
  // Fase K: accesos directos de cámara. Solo mueven la cámara; no actúan sobre ningún sistema.
  const irRecepcion = el("button", { type: "button", clase: "boton boton-chico", "data-ir": "recepcion", title: "Acercar a la recepción del piso (R)", "aria-label": "Recepción" }, el("span", { "aria-hidden": "true" }, "⌂"), el("span", { clase: "texto-k" }, " Recepción"));
  const irAnterior = el("button", { type: "button", clase: "boton boton-chico", "data-ir": "anterior", hidden: true, title: "Volver a la vista anterior de la cámara (Retroceso)", "aria-label": "Vista anterior" }, el("span", { "aria-hidden": "true" }, "↶"), el("span", { clase: "texto-k" }, " Anterior"));
  const irAlerta = el("button", { type: "button", clase: "boton boton-chico boton-alerta", "data-ir": "alerta", hidden: true, title: "Ir al siguiente departamento con alertas, errores o revisiones (A)", "aria-label": "Siguiente alerta" }, el("span", { "aria-hidden": "true" }, "⚠"), el("span", { clase: "texto-k" }, " Siguiente alerta"));
  const luzFija = el("input", { type: "checkbox" });
  const minimapa = crearMinimapa({ alElegir: (id) => (id ? alSeleccionar({ tipo: "departamento", id }) : volverAlPiso()) });
  const botonModo = (valor, texto) => el("button", { type: "button", clase: "boton boton-chico", "data-modo3d": valor }, texto);
  const modoDom = el("div", { clase: "segmentado", role: "group", "aria-label": "Vista 3D" },
    botonModo("edificio", "Edificio"), botonModo("individual", "Un cuarto"));
  const capaEtiquetas = crearCapaEtiquetas({ movil, alElegir: (id) => alSeleccionar({ tipo: "departamento", id }) });
  const etiquetasDom = capaEtiquetas.nodo;
  // Celular: barra inferior (◀ departamento ▶ ⋯). Usa las mismas acciones que el teclado y el gesto.
  const barraMovil = movil ? crearBarraMovil({
    alPaso: (paso) => irAVecino(paso),
    alElegir: (id) => (id ? alSeleccionar({ tipo: "departamento", id }) : volverAlPiso()),
    alModo: (valor) => cambiarModo(valor),
    alLuzFija: (fija) => { luzFija.checked = fija; luzFija.dispatchEvent(new Event("change")); if (modelo) actualizarBarraMovil(); },
    alCentrar: () => (modo === "edificio" && enfocado ? enfocar(enfocado) : encuadrar()),
    alVolverPiso: () => volverAlPiso(),
    alRecepcion: () => verRecepcion(),
    alSiguienteAlerta: () => irASiguienteAlerta(),
    alSala,
    alAnterior: () => volverAnterior(),
  }) : null;
  const aviso = el("p", { clase: "vista3d-aviso", role: "status" });
  // Fase L: tarjeta flotante sobre el personaje (o el puesto) elegido: quién es, su departamento, qué es y su estado.
  const tarjeta = el("div", { clase: "vista3d-tarjeta", hidden: true, "aria-hidden": "true" });
  const personajesDom = el("div", { clase: "vista3d-personajes", role: "toolbar", "aria-label": "Personajes del departamento" });
  const medidasTexto = el("pre", {});
  const copiar = el("button", { type: "button", clase: "boton boton-chico" }, "Copiar medición");
  const medidasDom = el("div", { clase: "vista3d-medidas", hidden: !medir }, medidasTexto, copiar);
  copiar.addEventListener("click", async () => {
    const texto = `Cauce 3D · ${new Date().toISOString()} · ${navigator.userAgent}\n${textoMedicion(metricas())}`;
    try { await navigator.clipboard.writeText(texto); copiar.textContent = "Copiada"; }
    catch { copiar.textContent = "Selecciona el texto y cópialo"; }
  });
  raiz.append(
    lienzo,
    etiquetasDom,
    el("div", { clase: "vista3d-barra" },
      fuente, modoDom, volverPiso, irAnterior, irRecepcion, irAlerta, selector,
      movil ? null : el("label", { clase: "interruptor", title: "Resplandor de letreros y pantallas" }, brillo, "Brillo"),
      el("label", { clase: "interruptor luz-fija", title: "Sin luz de la hora: la escena siempre igual de iluminada" }, luzFija, "Luz fija"),
      centrar),
    aviso, tarjeta, personajesDom, minimapa.nodo, barraMovil?.nodo ?? null, medidasDom);
  if (movil) raiz.classList.add("es-movil");
  contenedor.append(raiz);

  // Escena, luces y cámara.
  const escena = new THREE.Scene();
  escena.background = new THREE.Color(OFICINA.fondo); // así el color es el mismo con y sin brillo
  const hemi = new THREE.HemisphereLight(0xdfe8ff, 0x4a3a2a, 1.9);
  escena.add(hemi);
  const sol = new THREE.DirectionalLight(0xffe2b8, 1.4);
  sol.position.set(4, 10, 6);
  escena.add(sol);

  // Luz ambiental según la hora local (decoración) o fija. Se revisa una vez por minuto.
  luzFija.checked = leer("cauce.luz3d") === "fija";
  luzFija.addEventListener("change", () => { guardar("cauce.luz3d", luzFija.checked ? "fija" : "hora"); aplicarLuz(); });
  let luzActual = null;
  function aplicarLuz() {
    const ahora = new Date();
    const horaPrueba = Number(new URLSearchParams(location.search).get("hora")); // ?hora=23 solo para capturas y pruebas
    const horaLocal = Number.isFinite(horaPrueba) && new URLSearchParams(location.search).has("hora") ? horaPrueba : ahora.getHours() + ahora.getMinutes() / 60;
    luzActual = luzSegunHora(horaLocal, luzFija.checked);
    hemi.color.setHex(luzActual.cielo);
    hemi.groundColor.setHex(luzActual.suelo);
    hemi.intensity = luzActual.hemi;
    sol.color.setHex(luzActual.sol);
    sol.intensity = luzActual.intensidadSol;
    escena.background.setHex(luzActual.fondo);
    // De noche: las oficinas "con la luz encendida" (piso un poco más cálido que el pasillo) y anillos
    // de estado más visibles. No se tocan los materiales de los personajes.
    for (const mp of Object.values(compartido.pisos)) mp.emissive.setRGB(0.16 * luzActual.noche, 0.11 * luzActual.noche, 0.06 * luzActual.noche);
    for (const m of compartido.anillosEstado.values()) m.opacity = 0.5 + 0.35 * luzActual.noche;
    escenario?.aplicarLuz(luzActual);
    redibujar = true;
    luzFija.parentElement.title = luzFija.checked ? "Luz fija activada" : `Luz de la hora local (${luzActual.nombre}). Marca para dejarla fija.`;
  }
  const relojLuz = setInterval(aplicarLuz, 60_000);
  const camara = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  const controles = new OrbitControls(camara, lienzo);
  controles.enableDamping = true;
  controles.dampingFactor = 0.12;
  controles.screenSpacePanning = true;
  controles.minPolarAngle = 0.6;
  controles.maxPolarAngle = 1.2;
  controles.minAzimuthAngle = ANGULO_BASE - 0.8;
  controles.maxAzimuthAngle = ANGULO_BASE + 0.8;
  controles.minZoom = 0.7;
  controles.maxZoom = 3;
  // Fase M: con la rueda, el acercamiento va hacia donde apunta el ratón (no siempre al centro).
  controles.zoomToCursor = !movil;
  if (movil) {
    // En celular la vista no gira: un dedo que se desliza a los lados cambia de departamento;
    // dos dedos acercan, alejan y mueven. En escritorio el giro sigue libre.
    controles.enableRotate = false;
    controles.touches = { ONE: null, TWO: THREE.TOUCH.DOLLY_PAN };
  }

  // Recursos que no dependen del departamento.
  const compartidos = new Recursos();
  const texturaSombra = compartidos.agregar(texturaRadial());
  const compartido = {
    geoPersonaje: crearGeometriasPersonaje(compartidos),
    texturaSombra,
    matSombra: compartidos.agregar(Object.assign(new THREE.MeshBasicMaterial({ map: texturaSombra, transparent: true, depthWrite: false, opacity: 0.4 }), { userData: { sinBrillo: true } })),
    geoSombraEscritorio: compartidos.agregar(new THREE.PlaneGeometry(1.8, 1.4).rotateX(-Math.PI / 2)),
    burbujas: crearBurbujas(compartidos, ESTADOS),
    catalogo: crearCatalogoKenney(compartidos),
    // Placa «HUMANO» de los puestos de personas (una textura para todo el edificio).
    matPlacaHumano: compartidos.agregar(new THREE.MeshBasicMaterial({ map: compartidos.agregar(texturaPlaca("HUMANO")), toneMapped: false })),
    // Fase M: pisos por tipo de trabajo (estilo-visual.js → pisoDeTema). Uno por tipo para todo el edificio.
    pisos: {
      duela: compartidos.agregar(new THREE.MeshLambertMaterial({ map: compartidos.agregar(duelaM()) })),
      alfombra: compartidos.agregar(new THREE.MeshLambertMaterial({ map: compartidos.agregar(texturaAlfombra()) })),
      concreto: compartidos.agregar(new THREE.MeshLambertMaterial({ map: compartidos.agregar(texturaConcreto()) })),
      vinil: compartidos.agregar(new THREE.MeshLambertMaterial({ map: compartidos.agregar(texturaVinil()) })),
    },
    // Fase M: pantallas ambientales (pictogramas sin cifras). Sin luz propia: se atenúan con el color del material
    // cuando el piso no tiene datos vigentes (intensidadAmbiente). No brillan con el brillo ligero.
    matPantallaAmbiente: compartidos.agregar(new THREE.MeshBasicMaterial({ map: compartidos.agregar(texturaAtlasPantallas()), toneMapped: false, userData: { sinBrillo: true } })),
    // Un material por estado para el anillo bajo cada personaje (opacidad según la hora).
    anillosEstado: new Map(Object.entries(COLOR_ESTADO).map(([estado, color]) =>
      [estado, compartidos.agregar(new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false }))])),
    // Fase L: catálogo de muebles (geometrías compartidas por todo el edificio) y zona invisible para tocar un
    // puesto (también vacío). material.visible = false: el rayo la encuentra, pero no se dibuja (0 llamadas).
    mobiliario: crearMobiliario(compartidos),
    geoToque: compartidos.agregar(new THREE.BoxGeometry(1.4, 1.1, 1.9)),
    matToque: compartidos.agregar(new THREE.MeshBasicMaterial({ visible: false })),
    quieto: () => menosMovimiento.matches,
  };
  compartido.matPiso = compartido.pisos.duela; // el piso de siempre (cuartos sin tipo de piso)
  // Fase M: resplandor de la pantalla sobre el escritorio, solo cuando la pantalla está encendida por evidencia
  // (mismo color que la pantalla). Un material por color, compartido por todo el edificio.
  const texturaBrillo = compartidos.agregar(texturaResplandor());
  const resplandores = new Map();
  compartido.geoResplandor = compartidos.agregar(new THREE.PlaneGeometry(1.1, 0.8).rotateX(-Math.PI / 2));
  compartido.resplandor = (color) => {
    if (!resplandores.has(color)) resplandores.set(color, compartidos.agregar(new THREE.MeshBasicMaterial({
      map: texturaBrillo, color, transparent: true, depthWrite: false, opacity: 0.42, blending: THREE.AdditiveBlending, toneMapped: false, userData: { sinBrillo: true },
    })));
    return resplandores.get(color);
  };

  let escenario = null;    // edificio completo o un solo cuarto (edificio.js)
  let claveOficina = "";
  let modo = leer("cauce.modo3d") === "individual" ? "individual" : "edificio";
  let enfocado = null;     // departamento enfocado: se anima siempre a cuadro completo
  let animCam = null;      // movimiento suave de la cámara al enfocar
  let ultimoAnimados = 0;
  let ultimoAgente = null;
  let recienConstruido = false;
  let ultimoMinimapa = 0;
  let claveCargando = null;
  let modelo = null;
  let seleccion = null;
  let depMostrado = null;
  let mitadAlto = 4;
  let destruida = false;
  const ahorroQuietud = new URLSearchParams(location.search).get("quieta") !== "0";
  let redibujar = true;      // algo cambió fuera del ciclo (datos, tamaño, luz, brillo): dibujar el próximo cuadro
  let ultimoRender = 0;
  let cuadrosOmitidos = 0;
  let ultimoTextoMedir = 0;

  // --- Brillo (bloom): brillo.js. Solo escritorio, apagado por defecto. ---
  const brilloFx = crearBrillo({ renderer, escena, camara, alCambiar: () => ajustarTamano() });
  brillo.checked = !movil && leer("cauce.brillo3d") === "1"; // apagado por defecto: se enciende a mano
  // Rendimiento UHD: «ligero» (por defecto) o «completo» (el anterior). ?brillo=completo para comparar.
  const tipoDeBrillo = tipoBrillo(location.search, leer("cauce.brillo3d.tipo"));
  if (new URLSearchParams(location.search).has("brillo")) guardar("cauce.brillo3d.tipo", tipoDeBrillo);
  brillo.addEventListener("change", () => {
    guardar("cauce.brillo3d", brillo.checked ? "1" : "0");
    aplicarBrillo();
  });
  async function aplicarBrillo() {
    // Si falla la descarga, queda apagado: la oficina funciona igual sin brillo.
    if (await brilloFx.activar(brillo.checked && !movil, tipoDeBrillo) === "fallo") brillo.checked = false;
    redibujar = true;
    if (brilloFx.activo && escenario) brilloFx.marcar(escenario.grupo);
  }
  aplicarBrillo();

  // --- Tamaño ---
  function ajustarTamano() {
    const w = Math.max(1, raiz.clientWidth);
    const h = Math.max(1, raiz.clientHeight);
    renderer.setSize(w, h, false);
    redibujar = true;
    brilloFx.setSize(w, h);
    const aspecto = w / h;
    camara.top = mitadAlto;
    camara.bottom = -mitadAlto;
    camara.left = -mitadAlto * aspecto;
    camara.right = mitadAlto * aspecto;
    camara.updateProjectionMatrix();
    // Si el usuario no ha movido la cámara, se vuelve a encuadrar al cambiar el tamaño (abrir el panel, girar el celular).
    if (escenario && !usuarioMovio && !enfocado && !animCam && (w !== ultimoTamano.w || h !== ultimoTamano.h)) {
      ultimoTamano = { w, h };
      encuadrar();
    }
  }
  let ultimoTamano = { w: 0, h: 0 };
  let usuarioMovio = false;

  /** Zona del lienzo que no tapan la barra de arriba ni los avisos y botones de abajo (en píxeles). */
  function zonaLibre() {
    const w = Math.max(1, raiz.clientWidth), h = Math.max(1, raiz.clientHeight);
    const barra = raiz.querySelector(".vista3d-barra");
    let abajo = h - 8, izq = 8, der = w - 8;
    let arriba = barra ? barra.offsetTop + barra.offsetHeight + 6 : 8;
    // Lo que flota abajo sube el límite inferior; lo que flota arriba (el aviso en celular) baja el superior.
    for (const n of [aviso, personajesDom, barraMovil?.nodo, ...tapan()]) {
      if (!n || n.hidden || n.offsetHeight === 0 || !n.childNodes.length) continue;
      // La pastilla informativa de celular es chica y va en una esquina: no recorta toda la franja de
      // arriba; encuadrar() ya evita que algún cuarto quede debajo de ella (está en sus obstáculos).
      if (n === aviso && movil && aviso.classList.contains("aviso-info")) continue;
      const c = cajaEnRaiz(n);
      if (c.abajo <= 0 || c.arriba >= h || c.der <= 0 || c.izq >= w) continue; // fuera de la vista (p. ej. el panel a un lado en escritorio)
      const columna = Math.min(c.abajo, h) - Math.max(c.arriba, 0) > h * 0.6 && c.der - c.izq < w * 0.6;
      if (columna) { // a un lado (el detalle en celular horizontal): achica el ancho, no el alto
        if ((c.izq + c.der) / 2 > w / 2) der = Math.min(der, c.izq - 6); else izq = Math.max(izq, c.der + 6);
      } else if ((c.arriba + c.abajo) / 2 < h / 2) arriba = Math.max(arriba, c.abajo + 6);
      else abajo = Math.min(abajo, c.arriba - 6);
    }
    return { w, h, arriba, abajo: Math.max(arriba + 60, abajo), izq, der: Math.max(izq + 60, der) };
  }
  /** Caja de un control flotante en píxeles de la vista (sirve también para la barra móvil, que es fija). */
  function cajaEnRaiz(n) {
    const r = n.getBoundingClientRect(), b = raiz.getBoundingClientRect();
    return { izq: r.left - b.left, der: r.right - b.left, arriba: r.top - b.top, abajo: r.bottom - b.top };
  }
  const derecha = new THREE.Vector3(), arribaV = new THREE.Vector3();
  function ejesCamara() {
    camara.updateMatrixWorld();
    derecha.setFromMatrixColumn(camara.matrixWorld, 0);
    arribaV.setFromMatrixColumn(camara.matrixWorld, 1);
  }
  /** Punto que debe mirar la cámara para que `p` quede al centro de la zona libre con ese zoom. */
  function centrarEnZona(p, zoom) {
    ejesCamara();
    const z = zonaLibre();
    const porPx = (2 * mitadAlto / zoom) / z.h;
    const desX = (z.izq + z.der) / 2 - z.w / 2, desY = (z.arriba + z.abajo) / 2 - z.h / 2;
    return p.clone().addScaledVector(derecha, -desX * porPx).addScaledVector(arribaV, desY * porPx);
  }
  const observador = new ResizeObserver(ajustarTamano);
  observador.observe(raiz);

  /**
   * Ajusta la cámara para que el escenario completo quepa lo más grande posible en la zona libre,
   * sin quedar bajo la barra, los avisos ni el minimapa. suave = con movimiento y sin cambiar el giro.
   */
  function encuadrar({ suave = false } = {}) {
    if (!escenario) return;
    redibujar = true;
    const { minX, maxX, minZ, maxZ } = escenario.limites;
    const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
    if (!suave) {
      const d = 60;
      camara.position.set(
        cx + Math.sin(ANGULO_BASE) * Math.sin(INCLINACION) * d,
        Math.cos(INCLINACION) * d,
        cz + Math.cos(ANGULO_BASE) * Math.sin(INCLINACION) * d,
      );
      camara.far = 200;
      controles.target.set(cx, 0.5, cz);
      camara.lookAt(controles.target);
      controles.maxZoom = escenario.modo === "edificio" ? 6 : 3;
      usuarioMovio = false;
    }
    // Esquinas del escenario (con muros exteriores y losa) en coordenadas de la cámara.
    const m = escenario.modo === "edificio" ? 1.45 : 0.45;
    ejesCamara();
    const base = suave ? new THREE.Vector3(cx, 0.5, cz) : controles.target.clone();
    const puntos = [];
    for (const x of [minX - m, maxX + m]) for (const z of [minZ - m, maxZ + m]) for (const y of [-0.45, 2.35]) {
      const v = new THREE.Vector3(x, y, z).sub(base);
      puntos.push({ x: v.dot(derecha), y: v.dot(arribaV) });
    }
    // Ningún cuarto debe quedar debajo de los controles flotantes (aviso, botones de personajes,
    // minimapa). La losa y la banqueta sí pueden quedar detrás: así el edificio usa más pantalla.
    const z0 = zonaLibre();
    const zona = { ...z0, abajo: z0.h - 8 };
    const obstaculos = [aviso, personajesDom, minimapa.nodo, barraMovil?.nodo]
      .filter((n) => n && !n.hidden && n.offsetWidth > 0 && n.offsetHeight > 0 && (n !== personajesDom || n.childNodes.length))
      .map((n) => { const c = cajaEnRaiz(n); return { izq: c.izq - 4, der: c.der + 4, arriba: c.arriba - 4, abajo: c.abajo + 4 }; });
    const esquinasCuartos = [];
    for (const c of escenario.cuartos.values()) for (const sx of [-1, -0.5, 0, 0.5, 1]) for (const sz of [-1, -0.5, 0, 0.5, 1]) for (const y of [0, 1.2]) {
      if (Math.abs(sx) < 1 && Math.abs(sz) < 1) continue; // solo el borde del cuarto
      const v = new THREE.Vector3(c.x + sx * c.ancho / 2, y, c.z + sz * c.fondo / 2).sub(base);
      esquinasCuartos.push({ x: v.dot(derecha), y: v.dot(arribaV) });
    }
    const libre = (e) => !esquinasCuartos.some((p) => { const q = aPixeles(p, e, zona); return obstaculos.some((o) => dentro(q, o)); });
    // Zonas candidatas: el lienzo completo y el lienzo sin cada obstáculo (como franja o como columna).
    const zonas = [zona];
    for (const o of obstaculos) zonas.push({ ...zona, abajo: Math.min(zona.abajo, o.arriba) }, { ...zona, arriba: Math.max(zona.arriba, o.abajo) }, { ...zona, der: Math.min(zona.der, o.izq) });
    zonas.push({ ...zona, abajo: Math.min(...obstaculos.map((o) => o.arriba), zona.abajo) });
    let e = null;
    for (const z of zonas) {
      if (z.der - z.izq < 120 || z.abajo - z.arriba < 120) continue;
      for (const llenado of [0.96, 0.9, 0.84]) {
        const c = calcularEncuadre(puntos, z, llenado);
        if (libre(c) && (!e || c.mitadAlto < e.mitadAlto)) e = c;
      }
    }
    e ??= calcularEncuadre(puntos, zonas[zonas.length - 1], 0.8);
    mitadAlto = e.mitadAlto;
    const centro = base.clone().addScaledVector(derecha, e.centroX).addScaledVector(arribaV, e.centroY);
    if (suave) {
      animCam = { t: 0, desde: controles.target.clone(), hacia: centro, zoomDesde: camara.zoom, zoomHacia: 1 };
      return;
    }
    camara.position.add(centro.clone().sub(controles.target));
    controles.target.copy(centro);
    camara.zoom = 1;
    animCam = null;
    controles.update();
    ajustarTamanoCamara();
  }
  function ajustarTamanoCamara() {
    const aspecto = Math.max(1, raiz.clientWidth) / Math.max(1, raiz.clientHeight);
    camara.top = mitadAlto; camara.bottom = -mitadAlto;
    camara.left = -mitadAlto * aspecto; camara.right = mitadAlto * aspecto;
    camara.updateProjectionMatrix();
  }

  /** Acerca la cámara a un departamento del edificio (movimiento suave de 0.6 s). */
  function enfocar(id) {
    enfocarRect(escenario?.rectangulo(id));
  }
  /** Acerca la cámara a un rectángulo del edificio (un departamento o la recepción). */
  function enfocarRect(r) {
    if (!r || escenario?.modo !== "edificio") return;
    // El cuarto debe caber en la zona libre (en celular, entre la insignia y el panel o los botones).
    const z = zonaLibre();
    const aspecto = Math.max(0.5, z.w / z.h);
    const altoLibre = Math.max(0.25, (z.abajo - z.arriba) / z.h), anchoLibre = Math.max(0.25, (z.der - z.izq) / z.w);
    const mitad = Math.max(((r.ancho + r.fondo) * 0.707 * 0.58 / 2 + 1.2) / altoLibre, ((r.ancho + r.fondo) * 0.707 / 2 + 0.6) / aspecto / anchoLibre);
    animCam = {
      t: 0,
      desde: controles.target.clone(),
      zoomDesde: camara.zoom,
      zoomHacia: THREE.MathUtils.clamp(mitadAlto / mitad, 1, controles.maxZoom),
    };
    animCam.hacia = centrarEnZona(new THREE.Vector3(r.x, 0.5, r.z), animCam.zoomHacia);
  }
  /** Acerca la cámara al escritorio de un agente. */
  function acercarAgente(id) {
    const p = escenario?.posicionAgente(id);
    if (!p) return;
    animCam = {
      t: 0,
      desde: controles.target.clone(),
      zoomDesde: camara.zoom,
      zoomHacia: THREE.MathUtils.clamp(mitadAlto / 3.6, 1, controles.maxZoom),
    };
    animCam.hacia = centrarEnZona(new THREE.Vector3(p.x, 0.6, p.z), animCam.zoomHacia);
  }
  function volverAlPiso() {
    recordar();
    enfocado = null;
    siguiendo = null;
    encuadrar({ suave: true });
    alSeleccionar(null);
  }
  /** Recepción del piso: se acerca la cámara (sin elegir departamento). En «Un cuarto» pasa al edificio. */
  function verRecepcion() {
    if (!escenario) return;
    if (modo !== "edificio") { pendienteRecepcion = true; cambiarModo("edificio"); return; }
    recordar(seleccion, enfocado);
    restaurando = { soloBloquear: true }; // que el cambio de selección no guarde otra vista ni mueva la cámara
    if (enfocado || seleccion) { enfocado = null; alSeleccionar(null); }
    restaurando = null;
    siguiendo = null;
    const r = escenario.recepcion;
    if (r) enfocarRect({ x: r.x, z: r.z, ancho: r.ancho * 0.6, fondo: r.fondo * 0.6 });
  }
  let pendienteRecepcion = false;
  function irASiguienteAlerta() {
    if (!modelo) return;
    const d = siguienteConAtencion(modelo.departamentos, modo === "edificio" ? enfocado : depMostrado);
    if (d) alSeleccionar({ tipo: "departamento", id: d.id });
  }
  // --- Fase L: vista anterior. Antes de cada movimiento de cámara (enfocar, acercarse, recepción, edificio
  // completo o mover a mano) se guarda dónde estaba; «↶ Anterior» o Retroceso regresa a esa vista. ---
  const historial = crearHistorialCamara({ maximo: 12 });
  let restaurando = null;
  let ultimaSel = null; // la selección que se dibujó por última vez (la «anterior» al cambiar)
  function recordar(sel = ultimaSel, enf = enfocado) {
    if (!escenario || escenario.modo !== "edificio" || restaurando) return;
    const t = controles.target;
    historial.recordar({ x: t.x, y: t.y, z: t.z, zoom: camara.zoom, sel, enfocado: enf });
    irAnterior.hidden = historial.tamano === 0;
    if (modelo) actualizarBarraMovil();
  }
  function volverAnterior() {
    const v = historial.sacar();
    irAnterior.hidden = historial.tamano === 0;
    if (!v || !escenario || escenario.modo !== "edificio") return;
    siguiendo = null;
    restaurando = v;
    if (claveSeleccion(v.sel) !== claveSeleccion(seleccion)) alSeleccionar(v.sel); // vuelve a dibujar sin mover la cámara
    aplicarRestauracion();
  }
  function aplicarRestauracion() {
    const v = restaurando;
    if (!v) return;
    restaurando = null;
    enfocado = v.enfocado && escenario?.cuartos.has(v.enfocado) ? v.enfocado : null;
    volverPiso.hidden = !(modo === "edificio" && enfocado);
    usuarioMovio = true;
    animCam = { t: 0, desde: controles.target.clone(), hacia: new THREE.Vector3(v.x, v.y, v.z), zoomDesde: camara.zoom, zoomHacia: v.zoom };
    if (modelo) { actualizarBarraMovil(); capaEtiquetas.actualizar(modelo.departamentos, seleccion, enfocado); }
  }
  irAnterior.addEventListener("click", volverAnterior);

  // Seguir a un personaje (opcional): la cámara acompaña su escritorio o su camino. Se apaga al mover la cámara.
  let siguiendo = null;
  const seguido = new THREE.Vector3();
  function seguirCamara(dt) {
    if (!siguiendo || animCam || !escenario) return;
    const p = escenario.posicionAgente(siguiendo);
    if (!p) { siguiendo = null; return; }
    seguido.set(p.x, 0.6, p.z);
    const destino = centrarEnZona(seguido, camara.zoom);
    const k = menosMovimiento.matches ? 1 : 1 - Math.exp(-dt * 4);
    const nuevo = controles.target.clone().lerp(destino, k);
    camara.position.add(nuevo.clone().sub(controles.target));
    controles.target.copy(nuevo);
  }

  /** Departamento vecino del enfocado (o del mostrado), en el orden del archivo. */
  function vecino(paso) {
    return vecinoDe(modelo.departamentos, modo === "edificio" ? enfocado : depMostrado, paso);
  }
  function irAVecino(paso) {
    if (!modelo || !escenario) return;
    const destino = vecino(paso);
    if (destino) alSeleccionar({ tipo: "departamento", id: destino.id });
  }
  function actualizarBarraMovil() {
    barraMovil?.actualizar({
      resumenes: modelo.departamentos.map(resumenDepartamento),
      actualId: modo === "edificio" ? enfocado : depMostrado,
      modo,
      luzFija: luzFija.checked,
      hayAtencion: Boolean(siguienteConAtencion(modelo.departamentos, null)),
      hayAnterior: historial.tamano > 0,
    });
  }

  // Teclado: 1–9 enfoca un departamento, ← → pasa al vecino, Esc regresa al piso completo.
  // Fase K: 0 o Inicio = edificio completo, R = recepción, A = siguiente alerta, F = seguir al personaje elegido.
  function alTeclear(e) {
    if (e.ctrlKey || e.metaKey || e.altKey || !modelo || !escenario || pausada) return;
    if (e.target instanceof HTMLElement && e.target.closest("input, select, textarea")) return;
    const deps = modelo.departamentos;
    let destino = null;
    const tecla = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (tecla === "0" || tecla === "Home") { e.preventDefault(); if (modo !== "edificio") cambiarModo("edificio"); else volverAlPiso(); return; }
    if (tecla === "r") { e.preventDefault(); verRecepcion(); return; }
    if (tecla === "a") { e.preventDefault(); irASiguienteAlerta(); return; }
    if (tecla === "f" && seleccion?.tipo === "agente") { e.preventDefault(); alternarSeguir(seleccion.id); return; }
    if (tecla === "Backspace") { if (historial.tamano) { e.preventDefault(); volverAnterior(); } return; }
    if (/^[1-9]$/.test(e.key)) destino = deps[Number(e.key) - 1] ?? null;
    else if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); irAVecino(e.key === "ArrowRight" ? 1 : -1); return; }
    else if (e.key === "Escape" && !seleccion && modo === "edificio" && enfocado) { volverAlPiso(); e.preventDefault(); return; }
    if (!destino) return;
    e.preventDefault();
    alSeleccionar({ tipo: "departamento", id: destino.id });
  }
  document.addEventListener("keydown", alTeclear);

  function moverCamara(dt) {
    if (!animCam) return;
    // Fase M: la duración depende de la distancia y del cambio de acercamiento (0.45–0.9 s), con arranque y
    // frenado suaves. «Reducir movimiento» del sistema: sin viaje de cámara.
    animCam.duracion ??= duracionViaje(animCam.desde.distanceTo(animCam.hacia), animCam.zoomDesde, animCam.zoomHacia);
    animCam.t = menosMovimiento.matches ? 1 : Math.min(1, animCam.t + dt / animCam.duracion);
    const k = suavizarViaje(animCam.t);
    const nuevo = animCam.desde.clone().lerp(animCam.hacia, k);
    camara.position.add(nuevo.clone().sub(controles.target));
    controles.target.copy(nuevo);
    camara.zoom = animCam.zoomDesde + (animCam.zoomHacia - animCam.zoomDesde) * k;
    camara.updateProjectionMatrix();
    if (animCam.t >= 1) animCam = null;
  }
  centrar.addEventListener("click", () => encuadrar());
  irRecepcion.addEventListener("click", verRecepcion);
  irAlerta.addEventListener("click", irASiguienteAlerta);
  function alternarSeguir(id) {
    siguiendo = siguiendo === id ? null : id;
    if (modelo) dibujar(modelo, seleccion);
  }
  volverPiso.addEventListener("click", volverAlPiso);
  for (const b of modoDom.querySelectorAll("[data-modo3d]")) {
    b.addEventListener("click", () => cambiarModo(b.dataset.modo3d));
  }
  function cambiarModo(valor) {
    if (modo === valor) return;
    modo = valor;
    guardar("cauce.modo3d", modo);
    if (modelo) dibujar(modelo, seleccion);
  }

  // No dejar que el usuario arrastre la oficina fuera de la pantalla.
  controles.addEventListener("start", () => { recordar(seleccion, enfocado); animCam = null; usuarioMovio = true; if (siguiendo) { siguiendo = null; if (modelo) dibujar(modelo, seleccion); } }); // el usuario toma el control
  controles.addEventListener("change", () => {
    if (!escenario) return;
    const t = controles.target;
    const { minX, maxX, minZ, maxZ } = escenario.limites;
    const cx = THREE.MathUtils.clamp(t.x, minX, maxX);
    const cz = THREE.MathUtils.clamp(t.z, minZ, maxZ);
    const cy = THREE.MathUtils.clamp(t.y, 0, 1.5);
    if (cx !== t.x || cz !== t.z || cy !== t.y) {
      const dx = cx - t.x, dy = cy - t.y, dz = cz - t.z;
      t.set(cx, cy, cz);
      camara.position.x += dx; camara.position.y += dy; camara.position.z += dz;
    }
  });

  // --- Selección con toque o clic (no al arrastrar) ---
  const rayo = new THREE.Raycaster();
  const puntero = new THREE.Vector2();
  let inicio = null;
  lienzo.addEventListener("pointerdown", (e) => { inicio = { x: e.clientX, y: e.clientY }; });
  lienzo.addEventListener("pointercancel", () => { inicio = null; });
  lienzo.addEventListener("pointerup", (e) => {
    if (!inicio || !escenario) return;
    const movido = Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y);
    inicio = null;
    if (movido > 6) return;
    const r = lienzo.getBoundingClientRect();
    puntero.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    rayo.setFromCamera(puntero, camara);
    for (const hit of rayo.intersectObject(escenario.grupo, true)) {
      const sel = seleccionDe(hit.object);
      if (sel) { alSeleccionar(sel); return; }
    }
    alSeleccionar(null);
  });

  selector.addEventListener("change", () => {
    if (!selector.value) { volverAlPiso(); return; } // "Todo el piso"
    depMostrado = selector.value;
    if (modelo) guardar(`cauce.depto3d.${modelo.proyecto.id}`, depMostrado);
    alSeleccionar({ tipo: "departamento", id: depMostrado });
  });

  // Tocar fuera de la lista o del menú de la barra móvil los cierra.
  if (barraMovil) raiz.addEventListener("pointerdown", (e) => {
    if (barraMovil.estaAbierta() && !(e.target instanceof Element && e.target.closest(".vista3d-movil"))) barraMovil.cerrar();
  }, true);
  // Deslizar a los lados con un dedo (celular): departamento vecino (gestos.js).
  if (movil) escucharDeslizar(raiz, (sentido) => {
    if (!modelo || !escenario) return;
    barraMovil?.cerrar();
    irAVecino(sentido);
  });

  // --- Pérdida del contexto gráfico (driver reiniciado, poca memoria en el móvil) ---
  lienzo.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    if (destruida) return; // la perdemos a propósito al cerrar la vista (forceContextLoss): no es una falla
    detener();
    alFallar("La tarjeta gráfica dejó de responder (contexto WebGL perdido).");
  });

  // --- Ciclo de dibujo: limita cuadros por segundo y se pausa con la pestaña oculta ---
  const intervalo = 1000 / (movil ? 30 : 60);
  let idCuadro = 0;
  let anterior = 0;
  let ultimoDibujo = 0;
  let reloj = 0;
  let ultimaZona = 0;
  const medidor = crearMedidor({ ventana: 20 });
  const tiempoGpu = medir ? crearTiempoGpu(renderer.getContext()) : null; // solo con ?medir=1
  let brilloApagadoSolo = null;

  function cuadro(t) {
    idCuadro = requestAnimationFrame(cuadro);
    if (t - ultimoDibujo < intervalo - 1) return;
    ultimoDibujo = t;
    const dt = anterior ? Math.min(0.1, (t - anterior) / 1000) : 0;
    anterior = t;
    reloj += dt;
    const camaraAnimada = Boolean(animCam || siguiendo);
    moverCamara(dt);
    seguirCamara(dt);
    const camaraCambio = controles.update() || camaraAnimada;
    if (escenario) ultimoAnimados = escenario.paso(dt, reloj, hzDe);
    // Rendimiento UHD: si nada se mueve (sin personajes a la vista, cámara quieta, sin torreta que parpadee y sin
    // cambios de datos, tamaño o luz), la imagen sería idéntica: no se vuelve a dibujar. Por seguridad se
    // redibuja al menos una vez por segundo (p. ej. el reloj de pared). Con ?quieta=0 se desactiva para medir.
    if (!hayQueDibujar({ ahorro: ahorroQuietud, camaraCambio, redibujar, hayEscenario: Boolean(escenario), enMovimiento: escenario?.enMovimiento() ?? true, msDesdeUltimo: t - ultimoRender })) {
      cuadrosOmitidos++; medidor.pausa();
      // Con ?medir=1 el recuadro se actualiza igual (si no, seguiría mostrando la vista anterior).
      if (medir && t - ultimoTextoMedir > 500) { ultimoTextoMedir = t; medidasTexto.textContent = textoMedicion(metricas()); }
      return;
    }
    let forzado = redibujar;
    redibujar = false;
    ultimoRender = t;
    if (escenario) {
      if (t - ultimaZona > 300) {
        ultimaZona = t;
        const z = zonaLibre();
        if (!zonaLibreCache || ["w", "h", "arriba", "abajo", "izq", "der"].some((k) => z[k] !== zonaLibreCache[k])) forzado = true;
        zonaLibreCache = z;
      }
      colocarTarjeta();
      if (escenario.modo === "edificio") {
        // Las etiquetas solo dependen de la cámara y de la zona libre: si no cambiaron, se quedan donde están.
        if (camaraCambio || forzado) colocarEtiquetas();
        if (t - ultimoMinimapa > 250) { ultimoMinimapa = t; dibujarMinimapa(); }
      }
    }
    renderer.info.reset();
    tiempoGpu?.empezar();
    if (!brilloFx.render(dt)) renderer.render(escena, camara);
    tiempoGpu?.terminar();
    contarCuadro(t);
  }
  // Optimización: el departamento enfocado se anima en cada cuadro; los demás menos veces por
  // segundo, y casi nada si quedan fuera de la pantalla. El celular, menos todavía.
  const proyectado = new THREE.Vector3();
  function hzDe(id) {
    if (id === enfocado) return 0;
    const r = escenario.rectangulo(id);
    proyectado.set(r.x, 0.5, r.z).project(camara);
    const margen = 1 + (r.ancho / 2) * camara.zoom / Math.max(1, mitadAlto);
    if (Math.abs(proyectado.x) > margen || Math.abs(proyectado.y) > margen) return 2;
    if (movil) return 8;
    return escenario.personajes().length <= 12 ? 20 : 12;
  }

  // Nombres de los departamentos como texto nítido (HTML) encima del edificio cuando se ve de lejos.
  function colocarEtiquetas() {
    const w = raiz.clientWidth, h = raiz.clientHeight;
    // En celular la barra de abajo es fija: ninguna etiqueta debe quedar debajo de ella (ni al bajar la página).
    const limite = barraMovil && !barraMovil.nodo.hidden ? Math.min(h, cajaEnRaiz(barraMovil.nodo.querySelector(".movil-barra")).arriba - 4) : h;
    capaEtiquetas.colocar(camara, escenario, { w, h: limite, alto: h, arriba: (zonaLibreCache ?? zonaLibre()).arriba });
  }

  let pausada = false; // la sala de control tapa la vista: no se dibuja (fase K)
  function arrancar() {
    if (destruida || pausada || idCuadro || document.hidden) return;
    anterior = 0;
    redibujar = true;
    medidor.pausa();
    idCuadro = requestAnimationFrame(cuadro);
  }
  function detener() {
    cancelAnimationFrame(idCuadro);
    idCuadro = 0;
  }
  const alCambiarVisibilidad = () => (document.hidden ? detener() : arrancar());
  document.addEventListener("visibilitychange", alCambiarVisibilidad);

  function contarCuadro(t) {
    // Cada medición es de una sola configuración: si cambia el brillo, el modo, el enfoque o el
    // tamaño del lienzo, la ventana de 20 s empieza de nuevo.
    if (medidor.vigilar(firmaMedicion({
      brillo: brillo.checked ? "brillo" : "sin brillo",
      modo: escenario?.modo ?? modo,
      enfoque: escenario?.modo === "edificio" ? (enfocado ?? "") : "",
      tamano: `${lienzo.width}x${lienzo.height}`,
    }), t)) tiempoGpu?.reiniciar();
    if (!medidor.cuadro(t)) return;
    const cps = medidor.valor;
    // Si con brillo el equipo no sostiene 40 cuadros por segundo, se apaga solo (no se guarda:
    // la próxima visita lo vuelve a intentar). Con ?medir=1 no se apaga, para poder medir su costo.
    if (brilloFx.activo && !medir && t - brilloFx.desde > 3000 && cps < 40) {
      brillo.checked = false;
      brilloApagadoSolo = cps;
      brillo.parentElement.title = `Se apagó solo: el equipo iba a ${cps} cuadros por segundo`;
      aplicarBrillo();
    }
    if (!medir) return;
    medidasTexto.textContent = textoMedicion(metricas());
  }
  function textoMedicion(i) {
    const vista = i.modo !== "edificio" ? `un cuarto (${i.departamento_nombre})` : i.enfocado ? `edificio, enfocado: ${i.enfocado_nombre}` : "edificio completo";
    return `${i.fps} cps (prom. ${i.fps_promedio}, mín. ${i.fps_minimo} en ${i.segundos_medidos} s) · peor cuadro ${i.peor_cuadro_ms} ms · ${i.segundos_bajo_50} s bajo 50 cps\n` +
      `${vista}, ${i.personajes} personajes · ventana reiniciada por: ${i.reiniciado_por}\n` +
      `${i.llamadas} llamadas · ${i.triangulos} triángulos · ${i.geometrias} geometrías · ${i.texturas} texturas\n` +
      `px ${i.pixelRatio} · ${i.tamano.join("×")} · brillo ${i.brillo ? `encendido (${i.brillo_tipo})` : i.brillo_apagado_solo ? `apagado solo (${i.brillo_apagado_solo} cps)` : "apagado"}` +
      `${i.movil ? " · modo celular" : ""}` +
      `\nTarjeta gráfica: ${i.gpu_ms !== null ? `${i.gpu_ms} ms por cuadro (peor ${i.gpu_ms_peor} ms)` : i.gpu_tiempo_disponible ? "midiendo…" : "tiempo no disponible en este navegador"}` +
      `${i.escena_quieta && i.ahorro_quietud ? `\nEscena quieta: no se redibuja (${i.cuadros_omitidos_por_quietud} cuadros ahorrados); los cps no aplican` : ""}\nGPU: ${i.gpu}`;
  }
  let gpu = null;
  function nombreGpu() {
    if (gpu) return gpu;
    try {
      const gl = renderer.getContext();
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    } catch { gpu = "desconocida"; }
    return gpu;
  }
  function metricas() {
    const r = medidor.resumen();
    const nombre = (id) => modelo?.departamentos.find((d) => d.id === id)?.nombre ?? id;
    return {
      fps: r.cps,
      fps_promedio: r.promedio,
      fps_minimo: r.minimo,
      peor_cuadro_ms: r.peor_cuadro_ms,
      segundos_bajo_50: r.segundos_bajo_50,
      segundos_medidos: r.segundos,
      reiniciado_por: r.reiniciado_por,
      brillo_apagado_solo: brilloApagadoSolo,
      gpu: nombreGpu(),
      llamadas: renderer.info.render.calls,
      triangulos: renderer.info.render.triangles,
      geometrias: renderer.info.memory.geometries,
      texturas: renderer.info.memory.textures,
      pixelRatio: renderer.getPixelRatio(),
      movil,
      brillo: brilloFx.activo,
      brillo_tipo: brilloFx.tipo,
      tamano: [lienzo.width, lienzo.height],
      cuadros_totales: r.cuadros_totales,
      departamento: depMostrado,
      departamento_nombre: nombre(depMostrado),
      enfocado: escenario?.modo === "edificio" ? enfocado : null,
      enfocado_nombre: enfocado ? nombre(enfocado) : null,
      modo: escenario?.modo ?? modo,
      personajes: escenario ? escenario.personajes().length : 0,
      animados_ultimo_cuadro: ultimoAnimados,
      escena_quieta: Boolean(escenario) && !escenario.enMovimiento(),
      gpu_ms: tiempoGpu?.resumen()?.promedio_ms ?? null,
      gpu_ms_peor: tiempoGpu?.resumen()?.peor_ms ?? null,
      gpu_tiempo_disponible: Boolean(tiempoGpu?.disponible),
      cuadros_omitidos_por_quietud: cuadrosOmitidos,
      ahorro_quietud: ahorroQuietud,
    };
  }
  // Solo con ?medir=1: ayuda a las pruebas automáticas a medir y a tocar a un personaje.
  function proyectar(id) {
    const per = escenario?.personajes().find((p) => p.id === id);
    if (!per || !per.raiz.visible) return null;
    const v = new THREE.Vector3();
    per.raiz.getWorldPosition(v);
    v.y += 0.6;
    v.project(camara);
    const r = lienzo.getBoundingClientRect();
    return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
  }
  // Solo con ?medir=1 (pruebas): qué hace cada personaje ahora mismo.
  const personajesAhora = () => (escenario?.personajes() ?? []).map((p) => ({
    id: p.id, estado: p.estado, accion: p.accion, cola: [...p.cola], bucle: p.bucle, postura: p.postura, visible: p.raiz.visible,
    fase: p.fase ?? null, x: p.raiz.position.x, z: p.raiz.position.z, giro: p.raiz.rotation.y,
  }));
  // Solo con ?medir=1 (fase L): punto en pantalla del escritorio de un agente (aunque no tenga personaje) y cámara.
  function proyectarPuesto(id) {
    const l = escenario?.posicionPuesto(id);
    if (!l) return null;
    const v = new THREE.Vector3(l.x, 0.75, l.z + 0.25).project(camara);
    const r = lienzo.getBoundingClientRect();
    return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
  }
  const estadoCamara = () => ({ x: controles.target.x, y: controles.target.y, z: controles.target.z, zoom: camara.zoom, enfocado, historial: historial.tamano, siguiendo, animando: Boolean(animCam) });
  // Solo con ?medir=1: caja en pantalla (px de la ventana) de los cuartos del escenario, para medir el encuadre.
  function cajaEdificio() {
    if (!escenario) return null;
    const r = lienzo.getBoundingClientRect(), v = new THREE.Vector3();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const c of escenario.cuartos.values()) for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const y of [0, 1.2]) {
      v.set(c.x + sx * c.ancho / 2, y, c.z + sz * c.fondo / 2).project(camara);
      const px = r.left + (v.x + 1) / 2 * r.width, py = r.top + (1 - v.y) / 2 * r.height;
      x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
    }
    return { izq: x0, der: x1, arriba: y0, abajo: y1 };
  }
  if (medir) window.__cauce3d = { metricas, proyectar, personajes: personajesAhora, cajaEdificio, proyectarPuesto, camara: estadoCamara };

  // --- Dibujo a partir del modelo de vista ---
  function dibujar(m, sel) {
    modelo = m;
    redibujar = true;
    const selAntes = ultimaSel;
    seleccion = sel;
    const deps = m.departamentos;
    raiz.dataset.conexion = m.conexion;
    // Fase M: pantallas ambientales atenuadas si el piso no tiene datos vigentes (no sugieren que «todo funciona»).
    const ambiente = intensidadAmbiente(m);
    compartido.matPantallaAmbiente.color.setScalar(ambiente);
    raiz.dataset.ambiente = String(ambiente);
    // Sin archivo leído no hay origen que mostrar: "REAL" solo cuando de verdad llegó un archivo real.
    const origen = m.es_demo ? "demo" : m.generado_en ? "real" : "sin";
    fuente.textContent = { demo: "DEMO", real: "REAL", sin: "SIN DATOS" }[origen];
    fuente.className = `vista3d-fuente es-${origen}`;
    fuente.title = { demo: "Datos de demostración: no es actividad real", real: "Datos reales del sistema", sin: "No hay archivo de estado de este proyecto" }[origen];

    if (deps.length === 0) {
      quitarOficina();
      selector.replaceChildren();
      selector.hidden = true;
      personajesDom.replaceChildren();
      aviso.hidden = false;
      aviso.classList.remove("aviso-info");
      // Fase L: un proyecto pendiente explica por qué no tiene oficinas (no se inventan departamentos).
      aviso.textContent = m.proyecto.pendiente
        ? `Proyecto pendiente: ${m.proyecto.pendiente} No tiene oficinas ni datos; su piso aparecerá cuando exista un exportador de solo lectura.`
        : m.motivo ?? "No hay datos de este proyecto.";
      tarjeta.hidden = true; tarjetaId = null;
      if (barraMovil) barraMovil.nodo.hidden = true;
      return;
    }
    selector.hidden = false;
    if (barraMovil) barraMovil.nodo.hidden = false;

    // Qué departamento mostrar o enfocar: el elegido, el del personaje elegido o el último visto.
    let objetivo = null;
    if (sel?.tipo === "departamento") objetivo = sel.id;
    if (sel?.tipo === "agente") objetivo = deps.find((d) => d.agentes.some((a) => a.id === sel.id))?.id ?? null;
    const recordado = depMostrado ?? leer(`cauce.depto3d.${m.proyecto.id}`);
    const dep = deps.find((d) => d.id === (objetivo ?? recordado)) ?? deps[0];
    depMostrado = dep.id;
    const nuevoEnfoque = modo === "edificio" ? (objetivo ? dep.id : enfocado && deps.some((d) => d.id === enfocado) ? enfocado : null) : dep.id;

    for (const b of modoDom.querySelectorAll("[data-modo3d]")) b.setAttribute("aria-pressed", b.dataset.modo3d === modo ? "true" : "false");
    const opciones = `${modo}|` + deps.map((d) => `${d.id}:${d.nombre}`).join("|");
    if (selector.dataset.opciones !== opciones) {
      selector.dataset.opciones = opciones;
      selector.replaceChildren(
        modo === "edificio" ? el("option", { value: "" }, "Todo el piso") : null,
        ...deps.map((d) => el("option", { value: d.id }, d.nombre)));
    }
    selector.value = modo === "edificio" ? (nuevoEnfoque ?? "") : dep.id;

    const visibles = modo === "edificio" ? deps : [dep];
    // es_demo en la clave: al pasar de DEMO a REAL la escena se reconstruye y nadie "reacciona" a la diferencia.
    const clave = `${modo}/${m.proyecto.id}/${m.es_demo ? "demo" : "real"}/${m.cuadricula.metros_por_celda}/` +
      visibles.map((d) => `${d.id}:${d.posicion.x},${d.posicion.y},${d.posicion.ancho},${d.posicion.alto}:${d.agentes.map((a) => `${a.id}/${a.naturaleza ?? ""}`).join(",")}`).join("|");
    const ids = visibles.flatMap((d) => d.agentes.map((a) => a.id));
    if (clave !== claveOficina) {
      if (escenario) quitarOficina();
      if (compartido.catalogo.listos(ids)) {
        escenario = crearEscenario(visibles, m, compartido, { modo });
        escena.add(escenario.grupo);
        claveOficina = clave;
        crearEtiquetas(visibles);
        historial.vaciar(); // escena nueva (otro piso, modo o datos): las vistas guardadas ya no aplican
        irAnterior.hidden = true;
        lienzo.style.opacity = "0"; // fase L: el piso nuevo aparece con un fundido corto (sin él con «reducir movimiento»)
        requestAnimationFrame(() => { lienzo.style.opacity = ""; });
        encuadrar();
        recienConstruido = true;
        aplicarLuz();
        enfocado = null; // se vuelve a enfocar abajo, ya con la cámara en su lugar
      } else if (claveCargando !== clave) {
        // Primero se descargan los modelos de sus personajes (solo los que se van a ver).
        claveCargando = clave;
        compartido.catalogo.preparar(ids).then(() => {
          if (destruida || claveCargando !== clave) return;
          claveCargando = null;
          dibujar(modelo, seleccion);
        });
      }
    } else {
      escenario.actualizar(visibles, m);
    }
    let guardada = false;
    if (escenario && nuevoEnfoque !== enfocado) {
      if (!recienConstruido && !restaurando && nuevoEnfoque) { recordar(selAntes, enfocado); guardada = true; }
      enfocado = nuevoEnfoque;
      // En celular, al elegir un departamento la vista 3D sube hasta quedar bajo la cabecera fija,
      // así el cuarto tiene espacio entre la insignia y el detalle.
      if (movil && enfocado && raiz.getBoundingClientRect().top > 120) contenedor.scrollIntoView({ block: "start" });
      if (modo === "edificio" && enfocado && !restaurando) enfocar(enfocado);
    }
    // Al elegir un agente, la cámara se acerca a su escritorio (una vez por elección).
    const agenteElegido = escenario && sel?.tipo === "agente" ? sel.id : null;
    if (agenteElegido && agenteElegido !== ultimoAgente && !restaurando) {
      if (!guardada) recordar(selAntes, enfocado);
      acercarAgente(agenteElegido);
    }
    ultimoAgente = agenteElegido;
    volverPiso.hidden = !(modo === "edificio" && enfocado);
    irRecepcion.hidden = !(modo === "edificio" && escenario?.recepcion);
    const hayAtencion = Boolean(siguienteConAtencion(deps, null));
    irAlerta.hidden = !hayAtencion;
    if (siguiendo && !(sel?.tipo === "agente" && sel.id === siguiendo)) siguiendo = null;
    minimapa.nodo.hidden = modo !== "edificio";
    dibujarMinimapa();
    actualizarBarraMovil();
    escenario?.seleccionar(sel);
    if (brilloFx.activo && escenario) brilloFx.marcar(escenario.grupo); // qué brilla en el modo ligero
    actualizarEtiquetas(visibles, sel);
    ultimaSel = sel;
    dibujarTarjeta(m, sel);

    const delAviso = modo === "edificio" && !enfocado ? deps : [dep];
    const agentesAviso = delAviso.flatMap((d) => d.agentes);
    const clasificado = agentesAviso.some((a) => a.naturaleza);
    const vacios = clasificado
      ? agentesAviso.filter((a) => a.animacion_mostrada === "ausente").length
      : agentesAviso.filter((a) => a.estado === "sin_datos").length;
    // Un aviso de conexión se muestra completo; el informativo (puestos sin personaje) tiene además
    // una forma corta que en celular ocupa una sola línea y deja el edificio a la vista.
    let largo = null, corto = null;
    if (m.solo_estructura) largo = `${m.conexion_etiqueta}: solo se conocen sus departamentos; no hay datos ni personajes.`;
    else if (m.conexion !== "en_linea") largo = `${m.conexion_etiqueta}: sin evidencia vigente, los personajes salen de la oficina.`;
    else if (agentesAviso.length === 0) largo = "Este departamento no tiene personajes.";
    else if (vacios && clasificado) { largo = `${vacios} puesto(s) sin personaje (módulos, humanos o sin registro nuevo).`; corto = `${vacios} sin personaje`; }
    else if (vacios) { largo = `${vacios} silla(s) vacía(s): sin registro que respalde actividad.`; corto = `${vacios} silla(s) vacía(s)`; }
    aviso.hidden = largo === null;
    aviso.classList.toggle("aviso-info", corto !== null);
    aviso.title = corto ? largo : "";
    aviso.replaceChildren(...(corto
      ? [el("span", { clase: "aviso-largo" }, largo), el("span", { clase: "aviso-corto", "aria-hidden": "true" }, corto)]
      : [largo ?? ""]));

    const chips = modo === "edificio" && !enfocado ? [] : dep.agentes;
    const reencuadrar = recienConstruido;
    recienConstruido = false;
    const agenteSel = sel?.tipo === "agente" ? dep.agentes.find((a) => a.id === sel.id) : null;
    // «Seguir» solo si el personaje está en la escena (con evidencia); uno ausente no tiene a quién seguir.
    const seguible = agenteSel && escenario?.personajes().some((p) => p.id === agenteSel.id && p.raiz.visible);
    const botonSeguir = seguible ? el("button", {
      type: "button", clase: "chip chip-seguir", "aria-pressed": siguiendo === agenteSel.id ? "true" : "false",
      title: "La cámara acompaña a este personaje (F). Se apaga al mover la cámara.",
      onclick: () => alternarSeguir(agenteSel.id),
    }, siguiendo === agenteSel.id ? "◎ Siguiendo" : "◎ Seguir") : null;
    personajesDom.replaceChildren(...(botonSeguir ? [botonSeguir] : []), ...chips.map((a) => el("button", {
      type: "button",
      clase: `chip ${a.apariencia.clase2d}`,
      "aria-pressed": sel?.tipo === "agente" && sel.id === a.id ? "true" : "false",
      title: `${a.nombre}: ${a.apariencia.etiqueta}${a.naturaleza ? ` · ${NATURALEZAS[a.naturaleza].etiqueta}` : ""}`,
      onclick: () => alSeleccionar({ tipo: "agente", id: a.id }),
    }, el("span", { "aria-hidden": "true" }, a.apariencia.icono), ` ${a.nombre}`)));
    // Ya con avisos y botones en su lugar, se ajusta el encuadre al espacio que de verdad queda libre.
    if (reencuadrar && !enfocado && !usuarioMovio) encuadrar();
    if (pendienteRecepcion && escenario?.modo === "edificio") { pendienteRecepcion = false; verRecepcion(); }

    arrancar();
  }

  // --- Fase L: tarjeta flotante del personaje o puesto elegido (solo texto; las acciones siguen en el panel). ---
  let tarjetaId = null;
  function dibujarTarjeta(m, sel) {
    const a = sel?.tipo === "agente" ? m.departamentos.flatMap((d) => d.agentes.map((x) => [x, d])).find(([x]) => x.id === sel.id) : null;
    tarjetaId = a && escenario ? sel.id : null;
    if (!a) { tarjeta.hidden = true; return; }
    const [ag, dep] = a;
    const enEscena = escenario?.personajes().some((p) => p.id === ag.id && p.raiz.visible);
    const que = ag.naturaleza ? NATURALEZAS[ag.naturaleza].etiqueta : "Sin clasificar";
    tarjeta.className = `vista3d-tarjeta ${ag.apariencia.clase2d}`;
    tarjeta.replaceChildren(
      el("strong", {}, ag.nombre),
      el("span", { clase: "tarjeta-dep" }, dep.nombre),
      el("span", { clase: "tarjeta-estado" }, el("span", { "aria-hidden": "true" }, ag.apariencia.icono), ` ${ag.apariencia.etiqueta}`, m.es_demo ? " · DEMO" : ""),
      el("span", { clase: "tarjeta-que" }, que),
      ...(enEscena ? [] : [el("span", { clase: "tarjeta-vacio" }, "Puesto sin personaje: no hay evidencia de actividad vigente")]));
    tarjeta.dataset.puesto = enEscena ? "personaje" : "vacio";
  }
  const puntoTarjeta = new THREE.Vector3();
  function colocarTarjeta() {
    if (!tarjetaId || !escenario) { tarjeta.hidden = true; return; }
    const per = escenario.personajes().find((p) => p.id === tarjetaId && p.raiz.visible);
    if (per) { per.raiz.getWorldPosition(puntoTarjeta); puntoTarjeta.y += 1.55; }
    else { const l = escenario.posicionPuesto(tarjetaId); if (!l) { tarjeta.hidden = true; return; } puntoTarjeta.set(l.x, 1.25, l.z); }
    puntoTarjeta.project(camara);
    const w = raiz.clientWidth, h = raiz.clientHeight;
    const x = (puntoTarjeta.x + 1) / 2 * w, y = (1 - puntoTarjeta.y) / 2 * h;
    const z = zonaLibreCache;
    const fuera = !z || x < z.izq || x > z.der || y < z.arriba + 30 || y > z.abajo;
    tarjeta.hidden = fuera;
    if (!fuera) tarjeta.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -100%)`;
  }
  let zonaLibreCache = null;

  function dibujarMinimapa() {
    if (!escenario || escenario.modo !== "edificio" || !modelo) return;
    const estados = new Map(modelo.departamentos.map((d) => [d.id, d.estado_resumen]));
    minimapa.dibujar({
      cuartos: [...escenario.cuartos].map(([id, c]) => ({ id, x: c.x, z: c.z, ancho: c.ancho, fondo: c.fondo, color: COLOR_ESTADO[estados.get(id) ?? "sin_datos"] })),
      recepcion: escenario.recepcion,
      limites: escenario.limites,
      enfocado,
      objetivo: controles.target,
    });
  }

  function quitarOficina() {
    escenario?.liberar();
    escenario = null;
    claveOficina = "";
    animCam = null;
    capaEtiquetas.limpiar();
  }

  function crearEtiquetas(visibles) {
    if (modo === "edificio") capaEtiquetas.crear(visibles);
    else capaEtiquetas.limpiar();
  }
  function actualizarEtiquetas(visibles, sel) {
    capaEtiquetas.actualizar(visibles, sel, enfocado);
  }

  function destruir() {
    destruida = true;
    detener();
    clearInterval(relojLuz);
    document.removeEventListener("keydown", alTeclear);
    document.removeEventListener("visibilitychange", alCambiarVisibilidad);
    observador.disconnect();
    quitarOficina();
    compartidos.liberar();
    brilloFx.destruir();
    tiempoGpu?.destruir();
    controles.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    raiz.remove();
    if (window.__cauce3d) delete window.__cauce3d;
  }

  function pausar(si) {
    pausada = Boolean(si);
    if (pausada) detener();
    else { ajustarTamano(); arrancar(); }
  }

  return { dibujar, destruir, pausar };
}

function seleccionDe(objeto) {
  let sel = null;
  for (let o = objeto; o; o = o.parent) {
    if (!o.visible) return null; // personaje que ya salió, anillo oculto, etc.
    sel ??= o.userData.seleccion ?? null;
  }
  return sel;
}

/** Placa con texto (p. ej. «HUMANO») dibujada una vez. */
function texturaPlaca(texto) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#e8ecf5";
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = "#1b2440";
  ctx.fillRect(0, 0, 256, 6);
  ctx.fillRect(0, 58, 256, 6);
  ctx.font = "bold 40px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(texto, 128, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function texturaRadial() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
  g.addColorStop(0, "rgba(0,0,0,0.85)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
