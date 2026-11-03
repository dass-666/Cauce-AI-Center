// Casos de prueba del contrato, los estados y el modelo de vista.
// `leerTexto(ruta)` lo da quien ejecuta: Node lee del disco; el navegador usa fetch.

import { prueba, igual, verdadero } from "./mini.js";
import { validarDocumento, esEnlaceSeguro } from "../app/nucleo/contrato.js";
import { ESTADOS, NOMBRES_ESTADOS, estadoResumen } from "../app/nucleo/estados.js";
import { construirModeloVista, elegirCarga } from "../app/nucleo/modelo.js";

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
}

