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
  const texto = sinAcentos(`${dep.id} ${dep.nombre ?? ""}`);
  return TEMAS.find((t) => t.palabras.some((p) => texto.includes(p)))?.tema ?? GENERICOS[(huella(dep.id) >>> 3) % GENERICOS.length];
}

/** Acento por tema (distintos entre sí); los genéricos usan la huella del id. */
export function acentoDe(dep) {
  const i = TEMAS.findIndex((t) => t.tema === temaDe(dep));
  return i >= 0 ? ACENTOS[i % ACENTOS.length] : ACENTOS[huella(dep.id) % ACENTOS.length];
}
