// Fase H: Ek Chuah REAL junto a Compago y con las funciones de la fase G (inmersivo, celular, plano).
// Cubre lo que ek-chuah-pr2.cjs no prueba: aislamiento entre proyectos, errores visibles como errores,
// modo inmersivo, celular, vigencia de 15 min (2700 s) y privacidad en todo el texto visible.
// Con servir.py corriendo: node pruebas/navegador/ek-chuah-integracion.cjs [carpeta-capturas]
const { chromium, devices } = require('playwright');
const fs = require('fs');
const SAL = process.argv[2];
const URL = 'http://127.0.0.1:' + (process.env.PUERTO || 8765) + '/?medir=1';
const D = 'contrato/ejemplos/ek-chuah-pr2';
const ISO = /"(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z)"/g;
const iso = (ms) => new Date(ms).toISOString().replace(/\.\d+Z$/, 'Z');
/** Corre todas las horas del documento para que generado_en = base; opcionalmente cambia la vigencia. */
function alDia(nombre, base, vigencia) {
  const texto = fs.readFileSync(`${D}/${nombre}.json`, 'utf8');
  const gen = Date.parse(JSON.parse(texto).generado_en);
  const doc = JSON.parse(texto.replace(ISO, (_, t) => `"${iso(Date.parse(t) + base - gen)}"`));
  if (vigencia) doc.vigencia_segundos = vigencia;
  return JSON.stringify(doc);
}
const SENSIBLE = [/\$\s?\d/, /https?:\/\//i, /token/i, /webhook/i, /(api[_-]?key|password|contrase(ñ|n)a|secret)/i, /journal/i,
  /[a-z]:\\/i, /(\\users\\|\/home\/|\/users\/)/i, /\.env\b/i, /\.db\b|\.sqlite/i, /[\w.+-]+@[\w-]+\.[a-z]{2,}/i, /\b\d{10,}\b/];
const sensibles = (t) => SENSIBLE.filter((re) => re.test(t)).map((re) => t.match(re)[0]);

(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const res = []; const errs = [];
  const ok = (n, c, x = '') => res.push(`${c ? 'OK ' : 'FALLA'} ${n}${x ? ' · ' + x : ''}`);
  let cuerpo = null;
  const preparar = async (p) => {
    p.on('pageerror', (e) => errs.push(e.message));
    await p.route('**/datos/reales/ek-chuah.json*', (r) => (cuerpo === null ? r.fulfill({ status: 404, body: '' })
      : r.fulfill({ status: 200, contentType: 'application/json', body: cuerpo })));
    await p.route('**/datos/reales/compago.json*', (r) => r.fulfill({ status: 404, body: '' }));
  };
  const piso = async (p, nombre, ms = 4500) => { await p.locator('#pisos .piso', { hasText: nombre }).first().click(); await p.waitForTimeout(ms); };
  const pers = (p) => p.evaluate(() => (window.__cauce3d ? window.__cauce3d.personajes() : []));
  const pasos = (x) => [x.accion, ...x.cola].filter(Boolean);

  // ---------- Escritorio
  const p = await b.newPage({ viewport: { width: 1366, height: 768 } });
  await preparar(p);
  cuerpo = alDia('real-fallas', Date.now() - 5000);
  await p.goto(URL); await p.waitForTimeout(4000);
  await piso(p, 'Ek Chuah');
  let con = await p.locator('#conexion').innerText();
  let ps = await pers(p);
  ok('fallas REAL: insignia REAL, «En línea» y 5 alertas', /REAL/.test(con) && /En línea/.test(con) && /Alertas \(5\)/.test(con), con.split('\n')[0]);
  ok('fallas REAL: nadie aparece al cargar (primera lectura)', ps.every((x) => !x.visible && pasos(x).length === 0), `${ps.length} figuras`);
  const errores = await p.locator('.etiqueta-dep.estado-error').allInnerTexts();
  ok('los errores se ven como errores: Obtención de datos y Supervisión en rojo', errores.some((t) => /Obtención de datos/.test(t)) && errores.some((t) => /Supervisión/.test(t)), errores.join(' | '));
  ok('privacidad: nada sensible en la página con Ek Chuah REAL', sensibles(await p.evaluate(() => document.body.innerText)).length === 0);

  // Aislamiento: al pasar a Compago no queda nada de Ek Chuah y viceversa.
  await piso(p, 'Compago');
  con = await p.locator('#conexion').innerText();
  const t3 = await p.evaluate(() => document.body.innerText);
  ps = await pers(p);
  ok('Compago después de Ek Chuah: su DEMO, sus 3 alertas y ningún texto de Ek Chuah', /DEMO/.test(con) && /Alertas \(3\)/.test(con) && !/tarea diaria|Obtención de datos|Banxico/i.test(t3), con.split('\n')[0]);
  ok('Compago después de Ek Chuah: registro de cambios en cero y nadie con gestos', /Cambios observados \(0\)/.test(con) && ps.every((x) => pasos(x).every((a) => a !== 'celebrar')));
  await piso(p, 'Ek Chuah');
  con = await p.locator('#conexion').innerText();
  ps = await pers(p);
  ok('de vuelta en Ek Chuah: mismas 5 alertas, cambios en cero y nadie entra', /REAL/.test(con) && /Alertas \(5\)/.test(con) && /Cambios observados \(0\)/.test(con) && ps.every((x) => !x.visible), con.split('\n')[0]);
  const t4 = await p.evaluate(() => document.body.innerText);
  ok('Ek Chuah no muestra departamentos de Compago', !/Importación de catálogos|Búsqueda de proveedores|Márgenes/i.test(t4));

  // Modo inmersivo con Ek Chuah REAL.
  await p.locator('.boton-inmersivo').click(); await p.waitForTimeout(1200);
  con = await p.locator('#conexion').innerText();
  ok('inmersivo: REAL, conexión y 5 alertas visibles; cabecera oculta', /REAL/.test(con) && /Alertas \(5\)/.test(con) && !(await p.locator('.cabecera').isVisible()));
  await p.locator('[data-k="alertas"] summary').click(); await p.waitForTimeout(300);
  const lista = await p.locator('[data-k="alertas"] .tablero-lista').innerText();
  ok('inmersivo: la alerta crítica de la tarea diaria se consulta sin salir', /Crítica/.test(lista) && /tarea diaria terminó con error/i.test(lista));
  await p.locator('[data-k="alertas"] summary').click();
  await p.locator('.etiqueta-dep', { hasText: 'Supervisión' }).click(); await p.waitForTimeout(1200);
  const panel = await p.locator('#panel').innerText();
  ok('inmersivo: el detalle de Supervisión muestra la tarea diaria en error y sin nada sensible', /Tarea diaria/i.test(panel) && /Error/.test(panel) && sensibles(panel).length === 0);
  if (SAL) await p.screenshot({ path: `${SAL}/ek-chuah-inmersivo-fallas.png` });
  await p.keyboard.press('Escape'); await p.keyboard.press('Escape'); await p.keyboard.press('Escape'); await p.waitForTimeout(600);
  if (await p.evaluate(() => document.documentElement.classList.contains('inmersivo'))) await p.locator('#salir-inmersivo').click();

  // Plano 2D: las 6 oficinas y la tarea diaria como programada.
  await p.locator('[data-vista="2d"]').click(); await p.waitForTimeout(900);
  const t2 = await p.locator('#oficina').innerText();
  ok('plano: 6 oficinas y la tarea diaria marcada como programada', (await p.locator('#oficina .cuarto').count()) === 6 && /Programado/.test(t2));
  await p.locator('[data-vista="3d"]').click(); await p.waitForTimeout(2500);

  // Vigencia de 15 min × 3 = 2700 s: a los 30 min sigue en línea, a los 50 min está desactualizado.
  cuerpo = alDia('real-dia-normal', Date.now() - 30 * 60_000, 2700);
  await piso(p, 'Compago', 1200); await piso(p, 'Ek Chuah');
  con = await p.locator('#conexion').innerText();
  ok('vigencia 2700 s: dato de hace 30 min sigue «En línea»', /En línea/.test(con), con.split('\n')[0]);
  cuerpo = alDia('real-dia-normal', Date.now() - 50 * 60_000, 2700);
  await piso(p, 'Compago', 1200); await piso(p, 'Ek Chuah');
  con = await p.locator('#conexion').innerText();
  ps = await pers(p);
  ok('vigencia 2700 s: dato de hace 50 min «Datos desactualizados» y nadie aparece', /desactualizad/i.test(con) && ps.every((x) => !x.visible), con.split('\n')[0]);
  await p.close();

  // ---------- Celular vertical con Ek Chuah REAL
  const m = await b.newPage({ ...devices['iPhone 12 Pro'] });
  await preparar(m);
  cuerpo = alDia('real-dia-normal', Date.now() - 5000);
  await m.goto(URL); await m.waitForTimeout(4000);
  await m.locator('#pisos .piso', { hasText: 'Ek Chuah' }).first().tap(); await m.waitForTimeout(5000);
  await m.locator('.movil-actual').tap(); await m.waitForTimeout(300);
  const filas = await m.locator('.movil-fila').count();
  ok('celular: la lista de la barra tiene «Todo el piso» y las 6 oficinas', filas === 7, `${filas} filas`);
  await m.locator('.movil-fila', { hasText: 'Supervisión' }).tap(); await m.waitForTimeout(1500);
  const ancho = await m.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  ok('celular: detalle abierto sin desplazamiento horizontal y sin nada sensible', ancho <= 0 && await m.locator('#panel').isVisible() && sensibles(await m.evaluate(() => document.body.innerText)).length === 0, `sobra ${ancho}px`);
  if (SAL) await m.screenshot({ path: `${SAL}/ek-chuah-celular.png` });
  await m.close();

  console.log(res.join('\n'));
  console.log('errores:', errs.length ? errs.join(' | ') : 'ninguno');
  await b.close();
  if (res.some((l) => l.startsWith('FALLA')) || errs.length) process.exit(1);
})();
