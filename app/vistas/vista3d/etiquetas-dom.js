// Capa de etiquetas HTML sobre el lienzo (nombre y estado de cada departamento del edificio).
// HTML nítido en vez de texto 3D. La regla de acomodo sin encimarse está en etiquetas.js (se prueba en Node).

import * as THREE from "three";
import { el } from "../dom.js";
import { acomodarEtiquetas, nombresCortos, prioridadEtiqueta } from "./etiquetas.js";

export function crearCapaEtiquetas({ movil, alElegir }) {
  const nodo = el("div", { clase: "vista3d-etiquetas" });
  const etiquetas = new Map(); // id del departamento → botón
  const proyectado = new THREE.Vector3();

  function limpiar() {
    etiquetas.clear();
    nodo.replaceChildren();
  }

  function crear(visibles) {
    limpiar();
    for (const d of visibles) {
      const boton = el("button", { type: "button", clase: "etiqueta-dep", onclick: () => alElegir(d.id) });
      etiquetas.set(d.id, boton);
      nodo.append(boton);
    }
  }

  /** enfocado: id del departamento enfocado; sel: selección actual. */
  function actualizar(visibles, sel, enfocado) {
    const cortos = nombresCortos(visibles.map((d) => d.nombre));
    visibles.forEach((d, i) => {
      const boton = etiquetas.get(d.id);
      if (!boton) return;
      const elegida = sel?.tipo === "departamento" && sel.id === d.id;
      boton.dataset.prioridad = prioridadEtiqueta({ enfocado: d.id === enfocado || elegida, estado: d.estado_resumen, alertas: d.alertas.length });
      const corto = movil ? cortos[i] : d.nombre;
      const ap = d.apariencia_resumen;
      const clave = `${corto}|${d.nombre}|${ap.clase2d}|${d.alertas.length}|${elegida}`;
      if (boton.dataset.clave === clave) return;
      boton.dataset.clave = clave;
      boton.className = `etiqueta-dep ${ap.clase2d}${elegida ? " elegida" : ""}`;
      boton.replaceChildren(...[el("span", { clase: "etiqueta-luz", "aria-hidden": "true" }), corto,
        el("span", { clase: "solo-lector" }, `, ${ap.etiqueta}`),
        d.alertas.length ? el("span", { clase: "etiqueta-alertas" }, ` ⚠ ${d.alertas.length}`) : null].filter(Boolean));
      boton.title = `${d.nombre}: ${ap.etiqueta}`;
      boton.setAttribute("aria-label", `${d.nombre}: ${ap.etiqueta}${d.alertas.length ? `, ${d.alertas.length} alerta(s)` : ""}`);
      // Tamaño medido una vez por cambio de contenido (no en cada cuadro).
      const ocultaba = [nodo.hidden, boton.hidden];
      nodo.hidden = boton.hidden = false;
      boton.dataset.ancho = boton.offsetWidth;
      boton.dataset.alto = boton.offsetHeight;
      [nodo.hidden, boton.hidden] = ocultaba;
    });
  }

  /**
   * Coloca cada etiqueta en el primer lugar libre (muro del fondo, centro del cuarto o junto a la puerta)
   * y oculta las que chocarían con otra más importante. zona = {w, h, arriba}: h es el límite inferior.
   */
  function colocar(camara, escenario, zona) {
    const verlas = camara.zoom < 1.9;
    nodo.hidden = !verlas;
    if (!verlas) return;
    const { w, h } = zona;
    const alto = zona.alto ?? h;
    const enPantalla = (x, y, z) => { proyectado.set(x, y, z).project(camara); return { x: (proyectado.x + 1) / 2 * w, y: (1 - proyectado.y) / 2 * alto }; };
    const items = [];
    for (const [id, boton] of etiquetas) {
      const c = escenario.rectangulo(id);
      if (!c) continue;
      const opciones = [enPantalla(c.x, 2.4, c.z - c.fondo / 2), enPantalla(c.x, 1.3, c.z), enPantalla(c.x - c.ancho / 4, 1.0, c.z + c.fondo / 2)];
      items.push({ id, opciones, w: Number(boton.dataset.ancho) || 120, h: Number(boton.dataset.alto) || 24, prioridad: Number(boton.dataset.prioridad) || 0 });
    }
    const elegidas = acomodarEtiquetas(items, { w, h, arriba: zona.arriba });
    for (const it of items) {
      const boton = etiquetas.get(it.id);
      const k = elegidas.get(it.id);
      if (boton.hidden !== (k === undefined)) boton.hidden = k === undefined;
      if (k !== undefined) boton.style.transform = `translate(${it.opciones[k].x}px, ${it.opciones[k].y}px) translate(-50%, -100%)`;
    }
  }

  return { nodo, crear, actualizar, colocar, limpiar };
}
