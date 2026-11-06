// Gerente escéptico `nexus-R 0.2` (CAUCE_NEXUS_ARQUITECTURA_MAESTRA_v0.2 §5). Determinista: sin IA, sin red, sin azar.
// Cada regla entrega estado (cumple | no_cumple | no_evaluado), motivo, referencia y versión. Cualquier no_cumple
// bloquea aprobación; no_evaluado también (no se convierte en cumple). Un control que no aplica se dice con
// `aplica: false` y su justificación, nunca en silencio. El gerente NO aprueba: la decisión es humana.

import { esFechaConZona, intervalo, mismoId, texto, buscarDatosPrivados } from "./comun.js";
import { versionDe, ESTADOS_VALIDACION } from "./leccion.js";

export const VERSION_REGLAS = "nexus-R 0.2";
export const ESTADOS = ["cumple", "no_cumple", "no_evaluado"];
export const REGLAS = [
  { id: "R01", nombre: "Procedencia y separación" },
  { id: "R02", nombre: "Evidencia y cobertura" },
  { id: "R03", nombre: "Independencia y circularidad" },
  { id: "R04", nombre: "Temporalidad" },
  { id: "R05", nombre: "Reproducción y vigencia" },
  { id: "R06", nombre: "Transferencia" },
  { id: "R07", nombre: "Privacidad y estrategia" },
  { id: "R08", nombre: "Inferencia y robustez" },
  { id: "R09", nombre: "Resultado y estado operativo" },
  { id: "R10", nombre: "Autorización y aislamiento" },
];

const L = (v) => (Array.isArray(v) ? v : []);
const VALIDADA = ["validada_en_origen", "validada_en_destino"];
/** Tipos de evidencia que son texto de IA o inventario de IA: no acreditan hechos (§2, R01/R02). */
const EVIDENCIA_IA = /^(texto_ia|inventario_ia|resumen_ia|auditoria_ia|memoria_ia)$/;
/** Estados de proceso, no entregables: «la tarea dijo succeeded», «CI verde», «hay un PR» (R09). */
const ESTADO_PROCESO = /^(estado_tarea|ci|pr|etiqueta)$/;
const ENTREGABLE = /^(informe|entregable|artefacto|resultado_verificado|verificacion_despliegue|despliegue)$/;
const primaria = (ev) => ev && !EVIDENCIA_IA.test(ev.tipo ?? "");

/** Detalles de estrategia o de cuentas que no deben salir de un proyecto (R07, T13). Términos con cifra. */
const ESTRATEGIA = [
  /\b(umbral|stake|banca|bankroll|l[ií]mite(?: de p[eé]rdida)?|cuota(?: m[ií]nima| m[aá]xima)?|apalancamiento|stop[- ]?loss|take[- ]?profit|tama[nñ]o de posici[oó]n|kelly)\b\s*(?:de|=|:|en|del?)?\s*[$]?\d/i,
  /\b(bet365|codere|caliente\.mx|betway|bwin|pinnacle|betfair|1xbet|binance|bitso|interactive brokers)\b/i,
  /\b(cuenta|cartera|posici[oó]n)\s*(n[uú]mero|no\.|#|:)\s*\w*\d{4,}/i,
];

export function buscarEstrategia(valor, ruta = "") {
  const r = [];
  if (typeof valor === "string") { for (const re of ESTRATEGIA) if (re.test(valor)) { r.push(ruta || "(raíz)"); break; } }
  else if (Array.isArray(valor)) valor.forEach((v, i) => r.push(...buscarEstrategia(v, `${ruta}[${i}]`)));
  else if (valor && typeof valor === "object") for (const [k, v] of Object.entries(valor)) r.push(...buscarEstrategia(v, ruta ? `${ruta}.${k}` : k));
  return r;
}

/**
 * Evalúa una lección con nexus-R 0.2.
 * @param leccion   cauce.leccion 0.2 (puede venir mal formada: nunca lanza)
 * @param ctx       { ahora: ms|Date, lecciones: Map(id → lección vigente) }
 */
export function evaluarLeccion(leccion, { ahora = Date.now(), lecciones = new Map() } = {}) {
  const ahoraMs = ahora instanceof Date ? ahora.getTime() : Number(ahora);
  const l = leccion && typeof leccion === "object" && !Array.isArray(leccion) ? leccion : {};
  const f = { R01, R02, R03: (x) => R03(x, lecciones), R04, R05: (x) => R05(x, ahoraMs), R06: (x) => R06(x, lecciones), R07, R08, R09, R10 };
  const reglas = REGLAS.map((r) => {
    let s;
    try { s = f[r.id](l); } catch (err) { s = { estado: "no_evaluado", motivo: `No se pudo evaluar (${err.message}).` }; }
    return {
      id: r.id, nombre: r.nombre, estado: ESTADOS.includes(s.estado) ? s.estado : "no_evaluado",
      motivo: texto(s.motivo) ? s.motivo : "Sin motivo.", referencia: s.referencia ?? [], aplica: s.aplica !== false, version: VERSION_REGLAS,
    };
  });
  return { leccion_id: l.id ?? null, version: versionDe(l), reglas, dictamen: dictaminar(reglas), version_reglas: VERSION_REGLAS };
}

/** Cualquier no_cumple → con objeciones; si no, cualquier cosa que no sea cumple → incompleto; solo 10/10 → sin objeciones. */
export function dictaminar(reglas) {
  const no = reglas.filter((r) => r.estado === "no_cumple").map((r) => r.id);
  const pendientes = reglas.filter((r) => r.estado !== "cumple" && r.estado !== "no_cumple").map((r) => r.id);
  const estado = no.length ? "con_objeciones" : pendientes.length ? "incompleto" : "sin_objeciones";
  return { estado, no_cumple: no, no_evaluado: pendientes, apto_para_decision_humana: estado === "sin_objeciones" };
}

const C = (motivo, referencia = [], extra = {}) => ({ estado: "cumple", motivo, referencia, ...extra });
const N = (motivo, referencia = []) => ({ estado: "no_cumple", motivo, referencia });
const E = (motivo, referencia = []) => ({ estado: "no_evaluado", motivo, referencia });
const revisoresIndependientes = (l) => L(l.revisiones).filter((r) => r && !mismoId(r.autor, l.autor?.identificador));

// R01 — procedencia, autoría y revisor independiente. Texto de IA no acredita hechos; IA no se valida a sí misma.
function R01(l) {
  const faltan = [];
  if (!texto(l.origen?.proyecto)) faltan.push("origen.proyecto");
  if (!texto(l.origen?.version_sistema) && !texto(l.origen?.commit)) faltan.push("origen.version_sistema o commit");
  if (!texto(l.autor?.tipo) || !texto(l.autor?.identificador)) faltan.push("autor");
  if (!texto(l.procedencia?.metodo)) faltan.push("procedencia.metodo");
  if (faltan.length) return N(`Falta procedencia: ${faltan.join(", ")}.`, faltan);
  const validada = VALIDADA.includes(l.validacion?.estado);
  if (validada && l.origen.tipo === "texto_ia") return N("El origen es texto de IA: no acredita hechos y no puede estar validada.", ["origen.tipo"]);
  const ind = revisoresIndependientes(l);
  const autoIa = L(l.revisiones).filter((r) => r?.autor_tipo === "ia" && l.autor?.tipo === "ia" && mismoId(r.autor, l.autor.identificador));
  if (validada && autoIa.length) return N(`La IA autora (${l.autor.identificador}) aparece como revisora de su propia lección: no es validación independiente (T20).`, ["revisiones"]);
  const humanos = ind.filter((r) => r.autor_tipo === "humano");
  if (validada && l.autor?.tipo === "ia" && !humanos.length) return N("Lección de IA marcada como validada sin revisión humana independiente.", ["revisiones"]);
  if (!humanos.length) return E("Falta una revisión humana de alguien distinto del autor.", ["revisiones"]);
  return C(`Procedencia completa; revisión humana independiente de ${humanos.map((r) => r.autor).join(", ")}.`, ["origen", "autor", "procedencia", "revisiones"]);
}

// R02 — evidencia verificable y primaria; cobertura declarada.
function R02(l) {
  const ev = L(l.evidencia);
  if (!ev.length) return N("Sin evidencia: no hay fuente primaria (T01).", ["evidencia"]);
  const prim = ev.filter(primaria);
  if (!prim.length) return N(`Toda la evidencia es texto o inventario de IA (${ev.map((x) => x.tipo).join(", ")}): no es fuente primaria (T01).`, ["evidencia"]);
  if (l.origen?.tipo === "texto_ia" && prim.every((x) => x.ubicacion === "fuera_de_repo" && !x.sha256)) return N("Origen texto de IA y ninguna evidencia primaria con huella.", ["evidencia"]);
  const sinRef = ev.filter((x) => !texto(x.referencia) || !texto(x.ubicacion));
  if (sinRef.length) return N("Hay evidencia sin referencia o ubicación.", ["evidencia"]);
  if (l.muestra?.cobertura === null || l.muestra?.cobertura === undefined || l.muestra?.cobertura === "") return E("No se declara la cobertura (qué parte del universo cubre la evidencia, faltantes, sesgo de supervivencia).", ["muestra.cobertura"]);
  return C(`${prim.length} evidencia(s) primaria(s) con referencia; cobertura: ${typeof l.muestra.cobertura === "string" ? l.muestra.cobertura : JSON.stringify(l.muestra.cobertura)}.`, ["evidencia", "muestra.cobertura"]);
}

// R03 — duplicados exactos, unidades independientes y grafo de antecedentes (A→B→A).
const claveEv = (x) => (x?.sha256 ? `h:${x.sha256}` : `r:${String(x?.referencia ?? "").trim().toLowerCase()}|${x?.commit ?? ""}|${x?.dataset_id ?? ""}`);
export function cicloDesde(id, lecciones, inicial) {
  const pila = L(inicial).map((a) => [a, [id, a]]);
  const vistos = new Set();
  const faltan = [];
  while (pila.length) {
    const [x, camino] = pila.pop();
    if (x === id) return { ciclo: camino, faltan };
    if (vistos.has(x)) continue;
    vistos.add(x);
    const otra = lecciones.get(x);
    if (!otra) { faltan.push(x); continue; }
    for (const s of L(otra.antecedentes)) pila.push([s, [...camino, s]]);
  }
  return { ciclo: null, faltan };
}
function R03(l, lecciones) {
  const vistos = new Map();
  const dup = [];
  L(l.evidencia).forEach((x, i) => { const k = claveEv(x); if (vistos.has(k)) dup.push(`evidencia[${vistos.get(k)}] = evidencia[${i}]`); else vistos.set(k, i); });
  if (dup.length) return N(`Evidencia duplicada (misma huella o misma referencia, commit y dataset): ${dup.join("; ")}. Cuenta como una sola observación (T03).`, ["evidencia"]);
  if (L(l.antecedentes).includes(l.id)) return N("La lección se cita a sí misma como antecedente.", ["antecedentes"]);
  const { ciclo, faltan } = cicloDesde(l.id, lecciones, l.antecedentes);
  if (ciclo) return N(`Circularidad: ${ciclo.join(" → ")}. Una lección derivada no confirma a su origen (T10).`, ["antecedentes"]);
  const m = l.muestra ?? {};
  if (Number.isInteger(m.n_independiente) && Number.isInteger(m.n) && m.n_independiente > m.n) return N(`n_independiente (${m.n_independiente}) no puede superar n (${m.n}).`, ["muestra"]);
  if (Number.isInteger(m.n_efectivo) && Number.isInteger(m.n_independiente) && m.n_efectivo > m.n_independiente) return N(`n_efectivo (${m.n_efectivo}) no puede superar n_independiente (${m.n_independiente}).`, ["muestra"]);
  if (faltan.length) return E(`Antecedentes que no están en el registro: ${[...new Set(faltan)].join(", ")}.`, ["antecedentes"]);
  const n = m.n ?? null;
  if ((n === null || n > 1) && !Number.isInteger(m.n_independiente)) return E("Falta n_independiente: no se sabe cuántas unidades únicas hay detrás del conteo bruto.", ["muestra.n_independiente"]);
  if (Number.isInteger(n) && Number.isInteger(m.n_independiente) && m.n_independiente < n) {
    if (!texto(m.unidad_independencia)) return E(`n=${n} pero n_independiente=${m.n_independiente}: falta unidad_independencia.`, ["muestra.unidad_independencia"]);
    return C(`Se cuentan ${m.n_independiente} ${m.unidad_independencia} independientes, no ${n} ${m.unidad} (T15).`, ["muestra"], { n_usado: m.n_independiente });
  }
  return C("Sin duplicados, sin ciclos y con unidades independientes declaradas.", ["evidencia", "antecedentes", "muestra"]);
}

// R04 — observación, known_at, exportación y zona horaria; sin mirar el futuro.
function R04(l) {
  const sinZona = L(l.revisiones).map((r, i) => (r && !esFechaConZona(r.fecha) ? `revisiones[${i}].fecha` : null)).filter(Boolean);
  if (sinZona.length) return N(`Fechas de revisión sin zona horaria: ${sinZona.join(", ")} (T17).`, sinZona);
  const hallazgo = intervalo(l.fecha_hallazgo);
  if (!hallazgo) return N("fecha_hallazgo inválida o ausente.", ["fecha_hallazgo"]);
  const malas = [], dudosas = [], desconocidas = [];
  L(l.evidencia).forEach((x, i) => {
    const r = `evidencia[${i}]`;
    for (const k of ["observado_en", "conocido_en", "exportado_en"]) if (x?.[k] !== null && x?.[k] !== undefined && !esFechaConZona(x[k])) malas.push(`${r}.${k} sin zona`);
    const obs = esFechaConZona(x?.observado_en) ? Date.parse(x.observado_en) : null;
    const con = esFechaConZona(x?.conocido_en) ? Date.parse(x.conocido_en) : null;
    if (texto(x?.exportado_en) && x.exportado_en === x.observado_en) malas.push(`${r}: la fecha de exportación se presenta como observación (T07)`);
    if (obs !== null && con !== null && con < obs) malas.push(`${r}: conocido_en es anterior a observado_en`);
    if (con !== null) {
      if (con > hallazgo[1]) malas.push(`${r}: el dato se conoció (${x.conocido_en}) después del hallazgo (${l.fecha_hallazgo}) (T04)`);
      else if (con > hallazgo[0]) dudosas.push(`${r}: conocido_en cae dentro del día del hallazgo y la fecha del hallazgo no tiene hora ni zona`);
    }
    if (con === null || x?.base_conocimiento === "desconocida") desconocidas.push(r);
  });
  if (malas.length) return N(`${malas.join("; ")}.`, ["evidencia", "fecha_hallazgo"]);
  const est = L(l.evidencia).filter((x) => x?.base_conocimiento === "estimated");
  if (est.length && l.confianza?.nivel === "alta") return N(`known_at estimado${est.some((x) => typeof x.fraccion_estimada === "number") ? ` (${Math.round(Math.max(...est.map((x) => x.fraccion_estimada ?? 0)) * 100)} %)` : ""}: no permite confianza alta sobre ausencia de mirada al futuro (T21).`, ["evidencia.base_conocimiento", "confianza.nivel"]);
  if (dudosas.length) return E(`${dudosas.join("; ")}.`, ["evidencia", "fecha_hallazgo"]);
  if (desconocidas.length) return E(`No se sabe cuándo estuvo disponible el dato en ${desconocidas.join(", ")} (conocido_en nulo o base desconocida).`, ["evidencia.conocido_en"]);
  return C(`Toda la evidencia era conocida antes del hallazgo${est.length ? "; hay fechas estimadas, por eso la confianza no puede ser alta" : ""}.`, ["evidencia", "fecha_hallazgo"]);
}

// R05 — declarada ≠ reproducida; artefacto con huella o commit; caducidad.
function R05(l, ahoraMs) {
  const v = intervalo(l.vigente_hasta);
  if (!v) return N("vigente_hasta inválida o ausente.", ["vigente_hasta"]);
  if (v[1] < ahoraMs) return N(`Caducó (vigente_hasta ${l.vigente_hasta}): revisar antes de usarla (T11).`, ["vigente_hasta"]);
  if (l.validacion?.estado === "caducada") return N("La propia lección se declara caducada.", ["validacion.estado"]);
  const ev = L(l.evidencia).filter(primaria);
  const conArtefacto = ev.filter((x) => texto(x.sha256) || texto(x.commit));
  const reproducidas = ev.filter((x) => x.reproduccion_independiente && texto(x.reproduccion_independiente.referencia) && !mismoId(x.reproduccion_independiente.quien, l.autor?.identificador));
  if (VALIDADA.includes(l.validacion?.estado) && !conArtefacto.length && !reproducidas.length) return N("Marcada como validada sin artefacto (huella o commit) ni reproducción independiente.", ["evidencia"]);
  if (!conArtefacto.length) return E("Ninguna evidencia trae huella SHA-256 ni commit: no se puede comprobar que sea la misma al revisarla.", ["evidencia.sha256", "evidencia.commit"]);
  const declarada = ev.filter((x) => x.reproducible_declarado === true && !x.reproduccion_independiente);
  return C(`${conArtefacto.length} evidencia(s) con huella o commit; vigente hasta ${l.vigente_hasta}.${reproducidas.length ? ` Reproducida por terceros: ${reproducidas.length}.` : ""}${declarada.length ? ` ${declarada.length} solo declarada(s) reproducible(s): no reproducida(s) (Nexus no las ejecutó).` : ""}`, ["evidencia", "vigente_hasta"]);
}

// R06 — validaciones: prueba_ref, prueba propia y posterior en destino, revisión ajena, IA repetida no suma.
function R06(l, lecciones) {
  const vals = L(l.validacion?.validado_en);
  const sinRef = vals.map((v, i) => (!texto(v?.prueba_ref) ? i : null)).filter((i) => i !== null);
  if (sinRef.length) return N(`validado_en sin prueba_ref: posiciones ${sinRef.join(", ")} (T05).`, ["validacion.validado_en"]);
  // Una lección derivada de esta no puede servir como su validación (A→B→A).
  for (const v of vals) {
    const ref = String(v.prueba_ref).trim();
    const otra = ref.startsWith("leccion:") ? lecciones.get(ref.slice(8)) : null;
    if (otra && cicloDesde(l.id, lecciones, [otra.id]).ciclo) return N(`La validación cita ${otra.id}, que deriva de esta lección: no es confirmación independiente (T10).`, ["validacion.validado_en"]);
    if (ref.startsWith("leccion:")) return N(`La validación cita otra lección (${ref}): una convergencia de ideas no es una prueba.`, ["validacion.validado_en"]);
  }
  const estado = l.validacion?.estado;
  if (!ESTADOS_VALIDACION.includes(estado)) return E("Estado de validación desconocido.", ["validacion.estado"]);
  const origen = l.origen?.proyecto;
  const humanosAjenos = revisoresIndependientes(l).filter((r) => r.autor_tipo === "humano");
  if (estado === "validada_en_origen") {
    if (!vals.some((v) => v.proyecto === origen)) return N("Declara validada en origen sin una prueba identificable en el proyecto de origen.", ["validacion"]);
    if (!humanosAjenos.length) return N("Validada en origen sin revisión independiente del autor.", ["revisiones"]);
  }
  if (estado === "validada_en_destino") {
    const hallazgo = intervalo(l.fecha_hallazgo);
    const destino = vals.filter((v) => v.proyecto !== origen);
    if (!destino.length) return N("Declara validada en destino sin una validación en otro proyecto.", ["validacion"]);
    const propias = destino.filter((v) => L(l.evidencia).some((x) => x.proyecto_ejecutor === v.proyecto && primaria(x)));
    if (!propias.length) return N("La validación en destino no tiene evidencia primaria ejecutada por el destino: la reproducibilidad declarada en el origen no basta (T24) y repetir una fuente de IA no cuenta (T22).", ["evidencia.proyecto_ejecutor"]);
    const posteriores = propias.filter((v) => { const f = intervalo(v.fecha); return f && hallazgo && f[0] > hallazgo[1]; });
    if (!posteriores.length) return N("La prueba en destino no es claramente posterior al planteamiento de la lección.", ["validacion.validado_en.fecha"]);
    if (!humanosAjenos.length) return N("Validada en destino sin revisión ajena al autor.", ["revisiones"]);
  }
  if (["propuesta", "en_prueba"].includes(estado) && !vals.length) return C("No declara validación ni transferencia: las aplicaciones posibles son hipótesis.", ["validacion"], { aplica: false });
  return C(`Validaciones con prueba_ref (${vals.length}); estado «${estado}» coherente.`, ["validacion"]);
}

// R07 — privacidad (patrones + lista blanca de claves del contrato) y estrategia (cifras, casas, cuentas).
function R07(l) {
  const priv = buscarDatosPrivados(l);
  if (priv.length) return N(`Posibles datos privados: ${priv.slice(0, 3).map((p) => `${p.motivo} en ${p.ruta}`).join("; ")} (T13).`, priv.map((p) => p.ruta));
  const est = buscarEstrategia(l);
  if (est.length && l.sensibilidad !== "restringida") return N(`Detalle de estrategia, umbral, banca, casa o cuenta en ${est.slice(0, 3).join(", ")}: bloquea exportación (T13).`, est);
  if (l.tipo === "estrategia" && l.sensibilidad !== "restringida") return N("Una lección de tipo estrategia debe ser «restringida» y no se exporta.", ["tipo", "sensibilidad"]);
  if (l.sensibilidad === "restringida") return C("Restringida: se conserva en Nexus pero no es exportable a otros proyectos.", ["sensibilidad"], { exportable: false });
  return C("Sin datos privados ni detalles de estrategia detectados (los patrones no garantizan ausencia: la exportación requiere aprobación humana).", ["sensibilidad"]);
}

// R08 — inferencia: naturaleza de datos/resultado vs objeto de confianza, selección, comparaciones, costos, n efectivo.
function R08(l) {
  const m = l.muestra ?? {}, c = l.confianza ?? {};
  const nr = m.naturaleza_resultado, nat = m.naturaleza;
  if (c.objeto === "beneficio_economico" && nr !== "resultado_operativo_real") return N(`Afirma beneficio económico con un resultado «${nr}»: un backtest o simulación no es beneficio real (T06).`, ["muestra.naturaleza_resultado", "confianza.objeto"]);
  if (c.objeto === "beneficio_economico" && nat !== "real_comercial") return N(`Afirma beneficio económico con datos «${nat}»; un caso sintético o de demo nunca prueba éxito comercial (T14).`, ["muestra.naturaleza", "confianza.objeto"]);
  if ((nat === "sintetica" || nat === "demo") && c.objeto !== "metodo") return N(`Datos ${nat}: solo pueden respaldar el método, no un efecto (T14).`, ["muestra.naturaleza", "confianza.objeto"]);
  const costos = L(m.supuestos).filter((s) => (s && typeof s === "object" && /costo|comisi|fricci|desliz/i.test(s.variable ?? "") && Number(s.valor) === 0 && s.conocido === false)
    || (typeof s === "string" && /costos?[^.;]*(=|:|en)\s*0\b/i.test(s) && /desconoc|no se conoc|sin dato/i.test(s)));
  if (costos.length) return N("Costos desconocidos codificados como cero (T19).", ["muestra.supuestos"]);
  const fuerte = c.nivel !== "baja" || VALIDADA.includes(l.validacion?.estado);
  if (m.seleccion_en_muestra === true && fuerte) return N("La alternativa se eligió y se probó con la misma muestra: no generaliza (T16).", ["muestra.seleccion_en_muestra"]);
  const ajuste = L(m.supuestos).some((s) => (s && typeof s === "object" && /ajuste_comparaciones/.test(s.variable ?? "")) || (typeof s === "string" && /ajuste (por|de) (comparaciones|selecci)/i.test(s)));
  if (Number.isInteger(m.n_comparaciones) && m.n_comparaciones > 1 && fuerte && !ajuste) return N(`${m.n_comparaciones} alternativas comparadas sin ajuste por selección: impide afirmar ventaja robusta (T18).`, ["muestra.n_comparaciones"]);
  const est = L(l.evidencia).filter((x) => x?.base_conocimiento === "estimated" && (x.fraccion_estimada ?? 1) >= 0.5);
  if (est.length && c.nivel === "alta") return N("La mayor parte de las fechas de disponibilidad son estimadas: limita la confianza (T21).", ["evidencia.fraccion_estimada"]);
  if (c.nivel === "alta" && !Number.isInteger(m.n_efectivo)) return E("Confianza alta sin n_efectivo: no se puede juzgar.", ["muestra.n_efectivo"]);
  if (c.nivel === "alta" && c.objeto !== "metodo" && Number.isInteger(m.n_efectivo) && m.n_efectivo < 30) return N(`Confianza alta en un efecto con n_efectivo=${m.n_efectivo}.`, ["muestra.n_efectivo"]);
  return C(`Confianza «${c.nivel}» sobre «${c.objeto}» coherente con datos «${nat}» y resultado «${nr}»${m.seleccion_en_muestra ? " (selección en muestra: solo como limitación)" : ""}.`, ["muestra", "confianza"]);
}

// R09 — PR ≠ CI ≠ main ≠ despliegue; «succeeded» sin informe no es resultado.
function R09(l) {
  const ev = L(l.evidencia);
  const mal = ev.map((x, i) => (x?.ubicacion === "desplegado" && !ENTREGABLE.test(x.tipo ?? "") ? i : null)).filter((i) => i !== null);
  if (mal.length) return N(`Evidencia presentada como «desplegado» que es ${mal.map((i) => ev[i].tipo).join(", ")}: un PR o CI verde no demuestra despliegue (T08).`, mal.map((i) => `evidencia[${i}]`));
  const proceso = ev.filter((x) => ESTADO_PROCESO.test(x?.tipo ?? ""));
  if (proceso.length && proceso.length === ev.filter(primaria).length && l.muestra?.naturaleza_resultado !== "sin_resultado")
    return N(`Solo hay estados de proceso (${proceso.map((x) => x.tipo).join(", ")}) sin informe ni entregable verificado: sin resultado no hay éxito (T02).`, ["evidencia"]);
  if (l.muestra?.naturaleza_resultado === "sin_resultado" && l.confianza?.objeto !== "metodo") return N("Sin resultado no se puede afirmar un efecto.", ["muestra.naturaleza_resultado"]);
  if (l.validacion?.estado === "validada_en_origen" && l.tipo === "metodo" && ev.length && ev.every((x) => x.ubicacion === "pr_abierto"))
    return N("Validada en origen solo con PR abierto: una corrección de código necesita la versión integrada en main o despliegue verificado.", ["evidencia.ubicacion"]);
  return C("Ubicaciones y tipos de evidencia coherentes con lo que se afirma.", ["evidencia"]);
}

// R10 — en una lección: las estrategias no se transfieren entre proyectos; Nexus no ejecuta nada.
function R10(l) {
  const otros = L(l.aplicaciones_posibles).filter((a) => a?.proyecto && a.proyecto !== l.origen?.proyecto);
  if (l.tipo === "estrategia" && otros.length) return N("Una estrategia no se exporta entre proyectos.", ["aplicaciones_posibles"]);
  return C("No aplica a lecciones: la autorización y el aislamiento se revisan en cada recomendación (Nexus no ejecuta nada).", [], { aplica: false });
}
