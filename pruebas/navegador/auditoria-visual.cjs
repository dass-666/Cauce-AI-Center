// G: auditoría visual medible en escritorio, celular vertical y horizontal (3D y plano).
// Mide: fracción de pantalla libre para el edificio, alto de controles, etiquetas encimadas,
// textos recortados, desplazamiento horizontal y tamaño de objetivos táctiles. Guarda capturas.
// Con servir.py corriendo: node pruebas/navegador/auditoria-visual.cjs CARPETA [--estricto]
const { chromium, devices } = require('playwright');
const SAL = process.argv[2] || 'r';
const ESTRICTO = process.argv.includes('--estricto');
require('fs').mkdirSync(SAL, { recursive: true });

const PANTALLAS = [
  ['escritorio', { viewport: { width: 1366, height: 768 } }],
  ['escritorio-grande', { viewport: { width: 1920, height: 1080 } }],
  ['celular-vertical', devices['iPhone 12 Pro']],
  ['celular-horizontal', devices['iPhone 12 Pro landscape']],
];

function medirPagina() {
  const vw = innerWidth, vh = innerHeight;
  const caja = (n) => { if (!n || n.hidden || !n.getClientRects().length) return null; const b = n.getBoundingClientRect(); return b.width && b.height ? b : null; };
  const lienzo = caja(document.querySelector('.vista3d canvas')) || caja(document.querySelector('.plano, .vista2d, #oficina'));
  const encima = ['.cabecera', '#conexion', '.banda-demo', '.movil-barra', '.vista3d-personajes', '#panel', '.vista3d-barra', '.vista3d-aviso', '.inmersivo-barra']
    .flatMap((s) => [...document.querySelectorAll(s)]).map(caja).filter(Boolean);
  let libres = 0;
  const N = 32;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const x = (i + 0.5) * vw / N, y = (j + 0.5) * vh / N;
    if (!lienzo || x < lienzo.left || x > lienzo.right || y < lienzo.top || y > lienzo.bottom) continue;
    if (encima.some((b) => x >= b.left && x <= b.right && y >= b.top && y <= b.bottom)) continue;
    libres++;
  }
  // Alto ocupado por controles antes del edificio (cabecera + franjas + barra superior).
  const arriba = lienzo ? Math.max(0, Math.round(lienzo.top)) : null;
  // Etiquetas de departamento encimadas (más de 30 % del área de la menor).
  const etiquetas = [...document.querySelectorAll('.etiqueta-dep')].map(caja).filter(Boolean);
  let encimadas = 0;
  for (let i = 0; i < etiquetas.length; i++) for (let j = i + 1; j < etiquetas.length; j++) {
    const a = etiquetas[i], b = etiquetas[j];
    const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    if (w > 0 && h > 0 && w * h > 0.3 * Math.min(a.width * a.height, b.width * b.height)) encimadas++;
  }
  // Textos recortados con elipsis (visibles).
  const recortados = [...document.querySelectorAll('body *')].filter((n) => {
    if (!n.childNodes.length || ![...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())) return false;
    const b = caja(n); if (!b || b.bottom < 0 || b.top > vh) return false;
    const s = getComputedStyle(n);
    return s.textOverflow === 'ellipsis' && n.scrollWidth > n.clientWidth + 1;
  }).map((n) => (n.className || n.tagName) + ': ' + n.textContent.trim().slice(0, 40));
  // Objetivos táctiles visibles de menos de 32 px de alto (criterio práctico; WCAG 2.2 pide 24).
  const chicos = [...document.querySelectorAll('button, select, a, input, summary, [role=tab]')].filter((n) => {
    const b = caja(n); if (!b || b.bottom < 0 || b.top > vh || b.right < 0 || b.left > vw) return false;
    if (n.closest('.vista3d-medidas, .pie')) return false;
    return b.height < 32 || b.width < 32;
  }).map((n) => (n.textContent || n.getAttribute('aria-label') || n.tagName).trim().slice(0, 20));
  // Accesibilidad básica: todo control visible tiene nombre (texto no oculto a lectores, aria-label o title de etiqueta).
  const sinNombre = [...document.querySelectorAll('button, select, summary, [role=tab], input')].filter((n) => {
    const b = caja(n); if (!b) return false;
    if (n.matches('input')) return !n.closest('label') && !n.getAttribute('aria-label');
    const texto = [...n.childNodes].map((c) => c.nodeType === 3 ? c.textContent : (c.getAttribute?.('aria-hidden') === 'true' ? '' : c.textContent)).join('').trim();
    return !texto && !n.getAttribute('aria-label');
  }).map((n) => n.outerHTML.slice(0, 60));
  const ce = window.__cauce3d?.cajaEdificio?.();
  const edificio = ce ? Math.round((Math.min(ce.der, vw) - Math.max(ce.izq, 0)) * (Math.min(ce.abajo, vh) - Math.max(ce.arriba, 0)) / (vw * vh) * 100) : null;
  return {
    sinNombre, edificio, vw, vh, util: libres / (N * N), arriba, encimadas, etiquetas: etiquetas.length, recortados,
    chicos, scrollX: document.documentElement.scrollWidth - vw,
    demoVisible: !!caja(document.querySelector('.insignia-demo, .vista3d .demo, .banda-demo, .tablero-fuente')),
  };
}

(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const res = [];
  const ok = (n, c, extra = '') => res.push(`${c ? 'OK ' : 'FALLA'} ${n}${extra ? ' · ' + extra : ''}`);
  const info = (n, extra) => res.push(`INFO ${n} · ${extra}`);
  for (const [nombre, disp] of PANTALLAS) {
    const p = await b.newPage({ ...disp });
    await p.route('**/datos/reales/*', (r) => r.fulfill({ status: 404, body: '' }));
    await p.goto('http://127.0.0.1:' + (process.env.PUERTO || 8765) + '/?medir=1'); await p.waitForTimeout(7000);
    const m = await p.evaluate(medirPagina);
    const movil = nombre.startsWith('celular');
    info(`${nombre} 3D`, `cuartos ${m.edificio} % de la pantalla, lienzo libre ${Math.round(m.util * 100)} %, controles arriba ${m.arriba}px, etiquetas encimadas ${m.encimadas}/${m.etiquetas}, recortados ${m.recortados.length}, táctiles <32px ${m.chicos.length}`);
    if (m.recortados.length) info(`${nombre} recortados`, m.recortados.join(' | '));
    if (m.chicos.length && movil) info(`${nombre} táctiles chicos`, m.chicos.join(' | '));
    ok(`${nombre}: sin desplazamiento horizontal`, m.scrollX <= 0, `${m.scrollX}px`);
    ok(`${nombre}: todos los controles visibles tienen nombre accesible`, m.sinNombre.length === 0, m.sinNombre.join(' | '));
    ok(`${nombre}: ningún texto visible cortado con «…»`, m.recortados.length === 0, m.recortados.join(' | '));
    ok(`${nombre}: etiquetas de departamento sin encimarse`, m.encimadas === 0, `${m.encimadas}`);
    await p.screenshot({ path: `${SAL}/${nombre}-3d.png` });
    // Modo inmersivo, si existe.
    const inm = p.locator('[data-inmersivo]');
    if (await inm.count()) {
      await inm.first().click(); await p.waitForTimeout(1500);
      const mi = await p.evaluate(medirPagina);
      info(`${nombre} inmersivo`, `cuartos ${mi.edificio} % de la pantalla, lienzo libre ${Math.round(mi.util * 100)} %, controles arriba ${mi.arriba}px`);
      await p.screenshot({ path: `${SAL}/${nombre}-inmersivo.png` });
      await p.keyboard.press('Escape'); await p.waitForTimeout(600);
      if (await p.locator('html.inmersivo').count()) await p.locator('[data-inmersivo]').first().click();
      await p.waitForTimeout(600);
    }
    await p.locator('[data-vista="2d"]').first().click({ force: true }).catch(() => {});
    await p.waitForTimeout(1200);
    const m2 = await p.evaluate(medirPagina);
    info(`${nombre} plano`, `recortados ${m2.recortados.length}, desplazamiento horizontal ${m2.scrollX}px`);
    ok(`${nombre} plano: sin desplazamiento horizontal`, m2.scrollX <= 0, `${m2.scrollX}px`);
    await p.screenshot({ path: `${SAL}/${nombre}-plano.png`, fullPage: false });
    await p.close();
  }
  console.log(res.join('\n'));
  await b.close();
  if (ESTRICTO && res.some((l) => l.startsWith('FALLA'))) process.exit(1);
})();
