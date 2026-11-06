// Rendimiento UHD: comportamiento de las optimizaciones (no mide la Intel UHD: SwiftShader).
//  · brillo ligero (por defecto), completo con ?brillo=completo, apagar libera sus texturas, el interruptor sigue;
//  · escena quieta (Montambre: solo estructura) no se redibuja, pero la cámara, la selección y el cambio de
//    modo sí vuelven a dibujar al instante; las etiquetas siguen a la cámara;
//  · DEMO con personajes: se dibuja siempre (60/30 cps según el equipo), selección y cámara funcionan;
//  · «Un cuarto» intacto; ?quieta=0 desactiva el ahorro; WebGL perdido con brillo ligero no rompe la app.
// Con servir.py corriendo:  node pruebas/navegador/rendimiento-uhd.cjs   (SAL=carpeta para capturas, opcional)
const { chromium } = require('playwright');
const BASE = 'http://127.0.0.1:' + (process.env.PUERTO || 8765) + '/';
const SAL = process.env.SAL || null;

(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const res = []; const errs = [];
  const ok = (n, c, x = '') => res.push(`${c ? 'OK ' : 'FALLA'} ${n}${x ? ' · ' + x : ''}`);
  const nueva = async (consulta = '', viewport = { width: 1366, height: 768 }) => {
    const p = await b.newPage({ viewport });
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errs.push(m.text()); });
    await p.route('**/datos/proyectos.local.json*', (r) => r.fulfill({ status: 404, body: '' }));
    await p.route('**/datos/reales/*', (r) => r.fulfill({ status: 404, body: '' }));
    await p.goto(BASE + '?medir=1&hora=11' + consulta); await p.waitForTimeout(7000);
    return p;
  };
  const met = (p) => p.evaluate(() => window.__cauce3d.metricas());
  const brillo = (p) => p.locator('label.interruptor', { hasText: 'Brillo' }).click();
  // Cuadros dibujados en `ms` (cuenta llamadas reales a WebGL por cuadro de animación).
  const dibujados = (p, ms) => p.evaluate((ms) => new Promise((fin) => {
    const c = document.querySelector('.vista3d canvas'); const gl = c.getContext('webgl2');
    let n = 0, enCuadro = false; const orig = gl.drawElements.bind(gl); const origA = gl.drawArrays.bind(gl);
    gl.drawElements = (...a) => { enCuadro = true; return orig(...a); }; gl.drawArrays = (...a) => { enCuadro = true; return origA(...a); };
    const t0 = performance.now();
    const paso = () => { if (enCuadro) n++; enCuadro = false; if (performance.now() - t0 < ms) requestAnimationFrame(paso); else { delete gl.drawElements; delete gl.drawArrays; fin(n); } };
    requestAnimationFrame(paso);
  }), ms);

  // ------------------------------------------------------------ Brillo
  let p = await nueva();
  const m0 = await met(p);
  ok('brillo apagado por defecto', m0.brillo === false && !(await p.locator('label.interruptor', { hasText: 'Brillo' }).locator('input').isChecked()));
  await brillo(p); await p.waitForTimeout(2500);
  const m1 = await met(p);
  ok('al encender, el brillo es el ligero', m1.brillo === true && m1.brillo_tipo === 'ligero', `${m1.brillo_tipo}, ${m0.llamadas} → ${m1.llamadas} llamadas`);
  ok('brillo ligero: ≤ 45 llamadas extra (solo pantallas, letreros y luces)', m1.llamadas - m0.llamadas <= 45, `${m1.llamadas - m0.llamadas}`);
  ok('brillo ligero: suma 2 texturas como máximo (las dos imágenes reducidas)', m1.texturas - m0.texturas <= 2, `${m0.texturas} → ${m1.texturas}`);
  if (SAL) { await p.evaluate(() => { document.querySelector('.vista3d-medidas').hidden = true; }); await p.screenshot({ path: `${SAL}/uhd-brillo-ligero.png` }); }
  await brillo(p); await p.waitForTimeout(1500);
  const m2 = await met(p);
  ok('al apagar, el brillo libera sus texturas y vuelve a las llamadas de antes', m2.brillo === false && m2.texturas === m0.texturas && m2.llamadas === m0.llamadas, `${m2.texturas} texturas, ${m2.llamadas} llamadas`);
  // Encender y apagar muchas veces no acumula memoria de video.
  for (let i = 0; i < 6; i++) { await brillo(p); await p.waitForTimeout(700); }
  const m3 = await met(p);
  ok('encender/apagar 6 veces no acumula texturas', m3.texturas === m0.texturas && m3.brillo === false, `${m3.texturas}`);
  await p.close();

  p = await nueva('&brillo=completo');
  await brillo(p); await p.waitForTimeout(2500);
  const mc = await met(p);
  ok('?brillo=completo usa el brillo anterior (UnrealBloom)', mc.brillo === true && mc.brillo_tipo === 'completo', `${mc.brillo_tipo}, ${mc.llamadas} llamadas`);
  await p.close();

  // ------------------------------------------------------------ DEMO con personajes: se dibuja siempre
  p = await nueva();
  const nDemo = await dibujados(p, 2000);
  ok('DEMO con personajes: se sigue dibujando cada cuadro (≥ 15 en 2 s en SwiftShader)', nDemo >= 15, `${nDemo} cuadros`);
  const mDemo = await met(p);
  ok('DEMO: la escena no se marca como quieta', mDemo.escena_quieta === false);
  // Selección de un personaje: tarjeta y cámara.
  const per = (await p.evaluate(() => window.__cauce3d.personajes())).find((x) => x.visible);
  const pt = await p.evaluate((id) => window.__cauce3d.proyectar(id), per.id);
  await p.mouse.click(pt.x, pt.y); await p.waitForTimeout(1500);
  ok('tocar un personaje abre su tarjeta y acerca la cámara', await p.locator('.vista3d-tarjeta').isVisible() && (await p.evaluate(() => window.__cauce3d.camara())).zoom > 1.05, per.id);
  await p.keyboard.press('Escape'); await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  const cA = await p.evaluate(() => window.__cauce3d.camara());
  await p.keyboard.press('2'); await p.waitForTimeout(1200);
  const c2 = await p.evaluate(() => window.__cauce3d.camara());
  ok('tecla 2: enfoca el segundo departamento', c2.enfocado === 'busqueda', JSON.stringify(c2.enfocado));
  await p.keyboard.press('Backspace'); await p.waitForTimeout(1200);
  const cB = await p.evaluate(() => window.__cauce3d.camara());
  ok('Retroceso: vuelve a la vista anterior', cB.enfocado === cA.enfocado && cB.historial === c2.historial - 1 && Math.abs(cB.zoom - cA.zoom) < 0.05, `${c2.enfocado} → ${cB.enfocado}`);
  // Un cuarto intacto.
  await p.locator('[data-modo3d="individual"]').click(); await p.waitForTimeout(2000);
  await p.locator('.vista3d-selector').selectOption('importacion'); await p.waitForTimeout(2500);
  const mu = await met(p);
  ok('«Un cuarto»: un solo departamento, con su personaje, ≤ 20 llamadas', mu.modo === 'individual' && mu.llamadas <= 20 && mu.personajes >= 1, `${mu.llamadas} llamadas, ${mu.personajes} personaje(s), ${mu.departamento}`);
  ok('«Un cuarto»: se dibuja cada cuadro mientras el personaje se mueve', (await dibujados(p, 1500)) >= 10, mu.departamento);
  await p.locator('.vista3d-selector').selectOption('busqueda'); await p.waitForTimeout(2500);
  const mv = await met(p);
  ok('«Un cuarto» sin personaje a la vista (Búsqueda): la escena queda quieta y casi no se redibuja', mv.escena_quieta === true && (await dibujados(p, 2000)) <= 4, `${mv.departamento}`);
  await p.locator('[data-modo3d="edificio"]').click(); await p.waitForTimeout(1500);
  await p.close();

  // ------------------------------------------------------------ Escena quieta: Montambre (solo estructura)
  p = await nueva();
  await p.locator('#pisos .piso', { hasText: 'Montambre' }).first().click(); await p.waitForTimeout(5000);
  const mq = await met(p);
  ok('Montambre: escena sin personajes = quieta', mq.escena_quieta === true && mq.personajes === 0, `${mq.personajes} personajes`);
  const nq = await dibujados(p, 3000);
  ok('escena quieta: casi no se redibuja (≤ 5 cuadros en 3 s; antes ~90)', nq <= 5, `${nq} cuadros`);
  // Girar/acercar con la rueda: redibuja al instante y las etiquetas se mueven con la cámara.
  const etiqueta = () => p.evaluate(() => document.querySelector('.etiqueta-dep:not([hidden])')?.style.transform ?? '');
  const e0 = await etiqueta();
  const caja = await p.locator('.vista3d canvas').first().boundingBox();
  const conteo = dibujados(p, 1500);
  await p.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2);
  await p.mouse.down(); await p.mouse.move(caja.x + caja.width / 2 + 120, caja.y + caja.height / 2 + 10, { steps: 8 }); await p.mouse.up();
  const nMover = await conteo;
  ok('escena quieta: al mover la cámara sí se dibuja (≥ 5 cuadros)', nMover >= 5, `${nMover} cuadros`);
  await p.waitForTimeout(800);
  const e1 = await etiqueta();
  ok('las etiquetas siguen a la cámara aunque la escena esté quieta', e0 !== e1 && e1 !== '', `${e0} → ${e1}`);
  // Elegir un departamento redibuja (resaltado del letrero) y enfoca.
  await p.locator('.etiqueta-dep', { hasText: 'Moderación' }).click(); await p.waitForTimeout(1500);
  ok('escena quieta: elegir un departamento lo enfoca', Boolean((await p.evaluate(() => window.__cauce3d.camara())).enfocado));
  if (SAL) { await p.evaluate(() => { document.querySelector('.vista3d-medidas').hidden = true; }); await p.screenshot({ path: `${SAL}/uhd-quieta-enfocada.png` }); }
  // Cambiar el tamaño de la ventana redibuja.
  const conteo2 = dibujados(p, 1200);
  await p.setViewportSize({ width: 1100, height: 700 });
  ok('escena quieta: cambiar el tamaño de la ventana redibuja', (await conteo2) >= 1);
  const txt = await p.locator('.vista3d-medidas pre').innerText();
  ok('el medidor explica que la escena quieta no se redibuja', /Escena quieta/.test(txt), txt.split('\n').find((l) => /quieta/i.test(l)) ?? '');
  await p.close();

  p = await nueva('&quieta=0');
  await p.locator('#pisos .piso', { hasText: 'Montambre' }).first().click(); await p.waitForTimeout(5000);
  const n0 = await dibujados(p, 2000);
  ok('?quieta=0: la escena quieta se dibuja como antes (para medir)', n0 >= 15, `${n0} cuadros`);
  await p.close();

  // ------------------------------------------------------------ WebGL perdido con brillo ligero
  p = await nueva();
  await brillo(p); await p.waitForTimeout(2000);
  await p.evaluate(() => document.querySelector('.vista3d canvas').getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext());
  await p.waitForTimeout(2500);
  ok('WebGL perdido con brillo ligero: plano 2D con «Reintentar 3D»', await p.locator('.reintentar-3d').isVisible());
  await p.locator('.reintentar-3d').click(); await p.waitForTimeout(6000);
  const mr = await met(p);
  ok('Reintentar 3D: vuelve la oficina y el brillo guardado se enciende otra vez (ligero)', await p.locator('.vista3d').isVisible() && mr.brillo === true && mr.brillo_tipo === 'ligero', `${mr.brillo}/${mr.brillo_tipo}`);
  await p.close();

  // ------------------------------------------------------------ ?px= (diagnóstico de densidad de píxeles)
  {
    const ctx = await b.newContext({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1.5 });
    const q = await ctx.newPage();
    q.on('pageerror', (e) => errs.push(e.message));
    await q.route('**/datos/reales/*', (r) => r.fulfill({ status: 404, body: '' }));
    await q.route('**/datos/proyectos.local.json*', (r) => r.fulfill({ status: 404, body: '' }));
    await q.goto(BASE + '?medir=1&hora=11'); await q.waitForTimeout(6000);
    const sinPx = (await met(q)).pixelRatio;
    await q.goto(BASE + '?medir=1&hora=11&px=1'); await q.waitForTimeout(6000);
    const conPx = await met(q);
    ok('pantalla al 150 %: sin parámetro usa 1.5; con ?px=1 dibuja a 1 (menos píxeles)', sinPx === 1.5 && conPx.pixelRatio === 1, `${sinPx} → ${conPx.pixelRatio}, ${conPx.tamano.join('×')}`);
    await q.goto(BASE + '?medir=1&hora=11&px=9'); await q.waitForTimeout(5000);
    ok('?px= con un valor fuera de 0.5–2 se ignora', (await met(q)).pixelRatio === 1.5);
    await ctx.close();
  }

  // ------------------------------------------------------------ Celular: sin brillo, ahorro igual
  p = await nueva('', { width: 390, height: 844 });
  ok('celular: sin interruptor de brillo', (await p.locator('label.interruptor', { hasText: 'Brillo' }).count()) === 0);
  ok('celular: DEMO se dibuja (≥ 10 cuadros en 2 s, límite 30 cps)', (await dibujados(p, 2000)) >= 10);
  await p.close();

  console.log(res.join('\n'));
  console.log('errores:', errs.length ? errs : 'ninguno');
  await b.close();
  process.exit(res.some((r) => r.startsWith('FALLA')) ? 1 : 0);
})();
