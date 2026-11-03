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
import { OFICINA } from "./paleta.js";
import { crearCatalogoKenney } from "./kenney.js";
import { Recursos } from "./recursos.js";

const ANGULO_BASE = Math.PI / 4;     // vista isométrica: 45° alrededor del cuarto
const INCLINACION = 0.955;          // ≈ 35.3° sobre el horizonte (isométrica clásica)

function leer(clave) { try { return localStorage.getItem(clave); } catch { return null; } }
function guardar(clave, valor) { try { localStorage.setItem(clave, valor); } catch { /* sin almacenamiento */ } }

export function crearVista3D(contenedor, { alSeleccionar, alFallar = () => {} }) {
  const movil = matchMedia("(max-width: 760px), (pointer: coarse)").matches;
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
  const botonModo = (valor, texto) => el("button", { type: "button", clase: "boton boton-chico", "data-modo3d": valor }, texto);
  const modoDom = el("div", { clase: "segmentado", role: "group", "aria-label": "Vista 3D" },
    botonModo("edificio", "Edificio"), botonModo("individual", "Un cuarto"));
  const etiquetasDom = el("div", { clase: "vista3d-etiquetas" });
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
      fuente, modoDom, selector,
      movil ? null : el("label", { clase: "interruptor", title: "Resplandor de letreros y pantallas" }, brillo, "Brillo"),
      centrar),
    aviso, personajesDom, medidasDom);
  contenedor.append(raiz);

  // Escena, luces y cámara.
  const escena = new THREE.Scene();
  escena.background = new THREE.Color(OFICINA.fondo); // así el color es el mismo con y sin brillo
  escena.add(new THREE.HemisphereLight(0xdfe8ff, 0x4a3a2a, 1.9));
  const sol = new THREE.DirectionalLight(0xffe2b8, 1.4);
  sol.position.set(4, 10, 6);
  escena.add(sol);
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
  };

  let escenario = null;    // edificio completo o un solo cuarto (edificio.js)
  let claveOficina = "";
  let modo = leer("cauce.modo3d") === "individual" ? "individual" : "edificio";
  let enfocado = null;     // departamento enfocado: se anima siempre a cuadro completo
  let animCam = null;      // movimiento suave de la cámara al enfocar
  let ultimoAnimados = 0;
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
  brillo.checked = !movil && leer("cauce.brillo3d") !== "0";
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
    // Los controles de arriba tapan parte del lienzo (dos renglones en celular): se baja la imagen
    // para que el edificio quede centrado en el espacio libre. También corrige toques y etiquetas.
    const barra = raiz.querySelector(".vista3d-barra");
    const tapado = barra ? barra.offsetTop + barra.offsetHeight : 0;
    const desplazar = Math.max(0, (tapado - 50) / 2);
    if (desplazar > 0) camara.setViewOffset(w, h, 0, -desplazar, w, h);
    else camara.clearViewOffset();
    camara.updateProjectionMatrix();
  }
  const observador = new ResizeObserver(ajustarTamano);
  observador.observe(raiz);

  /** Ajusta la cámara para ver todo el escenario (edificio o cuarto). */
  function encuadrar() {
    if (!escenario) return;
    const { ancho, fondo, minX, maxX, minZ, maxZ } = escenario.limites;
    const aspecto = Math.max(0.5, raiz.clientWidth / Math.max(1, raiz.clientHeight));
    // Lo que ocupa visto en diagonal; en pantallas angostas se aleja más.
    const mitadVertical = (ancho + fondo) * 0.707 * 0.58 / 2 + 1.1;   // + muros y controles flotantes
    const mitadHorizontal = (ancho + fondo) * 0.707 / 2 + 0.4;
    mitadAlto = Math.max(mitadVertical, mitadHorizontal / aspecto);
    const d = 60;
    const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
    camara.position.set(
      cx + Math.sin(ANGULO_BASE) * Math.sin(INCLINACION) * d,
      Math.cos(INCLINACION) * d,
      cz + Math.cos(ANGULO_BASE) * Math.sin(INCLINACION) * d,
    );
    camara.far = 200;
    camara.zoom = 1;
    controles.target.set(cx, 0.5, cz);
    controles.maxZoom = escenario.modo === "edificio" ? 6 : 3;
    animCam = null;
    controles.update();
    ajustarTamano();
  }

  /** Acerca la cámara a un departamento del edificio (movimiento suave de 0.6 s). */
  function enfocar(id) {
    const r = escenario?.rectangulo(id);
    if (!r || escenario.modo !== "edificio") return;
    const aspecto = Math.max(0.5, raiz.clientWidth / Math.max(1, raiz.clientHeight));
    const mitad = Math.max((r.ancho + r.fondo) * 0.707 * 0.58 / 2 + 1.2, ((r.ancho + r.fondo) * 0.707 / 2 + 0.6) / aspecto);
    animCam = {
      t: 0,
      desde: controles.target.clone(),
      hacia: new THREE.Vector3(r.x, 0.5, r.z),
      zoomDesde: camara.zoom,
      zoomHacia: THREE.MathUtils.clamp(mitadAlto / mitad, 1, controles.maxZoom),
    };
  }
  function moverCamara(dt) {
    if (!animCam) return;
    animCam.t = Math.min(1, animCam.t + dt / 0.6);
    const k = animCam.t * animCam.t * (3 - 2 * animCam.t);
    const nuevo = animCam.desde.clone().lerp(animCam.hacia, k);
    camara.position.add(nuevo.clone().sub(controles.target));
    controles.target.copy(nuevo);
    camara.zoom = animCam.zoomDesde + (animCam.zoomHacia - animCam.zoomDesde) * k;
    camara.updateProjectionMatrix();
    if (animCam.t >= 1) animCam = null;
  }
  centrar.addEventListener("click", encuadrar);
  for (const b of modoDom.querySelectorAll("[data-modo3d]")) {
    b.addEventListener("click", () => {
      if (modo === b.dataset.modo3d) return;
      modo = b.dataset.modo3d;
      guardar("cauce.modo3d", modo);
      if (modelo) dibujar(modelo, seleccion);
    });
  }

  // No dejar que el usuario arrastre la oficina fuera de la pantalla.
  controles.addEventListener("start", () => { animCam = null; }); // el usuario toma el control
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
    if (!selector.value) { // "Todo el piso"
      enfocado = null;
      encuadrar();
      alSeleccionar(null);
      return;
    }
    depMostrado = selector.value;
    if (modelo) guardar(`cauce.depto3d.${modelo.proyecto.id}`, depMostrado);
    alSeleccionar({ tipo: "departamento", id: depMostrado });
  });

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
  const fps = { cuadros: 0, desde: 0, valor: 0, total: 0, ultimos: [] };
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
      if (escenario.modo === "edificio") colocarEtiquetas();
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
    const r = lienzo.getBoundingClientRect();
    const base = raiz.getBoundingClientRect();
    for (const [id, nodo] of etiquetas) {
      const c = escenario.rectangulo(id);
      if (!c) continue;
      proyectado.set(c.x, 2.4, c.z - c.fondo / 2).project(camara);
      nodo.style.transform = `translate(${(r.left - base.left) + (proyectado.x + 1) / 2 * r.width}px, ${(r.top - base.top) + (1 - proyectado.y) / 2 * r.height}px) translate(-50%, -100%)`;
    }
  }

  function arrancar() {
    if (destruida || idCuadro || document.hidden) return;
    anterior = 0;
    idCuadro = requestAnimationFrame(cuadro);
  }
  function detener() {
    cancelAnimationFrame(idCuadro);
    idCuadro = 0;
  }
  const alCambiarVisibilidad = () => (document.hidden ? detener() : arrancar());
  document.addEventListener("visibilitychange", alCambiarVisibilidad);

  function contarCuadro(t) {
    fps.cuadros++;
    fps.total++;
    if (t - fps.desde >= 1000) {
      fps.valor = Math.round((fps.cuadros * 1000) / (t - fps.desde));
      fps.cuadros = 0;
      fps.desde = t;
      fps.ultimos.push(fps.valor);
      if (fps.ultimos.length > 20) fps.ultimos.shift();
      // Si con brillo el equipo no sostiene 40 cuadros por segundo, se apaga solo (no se guarda:
      // la próxima visita lo vuelve a intentar). Con ?medir=1 no se apaga, para poder medir su costo.
      if (composer && !medir && t - brilloDesde > 3000 && fps.valor < 40) {
        brillo.checked = false;
        brilloApagadoSolo = fps.valor;
        brillo.parentElement.title = `Se apagó solo: el equipo iba a ${fps.valor} cuadros por segundo`;
        aplicarBrillo();
      }
      if (!medir) return;
      const i = metricas();
      medidasTexto.textContent = textoMedicion(i);
    }
  }
  function textoMedicion(i) {
    return `${i.fps} cps (prom. ${i.fps_promedio_20s}, mín. ${i.fps_minimo_20s} en 20 s) · ${i.modo === "edificio" ? "edificio completo" : "un cuarto"}, ${i.personajes} personajes\n` +
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
    const u = fps.ultimos;
    return {
      fps: fps.valor,
      fps_promedio_20s: u.length ? Math.round(u.reduce((a, b) => a + b, 0) / u.length) : 0,
      fps_minimo_20s: u.length ? Math.min(...u) : 0,
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
      cuadros_totales: fps.total,
      departamento: depMostrado,
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
  if (medir) window.__cauce3d = { metricas, proyectar };

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
      return;
    }
    selector.hidden = false;

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
      if (modo === "edificio" && enfocado) enfocar(enfocado);
    }
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
    personajesDom.replaceChildren(...chips.map((a) => el("button", {
      type: "button",
      clase: `chip ${a.apariencia.clase2d}`,
      "aria-pressed": sel?.tipo === "agente" && sel.id === a.id ? "true" : "false",
      onclick: () => alSeleccionar({ tipo: "agente", id: a.id }),
    }, el("span", { "aria-hidden": "true" }, a.apariencia.icono), ` ${a.nombre}`)));

    arrancar();
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
    for (const d of visibles) {
      const nodo = etiquetas.get(d.id);
      if (!nodo) continue;
      const ap = d.apariencia_resumen;
      const clave = `${d.nombre}|${ap.clase2d}|${d.alertas.length}|${sel?.tipo === "departamento" && sel.id === d.id}`;
      if (nodo.dataset.clave === clave) continue;
      nodo.dataset.clave = clave;
      nodo.className = `etiqueta-dep ${ap.clase2d}${sel?.tipo === "departamento" && sel.id === d.id ? " elegida" : ""}`;
      nodo.replaceChildren(...[el("span", { clase: "etiqueta-luz", "aria-hidden": "true" }), d.nombre,
        el("span", { clase: "solo-lector" }, `, ${ap.etiqueta}`),
        d.alertas.length ? el("span", { clase: "etiqueta-alertas" }, ` ⚠ ${d.alertas.length}`) : null].filter(Boolean));
      nodo.title = `${d.nombre}: ${ap.etiqueta}`;
    }
  }

  function destruir() {
    destruida = true;
    detener();
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
