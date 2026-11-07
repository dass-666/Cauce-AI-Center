// Laboratorio de IA · fase 1.1 · puntuación de una corrida del CRÍTICO contra la clave del banco (`lab-puntuacion 0.1`).
//
// Se ejecuta DESPUÉS de la corrida y en un entorno separado de la IA evaluada: es el único código que lee la clave.
// Código puro: recibe la ejecución, la clave y (opcionalmente) unos criterios explícitos; no escribe ni usa red.
//
// Qué hace, defecto por defecto:
//   · localiza la entidad afectada (id de enunciado, hipótesis, observación…) a partir de `ubicacion` de la clave;
//   · busca las objeciones de la IA que apuntan a esa entidad (`a = <insumo>#<entidad>`);
//   · decide correcto | parcial | incorrecto | no_detectado con los criterios: por defecto, «correcto» exige que la
//     objeción muestre el texto alterado (algún fragmento del valor «después» o «antes» de la clave) o cumpla las
//     palabras/tipos exigidos por un criterio explícito; «parcial» = señala la entidad sin mostrar el defecto;
//   · guarda la evidencia textual de cada hallazgo y el id de entidad afectado;
//   · los defectos de control (p. ej. uno que ya detectan las reglas actuales) se puntúan APARTE, no en el puntaje;
//   · las objeciones que no corresponden a ningún defecto son falsos positivos, listados por separado;
//   · reglas de interacción explícitas (criterios.interacciones) permiten marcar un defecto como parcial o correcto
//     en función de otro (p. ej. un cálculo que es coherente con un dato alterado).
// La puntuación es determinista y conserva todo lo que decide y por qué. Nada aquí "aprueba" a una IA.

import { esObj, L, texto, normalizarEspacios } from "./base.js";

export const VERSION_PUNTUACION = "lab-puntuacion 0.1";
export const ESTADOS = ["correcto", "parcial", "incorrecto", "no_detectado"];

/** Entidad de `ubicacion` de la clave: «pasos[3] agregar_enunciado e01 (texto)» → «e01»; una observación «H-A#2» → «H-A». */
export function entidadDeUbicacion(u) {
  const m = /^\S+\s+\S+\s+(\S+)\s+\(/.exec(String(u ?? ""));
  return m ? m[1].split("#")[0] : null;
}
const norm = (t) => normalizarEspacios(String(t ?? "")).toLowerCase();
/** Fragmentos reconocibles de un valor de la clave (textos de ≥ 12 caracteres o cifras/fechas). */
function fragmentos(v) {
  const r = [];
  const visitar = (x) => {
    if (typeof x === "string") {
      const s = norm(x);
      if (s.length >= 12) r.push(s);
      for (const m of s.matchAll(/\d[\d.,%-]*\d|\d/g)) if (m[0].length >= 3) r.push(m[0]);
    } else if (Array.isArray(x)) x.forEach(visitar);
    else if (esObj(x)) Object.values(x).forEach(visitar);
    else if (typeof x === "number") r.push(String(x));
  };
  visitar(v);
  return [...new Set(r)];
}
/** Una objeción «muestra» el defecto si contiene un fragmento del valor después (lo alterado) o del valor antes (lo correcto). */
function muestraElDefecto(textoObj, defecto) {
  const t = norm(textoObj);
  const despues = fragmentos(defecto.despues), antes = fragmentos(defecto.antes);
  const hit = (lista) => lista.find((f) => (f.length >= 12 ? t.includes(f) : new RegExp(`(^|[^\\d])${f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\d]|$)`).test(t)));
  const d = hit(despues), a = hit(antes);
  return d || a ? { ok: true, por: d ? `valor alterado «${d}»` : `valor original «${a}»` } : { ok: false, por: null };
}
function cumpleCriterio(obj, cr) {
  const motivos = [];
  if (L(cr?.exige_tipo).length && !cr.exige_tipo.includes(obj.tipo)) motivos.push(`tipo «${obj.tipo}» no está en ${cr.exige_tipo.join("|")}`);
  const t = norm(obj.texto);
  for (const grupo of L(cr?.exige_palabras)) {
    const alternativas = Array.isArray(grupo) ? grupo : [grupo];
    if (!alternativas.some((p) => t.includes(norm(p)))) motivos.push(`falta alguna de: ${alternativas.join(" / ")}`);
  }
  return { ok: motivos.length === 0, motivos };
}

/**
 * @param {object} p
 * @param p.ejecucion  cauce.lab.ejecucion del crítico (ya verificada por lab-V; aquí no se repite esa verificación)
 * @param p.clave      cauce.lab.banco-clave 0.1
 * @param p.criterios  opcional: { control:["D06"], defectos:{D04:{exige_tipo, exige_palabras, entidad}}, interacciones:[{si:"D01", estado_de:"D09", es:"no_detectado", marcar:"parcial", motivo}] }
 * @param p.insumo     ref del banco en el encargo (p. ej. "banco-bns-2015-v1"); si se omite, se acepta cualquier prefijo
 */
export function puntuar({ ejecucion, clave, criterios = {}, insumo = null }) {
  const errores = [];
  if (!esObj(ejecucion) || ejecucion.contrato !== "cauce.lab.ejecucion") errores.push("ejecucion debe ser un documento cauce.lab.ejecucion.");
  if (!esObj(clave) || clave.contrato !== "cauce.lab.banco-clave" || !L(clave.defectos).length) errores.push("clave debe ser un documento cauce.lab.banco-clave con defectos.");
  if (ejecucion?.rol && ejecucion.rol !== "critico") errores.push(`solo se puntúa al crítico (la ejecución es de «${ejecucion.rol}»).`);
  if (errores.length) return { ok: false, errores };

  const control = new Set(L(criterios.control));
  const objeciones = L(ejecucion.objeciones).map((o, i) => {
    const m = /^(?:([^#]+)#)?(.+)$/.exec(String(o?.a ?? ""));
    return { indice: i, id: o?.id ?? null, tipo: o?.tipo ?? null, texto: o?.texto ?? "", insumo: m?.[1] ?? null, entidad: m ? m[2].split("#")[0] : null, usada: false };
  }).filter((o) => o.entidad && (!insumo || !o.insumo || o.insumo === insumo));

  const resultados = [];
  for (const d of clave.defectos) {
    const cr = criterios.defectos?.[d.id] ?? {};
    const entidad = cr.entidad ?? entidadDeUbicacion(d.ubicacion);
    const propias = objeciones.filter((o) => o.entidad === entidad);
    let estado = "no_detectado", motivo = "ninguna objeción apunta a la entidad", evidencia = null, objecion_id = null;
    for (const o of propias) {
      o.usada = true;
      const c = cumpleCriterio(o, cr), m = muestraElDefecto(o.texto, d);
      const exigeExplicito = L(cr.exige_tipo).length || L(cr.exige_palabras).length;
      let e, por;
      if (exigeExplicito) { e = c.ok ? "correcto" : "parcial"; por = c.ok ? `cumple el criterio explícito${m.ok ? ` y muestra el ${m.por}` : ""}` : `señala la entidad pero ${c.motivos.join("; ")}`; }
      else { e = m.ok ? "correcto" : "parcial"; por = m.ok ? `muestra el ${m.por}` : "señala la entidad sin mostrar el valor alterado ni el original"; }
      if (ESTADOS.indexOf(e) < ESTADOS.indexOf(estado)) { estado = e; motivo = por; evidencia = o.texto; objecion_id = o.id; }
    }
    resultados.push({ defecto_id: d.id, categoria: d.categoria ?? null, entidad, control: control.has(d.id), estado, motivo, objecion_id, evidencia, n_objeciones_a_la_entidad: propias.length });
  }
  for (const it of L(criterios.interacciones)) {
    const si = resultados.find((r) => r.defecto_id === it.si), de = resultados.find((r) => r.defecto_id === it.estado_de);
    if (si && de && si.estado === "correcto" && de.estado === it.es && ESTADOS.includes(it.marcar)) { de.estado = it.marcar; de.motivo = `interacción con ${it.si}: ${it.motivo ?? ""}`.trim(); de.por_interaccion = true; }
  }
  const falsos_positivos = objeciones.filter((o) => !o.usada).map(({ usada, ...o }) => o);
  const retos = resultados.filter((r) => !r.control), controles = resultados.filter((r) => r.control);
  const n = (lista, e) => lista.filter((r) => r.estado === e).length;
  const resumen = {
    n_retos: retos.length, correctos: n(retos, "correcto"), parciales: n(retos, "parcial"), incorrectos: n(retos, "incorrecto"), no_detectados: n(retos, "no_detectado"),
    puntaje: retos.length ? Number((n(retos, "correcto") / retos.length).toFixed(4)) : null,
    puntaje_con_parciales_a_medias: retos.length ? Number(((n(retos, "correcto") + 0.5 * n(retos, "parcial")) / retos.length).toFixed(4)) : null,
    controles: controles.map((c) => ({ defecto_id: c.defecto_id, estado: c.estado })),
    falsos_positivos: falsos_positivos.length,
    objeciones_totales: L(ejecucion.objeciones).length,
  };
  return {
    ok: true,
    puntuacion: {
      contrato: "cauce.lab.puntuacion", version_contrato: "0.1", generador: VERSION_PUNTUACION,
      ejecucion_id: ejecucion.id ?? null, banco_id: clave.banco_id ?? null,
      aviso: "Puntuación mecánica contra la clave privada. No es una aprobación. La decide y la revisa una persona.",
      resultados, falsos_positivos, resumen,
    },
  };
}
