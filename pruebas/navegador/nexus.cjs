// Nexus fase 1 y 1.5: oficina de supervisión en el navegador (escritorio 3D, plano 2D, celular), pausa de la 3D,
// convivencia con la sala de control, revisión de borradores y pruebas.html completas.
// Con servir.py corriendo:  node pruebas/navegador/nexus.cjs      (SAL=carpeta para capturas, opcional)
// SwiftShader: comprueba comportamiento; NO mide el rendimiento de la Intel UHD.
const { chromium, devices } = require('playwright');
const fs = require('fs');
const BASE = 'http://127.0.0.1:' + (process.env.PUERTO || 8765) + '/';
const SAL = process.env.SAL || null;
if (SAL) fs.mkdirSync(SAL, { recursive: true });
const plantilla = fs.readFileSync('contrato/ejemplos/nexus/leccion-plantilla.json', 'utf8');

(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const res = []; const errs = [];
  const ok = (n, c, x = '') => res.push(`${c ? 'OK ' : 'FALLA'} ${n}${x ? ' · ' + x : ''}`);
  const vigilar = (p) => { p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource|node:child_process/.test(m.text())) errs.push(m.text()); }); };
  // (node:child_process: lo intenta pruebas/casos.js:345 desde antes de Nexus; esa prueba lo atrapa y sigue.)
  const foto = async (p, n, completa = false) => { if (SAL) await p.screenshot({ path: `${SAL}/${n}.png`, fullPage: completa }); };
  const preparar = async (p) => {
    vigilar(p);
    await p.route('**/datos/proyectos.local.json*', (r) => r.fulfill({ status: 404, body: '' }));
    await p.route('**/datos/reales/*.json*', (r) => r.fulfill({ status: 404, body: '' }));
  };

  // ---------------------------------------------------------------- Escritorio 3D
  const p = await b.newPage({ viewport: { width: 1366, height: 768 } });
  await preparar(p);
  await p.goto(BASE + '?medir=1&hora=11'); await p.waitForTimeout(6000);
  const nexus = p.locator('#nexus');
  const cuadros = () => p.evaluate(() => window.__cauce3d?.metricas().cuadros_totales ?? -1);
  ok('Nexus empieza cerrado y la oficina 3D se ve como antes', await nexus.isHidden() && await p.locator('.vista3d').isVisible());
  await p.locator('#boton-nexus').click(); await p.waitForTimeout(1200);
  ok('el botón «Nexus» abre la oficina con aria-pressed y foco en su título', await nexus.isVisible() && (await p.locator('#boton-nexus').getAttribute('aria-pressed')) === 'true' && await p.evaluate(() => document.activeElement?.id === 'nexus-titulo'));
  const texto = await nexus.innerText();
  ok('datos de prueba marcados como tales', /DATOS DE PRUEBA/.test(texto));
  ok('cifras: 6 lecciones, 1 sin objeciones, 1 incompleta, 4 con objeciones, 2 esperan decisión, 1 aprobada sin ejecutar',
    /6\s*lecciones registradas/.test(texto) && /1\s*sin objeciones/.test(texto) && /1\s*incompletas/.test(texto) && /4\s*con objeciones/.test(texto) && /2\s*recomendaciones esperan decisión humana/.test(texto) && /1\s*aprobadas, sin ejecutar/.test(texto));
  ok('pendientes: una lista para decidir y otra bloqueada (dinero) con su motivo', (await p.locator('[data-rec="demo-rec-conteos-tezcatlipoca"]').innerText()).includes('Lista para decidir')
    && /Bloqueada[\s\S]*Bloqueo absoluto[\s\S]*R08/.test(await p.locator('[data-rec="demo-rec-backtest-ek-chuah"]').innerText()));
  ok('alertas de evidencia: circularidad (R03), despliegue falso (R09) y backtest como beneficio (R08)', /R03 Independencia y circularidad/.test(texto) && /R09 Resultado y estado operativo/.test(texto) && /R08 Inferencia y robustez/.test(texto));
  ok('6 tarjetas de lección y 4 de recomendación', (await p.locator('[data-leccion]').count()) === 6 && (await p.locator('[data-recomendacion]').count()) === 4);
  ok('lección corregida muestra «2 versiones» y su revisión r3', /revisión r3 \(2 versiones\)/.test(await p.locator('[data-leccion="demo-cauce-zona-horaria"]').innerText()));
  ok('T15 a la vista: 88 filas → 62 partidos independientes', /88 fila → 62 partido independientes/.test(await p.locator('[data-leccion="demo-tezca-filas"]').innerText()));
  ok('recomendación aprobada: «Aprobada por una persona · sin ejecutar · no adoptada»', /Aprobada por una persona · sin ejecutar · no adoptada/.test(await p.locator('[data-recomendacion="demo-rec-duplicados-compago"]').innerText()));
  ok('sin botones que aprueben o ejecuten (solo cerrar, filtrar y revisar)', (await nexus.locator('button').allTextContents()).every((t) => /^(Ir al edificio|Revisar con el gerente|Quitar filtros|\d+)/.test(t.trim())), (await nexus.locator('button').allTextContents()).join('|'));
  ok('fase 1.5: la fuente DEMO se distingue (marca data-fuente="demo") y no hay integridad que mostrar', (await nexus.locator('[data-fuente="demo"]').count()) === 1 && (await nexus.locator('[data-fuente="real"]').count()) === 0);
  ok('fase 1.5: 3 candidatas Ek Chuah fuera del almacén, marcadas «Candidata · no registrada» y con motivos de rechazo', (await p.locator('[data-candidata]').count()) === 3
    && /Candidata · no registrada[\s\S]*Por qué no entra al almacén real[\s\S]*R01[\s\S]*R02/.test(await p.locator('[data-candidata="EK-L001"]').innerText()) && (await p.locator('[data-leccion^="EK-"]').count()) === 0);
  await p.locator('[data-filtro-cifra="con_objeciones"]').click(); await p.waitForTimeout(200);
  ok('fase 1.5: la cifra «con objeciones» filtra las tarjetas (4)', (await p.locator('[data-leccion]').count()) === 4 && (await p.locator('[data-leccion] .nexus-con_objeciones').count()) === 4);
  await p.locator('[data-filtro="proyecto"]').selectOption('tezcatlipoca'); await p.waitForTimeout(200);
  ok('fase 1.5: filtros combinados proyecto + estado', (await p.locator('[data-leccion]').count()) === 2);
  await p.locator('[data-filtro="confianza"]').selectOption('alta'); await p.waitForTimeout(200);
  ok('fase 1.5: sin coincidencias lo dice', /Ninguna lección con estos filtros/.test(await nexus.innerText()));
  await p.locator('[data-quitar-filtros]').click(); await p.waitForTimeout(200);
  ok('fase 1.5: «Quitar filtros» vuelve a las 6', (await p.locator('[data-leccion]').count()) === 6);
  ok('fase 1.5: reglas que no aplican se ven como «No aplica (justificado)», no como «Cumple»', /No aplica \(justificado\)/.test(await p.locator('[data-leccion="demo-compago-duplicados"] .nexus-reglas').textContent()));
  await p.locator('[data-leccion="demo-cauce-zona-horaria"] summary').first().click(); await p.waitForTimeout(200);
  const reglas = await p.locator('[data-leccion="demo-cauce-zona-horaria"] .nexus-regla').allInnerTexts();
  const sinEvaluar = reglas.filter((t) => t.includes('No evaluado'));
  ok('las 10 reglas se ven con estado y motivo (incompleta: R04, y R01 porque la evidencia cambió después de la revisión ajena)', reglas.length === 10 && sinEvaluar.length === 2 && /R01[\s\S]*cambió después/.test(sinEvaluar[0]) && /R04/.test(sinEvaluar[1]), sinEvaluar.join(' | '));
  const c0 = await cuadros(); await p.waitForTimeout(1200); const c1 = await cuadros();
  ok('con Nexus abierto la 3D no dibuja', c1 === c0, `${c0}→${c1}`);
  await foto(p, 'nexus-escritorio'); await foto(p, 'nexus-escritorio-completo', true);

  // Revisión de borradores
  await p.locator('[data-k="borrador"] summary').click();
  await p.locator('#nexus-alias').fill('revisor-prueba');
  await p.locator('#nexus-borrador').fill(plantilla.replace('"2026-11-06T10:00:00-06:00"', '"2026-11-06T10:00:00"'));
  await p.locator('#nexus-revisar').click(); await p.waitForTimeout(400);
  let salida = await p.locator('.nexus-salida').innerText();
  ok('borrador con revisión sin zona (T17): el contrato lo rechaza y no ofrece descarga', /revisiones\[0\]\.fecha .* zona horaria/.test(salida) && (await p.locator('.nexus-salida a[download]').count()) === 0);
  await p.locator('#nexus-borrador').fill(plantilla.replace('"hallazgo": "', '"hallazgo": "password=Secreta123 '));
  await p.locator('#nexus-revisar').click(); await p.waitForTimeout(400);
  ok('borrador con credencial: rechazado por privacidad', /Dato privado/.test(await p.locator('.nexus-salida').innerText()) && (await p.locator('.nexus-salida a[download]').count()) === 0);
  await p.locator('#nexus-borrador').fill(plantilla);
  await p.locator('#nexus-revisar').click(); await p.waitForTimeout(400);
  salida = await p.locator('.nexus-salida').innerText();
  ok('plantilla válida pero sin revisión ajena: «Incompleto» y NO entra al almacén real (explica R01), sin descarga', /Dictamen del gerente/.test(salida) && /Incompleto/.test(salida) && /Admisión al almacén real: NO[\s\S]*R01/.test(salida) && (await p.locator('.nexus-salida a[download]').count()) === 0);
  const revisada = JSON.parse(plantilla);
  revisada.revisiones.push({ fecha: '2026-11-06T11:00:00-06:00', autor_tipo: 'humano', autor: 'revisora-independiente', decision: 'revisada', justificacion: 'Revisé la prueba citada.', version: 'r2' });
  await p.locator('#nexus-borrador').fill(JSON.stringify(revisada));
  await p.locator('#nexus-revisar').click(); await p.waitForTimeout(500);
  salida = await p.locator('.nexus-salida').innerText();
  ok('con revisión humana independiente y commit: «Admisión: SÍ», descarga de registro y de manifiesto sellado, y ancla', /Admisión al almacén real: SÍ/.test(salida) && (await p.locator('.nexus-salida a[download="lecciones.json"]').count()) === 1 && (await p.locator('.nexus-salida a[download="manifiesto.json"]').count()) === 1 && /^1:[0-9a-f]{16}$/.test(await p.locator('[data-ancla]').innerText()) && /datos\/nexus\/registro\//.test(salida));
  const bajar = (nombre) => Promise.all([p.waitForEvent('download'), p.locator(`.nexus-salida a[download="${nombre}"]`).click()]).then(([d]) => d.path()).then((ruta) => JSON.parse(fs.readFileSync(ruta, 'utf8')));
  const descarga = await bajar('lecciones.json');
  const manifiestoBajado = await bajar('manifiesto.json');
  ok('el archivo descargado es un registro real con 1 entrada, quién registró y huella_anterior nula', descarga.contrato === 'cauce.nexus.registro-lecciones' && descarga.es_demo === false && descarga.entradas.length === 1 && descarga.entradas[0].huella_anterior === null && descarga.entradas[0].registrado_por.identificador === 'revisor-prueba');
  ok('el manifiesto descargado tiene 1 sello con 1 lección y 0 recomendaciones (identidad declarada)', manifiestoBajado.contrato === 'cauce.nexus.manifiesto' && manifiestoBajado.sellos.length === 1 && manifiestoBajado.sellos[0].registros.lecciones.n === 1 && manifiestoBajado.sellos[0].registros.recomendaciones.n === 0 && manifiestoBajado.sellos[0].sellado_por.autenticacion === 'declarada');
  await foto(p, 'nexus-borrador');

  // Convivencia con sala, teclado y Esc
  await p.keyboard.press('Escape'); await p.waitForTimeout(700);
  const c2 = await cuadros(); await p.waitForTimeout(1000);
  ok('Esc cierra Nexus y la 3D vuelve a dibujar', await nexus.isHidden() && (await cuadros()) > c2);
  await p.keyboard.press('n'); await p.waitForTimeout(600);
  ok('la tecla N abre Nexus', await nexus.isVisible());
  await p.keyboard.press('s'); await p.waitForTimeout(600);
  ok('S abre la sala y cierra Nexus (nunca las dos a la vez)', await p.locator('#sala-control').isVisible() && await nexus.isHidden());
  await p.keyboard.press('n'); await p.waitForTimeout(600);
  ok('N desde la sala: abre Nexus y cierra la sala', await nexus.isVisible() && await p.locator('#sala-control').isHidden());
  await p.keyboard.press('n'); await p.waitForTimeout(600);
  ok('N otra vez cierra Nexus', await nexus.isHidden());
  // «Un cuarto» sigue disponible y la sala de control sigue igual (6 proyectos; Nexus no es un piso).
  await p.keyboard.press('s'); await p.waitForTimeout(600);
  ok('la sala de control sigue con los 7 proyectos (6 + piso CSI; Nexus no se mezcla con el contrato v1)', (await p.locator('.sala-tarjeta').count()) === 7);
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  await p.locator('[data-modo3d="individual"]').click(); await p.waitForTimeout(2500);
  const modoCuarto = await p.evaluate(() => window.__cauce3d?.metricas().modo);
  await p.keyboard.press('n'); await p.waitForTimeout(600); await p.keyboard.press('n'); await p.waitForTimeout(1500);
  ok('el modo «Un cuarto» sigue funcionando y se conserva al abrir y cerrar Nexus', modoCuarto === 'individual' && (await p.evaluate(() => window.__cauce3d?.metricas().modo)) === 'individual', modoCuarto);
  await p.locator('[data-modo3d="edificio"]').click(); await p.waitForTimeout(1500);

  // Registro real presente: se usa en lugar del de prueba; uno alterado se avisa.
  const real = JSON.parse(JSON.stringify(descarga));
  let manifiestoServido = manifiestoBajado;
  await p.route('**/datos/nexus/registro/lecciones.json*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(real) }));
  await p.route('**/datos/nexus/registro/manifiesto.json*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(manifiestoServido) }));
  await p.keyboard.press('n'); await p.waitForTimeout(1200);
  let t2 = await nexus.innerText();
  ok('con registro real: marca REAL, sin franja de prueba y 1 lección', !/DATOS DE PRUEBA/.test(t2) && (await nexus.locator('[data-fuente="real"]').count()) === 1 && /1\s*lecciones registradas/.test(t2));
  ok('integridad «Íntegro» con el manifiesto descargado y su ancla a la vista', (await nexus.locator('[data-integridad="integro"]').count()) === 1 && /Ancla: 1:[0-9a-f]{16}/.test(t2));
  ok('las candidatas siguen fuera del almacén real (3)', (await p.locator('[data-candidata]').count()) === 3);
  const truncado = { ...real, entradas: [] };
  await p.unroute('**/datos/nexus/registro/lecciones.json*');
  await p.route('**/datos/nexus/registro/lecciones.json*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(truncado) }));
  await p.keyboard.press('n'); await p.waitForTimeout(300); await p.keyboard.press('n'); await p.waitForTimeout(1200);
  ok('registro truncado (le quitaron la última entrada): la oficina dice TRUNCADO', (await nexus.locator('[data-integridad="truncado"]').count()) === 1 && /faltan 1 al final/.test(await nexus.innerText()));
  await p.unroute('**/datos/nexus/registro/lecciones.json*');
  await p.route('**/datos/nexus/registro/lecciones.json*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(real) }));
  real.entradas.push({ ...real.entradas[0], huella_anterior: '0'.repeat(64) });
  await p.keyboard.press('n'); await p.waitForTimeout(300); await p.keyboard.press('n'); await p.waitForTimeout(1200);
  t2 = await nexus.innerText();
  ok('registro con historial alterado: lo avisa y no muestra la entrada alterada como válida', /problema/.test(t2) && /huella no coincide/.test(t2));
  await p.unroute('**/datos/nexus/registro/lecciones.json*');
  await p.unroute('**/datos/nexus/registro/manifiesto.json*');
  await p.keyboard.press('Escape');
  await p.close();

  // ---------------------------------------------------------------- Plano 2D (sin 3D)
  const p2 = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await preparar(p2);
  await p2.goto(BASE + '?nexus=1'); await p2.waitForTimeout(2500);
  await p2.locator('#nexus .boton').first().click(); await p2.waitForTimeout(300);
  await p2.locator('[data-vista="2d"]').click(); await p2.waitForTimeout(800);
  await p2.locator('#boton-nexus').click(); await p2.waitForTimeout(1000);
  ok('en el plano 2D Nexus funciona igual', await p2.locator('#nexus').isVisible() && (await p2.locator('[data-leccion]').count()) === 6);
  await p2.evaluate(() => { try { localStorage.removeItem('cauce.vista'); } catch {} });
  await p2.close();

  // ---------------------------------------------------------------- Celular
  for (const [nombre, disp] of [['celular-vertical', devices['Pixel 7']], ['celular-horizontal', devices['Pixel 7 landscape']]]) {
    const ctx = await b.newContext({ ...disp });
    const pc = await ctx.newPage();
    await preparar(pc);
    await pc.goto(BASE); await pc.waitForTimeout(5000);
    const boton = pc.locator('#boton-nexus');
    ok(`${nombre}: el botón Nexus se ve y cabe en la cabecera`, await boton.isVisible());
    await boton.click(); await pc.waitForTimeout(1200);
    const ancho = await pc.evaluate(() => ({ doc: document.documentElement.scrollWidth, vista: window.innerWidth }));
    ok(`${nombre}: Nexus abierto sin desplazamiento horizontal`, ancho.doc <= ancho.vista + 1, `${ancho.doc} > ${ancho.vista}`);
    await foto(pc, `nexus-${nombre}`);
    await ctx.close();
  }

  // ---------------------------------------------------------------- pruebas.html (incluye las de Nexus)
  const pp = await b.newPage();
  vigilar(pp);
  await pp.goto(BASE + 'pruebas.html'); await pp.waitForFunction(() => !/Ejecutando/.test(document.getElementById('resumen').textContent), null, { timeout: 120000 });
  const resumen = await pp.locator('#resumen').innerText();
  const nexusEnNavegador = await pp.locator('li', { hasText: /Nexus|^.?\s*T\d\d/ }).count();
  ok('pruebas.html en el navegador: 0 fallaron', / 0 fallaron/.test(resumen), resumen);
  ok('pruebas.html incluye las pruebas de Nexus', nexusEnNavegador >= 30, `${nexusEnNavegador}`);
  await pp.close();

  await b.close();
  for (const r of res) console.log(r);
  console.log(`errores: ${errs.length ? JSON.stringify(errs.slice(0, 5)) : 'ninguno'}`);
  process.exit(res.some((r) => r.startsWith('FALLA')) || errs.length ? 1 : 0);
})();
