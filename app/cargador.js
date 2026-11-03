// Lectura de archivos locales desde el navegador. Nunca toca bases de datos:
// solo lee los JSON que dejan los adaptadores (o los de demostración).

import { validarRegistro } from "./nucleo/registro.js";

export async function cargarJSON(url) {
  let resp;
  try {
    resp = await fetch(url, { cache: "no-store" });
  } catch (e) {
    return { tipo: "error_red", mensaje: "No se pudo contactar al servidor local." };
  }
  if (resp.status === 404) return { tipo: "no_encontrado", mensaje: `No existe ${url}` };
  if (!resp.ok) return { tipo: "error_red", mensaje: `Respuesta ${resp.status} al leer ${url}` };
  const texto = await resp.text();
  try {
    return { tipo: "ok", datos: JSON.parse(texto) };
  } catch {
    return { tipo: "json_invalido", mensaje: `${url} no es JSON válido.` };
  }
}

/** Registro de proyectos: primero el local (datos reales, fuera de git); si no existe, el de demostración. */
export async function cargarRegistro() {
  for (const url of ["datos/proyectos.local.json", "datos/proyectos.json"]) {
    const r = await cargarJSON(url);
    if (r.tipo === "ok" && Array.isArray(r.datos?.proyectos)) {
      const { proyectos, avisos } = validarRegistro(r.datos);
      for (const a of avisos) console.warn(`${url}: ${a}`);
      return { url, proyectos, avisos };
    }
  }
  return { url: null, proyectos: [] };
}
