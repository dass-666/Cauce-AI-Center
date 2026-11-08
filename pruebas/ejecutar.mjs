// Ejecuta las pruebas en Node:  node pruebas/ejecutar.mjs
// (Opcional: las mismas pruebas corren en el navegador abriendo pruebas.html.)
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { registrarCasos } from "./casos.js";
import { registrarCasosNaturaleza } from "./casos-naturaleza.js";
import { registrarCasosEkChuah } from "./casos-ek-chuah.js";
import { registrarCasosFaseI } from "./casos-fase-i.js";
import { registrarCasosFaseJ } from "./casos-fase-j.js";
import { registrarCasosFaseK } from "./casos-fase-k.js";
import { registrarCasosFaseL } from "./casos-fase-l.js";
import { registrarCasosRendimiento } from "./casos-rendimiento.js";
import { registrarCasosFaseM } from "./casos-fase-m.js";
import { registrarCasosNexus } from "./casos-nexus.js";
import { registrarCasosNexus15 } from "./casos-nexus-15.js";
import { registrarCasosCSI } from "./casos-csi.js";
import { registrarCasosCSIFase2 } from "./casos-csi-fase2.js";
import { registrarCasosCierre } from "./casos-cierre.js";
import { registrarCasosLaboratorio } from "./casos-laboratorio.js";
import { registrarCasosLaboratorioFase2 } from "./casos-laboratorio-fase2.js";
import { ejecutar } from "./mini.js";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const leer = (ruta) => readFile(join(raiz, ruta), "utf8");
registrarCasos(leer);
registrarCasosNaturaleza(leer);
registrarCasosEkChuah(leer);
registrarCasosFaseI(leer);
registrarCasosFaseJ(leer);
registrarCasosFaseK(leer);
registrarCasosFaseL(leer);
registrarCasosRendimiento(leer);
registrarCasosFaseM(leer);
registrarCasosNexus(leer);
registrarCasosNexus15(leer);
registrarCasosCSI(leer);
registrarCasosCSIFase2();
registrarCasosCierre(leer);
registrarCasosLaboratorio(leer);
registrarCasosLaboratorioFase2(leer);

const r = await ejecutar();
for (const p of r.resultados) console.log(`${p.ok ? "OK   " : "FALLA"} ${p.nombre}${p.ok ? "" : "\n      " + p.error}`);
console.log(`\n${r.pasaron} pasaron, ${r.fallaron} fallaron`);
process.exit(r.fallaron ? 1 : 0);
