// Laboratorio de IA · fase 1.1 · pruebas SOLO de Node del piloto aislado: empaquetar, comprobar (fallo seguro) y
// puntuar, de punta a punta sobre un banco de PRUEBA (datos/laboratorio/banco-prueba, 2 defectos públicos).
// Nunca usa la clave real ni ningún modelo. Trabaja en una carpeta temporal.
//   node pruebas/piloto-node.mjs

import { mkdtemp, readFile, writeFile, rm, readdir, cp, symlink, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { prueba, igual, verdadero, ejecutar } from "./mini.js";
import { principal as lab } from "../herramientas/laboratorio.mjs";
import { principal as piloto } from "../herramientas/piloto.mjs";
import { sha256 } from "../app/laboratorio/base.js";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const ORIGINAL = join(RAIZ, "datos/csi/casos-publicados/expediente-bns-2015.json");
const ESPEC_PRUEBA = join(RAIZ, "datos/laboratorio/banco-prueba/especificacion-prueba.json");
const AHORA = "2026-11-08T00:00:00Z";
const temporal = () => mkdtemp(join(tmpdir(), "cauce-piloto-"));
async function correr(h, ...args) { const lineas = []; const codigo = await h(args, (t) => lineas.push(String(t))); return { codigo, salida: lineas.join("\n") }; }
const PREGUNTA = "¿Qué inconsistencias, errores o afirmaciones sin respaldo encuentras en este expediente?";

/** Genera el banco de prueba y un paquete DEMO del crítico. */
async function bancoYPaquete(d) {
  const banco = join(d, "banco");
  const rb = await correr(lab, "banco", "--original", ORIGINAL, "--especificacion", ESPEC_PRUEBA, "--salida", banco);
  igual(rb.codigo, 0, rb.salida);
  const paq = join(d, "paquete");
  const rp = await correr(piloto, "empaquetar", "--rol", "critico", "--evaluacion", join(banco, "evaluacion/expediente-evaluacion.json"), "--corrida", "prueba-1", "--pregunta", PREGUNTA,
    "--creado-por", "diego", "--salida", paq, "--corte", "2015-01-15T00:00:00Z", "--banco", "banco-prueba-v1", "--demo", "--ahora", AHORA);
  igual(rp.codigo, 0, rp.salida);
  return { banco, paq, clave: join(banco, "clave/clave-respuestas.json") };
}
const leerJSON = async (r) => JSON.parse(await readFile(r, "utf8"));

prueba("Piloto · empaquetar (crítico): solo 5 archivos, sin clave, sin original, con huellas; comprobar desde disco → 0 problemas", async () => {
  const d = await temporal(); const { paq, banco } = await bancoYPaquete(d);
  igual((await readdir(paq)).sort(), ["INSTRUCCIONES.md", "catalogo-fuentes.json", "expediente-evaluacion.json", "formato-respuesta.json", "paquete.json"]);
  const p = await leerJSON(join(paq, "paquete.json"));
  igual(p.rol, "critico"); igual(p.encargo.rol, "critico"); igual(p.encargo.insumos[0].tipo, "banco_evaluacion");
  igual(p.encargo.insumos[0].sha256, await sha256(await readFile(join(banco, "evaluacion/expediente-evaluacion.json"), "utf8")), "el insumo es el expediente de evaluación exacto");
  igual(await readFile(join(paq, "expediente-evaluacion.json"), "utf8"), await readFile(join(banco, "evaluacion/expediente-evaluacion.json"), "utf8"), "copia byte a byte");
  const todo = (await Promise.all((await readdir(paq)).map((n) => readFile(join(paq, n), "utf8")))).join("\n");
  for (const re of [/linea_base/, /como_se_detectaria/, /clave-respuestas/, /casos-publicados/, /D0[12]/]) verdadero(!re.test(todo), `el paquete contiene ${re}`);
  verdadero(/neutrales a propósito/.test(await readFile(join(paq, "INSTRUCCIONES.md"), "utf8")), "instrucciones neutrales");
  verdadero(!/10 defectos|nueve|9 retos|hay \d+ (errores|defectos)/i.test(await readFile(join(paq, "INSTRUCCIONES.md"), "utf8")), "no dice cuántos defectos hay");
  const rc = await correr(piloto, "comprobar", paq, "--rol", "critico");
  igual(rc.codigo, 0, rc.salida); verdadero(/0 problema/.test(rc.salida) && /no demuestra aislamiento absoluto/.test(rc.salida), rc.salida);
  igual((await correr(piloto, "empaquetar", "--rol", "critico", "--evaluacion", join(banco, "evaluacion/expediente-evaluacion.json"), "--corrida", "prueba-1", "--pregunta", PREGUNTA, "--creado-por", "diego", "--salida", paq, "--demo")).codigo, 2, "no sobrescribe");
  await rm(d, { recursive: true });
});

prueba("Piloto · empaquetar se niega con el expediente ORIGINAL (sin marca) y con una corrida mal nombrada", async () => {
  const d = await temporal();
  const r = await correr(piloto, "empaquetar", "--rol", "critico", "--evaluacion", ORIGINAL, "--corrida", "x", "--pregunta", PREGUNTA, "--creado-por", "diego", "--salida", join(d, "p"), "--demo", "--ahora", AHORA);
  igual(r.codigo, 1, r.salida); verdadero(/parece el original/.test(r.salida) || /corrida_id inválido/.test(r.salida), r.salida);
  verdadero(!(await readdir(d)).includes("p"), "no deja carpeta a medias");
  await rm(d, { recursive: true });
});

prueba("Piloto · comprobar falla de forma segura: clave, original, criterios, registro, enlace simbólico, archivo extra, archivo cambiado, «..», sin manifiesto", async () => {
  const d = await temporal(); const { paq, banco, clave } = await bancoYPaquete(d);
  const casos = [
    ["clave copiada con otro nombre", async (m) => cp(clave, join(m, "notas.json")), /contrato_prohibido/],
    ["manifiesto del banco", async (m) => cp(join(banco, "manifiesto.json"), join(m, "datos.json")), /contrato_prohibido|nombre_prohibido/],
    ["expediente original en lugar del de evaluación", async (m) => cp(ORIGINAL, join(m, "expediente-evaluacion.json")), /expediente_original/],
    ["criterios privados", async (m) => writeFile(join(m, "CRITERIOS-EVALUACION.md"), "# criterios"), /nombre_prohibido/],
    ["registro JSONL", async (m) => writeFile(join(m, "demo-registro.jsonl"), "{}\n"), /nombre_prohibido|archivo_no_permitido/],
    ["enlace simbólico hacia fuera", async (m) => { await rm(join(m, "catalogo-fuentes.json")); await symlink(ORIGINAL, join(m, "catalogo-fuentes.json")); }, /enlace_simbolico/],
    ["archivo extra inocente", async (m) => writeFile(join(m, "notas.txt"), "hola"), /no_declarado/],
    ["instrucciones modificadas con una ruta externa", async (m) => writeFile(join(m, "INSTRUCCIONES.md"), "Mira también C:\\Laboratorio-privado\\banco"), /huella_distinta/],
    ["instrucciones con ../", async (m) => writeFile(join(m, "INSTRUCCIONES.md"), "abre ../clave/respuestas"), /contenido_prohibido/],
    ["referencia al repositorio", async (m) => writeFile(join(m, "INSTRUCCIONES.md"), "consulta datos/csi/casos-publicados"), /contenido_prohibido/],
    ["resultado de otra corrida", async (m) => writeFile(join(m, "verificadas.json"), JSON.stringify({ contrato: "cauce.lab.ejecucion", id: "demo-lab-run-otra", rol: "critico" })), /resultado_de_otra_corrida|archivo_no_permitido/],
    ["sin manifiesto", async (m) => rm(join(m, "paquete.json")), /falta_manifiesto/],
    ["subcarpeta con ..", async (m) => { await mkdir(join(m, "x")); await writeFile(join(m, "x", "..algo.txt"), "x"); }, /archivo_no_permitido/],
  ];
  for (const [nombre, romper, re] of casos) {
    const m = join(d, `malo-${casos.findIndex((c) => c[0] === nombre)}`);
    await cp(paq, m, { recursive: true });
    await romper(m);
    const r = await correr(piloto, "comprobar", m, "--rol", "critico");
    igual(r.codigo, 1, `${nombre}: ${r.salida}`); verdadero(re.test(r.salida), `${nombre}: esperaba ${re} en\n${r.salida}`);
  }
  // Otro rol: el paquete del crítico comprobado como investigador falla (rol distinto + expediente en rol indebido).
  const r = await correr(piloto, "comprobar", paq, "--rol", "investigador");
  igual(r.codigo, 1); verdadero(/rol_distinto/.test(r.salida) && /expediente_en_rol_indebido/.test(r.salida), r.salida);
  await rm(d, { recursive: true });
});

/** Respuesta sintética del crítico con la forma del paquete (sin ningún modelo). */
async function respuestaCritico(paq, objeciones) {
  const p = await leerJSON(join(paq, "paquete.json"));
  return {
    contrato: "cauce.lab.ejecucion", version_contrato: "0.1", id: "demo-lab-run-prueba-1-critico", es_demo: true,
    encargo_id: p.encargo.id, encargo_sha256: p.encargo_sha256, rol: "critico", estado: "terminado",
    inicio: "2026-11-08T01:00:00Z", fin: "2026-11-08T01:20:00Z", latido: "2026-11-08T01:20:00Z",
    autor: { tipo: "ia", identificador: "sintetico-v0", adaptador: "ninguno" },
    afirmaciones: [], hipotesis: [], objeciones, dudas: [], contradicciones: [], consultas_web: [],
    uso: { tokens_entrada: null, tokens_salida: 500, costo_mxn: 0 }, error: null,
  };
}

prueba("Piloto · una respuesta con la forma del paquete cumple el contrato y lab-V la verifica con el encargo del paquete", async () => {
  const d = await temporal(); const { paq } = await bancoYPaquete(d);
  const ej = await respuestaCritico(paq, [{ id: "o1", a: "banco-prueba-v1#e02", tipo: "evidencia", texto: "La cifra no cuadra con la fuente citada." }]);
  await writeFile(join(d, "ej.json"), JSON.stringify(ej));
  const p = await leerJSON(join(paq, "paquete.json")); await writeFile(join(d, "enc.json"), JSON.stringify(p.encargo));
  igual((await correr(lab, "validar", join(d, "ej.json"))).codigo, 0);
  await mkdir(join(d, "copias"));
  const rv = await correr(lab, "verificar", "--encargo", join(d, "enc.json"), "--ejecucion", join(d, "ej.json"), "--copias", join(d, "copias"), "--ahora", "2026-11-08T02:00:00Z");
  igual(rv.codigo, 0, rv.salida); verdadero(/apta_para_revision_humana/.test(rv.salida), rv.salida);
  const mala = await respuestaCritico(paq, [{ id: "o1", a: "otro-banco#e02", tipo: "evidencia", texto: "x" }]);
  await writeFile(join(d, "mala.json"), JSON.stringify(mala));
  const rm2 = await correr(lab, "verificar", "--encargo", join(d, "enc.json"), "--ejecucion", join(d, "mala.json"), "--copias", join(d, "copias"), "--ahora", "2026-11-08T02:00:00Z");
  igual(rm2.codigo, 1); verdadero(/objecion_a_insumo_desconocido/.test(rm2.salida), rm2.salida);
  await rm(d, { recursive: true });
});

prueba("Piloto · puntuar contra la clave de PRUEBA: correcto, parcial, no detectado, falso positivo, control y regla de interacción; nunca sobrescribe", async () => {
  const d = await temporal(); const { paq, clave } = await bancoYPaquete(d);
  const k = await leerJSON(clave);
  igual(k.defectos.map((x) => x.id), ["D01", "D02"]);
  // D01 altera una cifra de e02; D02 quita la condición de refutación de H-D.
  const ej = await respuestaCritico(paq, [
    { id: "o1", a: "banco-prueba-v1#e02", tipo: "evidencia", texto: "e02 dice «1.0820 francos» pero la fuente del BdI indica otra cifra." },
    { id: "o2", a: "banco-prueba-v1#H-D", tipo: "supuesto", texto: "Esta hipótesis no explica cómo se refutaría." },
    { id: "o3", a: "banco-prueba-v1#e05", tipo: "alcance", texto: "No veo problema real aquí pero lo anoto." },
  ]);
  await writeFile(join(d, "ej.json"), JSON.stringify(ej));
  const r = await correr(piloto, "puntuar", "--ejecucion", join(d, "ej.json"), "--clave", clave, "--salida", join(d, "p.json"), "--insumo", "banco-prueba-v1");
  igual(r.codigo, 0, r.salida);
  const p = await leerJSON(join(d, "p.json"));
  igual(p.resultados.map((x) => [x.defecto_id, x.entidad, x.estado]), [["D01", "e02", "correcto"], ["D02", "H-D", "parcial"]]);
  verdadero(/valor alterado «1\.0820»/.test(p.resultados[0].motivo), p.resultados[0].motivo);
  igual(p.resultados[0].evidencia, ej.objeciones[0].texto, "evidencia textual guardada");
  igual(p.falsos_positivos.map((f) => f.entidad), ["e05"]);
  igual(p.resumen, { n_retos: 2, correctos: 1, parciales: 1, incorrectos: 0, no_detectados: 0, puntaje: 0.5, puntaje_con_parciales_a_medias: 0.75, controles: [], falsos_positivos: 1, objeciones_totales: 3 });
  igual((await correr(piloto, "puntuar", "--ejecucion", join(d, "ej.json"), "--clave", clave, "--salida", join(d, "p.json"))).codigo, 2, "no sobrescribe");
  // Criterios explícitos: D02 es control; D01 exige tipo «evidencia» y la palabra «fuente»; interacción D01→D02.
  const criterios = { control: ["D02"], defectos: { D01: { exige_tipo: ["evidencia"], exige_palabras: [["fuente", "documento"]] } }, interacciones: [{ si: "D01", estado_de: "D02", es: "parcial", marcar: "correcto", motivo: "prueba de interacción" }] };
  await writeFile(join(d, "c.json"), JSON.stringify(criterios));
  const r2 = await correr(piloto, "puntuar", "--ejecucion", join(d, "ej.json"), "--clave", clave, "--salida", join(d, "p2.json"), "--criterios", join(d, "c.json"));
  igual(r2.codigo, 0, r2.salida);
  const p2 = await leerJSON(join(d, "p2.json"));
  igual(p2.resumen.n_retos, 1); igual(p2.resumen.correctos, 1); igual(p2.resumen.puntaje, 1);
  igual(p2.resumen.controles, [{ defecto_id: "D02", estado: "correcto" }]); verdadero(p2.resultados[1].por_interaccion === true, "interacción aplicada");
  // Sin ninguna objeción útil: todo no_detectado, puntaje 0.
  const vacia = await respuestaCritico(paq, [{ id: "o1", a: "banco-prueba-v1#e01", tipo: "otra", texto: "nada" }]);
  await writeFile(join(d, "v.json"), JSON.stringify(vacia));
  await correr(piloto, "puntuar", "--ejecucion", join(d, "v.json"), "--clave", clave, "--salida", join(d, "p3.json"));
  const p3 = await leerJSON(join(d, "p3.json")); igual(p3.resumen.puntaje, 0); igual(p3.resumen.no_detectados, 2); igual(p3.resumen.falsos_positivos, 1);
  // Un investigador no se puntúa; una clave que no es clave tampoco.
  const inv = { ...ej, rol: "investigador" }; await writeFile(join(d, "inv.json"), JSON.stringify(inv));
  igual((await correr(piloto, "puntuar", "--ejecucion", join(d, "inv.json"), "--clave", clave, "--salida", join(d, "p4.json"))).codigo, 1);
  igual((await correr(piloto, "puntuar", "--ejecucion", join(d, "ej.json"), "--clave", join(paq, "paquete.json"), "--salida", join(d, "p5.json"))).codigo, 1);
  await rm(d, { recursive: true });
});

prueba("Piloto · aislamiento: piloto.mjs, paquete.js y puntuacion.js sin red, sin procesos hijos, sin escribir en CSI/Nexus; el comprobador no contiene valores de la clave", async () => {
  for (const [f, extra] of [["herramientas/piloto.mjs", []], ["app/laboratorio/paquete.js", [/from ["']node:/, /writeFile/]], ["app/laboratorio/puntuacion.js", [/from ["']node:/, /writeFile/, /import .*csi/]]]) {
    const t = await readFile(join(RAIZ, f), "utf8");
    for (const re of [/\bfetch\s*\(/, /node:(http|https|net|dgram|child_process|worker_threads)/, /\beval\s*\(/, /new Function/, /datos\/(csi|nexus)/, /registrarLeccion|guardarAlmacen|escribirAlmacen|aplicarCambio/, ...extra])
      verdadero(!re.test(t), `${f} contiene ${re}`);
  }
  const comprobador = await readFile(join(RAIZ, "app/laboratorio/paquete.js"), "utf8");
  verdadero(!/\b1\.2[01]\d0\b|\b17\s?%|\bD0[0-9]\b/.test(comprobador), "el comprobador no lleva valores ni ids de defectos del banco");
});

const r = await ejecutar();
for (const p of r.resultados) console.log(`${p.ok ? "OK   " : "FALLA"} ${p.nombre}${p.ok ? "" : "\n      " + p.error}`);
console.log(`\n${r.pasaron} pasaron, ${r.fallaron} fallaron`);
process.exitCode = r.fallaron ? 1 : 0;
