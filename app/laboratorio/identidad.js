// Laboratorio de IA · fase 3 · identidad de quien revisa y estado de la decisión humana.
//
// HOY no existe infraestructura de identidad (Cauce corre local, sin cuentas ni servidor): quien aprueba o rechaza
// DECLARA su nombre y nadie lo comprueba. Esto se muestra siempre, con una advertencia visible. No se finge una
// autenticación: el contrato del trabajo solo admite `autenticacion: "declarada"`, y cualquier otra cosa escrita a mano
// en los datos se rechaza.
//
// Interfaz preparada para el futuro: un proveedor de identidad con { id, disponible, motivo, autenticar(persona) }.
// Cuando exista uno real (p. ej. el inicio de sesión de CauceService), autenticar() devolverá una prueba verificable y
// el contrato del trabajo pasará a una versión que la guarde. Hasta entonces, el único proveedor es «ninguno».

import { ESTADOS_FINALES } from "./trabajo.js";

export const MODOS_IDENTIDAD = Object.freeze(["declarada", "autenticada"]);
export const ADVERTENCIA_DECLARADA = "Identidad DECLARADA, sin autenticar: el nombre lo escribió la persona y el sistema no puede comprobarlo.";

export const PROVEEDOR_IDENTIDAD_NINGUNO = Object.freeze({
  id: "ninguno", disponible: false,
  motivo: "No hay infraestructura de identidad en este proyecto (todo es local, sin cuentas ni servidor). La revisión humana es declarada.",
  async autenticar() { return { ok: false, modo: "declarada", motivo: this.motivo }; },
});

/** Proveedor de identidad en uso. Solo existe «ninguno»: no se acepta otro hasta que haya uno real y probado. */
export function proveedorIdentidad() { return PROVEEDOR_IDENTIDAD_NINGUNO; }

/**
 * Estado de la decisión humana de un trabajo, para mostrar sin ambigüedad.
 * @returns {{decision: "pendiente"|"aprobada"|"rechazada", identidad: "declarada"|null, por, en, motivo, advertencia}}
 */
export function estadoDecision(trabajo) {
  if (!ESTADOS_FINALES.includes(trabajo?.estado)) return { decision: "pendiente", identidad: null, por: null, en: null, motivo: null, advertencia: null };
  const d = trabajo.decision_humana;
  return {
    decision: trabajo.estado === "aprobado_por_humano" ? "aprobada" : "rechazada", identidad: d?.por?.autenticacion === "declarada" ? "declarada" : null,
    por: d?.por?.identificador ?? null, en: d?.en ?? null, motivo: d?.motivo ?? null, advertencia: ADVERTENCIA_DECLARADA,
  };
}
