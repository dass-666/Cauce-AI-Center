// Revisa un archivo de estado contra el contrato cauce.estado-proyecto v1, igual que el visualizador.
// Sirve para construir un adaptador nuevo sin abrir el navegador. Solo lee el archivo; no escribe nada.
//   node herramientas/validar-estado.mjs datos/reales/compago.json
//   node herramientas/validar-estado.mjs datos/demo/ek-chuah.json --demo
//   node herramientas/validar-estado.mjs archivo.json --proyecto=compago   (exige que sea de ese proyecto)
// Termina con código 0 si el archivo es válido y vigente (o es demostración), 1 si no.

import { readFile } from "node:fs/promises";
import { validarDocumento } from "../app/nucleo/contrato.js";
import { construirModeloVista, elegirCarga } from "../app/nucleo/modelo.js";

const [ruta, ...banderas] = process.argv.slice(2);
if (!ruta) {
  console.error("Uso: node herramientas/validar-estado.mjs <archivo.json> [--demo]");
  process.exit(2);
}
const comoDemo = banderas.includes("--demo");

let carga;
try {
  carga = { tipo: "ok", datos: JSON.parse(await readFile(ruta, "utf8")) };
} catch (e) {
  carga = e.code === "ENOENT" ? { tipo: "no_encontrado", mensaje: `No existe ${ruta}` } : { tipo: "json_invalido", mensaje: `${ruta} no es JSON válido.` };
}
// Se elige la carga exactamente como en la página (con --demo, como si fuera el archivo de demostración).
const eleccion = comoDemo ? elegirCarga({ tipo: "no_encontrado" }, carga) : elegirCarga(carga, null);
const r = eleccion.carga.tipo === "ok" ? validarDocumento(eleccion.carga.datos) : null;
// El proyecto se toma de --proyecto=<id> o, si no se da, del propio archivo.
const idPedido = banderas.find((b) => b.startsWith("--proyecto="))?.slice(11);
const idProyecto = idPedido ?? (typeof carga.datos?.proyecto?.id === "string" ? carga.datos.proyecto.id : "desconocido");
const m = construirModeloVista({ proyecto: { id: idProyecto, nombre: ruta }, carga: eleccion.carga, ahora: new Date() });

console.log(`Archivo: ${ruta}${comoDemo ? " (como demostración)" : ""}`);
console.log(`Fuente: ${!m.generado_en ? "no determinada" : m.es_demo ? "DEMO" : "REAL"} · Conexión: ${m.conexion_etiqueta}${m.motivo ? ` · ${m.motivo}` : ""}`);
if (m.generado_en) console.log(`Generado: ${m.generado_en} (hace ${m.edad_segundos} s${m.hora_simulada ? ", hora simulada" : ""})`);
const agentes = m.departamentos.flatMap((d) => d.agentes);
if (agentes.length) {
  const conteo = {};
  for (const a of agentes) conteo[a.estado_mostrado] = (conteo[a.estado_mostrado] ?? 0) + 1;
  console.log(`Departamentos: ${m.departamentos.length} · Personajes: ${agentes.length} · ${Object.entries(conteo).map(([e, n]) => `${n} ${e}`).join(", ")}`);
}
for (const e of r?.errores ?? m.errores) console.log(`  ERROR  ${e}`);
for (const a of [...(r?.avisos ?? []), ...m.avisos]) console.log(`  AVISO  ${a}`);
const bien = m.conexion === "en_linea" || (m.es_demo && m.conexion !== "invalido");
console.log(bien ? "Resultado: válido." : "Resultado: el visualizador NO mostrará actividad con este archivo.");
process.exit(bien ? 0 : 1);
