// K: capturas y conteo de recursos (antes/después). Con servir.py corriendo:
//   SAL=carpeta node pruebas/navegador/fase-k-capturas.cjs
// Escribe <SAL>/metricas.json y PNG de: edificio, oficina, personaje trabajando (DEMO), puesto sin actividad,
// panel de departamento, sala de control (si existe), celular vertical y horizontal, inmersivo y plano 2D.
// SwiftShader (render por software): llamadas de dibujo, triángulos, geometrías y texturas sí son comparables
// con una GPU real; los cuadros por segundo NO (se anotan solo como referencia).
const { chromium, devices } = require('playwright');
const SAL = process.env.SAL || 'capturas-k';
require('fs').mkdirSync(SAL, { recursive: true });
const URL = 'http://127.0.0.1:' + (process.env.PUERTO || 8765) + '/';
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const metricas = {};
  const errores = [];
  const nueva = async (opts) => {
    const p = await b.newPage(opts);
    p.on('pageerror', (e) => errores.push(String(e)));
    await p.route('**/datos/reales/*', (r) => r.fulfill({ status: 404, body: '' }));
    return p;
  };
  const medir = (p) => p.evaluate(() => { const m = window.__cauce3d?.metricas(); return m && { llamadas: m.llamadas, triangulos: m.triangulos, geometrias: m.geometrias, texturas: m.texturas, personajes: m.personajes, fps_swiftshader: m.fps_promedio }; });
  const foto = (p, n) => p.screenshot({ path: `${SAL}/${n}.png` });
  const ocultarMedidas = (p) => p.evaluate(() => { const m = document.querySelector('.vista3d-medidas'); if (m) m.hidden = true; });

  // Escritorio, Compago DEMO
  let p = await nueva({ viewport: { width: 1366, height: 768 } });
  await p.goto(URL + '?medir=1&hora=11'); await p.waitForTimeout(8000);
  const sala = await p.locator('#sala-control').count();
  if (sala && await p.locator('#sala-control').isVisible()) { await foto(p, 'sala-control'); await p.locator('[data-cerrar-sala]').first().click(); await p.waitForTimeout(1500); }
  await ocultarMedidas(p);
  metricas.edificio = await medir(p);
  await foto(p, 'edificio');
  // Recepción: acercar con el botón de la recepción si existe; si no, solo el edificio.
  if (await p.locator('[data-ir="recepcion"]').count()) { await p.locator('[data-ir="recepcion"]').first().click(); await p.waitForTimeout(1600); await foto(p, 'recepcion'); await p.keyboard.press('0'); await p.waitForTimeout(1500); }
  await p.locator('.etiqueta-dep', { hasText: 'Importación' }).first().click(); await p.waitForTimeout(2000);
  metricas.oficina_enfocada = await medir(p);
  await foto(p, 'oficina-y-panel-departamento');
  const pos = await p.evaluate(() => window.__cauce3d.proyectar('importador'));
  if (pos) { await p.mouse.click(pos.x, pos.y); await p.waitForTimeout(1800); }
  await foto(p, 'personaje-trabajando-demo');
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  // Puesto sin actividad: el evaluador es humano (silla vacía) en la DEMO de Compago.
  await p.locator('.etiqueta-dep', { hasText: 'Evaluación' }).first().click().catch(() => {}); await p.waitForTimeout(2000);
  await foto(p, 'puesto-sin-actividad');
  await p.keyboard.press('Escape'); await p.keyboard.press('Escape'); await p.waitForTimeout(1200);
  await p.locator('[data-modo3d="individual"]').click(); await p.waitForTimeout(3000);
  metricas.un_cuarto = await medir(p);
  await foto(p, 'un-cuarto');
  await p.locator('[data-modo3d="edificio"]').click(); await p.waitForTimeout(2500);
  await p.locator('.boton-inmersivo').click(); await p.waitForTimeout(1500);
  metricas.inmersivo = await medir(p);
  await foto(p, 'inmersivo');
  await p.locator('#salir-inmersivo').click(); await p.waitForTimeout(500);
  await p.locator('[data-vista="2d"]').click(); await p.waitForTimeout(1200);
  await foto(p, 'plano-2d');
  await p.locator('[data-vista="3d"]').click(); await p.waitForTimeout(1500);
  await p.close();

  // Celular vertical y horizontal
  for (const [n, d] of [['celular-vertical', devices['iPhone 12']], ['celular-horizontal', devices['iPhone 12 landscape']]]) {
    p = await nueva({ ...d });
    await p.goto(URL + '?medir=1&hora=11'); await p.waitForTimeout(8000);
    if (await p.locator('#sala-control').count() && await p.locator('#sala-control').isVisible()) { await foto(p, `${n}-sala`); await p.locator('[data-cerrar-sala]').first().click(); await p.waitForTimeout(1500); }
    await ocultarMedidas(p);
    metricas[n] = await medir(p);
    await foto(p, n);
    await p.close();
  }
  require('fs').writeFileSync(`${SAL}/metricas.json`, JSON.stringify({ metricas, errores }, null, 2));
  console.log(JSON.stringify({ metricas, errores }, null, 2));
  await b.close();
})();
