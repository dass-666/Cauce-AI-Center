// Nexus fase 1 · utilidades comunes: fechas con zona horaria, actores, privacidad y huellas.
// Sin dependencias: corre igual en Node (pruebas y herramientas/nexus.mjs) y en el navegador.

/** Fecha y hora ISO 8601 CON zona horaria (Z o ±hh:mm). «2026-11-06T10:00:00» o «2026-11-06» no sirven. */
const ISO_CON_ZONA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/;

export function esFechaConZona(v) {
  return typeof v === "string" && ISO_CON_ZONA.test(v) && Number.isFinite(Date.parse(v));
}

/** Milisegundos de una fecha válida con zona, o null. Nunca adivina la zona. */
export function ms(v) {
  return esFechaConZona(v) ? Date.parse(v) : null;
}

export const TIPOS_ACTOR = ["humano", "ia", "proceso"];

export function esActor(a) {
  return !!a && typeof a === "object" && TIPOS_ACTOR.includes(a.tipo) && typeof a.id === "string" && a.id.trim() !== "";
}

/** Mismo actor (mismo tipo e id, sin distinguir mayúsculas ni espacios). */
export function mismoActor(a, b) {
  return esActor(a) && esActor(b) && a.tipo === b.tipo && a.id.trim().toLowerCase() === b.id.trim().toLowerCase();
}

export const texto = (v) => typeof v === "string" && v.trim() !== "";

// ---------- Privacidad: Nexus no guarda credenciales ni datos personales ----------
const PATRONES_PRIVADOS = [
  { motivo: "credencial (clave = valor)", re: /\b(contrase(?:ñ|n)a|password|passwd|pwd|secret|secreto|api[_-]?key|access[_-]?key|token|bearer)\b\s*[:=]\s*\S{4,}/i },
  { motivo: "encabezado de autorización", re: /\bauthorization\s*:\s*\S+/i },
  { motivo: "llave privada", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { motivo: "token con formato conocido", re: /\b(?:sk-[A-Za-z0-9_-]{16,}|sk-ant-[A-Za-z0-9_-]{10,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{30,})/ },
  { motivo: "URL con usuario y clave", re: /\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:[^\s/@]+@/i },
  { motivo: "correo electrónico", re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/ },
  { motivo: "CURP", re: /\b[A-Z][AEIOUX][A-Z]{2}\d{6}[HM][A-Z]{5}[A-Z0-9]\d\b/ },
  { motivo: "teléfono", re: /(?:\+\d{1,3}[\s-]?)?\(?\d{2,3}\)?[\s-]\d{3,4}[\s-]\d{4}\b/ },
];

function luhn(digitos) {
  let suma = 0;
  for (let i = 0; i < digitos.length; i++) {
    let d = Number(digitos[digitos.length - 1 - i]);
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    suma += d;
  }
  return suma % 10 === 0;
}

/** Busca datos privados en TODOS los textos (y llaves) de un objeto. Devuelve [{ruta, motivo}]. */
export function buscarDatosPrivados(valor, ruta = "") {
  const hallazgos = [];
  const revisar = (t, r) => {
    for (const p of PATRONES_PRIVADOS) if (p.re.test(t)) hallazgos.push({ ruta: r || "(raíz)", motivo: p.motivo });
    for (const m of t.match(/\b(?:\d[ -]?){13,19}\b/g) ?? []) {
      const d = m.replace(/\D/g, "");
      if (d.length >= 13 && d.length <= 19 && luhn(d)) hallazgos.push({ ruta: r || "(raíz)", motivo: "número de tarjeta" });
    }
  };
  if (typeof valor === "string") revisar(valor, ruta);
  else if (Array.isArray(valor)) valor.forEach((v, i) => hallazgos.push(...buscarDatosPrivados(v, `${ruta}[${i}]`)));
  else if (valor && typeof valor === "object") {
    for (const [k, v] of Object.entries(valor)) {
      revisar(k, `${ruta}.${k}`);
      hallazgos.push(...buscarDatosPrivados(v, ruta ? `${ruta}.${k}` : k));
    }
  }
  return hallazgos;
}

// ---------- Huellas (historial a prueba de borrado) ----------
/** JSON con llaves ordenadas: el mismo contenido da siempre el mismo texto. */
export function jsonCanonico(v) {
  if (Array.isArray(v)) return `[${v.map(jsonCanonico).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${jsonCanonico(v[k])}`).join(",")}}`;
  return JSON.stringify(v ?? null);
}

/** SHA-256 en hexadecimal (Web Crypto: existe en Node 18+ y en navegadores en 127.0.0.1). */
export async function sha256(textoPlano) {
  const datos = new TextEncoder().encode(textoPlano);
  const h = await globalThis.crypto.subtle.digest("SHA-256", datos);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const huellaDe = (registro) => sha256(jsonCanonico(registro));
export const esHuella = (v) => typeof v === "string" && /^[0-9a-f]{64}$/.test(v);
