// Selector de pisos con muchos proyectos (fase L). Sin DOM (se prueba en Node).
// Con pocos proyectos se ven todas las pestañas, como antes. Con más de `maximo`, los proyectos PENDIENTES
// (sin repositorio localizado y sin datos) se juntan en un solo botón «+N pendientes»: no tienen oficinas que
// ver, pero siguen a un clic y en la sala de control. Nunca se agrupa el piso que se está viendo ni uno con datos.

/**
 * @param proyectos  registro validado (cada uno con id y, si aplica, pendiente)
 * @param resumen    Map id → clave de ESTADO_PISO (real, demo, desconectado...) o undefined si no se ha leído
 * @param actualId   piso que se está viendo
 * @returns {{ pestanas: object[], agrupados: object[] }}
 */
export function agruparPisos(proyectos, resumen, actualId, maximo = 7) {
  if (proyectos.length <= maximo) return { pestanas: proyectos.slice(), agrupados: [] };
  const agrupable = (p) => p.id !== actualId && Boolean(p.pendiente) && (resumen.get(p.id) ?? "desconectado") === "desconectado";
  const agrupados = proyectos.filter(agrupable);
  if (agrupados.length < 2) return { pestanas: proyectos.slice(), agrupados: [] }; // agrupar uno solo no ahorra nada
  return { pestanas: proyectos.filter((p) => !agrupable(p)), agrupados };
}
