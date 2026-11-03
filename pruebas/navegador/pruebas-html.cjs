// Corre pruebas.html en Chromium (lo mismo que abre Diego en Windows) y lee el resultado.
// Con servir.py corriendo: node pruebas/navegador/pruebas-html.cjs
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://127.0.0.1:8765/pruebas.html');
  await p.waitForFunction(() => /pasaron/.test(document.body.innerText), null, { timeout: 60000 });
  const texto = await p.evaluate(() => document.body.innerText);
  console.log((texto.match(/\d+ pasaron, \d+ fallaron/) || ['sin resumen'])[0]);
  for (const l of texto.split('\n').filter((l) => /FALLA/.test(l))) console.log(l);
  console.log('errores:', errs.length ? errs : 'ninguno');
  await b.close();
})();
