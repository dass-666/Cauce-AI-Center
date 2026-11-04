// Fase J: estabilidad pensada para el puente Docker → JSON → Cauce (Compago) y para sesiones largas.
// 1) Archivo leído a medias: se relee una vez y no se ve «Archivo inválido» ni un cambio falso.
// 2) Archivo dañado de verdad: sigue viéndose «Archivo inválido» (la relectura no lo tapa).
// 3) Reloj del contenedor adelantado (WSL2 tras suspender): tolerancia de 5 min, más allá «hora en el futuro».
// 4) Sesión larga: 60 lecturas con datos que cambian + 30 cambios de piso sin crecer geometrías, texturas,
//    nodos ni escuchas de eventos (listeners), y el registro de cambios topado en 30.
// Con servir.py corriendo: node pruebas/navegador/fase-j.cjs      (SwiftShader: cuenta objetos, no mide la Intel UHD)
const { chromium } = require('playwright');
const fs = require('fs');
const URL = 'http://127.0.0.1:' + (process.env.PUERTO || 8765) + '/?medir=1';
const ISO = /"(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z)"/g;
const iso = (ms) => new Date(ms).toISOString().replace(/\.\d+Z$/, 'Z');
function alDia(ruta, base) {
  const texto = fs.readFileSync(ruta, 'utf8');
  const gen = Date.parse(JSON.parse(texto).generado_en);
  return texto.replace(ISO, (_, t) => `"${iso(Date.parse(t) + base - gen)}"`);
}
const COMPAGO = 'contrato/ejemplos/compago-exportador.json';
const EK = (n) => `contrato/ejemplos/ek-chuah-pr2/${n}.json`;

(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const res = []; const errs = [];
  const ok = (n, c, x = '') => res.push(`${c ? 'OK ' : 'FALLA'} ${n}${x ? ' · ' + x : ''}`);
  const p = await b.newPage({ viewport: { width: 1366, height: 768 } });
  p.on('pageerror', (e) => errs.push(e.message));
  // Cuenta escuchas de eventos vivas (agregadas menos quitadas) en toda la página.
  // Lleva la cuenta de escuchas de eventos (listeners) agregadas y no quitadas. Solo cuentan las que siguen
  // vivas de verdad: en window, document, nodos que siguen en la página u otros objetos (MediaQueryList...).
  // Las de nodos ya quitados de la página se liberan junto con el nodo, así que no se cuentan.
  await p.addInitScript(() => {
    const add = EventTarget.prototype.addEventListener, rem = EventTarget.prototype.removeEventListener;
    const registro = new Map(); // clave → { ref, n }
    const ids = new WeakMap(); let siguiente = 0;
    const clave = (o, t, f, op) => { if (!ids.has(o)) ids.set(o, ++siguiente); if (!ids.has(f)) ids.set(f, ++siguiente); return `${ids.get(o)}|${t}|${ids.get(f)}|${!!(op === true || op?.capture)}`; };
    EventTarget.prototype.addEventListener = function (t, f, op) {
      if (f && (typeof f === 'function' || typeof f === 'object')) registro.set(clave(this, t, f, op), { ref: new WeakRef(this), tipo: t });
      return add.call(this, t, f, op);
    };
    EventTarget.prototype.removeEventListener = function (t, f, op) {
      if (f && (typeof f === 'function' || typeof f === 'object')) registro.delete(clave(this, t, f, op));
      return rem.call(this, t, f, op);
    };
    window.__escuchasVivas = () => {
      const cuenta = { ventana: 0, nodos: 0, otros: 0 };
      for (const { ref } of registro.values()) {
        const o = ref.deref();
        if (!o) continue;
        if (o === window || o === document) cuenta.ventana++;
        else if (o instanceof Node) { if (o.isConnected) cuenta.nodos++; }
        else cuenta.otros++;
      }
      return cuenta;
    };
  });
  const escuchasGlobales = () => p.evaluate(() => { const c = window.__escuchasVivas(); return c.ventana + c.nodos + c.otros; });
  const detalleEscuchas = () => p.evaluate(() => JSON.stringify(window.__escuchasVivas()));
  let compago = null, cortarCompago = 0, ek = null;
  await p.route('**/datos/proyectos.local.json*', (r) => r.fulfill({ status: 404, body: '' }));
  await p.route('**/datos/reales/compago.json*', (r) => {
    if (compago === null) return r.fulfill({ status: 404, body: '' });
    const cuerpo = cortarCompago > 0 ? compago.slice(0, Math.floor(compago.length / 2)) : compago;
    if (cortarCompago > 0) cortarCompago--;
    return r.fulfill({ status: 200, contentType: 'application/json', body: cuerpo });
  });
  await p.route('**/datos/reales/ek-chuah.json*', (r) => (ek === null ? r.fulfill({ status: 404, body: '' }) : r.fulfill({ status: 200, contentType: 'application/json', body: ek })));
  const tablero = () => p.locator('#conexion').innerText();
  const actualizar = async (ms = 1600) => { await p.locator('#recargar').click(); await p.waitForTimeout(ms); };
  const piso = async (n, ms = 1500) => { await p.locator('#pisos .piso', { hasText: n }).first().click(); await p.waitForTimeout(ms); };
  const metricas = async () => ({ ...(await p.evaluate(() => window.__cauce3d.metricas())), nodos: await p.evaluate(() => document.getElementsByTagName('*').length), escuchas: await escuchasGlobales() });

  await p.goto(URL); await p.waitForTimeout(6000);

  // 1. Primera lectura REAL de Compago, y luego una lectura que llega a medias.
  compago = alDia(COMPAGO, Date.now() - 5000);
  await actualizar(2500);
  let t = await tablero();
  ok('Compago REAL desde el exportador: «En línea»', /REAL/.test(t) && /En línea/.test(t), t.split('\n')[0]);
  compago = alDia(COMPAGO, Date.now() - 3000);
  cortarCompago = 1; // la siguiente lectura llega cortada; la relectura, completa
  await actualizar(2500);
  t = await tablero();
  ok('archivo leído a medias: se relee y sigue «En línea», sin «Archivo inválido»', /En línea/.test(t) && !/inválido/i.test(t) && await p.locator('#diagnostico').isHidden(), t.split('\n')[0]);
  ok('archivo leído a medias: no aparece un cambio de conexión falso', !/La conexión pasó/.test(await p.locator('[data-k="cambios"] .tablero-lista').innerText()));
  ok('archivo leído a medias: el selector sigue en REAL', (await p.locator('#pisos .piso', { hasText: 'Compago' }).first().innerText()).includes('REAL'));

  // 2. Dañado de verdad: dos lecturas cortadas seguidas.
  cortarCompago = 2;
  await actualizar(2500);
  t = await tablero();
  ok('archivo dañado de verdad: «Archivo inválido» y nadie trabajando', /inválido/i.test(t) && (await p.evaluate(() => window.__cauce3d.personajes())).every((x) => !x.visible || ['salir', 'levantarse'].includes(x.accion)), t.split('\n')[0]);
  ok('archivo dañado de verdad: el selector dice «Error»', (await p.locator('#pisos .piso', { hasText: 'Compago' }).first().innerText()).includes('Error'));

  // 3. Reloj del contenedor adelantado.
  compago = alDia(COMPAGO, Date.now() + 4 * 60_000);
  await actualizar(2500);
  ok('reloj del puente 4 min adelantado: se tolera («En línea»)', /En línea/.test(await tablero()));
  compago = alDia(COMPAGO, Date.now() + 10 * 60_000);
  await actualizar(2500);
  t = await tablero();
  ok('reloj del puente 10 min adelantado: «hora en el futuro», no se muestra como vigente', /futuro/.test(t) && !/En línea/.test(t), t.split('\n').slice(0, 2).join(' / '));
  compago = alDia(COMPAGO, Date.now() - 5000);
  await actualizar(2500);

  // 3b. Piloto con datos sintéticos: el puente escribe una DEMO en datos/reales/ y luego se detiene.
  const demoViva = (generado) => JSON.stringify({ ...JSON.parse(fs.readFileSync('contrato/ejemplos/compago-pr10/demo-activo.json', 'utf8')),
    generado_en: iso(generado), demo: { ahora_simulado: iso(generado) } });
  compago = demoViva(Date.now() - 60_000);
  await actualizar(2500);
  t = await tablero();
  ok('piloto DEMO recién exportado en datos/reales/: insignia DEMO, franja DEMO y «En línea»', /DEMO/.test(t) && /En línea/.test(t) && await p.locator('#banda-demo').isVisible(), t.split('\n')[0]);
  compago = demoViva(Date.now() - 2 * 3600_000);
  await actualizar(2500);
  t = await tablero();
  ok('piloto DEMO detenido hace 2 h: «Datos desactualizados» (no queda «En línea» para siempre) y el selector dice «Vencido»',
    /desactualizad/i.test(t) && !/En línea/.test(t) && (await p.locator('#pisos .piso', { hasText: 'Compago' }).first().innerText()).includes('Vencido'), t.split('\n')[0]);
  compago = alDia(COMPAGO, Date.now() - 5000);
  await actualizar(2500);

  // 4. Sesión larga.
  ek = alDia(EK('real-dia-normal'), Date.now() - 5000);
  await piso('Ek Chuah', 6000);
  await piso('Compago', 6000);
  const base = await metricas();
  const docs = ['real-dia-normal', 'real-fallas', 'real-sin-evidencia', 'real-sin-base'];
  for (let i = 0; i < 60; i++) {
    ek = alDia(EK(docs[i % docs.length]), Date.now() - 2000);
    compago = alDia(COMPAGO, Date.now() - 2000);
    if (i % 2 === 0) await piso(i % 4 === 0 ? 'Ek Chuah' : 'Compago', 900);
    else await actualizar(600);
  }
  await piso('Compago', 1500);
  await p.waitForTimeout(15000); // que terminen las apariciones breves
  const tras = await metricas();
  ok('60 lecturas que cambian + 30 cambios de piso: geometrías y texturas no crecen', tras.geometrias <= base.geometrias && tras.texturas <= base.texturas, `geo ${base.geometrias}→${tras.geometrias}, tex ${base.texturas}→${tras.texturas}`);
  ok('sesión larga: nodos de la página estables', tras.nodos <= base.nodos + 10, `${base.nodos}→${tras.nodos}`);
  ok('sesión larga: escuchas de eventos (listeners) sin acumularse', tras.escuchas <= base.escuchas + 5, `${base.escuchas}→${tras.escuchas} ${await detalleEscuchas()}`);
  ok('sesión larga: Compago termina REAL, en línea y con las mismas figuras', /REAL/.test(await tablero()) && /En línea/.test(await tablero()) && tras.personajes === base.personajes, `${base.personajes}→${tras.personajes}`);
  // 40 lecturas seguidas de Ek Chuah alternando día normal y fallas: muchos cambios reales, registro topado.
  await piso('Ek Chuah', 4000);
  for (let i = 0; i < 40; i++) { ek = alDia(EK(i % 2 ? 'real-fallas' : 'real-dia-normal'), Date.now() - 2000); await actualizar(500); }
  await p.waitForTimeout(1500);
  const cambios = Number((await tablero()).match(/Cambios(?: observados)? \((\d+)\)/)?.[1] ?? -1);
  ok('40 lecturas con cambios reales: el registro de cambios se llena pero no pasa de 30', cambios >= 10 && cambios <= 30, `${cambios}`);

  console.log(res.join('\n'));
  console.log('errores:', errs.length ? errs.join(' | ') : 'ninguno');
  await b.close();
  if (res.some((l) => l.startsWith('FALLA')) || errs.length) process.exit(1);
})();
