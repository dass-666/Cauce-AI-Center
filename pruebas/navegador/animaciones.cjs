// Fase C3 en navegador: los gestos de transición solo aparecen ante un cambio observado entre dos lecturas.
// Con servir.py corriendo: node pruebas/navegador/animaciones.cjs   (SAL=carpeta para capturas; por omisión ./r)
// La segunda lectura cambia la demo en memoria (no toca ningún archivo): importador-cola esperando → requiere_revision,
// buscador finalizado → error. SwiftShader: no mide rendimiento.
const { chromium } = require('playwright');
const SAL = process.env.SAL || 'r';
require('fs').mkdirSync(SAL, { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const res = []; const errs = [];
  const ok = (n, c, extra = '') => res.push(`${c ? 'OK ' : 'FALLA'} ${n}${extra ? ' · ' + extra : ''}`);
  const p = await b.newPage({ viewport: { width: 1390, height: 760 } });
  p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/datos/reales/compago.json*', (r) => r.fulfill({ status: 404, body: '' }));
  let lecturas = 0;
  await p.route('**/datos/demo/compago.json*', async (r) => {
    lecturas++;
    const resp = await r.fetch();
    const d = await resp.json();
    if (lecturas >= 2) {
      d.generado_en = new Date(Date.parse(d.generado_en) + 30000).toISOString(); // un archivo nuevo, 30 s después
      for (const dep of d.departamentos) for (const a of dep.agentes) {
        if (a.id === 'importador-cola') a.estado = 'requiere_revision';
        if (a.id === 'buscador') { a.estado = 'error'; a.error = { mensaje: '[DEMO] Error de prueba observado entre dos lecturas' }; }
      }
    }
    await r.fulfill({ response: resp, json: d });
  });
  const pers = () => p.evaluate(() => window.__cauce3d.personajes());
  await p.goto('http://127.0.0.1:8765/?medir=1'); await p.waitForTimeout(9000);
  await p.evaluate(() => { document.querySelector('.vista3d-medidas').hidden = true; });
  let ps = await pers();
  ok('primera lectura: nadie camina ni hace gestos', ps.length > 0 && ps.every((x) => x.accion === null && x.cola.length === 0), `${ps.length} personajes`);
  ok('sin datos = silla vacía', ps.filter((x) => x.estado === 'sin_datos').every((x) => !x.visible) && ps.some((x) => x.estado === 'sin_datos'));
  ok('con evidencia ya está en su lugar', ps.filter((x) => x.estado !== 'sin_datos').every((x) => x.visible));
  const bucles = Object.fromEntries(ps.map((x) => [x.estado, x.bucle]));
  ok('bucles por estado', bucles.trabajando === 'teclear' && bucles.esperando === 'reposo' && bucles.finalizado === 'relajado' && bucles.error === 'alerta' && bucles.requiere_revision === 'atencion', JSON.stringify(bucles));
  // Segunda lectura con cambios: los gestos aparecen solo en quien cambió.
  await p.locator('#recargar').click(); await p.waitForTimeout(400);
  ps = await pers();
  const de = (id) => ps.find((x) => x.id === id);
  const pasos = (x) => [x.accion, ...x.cola].filter(Boolean);
  ok('cambio observado a revisión: llama la atención', pasos(de('importador-cola')).includes('llamar_atencion'), pasos(de('importador-cola')).join(','));
  ok('cambio observado a error: reacciona', pasos(de('buscador')).includes('reaccion_error'), pasos(de('buscador')).join(','));
  ok('sin cambio: sin gestos', ps.filter((x) => !['importador-cola', 'buscador'].includes(x.id)).every((x) => x.accion === null));
  const cambios = await p.locator('#conexion').innerText();
  ok('el tablero registra los cambios observados', /Cambios observados \([1-9]/.test(cambios), (cambios.match(/Cambios observados \(\d+\)/) || [''])[0]);
  await p.locator('.etiqueta-dep', { hasText: 'Búsqueda' }).click(); await p.waitForTimeout(1200);
  await p.screenshot({ path: `${SAL}/reaccion-error.png` });
  await p.waitForTimeout(3000);
  ps = await pers();
  ok('el gesto termina y queda en su bucle', de('buscador').accion === null && de('buscador').bucle === 'alerta' && de('importador-cola').bucle === 'atencion');
  // Escena reconstruida (cambiar de modo): sin gestos repetidos.
  await p.locator('[data-modo3d=individual]').click(); await p.waitForTimeout(2500);
  await p.locator('[data-modo3d=edificio]').click(); await p.waitForTimeout(3000);
  ps = await pers();
  ok('escena reconstruida: no repite gestos', ps.every((x) => x.accion === null && x.cola.length === 0));
  // Tercera lectura igual a la segunda: nada nuevo.
  await p.locator('#recargar').click(); await p.waitForTimeout(400);
  ps = await pers();
  ok('lectura sin cambios: sin gestos', ps.every((x) => x.accion === null));
  await p.screenshot({ path: `${SAL}/animaciones.png` });
  console.log(res.join('\n'));
  console.log('errores:', errs.length ? errs : 'ninguno');
  await b.close();
})();
