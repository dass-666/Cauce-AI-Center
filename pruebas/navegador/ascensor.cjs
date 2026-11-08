// Bloque D: ascensor virtual entre pisos. Comprueba en Chromium (SwiftShader) que al cambiar de piso la cámara sube
// o baja (salida, cambio de escena tapado, llegada), que dentro del mismo piso no hay ascensor, que los cambios
// rápidos redirigen sin acumular viajes ni bucles de dibujo, que «Edificio / Un cuarto», la selección, la sala de
// control y «reducir movimiento» siguen funcionando, y que no hay errores de JavaScript.
// Con servir.py corriendo:  node pruebas/navegador/ascensor.cjs      (SAL=carpeta para capturas, opcional)
// SwiftShader comprueba comportamiento; NO mide el rendimiento de la Intel UHD.
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = 'http://127.0.0.1:' + (process.env.PUERTO || 8765) + '/';
const SAL = process.env.SAL || null;
if (SAL) fs.mkdirSync(SAL, { recursive: true });

(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const res = []; const errs = [];
  const ok = (n, c, x = '') => res.push(`${c ? 'OK ' : 'FALLA'} ${n}${x ? ' · ' + x : ''}`);
  const vigilar = (p) => { p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errs.push(m.text()); }); };
  const cam = (p) => p.evaluate(() => window.__cauce3d.camara());
  const abrir = async (opciones = {}) => {
    const ctx = await b.newContext({ viewport: { width: 1366, height: 768 }, ...opciones });
    const p = await ctx.newPage();
    vigilar(p);
    await p.route('**/datos/proyectos.local.json*', (r) => r.fulfill({ status: 404, body: '' }));
    await p.route('**/datos/reales/*', (r) => r.fulfill({ status: 404, body: '' }));
    await p.addInitScript(() => {
      try { localStorage.setItem('cauce.proyecto', 'compago'); localStorage.setItem('cauce.modo3d', 'edificio'); } catch {}
      // Cuenta cuántas veces por segundo se pide un cuadro: con un solo ciclo de dibujo no cambia tras viajar.
      const raf = window.requestAnimationFrame.bind(window);
      window.__rafs = 0;
      window.requestAnimationFrame = (f) => { window.__rafs++; return raf(f); };
    });
    await p.goto(BASE + '?medir=1&hora=11'); await p.waitForTimeout(7000);
    if (await p.locator('#sala-control').isVisible().catch(() => false)) { await p.locator('[data-cerrar-sala]').first().click(); await p.waitForTimeout(1000); }
    return { ctx, p };
  };
  /** Pulsa la pestaña de un piso y registra el estado de la cámara cada ~25 ms durante `ms`. */
  const viaje = async (p, nombre, ms = 1600) => {
    await p.locator('#pisos .piso', { hasText: nombre }).first().click();
    return p.evaluate(async (ms) => {
      const m = []; const t0 = performance.now();
      while (performance.now() - t0 < ms) { m.push({ t: performance.now() - t0, ...window.__cauce3d.camara(), letrero: document.querySelector('.vista3d-ascensor-letrero')?.textContent ?? '', veloOculto: document.querySelector('.vista3d-ascensor')?.hidden }); await new Promise((r) => setTimeout(r, 25)); }
      return m;
    }, ms);
  };
  const rafsPorSegundo = (p) => p.evaluate(async () => { const a = window.__rafs; await new Promise((r) => setTimeout(r, 1000)); return window.__rafs - a; });

  const { ctx, p } = await abrir();
  const c0 = await cam(p);
  ok('arranque: piso Compago, sin viaje de ascensor y sin corrimiento', c0.piso === 'compago' && c0.ascensor === null && c0.desplaza === 0, JSON.stringify({ piso: c0.piso, a: c0.ascensor }));
  const rafs0 = await rafsPorSegundo(p);

  // ---------------------------------------------------------------- subir un piso
  const sube = await viaje(p, 'Ek Chuah');
  const salidaS = sube.filter((s) => s.ascensor === 'salida');
  const llegadaS = sube.filter((s) => s.ascensor === 'llegada');
  const fin = sube[sube.length - 1];
  ok('subir: la cámara sale hacia arriba del piso actual (corrimiento positivo, todavía Compago)', salidaS.length > 0 && salidaS.every((s) => s.desplaza >= 0 && s.piso === 'compago') && salidaS.some((s) => s.desplaza > 0.5), `${salidaS.length} muestras, máx ${Math.max(...salidaS.map((s) => s.desplaza)).toFixed(2)}`);
  ok('subir: llega a Ek Chuah desde abajo (corrimiento negativo que vuelve a 0)', llegadaS.length > 0 && llegadaS.every((s) => s.desplaza <= 0 && s.piso === 'ek-chuah'), `${llegadaS.length} muestras`);
  const iCambio = sube.findIndex((s) => s.piso === 'ek-chuah');
  ok('subir: la escena cambia con el velo casi opaco (no se ve el salto)', iCambio > 0 && sube[iCambio].velo > 0.85, `velo ${sube[iCambio]?.velo?.toFixed(2)}`);
  const tFin = sube.find((s) => s.piso === 'ek-chuah' && s.ascensor === null)?.t ?? Infinity;
  ok('subir: termina quieto, sin corrimiento, en un tiempo razonable (≤ 1.5 s con SwiftShader)', fin.ascensor === null && fin.desplaza === 0 && fin.veloOculto && tFin <= 1500, `${Math.round(tFin)} ms`);
  ok('subir: letrero «▲ Piso 2 · Ek Chuah» durante el viaje', sube.some((s) => s.letrero === '▲ Piso 2 · Ek Chuah'), sube.find((s) => s.letrero)?.letrero ?? '');
  ok('subir: el objetivo de la cámara (OrbitControls) no se movió en vertical: solo la proyección', sube.every((s) => Math.abs(s.y - 0.5) < 1.01), `y ${Math.min(...sube.map((s) => s.y)).toFixed(2)}–${Math.max(...sube.map((s) => s.y)).toFixed(2)}`);
  if (SAL) await p.screenshot({ path: `${SAL}/ascensor-llegada-ek-chuah.png` });

  // ---------------------------------------------------------------- bajar un piso
  const baja = await viaje(p, 'Compago');
  const salidaB = baja.filter((s) => s.ascensor === 'salida');
  ok('bajar: la cámara sale hacia abajo (corrimiento negativo) y llega a Compago desde arriba', salidaB.length > 0 && salidaB.every((s) => s.desplaza <= 0) && baja.filter((s) => s.ascensor === 'llegada').every((s) => s.desplaza >= 0 && s.piso === 'compago') && baja[baja.length - 1].piso === 'compago', `${salidaB.length} muestras de salida`);
  ok('bajar: letrero «▼ Piso 1 · Compago»', baja.some((s) => s.letrero === '▼ Piso 1 · Compago'));

  // ---------------------------------------------------------------- saltar varios pisos
  const salto = await viaje(p, 'Inteligencia Estratégica', 2000);
  const tSalto = salto.find((s) => s.piso === 'csi' && s.ascensor === null)?.t ?? Infinity;
  ok('varios pisos: Compago → CSI (piso 5) sube y llega', salto.some((s) => s.ascensor === 'salida' && s.desplaza > 0) && salto[salto.length - 1].piso === 'csi' && salto.some((s) => /Piso 5/.test(s.letrero)), `${Math.round(tSalto)} ms`);
  await p.waitForTimeout(800);
  await viaje(p, 'Compago', 1800); await p.waitForTimeout(600);

  // ---------------------------------------------------------------- mismo piso: cambiar de departamento o de bot
  await p.keyboard.press('1'); await p.waitForTimeout(80);
  const d1 = await cam(p);
  await p.waitForTimeout(1100);
  await p.keyboard.press('2'); await p.waitForTimeout(80);
  const d2 = await cam(p);
  await p.waitForTimeout(1100);
  ok('mismo piso: cambiar de departamento usa el viaje lateral, nunca el ascensor', d1.ascensor === null && d2.ascensor === null && d2.animando && d2.piso === 'compago', JSON.stringify({ a1: d1.ascensor, a2: d2.ascensor, lateral: d2.animando }));
  // Cambiar de bot dentro del piso (los datos DEMO tienen un bot por departamento: bot del 1 → bot del 3).
  const chips = p.locator('.vista3d-personajes .chip:not(.chip-seguir)');
  await p.keyboard.press('1'); await p.waitForTimeout(900);
  await chips.first().click(); await p.waitForTimeout(900);
  const botA = await cam(p);
  await p.keyboard.press('3'); await p.waitForTimeout(900);
  await chips.first().click(); await p.waitForTimeout(60);
  const bot = await cam(p);
  await p.waitForTimeout(900);
  const botB = await cam(p);
  ok('mismo piso: cambiar de bot no sube ni baja; la selección pasa al bot nuevo', botA.seleccion?.tipo === 'agente' && botB.seleccion?.tipo === 'agente' && botA.seleccion.id !== botB.seleccion.id && bot.ascensor === null && botB.ascensor === null && botB.piso === 'compago', `${botA.seleccion?.id} → ${botB.seleccion?.id}`);
  await p.keyboard.press('Escape'); await p.keyboard.press('0'); await p.waitForTimeout(1200);

  // ---------------------------------------------------------------- cambiar de destino durante la animación
  await p.locator('#pisos .piso', { hasText: 'Ek Chuah' }).first().click();
  await p.waitForTimeout(120);
  const medio = await cam(p);
  const redir = await viaje(p, 'Montambre', 2200);
  const pisosVistos = [...new Set(redir.map((s) => s.piso))];
  ok('redirigir a media salida (Ek Chuah → Montambre): un solo viaje que termina en Montambre', medio.ascensor === 'salida' && redir[redir.length - 1].piso === 'montambre' && redir[redir.length - 1].ascensor === null && !pisosVistos.includes('ek-chuah'), `pisos dibujados: ${pisosVistos.join(' → ')}`);
  ok('redirigir: el letrero cambia al nuevo destino (Piso 4)', redir.some((s) => /Piso 4 · Montambre/.test(s.letrero)));
  // Ráfaga: cinco pisos seguidos en menos de un segundo.
  for (const n of ['Compago', 'Ek Chuah', 'Montambre', 'Compago', 'Ek Chuah']) { await p.locator('#pisos .piso', { hasText: n }).first().click(); await p.waitForTimeout(90); }
  await p.waitForTimeout(2500);
  const rafaga = await cam(p);
  ok('ráfaga de 5 cambios: termina en el último piso elegido, quieto y sin modelo pendiente', rafaga.piso === 'ek-chuah' && rafaga.ascensor === null && rafaga.pendiente === null && rafaga.desplaza === 0, JSON.stringify({ piso: rafaga.piso, a: rafaga.ascensor, pend: rafaga.pendiente }));
  const rafs1 = await rafsPorSegundo(p);
  ok('sin bucles duplicados: tras los viajes se pide a lo más un cuadro por refresco de pantalla (≤ 70 por segundo; dos ciclos darían ~120)', rafs0 <= 70 && rafs1 <= 70, `${rafs0} al inicio (Compago) → ${rafs1} por segundo (Ek Chuah)`);

  // ---------------------------------------------------------------- cancelación: volver al piso actual a media salida
  await p.locator('#pisos .piso', { hasText: 'Compago' }).first().click();
  await p.waitForTimeout(100);
  const regreso = await viaje(p, 'Ek Chuah', 1400);
  ok('cancelar: volver a elegir el piso actual a media salida regresa a él sin cambiar de escena', regreso.every((s) => s.piso === 'ek-chuah') && regreso[regreso.length - 1].ascensor === null && regreso[regreso.length - 1].desplaza === 0, [...new Set(regreso.map((s) => s.ascensor))].join(','));

  // ---------------------------------------------------------------- piso sin oficinas (pendiente)
  const vacio = await viaje(p, 'Tezcatlipoca', 1600);
  const fv = vacio[vacio.length - 1];
  const avisoVacio = await p.locator('.vista3d-aviso').innerText().catch(() => '');
  ok('piso sin oficinas (Tezcatlipoca): el viaje termina y el velo se retira sobre su aviso', fv.piso === 'tezcatlipoca' && fv.ascensor === null && fv.veloOculto && /pendiente/i.test(avisoVacio), avisoVacio.slice(0, 50));
  await viaje(p, 'Compago', 1800); await p.waitForTimeout(500);

  // ---------------------------------------------------------------- Edificio / Un cuarto y selección
  await p.keyboard.press('2'); await p.waitForTimeout(1100);
  const selAntes = (await cam(p)).seleccion;
  await p.locator('[data-modo3d="individual"]').click(); await p.waitForTimeout(1800);
  const uno = await cam(p);
  const modoUno = await p.evaluate(() => window.__cauce3d.metricas().modo);
  ok('«Un cuarto»: conserva el departamento elegido y no activa el ascensor', modoUno === 'individual' && uno.ascensor === null && JSON.stringify(uno.seleccion) === JSON.stringify(selAntes), JSON.stringify(uno.seleccion));
  const subeUno = await viaje(p, 'Ek Chuah', 1800);
  ok('«Un cuarto»: cambiar de piso también sube y llega', subeUno.some((s) => s.ascensor === 'salida' && s.desplaza > 0) && subeUno[subeUno.length - 1].piso === 'ek-chuah' && subeUno[subeUno.length - 1].ascensor === null);
  // Alternar el modo a media salida: el viaje termina igual en el piso de destino.
  await p.locator('#pisos .piso', { hasText: 'Compago' }).first().click(); await p.waitForTimeout(100);
  await p.locator('[data-modo3d="edificio"]').click(); await p.waitForTimeout(2200);
  const alterna = await cam(p);
  const modoEd = await p.evaluate(() => window.__cauce3d.metricas().modo);
  ok('alternar Edificio a media salida: llega a Compago en modo edificio, sin quedarse a medias', alterna.piso === 'compago' && alterna.ascensor === null && modoEd === 'edificio' && alterna.desplaza === 0, JSON.stringify({ piso: alterna.piso, modo: modoEd }));
  const selFin = (await cam(p)).seleccion;
  ok('cambio de piso: la selección se limpia como antes (no queda un departamento de otro piso)', selFin === null, JSON.stringify(selFin));

  // ---------------------------------------------------------------- sala de control (vista en pausa)
  await p.keyboard.press('s'); await p.waitForTimeout(800);
  const irSala = p.locator('.sala-ir', { hasText: 'Ir al piso' }).first();
  if (await irSala.count()) {
    await irSala.click(); await p.waitForTimeout(2500);
    const s = await cam(p);
    ok('sala de control → «Ir al piso»: llega sin quedarse con el velo ni con un modelo pendiente', s.ascensor === null && s.pendiente === null && s.desplaza === 0 && s.piso !== null, `piso ${s.piso}`);
  } else ok('sala de control con botón «Ir al piso»', false);
  if (await p.locator('#sala-control').isVisible().catch(() => false)) { await p.locator('[data-cerrar-sala]').first().click(); await p.waitForTimeout(800); }

  // ---------------------------------------------------------------- 2D sin ascensor y regreso a 3D
  await p.locator('[data-vista="2d"]').click(); await p.waitForTimeout(800);
  await p.locator('#pisos .piso', { hasText: 'Ek Chuah' }).first().click(); await p.waitForTimeout(1200);
  const plano = await p.evaluate(() => ({ hay3d: Boolean(document.querySelector('.vista3d')), sel: document.querySelector('#pisos [aria-selected="true"]')?.textContent ?? '' }));
  ok('plano 2D: cambiar de piso es directo (no hay vista 3D ni ascensor)', !plano.hay3d && /Ek Chuah/.test(plano.sel));
  await p.locator('[data-vista="3d"]').click(); await p.waitForTimeout(5000);
  const vuelta = await cam(p);
  ok('regreso a 3D: piso Ek Chuah, sin viaje', vuelta.piso === 'ek-chuah' && vuelta.ascensor === null);

  // ---------------------------------------------------------------- «Cámara instantánea» (opción propia)
  await p.locator('label.camara-instantanea input').check(); await p.waitForTimeout(200);
  const inst = await viaje(p, 'Compago', 900);
  ok('«Cámara instantánea»: cambio de piso directo, sin ascensor ni corrimiento', inst.every((s) => s.ascensor === null && s.desplaza === 0) && inst[inst.length - 1].piso === 'compago');
  await p.keyboard.press('1'); await p.waitForTimeout(60);
  const instCam = await cam(p);
  ok('«Cámara instantánea»: enfocar un departamento tampoco anima', instCam.animando === false && instCam.enfocado !== null, JSON.stringify({ an: instCam.animando, e: instCam.enfocado }));
  await p.locator('label.camara-instantanea input').uncheck();
  await p.keyboard.press('0'); await p.waitForTimeout(800);
  const pref = await p.evaluate(() => localStorage.getItem('cauce.camara3d'));
  ok('«Cámara instantánea»: la preferencia se guarda y se puede volver a animar', pref === 'animada', pref);
  await ctx.close();

  // ---------------------------------------------------------------- prefers-reduced-motion del sistema
  const r = await abrir({ reducedMotion: 'reduce' });
  const red = await viaje(r.p, 'Ek Chuah', 1500);
  ok('reducir movimiento (sistema): cambio de piso instantáneo, nunca hay ascensor', red.every((s) => s.ascensor === null && s.desplaza === 0) && red[red.length - 1].piso === 'ek-chuah', `${red.length} muestras`);
  await r.ctx.close();

  // ---------------------------------------------------------------- celular: menú con la opción
  const m = await abrir({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const subeM = await viaje(m.p, 'Ek Chuah', 1800);
  ok('celular: el ascensor sube y llega igual', subeM.some((s) => s.ascensor === 'salida') && subeM[subeM.length - 1].piso === 'ek-chuah' && subeM[subeM.length - 1].ascensor === null);
  await m.p.locator('[aria-label="Más opciones"]').click().catch(() => {});
  await m.p.waitForTimeout(300);
  const opcionMovil = await m.p.locator('.movil-menu [role="menuitemcheckbox"]', { hasText: /Cámara instantánea/ }).count();
  ok('celular: el menú ⋯ ofrece «Cámara instantánea»', opcionMovil === 1, `${opcionMovil}`);
  await m.ctx.close();

  ok('sin errores de JavaScript en toda la prueba', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close();
  for (const l of res) console.log(l);
  const fallas = res.filter((l) => l.startsWith('FALLA')).length;
  console.log(`\n${res.length - fallas} pasaron, ${fallas} fallaron`);
  process.exit(fallas ? 1 : 0);
})();
