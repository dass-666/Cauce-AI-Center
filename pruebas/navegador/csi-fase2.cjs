// CSI fase 2 en Chromium: conjuntos REAL / HISTÓRICO / DEMO separados, fuentes con procedencia, mapa de actores,
// flujo de 10 pasos, Abogado del Diablo, contrafactual, propuesta a Nexus 0.2, anclas de predicciones, laboratorio 0.2,
// celular y regresión 2D/3D del piso CSI.
// Con servir.py corriendo:  node pruebas/navegador/csi-fase2.cjs      (SAL=carpeta para capturas, opcional)
// Por defecto el HISTÓRICO es un FIXTURE de prueba (example.org) servido por la prueba; CSI_HIST_REAL=1 usa la copia
// local de datos/csi/historico/ (solo para capturas en la máquina de quien la tenga).
// SwiftShader: comprueba comportamiento; NO mide el rendimiento de la Intel UHD.
const { chromium, devices } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const BASE = 'http://127.0.0.1:' + (process.env.PUERTO || 8765) + '/';
const SAL = process.env.SAL || null;
const REAL = process.env.CSI_HIST_REAL === '1';
if (SAL) fs.mkdirSync(SAL, { recursive: true });
const RAIZ = path.join(__dirname, '..', '..');
const mod = (r) => import(pathToFileURL(path.join(RAIZ, r)).href);

async function fixtureHistorico() {
  const { construirDesdeExpediente } = await mod('app/csi/expediente.js');
  const T = (m) => `2026-11-07T10:${String(m).padStart(2, '0')}:00Z`;
  const A = { tipo: 'humano', identificador: 'ana' };
  const FU = (id, x = {}) => ({ id, titulo: `[PRUEBA] Comunicado ${id}`, editor: 'Instituto de Prueba', tipo: 'documento_oficial', clase: 'primaria', estado: 'consultada', publicada_en: '2020-03-10', consultada_en: '2026-11-07T09:00:00Z', enlace: `https://example.org/${id}`, extracto: '"La junta decidió subir la tasa de referencia."', extracto_tipo: 'cita_textual', metodo_consulta: 'manual', limitaciones: ['Fixture de prueba, no es una fuente real.'], autor_actor_id: 'inst', origen: 'inst', ...x });
  const fuentes = [FU('f1'), FU('f2', { editor: 'Diario de Prueba', tipo: 'prensa', clase: 'secundaria', origen: 'diario', autor_actor_id: undefined, publicada_en: '2020-03-11', extracto: 'Informa la subida.', extracto_tipo: 'parafrasis' }), FU('f3', { publicada_en: '2020-06-01', extracto: 'Explicación posterior.', extracto_tipo: 'parafrasis' }),
    { id: 'f4', titulo: '[PRUEBA] Acta no verificada', editor: 'Instituto de Prueba', tipo: 'documento_oficial', clase: 'primaria', estado: 'pendiente', publicada_en: '2020-03-10', enlace: 'https://example.org/f4', pendiente_motivo: 'Sin acceso verificable al PDF.', limitaciones: ['Contenido no verificado.'] }];
  const actores = { contrato: 'cauce.csi.actores', version_contrato: '0.2', es_demo: false, actualizado_en: T(0), fuentes: [FU('fa')], relaciones: [{ id: 'r1', de: 'inst', a: 'banco', tipo: 'regula', descripcion: 'Supervisa', fuentes: ['fa'] }, { id: 'r2', de: 'banco', a: 'fondo', tipo: 'coopera', descripcion: 'Se dice que cooperan', fuentes: [] }],
    actores: [
      { id: 'inst', nombre: 'Instituto de Prueba', tipo: 'banco_central', ficticio: false, objetivos_documentados: [{ texto: 'Estabilidad', fuentes: ['fa'] }], incentivos_hipoteticos: [{ texto: 'Contener precios' }], recursos_conocidos: [], restricciones: [{ texto: 'Ley', fuentes: ['fa'], clase: 'legal' }], decisiones_posibles: [{ id: 'subir', texto: 'Subir' }, { id: 'esperar', texto: 'Esperar' }], incertidumbres: [], intereses_economicos: [{ texto: 'Resultado expuesto a la tasa', fuentes: ['fa'] }], decisiones_historicas: [{ id: 'd1', fecha: '2020-03-10', texto: 'Sube la tasa', fuentes: ['fa'] }], conflictos_interes: [] },
      { id: 'banco', nombre: 'Banco de Prueba', tipo: 'institucion_financiera', ficticio: false, objetivos_documentados: [], incentivos_hipoteticos: [{ texto: 'Márgenes' }], recursos_conocidos: [], restricciones: [], decisiones_posibles: [{ id: 'seguir', texto: 'Seguir' }], incertidumbres: [], intereses_economicos: [], decisiones_historicas: [], conflictos_interes: [{ texto: 'Posible conflicto', fuentes: [], clase: 'posible' }] },
      { id: 'fondo', nombre: 'Fondo de Prueba', tipo: 'fondo_inversion', ficticio: false, objetivos_documentados: [], incentivos_hipoteticos: [{ texto: 'Rendimiento' }], recursos_conocidos: [], restricciones: [], decisiones_posibles: [{ id: 'vender', texto: 'Vender' }], incertidumbres: [], intereses_economicos: [], decisiones_historicas: [], conflictos_interes: [] }] };
  const H = (id, categoria, enunciado, a_favor, en_contra = [], x = {}) => ({ accion: 'agregar_hipotesis', fecha: T(5), datos: { hipotesis: { id, categoria, enunciado, a_favor, en_contra, condiciones_refutacion: ['Dato contrario documentado'], datos_faltantes: ['Actas'], ...x } } });
  const exp = { contrato: 'cauce.csi.expediente', version_contrato: '0.1',
    investigacion: { id: 'hist-prueba', titulo: '[PRUEBA] Subida de tasa (fixture)', pregunta: '¿Por qué subió la tasa?', acontecimiento: { descripcion: 'Sube la tasa', fecha: '2020-03-10' }, autor: A, fecha: T(0), actores: ['inst', 'banco', 'fondo'], naturaleza_estudio: 'historico' },
    alcance: { fecha: T(1), datos: { descripcion: 'Decisión de prueba', periodo: { desde: '2020-01-01', hasta: '2020-12-31' }, incluye: ['comunicados'], excluye: ['rumores'], criterios_fuentes: ['Primero documentos de la institución'] } },
    pasos: [...fuentes.map((f) => ({ accion: 'agregar_fuente', datos: { fuente: f }, fecha: T(2) })),
      { accion: 'agregar_enunciado', fecha: T(3), datos: { enunciado: { id: 'e1', tipo: 'hecho', texto: 'La institución subió la tasa.', fuentes: ['f1', 'f2'], sobre: 'conducta', actor_id: 'inst', cita: 'La junta decidió subir la tasa de referencia.' } } },
      { accion: 'agregar_enunciado', fecha: T(3), datos: { enunciado: { id: 'e2', tipo: 'declaracion', texto: 'La junta explicó después sus razones.', fuentes: ['f3'], sobre: 'intencion', actor_id: 'inst' } } },
      { accion: 'agregar_enunciado', fecha: T(3), datos: { enunciado: { id: 'e3', tipo: 'hecho', texto: 'El banco no cambió su tasa.', fuentes: ['f2'], sobre: 'conducta', actor_id: 'banco' } } },
      { accion: 'agregar_enunciado', fecha: T(3), datos: { enunciado: { id: 's1', tipo: 'simulacion', texto: 'Contrafactual: si no hubiera subido…', escenario_id: 'esc-1', contrafactual: true } } },
      ...['inst', 'banco', 'fondo'].map((a, i) => ({ accion: 'agregar_incentivo', fecha: T(4), datos: { incentivo: { id: `i${i}`, actor_id: a, texto: 'Incentivo inferido', basado_en: ['e1'] } } })),
      H('H-A', 'fundamentales', 'Subió por inflación.', ['e1', 'e2'], ['e3'], { sobre_actor: 'inst', momento_decision: '2020-03-10' }), H('H-B', 'otra', 'Subió por presión externa.', ['e1']), H('H-C', 'manipulacion', 'Alguien operó con información previa.', []),
      ...[['H-A', ['H-B', 'H-C']], ['H-B', ['H-A']], ['H-C', ['H-A']]].map(([h, de]) => ({ accion: 'agregar_observacion', fecha: T(6), datos: { hipotesis_id: h, observacion: { texto: `Dato que separa ${h}`, distingue_de: de } } })),
      { accion: 'agregar_escenario', fecha: T(6), datos: { escenario_id: 'esc-1' } }],
    abogado: { fecha: T(7) }, actores,
    escenarios: [{ contrato: 'cauce.csi.escenario', version_contrato: '0.2', id: 'esc-1', investigacion_id: 'hist-prueba', titulo: '[PRUEBA] Contrafactual', es_demo: false, naturaleza: 'simulacion', contrafactual: true, supuestos: ['No sube'], creado_en: T(6), creado_por: A, detonante: 'Inflación',
      explicaciones: [{ id: 'A', clave: 'A', categoria: 'fundamentales', descripcion: 'Inflación', senales_a_favor: [{ texto: 'Sube', enunciado_id: 'e1' }], senales_en_contra: [], datos_faltantes: [] }],
      arbol: { nodos: [{ id: 'n1', padre: null, actor_id: 'inst', decision_id: 'esperar', beneficios: [], costos: [], restricciones: [], consecuencias: [] }, { id: 'n2', padre: 'n1', actor_id: 'fondo', decision_id: 'vender', beneficios: [], costos: [], restricciones: [], consecuencias: [] }] } }] };
  const r = await construirDesdeExpediente(exp);
  if (!r.ok) throw new Error(r.errores.join(' | '));
  return r.docs;
}

(async () => {
  const hist = REAL ? null : await fixtureHistorico();
  const { crearAncla } = await mod('app/csi/ancla.js');
  const predDemo = JSON.parse(fs.readFileSync(path.join(RAIZ, 'datos/csi/demo/predicciones.json'), 'utf8'));
  const { ancla } = await crearAncla(predDemo, { creada_en: '2026-11-06T12:00:00-06:00', creada_por: { tipo: 'humano', identificador: 'diego' } });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'csi-ancla-'));
  const fAncla = path.join(tmp, 'ancla.json'); fs.writeFileSync(fAncla, JSON.stringify(ancla));
  const malo = JSON.parse(JSON.stringify(ancla)); malo.entradas[2].huella = '0'.repeat(64);
  const fMala = path.join(tmp, 'ancla-alterada.json'); fs.writeFileSync(fMala, JSON.stringify(malo));

  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const res = []; const errs = [];
  const ok = (n, c, x = '') => res.push(`${c ? 'OK ' : 'FALLA'} ${n}${x ? ' · ' + x : ''}`);
  const vigilar = (p) => { p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errs.push(m.text()); }); };
  const foto = async (p, n, completa = false) => { if (SAL) await p.screenshot({ path: `${SAL}/${n}.png`, fullPage: completa }); };
  const preparar = async (p) => {
    vigilar(p);
    await p.addInitScript(() => { try { localStorage.clear(); } catch {} });
    await p.route('**/datos/proyectos.local.json*', (r) => r.fulfill({ status: 404, body: '' }));
    await p.route('**/datos/reales/*.json*', (r) => r.fulfill({ status: 404, body: '' }));
    await p.route('**/datos/csi/registro/*.json*', (r) => r.fulfill({ status: 404, body: '' }));
    if (hist) await p.route('**/datos/csi/historico/*.json*', (r) => {
      const n = new URL(r.request().url()).pathname.split('/').pop().replace('.json', '');
      return hist[n] ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(hist[n]) }) : r.fulfill({ status: 404, body: '' });
    });
  };

  const p = await b.newPage({ viewport: { width: 1366, height: 900 } });
  await preparar(p);
  await p.goto(BASE + '?csi=historico'); await p.waitForTimeout(4000);
  const csi = p.locator('#csi');
  const pestana = async (k) => { await p.locator(`[data-pestana="${k}"]`).click(); await p.waitForTimeout(250); return csi.innerText(); };
  let t = await csi.innerText();
  ok('?csi=historico abre el HISTÓRICO, marcado como retrospectivo y no predicción', (await csi.locator('[data-fuente="historico"]').count()) === 1 && /HISTÓRICO · REAL RETROSPECTIVO/.test(t) && /No es una predicción/.test(t));
  ok('sin texto «null» ni «undefined»', !/\bnull\b|\bundefined\b/.test(t));
  ok('selector de conjuntos: REAL (vacío, deshabilitado), HISTÓRICO activo, DEMO disponible',
    await p.locator('[data-conjunto="registro"]').isDisabled() && (await p.locator('[data-conjunto="historico"]').getAttribute('aria-pressed')) === 'true' && await p.locator('[data-conjunto="demo"]').isEnabled());
  ok('resumen: niveles HECHO / DECLARACIÓN / INFERENCIA / HIPÓTESIS / ESCENARIO y flujo con el Abogado antes de Nexus', (await csi.locator('[data-niveles]').count()) === 1 && /Abogado del Diablo objeta\s+→\s+Revisión escéptica \(Nexus\)\s+→\s+Decisión humana/.test(t));
  await foto(p, 'f2-historico-resumen', true);

  t = await pestana('fuentes');
  const nf = await csi.locator('[data-fuente-id]').count();
  ok('fuentes: tarjetas con clase, estado y fechas separadas', nf >= 4 && /Publicada: .* · Disponible: .* · Consultada:/.test(t), `${nf} fuentes`);
  ok('fuentes: la pendiente se ve como PENDIENTE con su motivo', (await csi.locator('[data-estado-fuente="pendiente"]').count()) >= 1 && /Pendiente: /.test(t));
  const enl = csi.locator('a[data-original]');
  ok('fuentes: «Abrir el original» abre en pestaña nueva sin opener', (await enl.count()) >= 3 && (await enl.first().getAttribute('target')) === '_blank' && /noopener/.test(await enl.first().getAttribute('rel')));
  ok('fuentes: alcance y criterios registrados antes de la primera fuente', (await csi.locator('[data-alcance]').count()) === 1 && /antes de la primera fuente/.test(t));
  ok('fuentes: tabla «¿Qué se podía conocer en cada momento?»', (await csi.locator('[data-linea] tbody tr').count()) === 3);
  await foto(p, 'f2-fuentes', true);

  t = await pestana('actores');
  ok('actores 0.2: intereses económicos, decisiones históricas y conflictos de interés', /Intereses económicos documentados/.test(t) && /Decisiones históricas verificables/.test(t) && /Posibles conflictos de interés/.test(t));
  await pestana('relaciones');
  const nAct = REAL ? 5 : 3;
  ok('mapa de actores: un nodo por actor; la relación sin fuente va punteada', (await csi.locator('[data-nodo-actor]').count()) === nAct && (REAL || (await csi.locator('[data-relacion][data-verificable="no"]').count()) === 1), `${await csi.locator('[data-nodo-actor]').count()} nodos`);
  await foto(p, 'f2-mapa-actores', true);

  t = await pestana('flujo');
  ok('flujo: diez pasos con estado; lo incompleto dice qué falta', (await csi.locator('[data-paso]').count()) === 10 && /\d+ de 10 pasos/.test(t) && (await csi.locator('[data-paso][data-estado="incompleto"]').count()) >= 1 && /Falta:/.test(t));
  await foto(p, 'f2-flujo', true);

  t = await pestana('abogado');
  ok('Abogado: 8 preguntas × hipótesis, firmado por código, sin sustituir la revisión humana', (await csi.locator('[data-pregunta]').count()) === 8 && /abogado-csi \(codigo\)/.test(t) && /No es una revisión humana/.test(t));
  ok('Abogado: hay alertas (información posterior, retrospectivo vs referencia simple)', (await csi.locator('td[data-resultado="alerta"]').count()) >= 3 && /retrospectivo/.test(t));
  await foto(p, 'f2-abogado', true);

  await pestana('arbol');
  ok('árbol: el escenario histórico se muestra como CONTRAFACTUAL', (await csi.locator('[data-contrafactual="si"]').count()) >= 1 && /CONTRAFACTUAL/.test(await csi.innerText()));
  await pestana('evidencias');
  ok('evidencias: observaciones distintivas y datos que faltan por hipótesis', /Observaciones que la distinguen/.test(await csi.innerText()));
  await pestana('predicciones');
  ok('HISTÓRICO sin predicciones: se explica que es retrospectivo', (await csi.locator('[data-sin-predicciones]').count()) === 1);

  await pestana('nexus');
  await p.locator('[data-preparar="H-A"]').click(); await p.waitForTimeout(400);
  t = await csi.locator('[data-propuesta]').innerText();
  ok('Nexus 0.2: fuentes con procedencia, objeciones, refutación, limitaciones y decisión pendiente', /Fuentes con procedencia/.test(t) && /Objeciones \(\d+\)/.test(t) && /Condiciones de refutación/.test(t) && /Limitaciones/.test(t) && /decisión: pendiente/.test(t));
  ok('Nexus 0.2: el Abogado objeta antes que Nexus (objeciones firmadas abogado-csi)', /abogado-csi/.test(t));
  ok('ningún botón aprueba, ejecuta, publica ni envía', (await csi.locator('button').allTextContents()).every((x) => !/aprob|ejecut|enviar|publicar|operar/i.test(x)));
  await foto(p, 'f2-nexus', true);

  // DEMO: predicciones con verificación temporal y anclas.
  await p.locator('[data-conjunto="demo"]').click(); await p.waitForTimeout(1500);
  t = await csi.innerText();
  ok('cambiar a DEMO: banda DEMO y nada del HISTÓRICO', (await csi.locator('[data-fuente="demo"]').count()) === 1 && !/HISTÓRICO · REAL/.test(t));
  t = await pestana('predicciones');
  ok('PREDICCIÓN: banda propia y verificación temporal visible (todas «declaradas» sin ancla)', (await csi.locator('[data-fuente="prediccion"]').count()) === 1 && (await csi.locator('tr[data-temporal="declarada"]').count()) === 5);
  await p.locator('[data-generar-ancla]').click(); await p.waitForTimeout(500);
  const huella = await csi.locator('[data-ancla]').getAttribute('data-ancla');
  ok('generar ancla: texto publicable con huella SHA-256 y aviso de que no se publica nada', /^[0-9a-f]{64}$/.test(huella || '') && /no publica nada/.test(await csi.innerText()) && (await csi.locator('a[download^="ancla-"]').count()) === 1);
  ok('el ancla generada en el navegador coincide con la de Node (misma huella)', huella === ancla.huella_ancla, `${huella?.slice(0, 12)} vs ${ancla.huella_ancla.slice(0, 12)}`);
  await p.locator('[data-cargar-ancla]').setInputFiles(fAncla); await p.waitForTimeout(600);
  t = await csi.innerText();
  ok('verificar con ancla: registro coherente y predicciones «ancladas sin acreditar»', /Registro coherente con el ancla: 9 entradas ancladas/.test(t) && (await csi.locator('tr[data-temporal="anclada_sin_acreditar"]').count()) === 5);
  await foto(p, 'f2-predicciones-ancla', true);
  await p.locator('[data-cargar-ancla]').setInputFiles(fMala); await p.waitForTimeout(600);
  ok('ancla alterada: se detecta y vuelve a «declarada»', /NO coincide/.test(await csi.innerText()) && (await csi.locator('tr[data-temporal="declarada"]').count()) === 5);

  // Laboratorio 0.2: investigación REAL histórica (alcance antes de fuentes, cita con procedencia, Abogado).
  await pestana('laboratorio');
  const llenar = async (pares) => { for (const [id, v] of pares) { const loc = p.locator(`#csi-lab-${id}`); if ((await loc.evaluate((n) => n.tagName)) === 'SELECT') await loc.selectOption(v); else await loc.fill(v); } };
  const abrir = (k) => p.locator(`[data-form="${k}"]`).evaluate((d) => { d.open = true; });
  const aplicar = async (k) => { await p.locator(`[data-enviar="${k}"]`).click(); await p.waitForTimeout(400); return (await csi.locator('.csi-mensajes').innerText()).split('\n')[0]; };
  await p.locator('#csi-practica').uncheck();
  await llenar([['naturaleza', 'historico'], ['id', 'mi-hist'], ['titulo', 'Prueba histórica'], ['pregunta', '¿Por qué?'], ['acont', 'Decisión de prueba'], ['fecha', '2020-03-10']]);
  let msg = await aplicar('crear');
  ok('laboratorio: crear investigación REAL histórica (0.2)', /creada \(REAL · historico\)/.test(msg), msg);
  await abrir('fuente');
  await llenar([['f-id', 'f1'], ['f-titulo', 'Comunicado de prueba'], ['f-editor', 'Instituto de Prueba'], ['f-tipo', 'documento_oficial'], ['f-fecha', '2020-03-10'], ['f-enlace', 'https://example.org/comunicado'], ['f-extracto', '"La junta decidió subir la tasa."'], ['f-ext-tipo', 'cita_textual'], ['f-limit', 'Prueba']]);
  msg = await aplicar('fuente');
  ok('laboratorio: sin alcance registrado la fuente se rechaza', /alcance/.test(msg), msg);
  await abrir('alcance');
  await llenar([['a-desc', 'Decisión de prueba'], ['a-desde', '2020-01-01'], ['a-hasta', '2020-12-31'], ['a-criterios', 'Primero documentos oficiales; luego prensa identificable']]);
  msg = await aplicar('alcance');
  ok('laboratorio: alcance y criterios registrados', /definir_alcance: listo/.test(msg), msg);
  msg = await aplicar('fuente');
  ok('laboratorio: fuente REAL con procedencia aceptada', /agregar_fuente: listo/.test(msg), msg);
  await abrir('enunciado');
  await llenar([['e-id', 'e1'], ['e-tipo', 'hecho'], ['e-texto', 'Subió la tasa'], ['e-fuentes', 'f1'], ['e-sobre', 'conducta'], ['e-cita', 'La junta decidió bajar la tasa']]);
  msg = await aplicar('enunciado');
  ok('laboratorio: una cita que no está en el extracto se rechaza (sin procedencia)', /cita sin procedencia/.test(msg), msg);
  await llenar([['e-cita', 'La junta decidió subir la tasa']]);
  msg = await aplicar('enunciado');
  ok('laboratorio: la cita con procedencia se acepta', /agregar_enunciado: listo/.test(msg), msg);
  await abrir('hipotesis');
  await llenar([['h-id', 'H1'], ['h-cat', 'fundamentales'], ['h-texto', 'Por inflación'], ['h-favor', 'e1'], ['h-refuta', 'Inflación a la baja']]);
  msg = await aplicar('hipotesis');
  await p.locator('[data-lab-abogado]').click(); await p.waitForTimeout(400);
  msg = (await csi.locator('.csi-mensajes').innerText()).split('\n')[0];
  ok('laboratorio: el Abogado del Diablo (código) registra objeciones abiertas', /Abogado del Diablo \(código\): \d+ alerta/.test(msg), msg);
  await foto(p, 'f2-laboratorio', true);

  // Regresión: cerrar CSI, plano 2D del piso CSI y 3D.
  await p.keyboard.press('Escape'); await p.waitForTimeout(800);
  ok('Esc cierra CSI', await csi.isHidden());
  await p.locator('#pisos .piso', { hasText: 'Inteligencia' }).first().click(); await p.waitForTimeout(3000);
  await p.locator('[data-vista="2d"]').click(); await p.waitForTimeout(1500);
  ok('regresión 2D: el piso CSI conserva sus 5 cuartos', (await p.locator('#oficina .cuarto').count()) === 5);
  ok('regresión: nadie aparece «trabajando» en el piso CSI', !/\d+ trabajando/.test(await p.locator('body').innerText()));
  await p.locator('[data-vista="3d"]').click(); await p.waitForTimeout(3000);
  ok('regresión 3D: la vista 3D vuelve a dibujar', await p.locator('.vista3d').isVisible());
  await p.close();

  // Celular.
  const c = await b.newContext({ ...devices['iPhone 13'] });
  const pm = await c.newPage(); await preparar(pm);
  await pm.goto(BASE + '?csi=historico'); await pm.waitForTimeout(4000);
  const W = devices['iPhone 13'].viewport.width;
  const ancho = async () => pm.evaluate(() => document.documentElement.scrollWidth);
  for (const k of ['fuentes', 'relaciones', 'flujo', 'abogado', 'nexus']) {
    await pm.locator(`[data-pestana="${k}"]`).click(); await pm.waitForTimeout(300);
    const a = await ancho();
    ok(`celular: pestaña ${k} sin desplazamiento horizontal de la página`, a <= W + 1, `${a} vs ${W}`);
  }
  await pm.locator('[data-pestana="fuentes"]').click(); await pm.waitForTimeout(300);
  await foto(pm, 'f2-celular-fuentes', true);
  await pm.locator('[data-pestana="abogado"]').click(); await pm.waitForTimeout(300);
  await foto(pm, 'f2-celular-abogado', true);
  await c.close();
  await b.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  for (const l of res) console.log(l);
  console.log(`errores: ${errs.length ? JSON.stringify(errs) : 'ninguno'}`);
  process.exit(res.some((l) => l.startsWith('FALLA')) || errs.length ? 1 : 0);
})();
