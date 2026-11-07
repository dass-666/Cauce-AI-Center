#!/usr/bin/env node
// Laboratorio de IA · fase 1.1 · piloto aislado: empaquetar, comprobar y puntuar (solo Node, solo archivos locales).
// No llama a modelos, no usa red, no ejecuta comandos y no escribe en CSI ni en Nexus. Las carpetas de salida se
// crean nuevas (nunca se sobrescribe) y cada archivo se escribe con reemplazo atómico.
//
//   node herramientas/piloto.mjs empaquetar --rol critico --evaluacion EXP.json --corrida 2026-11-piloto-1
//        --pregunta "…" --creado-por diego --salida DIR [--corte 2015-01-15T00:00:00Z] [--banco banco-bns-2015-v1]
//        [--demo] [--ahora …] [--max-minutos 60] [--max-tokens 20000]
//   node herramientas/piloto.mjs empaquetar --rol investigador --catalogo CAT.json --copias DIR … --salida DIR
//   node herramientas/piloto.mjs empaquetar --rol analista --catalogo CAT.json --verificadas DIR … --salida DIR
//   node herramientas/piloto.mjs comprobar DIR [--rol critico]        ← fallo seguro: cualquier problema = código 1
//   node herramientas/piloto.mjs puntuar --ejecucion X.json --clave CLAVE.json --salida R.json
//        [--criterios C.json] [--insumo banco-bns-2015-v1]          ← SOLO en el entorno privado, nunca con la IA
//
// Códigos de salida: 0 bien · 1 hay problemas (se explican) · 2 uso incorrecto o archivo ilegible.

import { readFile, mkdir, readdir, lstat, realpath, stat } from "node:fs/promises";
import { basename, join, resolve, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { construirPaquete, comprobarPaquete, MAX_BYTES_ARCHIVO } from "../app/laboratorio/paquete.js";
import { puntuar } from "../app/laboratorio/puntuacion.js";
import { esFechaConZona } from "../app/laboratorio/base.js";
import { escribirAtomico, MAX_BYTES_JSON } from "./laboratorio.mjs";

class ErrorUso extends Error {}
const existe = (r) => stat(r).then(() => true, () => false);
const textoJSON = (v) => `${JSON.stringify(v, null, 2)}\n`;

function opciones(args) {
  const o = { _: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--demo") o.demo = true;
    else if (a.startsWith("--")) { if (i + 1 >= args.length) throw new ErrorUso(`Falta el valor de ${a}.`); o[a.slice(2)] = args[++i]; }
    else o._.push(a);
  }
  return o;
}
const exigir = (o, ...claves) => { for (const k of claves) if (!o[k]) throw new ErrorUso(`Falta --${k}.`); };
const ahoraDe = (o) => {
  const t = o.ahora ?? new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  if (!esFechaConZona(t)) throw new ErrorUso("--ahora debe ser un instante con zona.");
  return t;
};
async function archivoNormal(ruta, max, que) {
  let st;
  try { st = await lstat(ruta); } catch { throw new ErrorUso(`No se pudo leer ${ruta}.`); }
  if (st.isSymbolicLink()) throw new ErrorUso(`${ruta} es un enlace simbólico: ${que} no se leen a través de enlaces.`);
  if (!st.isFile()) throw new ErrorUso(`${ruta} no es un archivo.`);
  if (st.size > max) throw new ErrorUso(`${ruta} pesa ${st.size} bytes y el límite para ${que} es ${max}.`);
}
async function leerTexto(ruta, max = MAX_BYTES_JSON) { await archivoNormal(ruta, max, "documentos"); try { return await readFile(ruta, "utf8"); } catch { throw new ErrorUso(`No se pudo leer ${ruta}.`); } }
async function leerJSON(ruta) { const t = await leerTexto(ruta); try { return { doc: JSON.parse(t), texto: t }; } catch { throw new ErrorUso(`${ruta} no es JSON válido.`); } }

/** Recorre una carpeta SIN seguir enlaces; devuelve entradas para comprobarPaquete (enlaces y rutas fuera incluidos, marcados). */
async function leerCarpeta(dir) {
  const raiz = resolve(dir);
  let raizReal;
  try { raizReal = await realpath(raiz); } catch { throw new ErrorUso(`No se pudo leer la carpeta ${dir}.`); }
  const entradas = [];
  async function visitar(d) {
    for (const nombre of (await readdir(d)).sort()) {
      const ruta = join(d, nombre), rel = relative(raiz, ruta).split(sep).join("/");
      const st = await lstat(ruta);
      if (st.isSymbolicLink()) {
        let fuera = true;
        try { const real = await realpath(ruta); fuera = !(real === raizReal || real.startsWith(raizReal + sep)); } catch { /* enlace roto: fuera */ }
        entradas.push({ ruta: rel, bytes: new Uint8Array(), texto: null, enlace: true, fuera });
        continue;
      }
      if (st.isDirectory()) { await visitar(ruta); continue; }
      if (!st.isFile()) { entradas.push({ ruta: rel, bytes: new Uint8Array(), texto: null, enlace: false, fuera: true }); continue; }
      if (st.size > MAX_BYTES_ARCHIVO) { entradas.push({ ruta: rel, bytes: new Uint8Array(st.size), texto: null, enlace: false, fuera: false }); continue; }
      const bytes = new Uint8Array(await readFile(ruta));
      const esTexto = /\.(json|md|txt|html?|csv)$/i.test(nombre);
      entradas.push({ ruta: rel, bytes, texto: esTexto ? new TextDecoder().decode(bytes) : null, enlace: false, fuera: false });
    }
  }
  await visitar(raiz);
  return entradas;
}

const ORDENES = {
  async empaquetar(o, log) {
    exigir(o, "rol", "corrida", "pregunta", "creado-por", "salida");
    if (await existe(o.salida)) throw new ErrorUso(`${o.salida} ya existe: un paquete nunca se sobrescribe.`);
    const p = {
      rol: o.rol, corrida_id: o.corrida, es_demo: !!o.demo, pregunta: o.pregunta, corte: o.corte ?? null, creado_por: o["creado-por"], creado_en: ahoraDe(o),
      banco_id: o.banco ?? "banco", limites: { max_minutos: Number(o["max-minutos"] ?? 60), max_tokens_salida: Number(o["max-tokens"] ?? 20000), max_consultas_web: 0 },
    };
    if (o.rol === "critico") { exigir(o, "evaluacion"); p.evaluacion = { texto: await leerTexto(o.evaluacion) }; }
    if (o.catalogo) p.catalogo = (await leerJSON(o.catalogo)).doc;
    if (o.rol === "investigador") {
      exigir(o, "catalogo", "copias");
      p.copias = new Map();
      for (const n of (await readdir(o.copias)).sort()) {
        if (n.includes(".tmp-")) continue;
        await archivoNormal(join(o.copias, n), MAX_BYTES_ARCHIVO, "copias");
        p.copias.set(n.replace(/\.[^.]+$/, ""), { nombre: n, bytes: new Uint8Array(await readFile(join(o.copias, n))) });
      }
    }
    if (o.rol === "analista") {
      exigir(o, "catalogo", "verificadas");
      const docs = [];
      for (const n of (await readdir(o.verificadas)).sort()) if (/\.json$/.test(n)) docs.push((await leerJSON(join(o.verificadas, n))).doc);
      const ejecuciones = docs.filter((d) => d?.contrato === "cauce.lab.ejecucion"), verificaciones = docs.filter((d) => d?.contrato === "cauce.lab.verificacion");
      p.verificadas = ejecuciones.map((e) => ({ ejecucion: e, verificacion: verificaciones.find((v) => v.ejecucion_id === e.id) ?? null }));
    }
    const r = await construirPaquete(p);
    if (!r.ok) { log(`✗ Paquete no generado:\n  - ${r.errores.join("\n  - ")}`); return 1; }
    for (const [ruta, a] of r.archivos) {
      await mkdir(join(o.salida, ...ruta.split("/").slice(0, -1)), { recursive: true });
      await escribirAtomico(join(o.salida, ...ruta.split("/")), "bytes" in a ? Buffer.from(a.bytes) : a.texto);
    }
    // Se vuelve a comprobar LEYENDO del disco: lo que importa es lo que la sesión verá.
    const c = await comprobarPaquete(await leerCarpeta(o.salida), { rol: o.rol });
    if (!c.ok) { log(`✗ El paquete escrito no pasa el comprobador:\n  - ${c.problemas.map((x) => `${x.ruta}: ${x.codigo} — ${x.detalle}`).join("\n  - ")}`); return 1; }
    log(`✓ Paquete ${r.paquete.corrida_id} (${o.rol}${o.demo ? ", DEMO" : ""}): ${r.paquete.archivos.length + 1} archivos en ${o.salida}; encargo ${r.paquete.encargo.id} (${r.paquete.encargo_sha256.slice(0, 12)}…).`);
    log("  Comprobado desde disco: sin clave, sin original, sin rutas externas. Lo que NO se comprueba aquí: la sesión que lo use debe abrirse sin acceso al repositorio ni a la carpeta del proyecto.");
    return 0;
  },

  async comprobar(o, log) {
    if (!o._[0]) throw new ErrorUso("Uso: comprobar <carpeta> [--rol critico|investigador|analista]");
    const c = await comprobarPaquete(await leerCarpeta(o._[0]), { rol: o.rol ?? null });
    log(`${c.ok ? "✓" : "✗"} ${c.resumen.n_archivos} archivo(s), ${c.resumen.bytes} bytes, rol ${c.resumen.rol ?? "?"}, corrida ${c.resumen.corrida_id ?? "?"}: ${c.problemas.length} problema(s).`);
    for (const p of c.problemas) log(`  ${p.ruta}: ${p.codigo} — ${p.detalle}`);
    if (c.ok) log("  Nada prohibido encontrado. Esto no demuestra aislamiento absoluto: la sesión real debe abrirse sin repositorio, sin carpeta del proyecto y sin red.");
    return c.ok ? 0 : 1;
  },

  async puntuar(o, log) {
    exigir(o, "ejecucion", "clave", "salida");
    if (await existe(o.salida)) throw new ErrorUso(`${o.salida} ya existe: una puntuación no se sobrescribe.`);
    const { doc: ejecucion } = await leerJSON(o.ejecucion), { doc: clave } = await leerJSON(o.clave);
    const criterios = o.criterios ? (await leerJSON(o.criterios)).doc : {};
    const r = puntuar({ ejecucion, clave, criterios, insumo: o.insumo ?? null });
    if (!r.ok) { log(`✗ No se puntuó:\n  - ${r.errores.join("\n  - ")}`); return 1; }
    await escribirAtomico(o.salida, textoJSON(r.puntuacion));
    const s = r.puntuacion.resumen;
    log(`✓ ${r.puntuacion.ejecucion_id}: ${s.correctos} correctos, ${s.parciales} parciales, ${s.incorrectos} incorrectos, ${s.no_detectados} no detectados de ${s.n_retos} retos; puntaje ${s.puntaje}; falsos positivos ${s.falsos_positivos}; controles ${s.controles.map((c) => `${c.defecto_id}=${c.estado}`).join(", ") || "ninguno"}.`);
    log(`  Guardada en ${o.salida}. Esta salida contiene ids de entidades y evidencias: NO la lleves al paquete de ninguna sesión evaluada.`);
    return 0;
  },
};

export async function principal(args, log = console.log) {
  const [orden, ...resto] = args;
  const f = ORDENES[orden];
  if (!f) { log(`Órdenes: ${Object.keys(ORDENES).join(" · ")}. Ver el encabezado de herramientas/piloto.mjs.`); return 2; }
  try { return await f(opciones(resto), log); } catch (err) {
    if (err instanceof ErrorUso) { log(`✗ ${err.message}`); return 2; }
    throw err;
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  process.exitCode = await principal(process.argv.slice(2));
}
export const RAIZ = join(fileURLToPath(new URL(".", import.meta.url)), "..");
export { basename };
