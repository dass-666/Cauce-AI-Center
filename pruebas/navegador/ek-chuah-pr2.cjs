// Fase G: la app con los 8 documentos del exportador de Ek Chuah (PR #2, contrato/ejemplos/ek-chuah-pr2/), de extremo a extremo.
// El archivo REAL se sirve en datos/reales/ek-chuah.json; las horas de los REAL se corren a "ahora".
// Con servir.py corriendo: node pruebas/navegador/ek-chuah-pr2.cjs [carpeta-capturas]
const { chromium, devices } = require('playwright');
const fs = require('fs');
const SAL = process.argv[2];
const D = 'contrato/ejemplos/ek-chuah-pr2';
const DOCS = ['dia-normal', 'fallas', 'sin-evidencia', 'sin-base'].flatMap((n) => [`demo-${n}`, `real-${n}`]);
const ISO = /"(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z)"/g;
const iso = (ms) => new Date(ms).toISOString().replace(/\.\d+Z$/, 'Z');
function alDia(texto, base) {
  const gen = Date.parse(JSON.parse(texto).generado_en);
  return texto.replace(ISO, (_, t) => `"${iso(Date.parse(t) + base - gen)}"`);
}
const leer = (n) => fs.readFileSync(`${D}/${n}.json`, 'utf8');
const servir = (n, base) => (n.startsWith('real-') ? alDia(leer(n), base) : leer(n));
// Mismos patrones que pruebas/casos-ek-chuah.js (montos, enlaces, secretos, rutas privadas, dinero real).
const SENSIBLE = [/\$\s?\d/, /https?:\/\//i, /token/i, /webhook/i, /(api[_-]?key|password|contrase(ñ|n)a|secret)/i, /journal/i,
  /[a-z]:\\/i, /(\\users\\|\/home\/|\/users\/|msigf)/i, /\.env\b/i, /\.db\b|\.sqlite/i, /[\w.+-]+@[\w-]+\.[a-z]{2,}/i, /\b\d{10,}\b/];
const DEPTOS = ['Obtención de datos', 'Supervisión y alertas', 'Informes', 'Simulaciones', 'Análisis de riesgo', 'Auditoría y verificación'];

(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const res = []; const errs = []; const avisosConsola = [];
  const ok = (n, c, x = '') => res.push(`${c ? 'OK ' : 'FALLA'} ${n}${x ? ' · ' + x : ''}`);
  const p = await b.newPage({ viewport: { width: 1390, height: 860 } });
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'warning' && /ek-chuah/.test(m.text())) avisosConsola.push(m.text()); });
  let cuerpo = null; // null → 404 (no hay archivo real)
  await p.route('**/datos/reales/ek-chuah.json*', (r) => (cuerpo === null ? r.fulfill({ status: 404, body: '' })
    : r.fulfill({ status: 200, contentType: 'application/json', body: cuerpo })));
  const pers = () => p.evaluate(() => (window.__cauce3d ? window.__cauce3d.personajes() : []));
  const de = (ps, id) => ps.find((x) => x.id === id) ?? { cola: [] };
  const pasos = (x) => [x.accion, ...x.cola].filter(Boolean);
  const recargar = async (espera = 600) => { await p.locator('#recargar').click(); await p.waitForTimeout(espera); return pers(); };
  const textoPagina = () => p.evaluate(() => document.body.innerText);
  const sensibles = (t) => SENSIBLE.filter((re) => re.test(t)).map((re) => `${re} → ${t.match(re)[0]}`);

  // 0) Sin archivo real: el DEMO incluido en Cauce, con sus 6 oficinas y sin personajes.
  await p.goto('http://127.0.0.1:8765/?medir=1'); await p.waitForTimeout(4000);
  await p.locator('#pisos .piso', { hasText: 'Ek Chuah' }).first().click(); await p.waitForTimeout(6000);
  let ps = await pers();
  ok('sin archivo real: DEMO de Cauce con franja y nadie visible', await p.locator('#banda-demo').isVisible() && ps.every((x) => !x.visible), `${ps.length} figuras`);

  // 1) Los 8 documentos, uno por uno (cada uno como primera lectura del piso).
  const resumen = [];
  for (const n of DOCS) {
    cuerpo = servir(n, Date.now() - 5000);
    await p.locator('#pisos .piso', { hasText: 'Compago' }).first().click(); await p.waitForTimeout(1500);
    await p.locator('#pisos .piso', { hasText: 'Ek Chuah' }).first().click(); await p.waitForTimeout(5000);
    ps = await pers();
    const con = await p.locator('#conexion').innerText();
    const demo = await p.locator('#banda-demo').isVisible();
    const esDemo = n.startsWith('demo-');
    await p.locator('[data-vista="2d"]').click(); await p.waitForTimeout(800);
    const t2 = await p.locator('#oficina').innerText();
    const deptos = DEPTOS.filter((d) => t2.toLowerCase().includes(d.toLowerCase())).length;
    const figuras2d = await p.locator('#oficina .personaje:not(.sin-figura)').count();
    const sinConf = /Programado · sin confirmar/i.test(t2);
    // Panel de cada personaje: el texto que ve la persona tampoco lleva nada sensible.
    let panel = '';
    for (const btn of await p.locator('#oficina .personaje').all()) { await btn.click(); await p.waitForTimeout(80); panel += await p.locator('#panel').innerText(); }
    for (const dep of await p.locator('#oficina .cuarto-titulo, #oficina .letrero').all()) { await dep.click().catch(() => {}); await p.waitForTimeout(60); panel += await p.locator('#panel').innerText(); }
    const todo = (await textoPagina()) + panel;
    const fuga = sensibles(todo);
    const esperaSinConf = /sin-evidencia|sin-base/.test(n);
    ok(`«${n}»: ${esDemo ? 'DEMO con franja' : 'REAL sin franja'}, 6 oficinas, nadie visible al cargar, tarea-diaria ${esperaSinConf ? 'sin confirmar' : 'confirmada'}, sin datos sensibles`,
      demo === esDemo && (esDemo ? /DEMO/ : /REAL/).test(con) && deptos === 6 && figuras2d === 0 && ps.every((x) => !x.visible && pasos(x).length === 0)
        && sinConf === esperaSinConf && fuga.length === 0,
      `deptos ${deptos}, figuras2d ${figuras2d}, 3d visibles ${ps.filter((x) => x.visible).length}, sinConf ${sinConf}${fuga.length ? ', FUGA ' + fuga.join(' | ') : ''}`);
    resumen.push(`${n}: ${con.split('\n')[0]} | figuras 3D presentes ${ps.length} (visibles ${ps.filter((x) => x.visible).length})`);
    if (SAL && (n === 'real-fallas' || n === 'real-sin-base')) await p.screenshot({ path: `${SAL}/g-${n}-2d.png` });
    await p.locator('[data-vista="3d"]').click(); await p.waitForTimeout(1500);
  }

  // 2) Animaciones: solo un registro nuevo Y reciente hace aparecer a alguien.
  const base0 = Date.now() - 3000;
  const conCorrida = (finMs, ref) => {
    const d = JSON.parse(servir('real-dia-normal', Date.now() - 1000));
    const t = d.departamentos.find((x) => x.id === 'supervision').agentes.find((a) => a.id === 'tarea-diaria');
    t.actividad.inicio = iso(finMs - 41000); t.actividad.fin = iso(finMs); t.evidencia.referencia = ref;
    return JSON.stringify(d);
  };
  cuerpo = servir('real-dia-normal', base0);
  await p.locator('#pisos .piso', { hasText: 'Compago' }).first().click(); await p.waitForTimeout(1500);
  await p.locator('#pisos .piso', { hasText: 'Ek Chuah' }).first().click(); await p.waitForTimeout(6000);
  ps = await pers();
  ok('primera lectura REAL: nadie camina ni hace gestos', ps.every((x) => !x.visible && pasos(x).length === 0));
  await p.waitForTimeout(1500);
  if (SAL) { await p.locator('select.vista3d-selector').selectOption({ label: 'Supervisión y alertas' }).catch(() => {}); await p.waitForTimeout(2500); }
  cuerpo = conCorrida(Date.now() - 2000, 'corrida nueva de hoy');
  ps = await recargar();
  ok('corrida nueva y reciente de la tarea diaria: entra (sin celebrar)', pasos(de(ps, 'tarea-diaria')).includes('entrar') && !pasos(de(ps, 'tarea-diaria')).includes('celebrar'), pasos(de(ps, 'tarea-diaria')).join(','));
  ok('los demás no se mueven', ps.filter((x) => x.id !== 'tarea-diaria').every((x) => !x.visible && pasos(x).length === 0));
  if (SAL) { await p.waitForTimeout(2500); await p.screenshot({ path: `${SAL}/g-tarea-breve.png` }); }
  await p.waitForTimeout(11000); ps = await pers();
  ok('~8 s después la tarea diaria ya salió', !de(ps, 'tarea-diaria').visible);
  cuerpo = conCorrida(Date.now() - 3 * 86400e3, 'corrida atrasada de hace 3 días');
  ps = await recargar();
  ok('registro nuevo pero de hace 3 días: nadie entra (defecto corregido)', ps.every((x) => !x.visible && pasos(x).length === 0), pasos(de(ps, 'tarea-diaria')).join(','));
  ps = await recargar();
  ok('lectura repetida: nadie entra ni hace gestos', ps.every((x) => !x.visible && pasos(x).length === 0));
  await p.locator('[data-vista="2d"]').click(); await p.waitForTimeout(700);
  ok('tras la corrida atrasada, el plano dice «Programado · sin confirmar»', /Programado · sin confirmar/i.test(await p.locator('#oficina').innerText()));
  await p.locator('[data-vista="3d"]').click(); await p.waitForTimeout(800);

  // 3) El archivo deja de actualizarse (vigencia vencida): Datos desactualizados, nadie aparece.
  const viejo = JSON.parse(servir('real-dia-normal', Date.now() - 27 * 3600e3));
  cuerpo = JSON.stringify(viejo);
  ps = await recargar(800);
  ok('archivo vencido: «Datos desactualizados» y nadie aparece', /desactualizad/i.test(await p.locator('#conexion').innerText()) && ps.every((x) => !x.visible));

  ok('la clasificación de Ek Chuah no produce avisos en la consola', avisosConsola.length === 0, avisosConsola.join(' | '));
  await p.close();

  // 4) Celular con REAL.
  const c = await b.newPage({ ...devices['iPhone 12'] }); c.on('pageerror', (e) => errs.push(e.message));
  await c.route('**/datos/reales/ek-chuah.json*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: servir('real-fallas', Date.now() - 5000) }));
  await c.goto('http://127.0.0.1:8765/'); await c.waitForTimeout(3000);
  await c.locator('#pisos .piso', { hasText: 'Ek Chuah' }).first().click(); await c.waitForTimeout(6000);
  const cc = await c.locator('#conexion').innerText();
  const ancho = await c.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok('celular con REAL: cabecera REAL, sin desplazamiento horizontal', /REAL/.test(cc) && ancho <= 0, `sobra ${ancho} px`);
  if (SAL) await c.screenshot({ path: `${SAL}/g-movil.png` });
  console.log(resumen.join('\n'));
  console.log(res.join('\n')); console.log('errores:', errs.length ? errs : 'ninguno'); await b.close();
  process.exit(res.some((r) => r.startsWith('FALLA')) || errs.length ? 1 : 0);
})();
