// Identidad visual de cada departamento: tema (muebles y símbolo) y color de acento.
// Solo decoración: no dice nada del estado (para eso están los colores de estado).
// Sin Three.js (se prueba en Node).

import { huella } from "./disposicion.js";
import { ACENTOS } from "./paleta.js";

// Palabras del id o del nombre → tema. El primero que coincida gana.
export const TEMAS = Object.freeze([
  { tema: "importacion", palabras: ["import", "catalogo", "carga"] },
  { tema: "busqueda", palabras: ["busq", "buscar", "search", "proveedor"] },
  { tema: "fuentes", palabras: ["fuente", "lista", "revision"] },
  { tema: "oportunidades", palabras: ["oportunidad", "evaluacion"] },
  { tema: "margenes", palabras: ["margen", "rentab", "precio"] },
  { tema: "auditoria", palabras: ["auditor", "calidad"] },
  { tema: "supervision", palabras: ["supervis", "monitor", "estado"] },
  { tema: "integracion", palabras: ["integra", "uniq", "enlace", "api"] },
]);
const GENERICOS = ["general-a", "general-b", "general-c"];

const sinAcentos = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function temaDe(dep) {
  // Fase L: si la escena declara el tema del departamento (escena/<id>.json → "tema"), manda ese.
  const declarado = dep.posicion?.tema ?? dep.tema;
  if (declarado && (TEMAS.some((t) => t.tema === declarado) || GENERICOS.includes(declarado))) return declarado;
  const texto = sinAcentos(`${dep.id} ${dep.nombre ?? ""}`);
  return TEMAS.find((t) => t.palabras.some((p) => texto.includes(p)))?.tema ?? GENERICOS[(huella(dep.id) >>> 3) % GENERICOS.length];
}

/** Acento por tema (distintos entre sí); los genéricos usan la huella del id. */
export function acentoDe(dep) {
  const i = TEMAS.findIndex((t) => t.tema === temaDe(dep));
  return i >= 0 ? ACENTOS[i % ACENTOS.length] : ACENTOS[huella(dep.id) % ACENTOS.length];
}

// ---------- Fase L: estilo visual de cada piso (proyecto) ----------
// Identidad, no datos: cambia el piso de la recepción, el símbolo del letrero y un mueble de la recepción.
// Lo declara el registro (datos/proyectos.json → "estilo"); sin él, «general». Un proyecto pendiente no tiene
// oficinas: su estilo no se usa hasta que tenga datos reales.
export const ESTILOS = Object.freeze({
  comercial: { etiqueta: "Análisis comercial", icono: "comercial", baldosa: ["#46506e", "#4d5878"], linea: "#5b6890" },
  financiero: { etiqueta: "Finanzas", icono: "financiero", baldosa: ["#3d5250", "#435a57"], linea: "#577770" },
  alimentos: { etiqueta: "Negocios de comida", icono: "alimentos", baldosa: ["#584a5e", "#605166"], linea: "#78657f" },
  servicios: { etiqueta: "Servicios", icono: "servicios", baldosa: ["#45506a", "#4b5672"], linea: "#5d6a8a" },
  general: { etiqueta: "", icono: "general", baldosa: ["#4a5474", "#4f5a7c"], linea: "#5a6688" },
});

/** Estilo del proyecto del modelo de vista (proyecto.estilo); desconocido o ausente = general. */
export function estiloDe(proyecto) {
  return ESTILOS[proyecto?.estilo] ?? ESTILOS.general;
}
