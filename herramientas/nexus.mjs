// Nexus fase 1 · línea de comandos (Node 18+). Solo lee y escribe el almacén de Nexus (por omisión datos/nexus/registro/,
// fuera de git; los datos de prueba están en datos/nexus/demo/). No se conecta a nada, no usa IA, no toca proyectos.
//
//   node herramientas/nexus.mjs validar                          revisa ambos registros, la cadena de huellas y las reglas
//   node herramientas/nexus.mjs lecciones [--proyecto=id]        lecciones vigentes con su dictamen
//   node herramientas/nexus.mjs revisar <id>                     las 10 reglas nexus-R 0.2 de una lección
//   node herramientas/nexus.mjs historial <id>                   versiones registradas de una lección
//   node herramientas/nexus.mjs agregar-leccion <archivo> --por=alias            agrega una versión (anexa revisiones)
//   node herramientas/nexus.mjs agregar-recomendacion <archivo> --por=alias      agrega una versión de recomendación
//   node herramientas/nexus.mjs revision-esceptica <archivo>     imprime la revision_esceptica calculada para pegarla
//   Opciones: --registro=carpeta  --ahora=2026-11-06T12:00:00-06:00  --por-tipo=humano|codigo|ia (por omisión humano)
import { readFile, writeFile, rename } from "node:fs/promises";
import { join, resolve } from "node:path";
import { leerNexus, agregarLeccion, agregarRecomendacion, resumirNexus, registroVacio } from "../app/nexus/registro.js";
import { evaluarLeccion } from "../app/nexus/gerente.js";
import { revisionEsceptica } from "../app/nexus/recomendacion.js";
import { esFechaConZona } from "../app/nexus/comun.js";

const args = process.argv.slice(2);
const opcion = (n) => args.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? null;
const [orden, objetivo] = args.filter((a) => !a.startsWith("--"));
const dir = resolve(opcion("registro") ?? "datos/nexus/registro");
const ahoraTxt = opcion("ahora");
function salir(t, codigo = 1) { console.error(t); process.exit(codigo); }
if (ahoraTxt && !esFechaConZona(ahoraTxt)) salir(`--ahora necesita fecha con zona horaria, no «${ahoraTxt}».`);
const ahora = ahoraTxt ? Date.parse(ahoraTxt) : Date.now();
const rutas = { lecciones: join(dir, "lecciones.json"), recomendaciones: join(dir, "recomendaciones.json") };
async function leerDoc(ruta, tipo) {
  try { return JSON.parse(await readFile(ruta, "utf8")); } catch (e) { if (e.code === "ENOENT") return registroVacio(tipo, { es_demo: dir.endsWith("demo") }); salir(`${ruta}: ${e.message}`); }
}
/** Reemplazo atómico: nunca queda un archivo a medias. */
async function guardar(ruta, doc) { await writeFile(`${ruta}.tmp`, `${JSON.stringify(doc, null, 2)}\n`, "utf8"); await rename(`${ruta}.tmp`, ruta); }
const icono = { cumple: "✓", no_cumple: "✗", no_evaluado: "?" };
const docs = { lecciones: await leerDoc(rutas.lecciones, "lecciones"), recomendaciones: await leerDoc(rutas.recomendaciones, "recomendaciones") };
const nx = await leerNexus(docs);
const sobre = (registro) => {
  const por = opcion("por");
  if (!por) salir("Falta --por=alias (quién registra; no un correo).");
  return { registro, registrado_en: new Date(ahora).toISOString(), registrado_por: { tipo: opcion("por-tipo") ?? "humano", identificador: por } };
};

switch (orden) {
  case "validar": {
    const r = resumirNexus(nx, { ahora });
    for (const e of nx.errores) console.log(`ERROR ${e}`);
    console.log(`${r.cifras.lecciones} lecciones: ${r.cifras.sin_objeciones} sin objeciones, ${r.cifras.incompletas} incompletas, ${r.cifras.con_objeciones} con objeciones.`);
    console.log(`${r.recomendaciones.length} recomendaciones: ${r.cifras.pendientes} esperan decisión humana, ${r.cifras.aprobadas_sin_ejecutar} aprobadas sin ejecutar, ${r.cifras.adoptadas} adoptadas.`);
    if (r.es_demo) console.log("Registro de PRUEBA.");
    process.exit(nx.errores.length ? 1 : 0);
  }
  case "lecciones": {
    const p = opcion("proyecto");
    for (const x of resumirNexus(nx, { ahora }).lecciones.filter((x) => !p || x.leccion.origen.proyecto === p))
      console.log(`${x.evaluacion.dictamen.estado.padEnd(15)} ${x.leccion.id} (${x.leccion.validacion.estado}, revisión ${x.evaluacion.version}) · ${x.leccion.hallazgo}`);
    break;
  }
  case "revisar": {
    const l = nx.ultimas.get(objetivo);
    if (!l) salir(`No existe la lección ${objetivo}.`);
    const ev = evaluarLeccion(l, { ahora, lecciones: nx.ultimas });
    console.log(`${l.id} · ${ev.version_reglas} · dictamen: ${ev.dictamen.estado} (el gerente no aprueba; decide una persona)`);
    for (const r of ev.reglas) console.log(`  ${icono[r.estado]} ${r.id} ${r.nombre}: ${r.estado}${r.aplica ? "" : " (no aplica)"} · ${r.motivo}`);
    break;
  }
  case "historial": {
    const h = nx.historial.get(objetivo);
    if (!h) salir(`No existe la lección ${objetivo}.`);
    h.forEach((e, i) => console.log(`versión ${i + 1} · registrada ${e.registrado_en} por ${e.registrado_por.tipo}:${e.registrado_por.identificador} · revisiones: ${e.registro.revisiones.map((r) => r.version).join(", ")}`));
    break;
  }
  case "agregar-leccion":
  case "agregar-recomendacion": {
    if (!objetivo) salir("Falta el archivo JSON.");
    if (nx.errores.length) salir(`El registro tiene errores; corrígelos antes de agregar:\n${nx.errores.join("\n")}`);
    const nuevo = JSON.parse(await readFile(objetivo, "utf8"));
    const r = orden === "agregar-leccion" ? await agregarLeccion(docs.lecciones, sobre(nuevo)) : await agregarRecomendacion(docs.recomendaciones, sobre(nuevo), docs.lecciones);
    if (!r.ok) salir(`No se agregó:\n- ${r.errores.join("\n- ")}`);
    await guardar(orden === "agregar-leccion" ? rutas.lecciones : rutas.recomendaciones, r.doc);
    console.log(`Agregado ${nuevo.id}. El historial anterior no cambió.`);
    break;
  }
  case "revision-esceptica": {
    if (!objetivo) salir("Falta el archivo JSON de la recomendación.");
    console.log(JSON.stringify(revisionEsceptica(JSON.parse(await readFile(objetivo, "utf8")), { lecciones: nx.ultimas, ahora }), null, 2));
    break;
  }
  default:
    salir("Uso: node herramientas/nexus.mjs validar | lecciones | revisar <id> | historial <id> | agregar-leccion <archivo> --por=alias | agregar-recomendacion <archivo> --por=alias | revision-esceptica <archivo>", orden ? 1 : 0);
}
