// Cierre del producto: expediente legible (.md), colección descargable del laboratorio, caso histórico publicado
// (índice + reconstrucción con el motor) y tratamiento de n_rango / n_comparaciones=null en Nexus (caso L6 de Tezcatlipoca).
// Corre en Node y en pruebas.html.

import { prueba, igual, verdadero } from "./mini.js";
import { informeInvestigacion, md } from "../app/csi/informe.js";
import { coleccionInvestigaciones, leerCSI } from "../app/csi/registro.js";
import { construirDemoCSI } from "../app/csi/demo.js";
import { construirDesdeExpediente } from "../app/csi/expediente.js";
import { crearInvestigacion, aplicarCambio } from "../app/csi/investigacion.js";
import { leccion } from "./casos-nexus.js";
import { validarLeccion } from "../app/nexus/leccion.js";
import { evaluarLeccion, rangoComparaciones } from "../app/nexus/gerente.js";

const AHORA = Date.parse("2026-11-07T12:00:00-06:00");
const regla = (l, id) => evaluarLeccion(l, { ahora: AHORA }).reglas.find((r) => r.id === id);
const con = (f) => { const l = leccion(); f(l); return l; };
const tiene = (lista, re) => lista.some((t) => re.test(t));

export function registrarCasosCierre(leerTexto) {
  // ---------------- Expediente legible ----------------
  prueba("Cierre · informe: el expediente .md del DEMO lleva la banda DEMO, las 10 secciones y las fuentes con su estado", async () => {
    const d = await construirDemoCSI();
    const c = await leerCSI(d);
    const inv = c.investigaciones[0].inv;
    const t = informeInvestigacion(inv, { actores: d.actores, escenarios: c.escenarios.map((x) => x.esc), ahora: "2026-11-07T12:00:00Z" });
    verdadero(t.startsWith(`# Expediente CSI · ${inv.titulo}`), "título");
    verdadero(/DEMO · CASO FICTICIO/.test(t), "banda DEMO");
    for (const h of ["## 1. Pregunta", "## 3. Fuentes", "## 4. Enunciados", "## 5. Hipótesis", "## 6. Objeciones", "## 7. Flujo de razonamiento", "## 8. Abogado del Diablo", "Historial ("]) verdadero(t.includes(h), `falta ${h}`);
    verdadero(t.includes("Generado 2026-11-07T12:00:00Z"), "fecha de generación");
    for (const f of inv.fuentes) verdadero(t.includes(`| ${f.id} |`), `fuente ${f.id} en la tabla`);
    verdadero(!/\bprobabilidad\b/i.test(t.replace(/no probabilidades/g, "")), "sin probabilidades inventadas");
  });
  prueba("Cierre · informe: es determinista (mismo texto dos veces) y escapa «|» y saltos de línea dentro de las celdas", async () => {
    const d = await construirDemoCSI();
    const inv = d.investigaciones.investigaciones[0];
    igual(informeInvestigacion(inv, { actores: d.actores }), informeInvestigacion(inv, { actores: d.actores }));
    igual(md("a | b\nc"), "a \\| b c");
    igual(md("# no es título"), "\\# no es título");
    igual(md("- no es lista"), "\\- no es lista");
  });
  prueba("Cierre · informe: una investigación 0.2 REAL prospectiva se marca REAL · PROSPECTIVO y lista la fuente PENDIENTE en «Qué falta»", async () => {
    const A = { tipo: "humano", identificador: "prueba" };
    const r0 = await crearInvestigacion({ id: "inv-prueba", titulo: "Prueba", pregunta: "¿Por qué?", acontecimiento: { descripcion: "Algo", fecha: "2027-01-01" }, autor: A, fecha: "2026-11-07T10:00:00Z", es_demo: false, version: "0.2", naturaleza_estudio: "prospectivo" });
    verdadero(r0.ok, r0.errores?.join(" | "));
    const r1 = await aplicarCambio(r0.inv, { accion: "agregar_fuente", datos: { fuente: { id: "f-p", titulo: "Acta", editor: "Instituto", tipo: "documento_oficial", clase: "primaria", estado: "pendiente", publicada_en: "2026-10-01", enlace: "https://example.org/acta", pendiente_motivo: "Sin acceso al PDF.", limitaciones: ["No verificada."] } } }, { autor: A, fecha: "2026-11-07T10:01:00Z" });
    verdadero(r1.ok, r1.errores?.join(" | "));
    const t = informeInvestigacion(r1.inv, { ahora: "2026-11-07T12:00:00Z" });
    verdadero(/REAL · PROSPECTIVO/.test(t), "banda REAL");
    verdadero(/## 9\. Qué falta/.test(t) && /Fuente PENDIENTE f-p/.test(t), "qué falta");
    verdadero(/## 10\. Historial \(2 cambios/.test(t), "historial numerado después de «qué falta»");
  });

  // ---------------- Colección descargable del laboratorio ----------------
  prueba("Cierre · laboratorio: investigaciones.json descargable es una colección que leerCSI lee; reemplaza por id y no mezcla DEMO con REAL", async () => {
    const d = await construirDemoCSI();
    const inv = d.investigaciones.investigaciones[0];
    const sola = coleccionInvestigaciones(inv);
    verdadero(sola.ok && sola.doc.contrato === "cauce.csi.investigaciones" && sola.doc.es_demo === true && sola.doc.investigaciones.length === 1);
    const c = await leerCSI({ investigaciones: sola.doc, actores: d.actores });
    igual(c.errores, []); igual(c.investigaciones.length, 1);
    // Misma investigación sobre la colección existente: reemplaza, no duplica.
    const otra = coleccionInvestigaciones({ ...inv, titulo: "Cambiada" }, d.investigaciones);
    igual(otra.doc.investigaciones.length, d.investigaciones.investigaciones.length);
    igual(otra.doc.investigaciones.at(-1).titulo, "Cambiada");
    // Una investigación REAL con una colección DEMO existente: la DEMO se ignora (nunca se mezclan).
    const real = coleccionInvestigaciones({ ...inv, es_demo: false }, d.investigaciones);
    igual(real.doc.es_demo, false); igual(real.doc.investigaciones.length, 1);
    igual(coleccionInvestigaciones(null).ok, false);
  });

  // ---------------- Caso histórico publicado ----------------
  prueba("Cierre · casos publicados: el índice es válido y su expediente se reconstruye con el motor (12 consultadas, 1 pendiente, 12 huellas)", async () => {
    const ind = JSON.parse(await leerTexto("datos/csi/casos-publicados/indice.json"));
    igual(ind.contrato, "cauce.csi.casos-publicados");
    verdadero(Array.isArray(ind.casos) && ind.casos.length >= 1);
    for (const c of ind.casos) {
      verdadero(/^[\w.-]+\.json$/.test(c.expediente), "nombre de archivo simple");
      verdadero(typeof c.autorizado_por === "string" && /^\d{4}-\d{2}-\d{2}$/.test(c.autorizado_en), "autorización registrada");
      const exp = JSON.parse(await leerTexto(`datos/csi/casos-publicados/${c.expediente}`));
      const r = await construirDesdeExpediente(exp);
      verdadero(r.ok, r.errores.join(" | "));
      const inv = r.docs.investigaciones.investigaciones[0];
      igual(inv.id, c.id);
      igual(inv.naturaleza_estudio, "historico");
      igual(inv.es_demo, false);
      if (c.id === "hist-bns-minimo-2015") {
        const fs = inv.fuentes;
        igual(fs.length, 13, "13 registros de fuente");
        igual(fs.filter((f) => f.estado === "consultada").length, 12, "12 consultadas");
        igual(fs.filter((f) => f.estado === "pendiente").map((f) => f.id), ["f-bns-2011"], "la de 2011 con el enlace equivocado sigue pendiente");
        igual(fs.filter((f) => f.estado === "consultada" && /^[0-9a-f]{64}$/.test(f.huella_contenido ?? "")).length, 12, "12 huellas SHA-256");
        verdadero(fs.find((f) => f.id === "f-bns-2011").enlace !== fs.find((f) => f.id === "f-bns-2011-pdf").enlace, "el enlace equivocado se conserva distinto del real");
        verdadero(!JSON.stringify(exp).includes("D:\\\\") && !/[A-Z]:\\/.test(JSON.stringify(exp)), "sin rutas privadas de Windows");
      }
      // Lo que lee la oficina a partir de lo reconstruido: HISTÓRICO, sin predicciones, sin errores.
      const csi = await leerCSI({ actores: r.docs.actores, investigaciones: r.docs.investigaciones, escenarios: r.docs.escenarios });
      igual(csi.errores, []); igual(csi.naturaleza, "historico");
    }
  });

  // ---------------- Nexus: n_rango y n_comparaciones = null (caso L6) ----------------
  prueba("Cierre · contrato: n_rango = [mín, máx] de enteros; otra forma o un n fuera del rango es error; n null sin rango sigue válido (candidatas EK)", () => {
    const e = (l) => validarLeccion(l).errores;
    igual(e(con((l) => { l.muestra.n = null; l.muestra.n_rango = [10, 50]; })), []);
    verdadero(tiene(e(con((l) => { l.muestra.n_rango = [50, 10]; })), /n_rango: \[mínimo, máximo\]/), "orden");
    verdadero(tiene(e(con((l) => { l.muestra.n_rango = "10-50"; })), /n_rango: \[mínimo, máximo\]/), "texto");
    verdadero(tiene(e(con((l) => { l.muestra.n = 1; l.muestra.n_rango = [10, 50]; })), /fuera de n_rango/), "n fuera del rango");
    igual(e(con((l) => { l.muestra.n = null; })), [], "n null sin rango: válido (conteo aún no conocido)");
    // Con n_rango y sin n, R03 pide n_independiente (no sabe cuántas unidades únicas hay): no evaluado, no «cumple».
    igual(regla(con((l) => { l.muestra.n = null; l.muestra.n_rango = [10, 50]; l.muestra.n_independiente = undefined; }), "R03").estado, "no_evaluado");
  });
  prueba("Cierre · R08 con n_comparaciones = null (no divulgado): rango con mínimo > 1 → no cumple; rango que admite 1 → no evaluado; sin rango → no evaluado; con ajuste → cumple", () => {
    const base = (f) => con((l) => { l.muestra.n_comparaciones = null; l.confianza.nivel = "media"; l.confianza.objeto = "metodo"; f?.(l); });
    const r1 = regla(base((l) => { l.muestra.supuestos = [{ variable: "n_comparaciones_rango", valor: [20, 60], conocido: true }]; }), "R08");
    igual(r1.estado, "no_cumple"); verdadero(/Entre 20 y 60/.test(r1.motivo) && /no divulgado/.test(r1.motivo), r1.motivo);
    const r2 = regla(base((l) => { l.muestra.supuestos = ["Se compararon entre 1 y 8 alternativas; el conteo exacto no se divulga."]; }), "R08");
    igual(r2.estado, "no_evaluado"); verdadero(/\[1, 8\]/.test(r2.motivo), r2.motivo);
    const r3 = regla(base(), "R08");
    igual(r3.estado, "no_evaluado"); verdadero(/no declara un rango/.test(r3.motivo), r3.motivo);
    const r4 = regla(base((l) => { l.muestra.supuestos = [{ variable: "n_comparaciones_rango", valor: [20, 60], conocido: true }, { variable: "ajuste_comparaciones", valor: "holm", conocido: true }]; }), "R08");
    igual(r4.estado, "cumple");
    // Con confianza baja la selección no pesa (como antes): el null no cambia el dictamen.
    igual(regla(con((l) => { l.muestra.n_comparaciones = null; l.confianza.nivel = "baja"; }), "R08").estado, "cumple");
    // Omitir la clave (sin búsqueda de alternativas declarada) sigue como en la fase 1: no se reinterpreta.
    igual(regla(con((l) => { delete l.muestra.n_comparaciones; l.confianza.nivel = "media"; l.confianza.objeto = "metodo"; }), "R08").estado, "cumple");
  });
  prueba("Cierre · rangoComparaciones lee el objeto o el texto y rechaza rangos mal formados", () => {
    igual(rangoComparaciones({ supuestos: [{ variable: "n_comparaciones_rango", valor: [2, 5] }] }), [2, 5]);
    igual(rangoComparaciones({ supuestos: ["Número de comparaciones entre 3 y 12 (no se divulga el exacto)."] }), [3, 12]);
    igual(rangoComparaciones({ supuestos: [{ variable: "n_comparaciones_rango", valor: [5, 2] }] }), null);
    igual(rangoComparaciones({ supuestos: ["costos desconocidos"] }), null);
    igual(rangoComparaciones({}), null);
  });
}
