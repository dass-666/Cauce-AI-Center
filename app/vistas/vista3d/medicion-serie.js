// Serie de medición A/B para la computadora de Diego (Intel UHD). Abre UNA dirección:
//   http://127.0.0.1:8765/?medir=1&auto=30&serie=1
// y la página recorre sola los casos de abajo, en la misma pestaña (nada más dibuja mientras mide), descarga un
// archivo por caso y al final cauce-medicion-serie.json con la comparación. Mismo piso, cámara (edificio completo,
// sin enfocar), tamaño de ventana y brillo en cada par; solo cambia lo que se compara.
// Lo que mide es el navegador en ESA computadora; en Chromium de pruebas (SwiftShader) los cps no significan nada.

export const CASOS_SERIE = Object.freeze([
  { caso: "A-compago-sin-estaciones", proyecto: "compago", estaciones: false, fusion: true },
  { caso: "B-compago-con-estaciones", proyecto: "compago", estaciones: true, fusion: true },
  { caso: "C-ek-chuah-sin-estaciones", proyecto: "ek-chuah", estaciones: false, fusion: true },
  { caso: "D-ek-chuah-con-estaciones", proyecto: "ek-chuah", estaciones: true, fusion: true },
  // Como el commit 9c002f0 (cada cuarto con sus mallas): para ver en la GPU real lo que ahorra la fusión del edificio.
  { caso: "E-compago-con-estaciones-sin-fusion", proyecto: "compago", estaciones: true, fusion: false },
]);
const CLAVE = "cauce.serieMedicion";

/** Dirección de un paso de la serie, conservando el resto de los parámetros (auto, puerto, etc.). */
export function direccionPaso(base, paso) {
  const u = new URL(base);
  const c = CASOS_SERIE[paso];
  for (const k of ["caso", "proyecto", "estaciones", "fusion", "paso"]) u.searchParams.delete(k);
  u.searchParams.set("paso", String(paso));
  u.searchParams.set("caso", c.caso);
  u.searchParams.set("proyecto", c.proyecto);
  u.searchParams.set("modo3d", "edificio");
  u.searchParams.set("quieta", "0"); // cada cuadro se dibuja en todos los casos (ya lo implica ?auto; queda explícito)
  if (!c.estaciones) u.searchParams.set("estaciones", "0");
  if (!c.fusion) u.searchParams.set("fusion", "0");
  return u.href;
}

function leer() { try { return JSON.parse(sessionStorage.getItem(CLAVE) ?? "[]"); } catch { return []; } }
function guardar(x) { try { sessionStorage.setItem(CLAVE, JSON.stringify(x)); } catch { /* sin almacenamiento */ } }

/** Si la página es el primer paso (sin «paso»), vacía la serie. Devuelve la dirección del primer caso o null. */
export function inicioDeSerie(href) {
  const u = new URL(href);
  if (!u.searchParams.has("serie") || u.searchParams.has("paso")) return null;
  guardar([]);
  return direccionPaso(href, 0);
}

/** Guarda el informe de este paso; devuelve la dirección del siguiente o null si era el último. */
export function registrarEnSerie(informe, href) {
  const lista = leer().filter((x) => x.caso !== informe.caso);
  lista.push(informe);
  guardar(lista);
  const paso = Number(new URL(href).searchParams.get("paso") ?? 0);
  return paso + 1 < CASOS_SERIE.length ? direccionPaso(href, paso + 1) : null;
}

const CAMPOS = ["fps_promedio", "fps_minimo", "cps_1pct_bajo", "cuadro_p99_ms", "peor_cuadro_ms", "segundos_bajo_50", "llamadas", "triangulos", "texturas", "geometrias", "memoria_js_mb"];

/** Compara con/sin estaciones con el criterio de Diego: ≤ 3 cps de diferencia media y sin segundos nuevos bajo 50. */
export function compararPar(sin, con) {
  if (!sin || !con) return null;
  const dif = Object.fromEntries(CAMPOS.map((k) => [k, sin[k] == null || con[k] == null ? null : Math.round((con[k] - sin[k]) * 10) / 10]));
  const cumple = dif.fps_promedio !== null && dif.fps_promedio >= -3 && con.segundos_bajo_50 <= sin.segundos_bajo_50;
  return { diferencia: dif, cumple_criterio: cumple };
}

export function resumenSerie(lista = leer()) {
  const de = (c) => lista.find((x) => x.caso === c) ?? null;
  const gpus = [...new Set(lista.map((x) => x.gpu))];
  const compago = compararPar(de(CASOS_SERIE[0].caso), de(CASOS_SERIE[1].caso));
  const ek = compararPar(de(CASOS_SERIE[2].caso), de(CASOS_SERIE[3].caso));
  const fusion = compararPar(de(CASOS_SERIE[4].caso), de(CASOS_SERIE[1].caso));
  const intel = gpus.length > 0 && gpus.every((g) => /intel/i.test(g ?? ""));
  const fila = (x) => `${x.caso}: ${x.fps_promedio} cps prom. · mín. ${x.fps_minimo} · 1 % más lento ${x.cps_1pct_bajo} · ${x.segundos_bajo_50} s bajo 50 · ${x.llamadas} llamadas · ${x.texturas} texturas`;
  const veredicto = (n, c) => `${n}: ${c ? `${c.diferencia.fps_promedio >= 0 ? "+" : ""}${c.diferencia.fps_promedio} cps con estaciones → ${c.cumple_criterio ? "CUMPLE" : "NO CUMPLE"} (≤ 3 cps y sin segundos nuevos bajo 50)` : "incompleto"}`;
  const texto = [
    `SERIE TERMINADA · ${lista.length}/${CASOS_SERIE.length} casos · GPU: ${gpus.join(" | ") || "?"}${intel ? "" : "  ⚠ NO es la Intel: la medición no vale para la UHD"}`,
    ...lista.map(fila), veredicto("Compago", compago), veredicto("Ek Chuah", ek),
    `Fusión del edificio (Compago con estaciones): ${fusion ? `${fusion.diferencia.llamadas} llamadas, ${fusion.diferencia.fps_promedio >= 0 ? "+" : ""}${fusion.diferencia.fps_promedio} cps frente a sin fusión` : "incompleto"}`,
  ].join("\n");
  return { herramienta: "Cauce 3D · serie A/B", fecha: new Date().toISOString(), gpu: gpus, es_intel: intel, casos: lista, compago, ek_chuah: ek, fusion, texto };
}
