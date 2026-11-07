// CSI · herramienta local (sin red, sin IA, sin dependencias). Uso:
//   node herramientas/csi.mjs demo [--comprobar]   genera (o compara) datos/csi/demo/*.json y datos/demo/csi.json
//   node herramientas/csi.mjs resumen [--demo]     resumen del almacén REAL (datos/csi/registro/) o del DEMO
//   node herramientas/csi.mjs validar <archivo>    valida una investigación, actores, escenario o registro de predicciones
//   node herramientas/csi.mjs predecir <archivo.json> --por <id> [--en <instante>]
//        anexa una predicción (o corrección/evaluación: {"tipo": …, "contenido": …}) al registro REAL con copia previa
//   node herramientas/csi.mjs piso                 escribe datos/reales/csi.json (contrato v1) desde el almacén REAL
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
import { agregarEntrada, registroVacioPredicciones, verificarPredicciones, validarRegistroPredicciones } from "../app/csi/predicciones.js";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const [orden, ...args] = process.argv.slice(2);
const opcion = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const leer = async (r) => JSON.parse(await readFile(join(raiz, r), "utf8"));
const leerSi = (r) => leer(r).catch(() => null);
const escribir = async (r, doc) => { const tmp = join(raiz, `${r}.tmp`); await mkdir(dirname(join(raiz, r)), { recursive: true }); await writeFile(tmp, `${JSON.stringify(doc, null, 2)}\n`, "utf8"); await rename(tmp, join(raiz, r)); };
const REAL = "datos/csi/registro";

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
} else {
  console.log("Órdenes: demo [--comprobar] | resumen [--demo] | validar <archivo> | predecir <archivo> --por <id> [--en <instante>] | piso");
  process.exit(orden ? 1 : 0);
}
