// Navegación entre departamentos (teclado, flechas de la barra móvil y gesto de deslizar).
// Sin DOM ni Three.js (se prueba en Node).

/** Departamento vecino de `actualId` en el orden del archivo; sin actual, el primero o el último. */
export function vecinoDe(deps, actualId, paso) {
  if (!deps.length) return null;
  const i = deps.findIndex((d) => d.id === actualId);
  if (i < 0) return paso > 0 ? deps[0] : deps[deps.length - 1];
  return deps[(i + paso + deps.length) % deps.length];
}

/** Lo que muestra el botón central de la barra móvil y cada renglón de la lista de departamentos. */
export function resumenDepartamento(d) {
  const conEvidencia = d.agentes.filter((a) => a.estado_mostrado !== "sin_datos").length;
  return {
    id: d.id,
    nombre: d.nombre,
    estado: d.estado_resumen,
    etiquetaEstado: d.apariencia_resumen?.etiqueta ?? d.estado_resumen,
    alertas: d.alertas.length,
    agentes: d.agentes.length,
    conEvidencia,
  };
}
