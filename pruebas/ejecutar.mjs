// Ejecuta las pruebas en Node:  node pruebas/ejecutar.mjs
// (Opcional: las mismas pruebas corren en el navegador abriendo pruebas.html.)
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { registrarCasos } from "./casos.js";
import { registrarCasosNaturaleza } from "./casos-naturaleza.js";
import { ejecutar } from "./mini.js";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const leer = (ruta) => readFile(join(raiz, ruta), "utf8");
registrarCasos(leer);
registrarCasosNaturaleza(leer);

const r = await ejecutar();
for (const p of r.resultados) console.log(`${p.ok ? "OK   " : "FALLA"} ${p.nombre}${p.ok ? "" : "\n      " + p.error}`);
console.log(`\n${r.pasaron} pasaron, ${r.fallaron} fallaron`);
process.exit(r.fallaron ? 1 : 0);
