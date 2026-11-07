// G: modo inmersivo en escritorio, celular vertical y horizontal. Con servir.py corriendo:
//   node pruebas/navegador/inmersivo.cjs [CARPETA_CAPTURAS]
const { chromium, devices } = require('playwright');
const SAL = process.argv[2] || null;
const URL = 'http://127.0.0.1:' + (process.env.PUERTO || 8765) + '/?medir=1';
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const res = [];
  const errores = [];
  const ok = (n, c, extra = '') => res.push(`${c ? 'OK ' : 'FALLA'} ${n}${extra ? ' · ' + extra : ''}`);
  const area = (p) => p.evaluate(() => { const c = window.__cauce3d?.cajaEdificio(); return c ? Math.round((c.der - c.izq) * (c.abajo - c.arriba)) : 0; });
  const inm = (p) => p.evaluate(() => document.documentElement.classList.contains('inmersivo'));
  const visible = (p, s) => p.locator(s).first().isVisible();
  const choque = (p, a, c) => p.evaluate(([a, c]) => {
    const x = document.querySelector(a)?.getBoundingClientRect(), y = document.querySelector(c)?.getBoundingClientRect();
    return !!(x && y && x.width && y.width && x.left < y.right && x.right > y.left && x.top < y.bottom && x.bottom > y.top);
  }, [a, c]);

  // ---------- Escritorio
  {
    const p = await b.newPage({ viewport: { width: 1366, height: 768 } });
    p.on('pageerror', (e) => errores.push(String(e)));
    await p.route('**/datos/reales/*', (r) => r.fulfill({ status: 404, body: '' }));
    await p.goto(URL); await p.waitForTimeout(6000);
    const antes = await area(p);
    const geoAntes = await p.evaluate(() => window.__cauce3d.metricas());
    ok('escritorio: botón Inmersivo visible en 3D con nombre accesible', await visible(p, '.boton-inmersivo') && /Inmersivo/.test(await p.locator('.boton-inmersivo').innerText()));
    await p.locator('.boton-inmersivo').click(); await p.waitForTimeout(1200);
    const despues = await area(p);
    ok('escritorio: entra al modo inmersivo y oculta la cabecera', await inm(p) && !(await visible(p, '.cabecera')));
    ok('escritorio: el edificio crece al menos 30 %', despues >= antes * 1.3, `${antes} → ${despues} px²`);
    ok('escritorio: siguen a la vista DEMO, conexión y alertas', await visible(p, '#conexion .tablero-insignia') && /En línea/.test(await p.locator('#conexion').innerText()) && await visible(p, '[data-k="alertas"] summary'));
    ok('escritorio: indicadores secundarios ocultos (estados, cambios, minimapa)', !(await visible(p, '.tablero-estados')) && !(await visible(p, '[data-k="cambios"]')) && !(await visible(p, '.vista3d-minimapa')));
    ok('escritorio: botón Salir visible, con foco y aria-pressed', await visible(p, '#salir-inmersivo') && await p.evaluate(() => document.activeElement?.id === 'salir-inmersivo') && (await p.locator('.boton-inmersivo').getAttribute('aria-pressed')) === 'true');
    ok('escritorio: la franja de estado no tapa el botón Salir', !(await choque(p, '#conexion', '#salir-inmersivo')));
    await p.locator('[data-k="alertas"] summary').click(); await p.waitForTimeout(300);
    ok('escritorio: las alertas se consultan sin salir', await visible(p, '[data-k="alertas"] .tablero-lista') && await inm(p));
    await p.locator('[data-k="alertas"] summary').click();
    await p.locator('.etiqueta-dep', { hasText: 'Búsqueda' }).click(); await p.waitForTimeout(1200);
    ok('escritorio: elegir un departamento abre el detalle sin salir', await visible(p, '#panel') && await inm(p));
    ok('escritorio: el detalle no tapa la franja ni Salir', !(await choque(p, '#panel', '#salir-inmersivo')) && !(await choque(p, '#panel', '#conexion')));
    if (SAL) await p.screenshot({ path: `${SAL}/inmersivo-escritorio-detalle.png` });
    await p.keyboard.press('Escape'); await p.waitForTimeout(400);
    ok('escritorio: Esc primero cierra el detalle', !(await visible(p, '#panel')) && await inm(p));
    await p.keyboard.press('Escape'); await p.waitForTimeout(800);
    // Con el departamento enfocado, Esc vuelve al piso antes de salir.
    if (await inm(p)) { await p.keyboard.press('Escape'); await p.waitForTimeout(800); }
    ok('escritorio: Esc sale del modo inmersivo', !(await inm(p)) && await visible(p, '.cabecera'));
    const geoDespues = await p.evaluate(() => window.__cauce3d.metricas());
    ok('escritorio: entrar y salir no cambia geometrías, texturas ni llamadas', geoAntes.geometrias === geoDespues.geometrias && geoAntes.texturas === geoDespues.texturas,
      `geo ${geoAntes.geometrias}→${geoDespues.geometrias}, tex ${geoAntes.texturas}→${geoDespues.texturas}`);
    // 10 vueltas: sin fugas de nodos.
    const nodos0 = await p.evaluate(() => document.getElementsByTagName('*').length);
    for (let i = 0; i < 10; i++) { await p.locator('.boton-inmersivo').click(); await p.waitForTimeout(150); await p.locator('#salir-inmersivo').click(); await p.waitForTimeout(150); }
    const nodos1 = await p.evaluate(() => document.getElementsByTagName('*').length);
    ok('escritorio: 10 entradas y salidas sin acumular nodos', Math.abs(nodos1 - nodos0) <= 2, `${nodos0}→${nodos1}`);
    // El plano no tiene modo inmersivo y pasar al plano lo apaga.
    await p.locator('.boton-inmersivo').click(); await p.waitForTimeout(300);
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    await p.locator('[data-vista="2d"]').click(); await p.waitForTimeout(800);
    ok('plano: sin botón Inmersivo y sin modo inmersivo', !(await inm(p)) && !(await visible(p, '.boton-inmersivo')));
    await p.locator('[data-vista="3d"]').click(); await p.waitForTimeout(3000);
    ok('de vuelta en 3D: el botón Inmersivo regresa', await visible(p, '.boton-inmersivo'));
    await p.close();
  }

  // ---------- Error de conexión: en inmersivo el error se ve completo
  {
    const p = await b.newPage({ viewport: { width: 1366, height: 768 } });
    p.on('pageerror', (e) => errores.push(String(e)));
    await p.route('**/datos/reales/*', (r) => r.fulfill({ status: 500, body: 'falla' }));
    await p.goto(URL); await p.waitForTimeout(5000);
    await p.locator('.boton-inmersivo').click(); await p.waitForTimeout(800);
    const t = await p.locator('#conexion').innerText();
    ok('inmersivo con error: «Sin conexión» y el motivo siguen visibles', /Sin conexión/.test(t) && await visible(p, '#conexion .conexion-motivo'), t.split('\n')[0]);
    await p.close();
  }

  // ---------- Archivo con datos corregidos (DEMO de Ek Chuah): el diagnóstico sigue a la vista
  {
    const p = await b.newPage({ viewport: { width: 1366, height: 768 } });
    p.on('pageerror', (e) => errores.push(String(e)));
    await p.addInitScript(() => { try { localStorage.setItem('cauce.proyecto', 'ek-chuah'); } catch {} });
    await p.route('**/datos/reales/*', (r) => r.fulfill({ status: 404, body: '' }));
    await p.goto(URL); await p.waitForTimeout(5000);
    const hay = await visible(p, '#diagnostico');
    await p.locator('.boton-inmersivo').click(); await p.waitForTimeout(800);
    ok('inmersivo: el diagnóstico del archivo sigue visible y no lo tapa nada', hay && await visible(p, '#diagnostico summary')
      && !(await choque(p, '#diagnostico', '.vista3d-barra select')) && !(await choque(p, '#diagnostico', '#conexion')),
      hay ? await p.locator('#diagnostico summary').innerText() : 'Ek Chuah DEMO no trajo diagnóstico');
    if (SAL) await p.screenshot({ path: `${SAL}/inmersivo-diagnostico.png` });
    await p.close();
  }

  // ---------- Celular vertical y horizontal
  for (const [nombre, disp] of [['celular-vertical', devices['iPhone 12 Pro']], ['celular-horizontal', devices['iPhone 12 Pro landscape']]]) {
    const p = await b.newPage({ ...disp });
    p.on('pageerror', (e) => errores.push(String(e)));
    await p.route('**/datos/reales/*', (r) => r.fulfill({ status: 404, body: '' }));
    await p.goto(URL); await p.waitForTimeout(6000);
    const antes = await area(p);
    await p.locator('.boton-inmersivo').tap(); await p.waitForTimeout(1500);
    const despues = await area(p);
    ok(`${nombre}: entra con un toque y el edificio no se achica`, await inm(p) && despues >= antes, `${antes} → ${despues} px²`);
    ok(`${nombre}: DEMO, conexión, alertas, Salir y barra de departamentos visibles`, await visible(p, '#conexion .tablero-insignia') && await visible(p, '[data-k="alertas"] summary') && await visible(p, '#salir-inmersivo') && await visible(p, '.movil-barra'));
    ok(`${nombre}: la franja de estado no tapa Salir`, !(await choque(p, '#conexion', '#salir-inmersivo')));
    const salir = await p.locator('#salir-inmersivo').boundingBox();
    ok(`${nombre}: Salir mide al menos 36 px`, salir && salir.width >= 36 && salir.height >= 36, salir ? `${Math.round(salir.width)}×${Math.round(salir.height)}` : '');
    await p.locator('.movil-actual').tap(); await p.locator('.movil-fila', { hasText: 'Importación' }).tap(); await p.waitForTimeout(1500);
    ok(`${nombre}: elegir un departamento desde la barra abre el detalle sin salir`, await visible(p, '#panel') && await inm(p));
    ok(`${nombre}: detalle, barra y Salir no se enciman`, !(await choque(p, '#panel', '.movil-barra')) && !(await choque(p, '#panel', '#salir-inmersivo')));
    if (SAL) await p.screenshot({ path: `${SAL}/inmersivo-${nombre}-detalle.png` });
    const scrollX = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    ok(`${nombre}: sin desplazamiento horizontal`, scrollX <= 0, `${scrollX}px`);
    await p.locator('#salir-inmersivo').tap(); await p.waitForTimeout(800);
    ok(`${nombre}: Salir regresa a la vista normal`, !(await inm(p)) && await visible(p, '.cabecera'));
    await p.close();
  }
  console.log(res.join('\n'));
  console.log('errores:', errores.length ? errores.join(' | ') : 'ninguno');
  await b.close();
  if (res.some((l) => l.startsWith('FALLA')) || errores.length) process.exit(1);
})();
