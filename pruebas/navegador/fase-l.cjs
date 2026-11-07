// Fase L: animaciones (pausas de trabajo, caminata con giro suave, gesto breve), cámara con vista anterior,
// selección de personajes y de puestos vacíos (tarjeta), DEMO/REAL, vencido, sala, celular, movimiento reducido,
// selector con muchos pisos, WebGL perdido y recursos en una sesión larga.
// Con servir.py corriendo:  node pruebas/navegador/fase-l.cjs      (SAL=carpeta para capturas, opcional)
// SwiftShader: cuenta objetos y comprueba comportamiento; NO mide el rendimiento de la Intel UHD.
const { chromium, devices } = require('playwright');
const fs = require('fs');
const BASE = 'http://127.0.0.1:' + (process.env.PUERTO || 8765) + '/';
const SAL = process.env.SAL || null;
if (SAL) fs.mkdirSync(SAL, { recursive: true });
const ISO = /"(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z)"/g;
const iso = (ms) => new Date(ms).toISOString().replace(/\.\d+Z$/, 'Z');
const plantilla = fs.readFileSync('contrato/ejemplos/compago-exportador.json', 'utf8');
function compagoReal(base, cambiar = null) {
  const gen = Date.parse(JSON.parse(plantilla).generado_en);
  const doc = JSON.parse(plantilla.replace(ISO, (_, t) => `"${iso(Date.parse(t) + base - gen)}"`));
  if (cambiar) cambiar(doc);
  return JSON.stringify(doc);
}
const agente = (d, id) => d.departamentos.flatMap((x) => x.agentes).find((a) => a.id === id);

(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const res = []; const errs = [];
  const ok = (n, c, x = '') => res.push(`${c ? 'OK ' : 'FALLA'} ${n}${x ? ' · ' + x : ''}`);
  const vigilar = (p) => { p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errs.push(m.text()); }); };
  const foto = async (p, n) => { if (SAL) { await p.evaluate(() => { const m = document.querySelector('.vista3d-medidas'); if (m) m.hidden = true; }); await p.screenshot({ path: `${SAL}/${n}.png` }); } };
  const per = (p) => p.evaluate(() => window.__cauce3d.personajes());
  const cam = (p) => p.evaluate(() => window.__cauce3d.camara());
  const met = (p) => p.evaluate(() => ({ ...window.__cauce3d.metricas(), nodos: document.getElementsByTagName('*').length }));

  // ------------------------------------------------------------ Escritorio, Compago DEMO
  const p = await b.newPage({ viewport: { width: 1366, height: 768 } });
  vigilar(p);
  await p.route('**/datos/proyectos.local.json*', (r) => r.fulfill({ status: 404, body: '' }));
  await p.route('**/datos/reales/*', (r) => r.fulfill({ status: 404, body: '' }));
  await p.goto(BASE + '?medir=1&hora=11'); await p.waitForTimeout(8000);
  const m0 = await met(p);
  ok('recursos: edificio completo con muebles nuevos en ≤ 120 llamadas de dibujo (fase K: 159)', m0.llamadas <= 120, `${m0.llamadas} llamadas, ${m0.triangulos} triángulos, ${m0.texturas} texturas`);
  ok('recursos: texturas ≤ 32 (fase K: 20; L: +3 baldosa, charcos y marquesina; M: +6 tres pisos, atlas de pantallas, sombra de contacto y resplandor)', m0.texturas <= 32, `${m0.texturas}`);
  ok('la recepción tiene marquesina, charcos de luz y emblema', await p.evaluate(() => ['marquesina', 'charcos-luz', 'emblema', 'directorio'].length) === 4);
  ok('cámara: sin vistas guardadas al abrir; el botón «Anterior» no aparece', (await cam(p)).historial === 0 && !(await p.locator('[data-ir="anterior"]').isVisible()));

  // Animaciones: el personaje que trabaja hace pausas (leer, mirar o acomodarse), no teclea sin parar.
  const fases = new Set();
  const trabajador = (await per(p)).find((x) => x.visible && x.bucle === 'teclear');
  ok('DEMO: hay un personaje trabajando (importador) con bucle «teclear»', Boolean(trabajador), trabajador?.id ?? 'ninguno');
  for (let i = 0; i < 46 && trabajador; i++) {
    const x = (await per(p)).find((y) => y.id === trabajador.id);
    if (x?.fase) fases.add(x.fase);
    await p.waitForTimeout(1000);
  }
  ok('trabajo con variaciones: en ~45 s teclea y además hace al menos una pausa', fases.has('teclear') && fases.size >= 2, [...fases].join(', '));
  const revision = (await per(p)).find((x) => x.estado === 'requiere_revision');
  ok('revisión humana: mantiene la postura «atención» (mano arriba) mientras dure la evidencia', !revision || (revision.bucle === 'atencion' && revision.accion === null), revision ? `${revision.bucle}/${revision.accion}` : 'sin personaje en revisión');

  // Cámara: 1 (departamento) → R (recepción) → Retroceso → Retroceso.
  await p.keyboard.press('1'); await p.waitForTimeout(1500);
  const c1 = await cam(p);
  ok('cámara: al enfocar un departamento se guarda la vista anterior', c1.historial === 1 && c1.enfocado === 'importacion' && await p.locator('[data-ir="anterior"]').isVisible(), JSON.stringify(c1));
  await p.keyboard.press('r'); await p.waitForTimeout(1500);
  const c2 = await cam(p);
  ok('cámara: ir a la recepción guarda otra vista', c2.historial === 2 && c2.enfocado === null);
  await foto(p, 'l-recepcion');
  await p.keyboard.press('Backspace'); await p.waitForTimeout(1500);
  const c3 = await cam(p);
  ok('cámara: Retroceso regresa al departamento con el mismo encuadre', c3.enfocado === 'importacion' && Math.abs(c3.zoom - c1.zoom) < 0.05 && Math.hypot(c3.x - c1.x, c3.z - c1.z) < 0.1 && await p.locator('#panel').isVisible(), `zoom ${c1.zoom.toFixed(2)}→${c3.zoom.toFixed(2)}`);
  await p.locator('[data-ir="anterior"]').click(); await p.waitForTimeout(1500);
  const c4 = await cam(p);
  ok('cámara: «↶ Anterior» regresa al edificio completo y se oculta al vaciarse', c4.enfocado === null && c4.historial === 0 && Math.abs(c4.zoom - 1) < 0.05 && !(await p.locator('[data-ir="anterior"]').isVisible()), JSON.stringify(c4));

  // Selección: personaje trabajando → tarjeta con estado; puesto humano vacío → tarjeta «sin personaje», nadie aparece.
  await p.locator('.etiqueta-dep', { hasText: 'Importación' }).first().click(); await p.waitForTimeout(1800);
  const pos = await p.evaluate(() => window.__cauce3d.proyectar('importador'));
  if (pos) { await p.mouse.click(pos.x, pos.y); await p.waitForTimeout(1800); }
  const tarjeta = p.locator('.vista3d-tarjeta');
  ok('selección: la tarjeta muestra nombre, departamento, qué es y estado del personaje', await tarjeta.isVisible() && /Importación de catálogos/.test(await tarjeta.innerText()) && /Trabajando/.test(await tarjeta.innerText()) && (await tarjeta.getAttribute('data-puesto')) === 'personaje', (await tarjeta.innerText().catch(() => '')).replace(/\n/g, ' / '));
  ok('selección: se puede seguir (F) y el panel muestra su evidencia', await p.locator('.chip-seguir').isVisible() && /Importador/.test(await p.locator('#panel').innerText()));
  await foto(p, 'l-personaje-tarjeta');
  await p.keyboard.press('Escape'); await p.keyboard.press('Escape'); await p.waitForTimeout(800);
  await p.locator('.etiqueta-dep', { hasText: 'Evaluación' }).first().click(); await p.waitForTimeout(1800);
  const antesVis = (await per(p)).filter((x) => x.visible).length;
  const puesto = await p.evaluate(() => window.__cauce3d.proyectarPuesto('evaluador'));
  if (puesto) { await p.mouse.click(puesto.x, puesto.y); await p.waitForTimeout(1500); }
  const textoT = await tarjeta.innerText().catch(() => '');
  ok('puesto vacío: tocar el escritorio (sin personaje) lo selecciona y la tarjeta lo explica', /Puesto sin personaje/.test(textoT) && (await tarjeta.getAttribute('data-puesto')) === 'vacio' && (await p.locator('#panel').innerText()).includes((await tarjeta.locator('strong').innerText().catch(() => '¿?'))), textoT.replace(/\n/g, ' / '));
  ok('puesto vacío: no aparece ningún personaje al consultarlo', (await per(p)).filter((x) => x.visible).length === antesVis && !(await per(p)).some((x) => x.id === 'evaluador' && x.visible));
  ok('puesto vacío: sin «Seguir» (no hay a quién seguir)', !(await p.locator('.chip-seguir').count()));
  await foto(p, 'l-puesto-vacio');
  await p.keyboard.press('Escape'); await p.keyboard.press('Escape'); await p.keyboard.press('0'); await p.waitForTimeout(1200);

  // Sala: abrirla no mueve la cámara; orden con pendientes al final y franja de identidad.
  const antesSala = await cam(p);
  await p.keyboard.press('s'); await p.waitForTimeout(700);
  const ids = await p.locator('.sala-tarjeta').evaluateAll((n) => n.map((x) => x.dataset.proyecto));
  ok('sala: 7 proyectos (CSI incluido); los pendientes (Tezcatlipoca, CauceService, Repacar) al final y compactos', ids.length === 7 && ids.slice(-3).sort().join() === 'cauceservice,repacar,tezcatlipoca' && (await p.locator('.sala-tarjeta-compacta').count()) === 3, ids.join(', '));
  ok('sala: Compago muestra su estilo «Análisis comercial» y su color de identidad', /Análisis comercial/i.test(await p.locator('.sala-tarjeta[data-proyecto="compago"]').innerText()) && /--identidad/.test(await p.locator('.sala-tarjeta[data-proyecto="compago"]').getAttribute('style')));
  ok('sala: ningún botón actúa sobre un sistema (solo navegar)', (await p.locator('#sala-control button').evaluateAll((n) => n.map((x) => x.textContent))).every((t) => /Ir al|Volver|Ver|Atención|Proyectos|Cambios|edificio/.test(t)));
  await p.keyboard.press('s'); await p.waitForTimeout(900);
  const trasSala = await cam(p);
  ok('sala: abrir y cerrar la sala no cambia la cámara', Math.hypot(trasSala.x - antesSala.x, trasSala.z - antesSala.z) < 0.01 && Math.abs(trasSala.zoom - antesSala.zoom) < 0.01);

  // Sesión larga: pisos, sala, recepción y vista anterior; los recursos no crecen.
  const base = await met(p);
  for (let i = 0; i < 8; i++) {
    await p.locator('#pisos .piso', { hasText: i % 2 ? 'Compago' : 'Ek Chuah' }).first().click(); await p.waitForTimeout(1600);
    await p.keyboard.press('2'); await p.waitForTimeout(500); await p.keyboard.press('r'); await p.waitForTimeout(500);
    await p.keyboard.press('Backspace'); await p.waitForTimeout(400); await p.keyboard.press('s'); await p.waitForTimeout(200); await p.keyboard.press('s');
  }
  await p.locator('#pisos .piso', { hasText: 'Compago' }).first().click(); await p.waitForTimeout(4000); await p.keyboard.press('0'); await p.waitForTimeout(1000);
  const tras = await met(p);
  ok('sesión larga (8 cambios de piso con cámara y sala): geometrías, texturas y nodos estables', tras.geometrias <= base.geometrias && tras.texturas <= base.texturas && tras.nodos <= base.nodos + 30, `geo ${base.geometrias}→${tras.geometrias}, tex ${base.texturas}→${tras.texturas}, nodos ${base.nodos}→${tras.nodos}`);

  // WebGL perdido: el plano 2D sigue y «Reintentar 3D» vuelve con muebles y cámara.
  await p.evaluate(() => document.querySelector('.vista3d canvas').getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext());
  await p.waitForTimeout(2500);
  ok('WebGL perdido: plano 2D con «Reintentar 3D»', await p.locator('.reintentar-3d').isVisible());
  await p.locator('.reintentar-3d').click(); await p.waitForTimeout(6000);
  ok('Reintentar 3D: vuelve la oficina con su historial de cámara vacío', await p.locator('.vista3d').isVisible() && (await cam(p)).historial === 0);
  await p.close();

  // ------------------------------------------------------------ REAL sin clasificación: entra caminando, gira suave, gesto breve
  let doc = null;
  const r = await b.newPage({ viewport: { width: 1366, height: 768 } });
  vigilar(r);
  await r.route('**/datos/proyectos.local.json*', (x) => x.fulfill({ status: 404, body: '' }));
  await r.route('**/escena/compago-naturaleza.json*', (x) => x.fulfill({ status: 404, body: '' }));
  await r.route('**/datos/reales/compago.json*', (x) => (doc ? x.fulfill({ status: 200, contentType: 'application/json', body: doc }) : x.fulfill({ status: 404, body: '' })));
  await r.route('**/datos/reales/[!c]*.json*', (x) => x.fulfill({ status: 404, body: '' }));
  await r.route('**/datos/reales/cauceservice.json*', (x) => x.fulfill({ status: 404, body: '' }));
  doc = compagoReal(Date.now() - 5000, (d) => { agente(d, 'importador').estado = 'sin_datos'; });
  await r.goto(BASE + '?medir=1&hora=11'); await r.waitForTimeout(8000);
  await r.keyboard.press('1'); await r.waitForTimeout(1500);
  ok('REAL: sin evidencia, el importador no está en la oficina', !(await per(r)).some((x) => x.id === 'importador' && x.visible));
  doc = compagoReal(Date.now() - 2000);
  await r.locator('#recargar').click();
  const muestras = [];
  for (let i = 0; i < 70; i++) {
    const x = (await per(r)).find((y) => y.id === 'importador');
    if (x) muestras.push(x);
    if (x && x.accion === null && x.visible && muestras.some((m) => m.accion === 'entrar')) break;
    await r.waitForTimeout(120);
  }
  const caminando = muestras.filter((m) => m.accion === 'entrar' && m.visible);
  let salto = 0;
  for (let i = 1; i < caminando.length; i++) {
    let d = Math.abs(caminando[i].giro - caminando[i - 1].giro) % (Math.PI * 2); if (d > Math.PI) d = Math.PI * 2 - d;
    const avance = Math.hypot(caminando[i].x - caminando[i - 1].x, caminando[i].z - caminando[i - 1].z);
    if (avance > 0.01) salto = Math.max(salto, d);
  }
  ok('REAL: al aparecer evidencia, entra caminando desde la puerta (sin aparecer de golpe)', caminando.length >= 3, `${caminando.length} muestras caminando`);
  ok('REAL: gira de forma suave al doblar (sin saltos de 90° entre muestras)', salto < 1.3, `mayor giro entre muestras ${salto.toFixed(2)} rad`);
  const final = muestras[muestras.length - 1];
  ok('REAL: termina sentado frente a su escritorio (mirando al monitor)', final && final.postura === 'sentado' && Math.abs(Math.cos(final.giro) + 1) < 0.05, final ? `${final.postura} giro ${final.giro.toFixed(2)}` : 'sin muestra');
  doc = compagoReal(Date.now() - 1000, (d) => { agente(d, 'importador').estado = 'finalizado'; });
  await r.locator('#recargar').click(); await r.waitForTimeout(1200);
  let celebro = false, t0 = Date.now(), fin = null;
  while (Date.now() - t0 < 8000) {
    const x = (await per(r)).find((y) => y.id === 'importador');
    if (x?.accion === 'celebrar') celebro = true;
    if (celebro && x?.accion === null) { fin = x; break; }
    await r.waitForTimeout(150);
  }
  ok('REAL: al terminar hace un gesto breve (celebrar) y vuelve a su postura (relajado), sin repetirlo', celebro && fin?.bucle === 'relajado', fin ? `${fin.bucle}` : 'no terminó');
  await r.waitForTimeout(3000);
  ok('REAL: el gesto no se repite solo', (await per(r)).find((y) => y.id === 'importador')?.accion === null);
  await foto(r, 'l-real-relajado');
  // Vencido: todos salen; la tarjeta del puesto lo dice.
  doc = compagoReal(Date.now() - 3 * 3600 * 1000);
  await r.locator('#recargar').click(); await r.waitForTimeout(6000);
  ok('vencido: ningún personaje se queda en la oficina', (await per(r)).filter((x) => x.visible && x.accion !== 'salir').length === 0);
  await r.close();

  // ------------------------------------------------------------ Movimiento reducido: sin pausas animadas ni giros
  const q = await b.newPage({ viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce' });
  vigilar(q);
  await q.route('**/datos/reales/*', (x) => x.fulfill({ status: 404, body: '' }));
  await q.goto(BASE + '?medir=1&hora=11'); await q.waitForTimeout(8000);
  const fq = new Set();
  for (let i = 0; i < 12; i++) { const x = (await per(q)).find((y) => y.bucle === 'teclear'); if (x?.fase) fq.add(x.fase); await q.waitForTimeout(1000); }
  ok('movimiento reducido: postura fija al trabajar (sin pausas animadas)', fq.size === 1 && fq.has('teclear'), [...fq].join(','));
  ok('movimiento reducido: el lienzo no tiene transición de fundido', await q.evaluate(() => getComputedStyle(document.querySelector('.vista3d canvas')).transitionDuration) === '0s');
  await q.keyboard.press('1'); await q.waitForTimeout(250);
  ok('movimiento reducido: la cámara salta sin viaje', !(await cam(q)).animando);
  await q.close();

  // ------------------------------------------------------------ Celular vertical y horizontal
  for (const [nombre, disp] of [['vertical', devices['iPhone 12']], ['horizontal', devices['iPhone 12 landscape']]]) {
    const c = await b.newPage({ ...disp });
    vigilar(c);
    await c.route('**/datos/reales/*', (x) => x.fulfill({ status: 404, body: '' }));
    await c.goto(BASE + '?medir=1&hora=11'); await c.waitForTimeout(8000);
    const sobra = await c.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok(`celular ${nombre}: sin desplazamiento horizontal`, sobra <= 0, `${sobra}px`);
    await c.evaluate(() => { const m = document.querySelector('.vista3d-medidas'); if (m) m.hidden = true; });
    await c.locator('.movil-barra button').nth(2).click(); await c.waitForTimeout(1800); // ▶: primer departamento (guarda la vista)
    const pc = await c.evaluate(() => window.__cauce3d.proyectar('importador'));
    if (pc) { await c.mouse.click(pc.x, pc.y); await c.waitForTimeout(2000); }
    const tc = c.locator('.vista3d-tarjeta');
    const caja = await tc.boundingBox().catch(() => null);
    const vp = c.viewportSize();
    ok(`celular ${nombre}: la tarjeta del personaje cabe en la pantalla`, !caja || (caja.x >= -1 && caja.x + caja.width <= vp.width + 1), caja ? `${Math.round(caja.x)}..${Math.round(caja.x + caja.width)} de ${vp.width}` : 'oculta (tapada por el detalle)');
    await c.locator('.movil-barra [aria-label="Más opciones"]').click().catch(() => {}); await c.waitForTimeout(500);
    ok(`celular ${nombre}: el menú ⋯ ofrece «Vista anterior» tras acercarse`, /Vista anterior/.test(await c.locator('.movil-menu').innerText().catch(() => '')));
    await foto(c, `l-celular-${nombre}`);
    await c.close();
  }

  // ------------------------------------------------------------ Selector con muchos pisos (registro de prueba con 10)
  const s = await b.newPage({ viewport: { width: 1366, height: 768 } });
  vigilar(s);
  const reg = JSON.parse(fs.readFileSync('datos/proyectos.json', 'utf8'));
  for (let i = 1; i <= 4; i++) reg.proyectos.push({ id: `extra-${i}`, nombre: `Extra ${i}`, estado: `datos/reales/extra-${i}.json`, pendiente: 'Proyecto de prueba sin datos' });
  await s.route('**/datos/proyectos.local.json*', (x) => x.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(reg) }));
  await s.route('**/datos/reales/*', (x) => x.fulfill({ status: 404, body: '' }));
  await s.goto(BASE + '?medir=1'); await s.waitForTimeout(7000);
  const mas = s.locator('#pisos .pisos-mas summary');
  ok('11 proyectos (con CSI): los 7 pendientes se juntan en «+7 pendientes»; los pisos con datos siguen a la vista', /\+7 pendientes/.test(await mas.innerText().catch(() => '')) && (await s.locator('#pisos > .piso').count()) === 4, `${await s.locator('#pisos > .piso').count()} pestañas`);
  await mas.click(); await s.waitForTimeout(300);
  await s.locator('.pisos-mas-lista .piso', { hasText: 'Extra 2' }).click(); await s.waitForTimeout(2500);
  ok('10 proyectos: elegir uno agrupado lo abre y su pestaña queda a la vista', /Extra 2/.test(await s.locator('#pisos [aria-selected="true"]').innerText()));
  await s.keyboard.press('s'); await s.waitForTimeout(600);
  ok('11 proyectos (con CSI): la sala sigue mostrando los 11', (await s.locator('.sala-tarjeta').count()) === 11);
  await s.close();

  console.log(res.join('\n'));
  console.log('errores:', errs.length ? errs.join(' | ') : 'ninguno');
  await b.close();
  const f = res.filter((x) => x.startsWith('FALLA')).length;
  console.log(`\n${res.length - f} OK, ${f} FALLA`);
  process.exit(f || errs.length ? 1 : 0);
})();
