// Laboratorio de IA · fase 1 · pruebas SOLO de Node (disco): escritura atómica, registro solo-anexado y la
// herramienta herramientas/laboratorio.mjs de punta a punta. Trabaja en una carpeta temporal del sistema;
// nunca toca datos/ salvo para leer los ejemplos DEMO y el expediente publicado (que comprueba intactos).
//   node pruebas/laboratorio-node.mjs

import { mkdtemp, readFile, writeFile, rename, rm, readdir, cp, stat, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { prueba, igual, verdadero, ejecutar } from "./mini.js";
import { escribirAtomico, principal, MAX_BYTES_JSON } from "../herramientas/laboratorio.mjs";
import { sha256 } from "../app/laboratorio/base.js";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEMO = join(RAIZ, "datos/laboratorio/demo");
const ORIGINAL = join(RAIZ, "datos/csi/casos-publicados/expediente-bns-2015.json");
const ESPEC_PRUEBA = join(RAIZ, "datos/laboratorio/banco-prueba/especificacion-prueba.json");
const AHORA = ["--ahora", "2030-04-01T12:00:00Z"];

const temporal = () => mkdtemp(join(tmpdir(), "cauce-lab-"));
async function correr(...args) { const lineas = []; const codigo = await principal(args, (t) => lineas.push(String(t))); return { codigo, salida: lineas.join("\n") }; }
const fsFalla = (donde) => ({
  writeFile: async (r, t, o) => { if (donde === "write") { await writeFile(r, t.slice(0, 5), o); throw new Error("disco lleno (simulado)"); } return writeFile(r, t, o); },
  rename: async (a, b) => { if (donde === "rename") throw new Error("renombrar falló (simulado)"); return rename(a, b); },
  rm,
});

prueba("Lab Node · escritura atómica: reemplaza completo y no deja temporales", async () => {
  const d = await temporal(), f = join(d, "r.jsonl");
  await writeFile(f, "viejo\n");
  await escribirAtomico(f, "nuevo\n");
  igual(await readFile(f, "utf8"), "nuevo\n");
  igual(await readdir(d), ["r.jsonl"]);
  await rm(d, { recursive: true });
});

prueba("Lab Node · escritura atómica: si falla escribir o renombrar, el original queda intacto y se borra el temporal", async () => {
  for (const donde of ["write", "rename"]) {
    const d = await temporal(), f = join(d, "r.jsonl");
    await writeFile(f, "línea 1\nlínea 2\n");
    let fallo = null;
    try { await escribirAtomico(f, "línea 1\nlínea 2\nlínea 3\n", fsFalla(donde)); } catch (e) { fallo = e.message; }
    verdadero(fallo, `${donde}: debía propagar el error`);
    igual(await readFile(f, "utf8"), "línea 1\nlínea 2\n", `${donde}: original intacto`);
    igual(await readdir(d), ["r.jsonl"], `${donde}: sin temporales`);
    await rm(d, { recursive: true });
  }
});

prueba("Lab Node · CLI de punta a punta (DEMO): verificar, registrar encargo → ejecución → verificación y comprobar la cadena", async () => {
  const d = await temporal(), reg = join(d, "demo-registro.jsonl"), v = join(d, "verificacion.json");
  const r1 = await correr("verificar", "--encargo", join(DEMO, "encargo.json"), "--ejecucion", join(DEMO, "ejecucion-respaldada.json"), "--copias", join(DEMO, "copias"), ...AHORA, "--salida", v);
  igual(r1.codigo, 0, r1.salida); verdadero(/apta_para_revision_humana/.test(r1.salida) && /pendiente de revisión humana/.test(r1.salida), r1.salida);
  const r1b = await correr("verificar", "--encargo", join(DEMO, "encargo.json"), "--ejecucion", join(DEMO, "ejecucion-respaldada.json"), "--copias", join(DEMO, "copias"), ...AHORA, "--salida", v);
  igual(r1b.codigo, 2, "no sobrescribe una verificación");
  const r2 = await correr("verificar", "--encargo", join(DEMO, "encargo.json"), "--ejecucion", join(DEMO, "ejecucion-con-fallas.json"), "--copias", join(DEMO, "copias"), ...AHORA);
  igual(r2.codigo, 1); verdadero(/fuente_inexistente/.test(r2.salida) && /posterior_al_corte/.test(r2.salida) && /posible_fuera_de_contexto/.test(r2.salida), r2.salida);
  for (const [tipo, doc] of [["encargo", join(DEMO, "encargo.json")], ["ejecucion", join(DEMO, "ejecucion-respaldada.json")], ["verificacion", v]]) {
    const r = await correr("registrar", "--registro", reg, "--tipo", tipo, "--documento", doc, "--demo", ...AHORA);
    igual(r.codigo, 0, r.salida);
  }
  const rv = await correr("verificar-registro", reg, "--demo");
  igual(rv.codigo, 0, rv.salida); verdadero(/3 entrada/.test(rv.salida), rv.salida);
  // Con el registro como índice, la misma ejecución sigue verificándose (sin circularidad).
  const r3 = await correr("verificar", "--encargo", join(DEMO, "encargo.json"), "--ejecucion", join(DEMO, "ejecucion-respaldada.json"), "--copias", join(DEMO, "copias"), "--registro", reg, ...AHORA);
  igual(r3.codigo, 0, r3.salida);
  await rm(d, { recursive: true });
});

prueba("Lab Node · CLI: un registro dañado no se repara ni se anexa; DEMO y REAL no se mezclan por nombre", async () => {
  const d = await temporal(), reg = join(d, "demo-registro.jsonl");
  await correr("registrar", "--registro", reg, "--tipo", "encargo", "--documento", join(DEMO, "encargo.json"), "--demo", ...AHORA);
  const texto = await readFile(reg, "utf8");
  await writeFile(reg, texto.slice(0, -20)); // escritura cortada a medias
  const danado = await readFile(reg, "utf8");
  const rv = await correr("verificar-registro", reg, "--demo");
  igual(rv.codigo, 1); verdadero(/registro_incompleto/.test(rv.salida), rv.salida);
  const ra = await correr("registrar", "--registro", reg, "--tipo", "ejecucion", "--documento", join(DEMO, "ejecucion-respaldada.json"), "--demo", ...AHORA);
  igual(ra.codigo, 1, ra.salida);
  igual(await readFile(reg, "utf8"), danado, "el archivo dañado queda como estaba (para auditoría)");
  const real = join(d, "registro.jsonl");
  igual((await correr("registrar", "--registro", real, "--tipo", "encargo", "--documento", join(DEMO, "encargo.json"), "--demo", ...AHORA)).codigo, 2, "nombre REAL con --demo");
  const rm1 = await correr("registrar", "--registro", real, "--tipo", "encargo", "--documento", join(DEMO, "encargo.json"), ...AHORA);
  igual(rm1.codigo, 1, rm1.salida); verdadero(/mezcla DEMO\/REAL/.test(rm1.salida), rm1.salida);
  verdadero(!(await stat(real).then(() => true, () => false)), "no se creó el registro REAL");
  await rm(d, { recursive: true });
});

prueba("Lab Node · CLI banco: genera evaluación, clave y manifiesto separados; detecta alteraciones; no sobrescribe; original intacto", async () => {
  const d = await temporal(), salida = join(d, "banco");
  const antes = await sha256(await readFile(ORIGINAL, "utf8"));
  const r = await correr("banco", "--original", ORIGINAL, "--especificacion", ESPEC_PRUEBA, "--salida", salida);
  igual(r.codigo, 0, r.salida);
  igual((await readdir(salida)).sort(), ["clave", "evaluacion", "manifiesto.json"]);
  const man = JSON.parse(await readFile(join(salida, "manifiesto.json"), "utf8"));
  igual(man.aprobacion.estado, "pendiente_revision_diego");
  const tEval = await readFile(join(salida, man.evaluacion.archivo), "utf8");
  verdadero(!/como_se_detectaria|linea_base/.test(tEval), "la evaluación no contiene campos de la clave");
  igual((await correr("verificar-banco", salida)).codigo, 0);
  igual((await correr("banco", "--original", ORIGINAL, "--especificacion", ESPEC_PRUEBA, "--salida", salida)).codigo, 2, "no sobrescribe");
  const copia = join(d, "copia"); await cp(salida, copia, { recursive: true });
  const fClave = join(copia, man.clave.archivo);
  await writeFile(fClave, (await readFile(fClave, "utf8")).replace("D01", "D99"));
  const rc = await correr("verificar-banco", copia);
  igual(rc.codigo, 1); verdadero(/clave no coincide/.test(rc.salida), rc.salida);
  igual(await sha256(await readFile(ORIGINAL, "utf8")), antes, "el expediente publicado no cambió");
  await rm(d, { recursive: true });
});

prueba("Lab Node 1.1 · CLI: copias por enlace simbólico, copias duplicadas y archivos enormes se niegan (fallo seguro)", async () => {
  const d = await temporal(), copias = join(d, "copias"), fuera = join(d, "fuera.txt");
  await cp(join(DEMO, "copias"), copias, { recursive: true });
  await writeFile(fuera, await readFile(join(DEMO, "copias/demo-f-a.txt"), "utf8"));
  await rm(join(copias, "demo-f-a.txt"));
  await symlink(fuera, join(copias, "demo-f-a.txt"));
  const r1 = await correr("verificar", "--encargo", join(DEMO, "encargo.json"), "--ejecucion", join(DEMO, "ejecucion-respaldada.json"), "--copias", copias, ...AHORA);
  igual(r1.codigo, 2, r1.salida); verdadero(/enlace simbólico/.test(r1.salida), r1.salida);
  await rm(join(copias, "demo-f-a.txt")); await cp(join(DEMO, "copias/demo-f-a.txt"), join(copias, "demo-f-a.txt"));
  await writeFile(join(copias, "demo-f-a.pdf"), "x"); await writeFile(join(copias, "demo-f-a.html"), "y");
  const r2 = await correr("verificar", "--encargo", join(DEMO, "encargo.json"), "--ejecucion", join(DEMO, "ejecucion-respaldada.json"), "--copias", copias, ...AHORA);
  igual(r2.codigo, 2, r2.salida); verdadero(/2 copias originales/.test(r2.salida), r2.salida);
  const grande = join(d, "grande.json"); await writeFile(grande, `{"contrato":"cauce.lab.encargo","x":"${"a".repeat(MAX_BYTES_JSON + 10)}"}`);
  const r3 = await correr("validar", grande);
  igual(r3.codigo, 2, r3.salida); verdadero(/límite para documentos JSON/.test(r3.salida), r3.salida);
  await rm(d, { recursive: true });
});

prueba("Lab Node 1.1 · CLI registrar: un id válido ya registrado no se anexa otra vez; una hora anterior a la última entrada tampoco", async () => {
  const d = await temporal(), reg = join(d, "demo-registro.jsonl");
  igual((await correr("registrar", "--registro", reg, "--tipo", "encargo", "--documento", join(DEMO, "encargo.json"), "--demo", ...AHORA)).codigo, 0);
  const dup = await correr("registrar", "--registro", reg, "--tipo", "encargo", "--documento", join(DEMO, "encargo.json"), "--demo", "--ahora", "2030-04-01T12:30:00Z");
  igual(dup.codigo, 1, dup.salida); verdadero(/id duplicado/.test(dup.salida), dup.salida);
  const atras = await correr("registrar", "--registro", reg, "--tipo", "ejecucion", "--documento", join(DEMO, "ejecucion-respaldada.json"), "--demo", "--ahora", "2030-04-01T11:00:00Z");
  igual(atras.codigo, 1, atras.salida); verdadero(/orden temporal/.test(atras.salida), atras.salida);
  igual((await readFile(reg, "utf8")).trimEnd().split("\n").length, 1, "sigue con una sola entrada");
  igual((await correr("verificar-registro", reg, "--demo")).codigo, 0);
  await rm(d, { recursive: true });
});

prueba("Lab Node · aislamiento de la herramienta: sin red, sin procesos hijos, sin escribir en CSI/Nexus", async () => {
  const t = await readFile(join(RAIZ, "herramientas/laboratorio.mjs"), "utf8");
  for (const re of [/\bfetch\s*\(/, /node:(http|https|net|dgram|child_process|worker_threads)/, /\beval\s*\(/, /new Function/, /app\/(csi|nexus)\//, /datos\/(csi|nexus)/])
    verdadero(!re.test(t), `herramientas/laboratorio.mjs contiene ${re}`);
});

prueba("Lab 2 Node · flujo-demo, trabajos y revisar: registro DEMO encadenado, decisión humana con motivo y sin repetir", async () => {
  const d = await temporal(), reg = join(d, "demo-reg.jsonl"), sal = join(d, "salida");
  const a = await correr("flujo-demo", "--registro", reg, "--salida", sal);
  igual(a.codigo, 0, a.salida); verdadero(/NO es IA|No es IA/.test(a.salida), a.salida);
  igual((await readdir(sal)).filter((f) => f.endsWith(".md")).length, 4);
  const lineas = (await readFile(reg, "utf8")).trimEnd().split("\n").length;
  verdadero(/no se repite/.test((await correr("flujo-demo", "--registro", reg)).salida));
  igual((await readFile(reg, "utf8")).trimEnd().split("\n").length, lineas, "la segunda corrida no duplica");
  verdadero((await correr("flujo-demo", "--registro", join(d, "real.jsonl"))).codigo !== 0, "flujo-demo nunca escribe en un registro REAL");
  const corto = await correr("revisar", "--registro", reg, "--trabajo", "demo-lab-trb-compago-001", "--decision", "aprobar", "--por", "diego", "--motivo", "ok", "--demo", "--ahora", "2030-01-01T00:00:00Z");
  igual(corto.codigo, 1, corto.salida);
  const sinEv = await correr("revisar", "--registro", reg, "--trabajo", "demo-lab-trb-prueba-lab-v", "--decision", "aprobar", "--por", "diego", "--motivo", "Quiero aprobar igual.", "--demo", "--ahora", "2030-01-01T00:00:00Z");
  igual(sinEv.codigo, 1, sinEv.salida);
  const bien = await correr("revisar", "--registro", reg, "--trabajo", "demo-lab-trb-compago-001", "--decision", "aprobar", "--por", "diego", "--motivo", "Revisé citas y objeciones.", "--demo", "--ahora", "2030-01-01T00:00:00Z");
  igual(bien.codigo, 0, bien.salida); verdadero(/NO crea lecciones/.test(bien.salida));
  const lista = await correr("trabajos", reg, "--demo");
  verdadero(/Aprobado por una persona · aprobado por diego/.test(lista.salida) && /registro íntegro/.test(lista.salida), lista.salida);
  igual((await correr("verificar-registro", reg, "--demo")).codigo, 0);
  await rm(d, { recursive: true });
});

const r = await ejecutar();
for (const p of r.resultados) console.log(`${p.ok ? "OK   " : "FALLA"} ${p.nombre}${p.ok ? "" : "\n      " + p.error}`);
console.log(`\n${r.pasaron} pasaron, ${r.fallaron} fallaron`);
process.exitCode = r.fallaron ? 1 : 0;
