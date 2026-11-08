// Laboratorio de IA fase 3.1 (navegador): fricciones del intercambio manual, diagnóstico sin contenido y resistencia del
// guardado local. Con servir.py corriendo:  node pruebas/navegador/laboratorio-fase3-1.cjs   (SAL=carpeta para capturas)
//
// Las respuestas que pega esta prueba son SINTÉTICAS (las escribe la prueba a partir de la solicitud). No son de ningún
// modelo. SwiftShader: comprueba comportamiento, no mide la Intel UHD.
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = 'http://127.0.0.1:' + (process.env.PUERTO || 8765) + '/';
const SAL = process.env.SAL || null;
if (SAL) fs.mkdirSync(SAL, { recursive: true });

function respuestaSintetica(sol) {
  const enc = /encargo: (\S+)/.exec(sol)[1], sha = /Huella del encargo[^:]*: ([0-9a-f]{64})/.exec(sol)[1];
  const fuente = /fuente_id «([^»]+)»/.exec(sol)[1];
  const lineas = [...sol.matchAll(/^\[L(\d+)\] (.*)$/gm)].map((m) => m[2]);
  return { formato: 'cauce.lab.respuesta-manual', version: '0.1', encargo_id: enc, encargo_sha256: sha, rol: 'investigador', modelo_declarado: 'respuesta sintética de prueba (no es un modelo)',
    preguntas: ['¿Por qué el Revisor está en error?'], afirmaciones: [{ id: 'a1', texto: 'El Revisor figura en error.', clase: 'hecho_citado', citas: [{ fuente_id: fuente, extracto: `[L${lineas.findIndex((l) => /«error»/.test(l)) + 1}] ${lineas.find((l) => /«error»/.test(l))}`, ubicacion: null }] }],
    dudas: ['Falta el registro detallado del Revisor.'], limitaciones: ['Una sola fuente.'] };
}

(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true });
  const res = []; const errs = [];
  const ok = (n, c, x = '') => res.push(`${c ? 'OK ' : 'FALLA'} ${n}${x ? ' · ' + x : ''}`);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await p.route('**/datos/proyectos.local.json*', (r) => r.fulfill({ status: 404, body: '' }));
  await p.route('**/datos/reales/*.json*', (r) => r.fulfill({ status: 404, body: '' }));
  const lab = p.locator('#laboratorio');
  const foto = async (n) => { if (SAL) await p.screenshot({ path: `${SAL}/${n}.png`, fullPage: true }); };
  const esperar = async (sel, ms = 12000) => { for (let i = 0; i < ms / 100 && !(await lab.locator(sel).count()); i++) await p.waitForTimeout(100); return lab.locator(sel).count(); };
  const pegar = async (texto) => { await lab.locator('#lab-pegar').fill(texto); await lab.locator('[data-accion="importar-respuesta"]').click(); await p.waitForTimeout(500); };

  try {
    await p.goto(BASE + '?laboratorio=1&vista=2d');
    await p.evaluate(() => localStorage.removeItem('cauce.lab.expedientes-manuales'));
    await p.reload();
    await esperar('[data-trabajo]');
    await lab.locator('#lab-nueva-motor').selectOption('demo:compago');
    await lab.locator('[data-accion="nueva-manual"]').click();
    await esperar('[data-espera="investigador"]');
    await lab.locator('.lab-manual details summary').click();
    await esperar('#lab-solicitud');
    const sol = await lab.locator('#lab-solicitud').inputValue();
    const r = respuestaSintetica(sol);
    const bueno = JSON.stringify(r, null, 2);

    // 1 · un fallo de formato no borra lo escrito y dice el lugar exacto
    await lab.locator('#lab-modelo').fill('Modelo X (declarado en la prueba)');
    await lab.locator('#lab-proveedor').fill('Proveedor de prueba');
    const roto = bueno.replace('"preguntas"', '“preguntas”');
    await pegar(roto);
    ok('JSON roto: rechazo clasificado como fallo de formato recuperable', (await lab.locator('[data-importacion="rechazada"][data-categoria="formato"]').count()) === 1 && /recuperable/.test(await lab.innerText()));
    ok('el motivo dice línea y columna y muestra el fragmento con ⟵AQUÍ⟶', /línea \d+, columna \d+/.test(await lab.innerText()) && (await lab.locator('[data-fragmento]').count()) === 1 && /⟵AQUÍ⟶/.test(await lab.locator('[data-fragmento]').innerText()));
    ok('el texto pegado sigue en el cuadro y se avisa', (await lab.locator('#lab-pegar').inputValue()) === roto && (await lab.locator('[data-texto-conservado]').count()) === 1);
    ok('modelo y proveedor escritos no se pierden al redibujar', (await lab.locator('#lab-modelo').inputValue()) === 'Modelo X (declarado en la prueba)' && (await lab.locator('#lab-proveedor').inputValue()) === 'Proveedor de prueba');
    await foto('f31-01-fallo-formato');

    // 2 · reparación segura declarada: comas finales + prefijo [Ln] en el extracto
    const conComas = bueno.replace(/\n  \]/g, ',\n  ]').replace(/\n\}$/, ',\n}');
    await pegar(conComas);
    await esperar('[data-espera="analista"]');
    const t = await lab.innerText();
    ok('comas finales y prefijo [Ln]: se acepta con correcciones de forma declaradas', (await lab.locator('[data-espera="analista"]').count()) === 1 && /Correcciones de forma aplicadas/.test(t) && /comas sobrantes/.test(t) && /prefijo \[Ln\]/.test(t));
    ok('la cita con prefijo quitado quedó comprobada por lab-V (apta)', /lab-V: apta para revision humana/i.test(t.replace(/ó/g, 'o')) || /lab-V: apta/.test(t));
    ok('tras aceptar, el cuadro de pegar queda vacío y el modelo sigue', (await lab.locator('#lab-pegar').inputValue()) === '' && (await lab.locator('#lab-modelo').inputValue()) === 'Modelo X (declarado en la prueba)');

    // 3 · diagnóstico descargable, sin contenido de respuestas ni de la ficha
    await lab.locator('[data-pestana-lab="auditoria"]').click();
    ok('botón de diagnóstico (Markdown y JSON) en Auditoría', (await lab.locator('[data-descarga$="-diagnostico.md"]').count()) === 1 && (await lab.locator('[data-descarga$="-diagnostico.json"]').count()) === 1);
    const [d1] = await Promise.all([p.waitForEvent('download'), lab.locator('[data-descarga$="-diagnostico.md"]').click()]);
    const md = fs.readFileSync(await d1.path(), 'utf8');
    ok('el diagnóstico dice qué falló (json_invalido, formato) y las correcciones', /json_invalido×1 \[formato, recuperable\]/.test(md) && /comas_finales_quitadas/.test(md) && /prefijo_linea_quitado/.test(md));
    ok('el diagnóstico no trae la ficha, la pregunta ni los extractos', !/Ficha de solo lectura/.test(md) && !/¿Qué problemas muestra/.test(md) && !/El Revisor figura en error/.test(md) && !/«error»/.test(md));
    ok('la lista de importaciones muestra el intento rechazado y el aceptado', (await lab.locator('[data-import="rechazada"]').count()) === 1 && (await lab.locator('[data-import="aceptada"]').count()) === 1);
    await foto('f31-02-diagnostico');

    // 4 · recargar no pierde el trabajo; reanudar el mismo expediente dos veces no lo duplica
    await p.reload();
    await esperar('[data-espera="analista"]');
    ok('tras recargar, el trabajo sigue esperando al Analista', (await lab.locator('[data-espera="analista"]').count()) === 1);
    const n1 = await lab.locator('.lab-trabajos [data-naturaleza="ia_manual"]').count();
    await lab.locator('[data-pestana-lab="auditoria"]').click();
    const [d2] = await Promise.all([p.waitForEvent('download'), lab.locator('[data-descarga$="-expediente.json"]').click()]);
    const ruta = await d2.path();
    await lab.locator('#lab-importar-expediente').setInputFiles(ruta);
    await p.waitForTimeout(600);
    ok('importar el mismo expediente exportado no duplica el trabajo', (await lab.locator('.lab-trabajos [data-naturaleza="ia_manual"]').count()) === n1 && /Expediente reanudado/.test(await lab.innerText()));
    const exp = JSON.parse(fs.readFileSync(ruta, 'utf8'));
    ok('el expediente exportado guarda los fallos por código, sin fragmentos del texto', exp.importaciones.length === 2 && exp.importaciones[0].fallos[0].codigo === 'json_invalido' && !JSON.stringify(exp).includes('⟵AQUÍ⟶'));

    // 5 · el guardado local falla (cuota) → aviso recuperable, el trabajo sigue en memoria
    await p.evaluate(() => { const o = Storage.prototype.setItem; window.__setItem = o; Storage.prototype.setItem = function () { const e = new Error('QuotaExceededError simulado'); e.name = 'QuotaExceededError'; throw e; }; });
    await lab.locator('.lab-manual details summary').click();
    await pegar('{ no es json');
    ok('si el navegador no puede guardar, se avisa y se pide exportar (sin perder el trabajo en memoria)', /No se pudo guardar en este navegador/.test(await lab.innerText()) && /Exporta el expediente/.test(await lab.innerText()) && (await lab.locator('[data-espera="analista"]').count()) === 1);
    await p.evaluate(() => { Storage.prototype.setItem = window.__setItem; });
    await foto('f31-03-cuota');

    ok('sin errores de JavaScript en la consola', errs.length === 0, errs.slice(0, 3).join(' | '));
  } catch (e) { res.push(`FALLA excepción: ${e.message}`); await foto('f31-excepcion'); }
  await b.close();
  const fallas = res.filter((l) => l.startsWith('FALLA')).length;
  console.log(res.join('\n')); console.log(`\n${res.length - fallas}/${res.length} OK`);
  process.exit(fallas ? 1 : 0);
})();
