// Rendimiento (Chromium): mide el TRABAJO que pide la oficina en cada escenario, de forma que sirva para
// comparar dos versiones en la misma máquina. Funciona con cualquier versión (no necesita código nuevo en la app):
// envuelve las llamadas WebGL de la página y lee las métricas del navegador por CDP.
//
//   node pruebas/navegador/rendimiento.cjs                     → versión servida en el puerto 8765
//   PUERTO=8766 node pruebas/navegador/rendimiento.cjs         → otra versión (p. ej. la anterior)
//   JSON=salida.json ...                                        → guarda el resultado
//
// IMPORTANTE: aquí Chromium dibuja con SwiftShader (la CPU hace de tarjeta gráfica). Los cuadros por segundo
// de este script NO son los de una Intel UHD. Lo que sí es válido y comparable entre versiones:
//   · llamadas de dibujo, triángulos, pasadas de pantalla completa y píxeles de posproceso por cuadro
//     (trabajo que la tarjeta gráfica tendrá que hacer en cualquier equipo),
//   · cuadros dibujados por segundo cuando la escena está quieta (si no cambia nada, ¿se redibuja?),
//   · tiempo de JavaScript por cuadro y recálculos de diseño (layout) forzados (trabajo del procesador).
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = 'http://127.0.0.1:' + (process.env.PUERTO || 8765) + '/';

// Se inyecta antes de que cargue la app: cuenta lo que se pide a WebGL en cada cuadro.
function instrumentar() {
  const c = { draws: 0, tris: 0, fsPasses: 0, fsPixels: 0, frames: 0, framesDibujados: 0, fbBinds: 0 };
  window.__perf = c;
  let vw = 0, vh = 0, enCuadro = 0;
  for (const Ctx of [window.WebGL2RenderingContext, window.WebGLRenderingContext].filter(Boolean)) {
    const P = Ctx.prototype;
    const viewport = P.viewport;
    P.viewport = function (x, y, w, h) { vw = w; vh = h; return viewport.call(this, x, y, w, h); };
    const bind = P.bindFramebuffer;
    P.bindFramebuffer = function (...a) { c.fbBinds++; return bind.apply(this, a); };
    for (const n of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
      const f = P[n];
      if (!f) continue;
      P[n] = function (modo, a1, a2, a3, a4) {
        c.draws++; enCuadro++;
        const cuenta = n.startsWith('drawArrays') ? a2 : a1;
        c.tris += Math.floor(cuenta / 3) * (n.endsWith('Instanced') ? (n === 'drawArraysInstanced' ? a3 : a4) : 1);
        // FullScreenQuad de three.js = un triángulo de 3 vértices con drawArrays: una pasada de pantalla completa.
        if (n === 'drawArrays' && cuenta === 3) { c.fsPasses++; c.fsPixels += vw * vh; }
        return f.call(this, modo, a1, a2, a3, a4);
      };
    }
  }
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf((t) => {
    const antes = enCuadro;
    cb(t);
    if (enCuadro > antes) { c.framesDibujados++; enCuadro = 0; }
  });
  // Recálculos de diseño forzados: lecturas de tamaño/posición justo después de cambiar el DOM.
  setInterval(() => { c.frames++; }, 1000);
}

async function medir(p, cdp, segundos) {
  const metricas = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
  const a = await p.evaluate(() => ({ ...window.__perf }));
  const ma = await metricas();
  const t0 = Date.now();
  await p.waitForTimeout(segundos * 1000);
  const dt = (Date.now() - t0) / 1000;
  const b = await p.evaluate(() => ({ ...window.__perf }));
  const mb = await metricas();
  const f = Math.max(1, b.framesDibujados - a.framesDibujados);
  const app = await p.evaluate(() => window.__cauce3d?.metricas?.() ?? null);
  return {
    cuadros_dibujados_por_s: Math.round((b.framesDibujados - a.framesDibujados) / dt * 10) / 10,
    llamadas_por_cuadro: Math.round((b.draws - a.draws) / f),
    triangulos_por_cuadro: Math.round((b.tris - a.tris) / f),
    pasadas_pantalla_completa_por_cuadro: Math.round((b.fsPasses - a.fsPasses) / f * 10) / 10,
    megapixeles_posproceso_por_cuadro: Math.round((b.fsPixels - a.fsPixels) / f / 1e4) / 100,
    cambios_framebuffer_por_cuadro: Math.round((b.fbBinds - a.fbBinds) / f * 10) / 10,
    js_ms_por_segundo: Math.round((mb.ScriptDuration - ma.ScriptDuration) * 1000 / dt * 10) / 10,
    layout_forzados_por_segundo: Math.round((mb.LayoutCount - ma.LayoutCount) / dt * 10) / 10,
    estilos_recalculados_por_segundo: Math.round((mb.RecalcStyleCount - ma.RecalcStyleCount) / dt * 10) / 10,
    heap_mb: Math.round(mb.JSHeapUsedSize / 1e5) / 10,
    app_llamadas: app?.llamadas ?? null,
    app_brillo: app?.brillo ?? null,
    app_modo: app?.modo ?? null,
    app_personajes: app?.personajes ?? null,
    fps_swiftshader_no_es_intel: app?.fps ?? null,
  };
}

(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const errs = [];
  const resultado = { base: BASE, aviso: 'SwiftShader (CPU). Los cps NO representan la Intel UHD; comparar trabajo por cuadro.', escenarios: {} };
  const escenario = async (nombre, { viewport = { width: 1366, height: 768 }, consulta = '', antes = null, dpr = 1, real = null } = {}) => {
    const ctx = await b.newContext({ viewport, deviceScaleFactor: dpr });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push(`${nombre}: ${e.message}`));
    await p.addInitScript(instrumentar);
    await p.route('**/datos/proyectos.local.json*', (r) => r.fulfill({ status: 404, body: '' }));
    await p.route('**/datos/reales/*', (r) => (real ? r.fulfill({ status: 200, contentType: 'application/json', body: real() }) : r.fulfill({ status: 404, body: '' })));
    await p.addInitScript(() => { try { localStorage.clear(); } catch {} });
    await p.goto(BASE + '?medir=1&hora=11' + consulta);
    await p.waitForTimeout(7000);
    const cdp = await ctx.newCDPSession(p);
    await cdp.send('Performance.enable');
    if (antes) { await antes(p); await p.waitForTimeout(3500); }
    resultado.escenarios[nombre] = await medir(p, cdp, 6);
    console.log(nombre.padEnd(34), JSON.stringify(resultado.escenarios[nombre]));
    await ctx.close();
  };
  const brillo = (p) => p.locator('label.interruptor', { hasText: 'Brillo' }).click();
  const unCuarto = (p) => p.locator('[data-modo3d="individual"]').click();

  await escenario('edificio');
  await escenario('edificio-enfocado', { antes: (p) => p.keyboard.press('1') });
  await escenario('un-cuarto', { antes: unCuarto });
  await escenario('edificio-brillo', { antes: brillo });
  await escenario('un-cuarto-brillo', { antes: async (p) => { await unCuarto(p); await p.waitForTimeout(1500); await brillo(p); } });
  await escenario('edificio-brillo-dpr1.5', { dpr: 1.5, antes: brillo });
  // En la versión nueva «edificio-brillo» es el ligero; este es el anterior (en la versión vieja ?brillo= se ignora).
  await escenario('edificio-brillo-completo', { consulta: '&brillo=completo', antes: brillo });
  await escenario('edificio-dpr1.5', { dpr: 1.5 });
  // Escena sin nadie que se mueva: Compago REAL con evidencia vencida (los personajes salen de la oficina).
  const plantilla = fs.readFileSync('contrato/ejemplos/compago-exportador.json', 'utf8');
  await escenario('edificio-real-vencido-quieto', { real: () => plantilla });
  await escenario('celular-edificio', { viewport: { width: 390, height: 844 }, dpr: 1, consulta: '' , antes: null });

  if (process.env.JSON) fs.writeFileSync(process.env.JSON, JSON.stringify(resultado, null, 2));
  console.log('errores:', errs.length ? errs : 'ninguno');
  await b.close();
})();
