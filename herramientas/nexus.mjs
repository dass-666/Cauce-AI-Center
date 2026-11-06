// Nexus · línea de comandos (Node 18+). Solo lee y escribe el almacén de Nexus (por omisión datos/nexus/registro/,
// fuera de git; los datos de prueba están en datos/nexus/demo/). No se conecta a nada, no usa IA, no toca proyectos.
// Toda identidad es DECLARADA (--por=alias): no hay autenticación (ver app/nexus/identidad.js).
//
// Consultar
//   validar                               cadena de huellas, manifiesto (truncamientos), política y reglas
//   lecciones [--proyecto=id]             lecciones vigentes con su dictamen
//   revisar <id>                          las 10 reglas nexus-R 0.2 de una lección
//   historial <id>                        versiones registradas de una lección
//   revision-esceptica <archivo>          imprime la revision_esceptica calculada para pegarla en una recomendación
// Importar (manual, con vista previa)
//   importar <archivo> --por=alias        VISTA PREVIA: contrato, gerente y si entra al almacén real. No escribe.
//   importar <archivo> --por=alias --confirmar        la agrega (respaldo antes, sello después)
//   agregar-recomendacion <archivo> --por=alias [--confirmar]   igual, para una versión de recomendación
// Integridad
//   sellar --por=alias                    agrega un sello al manifiesto con el estado actual
//   ancla                                 imprime el ancla del manifiesto para guardarla FUERA del equipo
//   verificar-ancla <ancla>               comprueba que el manifiesto no perdió sellos desde esa ancla
//   respaldar --por=alias [--motivo=…]    copia verificable en datos/nexus/respaldos/<fecha>/
//   verificar-respaldo <carpeta>          revisa huellas, cadenas y manifiesto de un respaldo
//   restaurar <carpeta>                   prepara una restauración en datos/nexus/restauraciones/<fecha>/ (NO toca el almacén)
// Opciones: --registro=carpeta  --manifiesto=archivo  --respaldos=carpeta  --politica=archivo
//           --ahora=2026-11-06T12:00:00-06:00  --por-tipo=humano|codigo|ia (por omisión humano)
import { readFile, writeFile, rename, mkdir, readdir } from "node:fs/promises";
import { join, resolve, basename } from "node:path";
import { leerNexus, agregarLeccion, agregarRecomendacion, resumirNexus, registroVacio, admisionReal, contextoGerente } from "../app/nexus/registro.js";
import { evaluarLeccion } from "../app/nexus/gerente.js";
import { revisionEsceptica } from "../app/nexus/recomendacion.js";
import { validarLeccion } from "../app/nexus/leccion.js";
import { esFechaConZona, sha256 } from "../app/nexus/comun.js";
import { verificarContinuidad, sellar, anclaDe, verificarAncla, relacionRegistros, indiceRespaldo, verificarManifiesto, RESPALDO } from "../app/nexus/integridad.js";
import { validarPolitica } from "../app/nexus/identidad.js";

const args = process.argv.slice(2);
const opcion = (n) => args.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? null;
const bandera = (n) => args.includes(`--${n}`);
const [orden, objetivo] = args.filter((a) => !a.startsWith("--"));
const dir = resolve(opcion("registro") ?? "datos/nexus/registro");
const esDemo = basename(dir) === "demo";
const rutaManifiesto = resolve(opcion("manifiesto") ?? join(dir, "manifiesto.json"));
const dirRespaldos = resolve(opcion("respaldos") ?? join(dir, "..", esDemo ? "respaldos-demo" : "respaldos"));
const rutaPolitica = resolve(opcion("politica") ?? join(dir, "..", "politica.json"));
const ahoraTxt = opcion("ahora");
function salir(t, codigo = 1) { console.error(t); process.exit(codigo); }
if (ahoraTxt && !esFechaConZona(ahoraTxt)) salir(`--ahora necesita fecha con zona horaria, no «${ahoraTxt}».`);
const ahora = ahoraTxt ? Date.parse(ahoraTxt) : Date.now();
const rutas = { lecciones: join(dir, "lecciones.json"), recomendaciones: join(dir, "recomendaciones.json") };
const sello = () => new Date(ahora).toISOString().replace(/[:.]/g, "-");

async function leerTexto(ruta) { try { return await readFile(ruta, "utf8"); } catch (e) { if (e.code === "ENOENT") return null; throw e; } }
async function leerJSON(ruta, siFalta = null) {
  const t = await leerTexto(ruta);
  if (t === null) return siFalta;
  try { return JSON.parse(t); } catch (e) { salir(`${ruta}: no es JSON válido (${e.message}).`); }
}
/** Reemplazo atómico: nunca queda un archivo a medias. */
async function guardar(ruta, doc) { await writeFile(`${ruta}.tmp`, `${JSON.stringify(doc, null, 2)}\n`, "utf8"); await rename(`${ruta}.tmp`, ruta); }
const icono = { cumple: "✓", no_cumple: "✗", no_evaluado: "?" };
const docs = { lecciones: await leerJSON(rutas.lecciones, registroVacio("lecciones", { es_demo: esDemo })), recomendaciones: await leerJSON(rutas.recomendaciones, registroVacio("recomendaciones", { es_demo: esDemo })) };
const manifiesto = await leerJSON(rutaManifiesto, null);
const politica = await leerJSON(rutaPolitica, null);
const nx = await leerNexus({ ...docs, politica });
const actor = () => {
  const por = opcion("por");
  if (!por) salir("Falta --por=alias (quién registra; no un correo). La identidad queda como DECLARADA.");
  return { tipo: opcion("por-tipo") ?? "humano", identificador: por };
};
const sobre = (registro) => ({ registro, registrado_en: new Date(ahora).toISOString(), registrado_por: actor() });
const lineaReglas = (ev) => ev.reglas.map((r) => `  ${icono[r.estado]} ${r.id} ${r.nombre}: ${r.estado}${r.aplica ? "" : " (no aplica)"} · ${r.motivo}`).join("\n");

/** Respaldo verificable de lo que hay ahora (archivos tal cual). Nunca sobrescribe un respaldo existente. */
async function respaldar(motivo) {
  await mkdir(dirRespaldos, { recursive: true });
  let destino = join(dirRespaldos, sello());
  for (let i = 2; ; i++) { // nunca se sobrescribe un respaldo: si el nombre existe, se usa otro
    try { await mkdir(destino); break; } catch (e) { if (e.code !== "EEXIST" || i > 999) throw e; destino = join(dirRespaldos, `${sello()}-${i}`); }
  }
  const archivos = {};
  for (const [nombre, ruta] of [["lecciones.json", rutas.lecciones], ["recomendaciones.json", rutas.recomendaciones], ["manifiesto.json", rutaManifiesto]]) {
    const t = await leerTexto(ruta);
    if (t !== null) { archivos[nombre] = t; await writeFile(join(destino, nombre), t, "utf8"); }
  }
  const indice = await indiceRespaldo(archivos, { creado_en: new Date(ahora).toISOString(), creado_por: actor(), motivo }, sha256);
  await writeFile(join(destino, "respaldo.json"), `${JSON.stringify(indice, null, 2)}\n`, "utf8");
  return destino;
}

/** Revisa un respaldo: huellas de archivos, cadenas y continuidad con su manifiesto. */
async function revisarRespaldo(carpeta) {
  const errores = [];
  const indice = await leerJSON(join(carpeta, "respaldo.json"), null);
  if (!indice || indice.contrato !== RESPALDO) return { ok: false, errores: ["Falta respaldo.json o no es un respaldo de Nexus."], docs: null, man: null };
  for (const [nombre, h] of Object.entries(indice.archivos ?? {})) {
    const t = await leerTexto(join(carpeta, nombre));
    if (t === null) errores.push(`Falta ${nombre}.`);
    else if ((await sha256(t)) !== h) errores.push(`${nombre} cambió después del respaldo (huella distinta).`);
  }
  const d = { lecciones: await leerJSON(join(carpeta, "lecciones.json"), registroVacio("lecciones")), recomendaciones: await leerJSON(join(carpeta, "recomendaciones.json"), registroVacio("recomendaciones")) };
  const man = await leerJSON(join(carpeta, "manifiesto.json"), null);
  const v = await verificarContinuidad(d, man);
  if (!v.ok && v.estado !== "sin_manifiesto") errores.push(...v.detalles);
  return { ok: errores.length === 0, errores, docs: d, man, indice, continuidad: v };
}

/** Escribir el almacén: comprobar que solo crece, respaldar antes, guardar, sellar después. */
async function escribirConSello(tipo, docNuevo, motivo) {
  const rel = await relacionRegistros(docNuevo, docs[tipo]);
  if (rel !== "a_amplia_b") salir(`Protección: el registro nuevo no es una ampliación del actual (${rel}). No se escribe nada.`);
  const c = await verificarContinuidad(docs, manifiesto);
  if (!c.ok && c.estado !== "sin_manifiesto") salir(`El almacén no continúa al último sello; no se escribe nada:\n- ${c.detalles.join("\n- ")}\nRevisa con «validar» y, si hace falta, «restaurar».`);
  await mkdir(dir, { recursive: true });
  const r = await respaldar(`antes de ${motivo}`);
  await guardar(rutas[tipo], docNuevo);
  const s = await sellar(manifiesto, { ...docs, [tipo]: docNuevo }, { sellado_en: new Date(ahora).toISOString(), sellado_por: actor() });
  if (!s.ok) salir(`Se guardó, pero no se pudo sellar: ${s.errores.join(" ")}`);
  await guardar(rutaManifiesto, s.doc);
  console.log(`Respaldo previo: ${r}\nNueva ancla del manifiesto (guárdala fuera del equipo): ${await anclaDe(s.doc)}`);
}

switch (orden) {
  case "validar": {
    const r = resumirNexus(nx, { ahora });
    for (const e of nx.errores) console.log(`ERROR ${e}`);
    const c = await verificarContinuidad(docs, manifiesto);
    console.log(`Integridad: ${c.estado}${c.detalles.length ? `\n  - ${c.detalles.join("\n  - ")}` : ""}`);
    if (!esDemo) { const ep = politica ? validarPolitica(politica) : ["no existe"]; console.log(ep.length ? `Política de aprobadores: NO válida (${ep.join(" ")})` : `Aprobadores declarados: ${politica.aprobadores_declarados.join(", ")} (identidad declarada, sin autenticar)`); }
    console.log(`${r.cifras.lecciones} lecciones: ${r.cifras.sin_objeciones} sin objeciones, ${r.cifras.incompletas} incompletas, ${r.cifras.con_objeciones} con objeciones.`);
    console.log(`${r.recomendaciones.length} recomendaciones: ${r.cifras.pendientes} esperan decisión humana, ${r.cifras.aprobadas_sin_ejecutar} aprobadas sin ejecutar, ${r.cifras.adoptadas} adoptadas.`);
    if (r.es_demo) console.log("Registro de PRUEBA.");
    process.exit(nx.errores.length || !(c.ok || c.estado === "sin_manifiesto") ? 1 : 0);
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
    const ctx = contextoGerente(nx, ahora);
    const ev = evaluarLeccion(l, { ...ctx, revisionDesde: ctx.revisionesDesde.get(l.id) ?? 0 });
    console.log(`${l.id} · ${ev.version_reglas} · dictamen: ${ev.dictamen.estado} (el gerente no aprueba; decide una persona)\n${lineaReglas(ev)}`);
    break;
  }
  case "historial": {
    const h = nx.historial.get(objetivo);
    if (!h) salir(`No existe la lección ${objetivo}.`);
    h.forEach((e, i) => console.log(`versión ${i + 1} · registrada ${e.registrado_en} por ${e.registrado_por.tipo}:${e.registrado_por.identificador} (declarada) · revisiones: ${e.registro.revisiones.map((r) => r.version).join(", ")}`));
    break;
  }
  case "importar":
  case "agregar-leccion": {
    if (!objetivo) salir("Falta el archivo JSON de la lección.");
    if (nx.errores.length) salir(`El registro tiene errores; corrígelos antes de importar:\n${nx.errores.join("\n")}`);
    let nueva;
    try { nueva = JSON.parse(await readFile(objetivo, "utf8")); } catch (e) { salir(`${objetivo}: no se pudo leer como JSON (${e.message}).`); }
    console.log(`VISTA PREVIA de ${nueva?.id ?? "(sin id)"} → almacén ${esDemo ? "de PRUEBA" : "REAL"} (${dir})`);
    const forma = validarLeccion(nueva).errores;
    console.log(forma.length ? `Contrato cauce.leccion 0.2: RECHAZA (${forma.length})\n  - ${forma.join("\n  - ")}` : "Contrato cauce.leccion 0.2: cumple.");
    if (!forma.length) {
      const ev = evaluarLeccion(nueva, { ...contextoGerente(nx, ahora), lecciones: new Map([...nx.ultimas, [nueva.id, nueva]]) });
      console.log(`Gerente ${ev.version_reglas}: ${ev.dictamen.estado} (registrar no es validar)\n${lineaReglas(ev)}`);
    }
    if (!esDemo && !nx.ultimas.has(nueva?.id)) {
      const a = admisionReal(nueva, { ahora, lecciones: nx.ultimas, registrado_por: actor() });
      console.log(a.admisible ? "Admisión al almacén real: SÍ." : `Admisión al almacén real: NO (se queda como candidata fuera del almacén)\n  - ${a.motivos.join("\n  - ")}`);
      if (!a.admisible) salir("Resultado: no se agrega nada.");
    }
    const r = await agregarLeccion(docs.lecciones, sobre(nueva));
    if (!r.ok) salir(`Resultado: no se puede agregar.\n- ${r.errores.join("\n- ")}`);
    if (!bandera("confirmar")) { console.log("Resultado: se puede agregar. No se escribió nada: repite con --confirmar para registrarla."); break; }
    await escribirConSello("lecciones", r.doc, `importar ${nueva.id}`);
    console.log(`Agregada ${nueva.id}. El historial anterior no cambió.`);
    break;
  }
  case "agregar-recomendacion": {
    if (!objetivo) salir("Falta el archivo JSON.");
    if (nx.errores.length) salir(`El registro tiene errores; corrígelos antes de agregar:\n${nx.errores.join("\n")}`);
    const nueva = JSON.parse(await readFile(objetivo, "utf8"));
    const r = await agregarRecomendacion(docs.recomendaciones, sobre(nueva), docs.lecciones, { politica });
    if (!r.ok) salir(`No se puede agregar:\n- ${r.errores.join("\n- ")}`);
    if (!bandera("confirmar")) { console.log(`VISTA PREVIA: ${nueva.id} → estado «${nueva.estado}». Se puede agregar; repite con --confirmar. Aprobar no ejecuta nada.`); break; }
    await escribirConSello("recomendaciones", r.doc, `registrar ${nueva.id}`);
    console.log(`Agregado ${nueva.id} (identidad declarada: ${actor().identificador}). El historial anterior no cambió.`);
    break;
  }
  case "revision-esceptica": {
    if (!objetivo) salir("Falta el archivo JSON de la recomendación.");
    console.log(JSON.stringify(revisionEsceptica(JSON.parse(await readFile(objetivo, "utf8")), contextoGerente(nx, ahora)), null, 2));
    break;
  }
  case "sellar": {
    const s = await sellar(manifiesto, docs, { sellado_en: new Date(ahora).toISOString(), sellado_por: actor() });
    if (!s.ok) salir(s.errores.join("\n"));
    await mkdir(dir, { recursive: true });
    await guardar(rutaManifiesto, s.doc);
    console.log(`Sellado. Ancla (guárdala fuera del equipo): ${await anclaDe(s.doc)}`);
    break;
  }
  case "ancla": {
    if (!manifiesto) salir("No hay manifiesto todavía (usa «sellar»).");
    const v = await verificarManifiesto(manifiesto);
    if (!v.ok) salir(`El manifiesto está alterado:\n- ${v.errores.join("\n- ")}`);
    console.log(await anclaDe(manifiesto));
    break;
  }
  case "verificar-ancla": {
    const v = await verificarAncla(manifiesto, objetivo);
    console.log(`${v.ok ? "OK" : "ALTERADO"} · ${v.motivo}`);
    process.exit(v.ok ? 0 : 1);
  }
  case "respaldar": {
    console.log(`Respaldo creado: ${await respaldar(opcion("motivo") ?? "manual")}`);
    break;
  }
  case "verificar-respaldo": {
    if (!objetivo) salir("Falta la carpeta del respaldo.");
    const v = await revisarRespaldo(resolve(objetivo));
    console.log(v.ok ? `Respaldo íntegro (${v.indice.creado_en}, por ${v.indice.creado_por.identificador}, declarada).` : `Respaldo con problemas:\n- ${v.errores.join("\n- ")}`);
    process.exit(v.ok ? 0 : 1);
  }
  case "restaurar": {
    if (!objetivo) salir("Falta la carpeta del respaldo.");
    const v = await revisarRespaldo(resolve(objetivo));
    if (!v.ok) salir(`No se restaura un respaldo con problemas:\n- ${v.errores.join("\n- ")}`);
    const informe = [`Restauración preparada desde ${resolve(objetivo)} (${v.indice.creado_en}).`, "El almacén actual NO se tocó."];
    for (const t of ["lecciones", "recomendaciones"]) {
      const rel = await relacionRegistros(docs[t], v.docs[t]);
      informe.push(`${t}: actual ${docs[t].entradas.length} entrada(s), respaldo ${v.docs[t].entradas.length} → ${{ igual: "iguales", a_amplia_b: "el actual es MÁS NUEVO que el respaldo (restaurar perdería entradas)", a_truncado: "al actual le faltan entradas que el respaldo sí tiene", divergen: "DIVERGEN: historiales distintos, revisar a mano" }[rel]}`);
    }
    const base = resolve(dir, "..", "restauraciones");
    await mkdir(base, { recursive: true });
    let destino = join(base, sello());
    for (let i = 2; ; i++) { try { await mkdir(destino); break; } catch (e) { if (e.code !== "EEXIST" || i > 999) throw e; destino = join(base, `${sello()}-${i}`); } }
    for (const n of ["lecciones.json", "recomendaciones.json", "manifiesto.json"]) { const t = await leerTexto(join(resolve(objetivo), n)); if (t !== null) await writeFile(join(destino, n), t, "utf8"); }
    informe.push(`Copias en ${destino}.`, `Para usarlas: cierra Cauce, haz «respaldar», mueve tú mismo los archivos de esa carpeta a ${dir} y corre «validar».`);
    await writeFile(join(destino, "INFORME.txt"), `${informe.join("\n")}\n`, "utf8");
    console.log(informe.join("\n"));
    break;
  }
  case "respaldos": {
    try { for (const d of (await readdir(dirRespaldos)).sort()) console.log(d); } catch { console.log("No hay respaldos."); }
    break;
  }
  default:
    salir("Uso: node herramientas/nexus.mjs validar | lecciones | revisar <id> | historial <id> | importar <archivo> --por=alias [--confirmar] | agregar-recomendacion <archivo> --por=alias [--confirmar] | revision-esceptica <archivo> | sellar --por=alias | ancla | verificar-ancla <ancla> | respaldar --por=alias | respaldos | verificar-respaldo <carpeta> | restaurar <carpeta>", orden ? 1 : 0);
}
