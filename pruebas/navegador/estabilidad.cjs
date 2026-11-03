// Fase D: estabilidad en navegador.
// - DEMO → REAL: no se reportan cambios de actividad ni gestos.
// - Desconexión y reconexión.
// - Cambio de proyecto y vuelta.
// - Uso prolongado: 25 lecturas sin acumular memoria ni nodos.
// Con servir.py corriendo: node pruebas/navegador/estabilidad.cjs. Los datos "reales" se fabrican en memoria a partir de la demo,
// solo para la prueba (nunca se escriben en disco). SwiftShader: cuenta objetos, no mide rendimiento.
const { chromium } = require('playwright');
const fs = require('fs');
const SAL = process.env.SAL || 'r';
fs.mkdirSync(SAL, { recursive: true });
const demo = JSON.parse(fs.readFileSync('datos/demo/compago.json', 'utf8'));
function falsoReal(cambiar) {
  const d = JSON.parse(JSON.stringify(demo));
  d.es_demo = false; delete d.demo; d.fuente = { tipo: 'adaptador', nombre: 'PRUEBA automática (datos ficticios)' };
  d.generado_en = new Date(Date.now() - 5000).toISOString();
  for (const dep of d.departamentos) for (const a of dep.agentes) if (cambiar[a.id]) Object.assign(a, cambiar[a.id]);
  return d;
}
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-precise-memory-info'] });
  const res = []; const errs = [];
  const ok = (n, c, extra = '') => res.push(`${c ? 'OK ' : 'FALLA'} ${n}${extra ? ' · ' + extra : ''}`);
  const p = await b.newPage({ viewport: { width: 1390, height: 760 } });
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  let modoReal = 'no'; // no | si | roto
  await p.route('**/datos/reales/compago.json*', (r) => {
    if (modoReal === 'no') return r.fulfill({ status: 404, body: '' });
    if (modoReal === 'roto') return r.fulfill({ status: 200, contentType: 'application/json', body: '{ roto' });
    if (modoReal === 'error500') return r.fulfill({ status: 500, body: 'error' });
    if (modoReal === 'viejo') { const d = falsoReal({}); d.generado_en = new Date(Date.now() - 3 * 3600e3).toISOString(); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) }); }
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(falsoReal({ 'importador-cola': { estado: 'requiere_revision' } })) });
  });
  const pers = () => p.evaluate(() => window.__cauce3d.personajes());
  const sinGestos = async () => (await pers()).every((x) => x.accion === null && x.cola.length === 0);
  const tablero = () => p.locator('#conexion').innerText();
  const recargar = async (ms = 600) => { await p.locator('#recargar').click(); await p.waitForTimeout(ms); };

  await p.goto('http://127.0.0.1:8765/?medir=1'); await p.waitForTimeout(9000);
  await p.evaluate(() => { document.querySelector('.vista3d-medidas').hidden = true; });
  ok('arranque: DEMO sin gestos', /DEMO/.test(await tablero()) && await sinGestos());

  modoReal = 'si'; await recargar(450);
  ok('DEMO → REAL: la escena se reconstruye sin gestos (justo después de leer)', await sinGestos());
  await p.waitForTimeout(3000);
  let t = await tablero();
  ok('DEMO → REAL: insignia REAL y sin franja DEMO', /REAL/.test(t) && await p.locator('#banda-demo').isHidden());
  await p.locator('summary', { hasText: 'Cambios observados' }).click();
  const lista = await p.locator('details[data-k="cambios"]').innerText();
  await p.locator('summary', { hasText: 'Cambios observados' }).click();
  ok('DEMO → REAL: solo se reporta el cambio de fuente, no estados', /Cambios observados \(1\)/.test(t) && /de DEMO a REAL/.test(lista) && !/pasó de/.test(lista), lista.split('\n').slice(-1)[0]);

  modoReal = 'roto'; await recargar(1500);
  t = await tablero();
  const ps = await pers();
  ok('archivo inválido: conexión no vigente y personajes salen o ya no están', !/En línea/.test(t) && ps.every((x) => !x.visible || ['salir', 'levantarse'].includes(x.accion)), t.split('\n')[0]);
  modoReal = 'si'; await recargar(4000);
  ok('reconexión: vuelve "En línea"', /En línea/.test(await tablero()));
  modoReal = 'error500'; await recargar(1500);
  t = await tablero();
  ok('error del servidor: "Sin conexión" y no se usa la demo', /Sin conexión/.test(t) && await p.locator('#banda-demo').isHidden(), t.split('\n')[0]);
  modoReal = 'viejo'; await recargar(3000);
  t = await tablero();
  ok('dato de hace 3 h: "Datos desactualizados" y nadie trabajando', /desactualizados/i.test(t) && (await pers()).every((x) => !x.visible || x.accion === 'salir' || x.accion === 'levantarse'), t.split('\n')[0]);
  modoReal = 'si'; await recargar(5000);
  ok('vuelve a datos vigentes: "En línea"', /En línea/.test(await tablero()));

  // Cambio de proyecto y vuelta: sin gestos y el registro empieza de cero.
  await p.getByRole('tab', { name: 'Ek Chuah' }).click(); await p.waitForTimeout(4000);
  await p.getByRole('tab', { name: 'Compago' }).click(); await p.waitForTimeout(4000);
  ok('cambiar de proyecto y volver: sin gestos', await sinGestos());
  ok('cambiar de proyecto: el registro de cambios empieza de cero', /Cambios observados \(0\)/.test(await tablero()));

  // Uso prolongado: 25 lecturas iguales.
  const medir = () => p.evaluate(() => { const m = window.__cauce3d.metricas(); return { g: m.geometrias, t: m.texturas, nodos: document.getElementsByTagName('*').length, heap: performance.memory?.usedJSHeapSize ?? 0 }; });
  const antes = await medir();
  for (let i = 0; i < 25; i++) await recargar(250);
  await p.waitForTimeout(1500);
  const despues = await medir();
  ok('25 lecturas: geometrías, texturas y nodos estables', despues.g <= antes.g && despues.t <= antes.t && despues.nodos <= antes.nodos + 5,
    `geo ${antes.g}→${despues.g}, tex ${antes.t}→${despues.t}, nodos ${antes.nodos}→${despues.nodos}`);
  ok('25 lecturas iguales: sin gestos', await sinGestos());
  res.push(`INFO memoria JS (no es la GPU): ${Math.round(antes.heap / 1e6)} → ${Math.round(despues.heap / 1e6)} MB`);

  // 2D después de todo lo anterior.
  await p.locator('[data-vista="2d"]').click(); await p.waitForTimeout(1500);
  ok('plano 2D funciona tras REAL/DEMO y reconexión', await p.locator('.plano .cuarto').count() >= 8);
  await p.screenshot({ path: `${SAL}/estabilidad-2d.png` });
  console.log(res.join('\n'));
  console.log('errores:', errs.length ? errs : 'ninguno');
  await b.close();
})();
