// Fase E3: la app con documentos REALES del exportador corregido de Compago (contrato/ejemplos/compago-pr10/).
// Las horas de cada documento se corren a "ahora" (misma separación entre ellas) para que estén vigentes.
// Con servir.py corriendo: node pruebas/navegador/compago-pr10.cjs [carpeta-capturas]
const { chromium, devices } = require('playwright');
const fs = require('fs');
const SAL = process.argv[2];
const D = 'contrato/ejemplos/compago-pr10';
const seq = ['real-activo-espera', 'real-activo-aplicando', 'real-detenido-cola', 'real-busqueda-1', 'real-busqueda-2', 'real-busqueda-2', 'real-indeterminado'];
const ISO = /"(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ)"/g;
function alDia(nombre, base) {
  const texto = fs.readFileSync(`${D}/${nombre}.json`, 'utf8');
  const gen = Date.parse(JSON.parse(texto).generado_en);
  const corrimiento = base - gen;
  return texto.replace(ISO, (_, t) => `"${new Date(Date.parse(t) + corrimiento).toISOString().replace(/\.\d+Z$/, 'Z')}"`);
}
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const res = []; const errs = []; const ok = (n, c, x = '') => res.push(`${c ? 'OK ' : 'FALLA'} ${n}${x ? ' · ' + x : ''}`);
  const p = await b.newPage({ viewport: { width: 1390, height: 860 } });
  p.on('pageerror', (e) => errs.push(e.message));
  let i = 0; let reloj = Date.now() - 5000;
  await p.route('**/datos/reales/compago.json*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: alDia(seq[i], reloj) }));
  const pers = () => p.evaluate(() => window.__cauce3d.personajes());
  const de = (ps, id) => ps.find((x) => x.id === id);
  const pasos = (x) => [x.accion, ...x.cola].filter(Boolean);
  const gesto = (x) => pasos(x).some((s) => ['celebrar', 'reaccion_error', 'llamar_atencion'].includes(s));
  // Cada lectura nueva es un archivo exportado 2 s después del anterior (el corrimiento conserva el orden real).
  const leer = async (n) => { i = n; reloj = Math.max(reloj + 2000, Date.now() - 1000); await p.locator('#recargar').click(); await p.waitForTimeout(500); return pers(); };
  await p.goto('http://127.0.0.1:8765/?medir=1'); await p.waitForTimeout(9000);
  let ps = await pers();
  ok('activo esperando: REAL, solo el importador sentado, sin gestos', /REAL/.test(await p.locator('#conexion').innerText()) && JSON.stringify(ps.filter((x) => x.visible).map((x) => x.id)) === '["importador"]' && ps.every((x) => x.accion === null));
  ps = await leer(1); await p.waitForTimeout(1500); ps = await pers();
  ok('activo aplicando: teclea, sin gestos', de(ps, 'importador').bucle === 'teclear' && !gesto(de(ps, 'importador')));
  ps = await leer(2);
  ok('detenido con cola: se levanta y sale; la alerta crítica no pone a nadie', pasos(de(ps, 'importador')).includes('salir') && ps.filter((x) => x.id !== 'importador').every((x) => !x.visible), pasos(de(ps, 'importador')).join(','));
  ps = await leer(3); await p.waitForTimeout(12000);
  ps = await leer(4);
  ok('SearchRun nuevo y reciente: la Buscadora entra sin celebrar', pasos(de(ps, 'buscador')).includes('entrar') && !gesto(de(ps, 'buscador')), pasos(de(ps, 'buscador')).join(','));
  await p.waitForTimeout(13000); ps = await pers();
  ok('~8 s después ya salió', !de(ps, 'buscador').visible);
  ps = await leer(5);
  ok('lectura repetida: nadie entra ni hace gestos', ps.every((x) => !x.visible && x.accion === null));
  ps = await leer(6);
  ok('indeterminado: el importador no aparece', !de(ps, 'importador').visible && pasos(de(ps, 'importador')).length === 0);
  await p.locator('[data-vista="2d"]').click(); await p.waitForTimeout(700);
  const t2 = await p.locator('#oficina').innerText();
  ok('plano 2D: naturalezas visibles, sin aviso falso de WebGL', /Automático/.test(t2) && /Humano/.test(t2) && /Módulo/.test(t2) && /Reactivo/.test(t2) && await p.locator('#aviso-vista').isHidden());
  if (SAL) await p.screenshot({ path: `${SAL}/e3-plano2d.png` });
  await p.close();
  const c = await b.newPage({ ...devices['iPhone 12'] }); c.on('pageerror', (e) => errs.push(e.message));
  await c.route('**/datos/reales/compago.json*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: alDia('real-activo-aplicando', Date.now() - 5000) }));
  await c.goto('http://127.0.0.1:8765/'); await c.waitForTimeout(9000);
  ok('celular con REAL: cabecera REAL y En línea', /REAL/.test(await c.locator('#conexion').innerText()) && /En línea/.test(await c.locator('#conexion').innerText()));
  if (SAL) await c.screenshot({ path: `${SAL}/e3-movil.png` });
  console.log(res.join('\n')); console.log('errores:', errs.length ? errs : 'ninguno'); await b.close();
  process.exit(res.some((r) => r.startsWith('FALLA')) || errs.length ? 1 : 0);
})();
