// Prototipo aislado de naturalezas (fase E) en Chromium. Con servir.py corriendo:
//   node pruebas/navegador/naturaleza.cjs [carpeta-capturas]
const { chromium } = require('playwright');
const salida = process.argv[2];
const fallos = [];
const esperar = (c, m) => { if (!c) fallos.push(m); };
(async () => {
  const b = await chromium.launch();
  for (const [nombre, vista] of [['escritorio', { width: 1280, height: 900 }], ['movil', { width: 390, height: 844 }]]) {
    const p = await b.newPage({ viewport: vista });
    const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto('http://127.0.0.1:8765/prototipos/naturaleza/index.html');
    await p.waitForFunction(() => window.__prototipoListo === true);
    const leer = () => p.$$eval('.cuarto', (c) => c.map((x) => [x.dataset.agente, x.dataset.personaje, x.dataset.puesto]));
    const l1 = await leer();
    esperar(l1.length === 8, `${nombre}: se esperaban 8 cuartos, hay ${l1.length}`);
    const presentes1 = l1.filter((x) => x[1] !== 'ausente').map((x) => x[0]);
    esperar(JSON.stringify(presentes1) === '["importador"]', `${nombre}: lectura 1 con personajes ${presentes1}`);
    esperar(await p.isVisible('text=DEMO · Prototipo aislado'), `${nombre}: falta la franja DEMO`);
    const ancho = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    esperar(ancho <= 0, `${nombre}: desplazamiento horizontal de ${ancho}px`);
    if (salida) await p.screenshot({ path: `${salida}/prototipo-${nombre}-lectura1.png`, fullPage: true });
    await p.click('#siguiente');
    const l2 = await leer();
    const breves = l2.filter((x) => x[1] === 'breve').map((x) => x[0]);
    esperar(JSON.stringify(breves) === '["buscador"]', `${nombre}: breves en lectura 2 = ${breves}`);
    esperar(l2.filter((x) => x[2] === 'humano' && x[1] !== 'ausente').length === 0, `${nombre}: un puesto humano tiene personaje`);
    if (salida) await p.screenshot({ path: `${salida}/prototipo-${nombre}-lectura2.png`, fullPage: true });
    const avisos = await p.textContent('#avisos');
    esperar(!avisos.trim(), `${nombre}: avisos ${avisos}`);
    esperar(errs.length === 0, `${nombre}: errores ${errs}`);
    await p.close();
  }
  await b.close();
  console.log(fallos.length ? 'FALLA\n' + fallos.join('\n') : 'prototipo naturalezas: OK (escritorio y móvil)');
  process.exit(fallos.length ? 1 : 0);
})();
