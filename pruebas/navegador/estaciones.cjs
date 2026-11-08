// Estaciones de trabajo dentro de las oficinas existentes, en Chromium (SwiftShader).
// Con servir.py corriendo:  node pruebas/navegador/estaciones.cjs      (SAL=carpeta para capturas, opcional)
//
// Comprueba: que el Observatorio aparece dentro de «Análisis de riesgo» (Ek Chuah) y Oportunidades Internacionales
// dentro de «Evaluación de oportunidades» (Compago) sin pisos ni departamentos nuevos; posturas honestas (nadie
// teclea con la demo); selección de la estación y de cada puesto con su panel; «Un cuarto»; plano 2D; piso REAL
// sin archivo de estaciones = sillas vacías (nunca cae a la demo); enlace confirmado solo con las dos partes;
// presupuesto de llamadas de dibujo con y sin estaciones (?estaciones=0); memoria estable al cambiar de piso.
// SwiftShader cuenta objetos y comprueba comportamiento; NO mide el rendimiento de la Intel UHD.
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = 'http://127.0.0.1:' + (process.env.PUERTO || 8765) + '/';
const SAL = process.env.SAL || null;
if (SAL) fs.mkdirSync(SAL, { recursive: true });
const ISO = /"(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z)"/g;
const iso = (ms) => new Date(ms).toISOString().replace(/\.\d+Z$/, 'Z');
const plantilla = fs.readFileSync('contrato/ejemplos/compago-exportador.json', 'utf8');
function compagoReal(base) {
  const gen = Date.parse(JSON.parse(plantilla).generado_en);
  return plantilla.replace(ISO, (_, t) => `"${iso(Date.parse(t) + base - gen)}"`);
}

(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const res = []; const errs = [];
  const ok = (n, c, x = '') => res.push(`${c ? 'OK ' : 'FALLA'} ${n}${x ? ' · ' + x : ''}`);
  const vigilar = (p) => { p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errs.push(m.text()); }); };
  const met = (p) => p.evaluate(() => window.__cauce3d.metricas());
  const est = (p) => p.evaluate(() => window.__cauce3d.estaciones());
  const foto = async (p, n) => { if (SAL) { await p.evaluate(() => { const m = document.querySelector('.vista3d-medidas'); if (m) m.hidden = true; }); await p.screenshot({ path: `${SAL}/${n}.png` }); } };
  const piso = async (p, nombre) => { await p.locator('#pisos .piso', { hasText: nombre }).first().click(); await p.waitForTimeout(3500); };
  const cerrarSala = async (p) => { if (await p.locator('#sala-control').isVisible().catch(() => false)) { await p.locator('[data-cerrar-sala]').first().click(); await p.waitForTimeout(1200); } };
  async function abrir({ proyecto, modo = 'edificio', query = '', reales = null }) {
    const p = await b.newPage({ viewport: { width: 1366, height: 768 } });
    vigilar(p);
    await p.route('**/datos/proyectos.local.json*', (r) => r.fulfill({ status: 404, body: '' }));
    await p.route('**/datos/reales/*', (r) => {
      const archivo = r.request().url().split('/').pop().split('?')[0];
      if (reales && reales[archivo]) return r.fulfill({ status: 200, contentType: 'application/json', body: reales[archivo]() });
      return r.fulfill({ status: 404, body: '' });
    });
    await p.addInitScript((a) => { try { localStorage.setItem('cauce.proyecto', a.proyecto); localStorage.setItem('cauce.modo3d', a.modo); } catch {} }, { proyecto, modo });
    await p.goto(BASE + '?medir=1&hora=11' + query); await p.waitForTimeout(8000);
    await cerrarSala(p);
    return p;
  }

  // ------------------------------------------------------------ Ek Chuah DEMO
  const p = await abrir({ proyecto: 'ek-chuah' });
  const e = await est(p);
  const obs = e.find((x) => x.id === 'observatorio');
  ok('Ek Chuah: el Observatorio está dentro de «Análisis de riesgo» (ningún departamento nuevo)', obs && obs.departamento === 'riesgo' && e.length === 1, JSON.stringify(e.map((x) => [x.id, x.departamento])));
  const deps = await p.evaluate(() => [...document.querySelectorAll('.vista3d-selector option')].filter((o) => o.value).length);
  ok('Ek Chuah: siguen 6 departamentos en el selector', deps === 6, `${deps}`);
  ok('Ek Chuah DEMO: macro espera, geopolítico consulta (señal recibida), riesgos pide atención; nadie teclea',
    obs && JSON.stringify(obs.puestos.map((x) => [x.estado, x.bucle, x.visible])) === JSON.stringify([['sin_actividad', 'reposo', true], ['senal_recibida', 'consultar', true], ['riesgo_detectado', 'atencion', true]]),
    JSON.stringify(obs?.puestos.map((x) => [x.estado, x.bucle])));
  ok('Ek Chuah DEMO: enlace con Compago confirmado (las dos demos registran SEN-DEMO-ARANCEL-01)', obs?.enlace === 'confirmado' && obs?.es_demo === true, `${obs?.enlace}`);
  const per = await p.evaluate(() => window.__cauce3d.personajes().map((x) => x.id));
  ok('los personajes de la estación no se cuentan como agentes del contrato v1', per.every((id) => !id.startsWith('estacion:')), per.join(','));
  const e0 = await met(p);
  ok('Ek Chuah con estación: ≤ 90 llamadas (presupuesto de fase M)', e0.llamadas <= 90, `${e0.llamadas} llamadas, ${e0.triangulos} triángulos, ${e0.texturas} texturas`);
  await foto(p, 'ek-chuah-edificio');

  // Tocar la estación: panel con su función, DEMO y la advertencia de qué son los personajes.
  const pt = await p.evaluate(() => window.__cauce3d.proyectarEstacion('observatorio'));
  await p.mouse.click(pt.x, pt.y); await p.waitForTimeout(2500);
  const panel = await p.locator('#panel').innerText();
  ok('tocar el tablero abre el detalle de la estación', /Estación de trabajo/i.test(panel) && /Observatorio Geopolítico/.test(panel), panel.slice(0, 80).replace(/\n/g, ' '));
  ok('el detalle dice DEMO, que los personajes son funciones (no agentes de IA) y los datos que faltan', /DEMO/.test(panel) && /no un agente de IA/i.test(panel) && /Datos que faltan/i.test(panel) && /magnitud del cambio/i.test(panel), panel.match(/Datos que faltan[\s\S]{0,60}/i)?.[0]?.replace(/\n/g, ' '));
  ok('el detalle muestra el origen (PR #4) y dice que la transferencia es de DEMOSTRACIÓN, no una comunicación real', /PR #4/.test(panel) && /Transferencia de DEMOSTRACIÓN/.test(panel) && /No es una comunicación real/.test(panel) && !/confirmada por las dos partes/.test(panel));
  const cam = await p.evaluate(() => window.__cauce3d.camara());
  ok('la cámara se acerca y enfoca «Análisis de riesgo»', cam.enfocado === 'riesgo' && cam.zoom > 1.3, `zoom ${cam.zoom.toFixed(2)}, enfocado ${cam.enfocado}`);
  await p.waitForTimeout(800);
  await foto(p, 'ek-chuah-estacion');
  // Elegir un puesto desde el panel.
  await p.locator('#panel .enlace-estacion', { hasText: 'Analista de riesgos' }).click(); await p.waitForTimeout(800);
  ok('elegir un puesto desde el panel lo marca', (await p.locator('#panel .puesto-elegido').innerText()).includes('Analista de riesgos'));
  // Tocar a un personaje de la estación selecciona su puesto.
  await p.locator('.panel-cerrar').click(); await p.waitForTimeout(600);
  const pg = await p.evaluate(() => window.__cauce3d.proyectarEstacion('observatorio', 'geopolitico'));
  await p.mouse.click(pg.x, pg.y); await p.waitForTimeout(1500);
  const panel2 = await p.locator('#panel').innerText().catch(() => '');
  ok('tocar a un personaje de la estación abre la estación con su puesto marcado', /Observatorio/.test(panel2) && /Analista geopolítico/.test(await p.locator('#panel .puesto-elegido').innerText().catch(() => '')));

  // «Un cuarto» con el departamento anfitrión.
  await p.locator('[data-modo3d="individual"]').click(); await p.waitForTimeout(1500);
  await p.locator('.vista3d-selector').selectOption('riesgo'); await p.waitForTimeout(2500);
  const uno = await met(p), eUno = await est(p);
  ok('«Un cuarto» (Análisis de riesgo): la estación también está, ≤ 30 llamadas', uno.modo === 'individual' && eUno.length === 1 && uno.llamadas <= 30, `${uno.llamadas} llamadas, ${eUno.length} estación`);
  await foto(p, 'ek-chuah-un-cuarto');
  await p.locator('.vista3d-selector').selectOption('datos'); await p.waitForTimeout(2000);
  ok('«Un cuarto» de otro departamento: sin estación', (await est(p)).length === 0);
  await p.locator('[data-modo3d="edificio"]').click(); await p.waitForTimeout(2000);

  // Plano 2D: botón de la estación dentro del cuarto anfitrión.
  await p.locator('[data-vista="2d"]').click(); await p.waitForTimeout(1200);
  const b2d = p.locator('.estacion-2d');
  ok('plano 2D: un botón de estación, dentro de «Análisis de riesgo»', (await b2d.count()) === 1 && /Análisis de riesgo/.test(await b2d.first().evaluate((n) => n.closest('.cuarto').getAttribute('aria-label'))));
  await b2d.first().click(); await p.waitForTimeout(600);
  ok('plano 2D: tocarlo abre el mismo detalle', /Observatorio Geopolítico/.test(await p.locator('#panel').innerText()));
  await foto(p, 'ek-chuah-plano');
  await p.locator('[data-vista="3d"]').click(); await p.waitForTimeout(2500);

  // ------------------------------------------------------------ Compago DEMO
  await piso(p, 'Compago');
  const c = (await est(p)).find((x) => x.id === 'internacional');
  ok('Compago: Oportunidades Internacionales dentro de «Evaluación de oportunidades»', c?.departamento === 'oportunidades', JSON.stringify(c?.departamento));
  ok('Compago DEMO: investigador consulta, importación pide atención (datos insuficientes), evaluador espera; nadie teclea',
    JSON.stringify(c?.puestos.map((x) => [x.estado, x.bucle])) === JSON.stringify([['investigacion_pendiente', 'consultar'], ['datos_insuficientes', 'atencion'], ['sin_actividad', 'reposo']]),
    JSON.stringify(c?.puestos.map((x) => [x.estado, x.bucle])));
  const c0 = await met(p);
  ok('Compago con estación: ≤ 110 llamadas (presupuesto de fase M)', c0.llamadas <= 110, `${c0.llamadas} llamadas, ${c0.triangulos} triángulos, ${c0.texturas} texturas`);
  await foto(p, 'compago-edificio');
  const pc = await p.evaluate(() => window.__cauce3d.proyectarEstacion('internacional'));
  await p.mouse.click(pc.x, pc.y); await p.waitForTimeout(2500);
  const panelC = await p.locator('#panel').innerText();
  ok('Compago: el detalle no presenta rentabilidad ni importes y dice qué falta', /Datos insuficientes/.test(panelC) && /cotización confirmada/.test(panelC) && !/\$\s?\d|rentable(?! ni)/i.test(panelC.replace(/no calcula rentabilidad/i, '')), panelC.match(/Datos que faltan[\s\S]{0,120}/)?.[0]?.replace(/\n/g, ' '));
  await p.waitForTimeout(800);
  await foto(p, 'compago-estacion');

  // Memoria: idas y vueltas sin crecer.
  await p.locator('.panel-cerrar').click().catch(() => {});
  const antes = await met(p);
  for (let i = 0; i < 4; i++) { await piso(p, 'Ek Chuah'); await piso(p, 'Compago'); }
  const despues = await met(p);
  ok('4 idas y vueltas Compago ↔ Ek Chuah con estaciones: geometrías y texturas sin crecer', despues.geometrias <= antes.geometrias + 2 && despues.texturas <= antes.texturas, `geometrías ${antes.geometrias}→${despues.geometrias}, texturas ${antes.texturas}→${despues.texturas}`);
  await p.close();

  // ------------------------------------------------------------ A/B: ?estaciones=0
  const q = await abrir({ proyecto: 'compago', query: '&estaciones=0' });
  const sin = await met(q), eSin = await est(q);
  ok('?estaciones=0: sin estaciones (para medir A/B en la MSI)', eSin.length === 0, `${sin.llamadas} llamadas sin estación vs ${c0.llamadas} con estación (+${c0.llamadas - sin.llamadas})`);
  const q2 = await abrir({ proyecto: 'compago' });
  const con = await met(q2);
  await q2.close();
  ok('Compago (recién abierto): la estación agrega ≤ 3 texturas de imagen (tablero + 2 pieles de los modelos que distinguen a los personajes; iconos dentro del atlas de burbujas), ≤ 1 de huesos por personaje, y el total queda en ≤ 32', con.texturas_imagen - sin.texturas_imagen <= 3 && con.texturas_huesos - sin.texturas_huesos <= 3 && con.texturas <= 32, `imagen ${sin.texturas_imagen} → ${con.texturas_imagen}, huesos ${sin.texturas_huesos} → ${con.texturas_huesos}, total ${sin.texturas} → ${con.texturas}`);
  await q.close();

  // ------------------------------------------------------------ Compago REAL sin archivo de estaciones
  const r = await abrir({ proyecto: 'compago', reales: { 'compago.json': () => compagoReal(Date.now() - 60_000) } });
  const eReal = (await est(r)).find((x) => x.id === 'internacional');
  ok('Compago REAL sin archivo de estaciones: sillas vacías («Sin información»); no cae a la demostración',
    eReal && eReal.es_demo === false && eReal.puestos.every((x) => x.estado === 'sin_informacion' && !x.visible), JSON.stringify(eReal?.puestos.map((x) => [x.estado, x.visible])));
  ok('Compago REAL: el enlace no se da por confirmado sin datos', eReal?.enlace === 'sin_dato', `${eReal?.enlace}`);
  const pr = await r.evaluate(() => window.__cauce3d.proyectarEstacion('internacional'));
  await r.mouse.click(pr.x, pr.y); await r.waitForTimeout(2000);
  const panelR = await r.locator('#panel').innerText();
  ok('Compago REAL: el detalle explica que falta el exportador de la estación', /SIN DATOS/.test(panelR) && /falta su exportador/.test(panelR), panelR.match(/Por qué no hay datos[\s\S]{0,100}/)?.[0]?.replace(/\n/g, ' '));
  await foto(r, 'compago-real-sin-estaciones');
  await r.close();

  // ------------------------------------------------------------ Compago REAL con archivo REAL vigente
  const demoCo = JSON.parse(fs.readFileSync('datos/demo/compago-estaciones.json', 'utf8'));
  const realCo = () => { const d = JSON.parse(JSON.stringify(demoCo)); d.es_demo = false; delete d.demo; d.fuente = { tipo: 'adaptador', nombre: 'exportador de prueba' }; d.generado_en = iso(Date.now() - 30_000);
    d.estaciones[0].puestos[0] = { id: 'investigador', estado: 'en_proceso', inicio: iso(Date.now() - 120_000), evidencia: { origen: 'prueba', referencia: 'corrida 1' } }; return JSON.stringify(d); };
  const s = await abrir({ proyecto: 'compago', reales: { 'compago.json': () => compagoReal(Date.now() - 60_000), 'compago-estaciones.json': realCo } });
  const eR = (await est(s)).find((x) => x.id === 'internacional');
  ok('Compago REAL con archivo vigente: «en proceso» con evidencia teclea; el enlace sin Ek Chuah REAL queda sin confirmar',
    eR?.es_demo === false && eR.puestos[0].estado === 'en_proceso' && eR.puestos[0].bucle === 'teclear' && eR.enlace === 'sin_confirmar', JSON.stringify([eR?.puestos[0], eR?.enlace]));
  await s.close();

  for (const l of res) console.log(l);
  console.log(`errores: ${errs.length ? JSON.stringify(errs) : 'ninguno'}`);
  await b.close();
  process.exit(res.some((l) => l.startsWith('FALLA')) || errs.length ? 1 : 0);
})();
