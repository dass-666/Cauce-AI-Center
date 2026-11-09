// Configuración de arranque (fase L): ruta base y modo incrustado. Sin dependencias (se prueba en Node).
//
// Todas las rutas de la aplicación son RELATIVAS a la carpeta de index.html (app/…, vendor/…, datos/…,
// escena/…). Por eso funciona igual en http://127.0.0.1:8765/ que publicada bajo una subruta, por ejemplo
// https://portal.ejemplo/cauce/ — siempre que la dirección termine en «/» (index.html lo corrige al abrir).

/** Carpeta (con «/» final) donde vive la página: la base de todas las rutas relativas. */
export function rutaBase(url) {
  return new URL(url).pathname.replace(/[^/]*$/, "");
}

/** ¿Hay que agregar la «/» final? (/cauce → /cauce/; un archivo como /cauce/index.html no). */
export function necesitaBarraFinal(ruta) {
  return ruta !== "/" && !ruta.endsWith("/") && !/\.[a-z0-9]+$/i.test(ruta.split("/").pop());
}

/** Lee la configuración de la dirección de la página. */
export function leerConfiguracion(url) {
  const u = new URL(url);
  const q = u.searchParams;
  return {
    base: rutaBase(u.href),
    // Para mostrarse dentro de otra página (iframe del futuro portal): sin marca ni pie, el resto igual.
    incrustado: q.get("incrustado") === "1",
    // Estaciones de trabajo dentro de las oficinas (estaciones.js). ?estaciones=0 las quita para medir A/B el
    // rendimiento en la computadora de Diego (mismo edificio con y sin estaciones). Por omisión, encendidas.
    estaciones: q.get("estaciones") !== "0",
  };
}
