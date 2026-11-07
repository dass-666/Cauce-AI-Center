// CSI fase 2 · Abogado del Diablo determinista (bloque 5, quinta estación). Código, no IA: hace las ocho preguntas a
// cada hipótesis con reglas fijas y explica cada alerta. No es un revisor humano ni lo sustituye: su firma es
// {tipo: "codigo", identificador: "abogado-csi"} y la revisión independiente sigue siendo de una persona.

import { L, esFechaODia, intervalo } from "./base.js";
import { esPendiente, conocidaDespues, fechaConocimiento, origenDe } from "./fuentes.js";
import { buscarPsicologia, buscarIntencion, buscarCoordinacion } from "./lenguaje.js";
import { ORDINARIAS } from "./flujo.js";

export const AUTOR_ABOGADO = { tipo: "codigo", identificador: "abogado-csi" };
export const VERSION_ABOGADO = "abogado-csi 0.1";
export const PREGUNTAS = [
  ["intenciones", "¿Estamos suponiendo intenciones sin pruebas?", "sesgo"],
  ["mas_sencilla", "¿Hay una explicación más sencilla?", "explicacion_alternativa"],
  ["independencia", "¿Las fuentes son independientes?", "fuente_debil"],
  ["informacion_posterior", "¿Usamos información conocida después del acontecimiento?", "sesgo"],
  ["seleccion", "¿Seleccionamos solo ejemplos que favorecen la teoría?", "sesgo"],
  ["referencia_simple", "¿El supuesto patrón supera una referencia simple?", "dato_faltante"],
  ["refutacion", "¿Qué evidencia refutaría la explicación?", "dato_faltante"],
  ["distinguir", "¿Qué observaciones distinguen las hipótesis rivales?", "dato_faltante"],
];

/** Fin del día (o instante) del acontecimiento: lo conocido después ya no explicaba la decisión de ese día. */
const corte = (h, inv) => { const f = h.momento_decision ?? inv?.acontecimiento?.fecha; return esFechaODia(f) ? new Date(intervalo(f)[1]).toISOString() : null; };

/**
 * @param inv       investigación (0.1 o 0.2)
 * @param opciones  { predicciones: resumen de resumirPredicciones() (opcional) }
 * @returns { version, hipotesis: [{id, alertas, comprobaciones: [{id, pregunta, resultado: alerta|ok|no_evaluable, detalle, tipo_objecion}]}], alertas_total }
 */
export function revisarAbogado(inv, { predicciones = null } = {}) {
  const enun = new Map(L(inv?.enunciados).map((x) => [x.id, x]));
  const fuentes = new Map(L(inv?.fuentes).map((f) => [f.id, f]));
  const vig = (id) => { const x = enun.get(id); return x && !x.retirado && ["hecho", "declaracion"].includes(x.tipo) ? x : null; };
  const hips = L(inv?.hipotesis);
  const usados = new Set(hips.flatMap((h) => [...L(h.a_favor), ...L(h.en_contra)]));
  const retrospectiva = inv?.naturaleza_estudio === "historico";
  const resultado = hips.map((h) => {
    const favor = L(h.a_favor).map(vig).filter(Boolean), contra = L(h.en_contra).map(vig).filter(Boolean);
    const fsFavor = favor.flatMap((x) => L(x.fuentes).map((id) => fuentes.get(id)).filter((f) => f && !esPendiente(f)));
    const c = [];
    const pon = (i, res, detalle) => c.push({ id: PREGUNTAS[i][0], pregunta: PREGUNTAS[i][1], resultado: res, detalle, tipo_objecion: PREGUNTAS[i][2] });

    // 1. Intenciones sin pruebas: lenguaje de intención/psicología/coordinación sin un enunciado «sobre intención» que lo respalde.
    const pal = [...buscarIntencion(h.enunciado), ...buscarPsicologia(h.enunciado), ...buscarCoordinacion(h.enunciado)];
    const respaldoIntencion = favor.some((x) => x.sobre === "intencion");
    const soloPrecios = h.categoria === "manipulacion" && favor.length > 0 && favor.every((x) => x.sobre === "dato");
    if (soloPrecios) pon(0, "alerta", "Manipulación apoyada solo en datos de precio: un movimiento de precios por sí solo no demuestra manipulación.");
    else if (pal.length && !respaldoIntencion) pon(0, "alerta", `El enunciado usa «${pal.join(", ")}» y ninguna evidencia a favor trata de la intención (sobre: intencion) con fuente del propio actor.`);
    else if (h.categoria === "manipulacion" && !favor.some((x) => x.tipo === "hecho" && L(x.fuentes).some((id) => ["documento_regulatorio", "documento_oficial"].includes(fuentes.get(id)?.tipo)))) pon(0, "alerta", "Manipulación sin hecho respaldado por documento regulatorio u oficial: queda como hipótesis.");
    else pon(0, "ok", respaldoIntencion ? "La intención que se menciona tiene evidencia sobre intención registrada." : "No atribuye intenciones.");

    // 2. Explicación más sencilla: si no es ordinaria, ¿hay una ordinaria con igual o más apoyo?
    const ord = hips.filter((o) => o.id !== h.id && ORDINARIAS.includes(o.categoria));
    const apoyo = (o) => L(o.a_favor).filter((id) => vig(id)).length;
    if (!ORDINARIAS.includes(h.categoria)) {
      if (!ord.length) pon(1, "alerta", "No se registró ninguna explicación ordinaria (fundamentales, liquidez, oportunista) con la que comparar.");
      else { const mejor = ord.filter((o) => apoyo(o) >= favor.length); pon(1, mejor.length ? "alerta" : "ok", mejor.length ? `${mejor.map((o) => o.id).join(", ")} es ordinaria y tiene igual o más evidencia a favor (${apoyo(mejor[0])} frente a ${favor.length}).` : "Las explicaciones ordinarias registradas tienen menos apoyo; aun así no está probada."); }
    } else pon(1, "ok", "Es una explicación ordinaria.");

    // 3. Independencia: orígenes distintos entre las fuentes a favor; y si solo lo dice el propio actor.
    const origenes = [...new Set(fsFavor.map(origenDe))];
    const propios = h.sobre_actor ? fsFavor.filter((f) => f.autor_actor_id === h.sobre_actor || origenDe(f) === h.sobre_actor) : [];
    if (!fsFavor.length) pon(2, "no_evaluable", "Sin fuentes a favor.");
    else if (h.sobre_actor && propios.length === fsFavor.length) pon(2, "alerta", `Todo lo que apoya la hipótesis lo dice el propio actor (${h.sobre_actor}) en ${new Set(fsFavor.map((f) => f.id)).size} fuente(s): es su explicación declarada, no una verificación independiente.`);
    else if (new Set(fsFavor.map((f) => f.id)).size === 1) pon(2, "alerta", `Una sola fuente a favor (${fsFavor[0].id}, origen ${origenes[0]}): no hay confirmación independiente.`);
    else if (origenes.length < 2) pon(2, "alerta", `Todas las fuentes a favor vienen del mismo origen (${origenes[0]}): copias o reproducciones no son confirmación independiente.`);
    else pon(2, "ok", `${origenes.length} orígenes distintos: ${origenes.join(", ")}.`);

    // 4. Información posterior: evidencia a favor que solo se conoció después del momento de decisión.
    const t = corte(h, inv);
    const tarde = t ? favor.filter((x) => { const fs = L(x.fuentes).map((id) => fuentes.get(id)).filter(Boolean); return fs.length && fs.every((f) => conocidaDespues(f, t)); }) : [];
    if (!t) pon(3, "no_evaluable", "Sin fecha de acontecimiento o momento de decisión.");
    else if (tarde.length) pon(3, "alerta", `${tarde.map((x) => x.id).join(", ")} se conoció después del momento de decisión (${h.momento_decision ?? inv?.acontecimiento?.fecha}) (${tarde.map((x) => L(x.fuentes).map((id) => fechaConocimiento(fuentes.get(id))).join("/")).join("; ")}): sirve para describir lo que pasó, no lo que el actor sabía al decidir.`);
    else pon(3, "ok", "La evidencia a favor ya era pública en el momento de la decisión.");

    // 5. Selección favorable: ¿se buscó algo en contra? ¿quedaron hechos sin usar?
    const sinUsar = [...enun.values()].filter((x) => !x.retirado && ["hecho", "declaracion"].includes(x.tipo) && !usados.has(x.id));
    if (!contra.length && sinUsar.length) pon(4, "alerta", `Nada en contra registrado y ${sinUsar.length} hecho(s)/declaración(es) no se usaron en ninguna hipótesis (${sinUsar.slice(0, 4).map((x) => x.id).join(", ")}${sinUsar.length > 4 ? "…" : ""}): ¿se dejaron fuera por no encajar?`);
    else if (!contra.length) pon(4, "alerta", "Nada en contra registrado: no hay señal de que se haya buscado evidencia contraria.");
    else pon(4, "ok", `${contra.length} enunciado(s) en contra registrados.`);

    // 6. Referencia simple: solo predicciones registradas antes, evaluadas y suficientes lo dirían.
    const filas = L(predicciones?.filas).filter((p) => p.investigacion_id === inv?.id && (!p.hipotesis_id || p.hipotesis_id === h.id));
    const decididas = filas.filter((p) => ["acertada", "fallida"].includes(p.estado));
    if (retrospectiva) pon(5, "alerta", "Estudio retrospectivo: explicar el pasado no demuestra capacidad de anticipar. Solo predicciones registradas antes del horizonte y comparadas con una referencia simple podrían hacerlo.");
    else if (decididas.length < 10) pon(5, "alerta", `${decididas.length} predicción(es) decidida(s) para esta hipótesis: no alcanza para decir que supera a la referencia simple.`);
    else { const m = decididas.filter((p) => p.estado === "acertada").length, rf = decididas.filter((p) => p.resultado_referencia === "acertada").length; pon(5, m > rf ? "ok" : "alerta", `Modelo ${m} aciertos frente a referencia ${rf} en ${decididas.length} decididas${m > rf ? " (fuera de muestra solo si se registraron antes)" : ": no la supera"}.`); }

    // 7. Refutación.
    pon(6, L(h.condiciones_refutacion).length ? "ok" : "alerta", L(h.condiciones_refutacion).length ? `Se refuta si: ${L(h.condiciones_refutacion).join(" · ")}` : "No dice qué la refutaría: una explicación que nada puede refutar no se puede comprobar.");

    // 8. Observaciones distintivas frente a rivales.
    const rivales = hips.filter((o) => o.id !== h.id).map((o) => o.id);
    const cubiertos = new Set(L(h.observaciones_distintivas).flatMap((o) => L(o.distingue_de)));
    const sin = rivales.filter((id) => !cubiertos.has(id));
    if (!rivales.length) pon(7, "alerta", "No hay hipótesis rivales registradas.");
    else if (sin.length) pon(7, "alerta", `Falta una observación que la distinga de: ${sin.join(", ")}.`);
    else pon(7, "ok", `Cada rival tiene una observación distintiva (${L(h.observaciones_distintivas).length}).`);

    return { id: h.id, categoria: h.categoria, alertas: c.filter((x) => x.resultado === "alerta").length, comprobaciones: c };
  });
  return { version: VERSION_ABOGADO, autor: AUTOR_ABOGADO, aviso: "Comprobaciones deterministas por código. No es una revisión humana independiente ni la sustituye.", hipotesis: resultado, alertas_total: resultado.reduce((s, x) => s + x.alertas, 0) };
}

/** Convierte las alertas en objeciones listas para `aplicarCambio(…, {accion: "agregar_objecion"})` (las registra quien quiera). */
export function objecionesSugeridas(inv, revision) {
  const ya = new Set(L(inv?.objeciones).map((o) => o.id));
  return L(revision?.hipotesis).flatMap((h) => h.comprobaciones.filter((c) => c.resultado === "alerta").map((c) => ({ id: `abg-${h.id}-${c.id}`.toLowerCase().replace(/[^a-z0-9._-]/g, "-"), hipotesis_id: h.id, tipo: c.tipo_objecion, texto: `${c.pregunta} ${c.detalle}`, autor: AUTOR_ABOGADO })))
    .filter((o) => !ya.has(o.id));
}
