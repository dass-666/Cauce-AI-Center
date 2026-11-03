// Qué ES cada personaje del contrato y cómo se muestra sin fingir actividad (fases E y E2).
//
// El contrato v1 no dice si un "agente" es un proceso automático, una persona o un cálculo.
// Esa clasificación vive FUERA del contrato, como la distribución: escena/<proyecto>-naturaleza.json,
// revisada a mano contra el código del sistema. Un proyecto sin ese archivo se ve como antes.
//
// Naturalezas:
//   automatico  proceso continuo con señal de vida (hoy, en Compago, solo el consumidor de importaciones).
//   programado  se ejecuta por un programador de tareas REAL (cron). Exige decir cuál es la evidencia.
//   reactivo    se ejecuta cuando alguien lo pide o cuando llega un archivo; no trabaja de forma continua.
//   humano      las decisiones las toma una persona; Cauce no sabe si está presente.
//   modulo      cálculo o consulta que corre al abrir una pantalla o un comando; no es un agente.
//   futuro      función prevista que aún no existe.

import { ESTADOS } from "./estados.js";

// puesto: qué muebles lleva su lugar. personaje: si alguna vez puede aparecer alguien.
export const NATURALEZAS = Object.freeze({
  automatico: { etiqueta: "Proceso automático", corta: "Automático", puesto: "personaje", personaje: true },
  programado: { etiqueta: "Proceso programado", corta: "Programado", puesto: "terminal", personaje: true },
  reactivo: { etiqueta: "Proceso reactivo", corta: "Reactivo", puesto: "terminal", personaje: true },
  humano: { etiqueta: "Puesto humano", corta: "Humano", puesto: "humano", personaje: false },
  modulo: { etiqueta: "Módulo de software", corta: "Módulo", puesto: "equipo", personaje: false },
  futuro: { etiqueta: "Función futura (inactiva)", corta: "Futuro", puesto: "inactivo", personaje: false },
});

// Cuánto dura la aparición breve de un proceso reactivo tras observar un registro nuevo.
export const DURACION_BREVE_SEGUNDOS = 8;
// Estados que pueden aparecer brevemente (un registro nuevo con resultado). "esperando" nunca.
const ESTADOS_BREVES = new Set(["trabajando", "finalizado", "error", "requiere_revision"]);

/**
 * Valida el archivo de clasificación.
 * @returns {{valido, errores, avisos, mapa: Map(agente_id → {naturaleza, latido|null})}}
 * "programado" sin `programacion.evidencia` se trata como "reactivo" (no hay cron confirmado).
 */
export function validarNaturalezas(datos) {
  const errores = [];
  const avisos = [];
  const mapa = new Map();
  if (!datos || typeof datos !== "object" || !datos.agentes || typeof datos.agentes !== "object") {
    return { valido: false, errores: ['Falta el objeto "agentes".'], avisos, mapa };
  }
  for (const [id, v] of Object.entries(datos.agentes)) {
    let n = v && v.naturaleza;
    if (!NATURALEZAS[n]) { errores.push(`"${id}": naturaleza desconocida (${JSON.stringify(n)}).`); continue; }
    if (n === "programado" && !(typeof v.programacion?.evidencia === "string" && v.programacion.evidencia.trim())) {
      avisos.push(`"${id}": "programado" sin evidencia de una programación real; se muestra como reactivo.`);
      n = "reactivo";
    }
    let latido = null;
    if (v.latido !== undefined) {
      const ok = v.latido && typeof v.latido.indicador === "string" && Array.isArray(v.latido.vivo) && v.latido.vivo.length;
      if (ok) latido = { indicador: v.latido.indicador, vivo: v.latido.vivo.map(String) };
      else errores.push(`"${id}": "latido" necesita "indicador" y una lista "vivo".`);
    }
    mapa.set(id, { naturaleza: n, latido });
  }
  return { valido: errores.length === 0, errores, avisos, mapa };
}

/**
 * Señal de vida de un proceso, leída de un indicador del departamento.
 * @returns true (vivo), false (el indicador dice otra cosa) o null (no hay indicador: no se sabe).
 */
export function latidoDe(dep, latido) {
  if (!latido) return true; // no se pidió latido
  const ind = (dep?.indicadores ?? []).find((i) => i.etiqueta === latido.indicador);
  if (!ind || ind.valor === null || ind.valor === undefined) return null;
  return latido.vivo.includes(String(ind.valor));
}

/**
 * Cómo se presenta un agente según su naturaleza.
 * @param agente      agente del modelo de vista (estado_mostrado ya corregido por las reglas de oro).
 * @param naturaleza  una de NATURALEZAS, o undefined si no está clasificado.
 * @param opciones.breve   true solo durante la aparición breve por un registro nuevo OBSERVADO.
 * @param opciones.vivo    señal de vida (latidoDe): true, false o null. Solo cuenta en "automatico".
 * @returns {{naturaleza, puesto, personaje: "presente"|"breve"|"ausente", animacion, pantalla, texto, avisos}}
 *   animacion = animacion3d del catálogo de estados ("ausente" si no hay personaje).
 */
export function presentar(agente, naturaleza, { breve = false, cambioObservado = false, vivo = true } = {}) {
  breve = breve || cambioObservado;
  const avisos = [];
  const estado = agente.estado_mostrado ?? agente.estado;
  const conEvidencia = Boolean(agente.evidencia);
  if (!NATURALEZAS[naturaleza]) {
    // Sin clasificar: lo prudente es no poner un personaje (no sabemos qué es).
    avisos.push(`"${agente.id}" no está clasificado; se muestra como equipo sin personaje.`);
    naturaleza = "modulo";
  }
  const base = { naturaleza, puesto: NATURALEZAS[naturaleza].puesto, avisos };
  const pantalla = estado === "sin_datos" ? "apagada" : estado;
  const ausente = (texto, pant = pantalla) => ({ ...base, personaje: "ausente", animacion: "ausente", pantalla: pant, texto });

  switch (naturaleza) {
    case "automatico": {
      // Presente solo con evidencia y con señal de vida. Un registro viejo no es un proceso vivo.
      if (estado === "sin_datos") return ausente("Sin información.", "apagada");
      if (!conEvidencia) return ausente("Sin registro que muestre que el proceso está en marcha.", "apagada");
      if (vivo === false) return ausente("El proceso no da señales de vida: no se dibuja a nadie trabajando.", "requiere_revision");
      if (vivo === null) return ausente("No hay dato de la señal de vida del proceso.", "apagada");
      return { ...base, personaje: "presente", animacion: animacionDe(estado), pantalla, texto: "Respaldado por un registro y con señal de vida." };
    }
    case "programado":
    case "reactivo": {
      // Nunca aparenta trabajo continuo. Aparece un momento solo si se observó un registro nuevo.
      const mostrar = breve && conEvidencia && ESTADOS_BREVES.has(estado);
      const cuando = naturaleza === "programado" ? "se ejecuta según su programación" : "se ejecuta cuando se le pide";
      if (mostrar) return { ...base, personaje: "breve", animacion: animacionDe(estado), pantalla, texto: `Llegó un registro nuevo; ${cuando}.` };
      return ausente(conEvidencia && estado !== "sin_datos" ? `Último registro en la pantalla; ${cuando}.` : `Sin registros recientes; ${cuando}.`,
        conEvidencia ? pantalla : "apagada");
    }
    case "humano":
      // Nunca se dibuja a la persona: no sabemos si está. Se muestra lo último que registró.
      return ausente(estado === "requiere_revision" ? "Espera la decisión de una persona." :
        conEvidencia && estado !== "sin_datos" ? "Último cambio registrado por una persona." : "Puesto de una persona; sin cambios registrados.",
      estado === "requiere_revision" ? "requiere_revision" : conEvidencia && estado !== "sin_datos" ? "registro" : "apagada");
    case "modulo":
      return ausente(estado === "sin_datos" ? "Calcula al abrirse; no registra ejecuciones." : "Resultado del último cálculo exportado.");
    case "futuro":
    default:
      return ausente("Función futura: todavía no existe.", "apagada");
  }
}

function animacionDe(estado) {
  return ESTADOS[estado]?.animacion3d ?? "ausente";
}

/** Referencia de evidencia por agente, para comparar dos lecturas. */
export function huellaEvidencia(modelo) {
  const h = new Map();
  for (const d of modelo.departamentos ?? [])
    for (const a of d.agentes) h.set(a.id, a.evidencia ? `${a.evidencia.origen}|${a.evidencia.referencia}` : null);
  return h;
}

/**
 * true si la evidencia de `id` cambió entre dos lecturas observadas.
 * No cuentan: la primera lectura, un agente que antes no estaba, ni perder la evidencia.
 */
export function cambioDeEvidencia(antes, ahora, id) {
  if (!antes || !antes.has(id)) return false;
  const a = antes.get(id) ?? null;
  const b = ahora.get(id) ?? null;
  return b !== null && a !== b;
}

/**
 * Un registro nuevo para ESTA página puede ser viejo (pestaña oculta, exportador detenido un rato). Solo cuenta
 * como actividad si su hora (evidencia.observado_en, o actividad.fin / inicio) es posterior a la lectura anterior
 * y cabe en la vigencia del archivo. Sin hora, no se puede saber: no cuenta.
 */
export function esReciente(agente, modelo, generadoAnterior) {
  const t = Date.parse(agente?.evidencia?.observado_en ?? agente?.actividad?.fin ?? agente?.actividad?.inicio ?? "");
  if (!Number.isFinite(t)) return false;
  // Mismo segundo que la lectura anterior: cuenta (las horas vienen redondeadas al segundo).
  if (generadoAnterior && t < Date.parse(generadoAnterior)) return false;
  const ref = Date.parse(modelo.ahora_referencia ?? modelo.generado_en);
  return ref - t <= (modelo.vigencia_segundos ?? 0) * 1000;
}

/**
 * Lleva la cuenta entre lecturas de UNA página: cuándo se vio un registro nuevo y hasta cuándo dura
 * la aparición breve. Decora cada agente del modelo con naturaleza, presentacion y animacion_mostrada.
 * reiniciar() al cambiar de proyecto: la siguiente lectura vuelve a ser "primera".
 */
export function crearSeguidorNaturalezas({ duracionMs = DURACION_BREVE_SEGUNDOS * 1000 } = {}) {
  let huella = null;
  let modeloVisto = null;
  let fuenteVista = null;
  let generadoAnterior = null; // generado_en de la lectura anterior con departamentos
  const hasta = new Map(); // agente → fin de la aparición breve (ms)
  return {
    reiniciar() { huella = null; modeloVisto = null; fuenteVista = null; generadoAnterior = null; hasta.clear(); },
    /**
     * @param modelo  modelo de vista (se modifica: agrega campos a cada agente).
     * @param clasificacion  resultado de validarNaturalezas, o null (proyecto sin clasificar: no se toca).
     * @param ahoraMs  reloj de la página.
     * @returns {number|null} ms hasta que termine la próxima aparición breve (para volver a dibujar).
     */
    aplicar(modelo, clasificacion, ahoraMs) {
      if (!clasificacion) return null;
      const nueva = modelo !== modeloVisto; // volver a aplicar el mismo modelo no es una lectura nueva
      if (nueva && modelo.departamentos.length) {
        // DEMO → REAL (u otro adaptador): otra fuente no es un registro nuevo; se vuelve a empezar.
        const fuente = `${modelo.es_demo}|${modelo.fuente?.tipo}|${modelo.fuente?.nombre}`;
        if (fuente !== fuenteVista) { huella = null; hasta.clear(); fuenteVista = fuente; generadoAnterior = null; }
        const h = huellaEvidencia(modelo);
        const porId = new Map(modelo.departamentos.flatMap((d) => d.agentes.map((a) => [a.id, a])));
        for (const id of h.keys()) {
          if (cambioDeEvidencia(huella, h, id) && esReciente(porId.get(id), modelo, generadoAnterior)) hasta.set(id, ahoraMs + duracionMs);
        }
        generadoAnterior = modelo.generado_en;
        huella = h; // solo se guarda una lectura con departamentos (una falla de lectura no borra la memoria)
      }
      modeloVisto = modelo;
      let proximo = null;
      for (const d of modelo.departamentos) {
        for (const a of d.agentes) {
          const c = clasificacion.mapa.get(a.id);
          const fin = hasta.get(a.id) ?? 0;
          const breve = fin > ahoraMs;
          if (breve) proximo = Math.min(proximo ?? Infinity, fin - ahoraMs);
          else hasta.delete(a.id);
          const p = presentar(a, c?.naturaleza, { breve, vivo: latidoDe(d, c?.latido) });
          a.naturaleza = p.naturaleza;
          a.presentacion = p;
          a.animacion_mostrada = p.animacion;
        }
      }
      return proximo;
    },
  };
}
