// CSI (Inteligencia Estratégica): piso de cinco estaciones en 3D, plano 2D y «Un cuarto», laboratorio con paneles,
// investigación de principio a fin sin IA, propuesta a Nexus sin aprobación automática, celular y pruebas.html.
// Con servir.py corriendo:  node pruebas/navegador/csi.cjs      (SAL=carpeta para capturas, opcional)
// SwiftShader: comprueba comportamiento; NO mide el rendimiento de la Intel UHD.
const { chromium, devices } = require('playwright');
const fs = require('fs');
const BASE = 'http://127.0.0.1:' + (process.env.PUERTO || 8765) + '/';
const SAL = process.env.SAL || null;
if (SAL) fs.mkdirSync(SAL, { recursive: true });

(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const res = []; const errs = [];
  const ok = (n, c, x = '') => res.push(`${c ? 'OK ' : 'FALLA'} ${n}${x ? ' · ' + x : ''}`);
  const vigilar = (p) => { p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource|node:child_process/.test(m.text())) errs.push(m.text()); }); };
  const foto = async (p, n, completa = false) => { if (SAL) await p.screenshot({ path: `${SAL}/${n}.png`, fullPage: completa }); };
  const preparar = async (p) => {
    vigilar(p);
    await p.addInitScript(() => { try { localStorage.clear(); } catch {} });
    await p.route('**/datos/proyectos.local.json*', (r) => r.fulfill({ status: 404, body: '' }));
    await p.route('**/datos/reales/*.json*', (r) => r.fulfill({ status: 404, body: '' }));
    await p.route('**/datos/csi/registro/*.json*', (r) => r.fulfill({ status: 404, body: '' }));
  };
  const met = (p) => p.evaluate(() => window.__cauce3d?.metricas() ?? null);

  // ---------------------------------------------------------------- Escritorio 3D: el piso CSI
  const p = await b.newPage({ viewport: { width: 1366, height: 768 } });
  await preparar(p);
  await p.goto(BASE + '?medir=1&hora=11'); await p.waitForTimeout(5000);
  const compago = await met(p);
  await p.locator('#pisos .piso', { hasText: 'Inteligencia' }).first().click(); await p.waitForTimeout(5000);
  const m = await met(p);
  const texto = await p.locator('body').innerText();
  ok('piso CSI: DEMO marcado y cinco estaciones con nombre', /DATOS DE DEMOSTRACIÓN[\s\S]*Inteligencia Estratégica/.test(texto) && ['Estratega', 'Psicólogo de Masas', 'Analista de Poder', 'Simulador', 'Abogado del Diablo'].every((t) => texto.includes(t)));
  ok('piso CSI: nadie aparece «trabajando» (3 requieren revisión, 2 esperando)', /3 requiere revisión/.test(texto) && /2 esperando/.test(texto) && !/\d+ trabajando/.test(texto));
  ok('piso CSI: llamadas de dibujo no superan las del piso Compago (ligero)', m && compago && m.llamadas <= compago.llamadas, `CSI ${m?.llamadas} · Compago ${compago?.llamadas}`);
  await foto(p, 'csi-piso-3d');
  await p.keyboard.press('1'); await p.waitForTimeout(1500);
  ok('tecla 1: enfoca la estación Estratega', /Estratega/.test(await p.locator('#panel').innerText()));
  await foto(p, 'csi-estacion-estratega');
  ok('el panel de la estación ofrece «Abrir el laboratorio CSI»', /Abrir el laboratorio CSI/.test(await p.locator('#panel').innerText()));
  await p.keyboard.press('Escape'); await p.keyboard.press('0'); await p.waitForTimeout(800);

  // ---------------------------------------------------------------- Laboratorio
  const csi = p.locator('#csi');
  const antes = (await met(p)).cuadros_totales;
  await p.keyboard.press('i'); await p.waitForTimeout(1500);
  ok('tecla I abre CSI con foco en su título y aria-pressed', await csi.isVisible() && await p.evaluate(() => document.activeElement?.id === 'csi-titulo') && (await p.locator('#boton-csi').getAttribute('aria-pressed')) === 'true');
  await p.waitForTimeout(2000);
  const despues = (await met(p)).cuadros_totales;
  ok('con CSI abierto la 3D se pausa (casi no dibuja)', despues - antes <= 4, `${despues - antes} cuadros en 2 s`);
  const t = await csi.innerText();
  ok('DEMO · CASO FICTICIO visible y sin texto «null»', /DEMO · CASO FICTICIO/.test(t) && !/\bnull\b/.test(t) && (await csi.locator('[data-fuente="demo"]').count()) === 1);
  ok('resumen: 1 investigación, 7 actores, 4 relaciones verificables, 1 sin fuente', /1\s*investigaciones/.test(t) && /7\s*actores/.test(t) && /4\s*relaciones verificables/.test(t) && /1\s*relaciones sin fuente/.test(t));
  ok('resumen: historial íntegro y cadena de predicciones íntegra', (await csi.locator('[data-integridad-csi="ok"]').count()) === 1 && /cadena íntegra \(9 entradas\)/.test(t));
  await foto(p, 'csi-resumen', true);
  const pestana = async (k) => { await p.locator(`[data-pestana="${k}"]`).click(); await p.waitForTimeout(250); return csi.innerText(); };

  let x = await pestana('investigaciones');
  ok('investigaciones: hechos, declaraciones, inferencias, simulaciones y predicciones en columnas separadas', (await csi.locator('.csi-col').count()) === 5 && /Hechos \(7\)/i.test(x) && /Declaraciones \(2\)/i.test(x) && /Inferencias \(2\)/i.test(x) && /Simulaciones \(1\)/i.test(x) && /Predicciones \(1\)/i.test(x));
  ok('investigaciones: incentivos marcados como inferidos y revisión reabierta', /Incentivos inferidos \(no son hechos\)/i.test(x) && /Revisión: en_revision/.test(x));
  await foto(p, 'csi-investigacion', true);
  x = await pestana('actores');
  ok('actores: 7 tarjetas, objetivos documentados con fuente e incentivos hipotéticos aparte', (await csi.locator('[data-actor]').count()) === 7 && /Incentivos hipotéticos \(no documentados\)/i.test(x));
  await csi.locator('select').selectOption('banco_central'); await p.waitForTimeout(250);
  ok('actores: filtro por tipo', (await csi.locator('[data-actor]').count()) === 1);
  x = await pestana('relaciones');
  ok('relaciones: la que no tiene fuente queda fuera y se advierte que un bloque no es coordinación', /Sin fuente: no entran al análisis \(1\)/i.test(x) && /No implica coordinación/.test(x));
  x = await pestana('hipotesis');
  ok('hipótesis: comparación A–D; D incompleta, ninguna «confirmada»', (await csi.locator('[data-hipotesis]').count()) === 4 && (await csi.locator('[data-hipotesis="H-D"]').getAttribute('data-estado')) === 'incompleta' && !/confirmada/i.test(x.replace(/no es confirmación/g, '')));
  await foto(p, 'csi-hipotesis', true);
  x = await pestana('arbol');
  ok('árbol: aviso de SIMULACIÓN, 4 explicaciones y la rama bloqueada por restricción', (await csi.locator('[data-simulacion]').count()) === 1 && (await csi.locator('[data-explicacion]').count()) === 4 && /BLOQUEADA por restricción documentada/.test(x) && /Rutas simuladas \(6; 1 bloqueadas\)/.test(x));
  await foto(p, 'csi-arbol', true);
  x = await pestana('evidencias');
  ok('evidencias y objeciones: contradicción p8/h2 y objeciones del Abogado del Diablo', /p8 \(hecho\) contradice h2 \(hecho\)/.test(x) && /\[abierta\] sesgo/.test(x) && /\[respondida\] explicacion_alternativa/.test(x));
  x = await pestana('predicciones');
  ok('predicciones: la fallida se conserva; corrección posterior no cuenta; vencida sin evaluar visible', (await csi.locator('[data-prediccion="pred-bc-facilidad"]').getAttribute('data-estado')) === 'fallida' && /posterior al horizonte\/resultado: no cuenta/.test(x) && (await csi.locator('[data-prediccion="pred-regulador"]').getAttribute('data-estado')) === 'sin_evaluar');
  ok('predicciones: comparación con la referencia simple y aviso de causalidad', /Referencia simple: 2 de 2/.test(x) && /no alcanza para afirmar/.test(x) && /no demuestra que la explicación causal/.test(x));
  await foto(p, 'csi-predicciones', true);
  await pestana('nexus');
  await p.locator('[data-preparar="H-B"]').click(); await p.waitForTimeout(300);
  x = await csi.innerText();
  ok('propuesta a Nexus: dictamen con objeciones y decisión humana pendiente', /Nexus: con_objeciones/.test(x) && (await csi.locator('[data-decision="pendiente"]').count()) === 1);
  ok('ningún botón de CSI aprueba, ejecuta ni envía', (await csi.locator('button').allTextContents()).every((t) => !/aprob|ejecut|enviar|publicar|operar/i.test(t)));
  await foto(p, 'csi-propuesta-nexus', true);

  // Investigación de principio a fin en el laboratorio (sin IA): crear → fuente → hecho → hipótesis → predicción → propuesta.
  await pestana('laboratorio');
  const llenar = async (pares) => { for (const [id, v] of pares) { const loc = p.locator(`#csi-lab-${id}`); if ((await loc.evaluate((n) => n.tagName)) === 'SELECT') await loc.selectOption(v); else await loc.fill(v); } };
  const abrir = (k) => p.locator(`[data-form="${k}"]`).evaluate((d) => { d.open = true; });
  const aplicar = async (k) => { await p.locator(`[data-enviar="${k}"]`).click(); await p.waitForTimeout(400); return (await csi.locator('.csi-mensajes').innerText()).split('\n')[0]; };
  await llenar([['alias', 'diego'], ['id', 'mi-caso'], ['titulo', 'Prueba de laboratorio'], ['pregunta', '¿Por qué cayó?'], ['acont', 'Caída de prueba'], ['fecha', '2026-11-01']]);
  let msg = await aplicar('crear');
  ok('laboratorio: crear investigación (práctica DEMO)', /Investigación mi-caso creada \(DEMO\)/.test(msg), msg);
  await abrir('fuente');
  await llenar([['f-id', 'f1'], ['f-titulo', 'Boletín'], ['f-editor', 'Bolsa'], ['f-tipo', 'dato_estadistico'], ['f-fecha', '2026-11-01T15:00']]);
  msg = await aplicar('fuente');
  ok('laboratorio: agregar fuente', /agregar_fuente: listo/.test(msg), msg);
  await abrir('enunciado');
  await llenar([['e-id', 'h1'], ['e-tipo', 'hecho'], ['e-texto', 'El índice cayó'], ['e-fuentes', 'f1'], ['e-sobre', 'intencion'], ['e-actor', 'banco-x']]);
  msg = await aplicar('enunciado');
  ok('laboratorio: una intención como hecho se rechaza con explicación', /intención no se registra como hecho/.test(msg), msg);
  await llenar([['e-sobre', 'dato'], ['e-actor', '']]);
  msg = await aplicar('enunciado');
  ok('laboratorio: el hecho con fuente se acepta', /agregar_enunciado: listo/.test(msg), msg);
  await abrir('hipotesis');
  await llenar([['h-id', 'H1'], ['h-cat', 'liquidez'], ['h-texto', 'Ventas forzadas'], ['h-favor', 'h1'], ['h-refuta', 'Entradas netas ese día']]);
  msg = await aplicar('hipotesis');
  ok('laboratorio: agregar hipótesis', /agregar_hipotesis: listo/.test(msg), msg);
  await abrir('prediccion');
  await llenar([['p-id', 'p1'], ['p-hip', 'H1'], ['p-texto', 'Rebota en una semana'], ['p-obs', 'Cierre oficial'], ['p-desde', '2030-01-01T10:00'], ['p-hasta', '2030-01-08T10:00'], ['p-ok', 'sube'], ['p-mal', 'baja'], ['p-ind', 'sin dato'], ['p-ref', 'sin cambio']]);
  msg = await aplicar('prediccion');
  ok('laboratorio: predicción registrada antes de su horizonte', /Predicción p1 registrada/.test(msg), msg);
  await p.locator('[data-lab-propuesta="H1"]').click(); await p.waitForTimeout(300);
  msg = (await csi.locator('.csi-mensajes').innerText()).split('\n')[0];
  ok('laboratorio: la propuesta llega a Nexus sin aprobarse (decisión humana pendiente)', /Nexus dice «con_objeciones»; decisión humana pendiente/.test(msg), msg);
  ok('laboratorio: descargas de investigaciones, predicciones y expediente disponibles', (await csi.locator('a[download="investigaciones.json"]').count()) === 1 && (await csi.locator('a[download="predicciones.json"]').count()) === 1 && (await csi.locator('a[download^="expediente-"]').count()) >= 1);
  await foto(p, 'csi-laboratorio', true);

  // Convivencia: Nexus y la sala cierran CSI; Esc vuelve al edificio.
  await p.keyboard.press('n'); await p.waitForTimeout(800);
  ok('abrir Nexus cierra CSI', await csi.isHidden() && await p.locator('#nexus').isVisible());
  await p.locator('#boton-csi').click(); await p.waitForTimeout(800);
  ok('abrir CSI cierra Nexus', await csi.isVisible() && await p.locator('#nexus').isHidden());
  await p.keyboard.press('Escape'); await p.waitForTimeout(800);
  ok('Esc cierra CSI y la 3D vuelve a dibujar', await csi.isHidden() && await p.locator('.vista3d').isVisible());
  await p.locator('[data-vista="2d"]').click(); await p.waitForTimeout(1500);
  ok('plano 2D del piso CSI: 5 cuartos', (await p.locator('#oficina .cuarto').count()) === 5);
  await foto(p, 'csi-plano-2d');
  await p.locator('[data-vista="3d"]').click(); await p.waitForTimeout(3000);
  await p.locator('#pisos .piso', { hasText: 'Compago' }).first().click(); await p.waitForTimeout(4000);
  ok('regresión: Compago en 3D sigue con 8 departamentos', /Compago/.test(await p.locator('#banda-demo').innerText()) && (await met(p))?.llamadas > 0);
  await p.close();

  // ---------------------------------------------------------------- Celular
  const c = await b.newContext({ ...devices['iPhone 13'] });
  const pm = await c.newPage(); await preparar(pm);
  await pm.goto(BASE + '?csi=1'); await pm.waitForTimeout(4000);
  ok('celular: ?csi=1 abre el laboratorio', await pm.locator('#csi').isVisible());
  const W = devices['iPhone 13'].viewport.width;
  const ancho = await pm.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  ok('celular: sin desplazamiento horizontal de la página (ancho del aparato, no el ampliado)', ancho[0] <= W + 1 && ancho[1] <= W + 1, `${ancho.join(' / ')} vs ${W}`);
  await pm.locator('[data-pestana="predicciones"]').click(); await pm.waitForTimeout(300);
  const ancho2 = await pm.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  ok('celular: la tabla de predicciones se desplaza dentro de su caja, no la página', ancho2[0] <= W + 1, ancho2.join(' vs '));
  await foto(pm, 'csi-celular-predicciones', true);
  await c.close();

  // ---------------------------------------------------------------- pruebas.html
  const ph = await b.newPage(); vigilar(ph);
  await ph.goto(BASE + 'pruebas.html');
  await ph.waitForFunction(() => /pasaron/.test(document.body.innerText), null, { timeout: 90000 });
  const r = ((await ph.locator('body').innerText()).match(/(\d+) pasaron, (\d+) fallaron/) || []);
  ok('pruebas.html en Chromium: todas pasan (incluye las de CSI)', r[2] === '0' && Number(r[1]) > 0, r[0]);
  await b.close();
  for (const l of res) console.log(l);
  console.log(`errores: ${errs.length ? JSON.stringify(errs) : 'ninguno'}`);
  process.exit(res.some((l) => l.startsWith('FALLA')) || errs.length ? 1 : 0);
})();
