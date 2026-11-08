// Laboratorio de IA fase 2: departamento en el navegador (escritorio 3D, plano 2D, celular), pausa de la 3D, flujo
// DEMO de punta a punta, revisión humana, propuesta a Nexus, marcas DEMO/«no es IA» y pruebas.html completas.
// Con servir.py corriendo:  node pruebas/navegador/laboratorio.cjs      (SAL=carpeta para capturas, opcional)
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
    await p.route('**/datos/proyectos.local.json*', (r) => r.fulfill({ status: 404, body: '' }));
    await p.route('**/datos/reales/*.json*', (r) => r.fulfill({ status: 404, body: '' }));
  };
  const lab = (p) => p.locator('#laboratorio');
  const esperarCarga = async (p) => { for (let i = 0; i < 60 && !(await lab(p).locator('[data-trabajo]').count()); i++) await p.waitForTimeout(200); };

  // ---------------------------------------------------------------- Escritorio 3D
  const p = await b.newPage({ viewport: { width: 1366, height: 768 } });
  await preparar(p);
  await p.goto(BASE + '?medir=1&hora=11'); await p.waitForTimeout(6000);
  const cuadros = () => p.evaluate(() => window.__cauce3d?.metricas().cuadros_totales ?? -1);
  ok('el Laboratorio empieza cerrado y la oficina 3D se ve como antes', await lab(p).isHidden() && await p.locator('.vista3d').isVisible());
  await p.locator('#boton-laboratorio').click();
  await esperarCarga(p);
  ok('el botón abre el Laboratorio con aria-pressed y foco en su título', await lab(p).isVisible() && (await p.locator('#boton-laboratorio').getAttribute('aria-pressed')) === 'true' && await p.evaluate(() => document.activeElement?.id === 'laboratorio-titulo'));
  const c1 = await cuadros(); await p.waitForTimeout(1500); const c2 = await cuadros();
  ok('con el Laboratorio abierto la 3D no dibuja (pausa)', c1 >= 0 && c2 === c1, `${c1} → ${c2}`);
  const t = await lab(p).innerText();
  ok('marca visible: DEMO · SIN MODELO · NO ES IA', /DEMO · SIN MODELO · NO ES IA/.test(t));
  ok('4 trabajos DEMO de partida', (await lab(p).locator('[data-trabajo]').count()) === 4, String(await lab(p).locator('[data-trabajo]').count()));
  ok('estados de partida: 3 requieren revisión humana y 1 requiere evidencia', (await lab(p).locator('.lab-trabajos [data-estado="requiere_revision"]').count()) === 3 && (await lab(p).locator('.lab-trabajos [data-estado="requiere_evidencia"]').count()) === 1);
  ok('el botón muestra 4 trabajos que esperan a una persona', (await p.locator('#boton-laboratorio .boton-lab-contador').innerText()) === '4');
  ok('5 estaciones en el plano; en Compago las 5 tienen registro (persona sentada)', (await lab(p).locator('.lab-estacion').count()) === 5 && (await lab(p).locator('.lab-estacion[data-estado="trabajo_registrado"]').count()) === 5 && (await lab(p).locator('.lab-cabeza').count()) === 5);
  ok('flujo visible: Motor → … → Revisión humana «te espera»', /Revisión humana · te espera/.test(await lab(p).locator('.lab-flujo').innerText()));
  ok('hallazgos con citas comprobadas por lab-V y aviso de respaldo semántico', (await lab(p).locator('[data-cita="verificada"]').count()) >= 5 && /eso lo revisa una persona/.test(await lab(p).locator('.lab-cuerpo').innerText()));
  ok('no hay ningún botón «Aprobar» sin formulario: exige nombre y motivo', (await lab(p).locator('#lab-por').count()) === 1 && (await lab(p).locator('#lab-motivo').count()) === 1);
  await foto(p, 'lab-escritorio', true);

  // Aprobar sin motivo → se rechaza; con motivo → aprobado.
  await lab(p).locator('[data-decision="aprobado_por_humano"]').click(); await p.waitForTimeout(200);
  ok('aprobar sin motivo NO se registra (lo dice)', /No se registró/.test(await lab(p).locator('.lab-mensaje').innerText()) && (await lab(p).locator('[data-estado-detalle]').getAttribute('data-estado-detalle')) === 'requiere_revision');
  await lab(p).locator('#lab-motivo').fill('Revisé hallazgos, citas y objeciones del DEMO.');
  await lab(p).locator('[data-decision="aprobado_por_humano"]').click(); await p.waitForTimeout(300);
  ok('con nombre y motivo, la persona aprueba: el trabajo pasa a Terminados', (await lab(p).locator('[data-estado-detalle]').getAttribute('data-estado-detalle')) === 'aprobado_por_humano' && /Terminados \(decididos por una persona\) \(1\)/.test(await lab(p).innerText()));
  ok('el contador baja a 3', (await p.locator('#boton-laboratorio .boton-lab-contador').innerText()) === '3');
  await lab(p).locator('[data-accion="propuesta"]').click(); await p.waitForTimeout(300);
  ok('propuesta para Nexus: solo se prepara y Nexus la objeta (con_objeciones)', (await lab(p).locator('[data-dictamen]').getAttribute('data-dictamen')) === 'con_objeciones' && /no se escribe en el almacén de Nexus/.test(await lab(p).innerText()));

  // Prueba de lab-V: requiere evidencia; no se puede aprobar.
  await lab(p).locator('[data-trabajo="demo-lab-trb-prueba-lab-v"]').click(); await p.waitForTimeout(300);
  ok('prueba de lab-V: cita inventada y extracto alterado aparecen como «NO pudo comprobar»', (await lab(p).locator('[data-cita="no-verificada"]').count()) === 2);
  ok('requiere evidencia: no se ofrece «Aprobar informe»', (await lab(p).locator('[data-decision="aprobado_por_humano"]').count()) === 0 && (await lab(p).locator('[data-decision="requiere_evidencia"], [data-decision="pendiente"]').count()) >= 1);
  // Prueba de fallo: historial con error y reintento.
  await lab(p).locator('[data-trabajo="demo-lab-trb-prueba-fallo"]').click(); await p.waitForTimeout(200);
  await lab(p).locator('[data-pestana-lab="auditoria"]').click(); await p.waitForTimeout(200);
  const aud = await lab(p).locator('.lab-historial').innerText();
  ok('auditoría: el historial muestra Error y el reintento, y el contrato se cumple', /→ Error/.test(aud) && /Reintento/.test(aud) && /cumple cauce\.lab\.trabajo 0\.1/.test(await lab(p).locator('.lab-cuerpo').innerText()));
  ok('estación Investigador del trabajo con fallo: intentos registrados (silla ocupada)', (await lab(p).locator('.lab-estacion[data-rol="investigador"]').getAttribute('data-estado')) === 'trabajo_registrado');

  // Correr un trabajo nuevo paso a paso.
  await lab(p).locator('[data-accion="correr-demo"]').click();
  let vioActiva = false;
  for (let i = 0; i < 40; i++) { if (await lab(p).locator('.lab-estacion.lab-activa').count()) vioActiva = true; if (!(await lab(p).locator('[data-accion="detener"]').count()) && i > 2) break; await p.waitForTimeout(150); }
  ok('al correr, una estación se resalta mientras su rol trabaja', vioActiva);
  ok('el trabajo nuevo de la sesión termina en «Requiere revisión humana»', (await lab(p).locator('[data-estado-detalle]').getAttribute('data-estado-detalle')) === 'requiere_revision' && (await lab(p).locator('[data-trabajo]').count()) === 5);
  // Interrumpir y reanudar.
  await lab(p).locator('[data-accion="correr-ek"]').click(); await p.waitForTimeout(250);
  if (await lab(p).locator('[data-accion="detener"]').count()) await lab(p).locator('[data-accion="detener"]').click();
  for (let i = 0; i < 30 && await lab(p).locator('[data-accion="detener"]').count(); i++) await p.waitForTimeout(150);
  const tras = await lab(p).locator('[data-estado-detalle]').getAttribute('data-estado-detalle');
  ok('«Detener» deja el trabajo en Pendiente con lo ya hecho (o termina si ya acabó)', tras === 'pendiente' || tras === 'requiere_revision', tras);
  ok('modelos: sin-modelo (DEMO), manual, Ollama no instalado y API de pago inexistente', (await lab(p).locator('[data-adaptador]').count()) === 4 && /no instalado/.test(await lab(p).locator('.lab-adaptadores').textContent()));
  ok('lecturas REALES: ninguna, y Tezcatlipoca sin integración (dicho)', (await lab(p).locator('[data-reales="0"]').count()) === 1 && /Tezcatlipoca/.test(await lab(p).innerText()));

  // Tecla L, Esc y convivencia con Nexus/CSI/sala.
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  ok('Esc cierra el Laboratorio y la 3D vuelve a dibujar', await lab(p).isHidden() && await (async () => { const a = await cuadros(); await p.waitForTimeout(800); return (await cuadros()) > a; })());
  await p.keyboard.press('l'); await p.waitForTimeout(400);
  ok('la tecla L lo abre y conserva lo hecho en la sesión (5 trabajos o más)', await lab(p).isVisible() && (await lab(p).locator('[data-trabajo]').count()) >= 5);
  await p.locator('#boton-nexus').click(); await p.waitForTimeout(500);
  ok('abrir Nexus cierra el Laboratorio', await lab(p).isHidden() && await p.locator('#nexus').isVisible());
  await p.keyboard.press('l'); await p.waitForTimeout(400);
  ok('y al revés: L cierra Nexus', await lab(p).isVisible() && await p.locator('#nexus').isHidden());
  await p.close();

  // ---------------------------------------------------------------- Plano 2D directo con ?laboratorio=1
  const q = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await preparar(q);
  await q.addInitScript(() => { try { localStorage.setItem('cauce.vista', '2d'); } catch {} });
  await q.goto(BASE + '?laboratorio=1'); await esperarCarga(q);
  ok('?laboratorio=1 abre el Laboratorio también en el plano 2D', await lab(q).isVisible() && (await lab(q).locator('[data-trabajo]').count()) === 4);
  await q.close();

  // ---------------------------------------------------------------- Celular vertical
  const m = await b.newContext({ ...devices['Pixel 7'] });
  const c = await m.newPage(); await preparar(c);
  await c.goto(BASE + '?laboratorio=1'); await esperarCarga(c);
  const ancho = await c.evaluate(() => ({ doc: document.documentElement.scrollWidth, vista: window.innerWidth }));
  ok('celular: sin desbordar a lo ancho', ancho.doc <= ancho.vista + 1, JSON.stringify(ancho));
  ok('celular: plano de estaciones visible y botones de al menos 44 px', await lab(c).locator('.lab-area').isVisible() && (await lab(c).locator('[data-accion="correr-demo"]').boundingBox()).height >= 43);
  await foto(c, 'lab-celular', true);
  await m.close();

  // ---------------------------------------------------------------- pruebas.html
  const h = await b.newPage(); vigilar(h);
  await h.goto(BASE + 'pruebas.html');
  for (let i = 0; i < 120 && !/pasaron/.test(await h.locator('#resumen').innerText()); i++) await h.waitForTimeout(500);
  const r = await h.locator('#resumen').innerText();
  ok('pruebas.html en Chromium: todas pasan', /\b0 fallaron/.test(r), r);
  await h.close();

  ok('sin errores de JavaScript en la consola', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close();
  for (const x of res) console.log(x);
  const fallas = res.filter((x) => x.startsWith('FALLA')).length;
  console.log(`\n${res.length - fallas}/${res.length} OK`);
  process.exitCode = fallas ? 1 : 0;
})();
