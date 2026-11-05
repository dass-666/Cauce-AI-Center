// Fase L (portal): el visualizador funciona publicado bajo una subruta (/cauce/), sin pedir nada fuera de ella,
// en modo incrustado (?incrustado=1) y dentro de un iframe del mismo origen. No necesita servir.py corriendo:
// levanta su propio servidor local (127.0.0.1) con --base /cauce/ en el puerto PUERTO_PORTAL (8768) y lo apaga.
//   node pruebas/navegador/fase-l-portal.cjs
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const PUERTO = Number(process.env.PUERTO_PORTAL || 8768);
const RAIZ = path.join(__dirname, '..', '..');
const ORIGEN = `http://127.0.0.1:${PUERTO}`;

const pedir = (ruta) => new Promise((listo) => http.get(ORIGEN + ruta, (r) => { r.resume(); listo({ estado: r.statusCode, donde: r.headers.location, csp: r.headers['content-security-policy'] }); }).on('error', () => listo({ estado: 0 })));

(async () => {
  const py = process.platform === 'win32' ? 'py' : 'python3';
  const srv = spawn(py, ['servir.py', '--sin-abrir', '--puerto', String(PUERTO), '--base', '/cauce/'], { cwd: RAIZ, stdio: 'ignore' });
  for (let i = 0; i < 40 && (await pedir('/cauce/')).estado !== 200; i++) await new Promise((r) => setTimeout(r, 150));
  const res = []; const errs = [];
  const ok = (n, c, x = '') => res.push(`${c ? 'OK ' : 'FALLA'} ${n}${x ? ' · ' + x : ''}`);
  try {
    const r1 = await pedir('/cauce');
    ok('servidor: /cauce redirige a /cauce/', r1.estado === 301 && /\/cauce\/$/.test(r1.donde || ''), `${r1.estado} ${r1.donde}`);
    ok('servidor: fuera de la subruta no se sirve nada (/app/app.js → 404)', (await pedir('/app/app.js')).estado === 404);
    ok('servidor: sin listados de carpetas (/cauce/datos/ → 404)', (await pedir('/cauce/datos/')).estado === 404);
    const r2 = await pedir('/cauce/');
    ok("servidor: solo el mismo origen puede incrustarlo (frame-ancestors 'self')", /frame-ancestors 'self'/.test(r2.csp || ''), r2.csp);

    const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const p = await b.newPage({ viewport: { width: 1366, height: 768 } });
    const pedidos = []; const fallidos = [];
    p.on('request', (q) => pedidos.push(new URL(q.url())));
    p.on('response', (q) => { if (q.status() >= 400) fallidos.push(`${q.status()} ${new URL(q.url()).pathname}`); });
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(ORIGEN + '/cauce?medir=1'); await p.waitForTimeout(9000);
    ok('subruta: abrir /cauce (sin «/») termina en /cauce/ y carga la oficina 3D', new URL(p.url()).pathname === '/cauce/' && await p.locator('.vista3d > canvas').isVisible());
    const fuera = pedidos.filter((u) => u.pathname !== '/cauce').filter((u) => u.origin !== ORIGEN || !u.pathname.startsWith('/cauce/')).map((u) => u.href);
    ok('subruta: ningún archivo se pide fuera de /cauce/ ni a otro servidor', fuera.length === 0, fuera.slice(0, 3).join(' '));
    const inesperados = fallidos.filter((f) => !/\/datos\/reales\/|proyectos\.local\.json|-naturaleza\.json/.test(f));
    ok('subruta: sin archivos faltantes (salvo los datos reales que aún no existen)', inesperados.length === 0, inesperados.slice(0, 4).join(', '));
    ok('subruta: personajes de Kenney cargados desde la subruta', pedidos.some((u) => /\/cauce\/vendor\/kenney-mini-characters\/.+\.glb$/.test(u.pathname)));
    await p.keyboard.press('s'); await p.waitForTimeout(800);
    ok('subruta: la sala de control funciona', (await p.locator('.sala-tarjeta').count()) === 6);
    await p.keyboard.press('s');

    await p.goto(ORIGEN + '/cauce/?incrustado=1'); await p.waitForTimeout(7000);
    ok('incrustado: sin marca ni pie, pero con DEMO, conexión y pestañas', !(await p.locator('.marca').isVisible()) && !(await p.locator('.pie').isVisible())
      && await p.locator('#banda-demo').isVisible() && await p.locator('#conexion').isVisible() && (await p.locator('#pisos .piso').count()) >= 3);

    // Página «portal» de prueba en el mismo origen con la oficina en un iframe (no es autenticación ni seguridad).
    await p.route(ORIGEN + '/cauce/__portal-prueba.html', (q) => q.fulfill({ status: 200, contentType: 'text/html; charset=utf-8',
      body: '<!doctype html><title>Portal de prueba</title><h1>Portal</h1><iframe id="f" src="./?incrustado=1" style="width:1200px;height:700px;border:0"></iframe>' }));
    await p.goto(ORIGEN + '/cauce/__portal-prueba.html'); await p.waitForTimeout(9000);
    const marco = p.frame({ url: /\/cauce\/\?incrustado=1/ });
    ok('iframe del mismo origen: la oficina carga dentro del portal de prueba', Boolean(marco) && await marco.locator('.vista3d > canvas').isVisible().catch(() => false));

    await p.goto(ORIGEN + '/cauce/pruebas.html');
    await p.waitForFunction(() => /pasaron/.test(document.body.innerText), null, { timeout: 60000 }).catch(() => {});
    const resumen = ((await p.evaluate(() => document.body.innerText)).match(/(\d+) pasaron, (\d+) fallaron/) || []);
    ok('subruta: pruebas.html corre completo bajo /cauce/', resumen[2] === '0' && Number(resumen[1]) > 0, resumen[0] || 'sin resumen');
    await b.close();
  } finally {
    srv.kill();
  }
  console.log(res.join('\n'));
  console.log('errores:', errs.length ? errs.join(' | ') : 'ninguno');
  const f = res.filter((x) => x.startsWith('FALLA')).length;
  console.log(`\n${res.length - f} OK, ${f} FALLA`);
  process.exit(f || errs.length ? 1 : 0);
})();
