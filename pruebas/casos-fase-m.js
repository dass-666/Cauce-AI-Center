// Fase M: renovación visual. Identidad por proyecto, interiores por tipo de trabajo que no estorban a nadie,
// decoración que no se confunde con estados, pantallas ambientales honestas y viaje de cámara.
// Corre en Node y en pruebas.html (sin Three.js).

import { prueba, igual, verdadero } from "./mini.js";
import { PALETAS, paletaDe, pisoDeTema, TIPOS_PISO, PICTOGRAMAS, ATLAS, COLORES_PICTOGRAMA, celdaPictograma, intensidadAmbiente, usaColorDeEstado } from "../app/vistas/vista3d/estilo-visual.js";
import { planInterior } from "../app/vistas/vista3d/interiores.js";
import { obstaculosCuarto, rectDe, seTocan } from "../app/vistas/vista3d/zonas-cuarto.js";
import { puestos, camino, caminoChoca } from "../app/vistas/vista3d/disposicion.js";
import { distribuirEdificio, fondoNecesario } from "../app/vistas/vista3d/plano-edificio.js";
import { TEMAS, temaDe } from "../app/vistas/vista3d/identidad.js";
import { duracionViaje, suavizarViaje } from "../app/vistas/vista3d/viaje-camara.js";
import { posicionDe, acomodarSinPosicion } from "../app/nucleo/modelo.js";

const TODOS_TEMAS = [...TEMAS.map((t) => t.tema), "general-a"];
const ESTILOS = ["comercial", "financiero", "general"];
const MUROS = new Set(["pantallaMuro", "tablero"]);

/** Revisa que ningún mueble de piso del plan toque escritorios, pasillo, puerta o caminos, ni salga del cuarto. */
function revisarPlan(plan, cuarto, lugares) {
  const obst = obstaculosCuarto(cuarto, lugares);
  const medidas = { tarima: [1.0, 0.8], banda: [1.6, 0.55], estacionPie: [0.7, 0.5], mesaAnalisis: [1.6, 1.4], archivero: [0.5, 0.48], archivoAlto: [1.2, 0.38], estanteria: [1.2, 0.34], credenza: [1.2, 0.46], rack: [0.6, 0.62], charolaCables: [1.2, 0.2], consola: [1.8, 0.6], globo: [0.4, 0.4], planta: [0.46, 0.46], lampara: [0.36, 0.36], monedas: [1.0, 0.42] };
  for (const p of plan) {
    if (p.pieza === "tapete") continue; // va en el piso, debajo de la mesa: se puede pisar
    if (MUROS.has(p.pieza)) {
      // En el muro izquierdo, nunca en la franja del pasillo de la puerta.
      verdadero(p.muro === "izq" && p.z + p.opciones.ancho / 2 <= cuarto.fondo / 2 - 1.38 + 1e-6, `${p.pieza} fuera del muro o en el pasillo (${p.z})`);
      continue;
    }
    const [w0, d] = medidas[p.pieza];
    const w = p.opciones.ancho ?? p.opciones.largo ?? w0;
    const r = rectDe(p.x, p.z, w, d, p.rot);
    verdadero(r.x0 >= -cuarto.ancho / 2 && r.x1 <= cuarto.ancho / 2 && r.z0 >= -cuarto.fondo / 2 && r.z1 <= cuarto.fondo / 2, `${p.pieza} se sale del cuarto`);
    const choque = obst.find((o) => seTocan(r, o));
    verdadero(!choque, `${p.pieza} en (${p.x}, ${p.z}) toca ${choque?.tipo}`);
  }
}

export function registrarCasosFaseM(leerTexto) {
  const leerJSON = async (ruta) => JSON.parse(await leerTexto(ruta));

  prueba("M · identidad: Compago (comercial) y Ek Chuah (financiero) tienen paletas distintas; estilo desconocido → general", () => {
    const c = PALETAS.comercial, f = PALETAS.financiero;
    for (const k of ["muro", "exterior", "madera", "silla", "pasillo", "tela"]) verdadero(c[k] !== f[k], `${k} igual en los dos proyectos`);
    igual(paletaDe("alimentos"), PALETAS.general);
    igual(paletaDe(undefined), PALETAS.general);
    igual(paletaDe("__proto__"), PALETAS.general, "no lee propiedades heredadas");
  });

  prueba("M · la decoración nunca usa un color de estado (azul trabajando, verde, rojo, ámbar, gris)", () => {
    for (const [nombre, p] of Object.entries(PALETAS)) verdadero(!usaColorDeEstado(Object.values(p)), `paleta ${nombre}`);
    verdadero(!usaColorDeEstado(Object.values(COLORES_PICTOGRAMA)), "colores de las pantallas ambientales");
    verdadero(usaColorDeEstado([0x4fb3ff]), "la revisión sí detecta un color de estado");
  });

  prueba("M · pisos: cada tema tiene un tipo conocido; Compago y Ek Chuah difieren; sin regla → duela", () => {
    for (const e of ESTILOS) for (const t of TODOS_TEMAS) verdadero(TIPOS_PISO.includes(pisoDeTema(t, e)), `${t}/${e}`);
    const distintos = TEMAS.filter(({ tema }) => pisoDeTema(tema, "comercial") !== pisoDeTema(tema, "financiero"));
    verdadero(distintos.length >= 2, "al menos dos temas con piso distinto entre proyectos");
    igual(pisoDeTema("general-b", "general"), "duela");
    igual(new Set(TEMAS.map(({ tema }) => pisoDeTema(tema, "comercial"))).size >= 3, true, "variedad de pisos en un mismo proyecto");
  });

  prueba("M · pantallas ambientales: 12 pictogramas en un atlas 4×3; uno desconocido usa «mosaico»", () => {
    igual(PICTOGRAMAS.length, ATLAS.columnas * ATLAS.filas);
    for (const n of PICTOGRAMAS) { const c = celdaPictograma(n); verdadero(c.col < ATLAS.columnas && c.fila < ATLAS.filas, n); }
    igual(celdaPictograma("cifras-falsas"), celdaPictograma("mosaico"));
  });

  prueba("M · honestidad: pantallas ambientales atenuadas sin datos vigentes (desactualizado, sin conexión o sin archivo)", () => {
    igual(intensidadAmbiente({ conexion: "en_linea", es_demo: true, generado_en: "x" }), 0.85);
    igual(intensidadAmbiente({ conexion: "en_linea", es_demo: false, generado_en: "2026-11-06T00:00:00Z" }), 0.85);
    igual(intensidadAmbiente({ conexion: "desactualizado", es_demo: false, generado_en: "x" }), 0.3);
    igual(intensidadAmbiente({ conexion: "sin_conexion", es_demo: false, generado_en: null }), 0.3);
    igual(intensidadAmbiente({ conexion: "en_linea", es_demo: false, generado_en: null }), 0.3, "sin archivo leído no hay datos");
    igual(intensidadAmbiente(null), 0.3);
  });

  prueba("M · interiores: ningún mueble toca escritorios, sillas, el pasillo de la puerta ni el camino de un personaje (1–12 puestos, 3 tamaños)", () => {
    const cuartos = [{ ancho: 6.4, fondo: 5.4 }, { ancho: 14.2, fondo: 5.4 }, { ancho: 6.4, fondo: 9.0 }];
    let revisados = 0;
    for (const base of cuartos) for (let n = 1; n <= 12; n++) {
      const cuarto = { ancho: base.ancho, fondo: Math.max(base.fondo, fondoNecesario(base.ancho, n)) };
      const lugares = puestos(n, cuarto);
      for (const tema of TODOS_TEMAS) for (const estilo of ESTILOS) {
        revisarPlan(planInterior(tema, cuarto, lugares, { estilo }), cuarto, lugares);
        revisados++;
      }
      // Los caminos de fase L siguen sin atravesar escritorios (los muebles no los cambian).
      for (const l of lugares) verdadero(!caminoChoca(camino(cuarto, l, lugares), l, lugares), `camino ${n} puestos`);
    }
    verdadero(revisados === 3 * 12 * TODOS_TEMAS.length * ESTILOS.length);
  });

  prueba("M · habitaciones con identidad: cada tipo de trabajo tiene su familia de muebles (no solo cambia el letrero)", () => {
    const cuarto = { ancho: 6.4, fondo: 5.4 };
    const lugares = puestos(1, cuarto);
    const firmas = new Map();
    for (const tema of TODOS_TEMAS) {
      const plan = planInterior(tema, cuarto, lugares, { estilo: "comercial" });
      verdadero(plan.length >= 3, `${tema}: ${plan.length} piezas`);
      firmas.set(tema, plan.map((p) => `${p.pieza}:${p.opciones.pictograma ?? ""}`).sort().join("|"));
    }
    igual(new Set(firmas.values()).size, firmas.size, "dos temas con exactamente los mismos muebles");
    // Ek Chuah cambia pantallas y detalles respecto a Compago en el mismo tema.
    const enFin = (t) => planInterior(t, cuarto, lugares, { estilo: "financiero" }).map((p) => `${p.pieza}:${p.opciones.pictograma ?? ""}`).sort().join("|");
    verdadero(["oportunidades", "margenes", "fuentes", "integracion"].every((t) => enFin(t) !== firmas.get(t)), "financiero igual a comercial");
  });

  prueba("M · interiores deterministas: el mismo cuarto siempre se amuebla igual (sin azar)", () => {
    const cuarto = { ancho: 6.4, fondo: 5.4 };
    for (const tema of TODOS_TEMAS) igual(planInterior(tema, cuarto, puestos(2, cuarto)), planInterior(tema, cuarto, puestos(2, cuarto)));
  });

  prueba("M · Compago (8 departamentos) y Ek Chuah (6): cada cuarto amueblado sin estorbar y con su propia familia", async () => {
    for (const [proyecto, estilo] of [["compago", "comercial"], ["ek-chuah", "financiero"]]) {
      const demo = await leerJSON(`datos/demo/${proyecto}.json`);
      const escena = await leerJSON(`escena/${proyecto}.json`);
      const deps = demo.departamentos.map((d) => ({ ...d, posicion: posicionDe(escena, d.id) }));
      acomodarSinPosicion(deps, escena.cuadricula.columnas); // UNIQ (sin lugar en la escena de Compago) se acomoda solo
      const acomodados = deps;
      const lista = acomodados.map((d) => ({ id: d.id, posicion: d.posicion, puestos: Math.max(1, d.agentes.length) }));
      const plano = distribuirEdificio(lista);
      const firmas = new Set();
      plano.cuartos.forEach((c, i) => {
        const dep = acomodados[i];
        const lugares = puestos(Math.max(1, dep.agentes.length), c);
        const plan = planInterior(temaDe({ ...dep, posicion: dep.posicion }), c, lugares, { estilo });
        verdadero(plan.length >= 3, `${proyecto}/${dep.id}: ${plan.length} piezas`);
        revisarPlan(plan, c, lugares);
        firmas.add(plan.map((p) => p.pieza + (p.opciones.pictograma ?? "")).sort().join("|"));
      });
      verdadero(firmas.size >= plano.cuartos.length - 1, `${proyecto}: ${firmas.size} familias para ${plano.cuartos.length} cuartos`);
    }
  });

  prueba("M · cámara: viaje de 0.45 a 0.9 s (más largo si va más lejos) con arranque y frenado suaves", () => {
    verdadero(duracionViaje(0) >= 0.45 && duracionViaje(1000, 1, 6) <= 0.9);
    verdadero(duracionViaje(20) >= duracionViaje(2), "más lejos, igual o más tiempo");
    verdadero(duracionViaje(2, 1, 4) > duracionViaje(2, 1, 1), "acercarse mucho también toma más tiempo");
    igual([suavizarViaje(0), suavizarViaje(0.5), suavizarViaje(1)], [0, 0.5, 1]);
    let antes = -1;
    for (let t = 0; t <= 1.0001; t += 0.05) { const v = suavizarViaje(t); verdadero(v >= antes, "siempre avanza"); antes = v; }
    verdadero(suavizarViaje(0.05) < 0.05 && suavizarViaje(0.95) > 0.95, "arranca y frena despacio");
  });

  prueba("M · el contrato sigue en su lugar y Tezcatlipoca sigue sin edificio (no se inventan departamentos)", async () => {
    const contrato = await leerTexto("contrato/CONTRATO.md");
    verdadero(/versi[oó]n/i.test(contrato), "el contrato sigue en su lugar");
    const proyectos = await leerJSON("datos/proyectos.json");
    igual(proyectos.proyectos.find((p) => p.id === "tezcatlipoca").distribucion, null, "Tezcatlipoca sigue sin edificio (no se inventan departamentos)");
  });
}
