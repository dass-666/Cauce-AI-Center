// Fase M: renovación visual. Comprueba en Chromium (SwiftShader) que el edificio nuevo sigue siendo un monitor
// honesto y no rompe nada: Compago y Ek Chuah, presupuesto de recursos gráficos, pantallas ambientales atenuadas
// sin datos vigentes, resplandor solo en pantallas encendidas por evidencia, nadie extra en la oficina, cámara
// (enfocar, volver, acercar hacia el cursor), inmersivo, «Un cuarto», 2D, bajo consumo, cambio repetido de
// proyectos sin fugas de memoria gráfica y celular.
// Con servir.py corriendo:  node pruebas/navegador/fase-m.cjs      (SAL=carpeta para capturas, opcional)
// SwiftShader cuenta objetos y comprueba comportamiento; NO mide el rendimiento de la Intel UHD.
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

(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const res = []; const errs = [];
  const ok = (n, c, x = '') => res.push(`${c ? 'OK ' : 'FALLA'} ${n}${x ? ' · ' + x : ''}`);
  const vigilar = (p) => { p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errs.push(m.text()); }); };
  const met = (p) => p.evaluate(() => window.__cauce3d.metricas());
  const per = (p) => p.evaluate(() => window.__cauce3d.personajes());
  const cam = (p) => p.evaluate(() => window.__cauce3d.camara());
  const foto = async (p, n) => { if (SAL) { await p.evaluate(() => { const m = document.querySelector('.vista3d-medidas'); if (m) m.hidden = true; }); await p.screenshot({ path: `${SAL}/${n}.png` }); } };
  const piso = async (p, nombre) => { await p.locator('#pisos .piso', { hasText: nombre }).first().click(); await p.waitForTimeout(3500); };
  const cerrarSala = async (p) => { if (await p.locator('#sala-control').isVisible().catch(() => false)) { await p.locator('[data-cerrar-sala]').first().click(); await p.waitForTimeout(1200); } };

  // ------------------------------------------------------------ Compago y Ek Chuah DEMO, escritorio
  const p = await b.newPage({ viewport: { width: 1366, height: 768 } });
  vigilar(p);
  await p.route('**/datos/proyectos.local.json*', (r) => r.fulfill({ status: 404, body: '' }));
  await p.route('**/datos/reales/*', (r) => r.fulfill({ status: 404, body: '' }));
  await p.addInitScript(() => { try { localStorage.setItem('cauce.proyecto', 'compago'); localStorage.setItem('cauce.modo3d', 'edificio'); } catch {} });
  await p.goto(BASE + '?medir=1&hora=11'); await p.waitForTimeout(8000);
  await cerrarSala(p);
  const c0 = await met(p);
  ok('Compago: edificio de 8 departamentos con interiores nuevos en ≤ 110 llamadas (antes 83; referencia medida en Intel UHD: 170)', c0.llamadas <= 110, `${c0.llamadas} llamadas, ${c0.triangulos} triángulos`);
  ok('Compago: ≤ 30 000 triángulos (antes 9 363) y ≤ 32 texturas', c0.triangulos <= 30000 && c0.texturas <= 32, `${c0.triangulos} / ${c0.texturas}`);
  ok('DEMO en línea: pantallas ambientales encendidas (0.85)', c0.ambiente === 0.85, `${c0.ambiente}`);
  const pc = await per(p);
  const visibles = pc.filter((x) => x.visible).length;
  ok('nadie extra: solo hay personajes para agentes del archivo (ninguno agregado para llenar cuartos)', pc.every((x) => typeof x.id === 'string') && visibles <= pc.length && pc.length <= 8, `${visibles} a la vista de ${pc.length}`);
  ok('resplandor solo en pantallas encendidas por evidencia (≤ número de puestos con agente)', c0.resplandores >= 1 && c0.resplandores <= 9, `${c0.resplandores}`);
  await foto(p, 'compago-edificio');

  // Cámara: 1 enfoca el primer departamento con un viaje suave, 0 vuelve, la rueda acerca hacia el cursor.
  await p.keyboard.press('1'); await p.waitForTimeout(150);
  const viajando = await cam(p);
  await p.waitForTimeout(1100);
  const enf = await cam(p);
  ok('cámara: «1» enfoca Importación con viaje suave (≤ 1 s) y termina quieta', viajando.animando && !enf.animando && enf.enfocado === 'importacion', JSON.stringify({ z: enf.zoom.toFixed(2), e: enf.enfocado }));
  await p.keyboard.press('Escape'); await p.keyboard.press('0'); await p.waitForTimeout(1200);
  const base = await cam(p);
  ok('cámara: «0» regresa al edificio completo', base.enfocado === null && base.zoom < 1.2, `zoom ${base.zoom.toFixed(2)}`);
  await p.mouse.move(300, 600);
  for (let i = 0; i < 3; i++) { await p.mouse.wheel(0, -200); await p.waitForTimeout(120); }
  await p.waitForTimeout(800);
  const rueda = await cam(p);
  ok('cámara: la rueda acerca hacia donde apunta el ratón (el centro se mueve, no solo el zoom)', rueda.zoom > base.zoom && Math.hypot(rueda.x - base.x, rueda.z - base.z) > 0.5, `Δ ${Math.hypot(rueda.x - base.x, rueda.z - base.z).toFixed(2)} m`);
  await p.keyboard.press('0'); await p.waitForTimeout(1200);

  // Inmersivo, «Un cuarto», 2D y regreso.
  await p.locator('.boton-inmersivo').click(); await p.waitForTimeout(1500);
  const inm = await met(p);
  ok('inmersivo: mismo edificio, mismo presupuesto', inm.llamadas <= 110 && inm.modo === 'edificio', `${inm.llamadas}`);
  await foto(p, 'compago-inmersivo');
  await p.locator('#salir-inmersivo').click(); await p.waitForTimeout(600);
  await p.locator('[data-modo3d="individual"]').click(); await p.waitForTimeout(2500);
  const uno = await met(p);
  ok('«Un cuarto»: un departamento amueblado, ≤ 24 llamadas', uno.modo === 'individual' && uno.llamadas <= 24, `${uno.llamadas} llamadas, ${uno.departamento}`);
  await foto(p, 'compago-un-cuarto');
  await p.locator('[data-modo3d="edificio"]').click(); await p.waitForTimeout(2000);
  await p.locator('[data-vista="2d"]').click(); await p.waitForTimeout(1000);
  ok('vista 2D sigue disponible (botón «Plano» activo y sin lienzo 3D)', (await p.locator('[data-vista="2d"]').getAttribute('aria-pressed')) === 'true' && (await p.locator('.vista3d canvas').count()) === 0);
  await p.locator('[data-vista="3d"]').click(); await p.waitForTimeout(2500);

  // Ek Chuah: su propio estilo (financiero) y sus 6 departamentos; Tezcatlipoca sin edificio.
  await piso(p, 'Ek Chuah');
  const e0 = await met(p);
  const txt = await p.evaluate(() => document.body.innerText);
  ok('Ek Chuah: 6 departamentos, ≤ 90 llamadas, sin textos de Compago', e0.llamadas <= 90 && !/Importación de catálogos/.test(txt), `${e0.llamadas} llamadas, ${e0.triangulos} triángulos`);
  await foto(p, 'ek-chuah-edificio');
  await piso(p, 'Tezcatlipoca');
  const tz = await p.evaluate(() => ({ aviso: document.querySelector('.vista3d-aviso')?.textContent ?? '', cuartos: window.__cauce3d?.metricas().personajes ?? 0 }));
  ok('Tezcatlipoca: sin edificio ni departamentos inventados', /pendiente/i.test(tz.aviso) && tz.cuartos === 0, tz.aviso.slice(0, 60));

  // Cambio repetido de proyectos: la memoria gráfica vuelve a lo mismo (sin fugas).
  await piso(p, 'Compago');
  const antes = await met(p);
  for (let i = 0; i < 6; i++) { await piso(p, 'Ek Chuah'); await piso(p, 'Compago'); }
  const despues = await met(p);
  ok('6 idas y vueltas Compago ↔ Ek Chuah: geometrías y texturas sin crecer', despues.geometrias <= antes.geometrias + 2 && despues.texturas <= antes.texturas, `geometrías ${antes.geometrias}→${despues.geometrias}, texturas ${antes.texturas}→${despues.texturas}`);

  // Bajo consumo: pasa al plano 2D y libera la vista 3D.
  await p.locator('#bajo-consumo').check(); await p.waitForTimeout(1200);
  ok('bajo consumo: sin lienzo 3D', (await p.locator('.vista3d canvas').count()) === 0);
  await p.locator('#bajo-consumo').uncheck(); await p.waitForTimeout(300);
  await p.close();

  // ------------------------------------------------------------ REAL vencido: pantallas atenuadas, nadie trabajando
  let doc = compagoReal(Date.now() - 4 * 3600_000); // datos de hace 4 h: fuera de vigencia
  const r = await b.newPage({ viewport: { width: 1366, height: 768 } });
  vigilar(r);
  await r.route('**/datos/proyectos.local.json*', (x) => x.fulfill({ status: 404, body: '' }));
  await r.route('**/datos/reales/compago.json*', (x) => x.fulfill({ status: 200, contentType: 'application/json', body: doc }));
  await r.route('**/datos/reales/[!c]*.json*', (x) => x.fulfill({ status: 404, body: '' }));
  await r.route('**/datos/reales/cauceservice.json*', (x) => x.fulfill({ status: 404, body: '' }));
  await r.addInitScript(() => { try { localStorage.setItem('cauce.proyecto', 'compago'); localStorage.setItem('cauce.modo3d', 'edificio'); } catch {} });
  await r.goto(BASE + '?medir=1&hora=11'); await r.waitForTimeout(8000);
  await cerrarSala(r);
  const rv = await met(r);
  const pv = await per(r);
  const con = await r.locator('#conexion').innerText();
  ok('REAL vencido: insignia REAL y aviso de datos no vigentes', /REAL/.test(con) && !/En línea/.test(con), con.split('\n')[0]);
  ok('REAL vencido: pantallas ambientales atenuadas (0.3) y nadie en los escritorios', rv.ambiente === 0.3 && pv.every((x) => !x.visible), `ambiente ${rv.ambiente}, ${pv.filter((x) => x.visible).length} visibles`);
  ok('REAL vencido: ninguna pantalla de puesto resplandece (sin evidencia vigente no hay trabajo que mostrar)', rv.resplandores === 0, `${rv.resplandores}`);
  await foto(r, 'real-vencido');
  // Llega una lectura vigente: las pantallas ambientales se encienden; nadie «reacciona» a la primera lectura.
  doc = compagoReal(Date.now() - 3000);
  await r.locator('#recargar').click(); await r.waitForTimeout(3500);
  const rv2 = await met(r);
  ok('REAL vigente: pantallas ambientales encendidas', rv2.ambiente === 0.85, `${rv2.ambiente}`);
  await r.close();

  // ------------------------------------------------------------ Celular
  const m = await b.newPage({ ...devices['iPhone 12'] });
  vigilar(m);
  await m.route('**/datos/proyectos.local.json*', (x) => x.fulfill({ status: 404, body: '' }));
  await m.route('**/datos/reales/*', (x) => x.fulfill({ status: 404, body: '' }));
  await m.goto(BASE + '?medir=1&hora=11'); await m.waitForTimeout(8000);
  await cerrarSala(m);
  const mm = await met(m);
  const desborde = await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok('celular: edificio dibujado, sin desplazamiento horizontal', mm.llamadas > 20 && desborde <= 1, `${mm.llamadas} llamadas, desborde ${desborde}px`);
  await foto(m, 'celular');
  await m.close();

  for (const l of res) console.log(l);
  console.log(`errores: ${errs.length ? JSON.stringify(errs) : 'ninguno'}`);
  await b.close();
  process.exit(res.some((l) => l.startsWith('FALLA')) || errs.length ? 1 : 0);
})();
