// CSI · herramienta local (sin red, sin IA, sin dependencias). Uso:
//   node herramientas/csi.mjs demo [--comprobar]   genera (o compara) datos/csi/demo/*.json y datos/demo/csi.json
//   node herramientas/csi.mjs resumen [--demo]     resumen del almacén REAL (datos/csi/registro/) o del DEMO
//   node herramientas/csi.mjs validar <archivo>    valida una investigación, actores, escenario o registro de predicciones
//   node herramientas/csi.mjs predecir <archivo.json> --por <id> [--en <instante>]
//        anexa una predicción (o corrección/evaluación: {"tipo": …, "contenido": …}) al registro REAL con copia previa
//   node herramientas/csi.mjs piso                 escribe datos/reales/csi.json (contrato v1) desde el almacén REAL
// Fase 2:
//   node herramientas/csi.mjs expediente <expediente.json> [--salida datos/csi/historico]
//        construye una investigación (con historial real) desde un expediente y escribe actores/investigaciones/escenarios
//   node herramientas/csi.mjs revisar [--base <carpeta>]  flujo de 10 pasos, Abogado del Diablo y fuentes pendientes
//   node herramientas/csi.mjs ancla --por <id> [--con-ids]     ancla del registro REAL en datos/csi/registro/anclas.json (no publica nada)
//   node herramientas/csi.mjs verificar-ancla [<ancla.json>]    compara el registro REAL con un ancla (por defecto, la última)
//   node herramientas/csi.mjs acreditar --n <k> --tipo <t> --en <instante> --prueba <ref> --texto <archivo-publicado> --autorizada-por diego
//        anota (local) la hora que acreditó un tercero; no publica nada
// El almacén real (datos/csi/registro/) es local y no va a git. Las identidades son DECLARADAS, sin autenticar.
import { readFile, writeFile, rename, mkdir, copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { construirDemoCSI, AHORA_DEMO } from "../app/csi/demo.js";
import { estadoPisoCSI } from "../app/csi/piso.js";
import { leerCSI } from "../app/csi/registro.js";
import { validarInvestigacion, verificarHistorial } from "../app/csi/investigacion.js";
import { validarActores } from "../app/csi/actores.js";
import { validarEscenario } from "../app/csi/simulador.js";
import { agregarEntrada, registroVacioPredicciones, verificarPredicciones, validarRegistroPredicciones, resumirPredicciones } from "../app/csi/predicciones.js";
import { construirDesdeExpediente } from "../app/csi/expediente.js";
import { crearAncla, instruccionesPublicacion, verificarContraAncla, registrarAcreditacion, validarAncla, TEMPORAL_TXT } from "../app/csi/ancla.js";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const [orden, ...args] = process.argv.slice(2);
const opcion = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const leer = async (r) => JSON.parse(await readFile(join(raiz, r), "utf8"));
const leerSi = (r) => leer(r).catch(() => null);
const escribir = async (r, doc) => { const tmp = join(raiz, `${r}.tmp`); await mkdir(dirname(join(raiz, r)), { recursive: true }); await writeFile(tmp, `${JSON.stringify(doc, null, 2)}\n`, "utf8"); await rename(tmp, join(raiz, r)); };
const REAL = "datos/csi/registro";
const ANCLAS = `${REAL}/anclas.json`;

async function salidasDemo() {
  const d = await construirDemoCSI();
  const csi = await leerCSI(d);
  const piso = estadoPisoCSI({ investigaciones: csi.investigaciones.map((x) => x.inv), actores: d.actores, escenarios: csi.escenarios.map((x) => x.esc), predicciones: csi.predicciones.resumen, es_demo: true, ahoraMs: Date.parse(AHORA_DEMO) });
  return [["datos/csi/demo/actores.json", d.actores], ["datos/csi/demo/investigaciones.json", d.investigaciones], ["datos/csi/demo/escenarios.json", d.escenarios], ["datos/csi/demo/predicciones.json", d.predicciones], ["datos/demo/csi.json", piso]];
}

if (orden === "demo") {
  const salidas = await salidasDemo();
  if (args.includes("--comprobar")) {
    let bien = true;
    for (const [r, doc] of salidas) { const g = await readFile(join(raiz, r), "utf8").catch(() => ""); const ok = g === `${JSON.stringify(doc, null, 2)}\n`; console.log(`${ok ? "OK   " : "FALLA"} ${r}`); bien &&= ok; }
    process.exit(bien ? 0 : 1);
  }
  for (const [r, doc] of salidas) { await escribir(r, doc); console.log(`escrito ${r}`); }
} else if (orden === "resumen") {
  const base = args.includes("--demo") ? "datos/csi/demo" : REAL;
  const docs = { actores: await leerSi(`${base}/actores.json`), investigaciones: await leerSi(`${base}/investigaciones.json`), escenarios: await leerSi(`${base}/escenarios.json`), predicciones: await leerSi(`${base}/predicciones.json`) };
  if (!Object.values(docs).some(Boolean)) { console.log(`Sin datos en ${base}/ (el almacén real empieza vacío).`); process.exit(0); }
  const c = await leerCSI(docs);
  console.log(`${c.es_demo ? "DEMO" : "REAL"} · ${c.investigaciones.length} investigación(es) · ${c.escenarios.length} escenario(s)`);
  for (const x of c.investigaciones) { console.log(`- ${x.inv.id}: historial ${x.integridad.ok ? "íntegro" : "ALTERADO"} · revisión ${x.analisis.revision}`); for (const h of x.analisis.hipotesis) console.log(`    ${h.id} (${h.categoria}): ${h.estado}${h.motivos.length ? ` — ${h.motivos.join("; ")}` : ""}`); }
  if (c.predicciones) { const r = c.predicciones.resumen; console.log(`Predicciones: ${r.total} · acertadas ${r.acertadas} · fallidas ${r.fallidas} · indeterminadas ${r.indeterminadas} · sin evaluar ${r.sin_evaluar} · pendientes ${r.pendientes + r.en_curso} · cadena ${c.predicciones.integridad.ok ? "íntegra" : "ALTERADA"}`); console.log(`  ${r.comparacion.lectura}`); }
  for (const t of c.errores) console.log(`ERROR ${t}`);
} else if (orden === "validar") {
  const doc = await leer(args[0]);
  const v = doc.contrato === "cauce.csi.investigacion" ? validarInvestigacion(doc) : doc.contrato === "cauce.csi.actores" ? validarActores(doc) : doc.contrato === "cauce.csi.escenario" ? validarEscenario(doc) : doc.contrato === "cauce.csi.predicciones" ? validarRegistroPredicciones(doc) : { errores: [`contrato desconocido: ${doc.contrato}`] };
  for (const t of v.errores) console.log(`ERROR ${t}`);
  for (const t of v.avisos ?? []) console.log(`aviso ${t}`);
  if (doc.contrato === "cauce.csi.investigacion" && !v.errores.length) { const h = await verificarHistorial(doc); console.log(h.ok ? "Historial íntegro." : `Historial: ${h.problemas.join(" ")}`); }
  if (doc.contrato === "cauce.csi.predicciones" && !v.errores.length) { const h = await verificarPredicciones(doc); console.log(h.ok ? "Cadena íntegra." : `Cadena: ${h.problemas.join(" ")}`); }
  process.exit(v.errores.length ? 1 : 0);
} else if (orden === "predecir") {
  const por = opcion("--por");
  if (!por) { console.log("Falta --por <identificador> (identidad declarada)."); process.exit(1); }
  const entrada = await leer(args[0]);
  const tipo = entrada.tipo && entrada.contenido ? entrada.tipo : "registro";
  const contenido = entrada.tipo && entrada.contenido ? entrada.contenido : entrada;
  const ruta = `${REAL}/predicciones.json`;
  const doc = (await leerSi(ruta)) ?? registroVacioPredicciones(false);
  if (doc.es_demo) { console.log("El almacén real no puede ser DEMO."); process.exit(1); }
  const h = await verificarPredicciones(doc);
  if (!h.ok) { console.log(`El registro está alterado; no se anexa: ${h.problemas.join(" ")}`); process.exit(1); }
  const r = await agregarEntrada(doc, { tipo, contenido, registrado_en: opcion("--en") ?? new Date().toISOString(), registrado_por: { tipo: "humano", identificador: por } });
  if (!r.ok) { for (const t of r.errores) console.log(`ERROR ${t}`); process.exit(1); }
  await mkdir(join(raiz, REAL, "respaldos"), { recursive: true });
  await copyFile(join(raiz, ruta), join(raiz, REAL, "respaldos", `predicciones-${Date.now()}.json`)).catch(() => {});
  await escribir(ruta, r.doc);
  console.log(`Anexada la entrada ${r.doc.entradas.length} (${tipo}). Huella ${r.doc.entradas.at(-1).huella.slice(0, 16)}… — para fijar la hora, publícala fuera (p. ej. en un commit).`);
} else if (orden === "piso") {
  const docs = { actores: await leerSi(`${REAL}/actores.json`), investigaciones: await leerSi(`${REAL}/investigaciones.json`), escenarios: await leerSi(`${REAL}/escenarios.json`), predicciones: await leerSi(`${REAL}/predicciones.json`) };
  if (!Object.values(docs).some(Boolean)) { console.log("El almacén real está vacío: no se escribe datos/reales/csi.json (el edificio muestra el DEMO)."); process.exit(0); }
  const c = await leerCSI(docs, { ahoraMs: Date.now() });
  if (c.es_demo) { console.log("El almacén real contiene datos DEMO: no se escribe."); process.exit(1); }
  await escribir("datos/reales/csi.json", estadoPisoCSI({ investigaciones: c.investigaciones.map((x) => x.inv), actores: c.actores?.doc ?? null, escenarios: c.escenarios.map((x) => x.esc), predicciones: c.predicciones?.resumen ?? null, es_demo: false, ahoraMs: Date.now() }));
  console.log("escrito datos/reales/csi.json");
} else if (orden === "expediente") {
  const r = await construirDesdeExpediente(await leer(args[0]));
  for (const t of r.errores) console.log(`ERROR ${t}`);
  if (!r.ok) process.exit(1);
  const sal = opcion("--salida") ?? "datos/csi/historico";
  for (const [n, doc] of Object.entries(r.docs)) if (doc) { await escribir(`${sal}/${n}.json`, doc); console.log(`escrito ${sal}/${n}.json`); }
  const inv = r.docs.investigaciones.investigaciones[0];
  console.log(`${inv.id}: ${inv.fuentes.length} fuentes (${inv.fuentes.filter((f) => f.estado === "pendiente").length} pendientes) · ${inv.enunciados.length} enunciados · ${inv.hipotesis.length} hipótesis · historial ${inv.historial.length} · última huella ${inv.historial.at(-1).huella.slice(0, 16)}…`);
} else if (orden === "revisar") {
  const base = opcion("--base") ?? REAL;
  const docs = { actores: await leerSi(`${base}/actores.json`), investigaciones: await leerSi(`${base}/investigaciones.json`), escenarios: await leerSi(`${base}/escenarios.json`), predicciones: await leerSi(`${base}/predicciones.json`) };
  const c = await leerCSI(docs);
  for (const t of c.errores) console.log(`ERROR ${t}`);
  for (const x of c.investigaciones) {
    console.log(`\n${x.inv.id} (${x.inv.naturaleza_estudio ?? (x.inv.es_demo ? "demo" : "0.1")}) · flujo ${x.flujo.completos}/${x.flujo.total}`);
    for (const p of x.flujo.pasos) console.log(`  ${p.estado === "completo" ? "✓" : "○"} ${p.n}. ${p.titulo}${p.faltan.length ? ` — falta: ${p.faltan.join("; ")}` : ""}`);
    console.log(`  Abogado del Diablo (${x.abogado.version}, código): ${x.abogado.alertas_total} alerta(s)`);
    for (const h of x.abogado.hipotesis) for (const k of h.comprobaciones.filter((k) => k.resultado !== "ok")) console.log(`    ${h.id} · ${k.pregunta} [${k.resultado}] ${k.detalle}`);
    console.log(`  Fuentes: ${x.expediente.consultadas.length} consultadas · ${x.expediente.pendientes.length} pendientes · ${x.expediente.sin_huella.length} sin huella de contenido`);
  }
} else if (orden === "ancla") {
  const por = opcion("--por");
  if (!por) { console.log("Falta --por <identificador> (identidad declarada)."); process.exit(1); }
  const doc = await leerSi(`${REAL}/predicciones.json`);
  if (!doc) { console.log("No hay registro REAL de predicciones."); process.exit(1); }
  const r = await crearAncla(doc, { creada_en: new Date().toISOString(), creada_por: { tipo: "humano", identificador: por }, incluir_ids: args.includes("--con-ids") });
  if (!r.ok) { for (const t of r.errores) console.log(`ERROR ${t}`); process.exit(1); }
  const col = (await leerSi(ANCLAS)) ?? { contrato: "cauce.csi.anclas", version_contrato: "0.1", es_demo: false, anclas: [] };
  col.anclas.push(r.ancla);
  await escribir(ANCLAS, col);
  await escribir(`${REAL}/anclas/ancla-${col.anclas.length}.json`, r.ancla);
  const prox = resumirPredicciones(doc).filas.filter((f) => f.estado === "pendiente").map((f) => f.horizonte.desde).sort()[0] ?? null;
  console.log(`Ancla ${col.anclas.length} guardada en ${ANCLAS} (copia: ${REAL}/anclas/ancla-${col.anclas.length}.json). NO se publicó nada.`);
  for (const t of instruccionesPublicacion(r.ancla, prox)) console.log(t);
} else if (orden === "verificar-ancla") {
  const doc = await leerSi(`${REAL}/predicciones.json`);
  const col = await leerSi(ANCLAS);
  const ancla = args[0] && !args[0].startsWith("--") ? await leer(args[0]) : col?.anclas?.at(-1);
  if (!ancla) { console.log("No hay anclas."); process.exit(1); }
  const v = await verificarContraAncla(doc, ancla, doc ? resumirPredicciones(doc) : null);
  console.log(v.ok ? `Registro coherente con el ancla (${v.entradas_ancladas} entradas ancladas, ${v.entradas_posteriores} posteriores).` : "NO coincide:");
  for (const t of v.problemas) console.log(`  ${t}`);
  for (const f of v.filas) console.log(`  ${f.id}: ${TEMPORAL_TXT[f.temporal]}`);
  process.exit(v.ok ? 0 : 1);
} else if (orden === "acreditar") {
  const autorizada = opcion("--autorizada-por");
  if (!autorizada) { console.log("Falta --autorizada-por <id>: la publicación externa la autoriza Diego."); process.exit(1); }
  const col = await leerSi(ANCLAS);
  const n = Number(opcion("--n") ?? col?.anclas?.length);
  const ancla = col?.anclas?.[n - 1];
  if (!ancla) { console.log(`No existe el ancla ${n}.`); process.exit(1); }
  const texto_publicado = await readFile(join(raiz, opcion("--texto") ?? "-"), "utf8").catch(() => "");
  const r = await registrarAcreditacion(ancla, { tipo: opcion("--tipo"), acreditado_en: opcion("--en"), prueba: opcion("--prueba"), autorizada_por: autorizada, texto_publicado });
  if (!r.ok) { for (const t of r.errores) console.log(`ERROR ${t}`); process.exit(1); }
  col.anclas[n - 1] = r.ancla; await escribir(ANCLAS, col);
  console.log(`Acreditación anotada en el ancla ${n}. Verifica la prueba con la herramienta del tercero (openssl ts -verify, ots verify…).`);
} else {
  console.log("Órdenes: demo [--comprobar] | resumen [--demo] | validar <archivo> | predecir <archivo> --por <id> [--en <instante>] | piso | expediente <archivo> | revisar [--base] | ancla --por <id> | verificar-ancla [ancla] | acreditar --n <k> …");
  process.exit(orden ? 1 : 0);
}
