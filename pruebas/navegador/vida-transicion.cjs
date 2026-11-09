// Vida mínima en «Un cuarto» y transición entre pisos (ascensor): se ve la transición vertical al cambiar de
// proyecto, sube o baja según el orden de las pestañas, «Un cuarto» tiene una entrada breve, cambiar de departamento
// en el edificio no anima, «reducir movimiento» y «Cámara instantánea» la quitan, los personajes de Compago →
// Evaluación de oportunidades se mueven (sin teclear) y recorrer pisos muchas veces no hace crecer geometrías,
// texturas ni nodos.
// Con servir.py corriendo:  node pruebas/navegador/vida-transicion.cjs
// SwiftShader: comprueba comportamiento; NO mide el rendimiento de la Intel UHD.
const { chromium } = require('playwright');
const BASE = 'http://127.0.0.1:' + (process.env.PUERTO || 8765) + '/';

(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const res = []; const errs = [];
  const ok = (n, c, x = '') => res.push(`${c ? 'OK ' : 'FALLA'} ${n}${x ? ' · ' + x : ''}`);
  const vigilar = (p) => { p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errs.push(m.text()); }); };
  const abrir = async (opciones = {}, extra = '') => {
    const p = await b.newPage({ viewport: { width: 1366, height: 768 }, ...opciones });
    vigilar(p);
    await p.route('**/datos/proyectos.local.json*', (r) => r.fulfill({ status: 404, body: '' }));
    await p.route('**/datos/reales/*', (r) => r.fulfill({ status: 404, body: '' }));
    await p.goto(BASE + '?proyecto=compago&modo3d=edificio&medir=1&hora=11' + extra);
    await p.waitForFunction(() => window.__cauce3d && window.__cauce3d.metricas().llamadas > 0, null, { timeout: 30000 });
    await p.waitForTimeout(1500);
    return p;
  };
  // Muestrea la transición en cada cuadro mientras corre `accion` (en la página).
  const muestrear = (p, accion, ms) => p.evaluate(async ({ accion, ms }) => {
    const m = []; let fin = false; const t0 = performance.now();
    (function f() { const t = window.__cauce3d.transicion(); m.push({ t: performance.now() - t0, ...t }); if (!fin) requestAnimationFrame(f); })();
    new Function(accion)();
    await new Promise((r) => setTimeout(r, ms)); fin = true;
    return m;
  }, { accion, ms });
  const pestana = (i) => `document.querySelectorAll('#pisos button.piso')[${i}].click()`;
  const modoCuarto = `document.querySelector('[data-modo3d="individual"]').click()`;
  const modoEdificio = `document.querySelector('[data-modo3d="edificio"]').click()`;
  const elegir = (re) => `const s = document.querySelector('.vista3d-barra select'); s.value = [...s.options].find((o) => ${re}.test(o.text)).value; s.dispatchEvent(new Event('change', { bubbles: true }));`;

  // ------------------------------------------------------------ Ascensor entre pisos
  const p = await abrir();
  const inicial = await p.evaluate(() => window.__cauce3d.metricas()); // edificio completo de Compago, recién encuadrado
  const sube = await muestrear(p, pestana(1), 2000); // Compago → Ek Chuah (la pestaña siguiente: sube)
  const salidaS = sube.filter((x) => x.fase === 'salida'), llegadaS = sube.filter((x) => x.fase === 'llegada' && x.y !== null && !x.esperando);
  ok('ascensor al subir: el piso actual baja y se desvanece', salidaS.length >= 5 && salidaS.at(-1).y < -1 && Number(salidaS.at(-1).opacidad) < 0.7 && salidaS.every((x) => x.tipo === 'ascensor' && x.direccion === 1), `${salidaS.length} cuadros, y final ${salidaS.at(-1)?.y?.toFixed(2)}`);
  ok('ascensor al subir: el piso nuevo llega desde arriba y se asienta en y = 0', llegadaS.length >= 8 && llegadaS[0].y > 1 && llegadaS.every((x, i) => i === 0 || x.y <= llegadaS[i - 1].y + 1e-6), `${llegadaS.length} cuadros, y ${llegadaS[0]?.y?.toFixed(2)} → ${llegadaS.at(-1)?.y?.toFixed(2)}`);
  const finS = sube.at(-1);
  ok('ascensor: termina (sin transición activa, y = 0, opacidad normal, una transición contada)', !finS.activa && finS.y === 0 && finS.opacidad === '' && finS.hechas === 1 && finS.vista.proyecto === 'ek-chuah', JSON.stringify({ y: finS.y, op: finS.opacidad, hechas: finS.hechas }));
  const dur = (sube.findLast((x) => x.activa)?.t ?? 0) - (sube.find((x) => x.activa)?.t ?? 0);
  ok('ascensor: dura entre 0.7 y 1.8 s (suave, no un salto ni una espera larga)', dur > 700 && dur < 1800, `${Math.round(dur)} ms`);
  ok('ascensor: las etiquetas del edificio vuelven a verse al terminar', await p.evaluate(() => { const n = document.querySelector('.vista3d-etiquetas'); return Boolean(n) && n.style.visibility !== 'hidden' && n.querySelectorAll('.etiqueta-dep').length > 0; }));
  const baja = await muestrear(p, pestana(0), 2000); // Ek Chuah → Compago: baja
  const salidaB = baja.filter((x) => x.fase === 'salida'), llegadaB = baja.filter((x) => x.fase === 'llegada' && x.y !== null && !x.esperando);
  ok('ascensor al bajar: el piso actual sube y el nuevo llega desde abajo', salidaB.length && salidaB.at(-1).y > 1 && llegadaB.length && llegadaB[0].y < -1 && salidaB.every((x) => x.direccion === -1), `salida ${salidaB.at(-1)?.y?.toFixed(2)}, llegada ${llegadaB[0]?.y?.toFixed(2)}`);

  // Mismo piso: cambiar de departamento en el edificio solo mueve la cámara (sin transición).
  const depEdif = await muestrear(p, elegir('/Márgenes/'), 900);
  ok('mismo piso, otro departamento (edificio): sin transición, la cámara viaja', depEdif.every((x) => !x.activa) && await p.evaluate(() => window.__cauce3d.camara().enfocado) === 'margenes');

  // «Un cuarto»: cambio de modo y de departamento con entrada breve; datos nuevos no animan.
  const aCuarto = await muestrear(p, modoCuarto, 900);
  const c1 = aCuarto.filter((x) => x.activa);
  ok('«Un cuarto»: entrada breve (sube un poco y aparece), sin ascensor', c1.length >= 4 && c1.every((x) => x.tipo === 'cuarto') && c1[0].y < 0 && c1[0].y > -0.5 && !aCuarto.at(-1).activa, `${c1.length} cuadros`);
  const otroCuarto = await muestrear(p, elegir('/oportunidades/i'), 900);
  ok('«Un cuarto», otro departamento: entrada breve, no un salto', otroCuarto.filter((x) => x.activa && x.tipo === 'cuarto').length >= 4 && !otroCuarto.at(-1).activa);

  // ------------------------------------------------------------ Vida en «Un cuarto» (Compago → Evaluación de oportunidades)
  await p.waitForTimeout(1200);
  const poses = () => p.evaluate(() => window.__cauce3d.poses());
  const dif = (a, b) => a.firma.reduce((s, v, i) => s + Math.abs(v - (b.firma[i] ?? 0)), 0);
  const p0 = await poses();
  const cambios = p0.map(() => 0); const gestos = new Set();
  for (let i = 0; i < 6; i++) {
    await p.waitForTimeout(1000);
    const pi = await poses();
    pi.forEach((x, k) => { if (dif(x, p0[k]) > 0.02) cambios[k]++; if (x.vida) gestos.add(x.vida); });
  }
  const visibles = p0.filter((x) => x.visible);
  ok('«Un cuarto» Oportunidades: hay personajes visibles', visibles.length >= 1, `${visibles.length}: ${visibles.map((x) => x.bucle).join(',')}`);
  ok('«Un cuarto» Oportunidades: cada personaje visible se mueve (pose distinta en ≥ 5 de 6 muestras)', p0.every((x, k) => !x.visible || cambios[k] >= 5), cambios.join(','));
  ok('«Un cuarto» Oportunidades: hace gestos cortos (mirar, acomodarse, girar la silla…)', gestos.size >= 1, [...gestos].join(','));
  ok('semántica intacta: nadie teclea en Oportunidades (no hay evidencia de trabajo en DEMO)', visibles.every((x) => x.bucle !== 'teclear'), visibles.map((x) => x.bucle).join(','));

  // ------------------------------------------------------------ Recursos: recorrer pisos muchas veces
  await p.evaluate(() => document.querySelector('[data-modo3d="edificio"]').click());
  await p.waitForTimeout(1500);
  const base = await p.evaluate(() => ({ ...window.__cauce3d.metricas(), nodos: document.getElementsByTagName('*').length }));
  for (let i = 0; i < 6; i++) {
    await p.evaluate(() => document.querySelectorAll('#pisos button.piso')[1].click()); await p.waitForTimeout(1600);
    await p.evaluate(() => document.querySelectorAll('#pisos button.piso')[0].click()); await p.waitForTimeout(1600);
  }
  await p.waitForTimeout(1500);
  const tras = await p.evaluate(() => ({ ...window.__cauce3d.metricas(), nodos: document.getElementsByTagName('*').length, t: window.__cauce3d.transicion() }));
  ok('12 viajes de ascensor: geometrías, texturas y nodos no crecen', tras.geometrias <= base.geometrias && tras.texturas <= base.texturas && tras.nodos <= base.nodos + 30, `geo ${base.geometrias}→${tras.geometrias}, tex ${base.texturas}→${tras.texturas}, nodos ${base.nodos}→${tras.nodos}`);
  ok('12 viajes: llamadas y triángulos iguales al volver (edificio completo, mismo encuadre que al abrir)', tras.llamadas === inicial.llamadas && tras.triangulos === inicial.triangulos, `${inicial.llamadas} → ${tras.llamadas}, triángulos ${inicial.triangulos} → ${tras.triangulos}`);
  ok('12 viajes: todas terminaron (y = 0, sin transición pendiente)', !tras.t.activa && tras.t.y === 0 && tras.t.hechas >= 14, `hechas ${tras.t.hechas}`);
  await p.close();

  // ------------------------------------------------------------ Reducir movimiento y cámara instantánea
  const q = await abrir({ reducedMotion: 'reduce' });
  const qs = await muestrear(q, pestana(1), 1800);
  ok('reducir movimiento: cambiar de piso no anima (cambio directo)', qs.every((x) => !x.activa) && qs.at(-1).vista?.proyecto === 'ek-chuah' && qs.at(-1).hechas === 0);
  const qc = await muestrear(q, modoCuarto, 900);
  ok('reducir movimiento: «Un cuarto» tampoco anima', qc.every((x) => !x.activa));
  await q.waitForTimeout(800);
  const r0 = await q.evaluate(() => window.__cauce3d.poses()); await q.waitForTimeout(1500); const r1 = await q.evaluate(() => window.__cauce3d.poses());
  ok('reducir movimiento: posturas fijas (sin vida animada)', r0.every((x, k) => !x.visible || r0[k].firma.every((v, i) => Math.abs(v - r1[k].firma[i]) < 1e-6)) && r1.every((x) => !x.vida));
  await q.close();

  const z = await abrir({}, '&camara=instantanea');
  ok('cámara instantánea: el interruptor aparece marcado con ?camara=instantanea', await z.evaluate(() => document.querySelector('[data-camara-instantanea]')?.checked === true));
  const zs = await muestrear(z, pestana(1), 1800);
  ok('cámara instantánea: cambiar de piso no anima', zs.every((x) => !x.activa) && zs.at(-1).vista?.proyecto === 'ek-chuah');
  await z.evaluate(() => document.querySelectorAll('#pisos button.piso')[0].click()); await z.waitForTimeout(1500);
  await z.evaluate(() => { const s = document.querySelector('.vista3d-barra select'); s.value = [...s.options].find((o) => /Márgenes/.test(o.text)).value; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await z.waitForTimeout(120);
  ok('cámara instantánea: enfocar un departamento no viaja (salta)', !(await z.evaluate(() => window.__cauce3d.camara().animando)));
  await z.evaluate(() => document.querySelector('[data-modo3d="individual"]').click()); await z.waitForTimeout(800);
  await z.evaluate(() => { const s = document.querySelector('.vista3d-barra select'); s.value = [...s.options].find((o) => /oportunidades/i.test(o.text)).value; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await z.waitForTimeout(1200);
  const z0 = await z.evaluate(() => window.__cauce3d.poses()); await z.waitForTimeout(1500); const z1 = await z.evaluate(() => window.__cauce3d.poses());
  ok('cámara instantánea: los personajes siguen vivos (solo la cámara es instantánea)', z0.some((x, k) => x.visible && x.firma.some((v, i) => Math.abs(v - z1[k].firma[i]) > 1e-3)));
  // Desmarcar: se recuerda «suave».
  await z.goto(BASE + '?proyecto=compago&modo3d=edificio&medir=1&hora=11');
  await z.waitForFunction(() => window.__cauce3d && window.__cauce3d.metricas().llamadas > 0, null, { timeout: 30000 });
  ok('cámara instantánea: sin el parámetro no queda marcada (no se recordó por la dirección)', await z.evaluate(() => document.querySelector('[data-camara-instantanea]')?.checked === false));
  await z.close();

  console.log(res.join('\n'));
  console.log('errores:', errs.length ? errs.join(' | ') : 'ninguno');
  await b.close();
  const f = res.filter((x) => x.startsWith('FALLA')).length;
  console.log(`\n${res.length - f} OK, ${f} FALLA`);
  process.exit(f || errs.length ? 1 : 0);
})();
