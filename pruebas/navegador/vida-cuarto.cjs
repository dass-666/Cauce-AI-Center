// «Un cuarto» con vida (2026-11-09), en Chromium (SwiftShader).
// Con servir.py corriendo:  node pruebas/navegador/vida-cuarto.cjs      (PUERTO=8765 por omisión)
//
// Comprueba: en «Un cuarto» (Compago › Evaluación de oportunidades) los personajes de la estación se mueven de forma
// visible con el tiempo (vida en reposo) sin pasar a teclear ni cambiar su estado; con «reducir movimiento» quedan
// quietos; entrar a un cuarto y cambiar de cuarto tiene fundido y un acercamiento breve de cámara, que «Cámara
// instantánea» y «reducir movimiento» quitan; recorrer cuartos y pisos no hace crecer geometrías ni texturas.
// SwiftShader cuenta objetos y comprueba comportamiento; NO mide los cuadros por segundo de la Intel UHD.
const { chromium } = require('playwright');
const BASE = 'http://127.0.0.1:' + (process.env.PUERTO || 8765) + '/';

(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const res = []; const errs = [];
  const ok = (n, c, x = '') => res.push(`${c ? 'OK ' : 'FALLA'} ${n}${x ? ' · ' + x : ''}`);
  async function abrir({ reducido = false, instantanea = false } = {}) {
    const p = await b.newPage({ viewport: { width: 1366, height: 768 }, reducedMotion: reducido ? 'reduce' : 'no-preference' });
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errs.push(m.text()); });
    await p.route('**/datos/proyectos.local.json*', (r) => r.fulfill({ status: 404, body: '' }));
    await p.route('**/datos/reales/*', (r) => r.fulfill({ status: 404, body: '' }));
    await p.addInitScript((i) => { try { localStorage.setItem('cauce.proyecto', 'compago'); localStorage.setItem('cauce.modo3d', 'individual'); localStorage.setItem('cauce.camara3d', i ? 'instantanea' : 'animada'); } catch {} }, instantanea);
    await p.goto(BASE + '?medir=1&hora=11'); await p.waitForTimeout(7000);
    if (await p.locator('#sala-control').isVisible().catch(() => false)) { await p.locator('[data-cerrar-sala]').first().click(); await p.waitForTimeout(1200); }
    await p.selectOption('.vista3d-selector', 'oportunidades'); await p.waitForTimeout(3000);
    await p.evaluate(() => { const m = document.querySelector('.vista3d-medidas'); if (m) m.hidden = true; });
    return p;
  }
  // Píxeles que cambian entre capturas tomadas cada 2 s alrededor de la mesa de la estación.
  async function movimiento(p, n = 6) {
    const pt = await p.evaluate(() => window.__cauce3d.proyectarEstacion('internacional'));
    const clip = { x: Math.max(0, pt.x - 230), y: Math.max(0, pt.y - 60), width: 380, height: 260 };
    const tomas = [];
    for (let i = 0; i < n; i++) { tomas.push((await p.screenshot({ clip })).toString('base64')); await p.waitForTimeout(2000); }
    return p.evaluate(async (lista) => {
      const carga = (b64) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + b64; });
      const datos = async (b64) => { const I = await carga(b64); const k = document.createElement('canvas'); k.width = I.width; k.height = I.height; const g = k.getContext('2d'); g.drawImage(I, 0, 0); return g.getImageData(0, 0, I.width, I.height).data; };
      const d = await Promise.all(lista.map(datos));
      const difs = [];
      for (let i = 1; i < d.length; i++) { let c = 0; for (let j = 0; j < d[0].length; j += 4) if (Math.abs(d[i][j] - d[i - 1][j]) + Math.abs(d[i][j + 1] - d[i - 1][j + 1]) + Math.abs(d[i][j + 2] - d[i - 1][j + 2]) > 30) c++; difs.push(c); }
      return difs;
    }, tomas);
  }
  const puestos = (p) => p.evaluate(() => window.__cauce3d.estaciones()[0].puestos.map((x) => [x.estado, x.bucle]));

  // ------------------------------------------------------------ vida en reposo
  const p = await abrir();
  const antes = await puestos(p);
  const difs = await movimiento(p);
  const despues = await puestos(p);
  ok('«Un cuarto»: los personajes de la estación se mueven a la vista (≥ 4 de 5 intervalos de 2 s con ≥ 150 píxeles distintos)', difs.filter((x) => x >= 150).length >= 4, difs.join(', '));
  ok('la vida en reposo no cambia el estado ni pone a teclear a nadie (sin evidencia de trabajo)', JSON.stringify(antes) === JSON.stringify(despues) && despues.every(([, bucle]) => bucle !== 'teclear'), JSON.stringify(despues));
  const m0 = await p.evaluate(() => window.__cauce3d.metricas());
  ok('«Un cuarto» de la estación: ≤ 30 llamadas de dibujo', m0.llamadas <= 30, `${m0.llamadas} llamadas, ${m0.texturas} texturas`);

  // ------------------------------------------------------------ transición al cambiar de cuarto
  const cam = () => p.evaluate(() => window.__cauce3d.camara());
  const opacidad = () => p.evaluate(() => Number(getComputedStyle(document.querySelector('.oficina canvas[data-engine]')).opacity));
  // La opacidad mínima del lienzo se registra en cada cuadro desde antes del cambio (un muestreo suelto puede caer
  // después del fundido en SwiftShader, donde construir el cuarto tarda).
  await p.evaluate(() => { window.__opMin = 1; const c = document.querySelector('.oficina canvas[data-engine]'); const f = () => { window.__opMin = Math.min(window.__opMin, Number(getComputedStyle(c).opacity)); if (performance.now() < window.__opHasta) requestAnimationFrame(f); }; window.__opHasta = performance.now() + 3000; requestAnimationFrame(f); });
  await p.selectOption('.vista3d-selector', 'margenes');
  await p.waitForTimeout(120);
  const c1 = await cam();
  await p.waitForTimeout(900);
  const o1 = await p.evaluate(() => window.__opMin);
  await p.waitForTimeout(800);
  const c2 = await cam(), o2 = await opacidad();
  ok('cambiar de cuarto: fundido (el lienzo empieza transparente) y acercamiento breve de la cámara', o1 < 0.95 && c1.zoom < 0.99 && c1.ascensor === null, `opacidad ${o1.toFixed(2)}, zoom ${c1.zoom.toFixed(2)}`);
  ok('cambiar de cuarto: termina quieto, encuadrado y opaco', o2 > 0.99 && Math.abs(c2.zoom - 1) < 0.02 && !c2.animando, `opacidad ${o2.toFixed(2)}, zoom ${c2.zoom.toFixed(2)}`);

  // ------------------------------------------------------------ recursos al recorrer cuartos y pisos
  const deps = await p.evaluate(() => [...document.querySelectorAll('.vista3d-selector option')].map((o) => o.value).filter(Boolean));
  for (const d of deps) { await p.selectOption('.vista3d-selector', d); await p.waitForTimeout(900); }
  await p.selectOption('.vista3d-selector', 'oportunidades'); await p.waitForTimeout(1500);
  const r0 = await p.evaluate(() => window.__cauce3d.metricas());
  for (let v = 0; v < 2; v++) {
    for (const d of deps) { await p.selectOption('.vista3d-selector', d); await p.waitForTimeout(700); }
    for (const piso of ['Ek Chuah', 'Montambre', 'Compago']) { await p.locator('#pisos .piso', { hasText: piso }).first().click(); await p.waitForTimeout(2600); }
  }
  await p.selectOption('.vista3d-selector', 'oportunidades'); await p.waitForTimeout(1500);
  const r1 = await p.evaluate(() => window.__cauce3d.metricas());
  ok(`2 vueltas por los ${deps.length} cuartos y 3 pisos (con ascensor): geometrías y texturas sin crecer`, r1.geometrias <= r0.geometrias + 2 && r1.texturas <= r0.texturas, `geometrías ${r0.geometrias}→${r1.geometrias}, texturas ${r0.texturas}→${r1.texturas}`);
  await p.close();

  // ------------------------------------------------------------ «Cámara instantánea»
  const q = await abrir({ instantanea: true });
  await q.selectOption('.vista3d-selector', 'margenes'); await q.waitForTimeout(120);
  const ci = await q.evaluate(() => window.__cauce3d.camara());
  const oi = await q.evaluate(() => Number(getComputedStyle(document.querySelector('.oficina canvas[data-engine]')).opacity));
  ok('«Cámara instantánea»: cambiar de cuarto sin fundido ni acercamiento', oi > 0.99 && Math.abs(ci.zoom - 1) < 0.02 && !ci.animando, `opacidad ${oi.toFixed(2)}, zoom ${ci.zoom.toFixed(2)}`);
  await q.selectOption('.vista3d-selector', 'oportunidades'); await q.waitForTimeout(1500);
  const difsI = await movimiento(q, 4);
  ok('«Cámara instantánea» no quita la vida de los personajes (solo afecta a la cámara)', difsI.filter((x) => x >= 150).length >= 2, difsI.join(', '));
  await q.close();

  // ------------------------------------------------------------ reducir movimiento (sistema)
  const s = await abrir({ reducido: true });
  const difsR = await movimiento(s, 4);
  ok('reducir movimiento: los personajes quedan en postura fija (sin vida en reposo)', difsR.every((x) => x < 60), difsR.join(', '));
  await s.selectOption('.vista3d-selector', 'margenes'); await s.waitForTimeout(120);
  const cr = await s.evaluate(() => window.__cauce3d.camara());
  ok('reducir movimiento: cambiar de cuarto sin acercamiento animado', Math.abs(cr.zoom - 1) < 0.02 && !cr.animando, `zoom ${cr.zoom.toFixed(2)}`);
  await s.close();

  await b.close();
  for (const l of res) console.log(l);
  console.log(errs.length ? `errores: ${JSON.stringify(errs.slice(0, 5))}` : 'errores: ninguno');
  process.exit(res.some((l) => l.startsWith('FALLA')) || errs.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
