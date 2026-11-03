// Auditoría C4: ¿se libera la memoria de la tarjeta gráfica al reconstruir la escena?
// Cambia de modo y de vista (3D ↔ 2D) varias veces y compara geometrías/texturas vivas y contextos WebGL.
// Con servir.py corriendo: node pruebas/navegador/memoria.cjs   (SwiftShader: cuenta objetos, no mide rendimiento)
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-precise-memory-info'] });
  const res = []; const errs = [];
  const ok = (n, c, extra = '') => res.push(`${c ? 'OK ' : 'FALLA'} ${n}${extra ? ' · ' + extra : ''}`);
  const p = await b.newPage({ viewport: { width: 1390, height: 760 } });
  p.on('pageerror', (e) => errs.push(e.message));
  // Cuenta contextos WebGL creados y perdidos a propósito.
  await p.addInitScript(() => {
    window.__contextos = { creados: 0 };
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (tipo, ...r) {
      const c = orig.call(this, tipo, ...r);
      if (c && /webgl/.test(tipo) && !this.__contado) { this.__contado = true; window.__contextos.creados++; }
      return c;
    };
  });
  await p.route('**/datos/reales/compago.json*', (r) => r.fulfill({ status: 404, body: '' }));
  await p.goto('http://127.0.0.1:8765/?medir=1'); await p.waitForTimeout(10000);
  const leer = () => p.evaluate(() => { const m = window.__cauce3d?.metricas(); return m && { g: m.geometrias, t: m.texturas, llamadas: m.llamadas, heap: performance.memory?.usedJSHeapSize ?? 0 }; });
  const base = await leer();
  for (let i = 0; i < 4; i++) {
    await p.locator('[data-modo3d=individual]').click(); await p.waitForTimeout(1500);
    await p.locator('[data-modo3d=edificio]').click(); await p.waitForTimeout(2500);
  }
  const tras = await leer();
  ok('cambiar de modo 4 veces no acumula geometrías ni texturas', tras.g <= base.g && tras.t <= base.t, `antes ${base.g}/${base.t}, después ${tras.g}/${tras.t}`);
  for (let i = 0; i < 3; i++) {
    await p.locator('[data-vista="2d"]').click(); await p.waitForTimeout(1200);
    await p.locator('[data-vista="3d"]').click(); await p.waitForTimeout(4000);
  }
  const vuelta = await leer();
  ok('3D ↔ 2D 3 veces: memoria de la escena igual', vuelta.g <= base.g && vuelta.t <= base.t, `${vuelta.g}/${vuelta.t}`);
  const lienzos = await p.evaluate(() => ({ creados: window.__contextos.creados, vivos: document.querySelectorAll('.vista3d canvas').length }));
  ok('un solo lienzo 3D vivo después de alternar', lienzos.vivos <= 2, `contextos creados ${lienzos.creados}, lienzos en la página ${lienzos.vivos} (incluye minimapa 2D)`);
  await p.evaluate(() => window.gc?.());
  const heap = await leer();
  res.push(`INFO memoria JS (no es la GPU): ${Math.round(base.heap / 1e6)} MB → ${Math.round(heap.heap / 1e6)} MB`);
  console.log(res.join('\n'));
  console.log('errores:', errs.length ? errs : 'ninguno');
  await b.close();
})();
