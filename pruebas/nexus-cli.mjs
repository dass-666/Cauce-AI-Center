// Nexus fase 1.5 · prueba de punta a punta de la línea de comandos (solo Node; usa carpetas temporales, nunca datos/nexus/registro).
//   node pruebas/nexus-cli.mjs
// Recorre: vista previa → importar con --confirmar (respaldo + sello) → validar → truncar a mano → detectar →
// sellar encima (se niega) → restaurar (no toca el almacén) → respaldo alterado (se rechaza) → candidatas (no entran).
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const raiz = resolve(new URL("..", import.meta.url).pathname);
const tmp = mkdtempSync(join(tmpdir(), "nexus-cli-"));
const reg = join(tmp, "registro"), resp = join(tmp, "respaldos"), pol = join(tmp, "politica.json");
writeFileSync(pol, readFileSync(join(raiz, "datos/nexus/politica.json")));
const res = [];
const ok = (n, c, x = "") => res.push(`${c ? "OK   " : "FALLA"} ${n}${x && !c ? ` · ${x}` : ""}`);
const cli = (...a) => {
  try { return { codigo: 0, salida: execFileSync("node", [join(raiz, "herramientas/nexus.mjs"), ...a, `--registro=${reg}`, `--respaldos=${resp}`, `--politica=${pol}`, "--ahora=2026-11-06T12:00:00-06:00"], { cwd: raiz, encoding: "utf8", stdio: "pipe" }) }; }
  catch (e) { return { codigo: e.status, salida: `${e.stdout}${e.stderr}` }; }
};

// Lección admisible: la plantilla con una revisión humana de otra persona.
const l = JSON.parse(readFileSync(join(raiz, "contrato/ejemplos/nexus/leccion-plantilla.json"), "utf8"));
l.revisiones.push({ fecha: "2026-11-06T11:00:00-06:00", autor_tipo: "humano", autor: "diego", decision: "revisada", justificacion: "Revisé la prueba citada.", version: "r2" });
const archivo = join(tmp, "leccion.json");
writeFileSync(archivo, JSON.stringify(l));

let r = cli("importar", archivo, "--por=diego");
ok("vista previa: dice que se puede agregar y NO escribe", r.codigo === 0 && /No se escribió nada/.test(r.salida) && !existsSync(join(reg, "lecciones.json")), r.salida);
r = cli("importar", archivo, "--por=diego", "--confirmar");
ok("importar --confirmar: agrega, hace respaldo previo y sella (ancla 1:…)", r.codigo === 0 && /Agregada/.test(r.salida) && /Nueva ancla del manifiesto[^\n]*1:[0-9a-f]{16}/.test(r.salida) && readdirSync(resp).length === 1, r.salida);
const ancla = /1:[0-9a-f]{16}/.exec(r.salida)?.[0];
r = cli("validar");
ok("validar: integridad «integro»", r.codigo === 0 && /Integridad: integro/.test(r.salida) && /Aprobadores declarados: diego/.test(r.salida), r.salida);
r = cli("importar", archivo, "--por=diego", "--confirmar");
ok("importar la misma versión otra vez: se rechaza (las revisiones solo se anexan)", r.codigo !== 0 && /solo se puede anexar/.test(r.salida), r.salida);

// Truncamiento a mano: se quita la última (única) entrada.
const docL = JSON.parse(readFileSync(join(reg, "lecciones.json"), "utf8"));
writeFileSync(join(reg, "lecciones.json"), JSON.stringify({ ...docL, entradas: [] }));
r = cli("validar");
ok("validar tras truncar: «truncado» y código de error", r.codigo !== 0 && /Integridad: truncado/.test(r.salida), r.salida);
r = cli("sellar", "--por=diego");
ok("sellar encima de un almacén truncado: se niega", r.codigo !== 0 && /no continúa al último sello/.test(r.salida), r.salida);
r = cli("importar", archivo, "--por=diego", "--confirmar");
ok("escribir sobre un almacén truncado: se niega", r.codigo !== 0, r.salida);
r = cli("verificar-ancla", ancla);
ok("el ancla anotada coincide con el manifiesto (el manifiesto no se tocó)", r.codigo === 0, r.salida);

// Restauración segura: desde el respaldo creado al confirmar (estado vacío) y desde uno nuevo.
writeFileSync(join(reg, "lecciones.json"), JSON.stringify(docL)); // la persona arregla a mano
r = cli("respaldar", "--por=diego", "--motivo=prueba");
const ultimo = readdirSync(resp).sort().at(-1);
ok("respaldar: crea una carpeta nueva con respaldo.json", r.codigo === 0 && existsSync(join(resp, ultimo, "respaldo.json")), r.salida);
r = cli("verificar-respaldo", join(resp, ultimo));
ok("verificar-respaldo: íntegro", r.codigo === 0 && /Respaldo íntegro/.test(r.salida), r.salida);
writeFileSync(join(reg, "lecciones.json"), JSON.stringify({ ...docL, entradas: [] }));
const antes = readFileSync(join(reg, "lecciones.json"), "utf8");
r = cli("restaurar", join(resp, ultimo));
ok("restaurar: prepara copias aparte, explica que al actual le faltan entradas y NO toca el almacén", r.codigo === 0 && /al actual le faltan entradas/.test(r.salida) && readFileSync(join(reg, "lecciones.json"), "utf8") === antes && existsSync(join(tmp, "restauraciones")), r.salida);
const alterado = join(resp, ultimo, "lecciones.json");
writeFileSync(alterado, readFileSync(alterado, "utf8").replace("Una afirmación", "Otra afirmación"));
r = cli("verificar-respaldo", join(resp, ultimo));
ok("respaldo alterado: se detecta por huella", r.codigo !== 0 && /cambió después del respaldo/.test(r.salida), r.salida);
r = cli("restaurar", join(resp, ultimo));
ok("restaurar desde un respaldo alterado: se niega", r.codigo !== 0, r.salida);

// Candidatas Ek Chuah: vista previa explica por qué no entran.
writeFileSync(join(reg, "lecciones.json"), JSON.stringify(docL));
for (const id of ["EK-L001", "EK-L003", "EK-L007"]) {
  r = cli("importar", join(raiz, `datos/nexus/candidatas/ek-chuah/${id}.json`), "--por=diego", "--confirmar");
  ok(`${id}: no entra al almacén real y dice por qué (R01, R02, procedencia)`, r.codigo !== 0 && /Admisión al almacén real: NO/.test(r.salida) && /R01/.test(r.salida) && /R02/.test(r.salida) && /no verificable/.test(r.salida), r.salida);
}
const final = JSON.parse(readFileSync(join(reg, "lecciones.json"), "utf8"));
ok("el almacén sigue con 1 lección: ninguna candidata se coló", final.entradas.length === 1);

console.log(res.join("\n"));
const fallas = res.filter((x) => x.startsWith("FALLA")).length;
console.log(`\n${res.length - fallas} OK, ${fallas} FALLA (carpeta temporal: ${tmp})`);
process.exit(fallas ? 1 : 0);
