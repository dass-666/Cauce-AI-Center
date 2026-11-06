// Nexus fase 1 · herramienta de línea de comandos (Node 18+). Solo lee y escribe en la carpeta del registro
// (por omisión datos/nexus/registro/, fuera de git; los datos de prueba están en datos/nexus/demo/). No se conecta a nada, no usa IA y no toca ningún proyecto.
//
//   node herramientas/nexus.mjs validar                     revisa ambos registros, la cadena de huellas y al gerente
//   node herramientas/nexus.mjs lecciones [--proyecto=id]   lista las lecciones vigentes con su dictamen
//   node herramientas/nexus.mjs revisar <lec-id>            las 12 reglas del gerente para una lección
//   node herramientas/nexus.mjs historial <lec-id>          todas las revisiones de una lección
//   node herramientas/nexus.mjs agregar-leccion <archivo>   agrega una versión (alta, corrección, revisión o retiro)
//   node herramientas/nexus.mjs agregar-evento <archivo>    agrega un evento a una recomendación
//   node herramientas/nexus.mjs revision-gerente <rec-id>   agrega la revisión automática del gerente a una recomendación
//   Opciones: --registro=carpeta   --ahora=2026-11-06T12:00:00-06:00 (para revisar como si fuera otra fecha)
import { readFile, writeFile, rename } from "node:fs/promises";
import { join, resolve } from "node:path";
import { leerNexus, agregarLeccion, agregarEvento, resumirNexus, revisionDelGerente, registroVacio } from "../app/nexus/registro.js";
import { evaluarLeccion } from "../app/nexus/gerente.js";
import { esFechaConZona } from "../app/nexus/comun.js";

const args = process.argv.slice(2);
const opcion = (n) => args.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? null;
const [orden, objetivo] = args.filter((a) => !a.startsWith("--"));
const dir = resolve(opcion("registro") ?? "datos/nexus/registro");
const ahoraTxt = opcion("ahora");
if (ahoraTxt && !esFechaConZona(ahoraTxt)) salir(`--ahora necesita fecha con zona horaria, no «${ahoraTxt}».`);
const ahora = ahoraTxt ? Date.parse(ahoraTxt) : Date.now();
const rutas = { lecciones: join(dir, "lecciones.json"), recomendaciones: join(dir, "recomendaciones.json") };

function salir(t, codigo = 1) { console.error(t); process.exit(codigo); }
async function leerDoc(ruta, tipo) {
  try { return JSON.parse(await readFile(ruta, "utf8")); }
  catch (e) { if (e.code === "ENOENT") return registroVacio(tipo); salir(`${ruta}: ${e.message}`); }
}
/** Reemplazo atómico: escribe a un temporal y lo renombra (nunca queda un archivo a medias). */
async function guardar(ruta, doc) {
  await writeFile(`${ruta}.tmp`, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
  await rename(`${ruta}.tmp`, ruta);
}
const icono = { cumple: "✓", no_cumple: "✗", no_evaluado: "?" };

const docs = { lecciones: await leerDoc(rutas.lecciones, "lecciones"), recomendaciones: await leerDoc(rutas.recomendaciones, "recomendaciones") };
const nx = await leerNexus(docs);

switch (orden) {
  case "validar": {
    const r = resumirNexus(nx, { ahora });
    for (const e of nx.errores) console.log(`ERROR ${e}`);
    console.log(`${r.cifras.lecciones} lecciones: ${r.cifras.sin_objeciones} sin objeciones, ${r.cifras.incompletas} incompletas, ${r.cifras.con_objeciones} con objeciones.`);
    console.log(`${r.recomendaciones.length} recomendaciones: ${r.cifras.pendientes} esperan decisión humana, ${r.cifras.aprobadas_sin_implementar} aprobadas sin implementar, ${r.cifras.desplegadas} desplegadas.`);
    if (r.es_demo) console.log("Registro de PRUEBA (es_demo: true).");
    process.exit(nx.errores.length ? 1 : 0);
  }
  case "lecciones": {
    const p = opcion("proyecto");
    for (const x of resumirNexus(nx, { ahora }).lecciones.filter((x) => !p || x.leccion.proyecto_origen === p || x.leccion.proyectos_destino.includes(p)))
      console.log(`${x.evaluacion.dictamen.estado.padEnd(15)} ${x.leccion.id} (rev. ${x.revisiones}) · ${x.leccion.nivel_validacion} → sostiene ${x.evaluacion.nivel_sustentado} · ${x.leccion.titulo}`);
    break;
  }
  case "revisar": {
    const l = nx.ultimas.get(objetivo);
    if (!l) salir(`No existe la lección ${objetivo}.`);
    const ev = evaluarLeccion(l, { ahora, lecciones: nx.ultimas });
    console.log(`${l.id} rev. ${l.revision} · dictamen: ${ev.dictamen.estado} (el gerente no aprueba; decide una persona)`);
    for (const r of ev.reglas) console.log(`  ${icono[r.resultado]} ${r.id} ${r.nombre}: ${r.resultado} · ${r.explicacion}`);
    break;
  }
  case "historial": {
    const h = nx.historial.get(objetivo);
    if (!h) salir(`No existe la lección ${objetivo}.`);
    for (const v of h) console.log(`rev. ${v.revision} · ${v.tipo_cambio} · ${v.registrado_en} · ${v.registrado_por.tipo}:${v.registrado_por.id}${v.motivo_cambio ? ` · ${v.motivo_cambio}` : ""}`);
    break;
  }
  case "agregar-leccion":
  case "agregar-evento": {
    if (!objetivo) salir("Falta el archivo JSON.");
    if (nx.errores.length) salir(`El registro tiene errores; corrígelos antes de agregar:\n${nx.errores.join("\n")}`);
    const nuevo = JSON.parse(await readFile(objetivo, "utf8"));
    const r = orden === "agregar-leccion" ? await agregarLeccion(docs.lecciones, nuevo) : await agregarEvento(docs.recomendaciones, nuevo, docs.lecciones);
    if (!r.ok) salir(`No se agregó:\n- ${r.errores.join("\n- ")}`);
    await guardar(orden === "agregar-leccion" ? rutas.lecciones : rutas.recomendaciones, r.doc);
    console.log(`Agregado ${nuevo.id}. El historial anterior no cambió.`);
    break;
  }
  case "revision-gerente": {
    const rec = nx.recomendaciones.find((x) => x.id === objetivo);
    if (!rec) salir(`No existe la recomendación ${objetivo}.`);
    const ev = revisionDelGerente(nx, rec, { en: new Date(ahora).toISOString(), secuencia: docs.recomendaciones.eventos.filter((e) => e.id === objetivo).length + 1, es_demo: docs.recomendaciones.es_demo === true });
    const r = await agregarEvento(docs.recomendaciones, ev, docs.lecciones);
    if (!r.ok) salir(`No se agregó:\n- ${r.errores.join("\n- ")}`);
    await guardar(rutas.recomendaciones, r.doc);
    console.log(`Revisión del gerente: ${ev.dictamen}. ${ev.nota}`);
    break;
  }
  default:
    salir("Uso: node herramientas/nexus.mjs validar | lecciones | revisar <id> | historial <id> | agregar-leccion <archivo> | agregar-evento <archivo> | revision-gerente <rec-id>", orden ? 1 : 0);
}
