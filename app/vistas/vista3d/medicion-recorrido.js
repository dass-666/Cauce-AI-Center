// Recorrido medido para la MSI (PR #35): ascensor entre pisos y vida en «Un cuarto», sin tocar nada.
//   http://127.0.0.1:8765/?medir=1&recorrido=1            (herramientas\medir-recorrido.bat lo abre en la Intel UHD)
// La página se maneja sola con sus propios botones (barra de pisos, «Edificio»/«Un cuarto», selector de cuarto),
// igual que una persona, y registra CADA cuadro: tiempo entre cuadros, corrimiento vertical de la cámara, velo del
// ascensor y posición en pantalla del edificio. Así se puede comprobar que el ascensor mueve la imagen de verdad
// (el edificio sube o baja en la pantalla antes de que el velo lo tape), además de los cps de cada transición.
// Al final entrega cauce-recorrido.json (al servidor de la medición o como descarga). No cambia datos ni estados.
// Lo que mide es el navegador en ESA computadora; en Chromium de pruebas (SwiftShader) los cps no significan nada.

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const redondo = (x, d = 1) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 10 ** d) / 10 ** d);

/** Resumen de una lista de duraciones de cuadro (ms). Puro: se prueba en Node. */
export function resumirCuadros(dts) {
  const v = dts.filter((x) => Number.isFinite(x) && x > 0);
  if (!v.length) return { cuadros: 0, cps_promedio: null, peor_cuadro_ms: null, p95_ms: null, sobre_33_ms: 0, sobre_50_ms: 0 };
  const total = v.reduce((a, b) => a + b, 0);
  const orden = [...v].sort((a, b) => a - b);
  const pct = (p) => orden[Math.min(orden.length - 1, Math.floor(p * orden.length))];
  return {
    cuadros: v.length, cps_promedio: redondo(1000 * v.length / total), peor_cuadro_ms: redondo(orden.at(-1)),
    p95_ms: redondo(pct(0.95)), sobre_33_ms: v.filter((x) => x > 33.4).length, sobre_50_ms: v.filter((x) => x > 50).length,
  };
}

/**
 * Lo que dice un viaje de ascensor a partir de sus muestras por cuadro ({dt, desplaza, velo, cy}).
 * `movimiento_visible_px`: cuánto se movió el edificio en la pantalla mientras el velo dejaba ver (< 0.5).
 * `gradual`: el corrimiento pasó por muchos valores intermedios (no saltó de golpe).
 */
export function resumirViaje(muestras, cy0) {
  const cuadros = resumirCuadros(muestras.map((m) => m.dt));
  const desplazas = muestras.map((m) => m.desplaza).filter(Number.isFinite);
  const distintos = new Set(desplazas.map((d) => d.toFixed(3))).size;
  const visibles = muestras.filter((m) => m.velo < 0.5 && Number.isFinite(m.cy) && Number.isFinite(cy0));
  const mov = visibles.length ? Math.max(...visibles.map((m) => Math.abs(m.cy - cy0))) : 0;
  return {
    ...cuadros,
    duracion_ms: Math.round(muestras.reduce((a, m) => a + (m.dt || 0), 0)),
    corrimiento_max: redondo(desplazas.length ? Math.max(...desplazas.map(Math.abs)) : 0, 2),
    valores_intermedios: distintos,
    velo_max: redondo(Math.max(0, ...muestras.map((m) => m.velo || 0)), 2),
    movimiento_visible_px: Math.round(mov),
    gradual: distintos >= 8 && mov >= 20,
  };
}

/**
 * Corre el recorrido. `api` = window.__cauce3d; `entregar(nombre, doc)` y `avisar(fase)` los pone escena3d.js.
 * @returns el informe entregado
 */
export async function correrRecorrido({ api, entregar, avisar = () => {}, raiz = document }) {
  const informe = { herramienta: "Cauce 3D · recorrido medido (ascensor y «Un cuarto»)", fecha: new Date().toISOString(),
    direccion: location.href, navegador: navigator.userAgent, pantalla: { ventana: [innerWidth, innerHeight], escala: devicePixelRatio },
    vida_en_reposo: new URLSearchParams(location.search).get("vida") !== "0", errores: [], tramos: [] };
  addEventListener("error", (e) => informe.errores.push(String(e.message ?? e).slice(0, 200)));

  // Registro por cuadro (un solo bucle de rAF durante todo el recorrido).
  let registro = null, anterior = performance.now(), activo = true;
  const lienzo = () => raiz.querySelector(".oficina canvas[data-engine]");
  const centroY = () => { const c = api.cajaEdificio?.(); return c ? (c.arriba ?? c.y0 ?? c.top ?? 0) / 2 + (c.abajo ?? c.y1 ?? c.bottom ?? 0) / 2 : NaN; };
  function cuadro(t) {
    if (!activo) return;
    const dt = t - anterior; anterior = t;
    if (registro) {
      const c = api.camara();
      const op = Number(getComputedStyle(lienzo() ?? document.body).opacity);
      registro.push({ dt, desplaza: c.desplaza, velo: c.velo, ascensor: c.ascensor, piso: c.piso, zoom: c.zoom, opacidad: op, cy: registro.conCaja ? centroY() : NaN });
    }
    requestAnimationFrame(cuadro);
  }
  requestAnimationFrame(cuadro);
  const grabar = async (ms, conCaja = false) => { registro = []; registro.conCaja = conCaja; await espera(ms); const r = registro; registro = null; return r; };
  const recursos = () => { const m = api.metricas(); return { geometrias: m.geometrias, texturas: m.texturas, llamadas: m.llamadas, memoria_js_mb: m.memoria_js_mb ?? null }; };
  // Solo las pestañas de piso (los «+N pendientes» no tienen oficina).
  const pisos = () => [...raiz.querySelectorAll('#pisos .piso[role="tab"]')];
  const botonPiso = (x) => (typeof x === "number" ? pisos()[x] : pisos().find((b) => b.textContent.includes(x)));
  const selector = () => raiz.querySelector(".vista3d-selector");
  const cuarto = (id) => { const s = selector(); s.value = id; s.dispatchEvent(new Event("change", { bubbles: true })); };
  const modo = (valor) => raiz.querySelector(`[data-modo3d="${valor}"]`)?.click();

  async function viajar(destino) {
    const b = botonPiso(destino); if (!b) return null;
    const desde = api.camara().piso;
    const cy0 = centroY();
    registro = []; registro.conCaja = true;
    b.click();
    const t0 = performance.now();
    // Hasta que el ascensor llegó al piso nuevo y la escena quedó quieta (tope 8 s).
    while (performance.now() - t0 < 8000) {
      await espera(50);
      const c = api.camara();
      if (c.ascensor === null && c.piso !== desde && performance.now() - t0 > 300) break;
    }
    await espera(400);
    const r = registro; registro = null;
    return { desde, hacia: api.camara().piso, ...resumirViaje(r, cy0), hubo_ascensor: r.some((m) => m.ascensor) };
  }

  avisar("recorrido: asentando");
  await espera(6000);
  modo("edificio"); await espera(1500);
  if (api.camara().piso !== "compago") { await viajar("Compago"); await espera(1500); }

  // 1. Edificio de Compago, quieto (referencia).
  avisar("recorrido: edificio quieto");
  informe.tramos.push({ tramo: "edificio-compago-quieto", ...resumirCuadros((await grabar(10000)).map((m) => m.dt)) });
  const r0 = recursos();

  // 2. Viajes de ascensor (dos vueltas: piso contiguo, dos pisos y regreso).
  avisar("recorrido: ascensor");
  const ruta = ["Ek Chuah", "Montambre", "Compago", "CSI", "Compago"]; // CSI = el piso más lejano con oficinas (4 pisos)
  informe.viajes = [];
  // La primera visita a un piso guarda en caché texturas compartidas (p. ej. las de CSI); eso no es una fuga. Fuga =
  // que la SEGUNDA vuelta, por los mismos pisos, suba otra vez.
  const porVuelta = [];
  for (let vuelta = 0; vuelta < 2; vuelta++) {
    for (const destino of ruta) {
      const v = await viajar(destino);
      if (v) informe.viajes.push(v);
      await espera(1500);
    }
    porVuelta.push(recursos());
  }
  const r1 = porVuelta[1];

  // 3. «Un cuarto»: Compago › Evaluación de oportunidades, quieto 20 s (vida en reposo).
  avisar("recorrido: un cuarto");
  modo("individual"); await espera(2500);
  cuarto("oportunidades"); await espera(4000);
  const antes = api.estaciones?.().flatMap((x) => x.puestos.map((p) => [p.estado, p.bucle])) ?? [];
  informe.tramos.push({ tramo: "un-cuarto-oportunidades-quieto", ...resumirCuadros((await grabar(20000)).map((m) => m.dt)) });
  const despues = api.estaciones?.().flatMap((x) => x.puestos.map((p) => [p.estado, p.bucle])) ?? [];
  informe.estacion_sin_cambios = JSON.stringify(antes) === JSON.stringify(despues);
  informe.alguien_teclea = despues.some(([, b]) => b === "teclear");

  // 4. Cambios de cuarto dentro del mismo piso (fundido y acercamiento; sin ascensor).
  avisar("recorrido: cambios de cuarto");
  const ids = [...selector().options].map((o) => o.value).filter(Boolean);
  informe.cambios_de_cuarto = [];
  for (let vuelta = 0; vuelta < 2; vuelta++) for (const id of ids) {
    registro = []; cuarto(id); await espera(1300);
    const r = registro; registro = null;
    informe.cambios_de_cuarto.push({ cuarto: id, ...resumirCuadros(r.map((m) => m.dt)), hubo_ascensor: r.some((m) => m.ascensor),
      opacidad_min: redondo(Math.min(1, ...r.map((m) => m.opacidad)), 2), zoom_min: redondo(Math.min(1, ...r.map((m) => m.zoom)), 2) });
  }
  // 5. Ascensor también desde «Un cuarto».
  informe.viajes_un_cuarto = [await viajar("Ek Chuah"), (await espera(1500), await viajar("Compago"))].filter(Boolean);
  cuarto("oportunidades"); await espera(2000);
  modo("edificio"); await espera(3000);
  const r2 = recursos();
  activo = false;

  const sube = (a, b) => b.geometrias > a.geometrias + 2 || b.texturas > a.texturas;
  informe.recursos = { inicio: r0, tras_vuelta_1: porVuelta[0], tras_vuelta_2: r1, final: r2,
    crecen: sube(porVuelta[0], r1) || sube(r1, r2) };
  const m = api.metricas();
  informe.gpu = m.gpu ?? null;
  informe.texto = textoRecorrido(informe);
  await entregar("cauce-recorrido", informe);
  avisar("recorrido terminado");
  return informe;
}

export function textoRecorrido(i) {
  const v = i.viajes ?? [];
  const peor = (l, k) => Math.max(0, ...l.map((x) => x[k] ?? 0));
  const prom = (l, k) => { const x = l.map((y) => y[k]).filter(Number.isFinite); return x.length ? redondo(x.reduce((a, b) => a + b, 0) / x.length) : null; };
  const t = (n) => i.tramos.find((x) => x.tramo === n) ?? {};
  const cc = i.cambios_de_cuarto ?? [];
  return [
    `RECORRIDO TERMINADO · GPU: ${i.gpu ?? "?"}${/intel/i.test(i.gpu ?? "") ? "" : "  ⚠ NO es la Intel"} · vida en reposo ${i.vida_en_reposo ? "encendida" : "APAGADA (?vida=0)"}`,
    `Edificio quieto: ${t("edificio-compago-quieto").cps_promedio} cps · peor cuadro ${t("edificio-compago-quieto").peor_cuadro_ms} ms`,
    `Ascensor (${v.length} viajes): ${prom(v, "cps_promedio")} cps prom. · peor cuadro ${peor(v, "peor_cuadro_ms")} ms · cuadros > 50 ms: ${v.reduce((a, x) => a + x.sobre_50_ms, 0)} · ` +
      `graduales ${v.filter((x) => x.gradual).length}/${v.length} · el edificio se movió ${Math.min(...v.map((x) => x.movimiento_visible_px))}–${peor(v, "movimiento_visible_px")} px a la vista`,
    `«Un cuarto» quieto (20 s): ${t("un-cuarto-oportunidades-quieto").cps_promedio} cps · peor cuadro ${t("un-cuarto-oportunidades-quieto").peor_cuadro_ms} ms · ` +
      `estación sin cambios de estado: ${i.estacion_sin_cambios ? "sí" : "NO"} · alguien teclea: ${i.alguien_teclea ? "SÍ" : "no"}`,
    `Cambios de cuarto (${cc.length}): ${prom(cc, "cps_promedio")} cps prom. · peor cuadro ${peor(cc, "peor_cuadro_ms")} ms · con ascensor: ${cc.filter((x) => x.hubo_ascensor).length}`,
    `Recursos (inicio → 1.ª vuelta → 2.ª vuelta → final): geometrías ${["inicio", "tras_vuelta_1", "tras_vuelta_2", "final"].map((k) => i.recursos[k].geometrias).join("→")} · ` +
      `texturas ${["inicio", "tras_vuelta_1", "tras_vuelta_2", "final"].map((k) => i.recursos[k].texturas).join("→")} → ${i.recursos.crecen ? "CRECEN tras la 1.ª vuelta (posible fuga)" : "sin crecer tras la 1.ª vuelta"}`,
    i.errores.length ? `Errores: ${i.errores.join(" | ")}` : "Errores: ninguno",
  ].join("\n");
}
