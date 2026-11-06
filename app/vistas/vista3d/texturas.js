// Fase M: texturas dibujadas con código en un <canvas> (sin imágenes descargadas ni recursos de pago).
// Todas son chicas (128–512 px) y se crean una vez por vista 3D: los cuartos las comparten.

import * as THREE from "three";
import { ATLAS, PICTOGRAMAS, COLORES_PICTOGRAMA as C } from "./estilo-visual.js";

function lienzo(w, h = w) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return [c, c.getContext("2d")];
}
function repetible(c) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
/** Ruido determinista (sin Math.random: la misma textura en cada carga). */
function ruido(semilla) {
  let s = semilla >>> 0;
  return () => { s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0; return s / 4294967296; };
}

/** Duela de madera (la de siempre, con vetas suaves). Un tramo de 2 m se repite. */
export function texturaDuela() {
  const [c, ctx] = lienzo(128);
  const tonos = ["#a07a52", "#9a7450", "#a68058", "#97714c"];
  const r = ruido(7);
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = tonos[i];
    ctx.fillRect(0, i * 32, 128, 32);
    ctx.fillStyle = "rgba(70,45,22,0.18)";
    for (let k = 0; k < 6; k++) ctx.fillRect(0, i * 32 + 4 + r() * 24, 128, 1); // vetas
    ctx.fillStyle = "rgba(60,40,20,0.35)";
    ctx.fillRect(0, i * 32, 128, 2);
    ctx.fillRect(((i * 53) % 96) + 16, i * 32, 2, 32); // junta entre tablas
  }
  return repetible(c);
}

/** Alfombra modular: losetas de 50 cm en dos tonos con textura de fibra. */
export function texturaAlfombra() {
  const [c, ctx] = lienzo(128);
  const r = ruido(11);
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    ctx.fillStyle = (i + j) % 2 ? "#5b6274" : "#646b7e";
    ctx.fillRect(i * 64, j * 64, 64, 64);
    // fibra: rayitas en la dirección de cada loseta (alternada, como se instalan)
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    for (let k = 0; k < 40; k++) {
      const x = i * 64 + r() * 64, y = j * 64 + r() * 64;
      if ((i + j) % 2) ctx.fillRect(x, y, 6, 1); else ctx.fillRect(x, y, 1, 6);
    }
  }
  ctx.strokeStyle = "rgba(20,24,34,0.35)";
  ctx.lineWidth = 1;
  for (const k of [0, 64]) { ctx.strokeRect(k + 0.5, 0.5, 63, 127); ctx.strokeRect(0.5, k + 0.5, 127, 63); }
  return repetible(c);
}

/** Concreto pulido: gris cálido con manchas suaves y juntas cada 2 m. */
export function texturaConcreto() {
  const [c, ctx] = lienzo(128);
  ctx.fillStyle = "#9a9ca1";
  ctx.fillRect(0, 0, 128, 128);
  const r = ruido(23);
  for (let k = 0; k < 140; k++) { // moteado fino (agregado del concreto), sin manchas grandes
    ctx.fillStyle = `rgba(${r() > 0.5 ? "255,255,255" : "40,40,46"},${0.04 + r() * 0.05})`;
    ctx.fillRect(r() * 128, r() * 128, 1 + r() * 2, 1 + r() * 2);
  }
  ctx.fillStyle = "rgba(40,42,50,0.45)";
  ctx.fillRect(0, 0, 128, 1); ctx.fillRect(0, 0, 1, 128);
  return repetible(c);
}

/** Vinil en losetas claras (tipo laboratorio o archivo) con junta fina. */
export function texturaVinil() {
  const [c, ctx] = lienzo(128);
  const r = ruido(31);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const v = 168 + Math.round(r() * 10);
    ctx.fillStyle = `rgb(${v - 6},${v - 2},${v + 4})`;
    ctx.fillRect(i * 32, j * 32, 32, 32);
    ctx.fillStyle = "rgba(90,96,110,0.25)";
    for (let k = 0; k < 4; k++) ctx.fillRect(i * 32 + r() * 30, j * 32 + r() * 30, 2, 2); // moteado
  }
  ctx.strokeStyle = "rgba(80,86,100,0.45)";
  for (let k = 0; k <= 128; k += 32) { ctx.beginPath(); ctx.moveTo(k + 0.5, 0); ctx.lineTo(k + 0.5, 128); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, k + 0.5); ctx.lineTo(128, k + 0.5); ctx.stroke(); }
  return repetible(c);
}

/**
 * Atlas de pantallas ambientales: pictogramas abstractos SIN cifras ni ejes con valores, en colores fríos que
 * no son colores de estado. Son ambientación: nunca muestran datos de los proyectos.
 */
export function texturaAtlasPantallas() {
  const T = ATLAS.celda;
  const [c, ctx] = lienzo(T * ATLAS.columnas, T * ATLAS.filas);
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  PICTOGRAMAS.forEach((nombre, i) => {
    const x0 = (i % ATLAS.columnas) * T, y0 = Math.floor(i / ATLAS.columnas) * T;
    ctx.save();
    ctx.translate(x0, y0);
    ctx.fillStyle = C.fondo; ctx.fillRect(0, 0, T, T);
    // barra de título genérica (sin texto)
    ctx.fillStyle = C.tenue; ctx.fillRect(8, 8, T - 16, 10);
    ctx.fillStyle = C.suave; ctx.fillRect(12, 11, 26, 4);
    dibujarPictograma(ctx, nombre, T);
    ctx.restore();
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function dibujarPictograma(ctx, nombre, T) {
  const linea = (pts, color = C.linea, ancho = 3) => {
    ctx.strokeStyle = color; ctx.lineWidth = ancho; ctx.beginPath();
    pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
  };
  const caja = (x, y, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };
  const renglones = (x, y, n, w) => { for (let k = 0; k < n; k++) caja(x, y + k * 10, w * (k % 3 === 2 ? 0.6 : 1), 4, k % 2 ? C.tenue : C.suave); };
  switch (nombre) {
    case "archivos": // cuadrícula de documentos
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
        const x = 16 + i * 34, y = 30 + j * 46;
        caja(x, y, 26, 34, C.tenue); caja(x + 4, y + 6, 18, 3, C.suave); caja(x + 4, y + 12, 14, 3, C.linea);
      }
      break;
    case "busqueda": // lupa sobre renglones
      renglones(16, 32, 8, 70);
      ctx.strokeStyle = C.blanco; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(84, 66, 20, 0, Math.PI * 2); ctx.stroke();
      linea([[98, 80], [114, 98]], C.blanco, 7);
      break;
    case "lista": // casillas con palomitas
      for (let k = 0; k < 5; k++) {
        const y = 32 + k * 18;
        ctx.strokeStyle = C.suave; ctx.lineWidth = 2; ctx.strokeRect(16, y, 10, 10);
        if (k < 3) linea([[17, y + 5], [21, y + 9], [27, y - 1]], C.blanco, 2);
        caja(34, y + 3, 70 - (k % 2) * 20, 4, C.tenue);
      }
      break;
    case "comparar": // dos paneles lado a lado con siluetas de barras (sin ejes)
      for (const [x, alturas] of [[12, [30, 48, 22, 40]], [68, [38, 26, 52, 30]]]) {
        caja(x, 26, 48, 90, "#122339");
        alturas.forEach((h, k) => caja(x + 6 + k * 10, 110 - h, 7, h, k % 2 ? C.suave : C.linea));
      }
      break;
    case "curva": { // línea suave sin escala
      const pts = []; for (let x = 12; x <= 116; x += 4) pts.push([x, 76 - Math.sin(x / 15) * 18 - Math.sin(x / 7) * 6]);
      linea(pts, C.linea, 3);
      linea(pts.map(([x, y]) => [x, y + 18]), C.tenue, 2);
      break;
    }
    case "historial": // línea de tiempo con puntos
      linea([[20, 30], [20, 112]], C.tenue, 3);
      for (let k = 0; k < 5; k++) { const y = 36 + k * 18; ctx.fillStyle = C.suave; ctx.beginPath(); ctx.arc(20, y, 5, 0, Math.PI * 2); ctx.fill(); caja(32, y - 2, 60 - (k % 3) * 12, 4, C.tenue); }
      break;
    case "mosaico": // mosaico neutro (no son estados)
      for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) caja(14 + i * 26, 30 + j * 28, 22, 22, (i + j) % 3 ? C.tenue : "#1f3a5c");
      break;
    case "red": { // nodos y enlaces
      const n = [[30, 44], [92, 40], [64, 76], [24, 104], [100, 102]];
      for (const [a, b] of [[0, 2], [1, 2], [2, 3], [2, 4], [0, 1]]) linea([n[a], n[b]], C.tenue, 2);
      for (const [x, y] of n) { ctx.fillStyle = C.suave; ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill(); }
      break;
    }
    case "documento": // hoja con renglones
      caja(30, 26, 68, 92, "#1a2e48"); renglones(38, 38, 8, 50);
      break;
    case "escenarios": { // abanico de curvas (escenarios, sin valores)
      for (let k = -2; k <= 2; k++) {
        const pts = []; for (let x = 16; x <= 112; x += 6) pts.push([x, 70 - (x - 16) * k * 0.18 - Math.sin(x / 12) * 4]);
        linea(pts, k === 0 ? C.blanco : k % 2 ? C.tenue : C.linea, k === 0 ? 3 : 2);
      }
      break;
    }
    case "mapa": // mapa abstracto con contornos
      for (let k = 0; k < 4; k++) { ctx.strokeStyle = k % 2 ? C.tenue : C.linea; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(64, 72, 46 - k * 10, 34 - k * 8, 0.3, 0, Math.PI * 2); ctx.stroke(); }
      break;
    case "barras": // barras horizontales (sin cifras)
      for (let k = 0; k < 5; k++) caja(16, 32 + k * 17, 30 + ((k * 37) % 60), 9, k % 2 ? C.tenue : C.linea);
      break;
  }
}

/**
 * Sombra de contacto: degradado de oscuro (abajo, v = 0) a transparente (arriba, v = 1). Se usa en tiras
 * pegadas a los muros y bajo los muebles grandes: da profundidad sin sombras en tiempo real.
 */
export function texturaSombraContacto() {
  const [c, ctx] = lienzo(4, 64);
  const g = ctx.createLinearGradient(0, 64, 0, 0);
  g.addColorStop(0, "rgba(0,0,0,0.55)");
  g.addColorStop(0.35, "rgba(0,0,0,0.22)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 64);
  return new THREE.CanvasTexture(c);
}

/** Resplandor de pantalla: degradado radial blanco → transparente (se tiñe con el color del material). */
export function texturaResplandor() {
  const [c, ctx] = lienzo(64);
  const g = ctx.createRadialGradient(32, 32, 1, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,0.9)");
  g.addColorStop(0.45, "rgba(255,255,255,0.35)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
