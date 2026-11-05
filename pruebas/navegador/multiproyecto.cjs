// Fase F: escalabilidad multiproyecto en Chromium (SwiftShader: cuenta objetos y llamadas; NO mide la Intel UHD).
// Con servir.py corriendo: node pruebas/navegador/multiproyecto.cjs [carpeta-capturas]
// Los proyectos sintéticos son DEMO generados en memoria (no se escriben en disco). Compago y Ek Chuah usan sus
// archivos reales del repositorio.
const { chromium, devices } = require('playwright');
const fs = require('fs');
const SAL = process.argv[2];
const ESTADOS = ['trabajando', 'esperando', 'finalizado', 'error', 'requiere_revision', 'sin_datos'];
function sintetico(id, deps, agentes) {
  const t = '2026-11-03T12:00:00Z';
  return {
    contrato: 'cauce.estado-proyecto', version: '1.0.0', proyecto: { id, nombre: `Sintético ${id.slice(-2)}` },
    generado_en: t, vigencia_segundos: 600, es_demo: true, demo: { ahora_simulado: '2026-11-03T12:01:00Z' },
    fuente: { tipo: 'demo', nombre: 'Proyecto sintético de prueba (no existe)' },
    departamentos: Array.from({ length: deps }, (_, d) => ({
      id: `dep-${d}`, nombre: `[DEMO] Departamento ${d + 1}`, indicadores: [{ etiqueta: 'Cifra', valor: d }],
      agentes: Array.from({ length: agentes }, (_, a) => {
        const estado = ESTADOS[(d + a) % ESTADOS.length];
        const con = estado !== 'sin_datos';
        return { id: `${id}-${d}-${a}`, nombre: `P${d}.${a}`, rol: '[DEMO] rol', estado,
          ...(con ? { actividad: { descripcion: '[DEMO] tarea', inicio: '2026-11-03T11:50:00Z' }, evidencia: { origen: 'demo', referencia: `[DEMO] ${d}.${a}` } } : {}) };
      }),
    })),
  };
}
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-precise-memory-info', '--js-flags=--expose-gc'] });
  const res = []; const errs = [];
  const ok = (n, c, x = '') => res.push(`${c ? 'OK ' : 'FALLA'} ${n}${x ? ' · ' + x : ''}`);
  const info = (n, x) => res.push(`INFO ${n} · ${x}`);
  // Registro: Compago, Ek Chuah, Tezcatlipoca y N sintéticos con distintos tamaños.
  const tamanos = { 'sint-01': [8, 1], 'sint-02': [8, 3], 'sint-03': [20, 1], 'sint-04': [20, 3], 'sint-05': [50, 1], 'sint-06': [50, 3] };
  for (let i = 7; i <= 20; i++) tamanos[`sint-${String(i).padStart(2, '0')}`] = [6, 1];
  const real = JSON.parse(fs.readFileSync('datos/proyectos.json', 'utf8'));
  const registro = { proyectos: [...real.proyectos, ...Object.keys(tamanos).map((id) => ({ id, nombre: `Sintético ${id.slice(-2)}`, estado: `datos/reales/${id}.json`, demo: `datos/demo/${id}.json` }))] };
  const nuevaPagina = async (opc) => {
    const p = await b.newPage(opc);
    p.on('pageerror', (e) => errs.push(e.message));
    await p.route('**/datos/proyectos.local.json*', (r) => r.fulfill({ status: 404, body: '' }));
    await p.route('**/datos/proyectos.json*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(registro) }));
    await p.route('**/datos/reales/*.json*', (r) => r.fulfill({ status: 404, body: '' }));
    await p.route(/datos\/demo\/sint-\d\d\.json/, (r) => { const id = r.request().url().match(/sint-\d\d/)[0]; r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(sintetico(id, ...tamanos[id])) }); });
    return p;
  };
  const p = await nuevaPagina({ viewport: { width: 1390, height: 860 } });
  await p.goto('http://127.0.0.1:8765/?medir=1'); await p.waitForTimeout(9000);
  const m = () => p.evaluate(() => window.__cauce3d.metricas());
  const heap = () => p.evaluate(() => { window.gc?.(); return Math.round((performance.memory?.usedJSHeapSize ?? 0) / 1048576); });
  const listaAbierta = [];
  // Fase L: los pisos pendientes (2 o más) se agrupan en «+N pendientes»; si la pestaña está ahí, se abre el grupo primero.
  const elegir = async (nombre, espera = 5000) => {
    const b = p.locator('#pisos .piso', { hasText: nombre }).first();
    const agrupado = !(await b.isVisible());
    if (agrupado) await p.locator('#pisos .pisos-mas > summary').click();
    await b.click(); await p.waitForTimeout(espera);
    if (agrupado) listaAbierta.push(await p.locator('#pisos .pisos-mas-lista').isVisible());
  };
  // 1. Costo por proyecto (escena del edificio completo).
  const filas = [];
  for (const [nombre, id] of [['Compago', null], ['Ek Chuah', null], ['Tezcatlipoca', null], ...Object.keys(tamanos).slice(0, 6).map((id) => [`Sintético ${id.slice(-2)}`, id])]) {
    await elegir(nombre, id && tamanos[id][0] >= 50 ? 12000 : 6000);
    const x = await m();
    filas.push(`${nombre}${id ? ` (${tamanos[id][0]} deptos × ${tamanos[id][1]})` : ''}: ${x.llamadas} llamadas, ${x.triangulos} triángulos, ${x.geometrias} geometrías, ${x.texturas} texturas, ${x.personajes} personajes, ${x.fps} cps (software)`);
  }
  info('costo por proyecto', '\n     ' + filas.join('\n     '));
  // 2. Cambio repetido entre proyectos: no crecen geometrías, texturas, nodos ni memoria.
  await elegir('Compago', 6000);
  const base = { ...(await m()), heap: await heap(), nodos: await p.evaluate(() => document.getElementsByTagName('*').length) };
  const ciclo = ['Ek Chuah', 'Sintético 02', 'Tezcatlipoca', 'Sintético 04', 'Compago'];
  for (let v = 0; v < 6; v++) for (const n of ciclo) await elegir(n, 1500);
  await p.waitForTimeout(5000);
  const tras = { ...(await m()), heap: await heap(), nodos: await p.evaluate(() => document.getElementsByTagName('*').length) };
  ok('«+N pendientes»: los pisos agrupados se eligen desde la lista y la lista se cierra (no tapa los controles)', listaAbierta.length > 0 && !listaAbierta.some(Boolean), `${listaAbierta.length} elecciones`);
  ok('30 cambios de proyecto: geometrías y texturas vuelven al mismo número', tras.geometrias <= base.geometrias && tras.texturas <= base.texturas, `geo ${base.geometrias}→${tras.geometrias}, tex ${base.texturas}→${tras.texturas}`);
  ok('30 cambios de proyecto: nodos de la página estables', tras.nodos <= base.nodos + 20, `${base.nodos}→${tras.nodos}`);
  info('memoria JS tras 30 cambios (no es la GPU)', `${base.heap} → ${tras.heap} MB`);
  ok('vuelve a Compago con su DEMO y sus 4 figuras', /DEMO/.test(await p.locator('#conexion').innerText()) && tras.personajes === 4, `${tras.personajes} personajes`);
  // 3. Aislamiento: los datos de un proyecto no aparecen en otro.
  await elegir('Sintético 01', 5000);
  const txt = await p.locator('#oficina').innerText().catch(() => '');
  ok('aislamiento: en el sintético no aparecen departamentos de Compago', !/Importación|Búsqueda de proveedores/.test(txt + (await p.locator('#panel').innerText())));
  // 4. 2D con 50 departamentos y sin aviso de falla.
  await elegir('Sintético 06', 9000);
  await p.locator('[data-vista="2d"]').click(); await p.waitForTimeout(1500);
  ok('plano 2D con 50 departamentos × 3 personajes', (await p.locator('.cuarto').count()) === 50 && await p.locator('#aviso-vista').isHidden(), `${await p.locator('.cuarto').count()} cuartos`);
  await p.locator('[data-vista="3d"]').click(); await p.waitForTimeout(3000);
  await p.close();
  // 5. Celular con 23 proyectos: cuánto ocupa el selector.
  const c = await nuevaPagina({ ...devices['iPhone 12'] });
  await c.goto('http://127.0.0.1:8765/'); await c.waitForTimeout(8000);
  const alto = await c.evaluate(() => document.getElementById('pisos').getBoundingClientRect().height);
  const anchoPag = await c.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  info('celular: alto del selector de proyectos con 23 proyectos', `${Math.round(alto)} px de ${await c.evaluate(() => innerHeight)} px`);
  ok('celular: selector de proyectos en una sola fila (≤ 60 px) y sin desplazamiento horizontal de la página', alto <= 60 && anchoPag <= 0, `${Math.round(alto)} px, sobra ${anchoPag} px`);
  if (SAL) await c.screenshot({ path: `${SAL}/movil-23-proyectos.png` });
  await c.close();
  console.log(res.join('\n')); console.log('errores:', errs.length ? errs : 'ninguno');
  await b.close();
  process.exit(res.some((r) => r.startsWith('FALLA')) || errs.length ? 1 : 0);
})();
