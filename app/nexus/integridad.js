// Integridad del almacén de Nexus (fase 1.5). La cadena de huellas de registro.js detecta borrar, editar o reordenar
// entradas INTERMEDIAS, pero no que alguien quite las últimas (el archivo truncado sigue siendo una cadena válida).
// Aquí se agrega un MANIFIESTO aparte (manifiesto.json) con «sellos»: cuántas entradas tenía cada registro y la huella
// de la última. Comparando el almacén con el último sello se detecta truncamiento, reescritura y entradas sin sellar.
// El manifiesto es a su vez una cadena; su «ancla» (n.º de sellos + 16 caracteres de huella) se copia FUERA del equipo.
//
// MODELO DE AMENAZAS (resumen; detalle en docs/NEXUS-FASE-1-5.md):
//  - Protege contra: errores humanos, copias incompletas, ediciones a mano, restauraciones de una copia vieja, un
//    archivo que se trunca al guardarse, y cambios de una sola parte (registro sin manifiesto o al revés).
//  - NO protege contra: alguien que puede editar TODOS los archivos (registro, manifiesto y respaldos) y recalcular las
//    huellas. Una huella local editable no es una firma. La única defensa ahí es comparar con un ancla guardada fuera
//    (papel, mensaje, otro disco) y, a futuro, firmas con identidad autenticada (CauceService).
// Funciones puras: corren en Node y en el navegador. No escriben en disco.

import { huellaDe, esFechaConZona, esActor } from "./comun.js";
import { REGISTRO, verificarCadena } from "./registro.js";

export const MANIFIESTO = "cauce.nexus.manifiesto";
export const RESPALDO = "cauce.nexus.respaldo";
const TIPOS = ["lecciones", "recomendaciones"];

export const manifiestoVacio = () => ({ contrato: MANIFIESTO, version_contrato: "0.2", sellos: [] });

async function estadoRegistro(doc) {
  const e = Array.isArray(doc?.entradas) ? doc.entradas : [];
  return { n: e.length, cabeza: e.length ? await huellaDe(e.at(-1)) : null };
}

/** Revisa la forma y la cadena del propio manifiesto. */
export async function verificarManifiesto(man) {
  const errores = [];
  if (!man || man.contrato !== MANIFIESTO || !Array.isArray(man.sellos)) return { ok: false, errores: [`El manifiesto debe tener contrato "${MANIFIESTO}" y la lista «sellos».`] };
  let previo = null;
  for (let i = 0; i < man.sellos.length; i++) {
    const s = man.sellos[i];
    if (!esFechaConZona(s?.sellado_en) || !esActor(s?.sellado_por) || !s?.registros) errores.push(`Sello ${i + 1}: necesita sellado_en con zona, sellado_por y registros.`);
    if ((s?.huella_anterior ?? null) !== (previo ? await huellaDe(previo) : null)) errores.push(`Sello ${i + 1}: la huella no coincide con el sello anterior (el manifiesto se editó, reordenó o le quitaron sellos intermedios).`);
    if (previo) for (const t of TIPOS) if ((s?.registros?.[t]?.n ?? 0) < (previo.registros?.[t]?.n ?? 0)) errores.push(`Sello ${i + 1}: el registro de ${t} tiene menos entradas que en el sello anterior: los registros solo crecen.`);
    previo = s;
  }
  return { ok: errores.length === 0, errores };
}

/** Ancla corta para copiar fuera del equipo: «sellos:huella16». */
export async function anclaDe(man) {
  const s = man?.sellos ?? [];
  return s.length ? `${s.length}:${(await huellaDe(s.at(-1))).slice(0, 16)}` : "0:vacio";
}

/** Comprueba que el manifiesto contiene el sello del ancla en la misma posición (detecta que le quitaron sellos finales). */
export async function verificarAncla(man, ancla) {
  const m = /^(\d+):([0-9a-f]{16})$/.exec(String(ancla ?? "").trim());
  if (!m) return { ok: false, motivo: "El ancla debe tener la forma «n:16 caracteres hexadecimales»." };
  const n = Number(m[1]), s = man?.sellos ?? [];
  if (s.length < n) return { ok: false, motivo: `El manifiesto tiene ${s.length} sello(s) y el ancla dice ${n}: le quitaron sellos (truncamiento del manifiesto).` };
  if (!(await huellaDe(s[n - 1])).startsWith(m[2])) return { ok: false, motivo: `El sello ${n} no coincide con el ancla: el manifiesto se reescribió.` };
  return { ok: true, motivo: s.length > n ? `Coincide; hay ${s.length - n} sello(s) posteriores al ancla.` : "Coincide con el último sello." };
}

/**
 * Compara el almacén con el último sello confiable.
 * @returns { estado: "sin_manifiesto"|"integro"|"sin_sellar"|"truncado"|"reescrito"|"manifiesto_alterado"|"registro_alterado",
 *            detalles[], ultimo_sello, ok }  — ok = integro o sin_sellar (este último es un aviso, no una alteración)
 */
export async function verificarContinuidad(docs, man) {
  const detalles = [];
  for (const t of TIPOS) {
    const c = await verificarCadena(docs?.[t]?.entradas ?? []);
    if (!c.ok) detalles.push(...c.errores.map((x) => `Registro de ${t}: ${x}`));
  }
  if (detalles.length) return { estado: "registro_alterado", detalles, ultimo_sello: null, ok: false };
  if (!man) return { estado: "sin_manifiesto", detalles: ["No hay manifiesto: no se puede detectar si faltan entradas al final."], ultimo_sello: null, ok: false };
  const vm = await verificarManifiesto(man);
  if (!vm.ok) return { estado: "manifiesto_alterado", detalles: vm.errores, ultimo_sello: null, ok: false };
  const ultimo = man.sellos.at(-1) ?? null;
  if (!ultimo) return { estado: "sin_sellar", detalles: ["El manifiesto no tiene sellos todavía."], ultimo_sello: null, ok: true };
  let estado = "integro";
  for (const t of TIPOS) {
    const e = docs?.[t]?.entradas ?? [];
    const s = ultimo.registros[t] ?? { n: 0, cabeza: null };
    if (docs?.[t] && docs[t].contrato !== REGISTRO[t]) { detalles.push(`El archivo de ${t} no es un registro de Nexus.`); estado = "reescrito"; continue; }
    if (e.length < s.n) { detalles.push(`Registro de ${t}: tiene ${e.length} entrada(s) y el último sello (${ultimo.sellado_en}) registró ${s.n}: faltan ${s.n - e.length} al final (truncamiento).`); estado = "truncado"; continue; }
    if (s.n > 0 && (await huellaDe(e[s.n - 1])) !== s.cabeza) { detalles.push(`Registro de ${t}: la entrada ${s.n} no es la que se selló: el historial se reescribió.`); if (estado !== "truncado") estado = "reescrito"; continue; }
    if (e.length > s.n) { detalles.push(`Registro de ${t}: ${e.length - s.n} entrada(s) posteriores al último sello (agregadas sin sellar).`); if (estado === "integro") estado = "sin_sellar"; }
  }
  return { estado, detalles, ultimo_sello: ultimo, ok: estado === "integro" || estado === "sin_sellar" };
}

/** Agrega un sello con el estado actual. Se niega si el almacén no continúa al último sello. */
export async function sellar(man, docs, { sellado_en, sellado_por }) {
  const base = man ?? manifiestoVacio();
  const v = await verificarContinuidad(docs, base);
  if (!v.ok && v.estado !== "sin_manifiesto") return { ok: false, doc: base, errores: ["No se sella un almacén que no continúa al último sello:", ...v.detalles] };
  if (!esFechaConZona(sellado_en) || !esActor(sellado_por)) return { ok: false, doc: base, errores: ["Un sello necesita fecha con zona y quién sella."] };
  const previo = base.sellos.at(-1);
  if (previo && Date.parse(sellado_en) < Date.parse(previo.sellado_en)) return { ok: false, doc: base, errores: ["La fecha del sello es anterior al sello previo."] };
  const registros = {};
  for (const t of TIPOS) registros[t] = await estadoRegistro(docs?.[t]);
  const sello = { sellado_en, sellado_por: { tipo: sellado_por.tipo, identificador: sellado_por.identificador, autenticacion: "declarada" }, registros, huella_anterior: previo ? await huellaDe(previo) : null };
  return { ok: true, doc: { ...base, sellos: [...base.sellos, sello] }, errores: [] };
}

/**
 * Relación entre dos versiones de un registro (p. ej. el actual y un respaldo).
 * @returns "igual" | "a_amplia_b" (b es prefijo de a) | "a_truncado" (a es prefijo de b) | "divergen"
 */
export async function relacionRegistros(a, b) {
  const ea = a?.entradas ?? [], eb = b?.entradas ?? [];
  const k = Math.min(ea.length, eb.length);
  for (let i = 0; i < k; i++) if ((await huellaDe(ea[i])) !== (await huellaDe(eb[i]))) return "divergen"; // entrada por entrada: no depende de que la cadena esté sana
  return ea.length === eb.length ? "igual" : ea.length > eb.length ? "a_amplia_b" : "a_truncado";
}

/** Índice de un respaldo: huella SHA-256 de cada archivo tal cual se guardó (texto exacto). */
export async function indiceRespaldo(archivos, { creado_en, creado_por, motivo }, sha) {
  const huellas = {};
  for (const [nombre, contenido] of Object.entries(archivos)) huellas[nombre] = await sha(contenido);
  return { contrato: RESPALDO, version_contrato: "0.2", creado_en, creado_por: { ...creado_por, autenticacion: "declarada" }, motivo, archivos: huellas };
}
