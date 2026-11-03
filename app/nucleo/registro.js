// Registro de proyectos (datos/proyectos.json o datos/proyectos.local.json). Sin DOM (se prueba en Node).
// Cada proyecto es un piso. El registro solo puede apuntar a archivos de esta carpeta, cada uno en su lugar:
//   estado        → datos/reales/<archivo>.json  (lo escribe el adaptador de solo lectura; fuera de git)
//   demo          → datos/demo/<archivo>.json    (opcional; debe venir marcado es_demo: true)
//   distribucion  → escena/<archivo>.json        (opcional)
// Así un registro mal escrito no puede leer otro sitio ni mezclar una demostración con datos reales.

const ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
const ARCHIVO = (carpeta) => new RegExp(`^${carpeta}/[a-z0-9][a-z0-9._-]{0,80}\\.json$`);
const RUTAS = { estado: ARCHIVO("datos/reales"), demo: ARCHIVO("datos/demo"), distribucion: ARCHIVO("escena") };

/**
 * @param {any} datos  contenido del registro ({ proyectos: [...] })
 * @returns {{ proyectos: Array<{id,nombre,estado,demo,distribucion}>, avisos: string[] }}
 */
export function validarRegistro(datos) {
  const avisos = [];
  const proyectos = [];
  if (!datos || !Array.isArray(datos.proyectos)) return { proyectos, avisos: ["El registro no tiene una lista \"proyectos\"."] };
  const vistos = new Set();
  datos.proyectos.forEach((p, i) => {
    const lugar = `proyectos[${i}]`;
    if (!p || typeof p !== "object") { avisos.push(`${lugar}: no es un objeto; se omite.`); return; }
    if (typeof p.id !== "string" || !ID.test(p.id)) { avisos.push(`${lugar}: id inválido; se omite.`); return; }
    if (vistos.has(p.id)) { avisos.push(`${lugar}: id "${p.id}" repetido; se omite.`); return; }
    if (typeof p.nombre !== "string" || !p.nombre.trim() || p.nombre.length > 60) { avisos.push(`${p.id}: nombre inválido; se omite.`); return; }
    if (typeof p.estado !== "string" || !RUTAS.estado.test(p.estado)) {
      avisos.push(`${p.id}: "estado" debe ser datos/reales/<archivo>.json; se omite.`);
      return;
    }
    const opcional = (campo) => {
      if (p[campo] === undefined || p[campo] === null) return null;
      if (typeof p[campo] === "string" && RUTAS[campo].test(p[campo])) return p[campo];
      avisos.push(`${p.id}: "${campo}" no permitido (${campo === "demo" ? "datos/demo/" : "escena/"}<archivo>.json); se ignora.`);
      return null;
    };
    vistos.add(p.id);
    proyectos.push({ id: p.id, nombre: p.nombre.trim(), estado: p.estado, demo: opcional("demo"), distribucion: opcional("distribucion") });
  });
  return { proyectos, avisos };
}
