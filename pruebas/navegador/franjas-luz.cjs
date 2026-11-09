// Cierre del PR #35 (2026-11-09), en Chromium (SwiftShader).
// Con servir.py corriendo:  node pruebas/navegador/franjas-luz.cjs      (PUERTO=8765 por omisión)
//
// 1) «Luz fija» encendida por defecto y «Brillo» apagado, respetando lo que la persona haya guardado.
// 2) Las franjas de estado (DEMO, conexión, diagnóstico) ya no mueven el edificio al cambiar de proyecto: la parte de
//    arriba del visor queda en el mismo sitio en todos los pisos (escritorio, 1280×720, la ventana de la MSI y celular),
//    la información sigue visible, sin desplazamiento horizontal, y las secciones especiales e Inmersivo no reservan nada.
const { chromium } = require('playwright');
const BASE = 'http://127.0.0.1:' + (process.env.PUERTO || 8765) + '/';

(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const res = []; const errs = [];
  const ok = (n, c, x = '') => res.push(`${c ? 'OK ' : 'FALLA'} ${n}${x ? ' · ' + x : ''}`);
  async function abrir({ w = 1366, h = 768, prefs = {}, query = '' } = {}) {
    const p = await b.newPage({ viewport: { width: w, height: h }, ...(w < 600 ? { isMobile: true, hasTouch: true } : {}) });
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errs.push(m.text()); });
    await p.route('**/datos/proyectos.local.json*', (r) => r.fulfill({ status: 404, body: '' }));
    await p.route('**/datos/reales/*', (r) => r.fulfill({ status: 404, body: '' }));
    await p.addInitScript((pr) => { try { localStorage.setItem('cauce.proyecto', 'compago'); localStorage.setItem('cauce.sala', '0'); for (const [k, v] of Object.entries(pr)) localStorage.setItem(k, v); } catch {} }, prefs);
    await p.goto(BASE + '?medir=1' + query); await p.waitForTimeout(6500);
    return p;
  }

  // ------------------------------------------------ Luz fija y brillo por defecto
  const luz = (p) => p.evaluate(() => ({ fija: document.querySelector('.luz-fija input')?.checked ?? null, brillo: document.querySelector('.vista3d input[type=checkbox]')?.closest('label')?.textContent.includes('Brillo') ? document.querySelector('.vista3d input[type=checkbox]').checked : [...document.querySelectorAll('.vista3d label')].find((l) => /Brillo/.test(l.textContent))?.querySelector('input')?.checked ?? null, guardada: localStorage.getItem('cauce.luz3d') }));
  const l0 = await abrir();
  const a = await luz(l0);
  ok('sin preferencia guardada: «Luz fija» encendida y «Brillo» apagado', a.fija === true && a.brillo === false, JSON.stringify(a));
  await l0.locator('.luz-fija').click(); await l0.waitForTimeout(300);
  ok('desmarcar «Luz fija» se guarda como «hora»', (await luz(l0)).guardada === 'hora');
  await l0.close();
  const l1 = await abrir({ prefs: { 'cauce.luz3d': 'hora' } });
  ok('con «hora» guardada se respeta: «Luz fija» apagada', (await luz(l1)).fija === false);
  await l1.close();
  const l2 = await abrir({ prefs: { 'cauce.luz3d': 'fija', 'cauce.brillo3d': '1' } });
  const c = await luz(l2);
  ok('con «fija» y brillo guardados se respetan', c.fija === true && c.brillo === true, JSON.stringify(c));
  await l2.close();

  // ------------------------------------------------ Franjas: el visor no se mueve al cambiar de proyecto
  for (const [w, h, nombre] of [[1366, 768, 'escritorio'], [1280, 720, '1280×720'], [1224, 636, 'ventana de la MSI'], [390, 844, 'celular']]) {
    const p = await abrir({ w, h, query: '&hora=11' });
    const medir = () => p.evaluate(() => {
      const o = document.querySelector('#oficina').getBoundingClientRect();
      const vis = (s) => { const e = document.querySelector(s); return !!e && !e.hidden && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().height > 0; };
      return { arriba: Math.round(o.top + scrollY), alto: Math.round(o.height), conexion: vis('#conexion'), banda: vis('#banda-demo') ? document.querySelector('#banda-demo').textContent.trim() : '',
        horizontal: document.documentElement.scrollWidth > innerWidth + 1, piso: document.querySelector('#pisos .piso[aria-selected="true"]')?.textContent.trim().slice(0, 14) };
    });
    const ir = async (i) => { await p.evaluate((i) => document.querySelectorAll('#pisos .piso[role="tab"]')[i].click(), i); await p.waitForTimeout(2300); };
    const n = await p.evaluate(() => document.querySelectorAll('#pisos .piso[role="tab"]').length);
    const vistas = [await medir()];
    for (let v = 0; v < 2; v++) for (let i = 0; i < n; i++) { await ir(i); vistas.push(await medir()); }
    // En celular no se reserva de antemano la línea del diagnóstico (le quitaría alto al edificio): puede bajar una
    // vez, la primera vez que un piso la muestra. Desde la 2.ª vuelta, ya no se mueve.
    const tramo = w < 600 ? vistas.slice(n + 1) : vistas;
    const arribas = tramo.map((x) => x.arriba), altos = tramo.map((x) => x.alto);
    const salto = Math.max(...arribas) - Math.min(...arribas);
    ok(`${nombre}: cambiar entre los ${n} pisos ${w < 600 ? '(2.ª vuelta; la 1.ª puede bajar una vez la línea del diagnóstico)' : '(2 vueltas)'} no mueve el visor (≤ 4 px)`, salto <= 4 && Math.max(...altos) - Math.min(...altos) <= 4, `arriba ${Math.min(...arribas)}–${Math.max(...arribas)} px, alto ${Math.min(...altos)}–${Math.max(...altos)} px; 1.ª vuelta ${Math.min(...vistas.map((x) => x.arriba))}–${Math.max(...vistas.map((x) => x.arriba))} px`);
    const demo = vistas.filter((x) => /Compago|Ek Chuah/.test(x.piso ?? ''));
    ok(`${nombre}: la información sigue a la vista (conexión en todos; franja DEMO en Compago y Ek Chuah) y sin desplazamiento horizontal`,
      vistas.every((x) => x.conexion && !x.horizontal) && demo.length > 0 && demo.every((x) => /DEMOSTRACI/.test(x.banda)), JSON.stringify(vistas.find((x) => !x.conexion || x.horizontal) ?? demo.find((x) => !/DEMOSTRACI/.test(x.banda)) ?? ''));
    if (w > 600) {
      await ir(0);
      const antes = await medir();
      await p.click('#boton-nexus'); await p.waitForTimeout(1200);
      const reservaNexus = await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--reserva-franjas').trim());
      const nexusArriba = await p.evaluate(() => Math.round(document.querySelector('#nexus').getBoundingClientRect().top));
      await ir(0);
      const despues = await medir();
      ok(`${nombre}: Nexus no reserva hueco arriba y al volver el visor queda donde estaba`, reservaNexus === '0px' && Math.abs(despues.arriba - antes.arriba) <= 2, `reserva ${reservaNexus}, Nexus a ${nexusArriba} px, visor ${antes.arriba}→${despues.arriba}`);
      await p.click('.boton-inmersivo'); await p.waitForTimeout(1000);
      const inm = await p.evaluate(() => ({ reserva: getComputedStyle(document.documentElement).getPropertyValue('--reserva-franjas').trim(), arriba: Math.round(document.querySelector('#oficina').getBoundingClientRect().top) }));
      ok(`${nombre}: en Inmersivo no hay reserva y el edificio ocupa desde arriba`, inm.reserva === '0px' && inm.arriba === 0, JSON.stringify(inm));
      await p.click('#salir-inmersivo'); await p.waitForTimeout(1000);
      ok(`${nombre}: al salir de Inmersivo el visor vuelve a su sitio`, Math.abs((await medir()).arriba - antes.arriba) <= 2);
    }
    await p.close();
  }

  await b.close();
  for (const l of res) console.log(l);
  console.log(errs.length ? `errores: ${JSON.stringify(errs.slice(0, 5))}` : 'errores: ninguno');
  process.exit(res.some((l) => l.startsWith('FALLA')) || errs.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
