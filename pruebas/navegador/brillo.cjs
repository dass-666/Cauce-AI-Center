// D2: el brillo (brillo.js) se enciende, se apaga y libera su efecto. Con servir.py corriendo.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const res = []; const errs = [];
  const ok = (n, c, extra = '') => res.push(`${c ? 'OK ' : 'FALLA'} ${n}${extra ? ' · ' + extra : ''}`);
  const p = await b.newPage({ viewport: { width: 1200, height: 720 } });
  p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/datos/reales/compago.json*', (r) => r.fulfill({ status: 404, body: '' }));
  await p.goto('http://127.0.0.1:8765/?medir=1'); await p.waitForTimeout(8000);
  const m = () => p.evaluate(() => window.__cauce3d.metricas());
  ok('brillo apagado por defecto', (await m()).brillo === false);
  const sin = (await m()).llamadas;
  await p.locator('label.interruptor', { hasText: 'Brillo' }).click(); await p.waitForTimeout(3000);
  const con = await m();
  ok('brillo se enciende', con.brillo === true, `llamadas ${sin} → ${con.llamadas}`);
  await p.locator('label.interruptor', { hasText: 'Brillo' }).click(); await p.waitForTimeout(1500);
  ok('brillo se apaga', (await m()).brillo === false);
  console.log(res.join('\n'));
  console.log('errores:', errs.length ? errs : 'ninguno');
  await b.close();
})();
