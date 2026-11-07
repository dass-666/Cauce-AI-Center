// Fase K: sala de control (resumen de la empresa), bitácora de la sesión, clasificación del historial,
// siguiente departamento con atención y registro con proyectos pendientes. Corre en Node y en pruebas.html.

import { prueba, igual, verdadero } from "./mini.js";
import { construirModeloVista, elegirCarga } from "../app/nucleo/modelo.js";
import { validarRegistro } from "../app/nucleo/registro.js";
import { resumirProyecto, resumirEmpresa, crearBitacora, clasificarEvento, siguienteConAtencion, VENTANA_RECIENTE_MS } from "../app/nucleo/sala.js";

export function registrarCasosFaseK(leerTexto) {
  const leerJSON = async (ruta) => JSON.parse(await leerTexto(ruta));
  const compago = { id: "compago", nombre: "Compago" };
  const real = async (desplazar = 0, cambiar = null) => {
    const doc = await leerJSON("contrato/ejemplos/compago-exportador.json");
    if (cambiar) cambiar(doc);
    const ahora = new Date(Date.parse(doc.generado_en) + 60_000 + desplazar);
    return construirModeloVista({ proyecto: compago, carga: { tipo: "ok", datos: doc }, origen: "real", ahora });
  };
  const demo = async (entrada, ruta) => {
    const e = elegirCarga({ tipo: "no_encontrado" }, { tipo: "ok", datos: await leerJSON(ruta) });
    return construirModeloVista({ proyecto: entrada, carga: e.carga, origen: e.origen, nota_origen: e.nota, ahora: new Date() });
  };
  const sinArchivo = (entrada) => construirModeloVista({ proyecto: entrada, carga: { tipo: "no_encontrado" }, ahora: new Date() });

  prueba("K · registro: pendiente y color opcionales; valores inválidos se ignoran con aviso", () => {
    const r = validarRegistro({ proyectos: [
      { id: "a", nombre: "A", estado: "datos/reales/a.json", pendiente: "Sin repositorio", color: "#A1B2C3" },
      { id: "b", nombre: "B", estado: "datos/reales/b.json", pendiente: 5, color: "rojo" },
    ] });
    igual([r.proyectos[0].pendiente, r.proyectos[0].color], ["Sin repositorio", "#a1b2c3"]);
    igual([r.proyectos[1].pendiente, r.proyectos[1].color], [undefined, undefined]);
    igual(r.avisos.length, 2);
  });

  prueba("K · registro del repositorio: Tezcatlipoca, CauceService y Repacar pendientes; Repacar sin decidir si son uno o dos", async () => {
    const { proyectos } = validarRegistro(await leerJSON("datos/proyectos.json"));
    const pend = proyectos.filter((p) => p.pendiente).map((p) => p.id);
    igual(pend, ["tezcatlipoca", "cauceservice", "repacar"]);
    verdadero(/uno o dos/.test(proyectos.find((p) => p.id === "repacar").pendiente));
    verdadero(proyectos.every((p) => !p.demo || ["compago", "ek-chuah", "csi"].includes(p.id)), "ningún pendiente trae demostración inventada (CSI: caso ficticio propio, no un proyecto externo)");
  });

  prueba("K · sala: proyecto sin archivo y pendiente = «pendiente», sin conexión, sin agentes ni asuntos", () => {
    const e = { id: "cauceservice", nombre: "CauceService", pendiente: "Sin localizar" };
    const r = resumirProyecto(e, sinArchivo(e));
    igual([r.clave, r.agentes, r.trabajando, r.atencion.length], ["pendiente", 0, 0, 0]);
    const emp = resumirEmpresa([r]);
    igual([emp.sin_conexion, emp.real, emp.demo], [1, 0, 0]);
  });

  prueba("K · sala: DEMO y REAL se cuentan por separado (nunca se suman)", async () => {
    const mReal = await real();
    const mDemo = await demo({ id: "ek-chuah", nombre: "Ek Chuah" }, "datos/demo/ek-chuah.json");
    const emp = resumirEmpresa([resumirProyecto(compago, mReal), resumirProyecto({ id: "ek-chuah", nombre: "Ek Chuah" }, mDemo)]);
    igual([emp.real, emp.demo], [1, 1]);
    igual(emp.trabajando_real, mReal.departamentos.flatMap((d) => d.agentes).filter((a) => a.estado_mostrado === "trabajando").length);
    verdadero(emp.atencion.filter((a) => a.proyecto_id === "ek-chuah").every((a) => a.es_demo), "lo de DEMO va marcado");
    verdadero(emp.atencion.filter((a) => a.proyecto_id === "compago").every((a) => !a.es_demo));
  });

  prueba("K · sala: datos vencidos = «desactualizado», 0 trabajando y un asunto «Información vencida»", async () => {
    const r = resumirProyecto(compago, await real(3 * 3600 * 1000));
    igual([r.clave, r.trabajando, r.vigente], ["desactualizado", 0, false]);
    verdadero(r.atencion.some((a) => a.tipo === "vencido"));
    verdadero(r.atencion.filter((a) => a.tipo === "alerta").every((a) => a.vigente === false), "alertas de un archivo vencido van marcadas como no vigentes");
  });

  prueba("K · sala: archivo inválido = «invalido» y asunto de archivo; JSON dañado no se tapa", () => {
    const m = construirModeloVista({ proyecto: compago, carga: { tipo: "json_invalido", mensaje: "x" }, ahora: new Date() });
    const r = resumirProyecto(compago, m);
    igual([r.clave, r.atencion[0].tipo], ["invalido", "archivo"]);
  });

  prueba("K · sala: orden de «Requiere atención»: crítica/errores, luego advertencias/revisiones, luego vencidos; REAL antes que DEMO", () => {
    const item = (nivel, es_demo) => ({ nivel, es_demo, vigente: true, tipo: "alerta", titulo: nivel });
    const r = (id, lista) => ({ id, nombre: id, clave: "real", trabajando: 0, atencion: lista });
    const emp = resumirEmpresa([r("a", [item("info", false), item("advertencia", true)]), r("b", [item("desactualizado", false), item("critica", true), item("error", false), item("advertencia", false)])]);
    igual(emp.atencion.map((a) => `${a.nivel}${a.es_demo ? "·demo" : ""}`), ["error", "critica·demo", "advertencia", "advertencia·demo", "desactualizado", "info"]);
  });

  prueba("K · bitácora: la primera lectura de cada proyecto no produce eventos; los cambios llevan proyecto, depto y agente", async () => {
    const b = crearBitacora();
    igual(b.leer(await real(), 1000).length, 0);
    const otra = await real(0, (d) => {
      d.generado_en = new Date(Date.parse(d.generado_en) + 1000).toISOString();
      d.departamentos.find((x) => x.id === "busqueda").agentes[0].estado = "esperando";
    });
    const nuevos = b.leer(otra, 2000);
    igual(nuevos.length, 1);
    igual([nuevos[0].proyecto_id, nuevos[0].departamento_id, nuevos[0].agente_id, nuevos[0].observado_ms], ["compago", "busqueda", "buscador", 2000]);
    igual(b.eventos({ departamento_id: "busqueda" }).length, 1);
    igual(b.eventos({ departamento_id: "importacion" }).length, 0);
    igual(b.eventos({ proyecto_id: "ek-chuah" }).length, 0);
  });

  prueba("K · bitácora: dos proyectos no se comparan entre sí y la lista tiene tope", async () => {
    const b = crearBitacora({ maximo: 3 });
    const m1 = await real();
    const m2 = { ...m1, proyecto: { id: "otro", nombre: "Otro" } };
    b.leer(m1, 1); b.leer(m2, 2);
    igual(b.eventos().length, 0);
    for (let i = 1; i <= 5; i++) {
      const m = await real(0, (d) => { d.generado_en = new Date(Date.parse(d.generado_en) + i * 1000).toISOString(); d.alertas.push({ ...d.alertas[0], id: `x${i}` }); });
      b.leer(m, 10 + i);
    }
    igual(b.eventos().length, 3);
  });

  prueba("K · historial: categorías (error, finalización, vencida, alerta, estado) y reciente vs. anterior", () => {
    const t = 10_000_000;
    const c = (x) => clasificarEvento({ observado_ms: t - 1000, ...x }, t);
    igual(c({ tipo: "estado", de: "trabajando", a: "error" }).categoria, "error");
    igual(c({ tipo: "alerta_nueva", nivel: "critica" }).categoria, "error");
    igual(c({ tipo: "estado", de: "trabajando", a: "finalizado" }).categoria, "finalizacion");
    igual(c({ tipo: "conexion", de: "En línea", a: "Datos desactualizados" }).categoria, "vencida");
    igual(c({ tipo: "alerta_nueva", nivel: "advertencia" }).categoria, "alerta");
    igual(c({ tipo: "estado", de: "esperando", a: "trabajando" }).categoria, "estado");
    igual(c({ tipo: "fuente", de: "DEMO", a: "REAL" }).categoria, "fuente");
    igual(c({ tipo: "estado", a: "esperando" }).reciente, true);
    igual(clasificarEvento({ tipo: "estado", a: "esperando", observado_ms: t - VENTANA_RECIENTE_MS - 1 }, t).reciente, false);
    igual(clasificarEvento({ tipo: "estado", a: "esperando" }, t).reciente, false, "sin hora de observación no se presume reciente");
  });

  prueba("K · siguiente con atención: recorre en el orden del archivo y da la vuelta; sin asuntos = null", async () => {
    const m = await real();
    const ids = m.departamentos.filter((d) => d.alertas.length || d.agentes.some((a) => ["error", "requiere_revision"].includes(a.estado_mostrado))).map((d) => d.id);
    verdadero(ids.length >= 2);
    igual(siguienteConAtencion(m.departamentos, null).id, ids[0]);
    igual(siguienteConAtencion(m.departamentos, ids[0]).id, ids[1]);
    igual(siguienteConAtencion(m.departamentos, ids[ids.length - 1]).id, ids[0]);
    const vencido = await real(3 * 3600 * 1000);
    const sinAlertas = vencido.departamentos.map((d) => ({ ...d, alertas: [] }));
    igual(siguienteConAtencion(sinAlertas, null), null, "datos vencidos: nadie en error por el archivo viejo");
  });

  prueba("K · el color de identidad del registro llega al modelo sin tocar el contrato", async () => {
    const m = construirModeloVista({ proyecto: { id: "compago", nombre: "Compago", color: "#e0a458" }, carga: { tipo: "no_encontrado" }, ahora: new Date() });
    igual(m.proyecto, { id: "compago", nombre: "Compago", color: "#e0a458" });
    const sin = construirModeloVista({ proyecto: compago, carga: { tipo: "no_encontrado" }, ahora: new Date() });
    igual(sin.proyecto, { id: "compago", nombre: "Compago" });
  });
}
