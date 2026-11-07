// Fase M: capturas comparables (antes/después) de Compago y Ek Chuah, y conteo de recursos gráficos.
// Con servir.py corriendo:  SAL=carpeta node pruebas/navegador/fase-m-capturas.cjs
// Funciona igual en la versión anterior (fase L / rendimiento UHD) y en la nueva: solo usa controles que ya existían.
// SwiftShader (render por software): llamadas de dibujo, triángulos, geometrías y texturas SÍ son comparables con
// una GPU real; los cuadros por segundo NO (se anotan solo como referencia, nunca como rendimiento en Intel UHD).
const { chromium, devices } = require('playwright');
const fs = require('fs');
const SAL = process.env.SAL || 'capturas-m';
fs.mkdirSync(SAL, { recursive: true });
const URL = 'http://127.0.0.1:' + (process.env.PUERTO || 8765) + '/';
const PROYECTOS = [['compago', 'Compago', 'Importación'], ['ek-chuah', 'Ek Chuah', 'Riesgo']];

(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const metricas = {};
  const errores = [];
  const nueva = async (opts, proyecto) => {
    const p = await b.newPage(opts);
    p.on('pageerror', (e) => errores.push(String(e)));
    await p.route('**/datos/reales/*', (r) => r.fulfill({ status: 404, body: '' }));
    await p.addInitScript((id) => { try { localStorage.setItem('cauce.proyecto', id); localStorage.setItem('cauce.modo3d', 'edificio'); } catch {} }, proyecto);
    return p;
  };
  const medir = (p) => p.evaluate(() => { const m = window.__cauce3d?.metricas(); return m && { llamadas: m.llamadas, triangulos: m.triangulos, geometrias: m.geometrias, texturas: m.texturas, personajes: m.personajes, fps_swiftshader: m.fps_promedio }; });
  const foto = (p, n) => p.screenshot({ path: `${SAL}/${n}.png` });
  const ocultarMedidas = (p) => p.evaluate(() => { const m = document.querySelector('.vista3d-medidas'); if (m) m.hidden = true; });
  const cerrarSala = async (p) => { if (await p.locator('#sala-control').count() && await p.locator('#sala-control').isVisible()) { await p.locator('[data-cerrar-sala]').first().click(); await p.waitForTimeout(1500); } };

  for (const [id, nombre, dep] of PROYECTOS) {
    const p = await nueva({ viewport: { width: 1366, height: 768 } }, id);
    await p.goto(URL + '?medir=1&hora=11'); await p.waitForTimeout(7000);
    await cerrarSala(p);
    await ocultarMedidas(p);
    metricas[`${id}-edificio`] = await medir(p);
    await foto(p, `${id}-edificio`);
    // Acercamiento libre (rueda) al centro: muestra el detalle de muebles y arquitectura.
    await p.mouse.move(683, 420);
    for (let i = 0; i < 4; i++) { await p.mouse.wheel(0, -240); await p.waitForTimeout(150); }
    await p.waitForTimeout(1500);
    await foto(p, `${id}-acercamiento`);
    await p.keyboard.press('0'); await p.waitForTimeout(1500);
    if (await p.locator('[data-ir="recepcion"]').count()) { await p.locator('[data-ir="recepcion"]').first().click(); await p.waitForTimeout(1800); await foto(p, `${id}-recepcion`); await p.keyboard.press('0'); await p.waitForTimeout(1500); }
    await p.locator('.etiqueta-dep', { hasText: dep }).first().click().catch(() => {}); await p.waitForTimeout(2200);
    metricas[`${id}-oficina-enfocada`] = await medir(p);
    await foto(p, `${id}-oficina-enfocada`);
    await p.keyboard.press('Escape'); await p.keyboard.press('Escape'); await p.waitForTimeout(1200);
    await p.locator('.boton-inmersivo').click(); await p.waitForTimeout(2000);
    metricas[`${id}-inmersivo`] = await medir(p);
    await foto(p, `${id}-inmersivo`);
    await p.locator('#salir-inmersivo').click(); await p.waitForTimeout(500);
    await p.locator('[data-modo3d="individual"]').click(); await p.waitForTimeout(3000);
    metricas[`${id}-un-cuarto`] = await medir(p);
    await foto(p, `${id}-un-cuarto`);
    await p.locator('[data-modo3d="edificio"]').click(); await p.waitForTimeout(1500);
    // De noche (luz de la hora): las oficinas con la luz encendida.
    await p.goto(URL + '?medir=1&hora=22'); await p.waitForTimeout(6000);
    await cerrarSala(p); await ocultarMedidas(p);
    await foto(p, `${id}-noche`);
    await p.close();
  }
  for (const [n, d] of [['celular-vertical', devices['iPhone 12']], ['celular-horizontal', devices['iPhone 12 landscape']]]) {
    const p = await nueva({ ...d }, 'compago');
    await p.goto(URL + '?medir=1&hora=11'); await p.waitForTimeout(7000);
    await cerrarSala(p); await ocultarMedidas(p);
    metricas[n] = await medir(p);
    await foto(p, n);
    await p.close();
  }
  fs.writeFileSync(`${SAL}/metricas.json`, JSON.stringify({ metricas, errores }, null, 2));
  console.log(JSON.stringify({ metricas, errores }, null, 2));
  await b.close();
})();
