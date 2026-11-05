// Fase L: caminos que rodean escritorios, fases de trabajo deterministas, giro corto, historial de cámara,
// estilo de piso en el registro, tema declarado en la escena, agrupación de pisos pendientes y ruta base.
// Corre en Node y en pruebas.html (sin Three.js ni DOM).

import { prueba, igual, verdadero } from "./mini.js";
import { tamanoCuarto, puestos, camino, caminoChoca, puerta, longitudCamino, huella } from "../app/vistas/vista3d/disposicion.js";
import { faseTrabajo, FASES_TRABAJO, variacion, girarHacia, planDeTransicion } from "../app/vistas/vista3d/maquina.js";
import { crearHistorialCamara, claveSeleccion } from "../app/vistas/vista3d/camara-historial.js";
import { validarRegistro, ESTILOS_PISO } from "../app/nucleo/registro.js";
import { construirModeloVista, posicionDe } from "../app/nucleo/modelo.js";
import { temaDe, estiloDe, ESTILOS } from "../app/vistas/vista3d/identidad.js";
import { agruparPisos } from "../app/nucleo/pisos.js";
import { rutaBase, necesitaBarraFinal, leerConfiguracion } from "../app/configuracion.js";

export function registrarCasosFaseL(leerTexto) {
  const leerJSON = async (ruta) => JSON.parse(await leerTexto(ruta));

  // ---------- L3: caminos ----------
  prueba("L · caminos: ningún personaje atraviesa otro escritorio (1 a 12 puestos, cuartos de 1 a 3 celdas)", () => {
    let revisados = 0;
    for (const celdas of [1, 2, 3]) for (let n = 1; n <= 12; n++) {
      const c = tamanoCuarto({ ancho: celdas, alto: 1 }, 6.4 / 1, n);
      const ps = puestos(n, c);
      for (const p of ps) {
        const r = camino(c, p, ps);
        verdadero(!caminoChoca(r, p, ps), `celdas=${celdas} n=${n} puesto=(${p.x},${p.z}) cruza un escritorio: ${JSON.stringify(r)}`);
        for (const q of r) verdadero(Math.abs(q.x) <= c.ancho / 2 && Math.abs(q.z) <= c.fondo / 2, `punto fuera del cuarto ${JSON.stringify(q)}`);
        revisados++;
      }
    }
    verdadero(revisados > 100, `revisados ${revisados}`);
  });
  prueba("L · caminos: el de la fase K sí atravesaba escritorios con dos filas (el defecto existía)", () => {
    const c = tamanoCuarto({ ancho: 1, alto: 1 }, 6.4, 4);
    const ps = puestos(4, c);
    const fila0 = ps[0];
    const p = puerta(c);
    const pasilloZ = Math.round((c.fondo / 2 - 1) * 1000) / 1000;
    const silla = { x: fila0.x, z: Math.round((fila0.z + 0.75) * 1000) / 1000 };
    const viejo = [p, { x: p.x, z: pasilloZ }, { x: silla.x, z: pasilloZ }, { x: silla.x, z: silla.z + 0.6 }, silla];
    verdadero(caminoChoca(viejo, fila0, ps), "el camino recto debería chocar con el escritorio de enfrente");
    verdadero(!caminoChoca(camino(c, fila0, ps), fila0, ps), "el camino nuevo no choca");
  });
  prueba("L · caminos: sin fila delante el camino es el mismo de antes (empieza en la puerta, termina en la silla)", () => {
    const c = tamanoCuarto({ ancho: 2, alto: 1 }, 4, 2);
    const p = puestos(2, c)[1];
    const r = camino(c, p, puestos(2, c));
    igual(r.length, 5);
    igual(r[0], puerta(c));
    igual(r[4], { x: p.x, z: Math.round((p.z + 0.75) * 1000) / 1000 });
    verdadero(longitudCamino(r) > 0);
  });

  // ---------- L3: animaciones deterministas ----------
  prueba("L · trabajo: misma fase con el mismo id y el mismo reloj (reproducible)", () => {
    const v = variacion(huella("importador"));
    for (const t of [0, 3.3, 17.9, 125.4]) igual(faseTrabajo(t, v), faseTrabajo(t, variacion(huella("importador"))));
  });
  prueba("L · trabajo: teclea la mayor parte del tiempo y hace las tres pausas (leer, mirar, acomodarse)", () => {
    for (const id of ["importador", "revisor", "a", "supervisora-de-ventas"]) {
      const v = variacion(huella(id));
      const cuenta = Object.fromEntries(FASES_TRABAJO.map((f) => [f, 0]));
      for (let t = 0; t < v.periodo * 3; t += 0.05) cuenta[faseTrabajo(t, v).fase]++;
      const total = Object.values(cuenta).reduce((a, b) => a + b, 0);
      verdadero(cuenta.teclear / total > 0.6, `${id}: teclea ${Math.round(cuenta.teclear / total * 100)} %`);
      for (const f of ["leer", "mirar", "acomodarse"]) verdadero(cuenta[f] > 0, `${id}: nunca hace «${f}»`);
    }
  });
  prueba("L · trabajo: las pausas entran y salen suave (k nunca salta más de 0.2 entre cuadros de 1/30 s)", () => {
    const v = variacion(huella("revisor"));
    let antes = faseTrabajo(0, v);
    for (let t = 1 / 30; t < v.periodo * 3 * 2; t += 1 / 30) {
      const ahora = faseTrabajo(t, v);
      const ka = antes.fase === "teclear" ? 0 : antes.k, kb = ahora.fase === "teclear" ? 0 : ahora.k;
      verdadero(Math.abs(kb - ka) <= 0.2, `salto de ${ka.toFixed(2)} a ${kb.toFixed(2)} en t=${t.toFixed(2)} (${antes.fase}→${ahora.fase})`);
      antes = ahora;
    }
  });
  prueba("L · trabajo: dos personajes no hacen la misma pausa al mismo tiempo todo el rato", () => {
    const a = variacion(huella("importador")), b = variacion(huella("buscador"));
    let iguales = 0, n = 0;
    for (let t = 0; t < 120; t += 0.5, n++) if (faseTrabajo(t, a).fase === faseTrabajo(t, b).fase && faseTrabajo(t, a).fase !== "teclear") iguales++;
    verdadero(iguales / n < 0.2, `coinciden ${iguales}/${n}`);
  });
  prueba("L · giro: siempre por el camino corto y sin pasarse", () => {
    const cerca = (a, b) => Math.abs(a - b) < 1e-9;
    verdadero(cerca(girarHacia(0, Math.PI / 2, 1), Math.PI / 2));
    verdadero(cerca(girarHacia(0.1, -0.1 + Math.PI * 2, 1), -0.1), "de 0.1 a 2π-0.1 gira 0.2 hacia atrás");
    verdadero(Math.abs(girarHacia(3, -3, 0.5) - 3) < 0.2, "de 3 a -3 rad son 0.28 rad, no 6");
    verdadero(cerca(girarHacia(1, 2, 0), 1) && cerca(girarHacia(1, 2, 5), 2), "k fuera de rango se limita");
  });
  prueba("L · reglas de evidencia intactas: la primera lectura no tiene gestos y «ausente» sale caminando", () => {
    igual(planDeTransicion(null, "estirarse").pasos, []);
    igual(planDeTransicion("sentado_tecleando", "ausente").pasos, ["levantarse", "salir"]);
    igual(planDeTransicion("ausente", "estirarse").pasos, ["entrar", "sentarse"]); // llega: no celebra lo que no vio
  });

  // ---------- L6: historial de cámara ----------
  prueba("L · cámara: el historial devuelve las vistas en orden inverso y no repite la misma vista", () => {
    const h = crearHistorialCamara({ maximo: 3 });
    verdadero(h.recordar({ x: 0, y: 0, z: 0, zoom: 1, sel: null, enfocado: null }));
    verdadero(!h.recordar({ x: 0.01, y: 0, z: 0, zoom: 1, sel: null, enfocado: null }), "la misma vista no se guarda dos veces");
    h.recordar({ x: 5, y: 0, z: 0, zoom: 2, sel: { tipo: "departamento", id: "a" }, enfocado: "a" });
    h.recordar({ x: 6, y: 0, z: 1, zoom: 3, sel: { tipo: "agente", id: "x" }, enfocado: "a" });
    h.recordar({ x: 7, y: 0, z: 1, zoom: 3, sel: null, enfocado: null });
    igual(h.tamano, 3, "se olvida la más vieja");
    igual(h.sacar().x, 7);
    igual(claveSeleccion(h.sacar().sel), "agente:x");
    igual(h.sacar().enfocado, "a");
    igual(h.sacar(), null);
  });
  prueba("L · cámara: el historial guarda una copia (cambiar la selección original no lo altera)", () => {
    const h = crearHistorialCamara();
    const sel = { tipo: "agente", id: "x" };
    h.recordar({ x: 1, y: 0, z: 0, zoom: 1, sel, enfocado: null });
    sel.id = "otro";
    igual(h.sacar().sel, { tipo: "agente", id: "x" });
  });

  // ---------- L5: identidad ----------
  prueba("L · registro: «estilo» opcional se acepta solo si es conocido; no toca el contrato", () => {
    const { proyectos, avisos } = validarRegistro({ proyectos: [
      { id: "a", nombre: "A", estado: "datos/reales/a.json", estilo: "comercial" },
      { id: "b", nombre: "B", estado: "datos/reales/b.json", estilo: "casino" },
      { id: "c", nombre: "C", estado: "datos/reales/c.json" },
    ] });
    igual(proyectos.map((p) => p.estilo ?? null), ["comercial", null, null]);
    verdadero(avisos.some((a) => /b: "estilo"/.test(a)), avisos.join(" | "));
    igual(ESTILOS_PISO.every((e) => ESTILOS[e]), true, "cada estilo del registro tiene su decoración");
  });
  prueba("L · registro real: Compago comercial, Ek Chuah financiero, Montambre alimentos; los pendientes sin estilo", async () => {
    const { proyectos } = validarRegistro(await leerJSON("datos/proyectos.json"));
    const e = Object.fromEntries(proyectos.map((p) => [p.id, p.estilo ?? null]));
    igual([e.compago, e["ek-chuah"], e.montambre], ["comercial", "financiero", "alimentos"]);
    igual([e.tezcatlipoca, e.cauceservice, e.repacar], [null, null, null]);
  });
  prueba("L · modelo: el estilo del registro llega al modelo de vista y uno desconocido es «general»", async () => {
    const doc = await leerJSON("contrato/ejemplos/compago-exportador.json");
    const m = construirModeloVista({ proyecto: { id: "compago", nombre: "Compago", estilo: "comercial" }, carga: { tipo: "ok", datos: doc }, origen: "real", ahora: new Date(Date.parse(doc.generado_en) + 60_000) });
    igual(m.proyecto.estilo, "comercial");
    igual(estiloDe(m.proyecto).etiqueta, "Análisis comercial");
    igual(estiloDe({ estilo: "otro" }), ESTILOS.general);
    igual(estiloDe(null), ESTILOS.general);
  });
  prueba("L · escena: «tema» declarado manda sobre el adivinado; uno inválido se ignora", () => {
    const dist = { departamentos: { ventas: { x: 0, y: 0, ancho: 1, alto: 1, tema: "auditoria" }, raro: { x: 1, y: 0, ancho: 1, alto: 1, tema: "<script>" } } };
    igual(temaDe({ id: "ventas", nombre: "Ventas", posicion: posicionDe(dist, "ventas") }), "auditoria");
    igual(posicionDe(dist, "raro").tema, undefined);
    igual(temaDe({ id: "importacion", nombre: "Importación", posicion: posicionDe(dist, "raro") }), "importacion");
    igual(temaDe({ id: "x", nombre: "X", posicion: { tema: "no-existe" } }), temaDe({ id: "x", nombre: "X" }), "tema desconocido: se adivina como antes");
  });

  // ---------- L10: selector con muchos pisos ----------
  prueba("L · selector: con 7 o menos proyectos no se agrupa nada (como en la fase K)", async () => {
    const { proyectos } = validarRegistro(await leerJSON("datos/proyectos.json"));
    const r = agruparPisos(proyectos, new Map(), "compago");
    igual(r.pestanas.length, proyectos.length);
    igual(r.agrupados, []);
  });
  prueba("L · selector: con muchos proyectos se agrupan solo los pendientes sin datos (nunca el actual)", () => {
    const lista = Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, nombre: `P${i}`, ...(i >= 6 ? { pendiente: "sin repositorio" } : {}) }));
    const resumen = new Map([["p7", "demo"]]); // un pendiente que ya tiene DEMO no se esconde
    const r = agruparPisos(lista, resumen, "p9");
    igual(r.agrupados.map((p) => p.id), ["p6", "p8"]);
    igual(r.pestanas.map((p) => p.id), ["p0", "p1", "p2", "p3", "p4", "p5", "p7", "p9"]);
    igual(agruparPisos(lista.slice(0, 9), new Map(), "p8").agrupados.length, 2, "con un solo agrupable no se agrupa; con dos sí");
  });

  // ---------- L9: ruta base ----------
  prueba("L · portal: la ruta base es la carpeta de la página (raíz o subruta)", () => {
    igual(rutaBase("http://127.0.0.1:8765/"), "/");
    igual(rutaBase("http://127.0.0.1:8765/index.html?medir=1"), "/");
    igual(rutaBase("https://portal.ejemplo/cauce/"), "/cauce/");
    igual(rutaBase("https://portal.ejemplo/herramientas/cauce/index.html#x"), "/herramientas/cauce/");
  });
  prueba("L · portal: sin «/» final hay que corregir la dirección; con archivo o con «/» no", () => {
    igual([necesitaBarraFinal("/cauce"), necesitaBarraFinal("/cauce/"), necesitaBarraFinal("/"), necesitaBarraFinal("/cauce/index.html"), necesitaBarraFinal("/a.b/cauce")], [true, false, false, false, true]);
  });
  prueba("L · portal: ?incrustado=1 activa el modo incrustado; cualquier otro valor no", () => {
    igual(leerConfiguracion("https://p.ejemplo/cauce/?incrustado=1").incrustado, true);
    igual(leerConfiguracion("https://p.ejemplo/cauce/?incrustado=si").incrustado, false);
    igual(leerConfiguracion("https://p.ejemplo/cauce/").base, "/cauce/");
  });
  prueba("L · portal: la app no usa rutas absolutas («/algo») para sus archivos", async () => {
    for (const ruta of ["index.html", "app/app.js", "app/cargador.js", "app/vistas/vista3d/kenney.js", "app/vistas/vista3d/brillo.js", "app/vistas/vista3d/escena3d.js", "pruebas.html"]) {
      const texto = await leerTexto(ruta);
      const absolutas = [...texto.matchAll(/(?:fetch\(|import\(|from |href=|src=|loadAsync\()\s*["'`](\/[^/"'`][^"'`]*)/g)].map((m) => m[1]);
      igual(absolutas, [], `${ruta} usa rutas absolutas`);
    }
  });
}
