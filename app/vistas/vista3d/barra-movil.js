// Barra inferior para celular: ◀ [● Departamento ▾] ▶ ⋯
// - Las flechas pasan al departamento vecino (lo mismo que deslizar el dedo o las teclas ← →).
// - El botón central abre la lista de todos los departamentos (estado, personajes con evidencia, alertas).
// - ⋯ abre las opciones secundarias (modo, luz fija, centrar, volver al piso).
// Solo DOM: no decide nada, recibe el resumen ya calculado (navegacion.js) y avisa lo que se tocó.

import { el } from "../dom.js";
import { ESTADOS } from "../../nucleo/estados.js";

const claseEstado = (estado) => ESTADOS[estado]?.clase2d ?? "sin_datos";

export function crearBarraMovil({ alPaso, alElegir, alModo, alLuzFija, alCentrar, alVolverPiso, alRecepcion = null, alSiguienteAlerta = null, alSala = null }) {
  const anterior = el("button", { type: "button", clase: "movil-flecha", "aria-label": "Departamento anterior" }, "◀");
  const siguiente = el("button", { type: "button", clase: "movil-flecha", "aria-label": "Departamento siguiente" }, "▶");
  const luz = el("span", { clase: "etiqueta-luz", "aria-hidden": "true" });
  const nombre = el("span", { clase: "movil-nombre" });
  const alertas = el("span", { clase: "movil-alertas", hidden: true });
  const actual = el("button", { type: "button", clase: "movil-actual", "aria-haspopup": "listbox", "aria-expanded": "false" },
    luz, nombre, alertas, el("span", { "aria-hidden": "true" }, "▾"));
  const mas = el("button", { type: "button", clase: "movil-flecha", "aria-label": "Más opciones", "aria-haspopup": "menu", "aria-expanded": "false" }, "⋯");
  const lista = el("div", { clase: "movil-hoja movil-lista", role: "listbox", "aria-label": "Departamentos", hidden: true });
  const menu = el("div", { clase: "movil-hoja movil-menu", role: "menu", "aria-label": "Opciones de la vista", hidden: true });
  const nodo = el("div", { clase: "vista3d-movil" }, lista, menu, el("div", { clase: "movil-barra" }, anterior, actual, siguiente, mas));

  let ultimo = null;

  function cerrar() {
    lista.hidden = menu.hidden = true;
    actual.setAttribute("aria-expanded", "false");
    mas.setAttribute("aria-expanded", "false");
  }
  function abrir(hoja, boton) {
    const estaba = !hoja.hidden;
    cerrar();
    if (estaba) return;
    hoja.hidden = false;
    boton.setAttribute("aria-expanded", "true");
    hoja.querySelector("[aria-selected='true'], button")?.focus({ preventScroll: true });
  }
  anterior.addEventListener("click", () => { cerrar(); alPaso(-1); });
  siguiente.addEventListener("click", () => { cerrar(); alPaso(1); });
  actual.addEventListener("click", () => abrir(lista, actual));
  mas.addEventListener("click", () => abrir(menu, mas));
  nodo.addEventListener("keydown", (e) => { if (e.key === "Escape" && (!lista.hidden || !menu.hidden)) { cerrar(); actual.focus(); e.stopPropagation(); } });

  const opcion = (texto, accion, extra = {}) =>
    el("button", { type: "button", role: "menuitem", clase: "movil-opcion", ...extra, onclick: () => { cerrar(); accion(); } }, texto);

  return {
    nodo,
    cerrar,
    estaAbierta: () => !lista.hidden || !menu.hidden,
    /**
     * @param resumenes  [{id,nombre,estado,etiquetaEstado,alertas,agentes,conEvidencia}] en el orden del archivo
     * @param actualId   departamento enfocado o mostrado (null = todo el piso)
     * @param modo       "edificio" | "individual"
     * @param luzFija    boolean
     */
    actualizar({ resumenes, actualId, modo, luzFija, hayAtencion = false }) {
      const clave = JSON.stringify([resumenes, actualId, modo, luzFija, hayAtencion]);
      if (clave === ultimo) return;
      ultimo = clave;
      const dep = resumenes.find((r) => r.id === actualId) ?? null;
      const alertasPiso = resumenes.reduce((n, r) => n + r.alertas, 0);
      actual.className = `movil-actual ${dep ? claseEstado(dep.estado) : ""}`;
      nombre.textContent = dep ? dep.nombre : "Todo el piso";
      const nAlertas = dep ? dep.alertas : alertasPiso;
      alertas.hidden = nAlertas === 0;
      alertas.textContent = `⚠ ${nAlertas}`;
      actual.setAttribute("aria-label", `${dep ? `${dep.nombre}, ${dep.etiquetaEstado}` : "Todo el piso"}${nAlertas ? `, ${nAlertas} alerta(s)` : ""}. Elegir departamento`);
      const sinLista = resumenes.length < 2;
      anterior.disabled = siguiente.disabled = resumenes.length === 0 || (sinLista && dep !== null);

      const fila = (r) => el("button", {
        type: "button", role: "option", clase: `movil-fila ${r ? claseEstado(r.estado) : ""}`,
        "aria-selected": (r ? r.id : null) === actualId ? "true" : "false",
        onclick: () => { cerrar(); alElegir(r ? r.id : null); },
      },
      el("span", { clase: "etiqueta-luz", "aria-hidden": "true" }),
      el("span", { clase: "movil-fila-nombre" }, r ? r.nombre : "Todo el piso"),
      el("span", { clase: "movil-fila-detalle" }, r
        ? `${r.etiquetaEstado} · ${r.conEvidencia}/${r.agentes} con evidencia`
        : `${resumenes.length} departamentos`),
      (r ? r.alertas : alertasPiso) ? el("span", { clase: "movil-alertas" }, `⚠ ${r ? r.alertas : alertasPiso}`) : null);
      lista.replaceChildren(...(modo === "edificio" ? [fila(null)] : []), ...resumenes.map(fila));

      menu.replaceChildren(...[
        el("p", { clase: "movil-menu-titulo" }, "Vista"),
        opcion("Edificio completo", () => alModo("edificio"), { "aria-checked": modo === "edificio" ? "true" : "false", role: "menuitemradio" }),
        opcion("Un cuarto", () => alModo("individual"), { "aria-checked": modo === "individual" ? "true" : "false", role: "menuitemradio" }),
        el("p", { clase: "movil-menu-titulo" }, "Cámara"),
        opcion("Centrar", alCentrar),
        modo === "edificio" && actualId ? opcion("← Volver al piso", alVolverPiso) : null,
        modo === "edificio" && alRecepcion ? opcion("⌂ Ir a la recepción", alRecepcion) : null,
        alSiguienteAlerta && hayAtencion ? opcion("⚠ Siguiente departamento con alertas", alSiguienteAlerta) : null,
        alSala ? el("p", { clase: "movil-menu-titulo" }, "Empresa") : null,
        alSala ? opcion("◉ Sala de control (todos los proyectos)", alSala) : null,
        el("p", { clase: "movil-menu-titulo" }, "Luz"),
        opcion(luzFija ? "Usar luz de la hora" : "Luz fija (siempre de día)", () => alLuzFija(!luzFija), { role: "menuitemcheckbox", "aria-checked": luzFija ? "true" : "false" }),
      ].filter(Boolean));
    },
  };
}
