// Fase I: estado de cada piso en el selector, Montambre preparado (solo estructura, sin personajes),
// insignia de la escena sin datos, recuperación tras perder el contexto WebGL y celular.
// Con servir.py corriendo: node pruebas/navegador/fase-i.cjs [carpeta-capturas]   (SwiftShader: no mide la Intel UHD)
const { chromium, devices } = require('playwright');
const fs = require('fs');
const SAL = process.argv[2];
const URL = 'http://127.0.0.1:' + (process.env.PUERTO || 8765) + '/?medir=1';
const D = 'contrato/ejemplos/ek-chuah-pr2';
const ISO = /"(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z)"/g;
const iso = (ms) => new Date(ms).toISOString().replace(/\.\d+Z$/, 'Z');
function alDia(nombre, base) {
  const texto = fs.readFileSync(`${D}/${nombre}.json`, 'utf8');
  const gen = Date.parse(JSON.parse(texto).generado_en);
  return texto.replace(ISO, (_, t) => `"${iso(Date.parse(t) + base - gen)}"`);
}

(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const res = []; const errs = [];
  const ok = (n, c, x = '') => res.push(`${c ? 'OK ' : 'FALLA'} ${n}${x ? ' · ' + x : ''}`);
  let ek = null; // cuerpo de datos/reales/ek-chuah.json (null = no existe)
  const preparar = async (p) => {
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errs.push(m.text()); });
    await p.route('**/datos/reales/ek-chuah.json*', (r) => (ek === null ? r.fulfill({ status: 404, body: '' }) : r.fulfill({ status: 200, contentType: 'application/json', body: ek })));
    await p.route('**/datos/reales/compago.json*', (r) => r.fulfill({ status: 404, body: '' }));
    await p.route('**/datos/proyectos.local.json*', (r) => r.fulfill({ status: 404, body: '' }));
  };
  const insignia = (p, nombre) => p.locator('#pisos .piso', { hasText: nombre }).first().locator('.piso-estado').innerText().catch(() => '');
  const insignias = async (p) => Object.fromEntries(await Promise.all(['Compago', 'Ek Chuah', 'Tezcatlipoca', 'Montambre'].map(async (n) => [n, (await insignia(p, n)).trim()])));
  const piso = async (p, nombre, ms = 4500) => { await p.locator('#pisos .piso', { hasText: nombre }).first().click(); await p.waitForTimeout(ms); };
  const pers = (p) => p.evaluate(() => (window.__cauce3d ? window.__cauce3d.personajes() : []));
  const actualizar = async (p) => { await p.locator('#recargar').click(); await p.waitForTimeout(1500); };

  const p = await b.newPage({ viewport: { width: 1366, height: 768 } });
  await preparar(p);
  await p.goto(URL); await p.waitForTimeout(5000);

  // 1. Selector: cada piso dice qué tiene, sin abrirlo.
  let s = await insignias(p);
  ok('selector: Compago DEMO, Ek Chuah DEMO, Tezcatlipoca y Montambre «Sin conexión»',
    s.Compago === 'DEMO' && s['Ek Chuah'] === 'DEMO' && s.Tezcatlipoca === 'Sin conexión' && s.Montambre === 'Sin conexión', JSON.stringify(s));

  // 2. Ek Chuah REAL aparece en el selector mientras se ve Compago (y Compago no cambia).
  ek = alDia('real-dia-normal', Date.now() - 5000);
  await actualizar(p);
  s = await insignias(p);
  ok('selector: Ek Chuah pasa a REAL mientras se ve Compago; Compago sigue DEMO', s['Ek Chuah'] === 'REAL' && s.Compago === 'DEMO', JSON.stringify(s));
  ok('leer otros pisos no mueve a nadie en Compago', (await pers(p)).every((x) => [x.accion, ...x.cola].every((a) => a !== 'celebrar')));
  ek = alDia('real-dia-normal', Date.now() - 27 * 3600_000);
  await actualizar(p);
  ok('selector: Ek Chuah vencido (27 h) se ve «Vencido»', (await insignia(p, 'Ek Chuah')).trim() === 'Vencido');
  ek = '{ esto no es json';
  await actualizar(p);
  ok('selector: Ek Chuah con archivo dañado se ve «Error» (no se tapa con la DEMO)', (await insignia(p, 'Ek Chuah')).trim() === 'Error');
  ek = null;

  // 3. Tezcatlipoca: sin archivo, la escena no dice REAL.
  await piso(p, 'Tezcatlipoca');
  const fuente = await p.locator('.vista3d-fuente').innerText();
  ok('Tezcatlipoca: la insignia de la escena dice «SIN DATOS», no REAL', /SIN DATOS/.test(fuente) && !/REAL/.test(await p.locator('#conexion').innerText()), fuente);

  // 4. Montambre: 4 cuartos conocidos por inventario, sin personajes ni cifras.
  await piso(p, 'Montambre', 6000);
  const etiquetas = await p.locator('.etiqueta-dep').allInnerTexts();
  const ps = await pers(p);
  const con = await p.locator('#conexion').innerText();
  ok('Montambre: 4 departamentos del inventario dibujados', etiquetas.length === 4 && ['Búsqueda y mapa', 'Registro de negocios', 'Moderación de altas', 'Prueba de cobertura'].every((n) => etiquetas.some((t) => t.includes(n))), etiquetas.join(' | '));
  ok('Montambre: cero personajes', ps.length === 0, `${ps.length} figuras`);
  ok('Montambre: «Sin conexión», sin insignia REAL/DEMO, sin franja DEMO y con la nota de inventario', /Sin conexión/.test(con) && !/\bREAL\b|\bDEMO\b/.test(con.split('\n')[0]) && await p.locator('#banda-demo').isHidden() && /inventario/.test(con), con.split('\n')[0]);
  ok('Montambre: no aparece «El archivo tiene error» (no hay archivo, no un archivo con errores)', await p.locator('#diagnostico').isHidden());
  ok('Montambre: el aviso de la escena dice que solo se conoce la estructura', /solo se conocen sus departamentos/.test(await p.locator('.vista3d-aviso').innerText()));
  await p.locator('.etiqueta-dep', { hasText: 'Moderación' }).click(); await p.waitForTimeout(1200);
  const panel = await p.locator('#panel').innerText();
  ok('Montambre: el detalle de Moderación dice que es decisión humana y no tiene personajes', /Decisión humana/.test(panel) && /Ninguno/.test(panel), panel.replace(/\n/g, ' ').slice(0, 120));
  if (SAL) await p.screenshot({ path: `${SAL}/montambre-estructura.png` });
  await p.keyboard.press('Escape'); await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  await p.locator('[data-vista="2d"]').click(); await p.waitForTimeout(800);
  ok('Montambre en el plano 2D: 4 cuartos «Sin personajes»', (await p.locator('#oficina .cuarto').count()) === 4 && (await p.locator('#oficina .puestos-vacio').count()) === 4);
  await p.locator('[data-vista="3d"]').click(); await p.waitForTimeout(2500);

  // 5. Pérdida del contexto WebGL: plano 2D con «Reintentar 3D» y regreso a la 3D sin acumular objetos.
  await piso(p, 'Compago', 6000);
  const antes = await p.evaluate(() => window.__cauce3d.metricas());
  const lienzos = () => p.evaluate(() => [...document.querySelectorAll('#oficina canvas')].filter((c) => !c.closest('.vista3d-minimapa, .minimapa') && c.width > 400).length);
  await p.evaluate(() => { const c = [...document.querySelectorAll('#oficina canvas')].find((x) => x.width > 400); (c.getContext('webgl2') || c.getContext('webgl')).getExtension('WEBGL_lose_context').loseContext(); });
  await p.waitForTimeout(1500);
  const aviso = await p.locator('#aviso-vista').innerText();
  ok('contexto perdido: se pasa al plano 2D y se ofrece «Reintentar 3D»', /dejó de responder/.test(aviso) && await p.locator('.reintentar-3d').isVisible() && (await p.locator('#oficina .cuarto').count()) > 0, aviso);
  await p.locator('.reintentar-3d').click(); await p.waitForTimeout(7000);
  const despues = await p.evaluate(() => window.__cauce3d?.metricas());
  ok('Reintentar 3D: la escena vuelve, el aviso se va y no se acumulan geometrías ni texturas',
    !!despues && await p.locator('#aviso-vista').isHidden() && (await lienzos()) === 1 && despues.geometrias <= antes.geometrias && despues.texturas <= antes.texturas,
    despues ? `geo ${antes.geometrias}→${despues.geometrias}, tex ${antes.texturas}→${despues.texturas}` : 'sin escena');

  // 6. 20 vueltas por los cuatro pisos reales: estable.
  const base = { ...(await p.evaluate(() => window.__cauce3d.metricas())), nodos: await p.evaluate(() => document.getElementsByTagName('*').length) };
  for (let v = 0; v < 5; v++) for (const n of ['Ek Chuah', 'Montambre', 'Tezcatlipoca', 'Compago']) await piso(p, n, 1200);
  await p.waitForTimeout(5000);
  const tras = { ...(await p.evaluate(() => window.__cauce3d.metricas())), nodos: await p.evaluate(() => document.getElementsByTagName('*').length) };
  ok('20 cambios entre los 4 pisos: geometrías, texturas y nodos estables', tras.geometrias <= base.geometrias && tras.texturas <= base.texturas && tras.nodos <= base.nodos + 10,
    `geo ${base.geometrias}→${tras.geometrias}, tex ${base.texturas}→${tras.texturas}, nodos ${base.nodos}→${tras.nodos}`);
  ok('de vuelta en Compago: su DEMO y sus 4 figuras', /DEMO/.test(await p.locator('#conexion').innerText()) && tras.personajes === 4, `${tras.personajes}`);
  await p.close();

  // 7. Celular: el selector muestra el punto de color y sigue en una fila sin desplazar la página.
  for (const [nombre, disp] of [['vertical', devices['iPhone 12 Pro']], ['horizontal', devices['Pixel 5 landscape']]]) {
    const m = await b.newPage({ ...disp });
    await preparar(m);
    await m.goto(URL); await m.waitForTimeout(5000);
    const alto = await m.evaluate(() => document.getElementById('pisos').getBoundingClientRect().height);
    const sobra = await m.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    const luces = await m.locator('#pisos .piso-luz').evaluateAll((xs) => xs.filter((x) => x.getBoundingClientRect().width > 0).length);
    const textoVisible = await m.locator('#pisos .piso-estado-texto').first().evaluate((x) => x.getBoundingClientRect().width > 2);
    // K: un punto por proyecto del registro (6 desde la fase K: + CauceService y Repacar, pendientes).
    const nPisos = JSON.parse(require('fs').readFileSync('datos/proyectos.json', 'utf8')).proyectos.length;
    ok(`celular ${nombre}: ${nPisos} puntos de estado, texto solo para lectores, selector en una fila y sin desplazamiento`, luces === nPisos && !textoVisible && alto <= 60 && sobra <= 0, `${luces} puntos, ${Math.round(alto)} px, sobra ${sobra}`);
    if (SAL) await m.screenshot({ path: `${SAL}/selector-${nombre}.png` });
    await m.close();
  }

  console.log(res.join('\n'));
  console.log('errores:', errs.length ? errs.join(' | ') : 'ninguno');
  await b.close();
  if (res.some((l) => l.startsWith('FALLA')) || errs.length) process.exit(1);
})();
