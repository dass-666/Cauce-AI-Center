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
import { OFICINA, COLOR_ESTADO } from "./paleta.js";
import { luzSegunHora } from "./iluminacion.js";
import { crearBarraMovil } from "./barra-movil.js";
import { vecinoDe, resumenDepartamento } from "./navegacion.js";
import { crearMinimapa } from "./minimapa.js";
import { calcularEncuadre, aPixeles, dentro } from "./encuadre.js";
import { acomodarEtiquetas, nombresCortos, prioridadEtiqueta } from "./etiquetas.js";
import { crearCatalogoKenney } from "./kenney.js";
import { Recursos } from "./recursos.js";
import { crearMedidor, firmaMedicion } from "./medidor.js";

const ANGULO_BASE = Math.PI / 4;     // vista isométrica: 45° alrededor del cuarto
const INCLINACION = 0.955;          // ≈ 35.3° sobre el horizonte (isométrica clásica)

function leer(clave) { try { return localStorage.getItem(clave); } catch { return null; } }
function guardar(clave, valor) { try { localStorage.setItem(clave, valor); } catch { /* sin almacenamiento */ } }

export function crearVista3D(contenedor, { alSeleccionar, alFallar = () => {}, tapan = () => [] }) {
  const movil = matchMedia("(max-width: 760px), (pointer: coarse)").matches;
  const menosMovimiento = matchMedia("(prefers-reduced-motion: reduce)");
  const medir = new URLSearchParams(location.search).has("medir");

  // Si el navegador no tiene WebGL, three.js lanza un error aquí y app.js vuelve al plano 2D.
  const renderer = new THREE.WebGLRenderer({
    antialias: !movil,
    powerPreference: movil ? "low-power" : "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, movil ? 1.25 : 2));
  renderer.info.autoReset = false;

  const raiz = el("div", { clase: "vista3d", role: "group", "aria-label": "Oficina 3D" });
  const lienzo = renderer.domElement;
  lienzo.setAttribute("aria-hidden", "true");
  const selector = el("select", { clase: "vista3d-selector", "aria-label": "Departamento" });
  const fuente = el("span", { clase: "vista3d-fuente" });
  const brillo = el("input", { type: "checkbox" });
  const centrar = el("button", { type: "button", clase: "boton boton-chico" }, "Centrar");
  const volverPiso = el("button", { type: "button", clase: "boton boton-chico", hidden: true, title: "Volver al piso completo (Esc)" }, "← Piso");
  const luzFija = el("input", { type: "checkbox" });
  const minimapa = crearMinimapa({ alElegir: (id) => (id ? alSeleccionar({ tipo: "departamento", id }) : volverAlPiso()) });
  const botonModo = (valor, texto) => el("button", { type: "button", clase: "boton boton-chico", "data-modo3d": valor }, texto);
  const modoDom = el("div", { clase: "segmentado", role: "group", "aria-label": "Vista 3D" },
    botonModo("edificio", "Edificio"), botonModo("individual", "Un cuarto"));
  const etiquetasDom = el("div", { clase: "vista3d-etiquetas" });
  // Celular: barra inferior (◀ departamento ▶ ⋯). Usa las mismas acciones que el teclado y el gesto.
  const barraMovil = movil ? crearBarraMovil({
    alPaso: (paso) => irAVecino(paso),
    alElegir: (id) => (id ? alSeleccionar({ tipo: "departamento", id }) : volverAlPiso()),
    alModo: (valor) => cambiarModo(valor),
    alLuzFija: (fija) => { luzFija.checked = fija; luzFija.dispatchEvent(new Event("change")); if (modelo) actualizarBarraMovil(); },
    alCentrar: () => (modo === "edificio" && enfocado ? enfocar(enfocado) : encuadrar()),
    alVolverPiso: () => volverAlPiso(),
  }) : null;
  const aviso = el("p", { clase: "vista3d-aviso", role: "status" });
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
      fuente, modoDom, volverPiso, selector,
      movil ? null : el("label", { clase: "interruptor", title: "Resplandor de letreros y pantallas" }, brillo, "Brillo"),
      el("label", { clase: "interruptor luz-fija", title: "Sin luz de la hora: la escena siempre igual de iluminada" }, luzFija, "Luz fija"),
      centrar),
    aviso, personajesDom, minimapa.nodo, barraMovil?.nodo ?? null, medidasDom);
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
    compartido.matPiso.emissive.setRGB(0.16 * luzActual.noche, 0.11 * luzActual.noche, 0.06 * luzActual.noche);
    for (const m of compartido.anillosEstado.values()) m.opacity = 0.5 + 0.35 * luzActual.noche;
    escenario?.aplicarLuz(luzActual);
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
    matSombra: compartidos.agregar(new THREE.MeshBasicMaterial({ map: texturaSombra, transparent: true, depthWrite: false, opacity: 0.4 })),
    geoSombraEscritorio: compartidos.agregar(new THREE.PlaneGeometry(1.8, 1.4).rotateX(-Math.PI / 2)),
    burbujas: crearBurbujas(compartidos, ESTADOS),
    catalogo: crearCatalogoKenney(compartidos),
    matPiso: compartidos.agregar(new THREE.MeshLambertMaterial({ map: compartidos.agregar(texturaDuela()) })),
    // Un material por estado para el anillo bajo cada personaje (opacidad según la hora).
    anillosEstado: new Map(Object.entries(COLOR_ESTADO).map(([estado, color]) =>
      [estado, compartidos.agregar(new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false }))])),
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
  const etiquetas = new Map();
  let claveCargando = null;
  let modelo = null;
  let seleccion = null;
  let depMostrado = null;
  let mitadAlto = 4;
  let destruida = false;

  // --- Brillo (bloom): solo escritorio, se carga bajo demanda y se puede apagar ---
  let composer = null;
  let bloom = null;
  let cargandoBrillo = false;
  let brilloDesde = 0;
  brillo.checked = !movil && leer("cauce.brillo3d") === "1"; // apagado por defecto: se enciende a mano
  brillo.addEventListener("change", () => {
    guardar("cauce.brillo3d", brillo.checked ? "1" : "0");
    aplicarBrillo();
  });
  async function aplicarBrillo() {
    if (!brillo.checked || movil) {
      composer?.dispose();
      bloom?.dispose();
      composer = bloom = null;
      return;
    }
    if (composer || cargandoBrillo) return;
    cargandoBrillo = true;
    try {
      const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }] = await Promise.all([
        import("three/addons/postprocessing/EffectComposer.js"),
        import("three/addons/postprocessing/RenderPass.js"),
        import("three/addons/postprocessing/UnrealBloomPass.js"),
        import("three/addons/postprocessing/OutputPass.js"),
      ]);
      if (destruida || !brillo.checked) return;
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(escena, camara));
      bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.35, 0.62);
      composer.addPass(bloom);
      composer.addPass(new OutputPass());
      brilloDesde = performance.now();
      ajustarTamano();
    } catch (e) {
      // Sin brillo la oficina funciona igual.
      brillo.checked = false;
      console.warn("Brillo no disponible:", e);
    } finally {
      cargandoBrillo = false;
    }
  }
  aplicarBrillo();

  // --- Tamaño ---
  function ajustarTamano() {
    const w = Math.max(1, raiz.clientWidth);
    const h = Math.max(1, raiz.clientHeight);
    renderer.setSize(w, h, false);
    composer?.setSize(w, h);
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
    let abajo = h - 8;
    let arriba = barra ? barra.offsetTop + barra.offsetHeight + 6 : 8;
    // Lo que flota abajo sube el límite inferior; lo que flota arriba (el aviso en celular) baja el superior.
    for (const n of [aviso, personajesDom, barraMovil?.nodo, ...tapan()]) {
      if (!n || n.hidden || n.offsetHeight === 0 || !n.childNodes.length) continue;
      const c = cajaEnRaiz(n);
      if (c.abajo <= 0 || c.arriba >= h || c.der <= 0 || c.izq >= w) continue; // fuera de la vista (p. ej. el panel a un lado en escritorio)
      if ((c.arriba + c.abajo) / 2 < h / 2) arriba = Math.max(arriba, c.abajo + 6);
      else abajo = Math.min(abajo, c.arriba - 6);
    }
    return { w, h, arriba, abajo: Math.max(arriba + 60, abajo), izq: 8, der: w - 8 };
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
    const r = escenario?.rectangulo(id);
    if (!r || escenario.modo !== "edificio") return;
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
    enfocado = null;
    encuadrar({ suave: true });
    alSeleccionar(null);
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
    });
  }

  // Teclado: 1–9 enfoca un departamento, ← → pasa al vecino, Esc regresa al piso completo.
  function alTeclear(e) {
    if (e.ctrlKey || e.metaKey || e.altKey || !modelo || !escenario) return;
    if (e.target instanceof HTMLElement && e.target.closest("input, select, textarea")) return;
    const deps = modelo.departamentos;
    let destino = null;
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
    animCam.t = menosMovimiento.matches ? 1 : Math.min(1, animCam.t + dt / 0.6); // "reducir movimiento" del sistema: sin viaje de cámara
    const k = animCam.t * animCam.t * (3 - 2 * animCam.t);
    const nuevo = animCam.desde.clone().lerp(animCam.hacia, k);
    camara.position.add(nuevo.clone().sub(controles.target));
    controles.target.copy(nuevo);
    camara.zoom = animCam.zoomDesde + (animCam.zoomHacia - animCam.zoomDesde) * k;
    camara.updateProjectionMatrix();
    if (animCam.t >= 1) animCam = null;
  }
  centrar.addEventListener("click", () => encuadrar());
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
  controles.addEventListener("start", () => { animCam = null; usuarioMovio = true; }); // el usuario toma el control
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

  // Deslizar a los lados con un dedo (celular): departamento vecino. Se escucha en toda la vista,
  // así funciona aunque el dedo empiece sobre una etiqueta; no en la barra, el minimapa ni las medidas.
  let dedos = 0;
  let deslizar = null;
  // Tocar fuera de la lista o del menú de la barra móvil los cierra.
  if (barraMovil) raiz.addEventListener("pointerdown", (e) => {
    if (barraMovil.estaAbierta() && !(e.target instanceof Element && e.target.closest(".vista3d-movil"))) barraMovil.cerrar();
  }, true);
  raiz.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "touch") return;
    dedos++;
    const enControl = e.target instanceof Element && e.target.closest(".vista3d-barra, .vista3d-minimapa, .vista3d-medidas, .vista3d-personajes, .vista3d-movil");
    deslizar = dedos > 1 || enControl ? null : { x: e.clientX, y: e.clientY, t: performance.now() };
  }, true);
  const soltar = (e) => {
    if (e.pointerType !== "touch") return;
    dedos = Math.max(0, dedos - 1);
    const d = deslizar;
    deslizar = null;
    if (!d || e.type === "pointercancel" && !movil) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (movil && modelo && escenario && performance.now() - d.t < 700 && Math.abs(dx) > 50 && Math.abs(dx) > 1.5 * Math.abs(dy)) {
      barraMovil?.cerrar();
      irAVecino(dx < 0 ? 1 : -1);
    }
  };
  raiz.addEventListener("pointerup", soltar, true);
  raiz.addEventListener("pointercancel", (e) => { if (e.pointerType === "touch") { dedos = Math.max(0, dedos - 1); deslizar = null; } }, true);

  // --- Pérdida del contexto gráfico (driver reiniciado, poca memoria en el móvil) ---
  lienzo.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    detener();
    alFallar("La tarjeta gráfica dejó de responder (contexto WebGL perdido).");
  });

  // --- Ciclo de dibujo: limita cuadros por segundo y se pausa con la pestaña oculta ---
  const intervalo = 1000 / (movil ? 30 : 60);
  let idCuadro = 0;
  let anterior = 0;
  let ultimoDibujo = 0;
  let reloj = 0;
  const medidor = crearMedidor({ ventana: 20 });
  let brilloApagadoSolo = null;

  function cuadro(t) {
    idCuadro = requestAnimationFrame(cuadro);
    if (t - ultimoDibujo < intervalo - 1) return;
    ultimoDibujo = t;
    const dt = anterior ? Math.min(0.1, (t - anterior) / 1000) : 0;
    anterior = t;
    reloj += dt;
    moverCamara(dt);
    controles.update();
    if (escenario) {
      ultimoAnimados = escenario.paso(dt, reloj, hzDe);
      if (escenario.modo === "edificio") {
        colocarEtiquetas();
        if (t - ultimoMinimapa > 250) { ultimoMinimapa = t; dibujarMinimapa(); }
      }
    }
    renderer.info.reset();
    if (composer) composer.render(dt);
    else renderer.render(escena, camara);
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
    const verlas = camara.zoom < 1.9;
    etiquetasDom.hidden = !verlas;
    if (!verlas) return;
    // Se calcula dónde cae cada etiqueta y se ocultan las que chocarían con otra más importante.
    const w = raiz.clientWidth, h = raiz.clientHeight;
    const items = [];
    const enPantalla = (x, y, z) => { proyectado.set(x, y, z).project(camara); return { x: (proyectado.x + 1) / 2 * w, y: (1 - proyectado.y) / 2 * h }; };
    for (const [id, nodo] of etiquetas) {
      const c = escenario.rectangulo(id);
      if (!c) continue;
      // Primero sobre el muro del fondo; si choca, al centro del cuarto; si no, junto a la puerta.
      const opciones = [enPantalla(c.x, 2.4, c.z - c.fondo / 2), enPantalla(c.x, 1.3, c.z), enPantalla(c.x - c.ancho / 4, 1.0, c.z + c.fondo / 2)];
      items.push({ id, opciones, w: Number(nodo.dataset.ancho) || 120, h: Number(nodo.dataset.alto) || 24, prioridad: Number(nodo.dataset.prioridad) || 0 });
    }
    const zona = zonaLibre();
    // En celular la barra de abajo es fija: ninguna etiqueta debe quedar debajo de ella (ni al bajar la página).
    const limite = barraMovil && !barraMovil.nodo.hidden ? Math.min(h, cajaEnRaiz(barraMovil.nodo.querySelector(".movil-barra")).arriba - 4) : h;
    const elegidas = acomodarEtiquetas(items, { w, h: limite, arriba: zona.arriba });
    for (const it of items) {
      const nodo = etiquetas.get(it.id);
      const k = elegidas.get(it.id);
      if (nodo.hidden !== (k === undefined)) nodo.hidden = k === undefined;
      if (k !== undefined) nodo.style.transform = `translate(${it.opciones[k].x}px, ${it.opciones[k].y}px) translate(-50%, -100%)`;
    }
  }

  function arrancar() {
    if (destruida || idCuadro || document.hidden) return;
    anterior = 0;
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
    medidor.vigilar(firmaMedicion({
      brillo: brillo.checked ? "brillo" : "sin brillo",
      modo: escenario?.modo ?? modo,
      enfoque: escenario?.modo === "edificio" ? (enfocado ?? "") : "",
      tamano: `${lienzo.width}x${lienzo.height}`,
    }), t);
    if (!medidor.cuadro(t)) return;
    const cps = medidor.valor;
    // Si con brillo el equipo no sostiene 40 cuadros por segundo, se apaga solo (no se guarda:
    // la próxima visita lo vuelve a intentar). Con ?medir=1 no se apaga, para poder medir su costo.
    if (composer && !medir && t - brilloDesde > 3000 && cps < 40) {
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
      `px ${i.pixelRatio} · ${i.tamano.join("×")} · brillo ${i.brillo ? "encendido" : i.brillo_apagado_solo ? `apagado solo (${i.brillo_apagado_solo} cps)` : "apagado"}` +
      `${i.movil ? " · modo celular" : ""}\nGPU: ${i.gpu}`;
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
      brillo: Boolean(composer),
      tamano: [lienzo.width, lienzo.height],
      cuadros_totales: r.cuadros_totales,
      departamento: depMostrado,
      departamento_nombre: nombre(depMostrado),
      enfocado: escenario?.modo === "edificio" ? enfocado : null,
      enfocado_nombre: enfocado ? nombre(enfocado) : null,
      modo: escenario?.modo ?? modo,
      personajes: escenario ? escenario.personajes().length : 0,
      animados_ultimo_cuadro: ultimoAnimados,
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
  }));
  if (medir) window.__cauce3d = { metricas, proyectar, personajes: personajesAhora };

  // --- Dibujo a partir del modelo de vista ---
  function dibujar(m, sel) {
    modelo = m;
    seleccion = sel;
    const deps = m.departamentos;
    raiz.dataset.conexion = m.conexion;
    fuente.textContent = m.es_demo ? "DEMO" : "REAL";
    fuente.className = `vista3d-fuente ${m.es_demo ? "es-demo" : "es-real"}`;
    fuente.title = m.es_demo ? "Datos de demostración: no es actividad real" : "Datos reales del sistema";

    if (deps.length === 0) {
      quitarOficina();
      selector.replaceChildren();
      selector.hidden = true;
      personajesDom.replaceChildren();
      aviso.hidden = false;
      aviso.textContent = m.motivo ?? "No hay datos de este proyecto.";
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
    const clave = `${modo}/${m.proyecto.id}/${m.cuadricula.metros_por_celda}/` +
      visibles.map((d) => `${d.id}:${d.posicion.x},${d.posicion.y},${d.posicion.ancho},${d.posicion.alto}:${d.agentes.map((a) => a.id).join(",")}`).join("|");
    const ids = visibles.flatMap((d) => d.agentes.map((a) => a.id));
    if (clave !== claveOficina) {
      if (escenario) quitarOficina();
      if (compartido.catalogo.listos(ids)) {
        escenario = crearEscenario(visibles, m, compartido, { modo });
        escena.add(escenario.grupo);
        claveOficina = clave;
        crearEtiquetas(visibles);
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
    if (escenario && nuevoEnfoque !== enfocado) {
      enfocado = nuevoEnfoque;
      // En celular, al elegir un departamento la vista 3D sube hasta quedar bajo la cabecera fija,
      // así el cuarto tiene espacio entre la insignia y el detalle.
      if (movil && enfocado && raiz.getBoundingClientRect().top > 120) contenedor.scrollIntoView({ block: "start" });
      if (modo === "edificio" && enfocado) enfocar(enfocado);
    }
    // Al elegir un agente, la cámara se acerca a su escritorio (una vez por elección).
    const agenteElegido = escenario && sel?.tipo === "agente" ? sel.id : null;
    if (agenteElegido && agenteElegido !== ultimoAgente) acercarAgente(agenteElegido);
    ultimoAgente = agenteElegido;
    volverPiso.hidden = !(modo === "edificio" && enfocado);
    minimapa.nodo.hidden = modo !== "edificio";
    dibujarMinimapa();
    actualizarBarraMovil();
    escenario?.seleccionar(sel);
    actualizarEtiquetas(visibles, sel);

    const delAviso = modo === "edificio" && !enfocado ? deps : [dep];
    const agentesAviso = delAviso.flatMap((d) => d.agentes);
    const vacios = agentesAviso.filter((a) => a.estado === "sin_datos").length;
    const textos = [];
    if (m.conexion !== "en_linea") textos.push(`${m.conexion_etiqueta}: sin evidencia vigente, los personajes salen de la oficina.`);
    else if (agentesAviso.length === 0) textos.push("Este departamento no tiene personajes.");
    else if (vacios) textos.push(`${vacios} silla(s) vacía(s): sin registro que respalde actividad.`);
    aviso.hidden = textos.length === 0;
    aviso.textContent = textos.join(" ");

    const chips = modo === "edificio" && !enfocado ? [] : dep.agentes;
    const reencuadrar = recienConstruido;
    recienConstruido = false;
    personajesDom.replaceChildren(...chips.map((a) => el("button", {
      type: "button",
      clase: `chip ${a.apariencia.clase2d}`,
      "aria-pressed": sel?.tipo === "agente" && sel.id === a.id ? "true" : "false",
      onclick: () => alSeleccionar({ tipo: "agente", id: a.id }),
    }, el("span", { "aria-hidden": "true" }, a.apariencia.icono), ` ${a.nombre}`)));
    // Ya con avisos y botones en su lugar, se ajusta el encuadre al espacio que de verdad queda libre.
    if (reencuadrar && !enfocado && !usuarioMovio) encuadrar();

    arrancar();
  }

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
    etiquetas.clear();
    etiquetasDom.replaceChildren();
  }

  function crearEtiquetas(visibles) {
    etiquetas.clear();
    etiquetasDom.replaceChildren();
    if (modo !== "edificio") return;
    for (const d of visibles) {
      const nodo = el("button", { type: "button", clase: "etiqueta-dep", onclick: () => alSeleccionar({ tipo: "departamento", id: d.id }) });
      etiquetas.set(d.id, nodo);
      etiquetasDom.append(nodo);
    }
  }
  function actualizarEtiquetas(visibles, sel) {
    const cortos = nombresCortos(visibles.map((d) => d.nombre));
    visibles.forEach((d) => {
      const nodo = etiquetas.get(d.id);
      if (nodo) nodo.dataset.prioridad = prioridadEtiqueta({ enfocado: d.id === enfocado || (sel?.tipo === "departamento" && sel.id === d.id), estado: d.estado_resumen, alertas: d.alertas.length });
    });
    visibles.forEach((d, i) => { d = { ...d, corto: movil ? cortos[i] : d.nombre }; actualizarEtiqueta(d, sel); });
  }
  function actualizarEtiqueta(d, sel) {
    {
      const nodo = etiquetas.get(d.id);
      if (!nodo) return;
      const ap = d.apariencia_resumen;
      const clave = `${d.corto}|${d.nombre}|${ap.clase2d}|${d.alertas.length}|${sel?.tipo === "departamento" && sel.id === d.id}`;
      if (nodo.dataset.clave === clave) return;
      nodo.dataset.clave = clave;
      nodo.className = `etiqueta-dep ${ap.clase2d}${sel?.tipo === "departamento" && sel.id === d.id ? " elegida" : ""}`;
      nodo.replaceChildren(...[el("span", { clase: "etiqueta-luz", "aria-hidden": "true" }), d.corto,
        el("span", { clase: "solo-lector" }, `, ${ap.etiqueta}`),
        d.alertas.length ? el("span", { clase: "etiqueta-alertas" }, ` ⚠ ${d.alertas.length}`) : null].filter(Boolean));
      nodo.title = `${d.nombre}: ${ap.etiqueta}`;
      nodo.setAttribute("aria-label", `${d.nombre}: ${ap.etiqueta}${d.alertas.length ? `, ${d.alertas.length} alerta(s)` : ""}`);
      // Tamaño medido una vez por cambio de contenido (no en cada cuadro).
      const ocultaba = [etiquetasDom.hidden, nodo.hidden];
      etiquetasDom.hidden = nodo.hidden = false;
      nodo.dataset.ancho = nodo.offsetWidth;
      nodo.dataset.alto = nodo.offsetHeight;
      [etiquetasDom.hidden, nodo.hidden] = ocultaba;
    }
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
    composer?.dispose();
    bloom?.dispose();
    controles.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    raiz.remove();
    if (window.__cauce3d) delete window.__cauce3d;
  }

  return { dibujar, destruir };
}

function seleccionDe(objeto) {
  let sel = null;
  for (let o = objeto; o; o = o.parent) {
    if (!o.visible) return null; // personaje que ya salió, anillo oculto, etc.
    sel ??= o.userData.seleccion ?? null;
  }
  return sel;
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

/** Duela de madera dibujada una vez en un lienzo (sin imágenes descargadas). */
function texturaDuela() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  const tonos = ["#a07a52", "#9a7450", "#a68058", "#97714c"];
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = tonos[i];
    ctx.fillRect(0, i * 32, 128, 32);
    ctx.fillStyle = "rgba(60,40,20,0.35)";
    ctx.fillRect(0, i * 32, 128, 2);
    ctx.fillRect(((i * 53) % 96) + 16, i * 32, 2, 32); // junta entre tablas
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
