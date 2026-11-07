// Fases C3 + E2 en navegador: los gestos solo aparecen ante un cambio observado entre dos lecturas, y cada
// puesto se dibuja según lo que ES (escena/compago-naturaleza.json).
// Con servir.py corriendo: node pruebas/navegador/animaciones.cjs   (SAL=carpeta para capturas; por omisión ./r)
// Las lecturas cambian la demo en memoria (no tocan ningún archivo). SwiftShader: no mide rendimiento.
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
  let lectura = 1; // qué lectura sirve la próxima petición
  await p.route('**/datos/demo/compago.json*', async (r) => {
    const resp = await r.fetch();
    const d = await resp.json();
    if (lectura >= 2) {
      d.generado_en = new Date(Date.parse(d.generado_en) + 30000).toISOString(); // un archivo nuevo, 30 s después
      for (const dep of d.departamentos) for (const a of dep.agentes) {
        if (a.id === 'buscador') Object.assign(a.evidencia, { referencia: '[DEMO] id=319 · resultado=ok', observado_en: '2026-11-03T16:29:20Z' }); // registro NUEVO y reciente
        if (a.id === 'revisor-fuentes') a.estado = 'requiere_revision';                // cambia sin registro nuevo
        if (a.id === 'importador') {
          a.estado = 'error'; a.actividad.fin = '2026-11-03T16:29:20Z';
          a.evidencia.referencia = '[DEMO] id=41 · estado=fallido';
          a.error = { mensaje: '[DEMO] Error de prueba observado entre dos lecturas' };
        }
      }
    }
    if (lectura >= 4) for (const i of d.departamentos[0].indicadores) if (i.etiqueta === 'Consumidor') i.valor = 'sin latido reciente';
    await r.fulfill({ response: resp, json: d });
  });
  const pers = () => p.evaluate(() => window.__cauce3d.personajes());
  const pasos = (x) => (x ? [x.accion, ...x.cola].filter(Boolean) : []);
  await p.goto('http://127.0.0.1:8765/?medir=1'); await p.waitForTimeout(9000);
  await p.evaluate(() => { document.querySelector('.vista3d-medidas').hidden = true; });
  let ps = await pers();
  const de = (id) => ps.find((x) => x.id === id);
  ok('solo hay figura donde puede haber alguien (automático y reactivos)', JSON.stringify(ps.map((x) => x.id).sort()) === JSON.stringify(['buscador', 'enlace-uniq', 'importador', 'revisor-fuentes']), ps.map((x) => x.id).join(','));
  ok('primera lectura: nadie camina ni hace gestos', ps.every((x) => x.accion === null && x.cola.length === 0));
  ok('primera lectura: solo el importador (evidencia y latido) está sentado', JSON.stringify(ps.filter((x) => x.visible).map((x) => x.id)) === '["importador"]' && de('importador').bucle === 'teclear');
  await p.screenshot({ path: `${SAL}/e2-edificio.png` });
  // Segunda lectura.
  lectura = 2; await p.locator('#recargar').click(); await p.waitForTimeout(400);
  ps = await pers();
  ok('reactivo con registro nuevo: entra (sin celebrar)', pasos(de('buscador')).includes('entrar') && !pasos(de('buscador')).includes('celebrar'), pasos(de('buscador')).join(','));
  ok('reactivo que cambia sin registro nuevo: no aparece', !de('revisor-fuentes').visible && pasos(de('revisor-fuentes')).length === 0);
  ok('automático con cambio observado a error: reacciona', pasos(de('importador')).includes('reaccion_error'), pasos(de('importador')).join(','));
  ok('sin cambio: sin gestos', ps.filter((x) => !['importador', 'buscador'].includes(x.id)).every((x) => x.accion === null));
  const cambios = await p.locator('#conexion').innerText();
  ok('el tablero registra los cambios observados', /Cambios observados \([1-9]/.test(cambios), (cambios.match(/Cambios observados \(\d+\)/) || [''])[0]);
  await p.locator('.etiqueta-dep', { hasText: 'Búsqueda' }).click(); await p.waitForTimeout(3500);
  await p.screenshot({ path: `${SAL}/e2-reactivo-breve.png` });
  ps = await pers();
  ok('aparición breve: sentado en su puesto', de('buscador').visible, `bucle ${de('buscador').bucle}`);
  await p.waitForTimeout(8000);
  ps = await pers();
  ok('a los ~8 s se va', !de('buscador').visible || pasos(de('buscador')).includes('salir'), `${de('buscador').visible} ${pasos(de('buscador'))}`);
  await p.waitForTimeout(4000);
  ps = await pers();
  ok('el automático queda en su bucle de error', de('importador').accion === null && de('importador').bucle === 'alerta');
  ok('el reactivo ya salió', !de('buscador').visible);
  // Escena reconstruida (cambiar de modo): sin gestos repetidos ni apariciones.
  await p.locator('[data-modo3d=individual]').click(); await p.waitForTimeout(2500);
  await p.locator('[data-modo3d=edificio]').click(); await p.waitForTimeout(3000);
  ps = await pers();
  ok('escena reconstruida: no repite gestos', ps.every((x) => x.accion === null && x.cola.length === 0));
  // Tercera lectura igual a la segunda: nada nuevo.
  lectura = 3; await p.locator('#recargar').click(); await p.waitForTimeout(400);
  ps = await pers();
  ok('lectura sin cambios: sin gestos ni apariciones', ps.every((x) => x.accion === null) && !de('buscador').visible);
  // Cuarta: el consumidor deja de dar latido → el importador se levanta y sale.
  lectura = 4; await p.locator('#recargar').click(); await p.waitForTimeout(400);
  ps = await pers();
  ok('sin latido: el automático sale (estado conservador)', pasos(de('importador')).includes('salir') || !de('importador').visible, pasos(de('importador')).join(','));
  console.log(res.join('\n'));
  console.log('errores:', errs.length ? errs : 'ninguno');
  await b.close();
  process.exit(res.some((r) => r.startsWith('FALLA')) || errs.length ? 1 : 0);
})();
