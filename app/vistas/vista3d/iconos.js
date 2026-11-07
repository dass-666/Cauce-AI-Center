// Símbolos de cada tema dibujados con líneas en un <canvas> (sin imágenes ni fuentes externas).

export function dibujarIcono(ctx, tema, cx, cy, r, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(3, r * 0.16);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const linea = (...p) => { ctx.beginPath(); ctx.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]); ctx.stroke(); };
  const circulo = (x, y, rr, relleno = false) => { ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); relleno ? ctx.fill() : ctx.stroke(); };
  switch (tema) {
    case "importacion": // caja
      ctx.strokeRect(cx - r * 0.75, cy - r * 0.45, r * 1.5, r * 1.15);
      linea(cx - r * 0.75, cy - r * 0.45, cx - r * 0.5, cy - r * 0.8, cx + r * 0.5, cy - r * 0.8, cx + r * 0.75, cy - r * 0.45);
      linea(cx, cy - r * 0.45, cx, cy + r * 0.1);
      break;
    case "busqueda": // lupa
      circulo(cx - r * 0.2, cy - r * 0.2, r * 0.5);
      linea(cx + r * 0.16, cy + r * 0.16, cx + r * 0.75, cy + r * 0.75);
      break;
    case "fuentes": // lista
      for (let i = -1; i <= 1; i++) { circulo(cx - r * 0.6, cy + i * r * 0.5, r * 0.1, true); linea(cx - r * 0.3, cy + i * r * 0.5, cx + r * 0.75, cy + i * r * 0.5); }
      break;
    case "oportunidades": // diana
      circulo(cx, cy, r * 0.8); circulo(cx, cy, r * 0.45); circulo(cx, cy, r * 0.12, true);
      break;
    case "margenes": // moneda
      circulo(cx, cy, r * 0.8);
      ctx.font = `bold ${Math.round(r * 1.1)}px system-ui, sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("$", cx, cy + r * 0.05);
      break;
    case "auditoria": // palomita en cuadro
      ctx.strokeRect(cx - r * 0.7, cy - r * 0.7, r * 1.4, r * 1.4);
      linea(cx - r * 0.4, cy, cx - r * 0.1, cy + r * 0.3, cx + r * 0.45, cy - r * 0.35);
      break;
    case "supervision": // ojo
      ctx.beginPath(); ctx.ellipse(cx, cy, r * 0.85, r * 0.45, 0, 0, Math.PI * 2); ctx.stroke();
      circulo(cx, cy, r * 0.22, true);
      break;
    case "integracion": // eslabones
      ctx.beginPath(); ctx.ellipse(cx - r * 0.3, cy, r * 0.5, r * 0.3, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(cx + r * 0.3, cy, r * 0.5, r * 0.3, 0, 0, Math.PI * 2); ctx.stroke();
      break;
    case "comercial": // carrito de compras (estilo de piso, fase L)
      linea(cx - r * 0.85, cy - r * 0.6, cx - r * 0.55, cy - r * 0.6, cx - r * 0.3, cy + r * 0.3, cx + r * 0.6, cy + r * 0.3, cx + r * 0.8, cy - r * 0.35, cx - r * 0.45, cy - r * 0.35);
      circulo(cx - r * 0.2, cy + r * 0.65, r * 0.13, true); circulo(cx + r * 0.5, cy + r * 0.65, r * 0.13, true);
      break;
    case "financiero": // columnas de un edificio financiero
      linea(cx - r * 0.85, cy - r * 0.35, cx, cy - r * 0.85, cx + r * 0.85, cy - r * 0.35, cx - r * 0.85, cy - r * 0.35);
      for (const dx of [-0.55, 0, 0.55]) linea(cx + dx * r, cy - r * 0.2, cx + dx * r, cy + r * 0.5);
      linea(cx - r * 0.85, cy + r * 0.72, cx + r * 0.85, cy + r * 0.72);
      break;
    case "alimentos": // tenedor y cuchillo
      linea(cx - r * 0.35, cy - r * 0.85, cx - r * 0.35, cy + r * 0.85);
      linea(cx - r * 0.6, cy - r * 0.85, cx - r * 0.6, cy - r * 0.3, cx - r * 0.1, cy - r * 0.3, cx - r * 0.1, cy - r * 0.85);
      linea(cx + r * 0.45, cy + r * 0.85, cx + r * 0.45, cy - r * 0.85);
      ctx.beginPath(); ctx.moveTo(cx + r * 0.45, cy - r * 0.85); ctx.quadraticCurveTo(cx + r * 0.85, cy - r * 0.3, cx + r * 0.45, cy); ctx.stroke();
      break;
    case "servicios": // llave inglesa simplificada
      circulo(cx - r * 0.35, cy - r * 0.35, r * 0.35);
      linea(cx - r * 0.1, cy - r * 0.1, cx + r * 0.75, cy + r * 0.75);
      break;
    default: // rombo
      linea(cx, cy - r * 0.75, cx + r * 0.75, cy, cx, cy + r * 0.75, cx - r * 0.75, cy, cx, cy - r * 0.75);
  }
  ctx.restore();
}

export const hex = (n) => `#${n.toString(16).padStart(6, "0")}`;
