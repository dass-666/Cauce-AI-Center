// Registro de proyectos (datos/proyectos.json o datos/proyectos.local.json). Sin DOM (se prueba en Node).
// Cada proyecto es un piso. El registro solo puede apuntar a archivos de esta carpeta, cada uno en su lugar:
//   estado        → datos/reales/<archivo>.json  (lo escribe el adaptador de solo lectura; fuera de git)
//   demo          → datos/demo/<archivo>.json    (opcional; debe venir marcado es_demo: true)
//   distribucion  → escena/<archivo>.json        (opcional)
//   naturalezas   → escena/<archivo>.json        (opcional; por omisión escena/<id>-naturaleza.json, si existe)
// Así un registro mal escrito no puede leer otro sitio ni mezclar una demostración con datos reales.

/** Estilos visuales de piso que entiende la vista 3D (fase L). Solo cambian decoración, nunca datos. */
export const ESTILOS_PISO = Object.freeze(["comercial", "financiero", "alimentos", "servicios", "general"]);

const ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
const ARCHIVO = (carpeta) => new RegExp(`^${carpeta}/[a-z0-9][a-z0-9._-]{0,80}\\.json$`);
const RUTAS = { estado: ARCHIVO("datos/reales"), demo: ARCHIVO("datos/demo"), distribucion: ARCHIVO("escena"), naturalezas: ARCHIVO("escena") };

/**
 * @param {any} datos  contenido del registro ({ proyectos: [...] })
 * @returns {{ proyectos: Array<{id,nombre,estado,demo,distribucion,naturalezas}>, avisos: string[] }}
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
    const entrada = { id: p.id, nombre: p.nombre.trim(), estado: p.estado, demo: opcional("demo"), distribucion: opcional("distribucion"),
      naturalezas: opcional("naturalezas") ?? `escena/${p.id}-naturaleza.json` };
    // Fase K (opcionales, fuera del contrato v1): proyecto pendiente de localizar y color de identidad del piso.
    if (p.pendiente !== undefined && p.pendiente !== null) {
      if (typeof p.pendiente === "string" && p.pendiente.trim() && p.pendiente.length <= 200) entrada.pendiente = p.pendiente.trim();
      else avisos.push(`${p.id}: "pendiente" debe ser un texto corto; se ignora.`);
    }
    if (p.color !== undefined && p.color !== null) {
      if (typeof p.color === "string" && /^#[0-9a-fA-F]{6}$/.test(p.color)) entrada.color = p.color.toLowerCase();
      else avisos.push(`${p.id}: "color" debe ser #rrggbb; se ignora.`);
    }
    // Fase L (opcional, fuera del contrato v1): estilo visual del piso (identidad, no datos). Ver identidad.js.
    if (p.estilo !== undefined && p.estilo !== null) {
      if (typeof p.estilo === "string" && ESTILOS_PISO.includes(p.estilo)) entrada.estilo = p.estilo;
      else avisos.push(`${p.id}: "estilo" debe ser uno de ${ESTILOS_PISO.join(", ")}; se ignora.`);
    }
    proyectos.push(entrada);
  });
  return { proyectos, avisos };
}
