// Fase G: integración del exportador de solo lectura de Ek Chuah (PR #2, commit a23e06c) con Cauce.
// Documentos en contrato/ejemplos/ek-chuah-pr2/ (bases SINTÉTICAS). Corre en Node y en pruebas.html.

import { prueba, igual, verdadero } from "./mini.js";
import { validarDocumento } from "../app/nucleo/contrato.js";
import { construirModeloVista, elegirCarga } from "../app/nucleo/modelo.js";
import { validarRegistro } from "../app/nucleo/registro.js";
import { validarNaturalezas, crearSeguidorNaturalezas, horaDelRegistro, esReciente } from "../app/nucleo/naturaleza.js";

export const ESCENARIOS_EK = ["dia-normal", "fallas", "sin-evidencia", "sin-base"];
export const DOCS_EK = ESCENARIOS_EK.flatMap((n) => [`demo-${n}`, `real-${n}`]);
export const DEPTOS_EK = ["datos", "supervision", "informes", "simulaciones", "riesgo", "auditoria"];

// Patrones que nunca deben llegar a Cauce desde Ek Chuah (montos, enlaces, secretos, rutas privadas, dinero real).
export const PATRONES_SENSIBLES = [
  ["monto en pesos", /\$\s?\d/],
  ["enlace", /https?:\/\//i],
  ["token", /token/i],
  ["webhook", /webhook/i],
  ["clave o contraseña", /(api[_-]?key|password|contrase(ñ|n)a|secret)/i],
  ["bitácora de dinero real", /journal/i],
  ["ruta de Windows", /[a-z]:\\/i],
  ["carpeta de usuario", /(\\users\\|\/home\/|\/users\/|msigf)/i],
  ["archivo .env", /\.env\b/i],
  ["base de datos", /\.db\b|\.sqlite/i],
  ["correo", /[\w.+-]+@[\w-]+\.[a-z]{2,}/i],
  ["cuenta o tarjeta", /\b\d{10,}\b/],
  ["personas.toml", /personas.*\.toml/i],
];

/** Corre todas las horas ISO del texto para que generado_en quede en `baseMs` (misma separación entre horas). */
export function alDia(texto, baseMs) {
  const gen = Date.parse(JSON.parse(texto).generado_en);
  return texto.replace(/"(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z)"/g,
    (_, t) => `"${new Date(Date.parse(t) + baseMs - gen).toISOString().replace(/\.\d+Z$/, "Z")}"`);
}

export function registrarCasosEkChuah(leerTexto) {
  const leerJSON = async (ruta) => JSON.parse(await leerTexto(ruta));
  const doc = (n) => leerTexto(`contrato/ejemplos/ek-chuah-pr2/${n}.json`);
  const proyecto = { id: "ek-chuah", nombre: "Ek Chuah" };
  const clasificacion = async () => validarNaturalezas(await leerJSON("escena/ek-chuah-naturaleza.json"));
  const agentes = (m) => m.departamentos.flatMap((d) => d.agentes);
  const de = (m, id) => agentes(m).find((a) => a.id === id);
  const BASE = Date.parse("2026-11-04T15:05:00Z");
  // Modelo tal como lo arma la app: el REAL se evalúa con su hora corrida a BASE; el DEMO con su hora simulada.
  const modelo = async (n, { base = BASE, ahora = base + 10000, editar } = {}) => {
    const datos = JSON.parse(n.startsWith("real-") ? alDia(await doc(n), base) : await doc(n));
    if (editar) editar(datos);
    return construirModeloVista({ proyecto, carga: { tipo: "ok", datos }, ahora: new Date(ahora) });
  };
  const tarea = (d) => d.departamentos.find((x) => x.id === "supervision").agentes.find((a) => a.id === "tarea-diaria");

  // ---------- contrato y registro

  for (const n of DOCS_EK) {
    prueba(`G · Ek Chuah «${n}»: válido en el contrato v1, ${n.startsWith("demo-") ? "DEMO" : "REAL"}, 6 oficinas, en línea, sin avisos`, async () => {
      const texto = await doc(n);
      const d = JSON.parse(n.startsWith("real-") ? alDia(texto, BASE) : texto);
      const r = validarDocumento(d);
      verdadero(r.valido, JSON.stringify(r.errores));
      igual(r.avisos ?? [], []);
      const m = await modelo(n);
      igual([m.conexion, m.es_demo, m.departamentos.map((x) => x.id), m.avisos, m.errores],
        ["en_linea", n.startsWith("demo-"), DEPTOS_EK, [], []]);
    });
  }

  prueba("G · registro: Ek Chuah lee datos/reales/ek-chuah.json y su DEMO sigue en datos/demo/ek-chuah.json", async () => {
    const { proyectos, avisos } = validarRegistro(await leerJSON("datos/proyectos.json"));
    const p = proyectos.find((x) => x.id === "ek-chuah");
    igual([avisos, p.estado, p.demo, p.naturalezas], [[], "datos/reales/ek-chuah.json", "datos/demo/ek-chuah.json", "escena/ek-chuah-naturaleza.json"]);
  });

  prueba("G · un REAL del exportador puesto en el lugar del DEMO se rechaza (no se muestra como demostración)", async () => {
    const real = { tipo: "ok", datos: JSON.parse(alDia(await doc("real-dia-normal"), BASE)) };
    const e = elegirCarga({ tipo: "no_encontrado" }, real);
    igual([e.origen, e.carga.tipo], ["demo", "json_invalido"]);
  });

  prueba("G · un DEMO del exportador en datos/reales se ve con la franja de DEMO (nunca como REAL)", async () => {
    const m = await modelo("demo-dia-normal");
    igual([m.es_demo, m.hora_simulada], [true, true]);
  });

  // ---------- clasificación

  prueba("G · clasificación de Ek Chuah: válida, sin avisos, cubre el DEMO de Cauce y los 7 puestos del exportador", async () => {
    const c = await clasificacion();
    igual([c.valido, c.errores, c.avisos, c.hora_del_registro], [true, [], [], "actividad"]);
    const ids = new Set([...(await leerJSON("datos/demo/ek-chuah.json")).departamentos.flatMap((d) => d.agentes.map((a) => a.id)),
      ...agentes(await modelo("demo-dia-normal")).map((a) => a.id)]);
    igual([...c.mapa.keys()].sort(), [...ids].sort());
  });

  prueba("G · naturalezas definitivas: solo tarea-diaria es programado (con plazo de 26 h); ningún automático", async () => {
    const { mapa } = await clasificacion();
    const por = Object.fromEntries([...mapa].map(([id, c]) => [id, c.naturaleza]));
    igual(por, { descargador: "reactivo", vigia: "reactivo", "tarea-diaria": "programado", redactor: "reactivo",
      simulador: "modulo", "evaluador-riesgo": "modulo", auditor: "humano" });
    igual(mapa.get("tarea-diaria").reciente_horas, 26);
  });

  prueba("G · un plazo de programación inválido se rechaza; sin plazo, programado se comporta como en la fase F", () => {
    const mal = validarNaturalezas({ agentes: { t: { naturaleza: "programado", programacion: { evidencia: "x", reciente_horas: -1 } } } });
    verdadero(!mal.valido && mal.errores[0].includes("reciente_horas"));
    const sin = validarNaturalezas({ agentes: { t: { naturaleza: "programado", programacion: { evidencia: "x" } } } });
    igual([sin.valido, sin.mapa.get("t").reciente_horas, sin.hora_del_registro], [true, null, "observado"]);
  });

  // ---------- primera lectura: nadie aparece; sin evidencia, nadie trabaja

  for (const n of DOCS_EK) {
    prueba(`G · «${n}» al cargar: ningún personaje visible (no se observó un registro nuevo)`, async () => {
      const m = await modelo(n);
      crearSeguidorNaturalezas().aplicar(m, await clasificacion(), 0);
      igual(agentes(m).filter((a) => a.animacion_mostrada !== "ausente").map((a) => a.id), []);
      igual(agentes(m).filter((a) => !a.naturaleza).map((a) => a.id), [], "todos clasificados");
    });
  }

  for (const n of ["demo-sin-evidencia", "real-sin-evidencia", "demo-sin-base", "real-sin-base"]) {
    prueba(`G · «${n}»: nadie trabajando, todas las pantallas apagadas y tarea-diaria sin confirmar`, async () => {
      const m = await modelo(n);
      crearSeguidorNaturalezas().aplicar(m, await clasificacion(), 0);
      igual(agentes(m).filter((a) => a.estado_mostrado !== "sin_datos" || a.presentacion.pantalla !== "apagada").map((a) => a.id), []);
      igual(de(m, "tarea-diaria").presentacion.programacion, "sin_confirmar");
      verdadero(/sin confirmar/.test(de(m, "tarea-diaria").presentacion.texto));
    });
  }

  prueba("G · «real-sin-base» trae alerta crítica y no inventa actividad", async () => {
    const m = await modelo("real-sin-base");
    verdadero(m.alertas.some((a) => a.nivel === "critica"));
    igual(agentes(m).filter((a) => a.actividad?.progreso).length, 0);
  });

  prueba("G · un «trabajando» sin evidencia no se dibuja trabajando (regla de oro del contrato)", async () => {
    const m = await modelo("real-dia-normal", { editar: (d) => { const t = tarea(d); t.estado = "trabajando"; delete t.evidencia; } });
    crearSeguidorNaturalezas().aplicar(m, await clasificacion(), 0);
    verdadero(de(m, "tarea-diaria").estado_mostrado !== "trabajando");
    igual(de(m, "tarea-diaria").animacion_mostrada, "ausente");
  });

  // ---------- tarea-diaria: programado condicionado a evidencia reciente

  prueba("G · tarea-diaria con ejecución de hoy: programación confirmada, sin figura al cargar", async () => {
    const m = await modelo("real-dia-normal");
    crearSeguidorNaturalezas().aplicar(m, await clasificacion(), 0);
    const t = de(m, "tarea-diaria");
    igual([t.naturaleza, t.presentacion.programacion, t.presentacion.personaje, t.presentacion.pantalla], ["programado", "confirmada", "ausente", "finalizado"]);
  });

  prueba("G · tarea-diaria con última ejecución de hace 3 días: «sin confirmar» aunque el archivo sea de hoy", async () => {
    const m = await modelo("real-dia-normal", { editar: (d) => {
      const t = tarea(d); const corre = (s) => new Date(Date.parse(s) - 3 * 86400e3).toISOString().replace(/\.\d+Z$/, "Z");
      t.actividad.inicio = corre(t.actividad.inicio); t.actividad.fin = corre(t.actividad.fin);
    } });
    crearSeguidorNaturalezas().aplicar(m, await clasificacion(), 0);
    const t = de(m, "tarea-diaria");
    igual([t.presentacion.programacion, t.presentacion.personaje], ["sin_confirmar", "ausente"]);
  });

  prueba("G · DEMO: el plazo se mide contra la hora simulada (dia-normal confirmada, sin-evidencia no)", async () => {
    const c = await clasificacion();
    const a = await modelo("demo-dia-normal"); crearSeguidorNaturalezas().aplicar(a, c, 0);
    const b = await modelo("demo-sin-evidencia"); crearSeguidorNaturalezas().aplicar(b, c, 0);
    igual([de(a, "tarea-diaria").presentacion.programacion, de(b, "tarea-diaria").presentacion.programacion], ["confirmada", "sin_confirmar"]);
  });

  // ---------- animaciones: solo eventos nuevos Y recientes

  const corrida = (dias, codigo = 0, ref) => (d) => {
    const t = tarea(d);
    const fin = new Date(Date.parse(d.generado_en) - dias * 86400e3 - 60e3).toISOString().replace(/\.\d+Z$/, "Z");
    t.actividad.inicio = new Date(Date.parse(fin) - 41e3).toISOString().replace(/\.\d+Z$/, "Z");
    t.actividad.fin = fin;
    t.evidencia.referencia = ref ?? `línea 'Inicio' ${t.actividad.inicio} · 'Fin (código ${codigo})'`;
  };

  prueba("G · corrida nueva de la tarea diaria (posterior a la lectura anterior): aparece 8 s y se va", async () => {
    const c = await clasificacion(); const s = crearSeguidorNaturalezas();
    s.aplicar(await modelo("real-dia-normal", { base: BASE - 86400e3 }), c, 0); // exportación de ayer
    const m = await modelo("real-dia-normal", { editar: corrida(0) });         // la de hoy, con la corrida de hoy
    igual(s.aplicar(m, c, 1000), 8000);
    igual(de(m, "tarea-diaria").presentacion.personaje, "breve");
    igual(agentes(m).filter((a) => a.presentacion.personaje === "breve").map((a) => a.id), ["tarea-diaria"], "solo cambió su evidencia");
    s.aplicar(m, c, 9001);
    igual(de(m, "tarea-diaria").presentacion.personaje, "ausente");
  });

  prueba("G · DEFECTO corregido: un registro nuevo pero de hace días NO anima (observado_en es la hora de exportar)", async () => {
    const c = await clasificacion();
    const s = crearSeguidorNaturalezas();
    s.aplicar(await modelo("real-dia-normal", { base: BASE - 4 * 86400e3 }), c, 0); // lectura de hace 4 días
    const m = await modelo("real-dia-normal", { editar: corrida(3, 0, "corrida atrasada de hace 3 días") });
    s.aplicar(m, c, 1000);
    igual(de(m, "tarea-diaria").presentacion.personaje, "ausente");
    // Prueba de que el defecto existía: con la regla anterior (observado_en), el mismo registro contaba como reciente.
    const t = de(m, "tarea-diaria");
    igual([esReciente(t, m, new Date(BASE - 4 * 86400e3).toISOString(), "observado"), esReciente(t, m, new Date(BASE - 4 * 86400e3).toISOString(), "actividad")], [true, false]);
  });

  prueba("G · lectura repetida del mismo archivo: nadie aparece", async () => {
    const c = await clasificacion(); const s = crearSeguidorNaturalezas();
    s.aplicar(await modelo("real-fallas"), c, 0);
    const m = await modelo("real-fallas", { ahora: BASE + 40000 });
    igual(s.aplicar(m, c, 30000), null);
    igual(agentes(m).filter((a) => a.animacion_mostrada !== "ausente").map((a) => a.id), []);
  });

  prueba("G · de DEMO a REAL: el cambio de fuente no cuenta como registro nuevo", async () => {
    const c = await clasificacion(); const s = crearSeguidorNaturalezas();
    s.aplicar(await modelo("demo-dia-normal"), c, 0);
    const m = await modelo("real-dia-normal");
    igual(s.aplicar(m, c, 1000), null);
  });

  prueba("G · archivo vencido (más de 26 h): datos desactualizados y nadie aparece", async () => {
    const c = await clasificacion(); const s = crearSeguidorNaturalezas();
    const m = await modelo("real-dia-normal", { ahora: BASE + 27 * 3600e3 });
    s.aplicar(m, c, 0);
    igual(m.conexion, "desactualizado");
    igual(agentes(m).filter((a) => a.estado_mostrado !== "sin_datos").map((a) => a.id), []);
  });

  // ---------- Compago sigue exactamente igual

  prueba("G · Compago: su clasificación usa la hora de siempre (observado) y la hora del registro no cambia en sus documentos", async () => {
    const c = validarNaturalezas(await leerJSON("escena/compago-naturaleza.json"));
    igual([c.valido, c.hora_del_registro], [true, "observado"]);
    const nombres = ["compago-exportador", ...["demo-activo", "real-activo-aplicando", "real-activo-espera", "real-activo-historico", "real-busqueda-1",
      "real-busqueda-2", "real-detenido-cola", "real-indeterminado", "real-vacio"].map((n) => `compago-pr10/${n}`)];
    for (const n of nombres) {
      const d = await leerJSON(`contrato/ejemplos/${n}.json`);
      for (const a of d.departamentos.flatMap((x) => x.agentes)) {
        const antes = Date.parse(a?.evidencia?.observado_en ?? a?.actividad?.fin ?? a?.actividad?.inicio ?? ""); // regla de la fase F
        const ahora = horaDelRegistro(a, c.hora_del_registro);
        verdadero(Object.is(antes, ahora), `${n}/${a.id}: ${antes} ≠ ${ahora}`);
      }
    }
  });

  // ---------- privacidad

  prueba("G · privacidad: ningún documento de Ek Chuah ni su configuración en Cauce lleva datos sensibles", async () => {
    const textos = [...await Promise.all(DOCS_EK.map(async (n) => [n, await doc(n)])),
      ["escena/ek-chuah-naturaleza.json", await leerTexto("escena/ek-chuah-naturaleza.json")],
      ["escena/ek-chuah.json", await leerTexto("escena/ek-chuah.json")],
      ["datos/demo/ek-chuah.json", await leerTexto("datos/demo/ek-chuah.json")]];
    const hallados = [];
    for (const [n, t] of textos) for (const [qué, re] of PATRONES_SENSIBLES) if (re.test(t)) hallados.push(`${n}: ${qué} (${t.match(re)[0]})`);
    igual(hallados, []);
  });

  prueba("G · privacidad: el filtro sí detecta lo que debe (montos, token, webhook, rutas, journal)", () => {
    for (const t of ["inversión real ($12,500)", "?token=abc", "discord webhook", "C:\\Users\\x", "journal_entries", "data/ek_chuah.db", ".env"]) {
      verdadero(PATRONES_SENSIBLES.some(([, re]) => re.test(t)), t);
    }
  });
}
