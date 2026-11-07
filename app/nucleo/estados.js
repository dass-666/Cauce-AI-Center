// Catálogo único de estados. Lo usan el contrato, la vista 2D y (después) la vista 3D.
// Cada estado dice cómo se ve en 2D (clase CSS) y qué animación usará el personaje 3D.
// Agregar un estado aquí obliga a darle apariencia en ambas vistas (lo revisan las pruebas).

export const ESTADOS = Object.freeze({
  trabajando: {
    etiqueta: "Trabajando",
    descripcion: "Hay un registro en curso que lo respalda.",
    icono: "⚙",
    clase2d: "estado-trabajando",
    animacion3d: "sentado_tecleando",
    prioridad: 3,
  },
  esperando: {
    etiqueta: "Esperando",
    descripcion: "Conectado y sin tarea en curso.",
    icono: "…",
    clase2d: "estado-esperando",
    animacion3d: "sentado_en_reposo",
    prioridad: 2,
  },
  finalizado: {
    etiqueta: "Finalizado",
    descripcion: "Su última tarea terminó correctamente.",
    icono: "✓",
    clase2d: "estado-finalizado",
    animacion3d: "estirarse",
    prioridad: 1,
  },
  error: {
    etiqueta: "Error",
    descripcion: "Su última tarea falló.",
    icono: "!",
    clase2d: "estado-error",
    animacion3d: "de_pie_alerta",
    prioridad: 5,
  },
  requiere_revision: {
    etiqueta: "Requiere revisión",
    descripcion: "Algo espera la decisión de una persona.",
    icono: "?",
    clase2d: "estado-revision",
    animacion3d: "levantar_mano",
    prioridad: 4,
  },
  sin_datos: {
    etiqueta: "Sin información",
    descripcion: "No hay evidencia de lo que está haciendo.",
    icono: "–",
    clase2d: "estado-sin-datos",
    animacion3d: "ausente",
    prioridad: 0,
  },
});

export const NOMBRES_ESTADOS = Object.freeze(Object.keys(ESTADOS));

// Estado de la conexión con el proyecto (el archivo JSON que deja su adaptador).
export const CONEXION = Object.freeze({
  en_linea: { etiqueta: "En línea", clase2d: "conexion-en-linea" },
  desactualizado: { etiqueta: "Datos desactualizados", clase2d: "conexion-desactualizado" },
  desconectado: { etiqueta: "Sin conexión", clase2d: "conexion-desconectado" },
  invalido: { etiqueta: "Archivo inválido", clase2d: "conexion-invalido" },
});

/** Estado que resume un departamento: el de mayor prioridad entre sus personajes. */
export function estadoResumen(estados) {
  let mejor = "sin_datos";
  for (const e of estados) {
    if (ESTADOS[e] && ESTADOS[e].prioridad > ESTADOS[mejor].prioridad) mejor = e;
  }
  return mejor;
}
