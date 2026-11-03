// Ayudante para crear elementos. Todo texto entra como textContent: los datos de los
// adaptadores nunca se interpretan como HTML.

export function el(etiqueta, atributos = {}, ...hijos) {
  const nodo = document.createElement(etiqueta);
  for (const [k, v] of Object.entries(atributos)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "clase") nodo.className = v;
    else if (typeof v === "function" && k.startsWith("on")) nodo.addEventListener(k.slice(2).toLowerCase(), v);
    else nodo.setAttribute(k, v === true ? "" : String(v));
  }
  for (const h of hijos.flat()) {
    if (h === null || h === undefined || h === false) continue;
    nodo.append(h instanceof Node ? h : document.createTextNode(String(h)));
  }
  return nodo;
}

const FORMATO = new Intl.DateTimeFormat("es-MX", {
  timeZone: "America/Mexico_City",
  dateStyle: "medium",
  timeStyle: "short",
});

export function fecha(iso) {
  return iso ? FORMATO.format(new Date(iso)) : "No disponible";
}

const FORMATO_HORA = new Intl.DateTimeFormat("es-MX", { timeZone: "America/Mexico_City", hour: "numeric", minute: "2-digit" });

export function hora(iso) {
  return iso ? FORMATO_HORA.format(new Date(iso)) : "—";
}
