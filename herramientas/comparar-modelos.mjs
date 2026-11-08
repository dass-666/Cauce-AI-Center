#!/usr/bin/env node
// Laboratorio de IA · fase 3.1 · comparar modelos a partir de expedientes EXPORTADOS (cauce.lab.expediente-local 0.1).
//
//   node herramientas/comparar-modelos.mjs <expediente.json> [<otro.json> …] [--json salida.json] [--md salida.md]
//   node herramientas/comparar-modelos.mjs --plantilla          → imprime la comparación vacía (formato), sin inventar nada
//
// Lee cada expediente con las mismas comprobaciones que la oficina al reanudar (huellas, contratos, historial). Un
// archivo que no cuadra se informa y se omite. No usa red, no escribe salvo donde se le pida con --json/--md.
import { readFile, writeFile } from "node:fs/promises";
import { restaurarExpediente } from "../app/laboratorio/expediente.js";
import { compararModelos, comparacionMarkdown } from "../app/laboratorio/comparacion.js";

const args = process.argv.slice(2);
const opc = { json: null, md: null, plantilla: false };
const rutas = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--json") opc.json = args[++i];
  else if (args[i] === "--md") opc.md = args[++i];
  else if (args[i] === "--plantilla") opc.plantilla = true;
  else rutas.push(args[i]);
}
const ahora = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
if (!rutas.length && !opc.plantilla) { console.error("Uso: node herramientas/comparar-modelos.mjs <expediente.json> […] [--json salida.json] [--md salida.md] | --plantilla"); process.exit(2); }

const expedientes = [];
for (const ruta of rutas) {
  let o;
  try { o = JSON.parse(await readFile(ruta, "utf8")); } catch (err) { console.error(`OMITIDO ${ruta}: no es JSON legible (${err.message}).`); continue; }
  const r = await restaurarExpediente(o);
  if (!r.ok) { console.error(`OMITIDO ${ruta}: ${r.errores.slice(0, 2).join(" ")}`); continue; }
  expedientes.push(r.expediente);
  console.error(`LEÍDO  ${ruta}: ${r.expediente.trabajo.id} (${r.expediente.trabajo.es_demo ? "DEMO" : "REAL"}, ${r.expediente.trabajo.estado})`);
}
const c = compararModelos(expedientes, { generado_en: ahora });
const md = comparacionMarkdown(c);
if (opc.json) await writeFile(opc.json, `${JSON.stringify(c, null, 2)}\n`);
if (opc.md) await writeFile(opc.md, md);
if (!opc.md) process.stdout.write(md);
process.exit(c.sin_datos && !opc.plantilla ? 1 : 0);
