// Recorrido medido del PR #35 (?medir=1&recorrido=1), en Chromium (SwiftShader).
// Con servir.py corriendo:  node pruebas/navegador/recorrido.cjs      (PUERTO=8765 por omisión)
//
// Corre el mismo recorrido que herramientas\medir-recorrido.bat hace en la MSI y comprueba que la herramienta
// funcione y que lo que registra tenga sentido: cada viaje de ascensor corre la cámara de forma gradual y el edificio
// se mueve en la pantalla antes de que el velo lo tape (no es solo un cambio de escena); los cambios de cuarto no
// usan ascensor y sí fundido; en «Un cuarto» nadie teclea ni cambia de estado; recursos sin crecer; informe completo.
// SwiftShader cuenta objetos y comprueba comportamiento; los cps de aquí NO son los de la Intel UHD.
const { chromium } = require('playwright');
const BASE = 'http://127.0.0.1:' + (process.env.PUERTO || 8765) + '/';

(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const res = []; const errs = [];
  const ok = (n, c, x = '') => res.push(`${c ? 'OK ' : 'FALLA'} ${n}${x ? ' · ' + x : ''}`);
  const p = await b.newPage({ viewport: { width: 1366, height: 768 }, acceptDownloads: true });
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await p.route('**/datos/proyectos.local.json*', (r) => r.fulfill({ status: 404, body: '' }));
  await p.route('**/datos/reales/*', (r) => r.fulfill({ status: 404, body: '' }));
  const descarga = p.waitForEvent('download', { timeout: 300_000 }).catch(() => null);
  await p.goto(BASE + '?medir=1&recorrido=1&proyecto=compago');
  const sala = await p.locator('#sala-control').isVisible().catch(() => false);
  await p.waitForFunction(() => window.__cauceRecorrido, null, { timeout: 300_000, polling: 1000 });
  const i = await p.evaluate(() => window.__cauceRecorrido);
  const d = await descarga;
  ok('el recorrido corre solo, sin sala de control encima, y entrega cauce-recorrido.json', !sala && d?.suggestedFilename() === 'cauce-recorrido.json', d?.suggestedFilename());
  const v = i.viajes;
  ok('10 viajes de ascensor registrados, todos con ascensor y llegando a su piso', v.length === 10 && v.every((x) => x.hubo_ascensor && x.hacia !== x.desde), v.map((x) => `${x.desde}→${x.hacia}`).join(' '));
  ok('cada viaje es gradual: ≥ 8 valores intermedios del corrimiento y el edificio se mueve ≥ 20 px a la vista antes del velo', v.every((x) => x.gradual), v.map((x) => `${x.valores_intermedios}/${x.movimiento_visible_px}px`).join(' '));
  ok('cada viaje dura lo esperado (0.6–0.9 s de movimiento + construir el piso; < 4 s) y el velo llega a tapar el cambio', v.every((x) => x.duracion_ms < 4000 && x.velo_max >= 0.99), v.map((x) => x.duracion_ms).join(','));
  ok('desde «Un cuarto» también hay ascensor', i.viajes_un_cuarto.length === 2 && i.viajes_un_cuarto.every((x) => x.hubo_ascensor && x.gradual), JSON.stringify(i.viajes_un_cuarto.map((x) => x.hacia)));
  const cc = i.cambios_de_cuarto;
  ok('cambiar de cuarto en el mismo piso: nunca ascensor, siempre fundido y acercamiento', cc.length >= 8 && cc.every((x) => !x.hubo_ascensor && x.opacidad_min < 0.95 && x.zoom_min < 0.99), `${cc.length} cambios`);
  ok('«Un cuarto» quieto 20 s: la estación no cambia de estado y nadie teclea', i.estacion_sin_cambios && !i.alguien_teclea);
  ok('recursos sin crecer después de la 1.ª vuelta (la 1.ª visita a un piso llena su caché; no es fuga)', !i.recursos.crecen, JSON.stringify(i.recursos));
  ok('el informe trae cps y peor cuadro por tramo, la GPU y un resumen legible', i.tramos.length === 2 && i.tramos.every((t) => t.cps_promedio > 0 && t.peor_cuadro_ms > 0) && !!i.gpu && /RECORRIDO TERMINADO/.test(i.texto) && i.errores.length === 0);
  // ?vida=0 apaga la vida en reposo (para medir su costo en la MSI); sin el parámetro sigue encendida.
  ok('el informe dice si la vida en reposo estaba encendida', i.vida_en_reposo === true);
  await b.close();
  console.log(i.texto);
  for (const l of res) console.log(l);
  console.log(errs.length ? `errores: ${JSON.stringify(errs.slice(0, 5))}` : 'errores: ninguno');
  process.exit(res.some((l) => l.startsWith('FALLA')) || errs.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
