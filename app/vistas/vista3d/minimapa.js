// Minimapa del piso (HTML <canvas>, sin costo en la tarjeta gráfica): un rectángulo por
// departamento con el color de su estado real, la recepción y un punto donde mira la cámara.
// Tocar un departamento lo enfoca; tocar fuera regresa al piso completo.

import { el } from "../dom.js";
import { hex } from "./iconos.js";

export function crearMinimapa({ alElegir }) {
  const lienzo = el("canvas", { width: 180, height: 120, "aria-hidden": "true" });
  const nodo = el("div", { clase: "vista3d-minimapa", title: "Minimapa: toca un departamento para acercarte" }, lienzo);
  const ctx = lienzo.getContext("2d");
  let ultimo = null; // { cuartos, limites, escala, ox, oz }
  let clave = "";

  lienzo.addEventListener("click", (e) => {
    if (!ultimo) return;
    const r = lienzo.getBoundingClientRect();
    const px = (e.clientX - r.left) * (lienzo.width / r.width);
    const py = (e.clientY - r.top) * (lienzo.height / r.height);
    const x = (px - ultimo.ox) / ultimo.escala + ultimo.limites.minX;
    const z = (py - ultimo.oz) / ultimo.escala + ultimo.limites.minZ;
    const c = ultimo.cuartos.find((c) => Math.abs(x - c.x) <= c.ancho / 2 && Math.abs(z - c.z) <= c.fondo / 2);
    alElegir(c ? c.id : null);
  });

  return {
    nodo,
    /**
     * @param cuartos  [{id, x, z, ancho, fondo, color}]  color = color del estado real
     * @param recepcion {x,z,ancho,fondo}|null
     * @param limites   {minX, minZ, ancho, fondo}
     * @param enfocado  id o null
     * @param objetivo  {x, z} punto al que mira la cámara
     */
    dibujar({ cuartos, recepcion, limites, enfocado, objetivo }) {
      const nueva = JSON.stringify([cuartos.map((c) => [c.id, c.color]), enfocado, Math.round(objetivo.x * 2), Math.round(objetivo.z * 2), limites.ancho]);
      if (nueva === clave) return;
      clave = nueva;
      const margen = 8;
      const escala = Math.min((lienzo.width - margen * 2) / limites.ancho, (lienzo.height - margen * 2) / limites.fondo);
      const ox = (lienzo.width - limites.ancho * escala) / 2;
      const oz = (lienzo.height - limites.fondo * escala) / 2;
      ultimo = { cuartos, limites, escala, ox, oz };
      const X = (x) => ox + (x - limites.minX) * escala;
      const Z = (z) => oz + (z - limites.minZ) * escala;
      ctx.clearRect(0, 0, lienzo.width, lienzo.height);
      ctx.fillStyle = "rgba(13,18,32,0.85)";
      ctx.fillRect(0, 0, lienzo.width, lienzo.height);
      ctx.fillStyle = "#2a3150";
      ctx.fillRect(X(limites.minX), Z(limites.minZ), limites.ancho * escala, limites.fondo * escala);
      if (recepcion) {
        ctx.fillStyle = "#4a5474";
        ctx.fillRect(X(recepcion.x - recepcion.ancho / 2), Z(recepcion.z - recepcion.fondo / 2), recepcion.ancho * escala, recepcion.fondo * escala);
      }
      for (const c of cuartos) {
        const x = X(c.x - c.ancho / 2) + 1, z = Z(c.z - c.fondo / 2) + 1;
        const w = c.ancho * escala - 2, h = c.fondo * escala - 2;
        ctx.fillStyle = hex(c.color);
        ctx.globalAlpha = 0.85;
        ctx.fillRect(x, z, w, h);
        ctx.globalAlpha = 1;
        if (c.id === enfocado) {
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 2;
          ctx.strokeRect(x, z, w, h);
        }
      }
      ctx.fillStyle = "#ffd89a";
      ctx.beginPath();
      ctx.arc(X(objetivo.x), Z(objetivo.z), 3.5, 0, Math.PI * 2);
      ctx.fill();
    },
  };
}
