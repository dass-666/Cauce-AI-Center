// Cierre del producto en Chromium: recorridos de principio a fin que una persona hace en la oficina.
//   1. Abrir la oficina y entender el estado de los proyectos (selector, sala de control).
//   2. Consultar el caso histórico del franco suizo SIN Node (reconstruido desde el expediente publicado) y bajar su expediente .md.
//   3. Crear una investigación pequeña de PRÁCTICA (DEMO, datos marcados [PRUEBA]), añadir fuente, enunciado e hipótesis,
//      pasar el Abogado del Diablo y descargar investigaciones.json + expediente .md.
//   4. Revisar propuestas y decisiones de Nexus (DEMO) dentro de la fase manual: sin botón de aprobar.
//   5. Recargar y comprobar que el borrador del laboratorio sigue; descartarlo.
//   6. Provocar errores (archivo del almacén dañado, DEMO y REAL mezclados) y ver que se entienden y se puede seguir.
// Con servir.py corriendo:  node pruebas/navegador/cierre.cjs      (SAL=carpeta para capturas, opcional)
// SwiftShader: comprueba comportamiento; NO mide el rendimiento de la Intel UHD.
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const BASE = 'http://127.0.0.1:' + (process.env.PUERTO || 8765) + '/';
const SAL = process.env.SAL || null;
if (SAL) fs.mkdirSync(SAL, { recursive: true });
const RAIZ = path.join(__dirname, '..', '..');
const mod = (r) => import(pathToFileURL(path.join(RAIZ, r)).href);

(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const res = []; const errs = [];
  const ok = (n, c, x = '') => { const l = `${c ? 'OK ' : 'FALLA'} ${n}${x ? ' · ' + x : ''}`; res.push(l); console.log(l); };
  const vigilar = (p) => { p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errs.push(m.text()); }); };
  const foto = async (p, n, completa = false) => { if (SAL) await p.screenshot({ path: `${SAL}/${n}.png`, fullPage: completa }); };
  // Sin datos reales ni almacenes locales: lo que vería alguien que acaba de descargar el repositorio.
  const sinLocales = async (p, { historico = true } = {}) => {
    await p.route('**/datos/proyectos.local.json*', (r) => r.fulfill({ status: 404, body: '' }));
    await p.route('**/datos/reales/*.json*', (r) => r.fulfill({ status: 404, body: '' }));
    await p.route('**/datos/csi/registro/*.json*', (r) => r.fulfill({ status: 404, body: '' }));
    await p.route('**/datos/nexus/registro/*.json*', (r) => r.fulfill({ status: 404, body: '' }));
    if (historico) await p.route('**/datos/csi/historico/*.json*', (r) => r.fulfill({ status: 404, body: '' }));
  };
  const bajar = async (p, selector) => { const [d] = await Promise.all([p.waitForEvent('download'), p.locator(selector).first().click()]); return { nombre: d.suggestedFilename(), texto: fs.readFileSync(await d.path(), 'utf8') }; };

  // ---------- 1. Abrir la oficina y entender el estado de los proyectos ----------
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true });
  const p = await ctx.newPage(); vigilar(p); // contexto nuevo: almacenamiento local vacío
  await sinLocales(p);
  await p.goto(BASE); await p.waitForTimeout(4500);
  const pisos = p.locator('#pisos .piso');
  const nPisos = await pisos.count();
  const etiquetas = await pisos.allInnerTexts();
  ok('1. el selector muestra los 7 pisos con su estado (DEMO o Sin conexión), sin inventar REAL', nPisos === 7 && etiquetas.every((t) => /DEMO|Sin conexión|Pendiente/i.test(t)) && !etiquetas.some((t) => /\bREAL\b/.test(t)), etiquetas.map((t) => t.replace(/\s+/g, ' ')).join(' | '));
  ok('1. la franja «DATOS DE DEMOSTRACIÓN» está visible al abrir', await p.locator('#banda-demo').isVisible() && /DEMOSTRACI/.test(await p.locator('#banda-demo').innerText()));
  await foto(p, 'c1-oficina');
  await p.keyboard.press('s'); await p.waitForTimeout(800);
  const sala = p.locator('#sala-control');
  const tSala = await sala.innerText();
  ok('1. la sala de control (S) lista los proyectos y separa DEMO de REAL', await sala.isVisible() && /Sala de control/i.test(tSala) && /DEMO/.test(tSala) && (await sala.locator('[data-proyecto], .sala-proyecto, li').count()) >= 7, tSala.split('\n').slice(0, 3).join(' / '));
  ok('1. ningún botón de la sala «resuelve» nada: no hay Aprobar, Ejecutar ni Reintentar proceso', !/\b(Aprobar|Ejecutar|Pausar|Reiniciar)\b/.test(tSala));
  await foto(p, 'c1-sala-control', true);
  await p.keyboard.press('Escape'); await p.waitForTimeout(500);

  // ---------- 2. Consultar el caso suizo sin Node ----------
  await p.keyboard.press('i'); await p.waitForTimeout(3500);
  const csi = p.locator('#csi');
  ok('2. CSI abre en DEMO (el almacén real está vacío) y el botón HISTÓRICO está disponible aunque la carpeta local esté vacía',
    (await csi.locator('[data-fuente="demo"]').count()) === 1 && await p.locator('[data-conjunto="historico"]').isEnabled() && await p.locator('[data-conjunto="registro"]').isDisabled());
  await p.locator('[data-conjunto="historico"]').click(); await p.waitForTimeout(3500);
  let t = await csi.innerText();
  ok('2. el caso suizo se reconstruye en el navegador desde el expediente publicado y se marca como tal', (await csi.locator('[data-fuente="historico"][data-origen="publicado"]').count()) === 1 && /reconstruido en este navegador/.test(t) && /HISTÓRICO · REAL RETROSPECTIVO/.test(t));
  ok('2. sin errores de lectura y sin «null»/«undefined»', (await csi.locator('.nexus-errores').count()) === 0 && !/\bnull\b|\bundefined\b/.test(t));
  const pestana = async (k) => { await p.locator(`[data-pestana="${k}"]`).click(); await p.waitForTimeout(300); return csi.innerText(); };
  t = await pestana('fuentes');
  ok('2. fuentes: 13 registros, 12 consultadas con huella y 1 PENDIENTE (el enlace equivocado de 2011 se conserva)',
    (await csi.locator('[data-fuente-id]').count()) === 13 && (await csi.locator('[data-estado-fuente="pendiente"]').count()) === 1 && /12 consultada\(s\) · 1 pendiente\(s\) · 0 sin copia verificable/.test(t) && (await csi.locator('[data-fuente-id="f-bns-2011"]').count()) === 1);
  ok('2. fuentes: las 12 huellas de las copias privadas se muestran y los cotejos se ven en el historial de cada fuente', (t.match(/Huella de la copia: [0-9a-f]{16}…/g) || []).length === 12 && (await csi.locator('[data-cotejos]').count()) >= 10);
  await foto(p, 'c2-caso-suizo-fuentes', true);
  t = await pestana('flujo');
  ok('2. flujo de 10 pasos: 9/10 y la falta es la evidencia de H-C y H-D (correcto: no la hay)', /9\/10|9 de 10/.test(t) && /H-C/.test(t) && /H-D/.test(t));
  t = await pestana('abogado');
  ok('2. Abogado del Diablo: tabla de 8 preguntas × 4 hipótesis firmada por código', (await csi.locator('[data-abogado-tabla] tbody tr').count()) === 8 && /abogado-csi \(codigo\)/.test(t) && /No es una revisión humana/.test(t));
  t = await pestana('predicciones');
  ok('2. un caso histórico no tiene predicciones y lo explica', (await csi.locator('[data-sin-predicciones]').count()) === 1 && /retrospectivo/.test(t));
  t = await pestana('nexus');
  await p.locator('[data-preparar="H-A"]').click(); await p.waitForTimeout(500);
  t = await csi.innerText();
  ok('2. propuesta a Nexus: «decisión: pendiente», sin botón de aprobar', (await csi.locator('[data-decision="pendiente"]').count()) === 1 && !/Aprobar/.test(t) && (await csi.locator('a[download$=".json"]').count()) >= 1);
  await foto(p, 'c2-caso-suizo-nexus', true);
  await pestana('investigaciones');
  const exp = await bajar(p, 'a[download="expediente-hist-bns-minimo-2015.md"]');
  ok('2. el expediente .md del caso suizo se descarga y dice lo mismo que la pantalla (HISTÓRICO, 12 consultadas, 1 pendiente, 9/10, 15 alertas, 100 cambios)',
    exp.nombre === 'expediente-hist-bns-minimo-2015.md' && /HISTÓRICO · REAL RETROSPECTIVO/.test(exp.texto) && /## 3\. Fuentes \(12 consultadas · 1 pendientes · 0 sin copia verificable\)/.test(exp.texto) && /9 de 10 pasos/.test(exp.texto) && /15 alerta\(s\)/.test(exp.texto) && /Historial \(100 cambios/.test(exp.texto) && /Caso publicado|caso HISTÓRICO/.test(exp.texto));
  ok('2. el expediente .md no contiene rutas privadas ni copias de terceros', !/[A-Z]:\\/.test(exp.texto) && !/<html/i.test(exp.texto) && exp.texto.length < 120_000);
  if (SAL) fs.writeFileSync(path.join(SAL, 'expediente-hist-bns-minimo-2015.md'), exp.texto);

  // ---------- 3. Crear una investigación de práctica y llegar a su expediente ----------
  await pestana('laboratorio');
  const llenar = async (pares) => { for (const [id, v] of pares) { const loc = p.locator(`#csi-lab-${id}`); if ((await loc.evaluate((n) => n.tagName)) === 'SELECT') await loc.selectOption(v); else await loc.fill(v); } };
  const abrir = (k) => p.locator(`[data-form="${k}"]`).evaluate((d) => { d.open = true; });
  const aplicar = async (k) => { await p.locator(`[data-enviar="${k}"]`).click(); await p.waitForTimeout(400); return (await csi.locator('.csi-mensajes').innerText()).split('\n')[0]; };
  ok('3. el laboratorio arranca con «Práctica (DEMO)» marcado y aviso de que nada se guarda solo en el almacén', await p.locator('#csi-practica').isChecked() && /borrador en este navegador/.test(await csi.innerText()));
  await llenar([['alias', 'diego'], ['id', 'prueba-cierre'], ['titulo', '[PRUEBA] Subida de tasa de referencia'], ['pregunta', '¿Por qué subió la tasa el instituto de prueba?'], ['acont', '[PRUEBA] El instituto sube la tasa'], ['fecha', '2026-12-01']]);
  let msg = await aplicar('crear');
  ok('3. crear investigación de práctica (DEMO)', /creada \(DEMO\)/.test(msg), msg);
  await abrir('fuente');
  await llenar([['f-id', 'f1'], ['f-titulo', '[PRUEBA] Comunicado del instituto'], ['f-editor', 'Instituto de Prueba'], ['f-tipo', 'documento_oficial'], ['f-clase', 'primaria'], ['f-estado', 'consultada'], ['f-fecha', '2026-11-01'], ['f-enlace', 'https://example.org/comunicado-prueba'], ['f-extracto', '"La junta decidió subir la tasa de referencia."'], ['f-ext-tipo', 'cita_textual'], ['f-limit', 'Fuente ficticia de prueba']]);
  msg = await aplicar('fuente');
  ok('3. añadir una fuente ficticia marcada como tal', /agregar_fuente: listo/.test(msg), msg);
  await abrir('enunciado');
  await llenar([['e-id', 'e1'], ['e-tipo', 'hecho'], ['e-texto', 'El instituto subió la tasa.'], ['e-fuentes', 'f1'], ['e-sobre', 'conducta'], ['e-cita', 'La junta decidió subir la tasa de referencia.']]);
  msg = await aplicar('enunciado');
  ok('3. añadir un hecho con cita con procedencia', /agregar_enunciado: listo/.test(msg), msg);
  await abrir('hipotesis');
  await llenar([['h-id', 'H1'], ['h-cat', 'fundamentales'], ['h-texto', 'Subió por inflación.'], ['h-favor', 'e1'], ['h-refuta', 'Inflación a la baja'], ['h-faltan', 'Actas de la junta']]);
  msg = await aplicar('hipotesis');
  ok('3. añadir una hipótesis', /agregar_hipotesis: listo/.test(msg), msg);
  await p.locator('[data-lab-abogado]').click(); await p.waitForTimeout(400);
  msg = (await csi.locator('.csi-mensajes').innerText()).split('\n')[0];
  ok('3. el Abogado del Diablo (código) revisa y deja objeciones abiertas', /Abogado del Diablo \(código\): \d+ alerta/.test(msg), msg);
  t = await csi.innerText();
  ok('3. el borrador se guarda en el navegador y el panel dice que la práctica NO va al almacén real', (await csi.locator('[data-borrador="guardado"]').count()) === 1 && (await csi.locator('[data-guardar="demo"]').count()) === 1 && /no la guardes en el almacén real/.test(t));
  const col = await bajar(p, 'a[download="investigaciones.json"]');
  const { leerCSI } = await mod('app/csi/registro.js');
  const docCol = JSON.parse(col.texto);
  const leido = await leerCSI({ investigaciones: docCol });
  ok('3. investigaciones.json descargado es una colección DEMO que el almacén lee sin errores, con historial íntegro', docCol.contrato === 'cauce.csi.investigaciones' && docCol.es_demo === true && leido.errores.length === 0 && leido.investigaciones.length === 1 && leido.investigaciones[0].integridad.ok && leido.investigaciones[0].inv.id === 'prueba-cierre', leido.errores.join(' | '));
  const expLab = await bajar(p, 'a[download="expediente-prueba-cierre.md"]');
  ok('3. el expediente .md del laboratorio se descarga marcado DEMO, con la fuente, el hecho, la hipótesis y las objeciones del Abogado', /DEMO · CASO FICTICIO/.test(expLab.texto) && /\| f1 \|/.test(expLab.texto) && /\*\*e1\*\*/.test(expLab.texto) && /### H1/.test(expLab.texto) && /abogado-csi/.test(expLab.texto));
  await foto(p, 'c3-laboratorio', true);

  // ---------- 4. Nexus: propuestas y decisiones dentro de la fase manual ----------
  await p.keyboard.press('Escape'); await p.waitForTimeout(500);
  await p.keyboard.press('n'); await p.waitForTimeout(3000);
  const nexus = p.locator('#nexus');
  t = await nexus.innerText();
  ok('4. Nexus abre en DEMO (almacén real vacío) y lo dice sin ambigüedad', (await nexus.locator('[data-fuente="demo"]').count()) === 1 && /DEMO · DATOS DE PRUEBA/.test(t));
  const pend = await nexus.locator('[data-rec]').count();
  ok('4. «Esperan decisión humana» lista recomendaciones con su estado (Lista para decidir / Bloqueada) y explica que aquí no se aprueba', pend >= 1 && /Lista para decidir|Bloqueada/.test(t) && /Desde aquí no se aprueba nada/.test(t));
  ok('4. ningún botón aprueba ni ejecuta', (await nexus.locator('button', { hasText: /^(Aprobar|Ejecutar|Adoptar)$/ }).count()) === 0);
  ok('4. las candidatas Ek Chuah se ven fuera del almacén y no cuentan en las cifras', /Candidatas fuera del almacén \(3\)/i.test(t) && /No cuentan en ninguna cifra/.test(t));
  await foto(p, 'c4-nexus', true);
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);

  // ---------- 5. Recargar: el borrador del laboratorio sigue ----------
  await p.reload(); await p.waitForTimeout(4500);
  await p.keyboard.press('i'); await p.waitForTimeout(3000);
  t = await csi.innerText();
  ok('5. tras recargar, la pestaña del laboratorio marca que hay un borrador (●)', /Nueva investigación ●/.test(t));
  await pestana('laboratorio');
  t = await csi.innerText();
  ok('5. el borrador se recupera con su título, su historial y el aviso de que no está en el almacén', /Borrador recuperado de este navegador/.test(t) && /\[PRUEBA\] Subida de tasa de referencia/.test(t) && /No está en el almacén/.test(t) && (await csi.locator('[data-borrador="guardado"]').count()) === 1);
  await foto(p, 'c5-borrador-recuperado', true);
  await p.locator('[data-descartar-borrador]').click(); await p.waitForTimeout(400);
  t = await csi.innerText();
  ok('5. «Descartar borrador» lo quita y no toca el almacén', /Borrador descartado/.test(t) && !/Nueva investigación ●/.test(t));
  await p.reload(); await p.waitForTimeout(4000);
  await p.keyboard.press('i'); await p.waitForTimeout(2500);
  ok('5. tras descartar y recargar no vuelve a aparecer', !/Nueva investigación ●/.test(await csi.innerText()));
  ok('sin errores de JavaScript en los recorridos 1–5', errs.length === 0, errs.slice(0, 3).join(' | '));
  await p.close();

  // ---------- 6. Errores que una persona puede provocar ----------
  const p2 = await ctx.newPage(); const errs2 = []; p2.on('pageerror', (e) => errs2.push(e.message));
  await p2.route('**/datos/proyectos.local.json*', (r) => r.fulfill({ status: 404, body: '' }));
  await p2.route('**/datos/reales/*.json*', (r) => r.fulfill({ status: 404, body: '' }));
  await p2.route('**/datos/nexus/registro/*.json*', (r) => r.fulfill({ status: 404, body: '' }));
  await p2.route('**/datos/csi/historico/*.json*', (r) => r.fulfill({ status: 404, body: '' }));
  // 6a. Un archivo del almacén real dañado (lo guardó a medias o lo editó mal).
  // (En Playwright manda la última ruta registrada: primero el 404 genérico, después el archivo dañado.)
  await p2.route('**/datos/csi/registro/*.json*', (r) => r.fulfill({ status: 404, body: '' }));
  await p2.route('**/datos/csi/registro/investigaciones.json*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"contrato": "cauce.csi.investigaciones", "investigaciones": [' }));
  await p2.goto(BASE + '?csi=1'); await p2.waitForTimeout(4000);
  const csi2 = p2.locator('#csi');
  t = await csi2.innerText();
  ok('6a. un investigaciones.json dañado en el almacén se explica («no es JSON válido») en vez de taparse con el DEMO', (await csi2.locator('.nexus-errores').count()) === 1 && /no es JSON válido/.test(t) && (await csi2.locator('[data-fuente="real"]').count()) === 1);
  ok('6a. se puede seguir: cambiar a DEMO o a HISTÓRICO funciona', await p2.locator('[data-conjunto="demo"]').isEnabled() && await p2.locator('[data-conjunto="historico"]').isEnabled());
  await foto(p2, 'c6-archivo-danado', true);
  await p2.locator('[data-conjunto="demo"]').click(); await p2.waitForTimeout(1500);
  ok('6a. en DEMO ya no aparece el error del archivo real', (await csi2.locator('[data-fuente="demo"]').count()) === 1 && !/no es JSON válido/.test(await csi2.innerText()));
  // 6b. DEMO y REAL mezclados en el almacén real.
  await p2.unroute('**/datos/csi/registro/investigaciones.json*');
  const demoInv = JSON.parse(fs.readFileSync(path.join(RAIZ, 'datos/csi/demo/investigaciones.json'), 'utf8'));
  const mezcla = { ...demoInv, es_demo: false };
  await p2.route('**/datos/csi/registro/investigaciones.json*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mezcla) }));
  await p2.locator('[data-conjunto="registro"]').click(); await p2.waitForTimeout(2000);
  t = await csi2.innerText();
  ok('6b. una colección REAL con investigaciones DEMO dentro se rechaza con un motivo claro y no se muestra', /DEMO\/REAL distinto del resto|Se mezclan documentos DEMO y REAL|ficticia no puede estar en un documento REAL/.test(t) && (await csi2.locator('[data-investigacion]').count()) === 0);
  // 6c. Un ancla alterada en DEMO (ya cubierto en csi-fase2.cjs): aquí solo que el campo de archivo existe y el error se explica.
  await p2.locator('[data-conjunto="demo"]').click(); await p2.waitForTimeout(1500);
  await p2.locator('[data-pestana="predicciones"]').click(); await p2.waitForTimeout(300);
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'cierre-'));
  const fMala = path.join(tmp, 'no-es-ancla.json'); fs.writeFileSync(fMala, '{"contrato": "otra cosa"}');
  await p2.locator('[data-cargar-ancla]').setInputFiles(fMala); await p2.waitForTimeout(600);
  t = await csi2.innerText();
  ok('6c. un archivo que no es un ancla se rechaza con explicación y las filas siguen en «Hora DECLARADA»', /NO coincide|No se pudo leer el ancla/.test(t) && (await csi2.locator('tr[data-temporal="declarada"]').count()) === 5);
  ok('sin errores de JavaScript en el recorrido 6', errs2.length === 0, errs2.slice(0, 3).join(' | '));
  await p2.close();

  // ---------- Celular: el caso suizo y el laboratorio caben en 390 px ----------
  const cm = await b.newContext({ ...devices['iPhone 13'] });
  const pm = await cm.newPage(); const errsM = []; pm.on('pageerror', (e) => errsM.push(e.message));
  await sinLocales(pm);
  await pm.goto(BASE + '?csi=historico'); await pm.waitForTimeout(5000);
  const anchoDoc = await pm.evaluate(() => document.documentElement.scrollWidth);
  ok('celular: el caso suizo abre en HISTÓRICO sin desplazamiento horizontal', (await pm.locator('#csi [data-fuente="historico"]').count()) === 1 && anchoDoc <= 390 + 2, `ancho ${anchoDoc}`);
  await pm.locator('[data-pestana="fuentes"]').click(); await pm.waitForTimeout(400);
  ok('celular: las 13 fuentes se listan', (await pm.locator('#csi [data-fuente-id]').count()) === 13);
  await foto(pm, 'c7-celular-caso-suizo', true);
  ok('sin errores de JavaScript en celular', errsM.length === 0, errsM.join(' | '));
  await pm.close();

  await b.close();
  const fallas = res.filter((r) => r.startsWith('FALLA')).length;
  console.log(`\n${res.length - fallas} OK, ${fallas} FALLA · errores: ${errs.length + errs2.length + errsM.length ? JSON.stringify([...errs, ...errs2, ...errsM].slice(0, 5)) : 'ninguno'}`);
  process.exit(fallas ? 1 : 0);
})().catch((e) => { console.error('FALLA', e); process.exit(1); });
