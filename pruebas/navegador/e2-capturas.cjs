// Fase E2: capturas (escritorio, móvil, plano 2D) y llamadas de dibujo del edificio en este entorno (SwiftShader:
// NO representa la Intel UHD). Con servir.py corriendo: node pruebas/navegador/e2-capturas.cjs [carpeta] [url-base]
const { chromium, devices } = require('playwright');
const SAL = process.argv[2] || 'r';
const BASE = process.argv[3] || 'http://127.0.0.1:8765';
require('fs').mkdirSync(SAL, { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const errs = [];
  const p = await b.newPage({ viewport: { width: 1390, height: 860 }, deviceScaleFactor: 2 });
  p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/datos/reales/compago.json*', (r) => r.fulfill({ status: 404, body: '' }));
  await p.goto(`${BASE}/?medir=1`); await p.waitForTimeout(9000);
  const m = await p.evaluate(() => window.__cauce3d.metricas());
  console.log(`edificio: ${m.llamadas} llamadas de dibujo, ${m.geometrias} geometrías, ${m.texturas} texturas, ${m.personajes} personajes`);
  await p.evaluate(() => { document.querySelector('.vista3d-medidas').hidden = true; });
  await p.screenshot({ path: `${SAL}/escritorio-edificio.png` });
  for (const [dep, archivo] of [['Evaluación de oportunidades', 'escritorio-humano'], ['Márgenes y rentabilidad', 'escritorio-modulo'], ['Importación de catálogos', 'escritorio-automatico'], ['Revisión de listas', 'escritorio-reactivo']]) {
    await p.locator('.vista3d select').first().selectOption({ label: dep }); await p.waitForTimeout(1800);
    await p.screenshot({ path: `${SAL}/${archivo}.png` });
  }
  await p.locator('[data-vista="2d"]').click(); await p.waitForTimeout(800);
  await p.screenshot({ path: `${SAL}/escritorio-plano2d.png`, fullPage: true });
  await p.locator('[data-vista="3d"]').click();
  await p.close();
  const c = await b.newPage({ ...devices['iPhone 12'] });
  c.on('pageerror', (e) => errs.push(e.message));
  await c.route('**/datos/reales/compago.json*', (r) => r.fulfill({ status: 404, body: '' }));
  await c.goto(`${BASE}/`); await c.waitForTimeout(9000);
  await c.screenshot({ path: `${SAL}/movil-edificio.png` });
  console.log('errores:', errs.length ? errs : 'ninguno');
  await b.close();
})();
