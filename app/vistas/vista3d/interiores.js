// Fase M: interiores con identidad según el tipo de trabajo del departamento (tema de identidad.js).
// Antes (fase L) cada cuarto tenía un mueble temático; ahora cada tema tiene una «familia» de muebles y
// pantallas ambientales que se acomodan solos donde hay espacio (zonas-cuarto.js): nunca encima de un
// escritorio, una silla, el pasillo de la puerta ni el camino de un personaje.
//
// - Solo decoración: no hay personas aquí (los personajes los pone oficina.js y solo con evidencia).
// - Las pantallas ambientales muestran pictogramas abstractos sin cifras (estilo-visual.js) y nunca cambian
//   con los datos.
// - planInterior() es puro (se prueba en Node); amueblarCuarto() lo convierte en muebles del catálogo, que
//   se fusionan con lo demás del cuarto (sin llamadas de dibujo extra, salvo una para las pantallas ambientales).

import { crearColocador } from "./zonas-cuarto.js";

// Huella en el piso (ancho en X, fondo en Z, sin girar) y alto de cada pieza.
const PIEZAS = Object.freeze({
  tarima: { w: 1.0, d: 0.8, alto: 0.9 },
  banda: { w: 1.6, d: 0.55, alto: 1.0 },
  estacionPie: { w: 0.7, d: 0.5, alto: 1.45 },
  mesaAnalisis: { w: 1.6, d: 1.4, alto: 0.8 }, // incluye los bancos
  archivero: { w: 0.5, d: 0.48, alto: 0.9 },
  archivoAlto: { w: 1.2, d: 0.38, alto: 1.2 },
  estanteria: { w: 1.2, d: 0.34, alto: 0.88 },
  credenza: { w: 1.2, d: 0.46, alto: 0.8 },
  rack: { w: 0.6, d: 0.62, alto: 1.15 },
  charolaCables: { w: 1.2, d: 0.2, alto: 0.05 },
  consola: { w: 1.8, d: 0.6, alto: 1.2 },
  globo: { w: 0.4, d: 0.4, alto: 1.0 },
  planta: { w: 0.46, d: 0.46, alto: 0.95 },
  lampara: { w: 0.36, d: 0.36, alto: 1.3 },
  tapete: { w: 2.0, d: 1.4, alto: 0.02 },
  monedas: { w: 1.0, d: 0.42, alto: 0.75 },
  // En muro (y0..y1 en metros): no tocan el piso, pero sí chocan con otra pieza del muro a esa altura.
  pantallaMuro: { w: 0.9, d: 0.08, muro: true },
  tablero: { w: 1.2, d: 0.08, muro: true },
});

/**
 * Lista de muebles del cuarto. Cada elemento: { pieza, x, z, rot, opciones }. Se intentan en orden; si una
 * pieza no cabe en ninguno de sus lugares candidatos, se omite (un cuarto chico simplemente tiene menos).
 * @param tema      tema de identidad.js (importacion, busqueda, …) o genérico
 * @param cuarto    {ancho, fondo}
 * @param lugares   puestos de disposicion.js (escritorios)
 * @param opciones  { estilo, altoMuro }
 */
export function planInterior(tema, cuarto, lugares, { estilo = "general", altoMuro = 1.0 } = {}) {
  const W = cuarto.ancho, F = cuarto.fondo;
  const col = crearColocador(cuarto, lugares);
  const plan = [];
  const fin = estilo === "financiero";
  // Lugares de referencia (centro de la pieza): esquina del fondo izquierdo, muro del fondo, muro izquierdo
  // y zona derecha (junto a la mampara de cristal).
  const xi = -W / 2, zf = -F / 2;
  const yMuro = (alto) => Math.min(altoMuro - alto / 2 - 0.1, 1.15); // pantalla en muro: debajo del remate
  // Piezas de muro: se revisan a 9 cm del muro (dentro del cuarto) y se dibujan pegadas a él (amueblarCuarto).
  const muroIzq = (z, w) => ({ x: xi + 0.09, z, rot: Math.PI / 2, w, muro: "izq" });

  function intentar(pieza, candidatos, opciones = {}) {
    const p = PIEZAS[pieza];
    const w = opciones.ancho ?? opciones.largo ?? p.w;
    for (const c of candidatos) {
      const d = p.d;
      const ok = p.muro
        ? col.intentar(c.x, c.z, c.w ?? w, d, c.rot ?? 0, { y0: opciones.y - (opciones.alto ?? 0.5) / 2, y1: opciones.y + (opciones.alto ?? 0.5) / 2 })
        : col.intentar(c.x, c.z, w, d, c.rot ?? 0, { y0: 0, y1: p.alto });
      if (ok) { plan.push({ pieza, x: c.x, z: c.z, rot: c.rot ?? 0, muro: c.muro ?? null, opciones }); return true; }
    }
    return false;
  }
  // Pantallas en el muro izquierdo (visible desde la cámara isométrica), de atrás hacia adelante.
  function pantallasMuro(pictogramas, { ancho = 0.8, alto = 0.42 } = {}) {
    const y = yMuro(alto);
    let z = zf + 0.75;
    for (const pictograma of pictogramas) {
      while (z < F / 2 - 1.4 && !intentar("pantallaMuro", [muroIzq(z, ancho)], { ancho, alto, y, pictograma })) z += 0.25;
      z += ancho + 0.12;
    }
  }
  // Zona derecha (junto a la mampara) y, si no cabe, el centro del muro del fondo (libre hasta los escritorios).
  const derecha = (dz = 0, w = 1, d = 0.5) => [
    { x: W / 2 - 0.25 - w / 2, z: zf + 2.4 + dz },
    { x: W / 2 - 0.25 - w / 2, z: zf + 1.6 + dz },
    { x: W / 2 - 0.25 - w / 2, z: 0.2 + dz },
    { x: W / 2 - 0.25 - w / 2, z: F / 2 - 1.8 },
    { x: 0.6, z: zf + 0.12 + d / 2 }, { x: 0, z: zf + 0.12 + d / 2 }, { x: 1.2, z: zf + 0.12 + d / 2 },
  ];
  const izquierda = (dz = 0, w = 0.5) => [
    { x: xi + 0.1 + w / 2, z: zf + 1.7 + dz },
    { x: xi + 0.1 + w / 2, z: zf + 2.4 + dz },
    { x: xi + 0.1 + w / 2, z: 0 + dz },
  ];
  const esquina = (w, d) => [{ x: xi + 0.12 + w / 2, z: zf + 0.12 + d / 2 }];
  const fondo = (x, d) => [{ x, z: zf + 0.1 + d / 2 }];

  // La planta de la esquina del fondo derecho (la de siempre) va primero: los demás muebles la respetan.
  intentar("planta", [{ x: W / 2 - 0.45, z: zf + 0.45 }], { tam: "media" });
  switch (tema) {
    case "importacion": // estaciones de procesamiento y pantallas de archivos
      intentar("tarima", esquina(1.0, 0.8));
      intentar("banda", fondo(xi + 2.25, 0.55), { largo: 1.6 });
      pantallasMuro(["archivos", "lista"]);
      intentar("estacionPie", derecha(0, 0.7), { pictograma: "archivos" });
      intentar("archivero", izquierda(0.6), { cajones: 3 });
      break;
    case "busqueda": // escritorios de investigación y paneles de búsqueda
      intentar("globo", esquina(0.4, 0.4));
      intentar("estanteria", fondo(xi + 1.25, 0.34), { ancho: 1.2 });
      pantallasMuro(["busqueda", "mapa"]);
      intentar("tablero", [muroIzq(zf + 2.9, 1.0)], { ancho: 1.0, alto: 0.5, y: yMuro(0.5), tipo: "corcho" });
      intentar("estacionPie", derecha(0, 0.7), { pictograma: "busqueda" });
      break;
    case "fuentes": // estaciones de revisión (Compago) o análisis documental (Ek Chuah)
      intentar("archivero", esquina(0.5, 0.48), { cajones: 3 });
      intentar("archivero", [{ x: xi + 0.75, z: zf + 0.36 }], { cajones: 3 });
      intentar("estacionPie", fondo(xi + 1.75, 0.5), { pictograma: fin ? "documento" : "lista" });
      pantallasMuro(fin ? ["documento"] : ["lista"]);
      intentar("tablero", [muroIzq(zf + 2.2, 1.0)], { ancho: 1.0, alto: 0.5, y: yMuro(0.5), tipo: "pizarron" });
      intentar("credenza", derecha(0, 1.2), { ancho: 1.0, bandejas: true });
      break;
    case "oportunidades": // mesas de análisis y pantallas comparativas (Ek Chuah: pantallas de escenarios)
      pantallasMuro(fin ? ["escenarios", "curva"] : ["comparar", "barras"]);
      if (intentar("mesaAnalisis", derecha(0.1, 1.5, 1.4), { largo: 1.4, fondo: 0.7 })) {
        const mesa = plan[plan.length - 1];
        plan.push({ pieza: "tapete", x: mesa.x, z: mesa.z + 0.15, rot: 0, muro: null, opciones: { ancho: 1.9, fondo: 1.5 } }); // bajo la mesa
      }
      intentar("estanteria", fondo(xi + 1.0, 0.34), { ancho: 1.2 });
      break;
    case "margenes": // monitores con gráficas y cálculos (Ek Chuah: paneles analíticos de riesgo)
      intentar("monedas", esquina(1.0, 0.42));
      pantallasMuro(fin ? ["mapa", "curva", "escenarios"] : ["curva", "barras", "comparar"], { ancho: 0.7, alto: 0.4 });
      intentar("estacionPie", derecha(0, 0.7), { pictograma: fin ? "barras" : "curva" });
      intentar("archivero", fondo(xi + 1.6, 0.48), { cajones: 2 });
      break;
    case "auditoria": // mesas de inspección y paneles de historial (Ek Chuah: verificación)
      intentar("archivoAlto", esquina(1.2, 0.38), { ancho: 1.2 });
      pantallasMuro(["historial"]);
      intentar("mesaAnalisis", derecha(0, 1.5, 1.4), { largo: 1.4, fondo: 0.7, inspeccion: true });
      intentar("tablero", [muroIzq(zf + 2.6, 1.0)], { ancho: 1.0, alto: 0.5, y: yMuro(0.5), tipo: "pizarron" });
      break;
    case "supervision": // panel central de estados y alertas (los estados reales siguen en letrero y torreta)
      intentar("consola", esquina(1.8, 0.6), { largo: 1.8 });
      pantallasMuro(["mosaico", "historial", "mapa"], { ancho: 0.72, alto: 0.42 });
      intentar("tapete", derecha(0, 1.6, 1.2), { ancho: 1.6, fondo: 1.2 });
      intentar("lampara", derecha(0, 0.4));
      break;
    case "integracion": // área técnica (UNIQ) o estaciones de recopilación (Ek Chuah: datos)
      intentar("rack", esquina(0.6, 0.62));
      intentar("rack", [{ x: xi + 1.06, z: zf + 0.43 }]);
      intentar("charolaCables", fondo(xi + 1.9, 0.2), { largo: 1.0 });
      pantallasMuro(fin ? ["red", "archivos"] : ["red"]);
      intentar("estacionPie", derecha(0, 0.7), { pictograma: fin ? "archivos" : "red" });
      break;
    default: // genérico: pizarrón y estantería
      intentar("tablero", [muroIzq(zf + 1.6, 1.2)], { ancho: 1.2, alto: 0.55, y: yMuro(0.55), tipo: "pizarron" });
      intentar("estanteria", fondo(xi + 1.0, 0.34), { ancho: 1.2 });
  }
  // Toque del estilo del proyecto, si queda lugar: plantas (comercial) o lámpara de lectura (financiero).
  if (fin) intentar("lampara", izquierda(1.0, 0.36));
  else if (estilo === "comercial") intentar("planta", izquierda(1.0, 0.46), { tam: "media" });
  return plan;
}

/** Convierte el plan en muebles del catálogo (mobiliario.js) dentro del grupo del cuarto. */
export function amueblarCuarto(grupo, mob, m, tema, cuarto, lugares, opciones = {}) {
  const plan = planInterior(tema, cuarto, lugares, opciones);
  for (const { pieza, x: px, z: pz, rot, muro, opciones: o } of plan) {
    // Las piezas de muro se pegan a él (se revisaron a unos centímetros, dentro del cuarto).
    const x = muro === "izq" ? -cuarto.ancho / 2 + 0.035 : px;
    const z = muro === "fondo" ? -cuarto.fondo / 2 + 0.035 : pz;
    const pos = { x, z, rot };
    switch (pieza) {
      case "pantallaMuro": mob.pantallaAmbiente(grupo, m, { ...pos, y: o.y, ancho: o.ancho, alto: o.alto, pictograma: o.pictograma }); break;
      case "tablero": mob.tablero(grupo, m, { ...pos, y: o.y, ancho: o.ancho, alto: o.alto, tipo: o.tipo }); break;
      case "credenza": {
        mob.credenza(grupo, m, { ...pos, ancho: o.ancho });
        if (o.bandejas) mob.bandejas(grupo, m, { x: x + 0.25, y: 0.58, z, rot });
        break;
      }
      case "mesaAnalisis": {
        mob.mesaAnalisis(grupo, m, { ...pos, largo: o.largo, fondo: o.fondo });
        if (o.inspeccion) mob.lamparaInspeccion(grupo, m, { x: x - 0.4, y: 0.745, z: z - 0.15, rot });
        break;
      }
      case "monedas": {
        const g = mob.credenza(grupo, m, { ...pos, ancho: 1.0 });
        // Pilas de monedas (símbolo del tema, no datos), sobre la credenza.
        [[0.15, 4], [0.32, 2], [0.0, 3]].forEach(([dx, n]) => mob.poner(g, mob.cil(0.07, 0.07, 0.03 * n, 12), m.oro ?? m.acento, dx, 0.58 + 0.015 * n, 0.05));
        break;
      }
      case "planta": mob.planta(grupo, m, { ...pos, tam: o.tam ?? "media" }); break;
      default: mob[pieza](grupo, m, { ...pos, ...o });
    }
  }
  return plan;
}
