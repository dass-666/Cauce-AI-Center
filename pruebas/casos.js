// Casos de prueba del contrato, los estados y el modelo de vista.
// `leerTexto(ruta)` lo da quien ejecuta: Node lee del disco; el navegador usa fetch.

import { prueba, igual, verdadero } from "./mini.js";
import { validarDocumento, esEnlaceSeguro } from "../app/nucleo/contrato.js";
import { ESTADOS, NOMBRES_ESTADOS, estadoResumen } from "../app/nucleo/estados.js";
import { construirModeloVista, elegirCarga } from "../app/nucleo/modelo.js";
import { ANIMACIONES_SOPORTADAS, ACCIONES, BUCLES, planDeTransicion, variacion, gestoOcasional } from "../app/vistas/vista3d/maquina.js";
import { tamanoCuarto, puestos, puerta, camino, longitudCamino, puntoEnCamino, huella, MEDIDAS } from "../app/vistas/vista3d/disposicion.js";
import { COLOR_ESTADO, aspecto } from "../app/vistas/vista3d/paleta.js";
import { distribuirEdificio, seEnciman, fondoNecesario, EDIFICIO } from "../app/vistas/vista3d/plano-edificio.js";
import { crearMedidor, firmaMedicion } from "../app/vistas/vista3d/medidor.js";
import { fotografia, compararLecturas, crearRegistroCambios } from "../app/nucleo/cambios.js";
import { textoCambio } from "../app/vistas/tablero.js";
import { calcularEncuadre, aPixeles, dentro } from "../app/vistas/vista3d/encuadre.js";
import { acomodarEtiquetas, nombresCortos, prioridadEtiqueta } from "../app/vistas/vista3d/etiquetas.js";
import { temaDe, acentoDe } from "../app/vistas/vista3d/identidad.js";
import { luzSegunHora, LUZ_FIJA, HEMI_MINIMA } from "../app/vistas/vista3d/iluminacion.js";
import { vecinoDe, resumenDepartamento } from "../app/vistas/vista3d/navegacion.js";

export function registrarCasos(leerTexto) {
  const leerJSON = async (ruta) => JSON.parse(await leerTexto(ruta));
  const copia = (o) => JSON.parse(JSON.stringify(o));
  const minimo = () => leerJSON("contrato/ejemplos/minimo.json");
  const ahoraMinimo = new Date("2026-11-03T16:05:00Z"); // 5 min después de generado_en
  const agente0 = (r) => r.documento.departamentos[0].agentes[0];
  const errorQueContiene = (r, texto) => verdadero(!r.valido && r.errores.some((e) => e.includes(texto)), `Se esperaba un error con "${texto}": ${JSON.stringify(r.errores)}`);

  // ---------- Contrato: archivos válidos ----------
  prueba("El ejemplo mínimo del contrato es válido", async () => {
    const r = validarDocumento(await minimo());
    igual(r.errores, []);
    igual(r.avisos, []);
  });

  for (const nombre of ["ek-chuah", "compago"]) {
    prueba(`La demostración de ${nombre} es válida y está marcada como demo`, async () => {
      const r = validarDocumento(await leerJSON(`datos/demo/${nombre}.json`));
      verdadero(r.valido, JSON.stringify(r.errores));
      igual(r.documento.es_demo, true);
      igual(r.documento.fuente.tipo, "demo");
    });
  }

  prueba("Cada texto de actividad o evidencia de las demostraciones lleva [DEMO]", async () => {
    for (const nombre of ["ek-chuah", "compago"]) {
      const d = await leerJSON(`datos/demo/${nombre}.json`);
      for (const dep of d.departamentos)
        for (const a of dep.agentes) {
          if (a.actividad?.descripcion) verdadero(a.actividad.descripcion.startsWith("[DEMO]"), `${nombre}/${a.id}: actividad sin [DEMO]`);
          if (a.evidencia) verdadero(a.evidencia.referencia.startsWith("[DEMO]"), `${nombre}/${a.id}: evidencia sin [DEMO]`);
        }
      for (const x of [...d.alertas, ...d.resultados]) verdadero(x.titulo.startsWith("[DEMO]"), `${nombre}/${x.id}: sin [DEMO]`);
    }
  });

  // ---------- Contrato: archivos inválidos ----------
  const casosInvalidos = [
    ["contrato equivocado", (d) => { d.contrato = "otro"; }, '"contrato"'],
    ["versión mayor no soportada", (d) => { d.version = "2.0.0"; }, "no compatible"],
    ["versión mal escrita", (d) => { d.version = "1.0"; }, '"version"'],
    ["sin es_demo", (d) => { delete d.es_demo; }, '"es_demo"'],
    ["demo sin hora simulada", (d) => { d.es_demo = true; d.fuente.tipo = "demo"; }, "ahora_simulado"],
    ["bloque demo en datos reales", (d) => { d.demo = { ahora_simulado: "2026-11-03T16:00:00Z" }; }, '"demo" solo'],
    ["fuente demo con es_demo false", (d) => { d.fuente.tipo = "demo"; }, "debe coincidir"],
    ["fecha sin zona horaria", (d) => { d.generado_en = "2026-11-03T16:00:00"; }, '"generado_en"'],
    ["vigencia demasiado corta", (d) => { d.vigencia_segundos = 5; }, '"vigencia_segundos"'],
    ["sin departamentos", (d) => { d.departamentos = []; }, '"departamentos"'],
    ["id de proyecto con mayúsculas", (d) => { d.proyecto.id = "Ek Chuah"; }, '"proyecto"'],
    ["departamento repetido", (d) => { d.departamentos.push({ ...copia(d.departamentos[0]), agentes: [] }); }, "repetido"],
    ["personaje repetido en otro departamento", (d) => { d.departamentos.push({ id: "otro", nombre: "Otro", agentes: copia(d.departamentos[0].agentes) }); }, "repetido en el proyecto"],
    ["estado inexistente", (d) => { d.departamentos[0].agentes[0].estado = "pensando"; }, "no existe"],
    ["personaje sin rol", (d) => { delete d.departamentos[0].agentes[0].rol; }, '"rol"'],
  ];
  for (const [nombre, cambiar, texto] of casosInvalidos) {
    prueba(`Rechaza: ${nombre}`, async () => {
      const d = await minimo();
      cambiar(d);
      errorQueContiene(validarDocumento(d), texto);
    });
  }

  prueba("Rechaza algo que no es un objeto", () => {
    for (const v of [null, [], "texto", 3]) verdadero(!validarDocumento(v).valido);
  });

  // ---------- Reglas de integridad: no inventar actividad ----------
  prueba('"trabajando" sin evidencia se muestra como "sin información"', async () => {
    const d = await minimo();
    delete d.departamentos[0].agentes[0].evidencia;
    const r = validarDocumento(d);
    verdadero(r.valido);
    igual(agente0(r).estado, "sin_datos");
    igual(agente0(r).estado_reportado, "trabajando");
    verdadero(r.avisos.length === 1 && agente0(r).notas.length === 1);
  });

  prueba('"trabajando" sin hora de inicio se muestra como "sin información"', async () => {
    const d = await minimo();
    delete d.departamentos[0].agentes[0].actividad.inicio;
    igual(agente0(validarDocumento(d)).estado, "sin_datos");
  });

  prueba('"trabajando" con evidencia incompleta se muestra como "sin información"', async () => {
    const d = await minimo();
    d.departamentos[0].agentes[0].evidencia = { origen: "fetch_log" };
    igual(agente0(validarDocumento(d)).estado, "sin_datos");
  });

  prueba("El progreso incoherente no se muestra", async () => {
    for (const p of [{ hecho: 5, total: 3 }, { hecho: 1, total: 0 }, { hecho: 1.5, total: 3 }, { hecho: -1, total: 3 }, "50%"]) {
      const d = await minimo();
      d.departamentos[0].agentes[0].actividad.progreso = p;
      const r = validarDocumento(d);
      igual(agente0(r).actividad.progreso, null, JSON.stringify(p));
      verdadero(r.avisos.length === 1);
    }
  });

  prueba("El progreso coherente se conserva", async () => {
    const d = await minimo();
    d.departamentos[0].agentes[0].actividad.progreso = { hecho: 1240, total: 2000, unidad: "filas" };
    igual(agente0(validarDocumento(d)).actividad.progreso, { hecho: 1240, total: 2000, unidad: "filas" });
  });

  prueba("Una fecha de fin anterior al inicio se descarta", async () => {
    const d = await minimo();
    const a = d.departamentos[0].agentes[0];
    a.estado = "finalizado";
    a.actividad.fin = "2026-11-03T15:00:00Z";
    igual(agente0(validarDocumento(d)).actividad.fin, null);
  });

  prueba("Un error sin mensaje recibe un texto que lo dice, sin inventar la causa", async () => {
    const d = await minimo();
    d.departamentos[0].agentes[0].estado = "error";
    const a = agente0(validarDocumento(d));
    igual(a.estado, "error");
    verdadero(a.error.mensaje.includes("no informó"));
  });

  prueba("Los campos desconocidos no pasan al modelo", async () => {
    const d = await minimo();
    d.departamentos[0].agentes[0].html = "<img src=x onerror=alert(1)>";
    verdadero(!("html" in agente0(validarDocumento(d))));
  });

  // ---------- Enlaces ----------
  prueba("Enlaces peligrosos se rechazan y los seguros se aceptan", () => {
    for (const malo of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,x", "file:///C:/x", "//otro.sitio/x", "\\\\servidor\\x", ""]) {
      verdadero(!esEnlaceSeguro(malo), `debió rechazar ${malo}`);
    }
    for (const bueno of ["https://ejemplo.mx/a", "http://127.0.0.1:8000/x", "datos/informe.html", "informe.html#parte"]) {
      verdadero(esEnlaceSeguro(bueno), `debió aceptar ${bueno}`);
    }
  });

  prueba("C4: enlaces que el navegador convertiría en javascript: se rechazan", () => {
    // El navegador quita espacios iniciales y tabuladores/saltos dentro del esquema antes de interpretar el enlace.
    for (const malo of [" javascript:alert(1)", "\tjavascript:alert(1)", "java\tscript:alert(1)", "java\nscript:alert(1)", "javascript\r:alert(1)",
      "\u0000javascript:alert(1)", "/\\otro.sitio/x", "vbscript:x", "https://ejemplo.mx/a "]) {
      verdadero(!esEnlaceSeguro(malo), `debió rechazar ${JSON.stringify(malo)}`);
    }
    for (const bueno of ["docs/mi informe.html", "./a/b?c=1", "https://ejemplo.mx/a?b=c#d"]) verdadero(esEnlaceSeguro(bueno), bueno);
  });

  prueba("Un resultado con enlace peligroso conserva el título pero pierde el enlace", async () => {
    const d = await minimo();
    d.resultados = [{ id: "r1", titulo: "Informe", enlace: "javascript:alert(1)" }];
    const r = validarDocumento(d);
    igual(r.documento.resultados[0].enlace, null);
    igual(r.avisos.length, 1);
  });

  // ---------- Estados ----------
  prueba("Hay exactamente seis estados", () => {
    igual(NOMBRES_ESTADOS, ["trabajando", "esperando", "finalizado", "error", "requiere_revision", "sin_datos"]);
  });

  prueba("Cada estado tiene apariencia 2D, animación 3D y prioridad únicas", () => {
    const campos = ["etiqueta", "descripcion", "icono", "clase2d", "animacion3d"];
    for (const [n, e] of Object.entries(ESTADOS)) for (const c of campos) verdadero(typeof e[c] === "string" && e[c], `${n}.${c}`);
    for (const c of ["clase2d", "animacion3d", "prioridad"]) {
      const valores = Object.values(ESTADOS).map((e) => e[c]);
      igual(new Set(valores).size, valores.length, `${c} repetido`);
    }
  });

  prueba("La hoja de estilos define cada clase de estado", async () => {
    const css = await leerTexto("app/estilos.css");
    for (const e of Object.values(ESTADOS)) verdadero(css.includes(`.${e.clase2d}`), `Falta .${e.clase2d} en estilos.css`);
  });

  prueba("El resumen de un departamento muestra lo más urgente", () => {
    igual(estadoResumen(["finalizado", "trabajando", "error"]), "error");
    igual(estadoResumen(["esperando", "requiere_revision", "trabajando"]), "requiere_revision");
    igual(estadoResumen(["esperando", "trabajando"]), "trabajando");
    igual(estadoResumen([]), "sin_datos");
  });

  // ---------- Modelo de vista: conexión y desconexión ----------
  const proyecto = { id: "ejemplo", nombre: "Proyecto de ejemplo" };

  prueba("Archivo inexistente: sin conexión y ningún personaje", () => {
    const m = construirModeloVista({ proyecto, carga: { tipo: "no_encontrado" }, ahora: ahoraMinimo });
    igual(m.conexion, "desconectado");
    igual(m.departamentos.length, 0);
    verdadero(m.motivo.includes("No existe"));
  });

  prueba("Archivo que no es JSON: archivo inválido", () => {
    igual(construirModeloVista({ proyecto, carga: { tipo: "json_invalido" }, ahora: ahoraMinimo }).conexion, "invalido");
  });

  prueba("Archivo que no cumple el contrato: inválido con la lista de errores", async () => {
    const d = await minimo();
    d.version = "9.0.0";
    const m = construirModeloVista({ proyecto, carga: { tipo: "ok", datos: d }, ahora: ahoraMinimo });
    igual(m.conexion, "invalido");
    verdadero(m.errores.length > 0);
  });

  prueba("Archivo de otro proyecto: inválido", async () => {
    const m = construirModeloVista({ proyecto: { id: "otro", nombre: "Otro" }, carga: { tipo: "ok", datos: await minimo() }, ahora: ahoraMinimo });
    igual(m.conexion, "invalido");
  });

  prueba("Dentro de su vigencia: en línea y con el estado reportado", async () => {
    const m = construirModeloVista({ proyecto, carga: { tipo: "ok", datos: await minimo() }, ahora: ahoraMinimo });
    igual(m.conexion, "en_linea");
    igual(m.departamentos[0].agentes[0].estado_mostrado, "trabajando");
    igual(m.departamentos[0].estado_resumen, "trabajando");
  });

  prueba("Pasada su vigencia: desactualizado y nadie aparece trabajando", async () => {
    const m = construirModeloVista({ proyecto, carga: { tipo: "ok", datos: await minimo() }, ahora: new Date("2026-11-03T18:00:00Z") });
    igual(m.conexion, "desactualizado");
    const a = m.departamentos[0].agentes[0];
    igual(a.estado_mostrado, "sin_datos");
    igual(a.ultimo_estado_conocido, "trabajando");
    igual(m.departamentos[0].estado_resumen, "sin_datos");
  });

  prueba("Hora del archivo en el futuro (más de 5 min): inválido", async () => {
    const m = construirModeloVista({ proyecto, carga: { tipo: "ok", datos: await minimo() }, ahora: new Date("2026-11-03T15:00:00Z") });
    igual(m.conexion, "invalido");
    igual(m.departamentos[0].agentes[0].estado_mostrado, "sin_datos");
  });

  prueba("La demostración usa su hora simulada y no caduca", async () => {
    const d = await leerJSON("datos/demo/compago.json");
    const m = construirModeloVista({ proyecto: { id: "compago", nombre: "Compago" }, carga: { tipo: "ok", datos: d }, ahora: new Date("2030-01-01T00:00:00Z") });
    igual(m.conexion, "en_linea");
    igual(m.hora_simulada, true);
    igual(m.ahora_referencia, "2026-11-03T16:30:00.000Z");
  });

  prueba("Demostración de Ek Chuah: el simulador sin evidencia no aparece trabajando", async () => {
    const d = await leerJSON("datos/demo/ek-chuah.json");
    const m = construirModeloVista({ proyecto: { id: "ek-chuah", nombre: "Ek Chuah" }, carga: { tipo: "ok", datos: d }, ahora: new Date() });
    const sim = m.departamentos.find((x) => x.id === "simulaciones").agentes[0];
    igual(sim.estado_mostrado, "sin_datos");
    igual(m.avisos.length, 1);
  });

  prueba("Demostración de Compago: la importación no inventa porcentaje de avance", async () => {
    const d = await leerJSON("datos/demo/compago.json");
    const m = construirModeloVista({ proyecto: { id: "compago", nombre: "Compago" }, carga: { tipo: "ok", datos: d }, ahora: new Date() });
    const imp = m.departamentos.find((x) => x.id === "importacion").agentes[0];
    igual(imp.estado_mostrado, "trabajando");
    igual(imp.actividad.progreso, null);
  });

  prueba("Las demostraciones cubren los seis estados entre ambos proyectos", async () => {
    const vistos = new Set();
    for (const id of ["ek-chuah", "compago"]) {
      const m = construirModeloVista({ proyecto: { id, nombre: id }, carga: { tipo: "ok", datos: await leerJSON(`datos/demo/${id}.json`) }, ahora: new Date() });
      for (const dep of m.departamentos) for (const a of dep.agentes) vistos.add(a.estado_mostrado);
    }
    igual([...vistos].sort(), [...NOMBRES_ESTADOS].sort());
  });

  // ---------- Distribución de la escena (la usarán 2D y 3D) ----------
  prueba("Las posiciones vienen de la distribución y lo que falta se acomoda debajo", async () => {
    const d = await leerJSON("datos/demo/compago.json");
    const dist = await leerJSON("escena/compago.json");
    const m = construirModeloVista({ proyecto: { id: "compago", nombre: "Compago" }, carga: { tipo: "ok", datos: d }, distribucion: dist, ahora: new Date() });
    const pos = Object.fromEntries(m.departamentos.map((x) => [x.id, x.posicion]));
    igual(pos.importacion, { x: 0, y: 0, ancho: 2, alto: 1, piso: 0, automatica: false });
    igual(pos.uniq.automatica, true);
    igual(pos.uniq.y, 2);
    igual(m.cuadricula.columnas, 4);
  });

  prueba("Sin distribución, todos los departamentos se acomodan sin encimarse", async () => {
    const d = await leerJSON("datos/demo/ek-chuah.json");
    const m = construirModeloVista({ proyecto: { id: "ek-chuah", nombre: "Ek Chuah" }, carga: { tipo: "ok", datos: d }, ahora: new Date() });
    const celdas = m.departamentos.map((x) => `${x.posicion.x},${x.posicion.y}`);
    igual(new Set(celdas).size, celdas.length);
  });

  prueba("Cada departamento de las demostraciones tiene lugar en su distribución o se acomoda", async () => {
    for (const id of ["ek-chuah", "compago"]) {
      const dist = await leerJSON(`escena/${id}.json`);
      igual(dist.proyecto_id, id);
      const d = await leerJSON(`datos/demo/${id}.json`);
      const ids = new Set(d.departamentos.map((x) => x.id));
      for (const k of Object.keys(dist.departamentos)) verdadero(ids.has(k), `${id}: la distribución menciona "${k}", que no existe`);
    }
  });

  // ---------- Fase 2: cambio de DEMO a REAL ----------
  const demoOk = { tipo: "ok", datos: { demo: true } };
  prueba("Sin archivo real se muestra la demostración, con una nota", () => {
    const e = elegirCarga({ tipo: "no_encontrado" }, demoOk);
    igual(e.origen, "demo");
    verdadero(e.nota.includes("demostración"));
  });
  prueba("Con archivo real válido se muestran los datos reales", () => {
    const real = { tipo: "ok", datos: { real: true } };
    igual(elegirCarga(real, demoOk).carga, real);
  });
  prueba("Un archivo real dañado NO se tapa con la demostración", () => {
    igual(elegirCarga({ tipo: "json_invalido" }, demoOk).origen, "real");
    igual(elegirCarga({ tipo: "error_red" }, demoOk).origen, "real");
  });
  prueba("Sin archivo real ni demostración: sin conexión", () => {
    const e = elegirCarga({ tipo: "no_encontrado" }, null);
    igual(construirModeloVista({ proyecto, carga: e.carga, ahora: ahoraMinimo }).conexion, "desconectado");
  });

  prueba("Una exportación real de Compago (exportar_cauce) cumple el contrato", async () => {
    const d = await leerJSON("contrato/ejemplos/compago-exportador.json");
    const r = validarDocumento(d);
    verdadero(r.valido, JSON.stringify(r.errores));
    igual(r.avisos, []);
    igual(d.es_demo, false);
    igual(d.fuente.tipo, "adaptador");
  });
  prueba("La exportación de Compago encaja con la escena de Compago", async () => {
    const d = await leerJSON("contrato/ejemplos/compago-exportador.json");
    const dist = await leerJSON("escena/compago.json");
    const ids = new Set(d.departamentos.map((x) => x.id));
    for (const k of Object.keys(dist.departamentos)) verdadero(ids.has(k), `escena menciona ${k}`);
  });
  prueba("La exportación de Compago se marca desactualizada al pasar su vigencia", async () => {
    const d = await leerJSON("contrato/ejemplos/compago-exportador.json");
    const tarde = new Date(Date.parse(d.generado_en) + (d.vigencia_segundos + 1) * 1000);
    const m = construirModeloVista({ proyecto: { id: "compago", nombre: "Compago" }, carga: { tipo: "ok", datos: d }, ahora: tarde });
    igual(m.conexion, "desactualizado");
    verdadero(m.departamentos.every((x) => x.agentes.every((a) => a.estado_mostrado === "sin_datos")));
  });

  // ---------- Vista 3D: máquina de estados ----------
  prueba("3D: cada estado tiene animación y color 3D", () => {
    for (const n of NOMBRES_ESTADOS) {
      verdadero(ANIMACIONES_SOPORTADAS.includes(ESTADOS[n].animacion3d), `${n} sin animación 3D soportada`);
      verdadero(Number.isInteger(COLOR_ESTADO[n]), `${n} sin color 3D`);
    }
  });
  prueba("3D: sin datos = silla vacía (el personaje no aparece)", () => {
    igual(planDeTransicion(null, "ausente"), { pasos: [], bucle: null, presente: false, postura: "fuera" });
  });
  prueba("C3: la primera lectura no muestra gestos ni llegadas que no se observaron", () => {
    for (const b of ANIMACIONES_SOPORTADAS) {
      const plan = planDeTransicion(null, b);
      igual(plan.pasos, [], `${b}: aparece ya en su postura`);
    }
    igual(planDeTransicion(null, "sentado_tecleando"), { pasos: [], bucle: "teclear", presente: true, postura: "sentado" });
    igual(planDeTransicion(null, "estirarse").bucle, "relajado", "finalizado: relajado, sin celebrar");
    igual(planDeTransicion(null, "de_pie_alerta").postura, "de_pie");
  });
  prueba("C3: misma animación en dos lecturas = sin pasos", () => {
    for (const b of ANIMACIONES_SOPORTADAS) igual(planDeTransicion(b, b).pasos, [], b);
  });
  prueba("C3: cambio observado a finalizado: se levanta, celebra y vuelve a sentarse", () => {
    igual(planDeTransicion("sentado_tecleando", "estirarse").pasos, ["levantarse", "celebrar", "sentarse"]);
  });
  prueba("C3: cambio observado a error: reacciona y queda de pie; a revisión: llama la atención sentado", () => {
    igual(planDeTransicion("sentado_tecleando", "de_pie_alerta"), { pasos: ["levantarse", "reaccion_error"], bucle: "alerta", presente: true, postura: "de_pie" });
    igual(planDeTransicion("sentado_en_reposo", "levantar_mano").pasos, ["llamar_atencion"]);
    igual(planDeTransicion("de_pie_alerta", "levantar_mano").pasos, ["sentarse", "llamar_atencion"]);
    igual(planDeTransicion("sentado_tecleando", "sentado_en_reposo").pasos, [], "de trabajando a esperando no se levanta");
  });
  prueba("C3: llegada observada entra caminando sin celebrar lo que no vimos", () => {
    igual(planDeTransicion("ausente", "estirarse").pasos, ["entrar", "sentarse"]);
    igual(planDeTransicion("ausente", "de_pie_alerta").pasos, ["entrar"]);
    igual(planDeTransicion("ausente", "sentado_tecleando").pasos, ["entrar", "sentarse"]);
  });
  prueba("C3: al perder la evidencia se levanta y sale", () => {
    igual(planDeTransicion("sentado_tecleando", "ausente").pasos, ["levantarse", "salir"]);
    igual(planDeTransicion("de_pie_alerta", "ausente").pasos, ["salir"]);
  });
  prueba("C3: los bucles no incluyen gestos de transición", () => {
    for (const g of ["celebrar", "reaccion_error", "llamar_atencion", "entrar", "salir"]) verdadero(!BUCLES.includes(g), g);
    for (const b of ANIMACIONES_SOPORTADAS) { const x = planDeTransicion(null, b).bucle; verdadero(x === null || BUCLES.includes(x), b); }
  });
  prueba("C3: variación determinista por id, sin moverse al unísono", () => {
    const ids = ["importador", "importador-cola", "auditora", "buscador", "revisor", "evaluador", "margenes", "supervisor"];
    const vs = ids.map((id) => variacion(huella(id)));
    igual(variacion(huella("auditora")), variacion(huella("auditora")));
    for (const v of vs) { verdadero(v.ritmo >= 0.85 && v.ritmo <= 1.15); verdadero(v.periodo >= 7 && v.periodo <= 13.1); }
    verdadero(new Set(vs.map((v) => v.fase.toFixed(3))).size >= 6, "fases distintas");
    // El gesto ocasional ocupa poco tiempo y no todos a la vez.
    let activo = 0, simultaneo = 0;
    for (let r = 0; r < 120; r += 0.1) {
      const n = vs.filter((v) => gestoOcasional(r, v) > 0).length;
      activo += n; if (n === vs.length) simultaneo++;
    }
    verdadero(activo / (1200 * vs.length) < 0.3, "ocasional, no continuo");
    igual(simultaneo, 0, "nunca todos al mismo tiempo");
  });
  prueba("3D: todas las transiciones usan solo acciones conocidas y terminan en postura válida", () => {
    for (const a of [null, ...ANIMACIONES_SOPORTADAS]) {
      for (const b of ANIMACIONES_SOPORTADAS) {
        const plan = planDeTransicion(a, b);
        for (const paso of plan.pasos) verdadero(ACCIONES.includes(paso), `${a}→${b}: ${paso}`);
        igual(plan.presente, b !== "ausente", `${a}→${b}`);
      }
    }
  });
  prueba("3D: una animación desconocida es un error, no un personaje inventado", () => {
    let lanzo = false;
    try { planDeTransicion(null, "bailar"); } catch { lanzo = true; }
    verdadero(lanzo);
  });

  // ---------- Vista 3D: distribución ----------
  prueba("3D: los escritorios caben dentro del cuarto", () => {
    for (const n of [1, 2, 5, 9]) {
      const c = tamanoCuarto({ ancho: 1, alto: 1 }, 4, n);
      const ps = puestos(n, c);
      igual(ps.length, n);
      for (const p of ps) {
        verdadero(Math.abs(p.x) + 0.65 <= c.ancho / 2, `n=${n} x=${p.x} fuera (ancho ${c.ancho})`);
        verdadero(p.z - 0.35 >= -c.fondo / 2 && p.z + 0.75 + 0.6 <= c.fondo / 2, `n=${n} z=${p.z} fuera (fondo ${c.fondo})`);
      }
    }
  });
  prueba("3D: el camino va de la puerta a la silla y puntoEnCamino respeta los extremos", () => {
    const c = tamanoCuarto({ ancho: 2, alto: 1 }, 4, 2);
    const p = puestos(2, c)[1];
    const r = camino(c, p);
    igual(r[0], puerta(c));
    igual(r[r.length - 1], { x: p.x, z: Math.round((p.z + 0.75) * 1000) / 1000 });
    const L = longitudCamino(r);
    verdadero(L > 0);
    const fin = puntoEnCamino(r, L + 5);
    const cerca = (a, b) => Math.abs(a - b) < 1e-9;
    verdadero(cerca(fin.x, r[r.length - 1].x) && cerca(fin.z, r[r.length - 1].z), "termina en la silla");
    const ini = puntoEnCamino(r, -1);
    igual([ini.x, ini.z], [r[0].x, r[0].z]);
  });
  prueba("3D: el cuarto respeta el tamaño mínimo", () => {
    const c = tamanoCuarto(null, 1, 1);
    verdadero(c.ancho >= MEDIDAS.minimoAncho && c.fondo >= MEDIDAS.minimoFondo);
  });
  prueba("3D: el mismo agente siempre se ve igual", () => {
    igual(aspecto(huella("importador")), aspecto(huella("importador")));
    verdadero(huella("importador") !== huella("importador-cola"));
  });

  // ---------- Vista 3D: three.js copiado y mapa de importación ----------
  prueba("3D: three.js copiado es la versión 0.187.0 con licencia MIT", async () => {
    verdadero((await leerTexto("vendor/three/build/three.core.js")).includes("const REVISION = '187';"), "REVISION 187");
    verdadero((await leerTexto("vendor/three/LICENSE")).includes("The MIT License"), "licencia MIT");
  });
  prueba("3D: el mapa de importación de index.html apunta a archivos que existen", async () => {
    const html = await leerTexto("index.html");
    const mapa = JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports;
    await leerTexto(mapa.three.replace("./", ""));
    for (const f of ["loaders/GLTFLoader.js", "utils/SkeletonUtils.js", "utils/BufferGeometryUtils.js", "controls/OrbitControls.js", "postprocessing/EffectComposer.js", "postprocessing/UnrealBloomPass.js", "postprocessing/OutputPass.js", "postprocessing/RenderPass.js"]) {
      await leerTexto(mapa["three/addons/"].replace("./", "") + f);
    }
  });

  prueba("3D: personajes de Kenney presentes y con licencia CC0", async () => {
    const lic = await leerTexto("vendor/kenney-mini-characters/License.txt");
    verdadero(lic.includes("Mini Characters (1.0)") && lic.includes("Creative Commons Zero, CC0"), "License.txt CC0");
    for (const sexo of ["female", "male"]) {
      for (const letra of "abcdef") await leerTexto(`vendor/kenney-mini-characters/character-${sexo}-${letra}.glb`);
    }
    await leerTexto("vendor/kenney-mini-characters/Textures/colormap.png");
    const k = await leerTexto("app/vistas/vista3d/kenney.js");
    for (const sexo of ["female", "male"]) for (const letra of "abcdef") verdadero(k.includes(`"character-${sexo}-${letra}"`), `kenney.js lista character-${sexo}-${letra}`);
  });

  // ---------- Vista 3D: edificio completo ----------
  const edificioCompago = async () => {
    const m = construirModeloVista({
      proyecto: { id: "compago", nombre: "Compago" },
      carga: { tipo: "ok", datos: await leerJSON("datos/demo/compago.json") },
      distribucion: await leerJSON("escena/compago.json"),
      ahora: new Date("2026-11-03T16:30:00Z"),
    });
    const deps = m.departamentos.map((d) => ({ id: d.id, posicion: d.posicion, puestos: Math.max(1, d.agentes.length) }));
    return { deps, plano: distribuirEdificio(deps), modelo: m };
  };
  prueba("Edificio: los 8 departamentos de Compago, sin encimarse y dentro del edificio", async () => {
    const { deps, plano } = await edificioCompago();
    igual(plano.cuartos.length, 8);
    igual(plano.cuartos.map((c) => c.id), deps.map((d) => d.id));
    for (let i = 0; i < plano.cuartos.length; i++) {
      const a = plano.cuartos[i];
      verdadero(Math.abs(a.x) + a.ancho / 2 <= plano.ancho / 2 + 1e-6 && Math.abs(a.z) + a.fondo / 2 <= plano.fondo / 2 + 1e-6, `${a.id} fuera del edificio`);
      for (let j = i + 1; j < plano.cuartos.length; j++) verdadero(!seEnciman(a, plano.cuartos[j]), `${a.id} se encima con ${plano.cuartos[j].id}`);
    }
  });
  prueba("Edificio: cada cuarto cabe sus escritorios y hay pasillo entre filas", async () => {
    const { deps, plano } = await edificioCompago();
    plano.cuartos.forEach((c, i) => verdadero(c.fondo + 1e-6 >= fondoNecesario(c.ancho, deps[i].puestos), `${c.id} sin espacio`));
    verdadero(plano.pasillos.length >= 1, "sin pasillo principal");
    for (const p of plano.pasillos) igual(p.fondo, EDIFICIO.pasilloFilas);
  });
  prueba("Edificio: un departamento con muchos personajes agranda su fila, no se enciman", () => {
    const deps = [
      { id: "a", posicion: { x: 0, y: 0, ancho: 1, alto: 1 }, puestos: 9 },
      { id: "b", posicion: { x: 1, y: 0, ancho: 1, alto: 1 }, puestos: 1 },
      { id: "c", posicion: { x: 0, y: 1, ancho: 2, alto: 1 }, puestos: 1 },
    ];
    const plano = distribuirEdificio(deps);
    verdadero(plano.cuartos[0].fondo >= fondoNecesario(plano.cuartos[0].ancho, 9));
    verdadero(!seEnciman(plano.cuartos[0], plano.cuartos[2]) && !seEnciman(plano.cuartos[1], plano.cuartos[2]));
    igual(distribuirEdificio([]).cuartos, []);
  });

  // --- Medidor de rendimiento (?medir=1) ---
  const firma = (o = {}) => firmaMedicion({ brillo: "sin brillo", modo: "edificio", enfoque: "", tamano: "100x100", ...o });
  // Dibuja `seg` segundos a `cps` cuadros por segundo empezando en t0; devuelve el tiempo final.
  const correr = (m, t0, seg, cps, f = firma()) => {
    let t = t0;
    for (let k = 0; k < seg * cps; k++) { t += 1000 / cps; m.vigilar(f, t); m.cuadro(t); }
    return t;
  };
  prueba("Medidor: promedio, mínimo, peor cuadro y segundos bajo 50 cps", () => {
    const m = crearMedidor({ ventana: 20 });
    let t = correr(m, 0, 5, 60);
    t = correr(m, t, 3, 30);
    const r = m.resumen();
    verdadero(r.segundos >= 7 && r.segundos <= 8, `segundos ${r.segundos}`);
    igual(r.minimo, 30);
    verdadero(r.segundos_bajo_50 >= 2 && r.segundos_bajo_50 <= 3, `bajo 50: ${r.segundos_bajo_50}`);
    verdadero(Math.abs(r.peor_cuadro_ms - 33.3) < 0.2, `peor ${r.peor_cuadro_ms}`);
  });
  prueba("Medidor: la ventana guarda solo los últimos 20 segundos", () => {
    const m = crearMedidor({ ventana: 20 });
    let t = correr(m, 0, 3, 30);
    t = correr(m, t, 25, 60);
    const r = m.resumen();
    igual(r.segundos, 20);
    igual(r.minimo, 60);
    igual(r.segundos_bajo_50, 0);
  });
  for (const [parte, valor] of [["brillo", "brillo"], ["modo", "individual"], ["enfoque", "importacion"], ["tamano", "80x100"]]) {
    prueba(`Medidor: se reinicia al cambiar ${parte} y dice por qué`, () => {
      const m = crearMedidor({ ventana: 20 });
      let t = correr(m, 0, 4, 30);                 // segundos lentos antes del cambio
      t = correr(m, t, 3, 60, firma({ [parte]: valor }));
      const r = m.resumen();
      igual(r.reiniciado_por, parte);
      igual(r.minimo, 60);                         // lo lento de antes ya no cuenta
      igual(r.segundos_bajo_50, 0);
      verdadero(r.peor_cuadro_ms < 17.5, `el hueco del cambio contó como cuadro lento: ${r.peor_cuadro_ms}`);
      verdadero(r.segundos >= 2 && r.segundos <= 3, `segundos ${r.segundos}`);
    });
  }
  prueba("Medidor: sin cambios no se reinicia; tras pausar la pestaña el hueco no cuenta", () => {
    const m = crearMedidor({ ventana: 20 });
    let t = correr(m, 0, 3, 60);
    m.pausa();
    t = correr(m, t + 60000, 3, 60);
    const r = m.resumen();
    igual(r.reiniciado_por, "inicio");
    igual(r.minimo, 60);
    verdadero(r.peor_cuadro_ms < 17.5, `peor ${r.peor_cuadro_ms}`);
  });
  prueba("Medidor: el brillo viene apagado por defecto en la escena 3D", async () => {
    const { readFile } = await import("node:fs/promises").catch(() => ({}));
    if (!readFile) return; // en el navegador se comprueba en la prueba con Playwright
    const src = await readFile(new URL("../app/vistas/vista3d/escena3d.js", import.meta.url), "utf8");
    verdadero(src.includes('leer("cauce.brillo3d") === "1"'), "el brillo debe encenderse solo si el usuario lo eligió");
  });

  // --- Recepción, identidad y luz ---
  prueba("Edificio: la recepción ocupa el espacio libre y no se encima con ningún cuarto", async () => {
    const { plano } = await edificioCompago();
    const r = plano.recepcion;
    verdadero(r && r.ancho > 0 && r.fondo > 0, "sin recepción");
    verdadero(Math.abs(r.x) + r.ancho / 2 <= plano.ancho / 2 + 1e-6 && Math.abs(r.z) + r.fondo / 2 <= plano.fondo / 2 + 1e-6, "recepción fuera del edificio");
    for (const c of plano.cuartos) verdadero(!seEnciman(r, c), `recepción encima de ${c.id}`);
    // Sin huecos en la última fila, la recepción va en una fila nueva al frente.
    const lleno = distribuirEdificio([{ id: "a", posicion: { x: 0, y: 0, ancho: 2, alto: 1 }, puestos: 1 }]);
    verdadero(lleno.recepcion.z > lleno.cuartos[0].z && !seEnciman(lleno.recepcion, lleno.cuartos[0]));
  });
  prueba("Identidad: cada departamento de Compago tiene tema y acento propios", async () => {
    const { deps, modelo } = await edificioCompago();
    const reales = modelo.departamentos;
    igual(new Set(reales.map(temaDe)).size, reales.length, "temas repetidos");
    igual(new Set(reales.map(acentoDe)).size, reales.length, "acentos repetidos");
    igual(temaDe({ id: "importacion", nombre: "Importación de catálogos" }), "importacion");
    verdadero(deps.length >= 7);
  });
  prueba("Luz: según la hora nunca baja del mínimo visible; la fija no cambia", () => {
    for (let h = 0; h < 24; h += 0.5) {
      const l = luzSegunHora(h);
      verdadero(l.hemi >= HEMI_MINIMA, `muy oscuro a las ${h}`);
      verdadero(Number.isInteger(l.cielo) && l.cielo >= 0 && l.cielo <= 0xffffff);
    }
    igual(luzSegunHora(3, true).hemi, LUZ_FIJA.hemi);
    igual(luzSegunHora(12).nombre, "día");
    igual(luzSegunHora(23).nombre, "noche");
  });

  // --- Cambios observados entre lecturas ---
  const lectura = (generado, estados, { conexion = "en_linea", alertas = [], proyecto = "compago" } = {}) => ({
    proyecto: { id: proyecto }, generado_en: generado, conexion, conexion_etiqueta: conexion, es_demo: false,
    departamentos: [{ id: "d", nombre: "Dep", agentes: Object.entries(estados).map(([id, estado]) => ({ id, nombre: id, estado })) }],
    alertas: alertas.map((id) => ({ id, titulo: id, nivel: "advertencia", departamento_id: "d" })),
  });
  prueba("Cambios: detecta un cambio de estado y dice entre qué datos se observó", () => {
    const c = compararLecturas(fotografia(lectura("T1", { a: "esperando" })), fotografia(lectura("T2", { a: "trabajando" })));
    igual(c.length, 1);
    igual(c[0].tipo, "estado");
    igual([c[0].de, c[0].a], ["esperando", "trabajando"]);
    igual(c[0].entre, ["T1", "T2"]);
  });
  prueba("Cambios: la misma lectura no produce actividad; no se inventan pasos intermedios", () => {
    igual(compararLecturas(fotografia(lectura("T1", { a: "esperando" })), fotografia(lectura("T1", { a: "esperando" }))), []);
    const c = compararLecturas(fotografia(lectura("T1", { a: "esperando" })), fotografia(lectura("T3", { a: "finalizado" })));
    igual(c.length, 1, "de esperando a finalizado es un solo cambio observado");
  });
  prueba("Cambios: alertas nuevas y quitadas; agentes nuevos y quitados", () => {
    const c = compararLecturas(fotografia(lectura("T1", { a: "esperando" }, { alertas: ["x"] })), fotografia(lectura("T2", { b: "esperando" }, { alertas: ["y"] })));
    igual(c.map((x) => x.tipo).sort(), ["agente_nuevo", "agente_quitado", "alerta_nueva", "alerta_quitada"]);
  });
  prueba("Cambios: sin archivo válido solo se informa la conexión; otro proyecto empieza de cero", () => {
    const sinArchivo = { ...lectura(null, {}), departamentos: [], alertas: [], conexion: "desconectado", conexion_etiqueta: "Sin conexión" };
    const c = compararLecturas(fotografia(lectura("T1", { a: "trabajando" })), fotografia(sinArchivo));
    igual(c.map((x) => x.tipo), ["conexion"]);
    const r = crearRegistroCambios();
    r.leer(lectura("T1", { a: "esperando" }));
    r.leer(lectura("T2", { a: "trabajando" }));
    igual(r.cambios.length, 1);
    r.leer(lectura("T3", { a: "error" }, { proyecto: "ek-chuah" }));
    igual(r.cambios.length, 0, "cambiar de proyecto no compara contra el anterior");
  });
  prueba("Tablero: el texto de un cambio usa los nombres de estado y no inventa la hora", () => {
    const [c] = compararLecturas(fotografia(lectura("2026-11-03T10:00:00Z", { a: "esperando" })), fotografia(lectura("2026-11-03T10:15:00Z", { a: "trabajando" })));
    igual(textoCambio(c), "a (Dep) pasó de Esperando a Trabajando.");
    igual(c.entre, ["2026-11-03T10:00:00Z", "2026-11-03T10:15:00Z"]);
  });

  // --- Fase C, PR 1: noche, encuadre y etiquetas ---
  prueba("Noche: el ambiente nunca baja de 1.7 y de noche se marca para encender oficinas y anillos", () => {
    for (let h = 0; h < 24; h += 0.25) verdadero(luzSegunHora(h).hemi >= 1.7, `oscuro a las ${h}`);
    igual(luzSegunHora(23).noche, 1);
    igual(luzSegunHora(12).noche, 0);
    igual(luzSegunHora(23, true).noche, 0, "la luz fija no cambia de noche");
  });
  const zonaPrueba = { w: 1000, h: 600, arriba: 60, abajo: 540, izq: 8, der: 992 };
  const caja = [{ x: -10, y: -4 }, { x: 10, y: -4 }, { x: -10, y: 4 }, { x: 10, y: 4 }];
  prueba("Encuadre: todo el escenario cabe en la zona libre (sin barra ni avisos) y la aprovecha", () => {
    const e = calcularEncuadre(caja, zonaPrueba);
    const px = caja.map((p) => aPixeles(p, e, zonaPrueba));
    for (const p of px) verdadero(dentro(p, zonaPrueba), `fuera de la zona: ${JSON.stringify(p)}`);
    const ancho = Math.max(...px.map((p) => p.x)) - Math.min(...px.map((p) => p.x));
    const alto = Math.max(...px.map((p) => p.y)) - Math.min(...px.map((p) => p.y));
    verdadero(ancho >= 0.9 * (zonaPrueba.der - zonaPrueba.izq) || alto >= 0.9 * (zonaPrueba.abajo - zonaPrueba.arriba), "deja demasiado espacio vacío");
  });
  prueba("Encuadre: con la barra arriba, el centro baja al centro de la zona libre", () => {
    const e = calcularEncuadre(caja, zonaPrueba);
    const centro = aPixeles({ x: 0, y: 0 }, e, zonaPrueba);
    verdadero(Math.abs(centro.y - (zonaPrueba.arriba + zonaPrueba.abajo) / 2) < 1, `centro en ${centro.y}`);
    const menos = calcularEncuadre(caja, zonaPrueba, 0.7);
    verdadero(menos.mitadAlto > e.mitadAlto, "menor llenado = más alejado");
  });
  prueba("Etiquetas: nunca quedan encimadas y gana la más importante", () => {
    const uno = (id, x, y, prioridad, extra = []) => ({ id, w: 120, h: 24, prioridad, opciones: [{ x, y }, ...extra] });
    const items = [
      uno("a", 100, 100, 10),
      uno("b", 130, 105, 60),
      uno("c", 400, 100, 5),
      uno("d", 5, 300, 90),    // se saldría del lienzo
      uno("e", 600, 40, 90),   // quedaría bajo la barra
      uno("f", 140, 102, 20, [{ x: 140, y: 200 }]), // choca con b, pero tiene otro lugar libre
    ];
    const v = acomodarEtiquetas(items, { w: 800, h: 600, arriba: 50 });
    igual([...v.keys()].sort(), ["b", "c", "f"]);
    igual(v.get("f"), 1, "usa su segunda opción");
    // Sin pares que se crucen entre las visibles, con muchas etiquetas al azar (semilla fija).
    let semilla = 7;
    const azar = () => (semilla = (semilla * 16807) % 2147483647) / 2147483647;
    const muchas = Array.from({ length: 40 }, (_, i) => ({ id: String(i), w: 60 + azar() * 80, h: 22, prioridad: Math.floor(azar() * 100), opciones: [{ x: azar() * 800, y: 60 + azar() * 540 }, { x: azar() * 800, y: 60 + azar() * 540 }] }));
    const elegidas = acomodarEtiquetas(muchas, { w: 800, h: 600, arriba: 50 });
    const vis = muchas.filter((m) => elegidas.has(m.id)).map((m) => ({ ...m, ...m.opciones[elegidas.get(m.id)] }));
    for (let i = 0; i < vis.length; i++) for (let j = i + 1; j < vis.length; j++) {
      const a = vis[i], b = vis[j];
      verdadero(!(Math.abs(a.x - b.x) * 2 < a.w + b.w && Math.abs(a.y - b.y) < (a.h + b.h) / 2), `se enciman ${a.id} y ${b.id}`);
    }
    verdadero(prioridadEtiqueta({ enfocado: false, estado: "error", alertas: 0 }) > prioridadEtiqueta({ enfocado: false, estado: "esperando", alertas: 0 }));
  });
  prueba("Etiquetas: nombres cortos únicos para los departamentos de Compago", async () => {
    const { modelo } = await edificioCompago();
    const nombres = modelo.departamentos.map((d) => d.nombre);
    const cortos = nombresCortos(nombres);
    igual(new Set(cortos).size, nombres.length, `repetidos: ${cortos.join(", ")}`);
    for (const c of cortos) verdadero(c.length <= 16, `largo: ${c}`);
    igual(nombresCortos(["Importación de catálogos"]), ["Importación"]);
    igual(nombresCortos(["Revisión de fuentes", "Revisión de listas"]), ["Revisión fuentes", "Revisión listas"]);
  });

  // ---------- Fase C2: navegación móvil ----------
  prueba("Navegación: vecino recorre en círculo y sin actual empieza por un extremo", () => {
    const deps = [{ id: "a" }, { id: "b" }, { id: "c" }];
    igual(vecinoDe(deps, "a", 1).id, "b");
    igual(vecinoDe(deps, "c", 1).id, "a", "del último pasa al primero");
    igual(vecinoDe(deps, "a", -1).id, "c", "del primero regresa al último");
    igual(vecinoDe(deps, null, 1).id, "a");
    igual(vecinoDe(deps, null, -1).id, "c");
    igual(vecinoDe(deps, "no-existe", 1).id, "a");
    igual(vecinoDe([], "a", 1), null);
    igual(vecinoDe([{ id: "x" }], "x", 1).id, "x");
  });
  prueba("Navegación: el resumen cuenta evidencia y alertas sin inventar nada", async () => {
    const { modelo } = await edificioCompago();
    for (const d of modelo.departamentos) {
      const r = resumenDepartamento(d);
      igual(r.agentes, d.agentes.length);
      igual(r.alertas, d.alertas.length);
      igual(r.conEvidencia, d.agentes.filter((a) => a.estado_mostrado !== "sin_datos").length);
      igual(r.estado, d.estado_resumen);
      verdadero(r.conEvidencia <= r.agentes);
    }
    // Sin datos vigentes: nadie cuenta como "con evidencia".
    const viejo = { ...modelo.departamentos[0], agentes: modelo.departamentos[0].agentes.map((a) => ({ ...a, estado_mostrado: "sin_datos" })) };
    igual(resumenDepartamento(viejo).conEvidencia, 0);
  });
  prueba("Barra móvil: la escena usa vecinoDe para flechas, teclado y gesto (una sola regla)", async () => {
    const { readFile } = await import("node:fs/promises");
    const src = await readFile(new URL("../app/vistas/vista3d/escena3d.js", import.meta.url), "utf8");
    verdadero(src.includes("vecinoDe(modelo.departamentos"));
    igual((src.match(/irAVecino\(/g) ?? []).length >= 4, true, "flechas, teclado y gesto pasan por irAVecino");
    verdadero(!/findIndex\(\(d\) => d\.id === \(modo/.test(src), "no queda una segunda copia de la regla del vecino");
  });
}
