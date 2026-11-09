// Navegación entre oficinas y secciones especiales (2026-11-09), en Chromium (SwiftShader).
// Con servir.py corriendo:  node pruebas/navegador/navegacion-secciones.cjs      (PUERTO=8765 por omisión)
//
// Defecto que cubre (visto por Diego en la MSI con el PR #35): tras abrir Sala de control, Nexus o CSI, pulsar una
// pestaña de piso no devolvía el edificio 3D (la clase de la sección en <html> dejaba #oficina oculto) y solo se
// recuperaba recargando o pasando por Inmersivo. Recorre la secuencia real de un usuario, sin recargar, con y sin
// Inmersivo, y comprueba en cada paso: lo que se ve, el visor 3D con tamaño, los controles, que la cámara responda,
// un solo lienzo WebGL, sin errores de consola y sin crecer geometrías ni texturas al repetir la secuencia.
const { chromium } = require('playwright');
const BASE = 'http://127.0.0.1:' + (process.env.PUERTO || 8765) + '/';

(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const res = []; const errs = [];
  const ok = (n, c, x = '') => res.push(`${c ? 'OK ' : 'FALLA'} ${n}${x ? ' · ' + x : ''}`);

  async function abrir() {
    const p = await b.newPage({ viewport: { width: 1366, height: 768 } });
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errs.push(m.text()); });
    await p.route('**/datos/proyectos.local.json*', (r) => r.fulfill({ status: 404, body: '' }));
    await p.route('**/datos/reales/*', (r) => r.fulfill({ status: 404, body: '' }));
    await p.addInitScript(() => { try { localStorage.setItem('cauce.proyecto', 'compago'); localStorage.setItem('cauce.sala', '0'); localStorage.setItem('cauce.modo3d', 'edificio'); localStorage.setItem('cauce.vista', '3d'); } catch {} });
    await p.goto(BASE + '?medir=1&hora=11'); await p.waitForTimeout(7000);
    if (await p.locator('#sala-control').isVisible().catch(() => false)) { await p.locator('[data-cerrar-sala]').first().click(); await p.waitForTimeout(800); }
    p.cargas = 0; p.on('framenavigated', (f) => { if (f === p.mainFrame()) p.cargas++; });
    return p;
  }
  const estado = (p) => p.evaluate(() => {
    const vis = (s) => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); return !e.hidden && getComputedStyle(e).display !== 'none' && r.width > 0 && r.height > 0; };
    const lienzos = document.querySelectorAll('.oficina canvas[data-engine]');
    const c = lienzos[0]?.getBoundingClientRect();
    const sel = document.querySelector('.vista3d-selector');
    return { oficina: vis('#oficina'), lienzos: lienzos.length, lienzo: c ? [Math.round(c.width), Math.round(c.height)] : null, selector: vis('.vista3d-selector') && !sel.disabled,
      sala: vis('#sala-control'), nexus: vis('#nexus'), csi: vis('#csi'), inmersivo: document.documentElement.classList.contains('inmersivo'),
      pisos: vis('#pisos'), plano: !!document.querySelector('.oficina:not(.modo-3d)'), piso: window.__cauce3d?.camara().piso ?? null,
      insignia: document.querySelector('#banda-demo')?.textContent.trim().slice(0, 40) ?? '', modo: document.querySelector('[data-modo3d][aria-pressed="true"]')?.dataset.modo3d ?? null };
  });
  // La cámara responde: la rueda sobre el lienzo cambia el zoom (luego se recentra con 0).
  async function camaraResponde(p) {
    const c = await p.locator('.oficina canvas[data-engine]').boundingBox();
    const z0 = await p.evaluate(() => window.__cauce3d.camara().zoom);
    await p.mouse.move(c.x + c.width / 2, c.y + c.height / 2); await p.mouse.wheel(0, -400); await p.waitForTimeout(700);
    const z1 = await p.evaluate(() => window.__cauce3d.camara().zoom);
    await p.keyboard.press('0'); await p.waitForTimeout(600);
    return Math.abs(z1 - z0) > 0.01;
  }
  const piso = async (p, nombre) => { await p.locator('#pisos .piso', { hasText: nombre }).first().click(); await p.waitForTimeout(2600); };
  const enOficinas = (e, pisoEsperado) => e.oficina && e.lienzos === 1 && e.lienzo && e.lienzo[0] > 300 && e.lienzo[1] > 200 && e.selector && !e.sala && !e.nexus && !e.csi && (!pisoEsperado || e.piso === pisoEsperado);

  // ------------------------------------------------ Secuencia real, sin Inmersivo, dos vueltas
  const p = await abrir();
  const pasos = [
    ['Nexus', async () => { await p.click('#boton-nexus'); await p.waitForTimeout(1500); }, (e) => e.nexus && !e.oficina],
    ['Compago (pestaña, mismo piso)', () => piso(p, 'Compago'), (e) => enOficinas(e, 'compago')],
    ['CSI', async () => { await p.click('#boton-csi'); await p.waitForTimeout(1500); }, (e) => e.csi && !e.oficina],
    ['Ek Chuah (pestaña)', () => piso(p, 'Ek Chuah'), (e) => enOficinas(e, 'ek-chuah')],
    ['Sala de control', async () => { await p.click('#boton-sala'); await p.waitForTimeout(1500); }, (e) => e.sala && !e.oficina],
    ['Compago (pestaña)', () => piso(p, 'Compago'), (e) => enOficinas(e, 'compago')],
    ['Un cuarto', async () => { await p.click('[data-modo3d="individual"]'); await p.waitForTimeout(2500); }, (e) => enOficinas(e, 'compago') && e.modo === 'individual'],
    ['Nexus desde «Un cuarto»', async () => { await p.click('#boton-nexus'); await p.waitForTimeout(1500); }, (e) => e.nexus && !e.oficina],
    ['«‹ Volver a oficinas» de Nexus', async () => { await p.locator('#nexus button', { hasText: 'Volver a oficinas' }).first().click(); await p.waitForTimeout(1500); }, (e) => enOficinas(e, 'compago') && e.modo === 'individual'],
    ['Edificio', async () => { await p.click('[data-modo3d="edificio"]'); await p.waitForTimeout(2500); }, (e) => enOficinas(e, 'compago') && e.modo === 'edificio'],
    ['CSI → «‹ Volver a oficinas»', async () => { await p.click('#boton-csi'); await p.waitForTimeout(1200); await p.locator('#csi button', { hasText: 'Volver a oficinas' }).first().click(); await p.waitForTimeout(1500); }, (e) => enOficinas(e, 'compago')],
    ['Sala → «‹ Volver a oficinas»', async () => { await p.click('#boton-sala'); await p.waitForTimeout(1200); await p.locator('#sala-control button', { hasText: 'Volver a oficinas' }).first().click(); await p.waitForTimeout(1500); }, (e) => enOficinas(e, 'compago')],
    ['Nexus → Plano 2D', async () => { await p.click('#boton-nexus'); await p.waitForTimeout(1200); await p.click('[data-vista="2d"]'); await p.waitForTimeout(1500); }, (e) => e.oficina && e.plano && !e.nexus],
    ['Plano 2D → Edificio 3D', async () => { await p.click('[data-vista="3d"]'); await p.waitForTimeout(5000); }, (e) => enOficinas(e, 'compago')],
  ];
  let m0 = null;
  for (let vuelta = 1; vuelta <= 2; vuelta++) {
    const fallos = [];
    for (const [n, hacer, esperado] of pasos) {
      await hacer();
      const e = await estado(p);
      if (!esperado(e)) fallos.push(`${n}: ${JSON.stringify(e)}`);
    }
    ok(`vuelta ${vuelta}: cada paso muestra lo que corresponde (${pasos.length} pasos; visor 3D con tamaño, controles, un solo lienzo)`, fallos.length === 0, fallos.slice(0, 2).join(' || '));
    ok(`vuelta ${vuelta}: la cámara responde al final`, await camaraResponde(p));
    if (vuelta === 1) m0 = await p.evaluate(() => window.__cauce3d.metricas());
  }
  const m1 = await p.evaluate(() => window.__cauce3d.metricas());
  ok('la 2.ª vuelta no hace crecer geometrías ni texturas', m1.geometrias <= m0.geometrias + 2 && m1.texturas <= m0.texturas, `geometrías ${m0.geometrias}→${m1.geometrias}, texturas ${m0.texturas}→${m1.texturas}`);
  ok('sin recargar la página en todo el recorrido', p.cargas === 0, `${p.cargas} cargas`);
  // Desde una sección, el ascensor no arranca (el piso anterior no estaba a la vista) y no queda nada a medias.
  await p.click('#boton-sala'); await p.waitForTimeout(1200);
  await p.locator('#pisos .piso', { hasText: 'Ek Chuah' }).first().click(); await p.waitForTimeout(150);
  const c1 = await p.evaluate(() => window.__cauce3d.camara());
  await p.waitForTimeout(2500);
  const c2 = await p.evaluate(() => window.__cauce3d.camara());
  ok('desde una sección especial, el piso elegido aparece sin ascensor a medias', c1.ascensor === null && c2.ascensor === null && c2.piso === 'ek-chuah', `${c1.ascensor}/${c2.ascensor} ${c2.piso}`);
  // Entre pisos con el edificio a la vista, el ascensor sigue funcionando.
  await p.locator('#pisos .piso', { hasText: 'Compago' }).first().click(); await p.waitForTimeout(200);
  const c3 = await p.evaluate(() => window.__cauce3d.camara());
  await p.waitForTimeout(2600);
  ok('entre pisos, el ascensor sigue funcionando', c3.ascensor !== null && (await estado(p)).piso === 'compago', String(c3.ascensor));
  // DEMO y REAL no se mezclan: Compago y Ek Chuah siguen en DEMO tras el recorrido.
  const e3 = await estado(p);
  ok('la insignia DEMO sigue en su sitio tras el recorrido', /DEMO|DEMOSTRACIÓN/i.test(e3.insignia), e3.insignia);
  await p.close();

  // ------------------------------------------------ Con Inmersivo (las secciones se abren con S, N, I)
  const q = await abrir();
  await q.click('.boton-inmersivo'); await q.waitForTimeout(1200);
  const fallosI = [];
  for (const [tecla, sel] of [['n', 'nexus'], ['i', 'csi'], ['s', 'sala']]) {
    await q.keyboard.press(tecla); await q.waitForTimeout(1500);
    const a = await estado(q);
    if (!a[sel] || a.inmersivo) fallosI.push(`${tecla} abre: ${JSON.stringify(a)}`);
    await q.keyboard.press('Escape'); await q.waitForTimeout(1500);
    const c = await estado(q);
    if (!enOficinas(c) || !c.inmersivo) fallosI.push(`${tecla} Esc: ${JSON.stringify(c)}`);
  }
  ok('Inmersivo: S, N e I abren su sección y Esc vuelve al edificio en Inmersivo', fallosI.length === 0, fallosI.slice(0, 2).join(' || '));
  await q.keyboard.press('n'); await q.waitForTimeout(1200);
  await q.locator('#nexus button', { hasText: 'Volver a oficinas' }).first().click(); await q.waitForTimeout(1500);
  const r = await estado(q);
  ok('Inmersivo: «‹ Volver a oficinas» de Nexus vuelve al edificio en Inmersivo', enOficinas(r) && r.inmersivo, JSON.stringify(r));
  ok('Inmersivo: la cámara responde', await camaraResponde(q));
  await q.click('#salir-inmersivo'); await q.waitForTimeout(1200);
  await q.click('#boton-csi'); await q.waitForTimeout(1200);
  await piso(q, 'Ek Chuah');
  const s = await estado(q);
  ok('fuera de Inmersivo, CSI → pestaña Ek Chuah vuelve al edificio (sin volver a Inmersivo)', enOficinas(s, 'ek-chuah') && !s.inmersivo, JSON.stringify(s));
  await q.click('.boton-inmersivo'); await q.waitForTimeout(1000);
  const t = await estado(q);
  ok('Inmersivo se puede activar y salir normalmente después', t.inmersivo && enOficinas(t) && (await q.click('#salir-inmersivo'), await q.waitForTimeout(800), !(await estado(q)).inmersivo));
  ok('sin recargar la página con Inmersivo', q.cargas === 0, `${q.cargas} cargas`);
  await q.close();

  await b.close();
  for (const l of res) console.log(l);
  console.log(errs.length ? `errores: ${JSON.stringify(errs.slice(0, 5))}` : 'errores: ninguno');
  process.exit(res.some((l) => l.startsWith('FALLA')) || errs.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
