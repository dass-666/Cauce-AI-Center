// Fase K: sala de control, navegación, paneles con historial de la sesión, celular, WebGL perdido y sesión larga.
// Con servir.py corriendo:  node pruebas/navegador/fase-k.cjs      (SAL=carpeta para capturas, opcional)
// SwiftShader: cuenta objetos y comprueba comportamiento; NO mide el rendimiento de la Intel UHD.
const { chromium, devices } = require('playwright');
const fs = require('fs');
const BASE = 'http://127.0.0.1:' + (process.env.PUERTO || 8765) + '/';
const SAL = process.env.SAL || null;
if (SAL) fs.mkdirSync(SAL, { recursive: true });
const ISO = /"(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z)"/g;
const iso = (ms) => new Date(ms).toISOString().replace(/\.\d+Z$/, 'Z');
const plantilla = fs.readFileSync('contrato/ejemplos/compago-exportador.json', 'utf8');
/** El exportador real de Compago (ejemplo del contrato) movido a la hora `base`; `cambiar` edita el documento. */
function compagoReal(base, cambiar = null) {
  const gen = Date.parse(JSON.parse(plantilla).generado_en);
  const doc = JSON.parse(plantilla.replace(ISO, (_, t) => `"${iso(Date.parse(t) + base - gen)}"`));
  if (cambiar) cambiar(doc);
  return JSON.stringify(doc);
}

(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const res = []; const errs = [];
  const ok = (n, c, x = '') => res.push(`${c ? 'OK ' : 'FALLA'} ${n}${x ? ' · ' + x : ''}`);
  const vigilar = (p) => { p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errs.push(m.text()); }); };
  const foto = async (p, n) => { if (SAL) await p.screenshot({ path: `${SAL}/${n}.png` }); };

  // ---------------------------------------------------------------- Escritorio con DEMO
  let compago = null, cortar = 0;
  const p = await b.newPage({ viewport: { width: 1366, height: 768 } });
  vigilar(p);
  await p.route('**/datos/proyectos.local.json*', (r) => r.fulfill({ status: 404, body: '' }));
  await p.route('**/datos/reales/compago.json*', (r) => {
    if (compago === null) return r.fulfill({ status: 404, body: '' });
    const cuerpo = cortar > 0 ? compago.slice(0, Math.floor(compago.length / 2)) : compago;
    if (cortar > 0) cortar--;
    return r.fulfill({ status: 200, contentType: 'application/json', body: cuerpo });
  });
  await p.route('**/datos/reales/[!c]*.json*', (r) => r.fulfill({ status: 404, body: '' }));
  await p.route('**/datos/reales/cauceservice.json*', (r) => r.fulfill({ status: 404, body: '' }));
  await p.goto(BASE + '?medir=1&hora=11'); await p.waitForTimeout(7000);
  const sala = () => p.locator('#sala-control');
  const abierta = () => sala().isVisible();
  const cuadros = () => p.evaluate(() => window.__cauce3d?.metricas().cuadros_totales ?? -1);

  ok('la sala empieza cerrada (la oficina 3D se ve igual que antes)', !(await abierta()) && await p.locator('.vista3d').isVisible());
  await p.locator('#boton-sala').click(); await p.waitForTimeout(800);
  let texto = await sala().innerText();
  ok('botón «Sala de control» la abre, con aria-pressed y foco en su título', await abierta() && (await p.locator('#boton-sala').getAttribute('aria-pressed')) === 'true' && await p.evaluate(() => document.activeElement?.id === 'sala-titulo'));
  ok('sala: los 7 proyectos registrados (CSI incluido)', (await p.locator('.sala-tarjeta').count()) === 7, `${await p.locator('.sala-tarjeta').count()}`);
  ok('sala: Compago y Ek Chuah DEMO; Tezcatlipoca, CauceService y Repacar «Pendiente»; Montambre sin conexión',
    /DEMO/.test(await p.locator('.sala-tarjeta[data-proyecto="compago"]').innerText()) && /DEMO/.test(await p.locator('.sala-tarjeta[data-proyecto="ek-chuah"]').innerText())
    && (await Promise.all(['tezcatlipoca', 'cauceservice', 'repacar'].map((id) => p.locator(`.sala-tarjeta[data-proyecto="${id}"]`).innerText()))).every((t) => /Pendiente/.test(t) && /Sin conexión/.test(t))
    && /Sin conexión/.test(await p.locator('.sala-tarjeta[data-proyecto="montambre"]').innerText()));
  ok('sala: Repacar no se da por uno ni dos proyectos (lo dice su nota)', /uno o dos proyectos/.test(await p.locator('.sala-tarjeta[data-proyecto="repacar"]').innerText()));
  ok('sala: DEMO y REAL no se suman (0 trabajando REAL; los de DEMO aparte y marcados «simulado»)', /0\s*procesos trabajando \(REAL\)/.test(texto) && /trabajando en DEMO \(simulado\)/.test(texto));
  ok('sala: los asuntos de DEMO llevan la insignia DEMO', (await p.locator('.sala-item .tablero-insignia.es-demo').count()) > 0);
  ok('sala: sin botones que actúen sobre sistemas (solo Ir/Ver/Cerrar)', (await p.locator('#sala-control button').allInnerTexts()).every((t) => /^(‹ Volver a oficinas|Ir al edificio|Ir al piso|Volver a este piso|Ver departamento|Ver piso|Ver)\b/.test(t.trim())));
  ok('sala: el contador del botón no cuenta asuntos de DEMO', await p.locator('#boton-sala .sala-contador').isHidden());
  const c0 = await cuadros(); await p.waitForTimeout(1200); const c1 = await cuadros();
  ok('con la sala abierta la 3D no dibuja (no gasta tarjeta gráfica)', c1 === c0, `${c0}→${c1}`);
  await foto(p, 'sala-control');
  await p.keyboard.press('Escape'); await p.waitForTimeout(800);
  const c2 = await cuadros(); await p.waitForTimeout(1000);
  ok('Esc cierra la sala y la 3D vuelve a dibujar', !(await abierta()) && (await cuadros()) > c2);
  await p.keyboard.press('s'); await p.waitForTimeout(600);
  ok('la tecla S abre la sala', await abierta());
  await p.locator('.sala-tarjeta[data-proyecto="ek-chuah"] .sala-ir').click(); await p.waitForTimeout(4500);
  ok('«Ir al piso» de Ek Chuah cierra la sala, cambia de piso y lo anuncia', !(await abierta())
    && (await p.locator('#pisos .piso[aria-selected="true"]').innerText()).includes('Ek Chuah') && /Piso Ek Chuah/.test(await p.locator('#llegada').innerText()));
  await p.keyboard.press('s'); await p.waitForTimeout(600);
  await p.locator('.sala-item', { hasText: 'Compago' }).filter({ hasText: 'Revisión de listas' }).first().locator('button').click(); await p.waitForTimeout(4500);
  ok('un asunto de la sala lleva a su piso y abre su departamento', (await p.locator('#pisos .piso[aria-selected="true"]').innerText()).includes('Compago')
    && /Revisión de listas/.test(await p.locator('#panel').innerText()));
  const panel = await p.locator('#panel').innerText();
  ok('panel: proyecto y DEMO arriba, fuente y vigencia, historial de la sesión', /COMPAGO · DEPARTAMENTO/i.test(panel) && /DEMO/.test(panel) && /Fuente/.test(panel) && /vigencia/.test(panel) && /Cambios observados en esta sesión/i.test(panel) && /no es un historial permanente/i.test(panel));
  await foto(p, 'panel-departamento');

  // Navegación de cámara
  const objetivo = () => p.evaluate(() => { const m = window.__cauce3d.metricas(); return `${m.enfocado}`; });
  await p.keyboard.press('Escape'); await p.waitForTimeout(300); await p.keyboard.press('0'); await p.waitForTimeout(1200);
  ok('tecla 0: edificio completo, sin departamento enfocado', (await objetivo()) === 'null' && await p.locator('#panel').isHidden());
  const caja0 = await p.evaluate(() => window.__cauce3d.cajaEdificio());
  await p.keyboard.press('r'); await p.waitForTimeout(1400);
  const caja1 = await p.evaluate(() => window.__cauce3d.cajaEdificio());
  ok('tecla R: la cámara se acerca a la recepción (el edificio se ve más grande)', (caja1.der - caja1.izq) > (caja0.der - caja0.izq) * 1.3, `${Math.round(caja0.der - caja0.izq)}→${Math.round(caja1.der - caja1.izq)} px`);
  await foto(p, 'recepcion');
  await p.keyboard.press('a'); await p.waitForTimeout(1500);
  const primero = await objetivo();
  await p.keyboard.press('a'); await p.waitForTimeout(1500);
  const segundo = await objetivo();
  ok('tecla A: recorre los departamentos con alertas o revisiones', primero !== 'null' && segundo !== 'null' && primero !== segundo, `${primero} → ${segundo}`);
  await p.locator('[data-ir="alerta"]').click(); await p.waitForTimeout(1200);
  ok('botón ⚠ con nombre accesible y misma acción', (await p.locator('[data-ir="alerta"]').getAttribute('aria-label')) === 'Siguiente alerta' && (await objetivo()) !== segundo);
  await p.keyboard.press('Escape'); await p.keyboard.press('0'); await p.waitForTimeout(1200);
  await p.locator('.etiqueta-dep', { hasText: 'Importación' }).first().click(); await p.waitForTimeout(1500);
  await p.locator('.vista3d-personajes .chip', { hasText: 'Importador' }).click(); await p.waitForTimeout(1500);
  ok('al elegir un personaje con evidencia aparece «Seguir»', await p.locator('.chip-seguir').isVisible());
  await p.keyboard.press('f'); await p.waitForTimeout(500);
  ok('tecla F: «Siguiendo» (aria-pressed)', (await p.locator('.chip-seguir').getAttribute('aria-pressed')) === 'true');
  await foto(p, 'personaje-trabajando-demo');
  const lz = await p.locator('canvas').first().boundingBox();
  await p.mouse.move(lz.x + 300, lz.y + 300); await p.mouse.down(); await p.mouse.move(lz.x + 360, lz.y + 330, { steps: 4 }); await p.mouse.up(); await p.waitForTimeout(400);
  ok('mover la cámara a mano apaga el seguimiento', (await p.locator('.chip-seguir').getAttribute('aria-pressed')) === 'false');
  const ag = await p.locator('#panel').innerText();
  ok('panel del personaje: qué es (automático), desde la última evidencia y fuente', /Proceso automático/.test(ag) && /Desde la última evidencia/.test(ag) && /Fuente/.test(ag));
  await p.keyboard.press('Escape'); await p.keyboard.press('Escape'); await p.waitForTimeout(800);
  // Puesto humano: nunca aparece como agente con actividad.
  await p.locator('.etiqueta-dep', { hasText: 'Evaluación' }).first().click(); await p.waitForTimeout(1500);
  const per = await p.evaluate(() => window.__cauce3d.personajes());
  ok('puesto humano (evaluador): sin personaje visible en DEMO', !per.some((x) => x.id === 'evaluador' && x.visible));
  await foto(p, 'puesto-sin-actividad');
  await p.keyboard.press('Escape'); await p.keyboard.press('0'); await p.waitForTimeout(600);

  // ---------------------------------------------------------------- REAL: cambios observados, historial y vencido
  compago = compagoReal(Date.now() - 4000);
  await p.locator('#recargar').click(); await p.waitForTimeout(2500);
  compago = compagoReal(Date.now() - 2000, (d) => {
    d.departamentos.find((x) => x.id === 'busqueda').agentes[0].estado = 'esperando';
    d.alertas.push({ ...d.alertas[0], id: 'k-prueba-critica', nivel: 'critica', titulo: 'Prueba K: alerta crítica', departamento_id: 'busqueda' });
  });
  await p.locator('#recargar').click(); await p.waitForTimeout(2500);
  await p.keyboard.press('s'); await p.waitForTimeout(800);
  texto = await sala().innerText();
  ok('REAL: la sala cuenta 1 proyecto con datos reales vigentes y lo marca REAL', /1\s*con datos reales vigentes/.test(texto) && /REAL/.test(await p.locator('.sala-tarjeta[data-proyecto="compago"]').innerText()));
  ok('REAL: la alerta crítica va primero en «Requiere atención»', /Crítica/.test(await p.locator('.sala-item').first().innerText()) && /Prueba K/.test(await p.locator('.sala-item').first().innerText()));
  ok('REAL: el contador del botón cuenta asuntos con datos reales', /^\d+$/.test(await p.locator('#boton-sala .sala-contador').innerText()) && await p.locator('#boton-sala .sala-contador').isVisible());
  ok('REAL: los cambios observados aparecen clasificados (Error / Cambio de estado) y «Reciente»',
    /Error/.test(await p.locator('.sala-eventos').innerText()) && /Cambio de estado/.test(await p.locator('.sala-eventos').innerText()) && /Reciente/.test(await p.locator('.sala-eventos').innerText()));
  await foto(p, 'sala-control-real');
  await p.locator('.sala-eventos .sala-item', { hasText: 'Buscador' }).first().locator('button').click(); await p.waitForTimeout(2000);
  const hist = await p.locator('#panel').innerText();
  ok('REAL: «Ver» un cambio abre el departamento y su historial lo muestra', /Búsqueda/.test(hist) && /pasó de Finalizado a Esperando/.test(hist) && /Nueva alerta: Prueba K/.test(hist));
  await p.keyboard.press('Escape');
  // JSON a medias: se relee (fase J) y la sala no muestra un error falso.
  compago = compagoReal(Date.now() - 1000, (d) => { d.departamentos.find((x) => x.id === 'busqueda').agentes[0].estado = 'esperando'; d.alertas.push({ ...d.alertas[0], id: 'k-prueba-critica', nivel: 'critica', titulo: 'Prueba K: alerta crítica', departamento_id: 'busqueda' }); });
  cortar = 1;
  await p.locator('#recargar').click(); await p.waitForTimeout(2600);
  await p.keyboard.press('s'); await p.waitForTimeout(600);
  ok('JSON leído a medias: la sala sigue en REAL, sin «archivo inválido»', /REAL/.test(await p.locator('.sala-tarjeta[data-proyecto="compago"]').innerText()) && !/Archivo de estado con errores/.test(await sala().innerText()));
  await p.keyboard.press('Escape');
  // Vencido: el adaptador dejó de escribir hace 2 h.
  compago = compagoReal(Date.now() - 2 * 3600 * 1000);
  await p.locator('#recargar').click(); await p.waitForTimeout(2500);
  await p.keyboard.press('s'); await p.waitForTimeout(600);
  texto = await sala().innerText();
  ok('vencido: la sala lo marca «Vencido» e «Información vencida», 0 trabajando REAL', /Vencido/.test(await p.locator('.sala-tarjeta[data-proyecto="compago"]').innerText()) && /Información vencida/.test(texto) && /0\s*procesos trabajando \(REAL\)/.test(texto));
  ok('vencido: el cambio de conexión queda como «Información vencida» en los cambios', /Información vencida/.test(await p.locator('.sala-eventos').innerText()));
  await p.keyboard.press('Escape'); await p.waitForTimeout(1500);
  const vis = await p.evaluate(() => window.__cauce3d.personajes().filter((x) => x.visible && x.accion !== 'salir').length);
  ok('vencido: ningún personaje se queda trabajando en la oficina', vis === 0, `${vis}`);
  compago = null;
  await p.locator('#recargar').click(); await p.waitForTimeout(2500);

  // ---------------------------------------------------------------- Sesión larga: sala y pisos
  const medir = () => p.evaluate(() => ({ ...window.__cauce3d.metricas(), nodos: document.getElementsByTagName('*').length }));
  const base = await medir();
  for (let i = 0; i < 12; i++) {
    await p.keyboard.press('s'); await p.waitForTimeout(250);
    await p.locator(`.sala-tarjeta[data-proyecto="${i % 2 ? 'compago' : 'montambre'}"] .sala-ir`).click(); await p.waitForTimeout(900);
  }
  await p.locator('#pisos .piso', { hasText: 'Compago' }).first().click(); await p.waitForTimeout(4000);
  const tras = await medir();
  ok('24 aperturas de sala y 12 cambios de piso desde ella: geometrías, texturas y nodos estables',
    tras.geometrias <= base.geometrias && tras.texturas <= base.texturas && tras.nodos <= base.nodos + 30, `geo ${base.geometrias}→${tras.geometrias}, tex ${base.texturas}→${tras.texturas}, nodos ${base.nodos}→${tras.nodos}`);
  ok('recursos del piso con recepción K: llamadas de dibujo ≤ 165 en el edificio completo', base.llamadas <= 165, `${base.llamadas}`);

  // ---------------------------------------------------------------- WebGL perdido: el plano 2D y la sala siguen
  await p.evaluate(() => document.querySelector('.vista3d canvas').getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext());
  await p.waitForTimeout(2500);
  ok('WebGL perdido: pasa al plano 2D con aviso y «Reintentar 3D»', await p.locator('.reintentar-3d').isVisible() && !(await p.locator('.vista3d').count()));
  await p.keyboard.press('s'); await p.waitForTimeout(600);
  ok('WebGL perdido: la sala de control funciona sin 3D', await abierta() && (await p.locator('.sala-tarjeta').count()) === 7);
  await p.keyboard.press('Escape');
  await p.locator('.reintentar-3d').click(); await p.waitForTimeout(5000);
  ok('Reintentar 3D vuelve a la oficina', await p.locator('.vista3d').isVisible());
  await p.close();

  // ---------------------------------------------------------------- Celular vertical
  const m = await b.newPage({ ...devices['iPhone 12'] });
  vigilar(m);
  await m.route('**/datos/reales/*', (r) => r.fulfill({ status: 404, body: '' }));
  await m.goto(BASE + '?medir=1&hora=11'); await m.waitForTimeout(7000);
  ok('celular: botón de la sala visible y de al menos 36 px', await m.locator('#boton-sala').isVisible() && (await m.locator('#boton-sala').boundingBox()).height >= 36);
  await m.locator('#boton-sala').tap(); await m.waitForTimeout(800);
  const ancho = await m.evaluate(() => ({ doc: document.documentElement.scrollWidth, vista: innerWidth }));
  ok('celular: la sala no se sale de la pantalla (sin desplazamiento horizontal)', ancho.doc <= ancho.vista + 1, `${ancho.doc} vs ${ancho.vista}`);
  const chicos = await m.locator('#sala-control button').evaluateAll((bs) => bs.filter((x) => x.getBoundingClientRect().height < 44).length);
  ok('celular: botones de la sala de al menos 44 px de alto', chicos === 0, `${chicos} más chicos`);
  await foto(m, 'celular-sala');
  await m.locator('.sala-tarjeta[data-proyecto="ek-chuah"] .sala-ir').tap(); await m.waitForTimeout(4500);
  ok('celular: elegir un proyecto desde la sala lleva a su piso', (await m.locator('#pisos .piso[aria-selected="true"]').innerText()).includes('Ek Chuah'));
  await m.locator('.vista3d-movil [aria-label="Más opciones"]').tap(); await m.waitForTimeout(400);
  const menu = await m.locator('.movil-menu').innerText();
  ok('celular: el menú ⋯ ofrece recepción, siguiente alerta y sala de control', /recepción/i.test(menu) && /Sala de control/.test(menu) && /alertas/.test(menu));
  await m.locator('.movil-opcion', { hasText: 'recepción' }).tap(); await m.waitForTimeout(1500);
  await foto(m, 'celular-recepcion');
  await m.locator('.vista3d-movil [aria-label="Más opciones"]').tap(); await m.waitForTimeout(400);
  await m.locator('.movil-opcion', { hasText: 'Sala de control' }).tap(); await m.waitForTimeout(800);
  ok('celular: «Sala de control» del menú la abre', await m.locator('#sala-control').isVisible());
  await m.close();

  // ---------------------------------------------------------------- Celular horizontal + inmersivo
  const h = await b.newPage({ ...devices['iPhone 12 landscape'] });
  vigilar(h);
  await h.route('**/datos/reales/*', (r) => r.fulfill({ status: 404, body: '' }));
  await h.goto(BASE + '?medir=1&hora=11'); await h.waitForTimeout(7000);
  await h.locator('#boton-sala').tap(); await h.waitForTimeout(800);
  const ah = await h.evaluate(() => ({ doc: document.documentElement.scrollWidth, vista: innerWidth }));
  ok('celular horizontal: sala sin desplazamiento horizontal', ah.doc <= ah.vista + 1, `${ah.doc} vs ${ah.vista}`);
  await foto(h, 'celular-horizontal-sala');
  await h.locator('[data-cerrar-sala]').tap(); await h.waitForTimeout(600);
  await h.locator('.boton-inmersivo').tap(); await h.waitForTimeout(1200);
  ok('inmersivo: entrar cierra la sala y oculta la cabecera', await h.evaluate(() => document.documentElement.classList.contains('inmersivo')) && !(await h.locator('#sala-control').isVisible()));
  await foto(h, 'celular-horizontal-inmersivo');
  await h.close();

  // ---------------------------------------------------------------- Movimiento reducido
  const rm = await b.newPage({ viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce' });
  vigilar(rm);
  await rm.route('**/datos/reales/*', (r) => r.fulfill({ status: 404, body: '' }));
  await rm.goto(BASE + '?medir=1&hora=11'); await rm.waitForTimeout(7000);
  const a0 = await rm.evaluate(() => window.__cauce3d.cajaEdificio());
  await rm.keyboard.press('r'); await rm.waitForTimeout(120);
  const a1 = await rm.evaluate(() => window.__cauce3d.cajaEdificio());
  ok('movimiento reducido: la recepción se muestra sin viaje de cámara (de inmediato)', (a1.der - a1.izq) > (a0.der - a0.izq) * 1.3);
  await rm.close();

  ok('sin errores de JavaScript en ninguna página', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close();
  for (const r of res) console.log(r);
  const f = res.filter((r) => r.startsWith('FALLA')).length;
  console.log(`\n${res.length - f} OK, ${f} FALLA`);
  process.exit(f ? 1 : 0);
})();
