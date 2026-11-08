#!/usr/bin/env node
// Laboratorio de IA · fase 1 · herramienta de línea de comandos (solo Node, solo archivos locales).
// No llama a modelos, no usa red, no ejecuta comandos de la IA y no escribe en CSI ni en Nexus.
// Todo lo que escribe va a archivos nuevos o a un registro solo-anexado, siempre con reemplazo atómico
// (se escribe un temporal y se renombra: si algo falla, el archivo anterior queda intacto).
//
//   node herramientas/laboratorio.mjs validar <documento.json>
//   node herramientas/laboratorio.mjs verificar --encargo E.json --ejecucion X.json --copias DIR
//        [--registro R.jsonl] [--ahora 2030-04-01T12:00:00Z] [--salida V.json]
//   node herramientas/laboratorio.mjs registrar --registro R.jsonl --tipo encargo|ejecucion|verificacion
//        --documento D.json [--demo] [--ahora …]
//   node herramientas/laboratorio.mjs verificar-registro R.jsonl [--demo]
//   node herramientas/laboratorio.mjs banco --original EXP.json --especificacion ESP.json --salida DIR
//   node herramientas/laboratorio.mjs verificar-banco DIR
//   Fase 2:
//   node herramientas/laboratorio.mjs flujo-demo --registro demo-R.jsonl [--salida DIR]
//        corre los 4 trabajos DEMO de punta a punta (guion sin modelo, NO es IA), los anexa al registro DEMO y,
//        con --salida, guarda cada informe en Markdown y la última versión de cada trabajo
//   node herramientas/laboratorio.mjs trabajos R.jsonl [--demo]        lista los trabajos y su estado
//   node herramientas/laboratorio.mjs revisar --registro R.jsonl --trabajo ID --decision aprobar|rechazar|pedir-evidencia|revisar|reanudar
//        --por NOMBRE --motivo "…" [--demo] [--ahora …]   decisión de UNA PERSONA (identidad declarada)
//
// Códigos de salida: 0 bien · 1 hay problemas (se explican) · 2 uso incorrecto o archivo ilegible.

import { readFile, writeFile, rename, rm, mkdir, readdir, stat, lstat } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { validarEncargo, validarEjecucion, validarVerificacion } from "../app/laboratorio/contratos.js";
import { verificarYValidar } from "../app/laboratorio/verificador.js";
import { nuevaEntrada, serializar, verificarRegistro, indicesDesdeEntradas } from "../app/laboratorio/registro.js";
import { construirBanco, comprobarBanco, textoJSON } from "../app/laboratorio/banco.js";
import { esFechaConZona, LIMITES } from "../app/laboratorio/base.js";
import { entradasDeDocumentos } from "../app/laboratorio/registro.js";
import { escenariosDemo } from "../app/laboratorio/escenarios-demo.js";
import { informeMarkdown } from "../app/laboratorio/informe.js";
import { transitar, ETIQUETA_ESTADO } from "../app/laboratorio/trabajo.js";

/** Topes de lectura: un archivo mayor no se abre (un JSON enorme o una «copia» gigante no deben tumbar la herramienta). */
export const MAX_BYTES_JSON = LIMITES.bytes_documento * 2;
export const MAX_BYTES_COPIA = 50_000_000;

const VALIDADORES = { "cauce.lab.encargo": validarEncargo, "cauce.lab.ejecucion": validarEjecucion, "cauce.lab.verificacion": validarVerificacion };

class ErrorUso extends Error {}
export const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Reemplazo atómico: escribe `ruta.tmp-<pid>` y lo renombra sobre `ruta`. Si escribir o renombrar falla,
 * borra el temporal y deja el archivo anterior como estaba. `fs` se inyecta solo en pruebas.
 */
export async function escribirAtomico(ruta, texto, fs = { writeFile, rename, rm }) {
  const tmp = `${ruta}.tmp-${process.pid}`;
  try {
    await fs.writeFile(tmp, texto, { encoding: "utf8", flag: "wx" });
    await fs.rename(tmp, ruta);
  } catch (err) {
    await fs.rm(tmp, { force: true }).catch(() => {});
    throw err;
  }
}

const existe = (r) => stat(r).then(() => true, () => false);
/** Comprueba, sin seguir enlaces, que `ruta` es un archivo normal (no un enlace simbólico) y que no supera `max` bytes. */
async function archivoNormal(ruta, max, que) {
  let st;
  try { st = await lstat(ruta); } catch { throw new ErrorUso(`No se pudo leer ${ruta}.`); }
  if (st.isSymbolicLink()) throw new ErrorUso(`${ruta} es un enlace simbólico: ${que} no se leen a través de enlaces (podría apuntar fuera de la carpeta permitida).`);
  if (!st.isFile()) throw new ErrorUso(`${ruta} no es un archivo.`);
  if (st.size > max) throw new ErrorUso(`${ruta} pesa ${st.size} bytes y el límite para ${que} es ${max}.`);
}
async function leerJSON(ruta) {
  let t;
  await archivoNormal(ruta, MAX_BYTES_JSON, "documentos JSON");
  try { t = await readFile(ruta, "utf8"); } catch { throw new ErrorUso(`No se pudo leer ${ruta}.`); }
  try { return { doc: JSON.parse(t), texto: t }; } catch { throw new ErrorUso(`${ruta} no es JSON válido.`); }
}

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

/** Un registro cuyo nombre empieza por «demo-» es DEMO; cualquier otro es REAL. El indicador --demo debe coincidir. */
function mundoDelRegistro(ruta, demo) {
  const esDemoPorNombre = basename(ruta).startsWith("demo-");
  if (esDemoPorNombre !== !!demo) throw new ErrorUso(`El registro ${basename(ruta)} es ${esDemoPorNombre ? "DEMO" : "REAL"} por su nombre y se pidió ${demo ? "DEMO" : "REAL"}: no se mezclan.`);
  return esDemoPorNombre;
}

async function leerRegistro(ruta, es_demo) {
  const texto = (await existe(ruta)) ? await readFile(ruta, "utf8") : "";
  return { texto, r: await verificarRegistro(texto, { es_demo }) };
}

/** Copias locales: por cada fuente, `<id>.txt` es el texto; otro `<id>.<ext>` (pdf, html…) son los bytes originales. */
async function leerCopias(dir, encargo) {
  const copias = new Map();
  let nombres;
  try { nombres = await readdir(dir); } catch { throw new ErrorUso(`No se pudo leer la carpeta de copias ${dir}.`); }
  for (const f of encargo?.fuentes_permitidas ?? []) {
    const id = f?.fuente_id;
    if (typeof id !== "string") continue;
    const propios = nombres.filter((n) => n.startsWith(`${id}.`) && !n.includes(".tmp-"));
    if (!propios.length) continue;
    const txt = propios.find((n) => n === `${id}.txt`);
    const originales = propios.filter((n) => n !== `${id}.txt`);
    if (originales.length > 1) throw new ErrorUso(`La fuente ${id} tiene ${originales.length} copias originales en ${dir} (${originales.join(", ")}): debe haber una sola.`);
    const original = originales[0] ?? txt;
    for (const n of propios) await archivoNormal(join(dir, n), MAX_BYTES_COPIA, "copias de fuentes");
    const bytes = new Uint8Array(await readFile(join(dir, original)));
    const texto = txt ? await readFile(join(dir, txt), "utf8") : null;
    copias.set(id, { bytes, texto });
  }
  return copias;
}

const ahoraDe = (o) => {
  const t = o.ahora ?? new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  if (!esFechaConZona(t)) throw new ErrorUso("--ahora debe ser un instante con zona (p. ej. 2030-04-01T12:00:00Z).");
  return t;
};

// ------------------------------------------------------------------ órdenes
const ORDENES = {
  async validar(o, log) {
    if (!o._[0]) throw new ErrorUso("Uso: validar <documento.json>");
    const { doc } = await leerJSON(o._[0]);
    const v = VALIDADORES[doc?.contrato];
    if (!v) { log(`✗ contrato «${doc?.contrato}» desconocido: ${Object.keys(VALIDADORES).join(" | ")}.`); return 1; }
    const r = v(doc);
    log(r.ok ? `✓ ${doc.contrato} ${doc.version_contrato} válido (${doc.id}${doc.es_demo ? ", DEMO" : ""}).` : `✗ ${doc.contrato}: ${r.errores.length} error(es)\n  - ${r.errores.join("\n  - ")}`);
    return r.ok ? 0 : 1;
  },

  async verificar(o, log) {
    exigir(o, "encargo", "ejecucion", "copias");
    const { doc: encargo } = await leerJSON(o.encargo), { doc: ejecucion } = await leerJSON(o.ejecucion);
    const copias = await leerCopias(o.copias, encargo);
    let registro = {};
    if (o.registro) {
      const { r } = await leerRegistro(o.registro, mundoDelRegistro(o.registro, ejecucion?.es_demo === true));
      if (!r.ok) { log(`✗ El registro tiene ${r.problemas.length} problema(s); no se usa para circularidad hasta revisarlo.`); return 1; }
      registro = indicesDesdeEntradas(r.entradas);
    }
    const r = await verificarYValidar({ encargo, ejecucion, copias, registro, ahora: ahoraDe(o) });
    if (!r.salida_valida) { log(`✗ Defecto de lab-V: su salida no cumple el contrato:\n  - ${r.errores_salida.join("\n  - ")}`); return 1; }
    const v = r.verificacion;
    log(`${v.resultado === "apta_para_revision_humana" ? "✓" : "✗"} ${v.id}: ${v.resultado} · citas utilizables ${v.resumen.n_citas_utilizables}/${v.resumen.n_citas} · alertas ${v.alertas.length} · errores ${v.errores.length}`);
    log("  Respaldo semántico: pendiente de revisión humana (lab-V nunca declara verdadera una afirmación).");
    for (const e of v.errores) log(`  error: ${e}`);
    for (const a of v.alertas) log(`  alerta: ${a.codigo} (${a.ruta}) ${a.detalle}`);
    if (o.salida) {
      if (await existe(o.salida)) throw new ErrorUso(`${o.salida} ya existe: lab-V no sobrescribe verificaciones.`);
      await escribirAtomico(o.salida, textoJSON(v));
      log(`  Guardada en ${o.salida}.`);
    }
    return v.resultado === "apta_para_revision_humana" ? 0 : 1;
  },

  async registrar(o, log) {
    exigir(o, "registro", "tipo", "documento");
    const es_demo = mundoDelRegistro(o.registro, o.demo);
    const { doc } = await leerJSON(o.documento);
    const { texto, r } = await leerRegistro(o.registro, es_demo);
    if (!r.ok) {
      log(`✗ No se anexa: el registro ya tiene ${r.problemas.length} problema(s). Revísalo con verificar-registro; nada se borra ni se repara solo.`);
      for (const p of r.problemas) log(`  línea ${p.linea}: ${p.codigo} — ${p.detalle}`);
      return 1;
    }
    const n = await nuevaEntrada(r.ultima, { tipo: o.tipo, documento: doc, registrado_en: ahoraDe(o), registro_es_demo: es_demo, ids_validos: r.ids_validos });
    if (!n.ok) { log(`✗ No se anexa:\n  - ${n.errores.join("\n  - ")}`); return 1; }
    await mkdir(dirname(resolve(o.registro)), { recursive: true });
    await escribirAtomico(o.registro, texto + serializar(n.entrada));
    log(`✓ Entrada ${n.entrada.n} (${o.tipo} ${n.entrada.id ?? "sin id"}) anexada${n.entrada.valido ? "" : ` como INVÁLIDA (${n.entrada.errores_contrato.length} error(es) de contrato; queda para auditoría)`}.`);
    return 0;
  },

  async "verificar-registro"(o, log) {
    if (!o._[0]) throw new ErrorUso("Uso: verificar-registro <registro.jsonl> [--demo]");
    const { r } = await leerRegistro(o._[0], mundoDelRegistro(o._[0], o.demo));
    log(`${r.ok ? "✓" : "✗"} ${r.entradas.length} entrada(s) legibles; ${r.problemas.length} problema(s).`);
    for (const p of r.problemas) log(`  línea ${p.linea}: ${p.codigo} — ${p.detalle}`);
    return r.ok ? 0 : 1;
  },

  async banco(o, log) {
    exigir(o, "original", "especificacion", "salida");
    if (await existe(o.salida)) throw new ErrorUso(`${o.salida} ya existe: un banco nunca se sobrescribe (genera otro con otro nombre).`);
    const { doc: original, texto: textoOriginal } = await leerJSON(o.original);
    const { doc: espec } = await leerJSON(o.especificacion);
    const b = await construirBanco(original, espec, { textoOriginal, nombreOriginal: basename(o.original) });
    if (!b.ok) { log(`✗ Banco no generado:\n  - ${b.errores.join("\n  - ")}`); return 1; }
    await mkdir(join(o.salida, "evaluacion"), { recursive: true });
    await mkdir(join(o.salida, "clave"), { recursive: true });
    await escribirAtomico(join(o.salida, b.manifiesto.evaluacion.archivo), b.textos.evaluacion);
    await escribirAtomico(join(o.salida, b.manifiesto.clave.archivo), b.textos.clave);
    await escribirAtomico(join(o.salida, "manifiesto.json"), b.textos.manifiesto);
    const s = b.clave.resumen;
    log(`✓ Banco ${b.manifiesto.banco_id}: ${s.n_defectos} defectos; las reglas actuales detectan ${s.detectados_por_reglas_actuales.length} (${s.detectados_por_reglas_actuales.join(", ") || "ninguno"}).`);
    log("  Aprobación: pendiente de Diego. Mueve clave/ fuera del alcance de la IA antes de cualquier corrida.");
    return 0;
  },

  async "flujo-demo"(o, log) {
    exigir(o, "registro");
    if (mundoDelRegistro(o.registro, true) !== true) throw new ErrorUso("flujo-demo solo escribe en un registro DEMO (nombre demo-…).");
    const leerDemo = async (m) => (await leerJSON(join(RAIZ, "datos", "demo", `${m}.json`))).doc;
    const r = await escenariosDemo({ compago: await leerDemo("compago"), "ek-chuah": await leerDemo("ek-chuah") });
    if (r.errores.length) { log(`✗ ${r.errores.join("\n✗ ")}`); return 1; }
    const { texto, r: reg } = await leerRegistro(o.registro, true);
    if (!reg.ok) { log(`✗ El registro ya tiene ${reg.problemas.length} problema(s): no se anexa nada (verificar-registro).`); return 1; }
    const ya = new Set(reg.entradas.filter((e) => e.tipo === "trabajo").map((e) => e.id));
    let anterior = reg.ultima, ids = reg.ids_validos, nuevo = "";
    for (const x of r.expedientes) {
      if (ya.has(x.trabajo.id)) { log(`· ${x.trabajo.id} ya está en el registro: no se repite.`); continue; }
      const e = await entradasDeDocumentos(x.documentos, { anterior, registro_es_demo: true, ids_validos: ids });
      if (!e.ok) { log(`✗ ${e.errores.join(" ")}`); return 1; }
      for (const z of e.entradas) { nuevo += serializar(z); ids = new Set([...ids, `${z.tipo === "trabajo" ? `trabajo:${z.id}#${z.documento.historial.length}` : `${z.tipo}:${z.id}`}`]); }
      anterior = e.entradas.at(-1) ?? anterior;
      log(`✓ ${x.trabajo.id}: ${ETIQUETA_ESTADO[x.trabajo.estado]} · ${e.entradas.length} entradas.`);
    }
    if (nuevo) { await mkdir(dirname(resolve(o.registro)), { recursive: true }); await escribirAtomico(o.registro, texto + nuevo); }
    if (o.salida) {
      await mkdir(o.salida, { recursive: true });
      for (const x of r.expedientes) {
        await escribirAtomico(join(o.salida, `${x.trabajo.id}.json`), `${JSON.stringify(x.trabajo, null, 2)}\n`).catch(async (err) => { if (err.code === "EEXIST") throw new ErrorUso(`${o.salida} tiene temporales viejos: bórralos.`); throw err; });
        if (x.informe) await escribirAtomico(join(o.salida, `${x.informe.id}.md`), informeMarkdown(x.informe, x.trabajo));
      }
      log(`  Informes y trabajos en ${o.salida}.`);
    }
    log("  Recuerda: guion determinista SIN MODELO (DEMO). No es IA. Nada queda aprobado: decide una persona con «revisar».");
    return 0;
  },

  async trabajos(o, log) {
    if (!o._[0]) throw new ErrorUso("Uso: trabajos <registro.jsonl> [--demo]");
    const { r } = await leerRegistro(o._[0], mundoDelRegistro(o._[0], o.demo));
    const ult = new Map();
    for (const e of r.entradas) if (e.tipo === "trabajo" && e.valido) ult.set(e.id, e.documento);
    log(`${ult.size} trabajo(s) · registro ${r.ok ? "íntegro" : `con ${r.problemas.length} problema(s)`}.`);
    for (const t of ult.values()) log(`  ${t.id} · ${ETIQUETA_ESTADO[t.estado]}${t.decision_humana ? ` · ${t.decision_humana.decision} por ${t.decision_humana.por.identificador}` : ""} · ${t.titulo}`);
    return r.ok ? 0 : 1;
  },

  async revisar(o, log) {
    exigir(o, "registro", "trabajo", "decision", "por", "motivo");
    const A = { aprobar: "aprobado_por_humano", rechazar: "rechazado", "pedir-evidencia": "requiere_evidencia", revisar: "requiere_revision", reanudar: "pendiente" }[o.decision];
    if (!A) throw new ErrorUso("--decision debe ser aprobar | rechazar | pedir-evidencia | revisar | reanudar.");
    const es_demo = mundoDelRegistro(o.registro, o.demo);
    const { texto, r } = await leerRegistro(o.registro, es_demo);
    if (!r.ok) { log(`✗ El registro tiene ${r.problemas.length} problema(s): no se anexa ninguna decisión.`); return 1; }
    const previo = [...r.entradas].reverse().find((e) => e.tipo === "trabajo" && e.valido && e.id === o.trabajo)?.documento;
    if (!previo) { log(`✗ No hay ningún trabajo válido ${o.trabajo} en el registro.`); return 1; }
    let t;
    try { t = transitar(previo, A, { por: { tipo: "humano", identificador: String(o.por) }, motivo: String(o.motivo), en: ahoraDe(o) }); }
    catch (err) { log(`✗ ${err.message}`); return 1; }
    const n = await nuevaEntrada(r.ultima, { tipo: "trabajo", documento: t, registrado_en: ahoraDe(o), registro_es_demo: es_demo, ids_validos: r.ids_validos });
    if (!n.ok || !n.entrada.valido) { log(`✗ No se anexa: ${(n.errores ?? n.entrada.errores_contrato).join(" ")}`); return 1; }
    await escribirAtomico(o.registro, texto + serializar(n.entrada));
    log(`✓ ${t.id}: ${ETIQUETA_ESTADO[previo.estado]} → ${ETIQUETA_ESTADO[t.estado]} por ${o.por} (identidad declarada, sin autenticar).`);
    if (A === "aprobado_por_humano") log("  Aprobar el informe NO crea lecciones en Nexus ni cambia ningún motor.");
    return 0;
  },

  async "verificar-banco"(o, log) {
    if (!o._[0]) throw new ErrorUso("Uso: verificar-banco <carpeta>");
    const dir = o._[0];
    const { doc: manifiesto } = await leerJSON(join(dir, "manifiesto.json"));
    const leer = (r) => readFile(join(dir, r ?? "-"), "utf8").catch(() => null);
    const c = await comprobarBanco({ manifiesto, textoEvaluacion: await leer(manifiesto?.evaluacion?.archivo), textoClave: await leer(manifiesto?.clave?.archivo) });
    log(c.ok ? `✓ Banco ${manifiesto.banco_id}: evaluación y clave coinciden con el manifiesto; aprobación: ${manifiesto.aprobacion?.estado}.` : `✗ ${c.problemas.join("\n✗ ")}`);
    return c.ok ? 0 : 1;
  },
};

/** Punto de entrada reutilizable por las pruebas: devuelve el código de salida y nunca llama a process.exit. */
export async function principal(args, log = console.log) {
  const [orden, ...resto] = args;
  const f = ORDENES[orden];
  if (!f) { log(`Órdenes: ${Object.keys(ORDENES).join(" · ")}. Ver el encabezado de herramientas/laboratorio.mjs.`); return 2; }
  try { return await f(opciones(resto), log); } catch (err) {
    if (err instanceof ErrorUso) { log(`✗ ${err.message}`); return 2; }
    throw err;
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  process.exitCode = await principal(process.argv.slice(2));
}
