// Cambios observados entre dos lecturas del archivo de estado. Sin DOM (se prueba en Node).
// No es un historial: solo compara la lectura anterior con la actual. Si algo cambió y volvió
// entre dos lecturas, no se ve; no se inventan pasos intermedios ni horas exactas.

/** Resumen mínimo de un modelo de vista para comparar después. */
export function fotografia(m) {
  const agentes = new Map();
  for (const d of m.departamentos) {
    for (const a of d.agentes) agentes.set(a.id, { estado: a.estado, nombre: a.nombre, departamento: d.nombre });
  }
  const deps = new Map(m.departamentos.map((d) => [d.id, d.nombre]));
  const alertas = new Map(m.alertas.map((a) => [a.id, { titulo: a.titulo, nivel: a.nivel, departamento: deps.get(a.departamento_id) ?? null }]));
  return {
    proyecto: m.proyecto.id,
    generado_en: m.generado_en,
    conexion: m.conexion,
    conexion_etiqueta: m.conexion_etiqueta,
    es_demo: m.es_demo,
    agentes,
    alertas,
  };
}

/**
 * Diferencias entre dos fotografías del mismo proyecto. Cada cambio dice entre qué datos se observó
 * (generado_en anterior y actual), nunca a qué hora exacta ocurrió.
 */
export function compararLecturas(antes, ahora) {
  if (!antes || !ahora || antes.proyecto !== ahora.proyecto) return [];
  const base = { entre: [antes.generado_en, ahora.generado_en], es_demo: ahora.es_demo };
  const cambios = [];
  if (antes.conexion !== ahora.conexion) {
    cambios.push({ ...base, tipo: "conexion", de: antes.conexion_etiqueta, a: ahora.conexion_etiqueta });
  }
  // Solo se comparan agentes y alertas entre dos archivos válidos y distintos.
  const validos = antes.generado_en && ahora.generado_en;
  if (!validos || antes.generado_en === ahora.generado_en) return cambios;
  for (const [id, a] of ahora.agentes) {
    const previo = antes.agentes.get(id);
    if (!previo) cambios.push({ ...base, tipo: "agente_nuevo", agente: a.nombre, departamento: a.departamento, a: a.estado });
    else if (previo.estado !== a.estado) cambios.push({ ...base, tipo: "estado", agente: a.nombre, departamento: a.departamento, de: previo.estado, a: a.estado });
  }
  for (const [id, a] of antes.agentes) {
    if (!ahora.agentes.has(id)) cambios.push({ ...base, tipo: "agente_quitado", agente: a.nombre, departamento: a.departamento });
  }
  for (const [id, al] of ahora.alertas) {
    if (!antes.alertas.has(id)) cambios.push({ ...base, tipo: "alerta_nueva", titulo: al.titulo, nivel: al.nivel, departamento: al.departamento });
  }
  for (const [id, al] of antes.alertas) {
    if (!ahora.alertas.has(id)) cambios.push({ ...base, tipo: "alerta_quitada", titulo: al.titulo, nivel: al.nivel, departamento: al.departamento });
  }
  return cambios;
}

/** Guarda la última lectura y los cambios observados en esta página (se pierden al recargar). */
export function crearRegistroCambios({ maximo = 30 } = {}) {
  let ultima = null;
  let lista = [];
  return {
    /** Agrega una lectura nueva; devuelve los cambios que encontró. */
    leer(modelo) {
      const foto = fotografia(modelo);
      if (ultima && ultima.proyecto !== foto.proyecto) lista = []; // otro proyecto: empieza de cero
      const nuevos = compararLecturas(ultima, foto);
      ultima = foto;
      lista = [...nuevos.reverse(), ...lista].slice(0, maximo);
      return nuevos;
    },
    get cambios() { return lista; },
  };
}
