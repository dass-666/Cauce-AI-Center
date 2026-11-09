// Versión candidata (PR #34): lo que se añadió al cerrar las estaciones, en Chromium (SwiftShader).
// Con servir.py corriendo:  node pruebas/navegador/candidata.cjs      (PUERTO=8765 por omisión)
//
// Comprueba: panel plegable (gana ancho la oficina, se recuerda, se vuelve a abrir); «Demostración vigente» en lugar
// de «En línea» con un piso DEMO; la fusión de geometría entre cuartos baja llamadas sin cambiar lo que se ve
// (comparando con ?fusion=0); la medición automática (?auto=N) descarga su informe con percentiles; los tres
// personajes de cada estación usan modelos distintos; idas y vueltas entre los pisos sin crecer recursos.
// SwiftShader cuenta objetos; NO mide los cuadros por segundo de la Intel UHD.
const { chromium } = require('playwright');
const BASE = 'http://127.0.0.1:' + (process.env.PUERTO || 8765) + '/';

(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const res = []; const errs = [];
  const ok = (n, c, x = '') => res.push(`${c ? 'OK ' : 'FALLA'} ${n}${x ? ' · ' + x : ''}`);
  const vigilar = (p) => { p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errs.push(m.text()); }); };
  const met = (p) => p.evaluate(() => window.__cauce3d.metricas());
  const cerrarSala = async (p) => { if (await p.locator('#sala-control').isVisible().catch(() => false)) { await p.locator('[data-cerrar-sala]').first().click(); await p.waitForTimeout(1200); } };
  async function abrir({ proyecto, query = '', ctx = null, plegado = null }) {
    const p = await (ctx ?? b).newPage({ viewport: { width: 1366, height: 768 }, ...(ctx ? {} : { acceptDownloads: true }) });
    vigilar(p);
    await p.route('**/datos/proyectos.local.json*', (r) => r.fulfill({ status: 404, body: '' }));
    await p.route('**/datos/reales/*', (r) => r.fulfill({ status: 404, body: '' }));
    await p.addInitScript((a) => { try { localStorage.setItem('cauce.proyecto', a.proyecto); localStorage.setItem('cauce.modo3d', 'edificio'); if (a.plegado !== null) localStorage.setItem('cauce.panelPlegado', a.plegado); } catch {} }, { proyecto, plegado });
    await p.goto(BASE + '?medir=1&hora=11' + query); await p.waitForTimeout(8000);
    await cerrarSala(p);
    return p;
  }

  // ---------------------------------------------------------------- Panel plegable + «Demostración vigente»
  const p = await abrir({ proyecto: 'compago', plegado: '0' });
  const barra = await p.locator('body').innerText();
  ok('piso DEMO: dice «Demostración vigente», no «En línea»', /Demostración vigente/.test(barra) && !/\bEn línea\b/.test(barra), barra.match(/Demostración vigente|En línea/g)?.join(','));
  const pt = await p.evaluate(() => window.__cauce3d.proyectarEstacion('internacional'));
  await p.mouse.click(pt.x, pt.y); await p.waitForTimeout(2500);
  const ancho = () => p.evaluate(() => Math.round(document.querySelector('.oficina').getBoundingClientRect().width));
  const a0 = await ancho();
  const panelVisible = await p.locator('#panel').isVisible();
  ok('el detalle se abre con el botón para plegarlo', panelVisible && await p.locator('.panel-plegar').isVisible());
  await p.locator('.panel-plegar').click(); await p.waitForTimeout(900);
  const a1 = await ancho();
  const guardado = await p.evaluate(() => localStorage.getItem('cauce.panelPlegado'));
  ok('plegar el panel da más ancho a la oficina y se recuerda', a1 > a0 + 200 && guardado === '1', `${a0} → ${a1} px, guardado ${guardado}`);
  const lienzo = await p.evaluate(() => { const c = document.querySelector('.oficina canvas[data-engine]'); return c ? Math.round(c.getBoundingClientRect().width) : 0; });
  ok('el lienzo 3D sigue al nuevo ancho', Math.abs(lienzo - a1) < 40, `lienzo ${lienzo} px, oficina ${a1} px`);
  await p.locator('.panel-plegar').click(); await p.waitForTimeout(900);
  const a2 = await ancho();
  ok('«◂ Detalle» lo vuelve a abrir', Math.abs(a2 - a0) < 4 && await p.evaluate(() => !document.body.classList.contains('panel-plegado')), `${a2} px`);
  const alto = await p.evaluate(() => { const o = document.querySelector('.oficina').getBoundingClientRect(); return { alto: Math.round(o.height), fondo: Math.round(o.bottom), vista: innerHeight }; });
  ok('la oficina 3D no es más baja que antes (alto de la ventana − 210 px) y usa el alto libre si lo hay (1366×768)', alto.alto >= Math.max(360, alto.vista - 210) - 1, JSON.stringify(alto));
  await p.close();

  // ---------------------------------------------------------------- Fusión entre cuartos: menos llamadas, misma imagen
  const foto = async (q) => { await q.evaluate(() => { const m = document.querySelector('.vista3d-medidas'); if (m) m.hidden = true; }); await q.waitForTimeout(400); return q.locator('.oficina canvas[data-engine]').screenshot(); };
  for (const proyecto of ['compago', 'montambre']) {
    const con = await abrir({ proyecto, query: '&estaciones=1' });
    const sin = await abrir({ proyecto, query: '&fusion=0' });
    const mc = await met(con), ms = await met(sin);
    ok(`${proyecto}: la fusión entre cuartos baja llamadas (≥ 8) sin subir triángulos`, ms.llamadas - mc.llamadas >= 8 && mc.triangulos <= ms.triangulos + 4, `${ms.llamadas} → ${mc.llamadas} llamadas, triángulos ${ms.triangulos} → ${mc.triangulos}`);
    const [ic, is] = [await foto(con), await foto(sin)];
    const dif = await con.evaluate(async ([x, y]) => {
      const carga = (b64) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + b64; });
      const [A, B] = await Promise.all([carga(x), carga(y)]);
      const c = (I) => { const k = document.createElement('canvas'); k.width = I.width; k.height = I.height; const g = k.getContext('2d'); g.drawImage(I, 0, 0); return g.getImageData(0, 0, I.width, I.height).data; };
      const a = c(A), d = c(B); let n = 0;
      for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - d[i]) + Math.abs(a[i + 1] - d[i + 1]) + Math.abs(a[i + 2] - d[i + 2]) > 24) n++;
      return { n, total: a.length / 4 };
    }, [ic.toString('base64'), is.toString('base64')]);
    ok(`${proyecto}: con y sin fusión se ve igual (≤ 0.2 % de píxeles distintos, por animación)`, dif.n / dif.total <= 0.002, `${dif.n} de ${dif.total} píxeles`);
    await con.close(); await sin.close();
  }

  // ---------------------------------------------------------------- Personajes de estación distintos
  const e = await abrir({ proyecto: 'compago' });
  const cuerpos = await e.evaluate(() => window.__cauce3d.estaciones().flatMap((x) => x.puestos.map((y) => y.cuerpo ?? null)));
  ok('Compago: los tres personajes de la estación usan modelos distintos', cuerpos.length === 3 && new Set(cuerpos).size === 3 && cuerpos.every(Boolean), JSON.stringify(cuerpos));

  // ---------------------------------------------------------------- Idas y vueltas entre todos los pisos con medición
  const pisos = await e.evaluate(() => [...document.querySelectorAll('#pisos .piso')].map((x) => x.textContent.trim()).filter(Boolean));
  const ir = async (n) => { await e.locator('#pisos .piso', { hasText: n }).first().click(); await e.waitForTimeout(2200); };
  for (const n of pisos) await ir(n);
  await ir('Compago');
  const m0 = await met(e);
  for (let v = 0; v < 2; v++) for (const n of pisos) await ir(n);
  await ir('Compago');
  const m1 = await met(e);
  ok(`2 vueltas más por los ${pisos.length} pisos: geometrías y texturas sin crecer`, m1.geometrias <= m0.geometrias + 2 && m1.texturas <= m0.texturas, `geometrías ${m0.geometrias}→${m1.geometrias}, texturas ${m0.texturas}→${m1.texturas}`);
  await e.close();

  // ---------------------------------------------------------------- Medición automática (?auto)
  const ctx = await b.newContext({ acceptDownloads: true });
  const a = await ctx.newPage({ viewport: { width: 1366, height: 768 } });
  vigilar(a);
  await a.route('**/datos/proyectos.local.json*', (r) => r.fulfill({ status: 404, body: '' }));
  await a.route('**/datos/reales/*', (r) => r.fulfill({ status: 404, body: '' }));
  const descarga = a.waitForEvent('download', { timeout: 120_000 }).catch(() => null);
  await a.goto(BASE + '?medir=1&auto=10&caso=prueba&proyecto=compago&modo3d=edificio');
  const d = await descarga;
  const sala = await a.locator('#sala-control').isVisible().catch(() => false);
  let inf = null;
  if (d) { const ruta = await d.path(); inf = JSON.parse(require('fs').readFileSync(ruta, 'utf8')); }
  ok('?auto=10 mide solo (sin pasar por la sala) y descarga su informe', !!d && !sala && /cauce-medicion-prueba-compago\.json/.test(d?.suggestedFilename() ?? ''), d?.suggestedFilename());
  const r = inf?.resumen ?? inf?.medicion ?? inf ?? {};
  const claves = ['fps_promedio', 'cuadro_p95_ms', 'cuadro_p99_ms', 'cps_1pct_bajo'];
  const plano = JSON.stringify(inf ?? {});
  ok('el informe trae GPU, cps promedio, percentiles y recursos', claves.every((k) => plano.includes(`"${k}"`)) && /"llamadas"/.test(plano) && /"texturas"/.test(plano) && /gpu|renderer/i.test(plano), Object.keys(r).slice(0, 12).join(','));
  await ctx.close();
  // Sin --recibir-mediciones el servidor no acepta escrituras (solo herramientas\\medir-msi.ps1 lo arranca con esa opción).
  const post = await fetch(BASE + '__medicion/prueba.json', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then((r) => r.status).catch(() => 0);
  ok('servir.py sin --recibir-mediciones rechaza escribir informes', post === 404 || post === 501, `HTTP ${post}`);

  await b.close();
  for (const l of res) console.log(l);
  console.log(errs.length ? `errores: ${JSON.stringify(errs.slice(0, 5))}` : 'errores: ninguno');
  process.exit(res.some((l) => l.startsWith('FALLA')) || errs.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
