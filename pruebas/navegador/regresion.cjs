// Regresión en navegador: selección, cámara, modos, 2D, bajo consumo, etiquetas y celular.
// Requiere Playwright y Chromium (no son dependencias del proyecto). Uso: con iniciar.bat/servir.py corriendo,
//   node pruebas/navegador/regresion.cjs      (SAL=carpeta para las capturas; por omisión ./r)
// Usa los datos de demostración (responde 404 al archivo real) y SwiftShader: no mide rendimiento real.
const { chromium, devices } = require('playwright');
const SAL = process.env.SAL || 'r';
require('fs').mkdirSync(SAL, { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const errs = []; const res = [];
  const ok = (n, c, extra='') => { res.push(`${c ? 'OK ' : 'FALLA'} ${n}${extra ? ' · ' + extra : ''}`); };
  const nueva = async (opts) => { const p = await b.newPage(opts); p.on('pageerror', e=>errs.push('PAGE '+e.message)); p.on('console', m=>{ if(m.type()==='error' && !m.text().includes('404')) errs.push(m.text()); });
    await p.route('**/datos/reales/compago.json*', r => r.fulfill({ status: 404, body: '' })); return p; };
  const choques = (p) => p.evaluate(() => {
    const vis = [...document.querySelectorAll('.etiqueta-dep')].filter(n => !n.hidden && n.getClientRects().length && !n.closest('[hidden]')).map(n => n.getBoundingClientRect());
    let c = 0; for (let i=0;i<vis.length;i++) for (let j=i+1;j<vis.length;j++){const a=vis[i],b=vis[j]; if(a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top) c++;}
    return { visibles: vis.length, c };
  });
  const sel = (p) => p.locator('.vista3d-selector').inputValue();
  // --- Escritorio ---
  let p = await nueva({ viewport: { width: 1390, height: 760 } });
  await p.goto('http://127.0.0.1:8765/?medir=1'); await p.waitForTimeout(9000);
  await p.evaluate(() => document.querySelector('.vista3d-medidas').hidden = true);
  const pos = await p.evaluate(() => window.__cauce3d.proyectar('importador'));
  if (pos) { await p.mouse.click(pos.x, pos.y); await p.waitForTimeout(1500); }
  const panel = await p.locator('#panel').innerText().catch(() => '');
  ok('clic en un personaje abre su detalle', /Importador/.test(panel));
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  ok('Esc cierra el panel', await p.locator('#panel').isHidden());
  await p.keyboard.press('Escape'); await p.waitForTimeout(1200);
  ok('segundo Esc vuelve al piso', (await sel(p)) === '');
  await p.locator('.etiqueta-dep', { hasText: 'Auditoría' }).click(); await p.waitForTimeout(1500);
  ok('tocar etiqueta enfoca', (await sel(p)) === 'auditoria');
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(1200);
  ok('flecha → pasa al vecino', (await sel(p)) !== 'auditoria');
  await p.getByRole('button', { name: '← Piso' }).click(); await p.waitForTimeout(1200);
  ok('botón ← Piso', (await sel(p)) === '');
  ok('escritorio: sin barra móvil', await p.locator('.vista3d-movil').count() === 0);
  const e1 = await choques(p); ok('escritorio: etiquetas sin encimarse', e1.c === 0, `${e1.visibles} visibles`);
  await p.locator('[data-modo3d=individual]').click(); await p.waitForTimeout(3000);
  await p.evaluate(() => document.querySelector('.vista3d-medidas').hidden = false);
  ok('modo Un cuarto', /un cuarto/.test(await p.locator('.vista3d-medidas pre').textContent()));
  await p.locator('[data-modo3d=edificio]').click(); await p.waitForTimeout(3000);
  ok('regresa a Edificio', /edificio/.test(await p.locator('.vista3d-medidas pre').textContent()));
  await p.screenshot({ path: `${SAL}/escritorio.png` });
  await p.locator('[data-vista="2d"]').click(); await p.waitForTimeout(1500);
  ok('plano 2D', await p.locator('.plano').count() > 0);
  await p.locator('[data-vista="3d"]').click(); await p.waitForTimeout(2500);
  await p.locator('#bajo-consumo').check(); await p.waitForTimeout(1200);
  ok('bajo consumo usa 2D', (await p.locator('.plano').count() > 0) && (await p.locator('.vista3d').count() === 0));
  await p.locator('#bajo-consumo').uncheck(); await p.waitForTimeout(3000);
  ok('vuelve a 3D', await p.locator('.vista3d').count() === 1);
  await p.setViewportSize({ width: 1000, height: 700 }); await p.waitForTimeout(1500);
  const e2 = await choques(p); ok('tras cambiar tamaño: etiquetas sin encimarse', e2.c === 0, `${e2.visibles} visibles`);
  await p.goto('http://127.0.0.1:8765/?hora=23'); await p.waitForTimeout(8000); await p.screenshot({ path: `${SAL}/escritorio-noche.png` });
  await p.close();
  // --- Celulares ---
  for (const [nombre, disp] of [['iphone12', devices['iPhone 12 Pro']], ['android-chico', { viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }], ['iphone-horizontal', devices['iPhone 12 Pro landscape']]]) {
    p = await nueva({ ...disp });
    await p.goto('http://127.0.0.1:8765/'); await p.waitForTimeout(9000);
    const e = await choques(p); ok(`${nombre}: etiquetas sin encimarse`, e.c === 0, `${e.visibles} visibles`);
    await p.locator('.vista3d canvas').first().scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
    const box = await p.locator('.vista3d canvas').first().boundingBox();
    const cdp = await p.context().newCDPSession(p);
    const y = box.y + box.height * 0.55;
    const toque = (type, x) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    await toque('touchStart', box.x + box.width * 0.8); for (let k = 1; k <= 6; k++) await toque('touchMove', box.x + box.width * (0.8 - 0.1 * k)); await toque('touchEnd');
    await p.waitForTimeout(1800);
    const s1 = await sel(p); ok(`${nombre}: deslizar cambia de departamento`, s1 !== '', s1);
    await p.screenshot({ path: `${SAL}/${nombre}.png` });
    // Barra inferior: flechas, lista y menú.
    const barra = p.locator('.vista3d-movil');
    ok(`${nombre}: barra móvil visible y selector de arriba oculto`, await barra.isVisible() && !(await p.locator('.vista3d-selector').isVisible()) && await p.locator('.vista3d-fuente').isVisible());
    const enc = await p.evaluate(() => { const b = document.querySelector('.movil-barra').getBoundingClientRect(); let c = 0;
      for (const n of document.querySelectorAll('.etiqueta-dep')) { if (n.hidden) continue; const r = n.getBoundingClientRect(); if (r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top) c++; } return c; });
    ok(`${nombre}: ninguna etiqueta debajo de la barra`, enc === 0);
    const antes = await sel(p);
    await p.getByRole('button', { name: 'Departamento siguiente' }).click(); await p.waitForTimeout(1200);
    const despues = await sel(p);
    await p.getByRole('button', { name: 'Departamento anterior' }).click(); await p.waitForTimeout(1200);
    ok(`${nombre}: flechas ▶ ◀`, despues !== antes && (await sel(p)) === antes, `${antes} → ${despues} → ${await sel(p)}`);
    await p.locator('.movil-actual').click(); await p.waitForTimeout(300);
    const filas = await p.locator('.movil-fila').count();
    const deps = await p.evaluate(() => document.querySelectorAll('.vista3d-selector option[value]:not([value=""])').length);
    ok(`${nombre}: lista con todos los departamentos`, filas === deps + 1, `${filas} filas, ${deps} departamentos`);
    await p.screenshot({ path: `${SAL}/${nombre}-lista.png` });
    await p.locator('.movil-fila', { hasText: 'Auditoría' }).click(); await p.waitForTimeout(1500);
    ok(`${nombre}: elegir en la lista enfoca`, (await sel(p)) === 'auditoria' && await p.locator('.movil-lista').isHidden());
    await p.locator('.movil-actual').click(); await p.locator('.movil-fila', { hasText: 'Todo el piso' }).click(); await p.waitForTimeout(1500);
    ok(`${nombre}: "Todo el piso" regresa`, (await sel(p)) === '');
    await p.getByRole('button', { name: 'Más opciones' }).click(); await p.waitForTimeout(300);
    await p.screenshot({ path: `${SAL}/${nombre}-menu.png` });
    await p.getByRole('menuitemradio', { name: 'Un cuarto' }).click(); await p.waitForTimeout(3000);
    const individual = await p.evaluate(() => localStorage.getItem('cauce.modo3d'));
    await p.getByRole('button', { name: 'Más opciones' }).click(); await p.getByRole('menuitemradio', { name: 'Edificio completo' }).click(); await p.waitForTimeout(3000);
    ok(`${nombre}: menú cambia de modo y regresa`, individual === 'individual' && (await p.evaluate(() => localStorage.getItem('cauce.modo3d'))) === 'edificio');
    await p.locator('.vista3d canvas').first().click({ position: { x: 5, y: 5 } }).catch(() => {});
    // Detalle: elegir un personaje abre el panel abajo sin tapar todo el edificio.
    await p.locator('.movil-actual').click(); await p.locator('.movil-fila', { hasText: 'Auditoría' }).click(); await p.waitForTimeout(1500);
    await p.locator('.vista3d-personajes .chip').first().click(); await p.waitForTimeout(1500);
    const alto = await p.evaluate(() => { const r = document.querySelector('#panel').getBoundingClientRect(); return { panel: r.height, vh: innerHeight, visible: !document.querySelector('#panel').hidden }; });
    ok(`${nombre}: panel de detalle ≤ 50% de la pantalla`, alto.visible && alto.panel <= alto.vh * 0.5 + 1, `${Math.round(alto.panel)} de ${alto.vh}px`);
    await p.screenshot({ path: `${SAL}/${nombre}-panel.png` });
    // Cabecera REAL/DEMO y conexión pegada arriba al bajar.
    await p.evaluate(() => window.scrollTo(0, 400)); await p.waitForTimeout(300);
    const cab = await p.evaluate(() => { const r = document.querySelector('#conexion').getBoundingClientRect(); return { top: r.top, demo: !!document.querySelector('#conexion .tablero-insignia') }; });
    ok(`${nombre}: REAL/DEMO y conexión siguen visibles al bajar`, Math.abs(cab.top) < 2 && cab.demo, `top ${cab.top}`);
    await p.close();
  }
  console.log(res.join('\n'));
  console.log('errores de consola:', errs.length ? errs : 'ninguno');
  await b.close();
})();
