// Genera los registros de PRUEBA de Nexus (datos/nexus/demo/*.json) con las mismas funciones que usa el registro real,
// así la cadena de huellas es correcta y cada evento pasó las reglas. Todo es ficticio (es_demo: true).
//   node herramientas/nexus-demo.mjs            → escribe datos/nexus/demo/
//   node herramientas/nexus-demo.mjs --comprobar → solo compara con lo guardado (lo usan las pruebas)
import { readFile, writeFile, rename } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { construirDemo } from "../app/nexus/demo.js";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const { lecciones, recomendaciones } = await construirDemo();
const salidas = [["datos/nexus/demo/lecciones.json", lecciones], ["datos/nexus/demo/recomendaciones.json", recomendaciones]];
if (process.argv.includes("--comprobar")) {
  let bien = true;
  for (const [ruta, doc] of salidas) {
    const guardado = await readFile(join(raiz, ruta), "utf8").catch(() => "");
    const igual = guardado === `${JSON.stringify(doc, null, 2)}\n`;
    console.log(`${igual ? "OK   " : "FALLA"} ${ruta}`);
    bien &&= igual;
  }
  process.exit(bien ? 0 : 1);
}
for (const [ruta, doc] of salidas) {
  const tmp = join(raiz, `${ruta}.tmp`);
  await writeFile(tmp, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
  await rename(tmp, join(raiz, ruta));
  console.log(`escrito ${ruta}`);
}
