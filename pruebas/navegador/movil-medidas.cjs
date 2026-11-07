// D3: mide el espacio útil en celular (vertical y horizontal) y si algo se encima. No mide rendimiento.
// Con servir.py corriendo: node pruebas/navegador/movil-medidas.cjs   (SAL=carpeta para capturas)
const { chromium, devices } = require('playwright');
const SAL = process.env.SAL || 'r';
require('fs').mkdirSync(SAL, { recursive: true });
const ESTRICTO = process.argv.includes('--estricto');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const res = [];
  const ok = (n, c, extra = '') => res.push(`${c ? 'OK ' : 'FALLA'} ${n}${extra ? ' · ' + extra : ''}`);
  for (const [nombre, disp] of [['iphone12', devices['iPhone 12 Pro']], ['android-chico', { viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }], ['iphone-horizontal', devices['iPhone 12 Pro landscape']], ['android-horizontal', { viewport: { width: 640, height: 360 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }]]) {
    const p = await b.newPage({ ...disp });
    await p.route('**/datos/reales/compago.json*', (r) => r.fulfill({ status: 404, body: '' }));
    await p.goto('http://127.0.0.1:8765/'); await p.waitForTimeout(8000);
    const medir = () => p.evaluate(() => {
      const vh = innerHeight, vw = innerWidth;
      const r = (s) => { const n = document.querySelector(s); if (!n || n.hidden || !n.getClientRects().length) return null; const b = n.getBoundingClientRect(); return b.width && b.height ? b : null; };
      const lienzo = r('.vista3d canvas');
      const visible = lienzo ? Math.max(0, Math.min(vh, lienzo.bottom) - Math.max(0, lienzo.top)) : 0;
      // Espacio del edificio: fracción de la pantalla donde se ve el lienzo sin nada encima
      // (cabecera fija, barra, botones de personajes, aviso ni detalle). Muestreo en una cuadrícula de 24×24.
      const encima = ['#conexion', '.movil-barra', '.vista3d-personajes', '#panel'].map(r).filter(Boolean);
      let libres = 0;
      for (let i = 0; i < 24; i++) for (let j = 0; j < 24; j++) {
        const x = (i + 0.5) * vw / 24, y = (j + 0.5) * vh / 24;
        if (!lienzo || x < lienzo.left || x > lienzo.right || y < lienzo.top || y > lienzo.bottom) continue;
        if (encima.some((b) => x >= b.left && x <= b.right && y >= b.top && y <= b.bottom)) continue;
        libres++;
      }
      const util = libres / 576;
      const fijos = ['.movil-barra', '.vista3d-personajes', '#panel', '.vista3d-aviso'].map((s) => [s, r(s)]).filter(([, b]) => b);
      const choques = [];
      for (let i = 0; i < fijos.length; i++) for (let j = i + 1; j < fijos.length; j++) {
        const [na, a] = fijos[i], [nb, c] = fijos[j];
        if (a.left < c.right && a.right > c.left && a.top < c.bottom - 1 && a.bottom > c.top + 1) choques.push(`${na}×${nb}`);
      }
      // Indicadores: cuánto se sale de la pantalla el último (la fila puede desplazarse, pero no deben quedar fuera).
      return { vh, vw, util, visibleLienzo: visible, choques, estadosOcultos: Math.max(0, ...[...document.querySelectorAll('.tablero-estado')].map((x) => Math.round(x.getBoundingClientRect().right - innerWidth))) };
    });
    const inicio = await medir();
    ok(`${nombre}: al abrir, el edificio ocupa ≥ 50 % de la pantalla`, inicio.util >= 0.5, `${Math.round(inicio.util * 100)} %`);
    ok(`${nombre}: indicadores de estado visibles sin desplazarse`, inicio.estadosOcultos <= 2, `${inicio.estadosOcultos}px ocultos`);
    await p.locator('.movil-actual').click(); await p.locator('.movil-fila', { hasText: 'Importación' }).click(); await p.waitForTimeout(1800);
    const conPanel = await medir();
    ok(`${nombre}: con el detalle abierto queda ≥ 30 % para el edificio`, conPanel.util >= 0.3, `${(conPanel.util * 100).toFixed(1)} %`);
    ok(`${nombre}: barra, botones, aviso y detalle no se enciman`, conPanel.choques.length === 0, conPanel.choques.join(', '));
    await p.screenshot({ path: `${SAL}/${nombre}-detalle.png` });
    await p.close();
  }
  console.log(res.join('\n'));
  await b.close();
  if (ESTRICTO && res.some((l) => l.startsWith('FALLA'))) process.exit(1);
})();
